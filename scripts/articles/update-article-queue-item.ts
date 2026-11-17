import "./load-notion-article-env";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createNotionArticleQueue, createNotionGameArticleQueue, articleQueueClaimExpired } from "./notion-article-queue";
import { withArticleQueueClaimLock, newArticleClaimToken, confirmArticleQueueClaim, assertArticleClaimToken } from "./article-queue-claim";
import type { NotionArticleQueue } from "./notion-article-queue";
import { assertArticleQueueTransition, parseArticleQueueStatus, type ArticleQueueStatus } from "./article-queue-status";

type TargetStatus = Exclude<ArticleQueueStatus, "pending">;

type Options = {
  queueId: string;
  status: TargetStatus;
  apply: boolean;
  worker: string;
  claimToken?: string;
  reason: string | null;
  resultPath: string | null;
  resultSlug: string | null;
  productionUrl: string | null;
  devEnvFile: string | null;
  retryAfterMinutes: number;
  retryAfter?: string; namespace?: string; gameSlug?: string; gameKind?: string;
};

type QueueRow = {
  id: string;
  article_title: string | null;
  workflow_mode: string;
  status: string;
  attempts: number | null;
  source_url: string | null;
  result_path: string | null;
  result_slug: string | null;
  production_url: string | null;
};

function printUsage() {
  console.log(
    "Usage: npm run articles:queue:update -- --queue-id UUID --status processing|blocked|completed|published|rejected|skipped|failed --apply [--dev-env-file PATH] [--worker NAME] [--claim-token TOKEN] [--reason TEXT] [--retry-after-minutes N] [--result-path final.json] [--result-slug SLUG] [--production-url URL]"
  );
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

function parseArgs(argv: string[], gameQueue = false): Options {
  const options: Options = {
    queueId: "",
    status: "processing",
    apply: false,
    worker: "codex-homelab",
    reason: null,
    resultPath: null,
    resultSlug: null,
    productionUrl: null,
    devEnvFile: null,
    retryAfterMinutes: 180
  };
  let hasStatus = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg === "--queue-id") {
      options.queueId = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === "--status") {
      const value = parseArticleQueueStatus(requireValue(argv, index, arg));
      if (value === "pending") throw new Error("Use the writer retry flow to return an item to pending.");
      options.status = value;
      hasStatus = true;
      index += 1;
    } else if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--worker") {
      options.worker = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === "--claim-token") {
      options.claimToken = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === "--reason") {
      options.reason = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === "--result-path") {
      options.resultPath = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === "--result-slug") {
      options.resultSlug = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === "--production-url") {
      options.productionUrl = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === "--dev-env-file") {
      options.devEnvFile = requireValue(argv, index, arg);
      index += 1;
    } else if (gameQueue && ["--namespace", "--game-slug", "--kind", "--retry-after"].includes(arg)) {
      const value = requireValue(argv,index,arg);index++;
      if(arg === "--retry-after") {if(!Number.isFinite(Date.parse(value)))throw new Error("Invalid --retry-after date.");options.retryAfter=new Date(value).toISOString();}
      else if(arg === "--kind") {if(!["game","franchise"].includes(value))throw new Error("--kind must be game or franchise.");options.gameKind=value;}
      else {if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))throw new Error(`${arg} must be a slug.`);if(arg==="--namespace")options.namespace=value;else options.gameSlug=value;}
    } else if (arg === "--retry-after-minutes") {
      const value = Number(requireValue(argv, index, arg));
      if (!Number.isInteger(value) || value < 5 || value > 10080) {
        throw new Error("--retry-after-minutes must be an integer from 5 to 10080.");
      }
      options.retryAfterMinutes = value;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.queueId) throw new Error("--queue-id is required.");
  if (!hasStatus) throw new Error("--status is required.");
  if (!options.apply) throw new Error("Queue state changes require --apply.");
  if (["blocked", "rejected", "skipped", "failed"].includes(options.status) && !options.reason?.trim()) {
    throw new Error(`${options.status} requires --reason.`);
  }
  if (options.status === "completed" && !options.claimToken) throw new Error("completed requires --claim-token from the successful claim.");
  if (options.status === "completed" && !options.resultPath) {
    throw new Error("completed requires --result-path so local output can be verified.");
  }
  if (options.status === "published" && !options.productionUrl) {
    throw new Error("published requires --production-url after the exact live article URL is verified.");
  }
  if(gameQueue && !["processing","blocked","completed","skipped"].includes(options.status))throw new Error("Game queue supports processing, blocked, completed and skipped. Publishing acknowledges Published.");
  return options;
}

async function verifyCompletedOutput(options: Options): Promise<{ resultPath: string; resultSlug: string }> {
  const absolutePath = path.resolve(process.cwd(), options.resultPath!);
  const raw = await readFile(absolutePath, "utf8");
  const parsed = JSON.parse(raw) as { slug?: unknown };
  const fileSlug = typeof parsed.slug === "string" ? parsed.slug.trim() : "";
  const resultSlug = options.resultSlug?.trim() || fileSlug;
  if (!resultSlug) throw new Error(`${options.resultPath} does not contain a usable slug.`);
  if (options.resultSlug && fileSlug && options.resultSlug !== fileSlug) {
    throw new Error(`--result-slug (${options.resultSlug}) does not match final.json slug (${fileSlug}).`);
  }
  return { resultPath: path.relative(process.cwd(), absolutePath), resultSlug };
}

function assertTransition(row: QueueRow, status: TargetStatus, reason: string | null) {
  if (row.workflow_mode !== "agent_runner") {
    throw new Error(`Queue item ${row.id} belongs to ${row.workflow_mode}, not the article runner.`);
  }
  assertArticleQueueTransition(row.status, status);
  // Reopening a rejected draft is a deliberate decision; record why on the row.
  if (row.status === "rejected" && ["processing", "completed"].includes(status) && !reason?.trim()) {
    throw new Error("Reopening a rejected item requires --reason saying what was fixed and re-verified.");
  }
}

function verifyProductionUrl(value: string, resultSlug: string | null): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || !["bloxodes.com", "www.bloxodes.com"].includes(url.hostname)) {
    throw new Error("--production-url must use https://bloxodes.com.");
  }
  if (!resultSlug) throw new Error("The completed queue row has no result_slug to verify against production.");
  if (url.pathname !== `/articles/${resultSlug}` || url.search || url.hash) {
    throw new Error(`--production-url must be the exact canonical article URL: https://bloxodes.com/articles/${resultSlug}`);
  }
  return `https://${url.hostname}${url.pathname}`;
}

export async function runQueueUpdate(argv: string[], gameQueue = false, dependencies: { queue?: NotionArticleQueue; settle?: () => Promise<void> } = {}) {
  const options = parseArgs(argv, gameQueue);
  const queue = dependencies.queue ?? (gameQueue ? createNotionGameArticleQueue({ envFile: options.devEnvFile }) : createNotionArticleQueue({ envFile: options.devEnvFile }));
  if(gameQueue && !queue.config.statuses.includes(options.status))throw new Error(`Unsupported game queue status: ${options.status}`);
  await queue.validate();

  const work = async () => {
    const completedOutput = options.status === "completed" ? await verifyCompletedOutput(options) : null;
    let row = await queue.get(options.queueId);
    if(options.status === "processing") {
      if(row.status === "processing" && !articleQueueClaimExpired(row))throw new Error("Queue row has an active claim. Wait for expiry or use its claim token to complete it.");
      if(articleQueueClaimExpired(row)) row=await queue.update(row.id,{status:"pending",locked_at:null,locked_by:null,next_attempt_at:null},{status:row.status,updated_at:row.updated_at});
      if(gameQueue) {
        options.namespace ??= row.namespace;options.gameSlug ??= row.game_slug;options.gameKind ??= row.game_kind;
        if(!options.namespace || options.namespace === "roblox" || !options.gameSlug || !options.gameKind)throw new Error("Claim requires --namespace, --game-slug and --kind.");
      }
    }
    const requiresClaimToken = options.status === "completed" || row.status === "processing" && options.status !== "processing";
    if(requiresClaimToken) assertArticleClaimToken(row, options.claimToken);
    assertTransition(row, options.status, options.reason);
    const replacesCompletedOutput = row.status === "completed" && options.status === "completed" && completedOutput &&
      (row.result_path !== completedOutput.resultPath || row.result_slug !== completedOutput.resultSlug);
    if (completedOutput && row.result_slug && row.result_slug !== completedOutput.resultSlug) {
      throw new Error("A completed article revision must preserve its existing slug.");
    }
    if (row.status === options.status && options.status !== "processing" && !replacesCompletedOutput) {
      if (options.status === "published") {
        const productionUrl = verifyProductionUrl(options.productionUrl!, row.result_slug);
        if (row.production_url !== productionUrl) {
          throw new Error(`Queue item ${row.id} is published with a different production URL: ${row.production_url ?? "missing"}`);
        }
      }
      console.log(`Queue item ${row.id} is already ${row.status}; no update needed.`);
      return;
    }

    const now = new Date().toISOString();
    const claimToken = options.status === "processing" ? newArticleClaimToken(options.worker) : undefined;
    const update: Record<string, unknown> = { status: options.status, updated_at: now };
    if (options.status === "processing") {
      if(gameQueue)Object.assign(update,{namespace:options.namespace,game_slug:options.gameSlug,game_kind:options.gameKind});
      Object.assign(update, {
        attempts: (row.attempts ?? 0) + (row.status === "processing" ? 0 : 1),
        last_attempted_at: now,
        locked_at: now,
        locked_by: claimToken,
        last_error: null,
        outcome_reason: row.status === "rejected" ? options.reason!.trim() : null,
        completed_at: null,
        published_at: null,
        rejected_at: null,
        production_url: null
      });
    } else if (options.status === "blocked") {
      Object.assign(update, {
        completed_at: null,
        locked_at: null,
        locked_by: null,
        next_attempt_at: options.retryAfter ?? new Date(Date.now() + options.retryAfterMinutes * 60_000).toISOString(),
        outcome_reason: options.reason!.trim(),
        last_error: options.reason!.trim(),
        published_at: null,
        rejected_at: null,
        production_url: null
      });
    } else if (options.status === "completed") {
      Object.assign(update, {
        completed_at: now,
        locked_at: row.locked_at,
        locked_by: row.locked_by,
        next_attempt_at: null,
        outcome_reason: options.reason?.trim() || null,
        last_error: null,
        published_at: null,
        rejected_at: null,
        production_url: null
      });
      if (completedOutput) {
        update.result_path = completedOutput.resultPath;
        update.result_slug = completedOutput.resultSlug;
      }
    } else if (options.status === "published") {
      Object.assign(update, {
        published_at: now,
        rejected_at: null,
        production_url: verifyProductionUrl(options.productionUrl!, row.result_slug),
        outcome_reason: null,
        last_error: null,
        locked_at: null,
        locked_by: null,
        next_attempt_at: null
      });
    } else if (options.status === "rejected") {
      Object.assign(update, {
        rejected_at: now,
        published_at: null,
        production_url: null,
        outcome_reason: options.reason!.trim(),
        last_error: null,
        locked_at: null,
        locked_by: null,
        next_attempt_at: null
      });
    } else {
      Object.assign(update, {
        completed_at: now,
        locked_at: null,
        locked_by: null,
        next_attempt_at: null,
        outcome_reason: options.reason?.trim() || null,
        last_error: options.status === "failed" ? options.reason?.trim() : null,
        published_at: null,
        rejected_at: null,
        production_url: null
      });
    }

    await queue.update(row.id, update, {
      status: row.status, updated_at: row.updated_at,
      ...(requiresClaimToken ? {locked_by:options.claimToken,locked_at:row.locked_at} : {}),
      ...(replacesCompletedOutput ? { result_path: row.result_path } : {})
    });
    if(claimToken) {
      await confirmArticleQueueClaim(queue,row.id,claimToken,now,dependencies.settle);
      console.log(JSON.stringify({id:row.id,status:"processing",claim_token:claimToken}));
    } else console.log(`${row.article_title ?? row.id}: ${row.status} -> ${options.status}`);
  };
  // Cancellation and fresh claims must share the same lock as completion.
  return withArticleQueueClaimLock(work);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runQueueUpdate(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
