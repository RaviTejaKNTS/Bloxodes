import "../shared/load-env";

import { classifyFreeItemEligibility, type FreeItemEligibilityInput } from "@/lib/free-items-eligibility";
import { supabaseAdmin } from "@/lib/supabase-admin";

const CATEGORIES_API = "https://catalog.roblox.com/v1/categories";
const SEARCH_API = "https://catalog.roblox.com/v1/search/items/details";
const ASSET_DETAILS_API = "https://economy.roblox.com/v2/assets";
const BUNDLE_DETAILS_API = "https://catalog.roblox.com/v1/bundles";
const ASSET_THUMBNAILS_API = "https://thumbnails.roblox.com/v1/assets";
const BUNDLE_THUMBNAILS_API = "https://thumbnails.roblox.com/v1/bundles/thumbnails";
const USER_AGENT = "BloxodesCatalogBot/1.0";
const SUPPORTED_CATEGORIES = new Set(["Accessories", "Body", "Clothing", "AvatarAnimations"]);
const LIMIT = 30;
const THUMBNAIL_SIZE = "420x420";
const THUMBNAIL_FORMAT = "Png";
const REQUEST_DELAY_MS = Math.max(100, Number(process.env.ROBLOX_FREE_ITEMS_DELAY_MS ?? "650"));
const MAX_RETRIES = Math.max(1, Number(process.env.ROBLOX_FREE_ITEMS_MAX_RETRIES ?? "6"));

type CliOptions = {
  apply: boolean;
  allowProd: boolean;
  maxPages: number;
  category: string | null;
  includeStoredCandidates: boolean;
  includePreviouslyVerifiedCandidates: boolean;
  includeLiveSearch: boolean;
};

type CatalogCategory = {
  category?: string;
  assetTypeIds?: number[];
  bundleTypeIds?: number[];
  subcategories?: Array<{
    subcategory?: string;
    name?: string;
    assetTypeIds?: number[];
    bundleTypeIds?: number[];
  }>;
};

type SearchItem = {
  id?: number;
  itemType?: string;
  assetType?: number;
  bundleType?: number;
  name?: string;
  description?: string;
  price?: number;
  priceStatus?: string;
  lowestPrice?: number;
  lowestResalePrice?: number;
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
  creatorTargetId?: number;
  creatorName?: string;
  creatorType?: string;
  creatorHasVerifiedBadge?: boolean;
  productId?: number;
  collectibleItemId?: string | number;
};

type SearchResponse = {
  data?: SearchItem[];
  nextPageCursor?: string | null;
};

type Candidate = {
  externalId: number;
  internalId: number;
  itemType: "Asset" | "Bundle";
  category: string;
  subcategory: string;
  search: SearchItem;
};

type StoredCandidateRow = {
  asset_id: number;
  item_type?: string | null;
  asset_type_id?: number | null;
  category?: string | null;
  subcategory?: string | null;
  name?: string | null;
  description?: string | null;
  price_robux?: number | null;
  price_status?: string | null;
  lowest_price_robux?: number | null;
  lowest_resale_price_robux?: number | null;
  favorite_count?: number | null;
  has_resellers?: boolean | null;
  total_quantity?: number | null;
  units_available_for_consumption?: number | null;
  quantity_limit_per_user?: number | null;
  sale_location_type?: string | null;
  off_sale_deadline?: string | null;
  item_status?: unknown;
  item_restrictions?: unknown;
  bundled_items?: unknown;
  creator_target_id?: number | null;
  creator_name?: string | null;
  creator_type?: string | null;
  creator_has_verified_badge?: boolean | null;
  product_id?: number | null;
  collectible_item_id?: string | null;
};

type AssetDetail = {
  AssetId?: number;
  AssetTypeId?: number;
  Name?: string;
  Description?: string;
  PriceInRobux?: number;
  IsForSale?: boolean;
  IsLimited?: boolean;
  IsLimitedUnique?: boolean;
  Remaining?: number;
  ProductId?: number;
  CollectibleItemId?: string;
  Creator?: {
    Id?: number;
    CreatorTargetId?: number;
    Name?: string;
    CreatorType?: string;
    HasVerifiedBadge?: boolean;
  };
  SaleLocation?: { SaleLocationType?: number; UniverseIds?: number[] };
  CollectiblesItemDetails?: {
    CollectibleLowestResalePrice?: number | null;
    CollectibleQuantityLimitPerUser?: number | null;
    IsForSale?: boolean;
    TotalQuantity?: number | null;
    IsLimited?: boolean;
  };
};

type BundleDetail = {
  id?: number;
  name?: string;
  description?: string;
  bundleType?: string;
  creator?: { id?: number; name?: string; type?: string; hasVerifiedBadge?: boolean };
  product?: { id?: number; isForSale?: boolean; priceInRobux?: number; isFree?: boolean };
  collectibleItemDetail?: {
    collectibleItemId?: string;
    price?: number;
    lowestPrice?: number;
    lowestResalePrice?: number;
    totalQuantity?: number;
    unitsAvailable?: number;
    quantityLimitPerUser?: number;
    hasResellers?: boolean;
    saleStatus?: string;
    collectibleItemType?: string;
    offSaleDeadline?: string;
    saleLocation?: { saleLocationType?: string; saleLocationTypeId?: number };
  };
  items?: unknown;
  itemRestrictions?: unknown;
};

type ThumbnailRow = {
  targetId?: number;
  imageUrl?: string;
  state?: string;
  version?: string;
};

type PreparedRow = Record<string, unknown> & {
  asset_id: number;
  item_type: "Asset" | "Bundle";
  free_claimability: "direct" | "experience" | "unavailable";
  free_restriction_reason: string | null;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    apply: false,
    allowProd: false,
    maxPages: 0,
    category: null,
    includeStoredCandidates: true,
    includePreviouslyVerifiedCandidates: true,
    includeLiveSearch: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--allow-prod") options.allowProd = true;
    else if (arg === "--max-pages") options.maxPages = Math.max(0, Number(argv[++index] ?? "0"));
    else if (arg === "--category") options.category = argv[++index]?.trim() || null;
    else if (arg === "--skip-stored-candidates") options.includeStoredCandidates = false;
    else if (arg === "--skip-previously-verified-candidates") options.includePreviouslyVerifiedCandidates = false;
    else if (arg === "--skip-live-search") options.includeLiveSearch = false;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: npm run collect:free-items -- [--apply] [--allow-prod] [--max-pages N] [--category NAME] [--skip-stored-candidates] [--skip-previously-verified-candidates] [--skip-live-search]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function isLocalUrl(value: string | undefined): boolean {
  if (!value) return false;
  const hostname = new URL(value).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, { headers: { accept: "application/json", "user-agent": USER_AGENT } });
    } catch (error) {
      if (attempt >= MAX_RETRIES) throw error;
      const waitMs = Math.max(REQUEST_DELAY_MS, Math.min(60_000, 2_000 * 2 ** attempt));
      console.warn(
        `Roblox request failed to connect; retrying in ${waitMs}ms (${attempt + 1}/${MAX_RETRIES}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await sleep(waitMs);
      continue;
    }
    if (response.ok) {
      await sleep(REQUEST_DELAY_MS);
      return (await response.json()) as T;
    }

    if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;
      const exponentialWait = Math.min(60_000, 2_000 * 2 ** attempt);
      const retryAfterWait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 0;
      const waitMs = Math.max(REQUEST_DELAY_MS, retryAfterWait, exponentialWait);
      console.warn(`Roblox request returned ${response.status}; retrying in ${waitMs}ms (${attempt + 1}/${MAX_RETRIES})`);
      await sleep(waitMs);
      continue;
    }

    throw new Error(`Roblox request failed (${response.status}) for ${url}: ${(await response.text()).slice(0, 240)}`);
  }
  throw new Error(`Roblox request exhausted retries for ${url}`);
}

async function loadTaxonomy() {
  const categories = await fetchJson<CatalogCategory[]>(CATEGORIES_API);
  const assetScopes = new Map<number, { category: string; subcategory: string }>();
  const bundleScopes = new Map<number, { category: string; subcategory: string }>();
  for (const entry of categories) {
    if (!entry.category || !SUPPORTED_CATEGORIES.has(entry.category)) continue;
    for (const subcategory of entry.subcategories ?? []) {
      if (!subcategory.subcategory) continue;
      for (const assetTypeId of subcategory.assetTypeIds ?? []) {
        assetScopes.set(assetTypeId, { category: entry.category, subcategory: subcategory.subcategory });
      }
      for (const bundleTypeId of subcategory.bundleTypeIds ?? []) {
        bundleScopes.set(bundleTypeId, { category: entry.category, subcategory: subcategory.subcategory });
      }
    }
  }
  return { assetScopes, bundleScopes };
}

const STORED_CANDIDATE_SELECT = [
  "asset_id",
  "item_type",
  "asset_type_id",
  "category",
  "subcategory",
  "name",
  "description",
  "price_robux",
  "price_status",
  "lowest_price_robux",
  "lowest_resale_price_robux",
  "favorite_count",
  "has_resellers",
  "total_quantity",
  "units_available_for_consumption",
  "quantity_limit_per_user",
  "sale_location_type",
  "off_sale_deadline",
  "item_status",
  "item_restrictions",
  "bundled_items",
  "creator_target_id",
  "creator_name",
  "creator_type",
  "creator_has_verified_badge",
  "product_id",
  "collectible_item_id",
].join(",");

function storedRowToCandidate(row: StoredCandidateRow): Candidate | null {
  const itemType = row.item_type === "Bundle" ? "Bundle" : row.item_type === "Asset" ? "Asset" : null;
  const internalId = asNumber(row.asset_id);
  if (!itemType || internalId === null || internalId === 0) return null;

  const externalId = Math.abs(Math.trunc(internalId));
  return {
    externalId,
    internalId: itemType === "Bundle" ? -externalId : externalId,
    itemType,
    category: asText(row.category) ?? "Accessories",
    subcategory: asText(row.subcategory) ?? "Other",
    search: {
      id: externalId,
      itemType,
      assetType: asNumber(row.asset_type_id) ?? undefined,
      name: asText(row.name) ?? undefined,
      description: asText(row.description) ?? undefined,
      price: asNumber(row.price_robux) ?? 0,
      priceStatus: asText(row.price_status) ?? undefined,
      lowestPrice: asNumber(row.lowest_price_robux) ?? undefined,
      lowestResalePrice: asNumber(row.lowest_resale_price_robux) ?? undefined,
      favoriteCount: asNumber(row.favorite_count) ?? 0,
      hasResellers: row.has_resellers ?? false,
      totalQuantity: asNumber(row.total_quantity) ?? undefined,
      unitsAvailableForConsumption: asNumber(row.units_available_for_consumption) ?? undefined,
      quantityLimitPerUser: asNumber(row.quantity_limit_per_user) ?? undefined,
      saleLocationType: asText(row.sale_location_type) ?? undefined,
      offSaleDeadline: asText(row.off_sale_deadline) ?? undefined,
      itemStatus: row.item_status,
      itemRestrictions: row.item_restrictions,
      bundledItems: row.bundled_items,
      creatorTargetId: asNumber(row.creator_target_id) ?? undefined,
      creatorName: asText(row.creator_name) ?? undefined,
      creatorType: asText(row.creator_type) ?? undefined,
      creatorHasVerifiedBadge: row.creator_has_verified_badge ?? false,
      productId: asNumber(row.product_id) ?? undefined,
      collectibleItemId: asText(row.collectible_item_id) ?? undefined,
    },
  };
}

async function loadStoredCandidateRows(
  applyFilters: (query: any) => any,
  category: string | null,
): Promise<StoredCandidateRow[]> {
  const sb = supabaseAdmin();
  const output: StoredCandidateRow[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    let query = sb
      .from("roblox_catalog_items")
      .select(STORED_CANDIDATE_SELECT)
      .eq("is_deleted", false)
      .range(offset, offset + pageSize - 1);
    if (category) query = query.eq("category", category);
    query = applyFilters(query);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to load stored free-item candidates: ${error.message}`);
    const rows = (data ?? []) as unknown as StoredCandidateRow[];
    output.push(...rows);
    if (rows.length < pageSize) break;
  }

  return output;
}

async function loadStoredCandidates(
  category: string | null,
  includePreviouslyVerifiedCandidates: boolean,
): Promise<Candidate[]> {
  const sourceTaggedRows = await loadStoredCandidateRows(
    (query) => query.eq("price_robux", 0).not("raw_economy_json->>free_item_source", "is", null),
    category,
  );
  const previouslyVerifiedRows = includePreviouslyVerifiedCandidates
    ? await loadStoredCandidateRows((query) => query.eq("free_verification_source", "roblox"), category)
    : [];
  const candidates = new Map<string, Candidate>();

  for (const row of [...sourceTaggedRows, ...previouslyVerifiedRows]) {
    const candidate = storedRowToCandidate(row);
    if (candidate) candidates.set(`${candidate.itemType}:${candidate.externalId}`, candidate);
  }

  console.log(
    `Loaded ${candidates.size} stored candidate(s) (${sourceTaggedRows.length} source-tagged, ${previouslyVerifiedRows.length} previously verified)`,
  );
  return Array.from(candidates.values());
}

async function discoverCandidates(options: CliOptions): Promise<{ candidates: Candidate[]; complete: boolean }> {
  const candidates = new Map<string, Candidate>();
  if (options.includeStoredCandidates) {
    for (const candidate of await loadStoredCandidates(
      options.category,
      options.includePreviouslyVerifiedCandidates,
    )) {
      candidates.set(`${candidate.itemType}:${candidate.externalId}`, candidate);
    }
  }
  const storedCount = candidates.size;
  if (!options.includeLiveSearch) {
    console.log(`Skipped live Roblox search; verifying ${storedCount} stored candidate(s) without retirement.`);
    return { candidates: Array.from(candidates.values()), complete: false };
  }

  const taxonomy = await loadTaxonomy();
  let complete = options.maxPages === 0 && options.category === null;
  let cursor: string | null = null;
  let page = 0;
  do {
    const url = new URL(SEARCH_API);
    url.searchParams.set("category", options.category ?? "All");
    url.searchParams.set("sortType", "PriceAsc");
    url.searchParams.set("limit", String(LIMIT));
    url.searchParams.set("includeNotForSale", "false");
    url.searchParams.set("minPrice", "0");
    url.searchParams.set("maxPrice", "0");
    if (cursor) url.searchParams.set("cursor", cursor);

    const payload = await fetchJson<SearchResponse>(url.toString());
    page += 1;
    for (const item of payload.data ?? []) {
      const id = asNumber(item.id);
      const itemType = item.itemType === "Bundle" ? "Bundle" : item.itemType === "Asset" ? "Asset" : null;
      if (!id || !itemType || item.price !== 0) continue;
      const scope = itemType === "Bundle"
        ? taxonomy.bundleScopes.get(asNumber(item.bundleType) ?? -1)
        : taxonomy.assetScopes.get(asNumber(item.assetType) ?? -1);
      const candidate: Candidate = {
        externalId: id,
        internalId: itemType === "Bundle" ? -id : id,
        itemType,
        category: scope?.category ?? "Accessories",
        subcategory: scope?.subcategory ?? "Other",
        search: item,
      };
      candidates.set(`${itemType}:${id}`, candidate);
    }

    cursor = payload.nextPageCursor ?? null;
    if (page % 10 === 0) console.log(`Discovered ${page} page(s), ${candidates.size} combined unique candidates`);
    if (options.maxPages > 0 && page >= options.maxPages && cursor) {
      complete = false;
      cursor = null;
    }
  } while (cursor);

  console.log(
    `Discovery complete: ${page} page(s), ${candidates.size} combined unique candidate(s) (${storedCount} stored before live search)`,
  );

  return { candidates: Array.from(candidates.values()), complete };
}

function mapBundleScope(bundleType: string | null) {
  const normalized = (bundleType ?? "").toLowerCase();
  if (normalized.includes("animation")) {
    return { category: "AvatarAnimations", subcategory: "AnimationBundles" };
  }
  if (normalized.includes("shoe")) {
    return { category: "Clothing", subcategory: "ShoesBundles" };
  }
  return { category: "Body", subcategory: "BodyPartsBundles" };
}

function searchEligibility(item: SearchItem): FreeItemEligibilityInput {
  return {
    priceRobux: asNumber(item.price),
    isForSale: true,
    hasResellers: item.hasResellers ?? false,
    lowestResalePriceRobux: asNumber(item.lowestResalePrice) ?? 0,
    saleLocationType: item.saleLocationType ?? null,
    isLimited: Array.isArray(item.itemRestrictions) && item.itemRestrictions.includes("Collectible"),
    remaining: asNumber(item.unitsAvailableForConsumption),
    unitsAvailableForConsumption: asNumber(item.unitsAvailableForConsumption),
  };
}

function shouldFetchDetail(candidate: Candidate): boolean {
  if (candidate.itemType === "Bundle") return true;
  return classifyFreeItemEligibility(searchEligibility(candidate.search)).reason !== "experience_only";
}

async function prepareCandidate(candidate: Candidate, verifiedAt: string): Promise<PreparedRow> {
  const search = candidate.search;
  let eligibilityInput = searchEligibility(search);
  let detail: AssetDetail | BundleDetail | SearchItem = search;
  let row: PreparedRow = {
    asset_id: candidate.internalId,
    item_type: candidate.itemType,
    asset_type_id: asNumber(search.assetType),
    category: candidate.category,
    subcategory: candidate.subcategory,
    name: asText(search.name),
    description: asText(search.description),
    price_robux: asNumber(search.price),
    price_status: asText(search.priceStatus),
    lowest_price_robux: asNumber(search.lowestPrice) ?? 0,
    lowest_resale_price_robux: asNumber(search.lowestResalePrice) ?? 0,
    favorite_count: asNumber(search.favoriteCount) ?? 0,
    has_resellers: search.hasResellers ?? false,
    total_quantity: asNumber(search.totalQuantity),
    units_available_for_consumption: asNumber(search.unitsAvailableForConsumption),
    quantity_limit_per_user: asNumber(search.quantityLimitPerUser),
    sale_location_type: asText(search.saleLocationType),
    off_sale_deadline: asText(search.offSaleDeadline),
    item_status: search.itemStatus ?? null,
    item_restrictions: search.itemRestrictions ?? null,
    bundled_items: search.bundledItems ?? null,
    creator_id: asNumber(search.creatorTargetId),
    creator_target_id: asNumber(search.creatorTargetId),
    creator_name: asText(search.creatorName),
    creator_type: asText(search.creatorType),
    creator_has_verified_badge: search.creatorHasVerifiedBadge ?? false,
    product_id: asNumber(search.productId),
    collectible_item_id: asText(search.collectibleItemId) ?? undefined,
    last_seen_at: verifiedAt,
    last_enriched_at: verifiedAt,
    is_deleted: false,
    raw_catalog_json: search,
    free_claimability: "unavailable",
    free_restriction_reason: "verification_pending",
    free_verified_at: verifiedAt,
    free_verification_source: "roblox",
  };

  if (shouldFetchDetail(candidate)) {
    if (candidate.itemType === "Asset") {
      const asset = await fetchJson<AssetDetail>(`${ASSET_DETAILS_API}/${candidate.externalId}/details`);
      detail = asset;
      const collectible = asset.CollectiblesItemDetails ?? {};
      const creator = asset.Creator ?? {};
      eligibilityInput = {
        priceRobux: asNumber(asset.PriceInRobux),
        isForSale: asset.IsForSale ?? collectible.IsForSale ?? false,
        hasResellers: (asNumber(collectible.CollectibleLowestResalePrice) ?? 0) > 0,
        lowestResalePriceRobux: asNumber(collectible.CollectibleLowestResalePrice) ?? 0,
        saleLocationType: asset.SaleLocation?.SaleLocationType ?? search.saleLocationType ?? null,
        isLimited: asset.IsLimited === true || asset.IsLimitedUnique === true || collectible.IsLimited === true,
        remaining: asNumber(asset.Remaining),
        unitsAvailableForConsumption: asNumber(asset.Remaining),
      };
      row = {
        ...row,
        asset_type_id: asNumber(asset.AssetTypeId) ?? row.asset_type_id,
        name: asText(asset.Name) ?? row.name,
        description: asText(asset.Description) ?? row.description,
        price_robux: asNumber(asset.PriceInRobux),
        price_status: asset.IsForSale ? "OnSale" : "OffSale",
        lowest_resale_price_robux: eligibilityInput.lowestResalePriceRobux,
        is_for_sale: eligibilityInput.isForSale,
        is_limited: eligibilityInput.isLimited,
        is_limited_unique: asset.IsLimitedUnique ?? false,
        remaining: asNumber(asset.Remaining),
        creator_id: asNumber(creator.CreatorTargetId) ?? asNumber(creator.Id),
        creator_target_id: asNumber(creator.CreatorTargetId) ?? asNumber(creator.Id),
        creator_name: asText(creator.Name),
        creator_type: asText(creator.CreatorType),
        creator_has_verified_badge: creator.HasVerifiedBadge ?? false,
        product_id: asNumber(asset.ProductId),
        collectible_item_id: asText(asset.CollectibleItemId) ?? undefined,
        has_resellers: eligibilityInput.hasResellers,
        total_quantity: asNumber(collectible.TotalQuantity),
        units_available_for_consumption: asNumber(asset.Remaining),
        quantity_limit_per_user: asNumber(collectible.CollectibleQuantityLimitPerUser),
        sale_location_type: String(asset.SaleLocation?.SaleLocationType ?? search.saleLocationType ?? ""),
        raw_catalog_json: asset,
      };
    } else {
      const bundle = await fetchJson<BundleDetail>(`${BUNDLE_DETAILS_API}/${candidate.externalId}/details`);
      detail = bundle;
      const collectible = bundle.collectibleItemDetail ?? {};
      const product = bundle.product ?? {};
      const creator = bundle.creator ?? {};
      const bundleScope = mapBundleScope(asText(bundle.bundleType));
      const limited = Boolean(collectible.collectibleItemType && collectible.collectibleItemType !== "NonLimited");
      eligibilityInput = {
        priceRobux: asNumber(product.priceInRobux) ?? asNumber(collectible.price),
        isForSale: product.isForSale ?? collectible.saleStatus === "OnSale",
        hasResellers: collectible.hasResellers ?? false,
        lowestResalePriceRobux: asNumber(collectible.lowestResalePrice) ?? 0,
        saleLocationType:
          collectible.saleLocation?.saleLocationType ?? collectible.saleLocation?.saleLocationTypeId ?? null,
        isLimited: limited,
        remaining: asNumber(collectible.unitsAvailable),
        unitsAvailableForConsumption: asNumber(collectible.unitsAvailable),
      };
      row = {
        ...row,
        category: bundleScope.category,
        subcategory: bundleScope.subcategory,
        name: asText(bundle.name) ?? row.name,
        description: asText(bundle.description) ?? row.description,
        price_robux: eligibilityInput.priceRobux,
        price_status: eligibilityInput.isForSale ? "OnSale" : "OffSale",
        lowest_price_robux: asNumber(collectible.lowestPrice) ?? eligibilityInput.priceRobux,
        lowest_resale_price_robux: eligibilityInput.lowestResalePriceRobux,
        is_for_sale: eligibilityInput.isForSale,
        is_limited: limited,
        is_limited_unique: false,
        remaining: asNumber(collectible.unitsAvailable),
        creator_id: asNumber(creator.id),
        creator_target_id: asNumber(creator.id),
        creator_name: asText(creator.name),
        creator_type: asText(creator.type),
        creator_has_verified_badge: creator.hasVerifiedBadge ?? false,
        product_id: asNumber(product.id),
        collectible_item_id: asText(collectible.collectibleItemId) ?? undefined,
        has_resellers: eligibilityInput.hasResellers,
        total_quantity: asNumber(collectible.totalQuantity),
        units_available_for_consumption: asNumber(collectible.unitsAvailable),
        quantity_limit_per_user: asNumber(collectible.quantityLimitPerUser),
        sale_location_type:
          asText(collectible.saleLocation?.saleLocationType) ??
          String(collectible.saleLocation?.saleLocationTypeId ?? ""),
        off_sale_deadline: asText(collectible.offSaleDeadline),
        bundled_items: bundle.items ?? null,
        item_restrictions: bundle.itemRestrictions ?? null,
        raw_catalog_json: bundle,
      };
    }
  }

  const result = classifyFreeItemEligibility(eligibilityInput);
  return {
    ...row,
    raw_catalog_json: detail,
    free_claimability: result.claimability,
    free_restriction_reason: result.reason,
  };
}

async function fetchThumbnails(rows: PreparedRow[]) {
  const imageRows: Array<Record<string, unknown>> = [];
  const directRows = rows.filter((row) => row.free_claimability === "direct");
  for (const itemType of ["Asset", "Bundle"] as const) {
    const targets = directRows.filter((row) => row.item_type === itemType);
    for (let index = 0; index < targets.length; index += 50) {
      const batch = targets.slice(index, index + 50);
      const externalIds = batch.map((row) => Math.abs(row.asset_id));
      const url = new URL(itemType === "Asset" ? ASSET_THUMBNAILS_API : BUNDLE_THUMBNAILS_API);
      url.searchParams.set(itemType === "Asset" ? "assetIds" : "bundleIds", externalIds.join(","));
      url.searchParams.set("size", THUMBNAIL_SIZE);
      url.searchParams.set("format", THUMBNAIL_FORMAT);
      url.searchParams.set("isCircular", "false");
      const payload = await fetchJson<{ data?: ThumbnailRow[] }>(url.toString());
      const internalIdByExternalId = new Map(batch.map((row) => [Math.abs(row.asset_id), row.asset_id]));
      for (const thumbnail of payload.data ?? []) {
        const externalId = asNumber(thumbnail.targetId);
        const imageUrl = asText(thumbnail.imageUrl);
        const internalId = externalId ? internalIdByExternalId.get(externalId) : null;
        if (!internalId || !imageUrl) continue;
        imageRows.push({
          asset_id: internalId,
          size: THUMBNAIL_SIZE,
          format: THUMBNAIL_FORMAT,
          image_url: imageUrl,
          state: asText(thumbnail.state) ?? "Completed",
          version: asText(thumbnail.version),
          last_checked_at: new Date().toISOString(),
        });
      }
    }
  }

  const imageIds = new Set(imageRows.map((row) => row.asset_id as number));
  for (const row of directRows) {
    if (!imageIds.has(row.asset_id)) {
      row.free_claimability = "unavailable";
      row.free_restriction_reason = "missing_thumbnail";
    }
  }
  return imageRows;
}

function chunks<T>(values: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
}

async function persist(rows: PreparedRow[], images: Array<Record<string, unknown>>, complete: boolean) {
  const sb = supabaseAdmin();
  for (const batch of chunks(rows, 100)) {
    const { error } = await sb.from("roblox_catalog_items").upsert(batch, { onConflict: "asset_id" });
    if (error) throw new Error(`Failed to save official free items: ${error.message}`);
  }
  for (const batch of chunks(images, 100)) {
    const { error } = await sb
      .from("roblox_catalog_item_images")
      .upsert(batch, { onConflict: "asset_id,size,format" });
    if (error) throw new Error(`Failed to save official free-item thumbnails: ${error.message}`);
  }

  if (!complete) return;
  const { data: previous, error } = await sb
    .from("roblox_catalog_items")
    .select("asset_id")
    .eq("free_verification_source", "roblox");
  if (error) throw new Error(`Failed to load previous official free items: ${error.message}`);
  const seen = new Set(rows.map((row) => row.asset_id));
  const staleIds = (previous ?? []).map((row) => row.asset_id as number).filter((assetId) => !seen.has(assetId));
  for (const batch of chunks(staleIds, 100)) {
    const { error: staleError } = await sb
      .from("roblox_catalog_items")
      .update({
        free_claimability: "unavailable",
        free_restriction_reason: "not_in_latest_source",
        free_verified_at: new Date().toISOString(),
      })
      .in("asset_id", batch);
    if (staleError) throw new Error(`Failed to retire stale official free items: ${staleError.message}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE");
  }
  if (options.apply && !options.allowProd && !isLocalUrl(process.env.SUPABASE_URL)) {
    throw new Error("Refusing to write to non-local Supabase without --allow-prod");
  }

  const { candidates, complete: discoveryComplete } = await discoverCandidates(options);
  let complete = discoveryComplete;
  const verifiedAt = new Date().toISOString();
  const rows: PreparedRow[] = [];
  const failures: Array<{ id: number; itemType: Candidate["itemType"]; error: string }> = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    try {
      rows.push(await prepareCandidate(candidate, verifiedAt));
    } catch (error) {
      complete = false;
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ id: candidate.externalId, itemType: candidate.itemType, error: message });
      console.warn(`Skipped ${candidate.itemType} ${candidate.externalId}: ${message}`);
    }
    if ((index + 1) % 25 === 0) console.log(`Verified ${index + 1}/${candidates.length} candidates`);
  }
  const images = await fetchThumbnails(rows);

  const counts = rows.reduce<Record<string, number>>((result, row) => {
    const key = row.free_claimability;
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
  const reasons = rows.reduce<Record<string, number>>((result, row) => {
    const key = row.free_restriction_reason ?? "direct";
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});

  console.log(
    JSON.stringify(
      {
        candidates: candidates.length,
        verified: rows.length,
        complete,
        failures: failures.length,
        counts,
        reasons,
        thumbnails: images.length,
      },
      null,
      2,
    ),
  );
  if (!options.apply) {
    console.log("Dry run only. Pass --apply to write to Supabase.");
    return;
  }
  await persist(rows, images, complete);
  console.log(`Saved ${rows.length} official Roblox free-item verification rows.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
