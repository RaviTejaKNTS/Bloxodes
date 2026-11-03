import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ empty: false, failure: "", manyGames: false,
  queries: [] as Array<{ table: string; filters: Record<string, unknown>; ranges: number[] }> }));
vi.mock("server-only", () => ({}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), cache: (fn: unknown) => fn }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from(table: string) {
  const filters: Record<string, unknown> = {};
  const ranges: number[] = [];
  state.queries.push({ table, filters, ranges });
  const query = {
    select: () => query, eq: (key: string, value: unknown) => { filters[key] = value; return query; },
    in: (key: string, value: unknown) => { filters[key] = value; return query; }, order: () => query,
    or: (value: string) => { filters.or = value; return query; },
    lte: (key: string, value: string) => { filters[`${key}.lte`] = value; return query; },
    range: async (start: number, end: number) => {
      ranges.push(start, end);
      const rows = table === "games"
        ? Array.from({ length: state.manyGames ? 1003 : 1 }, (_, id) => ({ id: String(id), namespace: `game-${id}`, parent_id: null }))
        : Array.from({ length: 503 }, (_, id) => ({ id: String(id), title: `Map ${id}`, canonical_path: `/maps/peak-${id}` }));
      return { data: state.empty ? [] : rows.slice(start, end + 1), error: state.failure === table ? { message: "private detail" } : null };
    }
  };
  return query;
} }) }));
import MapsPage from "@/app/(site)/maps/page";
import { OtherGamesSection } from "@/components/games/OtherGamesSection";
import { listMovedGamePages } from "../moved-game-pages";
beforeEach(() => { state.empty = false; state.failure = ""; state.manyGames = false; state.queries.length = 0; });
it("maps index dispatches to the game map directory", () => {
  const page = MapsPage();
  expect(page.props.children[1].type).toBe(OtherGamesSection);
  expect(page.props.children[1].props.kind).toBe("map");
});
it("directories read published saved paths beyond the first database page", async () => {
  const pages = await listMovedGamePages("map");
  expect(pages).toHaveLength(503);
  expect(pages.some(page => page.canonical_path === "/maps/peak-502")).toBe(true);
  expect(state.queries[0].filters).toMatchObject({ url_style: "page_type", is_published: true });
  expect(state.queries[0].filters.or).toContain("published_at.lte.");
  expect(state.queries[1].filters.is_published).toBe(true);
  expect(state.queries[1].filters.or).toContain("published_at.is.null");
});
it("paginates the game inventory and bounds owner filters", async () => {
  state.manyGames = true;
  await listMovedGamePages("map");
  expect(state.queries.filter(q => q.table === "games").map(q => q.ranges[0])).toEqual([0, 500, 1000]);
  for (const query of state.queries.filter(q => q.table !== "games")) expect((query.filters.game_id as string[]).length).toBeLessThanOrEqual(200);
});
it.each(["catalog", "checklist"])("supports published %s pages", async kind => {
  await listMovedGamePages(kind);
  const filters = state.queries.find(q => q.table === `game_${kind}_pages_view`)!.filters;
  expect(filters[kind === "checklist" ? "is_public" : "is_published"]).toBe(true);
  if (kind === "checklist") expect(filters["published_at.lte"]).toBeTruthy();
});
it.each(["games", "game_map_pages_view"])("directory failure in %s leaves the index usable", async table => {
  state.failure = table;
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(await OtherGamesSection({ kind: "map" })).toBeNull();
    expect(log).toHaveBeenCalledWith("[game-directories] Published game directory unavailable.");
  } finally { log.mockRestore(); }
});
it("empty maps index remains a valid empty directory", async () => {
  state.empty = true;
  expect(await OtherGamesSection({ kind: "map" })).toBeNull();
});
