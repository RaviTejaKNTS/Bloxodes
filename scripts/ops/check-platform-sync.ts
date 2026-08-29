import "../shared/load-env";

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type MigrationPolicy = {
  convergence_version: string;
  production_history_only: string[];
  production_schema_present_history_missing: string[];
  production_pending_before_convergence: string[];
};

type Result = {
  name: string;
  ok: boolean;
  detail: string;
};

const repoRoot = path.resolve(import.meta.dirname, "../..");
const args = new Set(process.argv.slice(2));
const localOnly = args.has("--local-only");
const json = args.has("--json");
const results: Result[] = [];

function run(command: string, commandArgs: string[]): string {
  return execFileSync(command, commandArgs, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function succeeds(command: string, commandArgs: string[]): boolean {
  try {
    execFileSync(command, commandArgs, { cwd: repoRoot, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function add(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
}

function safeSshTarget(value: string | undefined, label: string): string {
  if (!value || !/^[a-zA-Z0-9_.@-]+$/.test(value)) throw new Error(`${label} is missing or invalid.`);
  return value;
}

function safeAbsolutePath(value: string | undefined, label: string): string {
  if (!value || !/^\/[a-zA-Z0-9_./-]+$/.test(value)) throw new Error(`${label} is missing or invalid.`);
  return value;
}

function runtimeDeployRequired(fromSha: string, toSha: string): boolean {
  if (!/^[0-9a-f]{40}$/.test(fromSha)) return true;
  if (!succeeds("git", ["merge-base", "--is-ancestor", fromSha, toSha])) return true;
  const changed = run("git", ["diff", "--name-only", fromSha, toSha]);
  if (!changed) return false;
  return changed.split("\n").some((file) =>
    file.startsWith("data/") ||
    file.startsWith("apps/web/src/data/") ||
    file.startsWith("apps/web/public/") ||
    file.startsWith("apps/web/") ||
    file === "Dockerfile" ||
    file === "package.json" ||
    file === "package-lock.json"
  );
}

async function main() {
const head = run("git", ["rev-parse", "HEAD"]);
const originProduction = run("git", ["rev-parse", "origin/production"]);
const branch = run("git", ["branch", "--show-current"]);
const dirty = run("git", ["status", "--porcelain"]);
const basedOnOrigin = succeeds("git", ["merge-base", "--is-ancestor", "origin/production", "HEAD"]);
add("local-git", true, `branch=${branch} head=${head.slice(0, 12)} dirty_paths=${dirty ? dirty.split("\n").length : 0}`);
add(
  "cached-origin",
  branch === "production" ? head === originProduction : basedOnOrigin,
  branch === "production"
    ? `production=${head.slice(0, 12)} origin/production=${originProduction.slice(0, 12)}`
    : `task_branch_base_contains_origin=${basedOnOrigin} origin/production=${originProduction.slice(0, 12)}`
);

if (!localOnly) {
  const publicHealth = await fetch("https://bloxodes.com/api/health?scope=deploy", { cache: "no-store" });
  const health = (await publicHealth.json()) as { ok?: boolean; build?: { sha?: string }; checks?: { database?: { ok?: boolean } } };
  const liveSha = health.build?.sha ?? "unknown";
  const liveRuntimeCurrent = !runtimeDeployRequired(liveSha, originProduction);
  add(
    "production-web",
    publicHealth.ok && health.ok === true && health.checks?.database?.ok === true && liveRuntimeCurrent,
    `sha=${liveSha.slice(0, 12)} runtime_current=${liveRuntimeCurrent} ` +
      `database=${health.checks?.database?.ok === true ? "ok" : "failed"}`
  );

  const homelabTarget = safeSshTarget(process.env.HOMELAB_SSH_TARGET, "HOMELAB_SSH_TARGET");
  const homelabRoot = safeAbsolutePath(process.env.HOMELAB_REPO_ROOT, "HOMELAB_REPO_ROOT");
  const homelabRaw = run("ssh", [
    "-o", "BatchMode=yes",
    "-o", "ConnectTimeout=10",
    homelabTarget,
    `printf '%s|' "$(git -C ${homelabRoot} rev-parse HEAD)"; ` +
      `printf '%s|' "$(git -C ${homelabRoot} status --porcelain | wc -l | tr -d ' ')"; ` +
      `printf '%s|' "$(systemctl is-active bloxodes-article-discovery.timer)"; ` +
      `systemctl is-active bloxodes-wiki-builder.timer`
  ]);
  const [homelabSha, homelabDirty, timer, wikiTimer] = homelabRaw.split("|");
  add(
    "homelab",
    homelabSha === originProduction && homelabDirty === "0" && timer === "active" && wikiTimer === "active",
    `sha=${homelabSha?.slice(0, 12)} dirty_paths=${homelabDirty} article_timer=${timer} wiki_timer=${wikiTimer}`
  );

  const vpsTarget = safeSshTarget(
    process.env.VPS_ADMIN_USER && process.env.VPS_HOST
      ? `${process.env.VPS_ADMIN_USER}@${process.env.VPS_HOST}`
      : undefined,
    "VPS target"
  );
  const identityComment = process.env.VPS_SSH_IDENTITY_COMMENT?.trim();
  const authRoot = identityComment ? fs.mkdtempSync(path.join(os.tmpdir(), "bloxodes-platform-ssh-")) : null;
  let vpsRaw: string;
  try {
    const identityFile = authRoot ? path.join(authRoot, "identity.pub") : null;
    if (identityFile) {
      const publicKey = run("ssh-add", ["-L"])
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.endsWith(` ${identityComment}`));
      if (!publicKey) throw new Error(`SSH agent identity not found: ${identityComment}`);
      fs.writeFileSync(identityFile, `${publicKey}\n`, { mode: 0o600 });
    }
    vpsRaw = run("ssh", [
      "-o", "BatchMode=yes",
      "-o", "ConnectTimeout=10",
      ...(identityFile ? ["-o", "IdentitiesOnly=yes", "-i", identityFile] : []),
      vpsTarget,
      "printf '%s|' \"$(docker ps --filter name=bloxodes-web --format '{{.Image}}' | head -n1)\"; " +
        "printf '%s|' \"$(sha256sum /home/codex-admin/bloxodes-supabase/volumes/functions/revalidate/index.ts | awk '{print $1}')\"; " +
        "docker exec supabase-db psql -U postgres -d postgres -Atc \"select version from supabase_migrations.schema_migrations order by version;\""
    ]);
  } finally {
    if (authRoot) fs.rmSync(authRoot, { recursive: true, force: true });
  }
  const [image = "", deployedRevalidateSha = "", ...versionParts] = vpsRaw.split("|");
  const imageSha = image.match(/:([0-9a-f]{40})$/)?.[1] ?? "unknown";
  const productionVersions = new Set(versionParts.join("|").split(/\s+/).filter(Boolean));
  const imageRuntimeCurrent = !runtimeDeployRequired(imageSha, originProduction);
  add("vps-web-image", imageRuntimeCurrent, `image=${image} runtime_current=${imageRuntimeCurrent}`);

  const localRevalidateSha = createHash("sha256")
    .update(fs.readFileSync(path.join(repoRoot, "supabase/functions/revalidate/index.ts")))
    .digest("hex");
  add(
    "production-revalidate-function",
    deployedRevalidateSha === localRevalidateSha,
    `deployed=${deployedRevalidateSha.slice(0, 12)} local=${localRevalidateSha.slice(0, 12)}`
  );

  const policy = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "supabase/migration-policy.json"), "utf8")
  ) as MigrationPolicy;
  const localVersions = fs.readdirSync(path.join(repoRoot, "supabase/migrations"))
    .map((name) => name.match(/^(\d{8,14})_/)?.[1])
    .filter((value): value is string => Boolean(value));
  const missingAfterConvergence = localVersions
    .filter((version) => version >= policy.convergence_version && !productionVersions.has(version))
    .sort();
  const expectedPending = policy.production_pending_before_convergence
    .filter((version) => !productionVersions.has(version));
  add(
    "production-migrations",
    missingAfterConvergence.length === 0 && expectedPending.length === 0,
    `cutoff=${policy.convergence_version} pending_pre_cutoff=${expectedPending.join(",") || "none"} ` +
      `missing_after_cutoff=${missingAfterConvergence.join(",") || "none"}`
  );
}

if (json) console.log(JSON.stringify({ head, originProduction, results }, null, 2));
else {
  for (const result of results) console.log(`${result.ok ? "PASS" : "DRIFT"} ${result.name}: ${result.detail}`);
}

if (results.some((result) => !result.ok)) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
