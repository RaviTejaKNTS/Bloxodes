import "../shared/load-env";

import { spawnSync } from "node:child_process";

type Suite = "deterministic" | "build" | "postdeploy";

type Command = {
  label: string;
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
};

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(step: Command) {
  console.log(`\n[quality] ${step.label}`);
  const result = spawnSync(step.command, step.args, {
    cwd: process.cwd(),
    env: { ...process.env, ...step.env },
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function npmRun(script: string, label = script, trailingArgs: string[] = []): Command {
  return {
    label,
    command: npm,
    args: ["run", script, ...(trailingArgs.length ? ["--", ...trailingArgs] : [])]
  };
}

function parseSuite(): Suite {
  const suite = process.argv[2] ?? "deterministic";
  if (!(["deterministic", "build", "postdeploy"] as const).includes(suite as Suite)) {
    throw new Error(`Unknown quality suite: ${suite}`);
  }
  return suite as Suite;
}

const deterministic = [
  npmRun("lint", "ESLint"),
  npmRun("test:universe-stats-pipeline", "Universe stats pipeline contracts"),
  npmRun("typecheck:web", "Web TypeScript"),
  npmRun("test:unit:web", "Vitest unit and contract tests"),
  npmRun("test:coverage:web", "Coverage thresholds"),
  npmRun("test:page-contracts", "Page-family contracts"),
  npmRun("test:dates", "Date contracts"),
  npmRun("test:structured-data", "Structured-data contracts")
];

const suite = parseSuite();
if (suite === "deterministic") {
  deterministic.forEach(run);
} else if (suite === "build") {
  [
    ...deterministic,
    npmRun("audit:game-collection-datasets", "Game-collection dataset contracts"),
    npmRun("validate:published-content", "Published-content validation"),
    npmRun("build:web", "Next.js production build")
  ].forEach(run);
} else {
  const target = process.env.TEST_BASE_URL || process.env.POSTDEPLOY_BASE_URL;
  if (!target || !/^https?:\/\//.test(target)) {
    throw new Error("verify:postdeploy requires TEST_BASE_URL or POSTDEPLOY_BASE_URL");
  }
  [
    npmRun("test:production-smoke", "Production smoke and build identity"),
    npmRun("test:sitemaps", "Production sitemap crawl", ["--all"]),
    npmRun("test:seo", "Production SEO audit"),
    npmRun("test:routes", "Production bot and route audit"),
    { ...npmRun("test:render", "Production rendering"), env: { PLAYWRIGHT_SKIP_WEBSERVER: "1" } }
  ].forEach(run);
}
