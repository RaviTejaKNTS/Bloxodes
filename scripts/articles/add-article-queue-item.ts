import "../shared/load-env";

import path from "node:path";
import { pathToFileURL } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { slugify } from "@/lib/slug";
import { resolveArticleDevCredentials } from "./article-queue-env";
import {
  articleQueueIdempotencyKey,
  findExistingQueueRow,
  findProductionArticleDuplicate
} from "./article-queue-dedupe";
import { ARTICLE_TOPIC_DEDUPE_STATUSES } from "./article-queue-status";
import { fetchProductionEditorialInventory, type ProductionInventoryItem } from "./production-editorial-inventory";

const ARTICLE_TYPES = ["guide", "tier_list", "explainer"] as const;
const SOURCE_NAME = "Bloxodes Content Factory";

export type AddArticleQueueOptions = {
  title: string;
  type: (typeof ARTICLE_TYPES)[number];
  sourceUrls: string[];
  reason: string;
  universeId: number | null;
  claim: boolean;
  worker: string;
  devEnvFile: string | null;
  json: boolean;
  apply: boolean;
};

export function parseArgs(argv: string[]): AddArticleQueueOptions {
  const values: Record<string, string> = {};
  const sourceUrls: string[] = [];
  const switches = new Set<string>();
  const valueFlags = new Set(["--title", "--type", "--source-url", "--reason", "--universe-id", "--worker", "--dev-env-file"]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (["--claim", "--json", "--apply"].includes(arg)) {
      switches.add(arg);
      continue;
    }
    const separator = arg.indexOf("=");
    const flag = separator < 0 ? arg : arg.slice(0, separator);
    if (!valueFlags.has(flag)) throw new Error(`Unknown option: ${arg}`);
    const value = (separator < 0 ? argv[++index] : arg.slice(separator + 1))?.trim();
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
    if (flag === "--source-url") {
      let url: URL;
      try { url = new URL(value); } catch { throw new Error("--source-url must be a valid HTTPS URL."); }
      if (url.protocol !== "https:") throw new Error("--source-url must use HTTPS.");
      sourceUrls.push(url.href);
    } else {
      values[flag] = value;
    }
  }

  if (!values["--title"]) throw new Error("--title is required.");
  if (!slugify(values["--title"])) throw new Error("--title must contain letters or numbers usable in a topic key.");
  if (!values["--type"]) throw new Error("--type is required.");
  if (!ARTICLE_TYPES.includes(values["--type"] as AddArticleQueueOptions["type"])) {
    throw new Error("--type must be guide, tier_list, or explainer.");
  }
  if (!sourceUrls.length) throw new Error("At least one --source-url is required.");
  if (!values["--reason"]) throw new Error("--reason is required.");
  const universeId = values["--universe-id"] === undefined ? null : Number(values["--universe-id"]);
  if (universeId !== null && (!/^\d+$/.test(values["--universe-id"]) || !Number.isSafeInteger(universeId) || universeId < 1)) {
    throw new Error("--universe-id must be a positive safe integer.");
  }
  return {
    title: values["--title"],
    type: values["--type"] as AddArticleQueueOptions["type"],
    sourceUrls: [...new Set(sourceUrls)],
    reason: values["--reason"],
    universeId,
    claim: switches.has("--claim"),
    worker: values["--worker"] ?? "t3-content-factory",
    devEnvFile: values["--dev-env-file"] ?? null,
    json: switches.has("--json"),
    apply: switches.has("--apply")
  };
}

export function buildQueueRow(options: AddArticleQueueOptions, now = new Date().toISOString()) {
  return {
    article_title: options.title,
    article_type: options.type,
    universe_id: options.universeId,
    workflow_mode: "agent_runner",
    status: options.claim ? "processing" : "pending",
    attempts: options.claim ? 1 : 0,
    topic_key: slugify(options.title),
    idempotency_key: articleQueueIdempotencyKey(options.title, options.universeId),
    curated_at: now,
    curation_model: "content-factory-main-agent",
    curation_reason: options.reason,
    source_name: SOURCE_NAME,
    // A game page can prompt several topics; retain provenance in the plural fields.
    source_url: null,
    source_urls: options.sourceUrls,
    sources: options.sourceUrls.join("\n"),
    source_items: options.sourceUrls.map((url) => ({
      source_name: SOURCE_NAME,
      source_url: url,
      source_title: null,
      source_published_at: now,
      source_discovered_at: now,
      source_description: null,
      source_evidence: {}
    })),
    source_metadata: { origin: "content-factory", universe_id: options.universeId },
    source_published_at: now,
    source_discovered_at: now,
    created_at: now,
    updated_at: now,
    last_attempted_at: options.claim ? now : null,
    locked_at: options.claim ? now : null,
    locked_by: options.claim ? options.worker : null,
    last_error: null,
    outcome_reason: null,
    next_attempt_at: null,
    completed_at: null,
    published_at: null,
    rejected_at: null,
    production_url: null
  };
}

type Duplicate =
  | { kind: "queue"; id: unknown; article_title: unknown; status: unknown; workflow_mode?: unknown }
  | { kind: "production"; key: string; title: string };

export type AddArticleQueueResult =
  | { kind: "dry_run"; exitCode: 0; row: ReturnType<typeof buildQueueRow>; duplicate: Duplicate | null }
  | { kind: "duplicate"; exitCode: 3; duplicate: Duplicate }
  | { kind: "inserted"; exitCode: 0; row: { id: string; status: string; article_title: string; topic_key: string } };

function queueDuplicate(row: Record<string, unknown>): Duplicate {
  return {
    kind: "queue", id: row.id, article_title: row.article_title, status: row.status,
    ...(row.workflow_mode === undefined ? {} : { workflow_mode: row.workflow_mode })
  };
}

/** Recover unique-index conflicts across workflows without changing curation's lookup. */
async function findConflictingQueueRow(
  supabase: SupabaseClient,
  topicKey: string,
  idempotencyKey: string
): Promise<Record<string, unknown> | null> {
  for (const [column, value] of [["topic_key", topicKey], ["idempotency_key", idempotencyKey]] as const) {
    let query = supabase
      .from("article_generation_queue")
      .select("id, article_title, status, workflow_mode")
      .eq(column, value);
    if (column === "topic_key") {
      // Migration 20260920000005 also includes blocked topics in this index.
      query = query.in("status", ARTICLE_TOPIC_DEDUPE_STATUSES);
    } else {
      query = query.in("status", ["pending", "processing"]).is("event_id", null);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`Could not check conflicting queue ${column}: ${error.message}`);
    if (data) return data as Record<string, unknown>;
  }
  return null;
}

export async function addArticleQueueItem(
  supabase: SupabaseClient,
  options: AddArticleQueueOptions,
  inventory: ProductionInventoryItem[],
  now = new Date().toISOString()
): Promise<AddArticleQueueResult> {
  const row = buildQueueRow(options, now);
  const existing = await findExistingQueueRow(supabase, row.topic_key, row.article_title, row.idempotency_key);
  const production = findProductionArticleDuplicate(row.article_title, inventory);
  const duplicate: Duplicate | null = existing ? queueDuplicate(existing)
    : production ? { kind: "production", key: production.key, title: production.title } : null;
  // A plan always exits successfully, including when the planned insert is a duplicate.
  if (!options.apply) return { kind: "dry_run", exitCode: 0, row, duplicate };
  if (duplicate) return { kind: "duplicate", exitCode: 3, duplicate };

  const { data, error } = await supabase
    .from("article_generation_queue")
    .insert(row)
    .select("id, status, article_title, topic_key")
    .single();
  if (!error && data) return { kind: "inserted", exitCode: 0, row: data };
  if (error?.code === "23505") {
    const raced = await findConflictingQueueRow(supabase, row.topic_key, row.idempotency_key);
    if (raced) return { kind: "duplicate", exitCode: 3, duplicate: queueDuplicate(raced) };
  }
  throw new Error(`Could not add article queue item: ${error?.message ?? "missing inserted row"}`);
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.length === 1 && ["--help", "-h"].includes(argv[0])) {
    console.log("Usage: npm run articles:queue:add -- --title TEXT --type guide|tier_list|explainer --source-url URL [--source-url URL] --reason TEXT [--universe-id N] [--claim] [--worker NAME] [--dev-env-file PATH] [--json] [--apply]");
    console.log("Plans by default. --apply inserts into managed development only; it does not authorize publication.");
    console.log("Credentials: ARTICLE_DEV_SUPABASE_URL and ARTICLE_DEV_SUPABASE_SERVICE_ROLE, or --dev-env-file (same resolution as articles:queue:update).");
    return 0;
  }
  const options = parseArgs(argv);
  const dev = resolveArticleDevCredentials({ envFile: options.devEnvFile });
  const supabase = createClient(dev.url, dev.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  // Fail closed if production inventory cannot be read, even for a dry run.
  const inventory = await fetchProductionEditorialInventory();
  const result = await addArticleQueueItem(supabase, options, inventory.items);
  if (result.kind === "inserted") {
    console.log(options.json ? JSON.stringify(result.row) : result.row.id);
  } else if (result.kind === "dry_run") {
    console.log(JSON.stringify({ dry_run: true, row: result.row, duplicate: result.duplicate }, null, 2));
  } else if (options.json) {
    console.log(JSON.stringify({ duplicate: result.duplicate }));
  } else if (result.duplicate.kind === "queue") {
    const workflow = result.duplicate.workflow_mode === undefined ? "" : ` | ${result.duplicate.workflow_mode}`;
    console.log(`Duplicate queue item: ${result.duplicate.id} | ${result.duplicate.article_title} | ${result.duplicate.status}${workflow}`);
  } else {
    console.log(`Duplicate production article: ${result.duplicate.key} | ${result.duplicate.title}`);
  }
  return result.exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
