import fs from "node:fs/promises";
import { repoPath } from "@/lib/paths";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { CatalogSelectNav } from "@/components/CatalogSelectNav";
import { MoreWikiCollections } from "@/components/more-content";
import { processHtmlLinks } from "@/lib/link-utils";
import { breadcrumbJsonLd, SITE_URL, webPageJsonLd } from "@/lib/seo";
import { GameCollectionView, type CollectionFieldKind, type CollectionFieldPresentation } from "@/components/game-collections/GameCollectionView";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { ContentFaq } from "@/components/ContentFaq";
import { renderPageContentNodes } from "@/lib/page-content";
import { buildCollectionPagination } from "@/components/game-collections/collection-pagination";
import {
  buildGameCollectionPath,
  GAME_COLLECTIONS,
  getFieldLabel,
  getGameCollectionConfigByCode,
  type GameCollectionConfig
} from "@/lib/game-collections";

const FALLBACK_IMAGE = "/Bloxodes.png";

export type GameCollectionContentHtml = {
  id?: string | null;
  title?: string | null;
  introHtml?: string;
  howHtml?: string;
  descriptionHtml?: Array<{ key: string; html: string }>;
  faqHtml?: Array<{ q: string; a: string }>;
  updatedAt?: string | null;
};

type GameDatasetSource = {
  label?: string | null;
  url?: string | null;
  accessed?: string | null;
};

export type GameDatasetMeta = {
  title?: string | null;
  updatedAt?: string | null;
  sources?: GameDatasetSource[] | null;
  columns?: string[] | null;
  schemaVersion?: number | null;
  itemFields?: string[] | null;
  groupLabel?: string | null;
  sectionOrder?: string[] | null;
  fieldPresentation?: Record<string, CollectionFieldPresentation | CollectionFieldKind> | null;
  display?: {
    groupLabel?: string | null;
    sectionOrder?: string[] | null;
    badgeField?: string | null;
    subtitleFields?: string[] | null;
    descriptionField?: string | null;
    cardDescriptionField?: string | null;
    cardFields?: string[] | null;
    tableFields?: string[] | null;
    fieldPresentation?: Record<string, CollectionFieldPresentation | CollectionFieldKind> | null;
  } | null;
};

export type GameCollectionItem = {
  id: string;
  name: string;
  image?: string | null;
  [key: string]: unknown;
};

export type GameCollectionDataset = {
  meta: GameDatasetMeta | null;
  columns: string[];
  items: GameCollectionItem[];
};

type GenericViewConfig = {
  slug: string;
  label: string;
  groupLabel: string;
  groupKey: string;
  stats: Array<{ key: string; label: string }>;
  maxStats?: number;
  badgeKey?: string;
  subtitleKeys?: string[];
  descriptionKey?: string;
  cardDescriptionKey?: string;
  cardFields?: string[];
  fieldPresentation?: Record<string, CollectionFieldPresentation | CollectionFieldKind>;
  hideImages?: boolean;
};

const DESCRIPTION_MD_KEY = "description-md";

const HIDDEN_FIELD_KEYS = new Set([
  "id",
  "slug",
  "name",
  "image",
  "collectionSection",
  "collectionGroup",
  "sortOrder",
  "sort_order",
  "_sortOrder",
  "imageStatus",
  "imageMissingReason",
  "imageSource",
  "sourceImageUrl",
  "sourceImage",
  "sourcePage",
  "secondarySourcePage",
  "sourceUrl",
  "sourceUrls",
  "sourceFile",
  "sourceTables",
  "sourceStatus",
  "sourceConfidence",
  "sourceCheckedAt",
  "sourceGeneratedAt",
  "sourceNote",
  "sourceNotes",
  "sourceEvidence",
  "wikiSourceStatus",
  "verification",
  "verificationNote",
  "confidence",
  "blocker",
  "wikiUrl",
  "imageCandidate",
  "fields",
  "raw",
  "rawText",
  "sections",
  "displayRarity",
  "updatedAt"
]);

const GROUP_KEY_PRIORITY = [
  "collectionSection",
  "category",
  "type",
  "rarity",
  "tier",
  "status",
  "source",
  "location",
  "stage"
];

const BADGE_KEY_PRIORITY = ["rarity", "tier", "type", "category", "status", "availability", "cost", "price", "source"];
const SUBTITLE_KEY_PRIORITY = ["role", "type", "category", "rarity", "tier", "source", "location", "availability", "status"];
const DESCRIPTION_KEY_PRIORITY = ["cardSummary", "summary", "description", "overview", "effect", "purpose", "bestFor", "notes"];
const STAT_KEY_PRIORITY = [
  "cost",
  "price",
  "value",
  "rarity",
  "tier",
  "type",
  "category",
  "source",
  "availability",
  "status",
  "effect",
  "location",
  "role"
];

const SYSTEM_SECTION_KEY = "__section";

export function getGameCollectionConfig(collectionCode: string): GameCollectionConfig | null {
  return getGameCollectionConfigByCode(collectionCode);
}

async function readDataset(
  config: GameCollectionConfig
): Promise<{ meta: GameDatasetMeta | null; rows: Record<string, unknown>[] }> {
  const datasetPath = repoPath("data", config.dataDir, config.file);
  const raw = await fs.readFile(datasetPath, "utf8");
  const parsed = JSON.parse(raw) as
    | { meta?: GameDatasetMeta | null; items?: Record<string, unknown>[] | null; data?: Record<string, unknown>[] | null }
    | Record<string, unknown>[];

  if (Array.isArray(parsed)) {
    return { meta: null, rows: parsed };
  }

  return {
    meta: parsed.meta ?? null,
    rows: parsed.items ?? parsed.data ?? []
  };
}

export async function loadGameCollectionDataset(
  config: GameCollectionConfig
): Promise<GameCollectionDataset> {
  try {
    const { meta, rows } = await readDataset(config);
    const items = uniquifyIds(rows.map(normalizeItem).filter(Boolean) as GameCollectionItem[]);
    return {
      meta,
      columns: resolveColumns(meta, rows, items),
      items
    };
  } catch (error) {
    console.error(`Failed to load ${config.code} collection dataset`, error);
    return { meta: null, columns: [], items: [] };
  }
}

function normalizeItem(row: Record<string, unknown>): GameCollectionItem | null {
  if (isRecord(row.item)) {
    return normalizeV2Item(row);
  }

  const cleanedRow = cleanDatasetRecord(row) as Record<string, unknown>;
  const name = normalizeText(cleanedRow.name) ?? normalizeText(cleanedRow.title) ?? normalizeText(cleanedRow.item);
  if (!name) return null;

  const fields = isRecord(cleanedRow.fields) ? cleanedRow.fields : {};
  const flattenedFields = Object.fromEntries(
    Object.entries(fields).filter(([key]) => !(key in cleanedRow) && key !== "image" && key !== "item")
  );
  const rawSlug = normalizeText(cleanedRow.slug);
  const slug = rawSlug && !isHtmlDerivedSlug(rawSlug) ? rawSlug : toSlug(name);

  return {
    ...flattenedFields,
    ...cleanedRow,
    id: toSlug(slug || name),
    name,
    image: normalizeImage(row.image) ?? normalizeImage(row.imageCandidate) ?? null
  };
}

function normalizeV2Item(row: Record<string, unknown>): GameCollectionItem | null {
  const cleanedItem = cleanDatasetRecord(row.item) as Record<string, unknown>;
  const cleanedSystem = isRecord(row.system) ? (cleanDatasetRecord(row.system) as Record<string, unknown>) : {};
  const name = normalizeText(cleanedItem.name) ?? normalizeText(cleanedItem.title) ?? normalizeText(cleanedItem.item);
  if (!name) return null;

  const rawSlug = normalizeText(cleanedSystem.slug) ?? normalizeText(cleanedItem.slug);
  const slug = rawSlug && !isHtmlDerivedSlug(rawSlug) ? rawSlug : toSlug(name);
  const section = normalizeText(cleanedSystem.section) ?? "Items";

  return {
    ...cleanedItem,
    id: toSlug(slug || name),
    name,
    image: normalizeImage(cleanedSystem.image) ?? null,
    [SYSTEM_SECTION_KEY]: section,
    __sortOrder: cleanedSystem.sortOrder
  };
}

function cleanDatasetRecord(value: unknown, key = ""): unknown {
  if (typeof value === "string") {
    return shouldPreserveRawString(key) ? value : htmlToPlainText(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => cleanDatasetRecord(entry));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [entryKey, cleanDatasetRecord(entryValue, entryKey)])
    );
  }

  return value;
}

function shouldPreserveRawString(key: string): boolean {
  const normalizedKey = key.toLowerCase();
  return normalizedKey.includes("url") || normalizedKey.includes("image") || normalizedKey === "src";
}

function isHtmlDerivedSlug(value: string): boolean {
  return /^(a-href|img-|span-|div-)-/i.test(value) || /static-wikia-nocookie|mw-file-description/i.test(value);
}

function htmlToPlainText(value: string): string {
  const trimmed = value.trim();
  if (!/[<&]/.test(trimmed)) return trimmed.replace(/\s+/g, " ");

  const fallbackFromImage = extractImageLabel(trimmed);
  const withoutHidden = trimmed
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const stripped = decodeHtmlEntities(
    withoutHidden
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );

  return stripped || fallbackFromImage || trimmed.replace(/\s+/g, " ");
}

function extractImageLabel(value: string): string | null {
  const attrMatch =
    value.match(/\bdata-image-name=(["'])(.*?)\1/i) ??
    value.match(/\balt=(["'])(.*?)\1/i) ??
    value.match(/\bdata-image-key=(["'])(.*?)\1/i);
  if (!attrMatch?.[2]) return null;

  const decoded = decodeHtmlEntities(attrMatch[2])
    .replace(/\.(png|jpe?g|webp|gif|svg)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return decoded || null;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, token: string) => {
    const lowered = token.toLowerCase();
    if (lowered.startsWith("#x")) {
      const codePoint = Number.parseInt(lowered.slice(2), 16);
      return isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    if (lowered.startsWith("#")) {
      const codePoint = Number.parseInt(lowered.slice(1), 10);
      return isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }

    const named: Record<string, string> = {
      amp: "&",
      apos: "'",
      gt: ">",
      lt: "<",
      nbsp: " ",
      quot: "\""
    };

    return named[lowered] ?? entity;
  });
}

function isValidCodePoint(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff;
}

function uniquifyIds(items: GameCollectionItem[]): GameCollectionItem[] {
  const seen = new Map<string, number>();
  const used = new Set<string>();

  return items.map((item) => {
    const baseId = item.id || "item";
    const occurrence = (seen.get(baseId) ?? 0) + 1;
    seen.set(baseId, occurrence);

    let nextId = occurrence === 1 ? baseId : `${baseId}-${occurrence}`;
    let suffix = occurrence;
    while (used.has(nextId)) {
      suffix += 1;
      nextId = `${baseId}-${suffix}`;
    }
    used.add(nextId);

    return nextId === item.id ? item : { ...item, id: nextId };
  });
}

function resolveColumns(
  meta: GameDatasetMeta | null,
  rows: Record<string, unknown>[],
  items: GameCollectionItem[]
): string[] {
  if (meta?.schemaVersion === 2) {
    const display = meta.display;
    const fromMeta = [
      ...(meta.itemFields ?? []),
      ...(meta.columns ?? []),
      ...(display?.tableFields ?? []),
      ...(display?.cardFields ?? []),
      display?.badgeField,
      ...(display?.subtitleFields ?? []),
      display?.descriptionField,
      display?.cardDescriptionField
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    const seen = new Set<string>(fromMeta);
    for (const item of items.slice(0, 20)) {
      for (const key of Object.keys(item)) {
        if (!key.startsWith("__") && !["id", "name", "image"].includes(key)) {
          seen.add(key);
        }
      }
    }
    return Array.from(seen);
  }

  const fromMeta = (meta?.columns ?? []).filter(Boolean);
  const seen = new Set<string>(fromMeta);
  for (const row of [...rows.slice(0, 20), ...items.slice(0, 20)]) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
      }
    }
  }
  return Array.from(seen);
}

function buildViewConfig(
  config: GameCollectionConfig,
  dataset: GameCollectionDataset
): GenericViewConfig {
  if (dataset.meta?.schemaVersion === 2 && dataset.meta.display) {
    return buildExplicitViewConfig(config, dataset);
  }

  const columns = dataset.columns;
  const hiddenFieldKeys = new Set(HIDDEN_FIELD_KEYS);
  const groupKey =
    resolveDatasetGroupKey(dataset) ??
    pickFirstUsefulKey(dataset, GROUP_KEY_PRIORITY, { requireMultipleValues: true }) ??
    "collectionGroup";
  hiddenFieldKeys.add(groupKey);
  const badgeKey = pickFirstUsefulKey(
    dataset,
    BADGE_KEY_PRIORITY.filter((key) => key !== groupKey && !hiddenFieldKeys.has(key))
  );
  const descriptionKey = pickFirstUsefulKey(
    dataset,
    DESCRIPTION_KEY_PRIORITY.filter((key) => !hiddenFieldKeys.has(key))
  );
  const subtitleKeys = SUBTITLE_KEY_PRIORITY.filter(
    (key) =>
      columns.includes(key) &&
      !hiddenFieldKeys.has(key) &&
      key !== groupKey &&
      key !== badgeKey &&
      hasUsefulValues(dataset.items, key)
  ).slice(0, 2);
  const statKeys = [
    ...STAT_KEY_PRIORITY.filter((key) => columns.includes(key) && hasUsefulValues(dataset.items, key)),
    ...columns.filter((key) => !hiddenFieldKeys.has(key) && hasUsefulValues(dataset.items, key))
  ].filter(
    (key) =>
      !hiddenFieldKeys.has(key) &&
      key !== groupKey &&
      key !== badgeKey &&
      key !== descriptionKey &&
      !subtitleKeys.includes(key)
  );
  const stats = Array.from(new Set(statKeys))
    .map((key) => ({ key, label: getFieldLabel(key) }));
  const hasImages = dataset.items.some((item) => Boolean(normalizeText(item.image)));

  if (groupKey === "collectionGroup") {
    dataset.items.forEach((item) => {
      item.collectionGroup = "Items";
    });
  }

  const fieldPresentation = dataset.meta?.fieldPresentation ?? {};

  return {
    slug: config.code,
    label: config.label,
    groupKey,
    groupLabel:
      normalizeText(dataset.meta?.groupLabel) ??
      (groupKey === "collectionGroup" ? "Group" : getFieldLabel(groupKey)),
    badgeKey: badgeKey ?? undefined,
    subtitleKeys,
    descriptionKey: descriptionKey ?? undefined,
    cardDescriptionKey: descriptionKey ?? undefined,
    stats,
    maxStats: stats.length,
    fieldPresentation: Object.keys(fieldPresentation).length ? fieldPresentation : undefined,
    hideImages: !hasImages
  };
}

function sanitizeDisplayFieldList(value: string[] | null | undefined, dataset: GameCollectionDataset): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const fields: string[] = [];
  for (const key of value) {
    if (!key || seen.has(key) || key.startsWith("__")) continue;
    if (!dataset.columns.includes(key)) continue;
    if (!hasUsefulValues(dataset.items, key)) continue;
    seen.add(key);
    fields.push(key);
  }
  return fields;
}

function sanitizeDisplayField(value: string | null | undefined, dataset: GameCollectionDataset): string | null {
  if (!value || value.startsWith("__")) return null;
  if (!dataset.columns.includes(value)) return null;
  if (!hasUsefulValues(dataset.items, value)) return null;
  return value;
}

function buildExplicitViewConfig(config: GameCollectionConfig, dataset: GameCollectionDataset): GenericViewConfig {
  const display = dataset.meta?.display;
  const tableFields = sanitizeDisplayFieldList(display?.tableFields, dataset);
  const badgeKey = sanitizeDisplayField(display?.badgeField, dataset);
  const descriptionKey = sanitizeDisplayField(display?.descriptionField, dataset);
  const cardDescriptionKey = sanitizeDisplayField(display?.cardDescriptionField, dataset) ?? descriptionKey;
  const subtitleKeys = sanitizeDisplayFieldList(display?.subtitleFields, dataset).filter(
    (key) => key !== badgeKey && key !== descriptionKey && key !== cardDescriptionKey
  );
  const cardFields = sanitizeDisplayFieldList(display?.cardFields, dataset).filter(
    (key) => key !== badgeKey && key !== descriptionKey && key !== cardDescriptionKey && !subtitleKeys.includes(key)
  );
  const stats = tableFields
    .filter((key) => key !== badgeKey && key !== descriptionKey && key !== cardDescriptionKey && !subtitleKeys.includes(key))
    .map((key) => ({ key, label: getFieldLabel(key) }));
  const hasImages = dataset.items.some((item) => Boolean(normalizeText(item.image)));
  const fieldPresentation = display?.fieldPresentation ?? undefined;

  return {
    slug: config.code,
    label: config.label,
    groupKey: SYSTEM_SECTION_KEY,
    groupLabel: normalizeText(display?.groupLabel) ?? "Group",
    badgeKey: badgeKey ?? undefined,
    subtitleKeys,
    descriptionKey: descriptionKey ?? undefined,
    cardDescriptionKey: cardDescriptionKey ?? undefined,
    cardFields,
    stats,
    maxStats: stats.length,
    fieldPresentation: fieldPresentation && Object.keys(fieldPresentation).length ? fieldPresentation : undefined,
    hideImages: !hasImages
  };
}

function resolveDatasetGroupKey(dataset: GameCollectionDataset): string | null {
  if (dataset.meta?.schemaVersion === 2) return SYSTEM_SECTION_KEY;
  return null;
}

function resolveDatasetSectionOrder(dataset: GameCollectionDataset): string[] | null {
  if (dataset.meta?.schemaVersion === 2) {
    const sectionOrder = dataset.meta.display?.sectionOrder;
    if (!Array.isArray(sectionOrder)) return null;
    const normalized = sectionOrder.map((label) => normalizeText(label)).filter(Boolean) as string[];
    return normalized.length ? normalized : null;
  }

  const sectionOrder = dataset.meta?.sectionOrder;
  if (!Array.isArray(sectionOrder)) return null;
  const normalized = sectionOrder.map((label) => normalizeText(label)).filter(Boolean) as string[];
  return normalized.length ? normalized : null;
}

function getUsefulValueSet(items: GameCollectionItem[], key: string): Set<string> {
  const values = new Set<string>();
  for (const item of items) {
    const normalized = normalizeValue(item[key]);
    if (normalized) values.add(normalized);
  }
  return values;
}

function hasUsefulValues(items: GameCollectionItem[], key: string, options?: { requireMultipleValues?: boolean }) {
  const values = getUsefulValueSet(items, key);
  return options?.requireMultipleValues ? values.size > 1 : values.size > 0;
}

function pickFirstUsefulKey(
  dataset: GameCollectionDataset,
  keys: string[],
  options?: { requireMultipleValues?: boolean }
): string | null {
  return (
    keys.find((key) => dataset.columns.includes(key) && hasUsefulValues(dataset.items, key, options)) ?? null
  );
}

function buildGroupedSections(
  items: GameCollectionItem[],
  groupKey: string,
  sectionOrder?: string[] | null
) {
  const groups = new Map<string, GameCollectionItem[]>();
  items.forEach((item) => {
    const label = normalizeValue(item[groupKey]) ?? "Other";
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)?.push(item);
  });

  const orderIndex = new Map((sectionOrder ?? []).map((label, index) => [label, index]));

  return Array.from(groups.entries())
    .sort((a, b) => {
      const left = orderIndex.get(a[0]);
      const right = orderIndex.get(b[0]);
      if (left !== undefined && right !== undefined) return left - right;
      if (left !== undefined) return -1;
      if (right !== undefined) return 1;
      return a[0].localeCompare(b[0]);
    })
    .map(([label, entries]) => ({
      id: `section-${toSectionKey(label || "items")}`,
      label,
      items: entries.sort((a, b) => {
        const left = typeof a.__sortOrder === "number" ? a.__sortOrder : Number(a.__sortOrder);
        const right = typeof b.__sortOrder === "number" ? b.__sortOrder : Number(b.__sortOrder);
        if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
        if (Number.isFinite(left)) return -1;
        if (Number.isFinite(right)) return 1;
        return 0;
      })
    }));
}

type GameDatasetPreparedCollection = {
  dataset: GameCollectionDataset;
  viewConfig: GenericViewConfig;
  groupedSections: ReturnType<typeof buildGroupedSections>;
  itemCount: number;
  totalPages: number;
};

const gameDatasetPreparedCollectionCache = new Map<string, Promise<GameDatasetPreparedCollection>>();

// Per-collection pagination target weight (text-weight model). Lower values force more
// pages. Use for image-dense collections where many image cards make a single page exceed
// the HTML size gate even though the text-weight stays under the default target. Only the
// listed codes are affected; everything else uses the default.
const COLLECTION_PAGINATION_TARGET_WEIGHT: Record<string, number> = {
  "evomon-monsters": 30_000
};

function resolvePaginationTargetWeight(code: string): number | undefined {
  return COLLECTION_PAGINATION_TARGET_WEIGHT[code];
}

function buildGameDatasetPreparedCollection(
  config: GameCollectionConfig,
  dataset: GameCollectionDataset
): GameDatasetPreparedCollection {
  const viewConfig = buildViewConfig(config, dataset);
  const groupedSections = buildGroupedSections(
    dataset.items,
    viewConfig.groupKey,
    resolveDatasetSectionOrder(dataset)
  );
  const totalPages = buildCollectionPagination({
    sections: groupedSections,
    currentPage: 1,
    basePath: buildGameCollectionPath(config.code),
    targetWeight: resolvePaginationTargetWeight(config.code)
  }).info.totalPages;

  return {
    dataset,
    viewConfig,
    groupedSections,
    itemCount: dataset.items.length,
    totalPages
  };
}

export async function loadPreparedGameCollection(
  config: GameCollectionConfig
): Promise<GameDatasetPreparedCollection> {
  const cached = gameDatasetPreparedCollectionCache.get(config.code);
  if (cached) return cached;

  const next = loadGameCollectionDataset(config).then((dataset) => buildGameDatasetPreparedCollection(config, dataset));
  gameDatasetPreparedCollectionCache.set(config.code, next);
  return next;
}

export async function getPreparedGameCollectionPageCount(config: GameCollectionConfig) {
  return (await loadPreparedGameCollection(config)).totalPages;
}

export function buildGameCollectionSidebarSections(
  config: GameCollectionConfig,
  dataset: GameCollectionDataset
): Array<{ id: string; label: string; count: number }> {
  const prepared = buildGameDatasetPreparedCollection(config, dataset);
  return prepared.groupedSections.map((section) => ({
    id: section.id,
    label: section.label,
    count: section.items.length
  }));
}

export function getGameCollectionPageCount(config: GameCollectionConfig, dataset: GameCollectionDataset) {
  return buildGameDatasetPreparedCollection(config, dataset).totalPages;
}

function pickFirstExistingKey(columns: string[], keys: string[]): string | null {
  return keys.find((key) => columns.includes(key)) ?? null;
}

function resolveDataUpdatedAt(meta: GameDatasetMeta | null): string | null {
  if (!meta) return null;
  if (meta.updatedAt) return meta.updatedAt;
  const sources = meta.sources ?? [];
  return sources.find((source) => source?.accessed)?.accessed ?? null;
}

function resolveLatestUpdatedAt(values: Array<string | null | undefined>): string | null {
  let latestValue: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    if (!value) continue;
    const time = Date.parse(value);
    if (Number.isNaN(time)) continue;
    if (time > latestTime) {
      latestTime = time;
      latestValue = value;
    }
  }

  return latestValue ?? values.find((value): value is string => Boolean(value)) ?? null;
}

function resolveAbsoluteUrl(value: string | null | undefined): string {
  if (!value) return `${SITE_URL}${FALLBACK_IMAGE}`;
  if (value.startsWith("http")) return value;
  return `${SITE_URL.replace(/\/$/, "")}/${value.replace(/^\//, "")}`;
}

function buildItemListSchema({
  title,
  description,
  url,
  items,
  positionOffset = 0,
  totalItems
}: {
  title: string;
  description: string;
  url: string;
  items: GameCollectionItem[];
  positionOffset?: number;
  totalItems?: number;
}) {
  const itemListElement = items.map((item, index) => ({
    "@type": "ListItem",
    position: positionOffset + index + 1,
    item: {
      "@type": "Thing",
      name: item.name,
      url: `${url}#item-${item.id}`,
      image: resolveAbsoluteUrl(item.image ?? FALLBACK_IMAGE)
    }
  }));

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description,
    url,
    numberOfItems: totalItems ?? items.length,
    itemListElement
  });
}

function DatasetCollectionNav({
  config,
  className
}: {
  config: GameCollectionConfig;
  className?: string;
}) {
  const options = GAME_COLLECTIONS.filter((entry) => entry.gameSlug === config.gameSlug).map((entry) => ({
    value: entry.code,
    label: entry.label,
    href: buildGameCollectionPath(entry.code)
  }));

  return <CatalogSelectNav label={`${config.gameName} collection`} value={config.code} className={className} options={options} />;
}

function SectionNav({
  sections,
  className
}: {
  sections: Array<{ id: string; label: string; count: number; href?: string }>;
  className?: string;
}) {
  if (!sections.length) return null;
  return (
    <CatalogSelectNav
      label="Jump to section"
      placeholder="Choose a section"
      className={className}
      options={sections.map((section) => ({
        value: section.id,
        label: section.label,
        count: section.count,
        href: section.href,
        targetId: section.id
      }))}
    />
  );
}

export function renderGameCollectionPage({
  config,
  dataset,
  contentHtml,
  currentPage = 1,
  prepared
}: {
  config: GameCollectionConfig;
  dataset: GameCollectionDataset;
  contentHtml?: GameCollectionContentHtml | null;
  currentPage?: number;
  prepared?: GameDatasetPreparedCollection;
}) {
  const preparedCollection = prepared ?? buildGameDatasetPreparedCollection(config, dataset);
  const displayDataset = preparedCollection.dataset;
  const items = displayDataset.items;
  const itemCount = preparedCollection.itemCount;
  const pageTitle =
    contentHtml?.title?.trim() ||
    `All ${itemCount.toLocaleString("en-US")} ${config.label} in ${config.gameName}`;
  const pageDescription = `${config.gameName} ${config.label.toLowerCase()} collection with ${itemCount.toLocaleString("en-US")} tracked entries.`;
  const introHtml = contentHtml?.introHtml?.trim() ? contentHtml.introHtml : "";
  const descriptionHtml = contentHtml?.descriptionHtml ?? [];
  const faqHtml = contentHtml?.faqHtml ?? [];
  const dataUpdatedAt = resolveDataUpdatedAt(dataset.meta);
  const contentUpdatedAt = contentHtml?.updatedAt ?? null;
  const updatedAt = resolveLatestUpdatedAt([dataUpdatedAt, contentUpdatedAt]);
  const updatedDate = updatedAt ? new Date(updatedAt) : null;
  const basePath = buildGameCollectionPath(config.code);
  const updatedIso = updatedDate?.toISOString() ?? null;
  const pagination = buildCollectionPagination({
    sections: preparedCollection.groupedSections,
    currentPage,
    basePath,
    targetWeight: resolvePaginationTargetWeight(config.code)
  });
  const pageSections = pagination.sections;
  const pageItems = pageSections.flatMap((section) => section.items);
  const canonicalPath =
    pagination.info.currentPage === 1 ? basePath : `${basePath}/page/${pagination.info.currentPage}`;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const pageTitleWithPage =
    pagination.info.currentPage === 1 ? pageTitle : `${pageTitle} - Page ${pagination.info.currentPage}`;
  const pageDescriptionWithPage =
    pagination.info.currentPage === 1
      ? pageDescription
      : `${pageDescription} Page ${pagination.info.currentPage} of ${pagination.info.totalPages}.`;
  const sectionNoteEntries = new Map<string, { key: string; html: string }>();
  descriptionHtml
    .filter((entry) => entry.key !== DESCRIPTION_MD_KEY)
    .forEach((entry) => {
      sectionNoteEntries.set(toSectionKey(entry.key), entry);
    });
  const usedSectionNoteKeys = new Set<string>();
  const groupedSectionsWithNotes = pageSections.map((section) => {
    const noteEntry = section.isContinuation ? null : sectionNoteEntries.get(toSectionKey(section.label));
    if (noteEntry) {
      usedSectionNoteKeys.add(toSectionKey(noteEntry.key));
    }
    return {
      ...section,
      noteHtml: noteEntry ? processHtmlLinks(noteEntry.html).__html : null,
      noteNodes: noteEntry ? renderPageContentNodes(noteEntry.html, `${config.code}-section-note-${section.id}`) : null
    };
  });
  const detailDescriptionHtml =
    pagination.info.currentPage === 1
      ? descriptionHtml.filter(
          (entry) => entry.key === DESCRIPTION_MD_KEY || !usedSectionNoteKeys.has(toSectionKey(entry.key))
        )
      : [];
  const sectionNav = pagination.sectionLinks;
  const hasDetails = pagination.info.currentPage === 1 && (Boolean(detailDescriptionHtml.length) || Boolean(faqHtml.length));

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Wiki", href: "/wiki" },
    { label: config.gameName, href: `/wiki/${config.gameSlug}` },
    {
      label: pagination.info.currentPage === 1 ? config.label : `${config.label} page ${pagination.info.currentPage}`,
      href: null
    }
  ];

  const introNodes = introHtml ? renderPageContentNodes(introHtml, `${config.code}-intro`) : null;
  const descriptionNodes = detailDescriptionHtml.flatMap((entry) =>
    renderPageContentNodes(entry.html, `${config.code}-description-${entry.key}`)
  );
  const faqNodes = faqHtml.map((faq, idx) => ({
    ...faq,
    nodes: renderPageContentNodes(faq.a, `${config.code}-faq-${idx}`)
  }));

  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Wiki", url: `${SITE_URL.replace(/\/$/, "")}/wiki` },
      { name: config.gameName, url: `${SITE_URL.replace(/\/$/, "")}/wiki/${config.gameSlug}` },
      { name: pagination.info.currentPage === 1 ? config.label : `${config.label} page ${pagination.info.currentPage}`, url: canonicalUrl }
    ])
  );

  const listSchema = buildItemListSchema({
    title: pageTitleWithPage,
    description: pageDescriptionWithPage,
    url: canonicalUrl,
    items: pageItems,
    positionOffset: pagination.info.pageStartIndex,
    totalItems: itemCount
  });

  const pageSchema = JSON.stringify(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: canonicalPath.replace(/^\//, ""),
      title: pageTitleWithPage,
      description: pageDescriptionWithPage,
      image: `${SITE_URL}${FALLBACK_IMAGE}`,
      author: null,
      publishedAt: updatedIso,
      updatedAt: updatedIso
    })
  );

  return (
    <div className="catalog-surface space-y-10">
      <header className="space-y-4">
        <PageBreadcrumb items={breadcrumbItems} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{pageTitleWithPage}</h1>
        <UpdatedTimestamp value={updatedDate} />
      </header>

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space space-y-6">
        {pagination.info.currentPage === 1 && introNodes ? introNodes : null}

        <CatalogAdSlot />

        <GameCollectionView
          sections={groupedSectionsWithNotes}
          config={preparedCollection.viewConfig}
          pagination={pagination.info}
          toolbar={
            <>
              <DatasetCollectionNav config={config} className="max-w-none" />
              {sectionNav.length > 1 ? <SectionNav sections={sectionNav} className="max-w-none" /> : null}
            </>
          }
        />

        <CatalogAdSlot />

        {hasDetails ? (
          <>
            {descriptionNodes.length ? descriptionNodes : null}

            <ContentFaq
              items={faqNodes.map((faq, idx) => ({
                id: `${faq.q}-${idx}`,
                question: faq.q,
                answer: faq.nodes
              }))}
            />
          </>
        ) : null}
      </section>

      {pagination.info.currentPage === 1 ? (
        <>
          {contentHtml?.id ? (
            <div className="mt-10">
              <CommentsSection entityType="wiki_collection" entityId={contentHtml.id} />
            </div>
          ) : null}
          <MoreWikiCollections wikiSlug={config.gameSlug} excludeCollectionSlug={config.slug} gameName={config.gameName} />
        </>
      ) : null}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value) || isRecord(value)) return null;
  if (typeof value === "string") {
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (!trimmed) return null;
    const lowered = trimmed.toLowerCase();
    if (["none", "n/a", "na", "null"].includes(lowered)) return null;
    return trimmed;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value.toLocaleString("en-US");
  }
  return String(value);
}

function normalizeValue(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (normalized) return normalized;
  if (Array.isArray(value)) {
    const parts = value.map((entry) => normalizeValue(entry)).filter(Boolean) as string[];
    return parts.length ? parts.join("; ") : null;
  }
  if (isRecord(value)) {
    const parts = Object.entries(value)
      .map(([key, entry]) => {
        const entryValue = normalizeValue(entry);
        return entryValue ? `${getFieldLabel(key)}: ${entryValue}` : null;
      })
      .filter(Boolean) as string[];
    return parts.length ? parts.join("; ") : null;
  }
  return null;
}

function normalizeImage(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized || normalized.startsWith("data:image")) return null;
  return normalized;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toSectionKey(value: string): string {
  return toSlug(value.replace(/\+/g, " plus "));
}
