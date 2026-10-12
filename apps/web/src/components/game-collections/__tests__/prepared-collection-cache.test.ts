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

const runtime = {
  document: {
    meta: { schemaVersion: 2 },
    items: [{ item: { name: "Test Item", rarity: "Common" }, system: { slug: "test-item", image: null } }]
  }
};

beforeEach(() => { loadRuntime.mockReset(); });

describe("prepared collection promise caches", () => {
  it("retries Grow a Garden crafting recipes after a transient database failure", async () => {
    const config = getGrowGardenCollectionConfig("crafting-recipes")!;
    loadRuntime.mockRejectedValueOnce(new Error("Cloudflare 504"));
    loadRuntime.mockResolvedValueOnce(runtime);

    const [first, concurrent] = await Promise.allSettled([
      loadPreparedGrowGardenCollection(config), loadPreparedGrowGardenCollection(config)
    ]);
    expect(first.status).toBe("rejected");
    expect(concurrent.status).toBe("rejected");
    expect(loadRuntime).toHaveBeenCalledTimes(1);

    const recovered = await loadPreparedGrowGardenCollection(config);
    expect(recovered.itemCount).toBe(1);
    expect(recovered.totalPages).toBe(1);
    expect(await loadPreparedGrowGardenCollection(config)).toBe(recovered);
    expect(loadRuntime).toHaveBeenCalledTimes(2);
  });

  it("retries The Forge after a transient database failure", async () => {
    const config = getTheForgeCollectionConfig("ores")!;
    loadRuntime.mockRejectedValueOnce(new Error("Cloudflare 504"));
    loadRuntime.mockResolvedValueOnce(runtime);

    await expect(loadPreparedTheForgeCollection(config)).rejects.toThrow("Cloudflare 504");
    const recovered = await loadPreparedTheForgeCollection(config);
    expect(recovered.itemCount).toBe(1);
    expect(await loadPreparedTheForgeCollection(config)).toBe(recovered);
    expect(loadRuntime).toHaveBeenCalledTimes(2);
  });
});
