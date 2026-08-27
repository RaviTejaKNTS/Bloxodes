import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/public-content-cache", () => ({
  publicContentCache: (loader: () => Promise<unknown>) => loader
}));
vi.mock("@/lib/game-collections", () => ({
  getGameCollectionConfigByCode: vi.fn(() => null)
}));
vi.mock("@/lib/wiki-collections", () => ({
  getWikiCollectionPageByCode: vi.fn(async () => ({
    code: "example-items",
    published_dataset_id: "dataset-1"
  }))
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
});
