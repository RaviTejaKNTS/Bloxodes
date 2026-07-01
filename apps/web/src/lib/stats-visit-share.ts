import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { statsUniverseSlug } from "@/lib/slug";

export type StatsVisitShareRange = "1d" | "7d" | "14d" | "30d" | "90d";

export type StatsVisitShareSeries = {
  key: string;
  universeId: number | null;
  name: string;
  slug: string | null;
  iconUrl: string | null;
  color: string;
  totalVisits: number;
  sharePercent: number;
  isOther: boolean;
  isGroup: boolean;
  rankStart: number | null;
  rankEnd: number | null;
};

export type StatsVisitSharePoint = {
  label: string;
  tooltipLabel: string;
  sampledAt: string;
  totalVisits: number;
  shares: Record<string, number>;
  visits: Record<string, number>;
};

export type StatsVisitShareChartData = {
  range: StatsVisitShareRange;
  points: StatsVisitSharePoint[];
  series: StatsVisitShareSeries[];
  denominatorGameCount: number;
  visibleGameCount: number;
  totalVisits: number;
  generatedAt: string;
};

type VisitShareGameRow = {
  universe_id: number;
  name: string;
  display_name: string | null;
  slug: string | null;
  icon_url: string | null;
  visits: number | string | null;
};

type DailyVisitShareRow = {
  universe_id: number;
  stat_date: string;
  visit_delta: number | string | null;
  visits_start: number | string | null;
  visits_end: number | string | null;
};

type VisitShareGame = {
  universeId: number;
  name: string;
  slug: string;
  iconUrl: string | null;
  visits: number | null;
};

type VisitShareRpcRow = {
  stat_date: string;
  bucket_key: string;
  bucket_name: string;
  universe_id: number | string | null;
  slug: string | null;
  icon_url: string | null;
  bucket_rank_start: number | string | null;
  bucket_rank_end: number | string | null;
  is_group: boolean | null;
  visit_delta: number | string | null;
  denominator_visit_delta: number | string | null;
  denominator_game_count: number | string | null;
};

type VisitShareBucket = {
  key: string;
  name: string;
  universeId: number | null;
  slug: string | null;
  iconUrl: string | null;
  rankStart: number | null;
  rankEnd: number | null;
  isGroup: boolean;
  isOther: boolean;
};

const TOP_GAME_LIMIT = 1000;
const INDIVIDUAL_GAME_LIMIT = 8;
const TOP_GROUP_LIMIT = 100;
const WIDE_GROUP_LIMIT = 1000;
const REST_TOP_100_KEY = "rank_9_100";
const REST_TOP_1000_KEY = "rank_101_1000";
const OTHER_TRACKED_KEY = "other_tracked";
const RANGE_DAYS: Record<StatsVisitShareRange, number> = {
  "1d": 1,
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "90d": 90
};
const visitShareColors = [
  "#45d3c2",
  "#56bde8",
  "#ff9f8f",
  "#7897f2",
  "#f8d66d",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#60a5fa",
  "#64748b",
  "#94a3b8",
  "#cbd5e1"
];

export function normalizeVisitShareRange(value?: string | null): StatsVisitShareRange {
  return value === "1d" || value === "7d" || value === "14d" || value === "30d" || value === "90d" ? value : "30d";
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toInteger(value: unknown): number | null {
  const parsed = toFiniteNumber(value);
  return parsed == null ? null : Math.trunc(parsed);
}

function chartWindow(range: StatsVisitShareRange) {
  const durationMs = RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
  const end = new Date();
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

function visitShareSeriesKey(universeId: number) {
  return `g${universeId}`;
}

function groupBucketKey(rankStart: number, rankEnd: number) {
  return `rank_${rankStart}_${rankEnd}`;
}

function roundVisitShare(value: number) {
  return Math.round(value * 100) / 100;
}

function getDailyVisitDelta(row: DailyVisitShareRow) {
  const directDelta = toFiniteNumber(row.visit_delta);
  if (directDelta != null && directDelta > 0) return directDelta;
  const visitsStart = toFiniteNumber(row.visits_start);
  const visitsEnd = toFiniteNumber(row.visits_end);
  if (visitsStart == null || visitsEnd == null) return 0;
  return Math.max(0, visitsEnd - visitsStart);
}

async function listVisitShareGames(limit = TOP_GAME_LIMIT): Promise<VisitShareGame[]> {
  const { data, error } = await supabaseAdmin()
    .from("roblox_universes")
    .select("universe_id, name, display_name, slug, icon_url, visits")
    .not("slug", "is", null)
    .not("visits", "is", null)
    .order("visits", { ascending: false, nullsFirst: false })
    .order("universe_id", { ascending: true })
    .limit(limit);

  if (error) {
    console.warn("Failed to load visit-share games", error.message);
    return [];
  }

  return ((data ?? []) as VisitShareGameRow[]).map((game) => ({
    universeId: game.universe_id,
    name: game.display_name || game.name,
    slug: statsUniverseSlug(game.slug?.trim() || game.name || "roblox-game", game.universe_id),
    iconUrl: game.icon_url,
    visits: toFiniteNumber(game.visits)
  }));
}

async function listDailyVisitShareRows(
  universeIds: number[],
  range: StatsVisitShareRange,
  window = chartWindow(range)
): Promise<DailyVisitShareRow[]> {
  if (!universeIds.length) return [];
  const rows: DailyVisitShareRow[] = [];
  const pageSize = 1000;
  const idPageSize = 100;
  const startDate = window.start.toISOString().slice(0, 10);
  const endDate = window.end.toISOString().slice(0, 10);
  const sb = supabaseAdmin();

  for (let idOffset = 0; idOffset < universeIds.length; idOffset += idPageSize) {
    const idChunk = universeIds.slice(idOffset, idOffset + idPageSize);
    let offset = 0;

    while (true) {
      const { data, error } = await sb
        .from("roblox_universe_stats_daily")
        .select("universe_id, stat_date, visit_delta, visits_start, visits_end")
        .in("universe_id", idChunk)
        .gte("stat_date", startDate)
        .lte("stat_date", endDate)
        .order("stat_date", { ascending: true })
        .order("universe_id", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        if (error.code !== "42P01") {
          console.warn("Failed to load visit-share stats", error.message);
        }
        return [];
      }

      const chunk = (data ?? []) as DailyVisitShareRow[];
      rows.push(...chunk);
      if (chunk.length < pageSize) break;
      offset += pageSize;
    }
  }

  return rows;
}

function buildVisitShareChart({
  range,
  buckets,
  bucketTotals,
  byDate,
  dateTotals,
  denominatorGameCount
}: {
  range: StatsVisitShareRange;
  buckets: VisitShareBucket[];
  bucketTotals: Map<string, number>;
  byDate: Map<string, Map<string, number>>;
  dateTotals: Map<string, number>;
  denominatorGameCount: number;
}): StatsVisitShareChartData {
  const totalVisits = Array.from(dateTotals.values()).reduce((sum, value) => sum + value, 0);
  const activeBuckets = buckets.filter((bucket) => (bucketTotals.get(bucket.key) ?? 0) > 0);
  const series: StatsVisitShareSeries[] = activeBuckets.map((bucket, index) => {
    const visits = bucketTotals.get(bucket.key) ?? 0;
    return {
      key: bucket.key,
      universeId: bucket.universeId,
      name: bucket.name,
      slug: bucket.slug,
      iconUrl: bucket.iconUrl,
      color: visitShareColors[index % visitShareColors.length] ?? "#94a3b8",
      totalVisits: visits,
      sharePercent: totalVisits > 0 ? roundVisitShare((visits / totalVisits) * 100) : 0,
      isOther: bucket.isOther,
      isGroup: bucket.isGroup,
      rankStart: bucket.rankStart,
      rankEnd: bucket.rankEnd
    };
  });

  const points = Array.from(dateTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateValue, total]) => {
      const dateBuckets = byDate.get(dateValue) ?? new Map<string, number>();
      const date = new Date(`${dateValue}T00:00:00.000Z`);
      const shares: Record<string, number> = {};
      const visits: Record<string, number> = {};

      for (const bucket of activeBuckets) {
        const value = dateBuckets.get(bucket.key) ?? 0;
        visits[bucket.key] = value;
        shares[bucket.key] = total > 0 ? roundVisitShare((value / total) * 100) : 0;
      }

      return {
        label: Number.isFinite(date.getTime()) ? formatChartDate(date) : dateValue,
        tooltipLabel: Number.isFinite(date.getTime()) ? formatChartDate(date, true) : dateValue,
        sampledAt: `${dateValue}T00:00:00.000Z`,
        totalVisits: total,
        shares,
        visits
      };
    })
    .filter((point) => point.totalVisits > 0);

  return {
    range,
    points,
    series,
    denominatorGameCount,
    visibleGameCount: activeBuckets.filter((bucket) => !bucket.isGroup).length,
    totalVisits,
    generatedAt: new Date().toISOString()
  };
}

async function getVisitShareChartFromRpc(range: StatsVisitShareRange, window = chartWindow(range)): Promise<StatsVisitShareChartData | null> {
  const startDate = window.start.toISOString().slice(0, 10);
  const endDate = window.end.toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin().rpc("get_stats_visit_share_chart", {
    p_since: startDate,
    p_until: endDate,
    p_top_games: INDIVIDUAL_GAME_LIMIT,
    p_top_group: TOP_GROUP_LIMIT,
    p_wide_group: WIDE_GROUP_LIMIT
  });

  if (error) {
    if (error.code !== "PGRST202" && error.code !== "42883") {
      console.warn("Failed to load visit-share chart RPC", error.message);
    }
    return null;
  }

  const rows = (data ?? []) as VisitShareRpcRow[];
  if (!rows.length) return null;

  const bucketMap = new Map<string, VisitShareBucket>();
  const bucketTotals = new Map<string, number>();
  const byDate = new Map<string, Map<string, number>>();
  const dateTotals = new Map<string, number>();
  let denominatorGameCount = 0;

  for (const row of rows) {
    const key = row.bucket_key;
    const date = row.stat_date;
    const visits = toFiniteNumber(row.visit_delta) ?? 0;
    const total = toFiniteNumber(row.denominator_visit_delta) ?? 0;
    const rowDenominatorGameCount = toInteger(row.denominator_game_count) ?? 0;
    if (!key || !date || visits <= 0 || total <= 0) continue;

    if (!bucketMap.has(key)) {
      const universeId = toInteger(row.universe_id);
      bucketMap.set(key, {
        key,
        name: row.bucket_name,
        universeId,
        slug: row.slug && universeId != null ? statsUniverseSlug(row.slug, universeId) : null,
        iconUrl: row.icon_url,
        rankStart: toInteger(row.bucket_rank_start),
        rankEnd: toInteger(row.bucket_rank_end),
        isGroup: Boolean(row.is_group),
        isOther: key === OTHER_TRACKED_KEY
      });
    }

    bucketTotals.set(key, (bucketTotals.get(key) ?? 0) + visits);
    dateTotals.set(date, total);
    denominatorGameCount = Math.max(denominatorGameCount, rowDenominatorGameCount);

    const dateBuckets = byDate.get(date) ?? new Map<string, number>();
    dateBuckets.set(key, (dateBuckets.get(key) ?? 0) + visits);
    byDate.set(date, dateBuckets);
  }

  return buildVisitShareChart({
    range,
    buckets: Array.from(bucketMap.values()).sort((a, b) => (a.rankStart ?? Infinity) - (b.rankStart ?? Infinity)),
    bucketTotals,
    byDate,
    dateTotals,
    denominatorGameCount
  });
}

async function getVisitShareChartFallback(range: StatsVisitShareRange): Promise<StatsVisitShareChartData> {
  const games = await listVisitShareGames(TOP_GAME_LIMIT);
  const universeIds = games.map((game) => game.universeId);
  const dailyRows = await listDailyVisitShareRows(universeIds, range);
  const gameTotals = new Map<number, number>();
  const gameRowsByDate = new Map<string, Map<number, number>>();

  for (const row of dailyRows) {
    const delta = getDailyVisitDelta(row);
    if (delta <= 0) continue;
    gameTotals.set(row.universe_id, (gameTotals.get(row.universe_id) ?? 0) + delta);
    const dateTotals = gameRowsByDate.get(row.stat_date) ?? new Map<number, number>();
    dateTotals.set(row.universe_id, (dateTotals.get(row.universe_id) ?? 0) + delta);
    gameRowsByDate.set(row.stat_date, dateTotals);
  }

  const rankedGames = games
    .filter((game) => (gameTotals.get(game.universeId) ?? 0) > 0)
    .sort((a, b) => (gameTotals.get(b.universeId) ?? 0) - (gameTotals.get(a.universeId) ?? 0));
  const buckets: VisitShareBucket[] = rankedGames.slice(0, INDIVIDUAL_GAME_LIMIT).map((game, index) => ({
    key: visitShareSeriesKey(game.universeId),
    name: game.name,
    universeId: game.universeId,
    slug: game.slug,
    iconUrl: game.iconUrl,
    rankStart: index + 1,
    rankEnd: index + 1,
    isGroup: false,
    isOther: false
  }));

  if (rankedGames.length > INDIVIDUAL_GAME_LIMIT) {
    buckets.push({
      key: REST_TOP_100_KEY,
      name: `Ranks ${INDIVIDUAL_GAME_LIMIT + 1}-${Math.min(TOP_GROUP_LIMIT, rankedGames.length)}`,
      universeId: null,
      slug: null,
      iconUrl: null,
      rankStart: INDIVIDUAL_GAME_LIMIT + 1,
      rankEnd: Math.min(TOP_GROUP_LIMIT, rankedGames.length),
      isGroup: true,
      isOther: false
    });
  }

  if (rankedGames.length > TOP_GROUP_LIMIT) {
    buckets.push({
      key: REST_TOP_1000_KEY,
      name: `Ranks ${TOP_GROUP_LIMIT + 1}-${Math.min(WIDE_GROUP_LIMIT, rankedGames.length)}`,
      universeId: null,
      slug: null,
      iconUrl: null,
      rankStart: TOP_GROUP_LIMIT + 1,
      rankEnd: Math.min(WIDE_GROUP_LIMIT, rankedGames.length),
      isGroup: true,
      isOther: false
    });
  }

  const rankByUniverseId = new Map(rankedGames.map((game, index) => [game.universeId, index + 1]));
  const bucketKeyByUniverseId = new Map<number, string>();
  for (const game of rankedGames) {
    const rank = rankByUniverseId.get(game.universeId) ?? Infinity;
    if (rank <= INDIVIDUAL_GAME_LIMIT) {
      bucketKeyByUniverseId.set(game.universeId, visitShareSeriesKey(game.universeId));
    } else if (rank <= TOP_GROUP_LIMIT) {
      bucketKeyByUniverseId.set(game.universeId, REST_TOP_100_KEY);
    } else if (rank <= WIDE_GROUP_LIMIT) {
      bucketKeyByUniverseId.set(game.universeId, REST_TOP_1000_KEY);
    }
  }

  const bucketTotals = new Map<string, number>();
  const byDate = new Map<string, Map<string, number>>();
  const dateTotals = new Map<string, number>();

  for (const [date, dateGameTotals] of gameRowsByDate.entries()) {
    const dateBuckets = new Map<string, number>();
    let dateTotal = 0;
    for (const [universeId, visits] of dateGameTotals.entries()) {
      const key = bucketKeyByUniverseId.get(universeId);
      if (!key) continue;
      dateTotal += visits;
      bucketTotals.set(key, (bucketTotals.get(key) ?? 0) + visits);
      dateBuckets.set(key, (dateBuckets.get(key) ?? 0) + visits);
    }
    if (dateTotal > 0) {
      dateTotals.set(date, dateTotal);
      byDate.set(date, dateBuckets);
    }
  }

  return buildVisitShareChart({
    range,
    buckets,
    bucketTotals,
    byDate,
    dateTotals,
    denominatorGameCount: rankedGames.length
  });
}

export async function getStatsVisitShareChart(range: StatsVisitShareRange = "30d"): Promise<StatsVisitShareChartData> {
  return (await getVisitShareChartFromRpc(range)) ?? getVisitShareChartFallback(range);
}
