import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { readArticleState, saveArticleState, pruneArticleState, withArticleState, type ArticleLocalState } from "../article-local-state";

async function fixture() {
  const directory = path.resolve("tmp", `article-local-state-${randomUUID()}`);
  await fs.mkdir(directory, { recursive: true });
  return directory;
}
test("state dry runs create no files; missing state starts empty", async () => {
  const directory = await fixture();
  try {
    await withArticleState(false, async (state, save) => {
      assert.deepEqual(state, { version: 1, candidates: [], runs: [] });
      state.runs.push({ id: "dry", created_at: new Date().toISOString() });
      await save();
    }, directory);
    assert.deepEqual(await fs.readdir(directory), []);
  } finally { await fs.rm(directory, { recursive: true }); }
});
test("atomic saves retain a committed plan and remove temporary files", async () => {
  const directory = await fixture();
  try {
    await withArticleState(true, async (state, save) => {
      state.runs.push({ id: "run", status: "running", created_at: new Date().toISOString(), decisions: [{ topic_key: "fisch" }] });
      await save();
      assert.equal((await readArticleState(directory)).runs[0].decisions[0].topic_key, "fisch");
      await assert.rejects(withArticleState(true, async () => {}, directory), /busy/);
    }, directory);
    assert.deepEqual(await fs.readdir(directory), ["state.json"]);
    await fs.writeFile(path.join(directory, "state.json"), "corrupted");
    await assert.rejects(readArticleState(directory));
  } finally { await fs.rm(directory, { recursive: true }); }
});
test("a dead local owner and its abandoned temporary save are recovered", async () => {
  const directory = await fixture();
  try {
    await fs.mkdir(path.join(directory, ".writer-lock"));
    await fs.writeFile(path.join(directory, ".writer-lock", "owner.json"), JSON.stringify({ pid: 2147483647, host: hostname(), token: "dead" }));
    await fs.writeFile(path.join(directory, `.state-${randomUUID()}.tmp`), "half-written");
    await withArticleState(true, async (_state, save) => { await save(); }, directory);
    assert.deepEqual(await fs.readdir(directory), ["state.json"]);
  } finally { await fs.rm(directory, { recursive: true }); }
});
test("state keeps at most 5,000 candidates, 200 runs and ten full responses", () => {
  const now = Date.now(), date = new Date(now).toISOString();
  const state: ArticleLocalState = { version: 1,
    candidates: Array.from({ length: 5010 }, (_, id) => ({ id: String(id), source_url: `https://example.com/${id}`, source_title: "Title", source_name: "Source", curation_status: id < 10 ? "pending" : "rejected", created_at: date, updated_at: date })),
    runs: Array.from({ length: 205 }, (_, id) => ({ id, created_at: date, raw_response: { large: "data" } })) };
  pruneArticleState(state, now);
  assert.equal(state.candidates.length, 5000);
  assert.equal(state.candidates.filter(row => row.curation_status === "pending").length, 10);
  assert.equal(state.runs.length, 200);
  assert.equal(state.runs.filter(row => row.raw_response).length, 10);
});
test("expired state is pruned and a failed save preserves the previous file", async () => {
  const directory = await fixture();
  try {
    const state: ArticleLocalState = { version: 1, candidates: [], runs: [{ id: "expired", created_at: "2020-01-01" }] };
    await saveArticleState(state, directory);
    const original = await fs.readFile(path.join(directory, "state.json"), "utf8");
    const now = new Date().toISOString();
    state.candidates = Array.from({ length: 5001 }, (_, id) => ({ id: String(id), source_url: "https://example.com", source_title: "Title", source_name: "Source", curation_status: "pending", created_at: now, updated_at: now }));
    await assert.rejects(saveArticleState(state, directory), /5,000/);
    assert.equal(await fs.readFile(path.join(directory, "state.json"), "utf8"), original);
  } finally { await fs.rm(directory, { recursive: true }); }
});
