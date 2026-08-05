import "../shared/load-env";

import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { enqueueDiscoveredCatalogItems, robloxCatalogSortParams, upsertDiscoveredCatalogItems } from "./catalog-discovery-db";

const CATALOG_DETAILS_API = "https://catalog.roblox.com/v1/search/items/details";
const USER_AGENT = "BloxodesCatalogBot/1.0";

const DEFAULT_SORT_TYPES = [
  "MostFavorited",
  "BestSelling",
  "Sales",
  "RecentlyUpdated",
  "RecentlyCreated",
  "Relevance",
  "PriceAsc",
  "PriceDesc"
];
const DEFAULT_KEYWORDS = [
  "makeup",
  "face makeup",
  "eye makeup",
  "lip makeup",
  "eyebrow",
  "eyebrows",
  "eyelash",
  "eyelashes",
  "lashes",
  "lipstick",
  "eyeshadow",
  "eyeliner",
  "blush",
  "contour"
];
const ALLOWED_LIMITS = [10, 28, 30];
const MAKEUP_ASSET_TYPES = new Map<number, string>([
  [76, "Eyebrows"],
  [77, "Eyelashes"],
  [88, "FaceMakeup"],
  [89, "LipMakeup"],
  [90, "EyeMakeup"]
]);

const SORT_TYPES_RAW = process.env.ROBLOX_CATALOG_SORT_TYPES;
const KEYWORDS_RAW = process.env.ROBLOX_CATALOG_MAKEUP_KEYWORDS ?? process.env.ROBLOX_CATALOG_KEYWORDS;
const ENQUEUE_REFRESH = toBoolean(process.env.ROBLOX_CATALOG_ENQUEUE_REFRESH, true);
const DRY_RUN = toBoolean(process.env.ROBLOX_CATALOG_DRY_RUN, false);
const LOG_LEVEL = (process.env.ROBLOX_CATALOG_LOG_LEVEL ?? "info").toLowerCase();
const LOG_SAMPLE = toBoolean(process.env.ROBLOX_CATALOG_LOG_SAMPLE, true);
const LOG_SAMPLE_RAW = toBoolean(process.env.ROBLOX_CATALOG_LOG_SAMPLE_RAW, false);

const LIMIT = clampLimit(Number(process.env.ROBLOX_CATALOG_LIMIT ?? "30"));
const MAX_PAGES = Math.max(0, Math.floor(Number(process.env.ROBLOX_CATALOG_MAX_PAGES ?? "0")));
const MAX_ASSETS = Math.max(0, Math.floor(Number(process.env.ROBLOX_CATALOG_MAX_ASSETS ?? "0")));
const MAX_QUERIES = Math.max(0, Math.floor(Number(process.env.ROBLOX_CATALOG_MAX_QUERIES ?? "0")));
const ROTATION_OFFSET = Math.max(0, Math.floor(Number(process.env.ROBLOX_CATALOG_ROTATION_OFFSET ?? "0")));
const QUERY_DELAY_MS = Math.max(0, Math.floor(Number(process.env.ROBLOX_CATALOG_QUERY_DELAY_MS ?? "600")));
const MIN_REQUEST_INTERVAL_MS = Math.max(0, Math.floor(Number(process.env.ROBLOX_CATALOG_MIN_REQUEST_MS ?? "400")));
const RETRY_BASE_MS = Math.max(100, Math.floor(Number(process.env.ROBLOX_CATALOG_RETRY_BASE_MS ?? "1000")));
const RETRY_JITTER_MS = Math.max(0, Math.floor(Number(process.env.ROBLOX_CATALOG_RETRY_JITTER_MS ?? "250")));
const RATE_LIMIT_RETRY_LIMIT = Math.max(0, Math.floor(Number(process.env.ROBLOX_CATALOG_RATE_LIMIT_RETRIES ?? "2")));
const RATE_LIMIT_COOLDOWN_MS = Math.max(0, Math.floor(Number(process.env.ROBLOX_CATALOG_RATE_LIMIT_COOLDOWN_MS ?? "5000")));
const MAX_RETRIES = Math.max(0, Math.floor(Number(process.env.ROBLOX_CATALOG_MAX_RETRIES ?? "3")));

type CatalogItem = {
  id?: number;
  itemType?: string;
  assetType?: number;
  name?: string;
  description?: string;
  price?: number;
  priceStatus?: string;
  lowestPrice?: number;
  lowestResalePrice?: number;
  creatorName?: string;
  creatorType?: string;
  creatorTargetId?: number;
  creatorHasVerifiedBadge?: boolean;
  creatorId?: number;
  productId?: number;
  collectibleItemId?: string | number;
  favoriteCount?: number;
  hasResellers?: boolean;
  totalQuantity?: number;
  unitsAvailableForConsumption?: number;
  quantityLimitPerUser?: number;
  saleLocationType?: string;
  offSaleDeadline?: string;
  itemStatus?: unknown;
  itemRestrictions?: unknown;
  bundledItems?: unknown;
  isLimited?: boolean;
  isLimitedUnique?: boolean;
  isForSale?: boolean;
  remaining?: number;
};

type CatalogSearchResponse = {
  data?: CatalogItem[];
  nextPageCursor?: string | null;
  errors?: Array<{ message?: string; code?: number; field?: string }>;
};

type CatalogItemRow = {
  asset_id: number;
  item_type: string;
  asset_type_id: number | null;
  category: string | null;
  subcategory: string | null;
  name: string | null;
  description: string | null;
  price_robux: number | null;
  price_status: string | null;
  lowest_price_robux: number | null;
  lowest_resale_price_robux: number | null;
  is_for_sale: boolean | null;
  is_limited: boolean | null;
  is_limited_unique: boolean | null;
  remaining: number | null;
  creator_id: number | null;
  creator_target_id: number | null;
  creator_name: string | null;
  creator_type: string | null;
  creator_has_verified_badge: boolean | null;
  product_id: number | null;
  collectible_item_id: string | null;
  favorite_count: number | null;
  has_resellers: boolean | null;
  total_quantity: number | null;
  units_available_for_consumption: number | null;
  quantity_limit_per_user: number | null;
  sale_location_type: string | null;
  off_sale_deadline: string | null;
  item_status: unknown | null;
  item_restrictions: unknown | null;
  bundled_items: unknown | null;
  last_seen_at: string;
  is_deleted: boolean;
  raw_catalog_json: Record<string, unknown>;
};

type DiscoveryHitRow = {
  run_id: string;
  asset_id: number;
  query_hash: string;
  category: string | null;
  subcategory: string | null;
  keyword: string | null;
  sort_type: string | null;
  cursor_page: number;
  seen_at: string;
};

function toBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  if (value === "1") return true;
  if (value === "0") return false;
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "y"].includes(normalized)) return true;
  if (["false", "no", "n"].includes(normalized)) return false;
  return fallback;
}

function shouldLog(level: "info" | "debug") {
  const order = { debug: 0, info: 1 };
  const current = LOG_LEVEL in order ? LOG_LEVEL : "info";
  return order[level] >= order[current as keyof typeof order];
}

function logInfo(message: string) {
  if (shouldLog("info")) console.log(message);
}

function logDebug(message: string) {
  if (shouldLog("debug")) console.log(message);
}

function clampLimit(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 30;
  const rounded = Math.floor(value);
  if (ALLOWED_LIMITS.includes(rounded)) return rounded;
  const sorted = [...ALLOWED_LIMITS].sort((a, b) => a - b);
  for (const candidate of sorted) {
    if (rounded <= candidate) return candidate;
  }
  return sorted[sorted.length - 1];
}

function parseCsv(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function rotateValues<T>(values: T[], offset: number) {
  if (values.length < 2) return values;
  const start = offset % values.length;
  return [...values.slice(start), ...values.slice(0, start)];
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function normalizeIdText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  return null;
}

function resolveSortTypes(): string[] {
  const manual = parseCsv(SORT_TYPES_RAW);
  return manual.length ? manual : DEFAULT_SORT_TYPES;
}

function resolveKeywords(): string[] {
  const manual = parseCsv(KEYWORDS_RAW);
  return manual.length ? manual : DEFAULT_KEYWORDS;
}

function buildQueryHash(input: Record<string, unknown>) {
  return createHash("sha1").update(JSON.stringify(input)).digest("hex");
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function sleep(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function withJitter(ms: number, jitterMs: number) {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  if (!Number.isFinite(jitterMs) || jitterMs <= 0) return ms;
  return ms + Math.floor(Math.random() * jitterMs);
}

let lastRequestAt = 0;

async function throttleRequest() {
  if (MIN_REQUEST_INTERVAL_MS <= 0) return;
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
  }
  lastRequestAt = Date.now();
}

async function fetchCatalogPage(params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  const url = `${CATALOG_DETAILS_API}?${searchParams.toString()}`;
  let attempt = 0;

  while (true) {
    await throttleRequest();
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": USER_AGENT
      }
    });

    if (res.ok) {
      return (await res.json()) as CatalogSearchResponse;
    }

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= MAX_RETRIES) {
      const body = await res.text().catch(() => "");
      throw new Error(`Catalog makeup search failed (${res.status}): ${body.slice(0, 200)}`);
    }

    if (res.status === 429 && attempt < RATE_LIMIT_RETRY_LIMIT) {
      await sleep(withJitter(RATE_LIMIT_COOLDOWN_MS, RETRY_JITTER_MS));
    }

    const retryAfter = res.headers.get("retry-after");
    const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
    const retryAfterMs = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 0;
    const backoff = Math.max(RETRY_BASE_MS * Math.pow(2, attempt), retryAfterMs);
    attempt += 1;
    await sleep(withJitter(backoff, RETRY_JITTER_MS));
  }
}

function buildCatalogRows(items: CatalogItem[], nowIso: string): CatalogItemRow[] {
  const rows: CatalogItemRow[] = [];
  items.forEach((item) => {
    const assetId = normalizeNumber(item.id);
    if (!assetId) return;
    const itemType = normalizeText(item.itemType) ?? "Asset";
    if (itemType !== "Asset") return;
    const assetTypeId = normalizeNumber(item.assetType);
    if (!assetTypeId || !MAKEUP_ASSET_TYPES.has(assetTypeId)) return;

    const creatorId = normalizeNumber(item.creatorId);
    const creatorTargetId = normalizeNumber(item.creatorTargetId) ?? creatorId;
    const priceStatus = normalizeText(item.priceStatus);
    const isForSale = normalizeBoolean(item.isForSale) ?? (priceStatus ? priceStatus.toLowerCase() === "onsale" : null);

    rows.push({
      asset_id: assetId,
      item_type: itemType,
      asset_type_id: assetTypeId,
      category: "Makeup",
      subcategory: MAKEUP_ASSET_TYPES.get(assetTypeId) ?? null,
      name: normalizeText(item.name),
      description: normalizeText(item.description),
      price_robux: normalizeNumber(item.price),
      price_status: priceStatus,
      lowest_price_robux: normalizeNumber(item.lowestPrice),
      lowest_resale_price_robux: normalizeNumber(item.lowestResalePrice),
      is_for_sale: isForSale,
      is_limited: normalizeBoolean(item.isLimited),
      is_limited_unique: normalizeBoolean(item.isLimitedUnique),
      remaining: normalizeNumber(item.remaining),
      creator_id: creatorId,
      creator_target_id: creatorTargetId,
      creator_name: normalizeText(item.creatorName),
      creator_type: normalizeText(item.creatorType),
      creator_has_verified_badge: normalizeBoolean(item.creatorHasVerifiedBadge),
      product_id: normalizeNumber(item.productId),
      collectible_item_id: normalizeIdText(item.collectibleItemId),
      favorite_count: normalizeNumber(item.favoriteCount),
      has_resellers: normalizeBoolean(item.hasResellers),
      total_quantity: normalizeNumber(item.totalQuantity),
      units_available_for_consumption: normalizeNumber(item.unitsAvailableForConsumption),
      quantity_limit_per_user: normalizeNumber(item.quantityLimitPerUser),
      sale_location_type: normalizeText(item.saleLocationType),
      off_sale_deadline: normalizeText(item.offSaleDeadline),
      item_status: item.itemStatus ?? null,
      item_restrictions: item.itemRestrictions ?? null,
      bundled_items: item.bundledItems ?? null,
      last_seen_at: nowIso,
      is_deleted: false,
      raw_catalog_json: (item as Record<string, unknown>) ?? {}
    });
  });
  return rows;
}

async function upsertCatalogItems(rows: CatalogItemRow[]) {
  if (!rows.length || DRY_RUN) return;
  for (const chunk of chunkArray(rows, 200)) {
    await upsertDiscoveredCatalogItems(chunk, DRY_RUN);
    logInfo(`Upserted ${chunk.length} makeup items into roblox_catalog_items.`);
  }
}

async function insertDiscoveryHits(rows: DiscoveryHitRow[]) {
  if (!rows.length || DRY_RUN) return;
  const sb = supabaseAdmin();
  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await sb
      .from("roblox_catalog_discovery_hits")
      .upsert(chunk, { onConflict: "run_id,asset_id" });
    if (error) throw new Error(`Failed to upsert makeup discovery hits: ${error.message}`);
    logDebug(`Upserted ${chunk.length} makeup discovery hits.`);
  }
}

async function enqueueRefresh(assetIds: number[], nowIso: string) {
  if (!assetIds.length || DRY_RUN || !ENQUEUE_REFRESH) return;
  await enqueueDiscoveredCatalogItems(assetIds, nowIso, DRY_RUN, "makeup_discovery");
  logDebug(`Enqueued ${assetIds.length} makeup assets for refresh.`);
}

async function createDiscoveryRun(): Promise<string | null> {
  if (DRY_RUN) return null;
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_catalog_discovery_runs")
    .insert({
      strategy: "catalog_search_details_makeup_keywords",
      category: "Makeup",
      status: "running",
      started_at: new Date().toISOString()
    })
    .select("run_id")
    .single();

  if (error) throw new Error(`Failed to create makeup discovery run: ${error.message}`);
  if (!data?.run_id) throw new Error("Makeup discovery run did not return a run_id.");
  return data.run_id;
}

async function finishDiscoveryRun(runId: string | null, status: "completed" | "partial" | "failed", notes?: string) {
  if (DRY_RUN || !runId) return;
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("roblox_catalog_discovery_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      notes: notes ?? null
    })
    .eq("run_id", runId);
  if (error) throw new Error(`Failed to update makeup discovery run: ${error.message}`);
}

async function run() {
  const resolvedSortTypes = resolveSortTypes();
  const resolvedKeywords = resolveKeywords();
  const rotation = ROTATION_OFFSET * Math.max(1, MAX_QUERIES);
  const sortTypes = rotateValues(resolvedSortTypes, Math.floor(rotation / Math.max(1, resolvedKeywords.length)));
  const keywords = rotateValues(resolvedKeywords, rotation % Math.max(1, resolvedKeywords.length));
  const runId = await createDiscoveryRun();
  const seenQueryHashes = new Set<string>();
  let totalAssets = 0;
  let totalQueries = 0;
  let successfulQueries = 0;
  const failedQueries: string[] = [];

  logInfo(
    `Makeup discovery config: sortTypes=${sortTypes.length}, keywords=${keywords.length}, maxQueries=${MAX_QUERIES || "unlimited"}, rotation=${ROTATION_OFFSET}, limit=${LIMIT}, dryRun=${DRY_RUN}`
  );

  try {
    for (const sortType of sortTypes) {
      for (const keyword of keywords) {
        if (MAX_ASSETS > 0 && totalAssets >= MAX_ASSETS) break;
        if (MAX_QUERIES > 0 && totalQueries >= MAX_QUERIES) break;
        const queryHash = buildQueryHash({ category: "All", keyword, sortType, limit: LIMIT, makeup: true });
        if (seenQueryHashes.has(queryHash)) continue;
        seenQueryHashes.add(queryHash);

        totalQueries += 1;
        logInfo(`Starting makeup query ${totalQueries}: ${sortType}/${keyword}`);

        try {
          let cursor: string | null = null;
          let page = 0;
          const seenCursors = new Set<string>();

          while (true) {
          if (MAX_PAGES > 0 && page >= MAX_PAGES) break;
          if (MAX_ASSETS > 0 && totalAssets >= MAX_ASSETS) break;

          const params: Record<string, string> = {
            category: "All",
            keyword,
            ...robloxCatalogSortParams(sortType),
            limit: String(LIMIT)
          };
          if (cursor) params.cursor = cursor;

          const response = await fetchCatalogPage(params);
          if (response.errors?.length) {
            throw new Error(`Makeup catalog response error: ${JSON.stringify(response.errors).slice(0, 300)}`);
          }

          const data = Array.isArray(response.data) ? response.data : [];
          const nowIso = new Date().toISOString();
          const rows = buildCatalogRows(data, nowIso);

          if (LOG_SAMPLE && rows[0]) {
            console.log(
              `Sample makeup item: ${JSON.stringify(
                LOG_SAMPLE_RAW ? rows[0].raw_catalog_json : { id: rows[0].asset_id, name: rows[0].name, subcategory: rows[0].subcategory }
              )}`
            );
          }

          await upsertCatalogItems(rows);
          await enqueueRefresh(
            rows.map((row) => row.asset_id),
            nowIso
          );

          if (runId && rows.length) {
            await insertDiscoveryHits(
              rows.map((row) => ({
                run_id: runId,
                asset_id: row.asset_id,
                query_hash: queryHash,
                category: "Makeup",
                subcategory: row.subcategory,
                keyword,
                sort_type: sortType,
                cursor_page: page,
                seen_at: nowIso
              }))
            );
          }

          totalAssets += rows.length;
          logInfo(
            `Makeup query ${totalQueries} page ${page + 1}: ${data.length} raw items, ${rows.length} makeup items, total makeup hits ${totalAssets}.`
          );

            page += 1;
            cursor = response.nextPageCursor ?? null;
            if (!cursor || seenCursors.has(cursor)) break;
            seenCursors.add(cursor);
          }
          successfulQueries += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failedQueries.push(`${sortType}/${keyword}: ${message}`);
          console.warn(`Skipping failed makeup query ${sortType}/${keyword}: ${message}`);
        }

        await sleep(withJitter(QUERY_DELAY_MS, RETRY_JITTER_MS));
      }
    }

    if (successfulQueries === 0 && failedQueries.length > 0) {
      throw new Error(`Every makeup discovery query failed. First failure: ${failedQueries[0]}`);
    }
    const status = failedQueries.length ? "partial" : "completed";
    const notes = `Collected ${totalAssets} makeup item hits; ${successfulQueries}/${totalQueries} queries succeeded.${
      failedQueries.length ? ` Failures: ${failedQueries.slice(0, 10).join(" | ")}` : ""
    }`;
    await finishDiscoveryRun(runId, status, notes);
    logInfo(
      `Makeup discovery ${status}. Queries=${totalQueries}, successful=${successfulQueries}, failed=${failedQueries.length}, makeup hits=${totalAssets}`
    );
  } catch (error) {
    await finishDiscoveryRun(runId, "failed", (error as Error).message);
    throw error;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
