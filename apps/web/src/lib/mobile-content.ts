import fs from "node:fs/promises";
import {
  getArticleBySlug,
  getFreeItemCategories,
  getChecklistPageBySlug,
  listFreeItems,
  listPublishedArticlesPage,
  listPublishedChecklistsPage,
  type ArticleWithRelations,
  type ChecklistSummaryRow,
  type FreeItem
} from "@/lib/db";
import { buildEventsCards } from "@/app/(site)/events/page-data";
import {
  getCatalogPageContentByCodes,
  listPublishedCatalogPagesByCodePrefix,
  listPublishedTopLevelCatalogPages,
  type CatalogIndexEntry
} from "@/lib/catalog";
import { getQuizPageByCode, listPublishedQuizzes, loadQuizData, type QuizListEntry } from "@/lib/quizzes";
import { SITE_URL } from "@/lib/seo";
import { getToolContentWithDevFallback, listPublishedToolsPage, type ToolListEntry } from "@/lib/tools";
import { resolveModifiedAt } from "@/lib/content-dates";
import { cleanRewardsText, isCodeNew } from "@/lib/code-utils";
import { getWikiPageBySlug, listPublishedWikiPages, loadWikiRelatedData, type WikiListEntry } from "@/lib/wiki";
import {
  getWikiCollectionPageByCode,
  listPublishedWikiCollectionPagesByWikiSlug
} from "@/lib/wiki-collections";
import {
  getPublishedWikiCollectionRuntime
} from "@/lib/wiki-collection-runtime";
import { listUniverseEventTimeline } from "@/lib/events-summary";
import { repoPath } from "@/lib/paths";
import { GAME_COLLECTIONS, getFieldLabel, getGameCollectionConfigByCode } from "@/lib/game-collections";
import { listGameCollectionImageUrls } from "@/lib/game-collection-images";
import { unwrapDatasetItems } from "@/lib/local-datasets";
import { supabaseAdmin } from "@/lib/supabase";
import { ROBUX_BUNDLES, type RobuxBundle } from "@/app/(site)/tools/robux-to-usd-calculator/robux-bundles";
import { robuxForBundle } from "@/app/(site)/tools/robux-to-usd-calculator/robux-plans";
import { calculateDevexPayout, calculateDevexRequirement } from "@/lib/devex/calculator";
import { DEVEX_MIN, DEVEX_NEW_RATE, DEVEX_OLD_RATE, DEVEX_RATE_EFFECTIVE_DATE } from "@/lib/devex/constants";
import { getGrowGardenCollectionConfig, loadGrowGardenCollectionDataset } from "@/app/(site)/wiki/collections/games/grow-a-garden";
import { getTheForgeCollectionConfig, loadTheForgeCollectionDataset } from "@/app/(site)/wiki/collections/games/the-forge";

const PAGE_SIZE = 20;
const DETAIL_ITEM_LIMIT = 36;
const MOBILE_COLLECTION_OMITTED_KEYS = new Set([
  "id",
  "slug",
  "name",
  "title",
  "image",
  "imageStatus",
  "imageMissingReason",
  "imageSource",
  "thumbnail",
  "thumbnail_url",
  "imageUrl",
  "imageCandidate",
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
  "raw",
  "rawText",
  "fields",
  "sections",
  "updatedAt",
  "collectionSection",
  "sortOrder"
]);

export type MobileContentKind = "articles" | "catalog" | "checklists" | "events" | "quizzes" | "tools" | "wiki";

export type MobileContentItem = {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  coverImage: string | null;
  updatedAt: string | null;
  url: string;
  badge: string | null;
};

export type MobileContentIndexPayload = {
  ok: true;
  kind: MobileContentKind;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  latestUpdatedAt: string | null;
  query?: string | null;
  items: MobileContentItem[];
};

export type MobileContentDetailFieldTone = "positive" | "negative" | "warning" | "neutral";

export type MobileContentDetailField = {
  key: string;
  label: string;
  value: string;
  kind: "chip" | "detail" | "text";
  tone?: MobileContentDetailFieldTone | null;
};

export type MobileContentDetailItem = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  badge: string | null;
  image: string | null;
  images?: string[];
  url?: string | null;
  copyValue?: string | null;
  color?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  status?: "upcoming" | "current" | "past" | null;
  fields?: MobileContentDetailField[];
};

export type MobileContentDetailSection = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  items: MobileContentDetailItem[];
  variant?:
    | "collection-items"
    | "collection-details"
    | "codes"
    | "cta"
    | "faq"
    | "links"
    | "markdown"
    | "prose"
    | "social"
    | "stats"
    | "timeline";
  sourceId?: string | null;
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  query?: string | null;
};

export type MobileContentDetailPayload = {
  ok: true;
  kind: MobileContentKind;
  title: string;
  subtitle: string | null;
  summary: string | null;
  coverImage: string | null;
  updatedAt: string | null;
  url: string;
  badge: string | null;
  robloxUrl?: string | null;
  universeId?: number | null;
  layout?: "default" | "events" | "wiki" | "wiki_collection";
  sections: MobileContentDetailSection[];
};

function normalizePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function normalizeSearchQuery(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function mobileItemMatchesQuery(item: MobileContentItem, query: string | null): boolean {
  if (!query) return true;
  return [item.title, item.subtitle, item.summary, item.badge]
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    .some((entry) => entry.toLowerCase().includes(query));
}

function paginateMobileItems(items: MobileContentItem[], page: number, pageSize: number, query: string | null) {
  const filtered = query ? items.filter((item) => mobileItemMatchesQuery(item, query)) : items;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const offset = (safePage - 1) * pageSize;
  return {
    items: filtered.slice(offset, offset + pageSize),
    page: safePage,
    total: filtered.length,
    totalPages
  };
}

function absoluteAssetUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL.replace(/\/$/, "")}/${value.replace(/^\//, "")}`;
}

function pickThumbnail(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "string" && entry.trim()) return entry;
      if (entry && typeof entry === "object" && "url" in entry) {
        const url = (entry as { url?: unknown }).url;
        if (typeof url === "string" && url.trim()) return url;
      }
    }
  }
  return null;
}

function summarize(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const plain = value.replace(/[#>*_`~[\]]/g, " ").replace(/\s+/g, " ").trim();
  if (!plain) return fallback;
  if (plain.length <= 160) return plain;
  const slice = plain.slice(0, 157);
  const lastSpace = slice.lastIndexOf(" ");
  return `${lastSpace > 120 ? slice.slice(0, lastSpace) : slice}...`;
}

function toPlainText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function truncate(value: string | null, max = 900): string | null {
  if (!value || value.length <= max) return value;
  const slice = value.slice(0, max - 3);
  const lastSpace = slice.lastIndexOf(" ");
  return `${lastSpace > max * 0.7 ? slice.slice(0, lastSpace) : slice}...`;
}

function section(
  id: string,
  title: string,
  options: {
    body?: string | null;
    bodyMax?: number;
    items?: MobileContentDetailItem[];
    page?: number;
    pageSize?: number;
    query?: string | null;
    sourceId?: string | null;
    subtitle?: string | null;
    total?: number;
    variant?: MobileContentDetailSection["variant"];
  }
): MobileContentDetailSection | null {
  const body = truncate(options.body ?? null, options.bodyMax ?? 900);
  const items = options.items?.filter(Boolean) ?? [];
  const pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : undefined;
  const total = typeof options.total === "number" ? options.total : undefined;
  if (!body && items.length === 0) return null;
  return {
    id,
    title,
    subtitle: options.subtitle ?? null,
    body,
    items,
    variant: options.variant,
    sourceId: options.sourceId ?? null,
    page: options.page,
    pageSize,
    query: options.query ?? null,
    total,
    totalPages: pageSize && typeof total === "number" ? Math.max(1, Math.ceil(total / pageSize)) : undefined
  };
}

function detailItem(
  id: string,
  title: string,
  options: {
    badge?: string | null;
    body?: string | null;
    bodyMax?: number;
    color?: string | null;
    copyValue?: string | null;
    fields?: MobileContentDetailField[];
    image?: string | null;
    images?: string[];
    preserveMarkdown?: boolean;
    startAt?: string | null;
    endAt?: string | null;
    status?: "upcoming" | "current" | "past" | null;
    subtitle?: string | null;
    url?: string | null;
  } = {}
): MobileContentDetailItem {
  return {
    id,
    title,
    subtitle: options.subtitle ?? null,
    body: truncate(
      options.preserveMarkdown ? options.body ?? null : toPlainText(options.body) ?? options.body ?? null,
      options.bodyMax ?? 420
    ),
    badge: options.badge ?? null,
    image: absoluteAssetUrl(options.image ?? null),
    images: options.images?.length
      ? (options.images.map((entry) => absoluteAssetUrl(entry)).filter(Boolean) as string[])
      : undefined,
    url: options.url ?? undefined,
    copyValue: options.copyValue ?? undefined,
    color: options.color ?? undefined,
    startAt: options.startAt ?? null,
    endAt: options.endAt ?? null,
    status: options.status ?? null,
    fields: options.fields?.length ? options.fields : undefined
  };
}

const MOBILE_CONTROL_ALIASES = {
  desktop: ["desktop", "pc", "computer", "keyboard", "keyboard_mouse", "keyboardMouse"],
  mobile: ["mobile", "phone"],
  tablet: ["tablet"],
  console: ["console", "controller", "xbox", "playstation"],
  vr: ["vr", "virtual_reality", "virtualReality"]
} as const;

function controlValue(value: unknown): string | null {
  if (typeof value === "string") return normalizeText(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(controlValue).filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  }
  if (isRecord(value)) {
    const parts = Object.entries(value)
      .map(([key, entry]) => {
        const formatted = controlValue(entry);
        return formatted ? `${humanizeKey(key)}: ${formatted}` : null;
      })
      .filter(Boolean);
    return parts.length ? parts.join("; ") : null;
  }
  return null;
}

function mobileControlItems(raw: unknown): MobileContentDetailItem[] {
  const entries = Array.isArray(raw) ? raw.map((value, index) => [`control-${index + 1}`, value] as const) : isRecord(raw) ? Object.entries(raw) : [];
  return entries
    .map(([fallback, value], index): MobileContentDetailItem | null => {
      if (!isRecord(value)) return null;
      const title =
        controlValue(value.action) ??
        controlValue(value.move) ??
        controlValue(value.label) ??
        controlValue(value.title) ??
        controlValue(value.name) ??
        humanizeKey(fallback || `Control ${index + 1}`);
      const fields = Object.entries(MOBILE_CONTROL_ALIASES)
        .map(([device, aliases]): MobileContentDetailField | null => {
          const matched = aliases.map((alias) => controlValue(value[alias])).find(Boolean) ?? null;
          return matched ? { key: device, label: humanizeKey(device), value: matched, kind: "text" } : null;
        })
        .filter(Boolean) as MobileContentDetailField[];
      return fields.length ? detailItem(fallback || `control-${index + 1}`, title, { fields }) : null;
    })
    .filter(Boolean) as MobileContentDetailItem[];
}

function deviceSupportLabel(page: {
  desktop_enabled?: boolean | null;
  mobile_enabled?: boolean | null;
  tablet_enabled?: boolean | null;
  console_enabled?: boolean | null;
  vr_enabled?: boolean | null;
}): string | null {
  const devices = [
    ["Desktop", page.desktop_enabled],
    ["Mobile", page.mobile_enabled],
    ["Tablet", page.tablet_enabled],
    ["Console", page.console_enabled],
    ["VR", page.vr_enabled]
  ].filter((entry): entry is [string, true] => entry[1] === true);
  return devices.length ? devices.map(([label]) => label).join(", ") : null;
}

const MOBILE_SOCIAL_LABELS: Record<string, string> = {
  twitter: "Twitter / X",
  x: "Twitter / X",
  youtube: "YouTube",
  discord: "Discord",
  twitch: "Twitch",
  facebook: "Facebook",
  roblox_group: "Roblox Group",
  roblox: "Roblox Group",
  guilded: "Guilded"
};

function mobileSocialItems(raw: unknown): MobileContentDetailItem[] {
  if (!isRecord(raw)) return [];
  const seen = new Set<string>();
  const items: MobileContentDetailItem[] = [];
  for (const [platform, value] of Object.entries(raw)) {
    const normalizedPlatform = platform.trim().toLowerCase();
    const entries = Array.isArray(value) ? value : [value];
    for (const entry of entries) {
      const url =
        typeof entry === "string"
          ? normalizeText(entry)
          : isRecord(entry) && typeof entry.url === "string"
            ? normalizeText(entry.url)
            : null;
      if (!url || !/^https?:\/\//i.test(url)) continue;
      const dedupeKey = url.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      const title = isRecord(entry) && typeof entry.title === "string" ? normalizeText(entry.title) : null;
      items.push(
        detailItem(
          `${normalizedPlatform}-${items.length}`,
          title ?? MOBILE_SOCIAL_LABELS[normalizedPlatform] ?? humanizeKey(normalizedPlatform),
          { badge: normalizedPlatform, url }
        )
      );
    }
  }
  return items.slice(0, 10);
}

function keyValueItems(values: Record<string, unknown>): MobileContentDetailItem[] {
  return Object.entries(values)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 24)
    .map(([key, value]) =>
      detailItem(key, key.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()), {
        body: Array.isArray(value) ? value.join(", ") : String(value)
      })
    );
}

function compactNumber(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function latest(values: Array<string | null>): string | null {
  return values.reduce<string | null>((latestValue, value) => {
    if (!value) return latestValue;
    if (!latestValue) return value;
    return new Date(value) > new Date(latestValue) ? value : latestValue;
  }, null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function humanizeKey(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed || null;
}

function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No";
}

function formatUnknownValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return formatBoolean(value);
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString("en-US") : null;
  }
  if (typeof value === "string") {
    return normalizeText(value);
  }
  if (Array.isArray(value)) {
    const values = value.map(formatUnknownValue).filter(Boolean);
    return values.length ? values.join(", ") : null;
  }
  if (isRecord(value)) {
    const values = Object.entries(value)
      .map(([key, entry]) => {
        const formatted = formatUnknownValue(entry);
        return formatted ? `${humanizeKey(key)}: ${formatted}` : null;
      })
      .filter(Boolean);
    return values.length ? values.join("; ") : null;
  }
  return null;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function percent(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function numberLabel(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value.toLocaleString("en-US");
}

function firstMeaningfulValue(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = formatUnknownValue(row[key]);
    if (value) return value;
  }
  return null;
}

function datasetItemBody(row: Record<string, unknown>, keys: string[], max = 5): string | null {
  const parts = keys
    .filter((key) => !MOBILE_COLLECTION_OMITTED_KEYS.has(key))
    .map((key) => {
      const value = formatUnknownValue(row[key]);
      return value ? `${getFieldLabel(key)}: ${value}` : null;
    })
    .filter(Boolean)
    .slice(0, max);

  return parts.length ? parts.join(" | ") : null;
}

function normalizeHexColor(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed}`;
  return null;
}

function detailItemsFromRows(
  rows: Array<Record<string, unknown>>,
  options: {
    badgeKeys?: string[];
    bodyKeys?: string[];
    colorKey?: string;
    copyKeys?: string[];
    fallbackBadge?: string | null;
    fieldKeys?: string[];
    imageKeys?: string[];
    limit?: number;
    subtitleKeys?: string[];
    titleKeys?: string[];
  } = {}
): MobileContentDetailItem[] {
  const titleKeys = options.titleKeys ?? ["name", "title", "label", "code", "id"];
  const subtitleKeys = options.subtitleKeys ?? ["category", "subcategory", "artist", "creator_name", "type", "rarity", "tier"];
  const badgeKeys = options.badgeKeys ?? ["rarity", "tier", "status", "price", "price_robux", "rank", "code", "id"];
  const imageKeys = options.imageKeys ?? ["image", "thumbnail_url", "thumbnail", "image_url", "icon_url", "thumb_url"];
  const limit = options.limit ?? DETAIL_ITEM_LIMIT;

  return rows.slice(0, limit).map((row, index) => {
    const title = firstMeaningfulValue(row, titleKeys) ?? `Item ${index + 1}`;
    const subtitle = firstMeaningfulValue(row, subtitleKeys);
    const badge = firstMeaningfulValue(row, badgeKeys) ?? options.fallbackBadge ?? null;
    const image = firstMeaningfulValue(row, imageKeys);
    const body = datasetItemBody(row, options.bodyKeys ?? Object.keys(row));
    const id = firstMeaningfulValue(row, ["id", "asset_id", "code", "slug", "name", "title"]) ?? `${index}`;
    const copyValue = options.copyKeys ? firstMeaningfulValue(row, options.copyKeys)?.replace(/,/g, "") ?? null : null;
    const color = options.colorKey ? normalizeHexColor(formatUnknownValue(row[options.colorKey])) : null;
    const fields = (options.fieldKeys ?? [])
      .map((key): MobileContentDetailField | null => {
        const value = formatUnknownValue(row[key]);
        if (!value) return null;
        return {
          key,
          label: getFieldLabel(key),
          value,
          kind: mobileCollectionFieldKind(value),
          tone: mobileFieldTone(key, value)
        };
      })
      .filter(Boolean) as MobileContentDetailField[];
    return detailItem(String(id), title, {
      subtitle,
      badge,
      image,
      body: fields.length ? null : body,
      copyValue,
      color,
      fields: fields.length ? fields : undefined
    });
  });
}

function readRecordArrayPayload(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }
  if (!isRecord(value)) return [];
  return unwrapDatasetItems<Record<string, unknown>>(value as {
    meta?: unknown;
    items?: Array<Record<string, unknown> | { item?: Record<string, unknown>; system?: Record<string, unknown> }> | null;
    data?: Array<Record<string, unknown> | { item?: Record<string, unknown>; system?: Record<string, unknown> }> | null;
    rows?: Array<Record<string, unknown> | { item?: Record<string, unknown>; system?: Record<string, unknown> }> | null;
  }).filter(isRecord);
}

async function readJsonFile(path: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(path, "utf8")) as unknown;
  } catch (error) {
    console.warn(`Failed to load mobile dataset file ${path}`, error);
    return null;
  }
}

function sectionPage(searchParams: URLSearchParams | undefined, sectionId: string): number {
  const specific = searchParams?.get(`sectionPage.${sectionId}`);
  const legacy = searchParams?.get(`${sectionId}Page`);
  return normalizePositiveInt(specific ?? legacy ?? null, 1);
}

function sectionPageSize(searchParams: URLSearchParams | undefined, fallback = DETAIL_ITEM_LIMIT): number {
  const requested = normalizePositiveInt(searchParams?.get("sectionPageSize") ?? null, fallback);
  return Math.max(6, Math.min(60, requested));
}

function detailQuery(searchParams: URLSearchParams | undefined): string | null {
  return normalizeText(searchParams?.get("q"));
}

function rowMatchesQuery(row: Record<string, unknown>, query: string | null): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  return Object.values(row).some((value) => (formatUnknownValue(value) ?? "").toLowerCase().includes(needle));
}

function filterRowsByQuery<T extends Record<string, unknown>>(rows: T[], query: string | null): T[] {
  return query ? rows.filter((row) => rowMatchesQuery(row, query)) : rows;
}

function paginateRows<T>(rows: T[], page: number, pageSize: number): T[] {
  const offset = (Math.max(1, page) - 1) * pageSize;
  return rows.slice(offset, offset + pageSize);
}

function getRecordProperty(value: Record<string, unknown> | null, key: string): unknown {
  return value && key in value ? value[key] : null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : [];
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function mobileSectionId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "items";
}

function mobileCollectionFieldKind(value: string): MobileContentDetailField["kind"] {
  if (value.length > 90 || value.split(/\s+/).length > 12) return "detail";
  if (/^[+-]?\d[\d,.\s%kxKMB]*$/.test(value) || /\b(robux|bucks|coins|cash|xp|sec|seconds|min|minutes|hours|%)\b/i.test(value)) {
    return "chip";
  }
  return "text";
}

const MOBILE_STATUS_FIELD_KEYS = ["availability", "available", "status", "obtainable", "obtainability", "tradable", "tradeable"];

function mobileFieldTone(key: string, value: string): MobileContentDetailFieldTone | null {
  const loweredKey = key.toLowerCase();
  const lowered = value.toLowerCase();
  if (MOBILE_STATUS_FIELD_KEYS.some((entry) => loweredKey.includes(entry))) {
    if (/\b(retired|removed|unavailable|not available|trade only|unobtainable|not obtainable|disabled|inactive)\b/.test(lowered)) {
      return "negative";
    }
    if (/\b(event|limited|seasonal|early access|exclusive|shop pool|random roll)\b/.test(lowered)) {
      return "warning";
    }
    if (/\b(available|current|free|default|public|private server|obtainable|complete)\b/.test(lowered)) {
      return "positive";
    }
  }
  if (lowered === "yes" || lowered === "true") return "positive";
  if (lowered === "no" || lowered === "false") return "negative";
  return null;
}

type MobileFieldPresentation = {
  kind?: MobileContentDetailField["kind"];
  label?: string;
  tone?: MobileContentDetailFieldTone;
};

function normalizePresentationKind(value: unknown): MobileContentDetailField["kind"] | null {
  if (value === "chip" || value === "highlight") return "chip";
  if (value === "detail") return "detail";
  if (value === "normal" || value === "text") return "text";
  return null;
}

function normalizePresentationTone(value: unknown): MobileContentDetailFieldTone | null {
  return value === "positive" || value === "negative" || value === "warning" || value === "neutral" ? value : null;
}

function collectionFieldPresentation(payload: unknown): Record<string, MobileFieldPresentation> {
  const { meta, display } = collectionDisplayConfig(payload);
  const raw = getRecordProperty(display, "fieldPresentation") ?? getRecordProperty(meta, "fieldPresentation");
  if (!isRecord(raw)) return {};
  const result: Record<string, MobileFieldPresentation> = {};
  for (const [key, entry] of Object.entries(raw)) {
    if (typeof entry === "string") {
      const kind = normalizePresentationKind(entry);
      if (kind) result[key] = { kind };
      continue;
    }
    if (!isRecord(entry)) continue;
    result[key] = {
      kind: normalizePresentationKind(entry.kind) ?? undefined,
      label: normalizeText(entry.label) ?? undefined,
      tone: normalizePresentationTone(entry.tone) ?? undefined
    };
  }
  return result;
}

function collectionDisplayConfig(payload: unknown) {
  const meta = isRecord(payload) && isRecord(payload.meta) ? payload.meta : null;
  const display = meta && isRecord(meta.display) ? meta.display : null;
  return { meta, display };
}

function collectionDisplayKeys(payload: unknown, columns: string[]) {
  const { meta, display } = collectionDisplayConfig(payload);
  const badgeKey = normalizeText(getRecordProperty(display, "badgeField"));
  const descriptionKey =
    normalizeText(getRecordProperty(display, "cardDescriptionField")) ??
    normalizeText(getRecordProperty(display, "descriptionField")) ??
    ["cardSummary", "summary", "description", "overview", "effect", "purpose", "notes"].find((key) => columns.includes(key)) ??
    null;
  const subtitleKeys = stringList(getRecordProperty(display, "subtitleFields")).filter((key) => columns.includes(key));
  const configuredCardFields = stringList(getRecordProperty(display, "cardFields"));
  const configuredTableFields = stringList(getRecordProperty(display, "tableFields"));
  const fieldKeys = uniqueStrings([
    ...configuredCardFields,
    ...configuredTableFields,
    ...columns
  ]).filter(
    (key) =>
      columns.includes(key) &&
      key !== badgeKey &&
      key !== descriptionKey &&
      !subtitleKeys.includes(key) &&
      !MOBILE_COLLECTION_OMITTED_KEYS.has(key)
  );
  const sectionOrder = stringList(getRecordProperty(display, "sectionOrder")).length
    ? stringList(getRecordProperty(display, "sectionOrder"))
    : stringList(getRecordProperty(meta, "sectionOrder"));

  return { badgeKey, descriptionKey, fieldKeys, sectionOrder, subtitleKeys };
}

function mobileCollectionItem(row: Record<string, unknown>, fieldKeys: string[], options: {
  badgeKey: string | null;
  descriptionKey: string | null;
  presentation?: Record<string, MobileFieldPresentation>;
  subtitleKeys: string[];
}): MobileContentDetailItem {
  const title = firstMeaningfulValue(row, ["name", "title", "label", "id"]) ?? "Item";
  const id = firstMeaningfulValue(row, ["id", "slug", "name", "title"]) ?? title;
  const body = options.descriptionKey ? formatUnknownValue(row[options.descriptionKey]) : null;
  const fields = fieldKeys
    .map((key): MobileContentDetailField | null => {
      const value = formatUnknownValue(row[key]);
      if (!value) return null;
      const presentation = options.presentation?.[key];
      return {
        key,
        label: presentation?.label ?? getFieldLabel(key),
        value,
        kind: presentation?.kind ?? mobileCollectionFieldKind(value),
        tone: presentation?.tone ?? mobileFieldTone(key, value)
      };
    })
    .filter(Boolean) as MobileContentDetailField[];

  return detailItem(String(id), title, {
    badge: options.badgeKey ? formatUnknownValue(row[options.badgeKey]) : null,
    body,
    fields,
    image: firstMeaningfulValue(row, ["image", "thumbnail_url", "thumbnail", "image_url"]),
    subtitle: firstMeaningfulValue(row, options.subtitleKeys)
  });
}

async function collectionNavItemsForCode(code: string): Promise<MobileContentDetailItem[]> {
  const page = await getWikiCollectionPageByCode(code);
  if (page) {
    const published = await listPublishedWikiCollectionPagesByWikiSlug(page.wiki_slug);
    if (published.length) {
      return published.map((entry) =>
        detailItem(entry.code, entry.display_name?.trim() || entry.title, {
          badge: entry.code === code ? "Current" : null,
          subtitle: entry.wiki_slug
        })
      );
    }
  }

  const current = getGameCollectionConfigByCode(code);
  if (!current) return [];
  return GAME_COLLECTIONS.filter((entry) => entry.gameSlug === current.gameSlug).map((entry) =>
    detailItem(entry.code, entry.label, {
      badge: entry.code === code ? "Current" : null,
      subtitle: entry.gameName
    })
  );
}

function mapQuiz(row: QuizListEntry): MobileContentItem {
  const universeName = row.universe?.display_name ?? row.universe?.name ?? null;
  const thumbnail = pickThumbnail(row.universe?.thumbnail_urls);
  const coverImage = absoluteAssetUrl(row.universe?.icon_url || thumbnail || "/Bloxodes.png");
  const updatedAt = row.content_updated_at || row.updated_at || row.published_at || row.created_at || null;

  return {
    id: row.id,
    title: row.title,
    subtitle: universeName,
    summary: summarize(row.seo_description ?? row.description_md ?? null, "Quick Roblox quiz from Bloxodes."),
    coverImage,
    updatedAt,
    url: `${SITE_URL}/quizzes/${row.code}`,
    badge: "Quiz"
  };
}

function mapChecklist(row: ChecklistSummaryRow): MobileContentItem {
  const universeName = row.universe?.display_name ?? row.universe?.name ?? null;
  const thumbnail = pickThumbnail(row.universe?.thumbnail_urls);
  const coverImage = absoluteAssetUrl(row.universe?.icon_url || thumbnail || "/Bloxodes.png");
  const updatedAt = row.content_updated_at || row.updated_at || row.published_at || row.created_at || null;
  const itemCount = typeof row.leaf_item_count === "number" ? row.leaf_item_count : typeof row.item_count === "number" ? row.item_count : null;

  return {
    id: row.id,
    title: row.title,
    subtitle: universeName,
    summary: summarize(row.seo_description ?? row.description_md ?? null, "Guided Roblox checklist from Bloxodes."),
    coverImage,
    updatedAt,
    url: `${SITE_URL}/checklists/${row.slug}`,
    badge: itemCount ? `${itemCount} tasks` : "Checklist"
  };
}

function mapTool(row: ToolListEntry): MobileContentItem {
  const updatedAt = resolveModifiedAt(row);
  const coverImage = absoluteAssetUrl(row.thumb_url || row.universe?.icon_url || "/Bloxodes.png");

  return {
    id: row.id ?? row.code,
    title: row.title,
    subtitle: row.universe?.display_name ?? row.universe?.name ?? null,
    summary: summarize(row.meta_description ?? row.intro_md ?? null, "Roblox utility from Bloxodes."),
    coverImage,
    updatedAt,
    url: `${SITE_URL}/tools/${row.code}`,
    badge: "Tool"
  };
}

function mapArticle(row: ArticleWithRelations): MobileContentItem {
  const updatedAt = row.updated_at || row.published_at || row.created_at || null;
  const authorName = row.author?.name ?? null;
  const universeName = row.universe?.display_name ?? row.universe?.name ?? null;

  return {
    id: row.id,
    title: row.title,
    subtitle: universeName ?? authorName,
    summary: summarize(row.meta_description ?? null, "Latest Roblox guide from Bloxodes."),
    coverImage: absoluteAssetUrl(row.cover_image || row.universe?.icon_url || "/Bloxodes.png"),
    updatedAt,
    url: `${SITE_URL}/articles/${row.slug}`,
    badge: authorName ? `By ${authorName}` : "Article"
  };
}

function mapCatalog(row: CatalogIndexEntry): MobileContentItem {
  const updatedAt = row.content_updated_at || row.updated_at || row.published_at || row.created_at || null;

  return {
    id: row.id ?? row.code,
    title: row.title,
    subtitle: row.universe_name ?? null,
    summary: summarize(row.meta_description ?? row.intro_md ?? null, "Roblox catalog page from Bloxodes."),
    coverImage: absoluteAssetUrl(row.thumb_url || "/Bloxodes.png"),
    updatedAt,
    url: `${SITE_URL}/catalog/${row.code}`,
    badge: "Catalog"
  };
}

function mapWiki(row: WikiListEntry): MobileContentItem {
  const updatedAt = row.content_updated_at || row.updated_at || row.published_at || row.created_at || null;
  const thumbnail = pickThumbnail(row.thumbnail_urls);

  return {
    id: row.id,
    title: row.title,
    subtitle: "Roblox wiki",
    summary: summarize(row.meta_description ?? null, "Roblox wiki page from Bloxodes."),
    coverImage: absoluteAssetUrl(row.cover_image || row.icon_url || thumbnail || "/Bloxodes.png"),
    updatedAt,
    url: `${SITE_URL}/wiki/${row.slug}`,
    badge: "Wiki"
  };
}

async function loadGameCollectionSections(code: string, searchParams?: URLSearchParams): Promise<MobileContentDetailSection[]> {
  const page = await getWikiCollectionPageByCode(code);
  if (!page) return [];
  const runtime = await getPublishedWikiCollectionRuntime(page);
  if (!runtime) {
    throw new Error(`Required database runtime for ${code} did not load. Local fallback is disabled.`);
  }
  const config = runtime.config;
  const payload = runtime.document;
  const rows = readRecordArrayPayload(payload);
  const normalized: Array<Record<string, unknown>> = rows
    .map((row): Record<string, unknown> => {
      const nestedFields = isRecord(row.fields) ? row.fields : {};
      return {
        ...nestedFields,
        ...row,
        name: normalizeText(row.name) ?? normalizeText(row.title) ?? normalizeText(row.item) ?? null,
        image: normalizeText(row.image) ?? null
      };
    })
    .filter((row) => normalizeText(row.name));

  if (!normalized.length) return [];

  const query = detailQuery(searchParams);
  const filteredRows = filterRowsByQuery(normalized, query);
  const columns = Array.from(new Set(normalized.flatMap((row) => Object.keys(row))));
  const { badgeKey, descriptionKey, fieldKeys, sectionOrder, subtitleKeys } = collectionDisplayKeys(payload, columns);
  const presentation = collectionFieldPresentation(payload);
  const groupKey =
    columns.includes("collectionSection")
      ? "collectionSection"
      : ["category", "type", "rarity", "tier", "status", "source", "location", "stage"].find((key) => columns.includes(key));
  const groupedRows = new Map<string, Record<string, unknown>[]>();

  for (const row of filteredRows) {
    const label = (groupKey ? formatUnknownValue(row[groupKey]) : null) ?? config.label;
    groupedRows.set(label, [...(groupedRows.get(label) ?? []), row]);
  }

  const orderIndex = new Map(sectionOrder.map((label, index) => [label, index]));
  return Array.from(groupedRows.entries())
    .sort((a, b) => {
      const left = orderIndex.get(a[0]);
      const right = orderIndex.get(b[0]);
      if (left !== undefined && right !== undefined) return left - right;
      if (left !== undefined) return -1;
      if (right !== undefined) return 1;
      return a[0].localeCompare(b[0]);
    })
    .map(([label, entries]) =>
      section(`collection-${mobileSectionId(label)}`, label, {
        items: entries.map((row) =>
          mobileCollectionItem(row, fieldKeys, {
            badgeKey,
            descriptionKey,
            presentation,
            subtitleKeys
          })
        ),
        subtitle: `${entries.length.toLocaleString("en-US")} ${entries.length === 1 ? "item" : "items"}`,
        total: entries.length,
        variant: "collection-items"
      })
    )
    .filter(Boolean) as MobileContentDetailSection[];
}

async function loadGrowGardenCatalogSections(code: string, searchParams?: URLSearchParams): Promise<MobileContentDetailSection[]> {
  const slug = code.replace(/^grow-a-garden-/, "");
  const config = getGrowGardenCollectionConfig(slug);
  if (!config) return [];
  const dataset = await loadGrowGardenCollectionDataset(config);
  if (!dataset.items.length) return [];
  const rows = dataset.items as Array<Record<string, unknown>>;
  const query = detailQuery(searchParams);
  const filteredRows = filterRowsByQuery(rows, query);
  const columns = Array.from(new Set(filteredRows.flatMap((row) => Object.keys(row))));
  const { badgeKey, descriptionKey, fieldKeys, subtitleKeys } = collectionDisplayKeys(dataset, columns);
  const page = sectionPage(searchParams, "catalog-dataset");
  const pageSize = sectionPageSize(searchParams);
  const pagedRows = paginateRows(filteredRows, page, pageSize);

  return [
    section("catalog-dataset", `${config.label} database`, {
      subtitle: `${filteredRows.length.toLocaleString("en-US")} entries`,
      body: `${config.description} Page ${page} of ${Math.max(1, Math.ceil(filteredRows.length / pageSize))}.`,
      items: pagedRows.map((row) =>
        mobileCollectionItem(row, fieldKeys, {
          badgeKey: config.badgeKey ?? badgeKey,
          descriptionKey,
          presentation: collectionFieldPresentation(dataset),
          subtitleKeys: uniqueStrings([...(config.subtitleKeys ?? []), ...subtitleKeys])
        })
      ),
      page,
      pageSize,
      query,
      total: filteredRows.length,
      variant: "collection-items"
    })
  ].filter(Boolean) as MobileContentDetailSection[];
}

async function loadForgeCatalogSections(code: string, searchParams?: URLSearchParams): Promise<MobileContentDetailSection[]> {
  const slug = code.replace(/^the-forge-/, "");
  const config = getTheForgeCollectionConfig(slug);
  if (!config) return [];
  const dataset = await loadTheForgeCollectionDataset(config);
  if (!dataset.items.length) return [];
  const rows = dataset.items as Array<Record<string, unknown>>;
  const query = detailQuery(searchParams);
  const filteredRows = filterRowsByQuery(rows, query);
  const columns = Array.from(new Set(filteredRows.flatMap((row) => Object.keys(row))));
  const { badgeKey, descriptionKey, fieldKeys, subtitleKeys } = collectionDisplayKeys(dataset, columns);
  const page = sectionPage(searchParams, "catalog-dataset");
  const pageSize = sectionPageSize(searchParams);
  const pagedRows = paginateRows(filteredRows, page, pageSize);

  return [
    section("catalog-dataset", `${config.label} database`, {
      subtitle: `${filteredRows.length.toLocaleString("en-US")} entries`,
      body: `${config.description} Page ${page} of ${Math.max(1, Math.ceil(filteredRows.length / pageSize))}.`,
      items: pagedRows.map((row) =>
        mobileCollectionItem(row, fieldKeys, {
          badgeKey: config.badgeKey ?? badgeKey,
          descriptionKey,
          presentation: collectionFieldPresentation(dataset),
          subtitleKeys: uniqueStrings([...(config.subtitleKeys ?? []), config.groupKey, ...subtitleKeys])
        })
      ),
      page,
      pageSize,
      query,
      total: filteredRows.length,
      variant: "collection-items"
    })
  ].filter(Boolean) as MobileContentDetailSection[];
}

async function loadFreeItemsCatalogSections(searchParams?: URLSearchParams): Promise<MobileContentDetailSection[]> {
  const page = sectionPage(searchParams, "free-items");
  const pageSize = sectionPageSize(searchParams);
  const query = detailQuery(searchParams);
  const [{ items, total }, categories] = await Promise.all([listFreeItems(page, pageSize, { search: query ?? undefined }), getFreeItemCategories()]);
  const rows = items.map((item: FreeItem) => ({
    ...item,
    price_robux: item.price_robux === 0 ? "Free" : item.price_robux,
    thumbnail_url: item.thumbnail_url
  }));

  return [
    section("free-items", "Free Roblox items", {
      subtitle: `${total.toLocaleString("en-US")} items`,
      body: `Every free Roblox catalog item currently tracked by Bloxodes. Page ${page} of ${Math.max(1, Math.ceil(total / pageSize))}.`,
      items: detailItemsFromRows(rows, {
        badgeKeys: ["price_robux", "item_type"],
        subtitleKeys: ["category", "subcategory", "creator_name"],
        imageKeys: ["thumbnail_url"],
        fieldKeys: ["item_type", "creator_name", "favorite_count"],
        limit: pageSize
      }),
      page,
      pageSize,
      query,
      total
    }),
    categories.length
      ? section("free-item-categories", "Categories", {
          items: categories.slice(0, 16).map((category) =>
            detailItem(category.category, category.category, {
              badge: `${category.count.toLocaleString("en-US")} items`
            })
          )
        })
      : null
  ].filter(Boolean) as MobileContentDetailSection[];
}

async function loadMusicCatalogSections(searchParams?: URLSearchParams): Promise<MobileContentDetailSection[]> {
  const supabase = supabaseAdmin();
  const page = sectionPage(searchParams, "music-ids");
  const pageSize = sectionPageSize(searchParams);
  const query = detailQuery(searchParams);
  const offset = (page - 1) * pageSize;
  let musicQuery = supabase
    .from("roblox_music_ids_ranked_view")
    .select("asset_id, title, artist, album, genre, duration_seconds, thumbnail_url, rank, source, last_seen_at", { count: "exact" })
    .not("duration_seconds", "is", null)
    .gt("duration_seconds", 0);

  if (query) {
    const pattern = `%${query.replace(/[%_]/g, " ").trim().replace(/[^a-z0-9]+/gi, "%")}%`;
    const orParts = [`title.ilike.${pattern}`, `artist.ilike.${pattern}`, `album.ilike.${pattern}`, `genre.ilike.${pattern}`];
    if (/^\d+$/.test(query)) {
      orParts.unshift(`asset_id.eq.${query}`);
    }
    musicQuery = musicQuery.or(orParts.join(","));
  }

  const { data, count, error } = await musicQuery.order("rank", { ascending: true, nullsFirst: false }).range(offset, offset + pageSize - 1);

  if (error) {
    console.warn("Failed to load mobile music catalog rows", error);
    return [];
  }

  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    duration: typeof row.duration_seconds === "number" ? `${Math.floor(row.duration_seconds / 60)}:${String(row.duration_seconds % 60).padStart(2, "0")}` : null
  }));

  return [
    section("music-ids", "Music IDs", {
      subtitle: `${(count ?? rows.length).toLocaleString("en-US")} songs`,
      body: `Ranked Roblox music IDs with artist, genre, duration, and asset IDs. Page ${page} of ${Math.max(1, Math.ceil((count ?? rows.length) / pageSize))}.`,
      items: detailItemsFromRows(rows, {
        titleKeys: ["title", "asset_id"],
        subtitleKeys: ["artist"],
        badgeKeys: ["rank"],
        imageKeys: ["thumbnail_url"],
        copyKeys: ["asset_id"],
        fieldKeys: ["asset_id", "genre", "album", "duration"],
        limit: pageSize
      }),
      page,
      pageSize,
      query,
      total: count ?? rows.length
    })
  ].filter(Boolean) as MobileContentDetailSection[];
}

async function loadColorCodeCatalogSections(searchParams?: URLSearchParams): Promise<MobileContentDetailSection[]> {
  const payload = await readJsonFile(repoPath("data", "Color Codes", "roblox-color-codes.json"));
  const query = detailQuery(searchParams);
  const rows = filterRowsByQuery(readRecordArrayPayload(payload), query);
  if (!rows.length) return [];
  const page = sectionPage(searchParams, "color-codes");
  const pageSize = sectionPageSize(searchParams);
  const pagedRows = paginateRows(rows, page, pageSize);

  return [
    section("color-codes", "BrickColor codes", {
      subtitle: `${rows.length.toLocaleString("en-US")} colors`,
      body: `Official Roblox BrickColor names with numeric IDs, hex values, and RGB formats. Page ${page} of ${Math.max(1, Math.ceil(rows.length / pageSize))}.`,
      items: detailItemsFromRows(pagedRows, {
        titleKeys: ["name"],
        subtitleKeys: [],
        badgeKeys: ["number"],
        colorKey: "hex",
        copyKeys: ["hex"],
        fieldKeys: ["number", "hex", "rgb255", "rgb01"],
        limit: pageSize
      }),
      page,
      pageSize,
      query,
      total: rows.length
    })
  ].filter(Boolean) as MobileContentDetailSection[];
}

async function loadDecalCatalogSections(searchParams?: URLSearchParams): Promise<MobileContentDetailSection[]> {
  const query = detailQuery(searchParams);
  const page = sectionPage(searchParams, "decal-ids");
  const pageSize = sectionPageSize(searchParams);
  const offset = (page - 1) * pageSize;
  const sb = supabaseAdmin();
  let request = sb
    .from("roblox_decal_ids_ranked_view")
    .select(
      "asset_id, texture_id, name, description, creator_name, roblox_created_at, is_for_sale, price_in_robux, sales, thumbnail_url, vote_count, upvote_percent, source_count",
      { count: "exact" }
    )
    .eq("thumbnail_ready", true);

  if (query) {
    const pattern = `%${query.replace(/[%_]/g, " ").replace(/[^a-z0-9]+/gi, "%").replace(/%{2,}/g, "%")}%`;
    const orParts = [`name.ilike.${pattern}`, `description.ilike.${pattern}`, `creator_name.ilike.${pattern}`];
    if (/^\d+$/.test(query)) {
      orParts.unshift(`asset_id.eq.${query}`, `texture_id.eq.${query}`);
    }
    request = request.or(orParts.join(","));
  }

  const { data, error, count } = await request
    .order("popularity_score", { ascending: false, nullsFirst: false })
    .order("source_count", { ascending: false, nullsFirst: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.error("Failed to load mobile decal catalog", error);
    return [];
  }

  const rows = data ?? [];
  const total = count ?? rows.length;
  if (!rows.length) return [];

  return [
    section("decal-ids", "Decal IDs", {
      subtitle: `${total.toLocaleString("en-US")} decals`,
      body: `Verified Roblox decal IDs with visual previews, creators, ratings, and asset identifiers. Page ${page} of ${Math.max(1, Math.ceil(total / pageSize))}.`,
      items: detailItemsFromRows(rows, {
        titleKeys: ["name", "asset_id"],
        subtitleKeys: ["creator_name"],
        badgeKeys: ["price_in_robux"],
        imageKeys: ["thumbnail_url"],
        copyKeys: ["asset_id"],
        fieldKeys: ["asset_id", "sales", "upvote_percent"],
        limit: pageSize
      }),
      page,
      pageSize,
      query,
      total
    })
  ].filter(Boolean) as MobileContentDetailSection[];
}

async function loadCatalogNativeSections(code: string, searchParams?: URLSearchParams): Promise<MobileContentDetailSection[]> {
  const normalized = code.trim().toLowerCase();

  // Game-specific dataset loaders overlap (a forge code also resolves through
  // the generic registry), so take the first loader that yields sections
  // instead of concatenating duplicate item lists.
  const datasetSections: MobileContentDetailSection[] = [];
  if (normalized.startsWith("grow-a-garden-")) {
    datasetSections.push(...(await loadGrowGardenCatalogSections(normalized, searchParams)));
  }
  if (!datasetSections.length && normalized.startsWith("the-forge-")) {
    datasetSections.push(...(await loadForgeCatalogSections(normalized, searchParams)));
  }
  if (!datasetSections.length) datasetSections.push(...(await loadGameCollectionSections(normalized, searchParams)));

  const loaders: Array<() => Promise<MobileContentDetailSection[]>> = [];

  if (normalized === "free-roblox-items" || normalized === "roblox-free-items") {
    loaders.push(() => loadFreeItemsCatalogSections(searchParams));
  }

  if (normalized === "roblox-music-ids") {
    loaders.push(() => loadMusicCatalogSections(searchParams));
  }

  if (normalized === "roblox-color-codes") {
    loaders.push(() => loadColorCodeCatalogSections(searchParams));
  }

  if (normalized === "roblox-decal-ids") {
    loaders.push(() => loadDecalCatalogSections(searchParams));
  }

  const groups = await Promise.all(loaders.map((loader) => loader()));
  return [...datasetSections, ...groups.flat()];
}

function robuxBundleItems(): MobileContentDetailItem[] {
  return ROBUX_BUNDLES.filter((bundle) => bundle.active)
    .slice(0, 12)
    .map((bundle: RobuxBundle) => {
      const pc = robuxForBundle(bundle, "pc_web", false);
      const mobile = robuxForBundle(bundle, "mobile", false);
      const premiumPc = robuxForBundle(bundle, "pc_web", true);
      const premiumMobile = robuxForBundle(bundle, "mobile", true);
      return detailItem(bundle.id, bundle.label, {
        badge: money(bundle.priceUsd),
        body: [
          pc ? `PC/Web: ${pc.toLocaleString("en-US")} Robux` : null,
          mobile ? `Mobile: ${mobile.toLocaleString("en-US")} Robux` : null,
          premiumPc && premiumPc !== pc ? `Premium PC/Web: ${premiumPc.toLocaleString("en-US")} Robux` : null,
          premiumMobile && premiumMobile !== mobile ? `Premium mobile: ${premiumMobile.toLocaleString("en-US")} Robux` : null
        ]
          .filter(Boolean)
          .join(" | ")
      });
    });
}

function toolNativeSections(code: string): MobileContentDetailSection[] {
  if (code === "robux-to-usd-calculator") {
    const examples = [400, 800, 1700, 4500, 10000].map((robux) => {
      const bestBundle = ROBUX_BUNDLES.filter((bundle) => bundle.active)
        .map((bundle) => {
          const pc = robuxForBundle(bundle, "pc_web", false);
          return pc ? { bundle, pc } : null;
        })
        .filter((entry): entry is { bundle: RobuxBundle; pc: number } => Boolean(entry))
        .find((entry) => entry.pc >= robux);
      return detailItem(`robux-${robux}`, `${robux.toLocaleString("en-US")} Robux`, {
        badge: bestBundle ? money(bestBundle.bundle.priceUsd) : "Custom",
        body: bestBundle
          ? `Closest PC/Web bundle: ${bestBundle.bundle.label}. Effective value: ${money(bestBundle.bundle.priceUsd / bestBundle.pc)} per Robux.`
          : "Use bundle combinations for larger amounts."
      });
    });

    return [
      section("tool-calculator", "Robux purchase calculator", {
        body: "Native reference data for the Robux purchase tool. Use these bundle rows to compare PC/Web, mobile, and Premium values directly inside the app.",
        items: examples
      }),
      section("robux-bundles", "Current Robux bundles", { items: robuxBundleItems() })
    ].filter(Boolean) as MobileContentDetailSection[];
  }

  if (code === "roblox-devex-calculator") {
    const payoutExamples = [DEVEX_MIN, 100000, 500000, 1000000].map((robux) => {
      const result = calculateDevexPayout(robux, DEVEX_NEW_RATE);
      return detailItem(`devex-${robux}`, `${robux.toLocaleString("en-US")} earned Robux`, {
        badge: money(result.usd),
        body: result.eligible
          ? `Eligible at the current DevEx rate of ${money(DEVEX_NEW_RATE)} per Robux.`
          : `Needs ${result.shortfallRobux.toLocaleString("en-US")} more earned Robux to reach the DevEx minimum.`
      });
    });
    const requirements = [100, 500, 1000, 5000].map((usd) => {
      const result = calculateDevexRequirement(usd, DEVEX_NEW_RATE);
      return detailItem(`devex-usd-${usd}`, `${money(usd)} payout target`, {
        badge: `${Math.ceil(result.robuxNeeded).toLocaleString("en-US")} Robux`,
        body: result.eligibleAtTarget ? "Meets the DevEx minimum." : `${Math.ceil(result.shortfallRobux).toLocaleString("en-US")} Robux below the minimum.`
      });
    });

    return [
      section("devex-payouts", "DevEx payout calculator", {
        body: `Current rate: ${money(DEVEX_NEW_RATE)} per earned Robux. Previous rate: ${money(DEVEX_OLD_RATE)} before ${DEVEX_RATE_EFFECTIVE_DATE}. Minimum: ${DEVEX_MIN.toLocaleString("en-US")} earned Robux.`,
        items: payoutExamples
      }),
      section("devex-requirements", "USD target requirements", { items: requirements })
    ].filter(Boolean) as MobileContentDetailSection[];
  }

  if (code === "roblox-id-extractor") {
    return [
      section("id-extractor", "Roblox ID extractor", {
        body: "Paste-style reference for Roblox links. The native app shows the supported URL families and which ID fields are extracted.",
        items: [
          detailItem("experience", "Experience / game URLs", { badge: "Place ID", body: "Extracts placeId and universeId when the URL carries both values." }),
          detailItem("users", "User profile URLs", { badge: "User ID", body: "Supports /users/{id}/profile links." }),
          detailItem("groups", "Group and community URLs", { badge: "Group ID", body: "Supports /groups/{id} and /communities/{id} links." }),
          detailItem("catalog", "Catalog and library URLs", { badge: "Asset ID", body: "Supports /catalog/{id} and /library/{id} links." }),
          detailItem("bundles", "Bundle URLs", { badge: "Bundle ID", body: "Supports /bundles/{id} links." }),
          detailItem("badges", "Badge URLs", { badge: "Badge ID", body: "Supports /badges/{id} links." }),
          detailItem("gamepasses", "Game pass URLs", { badge: "Game Pass ID", body: "Supports /game-pass/{id}, /gamepass/{id}, and /game-passes/{id} links." })
        ]
      })
    ].filter(Boolean) as MobileContentDetailSection[];
  }

  if (code === "grow-a-garden-crop-value-calculator") {
    return [
      section("grow-garden-tool", "Crop value calculator data", {
        body: "The calculator combines crop base value, weight, quantity, variants, and mutations. The in-app reference exposes the core data that drives the tool.",
        items: [
          detailItem("inputs", "Inputs", { badge: "Calculator", body: "Crop, base mode, weight, quantity, variant, temporary mutation, and stackable mutations." }),
          detailItem("outputs", "Outputs", { badge: "Value", body: "Estimated Sheckles, multiplier, normalized mutations, and per-crop sale value." }),
          detailItem("data", "Data sources", { badge: "Grow a Garden", body: "Uses local crop and mutation datasets from Bloxodes." })
        ]
      })
    ].filter(Boolean) as MobileContentDetailSection[];
  }

  if (code === "the-forge-crafting-calculator" || code === "the-forge-inventory-optimizer") {
    return [
      section("forge-tool", code === "the-forge-crafting-calculator" ? "Forge crafting calculator data" : "Forge inventory optimizer data", {
        body: "The Forge tools use ore multipliers, trait activations, quality tiers, and weapon or armor outcome tables.",
        items: [
          detailItem("ores", "Ores", { badge: "Inputs", body: "Select up to the supported ore count, then the tool aggregates ore composition and multipliers." }),
          detailItem("traits", "Traits", { badge: "Output", body: "Trait chance is derived from selected ore shares and whether the trait applies to weapons, armor, or both." }),
          detailItem("outcomes", "Craft outcomes", { badge: "Results", body: "The tool ranks weapon and armor outcomes based on total ore count, multiplier, and selected quality tier." })
        ]
      })
    ].filter(Boolean) as MobileContentDetailSection[];
  }

  return [];
}

export async function getMobileContentIndex(kind: MobileContentKind, searchParams: URLSearchParams): Promise<MobileContentIndexPayload> {
  const page = normalizePositiveInt(searchParams.get("page"), 1);
  const pageSize = Math.max(1, Math.min(60, normalizePositiveInt(searchParams.get("pageSize"), PAGE_SIZE)));
  const query = normalizeSearchQuery(searchParams.get("q"));

  if (kind === "articles") {
    const { articles, total } = await listPublishedArticlesPage(query ? 1 : page, query ? 200 : pageSize);
    const mapped = articles.map(mapArticle);
    const paged = query ? paginateMobileItems(mapped, page, pageSize, query) : { items: mapped, page, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
    return {
      ok: true,
      kind,
      page: paged.page,
      pageSize,
      total: paged.total,
      totalPages: paged.totalPages,
      latestUpdatedAt: latest(articles.map((item) => item.updated_at || item.published_at || item.created_at || null)),
      query,
      items: paged.items
    };
  }

  if (kind === "catalog") {
    const all = await listPublishedTopLevelCatalogPages();
    const paged = paginateMobileItems(all.map(mapCatalog), page, pageSize, query);
    return {
      ok: true,
      kind,
      page: paged.page,
      pageSize,
      total: paged.total,
      totalPages: paged.totalPages,
      latestUpdatedAt: latest(all.map((item) => item.content_updated_at || item.updated_at || item.published_at || item.created_at || null)),
      query,
      items: paged.items
    };
  }

  if (kind === "quizzes") {
    const all = await listPublishedQuizzes();
    const paged = paginateMobileItems(all.map(mapQuiz), page, pageSize, query);
    return {
      ok: true,
      kind,
      page: paged.page,
      pageSize,
      total: paged.total,
      totalPages: paged.totalPages,
      latestUpdatedAt: latest(all.map((item) => item.content_updated_at || item.updated_at || item.published_at || item.created_at || null)),
      query,
      items: paged.items
    };
  }

  if (kind === "checklists") {
    const { checklists, total } = await listPublishedChecklistsPage(query ? 1 : page, query ? 500 : pageSize);
    const mapped = checklists.map(mapChecklist);
    const paged = query ? paginateMobileItems(mapped, page, pageSize, query) : { items: mapped, page, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
    return {
      ok: true,
      kind,
      page: paged.page,
      pageSize,
      total: paged.total,
      totalPages: paged.totalPages,
      latestUpdatedAt: latest(checklists.map((item) => item.content_updated_at || item.updated_at || item.published_at || item.created_at || null)),
      query,
      items: paged.items
    };
  }

  if (kind === "tools") {
    const { tools, total } = await listPublishedToolsPage(query ? 1 : page, query ? 500 : pageSize);
    const mapped = tools.map(mapTool);
    const paged = query ? paginateMobileItems(mapped, page, pageSize, query) : { items: mapped, page, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
    return {
      ok: true,
      kind,
      page: paged.page,
      pageSize,
      total: paged.total,
      totalPages: paged.totalPages,
      latestUpdatedAt: latest(tools.map((item) => resolveModifiedAt(item))),
      query,
      items: paged.items
    };
  }

  if (kind === "wiki") {
    const all = await listPublishedWikiPages();
    const paged = paginateMobileItems(all.map(mapWiki), page, pageSize, query);
    return {
      ok: true,
      kind,
      page: paged.page,
      pageSize,
      total: paged.total,
      totalPages: paged.totalPages,
      latestUpdatedAt: latest(all.map((item) => item.content_updated_at || item.updated_at || item.published_at || item.created_at || null)),
      query,
      items: paged.items
    };
  }

  const { cards, total } = await buildEventsCards();
  const mappedItems = cards.map((card) => ({
    id: card.id,
    title: card.title || (card.universeName ? `${card.universeName} Events` : "Roblox Event"),
    subtitle: card.universeName,
    summary: card.summary,
    coverImage: absoluteAssetUrl(card.coverImage || card.fallbackIcon || "/Bloxodes.png"),
    updatedAt: card.eventStartUtc || card.eventEndUtc,
    url: `${SITE_URL}/events/${card.slug}`,
    badge: card.eventTimeLabel ?? (card.status === "none" ? "Event" : card.status)
  }));
  const paged = paginateMobileItems(mappedItems, page, pageSize, query);

  return {
    ok: true,
    kind,
    page: paged.page,
    pageSize,
    total: query ? paged.total : total,
    totalPages: query ? paged.totalPages : Math.max(1, Math.ceil(total / pageSize)),
    latestUpdatedAt: latest(cards.map((card) => card.eventStartUtc || card.eventEndUtc)),
    query,
    items: query ? paged.items : mappedItems.slice((page - 1) * pageSize, page * pageSize)
  };
}

export async function getMobileContentDetail(
  kind: MobileContentKind,
  slug: string,
  searchParams: URLSearchParams = new URLSearchParams()
): Promise<MobileContentDetailPayload | null> {
  const normalizedSlug = slug.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  if (!normalizedSlug) return null;

  if (kind === "articles") {
    const article = await getArticleBySlug(normalizedSlug);
    if (!article) return null;
    const updatedAt = article.updated_at || article.published_at || article.created_at || null;
    const universeName = article.universe?.display_name ?? article.universe?.name ?? null;
    const authorName = article.author?.name ?? null;
    const intro = toPlainText(article.meta_description) ?? truncate(toPlainText(article.content_md), 1100);
    const sections = [
      section("overview", "Overview", { body: intro }),
      section("details", "Article details", {
        items: [
          authorName ? detailItem("author", "Author", { body: authorName }) : null,
          universeName ? detailItem("game", "Game", { body: universeName }) : null,
          article.published_at ? detailItem("published", "Published", { body: article.published_at }) : null,
          article.word_count ? detailItem("word-count", "Word count", { body: `${article.word_count} words` }) : null
        ].filter(Boolean) as MobileContentDetailItem[]
      }),
      article.tags?.length ? section("tags", "Tags", { items: article.tags.slice(0, 16).map((tag) => detailItem(tag, tag, { badge: "Tag" })) }) : null
    ].filter(Boolean) as MobileContentDetailSection[];

    return {
      ok: true,
      kind,
      title: article.title,
      subtitle: universeName ?? authorName,
      summary: intro,
      coverImage: absoluteAssetUrl(article.cover_image || article.universe?.icon_url || "/Bloxodes.png"),
      updatedAt,
      url: `${SITE_URL}/articles/${article.slug}`,
      badge: "Article",
      sections
    };
  }

  if (kind === "catalog") {
    const [page, childPages, nativeSections] = await Promise.all([
      getCatalogPageContentByCodes([normalizedSlug]),
      listPublishedCatalogPagesByCodePrefix(normalizedSlug, 24),
      loadCatalogNativeSections(normalizedSlug, searchParams)
    ]);
    if (!page) {
      // Game wiki collections live in wiki_collection_pages with catalog-style
      // codes, so serve them through the same catalog detail contract.
      const collection = await getWikiCollectionPageByCode(normalizedSlug);
      if (!collection || !collection.is_published) return null;
      const collectionRuntime = await getPublishedWikiCollectionRuntime(collection);
      const runtimeCoverImage = collectionRuntime?.document.items.find((item) => item.system.image)?.system.image;
      const collectionUpdatedAt =
        collection.content_updated_at || collection.updated_at || collection.published_at || collection.created_at || null;
      const collectionNavItems = await collectionNavItemsForCode(normalizedSlug);
      const collectionSections = [
        section("collection-nav", `${collection.display_name ?? "Related"} collections`, {
          items: collectionNavItems,
          variant: "links"
        }),
        section("overview", "Overview", {
          body: collection.intro_md ?? collection.meta_description,
          bodyMax: 6000,
          variant: "markdown"
        }),
        ...nativeSections,
        section("how-it-works", "How it works", {
          body: collection.how_it_works_md,
          bodyMax: 8000,
          variant: "markdown"
        }),
        section("details", "Details", {
          items: keyValueItems(collection.description_json ?? {}),
          variant: "collection-details"
        }),
        section("faq", "FAQ", {
          items: (collection.faq_json ?? []).slice(0, 12).map((entry, index) =>
            detailItem(`faq-${index}`, entry.q, { body: entry.a, preserveMarkdown: true })
          ),
          variant: "faq"
        })
      ].filter(Boolean) as MobileContentDetailSection[];

      return {
        ok: true,
        kind,
        title: collection.title,
        subtitle: collection.display_name ?? null,
        summary: collection.meta_description,
        coverImage: absoluteAssetUrl(runtimeCoverImage || collection.thumb_url || "/Bloxodes.png"),
        updatedAt: collectionUpdatedAt,
        url: `${SITE_URL}/wiki/${collection.wiki_slug}/${collection.collection_slug}`,
        badge:
          typeof collection.item_count === "number" && collection.item_count > 0
            ? `${collection.item_count.toLocaleString("en-US")} items`
            : "Collection",
        layout: "wiki_collection",
        sections: collectionSections
      };
    }
    const updatedAt = page.content_updated_at || page.updated_at || page.published_at || page.created_at || null;
    const childCatalogItems = childPages.length
      ? await Promise.all(
          childPages.map(async (entry) => {
            const [previewImage] = await listGameCollectionImageUrls(entry.code, 1);
            const wikiItemCount = (entry as unknown as { wiki_item_count?: unknown }).wiki_item_count;

            return detailItem(entry.code, entry.title, {
              badge: typeof wikiItemCount === "number" ? `${wikiItemCount.toLocaleString("en-US")} entries` : "Catalog",
              body: entry.wiki_md ?? entry.meta_description,
              image: entry.thumb_url ?? previewImage ?? null
            });
          })
        )
      : [];
    const sections = [
      section("overview", "Overview", {
        body: page.intro_md ?? page.meta_description,
        bodyMax: 6000,
        variant: "markdown"
      }),
      section("catalog-wiki", "Catalog notes", { body: page.wiki_md, bodyMax: 8000, variant: "markdown" }),
      ...nativeSections,
      childPages.length
        ? section("related-catalogs", "Related catalog pages", {
            subtitle: `${childPages.length} pages`,
            items: childCatalogItems
          })
        : null,
      section("how-it-works", "How it works", { body: page.how_it_works_md, bodyMax: 8000, variant: "markdown" }),
      section("details", "Details", { items: keyValueItems(page.description_json ?? {}), variant: "collection-details" }),
      section("faq", "FAQ", {
        items: (page.faq_json ?? []).slice(0, 12).map((entry, index) =>
          detailItem(`faq-${index}`, entry.q, { body: entry.a, preserveMarkdown: true })
        ),
        variant: "faq"
      })
    ].filter(Boolean) as MobileContentDetailSection[];

    return {
      ok: true,
      kind,
      title: page.title,
      subtitle: null,
      summary: page.meta_description,
      coverImage: absoluteAssetUrl(page.thumb_url || "/Bloxodes.png"),
      updatedAt,
      url: `${SITE_URL}/catalog/${page.code}`,
      badge: "Catalog",
      sections
    };
  }

  if (kind === "checklists") {
    const data = await getChecklistPageBySlug(normalizedSlug);
    if (!data) return null;
    const { page, items } = data;
    const updatedAt = page.content_updated_at || page.updated_at || page.published_at || page.created_at || null;
    const sectionParts = (code: string) => code.split(".").filter(Boolean);
    const leafItems = items.filter((item) => sectionParts(item.section_code).length === 3);
    const sectionTitles = new Map<string, string>();
    for (const item of items) {
      const parts = sectionParts(item.section_code);
      if (parts.length < 3) sectionTitles.set(parts.join("."), item.title);
    }
    const checklistTaskItem = (item: (typeof items)[number]) =>
      detailItem(item.id, item.title, { body: item.description, badge: item.is_required ? null : "Optional" });
    let taskSections: MobileContentDetailSection[];
    if (leafItems.length) {
      const grouped = new Map<string, typeof items>();
      for (const item of leafItems) {
        const prefix = sectionParts(item.section_code).slice(0, 2).join(".");
        grouped.set(prefix, [...(grouped.get(prefix) ?? []), item]);
      }
      taskSections = Array.from(grouped.entries())
        .map(([prefix, groupItems]) =>
          section(`tasks-${prefix.replace(/\./g, "-")}`, sectionTitles.get(prefix) ?? sectionTitles.get(prefix.split(".")[0]) ?? "Tasks", {
            subtitle: `${groupItems.length} ${groupItems.length === 1 ? "task" : "tasks"}`,
            items: groupItems.map(checklistTaskItem)
          })
        )
        .filter(Boolean) as MobileContentDetailSection[];
    } else {
      const required = items.filter((item) => item.is_required);
      const optional = items.filter((item) => !item.is_required);
      taskSections = [
        section("required", "Required tasks", {
          subtitle: `${required.length} tasks`,
          items: required.map(checklistTaskItem)
        }),
        section("optional", "Optional tasks", {
          subtitle: `${optional.length} tasks`,
          items: optional.map(checklistTaskItem)
        })
      ].filter(Boolean) as MobileContentDetailSection[];
    }
    const sections = [
      section("overview", "Overview", { body: toPlainText(page.seo_description) ?? toPlainText(page.description_md) }),
      ...taskSections
    ].filter(Boolean) as MobileContentDetailSection[];

    return {
      ok: true,
      kind,
      title: page.title,
      subtitle: page.universe?.display_name ?? page.universe?.name ?? null,
      summary: toPlainText(page.seo_description) ?? toPlainText(page.description_md),
      coverImage: absoluteAssetUrl(page.universe?.icon_url || "/Bloxodes.png"),
      updatedAt,
      url: `${SITE_URL}/checklists/${page.slug}`,
      badge: `${leafItems.length || items.length} tasks`,
      sections
    };
  }

  if (kind === "events") {
    const { cards } = await buildEventsCards();
    const card = cards.find((entry) => entry.slug === normalizedSlug);
    if (!card) return null;
    const timeline = await listUniverseEventTimeline(card.universeId, 20);
    const sections = [
      section("timeline", "Event timeline", {
        subtitle: `${timeline.length} ${timeline.length === 1 ? "event" : "events"}`,
        items: timeline.map((event) =>
          detailItem(event.eventId, event.name, {
            badge: event.status,
            body: event.description,
            startAt: event.startUtc,
            endAt: event.endUtc,
            status: event.status
          })
        ),
        variant: "timeline"
      })
    ].filter(Boolean) as MobileContentDetailSection[];

    return {
      ok: true,
      kind,
      title: card.title || (card.universeName ? `${card.universeName} Events` : "Roblox Event"),
      subtitle: card.universeName,
      summary: card.summary,
      coverImage: absoluteAssetUrl(card.coverImage || card.fallbackIcon || "/Bloxodes.png"),
      updatedAt: card.eventStartUtc || card.eventEndUtc,
      url: `${SITE_URL}/events/${card.slug}`,
      badge: card.eventTimeLabel ?? "Event",
      layout: "events",
      sections
    };
  }

  if (kind === "quizzes") {
    const [page, quizData] = await Promise.all([getQuizPageByCode(normalizedSlug), loadQuizData(normalizedSlug)]);
    if (!page) return null;
    const updatedAt = page.content_updated_at || page.updated_at || page.published_at || page.created_at || null;
    const questions = [...(quizData?.easy ?? []), ...(quizData?.medium ?? []), ...(quizData?.hard ?? [])].slice(0, 15);
    const sections = [
      section("overview", "Overview", { body: toPlainText(page.seo_description) ?? toPlainText(page.description_md) }),
      section("questions", "Questions", {
        subtitle: questions.length ? `${questions.length} questions` : null,
        items: questions.map((question, index) => detailItem(question.id || `q-${index}`, question.question, { badge: `Q${index + 1}` }))
      })
    ].filter(Boolean) as MobileContentDetailSection[];

    return {
      ok: true,
      kind,
      title: page.title,
      subtitle: page.universe?.display_name ?? page.universe?.name ?? null,
      summary: toPlainText(page.seo_description) ?? toPlainText(page.description_md),
      coverImage: absoluteAssetUrl(page.universe?.icon_url || pickThumbnail(page.universe?.thumbnail_urls) || "/Bloxodes.png"),
      updatedAt,
      url: `${SITE_URL}/quizzes/${page.code}`,
      badge: questions.length ? `${questions.length} questions` : "Quiz",
      sections
    };
  }

  if (kind === "tools") {
    const tool = await getToolContentWithDevFallback(normalizedSlug);
    if (!tool) {
      const { tools } = await listPublishedToolsPage(1, 100);
      const entry = tools.find((item) => item.code === normalizedSlug);
      if (!entry) return null;
      const updatedAt = resolveModifiedAt(entry);
      const summary = entry.meta_description ?? toPlainText(entry.intro_md);
      return {
        ok: true,
        kind,
        title: entry.title,
        subtitle: entry.universe?.display_name ?? entry.universe?.name ?? null,
        summary,
        coverImage: absoluteAssetUrl(entry.thumb_url || entry.universe?.icon_url || "/Bloxodes.png"),
        updatedAt,
        url: `${SITE_URL}/tools/${entry.code}`,
        badge: "Tool",
        sections: [
          section("overview", "Overview", { body: summary }),
          ...toolNativeSections(entry.code),
          section("details", "Tool details", {
            items: [
              detailItem("type", "Type", { body: "Bloxodes tool" }),
              entry.universe?.display_name || entry.universe?.name
                ? detailItem("game", "Game", { body: entry.universe.display_name ?? entry.universe.name ?? null })
                : null
            ].filter(Boolean) as MobileContentDetailItem[]
          })
        ].filter(Boolean) as MobileContentDetailSection[]
      };
    }
    const updatedAt = tool.content_updated_at || tool.updated_at || tool.published_at || tool.created_at || null;
    const sections = [
      section("overview", "Overview", {
        body: tool.intro_md ?? tool.meta_description,
        bodyMax: 6000,
        variant: "markdown"
      }),
      ...toolNativeSections(tool.code),
      section("how-it-works", "How it works", { body: tool.how_it_works_md, bodyMax: 8000, variant: "markdown" }),
      section("details", "Details", { items: keyValueItems(tool.description_json ?? {}), variant: "collection-details" }),
      section("faq", "FAQ", {
        items: (tool.faq_json ?? []).slice(0, 12).map((entry, index) =>
          detailItem(`faq-${index}`, entry.q, { body: entry.a, preserveMarkdown: true })
        ),
        variant: "faq"
      })
    ].filter(Boolean) as MobileContentDetailSection[];

    return {
      ok: true,
      kind,
      title: tool.title,
      subtitle: null,
      summary: tool.meta_description,
      coverImage: absoluteAssetUrl(tool.thumb_url || "/Bloxodes.png"),
      updatedAt,
      url: `${SITE_URL}/tools/${tool.code}`,
      badge: "Tool",
      sections
    };
  }

  const page = await getWikiPageBySlug(normalizedSlug);
  if (!page) return null;
  const related = await loadWikiRelatedData(page);
  const updatedAt = page.content_updated_at || page.updated_at || page.published_at || page.created_at || null;
  const nowMs = Date.now();
  const relatedCatalogItems = related.catalogPages.length
    ? await Promise.all(
        related.catalogPages.slice(0, DETAIL_ITEM_LIMIT).map(async (entry) => {
          const previewImages = await listGameCollectionImageUrls(entry.code, 6);

          return detailItem(entry.code, entry.title, {
            badge: "Catalog",
            body: entry.wiki_md ?? entry.meta_description,
            bodyMax: 12_000,
            preserveMarkdown: Boolean(entry.wiki_md),
            image: entry.thumb_url ?? previewImages[0] ?? null,
            images: previewImages
          });
        })
      )
    : [];
  const wikiGameDetails = [
    page.universe_creator_name ? detailItem("creator", "Creator", { body: page.universe_creator_name }) : null,
    page.created_at_api ? detailItem("created", "Game created", { body: page.created_at_api }) : null,
    page.updated_at_api ? detailItem("game-updated", "Last updated", { body: page.updated_at_api }) : null,
    page.universe_age_rating ? detailItem("age", "Age requirement", { body: page.universe_age_rating }) : null,
    (page.universe_genre_l1 ?? page.universe_genre)
      ? detailItem("genre", "Genre", { body: page.universe_genre_l1 ?? page.universe_genre })
      : null,
    page.universe_genre_l2 ? detailItem("subgenre", "Subgenre", { body: page.universe_genre_l2 }) : null,
    typeof page.max_players === "number"
      ? detailItem("max-players", "Max players", { body: page.max_players.toLocaleString("en-US") })
      : null,
    deviceSupportLabel(page) ? detailItem("devices", "Supported devices", { body: deviceSupportLabel(page) }) : null,
    typeof page.private_server_price_robux === "number"
      ? detailItem("private-server", "Private server", { body: `${page.private_server_price_robux.toLocaleString("en-US")} Robux` })
      : null
  ].filter(Boolean) as MobileContentDetailItem[];
  const sections = [
    section("overview", "Overview", {
      body: page.description_md,
      bodyMax: 24_000,
      variant: "markdown"
    }),
    section("stats", "Game stats", {
      items: [
        detailItem("playing", "Playing", { body: compactNumber(page.playing) }),
        detailItem("visits", "Visits", { body: compactNumber(page.visits) }),
        detailItem("favorites", "Favorites", { body: compactNumber(page.favorites) }),
        detailItem("max-players", "Max players", { body: compactNumber(page.max_players) }),
        detailItem("genre", "Genre", { body: page.universe_genre_l2 ?? page.universe_genre_l1 ?? page.universe_genre })
      ].filter((item) => item.body) as MobileContentDetailItem[],
      variant: "stats"
    }),
    section("game-details", "Game details", { items: wikiGameDetails, variant: "collection-details" }),
    mobileSocialItems(page.social_links).length
      ? section("social", `${page.universe_creator_name ?? "Creator"} Social Accounts`, {
          items: mobileSocialItems(page.social_links),
          variant: "social"
        })
      : null,
    related.activeCodes.length && related.codes[0]
      ? section("active-codes", `Active ${page.universe_display_name ?? page.universe_name ?? page.title} Codes`, {
          subtitle: `${related.codes[0].active_count ?? related.activeCodes.length} active`,
          sourceId: related.codes[0].slug,
          items: related.activeCodes.slice(0, 8).map((code) =>
            detailItem(code.id, code.code, {
              badge: isCodeNew(code, nowMs) ? "New" : null,
              body: cleanRewardsText(code.rewards_text),
              subtitle: code.level_requirement != null ? `Level ${code.level_requirement}+` : null,
              copyValue: code.code,
              startAt: code.first_seen_at
            })
          ),
          variant: "codes"
        })
      : null,
    related.codes.length
      ? section("codes", "Codes", {
          items: related.codes.map((game) =>
            detailItem(game.slug, `${game.name} Codes`, {
              badge: `${game.active_count ?? 0} active`,
              body: (game.genre_l2 ?? game.genre_l1) ? `Genre: ${game.genre_l2 ?? game.genre_l1}` : "Working codes list with rewards.",
              image: game.cover_image ?? null
            })
          )
        })
      : null,
    related.catalogPages.length
      ? section("catalog", "Catalog data", {
          subtitle: `${related.catalogPages.length} catalogs`,
          items: relatedCatalogItems
        })
      : null,
    section("controls", `${page.universe_display_name ?? page.universe_name ?? page.title} Controls`, {
      items: mobileControlItems(page.controls_json)
    }),
    section("tips", `${page.universe_display_name ?? page.universe_name ?? page.title} Gameplay Tips`, {
      body: page.tips_md,
      bodyMax: 24_000,
      variant: "markdown"
    }),
    related.eventsPage
      ? section("events", "Event guide", {
          body: related.eventsPage.meta_description ?? null,
          items: [detailItem(related.eventsPage.slug, related.eventsPage.title, { badge: "Event" })]
        })
      : null,
    related.eventTimeline.length
      ? section("event-timeline", "Event timeline", {
          items: related.eventTimeline.map((event) =>
            detailItem(event.eventId, event.name, {
              badge: event.status,
              body: event.description,
              startAt: event.startUtc,
              endAt: event.endUtc,
              status: event.status
            })
          ),
          variant: "timeline"
        })
      : null,
    related.checklists.length
      ? section("checklists", "Checklists", {
          items: related.checklists.map((checklist) =>
            detailItem(checklist.slug, checklist.title, {
              badge: checklist.leaf_item_count ? `${checklist.leaf_item_count} tasks` : "Checklist",
              body: checklist.seo_description ?? checklist.description_md,
              image: checklist.universe?.icon_url ?? null
            })
          )
        })
      : null,
    related.quizzes.length
      ? section("quizzes", "Quizzes", {
          items: related.quizzes.map((quiz) =>
            detailItem(quiz.code, quiz.title, {
              badge: "Quiz",
              body: quiz.seo_description ?? quiz.description_md
            })
          )
        })
      : null,
    related.articles.length
      ? section("articles", "Related articles", {
          items: related.articles.slice(0, 8).map((article) =>
            detailItem(article.slug, article.title, {
              badge: "Article",
              body: article.meta_description,
              image: article.cover_image ?? article.universe?.icon_url ?? null
            })
          )
        })
      : null,
    related.media.length
      ? section("media", "Media", {
          items: related.media.map((media) =>
            detailItem(media.id, media.alt_text ?? humanizeKey(media.media_type), {
              badge: media.media_type,
              image: media.image_url
            })
          )
        })
      : null,
    related.badges.length
      ? section("badges", "Badges", {
          items: related.badges.map((badge) =>
            detailItem(`${badge.badge_id}`, badge.name, {
              body: badge.description,
              image: badge.icon_image_url,
              fields: [
                compactNumber(badge.awarded_count)
                  ? { key: "awards", label: "Awards", value: compactNumber(badge.awarded_count)!, kind: "text" as const }
                  : null,
                badge.rarity_percent != null
                  ? { key: "rarity", label: "Rarity", value: `${percent(badge.rarity_percent)}%`, kind: "text" as const }
                  : null
              ].filter(Boolean) as MobileContentDetailField[]
            })
          )
        })
      : null,
    related.gamePasses.length
      ? section("game-passes", "Game passes", {
          items: related.gamePasses.map((pass) =>
            detailItem(`${pass.pass_id}`, pass.name, {
              body: pass.description,
              image: pass.icon_image_url,
              fields: [
                {
                  key: "price",
                  label: "Price",
                  value: pass.price === 0 ? "Free" : typeof pass.price === "number" ? `${pass.price.toLocaleString("en-US")} Robux` : "Price hidden",
                  kind: "text" as const
                },
                typeof pass.is_for_sale === "boolean"
                  ? { key: "sale", label: "Sale", value: pass.is_for_sale ? "Yes" : "No", kind: "text" as const }
                  : null,
                { key: "sales", label: "Sales", value: compactNumber(pass.sales) ?? "No public sales", kind: "text" as const }
              ].filter(Boolean) as MobileContentDetailField[]
            })
          )
        })
      : null,
    related.servers.length
      ? section("servers", "Recent servers", {
          items: related.servers.map((server, index) =>
            detailItem(server.id, `Public server ${index + 1}`, {
              subtitle: server.region ?? null,
              fields: [
                {
                  key: "players",
                  label: "Players",
                  value: `${numberLabel(server.player_count) ?? "0"} / ${numberLabel(server.max_players) ?? "?"}`,
                  kind: "text" as const
                },
                { key: "ping", label: "Ping", value: server.ping_ms != null ? `${server.ping_ms} ms` : "Ping hidden", kind: "text" as const },
                { key: "fps", label: "FPS", value: server.fps != null ? `${server.fps.toFixed(1)} FPS` : "FPS hidden", kind: "text" as const }
              ]
            })
          )
        })
      : null,
    related.developerGames.length
      ? section("developer-games", "More from this creator", {
          items: related.developerGames.map((game) =>
            detailItem(`${game.universe_id}`, game.display_name ?? game.name ?? `${game.universe_id}`, {
              badge: compactNumber(game.playing),
              body: game.visits ? `${game.visits.toLocaleString("en-US")} visits` : null,
              image: game.icon_url
            })
          )
        })
      : null
  ].filter(Boolean) as MobileContentDetailSection[];

  return {
    ok: true,
    kind,
    title: page.title,
    subtitle: page.universe_display_name ?? page.universe_name ?? null,
    summary: toPlainText(page.description_md) ?? page.meta_description ?? null,
    coverImage: absoluteAssetUrl(page.cover_image || page.icon_url || pickThumbnail(page.thumbnail_urls) || "/Bloxodes.png"),
    updatedAt,
    url: `${SITE_URL}/wiki/${page.slug}`,
    badge: "Wiki",
    robloxUrl: page.universe_root_place_id ? `https://www.roblox.com/games/${page.universe_root_place_id}` : null,
    universeId: typeof page.universe_id === "number" ? page.universe_id : null,
    layout: "wiki",
    sections
  };
}

export function isMobileContentKind(value: string): value is MobileContentKind {
  return (
    value === "articles" ||
    value === "catalog" ||
    value === "checklists" ||
    value === "events" ||
    value === "quizzes" ||
    value === "tools" ||
    value === "wiki"
  );
}
