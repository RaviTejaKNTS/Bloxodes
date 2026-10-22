import { beforeEach, describe, expect, it, vi } from "vitest";
import { load } from "cheerio";
import { renderToStaticMarkup } from "react-dom/server";
import { gameRootWikiPage } from "@/lib/game-root-page";
import type { SharedGameGame } from "@/lib/shared-game-reader";
import { renderGameWikiPage } from "./GameWikiPage";
import type { SharedGameWikiPage } from "@/lib/shared-game-reader";

const mocks = vi.hoisted(() => ({ collections: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/game-registry", () => ({ getGameDirectoryPages: async () => [] }));
vi.mock("./GameRelatedLinks", () => ({ GameRelatedLinks: () => null }));
vi.mock("@/components/comments/CommentsSection", () => ({ CommentsSection: ({ entityId }: { entityId: string }) => <div data-comments-id={entityId} /> }));
vi.mock("@/lib/shared-game-reader", async () => {
  const { resolveGameCoverImage, resolveGameThumbnailImage } = await import("@/lib/game-images");
  return { createGameReader: () => ({
    listPublishedSharedGameWikiCollectionsByWikiSlug: mocks.collections.mockImplementation(async (slug: string) => {
      if (slug === "root") return [{ id: "collection", code: "root-items", title: "Items", display_name: "Items", canonical_path: "/example/wiki/items", page_type: "database" }];
      if (slug === "child" || slug === "edition") {
        const wikiPath = slug === "edition" ? "/example/edition/wiki" : "/example/wiki/child";
        return ["collectible", "database"].map(page_type => ({ id: page_type, code: `${slug}-${page_type}`, title: page_type, display_name: page_type, canonical_path: `${wikiPath}/${page_type}`, page_type }));
      }
      return [];
    }),
    listPublishedSharedGameWikiCollectionImageUrls: async () => [],
    resolveSharedGameWikiCoverImage: (page: SharedGameWikiPage) => resolveGameCoverImage(page) || "",
    resolveSharedGameWikiThumbnailImage: (page: SharedGameWikiPage) => resolveGameThumbnailImage(page) || ""
  }) };
});

beforeEach(() => vi.clearAllMocks());

describe("franchise wiki image schema", () => {
  it.each([null, "https://media.bloxodes.com/child-cover.webp"])("only includes image when the game has artwork (%s)", async cover_image => {
    const page = { id: "wiki", game_id: "child", slug: "child", canonical_path: "/example/wiki/child", title: "Child Wiki", game_title: "Child", game_kind: "game", cover_image, game_cover_image: null, game_hero_image: null } as SharedGameWikiPage;
    const $ = load(renderToStaticMarkup(await renderGameWikiPage({ page, namespace: "example", namespaceTitle: "Example" })));
    const schema = JSON.parse($("script[type='application/ld+json']").text())["@graph"][0];
    if (cover_image) expect(schema.image).toBe(cover_image);
    else expect(schema).not.toHaveProperty("image");
  });
});

describe("bare root canonical alias", () => {
  it.each(["game", "franchise"] as const)("keeps %s root comments and canonical identity with its scoped cards", async kind => {
    const root = { id: "root-game", namespace: "example", title: "Example", slug: "root", kind, is_published: true, parent_id: null } as SharedGameGame;
    const wiki = { ...gameRootWikiPage(root), id: "root-wiki", canonical_path: "/example/wiki", is_published: true };
    const page = gameRootWikiPage(root, wiki);
    const directoryPages = [
      { href: "/example/wiki", title: "Wiki", kind: "game_wiki_pages_view", image: null },
      { href: "/example/wiki/child", title: "Child Wiki", kind: "game_wiki_pages_view", image: null },
      { href: "/example/wiki/items", title: "Items", kind: "game_collection_pages_view", image: null },
      ...["tools", "catalog", "quizzes"].map(section => ({ href: `/example/${section}/reference`, title: section, kind: "reference", image: null }))
    ];
    const $ = load(renderToStaticMarkup(await renderGameWikiPage({ page, namespace: "example", namespaceTitle: "Example", landingPath: "/example/wiki", directoryPages })));
    const graph = JSON.parse($("script[type='application/ld+json']").text())["@graph"];
    expect(graph[0].url).toBe("https://bloxodes.com/example/wiki");
    expect(graph[1].itemListElement.map((entry: { item: string }) => entry.item)).toEqual(["https://bloxodes.com", "https://bloxodes.com/example/wiki"]);
    for (const section of ["tools", "catalog", "quizzes"]) expect($(`a[href='/example/${section}/reference']`)).toHaveLength(kind === "game" ? 1 : 0);
    expect($("a[href='/example/wiki/items']")).toHaveLength(kind === "game" ? 1 : 0);
    expect($("a[href='/example/wiki/child']")).toHaveLength(1);
    const visiblePaths = $("#article-body [data-card-type='wiki'] a, #article-body .ads-content-game-collection a").map((_, link) => $(link).attr("href")).get();
    expect(graph[0].mainEntity.numberOfItems).toBe(visiblePaths.length);
    expect(graph[0].mainEntity.itemListElement.map((entry: { url: string }) => entry.url)).toEqual(visiblePaths.map(path => `https://bloxodes.com${path}`));
    expect($("[data-comments-id='root-wiki']")).toHaveLength(1);
    expect($("nav[aria-label='Breadcrumb'] a[href='/example/wiki']")).toHaveLength(0);
    expect($("a[href='/example/wiki']")).toHaveLength(0);
    // SocialShare puts the canonical URL into each provider's encoded share URL.
    expect($.html()).toContain(encodeURIComponent("https://bloxodes.com/example/wiki"));
    expect(page.canonical_path).toBe("/example");
  });
});

describe("franchise hub content isolation", () => {
  it.each(["gta", "red-dead", "minecraft"])("keeps only child game and edition cards on both %s hub routes", async namespace => {
    const children = [
      { href: `/${namespace}/wiki/child`, title: "Child Wiki", kind: "game_wiki_pages_view", image: null },
      { href: `/${namespace}/edition/wiki`, title: "Edition Wiki", kind: "game_wiki_pages_view", image: null }
    ];
    const resources = ["collection", "tool", "map", "catalog", "quiz", "code", "checklist"].map(kind => ({
      href: `/${namespace}/${kind}/reference`, title: kind, kind: `game_${kind}_pages_view`, image: null
    }));
    for (const canonical_path of [`/${namespace}`, `/${namespace}/wiki`]) {
      const page = { id: "wiki", game_id: "root-game", slug: "root", game_kind: "franchise", title: "Example Wiki", game_title: "Example", canonical_path } as SharedGameWikiPage;
      const directoryPages = [
        ...[`/${namespace}`, `/${namespace}/wiki`].map(href => ({ href, title: "Self", kind: "game_wiki_pages_view", image: null })),
        ...children, ...resources
      ];
      const $ = load(renderToStaticMarkup(await renderGameWikiPage({ page, namespace, namespaceTitle: "Example", directoryPages })));
      const visiblePaths = $("#article-body [data-card-type='wiki'] a").map((_, link) => $(link).attr("href")).get();
      expect(visiblePaths).toEqual(children.map(child => child.href));
      expect($("#article-body .ads-content-game-collection")).toHaveLength(0);
      for (const resource of resources) expect($(`#article-body a[href='${resource.href}']`)).toHaveLength(0);
      const schema = JSON.parse($("script[type='application/ld+json']").text())["@graph"][0];
      expect(schema["@type"]).toBe("CollectionPage");
      expect(schema.mainEntity.numberOfItems).toBe(visiblePaths.length);
      expect(schema.mainEntity.itemListElement).toEqual(children.map((child, index) => ({
        "@type": "ListItem", position: index + 1, name: child.title, url: `https://bloxodes.com${child.href}`
      })));
    }
    expect(mocks.collections).not.toHaveBeenCalled();
  });

  it("keeps an empty published hub empty without falling back to collections", async () => {
    const page = { id: "wiki", game_id: "root-game", slug: "root", game_kind: "franchise", title: "Example Wiki", game_title: "Example", canonical_path: "/example/wiki" } as SharedGameWikiPage;
    const $ = load(renderToStaticMarkup(await renderGameWikiPage({ page, namespace: "example", namespaceTitle: "Example" })));
    expect($("#article-body [data-journey-item]")).toHaveLength(0);
    const schema = JSON.parse($("script[type='application/ld+json']").text())["@graph"][0];
    expect(schema.mainEntity).toMatchObject({ numberOfItems: 0, itemListElement: [] });
    expect(mocks.collections).not.toHaveBeenCalled();
  });
});

describe("individual game and edition collections", () => {
  it.each(["child", "edition"])("keeps %s collections and matches their displayed order in the ItemList", async slug => {
    const canonical_path = slug === "edition" ? "/example/edition/wiki" : "/example/wiki/child";
    const page = { id: "wiki", game_id: slug, slug, game_kind: "game", title: "Example Wiki", game_title: "Example", canonical_path } as SharedGameWikiPage;
    const directoryPages = [{ href: "/example/wiki/sibling", title: "Sibling", kind: "game_wiki_pages_view", image: null }];
    const $ = load(renderToStaticMarkup(await renderGameWikiPage({ page, namespace: "example", namespaceTitle: "Example", directoryPages })));
    expect(mocks.collections).toHaveBeenCalledWith(slug);
    expect($("#article-body [data-card-type='wiki']")).toHaveLength(0);
    const visiblePaths = $("#article-body .ads-content-game-collection a").map((_, link) => $(link).attr("href")).get();
    expect(visiblePaths).toEqual([`${canonical_path}/database`, `${canonical_path}/collectible`]);
    const schema = JSON.parse($("script[type='application/ld+json']").text())["@graph"][0];
    expect(schema.mainEntity.numberOfItems).toBe(2);
    expect(schema.mainEntity.itemListElement.map((entry: { url: string }) => entry.url)).toEqual(visiblePaths.map(path => `https://bloxodes.com${path}`));
  });
});
