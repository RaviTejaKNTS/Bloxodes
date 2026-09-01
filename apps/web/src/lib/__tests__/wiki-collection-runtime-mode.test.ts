import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: <T extends (...args: never[]) => unknown>(loader: T) => loader }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: vi.fn() }));
vi.mock("@/lib/wiki-collections", () => ({ getWikiCollectionPageByCode: vi.fn() }));
vi.mock("@/lib/wiki-media", () => ({ resolveWikiMediaUrl: vi.fn((key) => key) }));

describe("wiki collection runtime source policy", () => {
  const originalMode = process.env.WIKI_COLLECTION_DATA_SOURCE;

  afterEach(() => {
    if (originalMode === undefined) delete process.env.WIKI_COLLECTION_DATA_SOURCE;
    else process.env.WIKI_COLLECTION_DATA_SOURCE = originalMode;
  });

  it("always uses database-only mode and disables local fallback", async () => {
    process.env.WIKI_COLLECTION_DATA_SOURCE = "local-only";
    const {
      requiresWikiCollectionDatabase,
      shouldFallbackToLocalWikiCollectionData,
      shouldReadWikiCollectionDatabase,
      wikiCollectionRuntimeMode
    } =
      await import("@/lib/wiki-collection-runtime");

    expect(wikiCollectionRuntimeMode()).toBe("database-only");
    expect(shouldReadWikiCollectionDatabase()).toBe(true);
    expect(requiresWikiCollectionDatabase("the-forge-ores")).toBe(true);
    expect(shouldFallbackToLocalWikiCollectionData("the-forge-ores")).toBe(false);
  });

  it("requires database runtime for every collection code", async () => {
    const { requiresWikiCollectionDatabase, shouldFallbackToLocalWikiCollectionData } =
      await import("@/lib/wiki-collection-runtime");
    const codes = [
      "1-speed-keyboard-escape-trails",
      "99-nights-in-the-forest-classes",
      "brookhaven-rp-vehicles",
      "dress-to-impress-themes",
      "grow-a-garden-crops",
      "jujutsu-shenanigans-characters",
      "murderers-vs-sheriffs-weapons",
      "rivals-weapons",
      "sell-lemons-income-sources",
      "slime-rng-slimes",
      "survive-zombie-arena-classes",
      "the-forge-ores",
      "wizard-alchemy-potions",
      "bee-swarm-simulator-bees",
      "blue-lock-rivals-styles",
      "build-a-boat-for-treasure-blocks",
      "doors-entities",
      "flee-the-facility-maps",
      "tower-defense-simulator-towers",
      "volleyball-legends-styles",
      "welcome-to-bloxburg-recipes"
    ];

    for (const code of codes) {
      expect(requiresWikiCollectionDatabase(code)).toBe(true);
      expect(shouldFallbackToLocalWikiCollectionData(code)).toBe(false);
    }
    expect(requiresWikiCollectionDatabase("grow-a-garden-2-mutations")).toBe(true);
    expect(shouldFallbackToLocalWikiCollectionData("grow-a-garden-2-mutations")).toBe(false);
    expect(shouldFallbackToLocalWikiCollectionData("any-game-any-collection")).toBe(false);
  });
});
