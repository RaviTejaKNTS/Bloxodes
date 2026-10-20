import { execFileSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
function git(...args: string[]) {
  try { return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch { throw new Error(`git ${args[0]} failed. Check repository access and the origin remote before retrying publication.`); }
}

export function assertProductionAncestor(head: string, production: string, isAncestor: boolean) {
  if (!/^[a-f0-9]{40}$/.test(head) || !/^[a-f0-9]{40}$/.test(production) || !isAncestor) {
    throw new Error(`HEAD must be an ancestor of origin/production after fetch. HEAD=${head}, origin/production=${production}.`);
  }
}

export function assertPublicationCheckout(head: string, production: string, deployed: string, dirty: string, isAncestor: boolean) {
  if (dirty) throw new Error("Production publication requires a clean working tree. Commit or remove the changes before publishing.");
  if (!/^[a-f0-9]{40}$/.test(head) || head !== deployed) {
    throw new Error(`Production publication requires HEAD = healthy live deployed SHA. HEAD=${head}, deployed=${deployed}. Check out the SHA from content:deployed-sha.`);
  }
  assertProductionAncestor(head, production, isAncestor);
}

export async function deployedContentSha(fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl("https://bloxodes.com/api/health?scope=deploy", { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Deploy health returned HTTP ${response.status}. Wait for a healthy production deployment.`);
  const health = await response.json() as { ok?: boolean; build?: { sha?: string } };
  if (health.ok !== true) throw new Error("Production deploy health is not healthy.");
  const sha = health.build?.sha;
  if (typeof sha !== "string" || !/^[a-f0-9]{40}$/.test(sha)) throw new Error("Production deploy health did not return a full 40-character build SHA.");
  return sha;
}

// This guard belongs only to content:publish. CI publishers retain publication-guard.ts.
export async function assertLocalContentPublication() {
  git("fetch", "origin", "refs/heads/production:refs/remotes/origin/production");
  const head = git("rev-parse", "HEAD");
  const remote = git("rev-parse", "origin/production");
  const deployed = await deployedContentSha();
  let isAncestor = false;
  try { git("merge-base", "--is-ancestor", head, remote); isAncestor = true; } catch { /* Fail closed below. */ }
  assertPublicationCheckout(head, remote, deployed, git("status", "--porcelain", "--untracked-files=all"), isAncestor);
  // Read-only schema-release mode also checks historical ledger exceptions.
  // Studio credentials come from the production target. No SQL writes are allowed.
  try {
    execFileSync(process.execPath, ["--import", "tsx", "scripts/ops/release-production-schema.ts",
      "--approved-sha", head, "--check-ledger", "--transport", "studio", "--database-role", "supabase_admin"],
    { cwd: repoRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    throw new Error("Production migration ledger is not ready or could not be read. Run supabase:production:release -- --approved-sha <HEAD> --check-ledger --transport studio --database-role supabase_admin for details. Apply pending schema through GitHub before publishing.");
  }
  return head;
}
