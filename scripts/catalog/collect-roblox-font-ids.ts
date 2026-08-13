import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

const CREATOR_STORE_API = "https://apis.roblox.com/toolbox-service/v2/assets:search";
const ASSET_DELIVERY_API = "https://assetdelivery.roblox.com/v1/asset";
const THUMBNAIL_API = "https://thumbnails.roblox.com/v1/assets";
const SOURCE_NAME = "roblox_creator_store_font_family";
const EXPECTED_ASSET_TYPE_ID = 73;
const REQUEST_TIMEOUT_MS = 30_000;
const CONCURRENCY = 8;

type CliOptions = {
  apply: boolean;
  allowProd: boolean;
};

type FontFace = {
  name: string;
  weight: number;
  style: string;
  assetId: number;
};

type CreatorStoreAsset = {
  voting?: {
    voteCount?: number;
    upVotePercent?: number;
  };
  creator?: {
    userId?: number;
    name?: string;
    verified?: boolean;
  };
  creatorStoreProduct?: {
    purchasable?: boolean;
  };
  asset?: {
    id?: number;
    name?: string;
    description?: string;
    assetTypeId?: number;
    createTime?: string;
    updateTime?: string;
  };
};

type CreatorStoreResponse = {
  creatorStoreAssets?: CreatorStoreAsset[];
  totalResults?: number;
};

type FontManifest = {
  name?: string;
  faces?: Array<{
    name?: string;
    weight?: number;
    style?: string;
    assetId?: string;
  }>;
};

type ThumbnailResponse = {
  data?: Array<{
    targetId?: number;
    state?: string;
    imageUrl?: string | null;
  }>;
};

type FontRow = {
  asset_id: number;
  name: string;
  description: string | null;
  native_styles: string[];
  faces: FontFace[];
  designer: string | null;
  font_version: string | null;
  license_name: string | null;
  license_url: string | null;
  creator_id: number | null;
  creator_name: string | null;
  creator_verified: boolean | null;
  asset_type_id: number;
  purchasable: boolean | null;
  vote_count: number | null;
  upvote_percent: number | null;
  thumbnail_url: string | null;
  thumbnail_state: string | null;
  thumbnail_checked_at: string;
  roblox_created_at: string | null;
  roblox_updated_at: string | null;
  creator_store_url: string;
  status: "active";
  source: string;
  raw_payload: Record<string, unknown>;
  last_seen_at: string;
  verified_at: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { apply: false, allowProd: false };
  for (const arg of argv) {
    if (arg === "--apply") options.apply = true;
    else if (arg === "--allow-prod") options.allowProd = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run collect:font-ids -- [--apply] [--allow-prod]");
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "BloxodesFontIdsBot/1.0"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return (await response.json()) as T;
}

async function mapWithConcurrency<T, R>(values: T[], worker: (value: T) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(values.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      output[index] = await worker(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, values.length) }, run));
  return output;
}

function normalizedDescription(value: string | undefined): string | null {
  const text = value?.replace(/\r\n/g, "\n").trim();
  return text || null;
}

function firstLineValue(description: string | null, label: string): string | null {
  if (!description) return null;
  const match = description.match(new RegExp(`^${label}:[ \\t]*([^\\n]*)$`, "im"));
  return match?.[1]?.trim() || null;
}

function parseStyles(description: string | null): string[] {
  if (!description) return [];
  const match = description.match(/^(?:Native|Available) styles:\s*\n([^\n]+)/im);
  if (!match?.[1]) return [];
  return Array.from(
    new Set(
      match[1]
        .split(",")
        .map((style) => style.trim())
        .filter(Boolean)
    )
  );
}

function parseLicense(description: string | null): { name: string | null; url: string | null } {
  if (!description) return { name: null, url: null };
  if (/SIL Open Font License/i.test(description)) {
    return {
      name: "SIL Open Font License 1.1",
      url: description.match(/https?:\/\/[^\s)]+(?:OFL|ofl)[^\s)]*/i)?.[0] ?? "https://openfontlicense.org"
    };
  }
  if (/Apache License/i.test(description)) {
    return {
      name: "Apache License 2.0",
      url: description.match(/https?:\/\/[^\s)]+apache[^\s)]*/i)?.[0] ?? "https://www.apache.org/licenses/LICENSE-2.0"
    };
  }
  if (/License terms:/i.test(description)) {
    const afterLabel = description.split(/License terms:/i)[1] ?? "";
    return {
      name: "Roblox font license",
      url: afterLabel.match(/https?:\/\/[^\s)]+/i)?.[0] ?? null
    };
  }
  return { name: null, url: null };
}

function parseFaceAssetId(value: string | undefined): number | null {
  const match = value?.match(/(\d+)$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function normalizeFaces(manifest: FontManifest): FontFace[] {
  return (manifest.faces ?? []).flatMap((face) => {
    const assetId = parseFaceAssetId(face.assetId);
    const name = face.name?.trim();
    const weight = Number(face.weight);
    const style = face.style?.trim().toLowerCase();
    if (!assetId || !name || !Number.isInteger(weight) || !style) return [];
    return [{ name, weight, style, assetId }];
  });
}

async function loadCreatorStoreFonts(): Promise<{ assets: CreatorStoreAsset[]; totalResults: number }> {
  const url = new URL(CREATOR_STORE_API);
  url.searchParams.set("searchCategoryType", "FontFamily");
  url.searchParams.set("maxPageSize", "100");
  url.searchParams.set("sortType", "1");
  url.searchParams.set("sortOrder", "2");
  url.searchParams.set("searchView", "Full");
  const payload = await fetchJson<CreatorStoreResponse>(url.toString());
  const assets = payload.creatorStoreAssets ?? [];
  const totalResults = Number(payload.totalResults ?? assets.length);
  if (assets.length < 50 || assets.length !== totalResults) {
    throw new Error(`Incomplete FontFamily response: received ${assets.length} of ${totalResults}`);
  }
  return { assets, totalResults };
}

async function loadManifests(assetIds: number[]): Promise<Map<number, FontManifest>> {
  const entries = await mapWithConcurrency(assetIds, async (assetId) => {
    try {
      const manifest = await fetchJson<FontManifest>(`${ASSET_DELIVERY_API}?id=${assetId}`);
      return [assetId, manifest] as const;
    } catch (error) {
      console.warn(`Font manifest ${assetId} could not be read: ${error instanceof Error ? error.message : error}`);
      return [assetId, {}] as const;
    }
  });
  return new Map(entries);
}

async function loadThumbnails(assetIds: number[]) {
  const checkedAt = new Date().toISOString();
  const results = new Map<number, { state: string | null; imageUrl: string | null }>();
  for (let index = 0; index < assetIds.length; index += 50) {
    const url = new URL(THUMBNAIL_API);
    url.searchParams.set("assetIds", assetIds.slice(index, index + 50).join(","));
    url.searchParams.set("returnPolicy", "PlaceHolder");
    url.searchParams.set("size", "1200x80");
    url.searchParams.set("format", "Webp");
    url.searchParams.set("isCircular", "false");
    const payload = await fetchJson<ThumbnailResponse>(url.toString());
    for (const item of payload.data ?? []) {
      if (!Number.isSafeInteger(item.targetId)) continue;
      results.set(item.targetId as number, {
        state: item.state?.trim() || null,
        imageUrl: item.imageUrl?.trim() || null
      });
    }
  }
  return { checkedAt, results };
}

async function collectRows(): Promise<{ rows: FontRow[]; totalResults: number }> {
  const { assets, totalResults } = await loadCreatorStoreFonts();
  const assetIds = assets.map((entry) => Number(entry.asset?.id)).filter(Number.isSafeInteger);
  if (new Set(assetIds).size !== totalResults) {
    throw new Error(`FontFamily response did not contain ${totalResults} unique asset IDs`);
  }

  const [manifests, thumbnails] = await Promise.all([loadManifests(assetIds), loadThumbnails(assetIds)]);
  const now = new Date().toISOString();
  const rows = assets.map((entry): FontRow => {
    const assetId = Number(entry.asset?.id);
    const name = entry.asset?.name?.trim();
    const assetTypeId = Number(entry.asset?.assetTypeId);
    if (!Number.isSafeInteger(assetId) || !name || assetTypeId !== EXPECTED_ASSET_TYPE_ID) {
      throw new Error(`Invalid FontFamily row: ${JSON.stringify(entry.asset ?? {})}`);
    }
    const description = normalizedDescription(entry.asset?.description);
    const manifest = manifests.get(assetId) ?? {};
    const faces = normalizeFaces(manifest);
    const descriptionStyles = parseStyles(description);
    const nativeStyles = faces.length ? Array.from(new Set(faces.map((face) => face.name))) : descriptionStyles;
    if (!nativeStyles.length) throw new Error(`Font ${assetId} (${name}) has no supported styles`);
    const thumbnail = thumbnails.results.get(assetId) ?? { state: null, imageUrl: null };
    const license = parseLicense(description);

    return {
      asset_id: assetId,
      name,
      description,
      native_styles: nativeStyles,
      faces,
      designer: firstLineValue(description, "Designer"),
      font_version: firstLineValue(description, "Version"),
      license_name: license.name,
      license_url: license.url,
      creator_id: Number.isSafeInteger(entry.creator?.userId) ? (entry.creator?.userId as number) : null,
      creator_name: entry.creator?.name?.trim() || null,
      creator_verified: typeof entry.creator?.verified === "boolean" ? entry.creator.verified : null,
      asset_type_id: assetTypeId,
      purchasable:
        typeof entry.creatorStoreProduct?.purchasable === "boolean" ? entry.creatorStoreProduct.purchasable : null,
      vote_count: Number.isInteger(entry.voting?.voteCount) ? (entry.voting?.voteCount as number) : null,
      upvote_percent: Number.isInteger(entry.voting?.upVotePercent) ? (entry.voting?.upVotePercent as number) : null,
      thumbnail_url: thumbnail.imageUrl,
      thumbnail_state: thumbnail.state,
      thumbnail_checked_at: thumbnails.checkedAt,
      roblox_created_at: entry.asset?.createTime ?? null,
      roblox_updated_at: entry.asset?.updateTime ?? null,
      creator_store_url: `https://create.roblox.com/store/asset/${assetId}`,
      status: "active",
      source: SOURCE_NAME,
      raw_payload: { creatorStore: entry, manifest },
      last_seen_at: now,
      verified_at: now
    };
  });

  return { rows, totalResults };
}

async function applyRows(rows: FontRow[]) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE");
  }
  const sb = supabaseAdmin();
  for (let index = 0; index < rows.length; index += 50) {
    const { error } = await sb.from("roblox_font_ids").upsert(rows.slice(index, index + 50), { onConflict: "asset_id" });
    if (error) throw error;
  }

  const { data: existing, error: existingError } = await sb.from("roblox_font_ids").select("asset_id").eq("status", "active");
  if (existingError) throw existingError;
  const seen = new Set(rows.map((row) => row.asset_id));
  const missing = (existing ?? [])
    .map((row) => Number((row as { asset_id?: number }).asset_id))
    .filter((assetId) => Number.isSafeInteger(assetId) && !seen.has(assetId));
  if (missing.length) {
    const { error } = await sb.from("roblox_font_ids").update({ status: "inactive" }).in("asset_id", missing);
    if (error) throw error;
  }
  return missing.length;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.apply && !options.allowProd && !isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL)) {
    throw new Error("Refusing to update outside managed development without --allow-prod");
  }

  const { rows, totalResults } = await collectRows();
  const completedThumbnails = rows.filter(
    (row) => row.thumbnail_state === "Completed" && Boolean(row.thumbnail_url)
  ).length;
  const faceCount = rows.reduce((total, row) => total + row.faces.length, 0);
  console.log(`Collected ${rows.length}/${totalResults} official Roblox FontFamily assets.`);
  console.log(`Preview thumbnails: ${completedThumbnails}/${rows.length}; font faces: ${faceCount}.`);

  if (!options.apply) {
    console.log("Dry run only. Pass --apply to upsert the rows.");
    return;
  }

  const retired = await applyRows(rows);
  console.log(`Upserted ${rows.length} font rows; marked ${retired} missing rows inactive.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
