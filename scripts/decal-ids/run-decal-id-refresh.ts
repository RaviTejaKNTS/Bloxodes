#!/usr/bin/env tsx

import "../shared/load-env";

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

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
  return new Promise<void>((resolve, reject) => {
    const startedAt = Date.now();
    console.log(`\n==> ${step.name}`);
    const child = spawn(NODE_BIN, [TSX_CLI, step.script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...(step.env ?? {})
      },
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      if (code === 0) {
        console.log(`<== ${step.name} finished in ${seconds}s`);
        resolve();
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

  await acquireLock();
  const startedAt = Date.now();

  try {
    console.log(`Starting decal ID refresh with ${steps.length} step(s). Lock: ${LOCK_DIR}`);
    for (const step of steps) {
      await runStep(step);
    }
    console.log(`\nDecal ID refresh finished in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`);
  } finally {
    await releaseLock();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
