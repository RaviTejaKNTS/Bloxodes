import { describe, expect, it } from "vitest";
import registry from "@/data/gta-maps/registry.json";
import sanAndreas from "@/data/gta-maps/gta-san-andreas.json";
import viceCity from "@/data/gta-maps/gta-vice-city.json";
import gtaThree from "@/data/gta-maps/gta-iii.json";
import gtaFour from "@/data/gta-maps/gta-4.json";
import libertyCityStories from "@/data/gta-maps/gta-liberty-city-stories.json";
import viceCityStories from "@/data/gta-maps/gta-vice-city-stories.json";
import chinatownWars from "@/data/gta-maps/gta-chinatown-wars.json";
import gtaOnline from "@/data/gta-maps/gta-online.json";
import { getGtaMapRouteForWikiSlug } from "@/lib/gta-interactive-map-registry";

const mapFiles = {
  "gta-san-andreas": sanAndreas,
  "gta-vice-city": viceCity,
  "gta-iii": gtaThree,
  "gta-4": gtaFour,
  "gta-liberty-city-stories": libertyCityStories,
  "gta-vice-city-stories": viceCityStories,
  "gta-chinatown-wars": chinatownWars,
  "gta-online": gtaOnline
} as const;

describe("GTA interactive map data", () => {
  it("includes all eight reviewed maps and keeps every point inside a declared view", () => {
    expect(registry).toHaveLength(8);
    const slugs = new Set(registry.map((map) => map.slug));
    expect(slugs).toEqual(new Set(Object.keys(mapFiles)));

    for (const map of registry) {
      const points = mapFiles[map.slug as keyof typeof mapFiles].points;
      expect(points).toHaveLength(map.mappedPointCount);
      expect(new Set(points.map((point) => point.id)).size).toBe(points.length);
      const views = new Map(map.views.map((view) => [view.slug, view]));
      const layers = new Map(map.layers.map((layer) => [layer.slug, layer]));

      for (const point of points) {
        const view = views.get(point.view);
        expect(view, map.slug + "/" + point.id + " has a declared map view").toBeTruthy();
        expect(layers.has(point.layer), map.slug + "/" + point.id + " has a declared layer").toBe(true);
        expect(point.sourceUrl).toMatch(/^https:\/\/gta\.wiki\/w\/Map:/);
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(view!.width);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(view!.height);
      }

      for (const layer of map.layers) {
        const layerPoints = points.filter((point) => point.layer === layer.slug);
        expect(layerPoints).toHaveLength(layer.pointCount);
        if (!layer.collection) continue;
        const mappedItems = layer.collection.collectionSlug === "drug-dealers"
          ? new Set(layerPoints.filter((point) => point.collectionName).map((point) => point.collectionName))
          : new Set(layerPoints.map((point) => point.collectionNumber).filter((number) => number !== null));
        expect(mappedItems.size, map.slug + "/" + layer.slug + " maps every guide item once").toBe(layer.collectionCount);
      }
    }
  });

  it("keeps special map and checklist differences explicit", () => {
    const gtaThreeRampages = gtaThree.points.filter((point) => point.layer === "rampages");
    expect(gtaThreeRampages).toHaveLength(40);
    expect(new Set(gtaThreeRampages.map((point) => point.collectionNumber)).size).toBe(20);
    expect(new Set(gtaThreeRampages.map((point) => point.variant))).toEqual(new Set(["original", "alternate"]));

    const viceCityStoriesRampages = viceCityStories.points.filter((point) => point.layer === "rampages");
    expect(viceCityStoriesRampages).toHaveLength(36);
    expect(new Set(viceCityStoriesRampages.map((point) => point.collectionNumber)).size).toBe(35);
    expect(viceCityStoriesRampages.filter((point) => point.collectionNumber === 15).map((point) => point.edition).sort()).toEqual(["ps2", "psp"]);

    const balloons = viceCityStories.points.filter((point) => point.layer === "red-balloons");
    expect(new Set(balloons.map((point) => point.collectionNumber))).toEqual(new Set(Array.from({ length: 99 }, (_, index) => index + 1)));

    const dealers = chinatownWars.points.filter((point) => point.layer === "drug-dealers");
    expect(dealers).toHaveLength(81);
    expect(dealers.filter((point) => point.referenceOnly)).toHaveLength(1);
    expect(dealers.filter((point) => point.collectionName)).toHaveLength(80);
    expect(chinatownWars.points.filter((point) => point.layer === "lions-of-fo")).toHaveLength(20);

    const online = registry.find((map) => map.slug === "gta-online")!;
    expect(online.guideOnly).toHaveLength(6);
    expect(gtaOnline.points.filter((point) => point.layer === "air-freight-signal-jammers")).toHaveLength(7);
    expect(gtaOnline.points.filter((point) => point.seasonal)).toHaveLength(76);

    const sanAndreasMap = registry.find((map) => map.slug === "gta-san-andreas")!;
    expect(sanAndreasMap.views.map((view) => view.slug)).toEqual(["state", "los-santos", "san-fierro"]);
    expect(sanAndreas.points.filter((point) => point.layer === "snapshots")).toHaveLength(50);
    expect(sanAndreas.points.filter((point) => point.layer === "camera-locations")).toHaveLength(19);
  });

  it("connects game hubs and episodes to the correct map routes", () => {
    for (const slug of Object.keys(mapFiles)) {
      expect(getGtaMapRouteForWikiSlug(slug)).toBe("/gta/maps/" + slug);
    }
    expect(getGtaMapRouteForWikiSlug("gta-4-tlad")).toBe("/gta/maps/gta-4");
    expect(getGtaMapRouteForWikiSlug("gta-4-tbogt")).toBe("/gta/maps/gta-4");
    expect(getGtaMapRouteForWikiSlug("gta-5")).toBe("/gta/maps/gta5");
  });
});
