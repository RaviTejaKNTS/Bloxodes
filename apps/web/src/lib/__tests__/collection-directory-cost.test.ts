import { beforeEach, describe, expect, it, vi } from "vitest";
import { getGameDirectoryPages } from "../game-registry";

const mocks = vi.hoisted(() => ({ tables: [] as string[], images: vi.fn().mockResolvedValue(["https://example.com/item.png"]) }));
vi.mock("server-only", () => ({}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), cache: (loader: unknown) => loader }));
vi.mock("../game-artwork", () => ({ readGameArtwork: async () => ({ cover_image: null }) }));
vi.mock("../shared-game-reader", () => ({ createGameReader: () => ({ listPublishedSharedGameWikiCollectionImageUrls: mocks.images }) }));
vi.mock("../supabase", () => ({ supabaseAdmin: () => ({ from: (table: string) => {
  mocks.tables.push(table);
  const query = {
    select: () => query, eq: () => query, not: () => query,
    order: async () => ({ data: table === "game_collection_pages_view" ? [{ id: "collection", game_id: "game", title: "Items", canonical_path: "/wiki/game/items" }] : [], error: null })
  };
  return query;
} }) }));

beforeEach(() => { mocks.tables.length = 0; mocks.images.mockClear(); });

describe("collection sidebar directory cost", () => {
  it("skips the collection query and every collection image lookup when requested", async () => {
    expect(await getGameDirectoryPages("example", "game", false)).toEqual([]);
    expect(mocks.tables).toHaveLength(8);
    expect(mocks.tables).not.toContain("game_collection_pages_view");
    expect(mocks.images).not.toHaveBeenCalled();
  });

  it("preserves collection images for existing directory callers", async () => {
    const pages = await getGameDirectoryPages("example", "game");
    expect(mocks.tables).toHaveLength(9);
    expect(mocks.images).toHaveBeenCalledTimes(1);
    expect(pages).toEqual([{ kind: "game_collection_pages_view", href: "/wiki/game/items", title: "Items", image: "https://example.com/item.png" }]);
  });
});
