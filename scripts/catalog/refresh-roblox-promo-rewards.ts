import "../shared/load-env";

import { createHash } from "node:crypto";

import {
  parseRobloxDenPromoRewards,
  planPromoRewardMissingState,
  planPromoRewardSeenStatus,
  robloxPromoItemUrl,
  ROBLOXDEN_PROMO_SOURCE_URL,
  type ParsedRobloxDenPromoReward,
  type RobloxPromoItemType,
} from "@/lib/robloxden-promo-rewards";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { finishStatsJobRun, startStatsJobRun, type StatsJobRun } from "../shared/stats-job-run";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

const JOB_NAME = "catalog_roblox_promo_rewards_refresh";
const CATALOG_PAGE_CODE = "roblox-promo-codes";
const USER_AGENT = "BloxodesPromoRewardsBot/1.0";
const ASSET_DETAILS_API = "https://economy.roblox.com/v2/assets";
const ASSET_THUMBNAILS_API = "https://thumbnails.roblox.com/v1/assets";
const BUNDLE_DETAILS_API = "https://catalog.roblox.com/v1/bundles";
const BUNDLE_THUMBNAILS_API = "https://thumbnails.roblox.com/v1/bundles/thumbnails";
const SOURCE_MIN_BYTES = 10_000;
const REQUEST_TIMEOUT_MS = 30_000;

function configuredInteger(raw: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

const MAX_RETRIES = configuredInteger(process.env.ROBLOX_PROMO_MAX_RETRIES, 3, 1, 10);
const CONCURRENCY = configuredInteger(process.env.ROBLOX_PROMO_CONCURRENCY, 6, 1, 10);

type CliOptions = {
  apply: boolean;
  allowProd: boolean;
  retireAfterMisses: number;
};

type StoredRewardRow = Record<string, unknown> & {
  source_provider: string;
  source_key: string;
  status: string;
  status_reason: string | null;
  consecutive_misses: number;
  roblox_item_type?: RobloxPromoItemType;
};

type AssetDetail = {
  TargetId?: number;
  AssetId?: number;
  Name?: string;
  AssetTypeId?: number;
  Creator?: {
    Id?: number;
    CreatorTargetId?: number;
    Name?: string;
  };
};

type Thumbnail = {
  targetId?: number;
  state?: string;
  imageUrl?: string | null;
};

type BundleDetail = {
  id?: number;
  name?: string;
  bundleType?: string;
  creator?: {
    id?: number;
    name?: string;
  };
};

type OfficialItemDetail = {
  itemType: RobloxPromoItemType;
  officialName: string | null;
  assetTypeId: number | null;
  creatorId: number | null;
  creatorName: string | null;
  raw: AssetDetail | BundleDetail;
};

type FetchFailure = {
  kind: "transient" | "permanent";
  message: string;
};

type OfficialItemResult =
  | { kind: "success"; detail: OfficialItemDetail }
  | FetchFailure;

type ThumbnailTarget = {
  assetId: number;
  itemType: RobloxPromoItemType;
};

type RefreshSummary = {
  advertised: number;
  parsed: number;
  existing: number;
  inserted: number;
  materiallyUpdated: number;
  observationsOnly: number;
  firstMisses: number;
  retired: number;
  enrichmentFailures: number;
  enrichmentIssues: Array<{
    sourceKey: string;
    assetId: number;
    metadata: string | null;
    thumbnail: string | null;
  }>;
  materialChanges: number;
};

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    apply: false,
    allowProd: false,
    retireAfterMisses: Math.max(2, Number(process.env.ROBLOX_PROMO_RETIRE_AFTER_MISSES ?? "2")),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--allow-prod") options.allowProd = true;
    else if (arg === "--retire-after-misses") {
      const value = Number(argv[++index]);
      if (!Number.isInteger(value) || value < 2) throw new Error("--retire-after-misses must be an integer of at least 2");
      options.retireAfterMisses = value;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: npm run refresh:promo-rewards -- [--apply] [--allow-prod] [--retire-after-misses N]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!Number.isInteger(options.retireAfterMisses) || options.retireAfterMisses < 2) {
    throw new Error("ROBLOX_PROMO_RETIRE_AFTER_MISSES must be an integer of at least 2");
  }
  return options;
}

function validateEnvironment(options: CliOptions) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE");
  }
  if (options.apply && !options.allowProd && !isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL)) {
    throw new Error("Refusing to update outside managed development without --allow-prod");
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function fetchWithRetry(url: string, accept: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept, "user-agent": USER_AGENT },
        redirect: "follow",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) return response;
      if (!isTransientStatus(response.status) || attempt === MAX_RETRIES - 1) {
        throw new HttpError(`Request returned HTTP ${response.status}: ${url}`, response.status);
      }
      lastError = new HttpError(`Request returned HTTP ${response.status}: ${url}`, response.status);
    } catch (error) {
      if (error instanceof HttpError && !isTransientStatus(error.status)) throw error;
      lastError = error;
      if (attempt === MAX_RETRIES - 1) throw error;
    }
    await sleep(Math.min(8_000, 500 * 2 ** attempt));
  }
  throw lastError;
}

async function fetchSourceHtml(): Promise<string> {
  const response = await fetchWithRetry(ROBLOXDEN_PROMO_SOURCE_URL, "text/html,application/xhtml+xml");
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/html")) {
    throw new Error(`RobloxDen returned an unexpected content type: ${contentType || "missing"}`);
  }
  const html = await response.text();
  if (Buffer.byteLength(html, "utf8") < SOURCE_MIN_BYTES) {
    throw new Error(`RobloxDen response body was unexpectedly small (${Buffer.byteLength(html, "utf8")} bytes)`);
  }
  if (!/<body[\s>]/i.test(html) || !/<\/html>/i.test(html)) {
    throw new Error("RobloxDen response body is not a complete HTML document");
  }
  return html;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failureKind(error: unknown): FetchFailure["kind"] {
  if (error instanceof HttpError && !isTransientStatus(error.status)) return "permanent";
  return "transient";
}

async function fetchAssetMetadata(assetId: number): Promise<OfficialItemResult> {
  try {
    const response = await fetchWithRetry(`${ASSET_DETAILS_API}/${assetId}/details`, "application/json");
    const detail = (await response.json()) as AssetDetail;
    if (detail.AssetId !== assetId && detail.TargetId !== assetId) {
      return { kind: "transient", message: `Roblox returned mismatched asset metadata for ${assetId}` };
    }
    const creator = detail.Creator;
    return {
      kind: "success",
      detail: {
        itemType: "Asset",
        officialName: asNullableText(detail.Name),
        assetTypeId: asNullableNumber(detail.AssetTypeId),
        creatorId: asNullableNumber(creator?.CreatorTargetId) ?? asNullableNumber(creator?.Id),
        creatorName: asNullableText(creator?.Name),
        raw: detail,
      },
    };
  } catch (error) {
    return { kind: failureKind(error), message: errorMessage(error) };
  }
}

async function fetchBundleMetadata(assetId: number): Promise<OfficialItemResult> {
  try {
    const response = await fetchWithRetry(`${BUNDLE_DETAILS_API}/${assetId}/details`, "application/json");
    const detail = (await response.json()) as BundleDetail;
    if (detail.id !== assetId) {
      return { kind: "transient", message: `Roblox returned mismatched bundle metadata for ${assetId}` };
    }
    return {
      kind: "success",
      detail: {
        itemType: "Bundle",
        officialName: asNullableText(detail.name),
        assetTypeId: null,
        creatorId: asNullableNumber(detail.creator?.id),
        creatorName: asNullableText(detail.creator?.name),
        raw: detail,
      },
    };
  } catch (error) {
    return { kind: failureKind(error), message: errorMessage(error) };
  }
}

async function fetchOfficialItemMetadata(
  assetId: number,
  preferredType: RobloxPromoItemType,
): Promise<OfficialItemResult> {
  const primary = preferredType === "Bundle" ? fetchBundleMetadata : fetchAssetMetadata;
  const fallback = preferredType === "Bundle" ? fetchAssetMetadata : fetchBundleMetadata;
  const primaryResult = await primary(assetId);
  if (primaryResult.kind !== "permanent") return primaryResult;
  const fallbackResult = await fallback(assetId);
  if (fallbackResult.kind === "permanent") {
    return {
      kind: "permanent",
      message: `${primaryResult.message}; alternate Roblox item lookup also failed: ${fallbackResult.message}`,
    };
  }
  return fallbackResult;
}

async function mapWithConcurrency<T, R>(values: T[], limit: number, worker: (value: T) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(values.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      output[index] = await worker(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, run));
  return output;
}

async function fetchOfficialItemDetails(
  items: ParsedRobloxDenPromoReward[],
  storedByKey: Map<string, StoredRewardRow>,
): Promise<Map<number, OfficialItemResult>> {
  const results = await mapWithConcurrency(items, CONCURRENCY, async (item) => ({
    assetId: item.assetId,
    result: await fetchOfficialItemMetadata(
      item.assetId,
      storedByKey.get(item.sourceKey)?.roblox_item_type === "Bundle" ? "Bundle" : "Asset",
    ),
  }));
  return new Map(results.map(({ assetId, result }) => [assetId, result]));
}

async function fetchOfficialThumbnails(
  targets: ThumbnailTarget[],
): Promise<{ thumbnails: Map<number, Thumbnail>; failures: Map<number, FetchFailure> }> {
  const thumbnails = new Map<number, Thumbnail>();
  const failures = new Map<number, FetchFailure>();
  const chunks: ThumbnailTarget[][] = [];
  for (const itemType of ["Asset", "Bundle"] as const) {
    const typedTargets = targets.filter((target) => target.itemType === itemType);
    for (let index = 0; index < typedTargets.length; index += 100) chunks.push(typedTargets.slice(index, index + 100));
  }

  await mapWithConcurrency(chunks, 2, async (chunk) => {
    const itemType = chunk[0].itemType;
    const url = new URL(itemType === "Bundle" ? BUNDLE_THUMBNAILS_API : ASSET_THUMBNAILS_API);
    url.searchParams.set(itemType === "Bundle" ? "bundleIds" : "assetIds", chunk.map((item) => item.assetId).join(","));
    url.searchParams.set("size", "420x420");
    url.searchParams.set("format", "Png");
    url.searchParams.set("isCircular", "false");
    try {
      const response = await fetchWithRetry(url.toString(), "application/json");
      const payload = (await response.json()) as { data?: Thumbnail[] };
      for (const thumbnail of payload.data ?? []) {
        const targetId = Number(thumbnail.targetId);
        if (Number.isSafeInteger(targetId) && targetId > 0) thumbnails.set(targetId, thumbnail);
      }
      for (const item of chunk) {
        if (!thumbnails.has(item.assetId)) {
          failures.set(item.assetId, {
            kind: "transient",
            message: `Roblox returned no thumbnail record for ${item.assetId}`,
          });
        }
      }
    } catch (error) {
      const failure = { kind: failureKind(error), message: errorMessage(error) } satisfies FetchFailure;
      for (const item of chunk) failures.set(item.assetId, failure);
    }
  });
  return { thumbnails, failures };
}

async function loadStoredRows(): Promise<StoredRewardRow[]> {
  const sb = supabaseAdmin();
  const output: StoredRewardRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await sb
      .from("roblox_promo_rewards")
      .select("*")
      .eq("source_provider", "robloxden")
      .order("source_key")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Failed to load stored promo rewards: ${error.message}`);
    const rows = (data ?? []) as unknown as StoredRewardRow[];
    output.push(...rows);
    if (rows.length < pageSize) break;
  }
  return output;
}

function sourceHash(item: ParsedRobloxDenPromoReward): string {
  return createHash("sha256").update(JSON.stringify(sourceEvidence(item))).digest("hex");
}

function sourceEvidence(item: ParsedRobloxDenPromoReward) {
  return {
    source_key: item.sourceKey,
    source_url: item.sourceUrl,
    asset_id: item.assetId,
    reward_name: item.rewardName,
    source_type: item.sourceType,
    claim_type: item.claimType,
    promo_code: item.promoCode,
    event_name: item.eventName,
    requirement_text: item.requirementText,
    destination_url: item.destinationUrl,
    sort_order: item.sortOrder,
  };
}

function asNullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function prepareSeenRow(
  item: ParsedRobloxDenPromoReward,
  existing: StoredRewardRow | undefined,
  assetResult: OfficialItemResult,
  thumbnail: Thumbnail | undefined,
  thumbnailFailure: FetchFailure | undefined,
  checkedAt: string,
): Record<string, unknown> {
  const restored = planPromoRewardSeenStatus(existing?.status, existing?.status_reason, assetResult.kind);
  const existingItemType: RobloxPromoItemType = existing?.roblox_item_type === "Bundle" ? "Bundle" : "Asset";
  const row: Record<string, unknown> = {
    source_provider: "robloxden",
    source_key: item.sourceKey,
    source_list_url: ROBLOXDEN_PROMO_SOURCE_URL,
    source_url: item.sourceUrl,
    asset_id: item.assetId,
    roblox_item_type: existingItemType,
    reward_name: item.rewardName,
    source_type: item.sourceType,
    claim_type: item.claimType,
    promo_code: item.promoCode,
    promo_code_normalized: item.promoCodeNormalized,
    event_name: item.eventName,
    requirement_text: item.requirementText,
    claim_instructions: item.claimInstructions,
    destination_url: item.destinationUrl,
    roblox_item_url: robloxPromoItemUrl(item.assetId, existingItemType),
    official_name: existing?.official_name ?? null,
    asset_type_id: existing?.asset_type_id ?? null,
    creator_id: existing?.creator_id ?? null,
    creator_name: existing?.creator_name ?? null,
    thumbnail_url: existing?.thumbnail_url ?? null,
    thumbnail_state: existing?.thumbnail_state ?? null,
    thumbnail_checked_at: existing?.thumbnail_checked_at ?? null,
    status: restored.status,
    status_reason: restored.statusReason,
    consecutive_misses: 0,
    sort_order: item.sortOrder,
    source_hash: sourceHash(item),
    last_seen_at: checkedAt,
    last_checked_at: checkedAt,
    verified_at: existing?.verified_at ?? null,
    retired_at: null,
    raw_source_json: sourceEvidence(item),
    raw_roblox_json: existing?.raw_roblox_json ?? {},
  };

  if (assetResult.kind === "success") {
    row.roblox_item_type = assetResult.detail.itemType;
    row.roblox_item_url = robloxPromoItemUrl(item.assetId, assetResult.detail.itemType);
    row.official_name = assetResult.detail.officialName ?? existing?.official_name ?? null;
    row.asset_type_id =
      assetResult.detail.itemType === "Bundle"
        ? null
        : assetResult.detail.assetTypeId ?? existing?.asset_type_id ?? null;
    row.creator_id = assetResult.detail.creatorId ?? existing?.creator_id ?? null;
    row.creator_name = assetResult.detail.creatorName ?? existing?.creator_name ?? null;
    row.verified_at = checkedAt;
    row.raw_roblox_json = assetResult.detail.raw;
  } else if (assetResult.kind === "transient" && !existing) {
    row.status_reason = "official_metadata_temporarily_unavailable";
  }

  if (thumbnail) {
    row.thumbnail_url = asNullableText(thumbnail.imageUrl) ?? existing?.thumbnail_url ?? null;
    row.thumbnail_state = asNullableText(thumbnail.state) ?? "Unknown";
    row.thumbnail_checked_at = checkedAt;
  } else if (!existing && thumbnailFailure) {
    row.thumbnail_state = "Unavailable";
  }
  return row;
}

const MATERIAL_FIELDS = [
  "asset_id",
  "roblox_item_type",
  "reward_name",
  "source_type",
  "claim_type",
  "promo_code",
  "promo_code_normalized",
  "event_name",
  "requirement_text",
  "claim_instructions",
  "destination_url",
  "roblox_item_url",
  "official_name",
  "asset_type_id",
  "creator_id",
  "creator_name",
  "thumbnail_url",
  "thumbnail_state",
  "status",
  "status_reason",
  "sort_order",
  "source_hash",
] as const;

function materialSignature(row: Record<string, unknown>): string {
  return JSON.stringify(Object.fromEntries(MATERIAL_FIELDS.map((field) => [field, row[field] ?? null])));
}

async function applyRefreshTransaction(
  seenRows: Record<string, unknown>[],
  checkedAt: string,
  retireAfterMisses: number,
  touchCatalog: boolean,
): Promise<{ seenCount: number; missingUpdated: number; retired: number; catalogTouched: number }> {
  const { data, error } = await supabaseAdmin().rpc("refresh_roblox_promo_rewards", {
    p_seen_rows: seenRows,
    p_checked_at: checkedAt,
    p_retire_after_misses: retireAfterMisses,
    p_touch_catalog: touchCatalog,
  });
  if (error) throw new Error(`Failed to apply the atomic promo reward refresh: ${error.message}`);
  const result = data as Record<string, unknown> | null;
  return {
    seenCount: Number(result?.seen_count ?? 0),
    missingUpdated: Number(result?.missing_updated ?? 0),
    retired: Number(result?.retired ?? 0),
    catalogTouched: Number(result?.catalog_touched ?? 0),
  };
}

async function runRefresh(options: CliOptions): Promise<RefreshSummary> {
  const html = await fetchSourceHtml();
  const parsed = parseRobloxDenPromoRewards(html);
  console.log(`Validated RobloxDen source: advertised ${parsed.advertisedCount}, parsed ${parsed.items.length}.`);

  const storedRows = await loadStoredRows();
  const storedByKey = new Map(storedRows.map((row) => [row.source_key, row]));
  const checkedAt = new Date().toISOString();
  const assetResults = await fetchOfficialItemDetails(parsed.items, storedByKey);
  const thumbnailTargets = parsed.items.map((item): ThumbnailTarget => {
    const result = assetResults.get(item.assetId);
    const itemType =
      result?.kind === "success"
        ? result.detail.itemType
        : storedByKey.get(item.sourceKey)?.roblox_item_type === "Bundle"
          ? "Bundle"
          : "Asset";
    return { assetId: item.assetId, itemType };
  });
  const thumbnailResults = await fetchOfficialThumbnails(thumbnailTargets);

  const seenRows: Record<string, unknown>[] = [];
  let inserted = 0;
  let materiallyUpdated = 0;
  let observationsOnly = 0;
  let enrichmentFailures = 0;
  const enrichmentIssues: RefreshSummary["enrichmentIssues"] = [];
  for (const item of parsed.items) {
    const existing = storedByKey.get(item.sourceKey);
    const assetResult = assetResults.get(item.assetId) ?? {
      kind: "transient" as const,
      message: "Official asset enrichment produced no result",
    };
    const thumbnailFailure = thumbnailResults.failures.get(item.assetId);
    if (assetResult.kind !== "success" || thumbnailFailure) {
      enrichmentFailures += 1;
      enrichmentIssues.push({
        sourceKey: item.sourceKey,
        assetId: item.assetId,
        metadata: assetResult.kind === "success" ? null : assetResult.message,
        thumbnail: thumbnailFailure?.message ?? null,
      });
    }
    const row = prepareSeenRow(
      item,
      existing,
      assetResult,
      thumbnailResults.thumbnails.get(item.assetId),
      thumbnailFailure,
      checkedAt,
    );
    seenRows.push(row);
    if (!existing) inserted += 1;
    else if (materialSignature(existing) !== materialSignature(row)) materiallyUpdated += 1;
    else observationsOnly += 1;
  }

  const seenKeys = new Set(parsed.items.map((item) => item.sourceKey));
  let firstMisses = 0;
  let retired = 0;
  const missingCount = storedRows.filter((row) => !seenKeys.has(row.source_key)).length;
  for (const row of storedRows) {
    if (seenKeys.has(row.source_key)) continue;
    const plan = planPromoRewardMissingState(row.status, Number(row.consecutive_misses ?? 0), options.retireAfterMisses);
    if (plan.action === "retire") retired += 1;
    else if (plan.action === "increment") firstMisses += 1;
  }

  const materialChanges = inserted + materiallyUpdated + retired;
  if (options.apply) {
    const applied = await applyRefreshTransaction(
      seenRows,
      checkedAt,
      options.retireAfterMisses,
      materialChanges > 0,
    );
    retired = applied.retired;
    firstMisses = applied.missingUpdated - applied.retired;
    if (applied.seenCount !== seenRows.length) {
      throw new Error(`Atomic refresh reported ${applied.seenCount} seen rows; expected ${seenRows.length}`);
    }
    if (materialChanges > 0 && applied.catalogTouched === 0) {
      console.warn(`Catalog page ${CATALOG_PAGE_CODE} was not found; its timestamp was not updated.`);
    }
  }

  const summary = {
    advertised: parsed.advertisedCount,
    parsed: parsed.items.length,
    existing: storedRows.length,
    inserted,
    materiallyUpdated,
    observationsOnly,
    firstMisses,
    retired,
    enrichmentFailures,
    enrichmentIssues,
    materialChanges,
  };
  console.log(JSON.stringify({ ...summary, missing: missingCount, apply: options.apply }, null, 2));
  if (!options.apply) console.log("Dry run only. Pass --apply to write; targets outside managed development also require --allow-prod.");
  return summary;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  validateEnvironment(options);
  let auditRun: StatsJobRun | null = null;
  if (options.apply) {
    auditRun = await startStatsJobRun({
      jobName: JOB_NAME,
      metadata: {
        source_url: ROBLOXDEN_PROMO_SOURCE_URL,
        retire_after_misses: options.retireAfterMisses,
      },
    });
  }

  try {
    const summary = await runRefresh(options);
    if (auditRun) {
      await finishStatsJobRun(auditRun, {
        status: summary.enrichmentFailures > 0 ? "partial" : "success",
        rowsClaimed: summary.parsed,
        rowsSucceeded: summary.parsed - summary.enrichmentFailures,
        rowsFailed: summary.enrichmentFailures,
        metadata: summary,
      });
    }
  } catch (error) {
    if (auditRun) await finishStatsJobRun(auditRun, { status: "failed", error });
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
