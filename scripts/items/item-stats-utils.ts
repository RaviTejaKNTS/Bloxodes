export const ITEM_STATS_TIERS = ["NEW", "HOT", "WARM", "COLD"] as const;
export type ItemStatsTier = (typeof ITEM_STATS_TIERS)[number];

export type ItemStatsSourceRow = {
  asset_id: number;
  item_type: string | null;
  asset_type_id: number | null;
  name: string | null;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  creator_id: number | null;
  creator_target_id: number | null;
  creator_name: string | null;
  creator_type: string | null;
  creator_has_verified_badge: boolean | null;
  price_robux: number | null;
  price_status: string | null;
  lowest_price_robux: number | null;
  lowest_resale_price_robux: number | null;
  is_for_sale: boolean | null;
  is_limited: boolean | null;
  is_limited_unique: boolean | null;
  remaining: number | null;
  product_id: number | null;
  collectible_item_id: string | number | null;
  favorite_count: number | null;
  has_resellers: boolean | null;
  total_quantity: number | null;
  units_available_for_consumption: number | null;
  quantity_limit_per_user: number | null;
  sale_location_type: string | null;
  off_sale_deadline: string | null;
  item_status: unknown;
  item_restrictions: unknown;
  bundled_items: unknown;
  raw_catalog_json: Record<string, unknown> | null;
  raw_economy_json: Record<string, unknown> | null;
  item_stats_tier: ItemStatsTier | string | null;
  next_item_stats_refresh_at: string | null;
  item_stats_refresh_locked_at: string | null;
  item_stats_refresh_locked_by: string | null;
  item_stats_refresh_attempt_count: number | null;
  last_item_stats_refreshed_at: string | null;
  last_resale_data_fetched_at: string | null;
  last_thumbnail_health_checked_at: string | null;
  thumbnail_http_status: number | null;
  thumbnail_last_error: string | null;
};

export type CatalogItemDetails = Record<string, unknown>;

export type ThumbnailEntry = {
  targetId?: number;
  state?: string;
  imageUrl?: string;
  version?: string;
};

export type ResalePoint = {
  value?: number;
  date?: string;
};

export type ResaleDataResponse = {
  priceDataPoints?: ResalePoint[];
  volumeDataPoints?: ResalePoint[];
  errors?: Array<{ code?: number; message?: string }>;
};

const CATALOG_ITEM_DETAILS_BATCH_API = "https://catalog.roblox.com/v1/catalog/items/details";
const ASSET_THUMBNAILS_API = "https://thumbnails.roblox.com/v1/assets";
const BUNDLE_THUMBNAILS_API = "https://thumbnails.roblox.com/v1/bundles/thumbnails";
const ECONOMY_ASSET_DETAILS_API = (assetId: number) => `https://economy.roblox.com/v2/assets/${assetId}/details`;
const RESALE_DATA_API = (assetId: number) => `https://economy.roblox.com/v1/assets/${assetId}/resale-data`;
const RATE_LIMIT_FALLBACK_MS = Math.max(
  1_000,
  Math.floor(readNumber(process.env.ROBLOX_RATE_LIMIT_FALLBACK_MS, 60_000))
);

let csrfToken: string | null = null;
let lastRequestAt = 0;
let requestGate: Promise<void> = Promise.resolve();

export function resetRobloxRequestStateForTests() {
  csrfToken = null;
  lastRequestAt = 0;
  requestGate = Promise.resolve();
}

export class RobloxRateLimitError extends Error {
  readonly status = 429;
  readonly retryAfterMs: number | null;

  constructor(message: string, retryAfterMs: number | null) {
    super(message);
    this.name = "RobloxRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class RobloxHttpError extends Error {
  readonly status: number | null;
  readonly retryAfterMs: number | null;
  readonly retryable: boolean;

  constructor(message: string, options: { status?: number | null; retryAfterMs?: number | null; retryable?: boolean } = {}) {
    super(message);
    this.name = "RobloxHttpError";
    this.status = options.status ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.retryable = options.retryable ?? false;
  }
}

export type ResaleFetchResult =
  | { kind: "success"; payload: ResaleDataResponse }
  | { kind: "unsupported"; payload: ResaleDataResponse | null; status: 400 | 404 };

export function toBoolean(value: string | undefined, fallback: boolean) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function readNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function itemTypeForRoblox(value: string | null | undefined) {
  return value === "Bundle" ? "Bundle" : "Asset";
}

export function robloxTargetId(row: Pick<ItemStatsSourceRow, "asset_id" | "item_type">) {
  return itemTypeForRoblox(row.item_type) === "Bundle" ? Math.abs(Math.trunc(row.asset_id)) : Math.trunc(row.asset_id);
}

export function hourStart(date = new Date()) {
  const rounded = new Date(date);
  rounded.setUTCMinutes(0, 0, 0);
  return rounded.toISOString();
}

export function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function addHours(value: string, hours: number) {
  return new Date(new Date(value).getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function sleep(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function throttle(minIntervalMs: number) {
  let release: () => void = () => undefined;
  const previous = requestGate;
  requestGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    const waitMs = Math.max(0, lastRequestAt + minIntervalMs - Date.now());
    if (waitMs > 0) await sleep(waitMs);
    lastRequestAt = Date.now();
  } finally {
    release();
  }
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function retryAfterMs(response: Response) {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(header);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : null;
}

function retryDelay(attempt: number, response?: Response | null) {
  const serverDelay = response ? retryAfterMs(response) : null;
  const exponential = Math.min(60_000, 1_500 * 2 ** Math.max(0, attempt));
  const jittered = Math.round(exponential * (0.75 + Math.random() * 0.5));
  // Roblox commonly omits Retry-After on 429 responses even though the
  // catalog quota resets on a longer window. Short exponential retries only
  // burn the remaining attempts inside that same window.
  const rateLimitFallback = response?.status === 429 ? RATE_LIMIT_FALLBACK_MS : 0;
  return Math.max(serverDelay ?? 0, rateLimitFallback, jittered);
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export async function fetchCatalogItemDetailsBatch(
  rows: Pick<ItemStatsSourceRow, "asset_id" | "item_type">[],
  options: { userAgent: string; minRequestMs: number; maxRetries: number }
): Promise<CatalogItemDetails[]> {
  if (!rows.length) return [];

  const body = JSON.stringify({
    items: rows.map((row) => ({
      itemType: itemTypeForRoblox(row.item_type),
      id: robloxTargetId(row)
    }))
  });

  let attempt = 0;
  while (true) {
    await throttle(options.minRequestMs);
    const headers: Record<string, string> = {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": options.userAgent
    };
    if (csrfToken) headers["x-csrf-token"] = csrfToken;

    let response: Response;
    try {
      response = await fetch(CATALOG_ITEM_DETAILS_BATCH_API, { method: "POST", headers, body });
    } catch (error) {
      if (attempt >= options.maxRetries) {
        throw new RobloxHttpError(`Catalog item details network failure: ${error instanceof Error ? error.message : String(error)}`, {
          retryable: true
        });
      }
      await sleep(retryDelay(attempt));
      attempt += 1;
      continue;
    }
    if (response.status === 403) {
      const token = response.headers.get("x-csrf-token");
      if (token) {
        csrfToken = token;
        response = await fetch(CATALOG_ITEM_DETAILS_BATCH_API, {
          method: "POST",
          headers: { ...headers, "x-csrf-token": token },
          body
        });
      }
    }

    if (response.ok) {
      const payload = (await response.json().catch(() => null)) as { data?: CatalogItemDetails[] } | null;
      return Array.isArray(payload?.data) ? payload.data : [];
    }

    const rateLimitRetryMs = response.status === 429 ? retryAfterMs(response) : null;
    if (isRetryableStatus(response.status) && attempt < options.maxRetries) {
      const delay = retryDelay(attempt, response);
      attempt += 1;
      await sleep(delay);
      continue;
    }

    const text = await response.text().catch(() => "");
    if (response.status === 429) {
      throw new RobloxRateLimitError(`Catalog item details rate limited (429): ${text.slice(0, 180)}`, rateLimitRetryMs);
    }
    throw new RobloxHttpError(`Catalog item details failed (${response.status}): ${text.slice(0, 180)}`, {
      status: response.status,
      retryAfterMs: retryAfterMs(response),
      retryable: isRetryableStatus(response.status)
    });
  }
}

export async function fetchAssetEconomyDetails(
  assetId: number,
  options: { userAgent: string; minRequestMs: number; maxRetries: number }
): Promise<Record<string, unknown> | null> {
  let attempt = 0;
  while (true) {
    await throttle(options.minRequestMs);
    let response: Response;
    try {
      response = await fetch(ECONOMY_ASSET_DETAILS_API(assetId), {
        headers: { accept: "application/json", "user-agent": options.userAgent }
      });
    } catch (error) {
      if (attempt >= options.maxRetries) {
        throw new RobloxHttpError(`Economy asset details network failure for ${assetId}: ${error instanceof Error ? error.message : String(error)}`, {
          retryable: true
        });
      }
      await sleep(retryDelay(attempt));
      attempt += 1;
      continue;
    }
    if (response.ok) {
      return (await response.json().catch(() => null)) as Record<string, unknown> | null;
    }
    if (response.status === 404 || response.status === 400) return null;
    if (isRetryableStatus(response.status) && attempt < options.maxRetries) {
      const delay = retryDelay(attempt, response);
      attempt += 1;
      await sleep(delay);
      continue;
    }
    throw new RobloxHttpError(`Economy asset details failed for ${assetId} (${response.status})`, {
      status: response.status,
      retryAfterMs: retryAfterMs(response),
      retryable: isRetryableStatus(response.status)
    });
  }
}

export async function fetchResaleDataResult(
  assetId: number,
  options: { userAgent: string; minRequestMs: number; maxRetries: number }
): Promise<ResaleFetchResult> {
  let attempt = 0;
  while (true) {
    await throttle(options.minRequestMs);
    let response: Response;
    try {
      response = await fetch(RESALE_DATA_API(assetId), {
        headers: { accept: "application/json", "user-agent": options.userAgent }
      });
    } catch (error) {
      if (attempt >= options.maxRetries) {
        throw new RobloxHttpError(`Resale data network failure for ${assetId}: ${error instanceof Error ? error.message : String(error)}`, {
          retryable: true
        });
      }
      await sleep(retryDelay(attempt));
      attempt += 1;
      continue;
    }
    const payload = (await response.json().catch(() => null)) as ResaleDataResponse | null;
    if (response.ok) return { kind: "success", payload: payload ?? {} };
    if (response.status === 400 || response.status === 404) {
      return { kind: "unsupported", payload, status: response.status };
    }
    if (isRetryableStatus(response.status) && attempt < options.maxRetries) {
      const delay = retryDelay(attempt, response);
      attempt += 1;
      await sleep(delay);
      continue;
    }
    throw new RobloxHttpError(`Resale data failed for ${assetId} (${response.status})`, {
      status: response.status,
      retryAfterMs: retryAfterMs(response),
      retryable: isRetryableStatus(response.status)
    });
  }
}

export async function fetchResaleData(
  assetId: number,
  options: { userAgent: string; minRequestMs: number; maxRetries: number }
): Promise<ResaleDataResponse | null> {
  const result = await fetchResaleDataResult(assetId, options);
  return result.payload;
}

async function fetchThumbnailEntries(url: string, options: { userAgent: string; maxRetries: number }): Promise<ThumbnailEntry[]> {
  let attempt = 0;
  while (true) {
    await throttle(0);
    let response: Response;
    try {
      response = await fetch(url, { headers: { accept: "application/json", "user-agent": options.userAgent } });
    } catch (error) {
      if (attempt >= options.maxRetries) {
        throw new RobloxHttpError(`Thumbnail network failure: ${error instanceof Error ? error.message : String(error)}`, {
          retryable: true
        });
      }
      await sleep(retryDelay(attempt));
      attempt += 1;
      continue;
    }
    if (response.ok) {
      const payload = (await response.json().catch(() => null)) as { data?: ThumbnailEntry[] } | null;
      return Array.isArray(payload?.data) ? payload.data : [];
    }
    const rateLimitRetryMs = response.status === 429 ? retryAfterMs(response) : null;
    if (isRetryableStatus(response.status) && attempt < options.maxRetries) {
      const delay = retryDelay(attempt, response);
      attempt += 1;
      await sleep(delay);
      continue;
    }
    if (response.status === 429) {
      throw new RobloxRateLimitError(`Thumbnail request rate limited (429)`, rateLimitRetryMs);
    }
    throw new RobloxHttpError(`Thumbnail request failed (${response.status})`, {
      status: response.status,
      retryAfterMs: retryAfterMs(response),
      retryable: isRetryableStatus(response.status)
    });
  }
}

export async function fetchThumbnails(
  rows: Pick<ItemStatsSourceRow, "asset_id" | "item_type">[],
  options: { userAgent: string; size: string; format: string; maxRetries: number }
): Promise<Map<number, ThumbnailEntry>> {
  const byTarget = new Map<number, number>();
  const assetIds: number[] = [];
  const bundleIds: number[] = [];

  for (const row of rows) {
    const targetId = robloxTargetId(row);
    byTarget.set(targetId, row.asset_id);
    if (itemTypeForRoblox(row.item_type) === "Bundle") {
      bundleIds.push(targetId);
    } else {
      assetIds.push(targetId);
    }
  }

  const requests: Promise<ThumbnailEntry[]>[] = [];
  for (const ids of chunkArray(assetIds, 50)) {
    const params = new URLSearchParams({
      assetIds: ids.join(","),
      size: options.size,
      format: options.format,
      isCircular: "false"
    });
    requests.push(fetchThumbnailEntries(`${ASSET_THUMBNAILS_API}?${params.toString()}`, options));
  }
  for (const ids of chunkArray(bundleIds, 50)) {
    const params = new URLSearchParams({
      bundleIds: ids.join(","),
      size: options.size,
      format: options.format,
      isCircular: "false"
    });
    requests.push(fetchThumbnailEntries(`${BUNDLE_THUMBNAILS_API}?${params.toString()}`, options));
  }

  const mapped = new Map<number, ThumbnailEntry>();
  const batches = await Promise.all(requests);
  for (const entry of batches.flat()) {
    const targetId = normalizeNumber(entry.targetId);
    if (!targetId) continue;
    const assetId = byTarget.get(targetId);
    if (assetId == null) continue;
    mapped.set(assetId, entry);
  }
  return mapped;
}

export function assignItemStatsTier(row: {
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  favorite_count?: number | null;
  lowest_resale_price_robux?: number | null;
  has_resellers?: boolean | null;
  collectible_item_id?: string | number | null;
  is_limited?: boolean | null;
  is_limited_unique?: boolean | null;
  last_item_stats_refreshed_at?: string | null;
  thumbnail_http_status?: number | null;
}): { tier: ItemStatsTier; reason: string; refreshHours: number } {
  if ((row.thumbnail_http_status ?? 0) >= 400) {
    return { tier: "NEW", reason: "thumbnail_http_error", refreshHours: 1 };
  }
  if ((row.favorite_count ?? 0) >= 100_000 || (row.lowest_resale_price_robux ?? 0) >= 10_000) {
    return { tier: "HOT", reason: "high_value_or_favorites", refreshHours: 2 };
  }
  if (row.has_resellers || (row.lowest_resale_price_robux ?? 0) > 0 || row.collectible_item_id || row.is_limited || row.is_limited_unique) {
    return { tier: "HOT", reason: "resale_or_collectible", refreshHours: 2 };
  }
  if ((row.favorite_count ?? 0) >= 10_000) {
    return { tier: "WARM", reason: "moderate_favorites", refreshHours: 12 };
  }
  if (!row.name || !row.category || !row.subcategory || row.favorite_count == null || !row.last_item_stats_refreshed_at) {
    return { tier: "NEW", reason: "missing_or_never_refreshed", refreshHours: 1 };
  }
  return { tier: "COLD", reason: "long_tail", refreshHours: 72 };
}
