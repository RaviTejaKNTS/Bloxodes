import { describe, expect, it, vi } from "vitest";
import { load } from "cheerio";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

const state = vi.hoisted(() => ({ publishedWiki: true, failedRead: "" }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/game-registry", () => ({
  getGameRoot: async (namespace: string) => {
    if (state.failedRead === "root") throw new Error("Root unavailable");
    return { id: namespace, namespace, parent_id: null, is_published: true };
  },
  getGameWikiByPath: async (namespace: string) => {
    if (state.failedRead === "wiki") throw new Error("Wiki unavailable");
    return state.publishedWiki ? { game_id: namespace, namespace, canonical_path: `/${namespace}/wiki`, is_published: true } : null;
  }
}));
vi.mock("@/lib/minecraft", () => ({ getMinecraftWikiPageBySlug: async () => ({ slug: "minecraft-java" }), resolveMinecraftWikiCoverImage: () => "/images/games/minecraft.webp" }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: (table: string) => {
  const query = { select: () => query, is: () => query, eq: () => query, not: () => query, limit: () => query, maybeSingle: async () => ({ data: null, error: state.failedRead === table ? { message: "View unavailable" } : null }), order: async () => ({ data: [{ namespace: "future-game", title: "Future Game", cover_image: "/Bloxodes.png" }], error: null }) };
  return query;
} }) }));
vi.mock("@/components/hubs/HubsSidebar", () => ({ HubsSidebarLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>, POPULAR_LINKS: [] }));

import GamesPage from "@/app/(site)/games/page";

describe("games directory canonical links", () => {
  it("uses the same conditional paths in cards and ItemList, without changing module state", async () => {
    state.failedRead = "";
    // Publication can change across requests. In particular, never mutate the static platform list.
    for (const published of [true, false, true]) {
      state.publishedWiki = published;
      const $ = load(renderToStaticMarkup(await GamesPage()));
      const graph = JSON.parse($("script[type='application/ld+json']").text())["@graph"];
      const schemaUrls = graph[1].mainEntity.itemListElement.map((entry: { url: string }) => entry.url);
      for (const namespace of ["gta", "red-dead", "minecraft", "future-game"]) {
        const path = `/${namespace}${published ? "/wiki" : ""}`;
        expect($(`#article-body a[href='${path}']`)).toHaveLength(1);
        expect(schemaUrls).toContain(`https://bloxodes.com${path}`);
      }
      expect($("#article-body a[href='/wiki']")).toHaveLength(1);
      expect($("#article-body a[href='/puzzles']")).toHaveLength(1);
    }
  });

  it.each(["game_catalog_pages_view", "root", "wiki"])("renders directory cards and schema when optional %s lookup fails", async failedRead => {
    state.publishedWiki = true;
    state.failedRead = failedRead;
    const $ = load(renderToStaticMarkup(await GamesPage()));
    const graph = JSON.parse($("script[type='application/ld+json']").text())["@graph"];
    const schemaUrls = graph[1].mainEntity.itemListElement.map((entry: { url: string }) => entry.url);
    for (const namespace of ["gta", "red-dead", "minecraft", "future-game"]) {
      expect($(`#article-body a[href='/${namespace}']`)).toHaveLength(1);
      expect(schemaUrls).toContain(`https://bloxodes.com/${namespace}`);
    }
  });
});
