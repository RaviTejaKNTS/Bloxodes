import "../shared/load-env";

import fs from "node:fs/promises";
import { URL } from "node:url";
import { GAME_COLLECTION_GROUPS } from "@/lib/game-collections";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { repoPath } from "@/lib/paths";
import { articleGameSlugFromUniverse, statsUniverseSlug } from "@/lib/slug";

const DEFAULT_MIN_CCU = 15_000;
const DEFAULT_LIMIT = 10;
const DEFAULT_MAX_POOL = 5_000;
const PAGE_SIZE = 1_000;
const SUPABASE_IN_CHUNK_SIZE = 500;
const BASELINE_HOURS = 6;
const BASELINE_TOLERANCE_MS = 90 * 60 * 1000;
const PROGRESS_PATH = repoPath("Writing plans", "wiki-pages-progress.md");

type Options = {
  minCcu: number;
  limit: number;
  maxPool: number;
  progressPath: string;
  json: boolean;
};

type GameRow = {
  universe_id: number;
  root_place_id: number | null;
  name: string | null;
  display_name: string | null;
  slug: string | null;
  creator_name: string | null;
  genre_l1: string | null;
  genre_l2: string | null;
  icon_url: string | null;
  playing: number | null;
  visits: number | null;
  global_playing_rank?: number | null;
  indexed_at?: string | null;
  last_playing_refreshed_at?: string | null;
};

type WikiPageRow = {
  universe_id: number | null;
  slug: string | null;
  title: string | null;
};

type WikiCollectionPageRow = {
  universe_id: number | null;
  wiki_slug: string | null;
  code: string | null;
  title: string | null;
};

type HourlyRow = {
  universe_id: number;
  hour_start: string;
  playing: number | null;
};

type ProgressState = {
  universeIds: Set<number>;
};

type Candidate = {
  game: GameRow;
  wikiSlug: string;
  statsSlug: string;
  baselinePlaying: number;
  baselineAt: string;
  growth6h: number;
  growth6hPercent: number | null;
};

function usage() {
  console.log(`Usage: npm run discover:wiki-candidates -- [options]

Find read-only Bloxodes wiki candidates from production stats data.

Options:
  --min-ccu <number>        Minimum current CCU. Default: ${DEFAULT_MIN_CCU}
  --limit <number>          Number of candidates to print. Default: ${DEFAULT_LIMIT}
  --max-pool <number>       Max games to scan after min-CCU filter. Default: ${DEFAULT_MAX_POOL}
  --progress <path>         Progress ledger path. Default: Writing plans/wiki-pages-progress.md
  --json                    Print JSON only
  --help                    Show this message
`);
}

function readPositiveInteger(value: string | undefined, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return Math.floor(parsed);
}

function parseArgs(argv: string[]): Options | null {
  const options: Options = {
    minCcu: DEFAULT_MIN_CCU,
    limit: DEFAULT_LIMIT,
    maxPool: DEFAULT_MAX_POOL,
    progressPath: PROGRESS_PATH,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
      case "-h":
        usage();
        return null;
      case "--min-ccu":
        options.minCcu = readPositiveInteger(argv[++i], arg);
        break;
      case "--limit":
        options.limit = readPositiveInteger(argv[++i], arg);
        break;
      case "--max-pool":
        options.maxPool = readPositiveInteger(argv[++i], arg);
        break;
      case "--progress":
        options.progressPath = argv[++i];
        if (!options.progressPath) throw new Error(`${arg} requires a path.`);
        break;
      case "--json":
        options.json = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function splitMarkdownRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

async function readProgressState(progressPath: string): Promise<ProgressState> {
  const state: ProgressState = { universeIds: new Set() };
  let text = "";
  try {
    text = await fs.readFile(progressPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return state;
    throw error;
  }

  const lines = text.split(/\r?\n/).filter((line) => line.trim().startsWith("|"));
  const headerIndex = lines.findIndex((line) => /universe id/i.test(line) && /\bslug\b/i.test(line));
  if (headerIndex === -1) return state;

  const headers = splitMarkdownRow(lines[headerIndex]).map((cell) => cell.toLowerCase());
  const universeIndex = headers.indexOf("universe id");

  for (const line of lines.slice(headerIndex + 1)) {
    if (/^\|\s*-+/.test(line)) continue;
    const cells = splitMarkdownRow(line);
    const rawUniverseId = universeIndex >= 0 ? cells[universeIndex] : "";
    const universeId = Number(rawUniverseId.replace(/,/g, ""));
    if (Number.isFinite(universeId) && universeId > 0) state.universeIds.add(Math.floor(universeId));
  }

  return state;
}

async function fetchGameRows(options: Options): Promise<GameRow[]> {
  const rows: GameRow[] = [];
  let offset = 0;

  while (rows.length < options.maxPool) {
    const remaining = options.maxPool - rows.length;
    const pageSize = Math.min(PAGE_SIZE, remaining);
    const { data, error } = await supabaseAdmin()
      .from("stats_game_current_index")
      .select(
        `
        universe_id, root_place_id, name, display_name, slug, creator_name,
        genre_l1, genre_l2, icon_url, playing, visits, global_playing_rank,
        indexed_at, last_playing_refreshed_at
      `
      )
      .gte("playing", options.minCcu)
      .not("slug", "is", null)
      .order("playing", { ascending: false, nullsFirst: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      if (error.code !== "42P01") throw error;
      return fetchGameRowsFallback(options);
    }

    const chunk = (data ?? []) as GameRow[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function fetchGameRowsFallback(options: Options): Promise<GameRow[]> {
  const rows: GameRow[] = [];
  let offset = 0;

  while (rows.length < options.maxPool) {
    const remaining = options.maxPool - rows.length;
    const pageSize = Math.min(PAGE_SIZE, remaining);
    const { data, error } = await supabaseAdmin()
      .from("roblox_universes")
      .select(
        `
        universe_id, root_place_id, name, display_name, slug, creator_name,
        genre_l1, genre_l2, icon_url, playing, visits, last_playing_refreshed_at
      `
      )
      .gte("playing", options.minCcu)
      .not("slug", "is", null)
      .order("playing", { ascending: false, nullsFirst: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    const chunk = (data ?? []) as GameRow[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function fetchExistingWikiPages(): Promise<WikiPageRow[]> {
  const { data, error } = await supabaseAdmin().from("wiki_pages").select("universe_id, slug, title");
  if (error) throw error;
  return (data ?? []) as WikiPageRow[];
}

async function fetchExistingWikiCollectionPages(): Promise<WikiCollectionPageRow[]> {
  const { data, error } = await supabaseAdmin().from("wiki_collection_pages").select("universe_id, wiki_slug, code, title");
  if (error) throw error;
  return (data ?? []) as WikiCollectionPageRow[];
}

async function fetchBaselineRows(universeIds: number[], targetIso: string): Promise<HourlyRow[]> {
  const rows: HourlyRow[] = [];
  const targetMs = Date.parse(targetIso);
  const startIso = new Date(targetMs - BASELINE_TOLERANCE_MS).toISOString();
  const endIso = new Date(targetMs + BASELINE_TOLERANCE_MS).toISOString();

  for (let i = 0; i < universeIds.length; i += SUPABASE_IN_CHUNK_SIZE) {
    const ids = universeIds.slice(i, i + SUPABASE_IN_CHUNK_SIZE);
    let offset = 0;
    while (true) {
      const { data, error } = await supabaseAdmin()
        .from("roblox_universe_stats_hourly")
        .select("universe_id, hour_start, playing")
        .in("universe_id", ids)
        .gte("hour_start", startIso)
        .lte("hour_start", endIso)
        .order("hour_start", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      const chunk = (data ?? []) as HourlyRow[];
      rows.push(...chunk);
      if (chunk.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }

  return rows;
}

function closestBaseline(rows: HourlyRow[], targetMs: number): HourlyRow | null {
  return rows.reduce<HourlyRow | null>((best, row) => {
    if (row.playing == null) return best;
    const time = Date.parse(row.hour_start);
    if (!Number.isFinite(time)) return best;
    if (!best) return row;
    const bestTime = Date.parse(best.hour_start);
    return Math.abs(time - targetMs) < Math.abs(bestTime - targetMs) ? row : best;
  }, null);
}

function percentChange(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 10_000) / 100;
}

function buildCandidates(games: GameRow[], baselineRows: HourlyRow[], targetIso: string): Candidate[] {
  const targetMs = Date.parse(targetIso);
  const baselineByUniverse = new Map<number, HourlyRow[]>();
  for (const row of baselineRows) {
    baselineByUniverse.set(row.universe_id, [...(baselineByUniverse.get(row.universe_id) ?? []), row]);
  }

  return games
    .map((game) => {
      const currentPlaying = game.playing ?? 0;
      const baseline = closestBaseline(baselineByUniverse.get(game.universe_id) ?? [], targetMs);
      if (!baseline?.playing) return null;
      const wikiSlug = articleGameSlugFromUniverse(game);
      const statsSlug = game.slug ?? statsUniverseSlug(game.display_name ?? game.name, game.universe_id);
      return {
        game,
        wikiSlug,
        statsSlug,
        baselinePlaying: baseline.playing,
        baselineAt: baseline.hour_start,
        growth6h: currentPlaying - baseline.playing,
        growth6hPercent: percentChange(currentPlaying, baseline.playing)
      };
    })
    .filter((candidate): candidate is Candidate => Boolean(candidate))
    .filter((candidate) => candidate.growth6h > 0)
    .sort((a, b) => {
      const growthDelta = b.growth6h - a.growth6h;
      if (growthDelta !== 0) return growthDelta;
      return (b.game.playing ?? 0) - (a.game.playing ?? 0);
    });
}

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US") : "";
}

function formatPercent(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}%` : "";
}

function markdownEscape(value: string | null | undefined) {
  return (value ?? "").replace(/\|/g, "\\|").trim();
}

function robloxUrl(game: GameRow) {
  return game.root_place_id ? `https://www.roblox.com/games/${game.root_place_id}` : "";
}

function publicCandidate(candidate: Candidate) {
  const gameName = candidate.game.display_name || candidate.game.name || `Universe ${candidate.game.universe_id}`;
  return {
    game: gameName,
    suggested_wiki_slug: candidate.wikiSlug,
    universe_id: candidate.game.universe_id,
    root_place_id: candidate.game.root_place_id,
    current_ccu: candidate.game.playing,
    baseline_ccu_6h: candidate.baselinePlaying,
    baseline_at: candidate.baselineAt,
    growth_6h: candidate.growth6h,
    growth_6h_percent: candidate.growth6hPercent,
    stats_slug: candidate.statsSlug,
    stats_url: `/stats/games/${candidate.statsSlug}`,
    roblox_url: robloxUrl(candidate.game),
    creator_name: candidate.game.creator_name,
    genre: candidate.game.genre_l1,
    subgenre: candidate.game.genre_l2,
    visits: candidate.game.visits,
    global_playing_rank: candidate.game.global_playing_rank ?? null,
    temp_workspace: `tmp/content-workspace/${candidate.wikiSlug}`
  };
}

function printMarkdown(candidates: Candidate[], options: Options, sourceHost: string, targetIso: string) {
  console.log(`# Wiki Candidate Discovery`);
  console.log("");
  console.log(`Supabase host: ${sourceHost}`);
  console.log(`Minimum CCU: ${formatNumber(options.minCcu)}`);
  console.log(`6h baseline target: ${targetIso}`);
  console.log("");
  console.log(
    "| Game | Slug | Universe ID | CCU | 6h Growth | 6h Growth % | Stats URL | Roblox URL | Temp Workspace |"
  );
  console.log("| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |");
  for (const candidate of candidates) {
    const row = publicCandidate(candidate);
    console.log(
      [
        markdownEscape(row.game),
        markdownEscape(row.suggested_wiki_slug),
        String(row.universe_id),
        formatNumber(row.current_ccu),
        formatNumber(row.growth_6h),
        formatPercent(row.growth_6h_percent),
        markdownEscape(row.stats_url),
        markdownEscape(row.roblox_url),
        markdownEscape(row.temp_workspace)
      ].join(" | ").replace(/^/, "| ") + " |"
    );
  }

  if (!candidates.length) {
    console.log("| No eligible candidates found |  |  |  |  |  |  |  |  |");
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options) return;

  const sourceUrl = process.env.SUPABASE_URL;
  if (!sourceUrl) throw new Error("SUPABASE_URL is not set.");
  const sourceHost = new URL(sourceUrl).host;

  const [progressState, games, wikiPages, wikiCollectionPages] = await Promise.all([
    readProgressState(options.progressPath),
    fetchGameRows(options),
    fetchExistingWikiPages(),
    fetchExistingWikiCollectionPages()
  ]);

  const coveredUniverseIds = new Set<number>();

  for (const row of wikiPages) {
    if (typeof row.universe_id === "number") coveredUniverseIds.add(row.universe_id);
  }
  for (const row of wikiCollectionPages) {
    if (typeof row.universe_id === "number") coveredUniverseIds.add(row.universe_id);
  }
  for (const group of GAME_COLLECTION_GROUPS) {
    if (typeof group.universeId === "number") coveredUniverseIds.add(group.universeId);
  }

  const filteredGames = games.filter((game) => {
    return (
      !coveredUniverseIds.has(game.universe_id) &&
      !progressState.universeIds.has(game.universe_id)
    );
  });

  const targetIso = new Date(Date.now() - BASELINE_HOURS * 60 * 60 * 1000).toISOString();
  const baselineRows = await fetchBaselineRows(
    filteredGames.map((game) => game.universe_id),
    targetIso
  );
  const candidates = buildCandidates(filteredGames, baselineRows, targetIso).slice(0, options.limit);
  const payload = {
    generated_at: new Date().toISOString(),
    supabase_host: sourceHost,
    min_ccu: options.minCcu,
    baseline_hours: BASELINE_HOURS,
    baseline_target: targetIso,
    progress_path: options.progressPath,
    scanned_games: games.length,
    eligible_after_exclusions: filteredGames.length,
    candidates: candidates.map(publicCandidate)
  };

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  printMarkdown(candidates, options, sourceHost, targetIso);
  console.log("");
  console.log("JSON:");
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
