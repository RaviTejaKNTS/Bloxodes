import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { slugify } from "@/lib/slug";
import { cleanRobloxUniverseDisplayName } from "@/lib/roblox/display-name";
import { isStatsTier, type StatsTier } from "./stats-tier";

const GAME_DETAILS_API = "https://games.roblox.com/v1/games";
const GAME_ICONS_API = "https://thumbnails.roblox.com/v1/games/icons";
const GAME_THUMBS_API = "https://thumbnails.roblox.com/v1/games/multiget/thumbnails";
const GAME_PASSES_API = (universeId: number) => `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes`;
const BADGES_API = (universeId: number) => `https://badges.roblox.com/v1/universes/${universeId}/badges`;
const PLACE_SERVERS_API = (placeId: number) => `https://games.roblox.com/v1/games/${placeId}/servers/Public`;
const ASSET_THUMBNAILS_API = "https://thumbnails.roblox.com/v1/assets";
const OPEN_CLOUD_BASE = "https://apis.roblox.com";
const OPEN_CLOUD_UNIVERSE_PATH = "/cloud/v2/universes";
const OPEN_CLOUD_CONCURRENCY = Number(process.env.ROBLOX_OPEN_CLOUD_CONCURRENCY ?? "5");
const GROUP_CONCURRENCY = Number(process.env.ROBLOX_GROUP_CONCURRENCY ?? "5");
const SERVER_CONCURRENCY = Number(process.env.ROBLOX_SERVER_CONCURRENCY ?? "1");
const OPEN_CLOUD_API_KEY = process.env.ROBLOX_OPEN_CLOUD_API_KEY ?? process.env.ROBLOX_API_KEY ?? null;
const GROUP_DETAILS_API = (groupId: number) => `https://groups.roblox.com/v1/groups/${groupId}`;

const DEFAULT_TOTAL_LIMIT = Number(process.env.ROBLOX_ENRICH_LIMIT ?? "300");
const BATCH_SIZE = Number(process.env.ROBLOX_ENRICH_BATCH ?? "50");
const ATTACHMENT_CONCURRENCY = Number(process.env.ROBLOX_ENRICH_CONCURRENCY ?? "4");
const REQUEST_INTERVAL_MS = Number(process.env.ROBLOX_ENRICH_REQUEST_INTERVAL_MS ?? "1000");
const BATCH_DELAY_MS = Number(process.env.ROBLOX_ENRICH_BATCH_DELAY_MS ?? "1200");
const RETRY_LIMIT = Number(process.env.ROBLOX_ENRICH_RETRY_LIMIT ?? "6");
const RETRY_BASE_DELAY_MS = Number(process.env.ROBLOX_ENRICH_RETRY_BASE_DELAY_MS ?? "5000");
const RETRY_MAX_DELAY_MS = Number(process.env.ROBLOX_ENRICH_RETRY_MAX_DELAY_MS ?? "120000");
const WRITE_LEGACY_DAILY_STATS = process.env.ROBLOX_ENRICH_WRITE_DAILY_STATS === "true";
const MIN_TIERED_ENRICHMENT_PAGE_SIZE = Number(process.env.ROBLOX_ENRICH_MIN_TIERED_PAGE_SIZE ?? "100");

type EnrichmentMode = "light" | "deep";

type UniverseRow = {
  universe_id: number;
  root_place_id: number | null;
  last_seen_in_sort: string | null;
  last_seen_in_search: string | null;
  updated_at: string | null;
  name?: string | null;
  playing?: number | null;
  visits?: number | null;
  stats_tier?: StatsTier | null;
};

type RobloxGameDetail = {
  id: number;
  rootPlaceId?: number;
  name?: string;
  description?: string;
  created?: string;
  updated?: string;
  sourceName?: string;
  creator?: {
    id?: number;
    name?: string;
    type?: string;
    hasVerifiedBadge?: boolean;
  };
  genre?: string;
  genre_l1?: string;
  genre_l2?: string;
  isAllGenre?: boolean;
  price?: number;
  voiceEnabled?: boolean;
  serverSize?: number;
  maxPlayers?: number;
  playing?: number;
  visits?: number;
  favorites?: number;
  favoritedCount?: number;
  totalUpVotes?: number;
  totalDownVotes?: number;
  allowedGearCategories?: string[];
  isExperimental?: boolean;
  isGenreEnforced?: boolean;
  isPlayable?: boolean;
  createVipServersAllowed?: boolean;
  studioAccessToApisAllowed?: boolean;
  universeAvatarType?: string;
  ageRecommendation?: string;
  isSponsoredGame?: boolean;
  hasVerifiedBadge?: boolean;
  pastDayVotes?: {
    upVotes?: number;
    downVotes?: number;
  };
  votes?: {
    upVotes?: number;
    downVotes?: number;
  };
  media?: unknown;
  [key: string]: unknown;
};

type IconResponse = {
  data?: Array<{
    targetId: number;
    state?: string;
    imageUrl?: string;
    universeId?: number;
    errorCode?: number;
    [key: string]: unknown;
  }>;
};

type ThumbnailResponse = {
  data?: Array<{
    universeId: number;
    thumbnails: Array<{
      imageUrl?: string;
      state?: string;
      thumbnailType?: string;
      thumbnailId?: number;
      errorCode?: number;
      [key: string]: unknown;
    }>;
  }>;
};

type GamePass = {
  id: number;
  productId?: number;
  name?: string;
  displayName?: string;
  description?: string;
  displayDescription?: string;
  price?: number;
  isForSale?: boolean;
  sales?: number;
  created?: string;
  updated?: string;
  iconImageId?: number;
  displayIconImageId?: number;
  displayIconImageAssetId?: number;
  [key: string]: unknown;
};

type Badge = {
  id: number;
  name?: string;
  displayName?: string;
  description?: string;
  displayDescription?: string;
  iconImageId?: number;
  awardingBadgeAssetId?: number;
  enabled?: boolean;
  created?: string;
  updated?: string;
  statistics?: {
    pastDayAwardedCount?: number;
    pastWeekAwardedCount?: number;
    awardedCount?: number;
    winRatePercentage?: number;
  };
  displayIconImageId?: number;
  rarity?: number;
  [key: string]: unknown;
};

type PublicServer = {
  id: string;
  maxPlayers?: number;
  playing?: number;
  fps?: number;
  ping?: number;
  region?: string;
  players?: unknown[];
  playerTokens?: unknown[];
  [key: string]: unknown;
};

type UniverseSocialLinks = Record<string, Array<{ title?: string | null; url?: string | null }>>;

type UniverseMetadata = {
  raw: Record<string, unknown>;
  displayName?: string | null;
  description?: string | null;
  descriptionSource?: string | null;
  rootPlaceId?: number | null;
  voiceChatEnabled?: boolean | null;
  socialLinks?: UniverseSocialLinks;
  socialRaw?: Record<string, unknown> | null;
  desktopEnabled?: boolean | null;
  mobileEnabled?: boolean | null;
  tabletEnabled?: boolean | null;
  consoleEnabled?: boolean | null;
  vrEnabled?: boolean | null;
  visibility?: string | null;
  privacyType?: string | null;
  isActive?: boolean | null;
  isArchived?: boolean | null;
  isSponsored?: boolean | null;
  ageRating?: string | null;
  privateServerPriceRobux?: number | null;
  createVipServersAllowed?: boolean | null;
  studioAccessAllowed?: boolean | null;
  groupId?: number | null;
  groupName?: string | null;
  groupHasVerifiedBadge?: boolean | null;
  groupRaw?: Record<string, unknown> | null;
};

type SocialLinkRow = {
  universe_id: number;
  platform: string;
  title: string | null;
  url: string;
  raw_payload: Record<string, unknown>;
  fetched_at: string;
};

type GroupRow = {
  group_id: number;
  name: string;
  description: string | null;
  member_count: number | null;
  owner_id: number | null;
  owner_name: string | null;
  has_verified_badge: boolean | null;
  raw_payload: Record<string, unknown>;
  updated_at: string;
};

type UniverseUpsertRecord = Record<string, unknown> & {
  universe_id: number;
  root_place_id: number;
};

type UniverseDbRow = Record<string, unknown> & {
  universe_id: number;
};

type RobloxGroupResponse = {
  id: number;
  name?: string;
  description?: string;
  memberCount?: number;
  owner?: {
    userId?: number;
    username?: string;
    hasVerifiedBadge?: boolean;
  };
  hasVerifiedBadge?: boolean;
  shout?: unknown;
  [key: string]: unknown;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const nowIso = () => new Date().toISOString();
let nextRequestAt = 0;
let requestSlotQueue = Promise.resolve();

function supabaseHost() {
  try {
    return new URL(process.env.SUPABASE_URL ?? "").host;
  } catch {
    return "unknown Supabase host";
  }
}

function retryAfterMs(headers: Headers): number | null {
  const value = headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(seconds * 1000, 0);
  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) return Math.max(dateMs - Date.now(), 0);
  return null;
}

function jitter(ms: number) {
  return Math.round(ms * (0.75 + Math.random() * 0.5));
}

async function waitForRequestSlot() {
  const previous = requestSlotQueue;
  let releaseSlot: () => void = () => {};
  requestSlotQueue = new Promise((resolve) => {
    releaseSlot = resolve;
  });
  await previous;

  const now = Date.now();
  if (nextRequestAt > now) {
    await sleep(nextRequestAt - now);
  }
  nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;
  releaseSlot();
}

async function fetchJson(url: string, label: string) {
  for (let attempt = 0; attempt <= RETRY_LIMIT; attempt += 1) {
    await waitForRequestSlot();
    let res: Response;
    try {
      res = await fetch(url, { headers: { "user-agent": "BloxodesUniverseEnricher/1.0" } });
    } catch (error) {
      if (attempt >= RETRY_LIMIT) {
        throw error;
      }
      const delay = jitter(Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS));
      console.warn(`⚠️ ${label} request failed; retrying in ${Math.round(delay / 1000)}s`);
      await sleep(delay);
      continue;
    }
    if (res.ok) {
      return res.json();
    }

    const body = await res.text().catch(() => "");
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= RETRY_LIMIT) {
      throw new Error(`Failed to fetch ${label} (${res.status}): ${body}`);
    }

    const delay =
      retryAfterMs(res.headers) ?? jitter(Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS));
    console.warn(`⚠️ ${label} returned ${res.status}; retrying in ${Math.round(delay / 1000)}s`);
    await sleep(delay);
  }

  throw new Error(`Failed to fetch ${label}`);
}

function ensureOpenCloudApiKey(): string {
  if (!OPEN_CLOUD_API_KEY) {
    throw new Error(
      "ROBLOX_OPEN_CLOUD_API_KEY (or ROBLOX_API_KEY) must be set to call Roblox Open Cloud endpoints."
    );
  }
  return OPEN_CLOUD_API_KEY;
}

function parseRootPlaceIdFromPath(pathValue?: string | null): number | null {
  if (!pathValue) return null;
  const match = /places\/(\d+)/i.exec(pathValue);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNumericIdFromResource(resource?: unknown): number | null {
  if (typeof resource !== "string") return null;
  const match = resource.match(/(\d+)/g);
  if (!match || match.length === 0) return null;
  const last = Number(match[match.length - 1]);
  return Number.isFinite(last) ? last : null;
}

function pickString(source: Record<string, unknown> | null | undefined, ...keys: string[]): string | null {
  if (!source) return null;
  for (const key of keys) {
    const value = (source as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim().length) {
      return value;
    }
  }
  return null;
}

function pickBoolean(source: Record<string, unknown> | null | undefined, ...keys: string[]): boolean | null {
  if (!source) return null;
  for (const key of keys) {
    const value = (source as Record<string, unknown>)[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return null;
}

function normalizeTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

const UNIVERSE_SOCIAL_FIELDS: Array<{ key: string; field: string }> = [
  { key: "facebook", field: "facebookSocialLink" },
  { key: "twitter", field: "twitterSocialLink" },
  { key: "youtube", field: "youtubeSocialLink" },
  { key: "twitch", field: "twitchSocialLink" },
  { key: "discord", field: "discordSocialLink" },
  { key: "roblox_group", field: "robloxGroupSocialLink" },
  { key: "guilded", field: "guildedSocialLink" }
];

function extractSocialLinksFromMetadata(raw: Record<string, unknown>) {
  const socialLinks: UniverseSocialLinks = {};
  const socialRaw: Record<string, unknown> = {};
  let count = 0;
  for (const { key, field } of UNIVERSE_SOCIAL_FIELDS) {
    const value = raw[field as keyof typeof raw] as { title?: string; uri?: string } | undefined;
    if (!value || typeof value !== "object") continue;
    const uri = typeof value.uri === "string" ? value.uri.trim() : "";
    if (!uri) continue;
    if (!socialLinks[key]) {
      socialLinks[key] = [];
    }
    socialLinks[key].push({
      title: typeof value.title === "string" ? value.title : null,
      url: uri
    });
    socialRaw[field as string] = value;
    count += 1;
  }
  return {
    links: count > 0 ? socialLinks : undefined,
    raw: count > 0 ? socialRaw : undefined
  };
}

function flattenSocialLinksForTable(
  universeId: number,
  links: UniverseSocialLinks,
  fetchedAt: string
): SocialLinkRow[] {
  const rows: SocialLinkRow[] = [];
  for (const [platform, entries] of Object.entries(links)) {
    for (const entry of entries) {
      if (!entry.url) continue;
      rows.push({
        universe_id: universeId,
        platform,
        title: entry.title ?? null,
        url: entry.url,
        raw_payload: { ...entry },
        fetched_at: fetchedAt
      });
    }
  }
  return rows;
}

async function syncSocialLinks(
  supabase: ReturnType<typeof supabaseAdmin>,
  universeIds: number[],
  metadataMap: Map<number, UniverseMetadata>
) {
  if (!universeIds.length) {
    return 0;
  }
  const fetchedAt = nowIso();
  const rows: SocialLinkRow[] = [];
  for (const universeId of universeIds) {
    const metadata = metadataMap.get(universeId);
    if (metadata?.socialLinks) {
      rows.push(...flattenSocialLinksForTable(universeId, metadata.socialLinks, fetchedAt));
    }
  }

  if (universeIds.length) {
    const { error } = await supabase.from("roblox_universe_social_links").delete().in("universe_id", universeIds);
    if (error) throw error;
  }
  if (rows.length) {
    const { error } = await supabase.from("roblox_universe_social_links").insert(rows);
    if (error) throw error;
  }
  return rows.length;
}

async function syncGroups(
  supabase: ReturnType<typeof supabaseAdmin>,
  metadataMap: Map<number, UniverseMetadata>
) {
  const groupIds = Array.from(
    new Set(
      Array.from(metadataMap.values())
        .map((meta) => meta.groupId)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    )
  );
  if (!groupIds.length) {
    return 0;
  }
  const rows = await fetchGroupRows(groupIds);
  if (!rows.length) {
    return 0;
  }
  const { error } = await supabase.from("roblox_groups").upsert(rows, { onConflict: "group_id" });
  if (error) throw error;
  return rows.length;
}

async function fetchUniverseMetadata(universeIds: number[]): Promise<Map<number, UniverseMetadata>> {
  if (!universeIds.length) return new Map();
  const apiKey = ensureOpenCloudApiKey();
  const results = new Map<number, UniverseMetadata>();

  await promisePool(universeIds, OPEN_CLOUD_CONCURRENCY, async (universeId) => {
    const url = `${OPEN_CLOUD_BASE}${OPEN_CLOUD_UNIVERSE_PATH}/${universeId}`;
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": "BloxodesUniverseEnricher/1.0",
          "x-api-key": apiKey
        }
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Failed (${res.status}): ${body || res.statusText}`);
      }
      const data = (await res.json()) as Record<string, unknown>;
      const rootPlaceId = parseRootPlaceIdFromPath(data.rootPlace as string | undefined);
      const social = extractSocialLinksFromMetadata(data);
      const metadata: UniverseMetadata = {
        raw: data,
        displayName: typeof data.displayName === "string" ? data.displayName : null,
        description: typeof data.description === "string" ? data.description : null,
        descriptionSource: typeof (data as any).descriptionSource === "string" ? ((data as any).descriptionSource as string) : null,
        voiceChatEnabled: typeof data.voiceChatEnabled === "boolean" ? data.voiceChatEnabled : null,
        rootPlaceId,
        socialLinks: social.links,
        socialRaw: social.raw ?? null,
        desktopEnabled: typeof (data as any).desktopEnabled === "boolean" ? (data as any).desktopEnabled : null,
        mobileEnabled: typeof (data as any).mobileEnabled === "boolean" ? (data as any).mobileEnabled : null,
        tabletEnabled: typeof (data as any).tabletEnabled === "boolean" ? (data as any).tabletEnabled : null,
        consoleEnabled: typeof (data as any).consoleEnabled === "boolean" ? (data as any).consoleEnabled : null,
        vrEnabled: typeof (data as any).vrEnabled === "boolean" ? (data as any).vrEnabled : null,
        visibility: typeof (data as any).visibility === "string" ? ((data as any).visibility as string) : null,
        privacyType: typeof (data as any).privacyType === "string" ? ((data as any).privacyType as string) : null,
        isActive: typeof (data as any).isActive === "boolean" ? (data as any).isActive : null,
        isArchived: typeof (data as any).isArchived === "boolean" ? (data as any).isArchived : null,
        isSponsored: typeof (data as any).isSponsored === "boolean" ? (data as any).isSponsored : null,
        ageRating: typeof (data as any).ageRating === "string" ? ((data as any).ageRating as string) : null,
        privateServerPriceRobux:
          typeof (data as any).privateServerPriceRobux === "number" ? (data as any).privateServerPriceRobux : null,
        createVipServersAllowed:
          typeof (data as any).createVipServersAllowed === "boolean" ? (data as any).createVipServersAllowed : null,
        studioAccessAllowed:
          typeof (data as any).studioAccessAllowed === "boolean" ? (data as any).studioAccessAllowed : null,
        groupId: parseNumericIdFromResource((data as any).group),
        groupName: typeof (data as any).groupDisplayName === "string" ? (data as any).groupDisplayName : null,
        groupHasVerifiedBadge:
          typeof (data as any).groupHasVerifiedBadge === "boolean" ? (data as any).groupHasVerifiedBadge : null,
        groupRaw: ((data as any).group ?? null) as Record<string, unknown> | null
      };
      results.set(universeId, metadata);
    } catch (error) {
      console.warn(`⚠️ Open Cloud universe fetch failed for ${universeId}:`, (error as Error).message);
    }
  });

  return results;
}

const SUPABASE_PAGE_LIMIT = 1000;

async function fetchUniversePage(
  offset: number,
  count: number,
  mode: EnrichmentMode,
  tier: StatsTier | "ALL",
  universeIds: number[] = []
): Promise<UniverseRow[]> {
  const supabase = supabaseAdmin();
  let query = supabase
    .from("roblox_universes")
    .select("universe_id, root_place_id, last_seen_in_sort, last_seen_in_search, updated_at, name, playing, visits, stats_tier")
    .not("root_place_id", "is", null);

  if (universeIds.length) {
    query = query.in("universe_id", universeIds);
  } else if (tier !== "ALL") {
    query = query.eq("stats_tier", tier);
  }

  if (universeIds.length) {
    query = query.order("playing", { ascending: false, nullsFirst: false }).order("universe_id", { ascending: true });
  } else if (tier !== "ALL") {
    const enrichedColumn = mode === "light" ? "last_light_enriched_at" : "last_deep_enriched_at";
    query = query.order(enrichedColumn, { ascending: true, nullsFirst: true });
    if (tier === "HOT") {
      query = query
        .order("playing", { ascending: false, nullsFirst: false })
        .order("visits", { ascending: false, nullsFirst: false })
        .order("last_seen_in_sort", { ascending: false, nullsFirst: false })
        .order("last_seen_in_search", { ascending: false, nullsFirst: false });
    } else if (tier === "NEW") {
      query = query
        .order("last_seen_in_sort", { ascending: false, nullsFirst: false })
        .order("last_seen_in_search", { ascending: false, nullsFirst: false })
        .order("playing", { ascending: false, nullsFirst: false })
        .order("visits", { ascending: false, nullsFirst: false });
    } else {
      query = query
        .order("playing", { ascending: false, nullsFirst: false })
        .order("visits", { ascending: false, nullsFirst: false });
    }
    query = query.order("universe_id", { ascending: true });
  } else if (mode === "light") {
    query = query
      .order("last_light_enriched_at", { ascending: true, nullsFirst: true })
      .order("stats_tier", { ascending: true, nullsFirst: false })
      .order("playing", { ascending: false, nullsFirst: false })
      .order("visits", { ascending: false, nullsFirst: false })
      .order("last_seen_in_search", { ascending: false })
      .order("last_seen_in_sort", { ascending: false })
      .order("updated_at", { ascending: false });
  } else {
    query = query
      .order("last_deep_enriched_at", { ascending: true, nullsFirst: true })
      .order("playing", { ascending: false, nullsFirst: false })
      .order("visits", { ascending: false, nullsFirst: false })
      .order("last_seen_in_sort", { ascending: false })
      .order("updated_at", { ascending: false });
  }

  const { data, error } = await query.range(offset, offset + count - 1);
  if (error) throw error;
  return (data as UniverseRow[]) ?? [];
}

async function fetchGameDetails(universeIds: number[]): Promise<RobloxGameDetail[]> {
  if (!universeIds.length) return [];
  const params = new URLSearchParams();
  params.set("universeIds", universeIds.join(","));
  const data = await fetchJson(`${GAME_DETAILS_API}?${params}`, "game details");
  return Array.isArray(data?.data) ? (data.data as RobloxGameDetail[]) : [];
}

async function fetchGameIcons(universeIds: number[]) {
  if (!universeIds.length) return [];
  const params = new URLSearchParams({
    universeIds: universeIds.join(","),
    size: "512x512",
    format: "Png",
    isCircular: "false"
  });
  const data = (await fetchJson(`${GAME_ICONS_API}?${params}`, "game icons")) as IconResponse;
  return Array.isArray(data?.data) ? data!.data! : [];
}

async function fetchGameThumbnails(universeIds: number[]) {
  if (!universeIds.length) return [];
  const params = new URLSearchParams({
    universeIds: universeIds.join(","),
    size: "768x432",
    format: "Png"
  });
  const data = (await fetchJson(`${GAME_THUMBS_API}?${params}`, "game thumbnails")) as ThumbnailResponse;
  return Array.isArray(data?.data) ? data!.data! : [];
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchAssetThumbnails(assetIds: number[]): Promise<Map<number, string>> {
  const uniqueIds = Array.from(new Set(assetIds.filter((id) => Number.isSafeInteger(id) && id > 0)));
  const thumbnails = new Map<number, string>();
  for (const chunk of chunkArray(uniqueIds, 100)) {
    const params = new URLSearchParams({
      assetIds: chunk.join(","),
      size: "150x150",
      format: "Png",
      isCircular: "false"
    });
    try {
      const data = await fetchJson(`${ASSET_THUMBNAILS_API}?${params}`, "asset thumbnails");
      if (!Array.isArray(data?.data)) continue;
      for (const entry of data.data as Array<{ targetId?: number; imageUrl?: string; state?: string }>) {
        if (typeof entry.targetId === "number" && typeof entry.imageUrl === "string" && entry.imageUrl) {
          thumbnails.set(entry.targetId, entry.imageUrl);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Asset thumbnails failed for ${chunk.length} ids:`, (error as Error).message);
    }
  }
  return thumbnails;
}

async function fetchGamePasses(universeId: number): Promise<GamePass[]> {
  const results: GamePass[] = [];
  let pageToken: string | null = null;
  try {
    do {
      const params = new URLSearchParams({ limit: "100" });
      if (pageToken) params.set("pageToken", pageToken);
      const data = await fetchJson(`${GAME_PASSES_API(universeId)}?${params}`, "game passes");
      if (Array.isArray(data?.gamePasses)) {
        results.push(...(data.gamePasses as GamePass[]));
      } else if (Array.isArray(data?.data)) {
        results.push(...(data.data as GamePass[]));
      }
      pageToken =
        typeof data?.nextPageToken === "string" && data.nextPageToken.length > 0
          ? data.nextPageToken
          : typeof data?.nextPageCursor === "string" && data.nextPageCursor.length > 0
            ? data.nextPageCursor
            : null;
      if (pageToken) await sleep(200);
    } while (pageToken);
  } catch (error) {
    console.warn(`⚠️ Game passes failed for ${universeId}:`, (error as Error).message);
  }
  return results;
}

async function fetchBadges(universeId: number): Promise<Badge[]> {
  const results: Badge[] = [];
  let cursor: string | null = null;
  try {
    do {
      const params = new URLSearchParams({ limit: "100" });
      if (cursor) params.set("cursor", cursor);
      const data = await fetchJson(`${BADGES_API(universeId)}?${params}`, "badges");
      if (Array.isArray(data?.data)) {
        results.push(...(data.data as Badge[]));
      }
      cursor = typeof data?.nextPageCursor === "string" && data.nextPageCursor.length > 0 ? data.nextPageCursor : null;
      if (cursor) await sleep(200);
    } while (cursor);
  } catch (error) {
    console.warn(`⚠️ Badges failed for ${universeId}:`, (error as Error).message);
  }
  return results;
}

async function fetchPublicServers(placeId: number): Promise<PublicServer[]> {
  try {
    const params = new URLSearchParams({
      limit: "10",
      sortOrder: "Desc"
    });
    const data = await fetchJson(`${PLACE_SERVERS_API(placeId)}?${params}`, "public servers");
    return Array.isArray(data?.data) ? (data.data as PublicServer[]) : [];
  } catch (error) {
    console.warn(`⚠️ Public servers failed for place ${placeId}:`, (error as Error).message);
    return [];
  }
}

async function fetchGroupDetail(groupId: number): Promise<GroupRow | null> {
  try {
    const data = (await fetchJson(GROUP_DETAILS_API(groupId), `group ${groupId}`)) as RobloxGroupResponse;
    if (!data || typeof data !== "object" || typeof data.id !== "number") {
      return null;
    }
    return {
      group_id: data.id,
      name: data.name ?? `Group ${groupId}`,
      description: typeof data.description === "string" ? data.description : null,
      member_count: typeof data.memberCount === "number" ? data.memberCount : null,
      owner_id: typeof data.owner?.userId === "number" ? data.owner.userId : null,
      owner_name: typeof data.owner?.username === "string" ? data.owner.username : null,
      has_verified_badge:
        typeof data.hasVerifiedBadge === "boolean"
          ? data.hasVerifiedBadge
          : typeof data.owner?.hasVerifiedBadge === "boolean"
            ? data.owner.hasVerifiedBadge
            : null,
      raw_payload: data as Record<string, unknown>,
      updated_at: nowIso()
    };
  } catch (error) {
    console.warn(`⚠️ Group fetch failed for ${groupId}:`, (error as Error).message);
    return null;
  }
}

async function fetchGroupRows(groupIds: number[]): Promise<GroupRow[]> {
  if (!groupIds.length) return [];
  const rows: GroupRow[] = [];
  await promisePool(groupIds, GROUP_CONCURRENCY, async (groupId) => {
    const row = await fetchGroupDetail(groupId);
    if (row) {
      rows.push(row);
    }
  });
  return rows;
}

function mapGameDetail(
  game: RobloxGameDetail,
  fallbackRootPlaceId?: number | null,
  metadata?: UniverseMetadata
): UniverseUpsertRecord | null {
  const votes = game.votes ?? game.pastDayVotes ?? {};
  const playing = typeof game.playing === "number" ? game.playing : null;
  const visits = typeof game.visits === "number" ? game.visits : null;
  const favorites =
    typeof game.favorites === "number"
      ? game.favorites
      : typeof game.favoritedCount === "number"
        ? game.favoritedCount
        : null;
  const likes =
    typeof votes.upVotes === "number"
      ? votes.upVotes
      : typeof game.totalUpVotes === "number"
        ? game.totalUpVotes
        : null;
  const dislikes =
    typeof votes.downVotes === "number"
      ? votes.downVotes
      : typeof game.totalDownVotes === "number"
        ? game.totalDownVotes
        : null;

  const rootPlaceId = game.rootPlaceId ?? fallbackRootPlaceId ?? null;
  if (rootPlaceId == null) {
    return null;
  }

  const rawDetails: Record<string, unknown> = { ...game };
  if (metadata?.raw) {
    rawDetails.openCloud = metadata.raw;
  }

  const metadataGenre = pickString(metadata?.raw ?? null, "genre");
  const metadataGenreL1 = pickString(metadata?.raw ?? null, "genre_l1", "genreL1");
  const metadataGenreL2 = pickString(metadata?.raw ?? null, "genre_l2", "genreL2");
  const metadataIsAllGenre = pickBoolean(metadata?.raw ?? null, "isAllGenre", "is_all_genre");

  const detailGenre = typeof game.genre === "string" ? game.genre : null;
  const detailGenreL1 = typeof game.genre_l1 === "string" ? game.genre_l1 : null;
  const detailGenreL2 = typeof game.genre_l2 === "string" ? game.genre_l2 : null;
  const detailIsAllGenre = typeof game.isAllGenre === "boolean" ? game.isAllGenre : null;
  const createdAtApi = normalizeTimestamp(
    pickString(metadata?.raw ?? null, "created", "createdAt", "created_at") ?? game.created ?? null
  );
  const updatedAtApi = normalizeTimestamp(
    pickString(metadata?.raw ?? null, "updated", "updatedAt", "updated_at") ?? game.updated ?? null
  );

  const genreValue = detailGenre ?? metadataGenre ?? null;
  const genreL1Value = metadataGenreL1 ?? detailGenreL1 ?? genreValue;
  const genreL2Value = metadataGenreL2 ?? detailGenreL2 ?? null;
  const derivedGenreForAllFlag = genreL1Value ?? genreValue;
  const isAllGenreValue =
    metadataIsAllGenre ??
    detailIsAllGenre ??
    (derivedGenreForAllFlag ? derivedGenreForAllFlag.trim().toLowerCase().includes("all") : null);

  const rawMetadata = metadata?.raw ? { open_cloud: metadata.raw } : {};
  if (metadata?.socialRaw) {
    (rawMetadata as Record<string, unknown>).social_links = metadata.socialRaw;
  }

  const payload: Record<string, unknown> = {
    universe_id: game.id,
    root_place_id: rootPlaceId,
    name: metadata?.displayName ?? game.name ?? `Universe ${game.id}`,
    description: metadata?.description ?? game.description ?? null,
    description_source: metadata?.description
      ? metadata.descriptionSource ?? "open_cloud"
      : typeof game.description === "string"
        ? "games"
        : null,
    slug: null,
    creator_id: game.creator?.id ?? null,
    creator_name: game.creator?.name ?? null,
    creator_type: game.creator?.type ?? null,
    creator_has_verified_badge:
      typeof game.creator?.hasVerifiedBadge === "boolean" ? game.creator.hasVerifiedBadge : null,
    group_id: metadata?.groupId ?? null,
    group_name: metadata?.groupName ?? null,
    group_has_verified_badge:
      typeof metadata?.groupHasVerifiedBadge === "boolean" ? metadata.groupHasVerifiedBadge : null,
    visibility: metadata?.visibility ?? null,
    privacy_type: metadata?.privacyType ?? null,
    is_active: typeof metadata?.isActive === "boolean" ? metadata.isActive : null,
    is_archived: typeof metadata?.isArchived === "boolean" ? metadata.isArchived : null,
    is_sponsored:
      typeof metadata?.isSponsored === "boolean"
        ? metadata.isSponsored
        : typeof game.isSponsoredGame === "boolean"
          ? game.isSponsoredGame
          : null,
    genre: genreValue ?? null,
    genre_l1: genreL1Value ?? null,
    genre_l2: genreL2Value ?? null,
    is_all_genre: typeof isAllGenreValue === "boolean" ? isAllGenreValue : null,
    age_rating: metadata?.ageRating ?? game.ageRecommendation ?? null,
    universe_avatar_type: game.universeAvatarType ?? null,
    desktop_enabled: typeof metadata?.desktopEnabled === "boolean" ? metadata.desktopEnabled : null,
    mobile_enabled: typeof metadata?.mobileEnabled === "boolean" ? metadata.mobileEnabled : null,
    tablet_enabled: typeof metadata?.tabletEnabled === "boolean" ? metadata.tabletEnabled : null,
    console_enabled: typeof metadata?.consoleEnabled === "boolean" ? metadata.consoleEnabled : null,
    vr_enabled: typeof metadata?.vrEnabled === "boolean" ? metadata.vrEnabled : null,
    voice_chat_enabled:
      typeof metadata?.voiceChatEnabled === "boolean"
        ? metadata.voiceChatEnabled
        : typeof game.voiceEnabled === "boolean"
          ? game.voiceEnabled
          : null,
    price: typeof game.price === "number" ? game.price : null,
    private_server_price_robux:
      typeof metadata?.privateServerPriceRobux === "number" ? metadata.privateServerPriceRobux : null,
    create_vip_servers_allowed:
      typeof metadata?.createVipServersAllowed === "boolean"
        ? metadata.createVipServersAllowed
        : typeof game.createVipServersAllowed === "boolean"
          ? game.createVipServersAllowed
          : null,
    studio_access_allowed:
      typeof metadata?.studioAccessAllowed === "boolean"
        ? metadata.studioAccessAllowed
        : typeof game.studioAccessToApisAllowed === "boolean"
          ? game.studioAccessToApisAllowed
          : null,
    server_size: typeof game.serverSize === "number" ? game.serverSize : null,
    max_players: typeof game.maxPlayers === "number" ? game.maxPlayers : null,
    playing,
    visits,
    favorites,
    likes,
    dislikes,
    created_at_api: createdAtApi,
    updated_at_api: updatedAtApi,
    raw_details: rawDetails,
    raw_metadata: rawMetadata,
    social_links: metadata?.socialLinks ?? {}
  };

  const displaySource = (payload.name as string | null) ?? `Universe ${game.id}`;
  const sanitizedDisplay = cleanRobloxUniverseDisplayName(displaySource);
  payload.display_name = sanitizedDisplay;
  const slugSource =
    sanitizedDisplay ?? (payload.name as string | null) ?? `universe-${game.id}`;
  payload.slug = slugify(slugSource) || `universe-${game.id}`;

  return payload as UniverseUpsertRecord;
}

function mergeWithExistingValues(
  incoming: UniverseUpsertRecord,
  existing?: UniverseDbRow | null
): UniverseUpsertRecord {
  if (!existing) return incoming;
  const lockedFields = new Set(["slug"]);
  const merged: Record<string, unknown> = { ...existing };

  for (const [key, value] of Object.entries(incoming)) {
    if (key === "universe_id") continue;

    if (key === "display_name") {
      const existingValue = existing[key];
      const incomingValue = typeof value === "string" ? value.trim() : null;
      const hasExistingValue =
        existingValue !== null &&
        existingValue !== undefined &&
        (typeof existingValue !== "string" || existingValue.trim().length > 0);
      if (hasExistingValue && !incomingValue) {
        continue; // keep existing display_name when the incoming clean value is empty
      }
    }

    if (lockedFields.has(key)) {
      const existingValue = existing[key];
      const hasValue =
        existingValue !== null &&
        existingValue !== undefined &&
        (typeof existingValue !== "string" || existingValue.trim().length > 0);
      if (hasValue) {
        continue; // keep existing locked values if set
      }
    }

    if (value === null || value === undefined) {
      continue; // do not overwrite existing with null/undefined
    }

    merged[key] = value;
  }

  return merged as UniverseUpsertRecord;
}

function normalizeThumbnailEntries(thumbnails: ThumbnailResponse["data"]) {
  const map = new Map<
    number,
    Array<{
      url: string;
      state?: string;
      type?: string;
      raw: Record<string, unknown>;
    }>
  >();

  if (!Array.isArray(thumbnails)) return map;
  for (const entry of thumbnails) {
    if (!entry || typeof entry !== "object") continue;
    const list: Array<{ url: string; state?: string; type?: string; raw: Record<string, unknown> }> = [];
    for (const thumb of entry.thumbnails ?? []) {
      if (!thumb) continue;
      const url = thumb.imageUrl;
      if (!url) continue;
      list.push({
        url,
        state: thumb.state,
        type: thumb.thumbnailType,
        raw: thumb as Record<string, unknown>
      });
    }
    map.set(entry.universeId, list);
  }
  return map;
}

function normalizeIconEntries(icons: IconResponse["data"]) {
  const map = new Map<
    number,
    {
      url: string;
      state?: string;
      raw: Record<string, unknown>;
    }
  >();
  if (!Array.isArray(icons)) return map;
  for (const icon of icons) {
    if (!icon) continue;
    const universeId = icon.universeId ?? icon.targetId;
    if (!universeId) continue;
    if (!icon.imageUrl) continue;
    map.set(universeId, { url: icon.imageUrl, state: icon.state, raw: icon as Record<string, unknown> });
  }
  return map;
}

type StoredThumbnail = { url: string; state?: string | null; type?: string | null };

function normalizeStoredThumbnails(value: unknown): StoredThumbnail[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): StoredThumbnail | null => {
      if (typeof entry === "string") return { url: entry };
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const url = typeof record.url === "string" ? record.url : typeof record.imageUrl === "string" ? record.imageUrl : null;
      if (!url) return null;
      return {
        url,
        state: typeof record.state === "string" ? record.state : null,
        type: typeof record.type === "string" ? record.type : null
      };
    })
    .filter((entry): entry is StoredThumbnail => entry != null);
}

async function upsertMedia(
  supabase = supabaseAdmin(),
  universeIds: number[],
  iconEntries: IconResponse["data"],
  thumbnailEntries: ThumbnailResponse["data"]
) {
  if (!universeIds.length) return { mediaRows: 0 };

  const iconMap = normalizeIconEntries(iconEntries);
  const thumbMap = normalizeThumbnailEntries(thumbnailEntries);

  const mediaRows: Array<{
    universe_id: number;
    media_type: "icon" | "screenshot" | "video";
    image_url: string;
    is_primary: boolean;
    extra: Record<string, unknown>;
  }> = [];

  const gameUpdates: Array<{
    universe_id: number;
    icon_url?: string | null;
    thumbnail_urls?: unknown;
  }> = [];
  const seenAt = nowIso();

  for (const universeId of universeIds) {
    const icon = iconMap.get(universeId);
    const thumbs = thumbMap.get(universeId) ?? [];

    if (icon) {
      mediaRows.push({
        universe_id: universeId,
        media_type: "icon",
        image_url: icon.url,
        is_primary: true,
        extra: {
          ...(icon.raw ?? {}),
          state: icon.state ?? null
        }
      });
    }

    thumbs.forEach((thumb, index) => {
      mediaRows.push({
        universe_id: universeId,
        media_type: "screenshot",
        image_url: thumb.url,
        is_primary: index === 0,
        extra: {
          ...(thumb.raw ?? {}),
          state: thumb.state ?? null,
          type: thumb.type ?? null
        }
      });
    });

    if (icon || thumbs.length) {
      gameUpdates.push({
        universe_id: universeId,
        icon_url: icon?.url ?? null,
        thumbnail_urls: thumbs.map((thumb) => ({
          url: thumb.url,
          state: thumb.state ?? null,
          type: thumb.type ?? null
        }))
      });
    }
  }

  if (mediaRows.length) {
    const { data: existingMedia, error: existingError } = await supabase
      .from("roblox_universe_media")
      .select("universe_id, media_type, image_url")
      .in("universe_id", universeIds)
      .not("image_url", "is", null);
    if (existingError) throw existingError;
    const existingKeys = new Set(
      ((existingMedia ?? []) as Array<{ universe_id: number; media_type: string; image_url: string | null }>).map(
        (row) => `${row.universe_id}:${row.media_type}:${row.image_url}`
      )
    );
    const freshRows = mediaRows
      .filter((row) => !existingKeys.has(`${row.universe_id}:${row.media_type}:${row.image_url}`))
      .map((row) => ({
        ...row,
        source: "roblox_thumbnails",
        first_seen_at: seenAt,
        last_seen_at: seenAt,
        fetched_at: seenAt
      }));
    const seenRows = mediaRows.filter((row) => existingKeys.has(`${row.universe_id}:${row.media_type}:${row.image_url}`));

    if (freshRows.length) {
      const { error } = await supabase.from("roblox_universe_media").insert(freshRows);
      if (error) throw error;
    }
    await promisePool(seenRows, ATTACHMENT_CONCURRENCY, async (row) => {
      const { error } = await supabase
        .from("roblox_universe_media")
        .update({
          last_seen_at: seenAt,
          fetched_at: seenAt,
          extra: row.extra
        })
        .eq("universe_id", row.universe_id)
        .eq("media_type", row.media_type)
        .eq("image_url", row.image_url);
      if (error) throw error;
    });
  }

  if (gameUpdates.length) {
    const { data: existingGames, error: existingGamesError } = await supabase
      .from("roblox_universes")
      .select("universe_id, icon_url, thumbnail_urls")
      .in(
        "universe_id",
        gameUpdates.map((update) => update.universe_id)
      );
    if (existingGamesError) throw existingGamesError;
    const existingById = new Map(
      ((existingGames ?? []) as Array<{ universe_id: number; icon_url: string | null; thumbnail_urls: unknown }>).map(
        (row) => [row.universe_id, row]
      )
    );

    await promisePool(gameUpdates, ATTACHMENT_CONCURRENCY, async (update) => {
      const existing = existingById.get(update.universe_id);
      const existingThumbs = normalizeStoredThumbnails(existing?.thumbnail_urls);
      const incomingThumbs = normalizeStoredThumbnails(update.thumbnail_urls);
      const mergedThumbs = Array.from(
        new Map([...existingThumbs, ...incomingThumbs].map((thumb) => [thumb.url, thumb])).values()
      );
      const updatePayload: Record<string, unknown> = {};
      if (!existing?.icon_url && update.icon_url) {
        updatePayload.icon_url = update.icon_url;
      }
      if (incomingThumbs.length) {
        updatePayload.thumbnail_urls = mergedThumbs;
      }
      if (!Object.keys(updatePayload).length) return;
      const { error } = await supabase.from("roblox_universes").update(updatePayload).eq("universe_id", update.universe_id);
      if (error) throw error;
    });
  }

  return { mediaRows: mediaRows.length };
}

async function promisePool<T>(items: T[], concurrency: number, handler: (item: T) => Promise<void>) {
  const executing: Promise<void>[] = [];
  for (const item of items) {
    const p = handler(item).finally(() => {
      const index = executing.indexOf(p);
      if (index >= 0) executing.splice(index, 1);
    });
    executing.push(p);
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.allSettled(executing);
}

type AttachmentTarget = {
  universeId: number;
  rootPlaceId: number | null;
};

function getGamePassIconId(pass: GamePass): number | null {
  return pass.iconImageId ?? pass.displayIconImageId ?? pass.displayIconImageAssetId ?? null;
}

function getBadgeIconId(badge: Badge): number | null {
  return badge.iconImageId ?? badge.displayIconImageId ?? null;
}

async function processAttachments(supabase: ReturnType<typeof supabaseAdmin>, targets: AttachmentTarget[]) {
  if (!targets.length) {
    return { passesCount: 0, badgesCount: 0, serversCount: 0 };
  }

  const passesByUniverse = new Map<number, GamePass[]>();
  const badgesByUniverse = new Map<number, Badge[]>();
  const serversByUniverse = new Map<number, { placeId: number; servers: PublicServer[] }>();

  await promisePool(targets, ATTACHMENT_CONCURRENCY, async (target) => {
    const [passes, badges] = await Promise.all([
      fetchGamePasses(target.universeId),
      fetchBadges(target.universeId)
    ]);

    if (passes?.length) {
      passesByUniverse.set(target.universeId, passes);
    }

    if (badges?.length) {
      badgesByUniverse.set(target.universeId, badges);
    }
  });

  await promisePool(targets, SERVER_CONCURRENCY, async (target) => {
    if (!target.rootPlaceId) return;
    const servers = await fetchPublicServers(target.rootPlaceId);
    if (target.rootPlaceId && servers?.length) {
      serversByUniverse.set(target.universeId, { placeId: target.rootPlaceId, servers });
    }
  });

  const assetIds: number[] = [];
  for (const passes of passesByUniverse.values()) {
    for (const pass of passes) {
      const iconId = getGamePassIconId(pass);
      if (iconId) assetIds.push(iconId);
    }
  }
  for (const badges of badgesByUniverse.values()) {
    for (const badge of badges) {
      const iconId = getBadgeIconId(badge);
      if (iconId) assetIds.push(iconId);
    }
  }
  const assetThumbnails = await fetchAssetThumbnails(assetIds);

  const passDeletes = Array.from(passesByUniverse.keys());
  if (passDeletes.length) {
    await supabase.from("roblox_universe_gamepasses").delete().in("universe_id", passDeletes);
  }
  const passRows: Array<{
    pass_id: number;
    universe_id: number;
    product_id: number | null;
    name: string | null;
    description: string | null;
    price: number | null;
    is_for_sale: boolean | null;
    sales: number | null;
    icon_image_id: number | null;
    icon_image_url: string | null;
    created_at_api: string | null;
    updated_at_api: string | null;
    raw_payload: unknown;
  }> = [];
  for (const [universeId, passes] of passesByUniverse.entries()) {
    for (const pass of passes) {
      const iconId = getGamePassIconId(pass);
      passRows.push({
        pass_id: pass.id,
        universe_id: universeId,
        product_id: pass.productId ?? null,
        name: pass.displayName ?? pass.name ?? null,
        description: pass.displayDescription ?? pass.description ?? null,
        price: pass.price ?? null,
        is_for_sale: typeof pass.isForSale === "boolean" ? pass.isForSale : null,
        sales: pass.sales ?? null,
        icon_image_id: iconId,
        icon_image_url: iconId ? assetThumbnails.get(iconId) ?? null : null,
        created_at_api: pass.created ?? null,
        updated_at_api: pass.updated ?? null,
        raw_payload: pass
      });
    }
  }
  if (passRows.length) {
    const { error } = await supabase.from("roblox_universe_gamepasses").insert(passRows);
    if (error) throw error;
  }

  const badgeDeletes = Array.from(badgesByUniverse.keys());
  if (badgeDeletes.length) {
    await supabase.from("roblox_universe_badges").delete().in("universe_id", badgeDeletes);
  }
  const badgeRows: Array<{
    badge_id: number;
    universe_id: number;
    name: string | null;
    description: string | null;
    icon_image_id: number | null;
    icon_image_url: string | null;
    awarding_badge_asset_id: number | null;
    enabled: boolean | null;
    awarded_count: number | null;
    awarded_past_day: number | null;
    awarded_past_week: number | null;
    rarity_percent: number | null;
    stats_updated_at: string | null;
    created_at_api: string | null;
    updated_at_api: string | null;
    raw_payload: unknown;
  }> = [];
  for (const [universeId, badges] of badgesByUniverse.entries()) {
    for (const badge of badges) {
      const stats = badge.statistics ?? {};
      const iconId = getBadgeIconId(badge);
      badgeRows.push({
        badge_id: badge.id,
        universe_id: universeId,
        name: badge.displayName ?? badge.name ?? null,
        description: badge.displayDescription ?? badge.description ?? null,
        icon_image_id: iconId,
        icon_image_url: iconId ? assetThumbnails.get(iconId) ?? null : null,
        awarding_badge_asset_id: badge.awardingBadgeAssetId ?? null,
        enabled: typeof badge.enabled === "boolean" ? badge.enabled : null,
        awarded_count: stats.awardedCount ?? null,
        awarded_past_day: stats.pastDayAwardedCount ?? null,
        awarded_past_week: stats.pastWeekAwardedCount ?? null,
        rarity_percent: badge.rarity ?? stats.winRatePercentage ?? null,
        stats_updated_at: null,
        created_at_api: badge.created ?? null,
        updated_at_api: badge.updated ?? null,
        raw_payload: badge
      });
    }
  }
  if (badgeRows.length) {
    const { error } = await supabase.from("roblox_universe_badges").insert(badgeRows);
    if (error) throw error;
  }

  const serverUniverseIds = Array.from(serversByUniverse.keys());
  if (serverUniverseIds.length) {
    await supabase.from("roblox_universe_place_servers").delete().in("universe_id", serverUniverseIds);
  }
  const fetchedAt = nowIso();
  const serverRows: Array<{
    place_id: number;
    universe_id: number;
    server_id: string;
    region: string | null;
    ping_ms: number | null;
    fps: number | null;
    player_count: number | null;
    max_players: number | null;
    player_list: unknown[];
    fetched_at: string;
  }> = [];
  for (const [universeId, { placeId, servers }] of serversByUniverse.entries()) {
    for (const server of servers) {
      if (!server.id) continue;
      serverRows.push({
        place_id: placeId,
        universe_id: universeId,
        server_id: server.id,
        region: typeof server.region === "string" ? server.region : null,
        ping_ms: typeof server.ping === "number" ? Math.round(server.ping) : null,
        fps: typeof server.fps === "number" ? server.fps : null,
        player_count: typeof server.playing === "number" ? server.playing : null,
        max_players: typeof server.maxPlayers === "number" ? server.maxPlayers : null,
        player_list: Array.isArray(server.players) ? server.players : [],
        fetched_at: fetchedAt
      });
    }
  }
  if (serverRows.length) {
    const { error } = await supabase.from("roblox_universe_place_servers").insert(serverRows);
    if (error) throw error;
  }

  return {
    passesCount: passRows.length,
    badgesCount: badgeRows.length,
    serversCount: serverRows.length
  };
}

async function processBatch(
  supabase: ReturnType<typeof supabaseAdmin>,
  universes: UniverseRow[],
  mode: EnrichmentMode
): Promise<{
  updatedGames: number;
  mediaRows: number;
  passesCount: number;
  badgesCount: number;
  serversCount: number;
  socialLinksCount: number;
  groupsSynced: number;
}> {
  if (!universes.length) {
    return {
      updatedGames: 0,
      mediaRows: 0,
      passesCount: 0,
      badgesCount: 0,
      serversCount: 0,
      socialLinksCount: 0,
      groupsSynced: 0
    };
  }

  const universeIds = universes.map((u) => u.universe_id);
  const [metadataMap, details] = await Promise.all([
    mode === "deep" ? fetchUniverseMetadata(universeIds) : Promise.resolve(new Map<number, UniverseMetadata>()),
    fetchGameDetails(universeIds)
  ]);
  const rootMap = new Map(universes.map((u) => [u.universe_id, u.root_place_id]));
  for (const [id, meta] of metadataMap.entries()) {
    if (meta.rootPlaceId) {
      rootMap.set(id, meta.rootPlaceId);
    }
  }
  const needsLookup = details
    .filter((detail) => {
      const existing = rootMap.get(detail.id);
      return (detail.rootPlaceId == null || detail.rootPlaceId === 0) && (existing == null || existing === 0);
    })
    .map((detail) => detail.id);

  if (needsLookup.length) {
    const { data, error } = await supabase
      .from("roblox_universes")
      .select("universe_id, root_place_id")
      .in("universe_id", needsLookup);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.root_place_id) {
        rootMap.set(row.universe_id, row.root_place_id);
      }
    }
  }

  const missingRootIds: number[] = [];
  const enrichedAt = nowIso();
  const upsertPayload = details
    .map((detail) => {
      const metadata = metadataMap.get(detail.id);
      const fallbackRoot = rootMap.get(detail.id) ?? null;
      if (fallbackRoot == null && (detail.rootPlaceId == null || detail.rootPlaceId === 0)) {
        missingRootIds.push(detail.id);
        return null;
      }
      const mapped = mapGameDetail(detail, fallbackRoot, metadata);
      if (mapped) {
        mapped.last_light_enriched_at = enrichedAt;
        if (mode === "deep") {
          mapped.last_deep_enriched_at = enrichedAt;
        }
      }
      return mapped;
    })
    .filter((value): value is NonNullable<typeof value> => value != null);
  const skipped = details.length - upsertPayload.length;
  if (skipped > 0) {
    console.warn(
      `⚠️ Skipped ${skipped} universes due to missing root place IDs. Examples: ${missingRootIds.slice(0, 5).join(", ")}`
    );
  }

  let existingMap = new Map<number, UniverseDbRow>();
  if (upsertPayload.length) {
    const ids = upsertPayload.map((payload) => payload.universe_id);
    const { data: existingRows, error: existingError } = await supabase
      .from("roblox_universes")
      .select("*")
      .in("universe_id", ids);
    if (existingError) throw existingError;
  const existingArray = (existingRows as UniverseDbRow[] | null) ?? [];
  existingMap = new Map(existingArray.map((row) => [row.universe_id, row]));
}

const mergedPayload = upsertPayload.map((payload) =>
  mergeWithExistingValues(payload, existingMap.get(payload.universe_id))
);

if (mergedPayload.length) {
  const { error } = await supabase.from("roblox_universes").upsert(mergedPayload, { onConflict: "universe_id" });
  if (error) throw error;
}

const processedUniverseIds = mergedPayload.map((payload) => payload.universe_id);

  // Legacy escape hatch only. Daily public stats now come from hourly rollups.
  if (WRITE_LEGACY_DAILY_STATS && mergedPayload.length) {
    const today = new Date().toISOString().slice(0, 10);
    const idsForStats = processedUniverseIds;
    const { data: existingStats, error: statsError } = await supabase
      .from("roblox_universe_stats_daily")
      .select("universe_id")
      .eq("stat_date", today)
      .in("universe_id", idsForStats);
    if (statsError) throw statsError;
    const existingStatsSet = new Set<number>((existingStats ?? []).map((row: any) => row.universe_id));

    const statRows = mergedPayload
      .filter((p) => !existingStatsSet.has(p.universe_id))
      .map((p) => {
        const snapshot: Record<string, unknown> = {};
        const apply = (key: "playing" | "visits" | "favorites" | "likes" | "dislikes", value: unknown) => {
          if (value === null || value === undefined) return;
          snapshot[key] = value;
        };
        apply("playing", p.playing);
        apply("visits", p.visits);
        apply("favorites", p.favorites);
        apply("likes", p.likes);
        apply("dislikes", p.dislikes);
        return {
          universe_id: p.universe_id,
          stat_date: today,
          playing: (snapshot.playing as number | null) ?? null,
          visits: (snapshot.visits as number | null) ?? null,
          favorites: (snapshot.favorites as number | null) ?? null,
          likes: (snapshot.likes as number | null) ?? null,
          dislikes: (snapshot.dislikes as number | null) ?? null,
          snapshot
        };
      })
      .filter((row) => Object.keys(row.snapshot).length > 0);

    if (statRows.length) {
      const { error: statInsertError } = await supabase
        .from("roblox_universe_stats_daily")
        .insert(statRows);
      if (statInsertError && !statInsertError.message.includes("duplicate key")) {
        throw statInsertError;
      }
    }
  }

const [icons, thumbs] = await Promise.all([
  fetchGameIcons(processedUniverseIds),
  fetchGameThumbnails(processedUniverseIds)
]);
  const mediaStats = await upsertMedia(supabase, processedUniverseIds, icons, thumbs);

  const attachments =
    mode === "deep"
      ? await processAttachments(
          supabase,
          mergedPayload.map((payload) => ({
            universeId: payload.universe_id,
            rootPlaceId: typeof payload.root_place_id === "number" ? payload.root_place_id : null
          }))
        )
      : { passesCount: 0, badgesCount: 0, serversCount: 0 };

  const metadataUniverseIds = processedUniverseIds.filter((id) => metadataMap.has(id));
  const metadataSubset = new Map<number, UniverseMetadata>();
  for (const id of metadataUniverseIds) {
    const meta = metadataMap.get(id);
    if (meta) {
      metadataSubset.set(id, meta);
    }
  }

  const socialLinksCount = mode === "deep" ? await syncSocialLinks(supabase, metadataUniverseIds, metadataMap) : 0;
  const groupsSynced = mode === "deep" ? await syncGroups(supabase, metadataSubset) : 0;

  return {
    updatedGames: upsertPayload.length,
    mediaRows: mediaStats.mediaRows,
    passesCount: attachments.passesCount,
    badgesCount: attachments.badgesCount,
    serversCount: attachments.serversCount,
    socialLinksCount,
    groupsSynced
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string | number | boolean> = {};
  const universeIds: number[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--limit" || arg === "-l") {
      options.limit = Number(args[i + 1]);
      i += 1;
    } else if (arg === "--batch" || arg === "-b") {
      options.batch = Number(args[i + 1]);
      i += 1;
    } else if (arg === "--mode" || arg === "-m") {
      options.mode = args[i + 1];
      i += 1;
    } else if (arg === "--quality-only") {
      options.tier = "HOT";
    } else if (arg === "--universe-id" || arg === "--id") {
      const parsed = Number(args[i + 1]);
      if (Number.isSafeInteger(parsed) && parsed > 0) universeIds.push(parsed);
      i += 1;
    } else if (arg === "--universe-ids" || arg === "--ids") {
      const values = String(args[i + 1] ?? "")
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isSafeInteger(value) && value > 0);
      universeIds.push(...values);
      i += 1;
    } else if (arg === "--tier") {
      const tier = String(args[i + 1] ?? "").toUpperCase();
      if (tier === "ALL" || isStatsTier(tier)) {
        options.tier = tier;
      } else {
        throw new Error(`Invalid --tier value: ${tier}. Use NEW, HOT, WARM, COLD, or ALL.`);
      }
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }
  if (universeIds.length) options.universeIds = Array.from(new Set(universeIds)).join(",");
  return options;
}

function parseMode(value: unknown): EnrichmentMode {
  if (value === "light" || value === "deep") return value;
  const envMode = process.env.ROBLOX_ENRICH_MODE;
  if (envMode === "light" || envMode === "deep") return envMode;
  return "deep";
}

function printHelp() {
  console.log(`
Usage: npm run enrich:universes -- [options]

Options:
  -l, --limit <number>   Total universes to process (default: ${DEFAULT_TOTAL_LIMIT})
  -b, --batch <number>   Batch size per Roblox API request (default: ${BATCH_SIZE})
  -m, --mode <mode>      light = details/media only; deep = Open Cloud, links, passes, badges, servers (default: deep)
  --tier <tier>          Only process NEW, HOT, WARM, COLD, or ALL rows (default: ALL)
  --universe-id <id>     Process one universe id directly
  --universe-ids <ids>   Process comma-separated universe ids directly
  -h, --help             Show this help text
`);
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const totalLimit =
    typeof options.limit === "number" && !Number.isNaN(options.limit) && options.limit > 0
      ? options.limit
      : DEFAULT_TOTAL_LIMIT;
  const batchSize =
    typeof options.batch === "number" && !Number.isNaN(options.batch) && options.batch > 0 ? options.batch : BATCH_SIZE;
  const mode = parseMode(options.mode);
  const tier = typeof options.tier === "string" && (options.tier === "ALL" || isStatsTier(options.tier)) ? options.tier : "ALL";
  const universeIds =
    typeof options.universeIds === "string"
      ? options.universeIds
          .split(",")
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isSafeInteger(value) && value > 0)
      : [];

  const supabase = supabaseAdmin();
  const targetDescription = universeIds.length
    ? `${universeIds.length} targeted`
    : totalLimit > 0
      ? `${totalLimit}`
      : "all available";
  console.log(
    `🚀 Enriching ${targetDescription} universes (${mode} mode, tier=${tier}, batch size ${batchSize}, attachment concurrency ${ATTACHMENT_CONCURRENCY}, server concurrency ${SERVER_CONCURRENCY})`
  );
  console.log(`🎯 Supabase target: ${supabaseHost()} (NODE_ENV=${process.env.NODE_ENV ?? "development"})`);

  let processed = 0;
  let pageOffset = 0;
  let pageIndex = 0;

  while (true) {
    const remaining = totalLimit > 0 ? Math.max(totalLimit - processed, 0) : SUPABASE_PAGE_LIMIT;
    if (totalLimit > 0 && remaining <= 0) break;
    const pageSize =
      totalLimit > 0 ? Math.min(SUPABASE_PAGE_LIMIT, Math.max(remaining, 0)) : SUPABASE_PAGE_LIMIT;
    const fetchSize =
      tier !== "ALL" && pageSize > 0
        ? Math.min(SUPABASE_PAGE_LIMIT, Math.max(pageSize, MIN_TIERED_ENRICHMENT_PAGE_SIZE))
        : pageSize;

    const page = await fetchUniversePage(pageOffset, fetchSize, mode, tier, universeIds);
    if (!page.length) break;

    for (let i = 0; i < page.length; i += batchSize) {
      const chunk = page.slice(i, i + batchSize);
      const stats = await processBatch(supabase, chunk, mode);
      processed += chunk.length;
      console.log(
        ` • Page ${pageIndex + 1}, batch ${Math.floor(i / batchSize) + 1} — universes: ${chunk.length}, updated: ${stats.updatedGames}, media rows: ${stats.mediaRows}, passes: ${stats.passesCount}, badges: ${stats.badgesCount}, servers: ${stats.serversCount}, social: ${stats.socialLinksCount}, groups: ${stats.groupsSynced}`
      );
      await sleep(BATCH_DELAY_MS);
      if (totalLimit > 0 && processed >= totalLimit) {
        break;
      }
    }

    pageOffset += page.length;
    pageIndex += 1;

    if (totalLimit > 0 && processed >= totalLimit) {
      break;
    }
    if (page.length < pageSize) {
      break;
    }
  }

  if (processed === 0) {
    console.log("ℹ️ No universes found to enrich.");
    return;
  }

  console.log(`✅ Finished enriching ${processed} universes.`);
}

main().catch((error) => {
  console.error("❌ Universe enrichment failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
