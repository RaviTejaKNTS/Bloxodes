import "server-only";
import { formatAgeRating } from "@/lib/age-rating";
import { supabaseAdmin } from "@/lib/supabase";
import { slugify, statsUniverseSlug } from "@/lib/slug";
export { formatCompactNumber, formatFullNumber, formatPercent } from "@/lib/stats-format";

export const STATS_PAGE_SIZE = 50;
const STATS_HOME_TOP_GAMES_LIMIT = 10;
const STATS_HOME_RISERS_LIMIT = 10;
const STATS_HOME_GENRES_LIMIT = 10;
const STATS_HOME_RISERS_MIN_PLAYERS = 5000;
const STATS_HOME_RISERS_MIN_GAIN = 1000;
const SUPABASE_READ_PAGE_SIZE = 1000;
const SUPABASE_IN_CHUNK_SIZE = 500;
const STATS_GROWTH_BASELINE_TOLERANCE_MS = 90 * 60 * 1000;
let statsIndexAvailability: Promise<boolean> | null = null;
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
  | "created";

export type StatsTimeRange = "1d" | "7d" | "14d" | "30d" | "90d";
export type StatsMetricKey = "players" | "visits" | "favorites" | "rating";
export type StatsChartResolution = "hourly" | "daily" | "weekly" | "monthly";

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
  statsTier: "NEW" | "HOT" | "WARM" | "COLD" | null;
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
  tooltipLabel?: string;
  sampledAt: string;
  players: number | null;
  peakPlayers: number | null;
  avgPlayers: number | null;
  visits: number | null;
  favorites: number | null;
  rating: number | null;
  samples: number | null;
};

export type StatsChartAnnotation = {
  type: "event" | "update";
  id: string;
  label: string;
  startAt: string;
  endAt: string | null;
  status: string | null;
  href: string | null;
  source: string | null;
};

export type StatsChartComparison = {
  universeId: number;
  name: string;
  slug: string;
  iconUrl: string | null;
  points: StatsChartPoint[];
};

export type StatsGameSearchResult = {
  universeId: number;
  name: string;
  slug: string;
  iconUrl: string | null;
  playing: number | null;
  visits: number | null;
};

export type StatsRankPoint = {
  label: string;
  tooltipLabel?: string;
  sampledAt: string;
  globalRank: number | null;
  genreRank: number | null;
  subgenreRank: number | null;
  globalPlayers: number | null;
  genrePlayers: number | null;
  subgenrePlayers: number | null;
  samples: number | null;
};

export type StatsRankSummary = {
  key: "global" | "genre" | "subgenre";
  label: string;
  scopeLabel: string | null;
  currentRank: number | null;
  currentAt: string | null;
  bestRank: number | null;
  bestAt: string | null;
  firstTop1At: string | null;
  lastTop1At: string | null;
  lastExitedTop1At: string | null;
  firstTop10At: string | null;
  lastExitedTop10At: string | null;
  sampleCount: number;
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
    featuredGames: number;
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
  initialChart: StatsGameChartData;
  initialRankChart: StatsGameRankChartData;
  relatedLinks: StatsRelatedLink[];
  sameCreator: StatsGame[];
  similarGames: StatsGame[];
  includedInLists: StatsRelatedLink[];
};

export type StatsGameChartData = {
  range: StatsTimeRange;
  requestedResolution: StatsChartResolution;
  resolution: StatsChartResolution;
  points: StatsChartPoint[];
  previousPoints?: StatsChartPoint[];
  comparisons?: StatsChartComparison[];
  annotations?: StatsChartAnnotation[];
};

export type StatsGameRankChartData = {
  range: StatsTimeRange;
  requestedResolution: StatsChartResolution;
  resolution: StatsChartResolution;
  points: StatsRankPoint[];
  previousPoints?: StatsRankPoint[];
  annotations?: StatsChartAnnotation[];
  summaries: StatsRankSummary[];
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
  stats_tier: "NEW" | "HOT" | "WARM" | "COLD" | null;
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

type StatsGameIndexRow = UniverseRow & {
  rating_percent: number | null;
  baseline_playing_24h: number | null;
  baseline_playing_7d: number | null;
  growth_24h: number | null;
  growth_24h_percent: number | null;
  growth_7d: number | null;
  growth_7d_percent: number | null;
  peak_24h: number | null;
  peak_7d: number | null;
  global_playing_rank: number | null;
  indexed_at: string | null;
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

type RankSnapshotRow = {
  rank_type: string;
  rank_value: number;
  metric_value: number | null;
  sampled_at: string;
};

type EventAnnotationRow = {
  event_id: string;
  title: string | null;
  display_title: string | null;
  start_utc: string | null;
  end_utc: string | null;
  created_utc: string | null;
  updated_utc: string | null;
  event_status: string | null;
  guide_slug: string | null;
};

type UpdateAnnotationRow = {
  id: string;
  updated_at_api: string;
  detected_at: string | null;
  label: string | null;
  source: string | null;
};

type HourlyRankSnapshotRow = {
  rank_type: string;
  rank_value: number;
  metric_value: number | null;
  hour_start: string;
  sampled_at: string | null;
};

const SORT_COLUMNS: Partial<Record<StatsSortKey, keyof UniverseRow>> = {
  playing: "playing",
  visits: "visits",
  favorites: "favorites",
  updated: "updated_at_api",
  created: "created_at_api"
};

const INDEX_SORT_COLUMNS: Record<StatsSortKey, keyof StatsGameIndexRow> = {
  playing: "playing",
  growth_24h: "growth_24h",
  growth_7d: "growth_7d",
  visits: "visits",
  favorites: "favorites",
  rating: "rating_percent",
  peak: "peak_24h",
  updated: "updated_at_api",
  created: "created_at_api"
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
  { value: "created", label: "Created date" }
];

export const STATS_TIME_RANGES: Array<{ value: StatsTimeRange; label: string }> = [
  { value: "1d", label: "1d" },
  { value: "7d", label: "7d" },
  { value: "14d", label: "14d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" }
];

export const STATS_METRICS: Array<{ value: StatsMetricKey; label: string }> = [
  { value: "players", label: "Playing" },
  { value: "visits", label: "Visits" },
  { value: "favorites", label: "Favorites" },
  { value: "rating", label: "Rating" }
];

export const STATS_CHART_RESOLUTIONS: Array<{ value: StatsChartResolution; label: string }> = [
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" }
];

function statsSlugBase(row: Pick<UniverseRow, "slug" | "name" | "universe_id">) {
  return row.slug?.trim() || row.name || "roblox-game";
}

function ensureSlug(row: Pick<UniverseRow, "slug" | "name" | "universe_id">) {
  return statsUniverseSlug(statsSlugBase(row), row.universe_id);
}

function parseStatsUniverseIdSlug(slug: string): number | null {
  const match = slug.trim().match(/(?:^|-)(\d+)$/);
  if (!match) return null;
  const universeId = Number(match[1]);
  return Number.isSafeInteger(universeId) && universeId > 0 ? universeId : null;
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

function momentumRiserScore(row: StatsGame) {
  const absoluteGainScore = Math.min(Math.max(row.growth24h ?? 0, 0), 50_000) / 50_000 * 55;
  const percentGainScore = Math.min(Math.max(row.growth24hPercent ?? 0, 0), 300) / 300 * 30;
  const playerScaleScore = row.playing ? Math.min(Math.log10(Math.max(row.playing, 1)) / 6, 1) * 15 : 0;
  return absoluteGainScore + percentGainScore + playerScaleScore;
}

function isEligibleHomeRiser(row: StatsGame) {
  return (
    (row.playing ?? 0) >= STATS_HOME_RISERS_MIN_PLAYERS &&
    (row.growth24h ?? 0) >= STATS_HOME_RISERS_MIN_GAIN &&
    typeof row.growth24hPercent === "number"
  );
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
    statsTier: row.stats_tier,
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

function mapIndexedGame(row: StatsGameIndexRow): StatsGame {
  const base = mapUniverse(row);
  const hydrated = {
    ...base,
    ratingPercent: toNumber(row.rating_percent) ?? base.ratingPercent,
    rank: toNumber(row.global_playing_rank),
    growth24h: toNumber(row.growth_24h),
    growth24hPercent: toNumber(row.growth_24h_percent),
    growth7d: toNumber(row.growth_7d),
    growth7dPercent: toNumber(row.growth_7d_percent),
    peak24h: toNumber(row.peak_24h),
    peak7d: toNumber(row.peak_7d)
  };
  return { ...hydrated, trendScore: trendScore(hydrated) };
}

async function isStatsIndexAvailable() {
  statsIndexAvailability ??= (async () => {
    try {
      const { data, error } = await supabaseAdmin()
        .from("stats_game_current_index")
        .select("universe_id")
        .limit(1);
      return !error && (data?.length ?? 0) > 0;
    } catch {
      return false;
    }
  })();
  return statsIndexAvailability;
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

type GrowthHourlyRow = {
  universe_id: number;
  hour_start: string;
  playing: number | null;
  peak_playing: number | null;
};

async function loadHourlyGrowthRows(
  universeIds: number[],
  options: { startIso: string; endIso?: string | null }
): Promise<GrowthHourlyRow[]> {
  if (!universeIds.length) return [];
  const sb = supabaseAdmin();
  const rows: GrowthHourlyRow[] = [];

  for (const ids of chunkArray(universeIds, SUPABASE_IN_CHUNK_SIZE)) {
    let offset = 0;
    while (true) {
      let query = sb
        .from("roblox_universe_stats_hourly")
        .select("universe_id, hour_start, playing, peak_playing")
        .in("universe_id", ids)
        .gte("hour_start", options.startIso);

      if (options.endIso) {
        query = query.lte("hour_start", options.endIso);
      }

      const { data, error } = await query
        .order("hour_start", { ascending: true })
        .range(offset, offset + SUPABASE_READ_PAGE_SIZE - 1);

      if (error) throw error;

      const chunk = (data ?? []) as GrowthHourlyRow[];
      rows.push(...chunk);
      if (chunk.length < SUPABASE_READ_PAGE_SIZE) break;
      offset += SUPABASE_READ_PAGE_SIZE;
    }
  }

  return rows;
}

function groupHourlyRows(rows: GrowthHourlyRow[]) {
  const byId = new Map<number, GrowthHourlyRow[]>();
  for (const row of rows) {
    const current = byId.get(row.universe_id) ?? [];
    current.push(row);
    byId.set(row.universe_id, current);
  }
  return byId;
}

function closestPlayingRow(rows: GrowthHourlyRow[], targetMs: number): GrowthHourlyRow | null {
  return rows.reduce<GrowthHourlyRow | null>((best, row) => {
    if (row.playing == null) return best;
    const time = Date.parse(row.hour_start);
    if (!Number.isFinite(time)) return best;
    if (!best) return row;
    return Math.abs(time - targetMs) < Math.abs(Date.parse(best.hour_start) - targetMs) ? row : best;
  }, null);
}

function hydrateGrowthFromRows(game: StatsGame, index: number, rows: GrowthHourlyRow[], nowMs = Date.now()): StatsGame {
  const cutoff24 = nowMs - 24 * 60 * 60 * 1000;
  const cutoff7d = nowMs - 7 * 24 * 60 * 60 * 1000;
  const first24 = closestPlayingRow(
    rows.filter((row) => {
      const time = Date.parse(row.hour_start);
      return Number.isFinite(time) && Math.abs(time - cutoff24) <= STATS_GROWTH_BASELINE_TOLERANCE_MS;
    }),
    cutoff24
  );
  const first7d = closestPlayingRow(
    rows.filter((row) => {
      const time = Date.parse(row.hour_start);
      return Number.isFinite(time) && Math.abs(time - cutoff7d) <= STATS_GROWTH_BASELINE_TOLERANCE_MS;
    }),
    cutoff7d
  );
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
}

async function attachGrowth(games: StatsGame[]): Promise<StatsGame[]> {
  if (!games.length) return games;
  const ids = games.map((game) => game.universeId);
  const nowMs = Date.now();
  const startIso = new Date(nowMs - (24 * 7 + 3) * 60 * 60 * 1000).toISOString();
  let data: GrowthHourlyRow[];

  try {
    data = await loadHourlyGrowthRows(ids, { startIso });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Failed to load hourly growth stats", message);
    return games.map((game, index) => ({ ...game, rank: index + 1, trendScore: trendScore(game) }));
  }

  const byId = groupHourlyRows(data);

  return games.map((game, index) => {
    const rows = byId.get(game.universeId) ?? [];
    return hydrateGrowthFromRows(game, index, rows, nowMs);
  });
}

async function attachGrowthBaselines(games: StatsGame[]): Promise<StatsGame[]> {
  if (!games.length) return games;
  const nowMs = Date.now();
  const cutoff24 = nowMs - 24 * 60 * 60 * 1000;
  const cutoff7d = nowMs - 7 * 24 * 60 * 60 * 1000;
  const ids = games.map((game) => game.universeId);
  const baselineWindows = [
    {
      startIso: new Date(cutoff24 - STATS_GROWTH_BASELINE_TOLERANCE_MS).toISOString(),
      endIso: new Date(cutoff24 + STATS_GROWTH_BASELINE_TOLERANCE_MS).toISOString()
    },
    {
      startIso: new Date(cutoff7d - STATS_GROWTH_BASELINE_TOLERANCE_MS).toISOString(),
      endIso: new Date(cutoff7d + STATS_GROWTH_BASELINE_TOLERANCE_MS).toISOString()
    }
  ];
  let data: GrowthHourlyRow[];

  try {
    const chunks = await Promise.all(baselineWindows.map((window) => loadHourlyGrowthRows(ids, window)));
    data = chunks.flat();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Failed to load hourly growth baselines", message);
    return games.map((game, index) => ({ ...game, rank: index + 1, trendScore: trendScore(game) }));
  }

  const byId = groupHourlyRows(data);
  return games.map((game, index) => hydrateGrowthFromRows(game, index, byId.get(game.universeId) ?? [], nowMs));
}

async function listBaseGames(options: {
  limit: number;
  offset?: number;
  q?: string;
  genre?: string;
  minPlayers?: number | null;
  sort?: StatsSortKey;
  count?: "exact" | "planned" | "estimated" | null;
  tierForSitemap?: boolean;
}) {
  const sb = supabaseAdmin();
  const indexSelect = `
    universe_id, root_place_id, name, display_name, slug, description,
    creator_id, creator_name, creator_type, genre, genre_l1, genre_l2, age_rating,
    icon_url, thumbnail_urls, playing, visits, favorites, likes, dislikes,
    rating_percent, stats_tier, created_at_api, updated_at_api, last_stats_refreshed_at,
    last_playing_refreshed_at, desktop_enabled, mobile_enabled, tablet_enabled,
    console_enabled, vr_enabled, baseline_playing_24h, baseline_playing_7d,
    growth_24h, growth_24h_percent, growth_7d, growth_7d_percent, peak_24h,
    peak_7d, global_playing_rank, indexed_at
  `;
  let indexQuery = sb
    .from("stats_game_current_index")
    .select(indexSelect, { count: options.count ?? undefined })
    .not("slug", "is", null);

  if (options.q?.trim()) {
    const pattern = `%${options.q.trim().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    indexQuery = indexQuery.or(`name.ilike.${pattern},display_name.ilike.${pattern},creator_name.ilike.${pattern}`);
  }

  if (options.genre && options.genre !== "all") {
    indexQuery = indexQuery.or(`genre.eq.${options.genre},genre_l1.eq.${options.genre}`);
  }

  if (typeof options.minPlayers === "number" && options.minPlayers > 0) {
    indexQuery = indexQuery.gte("playing", options.minPlayers);
  }

  if (options.tierForSitemap) {
    indexQuery = indexQuery.or("stats_tier.in.(HOT,WARM),playing.gte.100,visits.gte.10000000");
  }

  const indexSort = options.sort ?? "playing";
  const indexSortColumn = INDEX_SORT_COLUMNS[indexSort];
  indexQuery = indexQuery
    .order(indexSortColumn, { ascending: indexSort === "created", nullsFirst: false })
    .order("universe_id", { ascending: true })
    .range(options.offset ?? 0, (options.offset ?? 0) + options.limit - 1);

  const indexResult = await indexQuery;
  if (!indexResult.error) {
    const indexRows = (indexResult.data ?? []) as StatsGameIndexRow[];
    if (indexRows.length > 0 || (await isStatsIndexAvailable())) {
      return {
        rows: indexRows.map(mapIndexedGame),
        total: indexResult.count ?? 0
      };
    }
  }
  if (indexResult.error && indexResult.error.code !== "42P01") {
    console.warn("Failed to read stats_game_current_index; falling back to roblox_universes", indexResult.error.message);
  }

  const select = `
    universe_id, root_place_id, name, display_name, slug, description,
    creator_id, creator_name, creator_type, genre, genre_l1, genre_l2, age_rating,
    icon_url, thumbnail_urls, playing, visits, favorites, likes, dislikes,
    stats_tier, created_at_api, updated_at_api, last_stats_refreshed_at,
    last_playing_refreshed_at, desktop_enabled, mobile_enabled, tablet_enabled,
    console_enabled, vr_enabled
  `;
  let query = sb
    .from("roblox_universes")
    .select(select, { count: options.count ?? undefined })
    .not("slug", "is", null);

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

  if (options.tierForSitemap) {
    query = query.or("stats_tier.in.(HOT,WARM),playing.gte.100,visits.gte.10000000");
  }

  const fallbackSort = options.sort ?? "playing";
  const sortColumn = SORT_COLUMNS[fallbackSort];
  if (sortColumn) {
    query = query.order(sortColumn, { ascending: fallbackSort === "created", nullsFirst: false });
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

async function listAllBaseGames(options: Omit<Parameters<typeof listBaseGames>[0], "limit" | "offset" | "count"> & { maxRows?: number }) {
  const { maxRows: requestedMaxRows, ...listOptions } = options;
  const maxRows = Math.max(requestedMaxRows ?? 5000, STATS_HOME_RISERS_LIMIT);
  const rows: StatsGame[] = [];
  let offset = 0;

  while (rows.length < maxRows) {
    const { rows: chunk } = await listBaseGames({
      ...listOptions,
      limit: Math.min(SUPABASE_READ_PAGE_SIZE, maxRows - rows.length),
      offset,
      count: null
    });
    rows.push(...chunk);
    if (chunk.length < SUPABASE_READ_PAGE_SIZE) break;
    offset += SUPABASE_READ_PAGE_SIZE;
  }

  return rows;
}

async function listCurrentRisers(limit: number): Promise<StatsGame[]> {
  const sb = supabaseAdmin();
  const risers = await sb
    .from("stats_risers_current_index")
    .select("universe_id, rank_value")
    .order("rank_value", { ascending: true })
    .limit(limit);
  if (risers.error || !(risers.data?.length)) {
    return [];
  }

  const rankById = new Map(
    ((risers.data ?? []) as Array<{ universe_id: number; rank_value: number }>).map((row) => [row.universe_id, row.rank_value])
  );
  const ids = [...rankById.keys()];
  const indexRows = await sb
    .from("stats_game_current_index")
    .select(`
      universe_id, root_place_id, name, display_name, slug, description,
      creator_id, creator_name, creator_type, genre, genre_l1, genre_l2, age_rating,
      icon_url, thumbnail_urls, playing, visits, favorites, likes, dislikes,
      rating_percent, stats_tier, created_at_api, updated_at_api, last_stats_refreshed_at,
      last_playing_refreshed_at, desktop_enabled, mobile_enabled, tablet_enabled,
      console_enabled, vr_enabled, baseline_playing_24h, baseline_playing_7d,
      growth_24h, growth_24h_percent, growth_7d, growth_7d_percent, peak_24h,
      peak_7d, global_playing_rank, indexed_at
    `)
    .in("universe_id", ids);
  if (indexRows.error) return [];
  return ((indexRows.data ?? []) as StatsGameIndexRow[])
    .map(mapIndexedGame)
    .sort((a, b) => (rankById.get(a.universeId) ?? Infinity) - (rankById.get(b.universeId) ?? Infinity))
    .map((game) => ({ ...game, rank: rankById.get(game.universeId) ?? game.rank }));
}

export async function listStatsGenres(limit = 12): Promise<StatsGenreSummary[]> {
  const { data, error } = await supabaseAdmin()
    .from("stats_genre_current_index")
    .select("genre, genre_slug, games, playing, visits, top_name, top_slug, top_icon_url, top_playing")
    .order("playing", { ascending: false })
    .limit(limit);

  if (!error) {
    return ((data ?? []) as Array<{
      genre: string;
      genre_slug: string;
      games: number;
      playing: number;
      visits: number;
      top_name: string | null;
      top_slug: string | null;
      top_icon_url: string | null;
      top_playing: number | null;
    }>).map((row) => ({
      genre: row.genre,
      slug: row.genre_slug,
      games: row.games,
      playing: row.playing,
      visits: row.visits,
      topGame: row.top_slug
        ? {
            name: row.top_name ?? row.genre,
            slug: row.top_slug,
            iconUrl: row.top_icon_url,
            playing: row.top_playing
          }
        : null
    }));
  }

  const { rows } = await listBaseGames({ limit: 500, sort: "playing" });
  const map = new Map<string, StatsGenreSummary>();
  for (const game of rows) {
    const label = game.genre || "Uncategorized";
    const slug = slugify(label) || "uncategorized";
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
    .select("universe_id, hour_start, playing, peak_playing, avg_playing, visits_end, favorites_end, likes_end, dislikes_end, rating_percent, sample_count")
    .in("universe_id", ids)
    .gte("hour_start", hoursAgo(24))
    .order("hour_start", { ascending: true });

  if (error) {
    console.warn("Failed to load platform trend", error.message);
    return [];
  }

  const byHour = new Map<string, StatsChartPoint>();
  const ratingByHour = new Map<string, { total: number; weight: number }>();
  for (const row of (data ?? []) as HourlyRow[]) {
    const existing = byHour.get(row.hour_start) ?? {
      label: new Date(row.hour_start).toLocaleTimeString("en-US", { hour: "numeric", hour12: true, timeZone: "UTC" }),
      sampledAt: row.hour_start,
      players: 0,
      peakPlayers: 0,
      avgPlayers: 0,
      visits: 0,
      favorites: 0,
      rating: null,
      samples: 0
    };
    existing.players = (existing.players ?? 0) + (row.avg_playing ?? row.playing ?? 0);
    existing.peakPlayers = (existing.peakPlayers ?? 0) + (row.peak_playing ?? 0);
    existing.avgPlayers = (existing.avgPlayers ?? 0) + (row.avg_playing ?? row.playing ?? 0);
    existing.visits = (existing.visits ?? 0) + (row.visits_end ?? 0);
    existing.favorites = (existing.favorites ?? 0) + (row.favorites_end ?? 0);
    existing.samples = (existing.samples ?? 0) + (row.sample_count ?? 0);
    const rating = getRatingPercent(row.likes_end, row.dislikes_end) ?? row.rating_percent;
    if (typeof rating === "number") {
      const sampleCount = Math.max(row.sample_count ?? 1, 1);
      const current = ratingByHour.get(row.hour_start) ?? { total: 0, weight: 0 };
      current.total += rating * sampleCount;
      current.weight += sampleCount;
      ratingByHour.set(row.hour_start, current);
    }
    byHour.set(row.hour_start, existing);
  }

  for (const [hour, rating] of ratingByHour.entries()) {
    const point = byHour.get(hour);
    if (point && rating.weight > 0) {
      point.rating = Math.round((rating.total / rating.weight) * 10) / 10;
    }
  }

  return Array.from(byHour.values()).sort((a, b) => Date.parse(a.sampledAt) - Date.parse(b.sampledAt));
}

export async function getStatsHome(): Promise<StatsHomeData> {
  const [{ rows: topBase }, { rows: visitedBase }, { total: trackedGames }, genres, riserBase] = await Promise.all([
    listBaseGames({ limit: STATS_HOME_TOP_GAMES_LIMIT, sort: "playing" }),
    listBaseGames({ limit: 10, sort: "visits" }),
    listBaseGames({ limit: 1, sort: "playing", count: "exact" }),
    listStatsGenres(STATS_HOME_GENRES_LIMIT),
    listCurrentRisers(STATS_HOME_RISERS_LIMIT)
  ]);
  const [topGames, mostVisited, activeRisers] = await Promise.all([
    Promise.resolve(topBase),
    Promise.resolve(visitedBase),
    Promise.resolve(riserBase)
  ]);
  const sortedByTrend = activeRisers
    .filter(isEligibleHomeRiser)
    .sort((a, b) => {
      const scoreDelta = momentumRiserScore(b) - momentumRiserScore(a);
      if (scoreDelta !== 0) return scoreDelta;
      const growthDelta = (b.growth24h ?? -Infinity) - (a.growth24h ?? -Infinity);
      if (growthDelta !== 0) return growthDelta;
      return (b.playing ?? -Infinity) - (a.playing ?? -Infinity);
    });
  const fallers = [...topGames]
    .filter((game) => typeof game.growth24h === "number" && game.growth24h < 0)
    .sort((a, b) => (a.growth24h ?? 0) - (b.growth24h ?? 0))
    .slice(0, 6);
  const { rows: recentGames } = await listBaseGames({ limit: 8, sort: "updated" });
  const platformTrend = await getPlatformTrend(topGames);
  const livePlayers = topGames.reduce((sum, game) => sum + (game.playing ?? 0), 0);
  const totalVisits = mostVisited.reduce((sum, game) => sum + (game.visits ?? 0), 0);
  const sortedRefreshTimes = topGames
    .map((game) => game.lastStatsRefreshedAt ?? game.lastPlayingRefreshedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  const lastUpdatedAt = sortedRefreshTimes[sortedRefreshTimes.length - 1] ?? null;

  return {
    totals: {
      trackedGames,
      featuredGames: topGames.length,
      livePlayers,
      totalVisits,
      lastUpdatedAt
    },
    topGames: topGames.slice(0, STATS_HOME_TOP_GAMES_LIMIT),
    risers: sortedByTrend.slice(0, STATS_HOME_RISERS_LIMIT),
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
  if (value === "24h") return "1d";
  return STATS_TIME_RANGES.some((option) => option.value === value) ? (value as StatsTimeRange) : "1d";
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
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? STATS_PAGE_SIZE, 10), 100);
  const sort = normalizeStatsSort(input.sort);
  const offset = (page - 1) * pageSize;
  const q = input.q?.trim() ?? "";
  const genre = input.genre?.trim() ?? "all";
  const minPlayers = typeof input.minPlayers === "number" && Number.isFinite(input.minPlayers) ? input.minPlayers : null;

  const [{ rows, total }, genreOptions] = await Promise.all([
    listBaseGames({
      limit: pageSize,
      offset,
      q,
      genre,
      minPlayers,
      sort,
      count: "planned"
    }),
    getStatsGenreOptions()
  ]);
  const genres = genre !== "all" && !genreOptions.includes(genre)
    ? [genre, ...genreOptions].sort((a, b) => a.localeCompare(b))
    : genreOptions;

  const games = rows.map((game, index) => ({ ...game, rank: game.rank ?? offset + index + 1 }));

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
  const genreIndex = await sb
    .from("stats_genre_current_index")
    .select("genre")
    .order("genre", { ascending: true })
    .limit(500);
  if (!genreIndex.error) {
    return ((genreIndex.data ?? []) as Array<{ genre: string | null }>)
      .map((row) => row.genre)
      .filter((value): value is string => Boolean(value?.trim()));
  }

  const { data, error } = await sb
    .from("roblox_universes")
    .select("genre_l1, genre")
    .not("slug", "is", null)
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

export async function searchStatsGamesForCompare(input: {
  q?: string | null;
  excludeUniverseIds?: number[];
  limit?: number;
}): Promise<StatsGameSearchResult[]> {
  const q = input.q?.trim() ?? "";
  if (q.length < 2) return [];
  const exclude = new Set(input.excludeUniverseIds ?? []);
  const { rows } = await listBaseGames({
    limit: Math.min(Math.max(input.limit ?? 8, 1), 12),
    q,
    sort: "playing"
  });
  return rows
    .filter((game) => !exclude.has(game.universeId))
    .map((game) => ({
      universeId: game.universeId,
      name: game.name,
      slug: game.slug,
      iconUrl: game.iconUrl,
      playing: game.playing,
      visits: game.visits
    }));
}

const RANGE_DAYS: Record<StatsTimeRange, number> = {
  "1d": 1,
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "90d": 90
};

const RESOLUTION_HOURS: Record<StatsChartResolution, number> = {
  hourly: 1,
  daily: 24,
  weekly: 24 * 7,
  monthly: 24 * 30
};

function chartRangeStart(range: StatsTimeRange) {
  return hoursAgo(RANGE_DAYS[range] * 24);
}

function chartWindow(range: StatsTimeRange, offsetPeriods = 0) {
  const durationMs = RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
  const end = new Date(Date.now() - offsetPeriods * durationMs);
  const start = new Date(end.getTime() - durationMs);
  return { start, end };
}

function formatChartDate(date: Date, withYear = false) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC"
  });
}

function formatBucketLabel(start: Date, end: Date, resolution: StatsChartResolution) {
  if (resolution === "hourly") {
    return end.toLocaleTimeString("en-US", { hour: "numeric", hour12: true, timeZone: "UTC" });
  }
  if (resolution === "daily") {
    return formatChartDate(end);
  }
  const startLabel = formatChartDate(start);
  const endLabel = formatChartDate(end, start.getUTCFullYear() !== end.getUTCFullYear());
  return startLabel === endLabel ? endLabel : `${startLabel}-${endLabel}`;
}

function formatBucketTooltip(start: Date, end: Date, resolution: StatsChartResolution) {
  if (resolution === "hourly") {
    return end.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    });
  }
  if (resolution === "daily") {
    return formatChartDate(end, true);
  }
  return `${formatChartDate(start, true)} - ${formatChartDate(end, true)}`;
}

function latestNumber<T extends keyof HourlyRow>(rows: HourlyRow[], key: T): number | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const value = rows[index]?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function bucketRows(
  rows: HourlyRow[],
  range: StatsTimeRange,
  resolution: StatsChartResolution,
  window = chartWindow(range)
): StatsChartPoint[] {
  if (!rows.length) return [];
  const rangeStart = window.start;
  const rangeEnd = window.end;
  const bucketMs = RESOLUTION_HOURS[resolution] * 60 * 60 * 1000;
  const buckets = new Map<number, HourlyRow[]>();

  for (const row of rows) {
    const sampledMs = Date.parse(row.hour_start);
    if (!Number.isFinite(sampledMs)) continue;
    if (sampledMs < rangeStart.getTime() || sampledMs > rangeEnd.getTime()) continue;
    const bucketIndex = Math.max(0, Math.floor((sampledMs - rangeStart.getTime()) / bucketMs));
    const bucket = buckets.get(bucketIndex) ?? [];
    bucket.push(row);
    buckets.set(bucketIndex, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([bucketIndex, bucket]) => {
      bucket.sort((a, b) => Date.parse(a.hour_start) - Date.parse(b.hour_start));
      const bucketStart = new Date(rangeStart.getTime() + bucketIndex * bucketMs);
      const bucketEnd = new Date(Math.min(rangeStart.getTime() + (bucketIndex + 1) * bucketMs, rangeEnd.getTime()));
      const sampledAt = bucket[bucket.length - 1]?.hour_start ?? bucketEnd.toISOString();
      let playingTotal = 0;
      let playingWeight = 0;
      let peakPlayers: number | null = null;
      let samples = 0;

      for (const row of bucket) {
        const sampleCount = Math.max(row.sample_count ?? 1, 1);
        const playing = row.avg_playing ?? row.playing;
        if (typeof playing === "number") {
          playingTotal += playing * sampleCount;
          playingWeight += sampleCount;
        }
        if (typeof row.peak_playing === "number") {
          peakPlayers = peakPlayers == null ? row.peak_playing : Math.max(peakPlayers, row.peak_playing);
        }
        samples += row.sample_count ?? 0;
      }

      const likesEnd = latestNumber(bucket, "likes_end");
      const dislikesEnd = latestNumber(bucket, "dislikes_end");
      const rating = getRatingPercent(likesEnd, dislikesEnd) ?? latestNumber(bucket, "rating_percent");
      const players = playingWeight > 0 ? playingTotal / playingWeight : null;

      return {
        label: formatBucketLabel(bucketStart, bucketEnd, resolution),
        tooltipLabel: formatBucketTooltip(bucketStart, bucketEnd, resolution),
        sampledAt,
        players,
        peakPlayers,
        avgPlayers: players,
        visits: latestNumber(bucket, "visits_end"),
        favorites: latestNumber(bucket, "favorites_end"),
        rating,
        samples
      };
    });
}

async function getBucketedChart(
  universeId: number,
  range: StatsTimeRange,
  resolution: StatsChartResolution,
  window = chartWindow(range)
): Promise<StatsChartPoint[]> {
  const sb = supabaseAdmin();
  const rows: HourlyRow[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await sb
      .from("roblox_universe_stats_hourly")
      .select("universe_id, hour_start, playing, avg_playing, peak_playing, visits_end, favorites_end, likes_end, dislikes_end, rating_percent, sample_count")
      .eq("universe_id", universeId)
      .gte("hour_start", window.start.toISOString())
      .lte("hour_start", window.end.toISOString())
      .order("hour_start", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.warn("Failed to load chart stats", error.message);
      return [];
    }
    const chunk = (data ?? []) as HourlyRow[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  return bucketRows(rows, range, resolution, window);
}

export function normalizeStatsResolution(value?: string | null): StatsChartResolution {
  return STATS_CHART_RESOLUTIONS.some((option) => option.value === value) ? (value as StatsChartResolution) : "hourly";
}

function parsePositiveUniverseIds(value: string | null, limit = 2): number[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((id) => Number.isSafeInteger(id) && id > 0)
    )
  ).slice(0, limit);
}

export function normalizeStatsCompareIds(value: string | null, currentUniverseId?: number): number[] {
  return parsePositiveUniverseIds(value, 2).filter((id) => id !== currentUniverseId);
}

async function getStatsGameComparisons(
  universeIds: number[],
  range: StatsTimeRange,
  resolution: StatsChartResolution,
  window = chartWindow(range)
): Promise<StatsChartComparison[]> {
  if (!universeIds.length) return [];
  const games = await Promise.all(universeIds.map((id) => getStatsGameSummaryByUniverseId(id)));
  const comparisons: StatsChartComparison[] = [];
  for (const game of games) {
    if (!game) continue;
    comparisons.push({
      universeId: game.universeId,
      name: game.name,
      slug: game.slug,
      iconUrl: game.iconUrl,
      points: await getBucketedChart(game.universeId, range, resolution, window)
    });
  }
  return comparisons;
}

function annotationTime(annotation: Pick<StatsChartAnnotation, "startAt" | "endAt">) {
  return annotation.startAt || annotation.endAt || "";
}

async function getStatsChartAnnotations(universeId: number, start: Date, end: Date): Promise<StatsChartAnnotation[]> {
  const sb = supabaseAdmin();
  const [eventsResult, updatesResult] = await Promise.all([
    sb
      .from("roblox_virtual_events")
      .select("event_id, title, display_title, start_utc, end_utc, created_utc, updated_utc, event_status, guide_slug")
      .eq("universe_id", universeId)
      .lte("start_utc", end.toISOString())
      .or(`end_utc.gte.${start.toISOString()},end_utc.is.null,updated_utc.gte.${start.toISOString()},created_utc.gte.${start.toISOString()}`)
      .order("start_utc", { ascending: true })
      .limit(50),
    sb
      .from("roblox_universe_update_events")
      .select("id, updated_at_api, detected_at, label, source")
      .eq("universe_id", universeId)
      .gte("updated_at_api", start.toISOString())
      .lte("updated_at_api", end.toISOString())
      .order("updated_at_api", { ascending: true })
      .limit(100)
  ]);

  const annotations: StatsChartAnnotation[] = [];
  if (!eventsResult.error) {
    for (const row of (eventsResult.data ?? []) as EventAnnotationRow[]) {
      const startAt = row.start_utc ?? row.updated_utc ?? row.created_utc;
      if (!startAt) continue;
      annotations.push({
        type: "event",
        id: row.event_id,
        label: row.display_title || row.title || "Roblox event",
        startAt,
        endAt: row.end_utc,
        status: row.event_status,
        href: row.guide_slug ? `/events/${row.guide_slug}` : null,
        source: "roblox_virtual_events"
      });
    }
  } else if (eventsResult.error.code !== "42P01") {
    console.warn("Failed to load stats event annotations", eventsResult.error.message);
  }

  if (!updatesResult.error) {
    for (const row of (updatesResult.data ?? []) as UpdateAnnotationRow[]) {
      annotations.push({
        type: "update",
        id: row.id,
        label: row.label || "Game updated",
        startAt: row.updated_at_api,
        endAt: null,
        status: null,
        href: null,
        source: row.source
      });
    }
  } else if (updatesResult.error.code !== "42P01") {
    console.warn("Failed to load stats update annotations", updatesResult.error.message);
  }

  return annotations.sort((a, b) => Date.parse(annotationTime(a)) - Date.parse(annotationTime(b)));
}

export async function getStatsGameChart(
  universeId: number,
  range: StatsTimeRange = "1d",
  resolution: StatsChartResolution = "hourly",
  options: { includePrevious?: boolean; includeAnnotations?: boolean; compareUniverseIds?: number[] } = {}
): Promise<StatsGameChartData> {
  const window = chartWindow(range);
  const previousWindow = chartWindow(range, 1);
  const [points, previousPoints, comparisons, annotations] = await Promise.all([
    getBucketedChart(universeId, range, resolution, window),
    options.includePrevious ? getBucketedChart(universeId, range, resolution, previousWindow) : Promise.resolve(undefined),
    getStatsGameComparisons(options.compareUniverseIds ?? [], range, resolution, window),
    options.includeAnnotations ? getStatsChartAnnotations(universeId, window.start, window.end) : Promise.resolve(undefined)
  ]);
  return {
    range,
    requestedResolution: resolution,
    resolution,
    points,
    previousPoints,
    comparisons,
    annotations
  };
}

const RANK_TYPES_BY_KEY = {
  global: "global_playing",
  genre: "genre_playing",
  subgenre: "subgenre_playing"
} as const;

type StatsRankKey = keyof typeof RANK_TYPES_BY_KEY;

function latestRankValue(rows: RankSnapshotRow[], rankType: string) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row?.rank_type === rankType && typeof row.rank_value === "number") return row.rank_value;
  }
  return null;
}

function latestRankMetric(rows: RankSnapshotRow[], rankType: string) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row?.rank_type === rankType && typeof row.metric_value === "number") return row.metric_value;
  }
  return null;
}

function bucketRankRows(
  rows: RankSnapshotRow[],
  range: StatsTimeRange,
  resolution: StatsChartResolution,
  window = chartWindow(range)
): StatsRankPoint[] {
  if (!rows.length) return [];
  const rangeStart = window.start;
  const rangeEnd = window.end;
  const bucketMs = RESOLUTION_HOURS[resolution] * 60 * 60 * 1000;
  const buckets = new Map<number, RankSnapshotRow[]>();

  for (const row of rows) {
    const sampledMs = Date.parse(row.sampled_at);
    if (!Number.isFinite(sampledMs)) continue;
    if (sampledMs < rangeStart.getTime() || sampledMs > rangeEnd.getTime()) continue;
    const bucketIndex = Math.max(0, Math.floor((sampledMs - rangeStart.getTime()) / bucketMs));
    const bucket = buckets.get(bucketIndex) ?? [];
    bucket.push(row);
    buckets.set(bucketIndex, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([bucketIndex, bucket]) => {
      bucket.sort((a, b) => Date.parse(a.sampled_at) - Date.parse(b.sampled_at));
      const bucketStart = new Date(rangeStart.getTime() + bucketIndex * bucketMs);
      const bucketEnd = new Date(Math.min(rangeStart.getTime() + (bucketIndex + 1) * bucketMs, rangeEnd.getTime()));
      const sampledAt = bucket[bucket.length - 1]?.sampled_at ?? bucketEnd.toISOString();
      return {
        label: formatBucketLabel(bucketStart, bucketEnd, resolution),
        tooltipLabel: formatBucketTooltip(bucketStart, bucketEnd, resolution),
        sampledAt,
        globalRank: latestRankValue(bucket, RANK_TYPES_BY_KEY.global),
        genreRank: latestRankValue(bucket, RANK_TYPES_BY_KEY.genre),
        subgenreRank: latestRankValue(bucket, RANK_TYPES_BY_KEY.subgenre),
        globalPlayers: latestRankMetric(bucket, RANK_TYPES_BY_KEY.global),
        genrePlayers: latestRankMetric(bucket, RANK_TYPES_BY_KEY.genre),
        subgenrePlayers: latestRankMetric(bucket, RANK_TYPES_BY_KEY.subgenre),
        samples: bucket.length
      };
    });
}

function summarizeRankRows(rows: RankSnapshotRow[], game: Pick<StatsGame, "genre" | "subgenre">): StatsRankSummary[] {
  const labels: Record<StatsRankKey, { label: string; scopeLabel: string | null }> = {
    global: { label: "Global", scopeLabel: null },
    genre: { label: "Genre", scopeLabel: game.genre },
    subgenre: { label: "Subgenre", scopeLabel: game.subgenre }
  };

  return (["global", "genre", "subgenre"] as StatsRankKey[]).map((key) => {
    const rankType = RANK_TYPES_BY_KEY[key];
    const scopedRows = rows
      .filter((row) => row.rank_type === rankType && typeof row.rank_value === "number")
      .sort((a, b) => Date.parse(a.sampled_at) - Date.parse(b.sampled_at));
    const current = scopedRows[scopedRows.length - 1];
    const best = scopedRows.reduce<RankSnapshotRow | null>(
      (candidate, row) => (!candidate || row.rank_value < candidate.rank_value ? row : candidate),
      null
    );
    const firstTop1 = scopedRows.find((row) => row.rank_value === 1) ?? null;
    const lastTop1 = [...scopedRows].reverse().find((row) => row.rank_value === 1) ?? null;
    const firstTop10 = scopedRows.find((row) => row.rank_value <= 10) ?? null;
    let lastExitedTop1: RankSnapshotRow | null = null;
    let lastExitedTop10: RankSnapshotRow | null = null;
    for (let index = 1; index < scopedRows.length; index += 1) {
      if (scopedRows[index - 1]?.rank_value === 1 && scopedRows[index]?.rank_value > 1) {
        lastExitedTop1 = scopedRows[index] ?? null;
      }
      if (scopedRows[index - 1]?.rank_value <= 10 && scopedRows[index]?.rank_value > 10) {
        lastExitedTop10 = scopedRows[index] ?? null;
      }
    }

    return {
      key,
      label: labels[key].label,
      scopeLabel: labels[key].scopeLabel,
      currentRank: current?.rank_value ?? null,
      currentAt: current?.sampled_at ?? null,
      bestRank: best?.rank_value ?? null,
      bestAt: best?.sampled_at ?? null,
      firstTop1At: firstTop1?.sampled_at ?? null,
      lastTop1At: lastTop1?.sampled_at ?? null,
      lastExitedTop1At: lastExitedTop1?.sampled_at ?? null,
      firstTop10At: firstTop10?.sampled_at ?? null,
      lastExitedTop10At: lastExitedTop10?.sampled_at ?? null,
      sampleCount: scopedRows.length
    };
  });
}

async function getRankRows(universeId: number, range: StatsTimeRange, window = chartWindow(range)): Promise<RankSnapshotRow[]> {
  const sb = supabaseAdmin();
  const rows: RankSnapshotRow[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from("roblox_universe_rank_snapshots_hourly")
      .select("rank_type, rank_value, metric_value, hour_start, sampled_at")
      .eq("universe_id", universeId)
      .in("rank_type", Object.values(RANK_TYPES_BY_KEY))
      .gte("hour_start", window.start.toISOString())
      .lte("hour_start", window.end.toISOString())
      .order("hour_start", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.warn("Failed to load rank chart stats", error.message);
      return [];
    }
    const chunk = (data ?? []) as HourlyRankSnapshotRow[];
    rows.push(
      ...chunk.map((row) => ({
        rank_type: row.rank_type,
        rank_value: row.rank_value,
        metric_value: row.metric_value,
        sampled_at: row.hour_start
      }))
    );
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

export async function getStatsGameRankChart(
  game: Pick<StatsGame, "universeId" | "genre" | "subgenre">,
  range: StatsTimeRange = "1d",
  resolution: StatsChartResolution = "hourly",
  options: { includePrevious?: boolean; includeAnnotations?: boolean } = {}
): Promise<StatsGameRankChartData> {
  const window = chartWindow(range);
  const previousWindow = chartWindow(range, 1);
  const [rows, previousRows, annotations] = await Promise.all([
    getRankRows(game.universeId, range, window),
    options.includePrevious ? getRankRows(game.universeId, range, previousWindow) : Promise.resolve(undefined),
    options.includeAnnotations ? getStatsChartAnnotations(game.universeId, window.start, window.end) : Promise.resolve(undefined)
  ]);
  return {
    range,
    requestedResolution: resolution,
    resolution,
    points: bucketRankRows(rows, range, resolution, window),
    previousPoints: previousRows ? bucketRankRows(previousRows, range, resolution, previousWindow) : undefined,
    annotations,
    summaries: summarizeRankRows(rows, game)
  };
}

export async function getStatsGameRankChartByUniverseId(
  universeId: number,
  range: StatsTimeRange = "1d",
  resolution: StatsChartResolution = "hourly",
  options: { includePrevious?: boolean; includeAnnotations?: boolean } = {}
): Promise<StatsGameRankChartData> {
  const game = await getStatsGameSummaryByUniverseId(universeId);
  return getStatsGameRankChart(
    {
      universeId,
      genre: game?.genre ?? null,
      subgenre: game?.subgenre ?? null
    },
    range,
    resolution,
    options
  );
}

export async function getStatsGameBySlug(slug: string): Promise<StatsGameDetailData | null> {
  const sb = supabaseAdmin();
  const parsedUniverseId = parseStatsUniverseIdSlug(slug);
  const numericSlug = Number(slug);
  const indexFields = `
    universe_id, root_place_id, name, display_name, slug, description,
    creator_id, creator_name, creator_type, genre, genre_l1, genre_l2, age_rating,
    icon_url, thumbnail_urls, playing, visits, favorites, likes, dislikes,
    rating_percent, stats_tier, created_at_api, updated_at_api, last_stats_refreshed_at,
    last_playing_refreshed_at, desktop_enabled, mobile_enabled, tablet_enabled,
    console_enabled, vr_enabled, baseline_playing_24h, baseline_playing_7d,
    growth_24h, growth_24h_percent, growth_7d, growth_7d_percent, peak_24h,
    peak_7d, global_playing_rank, indexed_at
  `;
  const fields = `
    universe_id, root_place_id, name, display_name, slug, description,
    creator_id, creator_name, creator_type, genre, genre_l1, genre_l2, age_rating,
    icon_url, thumbnail_urls, playing, visits, favorites, likes, dislikes,
    stats_tier, created_at_api, updated_at_api, last_stats_refreshed_at,
    last_playing_refreshed_at, desktop_enabled, mobile_enabled, tablet_enabled,
    console_enabled, vr_enabled
  `;

  if (parsedUniverseId || Number.isFinite(numericSlug)) {
    const indexed = await sb
      .from("stats_game_current_index")
      .select(indexFields)
      .eq("universe_id", parsedUniverseId ?? numericSlug)
      .limit(1)
      .maybeSingle();
    if (!indexed.error && indexed.data) return buildStatsGameDetail(indexed.data as StatsGameIndexRow);

    const { data, error } = await sb
      .from("roblox_universes")
      .select(fields)
      .eq("universe_id", parsedUniverseId ?? numericSlug)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return buildStatsGameDetail(data as UniverseRow);
  }

  const indexed = await sb
    .from("stats_game_current_index")
    .select(indexFields)
    .eq("slug", slug)
    .order("visits", { ascending: false, nullsFirst: false })
    .order("playing", { ascending: false, nullsFirst: false })
    .order("last_stats_refreshed_at", { ascending: false, nullsFirst: false })
    .order("universe_id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!indexed.error && indexed.data) return buildStatsGameDetail(indexed.data as StatsGameIndexRow);

  const { data, error } = await sb
    .from("roblox_universes")
    .select(fields)
    .eq("slug", slug)
    .order("visits", { ascending: false, nullsFirst: false })
    .order("playing", { ascending: false, nullsFirst: false })
    .order("last_stats_refreshed_at", { ascending: false, nullsFirst: false })
    .order("universe_id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return buildStatsGameDetail(data as UniverseRow);
}

async function buildStatsGameDetail(row: UniverseRow | StatsGameIndexRow): Promise<StatsGameDetailData> {
  const baseGame =
    "indexed_at" in row
      ? mapIndexedGame(row)
      : (await attachGrowth([mapUniverse(row)]))[0];
  const [initialChart, initialRankChart, relatedLinks, sameCreator, similarGames, includedInLists, globalRank] = await Promise.all([
    getStatsGameChart(baseGame.universeId, "1d", "hourly", { includeAnnotations: true }),
    getStatsGameRankChart(baseGame, "1d", "hourly", { includeAnnotations: true }),
    loadRelatedLinks(baseGame.universeId, baseGame),
    loadSameCreatorGames(baseGame),
    loadSimilarGames(baseGame),
    loadListLinks(baseGame.universeId),
    loadLatestRank(baseGame.universeId)
  ]);

  return {
    game: { ...baseGame, rank: globalRank, links: relatedLinks },
    initialChart,
    initialRankChart,
    relatedLinks,
    sameCreator,
    similarGames,
    includedInLists
  };
}

export async function getStatsGameSummaryByUniverseId(universeId: number): Promise<StatsGame | null> {
  const sb = supabaseAdmin();
  const indexed = await sb
    .from("stats_game_current_index")
    .select(`
      universe_id, root_place_id, name, display_name, slug, description,
      creator_id, creator_name, creator_type, genre, genre_l1, genre_l2, age_rating,
      icon_url, thumbnail_urls, playing, visits, favorites, likes, dislikes,
      rating_percent, stats_tier, created_at_api, updated_at_api, last_stats_refreshed_at,
      last_playing_refreshed_at, desktop_enabled, mobile_enabled, tablet_enabled,
      console_enabled, vr_enabled, baseline_playing_24h, baseline_playing_7d,
      growth_24h, growth_24h_percent, growth_7d, growth_7d_percent, peak_24h,
      peak_7d, global_playing_rank, indexed_at
    `)
    .eq("universe_id", universeId)
    .limit(1)
    .maybeSingle();
  if (!indexed.error && indexed.data) return mapIndexedGame(indexed.data as StatsGameIndexRow);

  const { data, error } = await sb
    .from("roblox_universes")
    .select(`
      universe_id, root_place_id, name, display_name, slug, description,
      creator_id, creator_name, creator_type, genre, genre_l1, genre_l2, age_rating,
      icon_url, thumbnail_urls, playing, visits, favorites, likes, dislikes,
      stats_tier, created_at_api, updated_at_api, last_stats_refreshed_at,
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
    .from("roblox_universe_rank_snapshots_hourly")
    .select("rank_value")
    .eq("universe_id", universeId)
    .eq("rank_type", "global_playing")
    .order("hour_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("Failed to load stats rank", error.message);
    return null;
  }
  return toNumber((data as { rank_value?: unknown } | null)?.rank_value);
}

export async function listStatsSitemapGames(limit = 200): Promise<Array<{ slug: string; updatedAt: string | null }>> {
  const { rows } = await listBaseGames({ limit, sort: "playing", tierForSitemap: true });
  return rows.map((game) => ({
    slug: game.slug,
    updatedAt: game.lastStatsRefreshedAt ?? game.lastPlayingRefreshedAt ?? game.updatedAtApi
  }));
}

export function robloxGameUrl(game: Pick<StatsGame, "rootPlaceId" | "universeId">) {
  return `https://www.roblox.com/games/${game.rootPlaceId ?? game.universeId}`;
}
