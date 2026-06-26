import { supabaseAdmin } from "@/lib/supabase-admin";

export const DECAL_ASSET_TYPE_ID = 13;
export const TOOLBOX_SEARCH_API = "https://apis.roblox.com/toolbox-service/v2/assets:search";
export const THUMBNAILS_API = "https://thumbnails.roblox.com/v1/assets";
export const ECONOMY_ASSET_DETAILS_API = (assetId: number) => `https://economy.roblox.com/v2/assets/${assetId}/details`;

export type CreatorStoreAsset = {
  voting?: {
    upVotes?: number | null;
    downVotes?: number | null;
    voteCount?: number | null;
    upVotePercent?: number | null;
  } | null;
  creator?: {
    creator?: string | null;
    userId?: number | null;
    groupId?: number | null;
    name?: string | null;
    verified?: boolean | null;
  } | null;
  creatorStoreProduct?: {
    purchasable?: boolean | null;
    purchasePrice?: {
      currencyCode?: string | null;
      quantity?: { significand?: number | string | null; exponent?: number | string | null } | null;
    } | null;
  } | null;
  asset?: {
    id?: number | null;
    textureId?: number | null;
    name?: string | null;
    description?: string | null;
    assetTypeId?: number | null;
    createTime?: string | null;
    updateTime?: string | null;
    previewAssets?: {
      imagePreviewAssets?: number[] | null;
      videoPreviewAssets?: number[] | null;
    } | null;
  } | null;
};

export type DecalUpsertRow = {
  asset_id: number;
  texture_id?: number | null;
  name: string;
  description?: string | null;
  creator_id?: number | null;
  creator_type?: "User" | "Group" | null;
  creator_name?: string | null;
  creator_verified?: boolean | null;
  roblox_created_at?: string | null;
  roblox_updated_at?: string | null;
  is_public_domain?: boolean | null;
  is_for_sale?: boolean | null;
  price_in_robux?: number | null;
  sales?: number | null;
  purchasable?: boolean | null;
  vote_count?: number | null;
  upvote_percent?: number | null;
  thumbnail_url?: string | null;
  thumbnail_state?: string | null;
  thumbnail_checked_at?: string | null;
  status?: string;
  status_reason?: string | null;
  source?: string;
  raw_payload?: Record<string, unknown>;
  last_seen_at?: string;
  verified_at?: string | null;
  popularity_score?: number;
  categories?: string[];
  primary_category?: string | null;
  curated_score?: number;
  curated_rank?: number | null;
  curated_tier?: string | null;
  curated_reason?: string | null;
};

export type DecalSourceRow = {
  asset_id: number;
  source_kind: string;
  source_url?: string | null;
  source_query?: string | null;
  source_page?: number | null;
  source_rank?: number | null;
  raw_payload?: Record<string, unknown>;
  last_seen_at?: string;
};

export type InsertMissingDecalRowsResult = {
  attempted: number;
  inserted: number;
  existing: number;
};

export function clampNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function toBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return fallback;
}

export function parseCsv(raw: string | undefined, fallback: string[]): string[] {
  if (!raw || !raw.trim()) return fallback;
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length ? trimmed : null;
}

export function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit | undefined,
  options: { maxRetries: number; retryBaseMs: number; userAgent: string }
): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, {
      ...init,
      headers: {
        accept: "application/json",
        "user-agent": options.userAgent,
        ...(init?.headers ?? {})
      }
    });
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= options.maxRetries) return res;
    await sleep(options.retryBaseMs * Math.pow(2, attempt));
    attempt += 1;
  }
}

export function buildDecalRowFromToolbox(entry: CreatorStoreAsset, fetchedAt: string, source: string): DecalUpsertRow | null {
  const asset = entry.asset ?? null;
  const assetId = normalizeNumber(asset?.id ?? null);
  if (!asset || !assetId) return null;
  const assetTypeId = normalizeNumber(asset.assetTypeId ?? null);
  if (assetTypeId !== DECAL_ASSET_TYPE_ID) return null;

  const creatorId = normalizeNumber(entry.creator?.userId ?? entry.creator?.groupId ?? null);
  const creatorType = entry.creator?.groupId ? "Group" : entry.creator?.userId ? "User" : null;
  const name = normalizeText(asset.name) ?? `Roblox Decal ${assetId}`;

  return {
    asset_id: assetId,
    texture_id: normalizeNumber(asset.textureId ?? null),
    name,
    description: normalizeText(asset.description),
    creator_id: creatorId,
    creator_type: creatorType,
    creator_name: normalizeText(entry.creator?.name),
    creator_verified: normalizeBoolean(entry.creator?.verified ?? null),
    roblox_created_at: normalizeDate(asset.createTime),
    roblox_updated_at: normalizeDate(asset.updateTime),
    purchasable: normalizeBoolean(entry.creatorStoreProduct?.purchasable ?? null),
    vote_count: normalizeNumber(entry.voting?.voteCount ?? entry.voting?.upVotes ?? null),
    upvote_percent: normalizeNumber(entry.voting?.upVotePercent ?? null),
    status: "pending",
    status_reason: "awaiting_verification",
    source,
    raw_payload: entry as Record<string, unknown>,
    last_seen_at: fetchedAt
  };
}

export function computeDecalPopularity(row: {
  vote_count?: number | null;
  upvote_percent?: number | null;
  creator_verified?: boolean | null;
  sales?: number | null;
  source_count?: number | null;
  roblox_created_at?: string | null;
  thumbnail_state?: string | null;
}) {
  const votes = row.vote_count ?? 0;
  const upvote = row.upvote_percent ?? 0;
  const sales = row.sales ?? 0;
  const sources = row.source_count ?? 0;
  const verifiedBoost = row.creator_verified ? 50 : 0;
  const thumbnailBoost = row.thumbnail_state === "Completed" ? 25 : 0;
  let recencyBoost = 0;

  if (row.roblox_created_at) {
    const created = new Date(row.roblox_created_at);
    if (Number.isFinite(created.getTime())) {
      const days = Math.max(0, (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
      recencyBoost = Math.max(0, 180 - Math.min(180, days)) * 0.2;
    }
  }

  return votes * 1.2 + upvote * 5 + Math.log10(Math.max(1, sales)) * 20 + sources * 10 + verifiedBoost + thumbnailBoost + recencyBoost;
}

export async function upsertDecalRows(rows: DecalUpsertRow[], options?: { dryRun?: boolean }) {
  if (!rows.length) return;
  if (options?.dryRun) {
    console.log(`Dry run: would upsert ${rows.length} decal rows.`);
    return;
  }
  const sb = supabaseAdmin();
  for (const chunk of chunkArray(rows, 200)) {
    const { error } = await sb.from("roblox_decal_ids").upsert(chunk, { onConflict: "asset_id" });
    if (error) throw new Error(`Failed to upsert decal rows: ${error.message}`);
  }
}

export async function insertMissingDecalRows(
  rows: DecalUpsertRow[],
  options?: { dryRun?: boolean }
): Promise<InsertMissingDecalRowsResult> {
  const result: InsertMissingDecalRowsResult = {
    attempted: rows.length,
    inserted: 0,
    existing: 0
  };

  if (!rows.length) return result;
  if (options?.dryRun) {
    console.log(`Dry run: would insert ${rows.length} missing decal rows.`);
    result.inserted = rows.length;
    return result;
  }

  const sb = supabaseAdmin();
  for (const chunk of chunkArray(rows, 200)) {
    const ids = chunk.map((row) => row.asset_id);
    const { data: existingRows, error: existingError } = await sb
      .from("roblox_decal_ids")
      .select("asset_id")
      .in("asset_id", ids);
    if (existingError) throw new Error(`Failed to load existing decal rows: ${existingError.message}`);

    const existingIds = new Set((existingRows ?? []).map((row) => Number(row.asset_id)).filter(Number.isFinite));
    const missingRows = chunk.filter((row) => !existingIds.has(row.asset_id));
    result.existing += chunk.length - missingRows.length;
    if (!missingRows.length) continue;

    const { error } = await sb.from("roblox_decal_ids").insert(missingRows);
    if (error) throw new Error(`Failed to insert missing decal rows: ${error.message}`);
    result.inserted += missingRows.length;
  }

  return result;
}

export async function upsertSourceRows(rows: DecalSourceRow[], options?: { dryRun?: boolean }) {
  if (!rows.length) return;
  if (options?.dryRun) {
    console.log(`Dry run: would insert ${rows.length} source rows.`);
    return;
  }
  const sb = supabaseAdmin();
  for (const chunk of chunkArray(rows, 200)) {
    const { error } = await sb.from("roblox_decal_id_sources").upsert(chunk, {
      onConflict: "asset_id,source_kind,source_url,source_query,source_page,source_rank",
      ignoreDuplicates: false
    });
    if (error) throw new Error(`Failed to upsert decal source rows: ${error.message}`);
  }
}
