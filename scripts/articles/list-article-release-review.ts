import "../shared/load-env";

import { createClient } from "@supabase/supabase-js";

import { resolveArticleDevCredentials } from "./article-queue-env";

type Options = {
  baseUrl: string;
  json: boolean;
  limit: number;
  devEnvFile: string | null;
};

function printUsage() {
  console.log(
    "Usage: npm run articles:review:list -- [--base-url http://127.0.0.1:3000] [--limit 50] [--json] [--dev-env-file PATH]"
  );
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    baseUrl: "http://127.0.0.1:3000",
    json: false,
    limit: 50,
    devEnvFile: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--base-url") {
      options.baseUrl = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === "--limit") {
      options.limit = Number(requireValue(argv, index, arg));
      index += 1;
    } else if (arg === "--dev-env-file") {
      options.devEnvFile = requireValue(argv, index, arg);
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100) {
    throw new Error("--limit must be an integer from 1 to 100.");
  }
  const baseUrl = new URL(options.baseUrl);
  if (!["localhost", "127.0.0.1", "::1"].includes(baseUrl.hostname)) {
    throw new Error("--base-url must point to localhost.");
  }
  options.baseUrl = baseUrl.origin;
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const queue = resolveArticleDevCredentials({ envFile: options.devEnvFile });
  const supabase = createClient(queue.url, queue.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await supabase
    .from("article_generation_queue")
    .select(
      "id, article_title, article_type, completed_at, result_path, result_slug, source_name, source_url, source_urls, source_items, curation_reason"
    )
    .eq("workflow_mode", "agent_runner")
    .eq("status", "completed")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(options.limit);
  if (error) throw new Error(`Could not load completed article reviews: ${error.message}`);

  const reviews = (data ?? []).map((row) => ({
    queue_id: row.id,
    title: row.article_title,
    article_type: row.article_type,
    slug: row.result_slug,
    result_path: row.result_path,
    completed_at: row.completed_at,
    localhost_url: row.result_slug ? `${options.baseUrl}/articles/${row.result_slug}` : null,
    source_name: row.source_name,
    source_url: row.source_url,
    source_urls: row.source_urls,
    source_items: row.source_items,
    curation_reason: row.curation_reason
  }));

  if (options.json) {
    console.log(JSON.stringify(reviews, null, 2));
    return;
  }
  console.table(
    reviews.map((row) => ({
      queue_id: row.queue_id,
      title: row.title,
      slug: row.slug,
      completed: row.completed_at,
      localhost: row.localhost_url
    }))
  );
  console.log(`${reviews.length} completed article(s) awaiting publication review.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
