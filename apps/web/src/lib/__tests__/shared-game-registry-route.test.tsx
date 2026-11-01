import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  source: "game", kind: "wiki", status: "live", published: true, root: true, route: true,
  renderer: "image-pins", directory: true, directorySegment: "codes", error: "", timeout: false, selectedId: "", hiddenGame: false,
  queries: [] as Array<{ table: string; filters: Record<string, unknown> }>,
  render: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), cache: (fn: unknown) => fn }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("@/lib/shared-game-reader", () => ({ createGameReader: () => ({
  getPublishedSharedGameWikiCollectionRuntime: async () => ({ config: {}, document: { items: [{ system: { image: "https://media.bloxodes.com/item.webp" } }] } }),
  listPublishedSharedGameWikiCollectionImageUrls: async () => [],
}) }));
// Metadata adapters remain real; only collection document preparation is outside this route test.
vi.mock("@/app/(site)/wiki/collections/games/generic", () => ({ prepareGameCollectionDocument: () => ({ totalPages: 3 }) }));
vi.mock("@/lib/game-landing", () => ({ getGameLandingForLinks: async () => ({ path: "/example" }) }));

vi.mock("@/components/games/GameWikiPage.server", () => ({ renderGameWikiPage: state.render }));
vi.mock("@/components/games/GameCollectionPage", async original => ({ ...await original<typeof import("@/components/games/GameCollectionPage")>(), renderSharedGameCollection: state.render }));
vi.mock("@/components/games/GameContentPage", async original => ({ ...await original<typeof import("@/components/games/GameContentPage")>(), GameContentPage: "content-page" }));
vi.mock("@/components/games/GameMap", () => ({ GameMap: "game-map" }));
vi.mock("@/components/games/GameCatalog", () => ({ GameCatalog: "game-catalog" }));
vi.mock("@/components/games/GameQuizPage", async original => ({ ...await original<typeof import("@/components/games/GameQuizPage")>(), GameQuizPage: "game-quiz" }));
vi.mock("@/components/games/GameCodePage", () => ({ GameCodePage: "game-code" }));
vi.mock("@/components/games/GameToolPage", async original => ({ ...await original<typeof import("@/components/games/GameToolPage")>(), GameToolPage: "game-tool" }));
vi.mock("@/components/ChecklistPageTemplate", async original => ({ ...await original<typeof import("@/components/ChecklistPageTemplate")>(), ChecklistPageTemplate: "game-checklist" }));
vi.mock("@/components/games/GameRelatedLinks", () => ({ GameRelatedLinks: "related-links" }));
vi.mock("@/components/PageBreadcrumb", () => ({ PageBreadcrumb: "breadcrumb" }));
vi.mock("@/components/ContentCard", () => ({ ContentCard: "content-card" }));
vi.mock("@/components/PageSidebar", () => ({ PageSidebar: "sidebar" }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: (table: string) => {
  const filters: Record<string, unknown> = {};
  state.queries.push({ table, filters });
  const roots = [
    { id: "root-id", namespace: "example", title: "Example", is_published: state.root, parent_id: null },
    { id: "child-id", namespace: "example", title: "Child", is_published: true, parent_id: "root-id" },
    { id: "other-root-id", namespace: "other", title: "Other", is_published: true, parent_id: null },
  ].map(row => ({ ...row, cover_image: `https://media.bloxodes.com/${row.id}.webp` }));
  const row = { id: "page-id", namespace: "example", game_id: "child-id", title: "Saved title", seo_title: "SEO title", meta_description: "Saved description", map_data: { image: "https://media.bloxodes.com/map.webp", width: 100, height: 100, attribution: "Example", markers: [{ id: "pin", title: "Pin", x: 10, y: 20 }] },
    catalog_data: { columns: [{ key: "name", label: "Name" }], items: [{ id: "item", name: "Item" }] },
    quiz_data: Object.fromEntries(["easy", "medium", "hard"].map(level => [level, [{ id: level, question: "Question?", correctOptionId: "a", options: ["a", "b", "c", "d"].map(id => ({ id, text: id })) }]])),
    canonical_path: "/example/detail", slug: "detail", is_published: state.published, renderer_key: state.renderer, cover_image: "https://media.bloxodes.com/cover.webp" };
  const matches = (row: Record<string, unknown>) => Object.entries(filters).every(([key, value]) => row[key] === value);
  const rows = () => {
    if (table === "games") return roots;
    if (table === "site_routes") return state.route ? [{ path: "/example" + (state.kind === "hub" ? "" : "/detail"), status: state.status, match_type: "exact", source: state.source, page_type: state.kind, page_id: state.selectedId || (state.kind === "hub" ? "root-id" : row.id), game_id: state.kind === "hub" ? "root-id" : "child-id" }] : [];
    if (table === "game_checklist_items") return [{ id: "task", namespace: "example", page_id: "page-id", section_code: "1.1.1", title: "Task" }];
    if (table !== `game_${state.kind}_pages_view` && !(table === "game_wiki_pages_view" && state.kind === "hub")) return [];
    const pages = [row,
      { ...row, id: "sibling-page", title: "Sibling title", seo_title: "Sibling SEO" },
      { ...row, id: "moved-page", title: "Moved title", canonical_path: "/example/moved" },
      { ...row, id: "foreign-page", namespace: "other", game_id: "other-root-id", title: "Foreign title", canonical_path: "/other/detail" },
      ...(state.kind === "hub" ? [{ ...row, id: "root-wiki", game_id: "root-id", canonical_path: "/example/wiki" }] : []),
    ];
    // These protected views already omit drafts and hidden game/parent rows.
    return pages.filter(page => page.is_published && !(state.hiddenGame && page.game_id === "child-id"));
  };
  const query = {
    select: () => query, is: (key: string, value: unknown) => { filters[key] = value; return query; },
    eq: (key: string, value: unknown) => { filters[key] = value; return query; }, not: () => query,
    abortSignal: (_signal: AbortSignal) => query,
    maybeSingle: async () => {
      if (state.timeout && table === "site_routes") return new Promise<never>(() => {});
      if (state.error === table) return { data: null, error: { message: "Sensitive database details" } };
      return { data: rows().find(matches) ?? null, error: null };
    },
    order: async () => ({ data: table === "game_checklist_items" ? rows().filter(matches) : state.directory && table === "game_code_pages_view" ? [{ ...row, canonical_path: `/example/${state.directorySegment}/detail` }].filter(matches) : [], error: null }),
  };
  return query;
} }) }));

import { generateMetadata as previousMetadata } from "./fixtures/shared-game-route-before";
import SharedGamePage, { generateMetadata } from "@/components/games/GameRoutePage";
import { getGameWikiByPath, getGameCollectionByPath, getGameCodeByPath, getGameToolByPath } from "@/lib/game-registry";
import { getGameExtendedPage, getGameChecklistByPath } from "@/lib/game-extra-pages";
import { getLiveSiteRoute } from "@/lib/site-route-page";

const props = (segments = ["detail"]) => ({ params: Promise.resolve({ slug: "example", segments, sitePath: `/example/${segments.join("/")}` }) });
const readers = {
  wiki: () => getGameWikiByPath("example", "/example/detail"),
  collection: () => getGameCollectionByPath("example", "/example/detail"),
  code: () => getGameCodeByPath("example", "/example/detail"),
  tool: () => getGameToolByPath("example", "/example/detail"),
  map: () => getGameExtendedPage("example", "/example/detail", "map"),
  quiz: () => getGameExtendedPage("example", "/example/detail", "quiz"),
  catalog: () => getGameExtendedPage("example", "/example/detail", "catalog"),
  checklist: () => getGameChecklistByPath("example", "/example/detail"),
};
beforeEach(() => {
  Object.assign(state, { source: "game", kind: "wiki", status: "live", published: true, root: true, route: true, renderer: "image-pins", directory: true, directorySegment: "codes", error: "", timeout: false, selectedId: "", hiddenGame: false, queries: [] });
  state.render.mockReset().mockReturnValue("rendered");
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("shared registry route", () => {
  it.each(Object.keys(readers) as Array<keyof typeof readers>)("%s keeps the old page data and metadata adapter with one ID lookup", async kind => {
    state.kind = kind;
    const oldPage = await readers[kind]();
    state.queries = [];
    const result = await SharedGamePage(props());
    const pageQueries = state.queries.filter(q => q.table.endsWith("_pages_view"));
    expect(pageQueries).toHaveLength(1);
    expect(pageQueries[0].filters).toMatchObject({ namespace: "example", id: "page-id" });
    expect(pageQueries[0].filters).not.toHaveProperty("canonical_path");
    if (["wiki", "collection", "code", "tool"].includes(kind)) expect(pageQueries[0].filters.is_published).toBe(true);
    expect(state.queries.filter(q => q.table === "site_routes")).toHaveLength(1);
    expect(state.queries.find(q => q.table === "site_routes")?.filters).toEqual({ path: "/example/detail", status: "live", match_type: "exact" });
    if (kind === "wiki" || kind === "collection") expect(state.render.mock.calls[0][0].page).toEqual(oldPage);
    else expect((result as { props: Record<string, unknown> }).props[kind === "tool" ? "tool" : kind === "checklist" ? "data" : "page"]).toEqual(oldPage);
    const metadata = await generateMetadata(props());
    if (kind === "checklist") expect(metadata.alternates?.canonical).toBe("https://bloxodes.com/example/detail");
    else expect(metadata).toEqual(await previousMetadata(props()));
  });
  it.each(["gone", "old"])("%s rows cannot render even when a page still exists", async status => {
    state.status = status;
    await expect(SharedGamePage(props())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(state.queries.some(q => q.table.endsWith("_pages_view"))).toBe(false);
  });
  it.each(Object.keys(readers))("unpublished %s stays a 404", async kind => {
    state.kind = kind; state.published = false;
    await expect(SharedGamePage(props())).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(generateMetadata(props())).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it.each(Object.keys(readers))("hidden-game %s keeps fallback metadata and the final 404", async kind => {
    state.kind = kind; state.hiddenGame = true;
    await expect(generateMetadata(props())).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(SharedGamePage(props())).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("looks up the base collection path for pagination", async () => {
    state.kind = "collection";
    await SharedGamePage(props(["detail", "page", "2"]));
    expect(state.queries.find(q => q.table === "site_routes")?.filters.path).toBe("/example/detail");
    expect(state.render.mock.calls[0][0].currentPage).toBe(2);
    expect(await generateMetadata(props(["detail", "page", "2"]))).toEqual(await previousMetadata(props(["detail", "page", "2"])));
  });
  it.each(["wiki", "code", "tool", "map", "quiz", "catalog", "checklist", "hub"])("rejects pagination on %s", async kind => {
    state.kind = kind;
    await expect(SharedGamePage(props(["detail", "page", "2"]))).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("rejects unsafe page numbers and hidden roots before route lookup", async () => {
    await expect(SharedGamePage(props(["detail", "page", "999999999999999999"]))).rejects.toThrow("NEXT_NOT_FOUND");
    state.root = false;
    await expect(SharedGamePage(props())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(state.queries.some(q => q.table === "site_routes")).toBe(false);
  });
  it("keeps the unsupported map renderer 404", async () => {
    state.kind = "map"; state.renderer = "gta5";
    await expect(SharedGamePage(props())).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("rejects a foreign source and unsupported page type", async () => {
    state.source = "roblox";
    await expect(SharedGamePage(props())).rejects.toThrow("NEXT_NOT_FOUND");
    state.source = "game"; state.kind = "article";
    await expect(SharedGamePage(props())).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it.each(["missing-page", "foreign-page"])("does not load a wrong or foreign ID: %s", async id => {
    state.selectedId = id;
    await expect(SharedGamePage(props())).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(generateMetadata(props())).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("uses the selected sibling ID instead of the first row", async () => {
    state.selectedId = "sibling-page";
    await SharedGamePage(props());
    expect(state.render.mock.calls[0][0].page.title).toBe("Sibling title");
    expect(await generateMetadata(props())).toMatchObject({ title: "Sibling SEO" });
  });
  it("rejects an ID page whose own canonical path is not the requested path", async () => {
    state.selectedId = "moved-page";
    await expect(SharedGamePage(props())).rejects.toThrow();
    expect(state.render).not.toHaveBeenCalled();
  });
  it("selects the correct namespace root and child artwork", async () => {
    state.kind = "code";
    const page = await readers.code();
    expect(page?.image).toBe("https://media.bloxodes.com/child-id.webp");
    expect(await getGameWikiByPath("other", "/example/detail")).toBeNull();
    expect(await getGameWikiByPath("example", "/example/missing")).toBeNull();
  });
  it.each(Object.keys(readers) as Array<keyof typeof readers>)("registry errors fall back to the old %s output", async kind => {
    state.kind = kind; state.error = "site_routes";
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    if (kind === "checklist") expect((await generateMetadata(props())).alternates?.canonical).toBe("https://bloxodes.com/example/detail");
    else expect(await generateMetadata(props())).toEqual(await previousMetadata(props()));
    expect(await SharedGamePage(props())).toBeTruthy();
    expect(state.queries.filter(q => q.table.endsWith("_pages_view")).some(q => q.filters.canonical_path === "/example/detail")).toBe(true);
    expect(log).toHaveBeenCalledWith("Site route lookup unavailable; using by-path page readers.");
    expect(log.mock.calls.every(args => args.length === 1)).toBe(true);
  });
  it("falls back after the two-second registry deadline", async () => {
    vi.useFakeTimers(); state.timeout = true;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = SharedGamePage(props());
    await vi.advanceTimersByTimeAsync(1999);
    expect(state.queries.some(q => q.table.endsWith("_pages_view"))).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toBe("rendered");
    expect(state.queries.filter(q => q.table.endsWith("_pages_view"))).toHaveLength(8);
  });
  it("keeps a genuine missing live row distinct from a read failure", async () => {
    state.route = false;
    expect(await getLiveSiteRoute("/example/detail")).toBeNull();
    await expect(SharedGamePage(props())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(state.queries.some(q => q.table.endsWith("_pages_view"))).toBe(false);
  });
});
