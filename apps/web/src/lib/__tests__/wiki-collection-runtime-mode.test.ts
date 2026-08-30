import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: <T extends (...args: never[]) => unknown>(loader: T) => loader }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: vi.fn() }));
vi.mock("@/lib/wiki-collections", () => ({ getWikiCollectionPageByCode: vi.fn() }));
vi.mock("@/lib/wiki-media", () => ({ resolveWikiMediaUrl: vi.fn((key) => key) }));

describe("wiki collection runtime source policy", () => {
  const originalMode = process.env.WIKI_COLLECTION_DATA_SOURCE;
  const originalRequired = process.env.WIKI_COLLECTION_DATABASE_REQUIRED_CODES;

  beforeEach(() => {
    process.env.WIKI_COLLECTION_DATA_SOURCE = "database-first";
    process.env.WIKI_COLLECTION_DATABASE_REQUIRED_CODES =
      "flee-the-facility-beast-powers, the-forge-ores";
  });

  afterEach(() => {
    if (originalMode === undefined) delete process.env.WIKI_COLLECTION_DATA_SOURCE;
    else process.env.WIKI_COLLECTION_DATA_SOURCE = originalMode;
    if (originalRequired === undefined) delete process.env.WIKI_COLLECTION_DATABASE_REQUIRED_CODES;
    else process.env.WIKI_COLLECTION_DATABASE_REQUIRED_CODES = originalRequired;
  });

  it("disables local fallback for migrated games and exact staged collection codes", async () => {
    const { requiresWikiCollectionDatabase, shouldFallbackToLocalWikiCollectionData } =
      await import("@/lib/wiki-collection-runtime");

    expect(requiresWikiCollectionDatabase("the-forge-ores")).toBe(true);
    expect(shouldFallbackToLocalWikiCollectionData("the-forge-ores")).toBe(false);
    expect(shouldFallbackToLocalWikiCollectionData("the-forge-weapons")).toBe(false);
    expect(shouldFallbackToLocalWikiCollectionData("flee-the-facility-beast-powers")).toBe(false);
    expect(shouldFallbackToLocalWikiCollectionData("flee-the-facility-maps")).toBe(false);
  });

  it("requires database runtime for every migrated game group", async () => {
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
    expect(requiresWikiCollectionDatabase("grow-a-garden-2-mutations")).toBe(false);
    expect(shouldFallbackToLocalWikiCollectionData("grow-a-garden-2-mutations")).toBe(true);
  });

  it("disables every local fallback in database-only mode", async () => {
    process.env.WIKI_COLLECTION_DATA_SOURCE = "database-only";
    const { shouldFallbackToLocalWikiCollectionData } = await import("@/lib/wiki-collection-runtime");

    expect(shouldFallbackToLocalWikiCollectionData("any-game-any-collection")).toBe(false);
  });
});
