import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_LIMIT = readPositiveNumber("UNIVERSE_DAILY_ROLLUP_LIMIT", 0);
const BATCH_SIZE = readPositiveNumber("UNIVERSE_DAILY_ROLLUP_BATCH_SIZE", 500);

type Options = {
  date: string;
  finalize: boolean;
  limit: number;
  qualityOnly: boolean;
};

type HourlyRow = {
  universe_id: number;
  playing: number | null;
  avg_playing: number | null;
  peak_playing: number | null;
  min_playing: number | null;
  visits_start: number | null;
  visits_end: number | null;
  favorites_start: number | null;
  favorites_end: number | null;
  likes_start: number | null;
  likes_end: number | null;
  dislikes_start: number | null;
  dislikes_end: number | null;
  rating_percent: number | null;
  sample_count: number | null;
  first_sampled_at: string | null;
  last_sampled_at: string | null;
};

type DailyRollup = {
  universe_id: number;
  stat_date: string;
  playing: number | null;
  visits: number | null;
  favorites: number | null;
  likes: number | null;
  dislikes: number | null;
  avg_playing: number | null;
  peak_playing: number | null;
  min_playing: number | null;
  visits_start: number | null;
  visits_end: number | null;
  visit_delta: number | null;
  favorites_start: number | null;
  favorites_end: number | null;
  favorite_delta: number | null;
  likes_start: number | null;
  likes_end: number | null;
  like_delta: number | null;
  dislikes_start: number | null;
  dislikes_end: number | null;
  dislike_delta: number | null;
  rating_start: number | null;
  rating_end: number | null;
  sample_count: number;
  is_finalized: boolean;
  finalized_at: string | null;
  snapshot: Record<string, unknown>;
  recorded_at: string;
};

function readPositiveNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function yesterdayIsoDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return isoDate(date);
}

function todayIsoDate() {
  return isoDate(new Date());
}

function parseDate(value: string): string {
  if (value === "today") return todayIsoDate();
  if (value === "yesterday") return yesterdayIsoDate();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  throw new Error(`Invalid --date value: ${value}. Use today, yesterday, or YYYY-MM-DD.`);
}

function nextDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return isoDate(parsed);
}

function numeric(values: Array<number | null | undefined>): number[] {
  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function max(values: Array<number | null | undefined>): number | null {
  const safe = numeric(values);
  return safe.length ? Math.max(...safe) : null;
}

function min(values: Array<number | null | undefined>): number | null {
  const safe = numeric(values);
  return safe.length ? Math.min(...safe) : null;
}

function average(values: Array<number | null | undefined>): number | null {
  const safe = numeric(values);
  if (!safe.length) return null;
  return safe.reduce((sum, value) => sum + value, 0) / safe.length;
}

function weightedAverage(rows: HourlyRow[]): number | null {
  let total = 0;
  let weight = 0;
  for (const row of rows) {
    if (row.avg_playing == null) continue;
    const sampleCount = Math.max(row.sample_count ?? 1, 1);
    total += row.avg_playing * sampleCount;
    weight += sampleCount;
  }
  return weight > 0 ? total / weight : null;
}

function delta(end: number | null, start: number | null): number | null {
  if (end == null || start == null) return null;
  return end - start;
}

function first<T>(values: T[]): T | null {
  return values.length ? values[0] : null;
}

function last<T>(values: T[]): T | null {
  return values.length ? values[values.length - 1] : null;
}

async function fetchHourlyRows(options: Options, offset: number): Promise<HourlyRow[]> {
  const sb = supabaseAdmin();
  const start = `${options.date}T00:00:00.000Z`;
  const end = `${nextDate(options.date)}T00:00:00.000Z`;
  let query = sb
    .from("roblox_universe_stats_hourly")
    .select(
      [
        "universe_id",
        "playing",
        "avg_playing",
        "peak_playing",
        "min_playing",
        "visits_start",
        "visits_end",
        "favorites_start",
        "favorites_end",
        "likes_start",
        "likes_end",
        "dislikes_start",
        "dislikes_end",
        "rating_percent",
        "sample_count",
        "first_sampled_at",
        "last_sampled_at",
        "universe:roblox_universes!inner(is_quality_candidate)"
      ].join(", ")
    )
    .gte("hour_start", start)
    .lt("hour_start", end)
    .order("universe_id", { ascending: true })
    .order("hour_start", { ascending: true })
    .range(offset, offset + BATCH_SIZE - 1);

  if (options.qualityOnly) {
    query = query.eq("universe.is_quality_candidate", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as HourlyRow[];
}

function rollupRows(universeId: number, rows: HourlyRow[], options: Options): DailyRollup {
  const visitsStart = first(rows.map((row) => row.visits_start).filter((value): value is number => value != null)) ?? null;
  const visitsEnd = last(rows.map((row) => row.visits_end).filter((value): value is number => value != null)) ?? null;
  const favoritesStart =
    first(rows.map((row) => row.favorites_start).filter((value): value is number => value != null)) ?? null;
  const favoritesEnd = last(rows.map((row) => row.favorites_end).filter((value): value is number => value != null)) ?? null;
  const likesStart = first(rows.map((row) => row.likes_start).filter((value): value is number => value != null)) ?? null;
  const likesEnd = last(rows.map((row) => row.likes_end).filter((value): value is number => value != null)) ?? null;
  const dislikesStart =
    first(rows.map((row) => row.dislikes_start).filter((value): value is number => value != null)) ?? null;
  const dislikesEnd = last(rows.map((row) => row.dislikes_end).filter((value): value is number => value != null)) ?? null;
  const peakPlaying = max(rows.map((row) => row.peak_playing ?? row.playing));
  const avgPlaying = weightedAverage(rows);
  const minPlaying = min(rows.map((row) => row.min_playing ?? row.playing));
  const ratingStart = first(rows.map((row) => row.rating_percent).filter((value): value is number => value != null)) ?? null;
  const ratingEnd = last(rows.map((row) => row.rating_percent).filter((value): value is number => value != null)) ?? null;
  const sampleCount = rows.reduce((sum, row) => sum + (row.sample_count ?? 0), 0);
  const recordedAt = new Date().toISOString();
  const finalizedAt = options.finalize ? recordedAt : null;

  return {
    universe_id: universeId,
    stat_date: options.date,
    playing: peakPlaying,
    visits: visitsEnd,
    favorites: favoritesEnd,
    likes: likesEnd,
    dislikes: dislikesEnd,
    avg_playing: avgPlaying,
    peak_playing: peakPlaying,
    min_playing: minPlaying,
    visits_start: visitsStart,
    visits_end: visitsEnd,
    visit_delta: delta(visitsEnd, visitsStart),
    favorites_start: favoritesStart,
    favorites_end: favoritesEnd,
    favorite_delta: delta(favoritesEnd, favoritesStart),
    likes_start: likesStart,
    likes_end: likesEnd,
    like_delta: delta(likesEnd, likesStart),
    dislikes_start: dislikesStart,
    dislikes_end: dislikesEnd,
    dislike_delta: delta(dislikesEnd, dislikesStart),
    rating_start: ratingStart,
    rating_end: ratingEnd,
    sample_count: sampleCount,
    is_finalized: options.finalize,
    finalized_at: finalizedAt,
    recorded_at: recordedAt,
    snapshot: {
      source: "hourly_rollup",
      finalized: options.finalize,
      rolled_up_at: recordedAt,
      hour_count: rows.length,
      sample_count: sampleCount,
      avg_playing: avgPlaying,
      peak_playing: peakPlaying,
      min_playing: minPlaying,
      visits_start: visitsStart,
      visits_end: visitsEnd,
      visit_delta: delta(visitsEnd, visitsStart),
      favorites_start: favoritesStart,
      favorites_end: favoritesEnd,
      favorite_delta: delta(favoritesEnd, favoritesStart),
      likes_start: likesStart,
      likes_end: likesEnd,
      like_delta: delta(likesEnd, likesStart),
      dislikes_start: dislikesStart,
      dislikes_end: dislikesEnd,
      dislike_delta: delta(dislikesEnd, dislikesStart),
      rating_start: ratingStart,
      rating_end: ratingEnd,
      playing: {
        peak: peakPlaying,
        average: avgPlaying,
        min: minPlaying
      },
      visits: {
        start: visitsStart,
        end: visitsEnd,
        delta: delta(visitsEnd, visitsStart)
      },
      favorites: {
        start: favoritesStart,
        end: favoritesEnd,
        delta: delta(favoritesEnd, favoritesStart)
      },
      likes: {
        start: likesStart,
        end: likesEnd,
        delta: delta(likesEnd, likesStart)
      },
      dislikes: {
        start: dislikesStart,
        end: dislikesEnd,
        delta: delta(dislikesEnd, dislikesStart)
      },
      rating: {
        start: ratingStart,
        end: ratingEnd,
        average: average(rows.map((row) => row.rating_percent))
      }
    }
  };
}

function groupByUniverse(rows: HourlyRow[]): Map<number, HourlyRow[]> {
  const groups = new Map<number, HourlyRow[]>();
  for (const row of rows) {
    const bucket = groups.get(row.universe_id) ?? [];
    bucket.push(row);
    groups.set(row.universe_id, bucket);
  }
  return groups;
}

async function writeRollups(rollups: DailyRollup[]) {
  if (!rollups.length) return;
  const { error } = await supabaseAdmin()
    .from("roblox_universe_stats_daily")
    .upsert(rollups, { onConflict: "universe_id,stat_date" });
  if (error) throw error;
}

export async function main(overrides?: Partial<Options>) {
  const parsed = parseArgs();
  const options: Options = { ...parsed, ...overrides };
  const allRollups: DailyRollup[] = [];
  let offset = 0;
  let carry: HourlyRow[] = [];
  while (true) {
    if (options.limit > 0 && allRollups.length >= options.limit) break;
    const pageRows = await fetchHourlyRows(options, offset);
    if (!pageRows.length) {
      if (carry.length && (options.limit <= 0 || allRollups.length < options.limit)) {
        allRollups.push(rollupRows(carry[0].universe_id, carry, options));
      }
      break;
    }

    const rows = [...carry, ...pageRows];
    const lastUniverseId = rows[rows.length - 1]?.universe_id;
    const couldContinue = pageRows.length === BATCH_SIZE;
    carry = [];
    const grouped = groupByUniverse(rows);
    for (const [universeId, group] of grouped) {
      if (options.limit > 0 && allRollups.length >= options.limit) break;
      if (couldContinue && universeId === lastUniverseId) {
        carry = group;
        continue;
      }
      allRollups.push(rollupRows(universeId, group, options));
    }
    if (pageRows.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  await writeRollups(allRollups);
  console.log(
    `Rolled up ${allRollups.length} daily rows for ${options.date} (finalize=${options.finalize}, qualityOnly=${options.qualityOnly}).`
  );
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    date: todayIsoDate(),
    finalize: false,
    limit: Number.isFinite(DEFAULT_LIMIT) && DEFAULT_LIMIT > 0 ? DEFAULT_LIMIT : 0,
    qualityOnly: false
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--date") {
      options.date = parseDate(args[i + 1] ?? "");
      i += 1;
    } else if (arg === "--finalize") {
      options.finalize = true;
    } else if (arg === "--limit" || arg === "-l") {
      const parsed = Number(args[i + 1]);
      options.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      i += 1;
    } else if (arg === "--quality-only") {
      options.qualityOnly = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npm run stats:rollup-daily -- [options]

Options:
  --date <today|yesterday|YYYY-MM-DD>  Date to roll up (default: today)
  --finalize                           Mark snapshot as finalized
  -l, --limit <number>                 Max universe rollups to write; 0 means all
  --quality-only                       Only roll up quality candidate universes
  -h, --help                           Show this help text
`);
      process.exit(0);
    }
  }
  return options;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
