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
export const STATS_GAME_MIN_RATING_VOTES = 25;
const SUPABASE_READ_PAGE_SIZE = 1000;
const SUPABASE_IN_CHUNK_SIZE = 500;
const STATS_GROWTH_BASELINE_TOLERANCE_MS = 90 * 60 * 1000;
let statsIndexAvailability: Promise<boolean> | null = null;
let statsItemIndexAvailability: Promise<boolean> | null = null;
let statsItemHistoryAvailability: Promise<boolean> | null = null;
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
  | "likes"
  | "dislikes"
  | "updated"
  | "created";

export type StatsCreatorSortKey = "playing" | "visits" | "favorites" | "games" | "members";
export type StatsCreatorTypeFilter = "all" | "group" | "user";
export type StatsItemSortKey = "favorites" | "price_high" | "price_low" | "resale_low" | "newest" | "updated";
export type StatsItemSaleFilter = "all" | "free" | "paid" | "resale";
export type StatsItemCreatorFilter = "all" | "roblox" | "creators" | "verified";

export type StatsTimeRange = "1d" | "7d" | "14d" | "30d" | "90d";
export type StatsMetricKey = "players" | "visits" | "favorites" | "rating";
export type StatsChartResolution = "hourly" | "daily" | "weekly" | "monthly";
export type StatsGameColumnKey =
  | "rank"
  | "playing"
  | "growth24h"
  | "growth7d"
  | "visits"
  | "favorites"
  | "rating"
  | "likes"
  | "dislikes"
  | "genre"
  | "subgenre"
  | "creator"
  | "ageRating"
  | "peak24h"
  | "peak7d"
  | "created"
  | "updated"
  | "statsRefresh";

export const DEFAULT_STATS_CHART_RANGE: StatsTimeRange = "14d";
export const DEFAULT_STATS_CHART_RESOLUTION: StatsChartResolution = "hourly";
export const DEFAULT_STATS_GAME_COLUMNS: StatsGameColumnKey[] = ["rank", "playing", "growth24h", "growth7d", "visits", "rating", "updated"];
export const STATS_GAME_COLUMN_OPTIONS: Array<{ value: StatsGameColumnKey; label: string }> = [
  { value: "rank", label: "Rank" },
  { value: "playing", label: "Current players" },
  { value: "growth24h", label: "24h change" },
  { value: "growth7d", label: "7d change" },
  { value: "visits", label: "Visits" },
  { value: "favorites", label: "Favorites" },
  { value: "rating", label: "Rating" },
  { value: "likes", label: "Upvotes" },
  { value: "dislikes", label: "Downvotes" },
  { value: "genre", label: "Genre" },
  { value: "subgenre", label: "Subgenre" },
  { value: "creator", label: "Creator" },
  { value: "ageRating", label: "Age rating" },
  { value: "peak24h", label: "24h peak CCU" },
  { value: "peak7d", label: "7d peak CCU" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "statsRefresh", label: "Stats refresh" }
];

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
  type: "codes" | "wiki" | "catalog" | "event" | "tool" | "quiz" | "checklist" | "article" | "roblox";
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

export type StatsRankChartComparison = {
  universeId: number;
  name: string;
  slug: string;
  iconUrl: string | null;
  points: StatsRankPoint[];
};

export type StatsGameSearchResult = {
  universeId: number;
  name: string;
  slug: string;
  iconUrl: string | null;
  playing: number | null;
  visits: number | null;
  genre: string | null;
  subgenre: string | null;
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

export type StatsCreator = {
  creatorKey: string;
  creatorType: "group" | "user" | string;
  creatorId: number;
  creatorName: string;
  creatorSlug: string;
  gameCount: number;
  playing: number;
  visits: number;
  favorites: number;
  likes: number;
  dislikes: number;
  ratingPercent: number | null;
  topGame: Pick<StatsGame, "universeId" | "name" | "displayName" | "slug" | "iconUrl" | "playing" | "visits" | "favorites"> | null;
  memberCount: number | null;
  hasVerifiedBadge: boolean | null;
  lastStatsRefreshedAt: string | null;
  indexedAt: string | null;
  rank: number | null;
};

export type StatsItem = {
  assetId: number;
  itemType: string;
  assetTypeId: number | null;
  name: string;
  description: string | null;
  category: string;
  subcategory: string;
  creatorName: string;
  creatorId: number | null;
  creatorType: string | null;
  creatorHasVerifiedBadge: boolean | null;
  favoriteCount: number;
  priceRobux: number | null;
  priceStatus: string | null;
  lowestPriceRobux: number | null;
  lowestResalePriceRobux: number | null;
  isForSale: boolean | null;
  isLimited: boolean | null;
  isLimitedUnique: boolean | null;
  hasResellers: boolean | null;
  totalQuantity: number | null;
  unitsAvailableForConsumption?: number | null;
  quantityLimitPerUser?: number | null;
  collectibleItemId?: string | null;
  itemStatsTier?: string | null;
  remaining: number | null;
  lastSeenAt: string | null;
  lastItemStatsRefreshedAt?: string | null;
  lastResaleDataFetchedAt?: string | null;
  priceChange24h?: number | null;
  resaleChange24h?: number | null;
  favoriteChange24h?: number | null;
  priceChange7d?: number | null;
  resaleChange7d?: number | null;
  favoriteChange7d?: number | null;
  globalFavoritesRank?: number | null;
  globalResaleRank?: number | null;
  createdAt: string | null;
  robloxUrl: string;
  thumbnailUrl: string | null;
  rank: number | null;
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
  platformChart: StatsGameChartData;
};

export type StatsPlatformTotals = {
  trackedGames: number;
  livePlayers: number;
  totalVisits: number;
  totalFavorites: number;
  totalLikes: number;
  totalDislikes: number;
  ratingPercent: number | null;
  lastUpdatedAt: string | null;
};

export type StatsPlatformPageData = {
  totals: StatsPlatformTotals;
  chart: StatsGameChartData;
  topGames: StatsGame[];
  risers: StatsGame[];
  mostVisited: StatsGame[];
  genres: StatsGenreSummary[];
};

export type StatsGamesPageData = {
  games: StatsGame[];
  total: number;
  page: number;
  totalPages: number;
  genres: string[];
  subgenres: StatsSubgenreOption[];
  filters: {
    q: string;
    genres: string[];
    subgenres: string[];
    sort: StatsSortKey;
    minPlayers: number | null;
    columns: StatsGameColumnKey[];
  };
};

export type StatsCreatorsPageData = {
  creators: StatsCreator[];
  total: number;
  page: number;
  totalPages: number;
  filters: {
    q: string;
    sort: StatsCreatorSortKey;
    creatorType: StatsCreatorTypeFilter;
  };
};

export type StatsItemsPageData = {
  items: StatsItem[];
  total: number;
  page: number;
  totalPages: number;
  filters: {
    q: string;
    sort: StatsItemSortKey;
    category: string;
    subcategory: string;
    sale: StatsItemSaleFilter;
    creator: StatsItemCreatorFilter;
  };
};

export type StatsItemChartPoint = {
  label: string;
  sampledAt: string;
  priceRobux: number | null;
  lowestResalePriceRobux: number | null;
  favoriteCount: number | null;
  availableUnits: number | null;
  resaleVolume: number | null;
};

export type StatsItemDetailData = {
  item: StatsItem;
  hourlyPoints: StatsItemChartPoint[];
  dailyPoints: StatsItemChartPoint[];
  resalePoints: StatsItemChartPoint[];
  similarItems: StatsItem[];
};

export type StatsSubgenreOption = {
  genre: string;
  subgenre: string;
  games: number;
  playing: number;
};

export type StatsGameDetailData = {
  game: StatsGame;
  initialChart: StatsGameChartData;
  initialRankChart: StatsGameRankChartData;
  relatedLinks: StatsRelatedLink[];
  sameCreator: StatsGame[];
  similarGames: StatsGame[];
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
  comparisons?: StatsRankChartComparison[];
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

type StatsCreatorIndexRow = {
  creator_key: string;
  creator_type: string;
  creator_id: number;
  creator_name: string;
  creator_slug: string;
  game_count: number;
  playing: number | null;
  visits: number | null;
  favorites: number | null;
  likes: number | null;
  dislikes: number | null;
  rating_percent: number | null;
  top_universe_id: number | null;
  top_slug: string | null;
  top_name: string | null;
  top_display_name: string | null;
  top_icon_url: string | null;
  top_playing: number | null;
  top_visits: number | null;
  top_favorites: number | null;
  member_count: number | null;
  has_verified_badge: boolean | null;
  last_stats_refreshed_at: string | null;
  indexed_at: string | null;
};

type StatsItemIndexRow = {
  asset_id: number;
  item_type: string;
  asset_type_id: number | null;
  name: string;
  description: string | null;
  category: string;
  subcategory: string;
  creator_name: string;
  creator_id: number | null;
  creator_type: string | null;
  creator_has_verified_badge: boolean | null;
  favorite_count: number | null;
  price_robux: number | null;
  price_status: string | null;
  lowest_price_robux: number | null;
  lowest_resale_price_robux: number | null;
  is_for_sale: boolean | null;
  is_limited: boolean | null;
  is_limited_unique: boolean | null;
  has_resellers: boolean | null;
  total_quantity: number | null;
  units_available_for_consumption?: number | null;
  quantity_limit_per_user?: number | null;
  collectible_item_id?: string | null;
  item_stats_tier?: string | null;
  first_seen_at?: string | null;
  remaining: number | null;
  last_seen_at: string | null;
  last_item_stats_refreshed_at?: string | null;
  last_resale_data_fetched_at?: string | null;
  thumbnail_url?: string | null;
  thumbnail_state?: string | null;
  roblox_url?: string | null;
  price_change_24h?: number | null;
  resale_change_24h?: number | null;
  favorite_change_24h?: number | null;
  price_change_7d?: number | null;
  resale_change_7d?: number | null;
  favorite_change_7d?: number | null;
  global_favorites_rank?: number | null;
  global_resale_rank?: number | null;
  created_at: string | null;
  raw_catalog_json?: Record<string, unknown> | null;
};

type StatsItemThumbnailRow = {
  asset_id: number;
  size: string | null;
  format: string | null;
  state: string | null;
  image_url: string | null;
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

type PlatformTrendRow = {
  hour_start: string;
  players: number | string | null;
  peak_players: number | string | null;
  avg_players: number | string | null;
  visits: number | string | null;
  favorites: number | string | null;
  rating: number | string | null;
  samples: number | string | null;
};

type PlatformAggregateRow = {
  hour_start?: string | null;
  stat_date?: string | null;
  playing: number | string | null;
  peak_players: number | string | null;
  avg_players: number | string | null;
  visits: number | string | null;
  favorites: number | string | null;
  rating_percent: number | string | null;
  tracked_games: number | string | null;
  samples: number | string | null;
  recorded_at: string | null;
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
  likes: "likes",
  dislikes: "dislikes",
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
  likes: "likes",
  dislikes: "dislikes",
  updated: "updated_at_api",
  created: "created_at_api"
};

const CREATOR_SORT_COLUMNS: Record<StatsCreatorSortKey, keyof StatsCreatorIndexRow> = {
  playing: "playing",
  visits: "visits",
  favorites: "favorites",
  games: "game_count",
  members: "member_count"
};

export const STATS_SORT_OPTIONS: Array<{ value: StatsSortKey; label: string }> = [
  { value: "playing", label: "Current players" },
  { value: "growth_24h", label: "24h growth" },
  { value: "growth_7d", label: "7d growth" },
  { value: "visits", label: "Visits" },
  { value: "favorites", label: "Favorites" },
  { value: "rating", label: "Rating" },
  { value: "peak", label: "Peak CCU" },
  { value: "likes", label: "Upvotes" },
  { value: "dislikes", label: "Downvotes" },
  { value: "updated", label: "Roblox updated" },
  { value: "created", label: "Created date" }
];

export const STATS_GAMES_INDEXABLE_SORTS: StatsSortKey[] = [
  "playing",
  "growth_24h",
  "growth_7d",
  "visits",
  "favorites",
  "rating",
  "peak",
  "likes",
  "dislikes"
];

export const STATS_GAME_DETAIL_INDEX_LIMIT = 1000;

const STATS_GAMES_INDEXABLE_SORT_SET = new Set<StatsSortKey>(STATS_GAMES_INDEXABLE_SORTS);

function statsGamesSeoSubject(genre?: string | null) {
  const cleanedGenre = cleanStatsTaxonomyLabel(genre);
  return cleanedGenre ? `${cleanedGenre} Roblox Games` : "Roblox Games";
}

export function buildStatsGamesIndexPath({
  genre,
  sort = "playing"
}: {
  genre?: string | null;
  sort?: StatsSortKey;
}) {
  const params = new URLSearchParams();
  const cleanedGenre = cleanStatsTaxonomyLabel(genre);
  if (cleanedGenre) params.set("genre", cleanedGenre);
  if (sort !== "playing") params.set("sort", sort);
  const query = params.toString();
  return query ? `/stats/games?${query}` : "/stats/games";
}

export function statsGamesSeoTitle(sort: StatsSortKey, genre?: string | null) {
  const cleanedGenre = cleanStatsTaxonomyLabel(genre);
  const subject = statsGamesSeoSubject(cleanedGenre);
  switch (sort) {
    case "growth_24h":
      return `Trending ${subject} in the Last 24 Hours`;
    case "growth_7d":
      return `Trending ${subject} This Week`;
    case "visits":
      return `Most Visited ${subject}`;
    case "favorites":
      return `Most Favorited ${subject}`;
    case "rating":
      return `Highest Rated ${subject}`;
    case "peak":
      return `${subject} With the Highest Peak Players`;
    case "likes":
      return `${subject} With the Most Upvotes`;
    case "dislikes":
      return `${subject} With the Most Downvotes`;
    default:
      return cleanedGenre ? `Top Trending ${subject} Right Now` : "Top Trending Roblox Games Right Now";
  }
}

export function statsGamesSeoDescription(sort: StatsSortKey, genre?: string | null) {
  const title = statsGamesSeoTitle(sort, genre);
  const genrePhrase = cleanStatsTaxonomyLabel(genre) ? `${cleanStatsTaxonomyLabel(genre)} Roblox games` : "Roblox games";
  switch (sort) {
    case "growth_24h":
      return `${title}. Track which ${genrePhrase} are gaining players fastest over the last 24 hours with live Bloxodes stats.`;
    case "growth_7d":
      return `${title}. Compare the ${genrePhrase} gaining the most players over the past week.`;
    case "visits":
      return `${title}. Browse ${genrePhrase} ranked by total Roblox visits, with players, favorites, ratings, and trend data.`;
    case "favorites":
      return `${title}. Browse ${genrePhrase} ranked by total favorites, with live players, visits, ratings, and trend data.`;
    case "rating":
      return `${title}. Compare ${genrePhrase} by rating, current players, visits, favorites, and public Bloxodes trend data.`;
    case "peak":
      return `${title}. Find ${genrePhrase} with the strongest recent peak player counts and live stats history.`;
    case "likes":
      return `${title}. Browse ${genrePhrase} ranked by Roblox upvotes, with player counts, visits, favorites, and ratings.`;
    case "dislikes":
      return `${title}. Browse ${genrePhrase} ranked by Roblox downvotes, with player counts, visits, favorites, and ratings.`;
    default:
      return `${title}. Browse live current players, visits, favorites, ratings, and trend data for ${genrePhrase} on Bloxodes.`;
  }
}

function statsColumnsMatchDefault(columns: StatsGameColumnKey[]) {
  return (
    columns.length === DEFAULT_STATS_GAME_COLUMNS.length &&
    columns.every((column, index) => column === DEFAULT_STATS_GAME_COLUMNS[index])
  );
}

export function getStatsGamesSeoState(parsed: ReturnType<typeof parseStatsSearchParams>) {
  const singleGenre = parsed.genres.length === 1 ? cleanStatsTaxonomyLabel(parsed.genres[0]) : null;
  const hasExplicitDefaultSort = parsed.rawSort === "playing";
  const hasUnknownSort = Boolean(parsed.rawSort) && parsed.rawSort !== parsed.sort;
  const approvedSort = STATS_GAMES_INDEXABLE_SORT_SET.has(parsed.sort) && !hasUnknownSort;
  const indexable =
    parsed.page === 1 &&
    !parsed.q &&
    parsed.genres.length <= 1 &&
    parsed.subgenres.length === 0 &&
    !parsed.minPlaying &&
    statsColumnsMatchDefault(parsed.columns) &&
    !hasExplicitDefaultSort &&
    approvedSort;
  const canonicalSort = approvedSort ? parsed.sort : "playing";
  const canonicalPath = buildStatsGamesIndexPath({ genre: singleGenre, sort: canonicalSort });
  return {
    indexable,
    genre: singleGenre,
    sort: canonicalSort,
    title: statsGamesSeoTitle(canonicalSort, singleGenre),
    description: statsGamesSeoDescription(canonicalSort, singleGenre),
    canonicalPath
  };
}

export function listStatsGamesIndexPaths(genres: string[]) {
  const scopes = [null, ...genres.map((genre) => cleanStatsTaxonomyLabel(genre)).filter((genre): genre is string => Boolean(genre))];
  const paths = new Set<string>();
  for (const genre of scopes) {
    for (const sort of STATS_GAMES_INDEXABLE_SORTS) {
      paths.add(buildStatsGamesIndexPath({ genre, sort }));
    }
  }
  return Array.from(paths);
}

type StatsGameDetailIndexBoundary = {
  universe_id: number;
  playing: number | null;
};

function isStatsGameSitemapEligible(game: Pick<StatsGame, "playing" | "visits" | "statsTier">) {
  return (
    game.statsTier === "HOT" ||
    game.statsTier === "WARM" ||
    (game.playing ?? 0) >= 100 ||
    (game.visits ?? 0) >= 10_000_000
  );
}

async function loadStatsGameDetailIndexBoundary(): Promise<StatsGameDetailIndexBoundary | null> {
  const { data, error } = await supabaseAdmin()
    .from("stats_game_current_index")
    .select("universe_id, playing")
    .not("slug", "is", null)
    .or("stats_tier.in.(HOT,WARM),playing.gte.100,visits.gte.10000000")
    .order("playing", { ascending: false, nullsFirst: false })
    .order("universe_id", { ascending: true })
    .range(STATS_GAME_DETAIL_INDEX_LIMIT - 1, STATS_GAME_DETAIL_INDEX_LIMIT - 1)
    .maybeSingle();
  if (error) {
    console.warn("Failed to load stats game detail index boundary", error.message);
    return null;
  }
  return data as StatsGameDetailIndexBoundary | null;
}

export async function isStatsGameDetailIndexable(game: Pick<StatsGame, "universeId" | "playing" | "visits" | "statsTier">) {
  if (!isStatsGameSitemapEligible(game)) return false;

  const boundary = await loadStatsGameDetailIndexBoundary();
  if (!boundary) return false;

  const playing = game.playing ?? 0;
  const boundaryPlaying = toNumber(boundary.playing) ?? 0;
  if (playing > boundaryPlaying) return true;
  if (playing < boundaryPlaying) return false;
  return game.universeId <= boundary.universe_id;
}

export const STATS_CREATOR_SORT_OPTIONS: Array<{ value: StatsCreatorSortKey; label: string }> = [
  { value: "playing", label: "Current players" },
  { value: "visits", label: "Visits" },
  { value: "favorites", label: "Favorites" },
  { value: "games", label: "Tracked games" },
  { value: "members", label: "Group members" }
];

export const STATS_ITEM_SORT_OPTIONS: Array<{ value: StatsItemSortKey; label: string }> = [
  { value: "favorites", label: "Most favorited" },
  { value: "price_high", label: "Price: high to low" },
  { value: "price_low", label: "Price: low to high" },
  { value: "resale_low", label: "Lowest resale" },
  { value: "newest", label: "Recently created" },
  { value: "updated", label: "Recently seen" }
];

export const STATS_ITEM_SALE_OPTIONS: Array<{ value: StatsItemSaleFilter; label: string }> = [
  { value: "all", label: "All sale states" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
  { value: "resale", label: "Has resale" }
];

export const STATS_ITEM_CREATOR_OPTIONS: Array<{ value: StatsItemCreatorFilter; label: string }> = [
  { value: "all", label: "All creators" },
  { value: "roblox", label: "Roblox-made" },
  { value: "creators", label: "Creator-made" },
  { value: "verified", label: "Verified creators" }
];

export const STATS_ITEM_CATEGORY_OPTIONS = [
  { value: "Accessories", label: "Accessories" },
  { value: "Clothing", label: "Clothing" },
  { value: "Body", label: "Body" },
  { value: "AvatarAnimations", label: "Avatar animations" }
] as const;

export const STATS_ITEM_SUBCATEGORY_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  Accessories: [
    { value: "HeadAccessories", label: "Head" },
    { value: "FaceAccessories", label: "Face" },
    { value: "NeckAccessories", label: "Neck" },
    { value: "ShoulderAccessories", label: "Shoulder" },
    { value: "FrontAccessories", label: "Front" },
    { value: "BackAccessories", label: "Back" },
    { value: "WaistAccessories", label: "Waist" },
    { value: "Gear", label: "Gear" }
  ],
  Clothing: [
    { value: "ClassicShirts", label: "Classic shirts" },
    { value: "ClassicTShirts", label: "Classic T-shirts" },
    { value: "ClassicPants", label: "Classic pants" },
    { value: "ShirtAccessories", label: "Layered shirts" },
    { value: "TShirtAccessories", label: "Layered T-shirts" },
    { value: "PantsAccessories", label: "Layered pants" },
    { value: "JacketAccessories", label: "Jackets" },
    { value: "SweaterAccessories", label: "Sweaters" },
    { value: "ShortsAccessories", label: "Shorts" },
    { value: "DressSkirtAccessories", label: "Dresses & skirts" }
  ],
  Body: [
    { value: "HairAccessories", label: "Hair" },
    { value: "BodyPartsBundles", label: "Full bodies" },
    { value: "Bodies", label: "Bodies" },
    { value: "Heads", label: "Heads" },
    { value: "Faces", label: "Faces" },
    { value: "DynamicHeads", label: "Dynamic heads" }
  ],
  AvatarAnimations: [
    { value: "EmoteAnimations", label: "Emotes" },
    { value: "Emotes", label: "Emotes legacy" }
  ]
};

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

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function uniqueCleanStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim() ?? "").filter(Boolean))];
}

function cleanStatsTaxonomyLabel(value: string | null | undefined) {
  const label = value?.trim() ?? "";
  if (!label) return null;
  const normalized = label.toLowerCase();
  return normalized === "all" || normalized === "uncategorized" ? null : label;
}

function normalizeFilterValues(value?: string | string[] | null) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return uniqueCleanStrings(values).filter((item) => cleanStatsTaxonomyLabel(item));
}

function normalizeStatsColumns(value?: string | string[] | null): StatsGameColumnKey[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const allowed = new Set(STATS_GAME_COLUMN_OPTIONS.map((option) => option.value));
  const columns = uniqueCleanStrings(values).filter((item): item is StatsGameColumnKey => allowed.has(item as StatsGameColumnKey));
  return columns.length ? columns : DEFAULT_STATS_GAME_COLUMNS;
}

function normalizeStatsCreatorSort(value?: string | null): StatsCreatorSortKey {
  return STATS_CREATOR_SORT_OPTIONS.some((option) => option.value === value) ? (value as StatsCreatorSortKey) : "playing";
}

function normalizeStatsCreatorType(value?: string | null): StatsCreatorTypeFilter {
  return value === "group" || value === "user" ? value : "all";
}

function normalizeStatsItemSort(value?: string | null): StatsItemSortKey {
  return STATS_ITEM_SORT_OPTIONS.some((option) => option.value === value) ? (value as StatsItemSortKey) : "favorites";
}

function normalizeStatsItemSale(value?: string | null): StatsItemSaleFilter {
  return value === "free" || value === "paid" || value === "resale" ? value : "all";
}

function normalizeStatsItemCreator(value?: string | null): StatsItemCreatorFilter {
  return value === "roblox" || value === "creators" || value === "verified" ? value : "all";
}

function normalizeStatsItemCategory(value?: string | null): string {
  const normalized = value?.trim() ?? "";
  return STATS_ITEM_CATEGORY_OPTIONS.some((option) => option.value === normalized) ? normalized : "";
}

function normalizeStatsItemSubcategory(category: string, value?: string | null): string {
  const normalized = value?.trim() ?? "";
  const options = category ? STATS_ITEM_SUBCATEGORY_OPTIONS[category] ?? [] : Object.values(STATS_ITEM_SUBCATEGORY_OPTIONS).flat();
  return options.some((option) => option.value === normalized) ? normalized : "";
}

export function getRatingPercent(likes?: number | null, dislikes?: number | null): number | null {
  const up = typeof likes === "number" ? likes : 0;
  const down = typeof dislikes === "number" ? dislikes : 0;
  const total = up + down;
  if (total < STATS_GAME_MIN_RATING_VOTES) return null;
  return Math.round((up / total) * 1000) / 10;
}

function hasEnoughRatingVotes(likes?: number | null, dislikes?: number | null) {
  const up = typeof likes === "number" ? likes : 0;
  const down = typeof dislikes === "number" ? dislikes : 0;
  return up + down >= STATS_GAME_MIN_RATING_VOTES;
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
    genre: cleanStatsTaxonomyLabel(row.genre_l1),
    subgenre: cleanStatsTaxonomyLabel(row.genre_l2),
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
    ratingPercent: hasEnoughRatingVotes(row.likes, row.dislikes) ? (toNumber(row.rating_percent) ?? base.ratingPercent) : null,
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

function mapStatsCreator(row: StatsCreatorIndexRow): StatsCreator {
  const topGame = row.top_universe_id && row.top_slug && row.top_name
    ? {
        universeId: row.top_universe_id,
        slug: row.top_slug,
        name: row.top_display_name || row.top_name,
        displayName: row.top_display_name || row.top_name,
        iconUrl: row.top_icon_url,
        playing: toNumber(row.top_playing),
        visits: toNumber(row.top_visits),
        favorites: toNumber(row.top_favorites)
      }
    : null;

  return {
    creatorKey: row.creator_key,
    creatorType: row.creator_type,
    creatorId: row.creator_id,
    creatorName: row.creator_name,
    creatorSlug: row.creator_slug,
    gameCount: row.game_count,
    playing: toNumber(row.playing) ?? 0,
    visits: toNumber(row.visits) ?? 0,
    favorites: toNumber(row.favorites) ?? 0,
    likes: toNumber(row.likes) ?? 0,
    dislikes: toNumber(row.dislikes) ?? 0,
    ratingPercent: toNumber(row.rating_percent),
    topGame,
    memberCount: toNumber(row.member_count),
    hasVerifiedBadge: row.has_verified_badge,
    lastStatsRefreshedAt: row.last_stats_refreshed_at,
    indexedAt: row.indexed_at,
    rank: null
  };
}

const STATS_ITEM_THUMBNAIL_SIZE = "420x420";
const STATS_ITEM_THUMBNAIL_FORMAT = "Png";

function statsItemThumbnailPriority(row: StatsItemThumbnailRow): number {
  let score = 0;
  if (row.image_url) score += 100;
  if (row.state === "Completed") score += 40;
  if (row.size === STATS_ITEM_THUMBNAIL_SIZE) score += 20;
  if (row.format === STATS_ITEM_THUMBNAIL_FORMAT) score += 10;
  return score;
}

async function loadStatsItemThumbnailUrls(assetIds: number[]): Promise<Map<number, string>> {
  const requestedAssetIds = Array.from(new Set(assetIds.filter((assetId) => Number.isFinite(assetId)).map((assetId) => Math.trunc(assetId))));
  if (!requestedAssetIds.length) return new Map();
  const lookupAssetIds = Array.from(
    new Set(requestedAssetIds.flatMap((assetId) => [assetId, Math.abs(assetId), -Math.abs(assetId)]).filter((assetId) => assetId !== 0))
  );

  const { data, error } = await supabaseAdmin()
    .from("roblox_catalog_item_images")
    .select("asset_id, size, format, state, image_url")
    .in("asset_id", lookupAssetIds)
    .not("image_url", "is", null);

  if (error) {
    console.warn("Failed to load stats item thumbnails", error.message);
    return new Map();
  }

  const bestRows = new Map<number, StatsItemThumbnailRow>();
  for (const row of (data ?? []) as StatsItemThumbnailRow[]) {
    if (typeof row.asset_id !== "number" || typeof row.image_url !== "string" || row.image_url.length === 0) continue;
    const existing = bestRows.get(row.asset_id);
    if (!existing || statsItemThumbnailPriority(row) > statsItemThumbnailPriority(existing)) {
      bestRows.set(row.asset_id, row);
    }
  }

  const thumbnailMap = new Map<number, string>();
  for (const assetId of requestedAssetIds) {
    const candidates = [assetId, -Math.abs(assetId), Math.abs(assetId)]
      .map((candidateAssetId) => bestRows.get(candidateAssetId))
      .filter((row): row is StatsItemThumbnailRow => Boolean(row?.image_url));
    const best = candidates.sort((a, b) => statsItemThumbnailPriority(b) - statsItemThumbnailPriority(a))[0];
    if (best?.image_url) thumbnailMap.set(assetId, best.image_url);
  }
  return thumbnailMap;
}

function statsItemRobloxUrl(row: Pick<StatsItemIndexRow, "asset_id" | "item_type" | "raw_catalog_json">): string {
  const explicitUrl = row.raw_catalog_json?.roblox_url;
  if (typeof explicitUrl === "string" && explicitUrl.length > 0) return explicitUrl;
  if (row.item_type === "Bundle") return `https://www.roblox.com/bundles/${Math.abs(Math.trunc(row.asset_id))}`;
  return `https://www.roblox.com/catalog/${row.asset_id}`;
}

function statsItemCanonicalKey(row: Pick<StatsItemIndexRow, "asset_id" | "item_type">): string {
  return row.item_type === "Bundle" ? `Bundle:${Math.abs(Math.trunc(row.asset_id))}` : `Asset:${Math.trunc(row.asset_id)}`;
}

function dedupeStatsItemRows(rows: StatsItemIndexRow[], limit: number) {
  const seen = new Set<string>();
  const deduped: StatsItemIndexRow[] = [];
  for (const row of rows) {
    const key = statsItemCanonicalKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

function mapStatsItem(row: StatsItemIndexRow, thumbnailUrl: string | null): StatsItem {
  return {
    assetId: row.asset_id,
    itemType: row.item_type,
    assetTypeId: row.asset_type_id,
    name: row.name,
    description: row.description,
    category: row.category,
    subcategory: row.subcategory,
    creatorName: row.creator_name,
    creatorId: row.creator_id,
    creatorType: row.creator_type,
    creatorHasVerifiedBadge: row.creator_has_verified_badge,
    favoriteCount: toNumber(row.favorite_count) ?? 0,
    priceRobux: toNumber(row.price_robux),
    priceStatus: row.price_status,
    lowestPriceRobux: toNumber(row.lowest_price_robux),
    lowestResalePriceRobux: toNumber(row.lowest_resale_price_robux),
    isForSale: row.is_for_sale,
    isLimited: row.is_limited,
    isLimitedUnique: row.is_limited_unique,
    hasResellers: row.has_resellers,
    totalQuantity: toNumber(row.total_quantity),
    unitsAvailableForConsumption: toNumber(row.units_available_for_consumption),
    quantityLimitPerUser: toNumber(row.quantity_limit_per_user),
    collectibleItemId: row.collectible_item_id ?? null,
    itemStatsTier: row.item_stats_tier ?? null,
    remaining: toNumber(row.remaining),
    lastSeenAt: row.last_seen_at,
    lastItemStatsRefreshedAt: row.last_item_stats_refreshed_at ?? null,
    lastResaleDataFetchedAt: row.last_resale_data_fetched_at ?? null,
    priceChange24h: toNumber(row.price_change_24h),
    resaleChange24h: toNumber(row.resale_change_24h),
    favoriteChange24h: toNumber(row.favorite_change_24h),
    priceChange7d: toNumber(row.price_change_7d),
    resaleChange7d: toNumber(row.resale_change_7d),
    favoriteChange7d: toNumber(row.favorite_change_7d),
    globalFavoritesRank: toNumber(row.global_favorites_rank),
    globalResaleRank: toNumber(row.global_resale_rank),
    createdAt: row.created_at,
    robloxUrl: row.roblox_url || statsItemRobloxUrl(row),
    thumbnailUrl: row.thumbnail_url || thumbnailUrl,
    rank: null
  };
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

async function isStatsItemIndexAvailable() {
  statsItemIndexAvailability ??= (async () => {
    try {
      const { data, error } = await supabaseAdmin()
        .from("stats_item_current_index")
        .select("asset_id")
        .limit(1);
      return !error && (data?.length ?? 0) > 0;
    } catch {
      return false;
    }
  })();
  return statsItemIndexAvailability;
}

async function isStatsItemHistoryAvailable() {
  statsItemHistoryAvailability ??= (async () => {
    try {
      const [hourly, daily, resale] = await Promise.all([
        supabaseAdmin().from("roblox_catalog_item_stats_hourly").select("asset_id").limit(1),
        supabaseAdmin().from("roblox_catalog_item_stats_daily").select("asset_id").limit(1),
        supabaseAdmin().from("roblox_catalog_item_resale_points").select("asset_id").limit(1)
      ]);
      return !hourly.error && !daily.error && !resale.error;
    } catch {
      return false;
    }
  })();
  return statsItemHistoryAvailability;
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
  genre?: string | string[];
  subgenre?: string | string[];
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

  const genreFilters = normalizeFilterValues(options.genre);
  const subgenreFilters = normalizeFilterValues(options.subgenre);

  if (genreFilters.length === 1) {
    indexQuery = indexQuery.eq("genre_l1", genreFilters[0]);
  } else if (genreFilters.length > 1) {
    indexQuery = indexQuery.in("genre_l1", genreFilters);
  }

  if (subgenreFilters.length === 1) {
    indexQuery = indexQuery.eq("genre_l2", subgenreFilters[0]);
  } else if (subgenreFilters.length > 1) {
    indexQuery = indexQuery.in("genre_l2", subgenreFilters);
  }

  if (typeof options.minPlayers === "number" && options.minPlayers > 0) {
    indexQuery = indexQuery.gte("playing", options.minPlayers);
  }

  if (options.tierForSitemap) {
    indexQuery = indexQuery.or("stats_tier.in.(HOT,WARM),playing.gte.100,visits.gte.10000000");
  }

  const indexSort = options.sort ?? "playing";
  if (indexSort === "rating") {
    indexQuery = indexQuery.gte("likes", STATS_GAME_MIN_RATING_VOTES);
  }
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
    created_at_api, updated_at_api, last_stats_refreshed_at,
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

  if (genreFilters.length === 1) {
    query = query.eq("genre_l1", genreFilters[0]);
  } else if (genreFilters.length > 1) {
    query = query.in("genre_l1", genreFilters);
  }

  if (subgenreFilters.length === 1) {
    query = query.eq("genre_l2", subgenreFilters[0]);
  } else if (subgenreFilters.length > 1) {
    query = query.in("genre_l2", subgenreFilters);
  }

  if (typeof options.minPlayers === "number" && options.minPlayers > 0) {
    query = query.gte("playing", options.minPlayers);
  }

  if (options.tierForSitemap) {
    query = query.or("playing.gte.100,visits.gte.10000000");
  }

  const fallbackSort = options.sort ?? "playing";
  if (fallbackSort === "rating") {
    query = query.gte("likes", STATS_GAME_MIN_RATING_VOTES);
  }
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

export async function getUniverseStatsSummary(
  universeId: number
): Promise<{ rank: number | null; playing: number | null; slug: string | null; iconUrl: string | null } | null> {
  try {
    // Rank comes from the same source the stats page uses (latest hourly snapshot)
    // so the sidebar and the stats page never disagree.
    const [{ data, error }, latestRank] = await Promise.all([
      supabaseAdmin()
        .from("stats_game_current_index")
        .select("playing, slug, icon_url")
        .eq("universe_id", universeId)
        .limit(1),
      loadLatestRank(universeId)
    ]);
    if (error) throw error;
    const row = (data ?? [])[0] as
      | { playing?: number | null; slug?: string | null; icon_url?: string | null }
      | undefined;
    if (!row) return null;
    return {
      rank: latestRank ?? null,
      playing: row.playing ?? null,
      slug: row.slug ?? null,
      iconUrl: row.icon_url ?? null
    };
  } catch (error) {
    console.error("Error fetching universe stats summary", error);
    return null;
  }
}

export async function listStatsGenres(limit = 12): Promise<StatsGenreSummary[]> {
  const fetchLimit = Math.max(limit * 3, limit + 20);
  const { data, error } = await supabaseAdmin()
    .from("stats_genre_current_index")
    .select("genre, genre_slug, games, playing, visits, top_name, top_slug, top_icon_url, top_playing")
    .order("playing", { ascending: false })
    .limit(fetchLimit);

  if (!error) {
    return ((data ?? []) as Array<{
      genre: string | null;
      genre_slug: string | null;
      games: number;
      playing: number;
      visits: number;
      top_name: string | null;
      top_slug: string | null;
      top_icon_url: string | null;
      top_playing: number | null;
    }>)
      .map((row) => {
        const label = cleanStatsTaxonomyLabel(row.genre);
        if (!label) return null;
        return {
          genre: label,
          slug: row.genre_slug?.trim() || slugify(label) || "uncategorized",
          games: row.games,
          playing: row.playing,
          visits: row.visits,
          topGame: row.top_slug
            ? {
                name: row.top_name ?? label,
                slug: row.top_slug,
                iconUrl: row.top_icon_url,
                playing: row.top_playing
              }
            : null
        };
      })
      .filter((row): row is StatsGenreSummary => Boolean(row))
      .slice(0, limit);
  }

  const { rows } = await listBaseGames({ limit: 500, sort: "playing" });
  const map = new Map<string, StatsGenreSummary>();
  for (const game of rows) {
    const label = game.genre;
    if (!label) continue;
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

async function getStatsPlatformTotals(): Promise<Omit<StatsPlatformTotals, "trackedGames"> | null> {
  const { data, error } = await supabaseAdmin()
    .from("stats_genre_current_index")
    .select("playing, visits, indexed_at")
    .limit(1000);

  if (error) {
    if (error.code !== "42P01") {
      console.warn("Failed to load platform CCU totals", error.message);
    }
    return null;
  }

  const rows = (data ?? []) as Array<{ playing: number | string | null; visits: number | string | null; indexed_at: string | null }>;
  if (!rows.length) return null;

  const livePlayers = rows.reduce((sum, row) => sum + (toFiniteNumber(row.playing) ?? 0), 0);
  const totalVisits = rows.reduce((sum, row) => sum + (toFiniteNumber(row.visits) ?? 0), 0);
  const lastUpdatedAt = rows
    .map((row) => row.indexed_at)
    .filter((value): value is string => Boolean(value))
    .sort();

  return {
    livePlayers,
    totalVisits,
    totalFavorites: 0,
    totalLikes: 0,
    totalDislikes: 0,
    ratingPercent: null,
    lastUpdatedAt: lastUpdatedAt[lastUpdatedAt.length - 1] ?? null
  };
}

async function getPlatformTrendFallback(games: StatsGame[]): Promise<StatsChartPoint[]> {
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
    const rating = hasEnoughRatingVotes(row.likes_end, row.dislikes_end)
      ? (getRatingPercent(row.likes_end, row.dislikes_end) ?? row.rating_percent)
      : null;
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

async function getPlatformTrend(games: StatsGame[]): Promise<StatsChartPoint[]> {
  const chart = await getStatsPlatformChart("1d", "hourly");
  if (chart.points.length) return chart.points;

  return getPlatformTrendFallback(games);
}

async function getPlatformTrendFromRpc(sinceIso: string): Promise<StatsChartPoint[] | null> {
  const { data, error } = await supabaseAdmin().rpc("get_stats_platform_ccu_trend", {
    p_since: sinceIso
  });

  if (error) {
    if (error.code !== "42883") {
      console.warn("Failed to load platform CCU trend", error.message);
    }
    return null;
  }

  return ((data ?? []) as PlatformTrendRow[]).map((row) => mapPlatformTrendRow(row));
}

function mapPlatformTrendRow(row: PlatformTrendRow): StatsChartPoint {
  const sampledAt = row.hour_start;
  return {
    label: new Date(sampledAt).toLocaleTimeString("en-US", { hour: "numeric", hour12: true, timeZone: "UTC" }),
    sampledAt,
    players: toFiniteNumber(row.players),
    peakPlayers: toFiniteNumber(row.peak_players),
    avgPlayers: toFiniteNumber(row.avg_players),
    visits: toFiniteNumber(row.visits),
    favorites: toFiniteNumber(row.favorites),
    rating: toFiniteNumber(row.rating),
    samples: toFiniteNumber(row.samples)
  };
}

export async function getStatsHome(): Promise<StatsHomeData> {
  const [{ rows: topBase }, { rows: visitedBase }, { total: trackedGames }, genres, riserBase, platformTotals] = await Promise.all([
    listBaseGames({ limit: STATS_HOME_TOP_GAMES_LIMIT, sort: "playing" }),
    listBaseGames({ limit: 10, sort: "visits" }),
    listBaseGames({ limit: 1, sort: "playing", count: "exact" }),
    listStatsGenres(STATS_HOME_GENRES_LIMIT),
    listCurrentRisers(STATS_HOME_RISERS_LIMIT),
    getStatsPlatformTotals()
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
  const platformChart = await getStatsPlatformChart("1d", "hourly");
  const platformTrend = platformChart.points.length ? platformChart.points : await getPlatformTrend(topGames);
  const livePlayers = platformTotals?.livePlayers ?? topGames.reduce((sum, game) => sum + (game.playing ?? 0), 0);
  const totalVisits = platformTotals?.totalVisits ?? mostVisited.reduce((sum, game) => sum + (game.visits ?? 0), 0);
  const sortedRefreshTimes = topGames
    .map((game) => game.lastStatsRefreshedAt ?? game.lastPlayingRefreshedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  const lastUpdatedAt = platformTotals?.lastUpdatedAt ?? sortedRefreshTimes[sortedRefreshTimes.length - 1] ?? null;

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
    platformTrend,
    platformChart: platformChart.points.length
      ? platformChart
      : {
          range: "1d",
          requestedResolution: "hourly",
          resolution: "hourly",
          points: platformTrend
        }
  };
}

export function normalizeStatsSort(value?: string | null): StatsSortKey {
  return STATS_SORT_OPTIONS.some((option) => option.value === value) ? (value as StatsSortKey) : "playing";
}

export function normalizeStatsRange(value?: string | null): StatsTimeRange {
  if (value === "24h") return "1d";
  return STATS_TIME_RANGES.some((option) => option.value === value) ? (value as StatsTimeRange) : DEFAULT_STATS_CHART_RANGE;
}

export function parseStatsSearchParams(searchParams?: Record<string, string | string[] | undefined>) {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const pageValue = Number(first(searchParams?.page) ?? "1");
  const minValue = Number(first(searchParams?.minPlaying) ?? first(searchParams?.minPlayers) ?? "");
  const rawSort = first(searchParams?.sort)?.trim() ?? "";
  return {
    page: Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1,
    q: first(searchParams?.q)?.trim() ?? "",
    genres: normalizeFilterValues(searchParams?.genre),
    subgenres: normalizeFilterValues(searchParams?.subgenre),
    sort: normalizeStatsSort(rawSort),
    rawSort,
    minPlaying: Number.isFinite(minValue) && minValue > 0 ? Math.floor(minValue) : 0,
    columns: normalizeStatsColumns(searchParams?.column)
  };
}

export function parseStatsCreatorsSearchParams(searchParams?: Record<string, string | string[] | undefined>) {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const pageValue = Number(first(searchParams?.page) ?? "1");
  return {
    page: Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1,
    q: first(searchParams?.q)?.trim() ?? "",
    sort: normalizeStatsCreatorSort(first(searchParams?.sort)),
    creatorType: normalizeStatsCreatorType(first(searchParams?.type))
  };
}

export function parseStatsItemsSearchParams(searchParams?: Record<string, string | string[] | undefined>) {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const pageValue = Number(first(searchParams?.page) ?? "1");
  const category = normalizeStatsItemCategory(first(searchParams?.category));
  return {
    page: Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1,
    q: first(searchParams?.q)?.trim() ?? "",
    sort: normalizeStatsItemSort(first(searchParams?.sort)),
    category,
    subcategory: normalizeStatsItemSubcategory(category, first(searchParams?.subcategory)),
    sale: normalizeStatsItemSale(first(searchParams?.sale)),
    creator: normalizeStatsItemCreator(first(searchParams?.creator))
  };
}

export async function listStatsItems(input: {
  page?: number;
  pageSize?: number;
  q?: string;
  sort?: string | null;
  category?: string | null;
  subcategory?: string | null;
  sale?: string | null;
  creator?: string | null;
}): Promise<StatsItemsPageData> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? STATS_PAGE_SIZE, 10), 100);
  const offset = (page - 1) * pageSize;
  const q = input.q?.trim() ?? "";
  const sort = normalizeStatsItemSort(input.sort);
  const category = normalizeStatsItemCategory(input.category);
  const subcategory = normalizeStatsItemSubcategory(category, input.subcategory);
  const sale = normalizeStatsItemSale(input.sale);
  const creator = normalizeStatsItemCreator(input.creator);
  const hasItemIndex = await isStatsItemIndexAvailable();
  const tableName = hasItemIndex ? "stats_item_current_index" : "roblox_catalog_items";
  const selectColumns = hasItemIndex
    ? `
      asset_id, item_type, asset_type_id, name, description, category, subcategory,
      creator_name, creator_id, creator_type, creator_has_verified_badge,
      favorite_count, price_robux, price_status, lowest_price_robux,
      lowest_resale_price_robux, is_for_sale, is_limited, is_limited_unique,
      has_resellers, total_quantity, units_available_for_consumption,
      quantity_limit_per_user, collectible_item_id, remaining, item_stats_tier,
      last_seen_at, last_item_stats_refreshed_at, last_resale_data_fetched_at,
      thumbnail_url, thumbnail_state, roblox_url,
      price_change_24h, resale_change_24h, favorite_change_24h,
      price_change_7d, resale_change_7d, favorite_change_7d,
      global_favorites_rank, global_resale_rank, first_seen_at, created_at
    `
    : `
      asset_id, item_type, asset_type_id, name, description, category, subcategory,
      creator_name, creator_id, creator_type, creator_has_verified_badge,
      favorite_count, price_robux, price_status, lowest_price_robux,
      lowest_resale_price_robux, is_for_sale, is_limited, is_limited_unique,
      has_resellers, total_quantity, remaining, last_seen_at, created_at,
      raw_catalog_json
    `;

  let query = supabaseAdmin()
    .from(tableName)
    .select(selectColumns, { count: "exact" })
    .not("name", "is", null)
    .not("category", "is", null)
    .not("subcategory", "is", null)
    .not("favorite_count", "is", null);

  if (!hasItemIndex) {
    query = query.eq("is_deleted", false);
  }

  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    const orParts = [
      `name.ilike.${pattern}`,
      `description.ilike.${pattern}`,
      `creator_name.ilike.${pattern}`
    ];
    if (/^\d+$/.test(q)) {
      orParts.unshift(`asset_id.eq.${q}`);
    }
    query = query.or(orParts.join(","));
  }

  if (category) query = query.eq("category", category);
  if (subcategory) query = query.eq("subcategory", subcategory);

  if (sale === "free") {
    query = query.eq("price_robux", 0).or("has_resellers.is.false,has_resellers.is.null");
  } else if (sale === "paid") {
    query = query.gt("price_robux", 0);
  } else if (sale === "resale") {
    query = query.eq("has_resellers", true).gt("lowest_resale_price_robux", 0);
  }

  if (creator === "roblox") {
    query = query.eq("creator_name", "Roblox");
  } else if (creator === "creators") {
    query = query.neq("creator_name", "Roblox");
  } else if (creator === "verified") {
    query = query.eq("creator_has_verified_badge", true);
  }

  switch (sort) {
    case "price_high":
      query = query.order("price_robux", { ascending: false, nullsFirst: false }).order("favorite_count", { ascending: false, nullsFirst: false });
      break;
    case "price_low":
      query = query.order("price_robux", { ascending: true, nullsFirst: false }).order("favorite_count", { ascending: false, nullsFirst: false });
      break;
    case "resale_low":
      query = query
        .eq("has_resellers", true)
        .gt("lowest_resale_price_robux", 0)
        .order("lowest_resale_price_robux", { ascending: true, nullsFirst: false })
        .order("favorite_count", { ascending: false, nullsFirst: false });
      break;
    case "newest":
      query = query.order(hasItemIndex ? "created_at" : "created_at", { ascending: false, nullsFirst: false }).order("favorite_count", { ascending: false, nullsFirst: false });
      break;
    case "updated":
      query = query.order("last_seen_at", { ascending: false, nullsFirst: false }).order("favorite_count", { ascending: false, nullsFirst: false });
      break;
    case "favorites":
    default:
      query = query.order("favorite_count", { ascending: false, nullsFirst: false });
      break;
  }

  const fetchSize = Math.min(pageSize * 3, 300);
  const { data, error, count } = await query
    .order("asset_id", { ascending: true })
    .range(offset, offset + fetchSize - 1);

  if (error) {
    console.warn(`Failed to load ${tableName} for stats`, error.message);
    return {
      items: [],
      total: 0,
      page,
      totalPages: 1,
      filters: { q, sort, category, subcategory, sale, creator }
    };
  }

  const rows = dedupeStatsItemRows((data ?? []) as unknown as StatsItemIndexRow[], pageSize);
  const thumbnailMap = hasItemIndex ? new Map<number, string>() : await loadStatsItemThumbnailUrls(rows.map((row) => row.asset_id));
  const items = rows.map((row, index) => ({
    ...mapStatsItem(row, thumbnailMap.get(row.asset_id) ?? null),
    rank: offset + index + 1
  }));
  const total = count ?? items.length;

  return {
    items,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    filters: { q, sort, category, subcategory, sale, creator }
  };
}

function statsItemChartLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

async function loadStatsItemRow(assetId: number): Promise<{ row: StatsItemIndexRow | null; indexed: boolean }> {
  const hasItemIndex = await isStatsItemIndexAvailable();
  if (hasItemIndex) {
    const { data, error } = await supabaseAdmin()
      .from("stats_item_current_index")
      .select(`
        asset_id, item_type, asset_type_id, name, description, category, subcategory,
        creator_name, creator_id, creator_type, creator_has_verified_badge,
        favorite_count, price_robux, price_status, lowest_price_robux,
        lowest_resale_price_robux, is_for_sale, is_limited, is_limited_unique,
        has_resellers, total_quantity, units_available_for_consumption,
        quantity_limit_per_user, collectible_item_id, remaining, item_stats_tier,
        last_seen_at, last_item_stats_refreshed_at, last_resale_data_fetched_at,
        thumbnail_url, thumbnail_state, roblox_url,
        price_change_24h, resale_change_24h, favorite_change_24h,
        price_change_7d, resale_change_7d, favorite_change_7d,
        global_favorites_rank, global_resale_rank, first_seen_at, created_at
      `)
      .eq("asset_id", assetId)
      .maybeSingle();
    if (!error && data) return { row: data as unknown as StatsItemIndexRow, indexed: true };
  }

  const { data, error } = await supabaseAdmin()
    .from("roblox_catalog_items")
    .select(`
      asset_id, item_type, asset_type_id, name, description, category, subcategory,
      creator_name, creator_id, creator_type, creator_has_verified_badge,
      favorite_count, price_robux, price_status, lowest_price_robux,
      lowest_resale_price_robux, is_for_sale, is_limited, is_limited_unique,
      has_resellers, total_quantity, remaining, last_seen_at, created_at,
      raw_catalog_json
    `)
    .eq("asset_id", assetId)
    .eq("is_deleted", false)
    .maybeSingle();
  if (error) {
    console.warn("Failed to load stats item detail", error.message);
    return { row: null, indexed: false };
  }
  return { row: (data as StatsItemIndexRow | null) ?? null, indexed: false };
}

async function loadSimilarStatsItems(item: StatsItem, indexed: boolean): Promise<StatsItem[]> {
  const tableName = indexed ? "stats_item_current_index" : "roblox_catalog_items";
  const selectColumns = indexed
    ? `
      asset_id, item_type, asset_type_id, name, description, category, subcategory,
      creator_name, creator_id, creator_type, creator_has_verified_badge,
      favorite_count, price_robux, price_status, lowest_price_robux,
      lowest_resale_price_robux, is_for_sale, is_limited, is_limited_unique,
      has_resellers, total_quantity, remaining, last_seen_at, created_at,
      thumbnail_url, roblox_url
    `
    : `
      asset_id, item_type, asset_type_id, name, description, category, subcategory,
      creator_name, creator_id, creator_type, creator_has_verified_badge,
      favorite_count, price_robux, price_status, lowest_price_robux,
      lowest_resale_price_robux, is_for_sale, is_limited, is_limited_unique,
      has_resellers, total_quantity, remaining, last_seen_at, created_at,
      raw_catalog_json
    `;
  let query = supabaseAdmin()
    .from(tableName)
    .select(selectColumns)
    .eq("category", item.category)
    .neq("asset_id", item.assetId)
    .not("name", "is", null)
    .order("favorite_count", { ascending: false, nullsFirst: false })
    .limit(6);
  if (!indexed) query = query.eq("is_deleted", false);

  const { data, error } = await query;
  if (error) {
    console.warn("Failed to load similar stats items", error.message);
    return [];
  }
  const rows = (data ?? []) as unknown as StatsItemIndexRow[];
  const thumbnailMap = indexed ? new Map<number, string>() : await loadStatsItemThumbnailUrls(rows.map((row) => row.asset_id));
  return rows.map((row, index) => ({ ...mapStatsItem(row, thumbnailMap.get(row.asset_id) ?? null), rank: index + 1 }));
}

async function loadStatsItemHourlyPoints(assetId: number): Promise<StatsItemChartPoint[]> {
  const startIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin()
    .from("roblox_catalog_item_stats_hourly")
    .select("hour_start,price_robux,lowest_resale_price_robux,favorite_count,units_available_for_consumption")
    .eq("asset_id", assetId)
    .gte("hour_start", startIso)
    .order("hour_start", { ascending: true });
  if (error) {
    console.warn("Failed to load item hourly points", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    label: statsItemChartLabel(String(row.hour_start)),
    sampledAt: String(row.hour_start),
    priceRobux: toNumber(row.price_robux),
    lowestResalePriceRobux: toNumber(row.lowest_resale_price_robux),
    favoriteCount: toNumber(row.favorite_count),
    availableUnits: toNumber(row.units_available_for_consumption),
    resaleVolume: null
  }));
}

async function loadStatsItemDailyPoints(assetId: number): Promise<StatsItemChartPoint[]> {
  const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin()
    .from("roblox_catalog_item_stats_daily")
    .select("stat_date,price_close,resale_close,favorites_close,units_available_close")
    .eq("asset_id", assetId)
    .gte("stat_date", startDate)
    .order("stat_date", { ascending: true });
  if (error) {
    console.warn("Failed to load item daily points", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    label: statsItemChartLabel(String(row.stat_date)),
    sampledAt: String(row.stat_date),
    priceRobux: toNumber(row.price_close),
    lowestResalePriceRobux: toNumber(row.resale_close),
    favoriteCount: toNumber(row.favorites_close),
    availableUnits: toNumber(row.units_available_close),
    resaleVolume: null
  }));
}

async function loadStatsItemResalePoints(assetId: number): Promise<StatsItemChartPoint[]> {
  const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin()
    .from("roblox_catalog_item_resale_points")
    .select("point_date,resale_price_robux,resale_volume")
    .eq("asset_id", assetId)
    .gte("point_date", startDate)
    .order("point_date", { ascending: true });
  if (error) {
    console.warn("Failed to load item resale points", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    label: statsItemChartLabel(String(row.point_date)),
    sampledAt: String(row.point_date),
    priceRobux: null,
    lowestResalePriceRobux: toNumber(row.resale_price_robux),
    favoriteCount: null,
    availableUnits: null,
    resaleVolume: toNumber(row.resale_volume)
  }));
}

export async function getStatsItemDetail(assetId: number): Promise<StatsItemDetailData | null> {
  if (!Number.isFinite(assetId) || assetId <= 0) return null;
  const routeAssetId = Math.trunc(assetId);
  let { row, indexed } = await loadStatsItemRow(routeAssetId);
  if (!row) {
    const fallback = await loadStatsItemRow(-routeAssetId);
    row = fallback.row;
    indexed = fallback.indexed;
  }
  if (!row) return null;
  const thumbnailMap = indexed ? new Map<number, string>() : await loadStatsItemThumbnailUrls([row.asset_id]);
  const item = mapStatsItem(row, thumbnailMap.get(row.asset_id) ?? null);
  const hasHistory = await isStatsItemHistoryAvailable();
  const [hourlyPoints, dailyPoints, resalePoints, similarItems] = await Promise.all([
    hasHistory ? loadStatsItemHourlyPoints(item.assetId) : Promise.resolve([]),
    hasHistory ? loadStatsItemDailyPoints(item.assetId) : Promise.resolve([]),
    hasHistory ? loadStatsItemResalePoints(item.assetId) : Promise.resolve([]),
    loadSimilarStatsItems(item, indexed)
  ]);

  return { item, hourlyPoints, dailyPoints, resalePoints, similarItems };
}

export async function listStatsCreators(input: {
  page?: number;
  pageSize?: number;
  q?: string;
  sort?: string | null;
  creatorType?: string | null;
}): Promise<StatsCreatorsPageData> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? STATS_PAGE_SIZE, 10), 100);
  const offset = (page - 1) * pageSize;
  const q = input.q?.trim() ?? "";
  const sort = normalizeStatsCreatorSort(input.sort);
  const creatorType = normalizeStatsCreatorType(input.creatorType);
  const selectColumns = `
    creator_key, creator_type, creator_id, creator_name, creator_slug,
    game_count,
    playing, visits, favorites, likes, dislikes, rating_percent,
    top_universe_id, top_slug, top_name, top_display_name, top_icon_url,
    top_playing, top_visits, top_favorites, member_count, has_verified_badge,
    last_stats_refreshed_at, indexed_at
  `;

  let query = supabaseAdmin()
    .from("stats_creator_current_index")
    .select(selectColumns, { count: "exact" });

  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    query = query.or(`creator_name.ilike.${pattern},top_name.ilike.${pattern},top_display_name.ilike.${pattern}`);
  }

  if (creatorType !== "all") {
    query = query.eq("creator_type", creatorType);
  }

  const sortColumn = CREATOR_SORT_COLUMNS[sort];
  const { data, error, count } = await query
    .order(sortColumn, { ascending: false, nullsFirst: false })
    .order("creator_key", { ascending: true })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.warn("Failed to load stats_creator_current_index", error.message);
    return {
      creators: [],
      total: 0,
      page,
      totalPages: 1,
      filters: { q, sort, creatorType }
    };
  }

  const creators = ((data ?? []) as StatsCreatorIndexRow[]).map((row, index) => ({
    ...mapStatsCreator(row),
    rank: offset + index + 1
  }));
  const total = count ?? creators.length;

  return {
    creators,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    filters: { q, sort, creatorType }
  };
}

export async function listStatsGames(input: {
  page?: number;
  pageSize?: number;
  q?: string;
  genres?: string[];
  subgenres?: string[];
  sort?: string | null;
  minPlayers?: number | null;
  columns?: StatsGameColumnKey[];
}): Promise<StatsGamesPageData> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? STATS_PAGE_SIZE, 10), 100);
  const sort = normalizeStatsSort(input.sort);
  const offset = (page - 1) * pageSize;
  const q = input.q?.trim() ?? "";
  const selectedGenres = uniqueCleanStrings(input.genres ?? []);
  const selectedSubgenres = selectedGenres.length ? uniqueCleanStrings(input.subgenres ?? []) : [];
  const minPlayers = typeof input.minPlayers === "number" && Number.isFinite(input.minPlayers) ? input.minPlayers : null;
  const columns = input.columns?.length ? input.columns : DEFAULT_STATS_GAME_COLUMNS;

  const [{ rows, total }, genreOptions, subgenreOptions] = await Promise.all([
    listBaseGames({
      limit: pageSize,
      offset,
      q,
      genre: selectedGenres,
      subgenre: selectedSubgenres,
      minPlayers,
      sort,
      count: "planned"
    }),
    getStatsGenreOptions(),
    getStatsSubgenreOptions()
  ]);
  const genres = selectedGenres.some((genre) => !genreOptions.includes(genre))
    ? [...new Set([...selectedGenres, ...genreOptions])].sort((a, b) => a.localeCompare(b))
    : genreOptions;

  const games = rows.map((game, index) => ({ ...game, rank: offset + index + 1 }));

  return {
    games,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    genres,
    subgenres: subgenreOptions,
    filters: { q, genres: selectedGenres, subgenres: selectedSubgenres, sort, minPlayers, columns }
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
      .map((row) => cleanStatsTaxonomyLabel(row.genre))
      .filter((value): value is string => Boolean(value?.trim()));
  }

  const { data, error } = await sb
    .from("roblox_universes")
    .select("genre_l1")
    .not("slug", "is", null)
    .limit(1000);
  if (error) return [];
  return Array.from(
    new Set(
      ((data ?? []) as Array<{ genre_l1: string | null }>)
        .map((row) => cleanStatsTaxonomyLabel(row.genre_l1))
        .filter((value): value is string => Boolean(value?.trim()))
    )
  ).sort((a, b) => a.localeCompare(b));
}

export async function getStatsSubgenreOptions(): Promise<StatsSubgenreOption[]> {
  const rpcResult = await supabaseAdmin().rpc("get_stats_subgenre_options");
  if (!rpcResult.error) {
    return ((rpcResult.data ?? []) as Array<{ genre: string; subgenre: string; games: number; playing: number | string }>)
      .map((row) => {
        const genre = cleanStatsTaxonomyLabel(row.genre);
        const subgenre = cleanStatsTaxonomyLabel(row.subgenre);
        if (!genre || !subgenre) return null;
        return {
          genre,
          subgenre,
          games: row.games,
          playing: toFiniteNumber(row.playing) ?? 0
        };
      })
      .filter((row): row is StatsSubgenreOption => Boolean(row))
      .sort((a, b) => a.genre.localeCompare(b.genre) || b.playing - a.playing || a.subgenre.localeCompare(b.subgenre));
  }

  if (rpcResult.error.code !== "42883" && rpcResult.error.code !== "PGRST202") {
    console.warn("Failed to load stats subgenre options aggregate", rpcResult.error.message);
  }

  const { data, error } = await supabaseAdmin()
    .from("stats_game_current_index")
    .select("genre, genre_l1, genre_l2, playing")
    .not("genre_l2", "is", null)
    .order("playing", { ascending: false, nullsFirst: false })
    .limit(20000);

  if (error) {
    console.warn("Failed to load stats subgenre options", error.message);
    return [];
  }

  const byKey = new Map<string, StatsSubgenreOption>();
  for (const row of (data ?? []) as Array<{ genre: string | null; genre_l1: string | null; genre_l2: string | null; playing: number | null }>) {
    const genre = cleanStatsTaxonomyLabel(row.genre_l1);
    const subgenre = cleanStatsTaxonomyLabel(row.genre_l2);
    if (!genre || !subgenre) continue;
    const key = `${genre}\u0000${subgenre}`;
    const current = byKey.get(key) ?? { genre, subgenre, games: 0, playing: 0 };
    current.games += 1;
    current.playing += row.playing ?? 0;
    byKey.set(key, current);
  }

  return [...byKey.values()].sort((a, b) => a.genre.localeCompare(b.genre) || b.playing - a.playing || a.subgenre.localeCompare(b.subgenre));
}

export async function searchStatsGamesForCompare(input: {
  q?: string | null;
  excludeUniverseIds?: number[];
  limit?: number;
  genre?: string | null;
  subgenre?: string | null;
}): Promise<StatsGameSearchResult[]> {
  const q = input.q?.trim() ?? "";
  if (q.length < 2) return [];
  const exclude = new Set(input.excludeUniverseIds ?? []);
  const genre = input.genre?.trim() || undefined;
  const subgenre = input.subgenre?.trim() || undefined;
  const { rows } = await listBaseGames({
    limit: Math.min(Math.max(input.limit ?? 8, 1), 12),
    q,
    genre,
    subgenre,
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
      visits: game.visits,
      genre: game.genre,
      subgenre: game.subgenre
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
      const rating = hasEnoughRatingVotes(likesEnd, dislikesEnd)
        ? (getRatingPercent(likesEnd, dislikesEnd) ?? latestNumber(bucket, "rating_percent"))
        : null;
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
  return STATS_CHART_RESOLUTIONS.some((option) => option.value === value) ? (value as StatsChartResolution) : DEFAULT_STATS_CHART_RESOLUTION;
}

function mapPlatformAggregatePoint(row: PlatformAggregateRow, resolution: StatsChartResolution): StatsChartPoint | null {
  const sampledAt = row.hour_start ?? (row.stat_date ? `${row.stat_date}T00:00:00.000Z` : null);
  if (!sampledAt) return null;
  const date = new Date(sampledAt);
  if (!Number.isFinite(date.getTime())) return null;
  return {
    label: resolution === "hourly"
      ? date.toLocaleTimeString("en-US", { hour: "numeric", hour12: true, timeZone: "UTC" })
      : formatChartDate(date),
    tooltipLabel: resolution === "hourly"
      ? formatBucketTooltip(date, date, "hourly")
      : formatChartDate(date, true),
    sampledAt,
    players: toFiniteNumber(row.playing),
    peakPlayers: toFiniteNumber(row.peak_players),
    avgPlayers: toFiniteNumber(row.avg_players),
    visits: toFiniteNumber(row.visits),
    favorites: toFiniteNumber(row.favorites),
    rating: toFiniteNumber(row.rating_percent),
    samples: toFiniteNumber(row.samples)
  };
}

function latestPointNumber(points: StatsChartPoint[], key: keyof Pick<StatsChartPoint, "visits" | "favorites">): number | null {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const value = points[index]?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function bucketPlatformPoints(
  points: StatsChartPoint[],
  range: StatsTimeRange,
  resolution: StatsChartResolution,
  window = chartWindow(range)
): StatsChartPoint[] {
  if (!points.length) return [];
  const rangeStart = window.start;
  const rangeEnd = window.end;
  const bucketMs = RESOLUTION_HOURS[resolution] * 60 * 60 * 1000;
  const buckets = new Map<number, StatsChartPoint[]>();

  for (const point of points) {
    const sampledMs = Date.parse(point.sampledAt);
    if (!Number.isFinite(sampledMs)) continue;
    if (sampledMs < rangeStart.getTime() || sampledMs > rangeEnd.getTime()) continue;
    const bucketIndex = Math.max(0, Math.floor((sampledMs - rangeStart.getTime()) / bucketMs));
    const bucket = buckets.get(bucketIndex) ?? [];
    bucket.push(point);
    buckets.set(bucketIndex, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([bucketIndex, bucket]) => {
      bucket.sort((a, b) => Date.parse(a.sampledAt) - Date.parse(b.sampledAt));
      const bucketStart = new Date(rangeStart.getTime() + bucketIndex * bucketMs);
      const bucketEnd = new Date(Math.min(rangeStart.getTime() + (bucketIndex + 1) * bucketMs, rangeEnd.getTime()));
      let playerTotal = 0;
      let playerWeight = 0;
      let ratingTotal = 0;
      let ratingWeight = 0;
      let peakPlayers: number | null = null;
      let samples = 0;

      for (const point of bucket) {
        const sampleCount = Math.max(point.samples ?? 1, 1);
        if (typeof point.players === "number") {
          playerTotal += point.players * sampleCount;
          playerWeight += sampleCount;
        }
        if (typeof point.peakPlayers === "number") {
          peakPlayers = peakPlayers == null ? point.peakPlayers : Math.max(peakPlayers, point.peakPlayers);
        }
        if (typeof point.rating === "number") {
          ratingTotal += point.rating * sampleCount;
          ratingWeight += sampleCount;
        }
        samples += point.samples ?? 0;
      }

      const sampledAt = bucket[bucket.length - 1]?.sampledAt ?? bucketEnd.toISOString();
      return {
        label: formatBucketLabel(bucketStart, bucketEnd, resolution),
        tooltipLabel: formatBucketTooltip(bucketStart, bucketEnd, resolution),
        sampledAt,
        players: playerWeight > 0 ? playerTotal / playerWeight : null,
        peakPlayers,
        avgPlayers: playerWeight > 0 ? playerTotal / playerWeight : null,
        visits: latestPointNumber(bucket, "visits"),
        favorites: latestPointNumber(bucket, "favorites"),
        rating: ratingWeight > 0 ? Math.round((ratingTotal / ratingWeight) * 10) / 10 : null,
        samples
      };
    });
}

async function getStoredPlatformChart(
  range: StatsTimeRange,
  resolution: StatsChartResolution,
  window = chartWindow(range)
): Promise<StatsChartPoint[] | null> {
  const useHourly = resolution === "hourly";
  const table = useHourly ? "roblox_platform_stats_hourly" : "roblox_platform_stats_daily";
  const timeColumn = useHourly ? "hour_start" : "stat_date";
  const startValue = useHourly ? window.start.toISOString() : window.start.toISOString().slice(0, 10);
  const endValue = useHourly ? window.end.toISOString() : window.end.toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin()
    .from(table)
    .select(`${timeColumn}, playing, peak_players, avg_players, visits, favorites, rating_percent, tracked_games, samples, recorded_at`)
    .gte(timeColumn, startValue)
    .lte(timeColumn, endValue)
    .order(timeColumn, { ascending: true });

  if (error) {
    if (error.code !== "42P01") {
      console.warn("Failed to load stored platform stats", error.message);
    }
    return null;
  }

  const points = ((data ?? []) as PlatformAggregateRow[])
    .map((row) => mapPlatformAggregatePoint(row, useHourly ? "hourly" : "daily"))
    .filter((point): point is StatsChartPoint => Boolean(point));
  if (!points.length) return null;
  return resolution === "hourly" || resolution === "daily" ? points : bucketPlatformPoints(points, range, resolution, window);
}

export async function getStatsPlatformChart(
  range: StatsTimeRange = "7d",
  resolution: StatsChartResolution = DEFAULT_STATS_CHART_RESOLUTION,
  options: { includePrevious?: boolean } = {}
): Promise<StatsGameChartData> {
  const window = chartWindow(range);
  const previousWindow = chartWindow(range, 1);
  const [storedPoints, storedPreviousPoints] = await Promise.all([
    getStoredPlatformChart(range, resolution, window),
    options.includePrevious ? getStoredPlatformChart(range, resolution, previousWindow) : Promise.resolve(undefined)
  ]);
  const fallbackPoints =
    storedPoints ??
    (resolution === "hourly" && range === "1d" ? await getPlatformTrendFromRpc(window.start.toISOString()) : null) ??
    [];
  const fallbackPreviousPoints =
    options.includePrevious && !storedPreviousPoints && resolution === "hourly"
      ? undefined
      : storedPreviousPoints ?? undefined;

  return {
    range,
    requestedResolution: resolution,
    resolution,
    points: fallbackPoints,
    previousPoints: fallbackPreviousPoints
  };
}

export async function getStatsPlatformPage(): Promise<StatsPlatformPageData> {
  const [{ rows: topGames }, { rows: mostVisited }, { total: trackedGames }, genres, riserBase, platformTotals, chart] = await Promise.all([
    listBaseGames({ limit: 12, sort: "playing" }),
    listBaseGames({ limit: 10, sort: "visits" }),
    listBaseGames({ limit: 1, sort: "playing", count: "exact" }),
    listStatsGenres(12),
    listCurrentRisers(12),
    getStatsPlatformTotals(),
    getStatsPlatformChart("1d", "hourly")
  ]);
  const risers = riserBase
    .filter(isEligibleHomeRiser)
    .sort((a, b) => {
      const scoreDelta = momentumRiserScore(b) - momentumRiserScore(a);
      if (scoreDelta !== 0) return scoreDelta;
      return (b.growth24h ?? -Infinity) - (a.growth24h ?? -Infinity);
    })
    .slice(0, 10);

  return {
    totals: {
      trackedGames,
      livePlayers: platformTotals?.livePlayers ?? topGames.reduce((sum, game) => sum + (game.playing ?? 0), 0),
      totalVisits: platformTotals?.totalVisits ?? mostVisited.reduce((sum, game) => sum + (game.visits ?? 0), 0),
      totalFavorites: platformTotals?.totalFavorites ?? 0,
      totalLikes: platformTotals?.totalLikes ?? 0,
      totalDislikes: platformTotals?.totalDislikes ?? 0,
      ratingPercent: platformTotals?.ratingPercent ?? null,
      lastUpdatedAt: platformTotals?.lastUpdatedAt ?? topGames.map((game) => game.lastStatsRefreshedAt).filter(Boolean).sort().pop() ?? null
    },
    chart,
    topGames,
    risers,
    mostVisited,
    genres
  };
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

function rankComparisonMatchesScope(
  game: Pick<StatsGame, "genre" | "subgenre">,
  baseGame: Pick<StatsGame, "genre" | "subgenre">,
  scope: StatsRankKey
) {
  if (scope === "global") return true;
  if (scope === "genre") return Boolean(baseGame.genre && game.genre === baseGame.genre);
  return Boolean(baseGame.subgenre && game.subgenre === baseGame.subgenre);
}

async function getStatsRankChartComparisons(
  universeIds: number[],
  baseGame: Pick<StatsGame, "genre" | "subgenre">,
  scope: StatsRankKey,
  range: StatsTimeRange,
  resolution: StatsChartResolution,
  window = chartWindow(range)
): Promise<StatsRankChartComparison[]> {
  if (!universeIds.length) return [];
  const games = await Promise.all(universeIds.map((id) => getStatsGameSummaryByUniverseId(id)));
  const comparisons: StatsRankChartComparison[] = [];
  for (const game of games) {
    if (!game || !rankComparisonMatchesScope(game, baseGame, scope)) continue;
    const rows = await getRankRows(game.universeId, range, window);
    comparisons.push({
      universeId: game.universeId,
      name: game.name,
      slug: game.slug,
      iconUrl: game.iconUrl,
      points: bucketRankRows(rows, range, resolution, window)
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
  range: StatsTimeRange = DEFAULT_STATS_CHART_RANGE,
  resolution: StatsChartResolution = DEFAULT_STATS_CHART_RESOLUTION,
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
  range: StatsTimeRange = DEFAULT_STATS_CHART_RANGE,
  resolution: StatsChartResolution = DEFAULT_STATS_CHART_RESOLUTION,
  options: { includePrevious?: boolean; includeAnnotations?: boolean; compareUniverseIds?: number[]; compareScope?: StatsRankKey } = {}
): Promise<StatsGameRankChartData> {
  const window = chartWindow(range);
  const previousWindow = chartWindow(range, 1);
  const [rows, previousRows, comparisons, annotations] = await Promise.all([
    getRankRows(game.universeId, range, window),
    options.includePrevious ? getRankRows(game.universeId, range, previousWindow) : Promise.resolve(undefined),
    getStatsRankChartComparisons(options.compareUniverseIds ?? [], game, options.compareScope ?? "global", range, resolution, window),
    options.includeAnnotations ? getStatsChartAnnotations(game.universeId, window.start, window.end) : Promise.resolve(undefined)
  ]);
  return {
    range,
    requestedResolution: resolution,
    resolution,
    points: bucketRankRows(rows, range, resolution, window),
    previousPoints: previousRows ? bucketRankRows(previousRows, range, resolution, previousWindow) : undefined,
    comparisons,
    annotations,
    summaries: summarizeRankRows(rows, game)
  };
}

export async function getStatsGameRankChartByUniverseId(
  universeId: number,
  range: StatsTimeRange = DEFAULT_STATS_CHART_RANGE,
  resolution: StatsChartResolution = DEFAULT_STATS_CHART_RESOLUTION,
  options: { includePrevious?: boolean; includeAnnotations?: boolean; compareUniverseIds?: number[]; compareScope?: StatsRankKey } = {}
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
  const [initialChart, initialRankChart, relatedLinks, sameCreator, similarGames, globalRank] = await Promise.all([
    getStatsGameChart(baseGame.universeId, DEFAULT_STATS_CHART_RANGE, DEFAULT_STATS_CHART_RESOLUTION, { includeAnnotations: true }),
    getStatsGameRankChart(baseGame, DEFAULT_STATS_CHART_RANGE, DEFAULT_STATS_CHART_RESOLUTION, { includeAnnotations: true }),
    loadRelatedLinks(baseGame.universeId, baseGame),
    loadSameCreatorGames(baseGame),
    loadSimilarGames(baseGame),
    loadLatestRank(baseGame.universeId)
  ]);

  return {
    game: { ...baseGame, rank: globalRank ?? baseGame.rank, links: relatedLinks },
    initialChart,
    initialRankChart,
    relatedLinks,
    sameCreator,
    similarGames
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
    sb.from("code_pages").select("slug, name").eq("universe_id", universeId).eq("is_published", true).limit(1),
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

export async function loadLatestRank(universeId: number): Promise<number | null> {
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
