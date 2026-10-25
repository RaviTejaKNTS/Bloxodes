import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { statsUniverseSlug } from "@/lib/slug";
import { cachedStatsChart } from "@/lib/stats-chart-cache";

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
  /** True when no good result could be loaded; the page shows a short notice. */
  unavailable?: boolean;
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

const INDIVIDUAL_GAME_LIMIT = 8;
const TOP_GROUP_LIMIT = 100;
const WIDE_GROUP_LIMIT = 1000;
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

function roundVisitShare(value: number) {
  return Math.round(value * 100) / 100;
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

const RPC_PAGE_SIZE = 1000;
const RPC_MAX_PAGES = 5;

async function getVisitShareChartFromRpc(range: StatsVisitShareRange, window = chartWindow(range)): Promise<StatsVisitShareChartData | null> {
  const startDate = window.start.toISOString().slice(0, 10);
  const endDate = window.end.toISOString().slice(0, 10);
  // The Data API returns at most 1,000 rows per request, and a 90-day result
  // has up to 91 days x 11 buckets = 1,001. Page until a short page arrives.
  const rows: VisitShareRpcRow[] = [];
  for (let page = 0; page < RPC_MAX_PAGES; page += 1) {
    const from = page * RPC_PAGE_SIZE;
    const { data, error } = await supabaseAdmin()
      .rpc("get_stats_visit_share_chart", {
        p_since: startDate,
        p_until: endDate,
        p_top_games: INDIVIDUAL_GAME_LIMIT,
        p_top_group: TOP_GROUP_LIMIT,
        p_wide_group: WIDE_GROUP_LIMIT
      })
      .range(from, from + RPC_PAGE_SIZE - 1);

    if (error) {
      console.warn("Failed to load visit-share chart RPC", error.message);
      return null;
    }

    const pageRows = (data ?? []) as VisitShareRpcRow[];
    rows.push(...pageRows);
    if (pageRows.length < RPC_PAGE_SIZE) break;
  }

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

function unavailableVisitShareChart(range: StatsVisitShareRange): StatsVisitShareChartData {
  return {
    range,
    points: [],
    series: [],
    denominatorGameCount: 0,
    visibleGameCount: 0,
    totalVisits: 0,
    generatedAt: new Date().toISOString(),
    unavailable: true
  };
}

// The RPC reads summaries ranked over every tracked game. When a summary is
// missing or the read fails, retain the last good answer instead of rebuilding
// the chart from a smaller set of games.
export async function getStatsVisitShareChart(range: StatsVisitShareRange = "30d"): Promise<StatsVisitShareChartData> {
  const chart = await cachedStatsChart(`visit-share:${range}`, () => getVisitShareChartFromRpc(range));
  return chart ?? unavailableVisitShareChart(range);
}
