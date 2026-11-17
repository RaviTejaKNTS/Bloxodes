import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGrowGardenCollectionConfig, getPreparedGrowGardenCollectionPageCount, loadPreparedGrowGardenCollection
} from "@/app/(site)/wiki/collections/games/grow-a-garden";
import {
  getTheForgeCollectionConfig, getPreparedTheForgeCollectionPageCount, loadPreparedTheForgeCollection
} from "@/app/(site)/wiki/collections/games/the-forge";

type CacheNode = { children: Map<unknown, CacheNode>; result?: { value: unknown } };

const { loadRuntime, requestScope } = await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  return {
    loadRuntime: vi.fn(),
    requestScope: new AsyncLocalStorage<Map<object, CacheNode>>()
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/wiki-collection-runtime", () => ({ getPublishedWikiCollectionRuntimeByCode: loadRuntime }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    // Model React's argument-identity memoization, with a fresh cache per request.
    // Store pending/rejected promises too, so concurrent reads share one load.
    cache: <Args extends unknown[], Result>(loader: (...args: Args) => Result) => {
      const key = {};
      return (...args: Args): Result => {
        const request = requestScope.getStore();
        if (!request) return loader(...args);
        let node: CacheNode = request.get(key)!;
        if (!node) {
          node = { children: new Map() };
          request.set(key, node);
        }
        for (const arg of args) {
          let child: CacheNode | undefined = node.children.get(arg);
          if (!child) {
            child = { children: new Map() };
            node.children.set(arg, child);
          }
          node = child;
        }
        if (!node.result) node.result = { value: loader(...args) };
        return node.result.value as Result;
      };
    }
  };
});

function inRequest<T>(read: () => Promise<T>): Promise<T> {
  return requestScope.run(new Map(), read);
}

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

// Use fresh config objects on every call to catch object-identity cache keys.
const collections = [
  {
    game: "Grow a Garden",
    load: () => loadPreparedGrowGardenCollection({ ...getGrowGardenCollectionConfig("pets")! }),
    pageCount: () => getPreparedGrowGardenCollectionPageCount({ ...getGrowGardenCollectionConfig("pets")! })
  },
  {
    game: "The Forge",
    load: () => loadPreparedTheForgeCollection({ ...getTheForgeCollectionConfig("ores")! }),
    pageCount: () => getPreparedTheForgeCollectionPageCount({ ...getTheForgeCollectionConfig("ores")! })
  }
];

describe.each(collections)("$game prepared collection requests", ({ load, pageCount }) => {
  it("shares concurrent reads and the page-count helper, then reads the next published revision", async () => {
    loadRuntime.mockResolvedValueOnce(runtimeWithItems(453));
    const original = await inRequest(async () => {
      const [first, second, pages] = await Promise.all([load(), load(), pageCount()]);
      expect(second).toBe(first);
      expect(pages).toBe(first.totalPages);
      expect(first.itemCount).toBe(453);
      expect(first.dataset.items).toHaveLength(453);
      expect(loadRuntime).toHaveBeenCalledTimes(1);
      // Reuse also lasts through later reads in this same request.
      expect(await load()).toBe(first);
      expect(loadRuntime).toHaveBeenCalledTimes(1);
      return first;
    });

    loadRuntime.mockResolvedValueOnce(runtimeWithItems(461));
    await inRequest(async () => {
      const [published, second, pages] = await Promise.all([load(), load(), pageCount()]);
      expect(published).not.toBe(original);
      expect(second).toBe(published);
      expect(pages).toBe(published.totalPages);
      expect(published.itemCount).toBe(461);
      expect(published.dataset.items).toHaveLength(461);
      expect(published.dataset.items[460].name).toBe("Test Item 461");
      expect(published.groupedSections.flatMap((section) => section.items)).toHaveLength(461);
      expect(loadRuntime).toHaveBeenCalledTimes(2);
    });
  });

  it("shares a failed load within a request and recovers in the next request", async () => {
    const failure = new Error("Cloudflare 504");
    loadRuntime.mockRejectedValueOnce(failure);
    await inRequest(async () => {
      const reads = await Promise.allSettled([load(), load(), pageCount()]);
      for (const read of reads) {
        expect(read).toEqual({ status: "rejected", reason: failure });
      }
      await expect(load()).rejects.toBe(failure);
      expect(loadRuntime).toHaveBeenCalledTimes(1);
    });

    loadRuntime.mockResolvedValueOnce(runtimeWithItems(1));
    await inRequest(async () => {
      const [recovered, second, pages] = await Promise.all([load(), load(), pageCount()]);
      expect(second).toBe(recovered);
      expect(recovered.itemCount).toBe(1);
      expect(recovered.totalPages).toBe(1);
      expect(pages).toBe(1);
      expect(loadRuntime).toHaveBeenCalledTimes(2);
    });
  });
});
