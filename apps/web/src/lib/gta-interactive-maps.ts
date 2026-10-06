import "server-only";
import { getGameExtendedPage } from "./game-extra-pages";

import {
  buildGtaCollectionPath,
  getGtaWikiCollectionPageByPath,
  getGtaWikiPageBySlug,
  getPublishedGtaWikiCollectionRuntime,
  type GtaWikiCollectionPage
} from "@/lib/gta";
import type {
  GtaMapDefinition,
  GtaMapFact,
  GtaMapGuide,
  GtaMapGuideDefinition,
  GtaMapLayer,
  GtaMapMarker,
  GtaMapPageData,
  GtaMapPointRecord
} from "@/lib/gta-interactive-map-types";
import {
  getGtaInteractiveMapDefinition
} from "@/lib/gta-interactive-map-registry";

type PointFile = { points: GtaMapPointRecord[] };


function normalizedName(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function firstString(item: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function itemNumber(item: Record<string, unknown>): number | null {
  for (const key of ["guideNumber", "siteNumber", "collectionOrder", "number", "tagNumber", "balloonNumber"]) {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function displayLabel(key: string): string {
  const labels: Record<string, string> = {
    access: "Access",
    accessNotes: "Access",
    area: "Area",
    business: "Business",
    completion: "Completion",
    defaultBusiness: "Default business",
    defaultOwner: "Default owner",
    defaultScale: "Default scale",
    directions: "Directions",
    edition: "Edition",
    gang: "Gang",
    objective: "Objective",
    region: "Region",
    reward: "Reward",
    weapon: "Weapon"
  };
  return labels[key] ?? key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

function itemFacts(item: Record<string, unknown>): GtaMapFact[] {
  const omitted = new Set([
    "name", "guideNumber", "siteNumber", "collectionOrder", "number", "tagNumber", "balloonNumber",
    "imageCreditUrl", "cardSummary", "location", "area", "region", "section", "sourceUrl",
    "verificationStatus", "sourceNotes", "itemSlug"
  ]);
  const facts: GtaMapFact[] = [];
  for (const [key, raw] of Object.entries(item)) {
    if (omitted.has(key) || key.startsWith("_")) continue;
    if (typeof raw !== "string" && typeof raw !== "number") continue;
    const value = String(raw).trim();
    if (!value || value.length > 240 || value === "Not applicable") continue;
    facts.push({ label: displayLabel(key), value });
    if (facts.length >= 5) break;
  }
  return facts;
}

function guideCollectionRows(items: Array<{ item: Record<string, unknown>; system: { slug: string; section: string; sortOrder: number; image: string | null } }>) {
  const byNumber = new Map<number, typeof items[number]>();
  const byName = new Map<string, typeof items[number]>();
  for (const row of items) {
    const number = itemNumber(row.item);
    if (number !== null && !byNumber.has(number)) byNumber.set(number, row);
    const name = normalizedName(String(row.item.name ?? ""));
    if (name && !byName.has(name)) byName.set(name, row);
  }
  return { byNumber, byName };
}

async function readCollection(layer: GtaMapDefinition["layers"][number]) {
  if (!layer.collection) return null;
  const page = await getGtaWikiCollectionPageByPath(layer.collection.wikiSlug, layer.collection.collectionSlug);
  if (!page) return null;
  const runtime = await getPublishedGtaWikiCollectionRuntime(page);
  if (!runtime) throw new Error("Published GTA collection runtime is unavailable: " + page.code);
  return { page, runtime, ...guideCollectionRows(runtime.document.items) };
}

function findCollectionItem(point: GtaMapPointRecord, collection: Awaited<ReturnType<typeof readCollection>>) {
  if (!collection || point.referenceOnly) return null;
  if (point.collectionName) return collection.byName.get(normalizedName(point.collectionName)) ?? null;
  if (point.collectionNumber === null) return null;
  const direct = collection.byNumber.get(point.collectionNumber);
  if (direct) return direct;
  return collection.runtime.document.items.find((row) => row.system.sortOrder === point.collectionNumber) ?? null;
}

function collectionUrl(page: GtaWikiCollectionPage, itemSlug?: string): string {
  const base = buildGtaCollectionPath(page.wiki_slug, page.collection_slug);
  return itemSlug ? base + "#item-" + itemSlug : base;
}

function buildMarker(point: GtaMapPointRecord, layer: GtaMapLayer, collection: Awaited<ReturnType<typeof readCollection>>): GtaMapMarker {
  const guideUrl = collection ? collectionUrl(collection.page) : layer.guideUrl;
  const row = findCollectionItem(point, collection);
  const item = row?.item ?? null;
  const name = item ? firstString(item, ["name"]) : point.title;
  const area = item
    ? firstString(item, ["location", "area", "region", "district", "borough", "island", "neighborhood", "section"]) || point.area
    : point.area;
  const description = item
    ? firstString(item, ["cardSummary", "directions", "description", "exactSpot", "access", "accessNotes", "completion", "objective", "route", "locationNotes", "mapHint"])
    : point.description;
  const facts = item ? itemFacts(item) : point.category ? [{ label: "Map category", value: point.category }] : [];
  const markerGuideUrl = row && collection ? collectionUrl(collection.page, row.system.slug) : guideUrl;
  let note = layer.note ?? null;
  if (point.referenceOnly && point.layer === "drug-dealers") {
    note = "This is a platform-specific reference marker that is outside the 80 named locations in the Bloxodes checklist.";
  } else if (point.variant === "original") {
    note = "Original rampage start location. Choose Alternate locations to see the other start for the same objective.";
  } else if (point.variant === "alternate") {
    note = "Alternate rampage start location. This pin shares its completion state with the original start.";
  } else if (point.variant === "psp-location") {
    note = "PSP start location for Rampage #15. PlayStation 2 has an alternate start for the same checklist entry.";
  } else if (point.variant === "ps2-location") {
    note = "PlayStation 2 start location for Rampage #15. PSP has an alternate start for the same checklist entry.";
  }
  return {
    ...point,
    name: name || point.title,
    area,
    description,
    layerLabel: layer.label,
    color: layer.color,
    group: layer.group,
    collectionCode: row && collection ? collection.page.code : null,
    checkId: row && collection ? row.system.slug : null,
    guideUrl: markerGuideUrl,
    image: row?.system.image ?? null,
    facts,
    note
  };
}

export async function getGtaInteractiveMapPageData(slug: string): Promise<GtaMapPageData | null> {
  const registered = getGtaInteractiveMapDefinition(slug);
  if (!registered) return null;
  const stored = await getGameExtendedPage("gta",registered.route,"map");
  if (!stored || stored.renderer_key !== "gta-layered") return null;
  const mapData = stored.map_data as {definition:GtaMapDefinition;points:GtaMapPointRecord[]};
  const config = mapData.definition;
  const pointFile: PointFile = {points:mapData.points};
  const hub = await getGtaWikiPageBySlug(config.wikiSlug);

  const collectionResults = await Promise.all(config.layers.map(async (layer) => {
    if (!layer.collection) return [layer.slug, null] as const;
    try {
      return [layer.slug, await readCollection(layer)] as const;
    } catch (error) {
      console.error("Could not connect GTA map layer to its published collection", layer.slug, error);
      throw error;
    }
  }));
  const collectionsByLayer = new Map(collectionResults);

  const layers: GtaMapLayer[] = config.layers.map((layer) => {
    const collection = collectionsByLayer.get(layer.slug);
    return {
      ...layer,
      collectionCode: collection?.page.code ?? null,
      guideUrl: collection ? collectionUrl(collection.page) : null,
      collectionAvailable: Boolean(collection)
    };
  });
  const layerBySlug = new Map(layers.map((layer) => [layer.slug, layer]));
  const pointsByLayer = new Map<string, GtaMapPointRecord[]>();
  for (const point of pointFile.points) {
    const values = pointsByLayer.get(point.layer) ?? [];
    values.push(point);
    pointsByLayer.set(point.layer, values);
  }
  for (const layer of layers) {
    const collection = collectionsByLayer.get(layer.slug);
    if (!collection) continue;
    const rows = pointsByLayer.get(layer.slug) ?? [];
    const mappedIds = new Set(rows.map((point) => findCollectionItem(point, collection)?.system.slug).filter(Boolean));
    if (mappedIds.size !== collection.page.item_count) {
      throw new Error(
        "GTA map crosswalk mismatch for " + collection.page.code + ": mapped "
        + mappedIds.size + " of " + collection.page.item_count + " collection items."
      );
    }
  }

  const markers = pointFile.points.map((point) => {
    const layer = layerBySlug.get(point.layer);
    if (!layer) throw new Error("GTA map point has an unregistered layer: " + point.layer);
    return buildMarker(point, layer, collectionsByLayer.get(point.layer) ?? null);
  });

  const guidePages = await Promise.all(config.guideOnly.map(async (guide: GtaMapGuideDefinition) => {
    const page = await getGtaWikiCollectionPageByPath(guide.wikiSlug, guide.collectionSlug);
    return page ? {
      ...guide,
      title: page.title || guide.label,
      count: page.item_count,
      code: page.code,
      href: buildGtaCollectionPath(page.wiki_slug, page.collection_slug)
    } satisfies GtaMapGuide : null;
  }));

  return {
    config,
    layers,
    markers,
    guides: guidePages.filter((guide): guide is GtaMapGuide => Boolean(guide)),
    hubTitle: hub?.title ?? stored.game_title,
    hubPath: hub ? "/gta/wiki/" + config.wikiSlug : "/gta"
  };
}
