import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  franchise: false, robloxContent: false, path: "/peak/detail", source: "game", kind: "wiki", status: "live", published: true, root: true, route: true,
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
vi.mock("@/lib/game-landing", () => ({ getGameLandingForLinks: async () => ({ path: "/peak" }) }));

vi.mock("@/components/games/GameWikiPage.server", () => ({ renderGameWikiPage: state.render }));
vi.mock("@/components/games/GameCollectionPage", async original => {
  const actual = await original<typeof import("@/components/games/GameCollectionPage")>();
  return { ...actual, renderSharedGameCollection: (...args: Parameters<typeof actual.renderSharedGameCollection>) =>
    (args[0].currentPage ?? 1) > 3 ? actual.renderSharedGameCollection(...args) : state.render(...args) };
});
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
    { id: "root-id", namespace: "peak", title: "Example", is_published: state.root, parent_id: null, slug: "peak", url_style: "page_type" },
    { id: "child-id", namespace: "peak", title: "Child", is_published: true, parent_id: "root-id", slug: "peak-child", url_style: "page_type" },
    { id: "other-root-id", namespace: "other", title: "Other", is_published: true, parent_id: null, slug: "peak", url_style: "page_type" },
  ].map(row => ({ ...row, cover_image: `https://media.bloxodes.com/${row.id}.webp` }));
  const row = { id: "page-id", namespace: "peak", game_id: state.franchise ? "root-id" : "child-id", game_kind: state.franchise ? "franchise" : "game", title: "Saved title", seo_title: "SEO title", meta_description: "Saved description", map_data: { image: "https://media.bloxodes.com/map.webp", width: 100, height: 100, attribution: "Example", markers: [{ id: "pin", title: "Pin", x: 10, y: 20 }] },
    catalog_data: { columns: [{ key: "name", label: "Name" }], items: [{ id: "item", name: "Item" }] },
    quiz_data: Object.fromEntries(["easy", "medium", "hard"].map(level => [level, [{ id: level, question: "Question?", correctOptionId: "a", options: ["a", "b", "c", "d"].map(id => ({ id, text: id })) }]])),
    canonical_path: state.path, slug: "peak-detail", is_published: state.published, renderer_key: state.renderer, cover_image: "https://media.bloxodes.com/cover.webp" };
  const matches = (row: Record<string, unknown>) => Object.entries(filters).every(([key, value]) => row[key] === value);
  const rows = () => {
    if (table === "games") return roots;
    if (table === "site_routes") return state.route ? [{ path: state.path, status: state.status, match_type: "exact", source: state.source, page_type: state.kind, page_id: state.selectedId || (state.kind === "hub" ? "root-id" : row.id), game_id: state.kind === "hub" ? "root-id" : row.game_id }] : [];
    if (table === "game_checklist_items") return [{ id: "task", namespace: "peak", page_id: "page-id", section_code: "1.1.1", title: "Task" }];
    if (table !== `game_${state.kind}_pages_view` && !(table === "game_wiki_pages_view" && state.kind === "hub")) return [];
    const pages = [row,
      { ...row, id: "sibling-page", title: "Sibling title", seo_title: "Sibling SEO" },
      { ...row, id: "moved-page", title: "Moved title", canonical_path: "/peak/moved" },
      { ...row, id: "foreign-page", namespace: "other", game_id: "other-root-id", title: "Foreign title", canonical_path: "/other/detail" },
      ...(state.kind === "hub" ? [{ ...row, id: "root-wiki", game_id: "root-id", canonical_path: "/peak/wiki" }] : []),
    ];
    // These protected views already omit drafts and hidden game/parent rows.
    return pages.filter(page => page.is_published && !state.hiddenGame);
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
    order: async () => ({ data: table === "game_checklist_items" ? rows().filter(matches) : state.directory && table === "game_code_pages_view" ? [{ ...row, canonical_path: `/peak/${state.directorySegment}/detail` }].filter(matches) : [], error: null }),
  };
  return query;
} }) }));

import { generateMetadata as previousMetadata } from "./fixtures/shared-game-route-before";

beforeEach(() => {
  Object.assign(state, { franchise: false, robloxContent: false, path: "/peak/detail", source: "game", kind: "wiki", status: "live", published: true, root: true, route: true, renderer: "image-pins", directory: true, directorySegment: "codes", error: "", timeout: false, selectedId: "", hiddenGame: false, queries: [] });
  state.render.mockReset().mockReturnValue("rendered");
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function robloxPage() {
  return state.robloxContent ? { id: "roblox-page", slug: "peak-detail", code: "peak-detail", wiki_slug: "peak", collection_slug: "items", page_type: "database", is_published: true, title: "Roblox fixture", name: "Roblox fixture", seo_title: "Roblox fixture", meta_description: "Roblox description", seo_description: "Roblox description", description_md: "Roblox details.", codes: [], universe: null } : null;
}
vi.mock("@/lib/wiki-collection-runtime", () => ({ getPublishedWikiCollectionRuntime: async () => ({ config: {}, document: { items: [{ system: { image: "https://media.bloxodes.com/item.webp" }, item: {} }] } }), hasWikiCollectionImageCredit: () => false }));
// Keep Roblox loaders separate: registry dispatch must never claim their rows.
vi.mock("@/lib/db", async original => ({ ...await original<typeof import("@/lib/db")>(), getCodePageBySlug: async () => robloxPage(), getChecklistPageBySlug: async () => state.robloxContent ? { page: robloxPage(), items: [] } : null }));
vi.mock("@/lib/wiki", async original => ({ ...await original<typeof import("@/lib/wiki")>(), getWikiPageBySlug: async () => robloxPage() }));
vi.mock("@/lib/wiki-collections", async original => ({ ...await original<typeof import("@/lib/wiki-collections")>(), getWikiCollectionPageByPath: async () => robloxPage() }));
vi.mock("@/lib/tools", async original => ({ ...await original<typeof import("@/lib/tools")>(), getToolContentWithDevFallback: async () => robloxPage() }));
vi.mock("@/lib/catalog", async original => ({ ...await original<typeof import("@/lib/catalog")>(), getCatalogPageContentByCodes: async () => robloxPage() }));
vi.mock("@/app/(site)/wiki/page-data", () => ({ loadWikiDetailPageData: async () => null, renderWikiDetailPage: vi.fn() }));
vi.mock("@/app/(site)/quizzes/page-data", () => ({ loadQuizDetailPage: async () => null, loadQuizMetadataPage: async () => robloxPage() }));

import * as gamesEntry from "@/app/(site)/games/[slug]/page";
import * as wikiEntry from "@/app/(site)/wiki/[slug]/page";
import * as collectionEntry from "@/app/(site)/wiki/[slug]/[collection]/page";
import * as paginationEntry from "@/app/(site)/wiki/[slug]/[collection]/page/[page]/page";
import * as mapsEntry from "@/app/(site)/maps/[slug]/page";
import * as checklistsEntry from "@/app/(site)/checklists/[slug]/page";
import * as quizzesEntry from "@/app/(site)/quizzes/[slug]/page";
import * as toolsEntry from "@/app/(site)/tools/[...slug]/page";
import * as codesEntry from "@/app/(site)/codes/[slug]/page";
import * as catalogEntry from "@/app/(site)/catalog/[...slug]/page";
import { resolvePageTypeGameRoute } from "@/lib/page-type-game-route";

const entries = [
  { name: "games", kind: "wiki", path: "/games/peak", entry: gamesEntry, params: { slug: "peak" } },
  { name: "wiki", kind: "wiki", path: "/wiki/peak", entry: wikiEntry, params: { slug: "peak" } },
  { name: "collection", kind: "collection", path: "/wiki/peak/items", entry: collectionEntry, params: { slug: "peak", collection: "items" } },
  { name: "pagination", kind: "collection", path: "/wiki/peak/items", entry: paginationEntry, params: { slug: "peak", collection: "items", page: "2" } },
  { name: "maps", kind: "map", path: "/maps/peak-map", entry: mapsEntry, params: { slug: "peak-map" } },
  { name: "checklists", kind: "checklist", path: "/checklists/peak-detail", entry: checklistsEntry, params: { slug: "peak-detail" } },
  { name: "quizzes", kind: "quiz", path: "/quizzes/peak-detail", entry: quizzesEntry, params: { slug: "peak-detail" } },
  { name: "tools", kind: "tool", path: "/tools/peak-detail", entry: toolsEntry, params: { slug: ["peak-detail"] } },
  { name: "codes", kind: "code", path: "/codes/peak-detail", entry: codesEntry, params: { slug: "peak-detail" } },
  { name: "catalog", kind: "catalog", path: "/catalog/peak-detail", entry: catalogEntry, params: { slug: ["peak-detail"] } },
];
// Only canonical and OG URLs may change; all metadata content is compared deeply.
function normalizeUrls(metadata: unknown, path: string) {
  return JSON.parse(JSON.stringify(metadata).replaceAll(path, "/same-page"));
}
function invoke(fn: unknown, params: object) {
  return (fn as (props: { params: Promise<object> }) => Promise<unknown>)({ params: Promise.resolve(params) });
}
describe("page-type entry points with pilot-style fixtures", () => {
  it.each(entries)("$name dispatches game data and preserves namespace metadata", async ({ kind, path, entry, params, name }) => {
    state.kind = kind; state.franchise = name === "games";
    state.path = ["checklist", "quiz"].includes(kind) ? `/peak/${kind === "quiz" ? "quizzes" : "checklists"}/peak-detail` : "/peak/detail";
    const legacyPath = state.path;
    const segments = legacyPath.slice("/peak/".length).split("/");
    if (name === "pagination") segments.push("page", "2");
    const oldMetadata = await previousMetadata({ params: Promise.resolve({ slug: "peak", segments }) });
    state.path = path;
    state.queries.length = 0;
    expect(await invoke(entry.default, params)).toBeTruthy();
    expect(state.queries.some(q => q.table === `game_${kind}_pages_view` && q.filters.id === "page-id")).toBe(true);
    const movedMetadata = await invoke(entry.generateMetadata, params);
    expect(normalizeUrls(movedMetadata, path)).toEqual(normalizeUrls(oldMetadata, legacyPath));
  });
  it.each(entries)("$name rejects hidden pages in rendering and metadata", async ({ kind, path, entry, params }) => {
    state.kind = kind; state.path = path; state.hiddenGame = true;
    await expect(invoke(entry.default, params)).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(invoke(entry.generateMetadata, params)).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it.each(entries)("$name leaves Roblox registry ownership with Roblox", async ({ path }) => {
    state.source = "roblox"; state.path = path;
    expect(await resolvePageTypeGameRoute(path)).toBeNull();
    expect(state.queries.some(q => q.table.endsWith("_pages_view"))).toBe(false);
  });
  it.each(["02", "2.0", "2e0", "+2", " 2 "])("retains Roblox Number parsing for %s", async page => {
    state.robloxContent = true;
    state.queries.length = 0;
    expect(await invoke(paginationEntry.generateMetadata, { slug: "peak", collection: "items", page })).toEqual(
      await invoke(paginationEntry.generateMetadata, { slug: "peak", collection: "items", page: "2" }));
    expect(state.queries).toEqual([]);
  });
  it.each(["0", "1", "-2", "2.5", "NaN"])("invalid Roblox metadata falls back to page one: %s", async page => {
    state.robloxContent = true;
    expect(await invoke(paginationEntry.generateMetadata, { slug: "peak", collection: "items", page })).toEqual(
      await invoke(collectionEntry.generateMetadata, { slug: "peak", collection: "items" }));
    await expect(invoke(paginationEntry.default, { slug: "peak", collection: "items", page })).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it.each([gamesEntry, mapsEntry])("unknown exclusive route returns 404", async entry => {
    state.route = false;
    await expect(invoke(entry.default, { slug: "missing" })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(invoke(entry.generateMetadata, { slug: "missing" })).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("out-of-range collection metadata returns 404", async () => {
    state.kind = "collection"; state.path = "/wiki/peak/items";
    await expect(invoke(paginationEntry.generateMetadata, { slug: "peak", collection: "items", page: "4" })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(invoke(paginationEntry.default, { slug: "peak", collection: "items", page: "4" })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("shared entry point Roblox and unknown dispatch", () => {
  it.each(entries.filter(row => !["games", "maps"].includes(row.name)))("$name keeps the Roblox fallback and unknown 404", async ({ entry, path, params }) => {
    state.path = path; state.source = "roblox";
    await expect(invoke(entry.default, params)).rejects.toThrow("NEXT_NOT_FOUND");
    const robloxMetadata = await Promise.allSettled([invoke(entry.generateMetadata, params)]);
    state.route = false;
    await expect(invoke(entry.default, params)).rejects.toThrow("NEXT_NOT_FOUND");
    const unknownMetadata = await Promise.allSettled([invoke(entry.generateMetadata, params)]);
    expect(unknownMetadata).toEqual(robloxMetadata);
  });
});

it.each(entries.filter(row => !["games", "maps"].includes(row.name)))("$name preserves populated Roblox metadata", async ({ entry, path, params }) => {
  state.path = path; state.source = "game"; state.robloxContent = true;
  state.error = "site_routes";
  const metadata = await invoke(entry.generateMetadata, params);
  expect(metadata).toHaveProperty("title");
  state.route = false;
  expect(await invoke(entry.generateMetadata, params)).toEqual(metadata);
  expect(state.queries.some(q => q.table === "site_routes")).toBe(false);
  expect(state.queries.some(q => q.table.startsWith("game_") && q.table.endsWith("_pages_view"))).toBe(false);
});
