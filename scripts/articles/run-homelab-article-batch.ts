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
  buildGrokExecArgs,
  classifyCodexFallbackReason,
  fallbackTargetCount,
  parseCodexReasoningEffort,
  type CodexReasoningEffort
} from "./article-writer-provider";
import { acquireAgentWorkLock } from "../shared/agent-work-lock";

type Options = {
  apply: boolean;
  limit: number;
  timeoutMinutes: number;
  worktree: string;
  codexBin: string;
  codexModel: string;
  codexReasoningEffort: CodexReasoningEffort;
  grokFallback: boolean;
  grokBin: string;
  grokModel: string;
  maxAttempts: number;
  releaseCompleted: boolean;
};

type QueueRowReference = {
  id: string;
};

type ProviderProcessResult = {
  exitCode: number;
  output: string;
  timedOut: boolean;
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
const BATCH_RETRY_AFTER_MINUTES = 180;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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
  --apply                    Run Codex with a classified Grok fallback; dry-run by default
  --limit N                  Maximum queued articles, 1-6 (default: 6)
  --worktree PATH            Persistent Bloxodes worktree (default: current repo)
  --codex-bin PATH           Codex CLI path (default: ARTICLE_WRITER_CODEX_BIN or codex)
  --codex-model MODEL        Codex model (default: ARTICLE_WRITER_CODEX_MODEL or gpt-5.6-luna)
  --codex-reasoning EFFORT   Codex reasoning effort (default: ARTICLE_WRITER_CODEX_REASONING_EFFORT or xhigh)
  --no-grok-fallback         Disable the Grok provider fallback
  --grok-bin PATH            Grok CLI path (default: ARTICLE_WRITER_GROK_BIN or grok)
  --grok-model MODEL         Grok model (default: ARTICLE_WRITER_GROK_MODEL or grok-4.5)
  --max-attempts N           Retry threshold for blocked rows, 1-10 (default: 3)
  --timeout-minutes N        Batch timeout, 30-330 (default: 300)
  --release-completed        Publish completed rows to production after the provider exits (default)
  --skip-production-release  Leave completed rows in the queue for manual release
  --help                     Show this help

The batch exits without invoking a writer when no curated pending queue rows exist.
Grok runs only after a classified Codex provider/account failure.`);
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
      process.env.ARTICLE_WRITER_CODEX_REASONING_EFFORT?.trim() || "xhigh"
    ),
    grokFallback: parseBoolean(process.env.ARTICLE_WRITER_GROK_FALLBACK, true, "ARTICLE_WRITER_GROK_FALLBACK"),
    grokBin:
      process.env.ARTICLE_WRITER_GROK_BIN?.trim() ||
      executableDefault(path.join(os.homedir(), ".grok", "bin", "grok"), "grok"),
    grokModel: process.env.ARTICLE_WRITER_GROK_MODEL?.trim() || "grok-4.5",
    maxAttempts: parseInteger(process.env.ARTICLE_WRITER_MAX_ATTEMPTS ?? "3", "ARTICLE_WRITER_MAX_ATTEMPTS", 1, 10),
    releaseCompleted: parseBoolean(process.env.ARTICLE_AUTO_PUBLISH, true, "ARTICLE_AUTO_PUBLISH")
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg === "--apply") {
      options.apply = true;
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
    } else if (arg === "--no-grok-fallback") {
      options.grokFallback = false;
    } else if (arg === "--grok-bin") {
      options.grokBin = requireValue(argv, index, arg);
      index += 1;
    } else if (arg.startsWith("--grok-bin=")) {
      options.grokBin = arg.slice("--grok-bin=".length).trim();
    } else if (arg === "--grok-model") {
      options.grokModel = requireValue(argv, index, arg);
      index += 1;
    } else if (arg.startsWith("--grok-model=")) {
      options.grokModel = arg.slice("--grok-model=".length).trim();
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
    } else if (arg === "--release-completed") {
      options.releaseCompleted = true;
    } else if (arg === "--skip-production-release") {
      options.releaseCompleted = false;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

async function pendingQueueSelection(
  dev: { url: string; serviceRole: string },
  limit: number
): Promise<{ total: number; rows: QueueRowReference[] }> {
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
  return { total: count ?? 0, rows: (data ?? []) as QueueRowReference[] };
}

async function completedQueueRowsSince(
  dev: { url: string; serviceRole: string },
  startedAt: string,
  selectedIds: string[]
): Promise<QueueRowReference[]> {
  if (selectedIds.length === 0) return [];
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
  if (error) throw new Error(`Could not select articles completed by the current batch: ${error.message}`);
  return (data ?? []) as QueueRowReference[];
}

async function queueActivityIdsSince(
  dev: { url: string; serviceRole: string },
  startedAt: string,
  selectedIds: string[]
): Promise<string[]> {
  if (selectedIds.length === 0) return [];
  const supabase = createClient(dev.url, dev.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await supabase
    .from("article_generation_queue")
    .select("id")
    .eq("workflow_mode", "agent_runner")
    .in("id", selectedIds)
    .gte("last_attempted_at", startedAt);
  if (error) throw new Error(`Could not select article activity for the current batch: ${error.message}`);
  return (data ?? []).map((row) => String(row.id));
}

async function releaseUnfinishedBatchClaims(
  dev: { url: string; serviceRole: string },
  selectedIds: string[],
  reason: string
): Promise<number> {
  if (selectedIds.length === 0) return 0;
  const supabase = createClient(dev.url, dev.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const nextAttemptAt = new Date(Date.now() + BATCH_RETRY_AFTER_MINUTES * 60_000).toISOString();
  const { data, error } = await supabase
    .from("article_generation_queue")
    .update({
      status: "blocked",
      last_error: reason,
      outcome_reason: reason,
      locked_at: null,
      locked_by: null,
      next_attempt_at: nextAttemptAt,
      completed_at: null,
      published_at: null,
      rejected_at: null,
      production_url: null
    })
    .eq("workflow_mode", "agent_runner")
    .eq("status", "processing")
    .in("id", selectedIds)
    .like("locked_by", "%-homelab")
    .select("id");
  if (error) throw new Error(`Could not release unfinished homelab batch claims: ${error.message}`);
  return data?.length ?? 0;
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

function buildPrompt(
  targetCount: number,
  workerName: "codex-homelab" | "grok-homelab",
  selectedIds: string[]
): string {
  return `Use $bloxodes-article-workflow-runner for this unattended homelab batch.

The wrapper selected these exact article_generation_queue IDs: ${selectedIds.join(", ")}. Process only these rows and no other queue rows. Do not claim, write, or update any other queue row. Process at most ${targetCount} accepted articles in this run. Mark processing rows with worker name ${workerName}. Use the runner's required research, image, and writing subagents, queueing work within this same parent run when available subagent slots are full. Continue until those accepted articles are completed, deliberately skipped, or terminally failed; do not stop after producing only a plan.

Follow the complete workflow for every accepted row: processing status, research brief, parent review, separate image subagent with required media.json and at least one planned target, separate writing subagent, managed-dev import, verifier, real-browser localhost preview, and immediate final queue status. Never classify images as optional or set expected_count to zero. An article may have no body images only when the image pass searched reliable sources for every accurate, helpful target, recorded at least two distinct query variants and two checked source-page URLs per omitted target, and the parent explicitly marked every target accepted_missing. Keep final.json cover_image null and use the normal managed-dev import cover-editing process for every article; do not reuse a source-provided or pre-existing cover as the final cover. Do not invent substitute topics. Never publish to production. Production access is limited to the GET-only editorial inventory command.

This process is already inside run-homelab-article-batch.ts. Do not invoke npm run articles:writer:batch or any other outer batch/writer wrapper, and do not try to acquire another article-writer lock. The outer wrapper owns the selected queue IDs, lock, and production release.

For rendered browser QA, run npm run verify:article-browser -- --base-url http://localhost:<port> --file <final.json> for every reviewed final. That command uses the installed headless Chrome/Chromium executable, scrolls the real route, and checks rendered article images. An empty product/browser-agent list is not a blocker in unattended homelab mode; use this Playwright command instead. Mark a row completed only after both verify:article-finals and verify:article-browser pass.`;
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
  childEnv.ARTICLE_WRITER_BATCH_CONTEXT = "1";
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

async function runCodex(
  options: Options,
  targetCount: number,
  dev: { url: string; serviceRole: string },
  selectedIds: string[]
): Promise<void> {
  const result = await runProviderProcess({
    bin: options.codexBin,
    args: buildCodexExecArgs({
      worktree: options.worktree,
      model: options.codexModel,
      reasoningEffort: options.codexReasoningEffort,
      prompt: buildPrompt(targetCount, "codex-homelab", selectedIds)
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

async function runGrok(
  options: Options,
  targetCount: number,
  dev: { url: string; serviceRole: string },
  selectedIds: string[]
): Promise<void> {
  const result = await runProviderProcess({
    bin: options.grokBin,
    args: buildGrokExecArgs({
      worktree: options.worktree,
      model: options.grokModel,
      prompt: buildPrompt(targetCount, "grok-homelab", selectedIds),
      maxTurns: 400
    }),
    label: "Grok",
    options,
    dev
  });
  if (result.timedOut) {
    throw new ProviderProcessError(`Grok batch exceeded ${options.timeoutMinutes} minutes.`, result.output, true);
  }
  if (result.exitCode !== 0) {
    throw new ProviderProcessError(`Grok batch exited with code ${result.exitCode}.`, result.output, false);
  }
}

async function releaseCompletedArticles(options: Options, completedRows: QueueRowReference[]): Promise<void> {
  if (completedRows.length === 0) return;
  const args = ["run", "articles:release", "--", "--apply", "--allow-prod"];
  for (const row of completedRows) args.push("--queue-id", row.id);
  console.log(`Publishing ${completedRows.length} completed article(s) through the guarded exact-row production release.`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", args, {
      cwd: options.worktree,
      env: process.env,
      stdio: "inherit"
    });
    child.on("error", (error) => reject(new Error(`Production release could not start: ${error.message}`)));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Production release exited with code ${code ?? 1}.`));
    });
  });
}

async function main() {
  if (process.env.ARTICLE_WRITER_BATCH_CONTEXT === "1") {
    console.log("Nested article writer batch invocation ignored; the outer homelab batch already owns this run.");
    return;
  }
  const options = parseArgs(process.argv.slice(2));
  if (path.isAbsolute(options.codexBin)) await access(options.codexBin, fsConstants.X_OK);
  if (path.isAbsolute(options.grokBin)) await access(options.grokBin, fsConstants.X_OK);
  const dev = resolveArticleDevCredentials();
  if (options.apply) {
    const staleClaims = await recoverStaleBatchClaims(dev, options.maxAttempts, options.timeoutMinutes + 30);
    if (staleClaims) console.log(`Recovered ${staleClaims} stale homelab batch claim(s).`);
    const retryResult = await requeueDueBlockedRows(dev, options.maxAttempts);
    if (retryResult.requeued) console.log(`Returned ${retryResult.requeued} due blocked article row(s) to pending.`);
    if (retryResult.failed) console.log(`Closed ${retryResult.failed} blocked article row(s) after max attempts.`);
  }
  const selection = await pendingQueueSelection(dev, options.limit);
  const selectedIds = selection.rows.map((row) => row.id);
  const targetCount = selectedIds.length;
  console.log(
    `Managed dev queue: ${selection.total} pending at ${supabaseTarget(dev.url)}; batch target ${targetCount}.` +
      (selectedIds.length ? ` Selected IDs: ${selectedIds.join(", ")}.` : "")
  );

  if (targetCount === 0) {
    console.log("No curated pending article rows; no writer was started.");
    return;
  }
  if (!options.apply) {
    console.log(
      `Dry run: would start Codex ${options.codexModel} at ${options.codexReasoningEffort} reasoning for up to ${targetCount} article(s).`
    );
    console.log(
      options.grokFallback
        ? `Fallback: ${options.grokModel} after a classified Codex provider/account failure.`
        : "Fallback: disabled."
    );
    console.log(
      options.releaseCompleted
        ? "Post-provider release: enabled for the exact completed IDs selected by this batch."
        : "Post-provider release: disabled; completed rows remain queued for manual release."
    );
    return;
  }

  const releaseLock = await acquireAgentWorkLock(options.worktree, "article-batch");
  if (!releaseLock) {
    console.log(`Another article writer is active on ${os.hostname()}; this batch was skipped without overlap.`);
    return;
  }
  try {
    console.log(
      `Starting Codex ${options.codexModel} at ${options.codexReasoningEffort} reasoning for up to ${targetCount} article(s).`
    );
    const batchStartedAt = new Date().toISOString();
    try {
      let providerError: unknown = null;
      try {
        await runCodex(options, targetCount, dev, selectedIds);
      } catch (error) {
        const processError = error instanceof ProviderProcessError ? error : null;
        const fallbackReason = processError && !processError.timedOut
          ? classifyCodexFallbackReason(`${processError.message}\n${processError.output}`)
          : null;
        if (!options.grokFallback || !fallbackReason) {
          providerError = error;
        } else {
          const activityIds = await queueActivityIdsSince(dev, batchStartedAt, selectedIds);
          const untouchedIds = selectedIds.filter((id) => !activityIds.includes(id));
          const grokTarget = Math.min(fallbackTargetCount(targetCount, activityIds.length), untouchedIds.length);
          if (grokTarget === 0) {
            providerError = new Error(
              `Codex failed because of ${fallbackReason}, but all ${targetCount} batch slot(s) already show queue activity; ` +
                "Grok fallback was withheld to avoid overlapping partial work."
            );
          } else {
            console.warn(
              `Codex provider failure classified as ${fallbackReason}; starting one Grok fallback for up to ${grokTarget} untouched article(s).`
            );
            try {
              await runGrok(options, grokTarget, dev, untouchedIds.slice(0, grokTarget));
            } catch (fallbackError) {
              providerError = fallbackError;
            }
          }
        }
      }
      const completedRows = await completedQueueRowsSince(dev, batchStartedAt, selectedIds);
      if (completedRows.length === 0) {
        if (providerError) throw providerError;
        throw new Error("DEGRADED ARTICLE WRITER: A non-empty provider batch completed zero managed-dev articles.");
      }
      console.log(`Article writer completed ${completedRows.length} managed-dev article(s).`);
      if (options.releaseCompleted) await releaseCompletedArticles(options, completedRows);
      else console.log("Automatic production release is disabled for this batch; completed rows remain available for review.");
      if (providerError) throw providerError;
    } catch (error) {
      const reason = `Homelab article batch did not finish: ${errorMessage(error)}`.slice(0, 1_000);
      try {
        const released = await releaseUnfinishedBatchClaims(dev, selectedIds, reason);
        if (released) {
          console.warn(`Returned ${released} unfinished article claim(s) to blocked with a ${BATCH_RETRY_AFTER_MINUTES}-minute retry window.`);
        }
      } catch (cleanupError) {
        console.error(`Queue cleanup failed: ${errorMessage(cleanupError)}`);
      }
      throw error;
    }
  } finally {
    await releaseLock();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
