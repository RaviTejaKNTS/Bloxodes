import "../shared/load-env";
import { supabaseAdmin } from "@/lib/supabase-admin";

const GAME_DETAILS_API = "https://games.roblox.com/v1/games";
const BATCH_SIZE = Number(process.env.UNIVERSE_STATS_BATCH_SIZE ?? "50");
const DEFAULT_LIMIT = Number(process.env.UNIVERSE_STATS_LIMIT ?? "0");
const REQUEST_DELAY_MS = Number(process.env.UNIVERSE_STATS_REQUEST_DELAY_MS ?? "1000");
const RETRY_LIMIT = Number(process.env.UNIVERSE_STATS_RETRY_LIMIT ?? "5");
const RETRY_BASE_DELAY_MS = Number(process.env.UNIVERSE_STATS_RETRY_BASE_DELAY_MS ?? "5000");
const RETRY_MAX_DELAY_MS = Number(process.env.UNIVERSE_STATS_RETRY_MAX_DELAY_MS ?? "90000");

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

type UniverseRow = { universe_id: number; root_place_id: number | null };

type Options = {
  limit: number;
  qualityOnly: boolean;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
      .order("last_stats_refreshed_at", { ascending: true })
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

async function fetchStats(universeIds: number[]): Promise<Record<number, { visits: number | null; favorites: number | null; likes: number | null; dislikes: number | null }>> {
  const result: Record<number, { visits: number | null; favorites: number | null; likes: number | null; dislikes: number | null }> = {};
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
      const delay = jitter(Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS));
      console.warn(`Game details request failed; retrying in ${Math.round(delay / 1000)}s`);
      await sleep(delay);
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
    const delay = retryAfterMs(res.headers) ?? jitter(Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS));
    console.warn(`Game details returned ${res.status}; retrying in ${Math.round(delay / 1000)}s`);
    await sleep(delay);
  }
  const entries: RobloxGameDetail[] = Array.isArray(data?.data) ? data.data : [];
  for (const entry of entries) {
    if (typeof entry?.id !== "number") continue;
    const likes =
      entry.likes ??
      entry.upVotes ??
      entry.votes?.upVotes ??
      null;
    const dislikes =
      entry.downVotes ??
      entry.votes?.downVotes ??
      null;
    const favorites = entry.favorites ?? entry.favoriteCount ?? null;
    const visits = entry.visits ?? null;
    result[entry.id] = {
      visits: typeof visits === "number" ? visits : null,
      favorites: typeof favorites === "number" ? favorites : null,
      likes: typeof likes === "number" ? likes : null,
      dislikes: typeof dislikes === "number" ? dislikes : null
    };
  }
  return result;
}

async function updateStats(chunk: UniverseRow[], values: Record<number, { visits: number | null; favorites: number | null; likes: number | null; dislikes: number | null }>) {
  const sb = supabaseAdmin();
  const refreshedAt = new Date().toISOString();
  for (const row of chunk) {
    const stats = values[row.universe_id] ?? {
      visits: null,
      favorites: null,
      likes: null,
      dislikes: null
    };
    const { error } = await sb
      .from("roblox_universes")
      .update({
        visits: stats.visits,
        favorites: stats.favorites,
        likes: stats.likes,
        dislikes: stats.dislikes,
        last_stats_refreshed_at: refreshedAt
      })
      .eq("universe_id", row.universe_id)
      .limit(1);
    if (error) {
      throw new Error(`Failed to update stats for ${row.universe_id}: ${error.message}`);
    }
  }
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    limit: Number.isFinite(DEFAULT_LIMIT) && DEFAULT_LIMIT > 0 ? DEFAULT_LIMIT : 0,
    qualityOnly: process.env.UNIVERSE_STATS_QUALITY_ONLY === "true"
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--limit" || arg === "-l") {
      const parsed = Number(args[i + 1]);
      options.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      i += 1;
    } else if (arg === "--quality-only") {
      options.qualityOnly = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npm run update:stats -- [options]

Options:
  -l, --limit <number>   Max universes to refresh; 0 means all (default: ${DEFAULT_LIMIT})
  --quality-only         Only refresh rows marked is_quality_candidate
  -h, --help             Show this help text
`);
      process.exit(0);
    }
  }
  return options;
}

async function main() {
  const options = parseArgs();
  const universes = (await fetchUniverses(options)).filter(
    (row) => typeof row.universe_id === "number" && row.root_place_id !== null
  );
  if (!universes.length) {
    console.log("No universes found.");
    return;
  }

  console.log(`Updating stats for ${universes.length} universes (qualityOnly=${options.qualityOnly})...`);
  for (let i = 0; i < universes.length; i += BATCH_SIZE) {
    const chunk = universes.slice(i, i + BATCH_SIZE);
    const ids = chunk.map((row) => row.universe_id);
    try {
      const statsMap = await fetchStats(ids);
      await updateStats(chunk, statsMap);
      console.log(`  • Updated chunk ${i / BATCH_SIZE + 1} (${chunk.length} universes)`);
    } catch (error) {
      console.error(`Chunk ${i / BATCH_SIZE + 1} failed:`, (error as Error).message);
    }
    await sleep(REQUEST_DELAY_MS);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
