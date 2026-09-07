import "../shared/load-env";

import { spawn } from "node:child_process";
import { accessSync, constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

import {
  resolveArticleDevCredentials,
  supabaseTarget
} from "./article-queue-env";
import {
  parseCodexReasoningEffort,
  type CodexReasoningEffort
} from "./article-writer-provider";
import { acquireAgentWorkLock } from "../shared/agent-work-lock";
import { managedArticleEnvironment, withArticlePreview } from "./run-article-pipeline";
import { processArticleQueueRow } from "./article-pipeline-queue";

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
  queueId?: string;
};

type QueueRowReference = {
  id: string;
};

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
  --apply                    Run code-controlled article stages; dry-run by default
  --limit N                  Maximum queued articles, 1-6 (default: 6)
  --queue-id UUID            Select only this curated pending row
  --worktree PATH            Persistent Bloxodes worktree (default: current repo)
  --codex-bin PATH           Codex CLI path (default: ARTICLE_WRITER_CODEX_BIN or codex)
  --codex-model MODEL        Codex model (default: ARTICLE_WRITER_CODEX_MODEL or gpt-5.6-luna)
  --codex-reasoning EFFORT   Codex reasoning effort (default: ARTICLE_WRITER_CODEX_REASONING_EFFORT or max)
  --no-grok-fallback         Disable the Grok provider fallback
  --grok-bin PATH            Grok CLI path (default: ARTICLE_WRITER_GROK_BIN or grok)
  --grok-model MODEL         Grok model (default: ARTICLE_WRITER_GROK_MODEL or grok-4.5)
  --max-attempts N           Retry threshold for blocked rows, 1-10 (default: 3)
  --timeout-minutes N        Batch timeout, 30-330 (default: 300)
  --release-completed        Publish only code-verified completed rows to production (default)
  --skip-production-release  Leave completed rows in the queue for manual release
  --help                     Show this help

The batch exits without invoking a writer when no curated pending queue rows exist.
Grok is a single-stage fallback only after a classified Codex provider/account failure; neither provider controls workers.`);
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
      process.env.ARTICLE_WRITER_CODEX_REASONING_EFFORT?.trim() || "max"
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
    } else if (arg === "--queue-id") {
      options.queueId = requireValue(argv, index++, arg);
      if (!/^[0-9a-f-]{36}$/i.test(options.queueId)) throw new Error("--queue-id requires a UUID.");
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
  limit: number,
  queueId?: string
): Promise<{ total: number; rows: QueueRowReference[] }> {
  const supabase = createClient(dev.url, dev.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  let query = supabase
    .from("article_generation_queue")
    .select("id", { count: "exact" })
    .eq("workflow_mode", "agent_runner")
    .eq("status", "pending")
    .not("curated_at", "is", null)
    .order("source_published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (queueId) query = query.eq("id", queueId);
  const { data, count, error } = await query;
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

export async function recoverStaleBatchClaims(
  dev: { url: string; serviceRole: string },
  maxAttempts: number,
  staleMinutes: number,
  queueId?: string
): Promise<number> {
  const supabase = createClient(dev.url, dev.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const cutoff = new Date(Date.now() - staleMinutes * 60_000).toISOString();
  let query = supabase
    .from("article_generation_queue")
    .select("id, attempts")
    .eq("workflow_mode", "agent_runner")
    .eq("status", "processing")
    .like("locked_by", "%-homelab%")
    .lt("locked_at", cutoff);
  if (queueId) query = query.eq("id", queueId);
  const { data, error } = await query;
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

export async function requeueDueBlockedRows(
  dev: { url: string; serviceRole: string },
  maxAttempts: number,
  queueId?: string
): Promise<{ requeued: number; failed: number }> {
  const supabase = createClient(dev.url, dev.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const now = new Date().toISOString();
  let exhausted = supabase
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
  if (queueId) exhausted = exhausted.eq("id", queueId);
  const { data: failedRows, error: failedError } = await exhausted;
  if (failedError) throw new Error(`Could not close exhausted blocked article rows: ${failedError.message}`);
  let due = supabase
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
  if (queueId) due = due.eq("id", queueId);
  const { data, error } = await due;
  if (error) throw new Error(`Could not requeue due blocked article rows: ${error.message}`);
  return { requeued: data?.length ?? 0, failed: failedRows?.length ?? 0 };
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
  if (options.grokFallback && path.isAbsolute(options.grokBin)) await access(options.grokBin, fsConstants.X_OK);
  const dev = resolveArticleDevCredentials();
  const releaseLock = options.apply ? await acquireAgentWorkLock(options.worktree, "article-batch") : null;
  if (options.apply && !releaseLock) {
    console.log(`Another article/wiki writer is active on ${os.hostname()}; no queue state changed.`);
    return;
  }
  try {
    if (options.apply) {
      const staleClaims = await recoverStaleBatchClaims(dev, options.maxAttempts, options.timeoutMinutes + 30, options.queueId);
      if (staleClaims) console.log(`Recovered ${staleClaims} stale homelab batch claim(s).`);
      const retryResult = await requeueDueBlockedRows(dev, options.maxAttempts, options.queueId);
      if (retryResult.requeued) console.log(`Returned ${retryResult.requeued} due blocked article row(s) to pending.`);
      if (retryResult.failed) console.log(`Closed ${retryResult.failed} blocked article row(s) after max attempts.`);
    }
    const selection = await pendingQueueSelection(dev, options.limit, options.queueId);
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
          ? "Post-verification release: enabled for the exact completed IDs selected by this batch."
          : "Post-verification release: disabled; completed rows remain queued for manual release."
      );
      return;
    }

    console.log(
      `Starting code-controlled pipeline with ${options.codexModel} at ${options.codexReasoningEffort} reasoning for up to ${targetCount} article(s).`
    );
    const batchStartedAt = new Date().toISOString();
    try {
      let providerError: unknown = null;
      const verifiedIds: string[] = [];
      const deadline = Date.now() + options.timeoutMinutes * 60_000;
      const controller = new AbortController();
      const stop = () => controller.abort();
      process.once("SIGTERM", stop); process.once("SIGINT", stop);
      const stageMinutes = Number(process.env.ARTICLE_PIPELINE_STAGE_TIMEOUT_MINUTES ?? "45");
      if (!Number.isFinite(stageMinutes) || stageMinutes < 1 || stageMinutes > 120) throw new Error("Stage timeout must be 1-120 minutes.");
      const env = managedArticleEnvironment(dev);
      try {
        await withArticlePreview(options.worktree, env, process.env.ARTICLE_PIPELINE_PREVIEW_BASE_URL, async baseUrl => {
          for (const id of selectedIds) {
            if (controller.signal.aborted || Date.now() >= deadline) break;
            try {
              const result = await processArticleQueueRow(dev, id, {
                worktree: options.worktree, runDir: path.join(options.worktree, "tmp/article-pipeline", id), env, baseUrl,
                deadline, stageTimeoutMs: stageMinutes * 60_000, signal: controller.signal,
                codexBin: options.codexBin, model: options.codexModel, reasoning: options.codexReasoningEffort,
                grokFallback: options.grokFallback, grokBin: options.grokBin, grokModel: options.grokModel
              });
              if (result?.status === "completed") verifiedIds.push(id);
              if (result?.blockerKind === "provider") {
                providerError = new Error(result.feedback);
                console.warn("Provider access failed; remaining selected articles stay pending.");
                break;
              }
            } catch (error) { providerError = error; console.error(errorMessage(error)); }
          }
        });
        if (controller.signal.aborted) providerError = new Error("Article batch stopped by external request; saved stages retained.");
      } finally { process.off("SIGTERM", stop); process.off("SIGINT", stop); }
      const completedRows = await completedQueueRowsSince(dev, batchStartedAt, verifiedIds);
      if (completedRows.length === 0) {
        if (providerError) throw providerError;
        throw new Error("DEGRADED ARTICLE WRITER: A non-empty batch completed zero verified managed-dev articles.");
      }
      console.log(`Article writer completed ${completedRows.length} managed-dev article(s).`);
      if (options.releaseCompleted && !controller.signal.aborted) await releaseCompletedArticles(options, completedRows);
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
    if (releaseLock) await releaseLock();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
