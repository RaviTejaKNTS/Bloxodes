import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/public-content-cache", () => ({
  publicContentCache: (loader: () => Promise<unknown>) => loader
}));
vi.mock("@/lib/wiki-collections", () => ({
  getWikiCollectionPageByCode: vi.fn(async () => ({
    code: "example-items",
    wiki_slug: "example",
    thumb_url: null,
    published_dataset_id: "dataset-1"
  }))
}));
vi.mock("@/lib/wiki", () => ({
  getWikiPageBySlug: vi.fn(async () => ({ cover_image: "https://media.bloxodes.com/wiki/example/cover.webp" }))
}));
vi.mock("@/lib/wiki-collection-runtime", () => ({
  listPublishedWikiCollectionRuntimeImages: vi.fn(async () => [
    "https://media.bloxodes.com/wiki/1/items/first.webp"
  ]),
  shouldFallbackToLocalWikiCollectionData: vi.fn(() => true)
}));

describe("listGameCollectionImageUrls", () => {
  beforeEach(() => vi.resetModules());

  it("uses published R2 images before attempting a local dataset lookup", async () => {
    const { listGameCollectionImageUrls } = await import("@/lib/game-collection-images");
    await expect(listGameCollectionImageUrls("example-items", 6)).resolves.toEqual([
      "https://media.bloxodes.com/wiki/1/items/first.webp"
    ]);
  });

  it("uses the owning wiki cover for zero-image cards and social previews", async () => {
    const { listPublishedWikiCollectionRuntimeImages } = await import("@/lib/wiki-collection-runtime");
    vi.mocked(listPublishedWikiCollectionRuntimeImages).mockResolvedValueOnce([]);
    const { listGameCollectionImageUrls, getWikiCollectionFallbackImage } = await import("@/lib/game-collection-images");
    const cover = "https://media.bloxodes.com/wiki/example/cover.webp";
    await expect(listGameCollectionImageUrls("example-items")).resolves.toEqual([cover]);
    await expect(getWikiCollectionFallbackImage({ wiki_slug: "example", thumb_url: "/Bloxodes.png" })).resolves.toBe(cover);
  });

  it("does not hide a missing database runtime with game artwork", async () => {
    const { listPublishedWikiCollectionRuntimeImages } = await import("@/lib/wiki-collection-runtime");
    vi.mocked(listPublishedWikiCollectionRuntimeImages).mockResolvedValueOnce(null);
    const { listGameCollectionImageUrls } = await import("@/lib/game-collection-images");
    await expect(listGameCollectionImageUrls("example-items")).rejects.toThrow("did not load");
  });
});
