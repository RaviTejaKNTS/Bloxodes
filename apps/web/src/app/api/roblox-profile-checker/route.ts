import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";

export const runtime = "nodejs";

const USER_AGENT =
  process.env.ROBLOX_SCRAPER_UA ??
  "BloxodesProfileChecker/1.0 (+https://bloxodes.com; contact@bloxodes.com)";

const WARNING_RATE_LIMIT = "Roblox rate limit reached. Some sections may be incomplete.";
const WARNING_UNAVAILABLE = "Part of the Roblox API was unavailable. Some sections may be incomplete.";

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const COLLECTIBLE_PAGE_LIMIT = 3;
const UPSTREAM_TIMEOUT_MS = 8000;
const OVERALL_DEADLINE_MS = 12_000;
const LOOKUP_RATE_LIMIT = { limit: 10, windowMs: 60_000 };

type FetchResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; rateLimited: boolean };

type ProfileCore = {
  userId: number;
  username: string;
  displayName: string;
  description: string | null;
  created: string | null;
  isBanned: boolean;
  hasVerifiedBadge: boolean;
  avatarUrl: string | null;
  headshotUrl: string | null;
};

type ProfileStats = {
  friends: number | null;
  followers: number | null;
  following: number | null;
  totalPlaceVisits: number | null;
};

type PresenceInfo = {
  status: "offline" | "online" | "in-game" | "in-studio" | "invisible";
  lastLocation: string | null;
};

type WornItem = {
  assetId: number;
  name: string;
  assetType: string;
  imageUrl: string | null;
};

type CollectibleItem = {
  assetId: number;
  name: string;
  recentAveragePrice: number | null;
  serialNumber: number | null;
  imageUrl: string | null;
};

type CollectiblesInfo = {
  canView: boolean;
  totalRap: number | null;
  rapIsPartial: boolean;
  itemCount: number;
  items: CollectibleItem[];
};

type GroupMembership = {
  groupId: number;
  name: string;
  memberCount: number | null;
  role: string | null;
  rank: number | null;
  hasVerifiedBadge: boolean;
  imageUrl: string | null;
};

type PlatformBadge = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
};

type GameEntry = {
  universeId: number;
  rootPlaceId: number | null;
  name: string;
  placeVisits: number | null;
  imageUrl: string | null;
};

type SocialLinks = Record<string, string>;

type ProfileResponseOk = {
  ok: true;
  profile: ProfileCore;
  stats: ProfileStats;
  presence: PresenceInfo | null;
  previousUsernames: string[];
  wearing: WornItem[];
  collectibles: CollectiblesInfo;
  groups: GroupMembership[];
  robloxBadges: PlatformBadge[];
  socialLinks: SocialLinks;
  createdGames: GameEntry[];
  favoriteGames: GameEntry[];
  profileUrl: string;
  warnings: string[];
};

type ProfileSuggestion = {
  username: string;
  displayName: string;
  hasVerifiedBadge: boolean;
};

type ProfileResponseError = {
  ok: false;
  error: { code: string; message: string; hint?: string };
  suggestions?: ProfileSuggestion[];
};

type CacheEntry = { expires: number; payload: ProfileResponseOk };

const responseCache = new Map<string, CacheEntry>();

function readCache(key: string): ProfileResponseOk | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return entry.payload;
}

function writeCache(key: string, payload: ProfileResponseOk) {
  if (responseCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = responseCache.keys().next().value;
    if (oldest !== undefined) responseCache.delete(oldest);
  }
  responseCache.set(key, { expires: Date.now() + CACHE_TTL_MS, payload });
}

async function fetchRobloxJson<T>(url: string, deadline: number, init?: RequestInit): Promise<FetchResult<T>> {
  const timeoutMs = Math.min(UPSTREAM_TIMEOUT_MS, deadline - Date.now());
  if (timeoutMs <= 0) {
    return { ok: false, status: 0, error: "Overall lookup deadline exceeded", rateLimited: false };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": USER_AGENT,
        ...(init?.headers ?? {})
      }
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: text.slice(0, 300),
        rateLimited: res.status === 429
      };
    }
    const data = text ? (JSON.parse(text) as T) : ({} as T);
    return { ok: true, status: res.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Network error",
      rateLimited: false
    };
  } finally {
    clearTimeout(timeout);
  }
}

function addWarning(warnings: string[], message: string) {
  if (!warnings.includes(message)) warnings.push(message);
}

function noteFailure(warnings: string[], res: FetchResult<unknown>) {
  if (res.ok) return;
  if (res.rateLimited) {
    addWarning(warnings, WARNING_RATE_LIMIT);
  } else if (res.status !== 403 && res.status !== 404) {
    addWarning(warnings, WARNING_UNAVAILABLE);
  }
}

function isValidUsername(value: string): boolean {
  return /^[0-9A-Za-z_]{3,20}$/.test(value);
}

type ThumbnailEntry = { targetId?: number; imageUrl?: string; state?: string };
type ThumbnailResponse = { data?: ThumbnailEntry[] };

function thumbnailMap(res: FetchResult<ThumbnailResponse>): Map<number, string> {
  const map = new Map<number, string>();
  if (!res.ok) return map;
  for (const entry of res.data.data ?? []) {
    if (entry.targetId && entry.imageUrl && entry.state === "Completed") {
      map.set(entry.targetId, entry.imageUrl);
    }
  }
  return map;
}

async function fetchAssetThumbnails(assetIds: number[], warnings: string[], deadline: number): Promise<Map<number, string>> {
  if (!assetIds.length) return new Map();
  const params = new URLSearchParams({
    assetIds: assetIds.slice(0, 100).join(","),
    size: "150x150",
    format: "Png",
    isCircular: "false"
  });
  const res = await fetchRobloxJson<ThumbnailResponse>(`https://thumbnails.roblox.com/v1/assets?${params}`, deadline);
  noteFailure(warnings, res);
  return thumbnailMap(res);
}

async function fetchGameIcons(universeIds: number[], warnings: string[], deadline: number): Promise<Map<number, string>> {
  if (!universeIds.length) return new Map();
  const params = new URLSearchParams({
    universeIds: universeIds.slice(0, 100).join(","),
    size: "256x256",
    format: "Png",
    isCircular: "false"
  });
  const res = await fetchRobloxJson<ThumbnailResponse>(`https://thumbnails.roblox.com/v1/games/icons?${params}`, deadline);
  noteFailure(warnings, res);
  return thumbnailMap(res);
}

async function fetchGroupIcons(groupIds: number[], warnings: string[], deadline: number): Promise<Map<number, string>> {
  if (!groupIds.length) return new Map();
  const params = new URLSearchParams({
    groupIds: groupIds.slice(0, 100).join(","),
    size: "150x150",
    format: "Png",
    isCircular: "false"
  });
  const res = await fetchRobloxJson<ThumbnailResponse>(`https://thumbnails.roblox.com/v1/groups/icons?${params}`, deadline);
  noteFailure(warnings, res);
  return thumbnailMap(res);
}

type ResolvedUser = { id: number; name: string; displayName: string };

async function resolveUsername(
  username: string,
  deadline: number
): Promise<{ user: ResolvedUser | null; suggestions: ProfileSuggestion[]; rateLimited: boolean }> {
  const res = await fetchRobloxJson<{ data?: Array<{ id?: number; name?: string; displayName?: string }> }>(
    "https://users.roblox.com/v1/usernames/users",
    deadline,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
    }
  );

  if (!res.ok) {
    return { user: null, suggestions: [], rateLimited: res.rateLimited };
  }

  const entry = res.data.data?.[0];
  if (entry?.id && entry.name) {
    return {
      user: { id: entry.id, name: entry.name, displayName: entry.displayName ?? entry.name },
      suggestions: [],
      rateLimited: false
    };
  }

  const searchParamsObj = new URLSearchParams({ keyword: username, limit: "10" });
  const search = await fetchRobloxJson<{
    data?: Array<{ name?: string; displayName?: string; hasVerifiedBadge?: boolean }>;
  }>(`https://users.roblox.com/v1/users/search?${searchParamsObj}`, deadline);

  const suggestions: ProfileSuggestion[] = [];
  if (search.ok) {
    for (const item of search.data.data ?? []) {
      if (item.name) {
        suggestions.push({
          username: item.name,
          displayName: item.displayName ?? item.name,
          hasVerifiedBadge: Boolean(item.hasVerifiedBadge)
        });
      }
      if (suggestions.length >= 5) break;
    }
  }

  return { user: null, suggestions, rateLimited: false };
}

async function fetchCollectibles(userId: number, warnings: string[], deadline: number): Promise<CollectiblesInfo> {
  const canViewRes = await fetchRobloxJson<{ canView?: boolean }>(
    `https://inventory.roblox.com/v1/users/${userId}/can-view-inventory`,
    deadline
  );
  noteFailure(warnings, canViewRes);
  const canView = canViewRes.ok ? Boolean(canViewRes.data.canView) : false;
  if (!canView) {
    return { canView: false, totalRap: null, rapIsPartial: false, itemCount: 0, items: [] };
  }

  type CollectiblePage = {
    nextPageCursor?: string | null;
    data?: Array<{
      assetId?: number;
      name?: string;
      recentAveragePrice?: number;
      serialNumber?: number;
    }>;
  };

  const items: CollectibleItem[] = [];
  let cursor: string | null = null;
  let rapIsPartial = false;

  for (let page = 0; page < COLLECTIBLE_PAGE_LIMIT; page += 1) {
    if (Date.now() >= deadline) {
      rapIsPartial = true;
      break;
    }
    const params = new URLSearchParams({ limit: "100", sortOrder: "Asc" });
    if (cursor) params.set("cursor", cursor);
    const res = await fetchRobloxJson<CollectiblePage>(
      `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?${params}`,
      deadline
    );
    if (!res.ok) {
      noteFailure(warnings, res);
      break;
    }
    for (const entry of res.data.data ?? []) {
      if (!entry.assetId || !entry.name) continue;
      items.push({
        assetId: entry.assetId,
        name: entry.name,
        recentAveragePrice: typeof entry.recentAveragePrice === "number" ? entry.recentAveragePrice : null,
        serialNumber: typeof entry.serialNumber === "number" && entry.serialNumber > 0 ? entry.serialNumber : null,
        imageUrl: null
      });
    }
    cursor = res.data.nextPageCursor ?? null;
    if (!cursor) break;
    if (page === COLLECTIBLE_PAGE_LIMIT - 1) rapIsPartial = true;
  }

  const totalRap = items.reduce((sum, item) => sum + (item.recentAveragePrice ?? 0), 0);
  items.sort((a, b) => (b.recentAveragePrice ?? 0) - (a.recentAveragePrice ?? 0));
  const topItems = items.slice(0, 24);
  const thumbs = await fetchAssetThumbnails(
    topItems.map((item) => item.assetId),
    warnings,
    deadline
  );
  for (const item of topItems) {
    item.imageUrl = thumbs.get(item.assetId) ?? null;
  }

  return {
    canView: true,
    totalRap,
    rapIsPartial,
    itemCount: items.length,
    items: topItems
  };
}

function presenceFromType(type: number | undefined, lastLocation: string | null): PresenceInfo | null {
  switch (type) {
    case 0:
      return { status: "offline", lastLocation };
    case 1:
      return { status: "online", lastLocation };
    case 2:
      return { status: "in-game", lastLocation };
    case 3:
      return { status: "in-studio", lastLocation };
    case 4:
      return { status: "invisible", lastLocation };
    default:
      return null;
  }
}

async function buildProfile(user: ResolvedUser, deadline: number): Promise<ProfileResponseOk> {
  const warnings: string[] = [];
  const userId = user.id;

  type UserDetail = {
    name?: string;
    displayName?: string;
    description?: string;
    created?: string;
    isBanned?: boolean;
    hasVerifiedBadge?: boolean;
  };
  type CountResponse = { count?: number };
  type UsernameHistoryPage = { data?: Array<{ name?: string }> };
  type AvatarDetail = {
    assets?: Array<{ id?: number; name?: string; assetType?: { name?: string } }>;
  };
  type GroupRolesResponse = {
    data?: Array<{
      group?: { id?: number; name?: string; memberCount?: number; hasVerifiedBadge?: boolean };
      role?: { name?: string; rank?: number };
    }>;
  };
  type RobloxBadgesResponse = Array<{ id?: number; name?: string; description?: string; imageUrl?: string }>;
  type PromotionChannels = Record<string, string | null>;
  type GamesPage = {
    nextPageCursor?: string | null;
    data?: Array<{
      id?: number;
      name?: string;
      rootPlace?: { id?: number };
      placeVisits?: number;
    }>;
  };
  type PresenceResponse = {
    userPresences?: Array<{ userPresenceType?: number; lastLocation?: string }>;
  };

  const [
    detailRes,
    friendsRes,
    followersRes,
    followingRes,
    headshotRes,
    fullBodyRes,
    avatarRes,
    historyRes,
    groupsRes,
    badgesRes,
    socialRes,
    gamesRes,
    favoritesRes,
    presenceRes,
    collectibles
  ] = await Promise.all([
    fetchRobloxJson<UserDetail>(`https://users.roblox.com/v1/users/${userId}`, deadline),
    fetchRobloxJson<CountResponse>(`https://friends.roblox.com/v1/users/${userId}/friends/count`, deadline),
    fetchRobloxJson<CountResponse>(`https://friends.roblox.com/v1/users/${userId}/followers/count`, deadline),
    fetchRobloxJson<CountResponse>(`https://friends.roblox.com/v1/users/${userId}/followings/count`, deadline),
    fetchRobloxJson<ThumbnailResponse>(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`,
      deadline
    ),
    fetchRobloxJson<ThumbnailResponse>(
      `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`,
      deadline
    ),
    fetchRobloxJson<AvatarDetail>(`https://avatar.roblox.com/v1/users/${userId}/avatar`, deadline),
    fetchRobloxJson<UsernameHistoryPage>(
      `https://users.roblox.com/v1/users/${userId}/username-history?limit=100&sortOrder=Desc`,
      deadline
    ),
    fetchRobloxJson<GroupRolesResponse>(`https://groups.roblox.com/v2/users/${userId}/groups/roles`, deadline),
    fetchRobloxJson<RobloxBadgesResponse>(
      `https://accountinformation.roblox.com/v1/users/${userId}/roblox-badges`,
      deadline
    ),
    fetchRobloxJson<PromotionChannels>(
      `https://accountinformation.roblox.com/v1/users/${userId}/promotion-channels`,
      deadline
    ),
    fetchRobloxJson<GamesPage>(`https://games.roblox.com/v2/users/${userId}/games?limit=50&sortOrder=Desc`, deadline),
    fetchRobloxJson<GamesPage>(
      `https://games.roblox.com/v2/users/${userId}/favorite/games?limit=10&sortOrder=Desc`,
      deadline
    ),
    fetchRobloxJson<PresenceResponse>("https://presence.roblox.com/v1/presence/users", deadline, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userIds: [userId] })
    }),
    fetchCollectibles(userId, warnings, deadline)
  ]);

  for (const res of [
    detailRes,
    friendsRes,
    followersRes,
    followingRes,
    headshotRes,
    fullBodyRes,
    avatarRes,
    historyRes,
    groupsRes,
    badgesRes,
    socialRes,
    gamesRes,
    favoritesRes,
    presenceRes
  ]) {
    noteFailure(warnings, res);
  }

  const detail = detailRes.ok ? detailRes.data : null;
  const profile: ProfileCore = {
    userId,
    username: detail?.name ?? user.name,
    displayName: detail?.displayName ?? user.displayName,
    description: detail?.description?.trim() ? detail.description.trim() : null,
    created: detail?.created ?? null,
    isBanned: Boolean(detail?.isBanned),
    hasVerifiedBadge: Boolean(detail?.hasVerifiedBadge),
    avatarUrl: fullBodyRes.ok ? fullBodyRes.data.data?.[0]?.imageUrl ?? null : null,
    headshotUrl: headshotRes.ok ? headshotRes.data.data?.[0]?.imageUrl ?? null : null
  };

  const createdGamesRaw = gamesRes.ok ? gamesRes.data.data ?? [] : [];
  const totalPlaceVisits = createdGamesRaw.length
    ? createdGamesRaw.reduce((sum, game) => sum + (game.placeVisits ?? 0), 0)
    : null;

  const stats: ProfileStats = {
    friends: friendsRes.ok ? friendsRes.data.count ?? null : null,
    followers: followersRes.ok ? followersRes.data.count ?? null : null,
    following: followingRes.ok ? followingRes.data.count ?? null : null,
    totalPlaceVisits
  };

  const presenceEntry = presenceRes.ok ? presenceRes.data.userPresences?.[0] : undefined;
  const presence = presenceFromType(presenceEntry?.userPresenceType, presenceEntry?.lastLocation ?? null);

  const previousUsernames = historyRes.ok
    ? (historyRes.data.data ?? []).map((entry) => entry.name).filter((name): name is string => Boolean(name))
    : [];

  const wornAssets = avatarRes.ok ? avatarRes.data.assets ?? [] : [];
  const wearing: WornItem[] = wornAssets
    .filter((asset) => asset.id && asset.name)
    .filter((asset) => !(asset.assetType?.name ?? "").endsWith("Animation"))
    .map((asset) => ({
      assetId: asset.id as number,
      name: asset.name as string,
      assetType: asset.assetType?.name ?? "Item",
      imageUrl: null
    }));

  const groupsRaw = groupsRes.ok ? groupsRes.data.data ?? [] : [];
  const groups: GroupMembership[] = groupsRaw
    .filter((entry) => entry.group?.id && entry.group?.name)
    .slice(0, 50)
    .map((entry) => ({
      groupId: entry.group?.id as number,
      name: entry.group?.name as string,
      memberCount: entry.group?.memberCount ?? null,
      role: entry.role?.name ?? null,
      rank: entry.role?.rank ?? null,
      hasVerifiedBadge: Boolean(entry.group?.hasVerifiedBadge),
      imageUrl: null
    }));
  groups.sort((a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0));

  const robloxBadges: PlatformBadge[] = badgesRes.ok
    ? (badgesRes.data ?? [])
        .filter((badge) => badge.id && badge.name)
        .map((badge) => ({
          id: badge.id as number,
          name: badge.name as string,
          description: badge.description ?? null,
          imageUrl: badge.imageUrl ?? null
        }))
    : [];

  const socialLinks: SocialLinks = {};
  if (socialRes.ok) {
    for (const [key, value] of Object.entries(socialRes.data ?? {})) {
      if (typeof value === "string" && value.trim()) {
        socialLinks[key] = value.trim();
      }
    }
  }

  const favoriteGamesRaw = favoritesRes.ok ? favoritesRes.data.data ?? [] : [];
  const universeIds = [
    ...createdGamesRaw.map((game) => game.id).filter((id): id is number => Boolean(id)),
    ...favoriteGamesRaw.map((game) => game.id).filter((id): id is number => Boolean(id))
  ];

  const [wearingThumbs, groupThumbs, gameIcons] = await Promise.all([
    fetchAssetThumbnails(
      wearing.map((item) => item.assetId),
      warnings,
      deadline
    ),
    fetchGroupIcons(
      groups.slice(0, 24).map((group) => group.groupId),
      warnings,
      deadline
    ),
    fetchGameIcons(universeIds, warnings, deadline)
  ]);

  for (const item of wearing) {
    item.imageUrl = wearingThumbs.get(item.assetId) ?? null;
  }
  for (const group of groups) {
    group.imageUrl = groupThumbs.get(group.groupId) ?? null;
  }

  const toGameEntry = (game: { id?: number; name?: string; rootPlace?: { id?: number }; placeVisits?: number }) => ({
    universeId: game.id as number,
    rootPlaceId: game.rootPlace?.id ?? null,
    name: game.name ?? "Untitled experience",
    placeVisits: typeof game.placeVisits === "number" ? game.placeVisits : null,
    imageUrl: game.id ? gameIcons.get(game.id) ?? null : null
  });

  const createdGames: GameEntry[] = createdGamesRaw.filter((game) => game.id).map(toGameEntry);
  const favoriteGames: GameEntry[] = favoriteGamesRaw.filter((game) => game.id).map(toGameEntry);

  return {
    ok: true,
    profile,
    stats,
    presence,
    previousUsernames,
    wearing,
    collectibles,
    groups,
    robloxBadges,
    socialLinks,
    createdGames,
    favoriteGames,
    profileUrl: `https://www.roblox.com/users/${userId}/profile`,
    warnings
  };
}

type LookupOutcome =
  | { status: 200; body: ProfileResponseOk }
  | { status: number; body: ProfileResponseError };

const inflightLookups = new Map<string, Promise<LookupOutcome>>();

async function performLookup(username: string, cacheKey: string): Promise<LookupOutcome> {
  const deadline = Date.now() + OVERALL_DEADLINE_MS;

  const resolved = await resolveUsername(username, deadline);
  if (!resolved.user) {
    if (resolved.rateLimited) {
      return {
        status: 429,
        body: {
          ok: false,
          error: {
            code: "RATE_LIMITED",
            message: "Roblox is rate limiting lookups right now.",
            hint: "Wait a few seconds and try again."
          }
        }
      };
    }
    return {
      status: 404,
      body: {
        ok: false,
        error: {
          code: "USER_NOT_FOUND",
          message: `No Roblox account matches the username "${username}".`,
          hint: resolved.suggestions.length ? "Did you mean one of these?" : "Check the spelling and try again."
        },
        suggestions: resolved.suggestions.length ? resolved.suggestions : undefined
      }
    };
  }

  const payload = await buildProfile(resolved.user, deadline);
  writeCache(cacheKey, payload);
  return { status: 200, body: payload };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = String(searchParams.get("username") ?? "")
    .trim()
    .replace(/^@+/, "");

  if (!username) {
    return NextResponse.json<ProfileResponseError>(
      { ok: false, error: { code: "MISSING_USERNAME", message: "Enter a Roblox username." } },
      { status: 400 }
    );
  }

  if (!isValidUsername(username)) {
    return NextResponse.json<ProfileResponseError>(
      {
        ok: false,
        error: {
          code: "INVALID_USERNAME",
          message: "Roblox usernames are 3 to 20 characters using letters, numbers, and underscores."
        }
      },
      { status: 400 }
    );
  }

  const cacheKey = username.toLowerCase();
  const cached = readCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  let pending = inflightLookups.get(cacheKey);
  if (!pending) {
    const rateLimit = checkRateLimit({
      key: `roblox-profile-checker:${getRequestIp(request)}`,
      ...LOOKUP_RATE_LIMIT
    });
    if (!rateLimit.allowed) {
      return NextResponse.json<ProfileResponseError>(
        {
          ok: false,
          error: {
            code: "TOO_MANY_LOOKUPS",
            message: "Too many profile lookups in a short time.",
            hint: `Wait ${rateLimit.retryAfterSeconds} seconds and try again.`
          }
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) }
        }
      );
    }

    pending = performLookup(username, cacheKey).finally(() => {
      inflightLookups.delete(cacheKey);
    });
    inflightLookups.set(cacheKey, pending);
  }

  const outcome = await pending;
  return NextResponse.json(outcome.body, { status: outcome.status });
}
