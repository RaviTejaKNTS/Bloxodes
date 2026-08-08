import "../shared/load-env";

import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  ARTICLE_DEV_ENV_KEYS,
  ARTICLE_QUEUE_ENV_KEYS,
  resolveArticleDevCredentials,
  supabaseTarget
} from "./article-queue-env";

type Options = {
  apply: boolean;
  queueId: string | null;
  maxAttempts: number;
  timeoutMinutes: number;
  worktree: string;
  grokBin: string;
};

type QueueRow = {
  id: string;
  article_title: string;
  article_type: string;
  status: string;
  attempts: number;
  source_name: string | null;
  source_url: string | null;
  source_urls: unknown;
  source_items: unknown;
  source_published_at: string | null;
  curation_reason: string | null;
  curation_confidence: number | null;
  locked_at: string | null;
  locked_by: string | null;
};

type GrokOutcome = {
  status: "completed" | "skipped" | "blocked" | "failed";
  final_path: string | null;
  result_slug: string | null;
  reason: string;
};

const QUEUE_SELECT = [
  "id",
  "article_title",
  "article_type",
  "status",
  "attempts",
  "source_name",
  "source_url",
  "source_urls",
  "source_items",
  "source_published_at",
  "curation_reason",
  "curation_confidence",
  "locked_at",
  "locked_by"
].join(",");

const GROK_OUTCOME_SCHEMA = JSON.stringify({
  type: "object",
  additionalProperties: false,
  required: ["status", "final_path", "result_slug", "reason"],
  properties: {
    status: { type: "string", enum: ["completed", "skipped", "blocked", "failed"] },
    final_path: { type: ["string", "null"] },
    result_slug: { type: ["string", "null"] },
    reason: { type: "string" }
  }
});

function printUsage() {
  console.log(`Usage: npm run articles:writer:homelab -- [options]

Options:
  --apply                    Claim one managed-dev queue item and run Grok (dry-run by default)
  --queue-id UUID            Target one pending queue item instead of the next eligible item
  --worktree PATH            Persistent Bloxodes writing worktree (default: current repo)
  --grok-bin PATH            Grok CLI path (default: ARTICLE_WRITER_GROK_BIN or grok)
  --max-attempts N           Terminal failure threshold, 1-10 (default: 3)
  --timeout-minutes N        Grok timeout, 10-360 (default: 120)
  --help                     Show this help

ARTICLE_DEV_SUPABASE_URL and ARTICLE_DEV_SUPABASE_SERVICE_ROLE own both queue and
draft content. Production is read only through ARTICLE_PRODUCTION_INVENTORY_URL.`);
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
    queueId: null,
    maxAttempts: parseInteger(process.env.ARTICLE_WRITER_MAX_ATTEMPTS ?? "3", "ARTICLE_WRITER_MAX_ATTEMPTS", 1, 10),
    timeoutMinutes: parseInteger(process.env.ARTICLE_WRITER_TIMEOUT_MINUTES ?? "120", "ARTICLE_WRITER_TIMEOUT_MINUTES", 10, 360),
    worktree: path.resolve(process.env.ARTICLE_WRITER_WORKTREE?.trim() || process.cwd()),
    grokBin: process.env.ARTICLE_WRITER_GROK_BIN?.trim() || "grok"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--queue-id") {
      options.queueId = requireValue(argv, index, arg);
      index += 1;
    } else if (arg.startsWith("--queue-id=")) {
      options.queueId = arg.slice("--queue-id=".length).trim();
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
    } else if (arg === "--max-attempts") {
      options.maxAttempts = parseInteger(requireValue(argv, index, arg), arg, 1, 10);
      index += 1;
    } else if (arg.startsWith("--max-attempts=")) {
      options.maxAttempts = parseInteger(arg.slice("--max-attempts=".length), "--max-attempts", 1, 10);
    } else if (arg === "--timeout-minutes") {
      options.timeoutMinutes = parseInteger(requireValue(argv, index, arg), arg, 10, 360);
      index += 1;
    } else if (arg.startsWith("--timeout-minutes=")) {
      options.timeoutMinutes = parseInteger(arg.slice("--timeout-minutes=".length), "--timeout-minutes", 10, 360);
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

async function acquireWriterLock(worktree: string): Promise<() => Promise<void>> {
  const lockDir = path.join(worktree, "tmp", "article-writer");
  const lockPath = path.join(lockDir, "writer.lock");
  const token = randomUUID();
  await mkdir(lockDir, { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, token, started_at: new Date().toISOString() }));
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
      let existingPid = 0;
      try {
        const existing = JSON.parse(await readFile(lockPath, "utf8")) as { pid?: unknown };
        existingPid = typeof existing.pid === "number" ? existing.pid : 0;
      } catch {
        // A malformed lock is stale unless another live PID can be established.
      }
      if (isProcessAlive(existingPid)) {
        throw new Error(`Another homelab article writer is already running with PID ${existingPid}.`);
      }
      await unlink(lockPath);
    }
  }
  throw new Error("Could not acquire the homelab article writer lock.");
}

async function assertDevWorkspace(options: Options): Promise<{ url: string; serviceRole: string }> {
  const dev = resolveArticleDevCredentials();
  await access(path.join(options.worktree, "package.json"), fsConstants.R_OK);
  if (path.isAbsolute(options.grokBin)) await access(options.grokBin, fsConstants.X_OK);
  return dev;
}

async function recoverStaleWriterClaims(queue: SupabaseClient, maxAttempts: number, staleMinutes: number) {
  const cutoff = new Date(Date.now() - staleMinutes * 60_000).toISOString();
  const { data, error } = await queue
    .from("article_generation_queue")
    .select("id, attempts")
    .eq("workflow_mode", "agent_runner")
    .eq("status", "processing")
    .like("locked_by", "grok-homelab:%")
    .lt("locked_at", cutoff);
  if (error) throw new Error(`Could not inspect stale homelab writer claims: ${error.message}`);
  for (const row of data ?? []) {
    const attempts = Number(row.attempts ?? 0);
    const terminal = attempts >= maxAttempts;
    const { error: updateError } = await queue
      .from("article_generation_queue")
      .update({
        status: terminal ? "failed" : "pending",
        last_error: "Recovered after the homelab Grok writer left a stale processing claim.",
        outcome_reason: terminal ? "Homelab Grok writer exceeded max attempts after stale claims." : null,
        locked_at: null,
        locked_by: null,
        next_attempt_at: terminal ? null : new Date().toISOString(),
        completed_at: terminal ? new Date().toISOString() : null
      })
      .eq("id", row.id)
      .eq("status", "processing")
      .like("locked_by", "grok-homelab:%")
      .lt("locked_at", cutoff);
    if (updateError) throw new Error(`Could not recover stale queue item ${row.id}: ${updateError.message}`);
  }
  if (data?.length) console.log(`Recovered ${data.length} stale homelab writer claim(s).`);
}

async function selectPendingQueueItem(queue: SupabaseClient, options: Options): Promise<QueueRow | null> {
  let query = queue
    .from("article_generation_queue")
    .select(QUEUE_SELECT)
    .eq("workflow_mode", "agent_runner")
    .not("curated_at", "is", null)
    .eq("status", "pending")
    .lt("attempts", options.maxAttempts)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${new Date().toISOString()}`);
  if (options.queueId) query = query.eq("id", options.queueId);
  const { data, error } = await query
    .order("source_published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not select a pending dev article: ${error.message}`);
  return data ? data as unknown as QueueRow : null;
}

async function claimQueueItem(queue: SupabaseClient, options: Options, workerId: string): Promise<QueueRow | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = await selectPendingQueueItem(queue, options);
    if (!candidate) return null;
    const now = new Date().toISOString();
    const { data, error } = await queue
      .from("article_generation_queue")
      .update({
        status: "processing",
        attempts: Number(candidate.attempts ?? 0) + 1,
        last_attempted_at: now,
        last_error: null,
        outcome_reason: null,
        locked_at: now,
        locked_by: workerId,
        next_attempt_at: null,
        completed_at: null
      })
      .eq("id", candidate.id)
      .eq("status", "pending")
      .select(QUEUE_SELECT)
      .maybeSingle();
    if (error) throw new Error(`Could not claim dev queue item ${candidate.id}: ${error.message}`);
    if (data) return data as unknown as QueueRow;
  }
  throw new Error("The next dev queue item changed repeatedly while being claimed.");
}

function buildGrokPrompt(row: QueueRow): string {
  const sourcePayload = Array.isArray(row.source_items) && row.source_items.length
    ? row.source_items
    : [{ source_name: row.source_name, source_url: row.source_url }];
  return `Run exactly one Bloxodes article through $bloxodes-article-workflow-runner.

This topic has already been Groq-curated and claimed by the homelab wrapper. Treat it as an explicit approved input. Do not list, claim, or update article_generation_queue; the wrapper owns queue state. You have no production database credentials.

Article title: ${row.article_title}
Article type: ${row.article_type}
Queue reference: ${row.id}
Curation reason: ${row.curation_reason ?? "Approved by automated curation."}
Source material: ${JSON.stringify(sourcePayload)}

Complete the normal research, parent review, writing-subagent, verification, managed-dev Supabase import, and real-browser localhost preview workflow. Check existing production coverage only with npm run articles:inventory:production. All database and Storage writes must remain in managed dev Supabase. Never publish or import the article to production. Do not open, inspect, print, or modify any .env file; the wrapper has already provided the safe dev environment required by repository commands.

At the end, return the required structured result:
- completed: final.json exists, verification and browser preview passed, and the matching article row exists in managed dev Supabase
- skipped: the topic should deliberately not be written (duplicate, unsupported, or no useful angle)
- blocked: an operational or evidence blocker prevented completion
- failed: an unrecoverable workflow failure

For completed, include the repo-relative final.json path and its slug. For every other status, use null for final_path/result_slug and give a concise reason.`;
}

function childEnvironment(dev: { url: string; serviceRole: string }): NodeJS.ProcessEnv {
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  for (const key of ARTICLE_QUEUE_ENV_KEYS) delete childEnv[key];
  for (const key of ARTICLE_DEV_ENV_KEYS) delete childEnv[key];
  delete childEnv.ARTICLE_WRITER_QUEUE_ENV_FILE;
  childEnv.SUPABASE_URL = dev.url;
  childEnv.SUPABASE_SERVICE_ROLE = dev.serviceRole;
  childEnv.ARTICLE_WRITER_DEV_ONLY = "true";
  return childEnv;
}

async function runGrok(
  options: Options,
  row: QueueRow,
  dev: { url: string; serviceRole: string }
): Promise<{ exitCode: number; stdout: string; timedOut: boolean }> {
  const args = [
    "--cwd",
    options.worktree,
    "--single",
    buildGrokPrompt(row),
    "--json-schema",
    GROK_OUTCOME_SCHEMA,
    "--output-format",
    "json",
    "--permission-mode",
    "bypassPermissions",
    "--max-turns",
    "200",
    "--no-memory",
    "--no-alt-screen"
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(options.grokBin, args, {
      cwd: options.worktree,
      env: childEnvironment(dev),
      stdio: ["ignore", "pipe", "inherit"]
    });
    let stdout = "";
    let timedOut = false;
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (stdout.length > 4_000_000) stdout = stdout.slice(-4_000_000);
    });
    child.on("error", reject);
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 15_000).unref();
    }, options.timeoutMinutes * 60_000);
    timeout.unref();
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ exitCode: code ?? 1, stdout, timedOut });
    });
  });
}

async function saveGrokOutput(worktree: string, queueId: string, stdout: string): Promise<string> {
  const outputDir = path.join(worktree, "tmp", "article-writer", "runs");
  await mkdir(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const outputPath = path.join(outputDir, `${timestamp}-${queueId}.json`);
  await writeFile(outputPath, stdout, "utf8");
  return path.relative(worktree, outputPath);
}

function isGrokOutcome(value: unknown): value is GrokOutcome {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    ["completed", "skipped", "blocked", "failed"].includes(String(row.status)) &&
    (typeof row.final_path === "string" || row.final_path === null) &&
    (typeof row.result_slug === "string" || row.result_slug === null) &&
    typeof row.reason === "string"
  );
}

function findGrokOutcome(value: unknown, depth = 0): GrokOutcome | null {
  if (depth > 5) return null;
  if (isGrokOutcome(value)) return value;
  if (typeof value === "string") {
    try {
      return findGrokOutcome(JSON.parse(value), depth + 1);
    } catch {
      return null;
    }
  }
  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
      const found = findGrokOutcome(value[index], depth + 1);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["structured_output", "result", "output", "content", "message", "data"]) {
      const found = findGrokOutcome(record[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function parseGrokOutcome(stdout: string): GrokOutcome {
  const trimmed = stdout.trim();
  if (!trimmed) throw new Error("Grok returned no structured output.");
  const attempts = [trimmed, ...trimmed.split(/\r?\n/).reverse()];
  for (const candidate of attempts) {
    try {
      const outcome = findGrokOutcome(JSON.parse(candidate));
      if (outcome) return outcome;
    } catch {
      // Try the next complete line or wrapper shape.
    }
  }
  throw new Error("Grok output did not contain the required structured outcome.");
}

async function verifyDevCompletion(
  outcome: GrokOutcome,
  options: Options,
  dev: { url: string; serviceRole: string }
): Promise<{ resultPath: string; resultSlug: string }> {
  if (!outcome.final_path) throw new Error("Grok reported completed without final_path.");
  const absolutePath = path.resolve(options.worktree, outcome.final_path);
  const relativePath = path.relative(options.worktree, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Grok final_path points outside the configured writing worktree.");
  }
  if (!relativePath.startsWith(`tmp${path.sep}content-workspace${path.sep}`) || path.basename(absolutePath) !== "final.json") {
    throw new Error("Grok final_path must be a final.json beneath tmp/content-workspace.");
  }
  const parsed = JSON.parse(await readFile(absolutePath, "utf8")) as { slug?: unknown };
  const fileSlug = typeof parsed.slug === "string" ? parsed.slug.trim() : "";
  const resultSlug = outcome.result_slug?.trim() || fileSlug;
  if (!fileSlug || !resultSlug || fileSlug !== resultSlug) {
    throw new Error("Grok result_slug does not match final.json.");
  }
  const devSupabase = createClient(dev.url, dev.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await devSupabase
    .from("articles")
    .select("id, slug, title")
    .eq("slug", resultSlug)
    .maybeSingle();
  if (error) throw new Error(`Could not verify the managed-dev article row: ${error.message}`);
  if (!data) throw new Error(`Grok reported completion but managed dev Supabase has no article row for ${resultSlug}.`);
  return { resultPath: relativePath, resultSlug };
}

async function markTerminal(
  queue: SupabaseClient,
  row: QueueRow,
  workerId: string,
  status: "completed" | "skipped",
  details: { reason: string; resultPath?: string; resultSlug?: string }
) {
  const { data, error } = await queue
    .from("article_generation_queue")
    .update({
      status,
      outcome_reason: details.reason || null,
      result_path: details.resultPath ?? null,
      result_slug: details.resultSlug ?? null,
      completed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      next_attempt_at: null,
      last_error: null
    })
    .eq("id", row.id)
    .eq("status", "processing")
    .eq("locked_by", workerId)
    .select("id");
  if (error) throw new Error(`Could not mark dev queue item ${status}: ${error.message}`);
  if (!data?.length) throw new Error("Dev queue ownership changed before the terminal update.");
}

async function releaseForRetry(
  queue: SupabaseClient,
  row: QueueRow,
  workerId: string,
  reason: string,
  maxAttempts: number
) {
  const terminal = Number(row.attempts ?? 0) >= maxAttempts;
  const delayMinutes = Math.min(360, 30 * 2 ** Math.max(0, Number(row.attempts ?? 1) - 1));
  const { data, error } = await queue
    .from("article_generation_queue")
    .update({
      status: terminal ? "failed" : "pending",
      last_error: reason.slice(0, 2000),
      outcome_reason: terminal ? reason.slice(0, 2000) : null,
      completed_at: terminal ? new Date().toISOString() : null,
      next_attempt_at: terminal ? null : new Date(Date.now() + delayMinutes * 60_000).toISOString(),
      locked_at: null,
      locked_by: null
    })
    .eq("id", row.id)
    .eq("status", "processing")
    .eq("locked_by", workerId)
    .select("id");
  if (error) throw new Error(`Could not release dev queue item after failure: ${error.message}`);
  if (!data?.length) throw new Error("Dev queue ownership changed before retry release.");
  console.log(terminal ? `Queue item failed after ${row.attempts} attempt(s).` : `Queue item returned to pending for retry in ${delayMinutes} minutes.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dev = await assertDevWorkspace(options);

  const releaseLock = await acquireWriterLock(options.worktree);
  try {
    const queue = createClient(dev.url, dev.serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    if (options.apply) await recoverStaleWriterClaims(queue, options.maxAttempts, options.timeoutMinutes + 30);
    const candidate = await selectPendingQueueItem(queue, options);
    if (!candidate) {
      console.log("No eligible Groq-curated dev article is waiting.");
      return;
    }
    console.log(`Dev queue and content database: ${supabaseTarget(dev.url)}`);
    console.log(`Next article: ${candidate.article_title} [${candidate.article_type}] (${candidate.id})`);
    console.log(`Sources: ${Array.isArray(candidate.source_urls) ? candidate.source_urls.length : candidate.source_url ? 1 : 0}`);
    if (!options.apply) {
      console.log("Dry run: no queue claim and no Grok process started. Pass --apply to write one article.");
      return;
    }

    const workerId = `grok-homelab:${os.hostname()}:${process.pid}`;
    const claimed = await claimQueueItem(queue, options, workerId);
    if (!claimed) {
      console.log("The selected article was claimed by another worker; nothing to do.");
      return;
    }
    console.log(`Claimed ${claimed.id}; starting Grok in ${options.worktree}.`);
    try {
      const result = await runGrok(options, claimed, dev);
      const grokOutputPath = await saveGrokOutput(options.worktree, claimed.id, result.stdout);
      console.log(`Grok output: ${grokOutputPath}`);
      if (result.timedOut) throw new Error(`Grok exceeded the ${options.timeoutMinutes}-minute timeout.`);
      if (result.exitCode !== 0) throw new Error(`Grok exited with code ${result.exitCode}.`);
      const outcome = parseGrokOutcome(result.stdout);
      if (outcome.status === "completed") {
        const verified = await verifyDevCompletion(outcome, options, dev);
        await markTerminal(queue, claimed, workerId, "completed", {
          reason: outcome.reason,
          resultPath: verified.resultPath,
          resultSlug: verified.resultSlug
        });
        console.log(`Completed in managed dev: ${verified.resultSlug} (${verified.resultPath})`);
      } else if (outcome.status === "skipped") {
        await markTerminal(queue, claimed, workerId, "skipped", { reason: outcome.reason });
        console.log(`Skipped: ${outcome.reason}`);
      } else {
        await releaseForRetry(queue, claimed, workerId, `${outcome.status}: ${outcome.reason}`, options.maxAttempts);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await releaseForRetry(queue, claimed, workerId, reason, options.maxAttempts);
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
