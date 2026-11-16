import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { NotionArticleQueue, ARTICLE_QUEUE_SOURCE, articleQueueProperties, articleQueueBody, articleQueueBodyData, articleQueueFromPage, duplicateQueueRow, notionRichText, type ArticleQueueRow } from "../notion-article-queue";
import { migrateArticleQueue } from "../migrate-article-queue-to-notion";

const row = (extra: Record<string, any> = {}) => ({ article_title: "Fisch Kraken Boss Guide", article_type: "guide", status: "pending", topic_key: "fisch-kraken-boss",
  source_urls: ["https://example.com/guide"], source_items: [{ evidence: "evidence ".repeat(500) }], source_metadata: { count: 1 }, workflow_mode: "agent_runner", ...extra });
function page(payload: Record<string, any>, id = randomUUID(), created = "2026-11-01T00:00:00Z") {
  return { id, created_time: created, last_edited_time: created, parent: { data_source_id: ARTICLE_QUEUE_SOURCE }, properties: articleQueueProperties(payload), blocks: articleQueueBody(payload) };
}
function fixture() {
  const pages = new Map<string, any>();
  const mutations: string[] = [];
  let beforeCreate: (() => void) | undefined;
  let uncertain = false;
  const api = {
    async call(route: string, method = "GET", body?: any): Promise<any> {
      if (route.startsWith("data_sources/") && route.endsWith("/query")) {
        let found = [...pages.values()];
        if (body.filter?.property === "Dev queue ID") found = found.filter(p => articleQueueFromPage(p).dev_queue_id === body.filter.rich_text.equals);
        return { results: found, has_more: false };
      }
      const id = route.split("/")[1];
      if (route.startsWith("pages/")) {
        const p = pages.get(id);
        if (!p) throw new Error("Page not found");
        if (method === "PATCH") { mutations.push(route); Object.assign(p.properties, body.properties); }
        return p;
      }
      if (route.startsWith("blocks/") && route.includes("/children")) {
        const p = pages.get(id);
        if (method === "PATCH") { mutations.push(route); p.blocks.push(...body.children.map((block: any) => ({ id: randomUUID(), ...block }))); }
        return { results: p.blocks.filter((block: any) => !block.archived), has_more: false };
      }
      if (route.startsWith("blocks/") && method === "PATCH") {
        mutations.push(route);
        for (const p of pages.values()) for (const block of p.blocks) if (block.id === id) block.archived = body.archived;
        return {};
      }
      throw new Error(`Unexpected ${method} ${route}`);
    },
    async callCreate(body: any) {
      beforeCreate?.();
      mutations.push("create");
      const p = { ...page({}), properties: body.properties, blocks: body.children.map((block: any) => ({ id: randomUUID(), ...block })) };
      pages.set(p.id, p);
      if (uncertain) throw new Error("Create response uncertain");
      return p;
    }
  };
  return { queue: new NotionArticleQueue(api), pages, mutations, race: (fn: () => void) => { beforeCreate = fn; }, uncertain: () => { uncertain = true; } };
}

test("Notion properties split long text without losing Unicode or URLs", () => {
  const text = "🙂".repeat(2200) + "tail";
  const chunks = notionRichText(text);
  assert.ok(chunks.every(part => part.text.content.length <= 2000));
  assert.equal(chunks.map(part => part.text.content).join(""), text);
  const input = row({ curation_reason: text, locked_at: "2026-11-01T00:00:00Z" });
  const mapped = articleQueueFromPage(page(input), articleQueueBodyData(articleQueueBody(input)));
  assert.equal(mapped.curation_reason, text);
  assert.deepEqual(mapped.source_urls, input.source_urls);
  assert.deepEqual(mapped.source_items, input.source_items);
  assert.equal(mapped.locked_at, "2026-11-01T00:00:00.000Z");
});

test("body snapshots retain full evidence and ignore an interrupted newer snapshot", () => {
  const original = row({ source_metadata: { evidence: "\\\"🙂".repeat(9000) }, event_id: "event-1", rejected_at: "2026-01-01" });
  const blocks = articleQueueBody(original, "original");
  assert.ok(blocks.length > 1);
  const partial = articleQueueBody(row({ source_metadata: { evidence: "x".repeat(20000) } }), "incomplete").slice(0, 1);
  assert.deepEqual(articleQueueBodyData([...blocks, ...partial]), original);
  assert.throws(() => articleQueueBody(row({ source_items: ["x".repeat(210000)] })), /200 KB/);
});

test("queue title dedupe keeps the 0.8 boundary and includes blocked and rejected topics", () => {
  for (const status of ["pending", "processing", "blocked", "completed", "published", "rejected"]) {
    const existing = { ...row({ status, article_title: "Alpha Bravo Charlie Delta", topic_key: "another" }), id: "id" } as ArticleQueueRow;
    assert.equal(duplicateQueueRow([existing], row({ article_title: "Alpha Bravo Charlie Delta Echo", topic_key: "new" }))?.id, "id");
    assert.equal(duplicateQueueRow([existing], row({ article_title: "Alpha Bravo Charlie Delta Echo Foxtrot", topic_key: "new" })), null);
  }
});

test("page queries paginate through every queue row", async () => {
  let calls = 0;
  const first = page(row({ article_title: "First topic" }));
  const second = page(row({ article_title: "Second topic" }));
  const queue = new NotionArticleQueue({ callCreate: async () => { throw new Error("Unexpected create"); }, call: async (_route, _method, body: any) => {
    calls++;
    assert.equal(body.start_cursor, calls === 1 ? undefined : "next");
    assert.deepEqual(body.sorts, [{ timestamp: "created_time", direction: "ascending" }]);
    return { results: calls === 1 ? [first] : [first, second], has_more: calls === 1, next_cursor: calls === 1 ? "next" : null };
  } });
  assert.equal((await queue.list()).length, 2);
  assert.equal(calls, 2);
});

test("concurrent creates keep the earliest page and mark the later page Skipped duplicate", async () => {
  const f = fixture();
  f.race(() => {
    const earlier = page(row(), randomUUID(), "2026-10-01T00:00:00Z");
    f.pages.set(earlier.id, earlier);
  });
  const result = await f.queue.put(row());
  assert.equal(result.created, false);
  assert.equal(result.row.notion_created_at, "2026-10-01T00:00:00Z");
  const skipped = (await f.queue.list()).filter(item => item.status === "skipped");
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].outcome_reason, "duplicate");
  assert.equal(f.mutations.filter(item => item === "create").length, 1);
});

test("uncertain creates are not retried; the next run finds the accepted page", async () => {
  const f = fixture(); f.uncertain();
  await assert.rejects(f.queue.put(row()), /uncertain/);
  assert.equal(f.mutations.filter(item => item === "create").length, 1);
  const retry = await f.queue.put(row());
  assert.equal(retry.created, false);
  assert.deepEqual(retry.row.source_items, row().source_items);
  assert.equal(f.mutations.filter(item => item === "create").length, 1);
});

test("queue updates reject changed completion state before writing", async () => {
  const f = fixture();
  const saved = await f.queue.create(row({ status: "blocked", result_slug: "guide", result_path: "tmp/final.json" }));
  const before = f.mutations.length;
  await assert.rejects(f.queue.update(saved.id, { status: "published" }, { status: "completed", result_path: "tmp/final.json" }), /changed before update/);
  assert.equal(f.mutations.length, before);
  await f.queue.update(saved.id, { source_items: [{ evidence: "new" }] });
  assert.deepEqual((await f.queue.get(saved.id)).source_items, [{ evidence: "new" }]);
});

test("migration plans all open rows and repeat applies skip Dev queue IDs", async () => {
  const f = fixture();
  const rows = ["pending", "processing", "blocked", "completed", "published", "skipped"].map(status => row({ id: randomUUID(), status }));
  const dry = await migrateArticleQueue(rows, f.queue, false);
  assert.equal(dry.open, 4); assert.equal(dry.would_copy, 4); assert.equal(dry.copied, 0);
  assert.deepEqual(f.mutations, []);
  const applied = await migrateArticleQueue(rows, f.queue, true);
  assert.equal(applied.copied, 4);
  const again = await migrateArticleQueue(rows, f.queue, true);
  assert.equal(again.already_copied, 4); assert.equal(again.copied, 0);
  const copies = await f.queue.list();
  assert.ok(copies.every(copy => /^[0-9a-f-]{36}$/.test(copy.id) && rows.some(original => original.id === copy.dev_queue_id)));
  const hydrated = await f.queue.get(copies[0].id);
  assert.deepEqual(hydrated.source_items, row().source_items);
});

test("scheduled curation recovers expired claims and due blocked rows without reopening completions", async () => {
  const f = fixture();
  const now = Date.parse("2026-11-16T12:00:00Z");
  for (const extra of [
    { status: "processing", locked_at: "2026-11-16T00:00:00Z" },
    { status: "processing", locked_at: "2026-11-16T11:00:00Z" },
    { status: "blocked", next_attempt_at: "2026-11-16T11:00:00Z" },
    { status: "blocked", next_attempt_at: "2026-11-16T15:00:00Z" },
    { status: "completed", completed_at: "2026-11-15T00:00:00Z" }
  ]) await f.queue.create(row(extra));
  assert.equal(await f.queue.recoverClaims(await f.queue.list(), now), 2);
  const rows = await f.queue.list();
  assert.equal(rows.filter(item => item.status === "pending").length, 2);
  assert.equal(rows.filter(item => item.status === "completed").length, 1);
});

test("published history is copied only with the explicit migration option", async () => {
  const f = fixture();
  const published = row({ id: randomUUID(), status: "published", result_slug: "fisch-guide", result_path: "tmp/final.json", production_url: "https://bloxodes.com/articles/fisch-guide", published_at: "2026-11-15T00:00:00Z" });
  assert.equal((await migrateArticleQueue([published], f.queue, false)).would_copy, 0);
  assert.equal((await migrateArticleQueue([published], f.queue, false, true)).would_copy, 1);
  const copied = await migrateArticleQueue([published], f.queue, true, true);
  assert.ok(copied.id_map[published.id]);
  const saved = await f.queue.get(copied.id_map[published.id]);
  assert.equal(saved.status, "published");
  assert.equal(saved.production_url, published.production_url);
  assert.equal(saved.result_path, published.result_path);
});

test("a later scheduled run reconciles duplicate pages left by an interrupted create", async () => {
  const f = fixture();
  const first = page(row(), randomUUID(), "2026-10-01T00:00:00Z");
  const second = page(row(), randomUUID(), "2026-10-02T00:00:00Z");
  f.pages.set(second.id, second); f.pages.set(first.id, first);
  const rows = await f.queue.list();
  assert.equal(await f.queue.reconcileDuplicates(rows), 1);
  assert.equal((await f.queue.get(first.id)).status, "pending");
  assert.equal((await f.queue.get(second.id)).status, "skipped");
  assert.equal(await f.queue.reconcileDuplicates(await f.queue.list()), 0);
});
