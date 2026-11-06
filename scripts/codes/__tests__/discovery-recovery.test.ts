import test from "node:test";
import assert from "node:assert/strict";
import { emptyState, observeCandidates, fairPendingKeys, processPendingBatch, OperationalDiscoveryError, ResolutionError, type DiscoveryState } from "../discovery-model";
import { CodesQueue, makeRequest, FatalDiscoveryError } from "../discovery-io";
import { discoveryExitCode } from "../command-outcome";

const signal = () => new AbortController().signal;
function store() {
  let bytes = "";
  const state = emptyState(); state.robloxdenBaseline = true;
  return { state, save: async () => { bytes = JSON.stringify(state); }, reload: () => JSON.parse(bytes) as DiscoveryState };
}
test("all observed candidates survive a 50-create cap and disappearing source listings; sources alternate", async () => {
  const f = store();
  const keys = [...Array.from({ length: 60 }, (_, i) => `den:${i}`), ...Array.from({ length: 60 }, (_, i) => `bee:${i}`)];
  await observeCandidates(f.state, keys, f.save);
  const processed: string[] = [];
  await processPendingBatch(f.state, { signal: signal(), save: f.save, process: async key => {
    processed.push(key); f.state.entries[key].done = "create"; await f.save(); return true;
  } });
  assert.equal(processed.length, 50);
  assert.equal(processed.filter(key => key.startsWith("bee:")).length, 25);
  const resumed = f.reload();
  assert.equal(fairPendingKeys(resumed).length, 70);
  assert.equal(await observeCandidates(resumed, [], async () => {}), 0);
  assert.ok(fairPendingKeys(resumed).includes("bee:59"));
});
test("crash before first processing and crash during processing retain every pending URL", async () => {
  const f = store(); await observeCandidates(f.state, ["den:new", "bee:new"], f.save);
  assert.deepEqual(fairPendingKeys(f.reload()), ["den:new", "bee:new"]);
  await assert.rejects(processPendingBatch(f.state, { signal: signal(), save: f.save, process: async () => { throw new Error("Simulated crash"); } }), /Simulated crash/);
  assert.deepEqual(fairPendingKeys(f.reload()), ["den:new", "bee:new"]);
});
test("exhausted 5xx, network and timeout requests exit 1 with one clear line and never spend resolution attempts", async () => {
  for (const failure of [async () => new Response("", { status: 503 }), async () => { throw new TypeError("Network down"); }, async () => { throw new DOMException("Timeout", "TimeoutError"); }]) {
    const f = store(); await observeCandidates(f.state, ["bee:article"], f.save);
    let calls = 0;
    const request = makeRequest(signal(), async () => { calls++; return failure(); }, async () => {});
    const lines: string[] = [];
    const code = await discoveryExitCode(() => processPendingBatch(f.state, { signal: signal(), save: f.save, process: async () => { await request("https://beebom.com/test-codes/"); return false; } }), line => lines.push(line));
    assert.equal(code, 1); assert.equal(lines.length, 1); assert.match(lines[0], /Operational request retries exhausted/);
    assert.equal(calls, 3); assert.equal(f.reload().entries["bee:article"].attempts, 0); assert.equal(f.reload().entries["bee:article"].done, undefined);
  }
});
test("one transient request blip gets a retry grace and exits 0 after recovery", async () => {
  let calls = 0;
  const request = makeRequest(signal(), async () => ++calls === 1 ? new Response("", { status: 503 }) : new Response("ok"), async () => {});
  assert.equal(await discoveryExitCode(async () => { assert.equal(await request("https://beebom.com/test-codes/"), "ok"); }), 0);
  assert.equal(calls, 2);
});
test("repeated exhausted operational requests stop the batch, preserving later candidates", async () => {
  const f = store(); await observeCandidates(f.state, ["bee:1", "bee:2", "bee:3"], f.save);
  let calls = 0;
  await assert.rejects(processPendingBatch(f.state, { signal: signal(), save: f.save, process: async () => { calls++; throw new OperationalDiscoveryError("offline"); } }), /Operational request retries exhausted/);
  assert.equal(calls, 2); assert.equal(fairPendingKeys(f.reload()).length, 3);
});
test("deadline at batch boundary exits 1 instead of silently succeeding", async () => {
  const f = store(); await observeCandidates(f.state, ["den:1", "bee:1"], f.save);
  const controller = new AbortController(); let calls = 0;
  const lines: string[] = [];
  assert.equal(await discoveryExitCode(() => processPendingBatch(f.state, { signal: controller.signal, save: f.save, process: async () => {
    calls++; controller.abort(new Error("whole-run deadline exceeded")); return false;
  } }), line => lines.push(line)), 1);
  assert.equal(calls, 1); assert.deepEqual(lines, ["Codes discovery failed: whole-run deadline exceeded"]);
  assert.equal(f.reload().entries["bee:1"].attempts, 0);
});
test("wrong pages and ambiguous names spend the bounded resolution budget, not operational budget", async () => {
  const f = store(); await observeCandidates(f.state, ["bee:missing"], f.save);
  for (let i = 0; i < 5; i++) {
    assert.equal(await discoveryExitCode(() => processPendingBatch(f.state, { signal: signal(), save: f.save, process: async () => { throw new ResolutionError("Unresolved game name"); } })), 0);
  }
  assert.equal(f.reload().entries["bee:missing"].attempts, 5); assert.deepEqual(fairPendingKeys(f.reload()), []);
  const request = makeRequest(signal(), async () => new Response("", { status: 404 }), async () => {});
  await assert.rejects(request("https://beebom.com/deleted-codes/"), ResolutionError);
});
test("uncertain Notion create reconciles on a later run without repeating POST or spending attempts", async () => {
  let accepted: any = null, creates = 0;
  const request = async () => JSON.stringify({ results: accepted ? [accepted] : [] });
  const create: typeof fetch = async (_url, init) => {
    creates++; accepted = { id: "created", properties: JSON.parse(String(init?.body)).properties };
    throw new Error("Response lost after acceptance");
  };
  const game = { universe_id: 1, root_place_id: 2, name: "Example" };
  const f = store(); await observeCandidates(f.state, ["bee:article"], f.save);
  await assert.rejects(processPendingBatch(f.state, { signal: signal(), save: f.save, process: async () => {
    await new CodesQueue(request, "mock", "source", "database", create).put(game, "Beebom", "article", false); return true;
  } }), FatalDiscoveryError);
  assert.equal(f.reload().entries["bee:article"].attempts, 0);
  const later = new CodesQueue(request, "mock", "source", "database", create);
  assert.equal(await later.put(game, "Beebom", "article", false), "already-queued");
  assert.equal(creates, 1);
});
