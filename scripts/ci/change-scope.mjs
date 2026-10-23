import { execFileSync } from "node:child_process";
import fs from "node:fs";

export function classify(files) {
  const code = files.filter(file => !file.endsWith("/AGENTS.md") && !/^(AGENTS\.md|DESIGN\.md|bloxodes-docs\/|\.agents\/|\.claude\/|\.codex\/)/.test(file));
  return {
    checks: code.length > 0,
    migrations: code.some(file => file.startsWith("supabase/migrations/")),
    codeLookups: code.some(file => ["apps/web/src/lib/db.ts", "apps/web/src/lib/extension-codes.ts",
      "apps/web/src/lib/__tests__/code-lookups.test.ts", "scripts/ci/code-lookups-qa.mjs",
      ".github/workflows/pull-request.yml"].includes(file)),
    statsPrepared: code.some(file => /(?:stats-prepared|prepared-charts|stats-chart)/.test(file)
      || file.startsWith("supabase/migrations/") || file.startsWith("apps/web/src/app/(site)/stats/components/")
      || ["apps/web/src/lib/stats.ts", "apps/web/src/lib/stats-visit-share.ts", "apps/web/src/app/api/revalidate/route.ts",
        "apps/web/src/app/api/stats/platform/chart/route.ts", "apps/web/src/app/api/stats/visit-share/route.ts",
        ".github/workflows/pull-request.yml", ".github/workflows/stats-health-monitor.yml"].includes(file)),
    web: code.some(file => /^(apps\/web\/|data\/|scripts\/|supabase\/|env\/|\.github\/|package(-lock)?\.json$|Dockerfile$)/.test(file)),
    extension: code.some(file => /^(apps\/extension\/|package(-lock)?\.json$|\.github\/)/.test(file)),
    admin: code.some(file => /^(apps\/admin-extension\/|package(-lock)?\.json$|\.github\/)/.test(file)),
    mobile: code.some(file => /^(apps\/mobile\/|package(-lock)?\.json$|\.github\/)/.test(file)),
    schema: code.some(file => /^(supabase\/migrations\/|supabase\/migration-policy\.json$|scripts\/ci\/|scripts\/ops\/release-production-schema\.ts$|scripts\/ops\/studio-container-psql\.mjs$|\.github\/workflows\/)/.test(file))
  };
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
