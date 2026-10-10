import { realpathSync, readdirSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildCodexExecArgs, classifyCodexFallbackReason, parseCodexReasoningEffort } from "../articles/article-writer-provider";
import { runStageCommand } from "../articles/article-stage-runtime";
import { StageInterrupted, saveJson } from "../articles/article-pipeline";
import { buildClaudeStageArgs, headlessProviderErrors, headlessResultMetadata, parseClaudeEffort, parseHeadlessResult } from "../shared/claude-stage-runner";
import { MODEL_FORBIDDEN_ENV_KEYS } from "./wiki-automation-env";
import { isWikiReview, wikiClaudeBin, wikiStageConfig, type WikiStageConfig } from "./wiki-stage-config";
import { parseWikiDecision, wikiDecisionSchema, wikiOwnedFiles, wikiStagePrompt, type WikiCollection, type WikiDecision, type WikiIdentity } from "./wiki-stage-prompts";
import type { WikiStage } from "./wiki-stage-config";

export { StageInterrupted };
export class WikiOwnershipError extends Error {}
export type WikiStageTask = { stage: WikiStage; folder: string; collection?: WikiCollection; revision: boolean; feedback: string; approved: string[]; attemptDir: string; config?: WikiStageConfig };
export type WikiModelOptions = { worktree: string; root: string; identity: WikiIdentity; env: NodeJS.ProcessEnv; codexBin: string; deadline: number; signal?: AbortSignal; runCommand?: typeof runStageCommand };
export function wikiWorkerEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const allowed = ["PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "LC_ALL", "TMPDIR", "TZ", "CODEX_HOME", "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "NODE_EXTRA_CA_CERTS", "CLAUDE_CODE_OAUTH_TOKEN"];
  const result: NodeJS.ProcessEnv = Object.fromEntries(allowed.flatMap(key => env[key] === undefined ? [] : [[key, env[key]]]));
  for (const key of MODEL_FORBIDDEN_ENV_KEYS) delete result[key];
  return { ...result, NODE_ENV: "production", BLOXODES_ENV_PROFILE: "process-only", BLOXODES_ENV_OVERLAYS: "", WIKI_AUTOMATION_BATCH_CONTEXT: "1" };
}
// Inspect all artifacts, including sibling collections. Model logs and code-owned state
// live in .stages and are checked separately by their owner.
export async function wikiArtifactHashes(root: string): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  const walk = async (dir: string) => {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (dir === root && entry.name === ".stages") {
        if (!entry.isDirectory()) throw new WikiOwnershipError("Stage state directory must not be a symlink.");
        const stateFile = path.join(root, ".stages/state.json");
        try {
          if (!(await lstat(stateFile)).isFile()) throw new WikiOwnershipError("Stage state must be an ordinary file.");
          hashes[".stages/state.json"] = createHash("sha256").update(await readFile(stateFile)).digest("hex"); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
        continue;
      }
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new WikiOwnershipError(`Artifact symlink is not allowed: ${file}`);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) hashes[path.relative(root, file)] = createHash("sha256").update(await readFile(file)).digest("hex");
      else throw new WikiOwnershipError(`Unsupported artifact file: ${file}`);
    }
  };
  await walk(root);
  return hashes;
}
export function assertWikiOwnership(before: Record<string, string>, after: Record<string, string>, task: WikiStageTask, root: string) {
  const folder = path.relative(root, task.folder);
  const allowed = wikiOwnedFiles(task.stage, task.revision).map(file => path.join(folder, file));
  for (const file of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[file] === after[file]) continue;
    if (!allowed.some(rule => rule.endsWith("/**") ? file.startsWith(rule.slice(0, -2)) : file === rule)) throw new WikiOwnershipError(`${task.stage} changed an artifact outside its ownership: ${file}`);
  }
}
function codexHomeEntries(codexHome: string): string[] {
  try { return readdirSync(codexHome).filter(entry => entry !== "packages"); } catch { return []; }
}
export function wikiCodexPermissions(o: WikiModelOptions, task: WikiStageTask): string[] {
  const resolved = (file: string) => { try { return realpathSync(file); } catch { return path.resolve(file); } };
  const root = resolved(o.worktree), folder = resolved(task.folder), resultRoot = resolved(o.root);
  const review = isWikiReview(task.stage);
  const scoped = (access: string) => ({ ".": access, "**/.env*": "deny", "**/.envs/**": "deny", "**/.codex/**": "deny", "**/.claude/**": "deny", "**/.aws/**": "deny", "**/.ssh/**": "deny" });
  const filesystem: Record<string, unknown> = {
    ":minimal": "read", [root]: scoped("read"), [resultRoot]: scoped("read"),
    [folder]: scoped(review ? "read" : "write"),
    [path.join(resultRoot, ".stages")]: "deny", "/etc/bloxodes": "deny", "/proc": "deny",
    "/srv/data/projects/Bloxodes/.envs": "deny", [resolved(path.join(root, ".envs"))]: "deny"
  };
  if (o.env.HOME) for (const name of [".claude", ".aws", ".ssh", ".config/gh", ".grok"]) filesystem[resolved(path.join(o.env.HOME, name))] = "deny";
  // A parent deny overrides nested reads and would hide a sandbox helper installed
  // under CODEX_HOME/packages, so deny every other CODEX_HOME entry one by one.
  const codexHome = o.env.CODEX_HOME || (o.env.HOME ? path.join(o.env.HOME, ".codex") : "");
  if (codexHome) for (const entry of codexHomeEntries(codexHome)) filesystem[resolved(path.join(codexHome, entry))] = "deny";
  if (!review) {
    // Networked stages need the resolver and CA store, plus headless Chrome for
    // image inspection. /etc/bloxodes stays denied by its more specific rule.
    for (const input of ["/etc", "/run/systemd/resolve", "/opt/google"]) filesystem[input] = "read";
    if (o.env.HOME) for (const cache of [".cache/ms-playwright", ".npm"]) filesystem[resolved(path.join(o.env.HOME, cache))] = "read";
  }
  if (path.isAbsolute(o.codexBin)) {
    const bin = resolved(o.codexBin), directory = path.dirname(bin);
    filesystem[bin] = "read";
    filesystem[path.join(directory, "codex-code-mode-host")] = "read";
    if (path.basename(directory) === "bin") for (const name of ["codex-resources", "codex-path"]) filesystem[path.join(path.dirname(directory), name)] = "read";
  }
  const toml = (value: Record<string, unknown>): string => `{ ${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)} = ${typeof item === "object" && item !== null ? toml(item as Record<string, unknown>) : JSON.stringify(item)}`).join(", ")} }`;
  return ["--ignore-user-config", "--ignore-rules", "--strict-config", "--config", 'default_permissions="bloxodes_wiki_stage"',
    "--config", `permissions.bloxodes_wiki_stage.filesystem=${toml({ ...filesystem, glob_scan_max_depth: 16 })}`,
    "--config", `permissions.bloxodes_wiki_stage.network.enabled=${!review}`, "--config", 'approval_policy="never"', "--config", "allow_login_shell=false"];
}
export function wikiCodexStageArgs(o: WikiModelOptions, task: WikiStageTask, config: WikiStageConfig, prompt: string) {
  const args = buildCodexExecArgs({ worktree: task.folder, model: config.model, reasoningEffort: parseCodexReasoningEffort(config.effort), prompt }).filter(arg => arg !== "--approve-for-me");
  // Legacy sandbox flags override the named filesystem policy.
  args.splice(args.length - 1, 0, "--skip-git-repo-check", ...wikiCodexPermissions(o, task),
    "--config", "features.multi_agent=false", "--config", "features.multi_agent_v2=false", "--config", "features.apps=false", "--config", 'web_search="live"',
    "--output-schema", path.join(task.attemptDir, "schema.json"), "--output-last-message", path.join(task.attemptDir, "response.json"));
  return args;
}
export async function executeWikiModelStage(o: WikiModelOptions, task: WikiStageTask): Promise<WikiDecision> {
  o.signal?.throwIfAborted();
  const config = task.config ?? wikiStageConfig(task.stage, o.env);
  const stageDeadline = Math.min(o.deadline, Date.now() + config.timeoutMs);
  const schema = wikiDecisionSchema(task.stage);
  const prompt = wikiStagePrompt({ ...o, ...task });
  await mkdir(task.attemptDir, { recursive: true });
  await saveJson(path.join(task.attemptDir, "schema.json"), schema);
  await writeFile(path.join(task.attemptDir, "prompt.md"), prompt, { mode: 0o600 });
  const before = await wikiArtifactHashes(o.root);
  const previousData = task.stage === "collection_images" ? JSON.parse(await readFile(path.join(task.folder, "dataset.json"), "utf8")) : null;
  await saveJson(path.join(task.attemptDir, "input-hashes.json"), before);
  const assertImageData = async () => {
    if (!previousData) return;
    try {
      const after = JSON.parse(await readFile(path.join(task.folder, "dataset.json"), "utf8"));
      const withoutImages = (data: any) => ({ ...data, items: data.items.map(({ system, ...row }: any) => { const { image: _, ...rest } = system; return { ...row, system: rest }; }) });
      if (!isDeepStrictEqual(withoutImages(previousData), withoutImages(after))) throw new Error("Changed approved rows or public data.");
    } catch { throw new WikiOwnershipError("Image worker changed approved rows or public data."); }
  };
  const attempts: Array<WikiStageConfig & { fallback_reason?: string; usage?: unknown; modelUsage?: unknown }> = [];
  const persist = () => saveJson(path.join(task.attemptDir, "model-attempts.json"), attempts);
  const run = async (selected: WikiStageConfig, fallbackReason?: string): Promise<WikiDecision> => {
    const attempt = { ...selected, fallback_reason: fallbackReason };
    attempts.push(attempt);
    await persist();
    const review = isWikiReview(task.stage);
    const args = selected.provider === "claude" ? buildClaudeStageArgs({ workspace: task.folder, readDirectories: [path.join(o.worktree, ".agents/skills"), o.root], review, model: selected.model, effort: parseClaudeEffort(selected.effort), schema, prompt }) : wikiCodexStageArgs(o, task, selected, prompt);
    const workerEnv = wikiWorkerEnvironment(o.env);
    if (selected.provider !== "claude") delete workerEnv.CLAUDE_CODE_OAUTH_TOKEN;
    const result = await (o.runCommand ?? runStageCommand)({ bin: selected.provider === "claude" ? wikiClaudeBin(o.env) : o.codexBin, args, cwd: task.folder, env: workerEnv, log: path.join(task.attemptDir, `${selected.provider}-output.log`), timeoutMs: stageDeadline - Date.now(), signal: o.signal });
    if (selected.provider === "claude") Object.assign(attempt, headlessResultMetadata(result.stdout));
    await persist();
    const errors = selected.provider === "claude" ? headlessProviderErrors(result.stdout) : "";
    if (result.code !== 0 || errors) {
      // Never classify successful source/tool text as a provider error.
      throw new Error(`${selected.provider} CLI exited ${result.code}: ${errors || result.stderr.slice(-4000) || result.tail.slice(-4000)}`);
    }
    const response = selected.provider === "claude" ? parseHeadlessResult(result.stdout).decision : JSON.parse(await readFile(path.join(task.attemptDir, "response.json"), "utf8"));
    await saveJson(path.join(task.attemptDir, "response.json"), response);
    return parseWikiDecision(response, task.stage);
  };
  let decision: WikiDecision;
  try {
    try { decision = await run(config); }
    catch (error) {
      if (error instanceof StageInterrupted || o.signal?.aborted || Date.now() >= stageDeadline) throw error;
      const message = error instanceof Error ? error.message : String(error);
      const reason = classifyCodexFallbackReason(message);
      if (config.provider !== "claude" || !reason) throw error;
      // Check the failed worker too before authorizing a second provider.
      assertWikiOwnership(before, await wikiArtifactHashes(o.root), task, o.root);
      await assertImageData();
      console.warn(`[wiki ${o.identity.id}] Claude ${reason}; ${task.stage} falls back to Codex gpt-6-luna.`);
      decision = await run({ provider: "codex", model: "gpt-6-luna", effort: "max", timeoutMs: config.timeoutMs }, reason);
    }
  } finally {
    assertWikiOwnership(before, await wikiArtifactHashes(o.root), task, o.root);
    await assertImageData();
    await persist();
  }
  return decision!;
}
