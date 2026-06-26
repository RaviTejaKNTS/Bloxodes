import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  DECAL_ASSET_TYPE_ID,
  ECONOMY_ASSET_DETAILS_API,
  THUMBNAILS_API,
  chunkArray,
  clampNumber,
  computeDecalPopularity,
  fetchWithRetry,
  normalizeBoolean,
  normalizeDate,
  normalizeNumber,
  normalizeText,
  sleep,
  toBoolean,
  upsertDecalRows,
  type DecalUpsertRow
} from "./decal-id-utils";

const USER_AGENT = "BloxodesDecalVerifier/1.0";
const VERIFY_BATCH_SIZE = clampNumber(process.env.ROBLOX_DECAL_VERIFY_BATCH, 100, 1, 1000);
const VERIFY_MAX_TOTAL = clampNumber(process.env.ROBLOX_DECAL_VERIFY_MAX_TOTAL, 0, 0, Number.POSITIVE_INFINITY);
const VERIFY_CONCURRENCY = clampNumber(process.env.ROBLOX_DECAL_VERIFY_CONCURRENCY, 6, 1, 25);
const VERIFY_REFRESH_HOURS = clampNumber(process.env.ROBLOX_DECAL_VERIFY_REFRESH_HOURS, 168, 0, 365 * 24);
const REQUEST_DELAY_MS = clampNumber(process.env.ROBLOX_DECAL_VERIFY_REQUEST_DELAY_MS, 80, 0, 10000);
const BATCH_DELAY_MS = clampNumber(process.env.ROBLOX_DECAL_VERIFY_BATCH_DELAY_MS, 300, 0, 60000);
const MAX_RETRIES = clampNumber(process.env.ROBLOX_DECAL_VERIFY_MAX_RETRIES, 3, 0, 10);
const RETRY_BASE_MS = clampNumber(process.env.ROBLOX_DECAL_VERIFY_RETRY_BASE_MS, 400, 100, 10000);
const DRY_RUN = toBoolean(process.env.ROBLOX_DECAL_VERIFY_DRY_RUN, false);
const VERIFY_ORDER = (process.env.ROBLOX_DECAL_VERIFY_ORDER ?? "asset_id").trim().toLowerCase();

type PendingDecalRow = {
  asset_id: number;
  texture_id: number | null;
  name: string;
  raw_payload: Record<string, unknown> | null;
  vote_count: number | null;
  upvote_percent: number | null;
  creator_verified: boolean | null;
  sales: number | null;
  roblox_created_at: string | null;
  verified_at: string | null;
};

type RobloxAssetDetails = {
  TargetId?: number;
  AssetId?: number;
  Name?: string;
  Description?: string;
  AssetTypeId?: number;
  Creator?: {
    Id?: number;
    Name?: string;
    CreatorType?: string;
    HasVerifiedBadge?: boolean;
  };
  Created?: string;
  Updated?: string;
  PriceInRobux?: number | null;
  Sales?: number | null;
  IsForSale?: boolean | null;
  IsPublicDomain?: boolean | null;
  ContentRatingTypeId?: number | null;
};

type ThumbnailResult = {
  targetId?: number;
  state?: string;
  imageUrl?: string | null;
};

type DetailResult = {
  status: number;
  data: RobloxAssetDetails | null;
  fallbackTextureId?: number | null;
};

async function fetchAssetDetails(assetId: number): Promise<{ status: number; data: RobloxAssetDetails | null }> {
  await sleep(REQUEST_DELAY_MS);
  const res = await fetchWithRetry(ECONOMY_ASSET_DETAILS_API(assetId), undefined, {
    maxRetries: MAX_RETRIES,
    retryBaseMs: RETRY_BASE_MS,
    userAgent: USER_AGENT
  });
  let data: RobloxAssetDetails | null = null;
  try {
    data = (await res.json()) as RobloxAssetDetails;
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function fetchThumbnails(assetIds: number[]): Promise<Map<number, ThumbnailResult>> {
  const result = new Map<number, ThumbnailResult>();
  for (const chunk of chunkArray(assetIds, 100)) {
    const params = new URLSearchParams({
      assetIds: chunk.join(","),
      size: "420x420",
      format: "Png"
    });
    const res = await fetchWithRetry(`${THUMBNAILS_API}?${params.toString()}`, undefined, {
      maxRetries: MAX_RETRIES,
      retryBaseMs: RETRY_BASE_MS,
      userAgent: USER_AGENT
    });
    if (!res.ok) continue;
    const payload = (await res.json().catch(() => null)) as { data?: ThumbnailResult[] } | null;
    for (const entry of payload?.data ?? []) {
      const id = normalizeNumber(entry.targetId ?? null);
      if (id) result.set(id, entry);
    }
  }
  return result;
}

async function loadSourceCounts(assetIds: number[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (!assetIds.length) return counts;
  const sb = supabaseAdmin();
  for (const chunk of chunkArray(assetIds, 500)) {
    const { data, error } = await sb
      .from("roblox_decal_id_sources")
      .select("asset_id")
      .in("asset_id", chunk);
    if (error) throw new Error(`Failed to load decal source counts: ${error.message}`);
    for (const row of data ?? []) {
      const id = normalizeNumber((row as { asset_id?: number }).asset_id ?? null);
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

function buildInactiveRow(row: PendingDecalRow, status: string, reason: string, verifiedAt: string): DecalUpsertRow {
  return {
    asset_id: row.asset_id,
    name: row.name || `Roblox Decal ${row.asset_id}`,
    status,
    status_reason: reason,
    raw_payload: row.raw_payload ?? {},
    verified_at: verifiedAt,
    popularity_score: 0
  };
}

function fallbackDetailsFromRawPayload(row: PendingDecalRow): { details: RobloxAssetDetails; textureId: number | null } | null {
  const raw = row.raw_payload ?? {};
  const asset = (raw as Record<string, unknown>).asset as Record<string, unknown> | null | undefined;
  const creator = (raw as Record<string, unknown>).creator as Record<string, unknown> | null | undefined;
  const legacyCreator =
    ((raw as Record<string, unknown>).Creator ??
      (raw as Record<string, unknown>).creator) as Record<string, unknown> | null | undefined;

  if (asset && typeof asset === "object") {
    const assetId = normalizeNumber(asset.id ?? null);
    const assetTypeId = normalizeNumber(asset.assetTypeId ?? null);
    if (!assetId || assetTypeId !== DECAL_ASSET_TYPE_ID) return null;
    const groupId = normalizeNumber(creator?.groupId ?? null);
    const userId = normalizeNumber(creator?.userId ?? null);
    const creatorType = groupId ? "Group" : userId ? "User" : undefined;
    return {
      textureId: normalizeNumber(asset.textureId ?? row.texture_id ?? null),
      details: {
        AssetId: assetId,
        Name: normalizeText(asset.name) ?? row.name,
        Description: normalizeText(asset.description) ?? "",
        AssetTypeId: assetTypeId,
        Creator: {
          Id: groupId ?? userId ?? undefined,
          Name: normalizeText(creator?.name) ?? undefined,
          CreatorType: creatorType,
          HasVerifiedBadge: typeof creator?.verified === "boolean" ? creator.verified : undefined
        },
        Created: normalizeDate(asset.createTime) ?? undefined,
        Updated: normalizeDate(asset.updateTime) ?? undefined
      }
    };
  }

  const legacyAssetType = normalizeNumber((raw as Record<string, unknown>).AssetTypeId ?? (raw as Record<string, unknown>).assetType ?? null);
  const legacyAssetId = normalizeNumber((raw as Record<string, unknown>).AssetId ?? (raw as Record<string, unknown>).id ?? row.asset_id);
  if (legacyAssetType === DECAL_ASSET_TYPE_ID && legacyAssetId) {
    return {
      textureId: row.texture_id,
      details: {
        AssetId: legacyAssetId,
        Name: normalizeText((raw as Record<string, unknown>).Name ?? (raw as Record<string, unknown>).name) ?? row.name,
        Description: normalizeText((raw as Record<string, unknown>).Description ?? (raw as Record<string, unknown>).description) ?? "",
        AssetTypeId: legacyAssetType,
        Creator: {
          Id: normalizeNumber(legacyCreator?.Id ?? legacyCreator?.id ?? null) ?? undefined,
          Name: normalizeText(legacyCreator?.Name ?? legacyCreator?.name) ?? undefined,
          CreatorType: normalizeText(legacyCreator?.CreatorType ?? legacyCreator?.type) ?? undefined,
          HasVerifiedBadge: typeof legacyCreator?.HasVerifiedBadge === "boolean" ? legacyCreator.HasVerifiedBadge : undefined
        },
        Created: normalizeDate((raw as Record<string, unknown>).Created ?? (raw as Record<string, unknown>).created) ?? undefined,
        Updated: normalizeDate((raw as Record<string, unknown>).Updated ?? (raw as Record<string, unknown>).updated) ?? undefined,
        PriceInRobux: normalizeNumber((raw as Record<string, unknown>).PriceInRobux ?? (raw as Record<string, unknown>).priceInRobux ?? null),
        Sales: normalizeNumber((raw as Record<string, unknown>).Sales ?? (raw as Record<string, unknown>).sales ?? null),
        IsForSale: normalizeBoolean((raw as Record<string, unknown>).IsForSale ?? (raw as Record<string, unknown>).isForSale ?? null),
        IsPublicDomain: normalizeBoolean((raw as Record<string, unknown>).IsPublicDomain ?? (raw as Record<string, unknown>).isPublicDomain ?? null)
      }
    };
  }

  return null;
}

function buildVerifiedRow(
  row: PendingDecalRow,
  details: RobloxAssetDetails,
  thumbnail: ThumbnailResult | undefined,
  sourceCount: number,
  verifiedAt: string
): DecalUpsertRow {
  const assetId = normalizeNumber(details.AssetId ?? details.TargetId ?? row.asset_id) ?? row.asset_id;
  const name = normalizeText(details.Name) ?? row.name ?? `Roblox Decal ${assetId}`;
  const creatorTypeRaw = normalizeText(details.Creator?.CreatorType);
  const creatorType = creatorTypeRaw === "Group" ? "Group" : creatorTypeRaw === "User" ? "User" : null;
  const thumbnailState = normalizeText(thumbnail?.state) ?? null;
  const thumbnailUrl = normalizeText(thumbnail?.imageUrl);
  const status = thumbnailState === "Completed" && thumbnailUrl ? "active" : "inactive";
  const statusReason = status === "active" ? null : `thumbnail_${thumbnailState ?? "missing"}`;
  const voteCount = normalizeNumber(row.vote_count ?? null);
  const upvotePercent = normalizeNumber(row.upvote_percent ?? null);
  const creatorVerified = normalizeBoolean(details.Creator?.HasVerifiedBadge ?? row.creator_verified ?? null);
  const sales = normalizeNumber(details.Sales ?? row.sales ?? null);
  const robloxCreatedAt = normalizeDate(details.Created) ?? row.roblox_created_at;

  const popularityScore = computeDecalPopularity({
    vote_count: voteCount,
    upvote_percent: upvotePercent,
    creator_verified: creatorVerified,
    sales,
    source_count: sourceCount,
    roblox_created_at: robloxCreatedAt,
    thumbnail_state: thumbnailState
  });

  return {
    asset_id: assetId,
    texture_id: row.texture_id,
    name,
    description: normalizeText(details.Description),
    creator_id: normalizeNumber(details.Creator?.Id ?? null),
    creator_type: creatorType,
    creator_name: normalizeText(details.Creator?.Name),
    creator_verified: creatorVerified,
    roblox_created_at: robloxCreatedAt,
    roblox_updated_at: normalizeDate(details.Updated),
    is_public_domain: normalizeBoolean(details.IsPublicDomain ?? null),
    is_for_sale: normalizeBoolean(details.IsForSale ?? null),
    price_in_robux: normalizeNumber(details.PriceInRobux ?? null),
    sales,
    vote_count: voteCount,
    upvote_percent: upvotePercent,
    thumbnail_url: thumbnailUrl,
    thumbnail_state: thumbnailState,
    thumbnail_checked_at: verifiedAt,
    status,
    status_reason: statusReason,
    raw_payload: {
      ...(row.raw_payload ?? {}),
      economyDetails: details,
      thumbnail
    },
    verified_at: verifiedAt,
    popularity_score: popularityScore
  };
}

async function verifyRows(rows: PendingDecalRow[]): Promise<DecalUpsertRow[]> {
  const verifiedAt = new Date().toISOString();
  const thumbnails = await fetchThumbnails(rows.map((row) => row.asset_id));
  const sourceCounts = await loadSourceCounts(rows.map((row) => row.asset_id));
  const results: DecalUpsertRow[] = [];

  for (let i = 0; i < rows.length; i += VERIFY_CONCURRENCY) {
    const slice = rows.slice(i, i + VERIFY_CONCURRENCY);
    const detailResults: DetailResult[] = await Promise.all(
      slice.map((row) => {
        const fallback = fallbackDetailsFromRawPayload(row);
        const thumbnail = thumbnails.get(row.asset_id);
        if (fallback && thumbnail?.state === "Completed" && thumbnail.imageUrl) {
          return Promise.resolve({
            status: 200,
            data: fallback.details,
            fallbackTextureId: fallback.textureId
          });
        }
        return fetchAssetDetails(row.asset_id);
      })
    );
    detailResults.forEach((detailsResult, index) => {
      const row = slice[index];
      if (!detailsResult.data || detailsResult.status === 404) {
        results.push(buildInactiveRow(row, "deleted", "asset_details_not_found", verifiedAt));
        return;
      }
      if (detailsResult.status === 401 || detailsResult.status === 403) {
        results.push(buildInactiveRow(row, "private", `asset_details_${detailsResult.status}`, verifiedAt));
        return;
      }
      if (detailsResult.status >= 400) {
        const fallback = fallbackDetailsFromRawPayload(row);
        const thumbnail = thumbnails.get(row.asset_id);
        if (fallback && thumbnail?.state === "Completed" && thumbnail.imageUrl) {
          results.push(
            buildVerifiedRow(
              { ...row, texture_id: fallback.textureId },
              fallback.details,
              thumbnail,
              sourceCounts.get(row.asset_id) ?? 0,
              verifiedAt
            )
          );
          return;
        }
        results.push(buildInactiveRow(row, "error", `asset_details_${detailsResult.status}`, verifiedAt));
        return;
      }

      const assetTypeId = normalizeNumber(detailsResult.data.AssetTypeId ?? null);
      if (assetTypeId !== DECAL_ASSET_TYPE_ID) {
        results.push(buildInactiveRow(row, "not_decal", `asset_type_${assetTypeId ?? "unknown"}`, verifiedAt));
        return;
      }

      results.push(
        buildVerifiedRow(
          { ...row, texture_id: detailsResult.fallbackTextureId ?? row.texture_id },
          detailsResult.data,
          thumbnails.get(row.asset_id),
          sourceCounts.get(row.asset_id) ?? 0,
          verifiedAt
        )
      );
    });
  }

  return results;
}

async function fetchBatch(limit: number, cutoff: string | null): Promise<PendingDecalRow[]> {
  const sb = supabaseAdmin();
  let query = sb
    .from("roblox_decal_ids")
    .select("asset_id, texture_id, name, raw_payload, vote_count, upvote_percent, creator_verified, sales, roblox_created_at, verified_at")
    .limit(limit);

  if (cutoff) {
    query = query.or(`status.eq.pending,verified_at.is.null,verified_at.lt.${cutoff}`);
  } else {
    query = query.or("status.eq.pending,verified_at.is.null");
  }

  if (VERIFY_ORDER === "verified_at") {
    query = query.order("verified_at", { ascending: true, nullsFirst: true }).order("asset_id", { ascending: true });
  } else {
    query = query.order("asset_id", { ascending: true });
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load decal IDs for verification: ${error.message}`);
  return (data ?? []) as PendingDecalRow[];
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set.");
  }

  const cutoff = VERIFY_REFRESH_HOURS > 0
    ? new Date(Date.now() - VERIFY_REFRESH_HOURS * 60 * 60 * 1000).toISOString()
    : null;

  let processed = 0;
  while (true) {
    if (VERIFY_MAX_TOTAL > 0 && processed >= VERIFY_MAX_TOTAL) break;
    const remaining = VERIFY_MAX_TOTAL > 0 ? Math.max(0, VERIFY_MAX_TOTAL - processed) : VERIFY_BATCH_SIZE;
    const batchSize = Math.min(VERIFY_BATCH_SIZE, remaining || VERIFY_BATCH_SIZE);
    const rows = await fetchBatch(batchSize, cutoff);
    if (!rows.length) break;

    const updates = await verifyRows(rows);
    await upsertDecalRows(updates, { dryRun: DRY_RUN });
    processed += rows.length;
    const active = updates.filter((row) => row.status === "active").length;
    console.log(`Verified ${processed} decal IDs (${active}/${updates.length} active in latest batch).`);
    await sleep(BATCH_DELAY_MS);
  }

  console.log(`Done. Total verified: ${processed}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
