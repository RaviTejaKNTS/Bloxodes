import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { runDataApiOperation } from "../shared/data-api-retry";
import { enqueueRevalidationEvents, type RevalidationEvent } from "../shared/revalidation-events";
import {
  claimStatsPipelineLease,
  releaseStatsPipelineLease,
  statsPipelineLeaseName
} from "../shared/stats-pipeline-lease";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";
import { assignStatsTier, isStatsTier, type StatsTier } from "./stats-tier";

const GAME_DETAILS_API = "https://games.roblox.com/v1/games";
const GAME_VOTES_API = "https://games.roblox.com/v1/games/votes";
const BATCH_SIZE = readPositiveNumber("UNIVERSE_HOURLY_STATS_BATCH_SIZE", 50);
const DEFAULT_LIMIT = readPositiveNumber("UNIVERSE_HOURLY_STATS_LIMIT", 0);
const REQUEST_DELAY_MS = readPositiveNumber("UNIVERSE_HOURLY_STATS_REQUEST_DELAY_MS", 1000);
const RETRY_LIMIT = readPositiveNumber("UNIVERSE_HOURLY_STATS_RETRY_LIMIT", 5);
const RETRY_BASE_DELAY_MS = readPositiveNumber("UNIVERSE_HOURLY_STATS_RETRY_BASE_DELAY_MS", 5000);
const RETRY_MAX_DELAY_MS = readPositiveNumber("UNIVERSE_HOURLY_STATS_RETRY_MAX_DELAY_MS", 90000);
const DETAIL_REVALIDATION_LIMIT = readPositiveNumber("UNIVERSE_STATS_DETAIL_REVALIDATION_LIMIT", 1000);
const LEASE_MINUTES = readPositiveNumber("UNIVERSE_STATS_REFRESH_LEASE_MINUTES", 45);
const LEASE_CHUNK_SIZE = readPositiveNumber("UNIVERSE_STATS_REFRESH_LEASE_CHUNK_SIZE", 100);
const CLAIM_BATCH_SIZE = Math.max(1, Math.min(readPositiveNumber("UNIVERSE_STATS_CLAIM_BATCH_SIZE", 500), 500));
const PIPELINE_LEASE_MINUTES = Math.max(1, readPositiveNumber("UNIVERSE_STATS_PIPELINE_LEASE_MINUTES", 180));
const WORKER_ID =
  process.env.STATS_WORKER_ID ||
  process.env.NORTHFLANK_JOB_NAME ||
  process.env.HOSTNAME ||
  `stats-refresh-${process.pid}`;

type RobloxGameDetail = {
  id: number;
  created?: string;
  updated?: string;
  playing?: number;
  playerCount?: number;
  visits?: number;
  favorites?: number;
  favoriteCount?: number;
  favoritedCount?: number;
  likes?: number;
  upVotes?: number;
  downVotes?: number;
  totalUpVotes?: number;
  totalDownVotes?: number;
  votes?: { upVotes?: number; downVotes?: number };
};

type RobloxGameVote = {
  id: number;
  upVotes?: number;
  downVotes?: number;
};

type UniverseRow = {
  universe_id: number;
  root_place_id: number | null;
  slug: string | null;
  playing: number | null;
  visits: number | null;
  favorites: number | null;
  likes: number | null;
  dislikes: number | null;
  created_at_api: string | null;
  updated_at_api: string | null;
  stats_tier: StatsTier | null;
  last_stats_refreshed_at: string | null;
  last_seen_in_search: string | null;
  last_seen_in_sort: string | null;
  stats_refresh_attempt_count: number | null;
};

type HourlyRow = {
  universe_id: number;
  hour_start: string;
  avg_playing: number | null;
  peak_playing: number | null;
  min_playing: number | null;
  visits_start: number | null;
  favorites_start: number | null;
  likes_start: number | null;
  dislikes_start: number | null;
  sample_count: number | null;
  first_sampled_at: string | null;
};

type PublicStats = {
  playing: number | null;
  visits: number | null;
  favorites: number | null;
  likes: number | null;
  dislikes: number | null;
  ratingPercent: number | null;
  createdAtApi: string | null;
  updatedAtApi: string | null;
  raw: RobloxGameDetail & { votesApi?: RobloxGameVote };
};

type Options = {
  limit: number;
  tier: StatsTier | "ALL";
  rollupToday: boolean;
  skipIndexRefresh: boolean;
  universeIds: number[];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readPositiveNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function compactIsoHour(date: Date): string {
  const next = new Date(date);
  next.setUTCMinutes(0, 0, 0);
  return next.toISOString();
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addHours(value: string, hours: number) {
  return new Date(new Date(value).getTime() + hours * 3_600_000).toISOString();
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

function ratingPercent(likes: number | null, dislikes: number | null): number | null {
  const up = likes ?? 0;
  const down = dislikes ?? 0;
  const total = up + down;
  if (total <= 0) return null;
  return Math.round((up / total) * 1000) / 10;
}

export function hasAnyFreshUniverseStat(stats: Pick<PublicStats, "playing" | "visits" | "favorites" | "likes" | "dislikes">) {
  return stats.playing != null || stats.visits != null || stats.favorites != null || stats.likes != null || stats.dislikes != null;
}

function delta(end: number | null, start: number | null): number | null {
  if (end == null || start == null) return null;
  return end - start;
}

function averageWithSample(existingAverage: number | null, existingCount: number, nextValue: number | null): number | null {
  if (nextValue == null) return existingAverage;
  if (existingAverage == null || existingCount <= 0) return nextValue;
  return (existingAverage * existingCount + nextValue) / (existingCount + 1);
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

export { isTransientDataApiFailure, runDataApiOperation } from "../shared/data-api-retry";

async function fetchRobloxJson(url: string, label: string): Promise<any> {
  for (let attempt = 0; attempt <= RETRY_LIMIT; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "user-agent": "BloxodesBot/1.0" }
      });
    } catch (error) {
      if (attempt >= RETRY_LIMIT) throw error;
      const delayMs = jitter(Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS));
      console.warn(`${label} request failed; retrying in ${Math.round(delayMs / 1000)}s`);
      await sleep(delayMs);
      continue;
    }
    if (res.ok) {
      return res.json();
    }
    const body = await res.text().catch(() => "");
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= RETRY_LIMIT) {
      throw new Error(`Failed to fetch ${label} (${res.status}): ${body.slice(0, 200)}`);
    }
    const delayMs = retryAfterMs(res.headers) ?? jitter(Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS));
    console.warn(`${label} returned ${res.status}; retrying in ${Math.round(delayMs / 1000)}s`);
    await sleep(delayMs);
  }
  throw new Error(`${label} failed after retries`);
}

export function universeClaimBatchSize(remaining: number, configuredSize = CLAIM_BATCH_SIZE) {
  const safeConfiguredSize = Math.max(1, Math.min(Math.floor(configuredSize), 500));
  if (!Number.isFinite(remaining) || remaining <= 0) return safeConfiguredSize;
  return Math.max(1, Math.min(Math.floor(remaining), safeConfiguredSize));
}

async function claimUniverseBatch(options: Options, requestedLimit: number, universeIds: number[] = []): Promise<UniverseRow[]> {
  const { data, error } = await supabaseAdmin().rpc("claim_roblox_universe_stats_rows", {
    p_worker_id: WORKER_ID,
    p_tier: options.tier,
    p_limit: universeClaimBatchSize(requestedLimit),
    p_lease_minutes: LEASE_MINUTES,
    p_universe_ids: universeIds.length ? universeIds : null
  });
  if (error) throw new Error(`Failed to claim universe stats rows: ${error.message}`);
  return (data ?? []) as UniverseRow[];
}

async function releaseUniverseLeases(universeIds: number[]) {
  if (!universeIds.length) return;
  for (let index = 0; index < universeIds.length; index += LEASE_CHUNK_SIZE) {
    const ids = universeIds.slice(index, index + LEASE_CHUNK_SIZE);
    try {
      await runDataApiOperation("Release universe stats leases", () =>
        supabaseAdmin().rpc("release_roblox_universe_stats_rows", {
          p_worker_id: WORKER_ID,
          p_universe_ids: ids,
          p_error: null,
          p_next_run_at: null
        })
      );
    } catch (error) {
      console.warn("Failed to release stats refresh leases:", error instanceof Error ? error.message : String(error));
    }
  }
}

async function markFailures(rows: UniverseRow[], error: unknown, retryAfterHours?: number) {
  if (!rows.length) return;
  const message = error instanceof Error ? error.message : String(error);
  const maxAttempts = Math.max(...rows.map((row) => row.stats_refresh_attempt_count ?? 1));
  const nextRunAt = addHours(
    new Date().toISOString(),
    retryAfterHours ?? Math.min(72, 2 ** Math.min(maxAttempts, 6))
  );
  for (let index = 0; index < rows.length; index += LEASE_CHUNK_SIZE) {
    const ids = rows.slice(index, index + LEASE_CHUNK_SIZE).map((row) => row.universe_id);
    await runDataApiOperation("Mark failed universe stats rows", () =>
      supabaseAdmin().rpc("release_roblox_universe_stats_rows", {
        p_worker_id: WORKER_ID,
        p_universe_ids: ids,
        p_error: message,
        p_next_run_at: nextRunAt
      })
    );
  }
}

async function markMissingResponses(rows: UniverseRow[]) {
  if (!rows.length) return;
  const nowIso = new Date().toISOString();
  const unavailable = rows.filter((row) => (row.stats_refresh_attempt_count ?? 1) >= 3);
  const unavailableIds = new Set(unavailable.map((row) => row.universe_id));
  const retry = rows.filter((row) => !unavailableIds.has(row.universe_id));
  for (const row of unavailable) {
    const updatePayload = {
      stats_tier: "COLD",
      stats_tier_reason: "game_details_unavailable",
      stats_tier_updated_at: nowIso
    };
    await runDataApiOperation(`Quarantine unavailable universe ${row.universe_id}`, () =>
      supabaseAdmin()
        .from("roblox_universes")
        .update(updatePayload)
        .eq("universe_id", row.universe_id)
        .eq("stats_refresh_locked_by", WORKER_ID)
    );
  }
  const missingError = new Error("Universe missing from successful Roblox game details response");
  await markFailures(retry, missingError);
  await markFailures(unavailable, missingError, 168);
}

async function fetchStats(universeIds: number[]): Promise<Record<number, PublicStats>> {
  const result: Record<number, PublicStats> = {};
  if (!universeIds.length) return result;
  const params = new URLSearchParams({ universeIds: universeIds.join(",") });
  const data = await fetchRobloxJson(`${GAME_DETAILS_API}?${params.toString()}`, "game details");
  let votesByUniverseId = new Map<number, RobloxGameVote>();
  try {
    const votesData = await fetchRobloxJson(`${GAME_VOTES_API}?${params.toString()}`, "game votes");
    const votes: RobloxGameVote[] = Array.isArray(votesData?.data) ? votesData.data : [];
    votesByUniverseId = new Map(votes.filter((vote) => typeof vote?.id === "number").map((vote) => [vote.id, vote]));
  } catch (error) {
    console.warn("Game votes request failed; continuing without fresh rating data:", (error as Error).message);
  }
  const entries: RobloxGameDetail[] = Array.isArray(data?.data) ? data.data : [];
  for (const entry of entries) {
    if (typeof entry?.id !== "number") continue;
    const vote = votesByUniverseId.get(entry.id);
    const likes = toNumber(vote?.upVotes ?? entry.likes ?? entry.upVotes ?? entry.votes?.upVotes ?? entry.totalUpVotes ?? null);
    const dislikes = toNumber(vote?.downVotes ?? entry.downVotes ?? entry.votes?.downVotes ?? entry.totalDownVotes ?? null);
    const playing = toNumber(entry.playing ?? entry.playerCount ?? null);
    const visits = toNumber(entry.visits ?? null);
    const favorites = toNumber(entry.favorites ?? entry.favoriteCount ?? entry.favoritedCount ?? null);
    result[entry.id] = {
      playing,
      visits,
      favorites,
      likes,
      dislikes,
      ratingPercent: ratingPercent(likes, dislikes),
      createdAtApi: normalizeTimestamp(entry.created),
      updatedAtApi: normalizeTimestamp(entry.updated),
      raw: vote ? { ...entry, votesApi: vote } : entry
    };
  }
  return result;
}

async function fetchExistingHourly(universeIds: number[], hourStart: string): Promise<Map<number, HourlyRow>> {
  if (!universeIds.length) return new Map();
  const { data } = await runDataApiOperation("Load existing universe hourly stats", () =>
    supabaseAdmin()
      .from("roblox_universe_stats_hourly")
      .select(
        "universe_id, hour_start, avg_playing, peak_playing, min_playing, visits_start, favorites_start, likes_start, dislikes_start, sample_count, first_sampled_at"
      )
      .eq("hour_start", hourStart)
      .in("universe_id", universeIds)
  );
  return new Map(((data ?? []) as HourlyRow[]).map((row) => [row.universe_id, row]));
}

function buildHourlyPayload(row: UniverseRow, stats: PublicStats, existing: HourlyRow | undefined, hourStart: string, sampledAt: string) {
  const sampleCount = Math.max(existing?.sample_count ?? 0, 0);
  const nextSampleCount = sampleCount + 1;
  const visitsStart = existing?.visits_start ?? stats.visits;
  const favoritesStart = existing?.favorites_start ?? stats.favorites;
  const likesStart = existing?.likes_start ?? stats.likes;
  const dislikesStart = existing?.dislikes_start ?? stats.dislikes;
  const avgPlaying = averageWithSample(existing?.avg_playing ?? null, sampleCount, stats.playing);
  return {
    universe_id: row.universe_id,
    hour_start: hourStart,
    playing: stats.playing,
    avg_playing: avgPlaying,
    peak_playing:
      stats.playing == null && existing?.peak_playing == null
        ? null
        : Math.max(stats.playing ?? Number.NEGATIVE_INFINITY, existing?.peak_playing ?? Number.NEGATIVE_INFINITY),
    min_playing:
      stats.playing == null && existing?.min_playing == null
        ? null
        : Math.min(stats.playing ?? Number.POSITIVE_INFINITY, existing?.min_playing ?? Number.POSITIVE_INFINITY),
    visits: stats.visits,
    visits_start: visitsStart,
    visits_end: stats.visits,
    visit_delta: delta(stats.visits, visitsStart),
    favorites: stats.favorites,
    favorites_start: favoritesStart,
    favorites_end: stats.favorites,
    favorite_delta: delta(stats.favorites, favoritesStart),
    likes: stats.likes,
    likes_start: likesStart,
    likes_end: stats.likes,
    like_delta: delta(stats.likes, likesStart),
    dislikes: stats.dislikes,
    dislikes_start: dislikesStart,
    dislikes_end: stats.dislikes,
    dislike_delta: delta(stats.dislikes, dislikesStart),
    rating_percent: stats.ratingPercent,
    sample_count: nextSampleCount,
    first_sampled_at: existing?.first_sampled_at ?? sampledAt,
    last_sampled_at: sampledAt,
    snapshot: {
      source: "games_api",
      sampled_at: sampledAt,
      raw: stats.raw
    }
  };
}

type ChunkWriteResult = {
  attempted: number;
  updated: number;
  missing: number;
  hourlyRows: number;
  updateEvents: number;
  detailEvents: RevalidationEvent[];
};

function shouldRevalidateDetail(row: UniverseRow, stats: PublicStats) {
  if (!row.slug) return false;
  const latestPlaying = stats.playing ?? row.playing ?? 0;
  const previousPlaying = row.playing ?? 0;
  const playingChanged = stats.playing != null && Math.abs(stats.playing - previousPlaying) >= 100;
  const updatedAtChanged =
    stats.updatedAtApi != null &&
    row.updated_at_api != null &&
    Date.parse(stats.updatedAtApi) > Date.parse(row.updated_at_api);
  return latestPlaying >= 1000 || playingChanged || updatedAtChanged;
}

async function writeChunk(chunk: UniverseRow[], values: Record<number, PublicStats>, sampledAt: Date): Promise<ChunkWriteResult> {
  const sb = supabaseAdmin();
  const sampledAtIso = sampledAt.toISOString();
  const hourStart = compactIsoHour(sampledAt);
  const existingHourly = await fetchExistingHourly(chunk.map((row) => row.universe_id), hourStart);
  const hourlyPayloads = [];
  const updateEventPayloads = [];
  const detailEvents: RevalidationEvent[] = [];
  const missingRows = chunk.filter((row) => !values[row.universe_id]);
  const emptyRows = chunk.filter((row) => {
    const stats = values[row.universe_id];
    return stats != null && !hasAnyFreshUniverseStat(stats);
  });
  await markMissingResponses(missingRows);
  await markFailures(emptyRows, new Error("Roblox game details response contained no usable stats"));
  let updated = 0;
  for (const row of chunk) {
    const stats = values[row.universe_id];
    if (!stats) continue;
    if (!hasAnyFreshUniverseStat(stats)) continue;
    hourlyPayloads.push(buildHourlyPayload(row, stats, existingHourly.get(row.universe_id), hourStart, sampledAtIso));
    if (shouldRevalidateDetail(row, stats) && detailEvents.length < DETAIL_REVALIDATION_LIMIT) {
      detailEvents.push({ type: "stats", slug: `games/${row.slug}` });
    }
    const latest = {
      playing: stats.playing ?? row.playing,
      visits: stats.visits ?? row.visits,
      favorites: stats.favorites ?? row.favorites,
      likes: stats.likes ?? row.likes,
      dislikes: stats.dislikes ?? row.dislikes
    };
    const tier = assignStatsTier({
      playing: latest.playing,
      visits: latest.visits,
      lastStatsRefreshedAt: sampledAtIso
    });
    const updatePayload: Record<string, unknown> = {
      stats_tier: tier.tier,
      stats_tier_reason: tier.reason,
      stats_tier_updated_at: sampledAtIso,
      last_stats_refreshed_at: sampledAtIso,
      next_stats_refresh_at: addHours(sampledAtIso, tier.refreshHours),
      stats_refresh_locked_at: null,
      stats_refresh_locked_by: null,
      stats_refresh_attempt_count: 0,
      last_stats_refresh_error: null
    };
    if (!row.created_at_api && stats.createdAtApi) updatePayload.created_at_api = stats.createdAtApi;
    if (!row.updated_at_api && stats.updatedAtApi) updatePayload.updated_at_api = stats.updatedAtApi;
    const previousUpdatedAt = normalizeTimestamp(row.updated_at_api);
    const nextUpdatedAt = stats.updatedAtApi;
    if (nextUpdatedAt && previousUpdatedAt && Date.parse(nextUpdatedAt) > Date.parse(previousUpdatedAt)) {
      updatePayload.updated_at_api = nextUpdatedAt;
      updateEventPayloads.push({
        universe_id: row.universe_id,
        previous_updated_at_api: previousUpdatedAt,
        updated_at_api: nextUpdatedAt,
        detected_at: sampledAtIso,
        sampled_at: sampledAtIso,
        source: "update-universe-hourly-stats",
        label: "Game updated",
        stats_tier: tier.tier,
        playing: latest.playing,
        visits: latest.visits,
        favorites: latest.favorites,
        likes: latest.likes,
        dislikes: latest.dislikes,
        rating_percent: stats.ratingPercent,
        raw_game_json: stats.raw
      });
    }
    if (stats.playing != null) {
      updatePayload.playing = stats.playing;
      updatePayload.last_playing_refreshed_at = sampledAtIso;
    }
    if (stats.visits != null) updatePayload.visits = stats.visits;
    if (stats.favorites != null) updatePayload.favorites = stats.favorites;
    if (stats.likes != null) updatePayload.likes = stats.likes;
    if (stats.dislikes != null) updatePayload.dislikes = stats.dislikes;
    await runDataApiOperation(`Update latest stats for ${row.universe_id}`, () =>
      sb
        .from("roblox_universes")
        .update(updatePayload)
        .eq("universe_id", row.universe_id)
        .eq("stats_refresh_locked_by", WORKER_ID)
        .limit(1)
    );
    updated += 1;
  }
  if (hourlyPayloads.length) {
    await runDataApiOperation("Upsert universe hourly stats", () =>
      sb.from("roblox_universe_stats_hourly").upsert(hourlyPayloads, { onConflict: "universe_id,hour_start" })
    );
  }
  if (updateEventPayloads.length) {
    await runDataApiOperation("Upsert universe update events", () =>
      sb.from("roblox_universe_update_events").upsert(updateEventPayloads, { onConflict: "universe_id,updated_at_api" })
    );
  }
  return {
    attempted: chunk.length,
    updated,
    missing: missingRows.length + emptyRows.length,
    hourlyRows: hourlyPayloads.length,
    updateEvents: updateEventPayloads.length,
    detailEvents
  };
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    limit: Number.isFinite(DEFAULT_LIMIT) && DEFAULT_LIMIT > 0 ? DEFAULT_LIMIT : 0,
    tier: isStatsTier(process.env.UNIVERSE_STATS_TIER) ? process.env.UNIVERSE_STATS_TIER : "HOT",
    rollupToday: false,
    skipIndexRefresh: false,
    universeIds: []
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--limit" || arg === "-l") {
      const parsed = Number(args[i + 1]);
      options.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      i += 1;
    } else if (arg === "--universe-id" || arg === "--universe-ids") {
      const raw = String(args[i + 1] ?? "");
      const ids = raw
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isSafeInteger(value) && value > 0);
      if (!ids.length) throw new Error(`Invalid ${arg} value: ${raw}`);
      options.universeIds.push(...ids);
      i += 1;
    } else if (arg.startsWith("--universe-id=") || arg.startsWith("--universe-ids=")) {
      const raw = arg.slice(arg.indexOf("=") + 1);
      const ids = raw
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isSafeInteger(value) && value > 0);
      if (!ids.length) throw new Error(`Invalid universe id value: ${raw}`);
      options.universeIds.push(...ids);
    } else if (arg === "--tier") {
      const tier = String(args[i + 1] ?? "").toUpperCase();
      if (tier === "ALL" || isStatsTier(tier)) {
        options.tier = tier;
      } else {
        throw new Error(`Invalid --tier value: ${tier}. Use NEW, HOT, WARM, COLD, or ALL.`);
      }
      i += 1;
    } else if (arg === "--all") {
      options.tier = "ALL";
    } else if (arg === "--quality-only") {
      options.tier = "HOT";
    } else if (arg === "--rollup-today") {
      options.rollupToday = true;
    } else if (arg === "--skip-index-refresh") {
      options.skipIndexRefresh = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npm run update:hourly-stats -- [options]

Options:
  -l, --limit <number>   Max universes to refresh; 0 means all (default: ${DEFAULT_LIMIT})
  --tier <tier>          Refresh NEW, HOT, WARM, COLD, or ALL rows (default: HOT)
  --universe-id <id>     Refresh one universe ID; can repeat or accept comma-separated IDs
  --all                  Refresh all universes with a root place id
  --rollup-today         Also run the daily rollup for today's date after hourly writes
  --skip-index-refresh   Leave current-index rebuilding to the dedicated serialized job
  -h, --help             Show this help text
`);
      process.exit(0);
    }
  }
  return options;
}

async function rollupTodayIfRequested(options: Options, sampledAt: Date) {
  if (!options.rollupToday) return;
  const { main } = await import("./rollup-universe-daily-stats");
  await main({ date: isoDate(sampledAt), finalize: false, limit: options.limit });
}

async function refreshStatsIndexes() {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.rpc("refresh_stats_current_indexes_serialized");
    if (error) throw error;
    return (data ?? {}) as Record<string, unknown>;
  } catch (error) {
    console.warn("Failed to refresh stats current indexes:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function main() {
  const options = parseArgs();
  const run = await startStatsJobRun({
    jobName: `stats_refresh_${options.tier.toString().toLowerCase()}`,
    metadata: {
      tier: options.tier,
      limit: options.limit,
      rollup_today: options.rollupToday,
      skip_index_refresh: options.skipIndexRefresh,
      claim_batch_size: CLAIM_BATCH_SIZE,
      universe_ids: options.universeIds
    }
  });
  let latestSampledAt = new Date();
  let activeClaim: UniverseRow[] = [];
  let claimedRows = 0;
  let updatedRows = 0;
  let failedRows = 0;
  let hourlyRows = 0;
  let updateEvents = 0;
  let claimBatches = 0;
  const detailEvents: RevalidationEvent[] = [];
  const pipelineLeaseName = statsPipelineLeaseName(["universe-refresh", options.tier]);
  let pipelineLeaseAcquired = false;

  try {
    pipelineLeaseAcquired = await claimStatsPipelineLease({
      leaseName: pipelineLeaseName,
      workerId: WORKER_ID,
      leaseMinutes: PIPELINE_LEASE_MINUTES
    });
    if (!pipelineLeaseAcquired) {
      console.log(`Skipping ${options.tier} refresh because another worker holds ${pipelineLeaseName}.`);
      await finishStatsJobRun(run, { status: "skipped", metadata: { reason: "pipeline_lease_busy", pipeline_lease: pipelineLeaseName } });
      return;
    }

    const explicitIds = [...new Set(options.universeIds)];
    let explicitOffset = 0;
    while (true) {
      const remaining = options.limit > 0 ? options.limit - claimedRows : Number.POSITIVE_INFINITY;
      if (remaining <= 0) break;

      let requestedIds: number[] = [];
      if (explicitIds.length) {
        requestedIds = explicitIds.slice(explicitOffset, explicitOffset + universeClaimBatchSize(remaining));
        explicitOffset += requestedIds.length;
        if (!requestedIds.length) break;
      }

      const requestedClaimSize = universeClaimBatchSize(explicitIds.length ? requestedIds.length : remaining);
      activeClaim = (await claimUniverseBatch(options, requestedClaimSize, requestedIds)).filter(
        (row) => typeof row.universe_id === "number" && typeof row.root_place_id === "number" && row.root_place_id > 0
      );
      if (!activeClaim.length) {
        if (explicitIds.length && explicitOffset < explicitIds.length) continue;
        break;
      }

      claimBatches += 1;
      const claimedBatchSize = activeClaim.length;
      claimedRows += claimedBatchSize;
      console.log(`Claimed batch ${claimBatches}: ${claimedBatchSize} universes (tier=${options.tier}, total=${claimedRows}).`);

      try {
        for (let i = 0; i < activeClaim.length; i += BATCH_SIZE) {
          const chunk = activeClaim.slice(i, i + BATCH_SIZE);
          const ids = chunk.map((row) => row.universe_id);
          latestSampledAt = new Date();
          try {
            const statsMap = await fetchStats(ids);
            const result = await writeChunk(chunk, statsMap, latestSampledAt);
            updatedRows += result.updated;
            failedRows += result.missing;
            hourlyRows += result.hourlyRows;
            updateEvents += result.updateEvents;
            for (const event of result.detailEvents) {
              if (detailEvents.length < DETAIL_REVALIDATION_LIMIT) detailEvents.push(event);
            }
            console.log(`  - Updated chunk ${i / BATCH_SIZE + 1} (${result.updated}/${chunk.length} universes)`);
          } catch (error) {
            failedRows += chunk.length;
            await markFailures(chunk, error);
            console.error(`Chunk ${i / BATCH_SIZE + 1} failed:`, error instanceof Error ? error.message : String(error));
          }
          await sleep(REQUEST_DELAY_MS);
        }
      } finally {
        await releaseUniverseLeases(activeClaim.map((row) => row.universe_id));
        activeClaim = [];
      }

      if (!explicitIds.length && claimedBatchSize < requestedClaimSize) break;
    }

    if (!claimedRows) {
      console.log("No universes found.");
      await finishStatsJobRun(run, { status: "skipped", metadata: { reason: "no_universes", claim_batches: claimBatches } });
      return;
    }

    await rollupTodayIfRequested(options, latestSampledAt);

    const indexResult = updatedRows > 0 && !options.skipIndexRefresh ? await refreshStatsIndexes() : null;
    const revalidationEvents: RevalidationEvent[] =
      updatedRows > 0
        ? [
            { type: "stats", slug: "stats" },
            { type: "stats", slug: "games" },
            ...detailEvents
          ]
        : [];
    const queued = revalidationEvents.length
      ? await enqueueRevalidationEvents(revalidationEvents, `stats_refresh_${options.tier.toString().toLowerCase()}`)
      : { queued: 0, events: [] as string[] };

    await finishStatsJobRun(run, {
      status: failedRows > 0 ? "partial" : "success",
      rowsClaimed: claimedRows,
      rowsSucceeded: updatedRows,
      rowsFailed: failedRows,
      metadata: {
        hourly_rows: hourlyRows,
        claim_batches: claimBatches,
        update_events: updateEvents,
        detail_revalidation_events: detailEvents.length,
        queued_revalidation_events: queued.events,
        index_result: indexResult
      }
    });

    console.log(
      `Done. Updated ${updatedRows}/${claimedRows} universes across ${claimBatches} claim batches, wrote ${hourlyRows} hourly rows, queued ${queued.queued} revalidation events.`
    );
  } catch (error) {
    await finishStatsJobRun(run, {
      status: "failed",
      rowsClaimed: claimedRows,
      rowsSucceeded: updatedRows,
      rowsFailed: failedRows,
      error
    });
    throw error;
  } finally {
    await releaseUniverseLeases(activeClaim.map((row) => row.universe_id));
    if (pipelineLeaseAcquired) {
      await releaseStatsPipelineLease({ leaseName: pipelineLeaseName, workerId: WORKER_ID });
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
