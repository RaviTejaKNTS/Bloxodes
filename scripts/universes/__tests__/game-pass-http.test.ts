import assert from "node:assert/strict";
import test from "node:test";
import { createGamePassHttp, PassRefreshDeferredError } from "../game-pass-http";
import { refreshGamePasses } from "../game-passes";
import { runWikiGamePassRefresh } from "../refresh-wiki-game-passes";

function fakeClock() {
  let time = 0;
  const sleeps: number[] = [];
  return { now: () => time, sleeps, sleep: async (ms: number) => { sleeps.push(ms); await new Promise(resolve => setImmediate(resolve)); time += ms; } };
}
const json = (value: unknown) => new Response(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

test("request starts are globally spaced, including across concurrent workers", async () => {
  const clock = fakeClock();
  const starts: number[] = [];
  const http = createGamePassHttp({ ...clock, fetch: async () => { starts.push(clock.now()); return json({ ok: true }); } });
  await Promise.all(Array.from({ length: 5 }, () => http.fetchJson("https://api.test", "passes")));
  assert.deepEqual(starts, [0, 1000, 2000, 3000, 4000]);
});

test("repeated 429 responses honor Retry-After and stop after two retries", async () => {
  const clock = fakeClock();
  const starts: number[] = [];
  const http = createGamePassHttp({ ...clock, fetch: async () => {
    starts.push(clock.now());
    return starts.length <= 3 ? new Response("limited", { status: 429, headers: { "retry-after": "2" } }) : json({ ok: true });
  } });
  await assert.rejects(http.fetchJson("https://api.test", "passes"), /429/);
  assert.deepEqual(starts, [0, 2000, 4000]);
  assert.equal(http.shouldStop(), false);
  await http.fetchJson("https://api.test/another", "passes");
  assert.equal(starts[3], 6000); // Final 429 also protects the next universe.
});

test("real attempt aborts and retries fit the 45-second request deadline", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let time = 0;
  const starts: number[] = [];
  const signals: AbortSignal[] = [];
  const http = createGamePassHttp({ now: () => time, fetch: async (_url, init) => {
    starts.push(time);
    const signal = init!.signal!;
    signals.push(signal);
    return new Promise<Response>((_resolve, reject) => { signal.addEventListener("abort", () => reject(signal.reason), { once: true }); });
  } });
  const rejected = assert.rejects(http.fetchJson("https://api.test", "passes"), PassRefreshDeferredError);
  await flush();
  for (const step of [15000, 1000, 15000, 2000, 12000]) {
    time += step;
    t.mock.timers.tick(step);
    await flush();
  }
  await rejected;
  assert.deepEqual(starts, [0, 16000, 33000]);
  assert.ok(signals.every(signal => signal.aborted));
  assert.equal(time, 45000);
  assert.equal(http.shouldStop(), false); // Request budget does not change other enrichment or the run deadline.
});

for (const retryAfter of ["600", new Date(600_000).toUTCString()]) {
  test(`Retry-After ${retryAfter} beyond the budget defers immediately without more requests`, async () => {
    const clock = fakeClock();
    let requests = 0;
    const http = createGamePassHttp({ ...clock, runBudgetMs: 5000, fetch: async () => {
      requests++;
      return new Response("limited", { status: 429, headers: { "retry-after": retryAfter } });
    } });
    await assert.rejects(http.fetchJson("https://api.test", "passes"), /Retry-After exceeds budget/);
    await assert.rejects(http.fetchJson("https://api.test/another", "passes"), PassRefreshDeferredError);
    assert.equal(http.shouldStop(), true);
    assert.equal(http.stoppedReason, "retry_after_exceeds_budget");
    assert.equal(requests, 1);
    assert.deepEqual(clock.sleeps, []);
  });
}

test("exhausted run stops scheduling universes and reports every unfinished ID as deferred", async () => {
  const clock = fakeClock();
  const starts: number[] = [];
  const http = createGamePassHttp({ ...clock, runBudgetMs: 2500, fetch: async () => {
    starts.push(clock.now()); return json({ gamePasses: [] });
  } });
  const db = { from() { throw new Error("Expired run must not start saves"); } } as unknown as Parameters<typeof refreshGamePasses>[0];
  const ids = Array.from({ length: 41 }, (_, i) => i + 1);
  const result = await refreshGamePasses(db, ids, http.fetchJson, { shouldStop: http.shouldStop });
  assert.deepEqual(starts, [0, 1000, 2000]);
  assert.deepEqual(result.refreshed, []);
  assert.deepEqual(result.failed, []);
  assert.deepEqual(result.deferred.sort((a, b) => a - b), ids);
  assert.equal(http.shouldStop(), true);
  assert.ok(clock.now() < 2500);
});

function wikiDatabase(ids: number[], error = false) {
  return { from(table: string) {
    assert.equal(table, "wiki_pages");
    let after = "";
    const chain: any = {
      select() { return chain; }, eq() { return chain; }, not() { return chain; },
      gt(_key: string, value: string) { after = value; return chain; }, order() { return chain; }, limit() { return chain; },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve({
        data: after ? [] : ids.map(id => ({ slug: `wiki-${id}`, universe_id: id })), error: error ? new Error("enumeration failed") : null
      }).then(resolve); }
    }; return chain;
  } } as unknown as Parameters<typeof refreshGamePasses>[0];
}

test("deadline/long Retry-After outcomes finish the ledger and always release the lease", async () => {
  const clock = fakeClock();
  const events: string[] = [];
  let finish: any;
  const http = createGamePassHttp({ ...clock, runBudgetMs: 5000, fetch: async () => new Response("limited", { status: 429, headers: { "retry-after": "600" } }) });
  const result = await runWikiGamePassRefresh({
    database: () => wikiDatabase([1, 2, 3]), http: () => http,
    claimLease: async input => { assert.equal(input.leaseMinutes, 15); events.push("claim"); return true; },
    releaseLease: async () => { events.push("release"); },
    startRun: async () => { events.push("start"); return { id: "run", jobName: "test", startedAt: "now", metadata: {} }; },
    finishRun: async (_run, input) => { events.push("finish"); finish = input; }
  });
  assert.deepEqual(result?.deferred.sort(), [1, 2, 3]);
  assert.deepEqual(events, ["claim", "start", "finish", "release"]);
  assert.equal(finish.status, "partial");
  assert.equal(finish.rowsFailed, 3);
  assert.deepEqual(finish.metadata.deferred_universe_ids.sort(), [1, 2, 3]);
  assert.equal(finish.metadata.stopped_reason, "retry_after_exceeds_budget");
});

test("lease releases if ledger startup or target enumeration throws", async () => {
  for (const failStart of [false, true]) {
    let released = false;
    await assert.rejects(runWikiGamePassRefresh({
      database: () => wikiDatabase([], true), http: () => createGamePassHttp(),
      claimLease: async () => true, releaseLease: async () => { released = true; },
      startRun: async () => {
        if (failStart) throw new Error("start failed");
        return { id: "run", jobName: "test", startedAt: "now", metadata: {} };
      }, finishRun: async () => {}
    }), /failed/);
    assert.equal(released, true);
  }
});


test("a queued worker rechecks Retry-After received while it was waiting for spacing", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let time = 0;
  const starts: number[] = [];
  const http = createGamePassHttp({ now: () => time, fetch: async () => {
    starts.push(time);
    return starts.length === 1 ? new Response("limited", { status: 429, headers: { "retry-after": "5" } }) : json({ ok: true });
  } });
  const results = Promise.all([http.fetchJson("https://api.test/1", "passes"), http.fetchJson("https://api.test/2", "passes")]);
  await flush();
  time = 1000; t.mock.timers.tick(1000); await flush();
  assert.deepEqual(starts, [0]);
  time = 5000; t.mock.timers.tick(4000); await flush();
  assert.deepEqual(starts, [0, 5000]);
  time = 6000; t.mock.timers.tick(1000); await flush();
  await results;
  assert.deepEqual(starts, [0, 5000, 6000]);
});

test("hard request budget counts retries and concurrent starts", async () => {
  const clock = fakeClock();
  let starts = 0;
  const http = createGamePassHttp({ ...clock, maxRequests: 3, fetch: async () => {
    starts++;
    return json({ ok: true });
  } });
  const result = await Promise.allSettled(Array.from({ length: 6 }, () => http.fetchJson('https://api.test', 'attachments')));
  assert.equal(starts, 3);
  assert.equal(http.requestCount, 3);
  assert.equal(http.stoppedReason, 'request_budget');
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 3);
  assert.equal(result.filter(r => r.status === 'rejected').length, 3);
  const retry = createGamePassHttp({ ...fakeClock(), maxRequests: 2, fetch: async () => new Response('retry', { status: 500 }) });
  await assert.rejects(retry.fetchJson('https://api.test', 'attachments'), PassRefreshDeferredError);
  assert.equal(retry.requestCount, 2);
});
