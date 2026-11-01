import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const state = vi.hoisted(() => ({ moved: false }));
const aliases: Record<string, string> = {
  "/gta/maps": "/games/gta", "/gta/checklists": "/games/gta",
  "/gta/wiki/gta-5/spaceship-parts": "/wiki/gta-5/spaceship-parts", "/gta/wiki/gta-5/vehicles": "/wiki/gta-5/vehicles",
  "/gta/wiki/gta-5": "/wiki/gta-5", "/gta/wiki/gta-6": "/wiki/gta-6",
  "/gta/maps/gta5": "/maps/gta5", "/gta/checklists/gta-5": "/checklists/gta-5",
};
vi.mock("server-only", () => ({}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), cache: (fn: unknown) => fn }));
vi.mock("@/lib/game-landing", () => ({ getGameLandingForLinks: async (namespace: string) => ({ path: namespace === "gta" && state.moved ? "/games/gta" : `/${namespace}/wiki` }) }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: () => {
  const query = { select: () => query, eq: () => query, gt: () => query, not: () => query, order: () => query, limit: async () => ({ data: [], error: null }) };
  return query;
} }) }));
vi.mock("@/lib/db", () => ({ listPublishedArticles: async () => [], listPublishedChecklists: async () => [] }));
vi.mock("@/lib/quizzes", () => ({ listPublishedQuizzes: async () => [] }));
vi.mock("@/lib/tools", () => ({ listPublishedTools: async () => [] }));
vi.mock("@/lib/stats", () => ({ getStatsHome: async () => ({ topGames: [], risers: [], totals: {}, platformChart: { points: [] } }) }));
vi.mock("@/lib/content-counts", () => ({ getContentCounts: async () => ({ codes: 0, wiki: 0 }) }));
vi.mock("@/lib/wiki", () => ({ listPublishedWikiPages: async () => [] }));
vi.mock("@/lib/puzzles", () => ({ listPublishedPuzzlePages: async () => [] }));
vi.mock("@/lib/catalog", () => ({ listPublishedTopLevelCatalogPages: async () => [] }));
vi.mock("@/app/(site)/events/page-data", () => ({ buildEventsCards: async () => ({ cards: [] }) }));
import { loadHomePageData } from "../home-page-data";
import { hubsSidebarLinksFor, HubsSidebarLayout } from "@/components/hubs/HubsSidebar";
import GamesPage from "@/app/(site)/games/page";
const games = ["arc-raiders", "gta", "red-dead", "minecraft"].map(namespace => ({ namespace, title: namespace, href: `/games/${namespace}`, image: `https://media.bloxodes.com/${namespace}.webp`, pages: [{ kind: "wiki", gameId: "owner", title: `${namespace} wiki`, href: `/wiki/${namespace}-game` }] }));
vi.mock("@/lib/game-site-data", () => ({ listGameCards: async () => games, listGameMenus: async () => games }));
it("includes every published root with the same home card and directory contract", async () => {
  const home = await loadHomePageData();
  expect(home.franchises.map(game => game.name)).toEqual(games.map(game => game.title));
  for (const game of games) {
    expect(home.franchises.find(card => card.name === game.title)).toMatchObject({ href: game.href, image: game.image, links: [{ href: game.pages[0].href, label: game.pages[0].title }] });
    const sidebar = await hubsSidebarLinksFor(game.namespace);
    const markup = renderToStaticMarkup(await HubsSidebarLayout({ canonicalPath: game.href, title: game.title, ...sidebar, children: <p>Body</p> }));
    expect(markup).toContain(`href="${game.pages[0].href}"`);
  }
  const page = await GamesPage();
  // Inspect the exact cards passed to the server layout without resolving its rail.
  const markup = renderToStaticMarkup(<>{page.props.children}</>);
  for (const game of games) expect(markup).toContain(`href="${game.href}"`);
});
