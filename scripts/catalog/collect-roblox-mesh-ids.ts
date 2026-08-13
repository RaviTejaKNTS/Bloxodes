import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

const CREATOR_STORE_API = "https://apis.roblox.com/toolbox-service/v2/assets:search";
const THUMBNAIL_API = "https://thumbnails.roblox.com/v1/assets";
const SOURCE_NAME = "roblox_creator_store_mesh_part";
const EXPECTED_ASSET_TYPE_ID = 40;
const EXPECTED_RESULT_COUNT = 1_000;
const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 30_000;

type CliOptions = { apply: boolean; allowProd: boolean };

type CreatorStoreAsset = {
  voting?: { voteCount?: number; upVotePercent?: number };
  creator?: { userId?: number; name?: string; verified?: boolean };
  creatorStoreProduct?: { purchasable?: boolean };
  asset?: {
    id?: number;
    name?: string;
    description?: string;
    assetTypeId?: number;
    meshId?: number;
    textureId?: number;
    createTime?: string;
    updateTime?: string;
  };
};

type CreatorStoreResponse = {
  creatorStoreAssets?: CreatorStoreAsset[];
  totalResults?: number;
  nextPageToken?: string;
};

type ThumbnailResponse = {
  data?: Array<{ targetId?: number; state?: string; imageUrl?: string | null }>;
};

type MeshRow = {
  asset_id: number;
  mesh_id: number;
  texture_id: number | null;
  name: string;
  description: string | null;
  creator_id: number | null;
  creator_name: string | null;
  creator_verified: boolean | null;
  asset_type_id: number;
  purchasable: boolean | null;
  vote_count: number | null;
  upvote_percent: number | null;
  source_rank: number;
  thumbnail_url: string | null;
  thumbnail_state: string | null;
  thumbnail_checked_at: string;
  roblox_created_at: string | null;
  roblox_updated_at: string | null;
  creator_store_url: string;
  status: "active";
  source: string;
  raw_payload: CreatorStoreAsset;
  last_seen_at: string;
  verified_at: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options = { apply: false, allowProd: false };
  for (const arg of argv) {
    if (arg === "--apply") options.apply = true;
    else if (arg === "--allow-prod") options.allowProd = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run collect:mesh-ids -- [--apply] [--allow-prod]");
      process.exit(0);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function optionalSafeInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

async function fetchJson<T>(url: string, attempt = 1): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "BloxodesMeshIdsBot/1.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    if (attempt < 4 && (response.status === 429 || response.status >= 500)) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      return fetchJson<T>(url, attempt + 1);
    }
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
  return (await response.json()) as T;
}

async function loadCreatorStoreMeshes(): Promise<CreatorStoreAsset[]> {
  const assets: CreatorStoreAsset[] = [];
  let nextPageToken: string | undefined;
  let totalResults = 0;

  do {
    const url = new URL(CREATOR_STORE_API);
    url.searchParams.set("searchCategoryType", "MeshPart");
    url.searchParams.set("maxPageSize", String(PAGE_SIZE));
    url.searchParams.set("sortCategory", "Top");
    url.searchParams.set("sortDirection", "Descending");
    url.searchParams.set("searchView", "Full");
    url.searchParams.set("includeUnverifiedCreators", "true");
    if (nextPageToken) url.searchParams.set("pageToken", nextPageToken);

    const payload = await fetchJson<CreatorStoreResponse>(url.toString());
    assets.push(...(payload.creatorStoreAssets ?? []));
    totalResults = Number(payload.totalResults ?? totalResults);
    nextPageToken = payload.nextPageToken || undefined;
  } while (nextPageToken && assets.length < EXPECTED_RESULT_COUNT);

  const uniqueAssets = Array.from(
    new Map(assets.map((item) => [optionalSafeInteger(item.asset?.id), item])).values()
  );
  if (totalResults < EXPECTED_RESULT_COUNT || uniqueAssets.length !== EXPECTED_RESULT_COUNT) {
    throw new Error(
      `Incomplete MeshPart response: received ${uniqueAssets.length}; source reports ${totalResults}`
    );
  }
  return uniqueAssets;
}

async function loadThumbnails(assetIds: number[]) {
  const results = new Map<number, { state: string | null; imageUrl: string | null }>();
  for (let index = 0; index < assetIds.length; index += 50) {
    const url = new URL(THUMBNAIL_API);
    url.searchParams.set("assetIds", assetIds.slice(index, index + 50).join(","));
    url.searchParams.set("returnPolicy", "PlaceHolder");
    url.searchParams.set("size", "420x420");
    url.searchParams.set("format", "Webp");
    url.searchParams.set("isCircular", "false");
    const payload = await fetchJson<ThumbnailResponse>(url.toString());
    for (const item of payload.data ?? []) {
      const targetId = optionalSafeInteger(item.targetId);
      if (!targetId) continue;
      results.set(targetId, { state: item.state ?? null, imageUrl: item.imageUrl ?? null });
    }
  }
  return results;
}

function normalizeRows(
  assets: CreatorStoreAsset[],
  thumbnails: Map<number, { state: string | null; imageUrl: string | null }>
): MeshRow[] {
  const now = new Date().toISOString();
  return assets.map((item, index) => {
    const assetId = optionalSafeInteger(item.asset?.id);
    const meshId = optionalSafeInteger(item.asset?.meshId);
    const name = item.asset?.name?.trim();
    if (!assetId || !meshId || !name || item.asset?.assetTypeId !== EXPECTED_ASSET_TYPE_ID) {
      throw new Error(`Invalid MeshPart at source rank ${index + 1}`);
    }
    const thumbnail = thumbnails.get(assetId);
    return {
      asset_id: assetId,
      mesh_id: meshId,
      texture_id: optionalSafeInteger(item.asset?.textureId),
      name,
      description: item.asset?.description?.trim() || null,
      creator_id: optionalSafeInteger(item.creator?.userId),
      creator_name: item.creator?.name?.trim() || null,
      creator_verified: typeof item.creator?.verified === "boolean" ? item.creator.verified : null,
      asset_type_id: EXPECTED_ASSET_TYPE_ID,
      purchasable:
        typeof item.creatorStoreProduct?.purchasable === "boolean"
          ? item.creatorStoreProduct.purchasable
          : null,
      vote_count: Number.isInteger(item.voting?.voteCount) ? item.voting!.voteCount! : null,
      upvote_percent: Number.isInteger(item.voting?.upVotePercent) ? item.voting!.upVotePercent! : null,
      source_rank: index + 1,
      thumbnail_url: thumbnail?.imageUrl ?? null,
      thumbnail_state: thumbnail?.state ?? null,
      thumbnail_checked_at: now,
      roblox_created_at: item.asset?.createTime ?? null,
      roblox_updated_at: item.asset?.updateTime ?? null,
      creator_store_url: `https://create.roblox.com/store/asset/${assetId}`,
      status: "active",
      source: SOURCE_NAME,
      raw_payload: item,
      last_seen_at: now,
      verified_at: now
    };
  });
}

async function applyRows(rows: MeshRow[]) {
  const supabase = supabaseAdmin();
  for (let index = 0; index < rows.length; index += 100) {
    const { error } = await supabase
      .from("roblox_mesh_ids")
      .upsert(rows.slice(index, index + 100), { onConflict: "asset_id" });
    if (error) throw error;
  }
  const activeIds = new Set(rows.map((row) => row.asset_id));
  const { data: existingRows, error: existingError } = await supabase
    .from("roblox_mesh_ids")
    .select("asset_id")
    .eq("source", SOURCE_NAME)
    .eq("status", "active");
  if (existingError) throw existingError;
  const staleIds = (existingRows ?? [])
    .map((row) => Number(row.asset_id))
    .filter((assetId) => Number.isSafeInteger(assetId) && !activeIds.has(assetId));
  for (let index = 0; index < staleIds.length; index += 100) {
    const { error } = await supabase
      .from("roblox_mesh_ids")
      .update({ status: "inactive" })
      .in("asset_id", staleIds.slice(index, index + 100));
    if (error) throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (options.apply && !isManagedDevelopmentSupabaseUrl(supabaseUrl) && !options.allowProd) {
    throw new Error("Refusing a write outside managed development without --allow-prod");
  }

  const assets = await loadCreatorStoreMeshes();
  const assetIds = assets.map((item) => optionalSafeInteger(item.asset?.id)).filter((id): id is number => Boolean(id));
  const thumbnails = await loadThumbnails(assetIds);
  const rows = normalizeRows(assets, thumbnails);
  const completed = rows.filter((row) => row.thumbnail_state === "Completed" && row.thumbnail_url).length;
  const textures = rows.filter((row) => row.texture_id).length;

  console.log(
    JSON.stringify(
      {
        mode: options.apply ? "apply" : "dry-run",
        source: SOURCE_NAME,
        rows: rows.length,
        completedThumbnails: completed,
        textureIds: textures,
        first: rows[0] ? { name: rows[0].name, meshId: rows[0].mesh_id } : null
      },
      null,
      2
    )
  );

  if (options.apply) {
    await applyRows(rows);
    console.log(`Upserted ${rows.length} Roblox mesh ID rows.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
