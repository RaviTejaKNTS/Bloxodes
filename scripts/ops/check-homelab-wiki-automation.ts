import "../shared/load-env";

import { accessSync, constants as fsConstants, existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { parse as parseDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { loadR2ClientConfig, R2Client } from "../shared/r2-client";
import { isProductionSupabaseUrl } from "../shared/supabase-target";
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

function credentialMaskArgs(): string[] {
  const home = os.homedir();
  const candidates = [
    ".ssh", ".aws", ".azure", ".kube", ".docker", ".wrangler",
    ".config/gh", ".config/gcloud", ".config/rclone", ".config/cloudflared",
    ".config/supabase", ".config/op", ".local/share/keyrings",
    ".npmrc", ".git-credentials", ".netrc", ".pypirc"
  ];
  return candidates.flatMap((candidate) => {
    const target = path.join(home, candidate);
    if (!existsSync(target)) return [];
    return lstatSync(target).isDirectory()
      ? ["--tmpfs", target]
      : ["--ro-bind", "/dev/null", target];
  });
}

function siblingWorkspaceSecretMaskArgs(checkout: string): string[] {
  const parent = path.dirname(checkout);
  if (!existsSync(parent)) return [];
  return readdirSync(parent, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return [];
    const root = path.join(parent, entry.name);
    return [path.join(root, ".envs"), path.join(root, ".env"), path.join(root, ".env.local"), path.join(root, ".env.production")]
      .filter((target) => existsSync(target) && target !== path.join(checkout, ".envs"))
      .flatMap((target) => {
        const type = lstatSync(target);
        if (type.isSymbolicLink()) return [];
        return type.isDirectory() ? ["--tmpfs", target] : ["--ro-bind", "/dev/null", target];
      });
  });
}

async function main() {
  const dev = resolveWikiDevCredentials();
  const sb = createClient(dev.url, dev.serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  const table = await sb.from("wiki_generation_queue").select("id,processing_slot", { head: true, count: "exact" }).limit(1);
  if (table.error) throw new Error(`Managed-dev wiki queue is not ready: ${table.error.message}`);
  const concurrency = await sb.rpc("wiki_generation_queue_concurrency_contract");
  const contract = concurrency.data as { max_processing?: unknown; slot_index?: unknown; slot_constraint?: unknown } | null;
  if (
    concurrency.error ||
    contract?.max_processing !== 2 ||
    contract.slot_index !== true ||
    contract.slot_constraint !== true
  ) {
    throw new Error(`Managed-dev two-slot queue contract is not ready: ${concurrency.error?.message || JSON.stringify(contract)}.`);
  }
  const rpc = await sb.rpc("heartbeat_wiki_generation_queue_item", {
    p_id: "00000000-0000-0000-0000-000000000000",
    p_lease_token: "00000000-0000-0000-0000-000000000000",
    p_lease_minutes: 30
  });
  if (rpc.error || rpc.data !== false) throw new Error(`Managed-dev heartbeat RPC is not ready: ${rpc.error?.message || "unexpected result"}`);

  const codex = executable([process.env.WIKI_AUTOMATION_CODEX_BIN || "", path.join(os.homedir(), ".local", "bin", "codex"), "codex"].filter(Boolean));
  if (!codex) throw new Error("Codex CLI is not installed.");
  const bwrap = executable([process.env.WIKI_AUTOMATION_BWRAP_BIN || "", "/usr/bin/bwrap"].filter(Boolean));
  if (!bwrap) throw new Error("Bubblewrap is required to isolate model processes from production credentials.");
  const checkout = path.resolve(process.env.WIKI_AUTOMATION_WORKTREE || process.cwd());
  const hiddenCredentialChecks = [path.join(os.homedir(), ".ssh"), path.join(os.homedir(), ".config", "gh")]
    .filter(existsSync)
    .map((target) => `test ! -e ${JSON.stringify(`${target}/id_rsa`)} && test ! -e ${JSON.stringify(`${target}/hosts.yml`)}`);
  const gitCredentials = path.join(os.homedir(), ".git-credentials");
  if (existsSync(gitCredentials)) hiddenCredentialChecks.push(`test ! -s ${JSON.stringify(gitCredentials)}`);
  const isolation = spawnSync(bwrap, [
    "--die-with-parent",
    "--unshare-pid",
    "--ro-bind", "/", "/",
    "--tmpfs", path.join(checkout, ".envs"),
    "--tmpfs", "/etc/bloxodes",
    ...credentialMaskArgs(),
    ...siblingWorkspaceSecretMaskArgs(checkout),
    "--proc", "/proc",
    "/bin/sh", "-c",
    [
      `test ! -e ${JSON.stringify(path.join(checkout, ".envs", "targets", "production.env"))}`,
      "test ! -e /etc/bloxodes/wiki-automation.env",
      `test -r ${JSON.stringify(path.join(checkout, "package.json"))}`,
      ...hiddenCredentialChecks
    ].join(" && ")
  ], { encoding: "utf8" });
  if (isolation.status !== 0) {
    throw new Error(`Bubblewrap credential-isolation canary failed: ${isolation.stderr || isolation.stdout}`);
  }
  for (const args of [["--version"], ["login", "status"]]) {
    const result = spawnSync(codex, args, { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`Codex ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  const browser = executable(["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "google-chrome", "chromium", "chromium-browser"]);
  if (!browser) throw new Error("Chrome or Chromium is required for rendered verification.");

  const r2Config = loadR2ClientConfig(process.env);
  if (r2Config.bucket !== "bloxodes-wiki") throw new Error(`Expected shared R2 bucket bloxodes-wiki; received ${r2Config.bucket}.`);
  const image = await sb.from("wiki_collection_items").select("image_key").not("image_key", "is", null).limit(1).maybeSingle();
  if (image.error || !image.data?.image_key) throw new Error(`Managed-dev R2 canary key is unavailable: ${image.error?.message || "no image"}`);
  await new R2Client(r2Config).headObject(String(image.data.image_key));

  const productionFile = path.resolve(process.env.WIKI_RELEASE_PRODUCTION_ENV_FILE || ".envs/targets/production.env");
  const production = parseDotenv(readFileSync(productionFile, "utf8"));
  if (!isProductionSupabaseUrl(production.SUPABASE_URL)) throw new Error("Wiki production env does not target the recognized production database.");

  const [stats, inventory] = await Promise.all([
    fetch("https://bloxodes.com/api/stats/games?page=1&limit=50&sort=playing", { signal: AbortSignal.timeout(30_000) }),
    fetch("https://bloxodes.com/api/articles/editorial-inventory", { signal: AbortSignal.timeout(30_000) })
  ]);
  if (!stats.ok || !inventory.ok) throw new Error(`Public readiness failed: stats=${stats.status}, inventory=${inventory.status}.`);
  console.log(`Homelab wiki automation readiness passed: ${new URL(dev.url).hostname}, two queue slots, ${r2Config.bucket}, ${browser}, ${bwrap}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
