import "../shared/load-env";

import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, open, readFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import {
  ARTICLE_DEV_ENV_KEYS,
  ARTICLE_QUEUE_ENV_KEYS,
  resolveArticleDevCredentials,
  supabaseTarget
} from "./article-queue-env";

type Options = {
  apply: boolean;
  limit: number;
  timeoutMinutes: number;
  worktree: string;
  grokBin: string;
  grokModel: string;
  maxAttempts: number;
};

const MAX_BATCH_SIZE = 6;

function printUsage() {
  console.log(`Usage: npm run articles:writer:batch -- [options]

Options:
  --apply                    Run Grok; dry-run by default
  --limit N                  Maximum queued articles, 1-6 (default: 6)
  --worktree PATH            Persistent Bloxodes worktree (default: current repo)
  --grok-bin PATH            Grok CLI path (default: ARTICLE_WRITER_GROK_BIN or grok)
  --grok-model MODEL         Grok model (default: ARTICLE_WRITER_GROK_MODEL or grok-4.5)
  --max-attempts N           Retry threshold for blocked rows, 1-10 (default: 3)
  --timeout-minutes N        Batch timeout, 30-330 (default: 300)
  --help                     Show this help

The batch exits without invoking Grok when no curated pending queue rows exist.`);
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
    grokBin: process.env.ARTICLE_WRITER_GROK_BIN?.trim() || "grok",
    grokModel: process.env.ARTICLE_WRITER_GROK_MODEL?.trim() || "grok-4.5",
    maxAttempts: parseInteger(process.env.ARTICLE_WRITER_MAX_ATTEMPTS ?? "3", "ARTICLE_WRITER_MAX_ATTEMPTS", 1, 10)
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
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function acquireWriterLock(worktree: string): Promise<(() => Promise<void>) | null> {
  const lockDir = path.join(worktree, "tmp", "article-writer");
  const lockPath = path.join(lockDir, "writer.lock");
  const token = randomUUID();
  await mkdir(lockDir, { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, token, started_at: new Date().toISOString(), mode: "batch" }));
      await handle.close();
      return async () => {
        try {
          const current = JSON.parse(await readFile(lockPath, "utf8")) as { token?: unknown };
          if (current.token === token) await unlink(lockPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const current = JSON.parse(await readFile(lockPath, "utf8")) as { pid?: unknown };
        if (typeof current.pid === "number" && isProcessAlive(current.pid)) return null;
      } catch {
        // A malformed or incomplete stale lock is safe to replace once.
      }
      await unlink(lockPath).catch((unlinkError) => {
        if ((unlinkError as NodeJS.ErrnoException).code !== "ENOENT") throw unlinkError;
      });
    }
  }
  throw new Error(`Could not acquire article writer lock at ${lockPath}.`);
}

async function pendingQueueCount(dev: { url: string; serviceRole: string }): Promise<number> {
  const supabase = createClient(dev.url, dev.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { count, error } = await supabase
    .from("article_generation_queue")
    .select("id", { count: "exact", head: true })
    .eq("workflow_mode", "agent_runner")
    .eq("status", "pending")
    .not("curated_at", "is", null);
  if (error) throw new Error(`Could not count pending article queue rows: ${error.message}`);
  return count ?? 0;
}

async function completedQueueCountSince(
  dev: { url: string; serviceRole: string },
  startedAt: string
): Promise<number> {
  const supabase = createClient(dev.url, dev.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { count, error } = await supabase
    .from("article_generation_queue")
    .select("id", { count: "exact", head: true })
    .eq("workflow_mode", "agent_runner")
    .eq("status", "completed")
    .gte("completed_at", startedAt);
  if (error) throw new Error(`Could not count articles completed by the current batch: ${error.message}`);
  return count ?? 0;
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
  return `Use /bloxodes-article-workflow-runner for this unattended homelab batch.

No explicit article topic is supplied. Load the newest pending Groq-curated agent_runner rows from article_generation_queue and process at most ${targetCount} accepted articles in this run. Use the runner's required research, image, and writing subagents, queueing work within this same parent run when available subagent slots are full. Continue until those accepted articles are completed, deliberately skipped, or terminally failed; do not stop after producing only a plan.

Follow the complete workflow for every accepted row: processing status, research brief, parent review, separate image subagent with required media.json and at least one planned target, separate writing subagent, managed-dev import, verifier, real-browser localhost preview, and immediate final queue status. Never classify images as optional or set expected_count to zero. An article may have no body images only when the image pass searched reliable sources for every accurate, helpful target, recorded at least two distinct query variants and two checked source-page URLs per omitted target, and the parent explicitly marked every target accepted_missing. Do not invent substitute topics. Never publish to production. Production access is limited to the GET-only editorial inventory command.`;
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
  return childEnv;
}

async function runGrok(options: Options, targetCount: number, dev: { url: string; serviceRole: string }): Promise<void> {
  const args = [
    "--cwd",
    options.worktree,
    "--model",
    options.grokModel,
    "--always-approve",
    "--single",
    buildPrompt(targetCount),
    "--max-turns",
    "400",
    "--no-memory",
    "--no-alt-screen"
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(options.grokBin, args, {
      cwd: options.worktree,
      env: childEnvironment(dev),
      stdio: "inherit"
    });
    let timedOut = false;
    child.on("error", reject);
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 15_000).unref();
    }, options.timeoutMinutes * 60_000);
    timeout.unref();
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (timedOut) reject(new Error(`Grok batch exceeded ${options.timeoutMinutes} minutes.`));
      else if (code !== 0) reject(new Error(`Grok batch exited with code ${code ?? 1}.`));
      else resolve();
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (path.isAbsolute(options.grokBin)) await access(options.grokBin, fsConstants.X_OK);
  const dev = resolveArticleDevCredentials();
  if (options.apply) {
    const retryResult = await requeueDueBlockedRows(dev, options.maxAttempts);
    if (retryResult.requeued) console.log(`Returned ${retryResult.requeued} due blocked article row(s) to pending.`);
    if (retryResult.failed) console.log(`Closed ${retryResult.failed} blocked article row(s) after max attempts.`);
  }
  const pending = await pendingQueueCount(dev);
  const targetCount = Math.min(options.limit, pending);
  console.log(`Managed dev queue: ${pending} pending at ${supabaseTarget(dev.url)}; batch target ${targetCount}.`);

  if (targetCount === 0) {
    console.log("No curated pending article rows; Grok was not started.");
    return;
  }
  if (!options.apply) {
    console.log(`Dry run: would start ${options.grokModel} with automatic approval for up to ${targetCount} article(s).`);
    return;
  }

  const releaseLock = await acquireWriterLock(options.worktree);
  if (!releaseLock) {
    console.log(`Another article writer is active on ${os.hostname()}; this batch was skipped without overlap.`);
    return;
  }
  try {
    console.log(`Starting ${options.grokModel} batch for up to ${targetCount} article(s) with automatic approval.`);
    const batchStartedAt = new Date().toISOString();
    await runGrok(options, targetCount, dev);
    const completed = await completedQueueCountSince(dev, batchStartedAt);
    if (completed === 0) {
      throw new Error("DEGRADED ARTICLE WRITER: Grok processed a non-empty batch but completed zero managed-dev articles.");
    }
    console.log(`Grok batch completed ${completed} managed-dev article(s).`);
  } finally {
    await releaseLock();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
