import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import markerSnapshot from "@/data/gta5-map-marker-snapshot.json";
import { getGtaWikiCollectionPageByPath } from "@/lib/gta";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/gta", () => ({
  buildGtaCollectionPath: (game: string, collection: string) => `/gta/wiki/${game}/${collection}`,
  getGtaWikiCollectionPageByPath: vi.fn(async () => null),
  getPublishedGtaWikiCollectionRuntime: vi.fn(async () => null)
}));

import { getGta5MapMarkers } from "@/lib/gta-map";

describe("GTA V map availability", () => {
  beforeEach(() => {
    vi.mocked(getGtaWikiCollectionPageByPath).mockResolvedValue(null);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("serves the verified marker snapshot when collection lookup fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const markers = await getGta5MapMarkers();
    expect(markers).toHaveLength(469);
    expect(markers.slice(0, 377)).toEqual(markerSnapshot);
    expect(markers.slice(377).every((marker) => marker.collectionCode === null)).toBe(true);
  });

  it("returns the fallback promptly when collection lookups hang", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(getGtaWikiCollectionPageByPath).mockImplementation(() => new Promise(() => {}));
    vi.useFakeTimers();
    const result = getGta5MapMarkers();
    await vi.advanceTimersByTimeAsync(3500);
    expect((await result).slice(0, 377)).toEqual(markerSnapshot);
  });
});
