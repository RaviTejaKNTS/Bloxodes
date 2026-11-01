import { beforeEach, describe, expect, it, vi } from "vitest";
import { cacheTagsForPath } from "../public-cache-tags";

const state = vi.hoisted(() => ({ dependents: false, pages: 83, namespace: "risk-of-rain", queries: [] as Array<{ table: string; filters: Record<string, unknown> }> }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/shared-game-reader", () => ({ createGameReader: () => ({ getPublishedSharedGameWikiCollectionRuntime: async () => ({ config: {}, document: {} }) }) }));
vi.mock("@/app/(site)/wiki/collections/games/generic", () => ({ prepareGameCollectionDocument: () => ({ totalPages: state.pages }) }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from(table: string) {
  const filters: Record<string, unknown> = {};
  state.queries.push({ table, filters });
  const root = { id: "root", namespace: state.namespace, parent_id: null, url_style: "page_type" };
  const child = { ...root, id: "child", parent_id: "root" };
  const routes = [
    { source: "game", game_id: "child", page_type: "collection", page_id: "items", path: "/wiki/risk-of-rain-2/items", status: "live" },
    { source: "game", game_id: "child", page_type: "collection", page_id: "items", path: "/risk-of-rain/wiki/second/items", status: "old" },
    { source: "game", game_id: "child", page_type: "tool", page_id: "tool", path: "/tools/risk-of-rain-cost", status: "live" },
    { source: "game", game_id: "root", page_type: "wiki", page_id: "root-wiki", path: "/games/risk-of-rain", status: "live" },
    { source: "game", game_id: "root", page_type: "hub", page_id: "root", path: `/${state.namespace}`, status: "live" }
  ];
  const all: Record<string, Array<Record<string, unknown>>> = {
    games: [root, child], site_routes: routes,
    game_map_pages: state.dependents ? [{id: "sibling-map", namespace: state.namespace, game_id: "sibling", canonical_path: "/maps/sibling-map"}] : [],
    game_tool_pages: state.dependents ? [{id: "root-tool", namespace: state.namespace, game_id: "root", canonical_path: "/tools/root-tool"}] : [],
    game_wiki_pages: [
      { id: "root-wiki", game_id: "root", canonical_path: "/games/risk-of-rain", slug: "permanent-hub-slug" },
      { id: "child-wiki", game_id: "child", canonical_path: "/wiki/risk-of-rain-2" }
    ],
    game_collection_pages_view: [{ id: "items", namespace: "risk-of-rain", page_type: "database" }]
  };
  const result = () => (all[table] ?? []).filter(row => Object.entries(filters).every(([key, value]) => row[key] === value));
  // Like the real table, site_routes has no id column: selecting or ordering by it fails.
  let usesMissingId = false;
  const missingId = (columns: string) => table === "site_routes" && columns.split(",").map(column => column.trim()).includes("id");
  const query = {
    select: (columns = "*") => { usesMissingId ||= missingId(columns); return query; },
    eq: (key: string, value: unknown) => { filters[key] = value; return query; },
    order: (column: string) => { usesMissingId ||= missingId(column); return query; },
    range: async (start: number, end: number) => usesMissingId
      ? { data: null, error: { message: "column site_routes.id does not exist" } }
      : { data: result().slice(start, end + 1), error: null },
    maybeSingle: async () => ({ data: result()[0] ?? null, error: null })
  };
  return query;
} }) }));
import { gameContentRevalidationTargets } from "../game-content-revalidation";
beforeEach(() => { state.dependents = false; state.queries.length = 0; state.pages = 83; state.namespace = "risk-of-rain"; });
describe("game_content event contract", () => {
  it.each(["risk-of-rain", "gta", "red-dead", "minecraft"])("root wiki events purge the %s namespace homepage tag", async namespace => {
    state.namespace = namespace;
    const { paths, tags } = await gameContentRevalidationTargets("games/risk-of-rain");
    expect(paths).toContain(`/${namespace}`);
    expect(tags).toContain(`page:/${namespace}`);
    expect(cacheTagsForPath(`/${namespace}`)).toContain(`page:/${namespace}`);
  });

  it.each(["wiki/risk-of-rain-2/items", "risk-of-rain/wiki/second/items"])("purges both collection subtrees and parents for %s", async slug => {
    const { paths, tags, collectionPaths } = await gameContentRevalidationTargets(slug);
    for (const base of ["/wiki/risk-of-rain-2/items", "/risk-of-rain/wiki/second/items"]) {
      expect(paths).toContain(base);
      expect(collectionPaths).toContain(base);
      expect(paths).not.toContain(`${base}/page/83`);
      expect(tags).toContain(`page:${base}`);
      expect(cacheTagsForPath(`${base}/page/999`)).toContain(`page:${base}`);
    }
    expect(paths).toEqual(expect.arrayContaining(["/wiki/risk-of-rain-2", "/games/risk-of-rain", "/wiki", "/games"]));
    expect(paths).not.toContain("/tools/risk-of-rain-cost");
    expect(paths).not.toContain("/tools");
    expect(tags).not.toContain("risk-of-rain");
    expect(tags).not.toContain("wiki");
    expect(state.queries.some(q => q.table === "game_wiki_pages" && q.filters.slug)).toBe(false);
    expect(state.queries.some(q => q.table === "game_wiki_pages" && q.filters.game_id === "root")).toBe(true);
  });
  it("expands namespace-only events to every live owner", async () => {
    const { paths } = await gameContentRevalidationTargets("risk-of-rain");
    expect(paths).toEqual(expect.arrayContaining(["/wiki/risk-of-rain-2/items", "/tools/risk-of-rain-cost", "/games/risk-of-rain", "/tools"]));
  });
  it("does not read collection rows or runtime datasets, including drafts", async () => {
    await gameContentRevalidationTargets("risk-of-rain");
    expect(state.queries.some(q => q.table.includes("collection_pages") || q.table.includes("dataset"))).toBe(false);
  });
  it.each(["../wiki", "peak//wiki", "peak?draft=1"])("rejects invalid event %s", async slug => {
    expect(await gameContentRevalidationTargets(slug)).toEqual({ paths: [], tags: [], collectionPaths: [] });
  });
});

it.each(["gta", "red-dead", "minecraft", "risk-of-rain"])("%s never targets a retired sitemap", async namespace => {
 state.namespace = namespace;
 const { paths } = await gameContentRevalidationTargets(namespace);
 expect(paths).toContain("/sitemaps/games.xml");
 for (const retired of ["gta", "red-dead", "minecraft"]) expect(paths).not.toContain(`/sitemaps/${retired}.xml`);
});

it.each(["gta", "red-dead", "minecraft", "risk-of-rain"])("%s refreshes calculators and sibling maps from stored ownership", async namespace => {
 state.namespace = namespace;
 state.dependents = true;
 const { paths, tags } = await gameContentRevalidationTargets("wiki/risk-of-rain-2/items");
 expect(paths).toEqual(expect.arrayContaining(["/maps/sibling-map", "/tools/root-tool", "/maps", "/tools"]));
 expect(tags).toContain("page:/maps/sibling-map");
 expect(tags).toContain("page:/tools/root-tool");
});
