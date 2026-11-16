import "./load-notion-article-env";

import { createNotionArticleQueue } from "./notion-article-queue";
import { parseArticleQueueStatus, type ArticleQueueStatus } from "./article-queue-status";

type Options = {
  limit: number;
  status: ArticleQueueStatus;
  json: boolean;
};

function printUsage() {
  console.log(
    "Usage: npm run articles:queue:list -- [--limit N] [--status pending|processing|completed|published|rejected|skipped|failed] [--json]"
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

const parseStatus = parseArticleQueueStatus;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const queue = createNotionArticleQueue();
  await queue.validate();
  const rows = (await queue.list({ property: "Status", select: { equals: options.status[0].toUpperCase() + options.status.slice(1) } }))
    .filter(row => row.workflow_mode === "agent_runner" && row.curated_at)
    .sort((a, b) => String(b.source_published_at ?? "").localeCompare(String(a.source_published_at ?? "")) || a.created_at.localeCompare(b.created_at))
    .slice(0, options.limit);
  const data = [];
  for (const row of rows) data.push(await queue.get(row.id));

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
      slug: row.result_slug,
      url: row.status === "published" ? row.production_url : row.source_url
    }))
  );
  console.log(`${data?.length ?? 0} ${options.status} agent-runner queue item(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
