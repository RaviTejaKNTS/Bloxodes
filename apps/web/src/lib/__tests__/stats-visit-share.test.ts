import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => mocks }));

const rows = [
  { key: "g1", name: "Game One", rankStart: 1, rankEnd: 1, visits: 400, universeId: "1" },
  { key: "rank_9_100", name: "Ranks 9-100", rankStart: 9, rankEnd: 100, visits: 300, universeId: null },
  { key: "rank_101_1000", name: "Ranks 101-1000", rankStart: 101, rankEnd: 1000, visits: 200, universeId: null },
  { key: "other_tracked", name: "Other tracked games", rankStart: 1001, rankEnd: 1200, visits: 100, universeId: null }
].map((bucket) => ({
  stat_date: "2026-10-24",
  bucket_key: bucket.key,
  bucket_name: bucket.name,
  universe_id: bucket.universeId,
  slug: bucket.universeId ? "game-one" : null,
  icon_url: bucket.universeId ? "https://example.com/game.png" : null,
  bucket_rank_start: String(bucket.rankStart),
  bucket_rank_end: String(bucket.rankEnd),
  is_group: bucket.universeId === null,
  visit_delta: String(bucket.visits),
  denominator_visit_delta: "1000",
  denominator_game_count: "1200"
}));

beforeEach(() => {
  vi.resetModules();
  mocks.rpc.mockReset();
  mocks.from.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-25T01:30:00Z"));
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("prepared visit-share results", () => {
  it.each([
    ["1d", "2026-10-24"],
    ["7d", "2026-10-18"],
    ["14d", "2026-10-11"],
    ["30d", "2026-09-25"],
    ["90d", "2026-07-27"]
  ] as const)("loads %s with the same RPC arguments and complete denominator", async (range, since) => {
    const { getStatsVisitShareChart } = await import("@/lib/stats-visit-share");
    mocks.rpc.mockResolvedValue({ data: rows, error: null });
    const [chart, concurrent] = await Promise.all([getStatsVisitShareChart(range), getStatsVisitShareChart(range)]);
    expect(concurrent).toBe(chart);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_stats_visit_share_chart", {
      p_since: since, p_until: "2026-10-25", p_top_games: 8, p_top_group: 100, p_wide_group: 1000
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(chart.unavailable).toBeUndefined();
    expect(chart.totalVisits).toBe(1000);
    expect(chart.denominatorGameCount).toBe(1200);
    expect(chart.visibleGameCount).toBe(1);
    expect(chart.series.map((series) => series.sharePercent)).toEqual([40, 30, 20, 10]);
    expect(chart.series[chart.series.length - 1]).toMatchObject({ isOther: true, rankStart: 1001, rankEnd: 1200 });
    expect(chart.points[0]).toMatchObject({
      totalVisits: 1000,
      visits: { g1: 400, rank_9_100: 300, rank_101_1000: 200, other_tracked: 100 },
      shares: { g1: 40, rank_9_100: 30, rank_101_1000: 20, other_tracked: 10 }
    });
  });

  it("treats an unwarmed summary as unavailable and preserves a later last-good result", async () => {
    const { getStatsVisitShareChart } = await import("@/lib/stats-visit-share");
    const notReady = { code: "55000", message: "Visit-share summary is not ready" };
    mocks.rpc.mockResolvedValueOnce({ data: null, error: notReady });
    await expect(getStatsVisitShareChart("90d")).resolves.toMatchObject({ unavailable: true, points: [] });
    mocks.rpc.mockResolvedValueOnce({ data: rows, error: null });
    const good = await getStatsVisitShareChart("90d");
    expect(good.unavailable).toBeUndefined();
    vi.setSystemTime(new Date("2026-10-25T01:36:00Z"));
    mocks.rpc.mockResolvedValue({ data: null, error: notReady });
    await expect(getStatsVisitShareChart("90d")).resolves.toBe(good);
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(3));
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
