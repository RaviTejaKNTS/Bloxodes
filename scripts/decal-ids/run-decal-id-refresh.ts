#!/usr/bin/env tsx

import "../shared/load-env";

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { startStatsJobRun, finishStatsJobRun } from "../shared/stats-job-run";
import { decalDiscoveryHealth, parseDecalStepCounts } from "../shared/decal-discovery";

type Step = {
  name: string;
  script: string;
  env?: Record<string, string>;
};

const LOCK_DIR = process.env.ROBLOX_DECAL_REFRESH_LOCK_DIR ?? path.join(os.tmpdir(), "bloxodes-decal-id-refresh.lock");
const NODE_BIN = process.execPath;
const TSX_CLI = path.resolve("node_modules", "tsx", "dist", "cli.mjs");
const SKIP_IMPORT = isTruthy(process.env.ROBLOX_DECAL_REFRESH_SKIP_IMPORT);
const SKIP_COLLECT = isTruthy(process.env.ROBLOX_DECAL_REFRESH_SKIP_COLLECT);
const SKIP_VERIFY = isTruthy(process.env.ROBLOX_DECAL_REFRESH_SKIP_VERIFY);
const SKIP_RERANK = isTruthy(process.env.ROBLOX_DECAL_REFRESH_SKIP_RERANK);

function isTruthy(value: string | undefined) {
  return Boolean(value && ["1", "true", "yes", "y"].includes(value.trim().toLowerCase()));
}

async function acquireLock() {
  try {
    await fs.mkdir(LOCK_DIR);
    await fs.writeFile(
      path.join(LOCK_DIR, "owner.json"),
      JSON.stringify(
        {
          pid: process.pid,
          startedAt: new Date().toISOString()
        },
        null,
        2
      )
    );
  } catch (error) {
    const owner = await fs.readFile(path.join(LOCK_DIR, "owner.json"), "utf8").catch(() => null);
    throw new Error(`Decal ID refresh is already running. Lock: ${LOCK_DIR}${owner ? ` ${owner}` : ""}`);
  }
}

async function releaseLock() {
  await fs.rm(LOCK_DIR, { recursive: true, force: true });
}

function runStep(step: Step) {
  return new Promise<Record<string, number>>((resolve, reject) => {
    const startedAt = Date.now();
    console.log(`\n==> ${step.name}`);
    const child = spawn(NODE_BIN, [TSX_CLI, step.script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...(step.env ?? {})
      },
      stdio: ["inherit", "pipe", "inherit"]
    });

    let output = "";
    child.stdout!.on("data", (chunk: Buffer) => {
      process.stdout.write(chunk);
      output = (output + chunk.toString()).slice(-8192);
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      if (code === 0) {
        console.log(`<== ${step.name} finished in ${seconds}s`);
        resolve(parseDecalStepCounts(output));
        return;
      }
      reject(new Error(`${step.name} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}`));
    });
  });
}

async function main() {
  const steps: Step[] = [
    ...(!SKIP_COLLECT ? [{ name: "Collect Roblox decal IDs", script: "scripts/decal-ids/collect-roblox-decal-ids.ts" }] : []),
    ...(!SKIP_IMPORT ? [{ name: "Import decal ID candidates", script: "scripts/decal-ids/import-decal-id-candidates.ts" }] : []),
    ...(!SKIP_VERIFY ? [{ name: "Verify decal IDs", script: "scripts/decal-ids/verify-roblox-decal-ids.ts" }] : []),
    ...(!SKIP_RERANK ? [{ name: "Rerank decal IDs", script: "scripts/decal-ids/rerank-roblox-decal-ids.ts" }] : [])
  ];

  if (!steps.length) {
    console.log("No decal ID refresh steps selected.");
    return;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set.");
  }

  // Take the lock first so a run blocked by an active refresh writes no ledger row.
  await acquireLock();
  const stepResults: Array<{ name: string; status: string; duration_ms: number } & Record<string, unknown>> = [];
  let run: Awaited<ReturnType<typeof startStatsJobRun>> | null = null;
  try {
    run = await startStatsJobRun({ jobName: "decal_ids_refresh" });
    console.log(`Starting decal ID refresh with ${steps.length} step(s). Lock: ${LOCK_DIR}`);
    for (const step of steps) {
      const startedAt = Date.now();
      try {
        const counts = await runStep(step);
        stepResults.push({ name: step.name, status: "success", ...counts, duration_ms: Date.now() - startedAt });
      } catch (error) {
        stepResults.push({ name: step.name, status: "failed", duration_ms: Date.now() - startedAt });
        throw error;
      }
    }
    const { data, error } = await supabaseAdmin().from("roblox_decal_ids")
      .select("first_seen_at").order("first_seen_at", { ascending: false }).limit(1);
    if (error) throw new Error(`Failed to read decal discovery health: ${error.message}`);
    const latestSeenAt = data?.[0]?.first_seen_at ?? null;
    const healthError = decalDiscoveryHealth(latestSeenAt);
    await finishStatsJobRun(run, {
      status: healthError ? "partial" : "success",
      rowsClaimed: stepResults.reduce((sum, step) => sum + Number(step.candidates ?? 0), 0),
      rowsSucceeded: stepResults.reduce((sum, step) => sum + Number(step.inserted ?? 0), 0),
      error: healthError,
      metadata: { steps: stepResults, latest_first_seen_at: latestSeenAt, discovery_stall_days: 7 }
    });
    if (healthError) {
      console.error(healthError);
      process.exitCode = 1;
    }
    console.log(`Decal ID refresh finished. Outcome: ${healthError ? "partial" : "success"}.`);
  } catch (error) {
    if (run) await finishStatsJobRun(run, { status: "failed", error, metadata: { steps: stepResults } });
    throw error;
  } finally {
    await releaseLock();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
