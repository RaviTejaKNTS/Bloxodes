import assert from "node:assert/strict";
import test from "node:test";

import type { NotionArticleQueue } from "../notion-article-queue";
import type { SupabaseClient } from "@supabase/supabase-js";

import { addArticleQueueItem, buildQueueRow, parseArgs } from "../add-article-queue-item";
import { articleQueueIdempotencyKey, findExistingQueueRow, findProductionArticleDuplicate, nearDuplicateArticleTitle } from "../article-queue-dedupe";
import { ARTICLE_TOPIC_DEDUPE_STATUSES, assertArticleQueueTransition } from "../article-queue-status";

const args = [
  "--title", "Fisch Kraken Boss Guide", "--type", "guide",
  "--source-url", "https://bloxodes.com/wiki/fisch",
  "--reason", "Players need a strategy for the Kraken boss."
];
const now = "2026-10-23T00:00:00.000Z";
type Response = { data: unknown; error: { code?: string; message: string } | null };
const response = (data: unknown): Response => ({ data, error: null });

// Only terminal calls consume responses. No credentials or network are used.
function queueStub(responses: Response[]) {
  const calls: { method: string; args: unknown[] }[] = [];
  const remaining = [...responses];
  const next = () => {
    const value = remaining.shift();
    assert.ok(value, "unexpected database call");
    return value;
  };
  const query = {
    select(columns: string) { calls.push({ method: "select", args: [columns] }); return this; },
    eq(column: string, value: unknown) { calls.push({ method: "eq", args: [column, value] }); return this; },
    is(column: string, value: unknown) { calls.push({ method: "is", args: [column, value] }); return this; },
    in(column: string, values: unknown[]) { calls.push({ method: "in", args: [column, values] }); return this; },
    insert(row: unknown) { calls.push({ method: "insert", args: [row] }); return this; },
    async maybeSingle() { return next(); },
    async single() { return next(); },
    async limit(count: number) { calls.push({ method: "limit", args: [count] }); return next(); }
  };
  const client = {
    from(table: string) { assert.equal(table, "article_generation_queue"); return query; }
  } as unknown as SupabaseClient;
  return { client, calls, remaining };
}

test("parses required fields and safe dry-run defaults", () => {
  assert.deepEqual(parseArgs(args), {
    title: "Fisch Kraken Boss Guide", type: "guide",
    sourceUrls: ["https://bloxodes.com/wiki/fisch"],
    reason: "Players need a strategy for the Kraken boss.",
    universeId: null, claim: false, worker: "t3-content-factory",
    devEnvFile: null, json: false, apply: false
  });
});

test("accepts equals syntax, all article types, repeated URLs and claim options", () => {
  for (const type of ["guide", "tier_list", "explainer"]) {
    const options = parseArgs([
      "--title= Fisch Kraken Boss Guide ", `--type=${type}`, "--reason= Useful boss strategy ",
      "--source-url=https://bloxodes.com/wiki/fisch", "--source-url", "https://example.com/research",
      "--source-url=https://bloxodes.com/wiki/fisch", "--universe-id=5750914919",
      "--claim", "--worker", "factory-test", "--dev-env-file=tmp/article.env", "--json", "--apply"
    ]);
    assert.equal(options.type, type);
    assert.equal(options.title, "Fisch Kraken Boss Guide");
    assert.deepEqual(options.sourceUrls, ["https://bloxodes.com/wiki/fisch", "https://example.com/research"]);
    assert.equal(options.universeId, 5750914919);
    assert.equal(options.worker, "factory-test");
    assert.equal(options.devEnvFile, "tmp/article.env");
    assert.ok(options.claim && options.json && options.apply);
  }
});

test("rejects missing required arguments, missing values and unsupported options", () => {
  for (const flag of ["--title", "--type", "--source-url", "--reason"]) {
    const index = args.indexOf(flag);
    const missing = args.filter((_value, position) => position !== index && position !== index + 1);
    assert.throws(() => parseArgs(missing), /required/);
  }
  for (const flag of ["--title", "--type", "--source-url", "--reason", "--worker", "--dev-env-file", "--universe-id"]) {
    assert.throws(() => parseArgs([...args, flag]), /requires a value/);
    assert.throws(() => parseArgs([...args, `${flag}= `]), /requires a value/);
    assert.throws(() => parseArgs([...args, flag, "--apply"]), /requires a value/);
  }
  assert.throws(() => parseArgs([...args, "--type", "news"]), /guide, tier_list, or explainer/);
  assert.throws(() => parseArgs([...args, "--unknown"]), /Unknown option/);
  assert.throws(() => parseArgs([...args, "--title", "?!"]), /topic key/);
});

test("rejects non-HTTPS research URLs and unsafe universe IDs", () => {
  for (const url of ["http://example.com", "file:///tmp/research", "not a URL"]) {
    assert.throws(() => parseArgs([...args, "--source-url", url]), /HTTPS/);
  }
  for (const id of ["0", "-1", "1.5", "1e3", "nope", "9007199254740992"]) {
    assert.throws(() => parseArgs([...args, "--universe-id", id]), /positive safe integer/);
  }
});

test("builds a curated pending row with source provenance and schema-compatible keys", () => {
  const row = buildQueueRow(parseArgs([...args, "--source-url", "https://example.com/research"]), now);
  assert.equal(row.workflow_mode, "agent_runner");
  assert.equal(row.status, "pending");
  assert.equal(row.attempts, 0);
  assert.equal(row.article_title, "Fisch Kraken Boss Guide");
  assert.equal(row.article_type, "guide");
  assert.equal(row.topic_key, "fisch-kraken-boss-guide");
  assert.equal(row.idempotency_key, "global:fisch-kraken-boss-guide");
  assert.equal(row.curation_model, "content-factory-main-agent");
  assert.equal(row.curation_reason, args[7]);
  assert.equal(row.curated_at, now);
  assert.equal(row.source_name, "Bloxodes Content Factory");
  assert.equal(row.source_url, null);
  assert.deepEqual(row.source_urls, ["https://bloxodes.com/wiki/fisch", "https://example.com/research"]);
  assert.equal(row.sources, row.source_urls.join("\n"));
  assert.deepEqual(row.source_metadata, { origin: "content-factory", universe_id: null });
  assert.deepEqual(row.source_items.map(item => item.source_url), row.source_urls);
  assert.ok(row.source_items.every(item => item.source_name === row.source_name && item.source_title === null && item.source_published_at === now && item.source_discovered_at === now));
  for (const field of ["source_published_at", "source_discovered_at", "created_at", "updated_at"] as const) assert.equal(row[field], now);
  for (const field of ["universe_id", "last_attempted_at", "locked_at", "locked_by", "last_error", "outcome_reason", "next_attempt_at", "completed_at", "published_at", "rejected_at", "production_url"] as const) assert.equal(row[field], null);
  assert.equal("curation_run_id" in row, false);
});

test("claim matches processing update fields and supports completion", () => {
  const row = buildQueueRow(parseArgs([...args, "--claim", "--worker", "factory-test", "--universe-id", "5750914919"]), now);
  assert.equal(row.status, "processing");
  assert.equal(row.attempts, 1);
  assert.equal(row.last_attempted_at, now);
  assert.equal(row.locked_at, now);
  assert.equal(row.locked_by, "factory-test");
  assert.equal(row.universe_id, 5750914919);
  assert.equal(row.source_metadata.universe_id, row.universe_id);
  assert.equal(row.idempotency_key, "5750914919:fisch-kraken-boss-guide");
  assert.doesNotThrow(() => assertArticleQueueTransition(row.status, "completed"));
});

test("title dedupe includes the 0.8 boundary and uses curation token normalization", () => {
  assert.ok(nearDuplicateArticleTitle("Alpha Bravo Charlie Delta Echo", "Alpha Bravo Charlie Delta"));
  assert.equal(nearDuplicateArticleTitle("Alpha Bravo Charlie Delta Echo Foxtrot", "Alpha Bravo Charlie Delta"), false);
  assert.ok(nearDuplicateArticleTitle("Roblox Fisch Kraken Weapon Guide", "Kraken weapons in Fisch"));
  assert.equal(nearDuplicateArticleTitle("Fisch Kraken Boss Guide", "Fisch Rod Crafting Guide"), false);
  assert.equal(nearDuplicateArticleTitle("Guide", "How to"), false);
  assert.equal(articleQueueIdempotencyKey(" Fisch: Kraken Boss! "), "global:fisch-kraken-boss");
});

test("production dedupe only matches article items and returns their key", () => {
  const article = { family: "article", title: "Fisch Kraken Boss Guide", key: "fisch-kraken-boss", universe_id: null };
  assert.equal(findProductionArticleDuplicate(args[1], [{ ...article, family: "wiki" }]), null);
  assert.deepEqual(findProductionArticleDuplicate(args[1], [article]), article);
});

test("queue dedupe checks topic key first and returns the existing title and status", async () => {
  const row = { id: "existing", article_title: "Original title", status: "blocked" };
  const db = queueStub([response(row)]);
  assert.deepEqual(await findExistingQueueRow(db.client, "fisch-kraken", args[1]), row);
  assert.deepEqual(db.calls.filter(call => call.method === "eq"), [
    { method: "eq", args: ["workflow_mode", "agent_runner"] },
    { method: "eq", args: ["topic_key", "fisch-kraken"] }
  ]);
  assert.deepEqual(db.calls.find(call => call.method === "in")?.args, ["status", ARTICLE_TOPIC_DEDUPE_STATUSES]);
  assert.ok(String(db.calls[0].args[0]).includes("article_title"));
});

test("queue dedupe retains curation's global idempotency lookup and accepts a universe key", async () => {
  for (const key of [undefined, "5750914919:fisch-kraken-boss-guide"]) {
    const db = queueStub([response(null), response({ id: "existing", status: "published" })]);
    assert.ok(await findExistingQueueRow(db.client, "topic", args[1], key));
    assert.ok(db.calls.some(call => call.method === "eq" && call.args[0] === "idempotency_key" && call.args[1] === (key ?? "global:fisch-kraken-boss-guide")));
  }
});

test("queue similarity scan preserves the status scope and 1,000-row cap", async () => {
  const row = { id: "existing", article_title: "Fisch Kraken Boss", topic_key: "another-key", status: "rejected" };
  const db = queueStub([response(null), response(null), response([row])]);
  assert.deepEqual(await findExistingQueueRow(db.client, "topic", args[1]), row);
  assert.deepEqual(db.calls.filter(call => call.method === "in").map(call => call.args), Array(3).fill(["status", ARTICLE_TOPIC_DEDUPE_STATUSES]));
  assert.deepEqual(db.calls.find(call => call.method === "limit")?.args, [1000]);
});

function notionStub(rows: Record<string, any>[] = [], raced = false) {
  const calls: string[] = [];
  const queue = {
    async list() { calls.push("list"); return rows; },
    async put(row: Record<string, any>) { calls.push("put"); return { created: !raced, row: { id: raced ? "winner" : "new-id", ...row } }; }
  } as unknown as NotionArticleQueue;
  return { queue, calls };
}

test("dry-run returns the payload and duplicate result without writing Notion", async () => {
  for (const existing of [null, { id: "existing", article_title: args[1], status: "processing" }]) {
    const f = notionStub(existing ? [existing] : []);
    const result = await addArticleQueueItem(f.queue, parseArgs(args), [], now);
    assert.equal(result.kind, "dry_run");
    assert.equal(result.exitCode, 0);
    if (result.kind === "dry_run") {
      assert.deepEqual(result.row, buildQueueRow(parseArgs(args), now));
      assert.equal(result.duplicate?.kind ?? null, existing ? "queue" : null);
    }
    assert.deepEqual(f.calls, ["list"]);
  }
});

test("queue and production duplicates return exit 3 without creating a page", async () => {
  for (const status of ARTICLE_TOPIC_DEDUPE_STATUSES) {
    const f = notionStub([{ id: "existing", article_title: args[1], status }]);
    const result = await addArticleQueueItem(f.queue, parseArgs([...args, "--apply"]), [], now);
    assert.equal(result.kind, "duplicate"); assert.equal(result.exitCode, 3);
    assert.deepEqual(f.calls, ["list"]);
  }
  for (const apply of [false, true]) {
    const f = notionStub();
    const result = await addArticleQueueItem(f.queue, parseArgs([...args, ...(apply ? ["--apply"] : [])]), [
      { family: "article", title: args[1], key: "existing-article", universe_id: null }
    ], now);
    assert.equal(result.exitCode, apply ? 3 : 0);
    assert.deepEqual(f.calls, ["list"]);
  }
});

test("apply returns the Notion page UUID and resolves a concurrent insertion", async () => {
  for (const raced of [false, true]) {
    const f = notionStub([], raced);
    const result = await addArticleQueueItem(f.queue, parseArgs([...args, "--claim", "--apply"]), [], now);
    assert.equal(result.kind, raced ? "duplicate" : "inserted");
    assert.equal(result.exitCode, raced ? 3 : 0);
    if (result.kind === "inserted") { assert.equal(result.row.id, "new-id"); assert.equal(result.row.status, "processing"); }
    assert.deepEqual(f.calls, ["list", "put"]);
  }
});

test("Notion lookup and create failures stop queue:add", async () => {
  const lookup = { list: async () => { throw new Error("Notion read failed"); } } as unknown as NotionArticleQueue;
  await assert.rejects(addArticleQueueItem(lookup, parseArgs(args), []), /Notion read failed/);
  const create = { list: async () => [], put: async () => { throw new Error("Create uncertain"); } } as unknown as NotionArticleQueue;
  await assert.rejects(addArticleQueueItem(create, parseArgs([...args, "--apply"]), []), /Create uncertain/);
});
