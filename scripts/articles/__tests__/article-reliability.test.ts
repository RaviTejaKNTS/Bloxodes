import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { authorizePublication, acknowledgePublishedIntents, drainPublications, publicationDue } from "../article-publication-outbox";
import { saveJson, runArticlePipeline, type Decision } from "../article-pipeline";
import { applyLocalCorrections } from "../article-local-correction";
import { normalizeImageAlt } from "../../content/article-image-readiness";
import { briefUniverseId, ensureArticleGameIdentity, resolveOfficialArticleGame } from "../article-game-identity";
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
test("a verified manual recovery closes an exhausted outbox without a new release or retry reset", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "article-outbox-recovered-"));
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ status: "published", result_slug: "recovered", production_url: "https://bloxodes.com/articles/recovered" }), { headers: { "Content-Type": "application/json" } });
  try {
    await authorizePublication(root, ids[0]);
    const file = path.join(root, "tmp/article-publication", `${ids[0]}.json`);
    const intent = JSON.parse(await readFile(file, "utf8"));
    intent.attempts = 6; intent.error = "old cover failure"; await saveJson(file, intent);
    await drainPublications(root, dev, async () => { assert.fail("already published: no new release"); });
    const recovered = JSON.parse(await readFile(file, "utf8"));
    assert.ok(recovered.publishedAt); assert.equal(recovered.attempts, 6); assert.equal(recovered.error, undefined);
  } finally { globalThis.fetch = original; }
});
test("exact acknowledgement touches only the selected published intent and rejects unfinished rows", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "article-outbox-exact-"));
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    assert.equal(new URL(request.url).searchParams.get('id'), `in.(${ids[0]})`);
    return new Response(JSON.stringify([{ id: ids[0], status: "published", result_slug: "recovered", production_url: "https://bloxodes.com/articles/recovered" }]), { headers: { "Content-Type": "application/json" } });
  };
  try {
    for (const id of ids) await authorizePublication(root, id);
    const file = (id: string) => path.join(root, "tmp/article-publication", `${id}.json`);
    const untouched = await readFile(file(ids[1]), "utf8");
    await acknowledgePublishedIntents(root, dev, [ids[0]]);
    assert.ok(JSON.parse(await readFile(file(ids[0]), "utf8")).publishedAt);
    assert.equal(await readFile(file(ids[1]), "utf8"), untouched);
    globalThis.fetch = async () => new Response(JSON.stringify([{ id: ids[1], status: "completed" }]), { headers: { "Content-Type": "application/json" } });
    await assert.rejects(acknowledgePublishedIntents(root, dev, [ids[1]]), /not acknowledged as published/);
    assert.equal(await readFile(file(ids[1]), "utf8"), untouched);
  } finally { globalThis.fetch = original; }
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

test("official identity retries empty/transient responses and resolves place IDs before giving up", async () => {
  let calls = 0;
  const game = { id: 1234, rootPlaceId: 9876, name: "Game" };
  const direct = await resolveOfficialArticleGame(1234, async () => ++calls === 1 ? new Response(null, { status: 429 }) : calls === 2 ? new Response('{"data":[]}') : new Response(JSON.stringify({ data: [game] })), async () => {});
  assert.equal(direct.game?.id, 1234); assert.equal(calls, 3);
  const urls: string[] = [];
  const mapped = await resolveOfficialArticleGame(9876, async input => {
    const url = String(input); urls.push(url);
    return new Response(JSON.stringify(url.includes("/places/") ? { universeId: 1234 } : url.endsWith("=1234") ? { data: [game] } : { data: [] }));
  }, async () => {});
  assert.equal(mapped.game?.id, 1234); assert.match(mapped.note, /place mapping corrected/);
  assert.equal(urls.length, 5);
  calls = 0;
  const unavailable = await resolveOfficialArticleGame(9999, async () => { calls++; return new Response('{"data":[]}'); }, async () => {});
  assert.equal(unavailable.game, null); assert.match(unavailable.note, /universe_id is null/); assert.equal(calls, 4);
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

test("persistent stage workspaces outside Git retain the same model sandbox", async () => {
  const { stageCodexArgs } = await import("../article-stage-runtime");
  const args = stageCodexArgs({ runDir: "/state/article", model: "gpt-5.6-luna", reasoning: "max" } as any, "editorial_review", "review", "/state/attempt");
  assert.ok(args.includes("--skip-git-repo-check"));
  assert.equal(args[args.indexOf("--sandbox") + 1], "read-only");
});

test("fixed copy-gate recovery preserves budgets and requires fresh review for changed copy", async () => {
  const { recoverFixedRuntimeBlocker } = await import("../article-runtime-recovery");
  const root = await mkdtemp(path.join(os.tmpdir(), "article-runtime-recovery-"));
  const hashes = { "brief.md": "brief", "media.json": "media", "final.json": "approved" };
  await saveJson(path.join(root, "editorial_review.json"), { status: "completed", input_hashes: hashes });
  const state = () => ({status:"blocked",stage:"writing",feedback:"The checker rejects /sources/ image URLs.",
    revisions:{research:1,images:1,writing:1},technicalRepairs:{copy_check:1},
    history:[{stage:"copy_check",decision:{status:"needs_revision"}}]} as any);
  const unchanged = state();
  assert.equal(await recoverFixedRuntimeBlocker(unchanged,root,hashes),true);
  assert.equal(unchanged.stage,"copy_check"); assert.equal(unchanged.revisions.writing,1); assert.equal(unchanged.technicalRepairs.copy_check,1);
  const changed = state();
  assert.equal(await recoverFixedRuntimeBlocker(changed,root,{...hashes,"final.json":"changed"}),true);
  assert.equal(changed.stage,"editorial_review");
  const evidence = state();
  assert.equal(await recoverFixedRuntimeBlocker(evidence,root,{...hashes,"media.json":"changed"}),false);
  const editorial = state(); editorial.feedback="The draft repeats important advice.";
  assert.equal(await recoverFixedRuntimeBlocker(editorial,root,hashes),false);
});

test("review prompts return decisions without demanding artifact writes", async () => {
  const { stagePrompt } = await import("../article-stage-runtime");
  const state = {job:{slug:"door",title:"Door",article_type:"guide"},history:[],feedback:"",revisions:{writing:0}} as any;
  const options = {worktree:"/repo",runDir:"/state"} as any;
  for (const stage of ["research_review","image_review","editorial_review"] as const) {
    const prompt = stagePrompt(options,stage,state);
    assert.match(prompt,/controller saves review artifacts/); assert.doesNotMatch(prompt,/Save the artifact before returning/);
  }
});

test("persistent-state symlinks preserve approval checks and reject changed artifacts", async () => {
  const { mkdir, symlink, writeFile } = await import("node:fs/promises");
  const { artifactHashes } = await import("../article-pipeline");
  const { resolveReleaseArtifactPath } = await import("../release-completed-articles");
  const root = await mkdtemp(path.join(os.tmpdir(), "article-release-root-"));
  const stateRoot = await mkdtemp(path.join(os.tmpdir(), "article-release-state-"));
  await symlink(stateRoot, path.join(root, "tmp"));
  const run = path.join(stateRoot, "article-pipeline", ids[0]);
  const content = path.join(run, "content"); await mkdir(content, { recursive: true });
  for (const file of ["brief.md", "media.json", "final.json"]) await writeFile(path.join(content, file), "approved");
  await saveJson(path.join(run, "state.json"), { status: "completed", stage: "done", job: { id: ids[0], slug: "test" }, artifacts: await artifactHashes(content), history: ["copy_check", "image_check", "import_verify", "browser_verify"].map(stage => ({ stage, decision: { status: "completed" } })) });
  await saveJson(path.join(run, "editorial_review.json"), { status: "completed" });
  const logical = path.join(root, "tmp/article-pipeline", ids[0], "content/final.json");
  assert.equal(await resolveReleaseArtifactPath(logical, ids[0], "test", root), path.join(content, "final.json"));
  await writeFile(path.join(content, "final.json"), "changed");
  await assert.rejects(resolveReleaseArtifactPath(logical, ids[0], "test", root), /approval no longer matches/);
});
