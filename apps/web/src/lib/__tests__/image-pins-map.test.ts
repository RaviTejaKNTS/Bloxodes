import { describe, expect, it } from "vitest";
import { IMAGE_PINS_LAYER_COLORS, IMAGE_PINS_UNCATEGORIZED, imagePinsMapPageData, imagePinsPoint } from "@/lib/image-pins-map";
import type { GameMapData } from "@/lib/game-page-data";

const page = { slug: "leonida", title: "Leonida map", game_title: "Example Game", meta_description: "Find every town.", canonical_path: "/maps/leonida", updated_at: "2026-11-23" };
const data: GameMapData = {
  image: "https://wiki-media.bloxodes.com/example/map.webp", width: 3600, height: 5024, attribution: "Map: Example Studio poster",
  markers: [
    { id: "north", title: "North County", category: "Counties", x: 50, y: 10, description: "The northern county." },
    { id: "city", title: "Big City", category: "Cities and towns", x: 80, y: 60, href: "/wiki/example/cities" },
    { id: "south", title: "South County", category: "Counties", x: 30, y: 90 },
    { id: "rock", title: "Lone Rock", x: 0, y: 0 }
  ]
};

describe("image-pins coordinates", () => {
  // Leaflet CRS.Simple: bounds [[0, 0], [height, width]], latitude grows upwards, so the image's top edge is lat = height.
  it.each([
    ["top-left", { x: 0, y: 0 }, { x: 0, y: 5024 }],
    ["top-right", { x: 100, y: 0 }, { x: 3600, y: 5024 }],
    ["bottom-left", { x: 0, y: 100 }, { x: 0, y: 0 }],
    ["bottom-right", { x: 100, y: 100 }, { x: 3600, y: 0 }],
    ["middle", { x: 50, y: 50 }, { x: 1800, y: 2512 }],
    ["upper third", { x: 25, y: 25 }, { x: 900, y: 3768 }]
  ])("puts the %s of the image at the matching map corner", (_label, percent, expected) => {
    const point = imagePinsPoint(percent, data);
    expect(point.x).toBeCloseTo(expected.x, 6);
    expect(point.y).toBeCloseTo(expected.y, 6);
  });

  it("converts every marker into viewer units on the single image view", () => {
    const map = imagePinsMapPageData(page, data, { title: "Example Game", path: "/wiki/example" });
    expect(map.config.views).toEqual([expect.objectContaining({ slug: "map", image: data.image, width: 3600, height: 5024 })]);
    const expected = { north: [1800, 4521.6], city: [2880, 2009.6], south: [1080, 502.4], rock: [0, 5024] };
    for (const marker of map.markers) {
      const [x, y] = expected[marker.id as keyof typeof expected];
      expect(marker.view).toBe("map");
      expect(marker.x).toBeCloseTo(x, 6);
      expect(marker.y).toBeCloseTo(y, 6);
    }
    expect(map.markers).toHaveLength(4);
  });
});

describe("image-pins layers", () => {
  const map = imagePinsMapPageData(page, data, { title: "Example Game", path: "/wiki/example" });

  it("makes one enabled layer per category in first-seen order, with stable colors and counts", () => {
    expect(map.layers.map(layer => [layer.slug, layer.label, layer.color, layer.pointCount, layer.defaultEnabled])).toEqual([
      ["counties", "Counties", IMAGE_PINS_LAYER_COLORS[0], 2, true],
      ["cities-and-towns", "Cities and towns", IMAGE_PINS_LAYER_COLORS[1], 1, true],
      ["other-locations", IMAGE_PINS_UNCATEGORIZED, IMAGE_PINS_LAYER_COLORS[2], 1, true]
    ]);
    expect(map.config.layers).toEqual(map.layers);
    expect(imagePinsMapPageData(page, data, { title: "", path: "/" }).layers.map(layer => layer.color)).toEqual(map.layers.map(layer => layer.color));
  });

  it("puts blank categories with uncategorized pins instead of an empty layer", () => {
    const blank = { ...data, markers: [{ ...data.markers[0], id: "blank", category: "  " }, { ...data.markers[0], id: "none", category: undefined }] };
    const layers = imagePinsMapPageData(page, blank, { title: "Example Game", path: "/wiki/example" }).layers;
    expect(layers.map(layer => [layer.label, layer.pointCount])).toEqual([[IMAGE_PINS_UNCATEGORIZED, 2]]);
  });

  it("joins each marker to its layer and keeps its copy and guide link", () => {
    const north = map.markers.find(marker => marker.id === "north")!;
    expect(north).toMatchObject({ name: "North County", layer: "counties", layerLabel: "Counties", color: IMAGE_PINS_LAYER_COLORS[0], description: "The northern county.", category: "Counties", guideUrl: null, number: null });
    expect(map.markers.find(marker => marker.id === "city")!.guideUrl).toBe("/wiki/example/cities");
    expect(map.markers.find(marker => marker.id === "rock")!.layer).toBe("other-locations");
  });

  it("tracks no collection progress", () => {
    expect(map.layers.every(layer => layer.collectionCode === null && layer.collection === null)).toBe(true);
    expect(map.markers.every(marker => marker.collectionCode === null && marker.checkId === null)).toBe(true);
  });

  it("keeps layer slugs unique when two categories share a slug", () => {
    const clash = imagePinsMapPageData(page, { ...data, markers: [
      { id: "a", title: "A", category: "Lakes & rivers", x: 1, y: 1 },
      { id: "b", title: "B", category: "Lakes rivers", x: 2, y: 2 }
    ] }, { title: "", path: "/" });
    expect(clash.layers.map(layer => layer.slug)).toEqual(["lakes-rivers", "lakes-rivers-2"]);
  });

  it("carries the page identity and hub into the viewer", () => {
    expect(map.config).toMatchObject({ mapTitle: "Leonida map", title: "Example Game", route: "/maps/leonida", mappedPointCount: 4, modes: [], editionOptions: [], variantOptions: [] });
    expect(map).toMatchObject({ hubTitle: "Example Game", hubPath: "/wiki/example", guides: [] });
  });
});
