import "../shared/load-env";

import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";
import {
  assignItemStatsTier,
  chunkArray,
  fetchCatalogItemDetailsBatch,
  fetchThumbnails,
  itemTypeForRoblox,
  normalizeBoolean,
  normalizeNumber,
  normalizeText,
  readNumber,
  robloxTargetId,
  RobloxHttpError,
  RobloxRateLimitError,
  toBoolean,
  type CatalogItemDetails,
  type ItemStatsSourceRow,
  type ItemStatsTier
} from "../items/item-stats-utils";

type QueueRow = {
  asset_id: number;
  priority: string;
  attempts: number;
  next_run_at: string;
  refresh_reason: string;
};

type ExistingItemRow = ItemStatsSourceRow & {
  raw_catalog_json: Record<string, unknown> | null;
  rap: number | null;
  rap_sales: number | null;
  catalog_status: string | null;
  catalog_status_failure_count: number | null;
  last_thumbnail_verified_at: string | null;
};

type ItemResult = {
  assetId: number;
  success: boolean;
  metadataUpdated: boolean;
  thumbnailUpdated: boolean;
  error?: unknown;
  errorKind?: string;
  errorCode?: string;
  nextRunAt: string;
};

function argumentNumber(name: string, fallback: number) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return readNumber(process.argv[index + 1], fallback);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
Usage: npm run enrich:catalog-items -- [--limit <claim-size>] [--max-total <n>] [--dry-run]

Atomically leases due catalog rows, refreshes authoritative Roblox metadata and
typed asset/bundle thumbnails, writes change history, and acknowledges each row.
`);
  process.exit(0);
}

const USER_AGENT = process.env.ROBLOX_CATALOG_ENRICH_USER_AGENT ?? "BloxodesCatalogEnrichmentBot/2.0";
const WORKER_ID = process.env.CATALOG_ENRICH_WORKER_ID ?? process.env.HOSTNAME ?? `catalog-enrich-${randomUUID().slice(0, 8)}`;
const CLAIM_LIMIT = Math.max(1, Math.floor(argumentNumber("--limit", readNumber(process.env.ROBLOX_CATALOG_ENRICH_LIMIT, 100))));
const MAX_TOTAL = Math.max(1, Math.floor(argumentNumber("--max-total", readNumber(process.env.ROBLOX_CATALOG_ENRICH_MAX_TOTAL, 200))));
const DETAILS_BATCH = Math.max(
  1,
  Math.min(30, Math.floor(readNumber(process.env.ROBLOX_CATALOG_ENRICH_DETAILS_BATCH ?? process.env.ROBLOX_CATALOG_DETAILS_BATCH, 10)))
);
const DB_BATCH = Math.max(1, Math.floor(readNumber(process.env.ROBLOX_CATALOG_DB_BATCH, 100)));
const LEASE_MINUTES = Math.max(5, Math.floor(readNumber(process.env.ROBLOX_CATALOG_ENRICH_CLAIM_MINUTES, 30)));
const REQUEST_MIN_MS = Math.max(0, Math.floor(readNumber(process.env.ROBLOX_CATALOG_ENRICH_MIN_REQUEST_MS, 1500)));
const MAX_RETRIES = Math.max(0, Math.floor(readNumber(process.env.ROBLOX_CATALOG_ENRICH_MAX_RETRIES, 4)));
const THUMBNAIL_SIZE = process.env.ROBLOX_CATALOG_THUMBNAIL_SIZE ?? "420x420";
const THUMBNAIL_FORMAT = process.env.ROBLOX_CATALOG_THUMBNAIL_FORMAT ?? "Png";
const DRY_RUN = toBoolean(process.env.ROBLOX_CATALOG_DRY_RUN, false) || process.argv.includes("--dry-run");

function addHours(value: string, hours: number) {
  return new Date(new Date(value).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function retryHours(attempts: number) {
  return Math.min(72, Math.max(1, 2 ** Math.max(0, attempts - 1)));
}

function refreshHours(tier: ItemStatsTier) {
  if (tier === "NEW" || tier === "HOT") return 6;
  if (tier === "WARM") return 24;
  return 168;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function errorCode(error: unknown) {
  if (error instanceof RobloxRateLimitError) return "429";
  if (error instanceof RobloxHttpError && error.status != null) return String(error.status);
  return "request_failed";
}

function errorKind(error: unknown) {
  if (error instanceof RobloxRateLimitError) return "rate_limit";
  if (error instanceof RobloxHttpError && error.retryable) return "transient";
  if (error instanceof RobloxHttpError) return "permanent_http";
  return "network_or_unknown";
}

function payloadId(payload: CatalogItemDetails) {
  return normalizeNumber(payload.id ?? payload.Id ?? payload.AssetId);
}

function pickNumber(source: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = normalizeNumber(source?.[key]);
    if (value != null) return value;
  }
  return null;
}

function pickText(source: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = normalizeText(source?.[key]);
    if (value != null) return value;
  }
  return null;
}

function pickBoolean(source: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = normalizeBoolean(source?.[key]);
    if (value != null) return value;
  }
  return null;
}

function pickIdText(source: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    const number = normalizeNumber(value);
    if (number != null) return String(Math.trunc(number));
  }
  return null;
}

function assignIfPresent(target: Record<string, unknown>, key: string, value: unknown) {
  if (value !== null && value !== undefined) target[key] = value;
}

function buildItemUpdate(existing: ExistingItemRow, payload: CatalogItemDetails, nowIso: string) {
  const rawExisting = existing.raw_catalog_json ?? {};
  const mergedRaw = { ...rawExisting, ...payload };
  const creator = payload.Creator && typeof payload.Creator === "object" ? payload.Creator as Record<string, unknown> : null;
  const update: Record<string, unknown> = {
    asset_id: existing.asset_id,
    item_type: itemTypeForRoblox(existing.item_type),
    raw_catalog_json: mergedRaw,
    last_enriched_at: nowIso,
    last_metadata_verified_at: nowIso,
    catalog_status: "active",
    catalog_status_checked_at: nowIso,
    catalog_status_failure_count: 0,
    is_deleted: false
  };

  assignIfPresent(update, "name", pickText(payload, ["Name", "name"]) ?? existing.name);
  assignIfPresent(update, "description", pickText(payload, ["Description", "description"]) ?? existing.description);
  assignIfPresent(update, "asset_type_id", pickNumber(payload, ["AssetTypeId", "assetType"]) ?? existing.asset_type_id);
  assignIfPresent(update, "product_id", pickNumber(payload, ["ProductId", "productId"]) ?? existing.product_id);
  assignIfPresent(update, "price_robux", pickNumber(payload, ["PriceInRobux", "price"]) ?? existing.price_robux);
  assignIfPresent(update, "price_status", pickText(payload, ["priceStatus"]) ?? existing.price_status);
  assignIfPresent(update, "lowest_price_robux", pickNumber(payload, ["lowestPrice"]) ?? existing.lowest_price_robux);
  assignIfPresent(update, "lowest_resale_price_robux", pickNumber(payload, ["lowestResalePrice"]) ?? existing.lowest_resale_price_robux);
  assignIfPresent(update, "is_for_sale", pickBoolean(payload, ["IsForSale", "isForSale"]) ?? existing.is_for_sale);
  assignIfPresent(update, "is_limited", pickBoolean(payload, ["IsLimited", "isLimited"]) ?? existing.is_limited);
  assignIfPresent(update, "is_limited_unique", pickBoolean(payload, ["IsLimitedUnique", "isLimitedUnique"]) ?? existing.is_limited_unique);
  assignIfPresent(update, "remaining", pickNumber(payload, ["Remaining", "remaining"]) ?? existing.remaining);
  assignIfPresent(update, "favorite_count", pickNumber(payload, ["favoriteCount"]) ?? existing.favorite_count);
  assignIfPresent(update, "has_resellers", pickBoolean(payload, ["hasResellers"]) ?? existing.has_resellers);
  assignIfPresent(update, "total_quantity", pickNumber(payload, ["totalQuantity"]) ?? existing.total_quantity);
  assignIfPresent(update, "units_available_for_consumption", pickNumber(payload, ["unitsAvailableForConsumption"]) ?? existing.units_available_for_consumption);
  assignIfPresent(update, "quantity_limit_per_user", pickNumber(payload, ["quantityLimitPerUser"]) ?? existing.quantity_limit_per_user);
  assignIfPresent(update, "sale_location_type", pickText(payload, ["saleLocationType"]) ?? existing.sale_location_type);
  assignIfPresent(update, "off_sale_deadline", pickText(payload, ["offSaleDeadline"]) ?? existing.off_sale_deadline);
  assignIfPresent(update, "collectible_item_id", pickIdText(payload, ["collectibleItemId"]) ?? existing.collectible_item_id);
  assignIfPresent(update, "item_status", payload.itemStatus ?? existing.item_status);
  assignIfPresent(update, "item_restrictions", payload.itemRestrictions ?? existing.item_restrictions);
  assignIfPresent(update, "bundled_items", payload.bundledItems ?? existing.bundled_items);

  assignIfPresent(update, "creator_id", pickNumber(creator, ["CreatorTargetId", "Id"]) ?? pickNumber(payload, ["creatorTargetId", "creatorId"]) ?? existing.creator_id);
  assignIfPresent(update, "creator_target_id", pickNumber(creator, ["CreatorTargetId", "Id"]) ?? pickNumber(payload, ["creatorTargetId", "creatorId"]) ?? existing.creator_target_id);
  assignIfPresent(update, "creator_name", pickText(creator, ["Name"]) ?? pickText(payload, ["creatorName"]) ?? existing.creator_name);
  assignIfPresent(update, "creator_type", pickText(creator, ["CreatorType"]) ?? pickText(payload, ["creatorType"]) ?? existing.creator_type);
  assignIfPresent(update, "creator_has_verified_badge", pickBoolean(creator, ["HasVerifiedBadge"]) ?? pickBoolean(payload, ["creatorHasVerifiedBadge"]) ?? existing.creator_has_verified_badge);

  return update;
}

function historyChanged(existing: ExistingItemRow, update: Record<string, unknown>) {
  return existing.price_robux !== (normalizeNumber(update.price_robux) ?? null)
    || existing.is_for_sale !== (normalizeBoolean(update.is_for_sale) ?? null)
    || existing.favorite_count !== (normalizeNumber(update.favorite_count) ?? null);
}

function historyRow(existing: ExistingItemRow, update: Record<string, unknown>, nowIso: string) {
  return {
    asset_id: existing.asset_id,
    recorded_at: nowIso,
    rap: existing.rap,
    sales: existing.rap_sales,
    price_robux: normalizeNumber(update.price_robux),
    is_for_sale: normalizeBoolean(update.is_for_sale),
    favorite_count: normalizeNumber(update.favorite_count)
  };
}

async function claimQueue(limit: number): Promise<QueueRow[]> {
  if (DRY_RUN) {
    const { data, error } = await supabaseAdmin()
      .from("roblox_catalog_refresh_queue")
      .select("asset_id,priority,attempts,next_run_at,refresh_reason")
      .in("status", ["pending", "retry"])
      .lte("next_run_at", new Date().toISOString())
      .order("next_run_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(`Failed to preview catalog refresh queue: ${error.message}`);
    return (data ?? []) as QueueRow[];
  }

  const { data, error } = await supabaseAdmin().rpc("claim_roblox_catalog_refresh_queue", {
    p_worker_id: WORKER_ID,
    p_limit: limit,
    p_lease_minutes: LEASE_MINUTES
  });
  if (error) throw new Error(`Failed to atomically claim catalog refresh queue: ${error.message}`);
  return (data ?? []) as QueueRow[];
}

async function loadItems(assetIds: number[]) {
  const { data, error } = await supabaseAdmin()
    .from("roblox_catalog_items")
    .select("*")
    .in("asset_id", assetIds);
  if (error) throw new Error(`Failed to load catalog items for enrichment: ${error.message}`);
  return new Map(((data ?? []) as ExistingItemRow[]).map((row) => [row.asset_id, row]));
}

async function upsertRows(table: string, rows: Record<string, unknown>[], conflict: string) {
  if (DRY_RUN || !rows.length) return;
  for (const batch of chunkArray(rows, DB_BATCH)) {
    const { error } = await supabaseAdmin().from(table).upsert(batch, { onConflict: conflict });
    if (error) throw new Error(`Failed to upsert ${table}: ${error.message}`);
  }
}

async function insertHistory(rows: Record<string, unknown>[]) {
  if (DRY_RUN || !rows.length) return;
  for (const batch of chunkArray(rows, DB_BATCH)) {
    const { error } = await supabaseAdmin().from("roblox_catalog_items_history").upsert(batch, {
      onConflict: "asset_id,recorded_at",
      ignoreDuplicates: true
    });
    if (error) throw new Error(`Failed to write catalog history: ${error.message}`);
  }
}

async function finishQueue(row: QueueRow, result: ItemResult) {
  if (DRY_RUN) return true;
  const { data, error } = await supabaseAdmin().rpc("finish_roblox_catalog_refresh", {
    p_asset_id: row.asset_id,
    p_worker_id: WORKER_ID,
    p_status: result.success ? "pending" : row.attempts >= 12 ? "dead" : "retry",
    p_next_run_at: result.nextRunAt,
    p_error: result.success ? null : errorMessage(result.error),
    p_error_code: result.success ? null : result.errorCode ?? "unknown",
    p_error_kind: result.success ? null : result.errorKind ?? "unknown"
  });
  if (error) throw new Error(`Failed to finish catalog refresh claim ${row.asset_id}: ${error.message}`);
  return data === true;
}

async function releaseBatch(rows: QueueRow[], error: unknown) {
  const nowIso = new Date().toISOString();
  await Promise.all(rows.map((row) => finishQueue(row, {
    assetId: row.asset_id,
    success: false,
    metadataUpdated: false,
    thumbnailUpdated: false,
    error,
    errorCode: errorCode(error),
    errorKind: errorKind(error),
    nextRunAt: addHours(nowIso, retryHours(row.attempts))
  }).catch((finishError) => {
    console.warn(`Unable to release queue row ${row.asset_id}: ${errorMessage(finishError)}`);
    return false;
  })));
}

async function processBatch(queueRows: QueueRow[]): Promise<ItemResult[]> {
  const items = await loadItems(queueRows.map((row) => row.asset_id));
  const existingRows = queueRows.map((row) => items.get(row.asset_id)).filter((row): row is ExistingItemRow => Boolean(row));
  const nowIso = new Date().toISOString();
  let payloads: CatalogItemDetails[];

  try {
    payloads = await fetchCatalogItemDetailsBatch(existingRows, {
      userAgent: USER_AGENT,
      minRequestMs: REQUEST_MIN_MS,
      maxRetries: MAX_RETRIES
    });
  } catch (error) {
    return queueRows.map((row) => ({
      assetId: row.asset_id,
      success: false,
      metadataUpdated: false,
      thumbnailUpdated: false,
      error,
      errorCode: errorCode(error),
      errorKind: errorKind(error),
      nextRunAt: addHours(nowIso, retryHours(row.attempts))
    }));
  }

  const payloadByTarget = new Map(payloads.map((payload) => [payloadId(payload), payload]));
  const itemUpdates: Record<string, unknown>[] = [];
  const statusUpdates: Record<string, unknown>[] = [];
  const historyRows: Record<string, unknown>[] = [];
  const resultByAssetId = new Map<number, ItemResult>();
  const metadataRows: ExistingItemRow[] = [];

  for (const row of queueRows) {
    const existing = items.get(row.asset_id);
    if (!existing) {
      resultByAssetId.set(row.asset_id, {
        assetId: row.asset_id,
        success: false,
        metadataUpdated: false,
        thumbnailUpdated: false,
        error: new Error("Catalog item disappeared before enrichment"),
        errorCode: "missing_database_row",
        errorKind: "permanent_database",
        nextRunAt: addHours(nowIso, 24)
      });
      continue;
    }

    const payload = payloadByTarget.get(robloxTargetId(existing));
    if (!payload) {
      const failures = (existing.catalog_status_failure_count ?? 0) + 1;
      // Keep partial status writes separate from authoritative metadata rows.
      // PostgREST unions object keys within one upsert batch and would otherwise
      // fill absent metadata keys with null for these rows.
      statusUpdates.push({
        asset_id: existing.asset_id,
        catalog_status: failures >= 3 ? "unavailable" : existing.catalog_status ?? "unknown",
        catalog_status_checked_at: nowIso,
        catalog_status_failure_count: failures
      });
      resultByAssetId.set(row.asset_id, {
        assetId: row.asset_id,
        success: false,
        metadataUpdated: false,
        thumbnailUpdated: false,
        error: new Error("Item missing from successful Roblox catalog details response"),
        errorCode: "missing_from_details",
        errorKind: failures >= 3 ? "unavailable" : "incomplete_response",
        nextRunAt: addHours(nowIso, failures >= 3 ? 168 : retryHours(row.attempts))
      });
      continue;
    }

    const update = buildItemUpdate(existing, payload, nowIso);
    const tier = assignItemStatsTier({
      ...existing,
      name: normalizeText(update.name) ?? existing.name,
      category: existing.category,
      subcategory: existing.subcategory,
      favorite_count: normalizeNumber(update.favorite_count) ?? existing.favorite_count,
      lowest_resale_price_robux: normalizeNumber(update.lowest_resale_price_robux) ?? existing.lowest_resale_price_robux,
      has_resellers: normalizeBoolean(update.has_resellers) ?? existing.has_resellers,
      collectible_item_id: update.collectible_item_id as string | number | null,
      is_limited: normalizeBoolean(update.is_limited) ?? existing.is_limited,
      is_limited_unique: normalizeBoolean(update.is_limited_unique) ?? existing.is_limited_unique
    });
    update.item_stats_tier = tier.tier;
    update.item_stats_tier_reason = tier.reason;
    update.item_stats_tier_updated_at = nowIso;
    update.next_item_stats_refresh_at = existing.next_item_stats_refresh_at ?? nowIso;
    itemUpdates.push(update);
    if (historyChanged(existing, update)) historyRows.push(historyRow(existing, update, nowIso));
    metadataRows.push(existing);
    resultByAssetId.set(row.asset_id, {
      assetId: row.asset_id,
      success: false,
      metadataUpdated: true,
      thumbnailUpdated: false,
      error: new Error("Thumbnail has not completed yet"),
      errorCode: "thumbnail_pending",
      errorKind: "media_pending",
      nextRunAt: addHours(nowIso, 1)
    });
  }

  await upsertRows("roblox_catalog_items", itemUpdates, "asset_id");
  await upsertRows("roblox_catalog_items", statusUpdates, "asset_id");
  await insertHistory(historyRows);

  if (metadataRows.length) {
    try {
      const thumbnails = await fetchThumbnails(metadataRows, {
        userAgent: USER_AGENT,
        size: THUMBNAIL_SIZE,
        format: THUMBNAIL_FORMAT,
        maxRetries: MAX_RETRIES
      });
      const imageRows: Record<string, unknown>[] = [];
      const thumbnailItemUpdates: Record<string, unknown>[] = [];

      for (const existing of metadataRows) {
        const thumbnail = thumbnails.get(existing.asset_id);
        const imageUrl = normalizeText(thumbnail?.imageUrl);
        const state = normalizeText(thumbnail?.state);
        const completed = Boolean(imageUrl) && state?.toLowerCase() === "completed";
        if (!thumbnail) continue;
        imageRows.push({
          asset_id: existing.asset_id,
          size: THUMBNAIL_SIZE,
          format: THUMBNAIL_FORMAT,
          image_url: imageUrl,
          state,
          version: normalizeText(thumbnail.version),
          last_checked_at: nowIso
        });
        const thumbnailItemUpdate: Record<string, unknown> = {
          asset_id: existing.asset_id,
          last_thumbnail_health_checked_at: nowIso,
          last_thumbnail_verified_at: completed ? nowIso : existing.last_thumbnail_verified_at,
          thumbnail_http_status: completed ? 200 : existing.thumbnail_http_status,
          thumbnail_last_error: completed ? null : `Roblox thumbnail state: ${state ?? "missing"}`
        };
        thumbnailItemUpdates.push(thumbnailItemUpdate);
        if (completed) {
          const current = resultByAssetId.get(existing.asset_id);
          const tier = (itemUpdates.find((update) => update.asset_id === existing.asset_id)?.item_stats_tier ?? "COLD") as ItemStatsTier;
          resultByAssetId.set(existing.asset_id, {
            assetId: existing.asset_id,
            success: true,
            metadataUpdated: current?.metadataUpdated ?? true,
            thumbnailUpdated: true,
            nextRunAt: addHours(nowIso, refreshHours(tier))
          });
        }
      }

      await upsertRows("roblox_catalog_item_images", imageRows, "asset_id,size,format");
      await upsertRows("roblox_catalog_items", thumbnailItemUpdates, "asset_id");
    } catch (error) {
      for (const existing of metadataRows) {
        const current = resultByAssetId.get(existing.asset_id);
        resultByAssetId.set(existing.asset_id, {
          assetId: existing.asset_id,
          success: false,
          metadataUpdated: current?.metadataUpdated ?? true,
          thumbnailUpdated: false,
          error,
          errorCode: errorCode(error),
          errorKind: errorKind(error),
          nextRunAt: addHours(nowIso, retryHours(queueRows.find((row) => row.asset_id === existing.asset_id)?.attempts ?? 1))
        });
      }
    }
  }

  return queueRows.map((row) => resultByAssetId.get(row.asset_id) ?? ({
    assetId: row.asset_id,
    success: false,
    metadataUpdated: false,
    thumbnailUpdated: false,
    error: new Error("Unknown enrichment result"),
    errorCode: "unknown_result",
    errorKind: "internal",
    nextRunAt: addHours(nowIso, retryHours(row.attempts))
  }));
}

async function main() {
  const run = await startStatsJobRun({
    jobName: "catalog_items_enrichment",
    workerId: WORKER_ID,
    metadata: {
      dry_run: DRY_RUN,
      claim_limit: CLAIM_LIMIT,
      max_total: MAX_TOTAL,
      details_batch: DETAILS_BATCH,
      request_min_ms: REQUEST_MIN_MS
    }
  });
  let claimed = 0;
  let succeeded = 0;
  let failed = 0;
  let metadataUpdated = 0;
  let thumbnailsUpdated = 0;

  try {
    while (claimed < MAX_TOTAL) {
      const queueRows = await claimQueue(Math.min(CLAIM_LIMIT, MAX_TOTAL - claimed));
      if (!queueRows.length) break;
      claimed += queueRows.length;

      for (const batch of chunkArray(queueRows, DETAILS_BATCH)) {
        let results: ItemResult[];
        try {
          results = await processBatch(batch);
        } catch (error) {
          await releaseBatch(batch, error);
          failed += batch.length;
          console.error(`Catalog enrichment batch failed: ${errorMessage(error)}`);
          continue;
        }

        for (const result of results) {
          const queueRow = batch.find((row) => row.asset_id === result.assetId);
          if (!queueRow) continue;
          const acknowledged = await finishQueue(queueRow, result);
          if (!acknowledged && !DRY_RUN) {
            failed += 1;
            console.warn(`Catalog enrichment lease was lost before acknowledgement for ${result.assetId}.`);
            continue;
          }
          if (result.success) succeeded += 1;
          else failed += 1;
          if (result.metadataUpdated) metadataUpdated += 1;
          if (result.thumbnailUpdated) thumbnailsUpdated += 1;
        }
      }

      if (DRY_RUN) break;
    }

    const status = failed === 0 ? "success" : succeeded > 0 || metadataUpdated > 0 ? "partial" : "failed";
    await finishStatsJobRun(run, {
      status,
      rowsClaimed: claimed,
      rowsSucceeded: succeeded,
      rowsFailed: failed,
      metadata: { dry_run: DRY_RUN, metadata_updated: metadataUpdated, thumbnails_updated: thumbnailsUpdated }
    });
    console.log(JSON.stringify({ status, dryRun: DRY_RUN, claimed, succeeded, failed, metadataUpdated, thumbnailsUpdated }, null, 2));
    if (status === "failed") process.exitCode = 1;
  } catch (error) {
    await finishStatsJobRun(run, { status: "failed", rowsClaimed: claimed, rowsSucceeded: succeeded, rowsFailed: failed, error });
    throw error;
  }
}

main().catch((error) => {
  console.error(errorMessage(error));
  process.exit(1);
});
