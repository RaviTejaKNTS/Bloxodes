import "../shared/load-env";

import { spawn } from "node:child_process";
import { accessSync, constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  ARTICLE_DEV_ENV_KEYS,
  ARTICLE_QUEUE_ENV_KEYS,
  resolveArticleDevCredentials,
  supabaseTarget
} from "./article-queue-env";
import {
  buildCodexExecArgs,
  parseCodexReasoningEffort,
  type CodexReasoningEffort
} from "./article-writer-provider";
import { assertLunaMaxConfiguration } from "./pi-article-writer";
import { acquireAgentWorkLock } from "../shared/agent-work-lock";

type Options = {
  apply: boolean;
  releaseCompleted: boolean;
  limit: number;
  timeoutMinutes: number;
  worktree: string;
  codexBin: string;
  codexModel: string;
  codexReasoningEffort: CodexReasoningEffort;
  maxAttempts: number;
};

type ProviderProcessResult = {
  exitCode: number;
  output: string;
  timedOut: boolean;
};

type CompletedQueueRow = {
  id: string;
};

class ProviderProcessError extends Error {
  constructor(
    message: string,
    readonly output: string,
    readonly timedOut: boolean
  ) {
    super(message);
  }
}

const MAX_BATCH_SIZE = 6;

function executableDefault(userLocalPath: string, command: string): string {
  try {
    accessSync(userLocalPath, fsConstants.X_OK);
    return userLocalPath;
  } catch {
    return command;
  }
}

function printUsage() {
  console.log(`Usage: npm run articles:writer:batch -- [options]

Options:
  --apply                    Run the Luna Max parent workflow; dry-run by default
  --release-completed        Publish and verify exact rows completed by this batch (default)
  --skip-production-release  Leave completed rows in managed dev for manual review
  --limit N                  Maximum queued articles, 1-6 (default: 6)
  --worktree PATH            Persistent Bloxodes worktree (default: current repo)
  --codex-bin PATH           Codex CLI path (default: ARTICLE_WRITER_CODEX_BIN or codex)
  --codex-model MODEL        Codex model (default: ARTICLE_WRITER_CODEX_MODEL or gpt-5.6-luna)
  --codex-reasoning EFFORT   Codex reasoning effort (fixed: max)
  --max-attempts N           Retry threshold for blocked rows, 1-10 (default: 3)
  --timeout-minutes N        Batch timeout, 30-330 (default: 300)
  --help                     Show this help

The batch exits without invoking the parent when no curated pending queue rows exist.
Research, images, and review run through Codex Luna Max. Article prose runs only through Pi Luna Max.`);
}

function parseBoolean(value: string | undefined, fallback: boolean, label: string): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new Error(`${label} must be true or false.`);
}

function parseInteger(value: string | undefined, flag: string, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${flag} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1]?.trim();
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    apply: false,
    releaseCompleted: parseBoolean(process.env.ARTICLE_AUTO_PUBLISH, true, "ARTICLE_AUTO_PUBLISH"),
    limit: parseInteger(
      process.env.ARTICLE_WRITER_BATCH_SIZE ?? String(MAX_BATCH_SIZE),
      "ARTICLE_WRITER_BATCH_SIZE",
      1,
      MAX_BATCH_SIZE
    ),
    timeoutMinutes: parseInteger(
      process.env.ARTICLE_WRITER_TIMEOUT_MINUTES ?? "300",
      "ARTICLE_WRITER_TIMEOUT_MINUTES",
      30,
      330
    ),
    worktree: path.resolve(process.env.ARTICLE_WRITER_WORKTREE?.trim() || process.cwd()),
    codexBin:
      process.env.ARTICLE_WRITER_CODEX_BIN?.trim() ||
      executableDefault(path.join(os.homedir(), ".local", "bin", "codex"), "codex"),
    codexModel: process.env.ARTICLE_WRITER_CODEX_MODEL?.trim() || "gpt-5.6-luna",
    codexReasoningEffort: parseCodexReasoningEffort(
      process.env.ARTICLE_WRITER_CODEX_REASONING_EFFORT?.trim() || "max"
    ),
    maxAttempts: parseInteger(process.env.ARTICLE_WRITER_MAX_ATTEMPTS ?? "3", "ARTICLE_WRITER_MAX_ATTEMPTS", 1, 10)
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--release-completed") {
      options.releaseCompleted = true;
    } else if (arg === "--skip-production-release") {
      options.releaseCompleted = false;
    } else if (arg === "--limit") {
      options.limit = parseInteger(requireValue(argv, index, arg), arg, 1, MAX_BATCH_SIZE);
      index += 1;
    } else if (arg.startsWith("--limit=")) {
      options.limit = parseInteger(arg.slice("--limit=".length), "--limit", 1, MAX_BATCH_SIZE);
    } else if (arg === "--worktree") {
      options.worktree = path.resolve(requireValue(argv, index, arg));
      index += 1;
    } else if (arg.startsWith("--worktree=")) {
      options.worktree = path.resolve(arg.slice("--worktree=".length));
    } else if (arg === "--codex-bin") {
      options.codexBin = requireValue(argv, index, arg);
      index += 1;
    } else if (arg.startsWith("--codex-bin=")) {
      options.codexBin = arg.slice("--codex-bin=".length).trim();
    } else if (arg === "--codex-model") {
      options.codexModel = requireValue(argv, index, arg);
      index += 1;
    } else if (arg.startsWith("--codex-model=")) {
      options.codexModel = arg.slice("--codex-model=".length).trim();
    } else if (arg === "--codex-reasoning") {
      options.codexReasoningEffort = parseCodexReasoningEffort(requireValue(argv, index, arg));
      index += 1;
    } else if (arg.startsWith("--codex-reasoning=")) {
      options.codexReasoningEffort = parseCodexReasoningEffort(arg.slice("--codex-reasoning=".length).trim());
    } else if (arg === "--max-attempts") {
      options.maxAttempts = parseInteger(requireValue(argv, index, arg), arg, 1, 10);
      index += 1;
    } else if (arg.startsWith("--max-attempts=")) {
      options.maxAttempts = parseInteger(arg.slice("--max-attempts=".length), "--max-attempts", 1, 10);
    } else if (arg === "--timeout-minutes") {
      options.timeoutMinutes = parseInteger(requireValue(argv, index, arg), arg, 30, 330);
      index += 1;
    } else if (arg.startsWith("--timeout-minutes=")) {
      options.timeoutMinutes = parseInteger(arg.slice("--timeout-minutes=".length), "--timeout-minutes", 30, 330);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

async function pendingQueueSelection(
  dev: { url: string; serviceRole: string },
  limit: number
): Promise<{ total: number; rows: CompletedQueueRow[] }> {
  const supabase = createClient(dev.url, dev.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, count, error } = await supabase
    .from("article_generation_queue")
    .select("id", { count: "exact" })
    .eq("workflow_mode", "agent_runner")
    .eq("status", "pending")
    .not("curated_at", "is", null)
    .order("source_published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Could not select pending article queue rows: ${error.message}`);
  return { total: count ?? 0, rows: (data ?? []) as CompletedQueueRow[] };
}

async function completedQueueRowsSince(
  dev: { url: string; serviceRole: string },
  startedAt: string,
  selectedIds: string[]
): Promise<CompletedQueueRow[]> {
  if (!selectedIds.length) return [];
  const supabase = createClient(dev.url, dev.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await supabase
    .from("article_generation_queue")
    .select("id")
    .eq("workflow_mode", "agent_runner")
    .eq("status", "completed")
    .in("id", selectedIds)
    .gte("completed_at", startedAt)
    .order("completed_at", { ascending: true });
  if (error) throw new Error(`Could not list articles completed by the current batch: ${error.message}`);
  return (data ?? []) as CompletedQueueRow[];
}

async function recoverStaleBatchClaims(
  dev: { url: string; serviceRole: string },
  maxAttempts: number,
  staleMinutes: number
): Promise<number> {
  const supabase = createClient(dev.url, dev.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const cutoff = new Date(Date.now() - staleMinutes * 60_000).toISOString();
  const { data, error } = await supabase
    .from("article_generation_queue")
    .select("id, attempts")
    .eq("workflow_mode", "agent_runner")
    .eq("status", "processing")
    .like("locked_by", "%-homelab%")
    .lt("locked_at", cutoff);
  if (error) throw new Error(`Could not inspect stale homelab batch claims: ${error.message}`);

  for (const row of data ?? []) {
    const attempts = Number(row.attempts ?? 0);
    const terminal = attempts >= maxAttempts;
    const { error: updateError } = await supabase
      .from("article_generation_queue")
      .update({
        status: terminal ? "failed" : "pending",
        last_error: "Recovered after a homelab article provider left a stale processing claim.",
        outcome_reason: terminal ? "Homelab article providers exceeded max attempts after stale claims." : null,
        locked_at: null,
        locked_by: null,
        next_attempt_at: terminal ? null : new Date().toISOString(),
        completed_at: terminal ? new Date().toISOString() : null
      })
      .eq("id", row.id)
      .eq("status", "processing")
      .like("locked_by", "%-homelab%")
      .lt("locked_at", cutoff);
    if (updateError) throw new Error(`Could not recover stale batch queue item ${row.id}: ${updateError.message}`);
  }
  return data?.length ?? 0;
}

async function requeueDueBlockedRows(
  dev: { url: string; serviceRole: string },
  maxAttempts: number
): Promise<{ requeued: number; failed: number }> {
  const supabase = createClient(dev.url, dev.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const now = new Date().toISOString();
  const { data: failedRows, error: failedError } = await supabase
    .from("article_generation_queue")
    .update({
      status: "failed",
      completed_at: now,
      next_attempt_at: null,
      locked_at: null,
      locked_by: null,
      last_error: "Blocked article exceeded the configured homelab writer attempt limit."
    })
    .eq("workflow_mode", "agent_runner")
    .eq("status", "blocked")
    .gte("attempts", maxAttempts)
    .lte("next_attempt_at", now)
    .select("id");
  if (failedError) throw new Error(`Could not close exhausted blocked article rows: ${failedError.message}`);
  const { data, error } = await supabase
    .from("article_generation_queue")
    .update({
      status: "pending",
      locked_at: null,
      locked_by: null,
      outcome_reason: null
    })
    .eq("workflow_mode", "agent_runner")
    .eq("status", "blocked")
    .lt("attempts", maxAttempts)
    .lte("next_attempt_at", now)
    .select("id");
  if (error) throw new Error(`Could not requeue due blocked article rows: ${error.message}`);
  return { requeued: data?.length ?? 0, failed: failedRows?.length ?? 0 };
}

function buildPrompt(targetCount: number): string {
  return `Skill: .agents/skills/bloxodes-article-workflow-runner/SKILL.md
Articles:
- selection: newest pending Groq-curated agent_runner rows
- maximum: ${targetCount}
- worker: codex-homelab`;
}

function childEnvironment(dev: { url: string; serviceRole: string }): NodeJS.ProcessEnv {
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  for (const key of ARTICLE_QUEUE_ENV_KEYS) delete childEnv[key];
  for (const key of ARTICLE_DEV_ENV_KEYS) delete childEnv[key];
  childEnv.ARTICLE_DEV_SUPABASE_URL = dev.url;
  childEnv.ARTICLE_DEV_SUPABASE_SERVICE_ROLE = dev.serviceRole;
  childEnv.SUPABASE_URL = dev.url;
  childEnv.SUPABASE_SERVICE_ROLE = dev.serviceRole;
  childEnv.ARTICLE_WRITER_DEV_ONLY = "true";
  childEnv.ARTICLE_WRITER_REGENERATE_COVERS = "true";
  return childEnv;
}

async function runProviderProcess(params: {
  bin: string;
  args: string[];
  label: string;
  options: Options;
  dev: { url: string; serviceRole: string };
}): Promise<ProviderProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(params.bin, params.args, {
      cwd: params.options.worktree,
      env: childEnvironment(params.dev),
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    let timedOut = false;
    const capture = (chunk: Buffer, stream: NodeJS.WriteStream) => {
      stream.write(chunk);
      output += chunk.toString("utf8");
      if (output.length > 1_000_000) output = output.slice(-1_000_000);
    };
    child.stdout.on("data", (chunk: Buffer) => capture(chunk, process.stdout));
    child.stderr.on("data", (chunk: Buffer) => capture(chunk, process.stderr));
    child.on("error", (error) => {
      reject(new ProviderProcessError(`${params.label} could not start: ${error.message}`, `${output}\n${error.message}`, false));
    });
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 15_000).unref();
    }, params.options.timeoutMinutes * 60_000);
    timeout.unref();
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ exitCode: code ?? 1, output, timedOut });
    });
  });
}

async function runCodex(options: Options, targetCount: number, dev: { url: string; serviceRole: string }): Promise<void> {
  const result = await runProviderProcess({
    bin: options.codexBin,
    args: buildCodexExecArgs({
      worktree: options.worktree,
      model: options.codexModel,
      reasoningEffort: options.codexReasoningEffort,
      prompt: buildPrompt(targetCount)
    }),
    label: "Codex",
    options,
    dev
  });
  if (result.timedOut) {
    throw new ProviderProcessError(`Codex batch exceeded ${options.timeoutMinutes} minutes.`, result.output, true);
  }
  if (result.exitCode !== 0) {
    throw new ProviderProcessError(`Codex batch exited with code ${result.exitCode}.`, result.output, false);
  }
}

async function releaseCompletedArticles(options: Options, rows: CompletedQueueRow[]): Promise<void> {
  const args = ["run", "articles:release", "--"];
  for (const row of rows) args.push("--queue-id", row.id);
  args.push("--apply", "--allow-prod");

  await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", args, {
      cwd: options.worktree,
      env: process.env,
      shell: false,
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Automated article release exited with code ${code ?? "unknown"}.`));
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertLunaMaxConfiguration(options.codexModel, options.codexReasoningEffort, "Codex article workflow");
  if (path.isAbsolute(options.codexBin)) await access(options.codexBin, fsConstants.X_OK);
  const dev = resolveArticleDevCredentials();
  if (options.apply) {
    const staleClaims = await recoverStaleBatchClaims(dev, options.maxAttempts, options.timeoutMinutes + 30);
    if (staleClaims) console.log(`Recovered ${staleClaims} stale homelab batch claim(s).`);
    const retryResult = await requeueDueBlockedRows(dev, options.maxAttempts);
    if (retryResult.requeued) console.log(`Returned ${retryResult.requeued} due blocked article row(s) to pending.`);
    if (retryResult.failed) console.log(`Closed ${retryResult.failed} blocked article row(s) after max attempts.`);
  }
  const selection = await pendingQueueSelection(dev, options.limit);
  const targetCount = selection.rows.length;
  console.log(`Managed dev queue: ${selection.total} pending at ${supabaseTarget(dev.url)}; batch target ${targetCount}.`);

  if (targetCount === 0) {
    console.log("No curated pending article rows; no writer was started.");
    return;
  }
  if (!options.apply) {
    console.log(
      `Dry run: would start Codex ${options.codexModel} at ${options.codexReasoningEffort} reasoning for up to ${targetCount} article(s); production release ${options.releaseCompleted ? "enabled" : "disabled"}.`
    );
    return;
  }

  const releaseLock = await acquireAgentWorkLock(options.worktree, "article-writer");
  if (!releaseLock) {
    console.log(`Another article writer is active on ${os.hostname()}; this batch was skipped without overlap.`);
    return;
  }
  try {
    console.log(
      `Starting Codex ${options.codexModel} at ${options.codexReasoningEffort} reasoning for up to ${targetCount} article(s).`
    );
    const batchStartedAt = new Date().toISOString();
    await runCodex(options, targetCount, dev);
    const completed = await completedQueueRowsSince(
      dev,
      batchStartedAt,
      selection.rows.map((row) => row.id)
    );
    if (completed.length === 0) {
      throw new Error("DEGRADED ARTICLE WRITER: A non-empty provider batch completed zero managed-dev articles.");
    }
    console.log(`Article writer completed ${completed.length} managed-dev article(s).`);
    if (options.releaseCompleted) {
      console.log(`Releasing ${completed.length} exact queue row(s) to production after the model process exited.`);
      await releaseCompletedArticles(options, completed);
    } else {
      console.log("Production release is disabled; completed rows remain in managed dev for manual review.");
    }
  } finally {
    await releaseLock();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
