import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import markerSnapshot from "@/data/gta5-map-marker-snapshot.json";
import points from "@/data/gta5-map-points.json";
import places from "@/data/gta5-map-places.json";
import { getGameMapBySlug } from "@/lib/game-extra-pages";
const { getGtaWikiCollectionPageByPath } = vi.hoisted(() => ({ getGtaWikiCollectionPageByPath: vi.fn(async () => null) }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/game-extra-pages", () => ({
  getGameMapBySlug: vi.fn(async () => ({canonical_path:"/gta/maps/gta5",renderer_key:"gta5",map_data:{points,places,markerSnapshot}}))
}));
vi.mock("@/lib/shared-game-reader", () => ({ createGameReader: () => ({
  getSharedGameWikiCollectionPageByPath: getGtaWikiCollectionPageByPath,
  getPublishedSharedGameWikiCollectionRuntime: vi.fn(async () => null)
}) }));

import { getGta5MapMarkers } from "@/lib/gta-map";

describe("GTA V map availability", () => {
  it("rewrites fallback guide links for a moved map without changing progress identity", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(getGameMapBySlug).mockResolvedValueOnce({
      canonical_path: "/maps/gta5", renderer_key: "gta5", map_data: { points, places, markerSnapshot }
    } as NonNullable<Awaited<ReturnType<typeof getGameMapBySlug>>>);
    const markers = await getGta5MapMarkers();
    expect(markers.slice(0, 377)).toEqual(markerSnapshot.map(marker => ({
      ...marker, guideUrl: marker.guideUrl?.replace(/^\/gta\/wiki\//, "/wiki/") ?? null
    })));
    expect(markers.slice(0, 377).map(({ id, collectionCode }) => ({ id, collectionCode })))
      .toEqual(markerSnapshot.map(({ id, collectionCode }) => ({ id, collectionCode })));
  });
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
