import "../shared/load-env";

import { accessSync, constants as fsConstants } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import { loadR2ClientConfig, R2Client } from "../shared/r2-client";
import { checkWikiClaudeAvailability } from "../wiki/wiki-claude-readiness";
import { WIKI_STAGES, wikiStageConfig } from "../wiki/wiki-stage-config";
import { resolveWikiDevCredentials } from "../wiki/wiki-automation-env";

function executable(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (candidate.includes("/")) {
      try { accessSync(candidate, fsConstants.X_OK); return candidate; } catch { continue; }
    }
    const found = spawnSync("which", [candidate], { encoding: "utf8" });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  return null;
}

async function retryCheck<T>(label: string, operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === 3) break;
      const delayMs = attempt * 3_000;
      console.warn(`${label} failed on attempt ${attempt}/3; retrying in ${delayMs / 1_000}s.`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function main() {
  const operatorCheck = process.argv.includes("--operator-check");
  const dev = resolveWikiDevCredentials();
  const sb = createClient(dev.url, dev.serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  const table = await retryCheck("Managed-dev wiki queue", async () => {
    const result = await sb.from("wiki_generation_queue").select("id,processing_slot", { head: true, count: "exact" }).limit(1);
    if (result.error) throw new Error(`Managed-dev wiki queue is not ready: ${result.error.message}`);
    return result;
  });
  const concurrency = await retryCheck("Managed-dev queue concurrency contract", async () => {
    const result = await sb.rpc("wiki_generation_queue_concurrency_contract");
    if (result.error) throw new Error(result.error.message);
    return result;
  });
  const contract = concurrency.data as { max_processing?: unknown; slot_index?: unknown; slot_constraint?: unknown } | null;
  if (
    contract?.max_processing !== 2 ||
    contract.slot_index !== true ||
    contract.slot_constraint !== true
  ) {
    throw new Error(`Managed-dev two-slot queue contract is not ready: ${JSON.stringify(contract)}.`);
  }
  const rpc = await retryCheck("Managed-dev heartbeat RPC", async () => {
    const result = await sb.rpc("heartbeat_wiki_generation_queue_item", {
      p_id: "00000000-0000-0000-0000-000000000000",
      p_lease_token: "00000000-0000-0000-0000-000000000000",
      p_lease_minutes: 30
    });
    if (result.error) throw new Error(result.error.message);
    return result;
  });
  if (rpc.data !== false) throw new Error("Managed-dev heartbeat RPC returned an unexpected result.");

  const modelHome = process.env.WIKI_AUTOMATION_MODEL_HOME || "/var/lib/bloxodes/wiki-model";
  const codex = executable([process.env.WIKI_AUTOMATION_CODEX_BIN || "", "/home/teja/.local/bin/codex", "codex"].filter(Boolean));
  if (!codex) throw new Error("Codex CLI is not installed.");
  const checkout = path.resolve(process.env.WIKI_AUTOMATION_WORKTREE || process.cwd());
  if (!operatorCheck && spawnSync("/usr/bin/test", ["-r", path.join(checkout, ".envs")]).status === 0) {
    throw new Error("Restricted model user can read the checkout .envs directory.");
  }
  const codexEnv = operatorCheck
    ? process.env
    : { ...process.env, HOME: modelHome, CODEX_HOME: path.join(modelHome, ".codex") };
  const codexChecks = operatorCheck ? [["--version"]] : [["--version"], ["login", "status"]];
  for (const args of codexChecks) {
    const result = spawnSync(codex, args, { encoding: "utf8", env: codexEnv });
    if (result.status !== 0) throw new Error(`Codex ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  if (!operatorCheck) {
    const probe = spawnSync(process.execPath, ["--import", "tsx", "scripts/ops/check-wiki-model-sandbox.ts"], {
      cwd: checkout, env: codexEnv, encoding: "utf8", timeout: 90_000
    });
    if (probe.status !== 0) throw new Error(probe.stderr || probe.stdout || "Wiki model sandbox readiness failed.");
    process.stdout.write(probe.stdout);
  }
  for (const stage of WIKI_STAGES) wikiStageConfig(stage, process.env);
  const claude = await checkWikiClaudeAvailability({ ...codexEnv, HOME: modelHome });
  if (claude.available) console.log(`Claude readiness: ${claude.message}`);
  else console.warn(`Claude readiness warning: ${claude.message}`);
  if (operatorCheck) console.warn("Operator checks do not prove the model user's directory permissions or systemd mount access. Repeat readiness inside the restricted service environment before activation.");
  const browser = executable(["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "google-chrome", "chromium", "chromium-browser"]);
  if (!browser) throw new Error("Chrome or Chromium is required for rendered verification.");

  const r2Config = loadR2ClientConfig(process.env);
  if (r2Config.bucket !== "bloxodes-wiki") throw new Error(`Expected shared R2 bucket bloxodes-wiki; received ${r2Config.bucket}.`);
  const image = await sb.from("wiki_collection_items").select("image_key").not("image_key", "is", null).limit(1).maybeSingle();
  if (image.error || !image.data?.image_key) throw new Error(`Managed-dev R2 canary key is unavailable: ${image.error?.message || "no image"}`);
  const imageKey = String(image.data.image_key);
  await retryCheck("R2 media canary", () => new R2Client(r2Config).headObject(imageKey));

  const [stats, inventory] = await retryCheck("Public wiki inputs", async () => {
    const responses = await Promise.all([
      fetch("https://bloxodes.com/api/stats/games?page=1&limit=50&sort=playing", { signal: AbortSignal.timeout(30_000) }),
      fetch("https://bloxodes.com/api/articles/editorial-inventory", { signal: AbortSignal.timeout(30_000) })
    ]);
    if (!responses[0].ok || !responses[1].ok) {
      throw new Error(`stats=${responses[0].status}, inventory=${responses[1].status}`);
    }
    return responses;
  });
  if (!stats.ok || !inventory.ok) throw new Error(`Public readiness failed: stats=${stats.status}, inventory=${inventory.status}.`);
  console.log(`Homelab wiki automation readiness passed: per-stage Luna/Haiku routing, restricted checkout, ${new URL(dev.url).hostname}, two queue slots, ${r2Config.bucket}, ${browser}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
