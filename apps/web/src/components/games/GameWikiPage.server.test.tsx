import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SharedGameWikiPage } from "@/lib/shared-game-reader";

const mocks = vi.hoisted(() => ({ directory: vi.fn(), render: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/game-registry", () => ({ getGameDirectoryPages: mocks.directory }));
vi.mock("./GameRelatedLinks", () => ({ GameRelatedLinks: () => null }));
vi.mock("./GameWikiPage", () => ({ renderGameWikiPage: mocks.render }));

import { renderGameWikiPage } from "./GameWikiPage.server";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.directory.mockResolvedValue([{ href: "/example/wiki/child", title: "Child", kind: "game_wiki_pages_view", image: null }]);
});

describe("wiki route navigation adapter", () => {
  it.each([
    { game_kind: "franchise", canonical_path: "/example/wiki", gameId: undefined },
    { game_kind: "game", canonical_path: "/example", gameId: "owner" }
  ])("loads the directory for $canonical_path with $game_kind scope", async ({ game_kind, canonical_path, gameId }) => {
    const page = { game_kind, canonical_path, game_id: "owner" } as SharedGameWikiPage;
    await renderGameWikiPage({ page, namespace: "example", namespaceTitle: "Example" });
    expect(mocks.directory).toHaveBeenCalledWith("example", gameId);
    const props = mocks.render.mock.calls[0][0];
    expect(props.directoryPages).toEqual(await mocks.directory.mock.results[0].value);
    expect(props.sidebarContent.props).toEqual({ namespace: "example", gameId, canonicalPath: canonical_path });
  });

  it("passes child navigation as a server component without loading an unused body directory", async () => {
    const page = { game_kind: "game", canonical_path: "/example/wiki/child", game_id: "child" } as SharedGameWikiPage;
    const extraLinks = [{ href: "/example/maps/child", title: "Map" }];
    await renderGameWikiPage({ page, namespace: "example", namespaceTitle: "Example", extraLinks });
    expect(mocks.directory).not.toHaveBeenCalled();
    const props = mocks.render.mock.calls[0][0];
    expect(props.directoryPages).toEqual([]);
    expect(props.extraLinks).toBe(extraLinks);
    expect(props.sidebarContent.props).toEqual({ namespace: "example", gameId: "child", canonicalPath: page.canonical_path });
  });
});
