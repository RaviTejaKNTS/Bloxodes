import "./load-notion-article-env";

import { withArticleQueueClaimLock, newArticleClaimToken, confirmArticleQueueClaim } from "./article-queue-claim";
import { inferArticleScope, similarArticleTopics, type TopicCandidate } from "./article-topic-similarity";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createNotionArticleQueue, duplicateQueueRow, type NotionArticleQueue } from "./notion-article-queue";

import { slugify } from "@/lib/slug";
import {
  articleQueueIdempotencyKey,
  findProductionArticleDuplicate
} from "./article-queue-dedupe";
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
    locked_by: options.claim ? newArticleClaimToken(options.worker) : null,
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
  | { kind: "inserted"; exitCode: 0; row: { id: string; status: string; article_title: string; topic_key: string; claim_token?: string } };

function queueDuplicate(row: Record<string, unknown>): Duplicate {
  return {
    kind: "queue", id: row.id, article_title: row.article_title, status: row.status,
    ...(row.workflow_mode === undefined ? {} : { workflow_mode: row.workflow_mode })
  };
}

export async function addArticleQueueItem(
  queue: NotionArticleQueue,
  options: AddArticleQueueOptions,
  inventory: ProductionInventoryItem[],
  now = new Date().toISOString()
): Promise<AddArticleQueueResult & { near_matches?: TopicCandidate[] }> {
  const work = async (): Promise<AddArticleQueueResult & { near_matches?: TopicCandidate[] }> => {
    const row = buildQueueRow(options, now);
    const rows = await queue.list();
    const scope = options.universeId ? {universeId:options.universeId} : inferArticleScope(options.title,inventory);
    const matches = scope ? similarArticleTopics(options.title,scope,inventory,rows) : [];
    const existing = duplicateQueueRow(rows, row);
    const intentDuplicate = matches.find(match=>match.duplicate);
    const production = findProductionArticleDuplicate(row.article_title, inventory, scope);
    const duplicate: Duplicate | null = existing ? queueDuplicate(existing)
      : production ? { kind: "production", key: production.key, title: production.title } : intentDuplicate ? {kind:"production",key:intentDuplicate.url,title:intentDuplicate.title} : null;
    // A plan always exits successfully, including when the planned insert is a duplicate.
    if (!options.apply) return { kind: "dry_run", exitCode: 0, row, duplicate, near_matches:matches.slice(0,10) };
    if (duplicate) return { kind: "duplicate", exitCode: 3, duplicate, near_matches:matches.slice(0,10) };

    const result = await queue.put(row);
    if (!result.created) return { kind: "duplicate", exitCode: 3, duplicate: queueDuplicate(result.row) };
    if(options.claim) await confirmArticleQueueClaim(queue,result.row.id,row.locked_by!,row.locked_at!);
    return { kind: "inserted", exitCode: 0, row: { id: result.row.id, status: result.row.status, article_title: result.row.article_title, topic_key: result.row.topic_key ?? row.topic_key, ...(options.claim ? {claim_token:row.locked_by!} : {}) }, near_matches:matches.slice(0,10) };
  };
  return options.apply && options.claim ? withArticleQueueClaimLock(work) : work();
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.length === 1 && ["--help", "-h"].includes(argv[0])) {
    console.log("Usage: npm run articles:queue:add -- --title TEXT --type guide|tier_list|explainer --source-url URL [--source-url URL] --reason TEXT [--universe-id N] [--claim] [--worker NAME] [--dev-env-file PATH] [--json] [--apply]");
    console.log("Plans by default. --apply adds a Notion Article Queue page; it does not authorize publication.");
    console.log("Credentials: NOTION_ARTICLE_QUEUE_TOKEN. --dev-env-file remains an optional token env file.");
    return 0;
  }
  const options = parseArgs(argv);
  const queue = createNotionArticleQueue({ envFile: options.devEnvFile });
  await queue.validate();
  // Fail closed if production inventory cannot be read, even for a dry run.
  const inventory = await fetchProductionEditorialInventory();
  const result = await addArticleQueueItem(queue, options, inventory.items);
  if (result.kind === "inserted") {
    console.log(options.json ? JSON.stringify({...result.row,near_matches:result.near_matches??[]}) : options.claim ? JSON.stringify(result.row) : result.row.id);
  } else if (result.kind === "dry_run") {
    console.log(JSON.stringify({ dry_run: true, row: result.row, duplicate: result.duplicate, near_matches:result.near_matches }, null, 2));
  } else if (options.json) {
    console.log(JSON.stringify({ duplicate: result.duplicate,near_matches:result.near_matches }));
  } else if (result.duplicate.kind === "queue") {
    const workflow = result.duplicate.workflow_mode === undefined ? "" : ` | ${result.duplicate.workflow_mode}`;
    console.log(`Duplicate queue item: ${result.duplicate.id} | ${result.duplicate.article_title} | ${result.duplicate.status}${workflow}`);
  } else {
    console.log(`Duplicate production article: ${result.duplicate.key} | ${result.duplicate.title}`);
  }
  if(!options.json && result.near_matches?.length)console.log(JSON.stringify({near_matches:result.near_matches},null,2));
  return result.exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
