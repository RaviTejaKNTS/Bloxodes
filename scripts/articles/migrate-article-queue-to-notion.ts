import "./load-notion-article-env";
import { createClient } from "@supabase/supabase-js";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolveArticleDevCredentials } from "./article-queue-env";
import { createNotionArticleQueue, queueRowOrder, articleQueueBody, articleQueueProperties, type NotionArticleQueue } from "./notion-article-queue";

export function openArticleQueueRow(row: Record<string, any>) {
  return ["pending", "processing", "blocked"].includes(row.status) || row.status === "completed" && !row.published_at && !row.production_url;
}

export async function migrateArticleQueue(rows: Record<string, any>[], queue: NotionArticleQueue, apply: boolean, includePublished = false) {
  const existing = await queue.list();
  const selected = rows.filter(row => openArticleQueueRow(row) || includePublished && row.status === "published");
  const counts = { open: rows.filter(openArticleQueueRow).length, selected: selected.length, already_copied: 0, would_copy: 0, copied: 0, id_map: {} as Record<string, string>, by_status: {} as Record<string, number> };
  for (const row of selected) {
    counts.by_status[row.status] = (counts.by_status[row.status] ?? 0) + 1;
    const copied = existing.filter(page => page.dev_queue_id === row.id).sort(queueRowOrder)[0];
    if (copied) { counts.already_copied++; counts.id_map[row.id] = copied.id; continue; }
    articleQueueProperties(row);
    articleQueueBody({ ...row, dev_queue_id: row.id });
    counts.would_copy++;
    if (!apply) continue;
    // Preserve every source field, including workflow, dates, paths and evidence.
    // Dev queue ID is independent of editorial dedupe so no open row is lost.
    const created = await queue.create({ ...row, dev_queue_id: row.id, id: undefined });
    const copies = (await queue.list({ property: "Dev queue ID", rich_text: { equals: row.id } })).sort(queueRowOrder);
    const winner = copies[0] ?? created;
    for (const later of copies.filter(page => page.id !== winner.id)) {
      await queue.update(later.id, { status: "skipped", outcome_reason: "duplicate" });
    }
    counts.id_map[row.id] = winner.id;
    existing.push(winner);
    counts.copied++;
  }
  return counts;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) { console.log("articles:queue:migrate-to-notion [--dev-env-file PATH] [--include-published] [--apply]. Reads open dev rows, optionally published history for bundle updates; never modifies dev. Dry run by default."); return; }
  let envFile: string | undefined;
  let apply = false;
  let includePublished = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--apply") apply = true;
    else if (args[index] === "--include-published") includePublished = true;
    else if (args[index] === "--dev-env-file" && args[index + 1]) envFile = args[++index];
    else throw new Error(`Unknown or incomplete option: ${args[index]}`);
  }
  const dev = resolveArticleDevCredentials({ envFile: envFile || ".envs/targets/managed-dev.env" });
  const db = createClient(dev.url, dev.serviceRole, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(30_000) }) } });
  const queue = createNotionArticleQueue();
  await queue.validate();
  const rows: Record<string, any>[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await db.from("article_generation_queue").select("*").in("status", ["pending", "processing", "blocked", "completed", ...(includePublished ? ["published"] : [])]).order("created_at").order("id").range(offset, offset + 499);
    if (result.error) throw new Error(`Dev migration read failed: ${result.error.message}`);
    rows.push(...result.data);
    if (result.data.length < 500) break;
  }
  console.log(JSON.stringify({ dry_run: !apply, ...await migrateArticleQueue(rows, queue, apply, includePublished) }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
