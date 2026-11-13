import { retryPublishNetwork, requirePublishResponse } from "./publish-network.mjs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");

// Paths that ship in the production web image. Keep this in step with the
// "Classify production change" step in dokploy-production-deploy.yml: only
// changes that trigger a web deploy can be compared with the live SHA, or a
// non-deploying merge would block publishing until the next deploy. Scripts,
// contracts and migrations run from this checkout itself, and the schema
// ledger check covers migrations.
export const PUBLICATION_RELEVANT_PATHS = [
  "apps/web/",
  "data/",
  "Dockerfile",
  "package.json",
  "package-lock.json",
  ".github/workflows/dokploy-production-deploy.yml"
] as const;

function isPublicationRelevant(file: string) {
  if (file.startsWith("apps/web/") && file.endsWith("/AGENTS.md")) return false;
  return PUBLICATION_RELEVANT_PATHS.some(prefix => prefix.endsWith("/") ? file.startsWith(prefix) : file === prefix);
}

export const PUBLICATION_SUBPROCESS_TIMEOUT_MS = 60_000;
/**
 * The SSH command for git, with batch mode and a connect timeout. It keeps the command this
 * checkout already uses (GIT_SSH_COMMAND, then core.sshCommand, as git itself does), because
 * GIT_SSH_COMMAND replaces core.sshCommand: a checkout that reaches GitHub with a deploy key named
 * there would otherwise fall back to the default key and get "Permission denied (publickey)".
 * The options go straight after the program, because OpenSSH keeps the first value it sees.
 */
export function batchSshCommand(configured: string | undefined) {
  const [, program, rest] = /^("[^"]*"|'[^']*'|\S+)([\s\S]*)$/.exec(configured?.trim() || "ssh")!;
  return `${program} -o BatchMode=yes -o ConnectTimeout=15${rest}`;
}

let sshCommand: string | undefined;
function gitSshCommand() {
  if (sshCommand) return sshCommand;
  let configured = process.env.GIT_SSH_COMMAND?.trim() || undefined;
  if (!configured) {
    try {
      configured = execFileSync("git", ["config", "--get", "core.sshCommand"], {
        cwd: repoRoot, encoding: "utf8", timeout: PUBLICATION_SUBPROCESS_TIMEOUT_MS, killSignal: "SIGKILL",
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }, stdio: ["ignore", "pipe", "pipe"]
      }).trim() || undefined;
    } catch (error) {
      // git config exits 1 when the key isn't set. Anything else (a timeout, a broken config) stops here.
      if ((error as { status?: number }).status !== 1) throw new Error("git config failed. Check the checkout's git configuration before retrying publication.");
    }
  }
  return (sshCommand = batchSshCommand(configured));
}

const subprocessOptions = () => ({
  cwd: repoRoot, timeout: PUBLICATION_SUBPROCESS_TIMEOUT_MS, killSignal: "SIGKILL" as const,
  env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_SSH_COMMAND: gitSshCommand() },
  stdio: ["ignore", "pipe", "pipe"] as ["ignore", "pipe", "pipe"]
});

function git(...args: string[]) {
  const options = { ...subprocessOptions(), encoding: "utf8" as const }; // Outside the try, so a git config failure keeps its own message.
  try { return execFileSync("git", args, options).trim(); }
  catch { throw new Error(`git ${args[0]} failed. Check repository access and the origin remote before retrying publication.`); }
}

export function assertProductionAncestor(head: string, production: string, isAncestor: boolean) {
  if (!/^[a-f0-9]{40}$/.test(head) || !/^[a-f0-9]{40}$/.test(production) || !isAncestor) {
    throw new Error(`HEAD must be an ancestor of origin/production after fetch. HEAD=${head}, origin/production=${production}. Use a checkout on origin/production and pull before retrying publication.`);
  }
}

type PublicationCheckout = {
  head: string;
  production: string;
  deployed: string;
  trackedStatus: string;
  headOnProduction: boolean;
  deployedOnProduction: boolean;
  changedFiles: readonly string[];
  relationship: "equal" | "ahead" | "behind" | "diverged";
};

function assertPublicationHistory({ head, production, deployed, headOnProduction, deployedOnProduction }: Pick<PublicationCheckout, "head" | "production" | "deployed" | "headOnProduction" | "deployedOnProduction">) {
  assertProductionAncestor(head, production, headOnProduction);
  if (!/^[a-f0-9]{40}$/.test(deployed) || !deployedOnProduction) {
    throw new Error(`The healthy deployed SHA must be an ancestor of origin/production after fetch. deployed=${deployed}, origin/production=${production}. Wait for a healthy deployment from origin/production before retrying publication.`);
  }
}

export function assertPublicationCheckout(checkout: PublicationCheckout) {
  const { head, deployed, trackedStatus, changedFiles, relationship } = checkout;
  if (trackedStatus) throw new Error("Production publication requires no modified or staged tracked files. Commit or restore tracked changes before publishing. Untracked files are allowed.");
  assertPublicationHistory(checkout);
  const relevantFiles = changedFiles.filter(isPublicationRelevant);
  if (!relevantFiles.length) return;
  const action = relationship === "ahead" ? "HEAD is ahead of the deployed SHA. Wait for the deploy before publishing."
    : relationship === "behind" ? "HEAD is behind the deployed SHA. Pull origin/production before publishing."
    : "HEAD and the deployed SHA have diverged. Pull origin/production and wait for the deploy before publishing.";
  throw new Error(`Publish-relevant files differ between deployed=${deployed} and HEAD=${head}:\n${relevantFiles.join("\n")}\n${action}`);
}

export async function deployedContentSha(fetchImpl: typeof fetch = fetch) {
  const health = await retryPublishNetwork(async () => {
    const response = await fetchImpl("https://bloxodes.com/api/health?scope=deploy", { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    await requirePublishResponse(response, "Deploy health");
    return response.json() as Promise<{ ok?: boolean; build?: { sha?: string } }>;
  });
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
  const isAncestor = (ancestor: string, descendant: string) => {
    try { git("merge-base", "--is-ancestor", ancestor, descendant); return true; } catch { return false; }
  };
  const history = { head, production: remote, deployed, headOnProduction: isAncestor(head, remote), deployedOnProduction: isAncestor(deployed, remote) };
  // Check ancestry before diffing so a missing deployed commit gets recovery guidance.
  assertPublicationHistory(history);
  const relationship = head === deployed ? "equal"
    : isAncestor(deployed, head) ? "ahead"
    : isAncestor(head, deployed) ? "behind" : "diverged";
  // Disable rename detection so moving a relevant file elsewhere still blocks publication.
  const changedFiles = git("diff", "--name-only", "--no-renames", "--no-ext-diff", "--no-textconv", "-z", deployed, head, "--").split("\0").filter(Boolean);
  assertPublicationCheckout({
    ...history,
    trackedStatus: git("status", "--porcelain", "--untracked-files=no"), changedFiles, relationship
  });
  // Read-only schema-release mode also checks historical ledger exceptions.
  // Studio credentials come from the production target. No SQL writes are allowed.
  try {
    execFileSync(process.execPath, ["--import", "tsx", "scripts/ops/release-production-schema.ts",
      "--approved-sha", head, "--check-ledger", "--transport", "studio", "--database-role", "supabase_admin"],
    subprocessOptions());
  } catch {
    throw new Error("Production migration ledger is not ready or could not be read. Run supabase:production:release -- --approved-sha <HEAD> --check-ledger --transport studio --database-role supabase_admin for details. Apply pending schema through GitHub before publishing.");
  }
  return head;
}
