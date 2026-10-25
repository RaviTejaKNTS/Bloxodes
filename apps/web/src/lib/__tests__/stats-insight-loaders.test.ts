import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StatsGame } from "../stats";
import { DAY_MS, HOUR_MS } from "../stats-insights";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: mocks.from }) }));

type Query = { table: string; calls: Array<{ method: string; args: unknown[] }>; signal?: AbortSignal };
type Result = { data: any; error: unknown };
const queries: Query[] = [];
const now = Date.parse("2026-10-25T12:00:00Z");
const game = (extra: Partial<StatsGame> = {}) => ({
  universeId: 10, name: "Current", genre: "Survival", playing: 10000,
  lastPlayingRefreshedAt: new Date(Date.now()).toISOString(), ...extra
}) as StatsGame;

function database(result: (query: Query) => Result | Promise<Result>) {
  mocks.from.mockImplementation((table: string) => {
    const query: Query = { table, calls: [] };
    queries.push(query);
    const builder: object = new Proxy({}, {
      get: (_target, key) => key === "then"
        ? (resolve: (value: Result) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(result(query)).then(resolve, reject)
        : (...args: unknown[]) => {
          query.calls.push({ method: String(key), args });
          if (key === "abortSignal") query.signal = args[0] as AbortSignal;
          return builder;
        }
    });
    return builder;
  });
}
const selection = (query: Query) => query.calls.find(call => call.method === "select")?.args[0];
const empty = (query: Query): Result => ({
  data: query.calls.some(call => call.method === "maybeSingle") ? null : [], error: null
});

beforeEach(() => {
  vi.resetModules();
  mocks.from.mockReset();
  queries.length = 0;
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("optional insight deadlines", () => {
  it("bounds stalled game reads independently and preserves another card's result", async () => {
    database(query => query.table === "roblox_universe_gamepasses"
      ? { data: [{ pass_id: 1, name: "VIP", price: 99 }], error: null }
      : new Promise<Result>(() => undefined)); // Simulate transport ignoring abort.
    const { loadStatsGameInsights, INSIGHT_READ_TIMEOUT_MS } = await import("../stats-insight-loaders");
    let settled = false;
    const request = loadStatsGameInsights(game()).then(value => { settled = true; return value; });
    await vi.advanceTimersByTimeAsync(INSIGHT_READ_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const result = await request;
    expect(result).toMatchObject({ months: [], trackedSince: null, updates: [], scatter: null, badges: [] });
    expect(result.passes).toEqual([{ pass_id: 1, name: "VIP", price: 99 }]);
    expect(queries.length).toBeGreaterThan(8);
    expect(queries.every(query => query.signal instanceof AbortSignal && query.signal.aborted)).toBe(true);
  });

  it("passes the same bounded deadline to nested update-window and event-title reads", async () => {
    database(query => query.table === "roblox_universe_update_events" && selection(query) === "updated_at_api"
      ? { data: [{ updated_at_api: "2026-10-20T10:00:00Z" }], error: null }
      : ["roblox_universe_stats_hourly", "roblox_virtual_events"].includes(query.table)
        ? new Promise<Result>(() => undefined) : empty(query));
    const { loadStatsGameInsights, INSIGHT_READ_TIMEOUT_MS } = await import("../stats-insight-loaders");
    const request = loadStatsGameInsights(game({ genre: null }));
    await vi.advanceTimersByTimeAsync(INSIGHT_READ_TIMEOUT_MS);
    expect((await request).updates).toEqual([]);
    const windows = queries.filter(query => ["roblox_universe_stats_hourly", "roblox_virtual_events"].includes(query.table));
    expect(windows).toHaveLength(2);
    expect(windows.every(query => query.signal?.aborted)).toBe(true);
  });

  it("lets a stalled calendar hide independently of weekly movers", async () => {
    database(query => query.table === "roblox_platform_stats_daily" ? new Promise<Result>(() => undefined) : {
      data: [{ universe_id: 1, slug: "one", name: "One", playing: 6000, baseline_playing_7d: 2000, growth_7d_percent: 200 }], error: null
    });
    const { loadPlayersCalendar, loadWeeklyMovers, INSIGHT_READ_TIMEOUT_MS } = await import("../stats-insight-loaders");
    const calendar = loadPlayersCalendar();
    expect(await loadWeeklyMovers()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(INSIGHT_READ_TIMEOUT_MS);
    expect(await calendar).toEqual([]);
    expect(queries.every(query => query.signal instanceof AbortSignal && query.signal.aborted)).toBe(true);
  });
});

describe("insight query and cache contracts", () => {
  it("uses the genre key's precomputed count without any exact-count scan", async () => {
    database(query => {
      if (query.table === "stats_genre_current_index") return { data: { games: 4321 }, error: null };
      if (query.table === "stats_game_current_index") return {
        data: selection(query) === "genre_playing_rank,rating_percent,playing,name,display_name"
          ? { genre_playing_rank: 4, rating_percent: 90, playing: 10000, name: "Current" }
          : Array.from({ length: 10 }, (_, index) => ({ universe_id: index + 20, name: `Peer ${index}`, playing: 5000, rating_percent: 80 })),
        error: null
      };
      return empty(query);
    });
    const { loadStatsGameInsights } = await import("../stats-insight-loaders");
    expect((await loadStatsGameInsights(game())).scatter?.count).toBe(4321);
    const total = queries.find(query => query.table === "stats_genre_current_index")!;
    expect(total.calls).toContainEqual({ method: "eq", args: ["genre_slug", "survival"] });
    expect(total.calls).toContainEqual({ method: "limit", args: [1] });
    expect(queries.flatMap(query => query.calls).filter(call => call.method === "select").every(call => call.args.length === 1)).toBe(true);
  });

  it("filters unfinished updates before limiting the candidate events", async () => {
    database(empty);
    const { loadStatsGameInsights } = await import("../stats-insight-loaders");
    await loadStatsGameInsights(game({ genre: null }));
    const events = queries.find(query => query.table === "roblox_universe_update_events" && selection(query) === "updated_at_api")!;
    const cutoff = events.calls.findIndex(call => call.method === "lte" && call.args[0] === "updated_at_api");
    const limit = events.calls.findIndex(call => call.method === "limit");
    expect(cutoff).toBeGreaterThan(-1);
    expect(cutoff).toBeLessThan(limit);
    expect(events.calls[cutoff].args[1]).toBe(new Date(now - 48 * HOUR_MS).toISOString());
  });

  it("caches an empty first-date answer across requests", async () => {
    database(empty);
    const { loadStatsGameInsights } = await import("../stats-insight-loaders");
    expect((await loadStatsGameInsights(game({ genre: null }))).trackedSince).toBeNull();
    expect((await loadStatsGameInsights(game({ genre: null }))).trackedSince).toBeNull();
    expect(queries.filter(query => query.table === "roblox_universe_stats_daily" && selection(query) === "stat_date")).toHaveLength(1);
  });

  it("drops a cached badge as it crosses seven days even while refresh keeps failing", async () => {
    const badge = { badge_id: 1, name: "Winner", enabled: true, rarity_percent: .1, stats_updated_at: new Date(now - 7 * DAY_MS + 1000).toISOString() };
    let failed = false;
    database(query => query.table === "roblox_universe_badges"
      ? { data: failed ? null : [badge], error: failed ? new Error("refresh failed") : null } : empty(query));
    const { loadStatsGameInsights } = await import("../stats-insight-loaders");
    expect((await loadStatsGameInsights(game({ genre: null }))).badges).toEqual([badge]);
    vi.setSystemTime(now + 1001); // Still inside the five-minute cache TTL.
    expect((await loadStatsGameInsights(game({ genre: null }))).badges).toEqual([]);
    expect(queries.filter(query => query.table === "roblox_universe_badges")).toHaveLength(1);
    failed = true;
    vi.setSystemTime(now + 6 * 60_000);
    expect((await loadStatsGameInsights(game({ genre: null }))).badges).toEqual([]);
    await vi.advanceTimersByTimeAsync(0);
    vi.setSystemTime(now + DAY_MS);
    expect((await loadStatsGameInsights(game({ genre: null }))).badges).toEqual([]);
  });

  it("uses the platform chart's daily playing field instead of summed game peaks", async () => {
    database(() => ({ data: [{ stat_date: "2026-10-24", playing: 16000000, peak_players: 33900000, avg_players: "16000000.4" }], error: null }));
    const { loadPlayersCalendar } = await import("../stats-insight-loaders");
    const weeks = await loadPlayersCalendar();
    expect(weeks.flat().find(day => day.date === "2026-10-24")?.players).toBe(16000000);
    expect(selection(queries[0])).toBe("stat_date,playing");
  });
});
