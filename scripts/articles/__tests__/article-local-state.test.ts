import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
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
    assert.deepEqual((await fs.readdir(directory)).sort(), [".writer.lock", "state.json"]);
    await fs.writeFile(path.join(directory, "state.json"), "corrupted");
    await assert.rejects(readArticleState(directory));
  } finally { await fs.rm(directory, { recursive: true }); }
});
test("an abandoned temporary save is removed while holding the advisory lock", async () => {
  const directory = await fixture();
  try {
    await fs.writeFile(path.join(directory, `.state-${randomUUID()}.tmp`), "half-written");
    await withArticleState(true, async (_state, save) => { await save(); }, directory);
    assert.deepEqual((await fs.readdir(directory)).sort(), [".writer.lock", "state.json"]);
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
test("expired state is pruned and a failed serialization preserves the previous file", async () => {
  const directory = await fixture();
  try {
    const state: ArticleLocalState = { version: 1, candidates: [], runs: [{ id: "expired", created_at: "2020-01-01" }] };
    await saveArticleState(state, directory);
    const original = await fs.readFile(path.join(directory, "state.json"), "utf8");
    const circular: Record<string, any> = {}; circular.self = circular;
    state.runs = [{ created_at: new Date().toISOString(), raw_response: circular }];
    await assert.rejects(saveArticleState(state, directory), /circular/i);
    assert.equal(await fs.readFile(path.join(directory, "state.json"), "utf8"), original);
  } finally { await fs.rm(directory, { recursive: true }); }
});

test("the kernel releases a killed writer's lock and admits only one concurrent reclaimer", { timeout: 20_000 }, async () => {
  const directory = await fixture();
  const moduleUrl = new URL("../article-local-state.ts", import.meta.url).href;
  const source = `import { withArticleState } from ${JSON.stringify(moduleUrl)};
    await withArticleState(true, async () => { process.stdout.write('locked\\n'); await new Promise(resolve => setTimeout(resolve, 300000)); }, ${JSON.stringify(directory)});`;
  const writer = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", source], { stdio: ["ignore", "pipe", "pipe"], timeout: 15_000 });
  let stderr = "";
  writer.stderr.on("data", chunk => { stderr += chunk; });
  try {
    await new Promise<void>((resolve, reject) => {
      writer.stdout.on("data", chunk => { if (String(chunk).includes("locked")) resolve(); });
      writer.once("error", reject);
      writer.once("exit", code => reject(new Error(`Writer exited before acquiring its lock (${code}): ${stderr}`)));
    });
    await assert.rejects(withArticleState(true, async () => assert.fail("A second writer entered"), directory), /busy/);
    const exited = once(writer, "exit"); writer.kill("SIGKILL"); await exited;
    let entered = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let enteredSignal!: () => void;
    const acquired = new Promise<void>(resolve => { enteredSignal = resolve; });
    let rejectedSignal!: () => void;
    const rejected = new Promise<void>(resolve => { rejectedSignal = resolve; });
    const contenders = Array.from({ length: 2 }, () => withArticleState(true, async (state, save) => {
      entered++; enteredSignal(); await gate;
      state.runs.push({ id: "recovered", created_at: new Date().toISOString() }); await save();
    }, directory).catch(error => { rejectedSignal(); throw error; }));
    // Attach handlers before waiting so the losing contender is never unhandled.
    const settled = Promise.allSettled(contenders);
    await Promise.all([acquired, rejected]);
    assert.equal(entered, 1); release();
    const results = await settled;
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.match(String((results.find(result => result.status === "rejected") as PromiseRejectedResult).reason), /busy/);
    assert.equal((await readArticleState(directory)).runs[0].id, "recovered");
    // The same lock file stays in place across release and reacquisition.
    const before = await fs.stat(path.join(directory, ".writer.lock"));
    await withArticleState(true, async () => {}, directory);
    assert.equal((await fs.stat(path.join(directory, ".writer.lock"))).ino, before.ino);
  } finally {
    if (writer.exitCode === null && writer.signalCode === null) { const exited = once(writer, "exit"); writer.kill("SIGKILL"); await exited; }
    await fs.rm(directory, { recursive: true });
  }
});

test("discovery drops the oldest undecided backlog, logs the count and still saves", async t => {
  const directory = await fixture();
  const now = Date.now();
  const state: ArticleLocalState = { version: 1, runs: [], candidates: Array.from({ length: 5002 }, (_, id) => ({
    id: String(id), source_url: `https://example.com/${id}`, source_title: "Title", source_name: "Source", curation_status: "pending",
    created_at: new Date(now - (5002 - id) * 1000).toISOString(), updated_at: new Date(now).toISOString(),
  })) };
  const logs: string[] = [];
  t.mock.method(console, "warn", (message: string) => logs.push(message));
  try {
    await saveArticleState(state, directory);
    const saved = await readArticleState(directory);
    assert.equal(saved.candidates.length, 5000);
    assert.ok(!saved.candidates.some(row => ["0", "1"].includes(row.id)));
    assert.ok(saved.candidates.some(row => row.id === "5001"));
    assert.match(logs[0], /dropped 2 oldest undecided.*kept 5000 newest/);
  } finally { await fs.rm(directory, { recursive: true }); }
});

test("the cap preserves an interrupted curation plan and its old processing candidates", () => {
  const now = Date.now(), date = new Date(now).toISOString();
  const old = { id: "planned", source_url: "https://example.com/planned", source_title: "Title", source_name: "Source", curation_status: "processing", created_at: "2020-01-01", updated_at: "2020-01-01" };
  const state: ArticleLocalState = { version: 1,
    candidates: [old, ...Array.from({ length: 5000 }, (_, id) => ({ ...old, id: String(id), curation_status: "pending", created_at: date, updated_at: date }))],
    runs: [{ id: "resume", status: "running", created_at: "2020-01-01", candidate_ids: ["planned"], decisions: [] }] };
  pruneArticleState(state, now);
  assert.equal(state.candidates.length, 5000);
  assert.ok(state.candidates.some(row => row.id === "planned"));
  assert.equal(state.runs[0].id, "resume");
});

test("the scheduled unit curates before discovery with its existing run and memory limits", async () => {
  const unit = await fs.readFile("scripts/ops/systemd/bloxodes-article-discovery.service", "utf8");
  assert.deepEqual(unit.split("\n").filter(line => line.startsWith("ExecStart=")), [
    "ExecStart=/usr/bin/npm run articles:curate -- --apply", "ExecStart=/usr/bin/npm run articles:discover -- --apply",
  ]);
  assert.match(unit, /^MemoryMax=512M$/m); assert.match(unit, /^TimeoutStartSec=45min$/m);
});
