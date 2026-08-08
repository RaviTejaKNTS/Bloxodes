import "../shared/load-env";

import { createClient } from "@supabase/supabase-js";

import { resolveArticleDevCredentials } from "./article-queue-env";

type QueueStatus = "pending" | "processing" | "completed" | "skipped" | "failed";

type Options = {
  limit: number;
  status: QueueStatus;
  json: boolean;
};

function printUsage() {
  console.log(
    "Usage: npm run articles:queue:list -- [--limit N] [--status pending|processing|completed|skipped|failed] [--json]"
  );
}

function parseArgs(argv: string[]): Options {
  const options: Options = { limit: 4, status: "pending", json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--limit") {
      const value = Number(argv[++index]);
      if (!Number.isInteger(value) || value < 1 || value > 50) throw new Error("--limit must be an integer from 1 to 50.");
      options.limit = value;
    } else if (arg.startsWith("--limit=")) {
      const value = Number(arg.split("=")[1]);
      if (!Number.isInteger(value) || value < 1 || value > 50) throw new Error("--limit must be an integer from 1 to 50.");
      options.limit = value;
    } else if (arg === "--status") {
      options.status = parseStatus(argv[++index]);
    } else if (arg.startsWith("--status=")) {
      options.status = parseStatus(arg.split("=")[1]);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function parseStatus(value: string | undefined): QueueStatus {
  const statuses: QueueStatus[] = ["pending", "processing", "completed", "skipped", "failed"];
  if (!value || !statuses.includes(value as QueueStatus)) throw new Error(`Unsupported queue status: ${value ?? "(missing)"}`);
  return value as QueueStatus;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const queue = resolveArticleDevCredentials();

  const supabase = createClient(queue.url, queue.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await supabase
    .from("article_generation_queue")
    .select(
      "id, article_title, article_type, status, source_name, source_url, source_published_at, source_discovered_at, source_urls, source_items, topic_key, curation_model, curation_reason, curation_confidence, curated_at, source_metadata, attempts, created_at"
    )
    .eq("workflow_mode", "agent_runner")
    .not("curated_at", "is", null)
    .eq("status", options.status)
    .order("source_published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(options.limit);
  if (error) throw new Error(`Could not load article runner queue: ${error.message}`);

  if (options.json) {
    console.log(JSON.stringify(data ?? [], null, 2));
    return;
  }
  console.table(
    (data ?? []).map((row) => ({
      id: row.id,
      published: row.source_published_at,
      source: row.source_name,
      type: row.article_type,
      title: row.article_title,
      url: row.source_url
    }))
  );
  console.log(`${data?.length ?? 0} ${options.status} agent-runner queue item(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
