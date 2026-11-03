import { beforeEach, describe, expect, it, vi } from "vitest";
import { load } from "cheerio";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

const state = vi.hoisted(() => ({
  roots: [] as Array<{ namespace: string; slug: string; kind: string; title: string; cover_image: string }>,
  pages: [] as Array<{ namespace: string; game_id: string; title: string; canonical_path: string }>
}));
vi.mock("server-only", () => ({}));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(), cache: (loader: unknown) => loader }));
// Exercise the shared directory reader. Both order() and range() return an
// awaitable query, just as they do in Supabase.
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: (table: string) => {
  let start = 0;
  let end = Infinity;
  const query = {
    select: () => query, is: () => query, eq: () => query, not: () => query, order: () => query,
    range: (first: number, last: number) => { start = first; end = last; return query; },
    then: (resolve: (value: unknown) => unknown) => resolve({
      data: (table === "games" ? state.roots : table === "game_wiki_pages_view" ? state.pages : []).slice(start, end + 1),
      error: null
    })
  };
  return query;
} }) }));
vi.mock("@/components/hubs/HubsSidebar", () => ({ HubsSidebarLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>, POPULAR_LINKS: [] }));

import GamesPage from "@/app/(site)/games/page";

beforeEach(() => {
  state.roots = ["gta", "red-dead", "minecraft", "future-game"].map(namespace => ({
    namespace, slug: namespace, kind: namespace === "future-game" ? "game" : "franchise",
    title: namespace, cover_image: `/images/${namespace}.webp`
  }));
  state.pages = [];
});

async function directory() {
  const $ = load(renderToStaticMarkup(await GamesPage()));
  const graph = JSON.parse($("script[type='application/ld+json']").text())["@graph"];
  const list = graph[1].mainEntity;
  const paths = $("#article-body > a").map((_, card) => $(card).attr("href")).get();
  expect(list.numberOfItems).toBe(paths.length);
  expect(list.itemListElement.map((entry: { url: string }) => entry.url)).toEqual(paths.map(path => `https://bloxodes.com${path}`));
  expect($("#article-body a[href='/wiki']")).toHaveLength(1);
  expect($("#article-body a[href='/puzzles']")).toHaveLength(1);
  return { $, paths, list };
}

describe("games directory canonical links", () => {
  it("uses the same franchise and single-game destinations in cards and ItemList", async () => {
    const { paths } = await directory();
    expect(paths).toEqual(["/wiki", "/wiki/future-game", "/games/gta", "/games/minecraft", "/games/red-dead", "/puzzles"]);
  });

  it("follows published root changes across requests without changing module state", async () => {
    const roots = [...state.roots];
    for (const published of [true, false, true]) {
      state.roots = roots.filter(root => published || root.namespace !== "gta");
      const { paths } = await directory();
      expect(paths.includes("/games/gta")).toBe(published);
      expect(paths).toHaveLength(published ? 6 : 5);
      expect(state.roots).toEqual(roots.filter(root => published || root.namespace !== "gta"));
    }
  });

  it("keeps Roblox and puzzles when no non-Roblox roots are published", async () => {
    state.roots = [];
    expect((await directory()).paths).toEqual(["/wiki", "/puzzles"]);
  });

  it("keeps card order and stored artwork aligned with the schema", async () => {
    state.pages = [{ namespace: "red-dead", game_id: "rdr", title: "Saved wiki", canonical_path: "/wiki/red-dead-redemption-2" }];
    const { $, paths, list } = await directory();
    expect(paths[1]).toBe("/games/red-dead");
    expect(list.itemListElement.map((entry: { position: number }) => entry.position)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const root of state.roots) {
      const path = root.kind === "franchise" ? `/games/${root.namespace}` : `/wiki/${root.slug}`;
      const entry = list.itemListElement.find((item: { url: string }) => item.url === `https://bloxodes.com${path}`);
      expect(entry).toMatchObject({ name: root.title, image: `https://bloxodes.com${root.cover_image}` });
      // next/image encodes its original source inside the generated URL.
      expect(decodeURIComponent($(`#article-body a[href='${path}'] img`).attr("src")!)).toContain(root.cover_image);
    }
  });
});
