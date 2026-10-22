import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SharedGameWikiPage } from "@/lib/shared-game-reader";
import type { GameWikiPresentationPage } from "@/lib/game-root-page";

const mocks = vi.hoisted(() => ({ directory: vi.fn(), wikis: vi.fn(), render: vi.fn(), reader: vi.fn() }));
vi.mock("@/lib/game-landing", () => ({ getGameLandingForLinks: async (namespace: string) => ({ path: `/${namespace}/wiki` }) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/game-registry", () => ({ getGameDirectoryPages: mocks.directory }));
vi.mock("@/lib/shared-game-reader", async () => {
  const { resolveGameCoverImage } = await import("@/lib/game-images");
  return { createGameReader: mocks.reader.mockImplementation(() => ({
    listPublishedSharedGameWikiPages: mocks.wikis,
    resolveSharedGameWikiCoverImage: resolveGameCoverImage
  })) };
});
vi.mock("./GameRelatedLinks", () => ({ GameRelatedLinks: () => null }));
vi.mock("./GameWikiPage", () => ({ renderGameWikiPage: mocks.render }));

import { renderGameWikiPage } from "./GameWikiPage.server";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.directory.mockResolvedValue([{ href: "/example/wiki/child", title: "Child", kind: "game_wiki_pages_view", image: null }]);
  mocks.wikis.mockResolvedValue([]);
});

describe("wiki route navigation adapter", () => {
  it("keeps alias directory and related-link queries tied to the rendered route", async () => {
    const page = { game_kind: "game", game_id: "owner", canonical_path: "/example", seo_canonical_path: "/example/wiki" } as GameWikiPresentationPage;
    await renderGameWikiPage({ page, namespace: "example", namespaceTitle: "Example" });
    expect(mocks.directory).toHaveBeenCalledWith("example", "owner");
    const props = mocks.render.mock.calls[0][0];
    expect(props.page).toBe(page);
    expect(props.sidebarContent.props.canonicalPath).toBe("/example");
    expect(props.directoryPages).toHaveLength(1);
  });
  it.each(["gta", "red-dead", "minecraft"])("loads only published game and edition wikis for both %s hub routes", async namespace => {
    const children = [
      { id: "child", canonical_path: `/${namespace}/wiki/child`, title: "Child Wiki", cover_image: "https://media.bloxodes.com/wiki-cover.webp", game_cover_image: "https://media.bloxodes.com/game-cover.webp" },
      { id: "edition", canonical_path: `/${namespace}/edition/wiki`, title: "Edition Wiki", cover_image: null, game_cover_image: "https://media.bloxodes.com/edition-cover.webp" }
    ];
    mocks.wikis.mockResolvedValue([
      { id: "root-wiki", canonical_path: `/${namespace}/wiki`, title: "Root Wiki" },
      { id: "root-alias", canonical_path: `/${namespace}`, title: "Root" },
      ...children
    ]);
    for (const canonical_path of [`/${namespace}`, `/${namespace}/wiki`]) {
      const page = { id: "root-wiki", game_kind: "franchise", canonical_path, game_id: "root" } as SharedGameWikiPage;
      await renderGameWikiPage({ page, namespace, namespaceTitle: "Example" });
      const props = mocks.render.mock.calls[mocks.render.mock.calls.length - 1]![0];
      expect(mocks.reader).toHaveBeenLastCalledWith(namespace);
      expect(props.directoryPages).toEqual(children.map(child => ({
        href: child.canonical_path, title: child.title, kind: "game_wiki_pages_view", image: child.cover_image || child.game_cover_image
      })));
      expect(props.sidebarContent.props).toEqual({ namespace, gameId: undefined, canonicalPath: canonical_path });
      expect(props.landingPath).toBe(`/${namespace}/wiki`);
    }
    expect(mocks.wikis).toHaveBeenCalledTimes(2);
    expect(mocks.directory).not.toHaveBeenCalled();
  });

  it("keeps resource discovery scoped to a standalone game's owner", async () => {
    const page = { game_kind: "game", canonical_path: "/example", game_id: "owner" } as SharedGameWikiPage;
    await renderGameWikiPage({ page, namespace: "example", namespaceTitle: "Example" });
    expect(mocks.directory).toHaveBeenCalledWith("example", "owner");
    expect(mocks.wikis).not.toHaveBeenCalled();
    const props = mocks.render.mock.calls[0][0];
    expect(props.directoryPages).toEqual(await mocks.directory.mock.results[0].value);
    expect(props.landingPath).toBe("/example/wiki");
    expect(props.sidebarContent.props).toEqual({ namespace: "example", gameId: "owner", canonicalPath: page.canonical_path });
  });

  it.each(["/example/wiki/child", "/example/edition/wiki", "/example/wiki"])("passes game navigation for %s without loading an unused body directory", async canonical_path => {
    const page = { game_kind: "game", canonical_path, game_id: "child" } as SharedGameWikiPage;
    const extraLinks = [{ href: "/example/maps/child", title: "Map" }];
    await renderGameWikiPage({ page, namespace: "example", namespaceTitle: "Example", extraLinks });
    expect(mocks.directory).not.toHaveBeenCalled();
    expect(mocks.wikis).not.toHaveBeenCalled();
    const props = mocks.render.mock.calls[0][0];
    expect(props.directoryPages).toEqual([]);
    expect(props.extraLinks).toBe(extraLinks);
    expect(props.sidebarContent.props).toEqual({ namespace: "example", gameId: "child", canonicalPath: page.canonical_path });
  });
});
