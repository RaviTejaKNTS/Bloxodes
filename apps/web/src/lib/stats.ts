import "server-only";
import { unstable_noStore as noStore } from "next/cache";
import { formatAgeRating } from "@/lib/age-rating";
import { supabaseAdmin } from "@/lib/supabase";
export { formatCompactNumber, formatFullNumber, formatPercent } from "@/lib/stats-format";

export const STATS_PAGE_SIZE = 50;
export const STATS_DESCRIPTION =
  "Live Roblox game stats tracked by Bloxodes, including current players, visits, favorites, ratings, trends, and public history charts.";

export type StatsSortKey =
  | "playing"
  | "growth_24h"
  | "growth_7d"
  | "visits"
  | "favorites"
  | "rating"
  | "peak"
  | "updated"
  | "created"
  | "quality";

export type StatsTimeRange = "24h" | "7d" | "30d" | "90d" | "all";
export type StatsMetricKey = "players" | "visits" | "favorites" | "rating";

export type StatsGame = {
  universeId: number;
  slug: string;
  rootPlaceId: number | null;
  name: string;
  displayName: string;
  description: string | null;
  creatorName: string | null;
  creatorType: string | null;
  creatorId: number | null;
  genre: string | null;
  subgenre: string | null;
  ageRating: string | null;
  iconUrl: string | null;
  thumbnailUrls: string[];
  playing: number | null;
  visits: number | null;
  favorites: number | null;
  likes: number | null;
  dislikes: number | null;
  ratingPercent: number | null;
  qualityScore: number | null;
  createdAtApi: string | null;
  updatedAtApi: string | null;
  lastStatsRefreshedAt: string | null;
  lastPlayingRefreshedAt: string | null;
  desktopEnabled: boolean | null;
  mobileEnabled: boolean | null;
  tabletEnabled: boolean | null;
  consoleEnabled: boolean | null;
  vrEnabled: boolean | null;
  rank: number | null;
  growth24h: number | null;
  growth24hPercent: number | null;
  growth7d: number | null;
  growth7dPercent: number | null;
  peak24h: number | null;
  peak7d: number | null;
  trendScore: number;
  links?: StatsRelatedLink[];
};

export type StatsRelatedLink = {
  label: string;
  href: string;
  type: "codes" | "wiki" | "catalog" | "event" | "tool" | "quiz" | "checklist" | "article" | "list" | "roblox";
};

export type StatsChartPoint = {
  label: string;
  sampledAt: string;
  players: number | null;
  peakPlayers: number | null;
  avgPlayers: number | null;
  visits: number | null;
  favorites: number | null;
  rating: number | null;
  samples: number | null;
};

export type StatsGenreSummary = {
  genre: string;
  slug: string;
  games: number;
  playing: number;
  visits: number;
  topGame: Pick<StatsGame, "name" | "slug" | "iconUrl" | "playing"> | null;
};

export type StatsHomeData = {
  totals: {
    trackedGames: number;
    livePlayers: number;
    totalVisits: number;
    lastUpdatedAt: string | null;
  };
  topGames: StatsGame[];
  risers: StatsGame[];
  fallers: StatsGame[];
  mostVisited: StatsGame[];
  genres: StatsGenreSummary[];
  recentGames: StatsGame[];
  platformTrend: StatsChartPoint[];
};

export type StatsGamesPageData = {
  games: StatsGame[];
  total: number;
  page: number;
  totalPages: number;
  genres: string[];
  filters: {
    q: string;
    genre: string;
    sort: StatsSortKey;
    minPlayers: number | null;
  };
};

export type StatsGameDetailData = {
  game: StatsGame;
  charts: Record<StatsTimeRange, StatsChartPoint[]>;
  relatedLinks: StatsRelatedLink[];
  sameCreator: StatsGame[];
  similarGames: StatsGame[];
  includedInLists: StatsRelatedLink[];
};

type UniverseRow = {
  universe_id: number;
  root_place_id: number | null;
  name: string;
  display_name: string | null;
  slug: string | null;
  description: string | null;
  creator_id: number | null;
  creator_name: string | null;
  creator_type: string | null;
  genre: string | null;
  genre_l1: string | null;
  genre_l2: string | null;
  age_rating: string | null;
  icon_url: string | null;
  thumbnail_urls: unknown;
  playing: number | null;
  visits: number | null;
  favorites: number | null;
  likes: number | null;
  dislikes: number | null;
  quality_score: number | null;
  created_at_api: string | null;
  updated_at_api: string | null;
  last_stats_refreshed_at: string | null;
  last_playing_refreshed_at: string | null;
  desktop_enabled: boolean | null;
  mobile_enabled: boolean | null;
  tablet_enabled: boolean | null;
  console_enabled: boolean | null;
  vr_enabled: boolean | null;
};

type HourlyRow = {
  universe_id: number;
  hour_start: string;
  playing: number | null;
  avg_playing: number | null;
  peak_playing: number | null;
  visits_end: number | null;
  favorites_end: number | null;
  likes_end: number | null;
  dislikes_end: number | null;
  rating_percent: number | null;
  sample_count: number | null;
};

type DailyRow = {
  stat_date: string;
  playing: number | null;
  visits: number | null;
  favorites: number | null;
  likes: number | null;
  dislikes: number | null;
  avg_playing?: number | null;
  peak_playing?: number | null;
  visits_end?: number | null;
  favorites_end?: number | null;
  rating_end?: number | null;
  sample_count?: number | null;
  snapshot: Record<string, unknown> | null;
};

const SORT_COLUMNS: Partial<Record<StatsSortKey, keyof UniverseRow>> = {
  playing: "playing",
  visits: "visits",
  favorites: "favorites",
  updated: "updated_at_api",
  created: "created_at_api",
  quality: "quality_score"
};

export const STATS_SORT_OPTIONS: Array<{ value: StatsSortKey; label: string }> = [
  { value: "playing", label: "Current players" },
  { value: "growth_24h", label: "24h growth" },
  { value: "growth_7d", label: "7d growth" },
  { value: "visits", label: "Visits" },
  { value: "favorites", label: "Favorites" },
  { value: "rating", label: "Rating" },
  { value: "peak", label: "Peak CCU" },
  { value: "updated", label: "Roblox updated" },
  { value: "created", label: "Created date" },
  { value: "quality", label: "Bloxodes quality" }
];

export const STATS_TIME_RANGES: Array<{ value: StatsTimeRange; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" }
];

export const STATS_METRICS: Array<{ value: StatsMetricKey; label: string }> = [
  { value: "players", label: "Players" },
  { value: "visits", label: "Visits" },
  { value: "favorites", label: "Favorites" },
  { value: "rating", label: "Rating" }
];

function compactSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function ensureSlug(row: Pick<UniverseRow, "slug" | "name" | "universe_id">) {
  return row.slug?.trim() || `${compactSlug(row.name || "roblox-game")}-${row.universe_id}`;
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nestedNumber(value: Record<string, unknown>, key: string, childKey: string): number | null {
  const nested = value[key];
  if (!nested || typeof nested !== "object") return null;
  return toNumber((nested as Record<string, unknown>)[childKey]);
}

function toJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export function getRatingPercent(likes?: number | null, dislikes?: number | null): number | null {
  const up = typeof likes === "number" ? likes : 0;
  const down = typeof dislikes === "number" ? dislikes : 0;
  const total = up + down;
  if (total <= 0) return null;
  return Math.round((up / total) * 1000) / 10;
}

function percentChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function trendScore(row: StatsGame) {
  const playerScore = Math.max(-50, Math.min(80, row.growth24hPercent ?? 0));
  const weekScore = Math.max(-30, Math.min(50, (row.growth7dPercent ?? 0) / 2));
  const ratingScore = row.ratingPercent != null ? Math.max(0, row.ratingPercent - 60) / 2 : 0;
  const trafficScore = row.playing ? Math.log10(Math.max(row.playing, 1)) * 8 : 0;
  return Math.round(playerScore + weekScore + ratingScore + trafficScore);
}

function mapUniverse(row: UniverseRow): StatsGame {
  const ratingPercent = getRatingPercent(row.likes, row.dislikes);
  return {
    universeId: row.universe_id,
    slug: ensureSlug(row),
    rootPlaceId: row.root_place_id,
    name: row.display_name || row.name || `Universe ${row.universe_id}`,
    displayName: row.display_name || row.name || `Universe ${row.universe_id}`,
    description: row.description,
    creatorName: row.creator_name,
    creatorType: row.creator_type,
    creatorId: row.creator_id,
    genre: row.genre_l1 || row.genre,
    subgenre: row.genre_l2,
    ageRating: formatAgeRating(row.age_rating),
    iconUrl: row.icon_url,
    thumbnailUrls: toJsonStringArray(row.thumbnail_urls),
    playing: toNumber(row.playing),
    visits: toNumber(row.visits),
    favorites: toNumber(row.favorites),
    likes: toNumber(row.likes),
    dislikes: toNumber(row.dislikes),
    ratingPercent,
    qualityScore: toNumber(row.quality_score),
    createdAtApi: row.created_at_api,
    updatedAtApi: row.updated_at_api,
    lastStatsRefreshedAt: row.last_stats_refreshed_at,
    lastPlayingRefreshedAt: row.last_playing_refreshed_at,
    desktopEnabled: row.desktop_enabled,
    mobileEnabled: row.mobile_enabled,
    tabletEnabled: row.tablet_enabled,
    consoleEnabled: row.console_enabled,
    vrEnabled: row.vr_enabled,
    rank: null,
    growth24h: null,
    growth24hPercent: null,
    growth7d: null,
    growth7dPercent: null,
    peak24h: null,
    peak7d: null,
    trendScore: 0
  };
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function attachGrowth(games: StatsGame[]): Promise<StatsGame[]> {
  if (!games.length) return games;
  const ids = games.map((game) => game.universeId);
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_universe_stats_hourly")
    .select("universe_id, hour_start, playing, peak_playing")
    .in("universe_id", ids)
    .gte("hour_start", hoursAgo(24 * 7 + 2))
    .order("hour_start", { ascending: true });

  if (error) {
    console.warn("Failed to load hourly growth stats", error.message);
    return games.map((game, index) => ({ ...game, rank: index + 1, trendScore: trendScore(game) }));
  }

  const byId = new Map<number, Array<{ hour_start: string; playing: number | null; peak_playing: number | null }>>();
  for (const row of (data ?? []) as Array<{ universe_id: number; hour_start: string; playing: number | null; peak_playing: number | null }>) {
    const current = byId.get(row.universe_id) ?? [];
    current.push(row);
    byId.set(row.universe_id, current);
  }

  const cutoff24 = Date.now() - 24 * 60 * 60 * 1000;
  const cutoff7d = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return games.map((game, index) => {
    const rows = byId.get(game.universeId) ?? [];
    const first24 = rows.find((row) => Date.parse(row.hour_start) >= cutoff24);
    const first7d = rows.find((row) => Date.parse(row.hour_start) >= cutoff7d);
    const peak24h = rows
      .filter((row) => Date.parse(row.hour_start) >= cutoff24)
      .reduce<number | null>((max, row) => (row.peak_playing == null ? max : max == null ? row.peak_playing : Math.max(max, row.peak_playing)), null);
    const peak7d = rows.reduce<number | null>(
      (max, row) => (row.peak_playing == null ? max : max == null ? row.peak_playing : Math.max(max, row.peak_playing)),
      null
    );
    const growth24h = game.playing != null && first24?.playing != null ? game.playing - first24.playing : null;
    const growth7d = game.playing != null && first7d?.playing != null ? game.playing - first7d.playing : null;
    const hydrated = {
      ...game,
      rank: index + 1,
      growth24h,
      growth24hPercent: percentChange(game.playing, first24?.playing ?? null),
      growth7d,
      growth7dPercent: percentChange(game.playing, first7d?.playing ?? null),
      peak24h,
      peak7d
    };
    return { ...hydrated, trendScore: trendScore(hydrated) };
  });
}

async function listBaseGames(options: {
  limit: number;
  offset?: number;
  q?: string;
  genre?: string;
  minPlayers?: number | null;
  sort?: StatsSortKey;
  count?: "exact" | null;
  qualityForSitemap?: boolean;
}) {
  const sb = supabaseAdmin();
  const select = `
    universe_id, root_place_id, name, display_name, slug, description,
    creator_id, creator_name, creator_type, genre, genre_l1, genre_l2, age_rating,
    icon_url, thumbnail_urls, playing, visits, favorites, likes, dislikes,
    quality_score, created_at_api, updated_at_api, last_stats_refreshed_at,
    last_playing_refreshed_at, desktop_enabled, mobile_enabled, tablet_enabled,
    console_enabled, vr_enabled
  `;
  let query = sb
    .from("roblox_universes")
    .select(select, { count: options.count ?? undefined })
    .not("slug", "is", null)
    .not("icon_url", "is", null);

  if (options.q?.trim()) {
    const pattern = `%${options.q.trim().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    query = query.or(`name.ilike.${pattern},display_name.ilike.${pattern},creator_name.ilike.${pattern}`);
  }

  if (options.genre && options.genre !== "all") {
    query = query.or(`genre.eq.${options.genre},genre_l1.eq.${options.genre}`);
  }

  if (typeof options.minPlayers === "number" && options.minPlayers > 0) {
    query = query.gte("playing", options.minPlayers);
  }

  if (options.qualityForSitemap) {
    query = query.or("is_quality_candidate.eq.true,playing.gte.1000,quality_tier.in.(A,B)");
  }

  const sort = options.sort ?? "playing";
  const sortColumn = SORT_COLUMNS[sort];
  if (sortColumn) {
    query = query.order(sortColumn, { ascending: sort === "created", nullsFirst: false });
  } else {
    query = query.order("playing", { ascending: false, nullsFirst: false });
  }
  query = query.order("universe_id", { ascending: true }).range(options.offset ?? 0, (options.offset ?? 0) + options.limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    rows: ((data ?? []) as UniverseRow[]).map(mapUniverse),
    total: count ?? 0
  };
}

export async function listStatsGenres(limit = 12): Promise<StatsGenreSummary[]> {
  noStore();
  const { rows } = await listBaseGames({ limit: 500, sort: "playing" });
  const map = new Map<string, StatsGenreSummary>();
  for (const game of rows) {
    const label = game.genre || "Uncategorized";
    const slug = compactSlug(label);
    const current = map.get(label) ?? {
      genre: label,
      slug,
      games: 0,
      playing: 0,
      visits: 0,
      topGame: null
    };
    current.games += 1;
    current.playing += game.playing ?? 0;
    current.visits += game.visits ?? 0;
    if (!current.topGame || (game.playing ?? 0) > (current.topGame.playing ?? 0)) {
      current.topGame = {
        name: game.name,
        slug: game.slug,
        iconUrl: game.iconUrl,
        playing: game.playing
      };
    }
    map.set(label, current);
  }

  return Array.from(map.values())
    .sort((a, b) => b.playing - a.playing)
    .slice(0, limit);
}

async function getPlatformTrend(games: StatsGame[]): Promise<StatsChartPoint[]> {
  const ids = games.slice(0, 100).map((game) => game.universeId);
  if (!ids.length) return [];
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_universe_stats_hourly")
    .select("universe_id, hour_start, playing, peak_playing, avg_playing, visits_end, favorites_end, rating_percent, sample_count")
    .in("universe_id", ids)
    .gte("hour_start", hoursAgo(24))
    .order("hour_start", { ascending: true });

  if (error) {
    console.warn("Failed to load platform trend", error.message);
    return [];
  }

  const byHour = new Map<string, StatsChartPoint>();
  for (const row of (data ?? []) as HourlyRow[]) {
    const existing = byHour.get(row.hour_start) ?? {
      label: formatChartLabel(row.hour_start, "24h"),
      sampledAt: row.hour_start,
      players: 0,
      peakPlayers: 0,
      avgPlayers: 0,
      visits: 0,
      favorites: 0,
      rating: null,
      samples: 0
    };
    existing.players = (existing.players ?? 0) + (row.playing ?? 0);
    existing.peakPlayers = (existing.peakPlayers ?? 0) + (row.peak_playing ?? 0);
    existing.avgPlayers = (existing.avgPlayers ?? 0) + (row.avg_playing ?? row.playing ?? 0);
    existing.visits = (existing.visits ?? 0) + (row.visits_end ?? 0);
    existing.favorites = (existing.favorites ?? 0) + (row.favorites_end ?? 0);
    existing.samples = (existing.samples ?? 0) + (row.sample_count ?? 0);
    byHour.set(row.hour_start, existing);
  }

  return Array.from(byHour.values()).sort((a, b) => Date.parse(a.sampledAt) - Date.parse(b.sampledAt));
}

export async function getStatsHome(): Promise<StatsHomeData> {
  noStore();
  const [{ rows: topBase }, { rows: visitedBase }, genres] = await Promise.all([
    listBaseGames({ limit: 16, sort: "playing" }),
    listBaseGames({ limit: 10, sort: "visits" }),
    listStatsGenres(10)
  ]);
  const [topGames, mostVisited] = await Promise.all([attachGrowth(topBase), attachGrowth(visitedBase)]);
  const sortedByTrend = [...topGames].sort((a, b) => b.trendScore - a.trendScore);
  const fallers = [...topGames]
    .filter((game) => typeof game.growth24h === "number" && game.growth24h < 0)
    .sort((a, b) => (a.growth24h ?? 0) - (b.growth24h ?? 0))
    .slice(0, 6);
  const { rows: recentGames } = await listBaseGames({ limit: 8, sort: "updated" });
  const platformTrend = await getPlatformTrend(topGames);
  const livePlayers = topGames.reduce((sum, game) => sum + (game.playing ?? 0), 0);
  const totalVisits = mostVisited.reduce((sum, game) => sum + (game.visits ?? 0), 0);
  const lastUpdatedAt =
    topGames
      .map((game) => game.lastStatsRefreshedAt ?? game.lastPlayingRefreshedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

  return {
    totals: {
      trackedGames: topGames.length,
      livePlayers,
      totalVisits,
      lastUpdatedAt
    },
    topGames: topGames.slice(0, 8),
    risers: sortedByTrend.slice(0, 8),
    fallers,
    mostVisited,
    genres,
    recentGames,
    platformTrend
  };
}

export function normalizeStatsSort(value?: string | null): StatsSortKey {
  return STATS_SORT_OPTIONS.some((option) => option.value === value) ? (value as StatsSortKey) : "playing";
}

export function normalizeStatsRange(value?: string | null): StatsTimeRange {
  return STATS_TIME_RANGES.some((option) => option.value === value) ? (value as StatsTimeRange) : "24h";
}

export function parseStatsSearchParams(searchParams?: Record<string, string | string[] | undefined>) {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const pageValue = Number(first(searchParams?.page) ?? "1");
  const minValue = Number(first(searchParams?.minPlaying) ?? first(searchParams?.minPlayers) ?? "");
  return {
    page: Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1,
    q: first(searchParams?.q)?.trim() ?? "",
    genre: first(searchParams?.genre)?.trim() || "all",
    sort: normalizeStatsSort(first(searchParams?.sort)),
    minPlaying: Number.isFinite(minValue) && minValue > 0 ? Math.floor(minValue) : 0
  };
}

export async function listStatsGames(input: {
  page?: number;
  pageSize?: number;
  q?: string;
  genre?: string;
  sort?: string | null;
  minPlayers?: number | null;
}): Promise<StatsGamesPageData> {
  noStore();
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? STATS_PAGE_SIZE, 10), 100);
  const sort = normalizeStatsSort(input.sort);
  const offset = (page - 1) * pageSize;
  const q = input.q?.trim() ?? "";
  const genre = input.genre?.trim() ?? "all";
  const minPlayers = typeof input.minPlayers === "number" && Number.isFinite(input.minPlayers) ? input.minPlayers : null;

  const needsComputedSort = sort === "growth_24h" || sort === "growth_7d" || sort === "rating" || sort === "peak";
  const baseLimit = needsComputedSort ? Math.max(250, pageSize) : pageSize;
  const baseOffset = needsComputedSort ? 0 : offset;
  const [{ rows, total }, genreOptions] = await Promise.all([
    listBaseGames({
      limit: baseLimit,
      offset: baseOffset,
      q,
      genre,
      minPlayers,
      sort: needsComputedSort ? "playing" : sort,
      count: "exact"
    }),
    getStatsGenreOptions()
  ]);
  const genres = genre !== "all" && !genreOptions.includes(genre)
    ? [genre, ...genreOptions].sort((a, b) => a.localeCompare(b))
    : genreOptions;

  let games = await attachGrowth(rows);
  if (sort === "growth_24h") games = games.sort((a, b) => (b.growth24h ?? -Infinity) - (a.growth24h ?? -Infinity));
  if (sort === "growth_7d") games = games.sort((a, b) => (b.growth7d ?? -Infinity) - (a.growth7d ?? -Infinity));
  if (sort === "rating") games = games.sort((a, b) => (b.ratingPercent ?? -Infinity) - (a.ratingPercent ?? -Infinity));
  if (sort === "peak") games = games.sort((a, b) => (b.peak24h ?? -Infinity) - (a.peak24h ?? -Infinity));
  if (needsComputedSort) {
    games = games.slice(offset, offset + pageSize).map((game, index) => ({ ...game, rank: offset + index + 1 }));
  }

  return {
    games,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    genres,
    filters: { q, genre, sort, minPlayers }
  };
}

export async function getStatsGenreOptions(): Promise<string[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_universes")
    .select("genre_l1, genre")
    .not("slug", "is", null)
    .not("icon_url", "is", null)
    .order("genre_l1", { ascending: true })
    .limit(1000);
  if (error) return [];
  return Array.from(
    new Set(
      ((data ?? []) as Array<{ genre_l1: string | null; genre: string | null }>)
        .map((row) => row.genre_l1 || row.genre)
        .filter((value): value is string => Boolean(value?.trim()))
    )
  ).sort((a, b) => a.localeCompare(b));
}

function formatChartLabel(value: string, range: StatsTimeRange) {
  const date = new Date(value);
  if (range === "24h") {
    return date.toLocaleTimeString("en-US", { hour: "numeric", hour12: true, timeZone: "UTC" });
  }
  if (range === "7d" || range === "30d") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit", timeZone: "UTC" });
}

function hourlyRangeStart(range: StatsTimeRange) {
  if (range === "24h") return hoursAgo(24);
  if (range === "7d") return hoursAgo(24 * 7);
  return hoursAgo(24 * 30);
}

async function getHourlyChart(universeId: number, range: Extract<StatsTimeRange, "24h" | "7d" | "30d">): Promise<StatsChartPoint[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_universe_stats_hourly")
    .select("universe_id, hour_start, playing, avg_playing, peak_playing, visits_end, favorites_end, likes_end, dislikes_end, rating_percent, sample_count")
    .eq("universe_id", universeId)
    .gte("hour_start", hourlyRangeStart(range))
    .order("hour_start", { ascending: true });
  if (error) {
    console.warn("Failed to load hourly chart", error.message);
    return [];
  }
  return ((data ?? []) as HourlyRow[]).map((row) => ({
    label: formatChartLabel(row.hour_start, range),
    sampledAt: row.hour_start,
    players: row.playing,
    peakPlayers: row.peak_playing,
    avgPlayers: row.avg_playing,
    visits: row.visits_end,
    favorites: row.favorites_end,
    rating: row.rating_percent,
    samples: row.sample_count
  }));
}

async function getDailyChart(universeId: number, range: Extract<StatsTimeRange, "90d" | "all">): Promise<StatsChartPoint[]> {
  const sb = supabaseAdmin();
  let query = sb
    .from("roblox_universe_stats_daily")
    .select("stat_date, playing, visits, favorites, likes, dislikes, avg_playing, peak_playing, visits_end, favorites_end, rating_end, sample_count, snapshot")
    .eq("universe_id", universeId)
    .order("stat_date", { ascending: true });
  if (range === "90d") {
    const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    query = query.gte("stat_date", start);
  }
  const { data, error } = await query.limit(range === "all" ? 1000 : 120);
  if (error) {
    console.warn("Failed to load daily chart", error.message);
    return [];
  }
  return ((data ?? []) as DailyRow[]).map((row) => {
    const snapshot = row.snapshot ?? {};
    const avgPlaying = toNumber(row.avg_playing) ?? toNumber(snapshot.avg_playing) ?? nestedNumber(snapshot, "playing", "average");
    const peakPlaying = toNumber(row.peak_playing) ?? toNumber(snapshot.peak_playing) ?? nestedNumber(snapshot, "playing", "peak") ?? row.playing;
    const visitsEnd = toNumber(row.visits_end) ?? toNumber(snapshot.visits_end) ?? nestedNumber(snapshot, "visits", "end") ?? row.visits;
    const favoritesEnd =
      toNumber(row.favorites_end) ?? toNumber(snapshot.favorites_end) ?? nestedNumber(snapshot, "favorites", "end") ?? row.favorites;
    const rating = toNumber(row.rating_end) ?? toNumber(snapshot.rating_end) ?? nestedNumber(snapshot, "rating", "end") ?? getRatingPercent(row.likes, row.dislikes);
    const samples = toNumber(row.sample_count) ?? toNumber(snapshot.sample_count);
    return {
      label: formatChartLabel(row.stat_date, range),
      sampledAt: row.stat_date,
      players: row.playing,
      peakPlayers: peakPlaying,
      avgPlayers: avgPlaying,
      visits: visitsEnd,
      favorites: favoritesEnd,
      rating,
      samples
    };
  });
}

export async function getStatsGameCharts(universeId: number): Promise<Record<StatsTimeRange, StatsChartPoint[]>> {
  const [h24, d7, d30, d90, all] = await Promise.all([
    getHourlyChart(universeId, "24h"),
    getHourlyChart(universeId, "7d"),
    getHourlyChart(universeId, "30d"),
    getDailyChart(universeId, "90d"),
    getDailyChart(universeId, "all")
  ]);
  return { "24h": h24, "7d": d7, "30d": d30, "90d": d90, all };
}

export async function getStatsGameBySlug(slug: string): Promise<StatsGameDetailData | null> {
  noStore();
  const sb = supabaseAdmin();
  const numericSlug = Number(slug);
  const slugFilter = Number.isFinite(numericSlug) ? `slug.eq.${slug},universe_id.eq.${numericSlug}` : `slug.eq.${slug}`;
  const { data, error } = await sb
    .from("roblox_universes")
    .select(`
      universe_id, root_place_id, name, display_name, slug, description,
      creator_id, creator_name, creator_type, genre, genre_l1, genre_l2, age_rating,
      icon_url, thumbnail_urls, playing, visits, favorites, likes, dislikes,
      quality_score, created_at_api, updated_at_api, last_stats_refreshed_at,
      last_playing_refreshed_at, desktop_enabled, mobile_enabled, tablet_enabled,
      console_enabled, vr_enabled
    `)
    .or(slugFilter)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const baseGame = (await attachGrowth([mapUniverse(data as UniverseRow)]))[0];
  const [charts, relatedLinks, sameCreator, similarGames, includedInLists, globalRank] = await Promise.all([
    getStatsGameCharts(baseGame.universeId),
    loadRelatedLinks(baseGame.universeId, baseGame),
    loadSameCreatorGames(baseGame),
    loadSimilarGames(baseGame),
    loadListLinks(baseGame.universeId),
    loadLatestRank(baseGame.universeId)
  ]);

  return {
    game: { ...baseGame, rank: globalRank, links: relatedLinks },
    charts,
    relatedLinks,
    sameCreator,
    similarGames,
    includedInLists
  };
}

export async function getStatsGameSummaryByUniverseId(universeId: number): Promise<StatsGame | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_universes")
    .select(`
      universe_id, root_place_id, name, display_name, slug, description,
      creator_id, creator_name, creator_type, genre, genre_l1, genre_l2, age_rating,
      icon_url, thumbnail_urls, playing, visits, favorites, likes, dislikes,
      quality_score, created_at_api, updated_at_api, last_stats_refreshed_at,
      last_playing_refreshed_at, desktop_enabled, mobile_enabled, tablet_enabled,
      console_enabled, vr_enabled
    `)
    .eq("universe_id", universeId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (await attachGrowth([mapUniverse(data as UniverseRow)]))[0] ?? null;
}

async function loadRelatedLinks(universeId: number, game: StatsGame): Promise<StatsRelatedLink[]> {
  const sb = supabaseAdmin();
  const [codes, wiki, catalogs, events, tools, quizzes, checklists, articles] = await Promise.all([
    sb.from("games").select("slug, name").eq("universe_id", universeId).eq("is_published", true).limit(1),
    sb.from("wiki_pages").select("slug, title").eq("universe_id", universeId).eq("is_published", true).limit(1),
    sb.from("catalog_pages").select("code, title").eq("universe_id", universeId).eq("is_published", true).limit(4),
    sb.from("events_pages").select("slug, title").eq("universe_id", universeId).eq("is_published", true).limit(1),
    sb.from("tools").select("code, title").eq("universe_id", universeId).eq("is_published", true).limit(4),
    sb.from("quiz_pages").select("code, title").eq("universe_id", universeId).eq("is_published", true).limit(4),
    sb.from("checklist_pages").select("slug, title").eq("universe_id", universeId).eq("is_public", true).limit(4),
    sb.from("articles").select("slug, title").eq("universe_id", universeId).eq("is_published", true).limit(4)
  ]);

  const links: StatsRelatedLink[] = [];
  if (game.rootPlaceId) links.push({ label: "Roblox", href: `https://www.roblox.com/games/${game.rootPlaceId}`, type: "roblox" });
  for (const row of (codes.data ?? []) as Array<{ slug: string | null }>) if (row.slug) links.push({ label: "Codes", href: `/codes/${row.slug}`, type: "codes" });
  for (const row of (wiki.data ?? []) as Array<{ slug: string | null }>) if (row.slug) links.push({ label: "Wiki", href: `/wiki/${row.slug}`, type: "wiki" });
  for (const row of (catalogs.data ?? []) as Array<{ code: string | null; title: string | null }>) if (row.code) links.push({ label: row.title ?? "Catalog", href: `/catalog/${row.code}`, type: "catalog" });
  for (const row of (events.data ?? []) as Array<{ slug: string | null }>) if (row.slug) links.push({ label: "Events", href: `/events/${row.slug}`, type: "event" });
  for (const row of (tools.data ?? []) as Array<{ code: string | null; title: string | null }>) if (row.code) links.push({ label: row.title ?? "Tool", href: `/tools/${row.code}`, type: "tool" });
  for (const row of (quizzes.data ?? []) as Array<{ code: string | null; title: string | null }>) if (row.code) links.push({ label: row.title ?? "Quiz", href: `/quizzes/${row.code}`, type: "quiz" });
  for (const row of (checklists.data ?? []) as Array<{ slug: string | null; title: string | null }>) if (row.slug) links.push({ label: row.title ?? "Checklist", href: `/checklists/${row.slug}`, type: "checklist" });
  for (const row of (articles.data ?? []) as Array<{ slug: string | null; title: string | null }>) if (row.slug) links.push({ label: row.title ?? "Article", href: `/articles/${row.slug}`, type: "article" });
  return links;
}

async function loadSameCreatorGames(game: StatsGame): Promise<StatsGame[]> {
  if (!game.creatorId) return [];
  const { rows } = await listBaseGames({ limit: 6, sort: "playing" });
  return attachGrowth(rows.filter((row) => row.creatorId === game.creatorId && row.universeId !== game.universeId).slice(0, 4));
}

async function loadSimilarGames(game: StatsGame): Promise<StatsGame[]> {
  const { rows } = await listBaseGames({ limit: 20, sort: "playing", genre: game.genre ?? undefined });
  return attachGrowth(rows.filter((row) => row.universeId !== game.universeId).slice(0, 6));
}

async function loadListLinks(universeId: number): Promise<StatsRelatedLink[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("game_list_entries")
    .select("rank, list:game_lists(slug, title, is_published)")
    .eq("universe_id", universeId)
    .order("rank", { ascending: true })
    .limit(6);
  if (error) return [];
  return ((data ?? []) as Array<{ rank: number | null; list: { slug?: string | null; title?: string | null; is_published?: boolean | null } | Array<{ slug?: string | null; title?: string | null; is_published?: boolean | null }> | null }>)
    .flatMap((row) => {
      const list = Array.isArray(row.list) ? row.list[0] : row.list;
      if (!list?.slug || list.is_published !== true) return [];
      const label = row.rank ? `#${row.rank} on ${list.title ?? "List"}` : list.title ?? "List";
      return [{ label, href: `/lists/${list.slug}`, type: "list" as const }];
    });
}

async function loadLatestRank(universeId: number): Promise<number | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_universe_rank_snapshots")
    .select("rank_value")
    .eq("universe_id", universeId)
    .eq("rank_type", "global_playing")
    .order("sampled_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("Failed to load stats rank", error.message);
    return null;
  }
  return toNumber((data as { rank_value?: unknown } | null)?.rank_value);
}

export async function listStatsSitemapGames(limit = 200): Promise<Array<{ slug: string; updatedAt: string | null }>> {
  const { rows } = await listBaseGames({ limit, sort: "playing", qualityForSitemap: true });
  return rows.map((game) => ({
    slug: game.slug,
    updatedAt: game.lastStatsRefreshedAt ?? game.lastPlayingRefreshedAt ?? game.updatedAtApi
  }));
}

export function robloxGameUrl(game: Pick<StatsGame, "rootPlaceId" | "universeId">) {
  return `https://www.roblox.com/games/${game.rootPlaceId ?? game.universeId}`;
}
