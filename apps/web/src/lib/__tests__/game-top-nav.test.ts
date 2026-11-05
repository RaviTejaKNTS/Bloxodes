import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameMenu } from "../game-site-navigation";

vi.mock("server-only", () => ({}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), cache: (fn: unknown) => fn }));
const state = vi.hoisted(() => ({
  rows: {} as Record<string, unknown>,
  calls: [] as string[],
  route: { source: "game", page_type: "wiki", game_id: "gta5" } as { source: string; page_type: string; game_id: string } | null,
  summary: null as unknown,
  menus: [] as GameMenu[]
}));
vi.mock("../supabase", () => ({ supabaseAdmin: () => ({ from: (table: string) => {
  state.calls.push(table);
  const query: Record<string, unknown> = {};
  for (const name of ["select", "eq", "limit", "order", "not"]) query[name] = () => query;
  const result = () => ({ data: state.rows[table] ?? null, error: null });
  query.maybeSingle = async () => result();
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
  return query;
} }) }));
vi.mock("../db", () => ({ getArticleGameSummaryBySlug: async () => state.summary }));
vi.mock("../site-route-page", () => ({ getLiveSiteRoute: vi.fn(async () => state.route) }));
vi.mock("../game-site-data", () => ({ listGameMenus: vi.fn(async () => state.menus) }));
import { getGameTopNavContext } from "../game-top-nav";
import { getLiveSiteRoute } from "../site-route-page";
import { listGameMenus } from "../game-site-data";

beforeEach(() => {
  vi.clearAllMocks();
  state.calls = [];
  state.summary = { slug: "gta-5", namespace: "gta", gameId: "gta5" };
  state.route = { source: "game", page_type: "wiki", game_id: "gta5" };
  state.rows = {
    games: { id: "gta5", namespace: "gta", kind: "game", title: "GTA 5", cover_image: "/gta5-cover.webp", hero_image: "/gta5.webp" },
    game_article_game_summary: { game_slug: "gta-5", article_count: 2 }
  };
  state.menus = [{ namespace: "gta", title: "GTA", image: "/gta.webp", href: "/games/gta", pages: [
    ...["wiki", "code", "checklist", "quiz", "map", "tool", "article"].map(kind => ({ kind, gameId: "gta5", title: `${kind} page title`, href: `/${kind}/gta5` })),
    { kind: "article", gameId: "gta5", title: "Another article", href: "/articles/another" },
    { kind: "map", gameId: "gta5", title: "Second map", href: "/maps/second" },
    { kind: "wiki", gameId: "gta6", title: "GTA 6 Wiki", href: "/wiki/gta-6" }
  ] }];
});

describe("non-Roblox game bar", () => {
  it("uses game identity, one plain link per type, and no sibling pages or article titles", async () => {
    const nav = await getGameTopNavContext("/wiki/gta-5");
    expect(nav?.gameName).toBe("GTA 5");
    expect(nav?.thumbnailUrl).toBe("/gta5.webp");
    expect(nav?.links.map(link => link.label)).toEqual(["Wiki", "Articles", "Codes", "Gameplay Checklist", "Quiz", "Map"]);
    expect(nav?.links.find(link => link.type === "articles")?.href).toBe("/articles/games/gta-5");
    expect(nav?.links.some(link => /gta-6|another|second/.test(link.href))).toBe(false);
    expect(listGameMenus).toHaveBeenCalledWith("gta", "gta5", false);
  });
  it.each([
    ["/wiki/gta-5", "wiki", "wiki"],
    ["/wiki/gta-5/weapons", "collection", "wiki"],
    ["/wiki/gta-5/weapons/page/2", "collection", "wiki"],
    ["/codes/gta5", "code", "codes"],
    ["/checklists/gta-5", "checklist", "checklists"],
    ["/quizzes/gta5", "quiz", "quizzes"],
    ["/maps/gta5", "map", "map"],
    ["/articles/gta5", "article", "articles"],
    ["/articles/gta5/page/2", "article", "articles"],
    ["/games/gta5", "hub", "wiki"]
  ])("marks the type on %s", async (path, kind, activeType) => {
    state.route!.page_type = kind;
    const nav = await getGameTopNavContext(path);
    expect(nav?.links.filter(link => link.active).map(link => link.type)).toEqual([activeType]);
    expect(getLiveSiteRoute).toHaveBeenCalledWith(path.replace(/\/page\/2$/, ""));
  });
  it("keeps tools in the existing Tools menu", async () => {
    state.route!.page_type = "tool";
    const nav = await getGameTopNavContext("/tools/gta5");
    expect(nav?.toolsActive).toBe(true);
    expect(nav?.tools).toHaveLength(1);
  });
  it("resolves article archives, including pagination, to their game", async () => {
    state.summary = { slug: "gta-5", namespace: "gta", gameId: "gta5" };
    const nav = await getGameTopNavContext("/articles/games/gta-5/page/2");
    expect(nav?.gameName).toBe("GTA 5");
    expect(nav?.links.find(link => link.active)?.type).toBe("articles");
    expect(getLiveSiteRoute).not.toHaveBeenCalled();
  });
  it("omits Articles when no published archive exists", async () => {
    state.rows.game_article_game_summary = null;
    expect((await getGameTopNavContext("/wiki/gta-5"))?.links.some(link => link.type === "articles")).toBe(false);
  });
  it("omits Articles when another game owns that archive URL", async () => {
    state.summary = { slug: "gta-5", universeId: 1, gameId: null };
    expect((await getGameTopNavContext("/wiki/gta-5"))?.links.some(link => link.type === "articles")).toBe(false);
  });
  it("looks up the route with the same normalized path as the parser", async () => {
    await getGameTopNavContext("/WIKI/gta%2D5/PAGE/2/");
    expect(getLiveSiteRoute).toHaveBeenCalledWith("/wiki/gta-5");
  });
  it("returns null for a franchise landing page", async () => {
    state.rows.games = { ...state.rows.games as object, kind: "franchise" };
    expect(await getGameTopNavContext("/games/gta")).toBeNull();
    expect(listGameMenus).not.toHaveBeenCalled();
  });
  it("returns null for unowned paths", async () => {
    state.route = null;
    expect(await getGameTopNavContext("/maps/missing")).toBeNull();
  });
});

it("preserves Roblox labels, order, active state and queries without the shared fallback", async () => {
  state.rows = {
    wiki_pages_view: { universe_id: 994732206, slug: "blox-fruits" },
    roblox_universes: { universe_id: 994732206, slug: "blox-fruits", display_name: "Blox Fruits", icon_url: "/blox.webp" },
    code_pages_index_view: [{ slug: "blox-fruits" }],
    events_pages: [{ slug: "blox-fruits" }],
    checklist_pages_view: [{ slug: "blox-fruits" }],
    quiz_pages_view: [{ code: "blox-fruits" }],
    tools_view: [{ code: "blox-fruits-calculator", title: "Calculator" }],
    articles: [{ id: "article" }]
  };
  state.rows.wiki_pages_view = [{ universe_id: 994732206, slug: "blox-fruits" }];
  // Use stats resolution to isolate the unchanged Roblox link builder.
  const nav = await getGameTopNavContext("/stats/games/blox-fruits-994732206");
  expect(nav).toEqual({
    gameName: "Blox Fruits", thumbnailUrl: "/blox.webp",
    links: [
      ["Wiki", "/wiki/blox-fruits", "wiki", false],
      ["Stats", "/stats/games/blox-fruits-994732206", "stats", true],
      ["Articles", "/articles/games/blox-fruits", "articles", false],
      ["Codes", "/codes/blox-fruits", "codes", false],
      ["Events", "/events/blox-fruits", "events", false],
      ["Gameplay Checklist", "/checklists/blox-fruits", "checklists", false],
      ["Quiz", "/quizzes/blox-fruits", "quizzes", false]
    ].map(([label, href, type, active]) => ({ label, href, type, active })),
    tools: [{ label: "Calculator", href: "/tools/blox-fruits-calculator", active: false }], toolsActive: false
  });
  expect(getLiveSiteRoute).not.toHaveBeenCalled();
  expect(listGameMenus).not.toHaveBeenCalled();
  expect(state.calls).not.toContain("games");
});
