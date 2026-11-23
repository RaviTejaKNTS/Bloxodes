import type { GameExtendedPage, GameMapData, GameMapMarker } from "./game-page-data";
import type { GtaMapLayer, GtaMapMarker, GtaMapPageData, GtaMapViewDefinition } from "./gta-interactive-map-types";

/** Layer colors in category order. Pin numbers are dark, so every color is light enough to read them. */
export const IMAGE_PINS_LAYER_COLORS = [
  "#fbbf24", "#38bdf8", "#4ade80", "#f472b6", "#a78bfa", "#fb923c",
  "#2dd4bf", "#f87171", "#facc15", "#93c5fd", "#bef264", "#e879f9"
] as const;
export const IMAGE_PINS_UNCATEGORIZED = "Other locations";
const VIEW_SLUG = "map";

/**
 * `image-pins` stores x and y as percentages of the image, measured from its top-left corner.
 * The viewer uses Leaflet CRS.Simple with bounds [[0, 0], [height, width]], where latitude grows
 * upwards, so the image's top edge is latitude `height`. Returns viewer units: x = lng, y = lat.
 */
export function imagePinsPoint(marker: Pick<GameMapMarker, "x" | "y">, size: Pick<GameMapData, "width" | "height">) {
  return { x: size.width * marker.x / 100, y: size.height * (100 - marker.y) / 100 };
}

function layerSlug(category: string, used: Set<string>) {
  const base = category.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "locations";
  let slug = base;
  for (let index = 2; used.has(slug); index += 1) slug = `${base}-${index}`;
  used.add(slug);
  return slug;
}

/**
 * Shape an `image-pins` map for the shared interactive viewer: one view the size of the image,
 * one layer per marker category in first-seen order, and no collection progress.
 */
export function imagePinsMapPageData(
  page: Pick<GameExtendedPage, "slug" | "title" | "game_title" | "meta_description" | "canonical_path" | "updated_at">,
  data: GameMapData,
  hub: { title: string; path: string }
): GtaMapPageData {
  const view: GtaMapViewDefinition = {
    slug: VIEW_SLUG,
    label: page.game_title,
    asset: data.image,
    sourceTitle: data.attribution,
    sourceUrl: "",
    image: data.image,
    width: data.width,
    height: data.height
  };
  const used = new Set<string>();
  const layers = new Map<string, GtaMapLayer>();
  for (const marker of data.markers) {
    const category = marker.category ?? IMAGE_PINS_UNCATEGORIZED;
    const existing = layers.get(category);
    if (existing) { existing.pointCount += 1; continue; }
    layers.set(category, {
      slug: layerSlug(category, used),
      label: category,
      group: "Categories",
      color: IMAGE_PINS_LAYER_COLORS[layers.size % IMAGE_PINS_LAYER_COLORS.length],
      sourceTitle: data.attribution,
      sourceUrl: "",
      view: VIEW_SLUG,
      collection: null,
      categoryIds: null,
      mode: null,
      defaultEnabled: true,
      pointCount: 1,
      collectionCount: null,
      collectionCode: null,
      guideUrl: null,
      collectionAvailable: false
    });
  }
  const markers: GtaMapMarker[] = data.markers.map(marker => {
    const layer = layers.get(marker.category ?? IMAGE_PINS_UNCATEGORIZED)!;
    return {
      ...imagePinsPoint(marker, data),
      id: marker.id,
      layer: layer.slug,
      sourceId: marker.id,
      sourceTitle: data.attribution,
      sourceUrl: "",
      view: VIEW_SLUG,
      title: marker.title,
      name: marker.title,
      area: "",
      description: marker.description ?? "",
      category: layer.label,
      number: null,
      collectionNumber: null,
      collectionName: null,
      referenceOnly: true,
      mode: null,
      edition: null,
      variant: null,
      sourceImage: null,
      layerLabel: layer.label,
      color: layer.color,
      group: layer.group,
      collectionCode: null,
      checkId: null,
      guideUrl: marker.href ?? null,
      image: null,
      facts: [],
      note: null
    };
  });
  return {
    config: {
      slug: page.slug,
      wikiSlug: "",
      title: page.game_title,
      mapTitle: page.title,
      description: page.meta_description ?? "",
      summary: "",
      route: page.canonical_path,
      views: [view],
      layers: [...layers.values()],
      modes: [],
      defaultMode: null,
      editionOptions: [],
      defaultEdition: null,
      variantOptions: [],
      defaultVariant: null,
      guideOnly: [],
      about: [],
      mappedPointCount: markers.length,
      retrievedAt: page.updated_at
    },
    layers: [...layers.values()],
    markers,
    guides: [],
    hubTitle: hub.title,
    hubPath: hub.path
  };
}
