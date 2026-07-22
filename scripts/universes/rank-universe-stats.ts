import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";
import { isStatsTier, type StatsTier } from "./stats-tier";
import { STATS_PLAYING_FRESHNESS_MS } from "@/lib/stats-freshness";

const DEFAULT_LIMIT = readNonNegativeInteger("UNIVERSE_RANK_LIMIT", 0);
const PAGE_SIZE = readNonNegativeInteger("UNIVERSE_RANK_PAGE_SIZE", 1000);
const UPSERT_CHUNK_SIZE = readNonNegativeInteger("UNIVERSE_RANK_UPSERT_CHUNK_SIZE", 5000);
const RELEVANT_GLOBAL_PLAYING_LIMIT = readNonNegativeInteger("UNIVERSE_RANK_RELEVANT_GLOBAL_PLAYING_LIMIT", 10000);
const RELEVANT_SCOPED_PLAYING_LIMIT = readNonNegativeInteger("UNIVERSE_RANK_RELEVANT_SCOPED_PLAYING_LIMIT", 1000);
const RANK_TYPES = ["global_playing", "genre_playing", "subgenre_playing", "global_visits", "global_favorites", "global_rating"] as const;
const PLAYING_RANK_TYPES = ["global_playing", "genre_playing", "subgenre_playing"] as const;

type RankType = (typeof RANK_TYPES)[number];
type RankSet = "playing" | "all";
type SnapshotScope = "relevant" | "all";
type RankGranularity = "hourly" | "daily";

type UniverseRankRow = {
  universe_id: number;
  stats_tier: StatsTier | null;
  genre: string | null;
  genre_l1: string | null;
  genre_l2: string | null;
  playing: number | null;
  visits: number | null;
  favorites: number | null;
  likes: number | null;
  dislikes: number | null;
};

type Options = {
  limit: number;
  pageSize: number;
  upsertChunkSize: number;
  tier: StatsTier | "ALL";
  rankSet: RankSet;
  snapshotScope: SnapshotScope;
  granularity: RankGranularity;
  dryRun: boolean;
};

type RankSnapshotPayload = {
  universe_id: number;
  rank_type: RankType;
  rank_value: number;
  metric_value: number | null;
  hour_start?: string;
  stat_date?: string;
  sampled_at: string;
};

function readNonNegativeInteger(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function metricFor(row: UniverseRankRow, rankType: RankType): number | null {
  if (rankType === "global_playing" || rankType === "genre_playing" || rankType === "subgenre_playing") return row.playing ?? null;
  if (rankType === "global_visits") return row.visits ?? null;
  if (rankType === "global_favorites") return row.favorites ?? null;
  const likes = row.likes ?? 0;
  const dislikes = row.dislikes ?? 0;
  const total = likes + dislikes;
  if (total < 20) return null;
  return Math.round((likes / total) * 1000) / 10;
}

function scopeFor(row: UniverseRankRow, rankType: RankType): string | null {
  if (rankType === "genre_playing") return row.genre_l1?.trim() || null;
  if (rankType === "subgenre_playing") return row.genre_l2 ?? null;
  return "global";
}

function orderColumnFor(rankType: RankType): "playing" | "visits" | "favorites" | "likes" {
  if (rankType === "global_visits") return "visits";
  if (rankType === "global_favorites") return "favorites";
  if (rankType === "global_rating") return "likes";
  return "playing";
}

function orderValueFor(row: UniverseRankRow, orderColumn: ReturnType<typeof orderColumnFor>) {
  return row[orderColumn];
}

function isRelevantSnapshot(row: UniverseRankRow, rankType: RankType, rank: number, options: Options) {
  if (options.snapshotScope === "all") return true;
  if (row.stats_tier === "HOT" || row.stats_tier === "WARM") return true;
  if (rankType === "global_playing") return rank <= RELEVANT_GLOBAL_PLAYING_LIMIT;
  if (rankType === "genre_playing" || rankType === "subgenre_playing") return rank <= RELEVANT_SCOPED_PLAYING_LIMIT;
  return rank <= RELEVANT_GLOBAL_PLAYING_LIMIT;
}

async function fetchRankRows(rankType: RankType, options: Options): Promise<UniverseRankRow[]> {
  const sb = supabaseAdmin();
  const orderColumn = orderColumnFor(rankType);
  const rows: UniverseRankRow[] = [];
  const pageSize = Math.max(1, options.pageSize);
  let lastOrderValue: number | null = null;
  let lastUniverseId: number | null = null;

  while (true) {
    if (options.limit > 0 && rows.length >= options.limit) break;
    const remaining = options.limit > 0 ? options.limit - rows.length : pageSize;
    const currentPageSize = Math.min(pageSize, remaining);
    let query = sb
      .from("roblox_universes")
      .select("universe_id, stats_tier, genre, genre_l1, genre_l2, playing, visits, favorites, likes, dislikes")
      .not(orderColumn, "is", null);

    if (options.tier !== "ALL") {
      query = query.eq("stats_tier", options.tier);
    } else {
      query = query.or("stats_tier.neq.NEW,stats_tier.is.null");
    }

    if (PLAYING_RANK_TYPES.includes(rankType as (typeof PLAYING_RANK_TYPES)[number])) {
      query = query.gte("last_playing_refreshed_at", new Date(Date.now() - STATS_PLAYING_FRESHNESS_MS).toISOString());
    }

    if (lastOrderValue != null && lastUniverseId != null) {
      query = query.or(`${orderColumn}.lt.${lastOrderValue},and(${orderColumn}.eq.${lastOrderValue},universe_id.gt.${lastUniverseId})`);
    }

    const { data, error } = await query
      .order(orderColumn, { ascending: false, nullsFirst: false })
      .order("universe_id", { ascending: true })
      .limit(currentPageSize);
    if (error) throw error;
    const chunk = (data ?? []) as UniverseRankRow[];
    rows.push(...chunk);
    if (chunk.length < currentPageSize) break;
    const lastRow = chunk[chunk.length - 1];
    lastOrderValue = orderValueFor(lastRow, orderColumn);
    lastUniverseId = lastRow.universe_id;
  }

  if (rankType !== "global_rating") return rows;
  return rows
    .map((row) => ({ row, metric: metricFor(row, rankType) }))
    .filter((entry): entry is { row: UniverseRankRow; metric: number } => entry.metric != null)
    .sort((a, b) => b.metric - a.metric)
    .slice(0, options.limit > 0 ? options.limit : undefined)
    .map((entry) => entry.row);
}

async function writePayload(payload: RankSnapshotPayload[], options: Options) {
  if (!payload.length) return 0;
  if (options.dryRun) return payload.length;
  const table = options.granularity === "daily" ? "roblox_universe_rank_snapshots_daily" : "roblox_universe_rank_snapshots_hourly";
  const onConflict = options.granularity === "daily" ? "universe_id,rank_type,stat_date" : "universe_id,rank_type,hour_start";
  for (let i = 0; i < payload.length; i += options.upsertChunkSize) {
    const chunk = payload.slice(i, i + options.upsertChunkSize);
    const { error } = await supabaseAdmin()
      .from(table)
      .upsert(chunk, { onConflict });
    if (error) throw error;
  }
  return payload.length;
}

function snapshotBase(options: Options, sampledAt: string) {
  const base = { sampled_at: sampledAt };
  if (options.granularity === "daily") {
    return { ...base, stat_date: sampledAt.slice(0, 10) };
  }
  return { ...base, hour_start: sampledAt };
}

function snapshotKey(row: RankSnapshotPayload, options: Options) {
  const timestampKey = options.granularity === "daily" ? row.stat_date : row.hour_start;
  return `${row.universe_id}:${row.rank_type}:${timestampKey ?? ""}`;
}

function dedupePayload(payload: RankSnapshotPayload[], options: Options) {
  if (payload.length < 2) return payload;
  const rowsByKey = new Map<string, RankSnapshotPayload>();
  let duplicateCount = 0;
  for (const row of payload) {
    const key = snapshotKey(row, options);
    if (rowsByKey.has(key)) duplicateCount += 1;
    rowsByKey.set(key, row);
  }
  if (duplicateCount > 0) {
    console.warn(`Dropped ${duplicateCount} duplicate rank snapshot row(s) before upsert.`);
  }
  return [...rowsByKey.values()];
}

async function writeGlobalRankType(rankType: RankType, rows: UniverseRankRow[], options: Options, sampledAt: string) {
  const payload: RankSnapshotPayload[] = [];
  rows.forEach((row, index) => {
    const rank = index + 1;
    const metric = metricFor(row, rankType);
    if (metric == null || !isRelevantSnapshot(row, rankType, rank, options)) return;
    payload.push({
      universe_id: row.universe_id,
      rank_type: rankType,
      rank_value: rank,
      metric_value: metric,
      ...snapshotBase(options, sampledAt)
    });
  });
  return writePayload(dedupePayload(payload, options), options);
}

async function writeScopedPlayingRankType(rankType: "genre_playing" | "subgenre_playing", rows: UniverseRankRow[], options: Options, sampledAt: string) {
  const payload: RankSnapshotPayload[] = [];
  const groups = new Map<string, UniverseRankRow[]>();
  for (const row of rows) {
    const scope = scopeFor(row, rankType);
    const metric = metricFor(row, rankType);
    if (!scope || metric == null) continue;
    groups.set(scope, [...(groups.get(scope) ?? []), row]);
  }
  for (const scopedRows of groups.values()) {
    scopedRows
      .sort((a, b) => (metricFor(b, rankType) ?? -Infinity) - (metricFor(a, rankType) ?? -Infinity) || a.universe_id - b.universe_id)
      .forEach((row, index) => {
        const rank = index + 1;
        const metric = metricFor(row, rankType);
        if (metric == null || !isRelevantSnapshot(row, rankType, rank, options)) return;
        payload.push({
          universe_id: row.universe_id,
          rank_type: rankType,
          rank_value: rank,
          metric_value: metric,
          ...snapshotBase(options, sampledAt)
        });
      });
  }
  return writePayload(dedupePayload(payload, options), options);
}

async function writeRankType(rankType: RankType, options: Options, sampledAt: string) {
  const rows = await fetchRankRows(rankType, options);
  if (rankType === "genre_playing" || rankType === "subgenre_playing") {
    return writeScopedPlayingRankType(rankType, rows, options, sampledAt);
  }
  return writeGlobalRankType(rankType, rows, options, sampledAt);
}

async function writePlayingRankTypes(options: Options, sampledAt: string) {
  const rows = await fetchRankRows("global_playing", options);
  const counts = new Map<RankType, number>();
  counts.set("global_playing", await writeGlobalRankType("global_playing", rows, options, sampledAt));
  counts.set("genre_playing", await writeScopedPlayingRankType("genre_playing", rows, options, sampledAt));
  counts.set("subgenre_playing", await writeScopedPlayingRankType("subgenre_playing", rows, options, sampledAt));
  return counts;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    limit: Number.isFinite(DEFAULT_LIMIT) && DEFAULT_LIMIT > 0 ? DEFAULT_LIMIT : 0,
    pageSize: PAGE_SIZE > 0 ? PAGE_SIZE : 1000,
    upsertChunkSize: UPSERT_CHUNK_SIZE > 0 ? UPSERT_CHUNK_SIZE : 5000,
    tier: "ALL",
    rankSet: process.env.UNIVERSE_RANK_SET === "all" ? "all" : "playing",
    snapshotScope: process.env.UNIVERSE_RANK_SNAPSHOT_SCOPE === "all" ? "all" : "relevant",
    granularity: process.env.UNIVERSE_RANK_GRANULARITY === "daily" ? "daily" : "hourly",
    dryRun: false
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--limit" || arg === "-l") {
      const parsed = Number(args[i + 1]);
      options.limit = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : options.limit;
      i += 1;
    } else if (arg === "--page-size") {
      const parsed = Number(args[i + 1]);
      options.pageSize = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : options.pageSize;
      i += 1;
    } else if (arg === "--upsert-chunk-size") {
      const parsed = Number(args[i + 1]);
      options.upsertChunkSize = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : options.upsertChunkSize;
      i += 1;
    } else if (arg === "--tier") {
      const tier = String(args[i + 1] ?? "").toUpperCase();
      if (tier === "ALL" || isStatsTier(tier)) {
        options.tier = tier;
      } else {
        throw new Error(`Invalid --tier value: ${tier}. Use HOT, WARM, COLD, NEW, or ALL.`);
      }
      i += 1;
    } else if (arg === "--all") {
      options.tier = "ALL";
    } else if (arg === "--rank-set") {
      const rankSet = String(args[i + 1] ?? "").toLowerCase();
      if (rankSet !== "playing" && rankSet !== "all") throw new Error(`Invalid --rank-set value: ${rankSet}. Use playing or all.`);
      options.rankSet = rankSet;
      i += 1;
    } else if (arg === "--snapshot-scope") {
      const snapshotScope = String(args[i + 1] ?? "").toLowerCase();
      if (snapshotScope !== "relevant" && snapshotScope !== "all") throw new Error(`Invalid --snapshot-scope value: ${snapshotScope}. Use relevant or all.`);
      options.snapshotScope = snapshotScope;
      i += 1;
    } else if (arg === "--granularity") {
      const granularity = String(args[i + 1] ?? "").toLowerCase();
      if (granularity !== "hourly" && granularity !== "daily") throw new Error(`Invalid --granularity value: ${granularity}. Use hourly or daily.`);
      options.granularity = granularity;
      i += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--quality-only") {
      options.tier = "HOT";
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npm run stats:rank -- [options]

Options:
  -l, --limit <number>   Max rows to rank per metric; 0 means all (default: ${DEFAULT_LIMIT})
  --page-size <number>   Supabase page size for universe reads (default: ${PAGE_SIZE})
  --upsert-chunk-size <number>
                         Rows per rank snapshot upsert chunk (default: ${UPSERT_CHUNK_SIZE})
  --tier <tier>          Rank one stats tier: HOT, WARM, COLD, NEW, or ALL (default: ALL except NEW)
  --all                  Rank all non-NEW universes
  --rank-set <set>       playing or all (default: ${options.rankSet})
  --snapshot-scope <s>   relevant or all (default: ${options.snapshotScope})
  --granularity <value>  hourly or daily (default: ${options.granularity})
  --dry-run              Read and compute ranks without writing snapshots
  -h, --help             Show this help text
`);
      process.exit(0);
    }
  }
  return options;
}

async function main() {
  const options = parseArgs();
  const run = await startStatsJobRun({
    jobName: options.rankSet === "playing" ? "stats_rank_playing" : "stats_rank_all",
    metadata: {
      granularity: options.granularity,
      rank_set: options.rankSet,
      snapshot_scope: options.snapshotScope,
      limit: options.limit,
      page_size: options.pageSize,
      upsert_chunk_size: options.upsertChunkSize,
      dry_run: options.dryRun
    }
  });
  const sampledAt = new Date();
  sampledAt.setUTCMinutes(0, 0, 0);
  const sampledAtIso = sampledAt.toISOString();
  let totalRanked = 0;

  try {
    console.log(
      `Snapshotting ranks (granularity=${options.granularity}, rankSet=${options.rankSet}, snapshotScope=${options.snapshotScope}, limit=${options.limit || "all"}, pageSize=${options.pageSize}, dryRun=${options.dryRun})...`
    );

    const countsByType: Record<string, number> = {};

    if (options.rankSet === "playing") {
      const counts = await writePlayingRankTypes(options, sampledAtIso);
      for (const rankType of PLAYING_RANK_TYPES) {
        const count = counts.get(rankType) ?? 0;
        totalRanked += count;
        countsByType[rankType] = count;
        console.log(`Ranked ${count} rows for ${rankType}.`);
      }
      await finishStatsJobRun(run, {
        status: "success",
        rowsSucceeded: totalRanked,
        metadata: { sampled_at: sampledAtIso, counts_by_type: countsByType }
      });
      return;
    }

    const playingCounts = await writePlayingRankTypes(options, sampledAtIso);
    for (const rankType of PLAYING_RANK_TYPES) {
      const count = playingCounts.get(rankType) ?? 0;
      totalRanked += count;
      countsByType[rankType] = count;
      console.log(`Ranked ${count} rows for ${rankType}.`);
    }
    for (const rankType of ["global_visits", "global_favorites", "global_rating"] as const) {
      const count = await writeRankType(rankType, options, sampledAtIso);
      totalRanked += count;
      countsByType[rankType] = count;
      console.log(`Ranked ${count} rows for ${rankType}.`);
    }

    await finishStatsJobRun(run, {
      status: "success",
      rowsSucceeded: totalRanked,
      metadata: { sampled_at: sampledAtIso, counts_by_type: countsByType }
    });
  } catch (error) {
    await finishStatsJobRun(run, { status: "failed", rowsSucceeded: totalRanked, error });
    throw error;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
