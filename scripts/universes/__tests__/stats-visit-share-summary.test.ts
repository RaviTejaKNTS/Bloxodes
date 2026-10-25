import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  refreshVisitShareSummaries,
  VisitShareSummaryBuilder,
  type VisitShareRpc,
  type VisitShareSourceGame
} from "../stats-visit-share-summary";
import { runPlatformRefreshSteps } from "../refresh-platform-stats";

const now = new Date("2026-10-25T01:05:00Z");
const noSleep = async () => {};
const windowFor = (builder: VisitShareSummaryBuilder, since = "2026-10-18", until = "2026-10-25") =>
  builder.build().find((window) => window.since_date === since && window.until_date === until)!;

test("window ranking retains a consistent game that never wins a single day", () => {
  const builder = new VisitShareSummaryBuilder("2026-10-25");
  const games = Array.from({ length: 1001 }, (_, index) => ({
    universe_id: String(index + 1), visits: { "2026-10-24": "100", "2026-10-25": "1" }
  }));
  // A daily top-1000 prune would drop this game on Oct 24, but its full-window
  // total puts it first. The same example also exercises batch eviction.
  builder.addBatch(games);
  builder.addBatch([{ universe_id: "1002", visits: { "2026-10-24": "99", "2026-10-25": "99" } }]);
  const rows = windowFor(builder).rows;
  assert.equal(rows.find((row) => row.bucket_rank_start === 1)?.universe_id, "1002");
  const day = rows.filter((row) => row.stat_date === "2026-10-24");
  assert.equal(day.find((row) => row.bucket_key === "rank_9_100")?.visit_delta, "9200");
  assert.equal(day.find((row) => row.bucket_key === "rank_101_1000")?.visit_delta, "90000");
  assert.equal(day.find((row) => row.bucket_key === "other_tracked")?.visit_delta, "200");
  assert.equal(day[0].denominator_game_count, 1002);
  assert.equal(day[0].denominator_visit_delta, "100199");
  assert.equal(day.reduce((sum, row) => sum + BigInt(row.visit_delta), 0n), 100199n);
});

test("bigint visits and numeric universe-ID tie breaks survive JSON exactly", () => {
  const builder = new VisitShareSummaryBuilder("2026-10-25");
  builder.addBatch([
    { universe_id: "9007199254740993", visits: { "2026-10-25": "9007199254740993" } },
    { universe_id: "10", visits: { "2026-10-25": "9007199254740993" } },
    { universe_id: "2", visits: { "2026-10-25": "9007199254740993" } }
  ]);
  const rows = windowFor(builder).rows;
  assert.deepEqual(rows.map((row) => row.universe_id), ["2", "10", "9007199254740993"]);
  assert.equal(rows[0].denominator_visit_delta, "27021597764222979");
  assert.equal(JSON.parse(JSON.stringify(rows))[0].visit_delta, "9007199254740993");
});

test("date bounds stay inclusive and tomorrow gets its own shifted ranking", () => {
  const builder = new VisitShareSummaryBuilder("2026-10-25");
  builder.addBatch([
    { universe_id: "1", visits: { "2026-10-18": "1000", "2026-10-25": "1" } },
    { universe_id: "2", visits: { "2026-10-19": "10", "2026-10-24": "2", "2026-10-25": "3" } }
  ]);
  const today = windowFor(builder).rows;
  assert.equal(today.find((row) => row.stat_date === "2026-10-18")?.visit_delta, "1000");
  assert.equal(today.find((row) => row.stat_date === "2026-10-25" && row.universe_id === "1")?.bucket_rank_start, 1);
  const tomorrow = windowFor(builder, "2026-10-19", "2026-10-26").rows;
  assert.equal(tomorrow.some((row) => row.stat_date === "2026-10-18"), false);
  assert.equal(tomorrow.find((row) => row.stat_date === "2026-10-25" && row.universe_id === "2")?.bucket_rank_start, 1);
  const oneDay = windowFor(builder, "2026-10-24").rows;
  assert.deepEqual([...new Set(oneDay.map((row) => row.stat_date))], ["2026-10-24", "2026-10-25"]);
});

test("an empty source still produces ten complete empty window markers", () => {
  const windows = new VisitShareSummaryBuilder("2026-10-25").build();
  assert.equal(windows.length, 10);
  assert.ok(windows.every((window) => window.rows.length === 0));
});

test("refresh consumes a short nonterminal page and only publishes after an explicit end", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const rpc: VisitShareRpc = async (name, args) => {
    calls.push({ name, args });
    if (name === "replace_stats_visit_share_summaries") {
      assert.equal(calls.length, 4);
      assert.equal((args.p_windows as unknown[]).length, 10);
      return { data: 10, error: null };
    }
    const id = calls.length === 1 ? "1" : calls.length === 2 ? "2" : null;
    return { data: { next_after: id, games: id ? [{ universe_id: id, visits: { "2026-10-24": "5" } }] : [] }, error: null };
  };
  const result = await refreshVisitShareSummaries(rpc, now);
  assert.equal(result.sourceGames, 2);
  assert.deepEqual(calls.slice(0, 3).map((call) => call.args.p_after_universe_id), ["0", "1", "2"]);
  assert.equal(calls[0].args.p_since, "2026-07-27");
  assert.equal(calls[0].args.p_until, "2026-10-26");
});

test("a timed-out batch shrinks and retries the same cursor without double counting", async () => {
  const calls: Record<string, unknown>[] = [];
  const rpc: VisitShareRpc = async (name, args) => {
    if (name === "replace_stats_visit_share_summaries") {
      const windows = args.p_windows as ReturnType<VisitShareSummaryBuilder["build"]>;
      assert.ok(windows.flatMap((window) => window.rows).every((row) => row.denominator_visit_delta === "5"));
      return { data: 10, error: null };
    }
    calls.push(args);
    if (calls.length === 1) return { data: null, error: { code: "57014", message: "statement timeout" } };
    const games: VisitShareSourceGame[] = calls.length === 2 ? [{ universe_id: "1", visits: { "2026-10-24": "5" } }] : [];
    return { data: { next_after: games.length ? "1" : null, games }, error: null };
  };
  await refreshVisitShareSummaries(rpc, now, { sleep: noSleep });
  assert.deepEqual(calls.map((args) => [args.p_after_universe_id, args.p_limit]), [["0", 250], ["0", 125], ["1", 125]]);
});

test("failed, truncated, or duplicate source pages never publish partial charts", async () => {
  for (const response of [
    { data: null, error: { code: "42501", message: "permission denied" } },
    { data: { next_after: "2", games: [{ universe_id: "1", visits: {} }] }, error: null },
    { data: { next_after: "1", games: [{ universe_id: "1", visits: {} }, { universe_id: "1", visits: {} }] }, error: null }
  ]) {
    const names: string[] = [];
    await assert.rejects(refreshVisitShareSummaries(async (name) => {
      names.push(name);
      return response;
    }, now));
    assert.deepEqual(names, ["get_stats_visit_share_source_batch"]);
  }
});

test("retry exhaustion is bounded and keeps the previous published charts", async () => {
  let calls = 0;
  await assert.rejects(refreshVisitShareSummaries(async (name) => {
    assert.equal(name, "get_stats_visit_share_source_batch");
    calls += 1;
    return { data: null, error: { code: "57014", message: "statement timeout" } };
  }, now, { sleep: noSleep }), /statement timeout/);
  assert.equal(calls, 4);
});

test("publication failures propagate and an older publisher reports no replaced rows", async () => {
  for (const fail of [false, true]) {
    const refresh = refreshVisitShareSummaries(async (name) => {
      if (name === "get_stats_visit_share_source_batch") return { data: { next_after: null, games: [] }, error: null };
      return fail ? { data: null, error: { message: "publication failed" } } : { data: 0, error: null };
    }, now);
    if (fail) await assert.rejects(refresh, /publication failed/);
    else assert.deepEqual(await refresh, { windows: 0, rows: 0, sourceGames: 0 });
  }
});

test("a failed daily player summary still runs visit-share and reports failure", async () => {
  const ran: string[] = [];
  await assert.rejects(runPlatformRefreshSteps([
    { name: "hourly", run: async () => { ran.push("hourly"); } },
    { name: "daily", run: async () => { ran.push("daily"); throw new Error("statement timeout"); } },
    { name: "visit-share", run: async () => { ran.push("visit-share"); } }
  ]), AggregateError);
  assert.deepEqual(ran, ["hourly", "daily", "visit-share"]);
});

test("the frequent platform job skips visit-share and the nightly job refreshes it", () => {
  const cron = readFileSync(new URL("../../ops/vps-scheduled-automation.crontab", import.meta.url), "utf8");
  const lines = cron.split("\n").filter((line) => !line.startsWith("#"));
  assert.match(lines.find((line) => line.includes(" stats-platform-hourly-refresh "))!, /^\*\/5 .*--skip-daily/);
  const nightly = lines.find((line) => line.includes(" stats-platform-refresh "))!;
  assert.match(nightly, /^5 1 /);
  assert.doesNotMatch(nightly, /--skip-daily/);
});
