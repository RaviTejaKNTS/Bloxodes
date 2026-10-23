import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadWikiRelatedData, type WikiPageContent } from "../wiki";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  getEventsPageByUniverseId: async () => null,
  listCodesForCodePage: async () => [],
  listCodePagesWithActiveCountsByUniverseId: async () => [],
  listPublishedArticlesByUniverseId: async () => [],
  listPublishedChecklistsByUniverseId: async () => []
}));
vi.mock("@/lib/tools", () => ({ listPublishedToolsByUniverseId: async () => [] }));
vi.mock("@/lib/wiki-collections", () => ({
  listPublishedWikiCollectionPagesByUniverseId: async () => [],
  listPublishedWikiCollectionPagesByWikiSlug: async () => []
}));
vi.mock("@/lib/events-summary", () => ({
  getUniverseEventSummary: async () => null,
  listUniverseEventTimeline: async () => []
}));
type Row = Record<string, unknown>;
interface QueryChain {
  select(): QueryChain;
  eq(column: string, value: unknown): QueryChain;
  neq(column: string, value: unknown): QueryChain;
  or(): QueryChain;
  order(column: string, options: { ascending: boolean }): QueryChain;
  limit(value: number): QueryChain;
  then(resolve: (value: unknown) => unknown): Promise<unknown>;
}
const mocks = vi.hoisted(() => ({ tables: {} as Record<string, Row[]> }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from(table: string) {
  let rows = [...(mocks.tables[table] ?? [])];
  const chain: QueryChain = {
    select() { return chain; },
    eq(column: string, value: unknown) { rows = rows.filter(row => row[column] === value); return chain; },
    neq(column: string, value: unknown) { rows = rows.filter(row => row[column] !== value); return chain; },
    or() { return chain; },
    order(column: string, options: { ascending: boolean }) { rows.sort((a, b) => options.ascending ? Number(a[column]) - Number(b[column]) : Number(b[column]) - Number(a[column])); return chain; },
    limit(value: number) { rows = rows.slice(0, value); return chain; },
    then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: rows, error: null }).then(resolve); }
  }; return chain;
} }) }));
beforeEach(() => { mocks.tables = {}; });
const page = { id: "wiki", slug: "example", title: "Example", is_published: true, universe_id: 10, universe_creator_id: 1 } as WikiPageContent;

describe("wiki related data shared by the website and mobile", () => {
  it("filters off-sale/unknown passes before filling the eight slots and keeps numeric prices", async () => {
    mocks.tables.roblox_universe_gamepasses = [
      ...Array.from({ length: 8 }, (_, id) => ({ pass_id: id, universe_id: 10, is_for_sale: false, price: 1 })),
      { pass_id: 11, universe_id: 10, is_for_sale: true, price: 799 },
      { pass_id: 12, universe_id: 10, is_for_sale: true, price: 0 },
      { pass_id: 13, universe_id: 10, is_for_sale: null, price: 1 },
      { pass_id: 14, universe_id: 20, is_for_sale: true, price: 1 }
    ];
    const result = await loadWikiRelatedData(page);
    expect(result.gamePasses.map(pass => [pass.pass_id, pass.price])).toEqual([[12, 0], [11, 799]]);
  });
  it("returns an empty section input when no passes are on sale", async () => {
    mocks.tables.roblox_universe_gamepasses = [{ pass_id: 1, universe_id: 10, is_for_sale: false }];
    expect((await loadWikiRelatedData(page)).gamePasses).toEqual([]);
  });
  it("excludes tiny developer games and stale positive player counts", async () => {
    const fresh = new Date().toISOString();
    mocks.tables.roblox_universes = [
      { universe_id: 11, creator_id: 1, playing: 0, visits: 54, last_playing_refreshed_at: fresh },
      { universe_id: 12, creator_id: 1, playing: 10, visits: 55, last_playing_refreshed_at: "2020-01-01" },
      { universe_id: 13, creator_id: 1, playing: 1, visits: 56, last_playing_refreshed_at: fresh },
      { universe_id: 14, creator_id: 1, playing: 0, visits: 100_000, last_playing_refreshed_at: fresh }
    ];
    expect((await loadWikiRelatedData(page)).developerGames.map(game => game.universe_id)).toEqual([14, 13]);
  });
});
