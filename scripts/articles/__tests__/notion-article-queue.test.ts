import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { NotionArticleQueue, ARTICLE_QUEUE_SOURCE, articleQueueNewestGeneration, ARTICLE_QUEUE_DATABASE, articleQueueProperties, articleQueueBody, articleQueueBodyData, articleQueueFromPage, duplicateQueueRow, notionRichText, type ArticleQueueRow } from "../notion-article-queue";
import { CodesQueue } from "../../codes/discovery-io";
import { migrateArticleQueue } from "../migrate-article-queue-to-notion";

const row = (extra: Record<string, any> = {}) => ({ article_title: "Fisch Kraken Boss Guide", article_type: "guide", status: "pending", topic_key: "fisch-kraken-boss",
  source_urls: ["https://example.com/guide"], source_items: [{ evidence: "evidence ".repeat(500) }], source_metadata: { count: 1 }, workflow_mode: "agent_runner", ...extra });
function page(payload: Record<string, any>, id = randomUUID(), created = "2026-11-01T00:00:00Z") {
  return { id, created_time: created, last_edited_time: created, in_trash: false, parent: { type: "data_source_id", data_source_id: ARTICLE_QUEUE_SOURCE }, properties: articleQueueProperties(payload), blocks: articleQueueBody(payload).map(block => ({ id: randomUUID(), in_trash: false, ...block })) };
}
function fixture() {
  const pages = new Map<string, any>();
  const mutations: string[] = [];
  const requests: Array<{ route: string; method: string; body: any }> = [];
  let beforeCreate: (() => void) | undefined;
  let uncertain = false;
  function validatePayload(body: any) {
    // These fields were removed in Notion-Version 2026-03-11.
    if (body && ("archived" in body || "after" in body)) throw new Error("Notion 2026-03-11 rejects archived/after");
    for (const property of Object.values(body?.properties ?? {}) as any[]) {
      assert.equal(Object.keys(property).length, 1);
      for (const text of property.rich_text ?? property.title ?? []) {
        assert.equal(text.type, "text"); assert.ok(text.text.content.length <= 2000);
      }
    }
    for (const block of body?.children ?? []) {
      assert.equal(block.type, "code"); assert.equal(block.code.language, "json");
      assert.ok(block.code.caption.length <= 100); assert.ok(block.code.rich_text.length <= 100);
      for (const part of [...block.code.caption, ...block.code.rich_text]) assert.ok(part.text.content.length <= 2000);
    }
    assert.ok((body?.children?.length ?? 0) <= 100);
  }
  const api = {
    async call(route: string, method = "GET", body?: any): Promise<any> {
      validatePayload(body);
      requests.push({ route, method, body });
      if (route.startsWith("data_sources/") && route.endsWith("/query")) {
        assert.equal(route, `data_sources/${ARTICLE_QUEUE_SOURCE}/query`); assert.equal(method, "POST");
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
        return { results: p.blocks.filter((block: any) => !block.in_trash), has_more: false };
      }
      if (route.startsWith("blocks/") && method === "PATCH") {
        mutations.push(route);
        assert.equal(body.in_trash, true);
        for (const p of pages.values()) for (const block of p.blocks) if (block.id === id) block.in_trash = body.in_trash;
        return {};
      }
      throw new Error(`Unexpected ${method} ${route}`);
    },
    async callCreate(body: any) {
      validatePayload(body);
      assert.deepEqual(body.parent, { type: "data_source_id", data_source_id: ARTICLE_QUEUE_SOURCE });
      beforeCreate?.();
      mutations.push("create");
      const p = { ...page({}), properties: body.properties, blocks: body.children.map((block: any) => ({ id: randomUUID(), ...block })) };
      pages.set(p.id, p);
      if (uncertain) throw new Error("Create response uncertain");
      return p;
    }
  };
  return { queue: new NotionArticleQueue(api), api, pages, mutations, requests,
    race: (fn: () => void) => { beforeCreate = fn; }, uncertain: () => { uncertain = true; } };
}

test("the Notion transport pins 2026-03-11 and uses data-source page parents", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const request = async (url: string, init: RequestInit = {}) => { calls.push({ url, init }); return JSON.stringify({ results: [], has_more: false }); };
  const transport = new CodesQueue(request, "test-token", ARTICLE_QUEUE_SOURCE, ARTICLE_QUEUE_DATABASE, (async (input, init) => {
    calls.push({ url: String(input), init: init! }); return new Response(JSON.stringify({ id: randomUUID() }));
  }) as typeof fetch);
  await transport.call(`data_sources/${ARTICLE_QUEUE_SOURCE}/query`, "POST", { page_size: 100 });
  await transport.callCreate({ parent: { type: "data_source_id", data_source_id: ARTICLE_QUEUE_SOURCE }, properties: articleQueueProperties(row()), children: articleQueueBody(row()) });
  assert.deepEqual(calls.map(call => call.url), [`https://api.notion.com/v1/data_sources/${ARTICLE_QUEUE_SOURCE}/query`, "https://api.notion.com/v1/pages"]);
  assert.ok(calls.every(call => new Headers(call.init.headers).get("Notion-Version") === "2026-03-11"));
});

test("claim/completion snapshot cleanup uses in_trash and keeps the queue page", async () => {
  const f = fixture();
  const saved = await f.queue.create(row());
  await assert.rejects(f.api.call(`blocks/${randomUUID()}`, "PATCH", { archived: true }), /2026-03-11 rejects/);
  await f.queue.update(saved.id, { status: "processing", last_attempted_at: "2026-11-16", last_error: null }, { status: "pending" });
  await f.queue.update(saved.id, { status: "completed", result_slug: "guide", result_path: "tmp/final.json", rejected_at: null }, { status: "processing" });
  const p = f.pages.get(saved.id);
  assert.equal(p.in_trash, false);
  assert.equal((await f.queue.get(saved.id)).status, "completed");
  assert.equal(p.blocks.filter((block: any) => !block.in_trash).length, 1);
  assert.equal(p.blocks.filter((block: any) => block.in_trash).length, 2);
  assert.ok(f.requests.filter(request => request.route.startsWith("blocks/") && !request.route.includes("/children") && request.method === "PATCH").every(request => request.body.in_trash === true));
});

test("trashed 2026-03-11 pages are rejected without an archived field", async () => {
  const f = fixture(); const p = page(row()); p.in_trash = true; f.pages.set(p.id, p);
  await assert.rejects(f.queue.get(p.id), /not an active Article Queue row/);
});

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

test("a snapshot appended before a failed property write never shows", async () => {
  const f = fixture();
  const saved = await f.queue.create(row({ last_error: "first" }));
  const call = f.api.call.bind(f.api);
  f.api.call = async (route: string, method = "GET", body?: any) => {
    if (route === `pages/${saved.id}` && method === "PATCH") throw new Error("property write failed");
    return call(route, method, body);
  };
  await assert.rejects(f.queue.update(saved.id, { status: "blocked", last_error: "never committed", rejected_at: "2026-11-16" }, { status: "pending" }), /property write failed/);
  f.api.call = call;
  const after = await f.queue.get(saved.id);
  assert.equal(after.status, "pending");
  assert.equal(after.last_error, "first");
  assert.equal(after.rejected_at ?? null, null);
  await f.queue.update(saved.id, { status: "blocked", last_error: "committed" }, { status: "pending" });
  assert.equal((await f.queue.get(saved.id)).last_error, "committed");
  assert.equal(f.pages.get(saved.id).blocks.filter((block: any) => !block.in_trash).length, 1);
});

test("a legacy row without a Snapshot pointer never shows a failed update's snapshot", async () => {
  const f = fixture();
  const legacy = page(row({ last_error: "first" }));
  assert.equal(legacy.properties.Snapshot, undefined);
  f.pages.set(legacy.id, legacy);
  const original = articleQueueNewestGeneration(legacy.blocks);
  const call = f.api.call.bind(f.api);
  let patches = 0;
  f.api.call = async (route: string, method = "GET", body?: any) => {
    // Let the pointer write through, then fail the real property write.
    if (route === `pages/${legacy.id}` && method === "PATCH" && ++patches === 2) throw new Error("property write failed");
    return call(route, method, body);
  };
  await assert.rejects(f.queue.update(legacy.id, { status: "blocked", last_error: "never committed" }, { status: "pending" }), /property write failed/);
  f.api.call = call;
  const after = await f.queue.get(legacy.id);
  assert.equal(after.body_generation, original);
  assert.equal(after.status, "pending");
  assert.equal(after.last_error, "first");
});

test("a committed snapshot generation wins over a complete uncommitted one", () => {
  const committed = row({ event_id: "kept" });
  const blocks = [...articleQueueBody(committed, "a"), ...articleQueueBody(row({ event_id: "uncommitted" }), "b")];
  assert.equal(articleQueueBodyData(blocks, "a").event_id, "kept");
  assert.equal(articleQueueBodyData(blocks).event_id, "uncommitted");
  assert.throws(() => articleQueueBodyData(blocks, "missing"), /missing or incomplete/);
});

test("queue title dedupe requires equal subjects and includes blocked and rejected topics", () => {
  for (const status of ["pending", "processing", "blocked", "completed", "published", "rejected"]) {
    const existing = { ...row({ status, article_title: "Alpha Bravo Charlie Delta", topic_key: "another" }), id: "id" } as ArticleQueueRow;
    assert.equal(duplicateQueueRow([existing], row({ article_title: "Alpha Bravo Charlie Delta Guide", topic_key: "new" }))?.id, "id");
    assert.equal(duplicateQueueRow([existing], row({ article_title: "Alpha Bravo Charlie Delta Echo", topic_key: "new" })), null);
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

for (const status of ["completed", "published"]) test(`duplicate cleanup preserves a later ${status} row and active claims`, async () => {
  const f = fixture();
  const now = Date.parse("2026-11-16T12:00:00Z");
  const extras = [
    { status: "pending" }, { status: "blocked" },
    { status: "processing", locked_at: "2026-11-16T00:00:00Z" },
    { status: "processing", locked_at: "2026-11-16T11:00:00Z" },
    { status, result_path: "tmp/approved/final.json", result_slug: "guide" },
  ];
  for (const [index, extra] of extras.entries()) {
    const p = page(row(extra), randomUUID(), `2026-11-0${index + 1}T00:00:00Z`); f.pages.set(p.id, p);
  }
  const rows = await f.queue.list();
  assert.equal(await f.queue.reconcileDuplicates(rows, now), 3);
  const saved = await f.queue.list();
  assert.equal(saved.filter(item => item.status === status).length, 1);
  assert.equal(saved.filter(item => item.status === "processing").length, 1);
  assert.equal(saved.filter(item => item.status === "skipped").length, 3);
  assert.equal((await f.queue.put(row())).row.status, status);
});

test("conflicting finished duplicates leave the entire group unchanged and log IDs", async t => {
  const f = fixture();
  for (const extra of [{ status: "pending" }, { status: "completed", result_path: "tmp/a/final.json", result_slug: "guide" }, { status: "published", result_path: "tmp/b/final.json", result_slug: "guide" }]) {
    const p = page(row(extra)); f.pages.set(p.id, p);
  }
  const messages: string[] = [];
  t.mock.method(console, "error", (message: string) => messages.push(message));
  assert.equal(await f.queue.reconcileDuplicates(await f.queue.list()), 0);
  assert.deepEqual(f.mutations, []);
  assert.match(messages[0], /conflicting finished duplicates.*No rows.*inspect/i);
  for (const item of [...f.pages.values()].filter(p => p.properties.Status.select.name !== "Pending")) assert.ok(messages[0].includes(item.id));
});

test("duplicate cleanup keeps distinct topics linked only through subject containment", async () => {
  const f = fixture();
  for (const [index, title] of ["Alpha Bravo Charlie Delta", "Alpha Bravo Charlie Delta Echo", "Bravo Charlie Delta Echo"].entries()) {
    const p = page(row({ article_title: title, topic_key: `topic-${index}` }), randomUUID(), `2026-11-0${index + 1}T00:00:00Z`); f.pages.set(p.id, p);
  }
  assert.equal(await f.queue.reconcileDuplicates(await f.queue.list()), 0);
  assert.deepEqual((await f.queue.list()).map(item => item.status), ["pending", "pending", "pending"]);
});

test("reconciliation keeps Dual Katana and Cursed Dual Katana when their keys differ", async () => {
  const f = fixture();
  for (const title of ["How to Get Dual Katana in Blox Fruits", "How to Get Cursed Dual Katana in Blox Fruits"]) {
    const key = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const p = page(row({ article_title:title, game:"Blox Fruits", universe_id:1, topic_key:key, idempotency_key:`1:${key}` }));f.pages.set(p.id,p);
  }
  const rows=await f.queue.list();
  assert.equal(duplicateQueueRow([rows[0]],rows[1]),null);
  assert.equal(await f.queue.reconcileDuplicates(rows),0);
  assert.deepEqual((await f.queue.list()).map(item=>item.status),["pending","pending"]);
  assert.deepEqual(f.mutations,[]);
});

test("a duplicate completed after the scheduler snapshot is never skipped", async () => {
  const f = fixture();
  const first = page(row(), randomUUID(), "2026-11-01T00:00:00Z");
  const second = page(row(), randomUUID(), "2026-11-02T00:00:00Z");
  f.pages.set(first.id, first); f.pages.set(second.id, second);
  const snapshot = await f.queue.list();
  Object.assign(second.properties, articleQueueProperties({ status: "completed", result_path: "tmp/final.json", result_slug: "guide" }));
  await assert.rejects(f.queue.reconcileDuplicates(snapshot), /changed before update/);
  assert.deepEqual(f.mutations, []);
  assert.equal((await f.queue.get(second.id)).status, "completed");
});

test("finished duplicate rows with the same result are retained", async () => {
  const f = fixture();
  for (const status of ["pending", "completed", "published"]) { const p = page(row({ status, result_path: "tmp/final.json", result_slug: "guide" })); f.pages.set(p.id, p); }
  assert.equal(await f.queue.reconcileDuplicates(await f.queue.list()), 1);
  assert.deepEqual((await f.queue.list()).map(item => item.status).sort(), ["completed", "published", "skipped"]);
});

test("claim recovery rechecks a row completed on another machine before changing it", async () => {
  const f = fixture();
  const saved = await f.queue.create(row({ status: "processing", locked_at: "2026-11-16T00:00:00Z" }));
  const snapshot = await f.queue.list();
  Object.assign(f.pages.get(saved.id).properties, articleQueueProperties({ status: "completed" }));
  const before = f.mutations.length;
  assert.equal(await f.queue.recoverClaims(snapshot, Date.parse("2026-11-16T12:00:00Z")), 0);
  assert.equal(f.mutations.length, before);
});

test("migration duplicate reconciliation retains a newly completed copy", async () => {
  const f = fixture(); const devId = randomUUID();
  let olderId = "";
  f.race(() => { const p = page(row({ dev_queue_id: devId }), randomUUID(), "2026-10-01T00:00:00Z"); olderId = p.id; f.pages.set(p.id, p); });
  const result = await migrateArticleQueue([row({ id: devId, status: "completed", result_path: "tmp/final.json", result_slug: "guide" })], f.queue, true);
  assert.equal((await f.queue.get(result.id_map[devId])).status, "completed");
  assert.equal((await f.queue.get(olderId)).status, "skipped");
});
