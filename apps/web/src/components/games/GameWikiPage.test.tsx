import { describe, expect, it, vi } from "vitest";
import { load } from "cheerio";
import { renderToStaticMarkup } from "react-dom/server";
import { renderGameWikiPage } from "./GameWikiPage";
import type { SharedGameWikiPage } from "@/lib/shared-game-reader";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/game-registry", () => ({ getGameDirectoryPages: async () => [] }));
vi.mock("./GameRelatedLinks", () => ({ GameRelatedLinks: () => null }));
vi.mock("@/components/comments/CommentsSection", () => ({ CommentsSection: () => null }));
vi.mock("@/lib/shared-game-reader", async () => {
  const { resolveGameCoverImage, resolveGameThumbnailImage } = await import("@/lib/game-images");
  return { createGameReader: () => ({
    listPublishedSharedGameWikiCollectionsByWikiSlug: async () => [],
    resolveSharedGameWikiCoverImage: (page: SharedGameWikiPage) => resolveGameCoverImage(page) || "",
    resolveSharedGameWikiThumbnailImage: (page: SharedGameWikiPage) => resolveGameThumbnailImage(page) || ""
  }) };
});

describe("franchise wiki image schema", () => {
  it.each([null, "https://media.bloxodes.com/child-cover.webp"])("only includes image when the game has artwork (%s)", async cover_image => {
    const page = { id: "wiki", game_id: "child", slug: "child", canonical_path: "/example/wiki/child", title: "Child Wiki", game_title: "Child", game_kind: "game", cover_image, game_cover_image: null, game_hero_image: null } as SharedGameWikiPage;
    const $ = load(renderToStaticMarkup(await renderGameWikiPage({ page, namespace: "example", namespaceTitle: "Example" })));
    const schema = JSON.parse($("script[type='application/ld+json']").text())["@graph"][0];
    if (cover_image) expect(schema.image).toBe(cover_image);
    else expect(schema).not.toHaveProperty("image");
  });
});
