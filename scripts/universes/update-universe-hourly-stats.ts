import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";

const GAME_DETAILS_API = "https://games.roblox.com/v1/games";
const BATCH_SIZE = readPositiveNumber("UNIVERSE_HOURLY_STATS_BATCH_SIZE", 50);
const DEFAULT_LIMIT = readPositiveNumber("UNIVERSE_HOURLY_STATS_LIMIT", 0);
const REQUEST_DELAY_MS = readPositiveNumber("UNIVERSE_HOURLY_STATS_REQUEST_DELAY_MS", 1000);
const RETRY_LIMIT = readPositiveNumber("UNIVERSE_HOURLY_STATS_RETRY_LIMIT", 5);
const RETRY_BASE_DELAY_MS = readPositiveNumber("UNIVERSE_HOURLY_STATS_RETRY_BASE_DELAY_MS", 5000);
const RETRY_MAX_DELAY_MS = readPositiveNumber("UNIVERSE_HOURLY_STATS_RETRY_MAX_DELAY_MS", 90000);

type RobloxGameDetail = {
  id: number;
  playing?: number;
  playerCount?: number;
  visits?: number;
  favorites?: number;
  favoriteCount?: number;
  likes?: number;
  upVotes?: number;
  downVotes?: number;
  votes?: { upVotes?: number; downVotes?: number };
};

type UniverseRow = {
  universe_id: number;
  root_place_id: number | null;
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
  raw: RobloxGameDetail;
};

type Options = {
  limit: number;
  qualityOnly: boolean;
  rollupToday: boolean;
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

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ratingPercent(likes: number | null, dislikes: number | null): number | null {
  const up = likes ?? 0;
  const down = dislikes ?? 0;
  const total = up + down;
  if (total <= 0) return null;
  return Math.round((up / total) * 1000) / 10;
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

async function fetchUniverses(options: Options): Promise<UniverseRow[]> {
  const sb = supabaseAdmin();
  const rows: UniverseRow[] = [];
  let from = 0;
  while (true) {
    if (options.limit > 0 && rows.length >= options.limit) break;
    const remaining = options.limit > 0 ? options.limit - rows.length : BATCH_SIZE;
    const pageSize = Math.min(BATCH_SIZE, remaining);
    let query = sb
      .from("roblox_universes")
      .select("universe_id, root_place_id")
      .not("root_place_id", "is", null);

    if (options.qualityOnly) {
      query = query.eq("is_quality_candidate", true);
    }

    const { data, error } = await query
      .order("last_stats_refreshed_at", { ascending: true, nullsFirst: true })
      .order("last_playing_refreshed_at", { ascending: true, nullsFirst: true })
      .order("quality_score", { ascending: false })
      .order("universe_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data ?? []) as UniverseRow[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function fetchStats(universeIds: number[]): Promise<Record<number, PublicStats>> {
  const result: Record<number, PublicStats> = {};
  if (!universeIds.length) return result;
  const params = new URLSearchParams({ universeIds: universeIds.join(",") });
  let data: any = null;
  for (let attempt = 0; attempt <= RETRY_LIMIT; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(`${GAME_DETAILS_API}?${params.toString()}`, {
        headers: { "user-agent": "BloxodesBot/1.0" }
      });
    } catch (error) {
      if (attempt >= RETRY_LIMIT) throw error;
      const delayMs = jitter(Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS));
      console.warn(`Game details request failed; retrying in ${Math.round(delayMs / 1000)}s`);
      await sleep(delayMs);
      continue;
    }
    if (res.ok) {
      data = await res.json();
      break;
    }
    const body = await res.text().catch(() => "");
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= RETRY_LIMIT) {
      throw new Error(`Failed to fetch game details (${res.status}): ${body.slice(0, 200)}`);
    }
    const delayMs = retryAfterMs(res.headers) ?? jitter(Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS));
    console.warn(`Game details returned ${res.status}; retrying in ${Math.round(delayMs / 1000)}s`);
    await sleep(delayMs);
  }
  const entries: RobloxGameDetail[] = Array.isArray(data?.data) ? data.data : [];
  for (const entry of entries) {
    if (typeof entry?.id !== "number") continue;
    const likes = toNumber(entry.likes ?? entry.upVotes ?? entry.votes?.upVotes ?? null);
    const dislikes = toNumber(entry.downVotes ?? entry.votes?.downVotes ?? null);
    const playing = toNumber(entry.playing ?? entry.playerCount ?? null);
    const visits = toNumber(entry.visits ?? null);
    const favorites = toNumber(entry.favorites ?? entry.favoriteCount ?? null);
    result[entry.id] = {
      playing,
      visits,
      favorites,
      likes,
      dislikes,
      ratingPercent: ratingPercent(likes, dislikes),
      raw: entry
    };
  }
  return result;
}

async function fetchExistingHourly(universeIds: number[], hourStart: string): Promise<Map<number, HourlyRow>> {
  if (!universeIds.length) return new Map();
  const { data, error } = await supabaseAdmin()
    .from("roblox_universe_stats_hourly")
    .select(
      "universe_id, hour_start, avg_playing, peak_playing, min_playing, visits_start, favorites_start, likes_start, dislikes_start, sample_count, first_sampled_at"
    )
    .eq("hour_start", hourStart)
    .in("universe_id", universeIds);
  if (error) throw error;
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

async function writeChunk(chunk: UniverseRow[], values: Record<number, PublicStats>, sampledAt: Date) {
  const sb = supabaseAdmin();
  const sampledAtIso = sampledAt.toISOString();
  const hourStart = compactIsoHour(sampledAt);
  const existingHourly = await fetchExistingHourly(chunk.map((row) => row.universe_id), hourStart);
  const hourlyPayloads = [];
  for (const row of chunk) {
    const stats = values[row.universe_id];
    if (!stats) continue;
    hourlyPayloads.push(buildHourlyPayload(row, stats, existingHourly.get(row.universe_id), hourStart, sampledAtIso));
    const { error } = await sb
      .from("roblox_universes")
      .update({
        playing: stats.playing,
        visits: stats.visits,
        favorites: stats.favorites,
        likes: stats.likes,
        dislikes: stats.dislikes,
        last_playing_refreshed_at: sampledAtIso,
        last_stats_refreshed_at: sampledAtIso
      })
      .eq("universe_id", row.universe_id)
      .limit(1);
    if (error) {
      throw new Error(`Failed to update latest stats for ${row.universe_id}: ${error.message}`);
    }
  }
  if (hourlyPayloads.length) {
    const { error } = await sb
      .from("roblox_universe_stats_hourly")
      .upsert(hourlyPayloads, { onConflict: "universe_id,hour_start" });
    if (error) {
      throw new Error(`Failed to upsert hourly stats: ${error.message}`);
    }
  }
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    limit: Number.isFinite(DEFAULT_LIMIT) && DEFAULT_LIMIT > 0 ? DEFAULT_LIMIT : 0,
    qualityOnly: process.env.UNIVERSE_HOURLY_STATS_QUALITY_ONLY !== "false",
    rollupToday: false
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--limit" || arg === "-l") {
      const parsed = Number(args[i + 1]);
      options.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      i += 1;
    } else if (arg === "--all") {
      options.qualityOnly = false;
    } else if (arg === "--quality-only") {
      options.qualityOnly = true;
    } else if (arg === "--rollup-today") {
      options.rollupToday = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npm run update:hourly-stats -- [options]

Options:
  -l, --limit <number>   Max universes to refresh; 0 means all (default: ${DEFAULT_LIMIT})
  --quality-only         Only refresh rows marked is_quality_candidate (default)
  --all                  Refresh all universes with a root place id
  --rollup-today         Also run the daily rollup for today's date after hourly writes
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
  await main({ date: isoDate(sampledAt), finalize: false, limit: options.limit, qualityOnly: options.qualityOnly });
}

async function main() {
  const options = parseArgs();
  const sampledAt = new Date();
  const universes = (await fetchUniverses(options)).filter(
    (row) => typeof row.universe_id === "number" && row.root_place_id !== null
  );
  if (!universes.length) {
    console.log("No universes found.");
    return;
  }

  console.log(`Updating hourly stats for ${universes.length} universes (qualityOnly=${options.qualityOnly})...`);
  for (let i = 0; i < universes.length; i += BATCH_SIZE) {
    const chunk = universes.slice(i, i + BATCH_SIZE);
    const ids = chunk.map((row) => row.universe_id);
    try {
      const statsMap = await fetchStats(ids);
      await writeChunk(chunk, statsMap, sampledAt);
      console.log(`  - Updated chunk ${i / BATCH_SIZE + 1} (${chunk.length} universes)`);
    } catch (error) {
      console.error(`Chunk ${i / BATCH_SIZE + 1} failed:`, (error as Error).message);
    }
    await sleep(REQUEST_DELAY_MS);
  }
  await rollupTodayIfRequested(options, sampledAt);
  console.log("Done.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
