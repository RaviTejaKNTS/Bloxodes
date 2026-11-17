import { execFileSync } from "node:child_process";
import fs from "node:fs";

export const allBrowserSpecs = ["release-smoke", "ci-data-source", "catalog-covers", "site-route-parity", "shared-game-registry", "game-page-type-urls", "specialized-franchise-page-type-urls"];
const smokeSpecs = allBrowserSpecs.slice(0, 2);
const gameSpecs = allBrowserSpecs.slice(3);

const rootWebDependency = /^(?:[^/]*config\.[^/]+|(?:middleware|proxy)\.[jt]s|\.(?:browserslistrc|npmrc|nvmrc|node-version))$/;
const isWebDependency = file => rootWebDependency.test(file) || /^(apps\/web\/|data\/|scripts\/|supabase\/|env\/|\.github\/|package(-lock)?\.json$|Dockerfile$)/.test(file);

// Unknown web paths and shared dependencies receive every spec. Narrow only
// route families whose callers are covered by the named suites.
export function browserScope(files, web) {
  const specs = new Set(smokeSpecs);
  let catalogRegression = false;
  for (const file of files) {
    if (!web) break;
    const route = file.match(/^apps\/web\/src\/app\/\(site\)\/([^/]+)\//)?.[1];
    if (route === "catalog" || /^apps\/web\/src\/app\/(api\/roblox-(music|decal|mesh)-ids|catalog-image)\//.test(file)) {
      for (const spec of ["catalog-covers", ...gameSpecs]) specs.add(spec);
      catalogRegression = true;
    } else if (["wiki", "games", "codes", "tools", "maps", "quizzes", "checklists", "[slug]", "[...slug]"].includes(route)) {
      for (const spec of gameSpecs) specs.add(spec);
    } else if (["articles", "authors", "events", "puzzles", "stats"].includes(route)) {
      specs.add("site-route-parity");
    } else if (isWebDependency(file)) {
      return { browser_specs: allBrowserSpecs.map(spec => `apps/web/e2e/${spec}.spec.ts`).join(" "), catalog_regression: true };
    }
  }
  return { browser_specs: web ? allBrowserSpecs.filter(spec => specs.has(spec)).map(spec => `apps/web/e2e/${spec}.spec.ts`).join(" ") : "", catalog_regression: web && catalogRegression };
}

export function classify(files) {
  const code = files.filter(file => !file.endsWith("/AGENTS.md") && !/^(AGENTS\.md|DESIGN\.md|bloxodes-docs\/|\.agents\/|\.claude\/|\.codex\/)/.test(file));
  const scope = {
    checks: code.length > 0,
    migrations: code.some(file => file.startsWith("supabase/migrations/") || file === "supabase/migration-policy.json" || file === "scripts/ci/fixtures/schema.json"),
    web: code.some(isWebDependency),
    extension: code.some(file => /^(apps\/extension\/|tsconfig\.json$|package(-lock)?\.json$|\.github\/)/.test(file)),
    admin: code.some(file => /^(apps\/admin-extension\/|tsconfig\.json$|package(-lock)?\.json$|\.github\/)/.test(file)),
    mobile: code.some(file => /^(apps\/mobile\/|tsconfig\.json$|package(-lock)?\.json$|\.github\/)/.test(file)),
    schema: code.some(file => /^(supabase\/migrations\/|supabase\/migration-policy\.json$|scripts\/ci\/|scripts\/ops\/release-production-schema\.ts$|scripts\/ops\/studio-container-psql\.mjs$|\.github\/workflows\/)/.test(file))
  };
  return { ...scope, ...browserScope(code, scope.web) };
}

if (process.argv[1]?.endsWith("change-scope.mjs")) {
  const base = process.env.BASE_SHA;
  const head = process.env.HEAD_SHA;
  if (!/^[0-9a-f]{40}$/.test(base ?? "") || !/^[0-9a-f]{40}$/.test(head ?? "")) throw new Error("Full base and head SHAs are required.");
  const files = execFileSync("git", ["diff", "--name-only", "-z", base, head], { encoding: "utf8" }).split("\0").filter(Boolean);
  const scope = classify(files);
  for (const [key, value] of Object.entries(scope)) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  console.log(JSON.stringify(scope));
}
