import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGrowGardenCollectionConfig, loadPreparedGrowGardenCollection
} from "@/app/(site)/wiki/collections/games/grow-a-garden";
import {
  getTheForgeCollectionConfig, loadPreparedTheForgeCollection
} from "@/app/(site)/wiki/collections/games/the-forge";

const { loadRuntime } = vi.hoisted(() => ({ loadRuntime: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/wiki-collection-runtime", () => ({ getPublishedWikiCollectionRuntimeByCode: loadRuntime }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T extends (...args: never[]) => unknown>(loader: T) => loader };
});

function runtimeWithItems(count: number) {
  return {
    document: {
      meta: { schemaVersion: 2 },
      items: Array.from({ length: count }, (_, index) => ({
        item: { name: `Test Item ${index + 1}`, rarity: "Common" },
        system: { slug: `test-item-${index + 1}`, image: null }
      }))
    }
  };
}

beforeEach(() => { loadRuntime.mockReset(); });

// React cache is an identity above: each call models a new request, without
// memoization carried over from an earlier server render.
const collections = [
  {
    game: "Grow a Garden",
    load: () => loadPreparedGrowGardenCollection(getGrowGardenCollectionConfig("pets")!)
  },
  {
    game: "The Forge",
    load: () => loadPreparedTheForgeCollection(getTheForgeCollectionConfig("ores")!)
  }
];

describe.each(collections)("$game prepared collection requests", ({ load }) => {
  it("reads the newly published revision on a later request", async () => {
    loadRuntime.mockResolvedValueOnce(runtimeWithItems(453));
    const original = await load();
    expect(original.itemCount).toBe(453);
    expect(original.dataset.items).toHaveLength(453);

    loadRuntime.mockResolvedValueOnce(runtimeWithItems(461));
    const published = await load();
    expect(published.itemCount).toBe(461);
    expect(published.dataset.items).toHaveLength(461);
    expect(published.dataset.items[460].name).toBe("Test Item 461");
    expect(published.groupedSections.flatMap((section) => section.items)).toHaveLength(461);
    expect(loadRuntime).toHaveBeenCalledTimes(2);
  });

  it("recovers on a later request after a transient database failure", async () => {
    loadRuntime.mockRejectedValueOnce(new Error("Cloudflare 504"));
    await expect(load()).rejects.toThrow("Cloudflare 504");

    loadRuntime.mockResolvedValueOnce(runtimeWithItems(1));
    const recovered = await load();
    expect(recovered.itemCount).toBe(1);
    expect(recovered.totalPages).toBe(1);
    expect(loadRuntime).toHaveBeenCalledTimes(2);
  });
});
