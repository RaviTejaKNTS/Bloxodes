import "../shared/load-env";

import { spawn } from "node:child_process";

type Options = {
  allowLive: boolean;
  lightLimit: number;
  newStatsLimit: number;
  hotStatsLimit: number;
  warmStatsLimit: number;
  coldStatsLimit: number;
  deepLimit: number;
  refreshLists: boolean;
  skipDiscovery: boolean;
  skipLight: boolean;
  skipTier: boolean;
};

type Step = {
  name: string;
  args: string[];
  enabled: boolean;
};

function readNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    allowLive: false,
    lightLimit: readNumber(process.env.UNIVERSE_PIPELINE_LIGHT_LIMIT, 500),
    newStatsLimit: readNumber(process.env.UNIVERSE_PIPELINE_NEW_STATS_LIMIT, 1000),
    hotStatsLimit: readNumber(process.env.UNIVERSE_PIPELINE_HOT_STATS_LIMIT, 0),
    warmStatsLimit: readNumber(process.env.UNIVERSE_PIPELINE_WARM_STATS_LIMIT, 0),
    coldStatsLimit: readNumber(process.env.UNIVERSE_PIPELINE_COLD_STATS_LIMIT, 0),
    deepLimit: readNumber(process.env.UNIVERSE_PIPELINE_DEEP_LIMIT, 0),
    refreshLists: false,
    skipDiscovery: false,
    skipLight: false,
    skipTier: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--allow-live") {
      options.allowLive = true;
    } else if (arg === "--light-limit") {
      options.lightLimit = readNumber(args[i + 1], options.lightLimit);
      i += 1;
    } else if (arg === "--new-stats-limit") {
      options.newStatsLimit = readNumber(args[i + 1], options.newStatsLimit);
      i += 1;
    } else if (arg === "--hot-stats-limit") {
      options.hotStatsLimit = readNumber(args[i + 1], options.hotStatsLimit);
      i += 1;
    } else if (arg === "--warm-stats-limit") {
      options.warmStatsLimit = readNumber(args[i + 1], options.warmStatsLimit);
      i += 1;
    } else if (arg === "--cold-stats-limit") {
      options.coldStatsLimit = readNumber(args[i + 1], options.coldStatsLimit);
      i += 1;
    } else if (arg === "--deep-limit") {
      options.deepLimit = readNumber(args[i + 1], options.deepLimit);
      i += 1;
    } else if (arg === "--refresh-lists") {
      options.refreshLists = true;
    } else if (arg === "--skip-discovery" || arg === "--skip-search" || arg === "--skip-creators") {
      options.skipDiscovery = true;
    } else if (arg === "--skip-light") {
      options.skipLight = true;
    } else if (arg === "--skip-tier") {
      options.skipTier = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Usage: npm run pipeline:universes -- [options]

Local-safe orchestration for the universe discovery pipeline.

Options:
  --allow-live              Allow non-local SUPABASE_URL targets
  --skip-discovery          Skip Explore universe collection
  --light-limit <number>    Light enrichment limit; 0 skips (default: 500)
  --new-stats-limit <n>     Refresh NEW game stats; 0 skips
  --hot-stats-limit <n>     Refresh HOT game stats and today's rollup; 0 skips
  --warm-stats-limit <n>    Refresh WARM game stats; 0 skips
  --cold-stats-limit <n>    Refresh COLD game stats; 0 skips
  --deep-limit <number>     Deep-enrich HOT rows; 0 skips
  --refresh-lists           Refresh game lists at the end
  --skip-light              Skip light enrichment
  --skip-tier               Skip stats tier assignment
  -h, --help                Show this help text
`);
}

function isLocalSupabaseUrl(value: string | undefined) {
  if (!value) return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/i.test(value);
}

function assertSafeTarget(options: Options) {
  if (options.allowLive) return;
  if (isLocalSupabaseUrl(process.env.SUPABASE_URL)) return;
  throw new Error(
    `Refusing to run universe pipeline against non-local SUPABASE_URL (${process.env.SUPABASE_URL ?? "unset"}). Use --allow-live when intentionally running outside local Supabase.`
  );
}

function npmStep(name: string, script: string, args: string[], enabled: boolean): Step {
  return {
    name,
    enabled,
    args: ["run", script, "--", ...args]
  };
}

function buildSteps(options: Options): Step[] {
  return [
    npmStep("Explore discovery", "collect:universes", [], !options.skipDiscovery),
    npmStep(
      "Light enrichment",
      "enrich:universes:light",
      ["--limit", String(options.lightLimit)],
      !options.skipLight && options.lightLimit > 0
    ),
    npmStep(
      "NEW stats refresh",
      "stats:refresh",
      ["--tier", "NEW", "--limit", String(options.newStatsLimit)],
      options.newStatsLimit > 0
    ),
    npmStep(
      "Stats tier assignment",
      "stats:tier",
      ["--limit", "0"],
      !options.skipTier
    ),
    npmStep(
      "HOT stats refresh",
      "stats:refresh",
      ["--tier", "HOT", "--limit", String(options.hotStatsLimit)],
      options.hotStatsLimit > 0
    ),
    npmStep(
      "WARM stats refresh",
      "stats:refresh",
      ["--tier", "WARM", "--limit", String(options.warmStatsLimit)],
      options.warmStatsLimit > 0
    ),
    npmStep(
      "COLD stats refresh",
      "stats:refresh",
      ["--tier", "COLD", "--limit", String(options.coldStatsLimit)],
      options.coldStatsLimit > 0
    ),
    npmStep(
      "Hourly stats rank snapshots",
      "stats:rank",
      [
        "--all",
        "--granularity",
        "hourly",
        "--rank-set",
        "playing",
        "--snapshot-scope",
        "relevant",
        "--limit",
        String(Math.max(options.hotStatsLimit, 250))
      ],
      options.hotStatsLimit > 0
    ),
    npmStep(
      "Deep enrichment",
      "enrich:universes:deep",
      ["--tier", "HOT", "--limit", String(options.deepLimit)],
      options.deepLimit > 0
    ),
    npmStep("List refresh", "lists:refresh", [], options.refreshLists)
  ];
}

function runStep(step: Step): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n▶ ${step.name}: npm ${step.args.join(" ")}`);
    const child = spawn("npm", step.args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${step.name} exited with code ${code}`));
    });
  });
}

async function main() {
  const options = parseArgs();
  assertSafeTarget(options);
  const steps = buildSteps(options).filter((step) => step.enabled);
  if (!steps.length) {
    console.log("No universe pipeline steps enabled.");
    return;
  }

  console.log(`Running universe pipeline against ${process.env.SUPABASE_URL}`);
  for (const step of steps) {
    await runStep(step);
  }
  console.log("\nUniverse pipeline complete.");
}

main().catch((error) => {
  console.error("Universe pipeline failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
