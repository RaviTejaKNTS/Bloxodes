import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { authorizePublication, drainPublications, publicationDue } from "../article-publication-outbox";
import { saveJson, runArticlePipeline, type Decision } from "../article-pipeline";
import { applyLocalCorrections } from "../article-local-correction";
import { normalizeImageAlt } from "../../content/article-image-readiness";
import { briefUniverseId, ensureArticleGameIdentity } from "../article-game-identity";
const dev = { url: "https://test.supabase.co", serviceRole: "test-placeholder" };
const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
test("failed publication survives restart, backs off, and does not block another completed article", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "article-outbox-"));
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ status: "completed" }), { headers: { "Content-Type": "application/json" } });
  try {
    for (const id of ids) await authorizePublication(root, id);
    const attempted: string[] = [];
    await assert.rejects(drainPublications(root, dev, async id => { attempted.push(id); if (id === ids[0]) throw new Error("injected upload interruption"); }));
    assert.deepEqual(attempted, ids);
    const file = path.join(root, "tmp/article-publication", `${ids[0]}.json`);
    const intent = JSON.parse(await readFile(file, "utf8"));
    assert.equal(intent.attempts, 1); assert.equal(publicationDue(intent), false);
    await drainPublications(root, dev, async () => { throw new Error("not due: must not launch"); });
    intent.nextAttemptAt = new Date(0).toISOString(); await saveJson(file, intent);
    await drainPublications(root, dev, async id => { assert.equal(id, ids[0]); });
    assert.ok(JSON.parse(await readFile(file, "utf8")).publishedAt);
  } finally { globalThis.fetch = original; }
});
test("unapproved and unfinished articles never reach publication", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "article-outbox-"));
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ status: "processing" }), { headers: { "Content-Type": "application/json" } });
  try { await authorizePublication(root, ids[0]); await drainPublications(root, dev, async () => { assert.fail("unfinished publication"); }); }
  finally { globalThis.fetch = original; }
});
test("publication retries remain bounded even if the child dies before acknowledgement", () => {
  assert.equal(publicationDue({ version: 1, queueId: ids[0], authorizedAt: "", attempts: 6 }), false);
});
test("equivalent alt encodings pass while meaningfully different text stays different", () => {
  assert.equal(normalizeImageAlt("Woodsman&#39;s &amp; axe"), normalizeImageAlt("Woodsman's & axe"));
  assert.notEqual(normalizeImageAlt("Woodsman's axe"), normalizeImageAlt("Elemental's axe"));
});
test("local correction accepts unique short prose and rejects broad, ambiguous or media edits", () => {
  assert.equal(applyLocalCorrections("Follow this four-country progression.", [{ before: "four-country", after: "four-state" }]), "Follow this four-state progression.");
  assert.equal(applyLocalCorrections("same same", [{ before: "same", after: "different" }]), null);
  assert.equal(applyLocalCorrections("![image](url)", [{ before: "![image](url)", after: "" }]), null);
});
test("deadline retains the stage with bounded operational retry", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "article-deadline-"));
  const state = await runArticlePipeline({ job: { id: "deadline", title: "Test", slug: "test", article_type: "guide", sources: [] }, runDir, deadline: Date.now() - 1, execute: async () => { assert.fail("deadline must not run"); } });
  assert.equal(state.stage, "research"); assert.equal(state.blockerKind, "technical"); assert.ok(state.retryAfter);
});
test("localized correction must go through a fresh review before technical checks", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "article-correction-")); let reviews = 0;
  const pass = (): Decision => ({ status: "completed", summary: "checked", findings: [], repair_stage: null, accepted_missing: [] });
  const state = await runArticlePipeline({ job: { id: "correction", title: "Test", slug: "test", article_type: "guide", sources: [] }, runDir, deadline: Date.now() + 10_000, execute: async stage => {
    if (stage === "editorial_review" && ++reviews === 1) return { status: "needs_revision", summary: "localized edit applied", findings: ["word corrected"], repair_stage: "writing", accepted_missing: [], localizedCorrectionApplied: true };
    if (stage === "copy_check") assert.equal(reviews, 2);
    return pass();
  } });
  assert.equal(state.status, "completed"); assert.equal(state.editorialCorrections, 1);
});
test("identity preflight only inserts the exact official game, preserves existing rows, verifies readback", async () => {
  assert.equal(briefUniverseId("Game universe_id (if game-specific): 1235188606."), 1235188606);
  assert.equal(briefUniverseId("universe_id: 1234\nuniverse_id: 5678"), null);
  const original = globalThis.fetch; let inserted: any; let reads = 0;
  globalThis.fetch = async (input, init) => {
    const r = new Request(input, init);
    if (r.method === "POST") { inserted = await r.json(); return new Response(null, { status: 201 }); }
    return new Response(JSON.stringify(++reads === 1 ? null : { root_place_id: 3475397644 }), { headers: { "Content-Type": "application/json" } });
  };
  try {
    await ensureArticleGameIdentity(1235188606, { NODE_ENV: "test", SUPABASE_URL: dev.url, SUPABASE_SERVICE_ROLE: dev.serviceRole }, async () => new Response(JSON.stringify({ data: [{ id: 1235188606, rootPlaceId: 3475397644, name: "Dragon Adventures" }] })));
    assert.equal(inserted.universe_id, 1235188606); assert.equal(inserted.root_place_id, 3475397644);
  } finally { globalThis.fetch = original; }
});

test("image bytes retry transient failures but do not retry a 404 or invalid image payload", async () => {
  const { fetchImageBytes } = await import("../../shared/fetch-image-bytes");
  let attempts = 0;
  const bytes = await fetchImageBytes("https://example.com/image", {}, async () => { if (++attempts === 1) throw Error("injected connection reset"); return new Response("image", { headers: { "Content-Type": "image/webp" } }); }, async () => {});
  assert.equal(bytes.toString(), "image"); assert.equal(attempts, 2);
  attempts = 0;
  await assert.rejects(fetchImageBytes("https://example.com/image", {}, async () => { attempts++; return new Response(null, { status: 404 }); }, async () => {}), /404/);
  assert.equal(attempts, 1);
});
