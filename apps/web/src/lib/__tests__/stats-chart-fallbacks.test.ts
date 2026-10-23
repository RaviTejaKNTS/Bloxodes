import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: mocks.from, rpc: mocks.rpc }) }));

import { getStatsPlatformChart } from "@/lib/stats";
import { getStatsVisitShareChart } from "@/lib/stats-visit-share";

const timeout = { code: "57014", message: "canceling statement due to statement timeout" };

function query(result: { data: unknown; error: unknown }) {
  const builder: object = new Proxy({}, {
    get: (_target, key) => key === "then"
      ? (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve)
      : () => builder
  });
  return builder;
}

const visitShareRow = (date: string, key: string, visits: number) => ({
  stat_date: date,
  bucket_key: key,
  bucket_name: key === "g1" ? "Game One" : "Ranks 2-100",
  universe_id: key === "g1" ? 1 : null,
  slug: key === "g1" ? "game-one" : null,
  icon_url: null,
  bucket_rank_start: key === "g1" ? 1 : 2,
  bucket_rank_end: key === "g1" ? 1 : 100,
  is_group: key !== "g1",
  visit_delta: visits,
  denominator_visit_delta: 1000,
  denominator_game_count: 500
});

beforeEach(() => {
  mocks.from.mockReset();
  mocks.rpc.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("platform chart", () => {
  it("does not fan out to per-game history when the stored summary fails", async () => {
    mocks.from.mockImplementation(() => query({ data: null, error: timeout }));
    const chart = await getStatsPlatformChart("30d", "daily");
    expect(chart).toMatchObject({ range: "30d", points: [], unavailable: true });
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["roblox_platform_stats_daily"]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("makes one live call for the 24-hour chart and nothing else when it times out", async () => {
    mocks.from.mockImplementation(() => query({ data: [], error: null }));
    mocks.rpc.mockResolvedValue({ data: null, error: timeout });
    const chart = await getStatsPlatformChart("1d", "hourly");
    expect(chart.unavailable).toBe(true);
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["roblox_platform_stats_hourly"]);
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["get_stats_platform_ccu_trend"]);
  });

  it("reads the stored summary once per cache window", async () => {
    mocks.from.mockImplementation(() =>
      query({ data: [{ stat_date: "2026-10-20", playing: 100, samples: 1 }], error: null })
    );
    const [first, second] = await Promise.all([getStatsPlatformChart("90d", "daily"), getStatsPlatformChart("90d", "daily")]);
    expect(first.points).toHaveLength(1);
    expect(second).toBe(first);
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
});

describe("visit-share chart", () => {
  it("never rebuilds the chart from a smaller set of games", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: timeout });
    const chart = await getStatsVisitShareChart("90d");
    expect(chart).toMatchObject({ range: "90d", points: [], series: [], unavailable: true });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("serves the last good chart when a later calculation times out", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-24T00:00:00Z"));
    mocks.rpc.mockResolvedValueOnce({
      data: [
        visitShareRow("2026-10-22", "g1", 400),
        visitShareRow("2026-10-22", "rank_2_100", 300),
        visitShareRow("2026-10-23", "g1", 500),
        visitShareRow("2026-10-23", "rank_2_100", 200)
      ],
      error: null
    });
    const good = await getStatsVisitShareChart("7d");
    expect(good.unavailable).toBeUndefined();
    expect(good.points).toHaveLength(2);
    expect(good.denominatorGameCount).toBe(500);

    vi.setSystemTime(new Date("2026-10-24T00:06:00Z"));
    mocks.rpc.mockResolvedValue({ data: null, error: timeout });
    await expect(getStatsVisitShareChart("7d")).resolves.toBe(good);
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(2));
    await expect(getStatsVisitShareChart("7d")).resolves.toBe(good);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
