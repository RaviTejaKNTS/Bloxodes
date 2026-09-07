import assert from "node:assert/strict";
import test from "node:test";
import { processArticleQueueRow, queueArticleJob } from "../article-pipeline-queue";
import type { StageRuntimeOptions } from "../article-stage-runtime";
import type { PipelineState } from "../article-pipeline";

const row = { id: "11111111-1111-4111-8111-111111111111", article_title: "How to Get a Test Item", article_type: "guide", attempts: 0, source_url: "https://example.com/guide" };
const runtime = { worktree: "/repo", runDir: "/repo/tmp/article-pipeline/test" } as StageRuntimeOptions;
const dev = { url: "https://test.supabase.co", serviceRole: "test-only-placeholder" };

test("queue completion belongs to the code claim and only follows a completed pipeline result", async () => {
  const original = globalThis.fetch; const requests: { url: URL; method: string; body: any }[] = [];
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init); const method = request.method;
    const body = method === "PATCH" ? await request.json() : null;
    requests.push({ url: new URL(request.url), method, body });
    const result = method === "GET" ? [row] : { id: row.id };
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await processArticleQueueRow(dev, row.id, runtime, async job => ({ status: "completed", job, feedback: "All stages passed" } as PipelineState));
    assert.equal(result?.status, "completed");
    const claim = requests.find(r => r.body?.status === "processing")!;
    assert.equal(claim.url.searchParams.get("status"), "eq.pending"); assert.equal(claim.url.searchParams.get("attempts"), "eq.0");
    const complete = requests.find(r => r.body?.status === "completed")!;
    assert.equal(complete.url.searchParams.get("locked_by"), "eq.code-homelab");
    assert.equal(complete.url.searchParams.get("locked_at"), `eq.${claim.body.locked_at}`);
    assert.equal(complete.body.result_path, "tmp/article-pipeline/test/content/final.json");
  } finally { globalThis.fetch = original; }
});
test("research/editorial blockers release the lease without endlessly scheduling the same exhausted run", async () => {
  const original = globalThis.fetch; let patch: any;
  globalThis.fetch = async (input, init) => {
    const r = new Request(input, init);
    if (r.method === "PATCH") patch = await r.json();
    return new Response(JSON.stringify(r.method === "GET" ? [row] : { id: row.id }), { headers: { "Content-Type": "application/json" } });
  };
  try {
    await processArticleQueueRow(dev, row.id, runtime, async job => ({ status: "blocked", job, feedback: "Review budget exhausted" } as PipelineState));
    assert.equal(patch.status, "blocked"); assert.equal(patch.locked_by, null); assert.equal(patch.next_attempt_at, null); assert.equal(patch.result_path, null);
  } finally { globalThis.fetch = original; }
});
test("a raced queue claim never launches a model", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => { const r = new Request(input, init); return new Response(JSON.stringify(r.method === "GET" ? [row] : null), { headers: { "Content-Type": "application/json" } }); };
  try { assert.equal(await processArticleQueueRow(dev, row.id, runtime, async () => { throw Error("must not run"); }), undefined); }
  finally { globalThis.fetch = original; }
});
test("queue input preserves the grouped source packet and stable refresh slug", () => {
  const job = queueArticleJob({ ...row, result_slug: "retained-slug", source_urls: [row.source_url, "https://example.org/guide"], source_items: [{ text: "source evidence" }] });
  assert.equal(job.slug, "retained-slug"); assert.equal((job.sources as any).source_items[0].text, "source evidence");
});
test('provider backoff is recorded in the queue while preserving the exact article slug', async () => {
  const original = globalThis.fetch; let patch: any;
  const retryAfter = new Date(Date.now() + 180 * 60_000).toISOString();
  globalThis.fetch = async (input, init) => {
    const r = new Request(input, init);
    if (r.method === 'PATCH') patch = await r.json();
    return new Response(JSON.stringify(r.method === 'GET' ? [row] : { id: row.id }), { headers: { 'Content-Type': 'application/json' } });
  };
  try {
    await processArticleQueueRow(dev, row.id, runtime, async job => ({ status: 'blocked', job, feedback: 'Account usage limit', blockerKind: 'provider', retryAfter } as PipelineState));
    assert.equal(patch.next_attempt_at, retryAfter); assert.equal(patch.result_slug, queueArticleJob(row).slug); assert.equal(patch.locked_by, null);
  } finally { globalThis.fetch = original; }
});

test("an explicit queue-ID run scopes recovery as well as selection", async () => {
  const { recoverStaleBatchClaims, requeueDueBlockedRows } = await import("../run-homelab-article-batch");
  const original = globalThis.fetch; const requests: URL[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push(new URL(new Request(input, init).url));
    return new Response("[]", { headers: { "Content-Type": "application/json" } });
  };
  try {
    await recoverStaleBatchClaims(dev, 3, 330, row.id);
    await requeueDueBlockedRows(dev, 3, row.id);
    assert.equal(requests.length, 3);
    assert.ok(requests.every(url => url.searchParams.get("id") === `eq.${row.id}`));
  } finally { globalThis.fetch = original; }
});
