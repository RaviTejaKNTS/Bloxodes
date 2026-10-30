import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: mocks.from, rpc: mocks.rpc }) }));

import { listStatsGames } from "@/lib/stats";

function query(result: { data: unknown; error: unknown; count?: number | null }, onOr?: (filter: string) => void) {
  const builder: object = new Proxy({}, {
    get: (_target, key) => key === "then"
      ? (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve)
      : (...args: unknown[]) => {
        if (key === "or") onOr?.(args[0] as string);
        return builder;
      }
  });
  return builder;
}

const pastLastPage = {
  code: "PGRST103",
  details: "An offset of 4050 was requested, but there are only 3836 rows.",
  message: "Requested range not satisfiable"
};

beforeEach(() => {
  mocks.from.mockReset();
  mocks.rpc.mockReset();
  mocks.rpc.mockResolvedValue({ data: [], error: null });
});

describe("stats games pagination", () => {
  it("returns an empty page with the real total for a page past the last row", async () => {
    mocks.from.mockImplementation((table: string) =>
      table === "stats_game_current_index"
        ? query({ data: null, error: pastLastPage, count: null })
        : query({ data: [], error: null })
    );
    const data = await listStatsGames({ page: 82 });
    expect(data).toMatchObject({ games: [], total: 3836, totalPages: 77 });
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain("roblox_universes");
  });

  it("still fails on a real database error", async () => {
    const timeout = { code: "57014", message: "canceling statement due to statement timeout" };
    mocks.from.mockImplementation((table: string) =>
      table === "stats_game_current_index" || table === "roblox_universes"
        ? query({ data: null, error: timeout })
        : query({ data: [], error: null })
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(listStatsGames({ page: 2 })).rejects.toMatchObject({ code: "57014" });
  });
});

describe("stats games search quoting", () => {
  it.each([false, true])("protects scanner text in the index and fallback (fallback=%s)", async (fallback) => {
    const filters: string[] = [];
    let indexCalls = 0;
    mocks.from.mockImplementation((table: string) => query(
      table === "stats_game_current_index" && fallback
        ? { data: null, error: { code: "42P01", message: "missing index" } }
        : { data: table === "stats_game_current_index" && ++indexCalls > 1 ? [{ universe_id: 1 }] : [], error: null, count: 0 },
      (filter) => filters.push(filter)
    ));
    const data = await listStatsGames({ q: "1' UNION ALL SELECT (1,2)-- fd4nou" });
    expect(data.games).toEqual([]);
    const quoted = '"%1\' UNION ALL SELECT (1,2)-- fd4nou%"';
    const expected = `name.ilike.${quoted},display_name.ilike.${quoted},creator_name.ilike.${quoted}`;
    expect(filters).toEqual(fallback ? [expected, expected] : [expected]);
  });
});
