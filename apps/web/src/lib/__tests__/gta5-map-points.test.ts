import { describe, expect, it } from "vitest";
import points from "@/data/gta5-map-points.json";
import markerSnapshot from "@/data/gta5-map-marker-snapshot.json";
import places from "@/data/gta5-map-places.json";
import { GTA5_MAP_LAYERS } from "@/lib/gta-map-types";

describe("GTA V Story Mode map annotations", () => {
  it("maps all 377 guide items and keeps the shared Altruist Camp anchor explicit", () => {
    const expectedCounts = new Map([
      ["spaceship-parts", 50],
      ["letter-scraps", 50],
      ["stunt-jumps", 50],
      ["under-the-bridge", 50],
      ["knife-flights", 15],
      ["nuclear-waste", 30],
      ["submarine-pieces", 30],
      ["monkey-mosaics", 50],
      ["peyote-plants", 27],
      ["epsilon-tracts", 10],
      ["hidden-packages", 15]
    ]);
    const all = GTA5_MAP_LAYERS.filter((layer) => layer.group !== "Places").flatMap((layer) => {
      const rows = points[layer.slug as keyof typeof points];
      const count = expectedCounts.get(layer.slug)!;
      expect(layer.count).toBe(count);
      expect(rows).toHaveLength(count);
      expect(rows.map((row) => row.number)).toEqual(Array.from({ length: count }, (_, index) => index + 1));
      const exactRows = layer.slug === "hidden-packages" ? rows.slice(0, 11) : rows;
      expect(new Set(exactRows.map((row) => row.sourceIndex)).size).toBe(exactRows.length);
      expect(new Set(exactRows.map((row) => `${row.x},${row.y}`)).size).toBe(exactRows.length);
      rows.forEach((row) => {
        if (row.sourceIndex !== null) {
          expect(row.sourceIndex).toBeGreaterThanOrEqual(1);
          expect(row.sourceIndex).toBeLessThanOrEqual(count);
        }
        // GTADB's GTA V tile plane is 32768 × 32768, centered on game x/y = 0.
        expect(row.x + 16384).toBeGreaterThan(0);
        expect(row.x + 16384).toBeLessThan(32768);
        expect(16384 - row.y).toBeGreaterThan(0);
        expect(16384 - row.y).toBeLessThan(32768);
      });
      return rows;
    });
    expect(all).toHaveLength(377);
    expect(points["hidden-packages"].slice(11).every((point) => point.sourceIndex === null)).toBe(true);
    expect(places).toHaveLength(92);
    expect(new Set(places.map((place) => place.id)).size).toBe(92);
    for (const layer of GTA5_MAP_LAYERS.filter((layer) => layer.group === "Places")) {
      expect(places.filter((place) => place.group === layer.slug)).toHaveLength(layer.count);
    }
  });

  it("keeps the outage fallback aligned with every mapped guide item", () => {
    expect(markerSnapshot).toHaveLength(377);
    expect(new Set(markerSnapshot.map((marker) => marker.id)).size).toBe(377);
    for (const marker of markerSnapshot) {
      const point = points[marker.layer as keyof typeof points][marker.number - 1];
      expect(marker.x).toBe(point.x);
      expect(marker.y).toBe(point.y);
      expect(marker.name).toBeTruthy();
      expect(marker.guideUrl).toContain(`/gta/wiki/gta-5/${marker.layer}#item-${marker.id}`);
    }
  });
});
