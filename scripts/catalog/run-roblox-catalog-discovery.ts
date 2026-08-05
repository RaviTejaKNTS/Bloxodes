import "../shared/load-env";

import { spawn } from "node:child_process";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";
import { expireStaleCatalogDiscoveryRuns } from "./catalog-discovery-db";

const FAMILIES = [
  { name: "accessories", script: "collect:accessory-items" },
  { name: "body", script: "collect:body-items" },
  { name: "clothing", script: "collect:clothing-items" },
  { name: "avatar-animations", script: "collect:avatar-animation-items" },
  { name: "makeup", script: "collect:makeup-items" }
] as const;

const ROTATION_WINDOW_HOURS = Math.max(1, Math.floor(Number(process.env.ROBLOX_CATALOG_ROTATION_WINDOW_HOURS ?? "6")));
const ROTATION_OFFSET = Math.max(
  0,
  Math.floor(Number(process.env.ROBLOX_CATALOG_ROTATION_OFFSET ?? Math.floor(Date.now() / (ROTATION_WINDOW_HOURS * 3_600_000))))
);

function selectedFamilies() {
  const familyIndex = process.argv.indexOf("--family");
  if (familyIndex < 0) return [...FAMILIES];
  const requested = new Set((process.argv[familyIndex + 1] ?? "").split(",").map((value) => value.trim()).filter(Boolean));
  const selected = FAMILIES.filter((family) => requested.has(family.name));
  if (!selected.length) throw new Error(`Unknown catalog family. Use: ${FAMILIES.map((family) => family.name).join(", ")}`);
  return selected;
}

function runNpmScript(script: string) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn("npm", ["run", script], {
      stdio: "inherit",
      env: { ...process.env, ROBLOX_CATALOG_ROTATION_OFFSET: String(ROTATION_OFFSET) }
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`${script} terminated by ${signal}`));
      else resolve(code ?? 1);
    });
  });
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(`Usage: npm run collect:catalog-items -- [--family ${FAMILIES.map((family) => family.name).join("|")}]`);
    return;
  }

  const families = selectedFamilies();
  const expiredDiscoveryRuns = await expireStaleCatalogDiscoveryRuns();
  const run = await startStatsJobRun({
    jobName: "catalog_items_discovery_orchestrator",
    metadata: {
      families: families.map((family) => family.name),
      rotation_offset: ROTATION_OFFSET,
      rotation_window_hours: ROTATION_WINDOW_HOURS,
      expired_discovery_runs: expiredDiscoveryRuns
    }
  });
  const results: Array<{ family: string; status: "success" | "failed"; exitCode?: number; error?: string }> = [];

  for (const family of families) {
    console.log(`\nStarting Roblox catalog discovery family: ${family.name}`);
    try {
      const exitCode = await runNpmScript(family.script);
      results.push({ family: family.name, status: exitCode === 0 ? "success" : "failed", exitCode });
    } catch (error) {
      results.push({ family: family.name, status: "failed", error: error instanceof Error ? error.message : String(error) });
    }
  }

  const failed = results.filter((result) => result.status === "failed");
  const succeeded = results.length - failed.length;
  const status = failed.length === 0 ? "success" : succeeded > 0 ? "partial" : "failed";
  await finishStatsJobRun(run, {
    status,
    rowsClaimed: results.length,
    rowsSucceeded: succeeded,
    rowsFailed: failed.length,
    metadata: { results, expired_discovery_runs: expiredDiscoveryRuns }
  });
  console.log(JSON.stringify({ status, results }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
