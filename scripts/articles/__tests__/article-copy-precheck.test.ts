import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { authorizePublication, drainPublications, publicationDue } from "../article-publication-outbox";
import { saveJson } from "../article-pipeline";

const dev = { url: "https://test.supabase.co", serviceRole: "test-placeholder" };
const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
const read = async (file: string) => JSON.parse(await readFile(file, "utf8"));
async function fixture(t: any) {
  const root = await mkdtemp(path.join(os.tmpdir(), "article-copy-precheck-"));
  const rows = ids.map(id => ({ id, status: "completed", result_slug: "test", result_path: `tmp/content-workspace/${id}/final.json`, production_url: null }));
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(new Request(input, init).url);
    assert.equal(url.searchParams.get("workflow_mode"), "eq.agent_runner");
    return new Response(JSON.stringify(rows.find(row => url.searchParams.get("id") === `eq.${row.id}`)), { headers: { "Content-Type": "application/json" } });
  };
  t.after(async () => { globalThis.fetch = original; await rm(root, { recursive: true, force: true }); });
  const final = (id = ids[0]) => path.join(root, rows.find(row => row.id === id)!.result_path);
  const intent = (id = ids[0]) => path.join(root, "tmp/article-publication", `${id}.json`);
  const writeCopy = (text: string, id = ids[0]) => saveJson(final(id), { title: "Test", slug: "test", content_md: text });
  for (const id of ids) { await authorizePublication(root, id); await writeCopy("Collect the reward.", id); }
  return { root, rows, final, intent, writeCopy, health: () => read(path.join(root, "tmp/article-publication/health.json")) };
}

test("bad copy blocks before reservation/dispatch, reports once across restarts, and lets other intents release", async t => {
  const f = await fixture(t);
  await f.writeCopy("Keep moving for the whole fight, not just during the big hits.");
  const previous = await read(f.intent()); previous.attempts = 2; await saveJson(f.intent(), previous);
  const dispatched: string[] = [];
  await assert.rejects(drainPublications(f.root, dev, async id => { dispatched.push(id); }), /AI-ish contrast filler.*not just/);
  assert.deepEqual(dispatched, [ids[1]]);
  const blocked = await read(f.intent());
  assert.equal(blocked.attempts, 2); assert.equal(blocked.nextAttemptAt, undefined); assert.equal(blocked.dispatchHash, undefined);
  assert.equal(blocked.copyBlocked.finalHash, createHash("sha256").update(await readFile(f.final())).digest("hex"));
  assert.ok(blocked.copyBlocked.reportedAt); assert.equal(publicationDue(blocked), false);
  await drainPublications(f.root, dev, async () => assert.fail("unchanged bad copy must not dispatch"));
  assert.deepEqual(await read(f.intent()), blocked);
  assert.match((await f.health()).issues[0], /AI-ish contrast filler.*not just/);
  assert.equal((await f.health()).issues.length, 1);
  await f.writeCopy("Get fully clear, not just to the edge.");
  await assert.rejects(drainPublications(f.root, dev, async () => assert.fail("changed bad copy must not dispatch")), /not just to the edge/);
  assert.notEqual((await read(f.intent())).copyBlocked.finalHash, blocked.copyBlocked.finalHash);
  assert.equal((await read(f.intent())).attempts, 2);
  await f.writeCopy("Get fully clear.");
  await drainPublications(f.root, dev, async id => assert.equal(id, ids[0]));
  const released = await read(f.intent());
  assert.equal(released.attempts, 3); assert.ok(released.publishedAt); assert.equal(released.copyBlocked, undefined);
  assert.deepEqual((await f.health()).issues, []);
});

test("rejection removes a copy blocker from health without dispatch or budget changes", async t => {
  const f = await fixture(t);
  await f.writeCopy("Keep moving, not just during the big hits.");
  await assert.rejects(drainPublications(f.root, dev, async id => assert.equal(id, ids[1])), /Copy pre-check/);
  f.rows[0].status = "rejected";
  await drainPublications(f.root, dev, async () => assert.fail("rejected article"));
  assert.equal((await read(f.intent())).attempts, 0);
  assert.deepEqual((await f.health()).issues, []);
});
