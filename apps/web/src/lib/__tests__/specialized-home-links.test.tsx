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
vi.mock("@/lib/game-link-paths", () => ({ gameLinkPaths: async () => state.moved ? aliases : {} }));
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
vi.mock("@/lib/minecraft", () => ({ getMinecraftWikiPageBySlug: async () => null }));
vi.mock("@/app/(site)/events/page-data", () => ({ buildEventsCards: async () => ({ cards: [] }) }));
import { loadHomePageData } from "../home-page-data";
import { GTA_LINKS, HubsPageSidebar, HubsSidebarLayout } from "@/components/hubs/HubsSidebar";

describe("home and hub rails use saved aliases", () => {
  it.each([false, true])("keeps curated home and sidebar destinations consistent, moved=%s", async moved => {
    state.moved = moved;
    const home = await loadHomePageData();
    const gta = home.franchises.find(franchise => franchise.name === "Grand Theft Auto")!;
    expect(gta.href).toBe(moved ? "/games/gta" : "/gta/wiki");
    expect(gta.links.map(link => link.href)).toEqual(GTA_LINKS.slice(0, 3).map(link => moved ? aliases[link.href] ?? link.href : link.href));
    const redDead = home.franchises.find(franchise => franchise.name === "Red Dead")!;
    expect(redDead.href).toBe("/red-dead/wiki");
    expect(redDead.links.every(link => link.href.startsWith("/red-dead/"))).toBe(true);
    for (const element of [
      await HubsPageSidebar({ canonicalPath: "/example", title: "Example", links: GTA_LINKS }),
      await HubsSidebarLayout({ canonicalPath: "/example", title: "Example", heading: "GTA", links: GTA_LINKS, children: <p>Body</p> }),
    ]) {
      const html = renderToStaticMarkup(element);
      for (const link of GTA_LINKS.slice(0, 6)) {
        expect(html).toContain(`href="${moved ? aliases[link.href] ?? link.href : link.href}"`);
        if (moved && aliases[link.href]) expect(html).not.toContain(`href="${link.href}"`);
      }
    }
  });
});

it("preserves the committed GTA home destinations and full sidebar order before the move", async () => {
  state.moved = false;
  const home = await loadHomePageData();
  const gta = home.franchises.find(franchise => franchise.name === "Grand Theft Auto")!;
  expect(gta.href).toBe("/gta/wiki");
  expect(gta.links.map(link => link.href)).toEqual(["/gta/maps", "/gta/maps/gta5", "/gta/checklists"]);
  const element = await HubsSidebarLayout({ canonicalPath: "/example", title: "Example", heading: "GTA", links: GTA_LINKS, children: <p>Body</p> });
  const markup = renderToStaticMarkup(element);
  const links = [...markup.matchAll(/href="(\/gta[^"]*)"/g)].map(match => match[1]);
  expect(links).toEqual([
    "/gta/maps", "/gta/maps/gta5", "/gta/checklists", "/gta/checklists/gta-5",
    "/gta/wiki/gta-5/spaceship-parts", "/gta/wiki/gta-5/vehicles"
  ]);
});
