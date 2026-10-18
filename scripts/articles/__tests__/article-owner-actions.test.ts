import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authorizePublication, retryExhaustedIntents, drainPublications } from "../article-publication-outbox";
import { approveOwnerArticleEdit } from "../approve-owner-article-edit";
import { artifactHashes, saveJson } from "../article-pipeline";
import { resolveReleaseArtifactPath } from "../release-completed-articles";
import { acquireAgentWorkLock } from "../../shared/agent-work-lock";
import { parseOwnerArgs } from "../article-owner-actions";

const dev = { url: "https://test.supabase.co", serviceRole: "test-placeholder" };
const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
const read = async (file: string) => JSON.parse(await readFile(file, "utf8"));
async function fixture(t: any) {
  const root = await mkdtemp(path.join(os.tmpdir(), "article-owner-"));
  const intentFile = (id = ids[0]) => path.join(root, "tmp/article-publication", `${id}.json`);
  const rows = ids.map(id => ({ id, status: "completed", result_slug: "test", result_path: `tmp/article-pipeline/${id}/content/final.json`, production_url: null as string | null }));
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    assert.equal(request.method, "GET", "owner commands never mutate the database");
    const query = new URL(request.url).searchParams;
    assert.equal(query.get("workflow_mode"), "eq.agent_runner");
    const selected = rows.filter(row => query.get("id")?.includes(row.id));
    return new Response(JSON.stringify(query.get("id")?.startsWith("eq.") ? selected[0] ?? null : selected), { headers: { "Content-Type": "application/json" } });
  };
  t.after(async () => { globalThis.fetch = original; await rm(root, { recursive: true, force: true }); });
  for (const id of ids) {
    await authorizePublication(root, id);
    await saveJson(intentFile(id), { ...await read(intentFile(id)), attempts: 6, error: "previous error", exhaustionReportedAt: new Date().toISOString(), nextAttemptAt: new Date(Date.now() + 3600_000).toISOString() });
  }
  return { root, rows, intentFile };
}

test("exact exhausted retry retains authorization and audit, clears report/backoff, and needs normal drain", async t => {
  const { root, intentFile } = await fixture(t);
  const previous = await read(intentFile()), untouched = await readFile(intentFile(ids[1]), "utf8");
  await retryExhaustedIntents(root, dev, [ids[0]], "Claude owner", "fixed copy");
  const updated = await read(intentFile());
  assert.equal(updated.attempts, 0); assert.equal(updated.authorizedAt, previous.authorizedAt);
  for (const key of ["error", "nextAttemptAt", "exhaustionReportedAt", "publishedAt"]) assert.equal(updated[key], undefined);
  assert.deepEqual(updated.ownerRetries[0].previous, previous);
  assert.equal(updated.ownerRetries[0].operator, "Claude owner"); assert.ok(updated.ownerRetries[0].localUser); assert.ok(updated.ownerRetries[0].at);
  assert.equal(await readFile(intentFile(ids[1]), "utf8"), untouched);
  await assert.rejects(retryExhaustedIntents(root, dev, [ids[0]], "owner", "again"), /exhausted/);
  // Mark the unrelated exhausted alert as already reported; retry itself did not release.
  let calls = 0;
  await drainPublications(root, dev, async id => { assert.equal(id, ids[0]); calls++; });
  assert.equal(calls, 1);
});

test("retry validates all IDs first and refuses published, unexhausted, malformed and unresolved dispatches", async t => {
  const { root, rows, intentFile } = await fixture(t);
  const previous = await readFile(intentFile(), "utf8");
  rows[1].status = "published";
  await assert.rejects(retryExhaustedIntents(root, dev, ids, "owner", "repair"), /unpublished/);
  assert.equal(await readFile(intentFile(), "utf8"), previous);
  rows[1].status = "completed";
  for (const patch of [{ attempts: 5 }, { publishedAt: new Date().toISOString() }, { dispatchHash: "a".repeat(64) }, { submittedAt: new Date().toISOString() }, { githubRunId: 1 }, { authorizedAt: "bad" }, { queueId: ids[1] }]) {
    await saveJson(intentFile(), { ...JSON.parse(previous), ...patch });
    await assert.rejects(retryExhaustedIntents(root, dev, [ids[0]], "owner", "repair"));
  }
  for (const selection of [[], [ids[0], ids[0]], ["all"], ["../"], [ids[0].toUpperCase()]]) {
    // This fixture UUID contains only digits, so uppercase is identical and remains valid.
    if (selection[0] === ids[0] && selection.length === 1) continue;
    await assert.rejects(retryExhaustedIntents(root, dev, selection, "owner", "repair"));
  }
  const unlock = await acquireAgentWorkLock(path.join(root, "tmp/article-publication"), "test");
  try { await assert.rejects(retryExhaustedIntents(root, dev, [ids[0]], "owner", "repair"), /busy/); }
  finally { await unlock!(); }
});

async function articleFixture(t: any, text: string) {
  const fixtureData = await fixture(t);
  const { root } = fixtureData;
  await symlink(fileURLToPath(new URL("../../", import.meta.url)), path.join(root, "scripts"));
  const run = path.join(root, "tmp/article-pipeline", ids[0]), content = path.join(run, "content");
  const finalPath = path.join(content, "final.json"), stateFile = path.join(run, "state.json"), reviewFile = path.join(run, "editorial_review.json");
  await saveJson(path.join(content, "brief.md"), "unchanged brief"); await saveJson(path.join(content, "media.json"), { entries: [] });
  await saveJson(finalPath, { title: "Test", slug: "test", content_md: text });
  const originalHashes = await artifactHashes(content);
  const previousReview = { status: "completed", input_hashes: originalHashes, summary: "Original reviewer evidence" };
  await saveJson(reviewFile, previousReview);
  await saveJson(stateFile, { version: 1, status: "completed", stage: "done", job: { id: ids[0], slug: "test" }, attempts: {}, artifacts: originalHashes, history: ["copy_check", "image_check", "import_verify", "browser_verify"].map(stage => ({ stage, decision: { status: "completed", delegatedToCi: true } })) });
  return { ...fixtureData, run, content, finalPath, stateFile, reviewFile, originalHashes, previousReview };
}

const edits = [
  ["Claim every unlocked row, not just the newest.", "Go back and claim the older rows too."],
  ["The first three finishers each get one Halloween Egg. Third place is the cutoff, so you're racing for position, not just a finish.", "The first three finishers each get one Halloween Egg."],
];
for (const [before, after] of edits) test(`owner copy approval binds repaired bytes and retains prior evidence: ${after}`, async t => {
  const f = await articleFixture(t, before);
  const oldIntent = await readFile(f.intentFile(), "utf8");
  await saveJson(f.finalPath, { title: "Test", slug: "test", content_md: after });
  const hash = (await artifactHashes(f.content))["final.json"];
  await assert.rejects(resolveReleaseArtifactPath(f.finalPath, ids[0], "test", f.root), /no longer matches/);
  await assert.rejects(approveOwnerArticleEdit(f.root, dev, ids[0], "f".repeat(64), "owner", "copy repair"), /expected SHA256/);
  await approveOwnerArticleEdit(f.root, dev, ids[0], hash, "owner", "copy repair");
  const state = await read(f.stateFile), review = await read(f.reviewFile);
  assert.equal(state.artifacts["final.json"], hash); assert.deepEqual(review.input_hashes, state.artifacts);
  assert.deepEqual(state.ownerApprovals[0].previousArtifacts, f.originalHashes); assert.deepEqual(state.ownerApprovals[0].previousReview, f.previousReview);
  assert.equal(state.ownerApprovals[0].status, "completed"); assert.equal(state.history.slice(-1).pop().decision.delegatedToCi, true);
  assert.equal(await readFile(f.intentFile(), "utf8"), oldIntent);
  assert.equal(await resolveReleaseArtifactPath(f.finalPath, ids[0], "test", f.root), f.finalPath);
  state.ownerApprovals[0].status = "pending"; state.artifacts = f.originalHashes; await saveJson(f.stateFile, state);
  await assert.rejects(resolveReleaseArtifactPath(f.finalPath, ids[0], "test", f.root), /pending/);
  await approveOwnerArticleEdit(f.root, dev, ids[0], hash, "owner", "copy repair");
  assert.equal((await read(f.stateFile)).ownerApprovals.length, 1, "interrupted approval resumes the same audit entry");
  await saveJson(f.finalPath, { title: "Test", slug: "test", content_md: after + " Extra edit." });
  await assert.rejects(resolveReleaseArtifactPath(f.finalPath, ids[0], "test", f.root), /does not match/);
});

test("owner approval rejects failing copy, changed evidence, missing QA and busy runs without recording approval", async t => {
  const f = await articleFixture(t, "Original copy.");
  const stateBytes = await readFile(f.stateFile, "utf8"), reviewBytes = await readFile(f.reviewFile, "utf8");
  await saveJson(f.finalPath, { title: "Test", slug: "test", content_md: edits[0][0] });
  let hash = (await artifactHashes(f.content))["final.json"];
  await assert.rejects(approveOwnerArticleEdit(f.root, dev, ids[0], hash, "owner", "repair"), /Command failed/);
  assert.equal(await readFile(f.stateFile, "utf8"), stateBytes); assert.equal(await readFile(f.reviewFile, "utf8"), reviewBytes);
  await saveJson(f.finalPath, { title: "Test", slug: "test", content_md: edits[0][1] }); hash = (await artifactHashes(f.content))["final.json"];
  await saveJson(path.join(f.content, "brief.md"), "changed evidence");
  await assert.rejects(approveOwnerArticleEdit(f.root, dev, ids[0], hash, "owner", "repair"), /cannot change approved brief/);
  await saveJson(path.join(f.content, "brief.md"), "unchanged brief");
  const state = JSON.parse(stateBytes); state.history.pop(); await saveJson(f.stateFile, state);
  await assert.rejects(approveOwnerArticleEdit(f.root, dev, ids[0], hash, "owner", "repair"), /Missing original browser_verify/);
  await saveJson(f.stateFile, JSON.parse(stateBytes));
  const unlock = await acquireAgentWorkLock(f.run, "test");
  try { await assert.rejects(approveOwnerArticleEdit(f.root, dev, ids[0], hash, "owner", "repair"), /pipeline is busy/); }
  finally { await unlock!(); }
});

test("owner CLI requires explicit apply, identity, reason and exact hash and rejects unknown flags", () => {
  const base = ["--queue-id", ids[0], "--operator", "owner", "--reason", "repair"];
  assert.throws(() => parseOwnerArgs(base), /--apply/);
  assert.throws(() => parseOwnerArgs([...base, "--apply", "--all"]), /Invalid/);
  assert.throws(() => parseOwnerArgs(["--queue-id", ids[0], "--apply"]), /operator/);
  assert.throws(() => parseOwnerArgs([...base, "--apply"], true), /expected-final-hash/);
  assert.equal(parseOwnerArgs([...base, "--apply", "--expected-final-hash", "a".repeat(64)], true).expectedHash, "a".repeat(64));
});
