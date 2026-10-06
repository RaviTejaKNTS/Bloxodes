import "server-only";
import { getGameExtendedPage } from "./game-extra-pages";

import { GTA5_MAP_LAYERS, type Gta5MapMarker } from "@/lib/gta-map-types";
import {
  buildGtaCollectionPath,
  getGtaWikiCollectionPageByPath,
  getPublishedGtaWikiCollectionRuntime
} from "@/lib/gta";

function firstString(item: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

const DETAIL_FIELDS: Record<string, { key: string; label: string }[]> = {
  "spaceship-parts": [{ key: "access", label: "How to reach it" }, { key: "mapHint", label: "Map hint" }],
  "letter-scraps": [{ key: "exactSpot", label: "Exact spot" }, { key: "accessNotes", label: "Access" }, { key: "nearestLandmark", label: "Nearby" }],
  "nuclear-waste": [{ key: "accessNotes", label: "Access" }, { key: "reportedDepthFt", label: "Reported depth (ft)" }, { key: "collectionValue", label: "Value" }],
  "submarine-pieces": [{ key: "access", label: "How to reach it" }, { key: "mission", label: "Mission" }],
  "monkey-mosaics": [{ key: "access", label: "How to reach it" }, { key: "reward", label: "Reward" }],
  "peyote-plants": [{ key: "access", label: "How to reach it" }],
  "epsilon-tracts": [{ key: "clue", label: "Epsilon clue" }, { key: "access", label: "Access" }],
  "hidden-packages": [{ key: "value", label: "Cash" }],
  "stunt-jumps": [{ key: "jump", label: "Approach" }, { key: "completion", label: "Completion" }],
  "under-the-bridge": [{ key: "bridge", label: "Bridge" }],
  "knife-flights": [{ key: "route", label: "Flight line" }, { key: "completion", label: "Completion" }]
};

function mapFacts(slug: string, item: Record<string, unknown>) {
  return (DETAIL_FIELDS[slug] ?? []).flatMap(({ key, label }) => {
    const value = item[key];
    return (typeof value === "string" && value.trim()) || typeof value === "number"
      ? [{ label, value: String(value).trim() }]
      : [];
  });
}

type MapSnapshot = { points:Record<string,Array<{number:number;x:number;y:number}>>;places:Array<{id:string;group:string;name:string;x:number;y:number}>;markerSnapshot:Gta5MapMarker[] };
function getPlaceMarkers(places: MapSnapshot["places"]): Gta5MapMarker[] {
  return places.map((place) => ({
    id: `place-${place.id.toLowerCase()}`,
    number: 0,
    layer: place.group as Gta5MapMarker["layer"],
    name: place.name.split(", ")[0],
    area: place.name.includes(", ") ? place.name.slice(place.name.indexOf(", ") + 2) : "San Andreas",
    description: "A named place in the GTA V Story Mode world. Use it as a landmark while planning a route.",
    facts: [],
    image: null,
    x: place.x,
    y: place.y,
    guideUrl: null,
    collectionCode: null,
    walkthroughUrl: null
  }));
}

async function getLiveGta5MapMarkers(snapshot: MapSnapshot): Promise<Gta5MapMarker[]> {
  const {points,places} = snapshot;
  const layers = await Promise.all(GTA5_MAP_LAYERS.filter((layer) => layer.group !== "Places").map(async (layer) => {
    const page = await getGtaWikiCollectionPageByPath("gta-5", layer.slug);
    if (!page) throw new Error(`GTA V map requires the published ${layer.slug} collection.`);
    const runtime = await getPublishedGtaWikiCollectionRuntime(page);
    if (!runtime) throw new Error(`GTA V map could not load ${page.code}.`);
    const coordinates = points[layer.slug as keyof typeof points];
    if (runtime.document.items.length !== coordinates.length) {
      throw new Error(`GTA V map expected ${coordinates.length} ${layer.slug} items; got ${runtime.document.items.length}.`);
    }

    const itemsByOrder = new Map(runtime.document.items.map((entry) => [entry.system.sortOrder, entry]));
    return coordinates.map((point) => {
      const entry = itemsByOrder.get(point.number);
      if (!entry) throw new Error(`GTA V map has no ${layer.slug} guide item #${point.number}.`);
      const item = entry.item as Record<string, unknown>;
      const guideNumber = item.guideNumber ?? item.collectionOrder;
      if (typeof guideNumber === "number" && guideNumber !== point.number) {
        throw new Error(`GTA V map ${layer.slug} item #${point.number} has a different published guide number (${guideNumber}).`);
      }
      const name = firstString(item, ["name"]) || `${layer.label} #${point.number}`;
      const packageFive = layer.slug === "hidden-packages" && point.number === 5;
      const area = packageFive
        ? "Offshore plane wreck east of Terminal"
        : firstString(item, ["area", "location", "nearestLandmark", "bridge"]) || entry.system.section;
      const description = packageFive
        ? "Dive at the plane wreck east of Terminal, south of the Palomino Highlands coast."
        : firstString(item, ["cardSummary", "exactSpot", "jump", "bridge", "location", "route", "mapHint"]);
      return {
        id: entry.system.slug,
        number: point.number,
        layer: layer.slug,
        name,
        area,
        description,
        facts: mapFacts(layer.slug, item),
        image: entry.system.image ?? null,
        x: point.x,
        y: point.y,
        guideUrl: `${buildGtaCollectionPath("gta-5", layer.slug)}#item-${entry.system.slug}`,
        collectionCode: page.code,
        walkthroughUrl: layer.slug === "hidden-packages" && typeof item.walkthroughUrl === "string"
          && /^https:\/\/(www\.)?youtube\.com\//.test(item.walkthroughUrl)
          ? item.walkthroughUrl : null
      } satisfies Gta5MapMarker;
    });
  }));
  return [...layers.flat(), ...getPlaceMarkers(places)];
}

export async function getGta5MapMarkers(): Promise<Gta5MapMarker[]> {
  const page = await getGameExtendedPage("gta","/gta/maps/gta5","map");
  if(!page || page.renderer_key !== "gta5") throw new Error("GTA V map needs its published shared snapshot.");
  const snapshot = page.map_data as MapSnapshot;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      getLiveGta5MapMarkers(snapshot),
      new Promise<Gta5MapMarker[]>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("GTA V map collection lookup timed out")), 3500);
      })
    ]);
  } catch (error) {
    // Keep the map usable during a transient collection database outage. This
    // snapshot is generated from the same published collection revision.
    console.warn("Serving the GTA V map marker snapshot:", error);
    return [...snapshot.markerSnapshot, ...getPlaceMarkers(snapshot.places)];
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
