import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { enqueueRevalidationEvents } from "../shared/revalidation-events";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";
import {
  addHours,
  assignItemStatsTier,
  chunkArray,
  fetchAssetEconomyDetails,
  fetchCatalogItemDetailsBatch,
  fetchThumbnails,
  hourStart,
  ITEM_STATS_TIERS,
  itemTypeForRoblox,
  normalizeBoolean,
  normalizeNumber,
  normalizeText,
  readNumber,
  robloxTargetId,
  RobloxRateLimitError,
  toBoolean,
  type CatalogItemDetails,
  type ItemStatsSourceRow,
  type ItemStatsTier
} from "./item-stats-utils";
import { refreshStatsItemCurrentIndexes } from "./item-index-refresh";

type Options = {
  tier: ItemStatsTier | "ALL";
  limit: number;
  assetIds: number[];
  includeEconomyDetails: boolean;
  refreshIndexes: boolean;
  dryRun: boolean;
};

const USER_AGENT = process.env.ROBLOX_ITEM_STATS_USER_AGENT ?? "BloxodesItemStatsBot/1.0";
const REQUEST_MIN_MS = readNumber(process.env.ROBLOX_ITEM_STATS_MIN_REQUEST_MS, 1200);
const MAX_RETRIES = readNumber(process.env.ROBLOX_ITEM_STATS_MAX_RETRIES, 3);
const DETAILS_BATCH = readNumber(process.env.ROBLOX_ITEM_STATS_DETAILS_BATCH, 10);
const DEFAULT_LIMIT = readNumber(process.env.ROBLOX_ITEM_STATS_LIMIT, 200);
const THUMBNAIL_SIZE = process.env.ROBLOX_ITEM_STATS_THUMBNAIL_SIZE ?? "420x420";
const THUMBNAIL_FORMAT = process.env.ROBLOX_ITEM_STATS_THUMBNAIL_FORMAT ?? "Png";

function parseTier(value: string | undefined): Options["tier"] {
  const normalized = (value ?? "HOT").toUpperCase();
  if (normalized === "ALL") return "ALL";
  if (ITEM_STATS_TIERS.includes(normalized as ItemStatsTier)) return normalized as ItemStatsTier;
  throw new Error(`Invalid tier "${value}". Use ${ITEM_STATS_TIERS.join(", ")} or ALL.`);
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    tier: parseTier(process.env.ROBLOX_ITEM_STATS_TIER),
    limit: DEFAULT_LIMIT,
    assetIds: [],
    includeEconomyDetails: toBoolean(process.env.ROBLOX_ITEM_STATS_ECONOMY_DETAILS, false),
    refreshIndexes: toBoolean(process.env.ROBLOX_ITEM_STATS_REFRESH_INDEXES, true),
    dryRun: toBoolean(process.env.ROBLOX_ITEM_STATS_DRY_RUN, false)
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--tier") {
      options.tier = parseTier(args[index + 1]);
      index += 1;
    } else if (arg === "--limit") {
      options.limit = readNumber(args[index + 1], options.limit);
      index += 1;
    } else if (arg === "--asset-id") {
      const ids = (args[index + 1] ?? "").split(",").map((value) => Number(value.trim())).filter(Number.isFinite);
      options.assetIds.push(...ids);
      index += 1;
    } else if (arg === "--include-economy-details") {
      options.includeEconomyDetails = true;
    } else if (arg === "--skip-index-refresh") {
      options.refreshIndexes = false;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npm run stats:items:refresh -- [--tier HOT|WARM|COLD|NEW|TRADE|BROKEN_MEDIA|ALL] [--limit <n>]

Refreshes Roblox item metadata/thumbnails, writes hourly snapshots, and optionally rebuilds /stats/items indexes.
`);
      process.exit(0);
    }
  }

  return options;
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

function catalogPayloadId(payload: CatalogItemDetails) {
  return normalizeNumber(payload.id) ?? normalizeNumber(payload.Id) ?? normalizeNumber(payload.AssetId);
}

function catalogPayloadByTargetId(payloads: CatalogItemDetails[]) {
  const map = new Map<number, CatalogItemDetails>();
  for (const payload of payloads) {
    const id = catalogPayloadId(payload);
    if (id != null) map.set(id, payload);
  }
  return map;
}

async function loadItems(options: Options): Promise<ItemStatsSourceRow[]> {
  const select = `
    asset_id,item_type,asset_type_id,name,description,category,subcategory,
    creator_id,creator_target_id,creator_name,creator_type,creator_has_verified_badge,
    price_robux,price_status,lowest_price_robux,lowest_resale_price_robux,
    is_for_sale,is_limited,is_limited_unique,remaining,product_id,collectible_item_id,
    favorite_count,has_resellers,total_quantity,units_available_for_consumption,
    quantity_limit_per_user,sale_location_type,off_sale_deadline,item_status,
    item_restrictions,bundled_items,raw_catalog_json,raw_economy_json,
    item_stats_tier,next_item_stats_refresh_at,item_stats_refresh_attempt_count,
    last_item_stats_refreshed_at,last_resale_data_fetched_at,
    last_thumbnail_health_checked_at,thumbnail_http_status,thumbnail_last_error
  `;

  let query = supabaseAdmin()
    .from("roblox_catalog_items")
    .select(select)
    .eq("is_deleted", false)
    .order("next_item_stats_refresh_at", { ascending: true, nullsFirst: true })
    .order("last_item_stats_refreshed_at", { ascending: true, nullsFirst: true })
    .limit(options.limit);

  if (options.assetIds.length) {
    query = query.in("asset_id", Array.from(new Set(options.assetIds)));
  } else {
    if (options.tier !== "ALL") query = query.eq("item_stats_tier", options.tier);
    query = query.or(`next_item_stats_refresh_at.is.null,next_item_stats_refresh_at.lte.${new Date().toISOString()}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load item stats refresh rows: ${error.message}`);
  return (data ?? []) as ItemStatsSourceRow[];
}

async function claimRows(rows: ItemStatsSourceRow[], workerId: string, dryRun: boolean) {
  if (!rows.length || dryRun) return;
  const nowIso = new Date().toISOString();
  const { error } = await supabaseAdmin()
    .from("roblox_catalog_items")
    .update({
      item_stats_refresh_locked_at: nowIso,
      item_stats_refresh_locked_by: workerId,
      last_item_stats_refresh_error: null
    })
    .in("asset_id", rows.map((row) => row.asset_id));
  if (error) throw new Error(`Failed to claim item stats rows: ${error.message}`);
}

function itemUpdateFromPayload(row: ItemStatsSourceRow, payload: CatalogItemDetails | null, economy: Record<string, unknown> | null, nowIso: string) {
  const rawCatalog = payload ?? row.raw_catalog_json ?? {};
  const creator = (rawCatalog.Creator && typeof rawCatalog.Creator === "object" ? rawCatalog.Creator : null) as Record<string, unknown> | null;
  const collectibles = (economy?.CollectiblesItemDetails && typeof economy.CollectiblesItemDetails === "object" ? economy.CollectiblesItemDetails : null) as Record<string, unknown> | null;

  const update: Record<string, unknown> = {
    asset_id: row.asset_id,
    item_type: itemTypeForRoblox(row.item_type),
    last_item_stats_refreshed_at: nowIso,
    last_enriched_at: nowIso,
    is_deleted: false,
    raw_catalog_json: rawCatalog
  };

  const priceRobux =
    pickNumber(economy, ["PriceInRobux"]) ??
    pickNumber(rawCatalog, ["PriceInRobux", "price"]) ??
    row.price_robux;
  const lowestResalePrice =
    pickNumber(collectibles, ["CollectibleLowestResalePrice", "lowestResalePrice"]) ??
    pickNumber(rawCatalog, ["lowestResalePrice"]) ??
    row.lowest_resale_price_robux;

  update.name = pickText(economy, ["Name"]) ?? pickText(rawCatalog, ["Name", "name"]) ?? row.name;
  update.description = pickText(economy, ["Description"]) ?? pickText(rawCatalog, ["Description", "description"]) ?? row.description;
  update.asset_type_id = pickNumber(economy, ["AssetTypeId"]) ?? pickNumber(rawCatalog, ["AssetTypeId", "assetType"]) ?? row.asset_type_id;
  update.product_id = pickNumber(economy, ["ProductId"]) ?? pickNumber(rawCatalog, ["ProductId", "productId"]) ?? row.product_id;
  update.price_robux = priceRobux;
  update.price_status = pickText(rawCatalog, ["priceStatus"]) ?? row.price_status;
  update.lowest_price_robux = pickNumber(rawCatalog, ["lowestPrice"]) ?? row.lowest_price_robux ?? priceRobux;
  update.lowest_resale_price_robux = lowestResalePrice;
  update.is_for_sale = pickBoolean(economy, ["IsForSale"]) ?? pickBoolean(rawCatalog, ["IsForSale", "isForSale"]) ?? row.is_for_sale;
  update.is_limited = pickBoolean(economy, ["IsLimited"]) ?? pickBoolean(rawCatalog, ["IsLimited", "isLimited"]) ?? row.is_limited;
  update.is_limited_unique = pickBoolean(economy, ["IsLimitedUnique"]) ?? pickBoolean(rawCatalog, ["IsLimitedUnique", "isLimitedUnique"]) ?? row.is_limited_unique;
  update.remaining = pickNumber(economy, ["Remaining"]) ?? pickNumber(rawCatalog, ["remaining"]) ?? row.remaining;
  update.favorite_count = pickNumber(rawCatalog, ["favoriteCount"]) ?? row.favorite_count;
  update.has_resellers = pickBoolean(rawCatalog, ["hasResellers"]) ?? row.has_resellers ?? (lowestResalePrice != null && lowestResalePrice > 0);
  update.total_quantity = pickNumber(collectibles, ["TotalQuantity", "totalQuantity"]) ?? pickNumber(rawCatalog, ["totalQuantity"]) ?? row.total_quantity;
  update.units_available_for_consumption = pickNumber(collectibles, ["UnitsAvailableForConsumption", "unitsAvailable"]) ?? pickNumber(rawCatalog, ["unitsAvailableForConsumption"]) ?? row.units_available_for_consumption;
  update.quantity_limit_per_user = pickNumber(collectibles, ["CollectibleQuantityLimitPerUser", "quantityLimitPerUser"]) ?? pickNumber(rawCatalog, ["quantityLimitPerUser"]) ?? row.quantity_limit_per_user;
  update.sale_location_type = pickText(rawCatalog, ["saleLocationType"]) ?? row.sale_location_type;
  update.off_sale_deadline = pickText(rawCatalog, ["offSaleDeadline"]) ?? row.off_sale_deadline;
  update.collectible_item_id = pickText(economy, ["CollectibleItemId"]) ?? pickText(rawCatalog, ["collectibleItemId"]) ?? row.collectible_item_id;
  update.item_status = rawCatalog.itemStatus ?? row.item_status;
  update.item_restrictions = rawCatalog.itemRestrictions ?? row.item_restrictions;
  update.bundled_items = rawCatalog.bundledItems ?? row.bundled_items;

  if (creator) {
    update.creator_id = pickNumber(creator, ["CreatorTargetId", "Id"]) ?? row.creator_id;
    update.creator_target_id = pickNumber(creator, ["CreatorTargetId", "Id"]) ?? row.creator_target_id;
    update.creator_name = pickText(creator, ["Name"]) ?? row.creator_name;
    update.creator_type = pickText(creator, ["CreatorType"]) ?? row.creator_type;
    update.creator_has_verified_badge = pickBoolean(creator, ["HasVerifiedBadge"]) ?? row.creator_has_verified_badge;
  } else {
    update.creator_id = pickNumber(rawCatalog, ["creatorTargetId", "creatorId"]) ?? row.creator_id;
    update.creator_target_id = pickNumber(rawCatalog, ["creatorTargetId", "creatorId"]) ?? row.creator_target_id;
    update.creator_name = pickText(rawCatalog, ["creatorName"]) ?? row.creator_name;
    update.creator_type = pickText(rawCatalog, ["creatorType"]) ?? row.creator_type;
    update.creator_has_verified_badge = pickBoolean(rawCatalog, ["creatorHasVerifiedBadge"]) ?? row.creator_has_verified_badge;
  }

  if (economy) {
    update.raw_economy_json = economy;
  }

  const assigned = assignItemStatsTier({
    ...row,
    name: normalizeText(update.name) ?? row.name,
    category: row.category,
    subcategory: row.subcategory,
    favorite_count: normalizeNumber(update.favorite_count) ?? row.favorite_count,
    lowest_resale_price_robux: normalizeNumber(update.lowest_resale_price_robux) ?? row.lowest_resale_price_robux,
    has_resellers: normalizeBoolean(update.has_resellers) ?? row.has_resellers,
    collectible_item_id: update.collectible_item_id as string | number | null,
    is_limited: normalizeBoolean(update.is_limited) ?? row.is_limited,
    is_limited_unique: normalizeBoolean(update.is_limited_unique) ?? row.is_limited_unique,
    last_item_stats_refreshed_at: nowIso
  });
  update.item_stats_tier = assigned.tier;
  update.next_item_stats_refresh_at = addHours(nowIso, assigned.refreshHours);
  update.item_stats_refresh_locked_at = null;
  update.item_stats_refresh_locked_by = null;
  update.item_stats_refresh_attempt_count = 0;
  update.last_item_stats_refresh_error = null;

  return update;
}

function hourlyRowFromUpdate(row: ItemStatsSourceRow, update: Record<string, unknown>, thumbnailUrl: string | null, thumbnailState: string | null, nowIso: string, hourIso: string) {
  return {
    asset_id: row.asset_id,
    hour_start: hourIso,
    sampled_at: nowIso,
    item_type: update.item_type,
    price_robux: update.price_robux,
    lowest_price_robux: update.lowest_price_robux,
    lowest_resale_price_robux: update.lowest_resale_price_robux,
    favorite_count: update.favorite_count,
    is_for_sale: update.is_for_sale,
    has_resellers: update.has_resellers,
    is_limited: update.is_limited,
    is_limited_unique: update.is_limited_unique,
    remaining: update.remaining,
    total_quantity: update.total_quantity,
    units_available_for_consumption: update.units_available_for_consumption,
    quantity_limit_per_user: update.quantity_limit_per_user,
    sale_location_type: update.sale_location_type,
    off_sale_deadline: update.off_sale_deadline,
    collectible_item_id: update.collectible_item_id,
    thumbnail_state: thumbnailState,
    thumbnail_url: thumbnailUrl,
    raw_snapshot_json: {
      catalog: update.raw_catalog_json ?? null,
      economy: update.raw_economy_json ?? null
    }
  };
}

async function upsertRows(table: string, rows: Record<string, unknown>[], onConflict: string, size = 100) {
  for (const chunk of chunkArray(rows, size)) {
    const { error } = await supabaseAdmin().from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`Failed to upsert ${table}: ${error.message}`);
  }
}

async function markFailures(rows: ItemStatsSourceRow[], error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const nowIso = new Date().toISOString();
  const updates = rows.map((row) => ({
    asset_id: row.asset_id,
    item_stats_refresh_locked_at: null,
    item_stats_refresh_locked_by: null,
    item_stats_refresh_attempt_count: (row.item_stats_refresh_attempt_count ?? 0) + 1,
    last_item_stats_refresh_error: message,
    next_item_stats_refresh_at: addHours(nowIso, Math.min(72, 2 ** Math.min((row.item_stats_refresh_attempt_count ?? 0) + 1, 6)))
  }));
  await upsertRows("roblox_catalog_items", updates, "asset_id", 100);
}

function summarizeRows(rows: ItemStatsSourceRow[]) {
  return rows.map((row) => row.asset_id).slice(0, 10);
}

async function refreshIndexes() {
  const { result, method } = await refreshStatsItemCurrentIndexes();
  await enqueueRevalidationEvents([{ type: "stats", slug: "items" }], "stats_items_refresh");
  return { ...result, method };
}

async function main() {
  const options = parseArgs();
  const workerId = process.env.STATS_WORKER_ID || process.env.HOSTNAME || `local-${process.pid}`;
  const run = await startStatsJobRun({
    jobName: `stats_items_refresh_${options.tier.toString().toLowerCase()}`,
    workerId,
    metadata: {
      tier: options.tier,
      limit: options.limit,
      asset_ids: options.assetIds,
      include_economy_details: options.includeEconomyDetails,
      refresh_indexes: options.refreshIndexes,
      dry_run: options.dryRun
    }
  });

  const rows = await loadItems(options);
  if (!rows.length) {
    await finishStatsJobRun(run, { status: "skipped", metadata: { reason: "no_items" } });
    console.log("No item stats rows ready for refresh.");
    return;
  }

  await claimRows(rows, workerId, options.dryRun);

  try {
    const nowIso = new Date().toISOString();
    const hourIso = hourStart(new Date(nowIso));
    const itemUpdates: Record<string, unknown>[] = [];
    const hourlyRows: Record<string, unknown>[] = [];
    const thumbnailRows: Record<string, unknown>[] = [];
    let rateLimitedBatches = 0;
    let rateLimitedRows = 0;
    const rateLimitedSamples: number[] = [];

    for (const detailBatch of chunkArray(rows, DETAILS_BATCH)) {
      let payloads: CatalogItemDetails[];
      let thumbnails: Awaited<ReturnType<typeof fetchThumbnails>>;

      try {
        payloads = await fetchCatalogItemDetailsBatch(detailBatch, {
          userAgent: USER_AGENT,
          minRequestMs: REQUEST_MIN_MS,
          maxRetries: MAX_RETRIES
        });
        thumbnails = await fetchThumbnails(detailBatch, {
          userAgent: USER_AGENT,
          size: THUMBNAIL_SIZE,
          format: THUMBNAIL_FORMAT,
          maxRetries: MAX_RETRIES
        });
      } catch (error) {
        if (!(error instanceof RobloxRateLimitError)) throw error;

        rateLimitedBatches += 1;
        rateLimitedRows += detailBatch.length;
        rateLimitedSamples.push(...summarizeRows(detailBatch).slice(0, Math.max(0, 10 - rateLimitedSamples.length)));
        console.warn(
          `Roblox rate limited ${detailBatch.length} item stats rows; backing off batch. Sample asset ids: ${summarizeRows(detailBatch).join(", ")}`
        );
        if (!options.dryRun) await markFailures(detailBatch, error);
        continue;
      }

      const payloadById = catalogPayloadByTargetId(payloads);

      for (const row of detailBatch) {
        const targetId = robloxTargetId(row);
        const payload = payloadById.get(targetId) ?? null;
        const economy =
          options.includeEconomyDetails && itemTypeForRoblox(row.item_type) === "Asset"
            ? await fetchAssetEconomyDetails(targetId, { userAgent: USER_AGENT, minRequestMs: REQUEST_MIN_MS, maxRetries: MAX_RETRIES }).catch((error) => {
                console.warn(`Economy details skipped for ${row.asset_id}:`, error instanceof Error ? error.message : String(error));
                return null;
              })
            : null;
        const update = itemUpdateFromPayload(row, payload, economy, nowIso);
        const thumbnail = thumbnails.get(row.asset_id) ?? null;
        const thumbnailUrl = normalizeText(thumbnail?.imageUrl);
        const thumbnailState = normalizeText(thumbnail?.state);

        if (thumbnail) {
          thumbnailRows.push({
            asset_id: row.asset_id,
            size: THUMBNAIL_SIZE,
            format: THUMBNAIL_FORMAT,
            image_url: thumbnailUrl,
            state: thumbnailState,
            version: normalizeText(thumbnail.version),
            last_checked_at: nowIso
          });
          update.last_thumbnail_health_checked_at = nowIso;
          update.thumbnail_http_status = thumbnailUrl ? 200 : null;
          update.thumbnail_last_error = null;
        }

        itemUpdates.push(update);
        hourlyRows.push(hourlyRowFromUpdate(row, update, thumbnailUrl, thumbnailState, nowIso, hourIso));
      }
    }

    if (!options.dryRun) {
      await upsertRows("roblox_catalog_items", itemUpdates, "asset_id", 100);
      await upsertRows("roblox_catalog_item_images", thumbnailRows, "asset_id,size,format", 100);
      await upsertRows("roblox_catalog_item_stats_hourly", hourlyRows, "asset_id,hour_start", 100);
    }

    const indexResult = !options.dryRun && options.refreshIndexes ? await refreshIndexes() : null;
    const status = rateLimitedRows > 0 ? "partial" : "success";

    await finishStatsJobRun(run, {
      status,
      rowsClaimed: rows.length,
      rowsSucceeded: itemUpdates.length,
      rowsFailed: rateLimitedRows,
      metadata: {
        hourly_rows: hourlyRows.length,
        thumbnail_rows: thumbnailRows.length,
        rate_limited_batches: rateLimitedBatches,
        rate_limited_rows: rateLimitedRows,
        rate_limited_sample_asset_ids: rateLimitedSamples,
        index_result: indexResult
      }
    });

    console.log(
      JSON.stringify(
        {
          dryRun: options.dryRun,
          status,
          refreshed: itemUpdates.length,
          rateLimitedRows,
          rateLimitedBatches,
          rateLimitedSamples,
          hourlyRows: hourlyRows.length,
          thumbnailRows: thumbnailRows.length,
          indexResult
        },
        null,
        2
      )
    );
  } catch (error) {
    if (!options.dryRun) await markFailures(rows, error);
    await finishStatsJobRun(run, { status: "failed", rowsClaimed: rows.length, error });
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
