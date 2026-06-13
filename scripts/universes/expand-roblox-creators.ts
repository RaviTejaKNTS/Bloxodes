import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";
import {
  fetchJson,
  insertNewUniverseCandidates,
  pickNumber,
  pickString,
  readPositiveNumber,
  readRecord,
  type FetchJsonOptions,
  type UniverseDiscoveryCandidate
} from "./discovery-utils";

const GROUP_GAMES_API = (groupId: number) => `https://games.roblox.com/v2/groups/${groupId}/gamesV2`;
const USER_GAMES_API = (userId: number) => `https://games.roblox.com/v2/users/${userId}/games`;

const REQUEST_OPTIONS: FetchJsonOptions = {
  userAgent: "BloxodesCreatorExpansionDiscovery/1.0",
  requestIntervalMs: readPositiveNumber("ROBLOX_CREATOR_EXPAND_REQUEST_INTERVAL_MS", 1200),
  retryLimit: readPositiveNumber("ROBLOX_CREATOR_EXPAND_RETRY_LIMIT", 5),
  retryBaseDelayMs: readPositiveNumber("ROBLOX_CREATOR_EXPAND_RETRY_BASE_DELAY_MS", 4000),
  retryMaxDelayMs: readPositiveNumber("ROBLOX_CREATOR_EXPAND_RETRY_MAX_DELAY_MS", 90000)
};

const DEFAULT_SEED_LIMIT = readPositiveNumber("ROBLOX_CREATOR_EXPAND_SEED_LIMIT", 500);
const DEFAULT_MAX_PAGES = readPositiveNumber("ROBLOX_CREATOR_EXPAND_MAX_PAGES", 2);
const CREATOR_GAMES_PAGE_LIMIT = clampCreatorGamesLimit(readPositiveNumber("ROBLOX_CREATOR_GAMES_PAGE_LIMIT", 50));

type CreatorSeed = {
  type: "group" | "user";
  id: number;
  name: string | null;
};

type UniverseCreatorRow = {
  creator_id: number | null;
  creator_type: string | null;
  creator_name: string | null;
  group_id: number | null;
  group_name: string | null;
};

type Options = {
  seedLimit: number;
  maxPages: number;
  dryRun: boolean;
};

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    seedLimit: Number.isFinite(DEFAULT_SEED_LIMIT) && DEFAULT_SEED_LIMIT > 0 ? DEFAULT_SEED_LIMIT : 500,
    maxPages: Number.isFinite(DEFAULT_MAX_PAGES) && DEFAULT_MAX_PAGES > 0 ? DEFAULT_MAX_PAGES : 2,
    dryRun: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--seed-limit" || arg === "--limit" || arg === "-l") {
      options.seedLimit = readCliPositiveInteger(args[i + 1], "seed-limit");
      i += 1;
    } else if (arg === "--max-pages") {
      options.maxPages = readCliPositiveInteger(args[i + 1], "max-pages");
      i += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function readCliPositiveInteger(value: string | undefined, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`--${label} must be a positive integer`);
  return parsed;
}

function printHelp() {
  console.log(`
Usage: npm run discover:universes:creators -- [options]

Discovers additional public games from creators/groups of existing HOT/WARM
universes and inserts only missing rows into roblox_universes as NEW.

Options:
  -l, --limit <n>       Creator seeds to inspect. Default ${DEFAULT_SEED_LIMIT}.
  --seed-limit <n>      Same as --limit.
  --max-pages <n>       Creator game pages per seed. Default ${DEFAULT_MAX_PAGES}.
  --dry-run             Fetch and report without inserting rows.
  -h, --help            Show this help text.
`);
}

function clampCreatorGamesLimit(value: number) {
  if (value <= 10) return 10;
  if (value <= 25) return 25;
  return 50;
}

function normalizeCreatorType(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function seedFromRow(row: UniverseCreatorRow): CreatorSeed | null {
  if (row.group_id) return { type: "group", id: row.group_id, name: row.group_name ?? row.creator_name };
  const creatorType = normalizeCreatorType(row.creator_type);
  if (creatorType === "group" && row.creator_id) {
    return { type: "group", id: row.creator_id, name: row.creator_name };
  }
  if (creatorType === "user" && row.creator_id) {
    return { type: "user", id: row.creator_id, name: row.creator_name };
  }
  return null;
}

async function fetchCreatorSeeds(limit: number) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_universes")
    .select("creator_id, creator_type, creator_name, group_id, group_name")
    .or("stats_tier.in.(HOT,WARM),playing.gte.100,visits.gte.10000000")
    .not("creator_id", "is", null)
    .order("playing", { ascending: false, nullsFirst: false })
    .order("visits", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`Failed to fetch creator seeds: ${error.message}`);

  const seeds = new Map<string, CreatorSeed>();
  for (const row of (data ?? []) as UniverseCreatorRow[]) {
    const seed = seedFromRow(row);
    if (!seed) continue;
    seeds.set(`${seed.type}:${seed.id}`, seed);
  }
  return Array.from(seeds.values());
}

function buildCreatorGamesUrl(seed: CreatorSeed, cursor: string | null) {
  const params = new URLSearchParams({
    accessFilter: "Public",
    sortOrder: "Asc",
    limit: String(CREATOR_GAMES_PAGE_LIMIT)
  });
  if (cursor) params.set("cursor", cursor);
  return seed.type === "group"
    ? `${GROUP_GAMES_API(seed.id)}?${params.toString()}`
    : `${USER_GAMES_API(seed.id)}?${params.toString()}`;
}

function candidateFromCreatorGame(value: unknown, seed: CreatorSeed, position: number): UniverseDiscoveryCandidate | null {
  const source = readRecord(value);
  if (!source) return null;
  const universeId = pickNumber(source, ["id", "universeId", "universe_id"]);
  if (!universeId) return null;
  const creator = readRecord(source.creator);

  return {
    universeId,
    rootPlaceId: pickNumber(source, ["rootPlaceId", "root_place_id", "placeId", "place_id"]),
    name: pickString(source, ["name", "displayName", "title"]),
    description: pickString(source, ["description"]),
    creatorId: creator ? pickNumber(creator, ["id", "creatorId"]) : seed.id,
    creatorName: creator ? pickString(creator, ["name", "creatorName", "username"]) : seed.name,
    creatorType: creator ? pickString(creator, ["type", "creatorType"]) : seed.type === "group" ? "Group" : "User",
    query: `${seed.type}:${seed.id}`,
    position,
    raw: source
  };
}

async function fetchCreatorCandidates(seed: CreatorSeed, maxPages: number) {
  const candidates = new Map<number, UniverseDiscoveryCandidate>();
  let cursor: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const raw = await fetchJson(buildCreatorGamesUrl(seed, cursor), `${seed.type}:${seed.id}`, REQUEST_OPTIONS);
    const rows = Array.isArray(raw.data) ? raw.data : [];
    rows.forEach((row, index) => {
      const candidate = candidateFromCreatorGame(row, seed, page * CREATOR_GAMES_PAGE_LIMIT + index + 1);
      if (candidate && !candidates.has(candidate.universeId)) candidates.set(candidate.universeId, candidate);
    });
    cursor = pickString(raw, ["nextPageCursor", "nextCursor"]);
    if (!cursor || !rows.length) break;
  }

  return Array.from(candidates.values());
}

async function main() {
  const options = parseArgs();
  const run = await startStatsJobRun({
    jobName: "discover_universes_creators",
    metadata: {
      seed_limit: options.seedLimit,
      max_pages: options.maxPages,
      creator_games_page_limit: CREATOR_GAMES_PAGE_LIMIT,
      dry_run: options.dryRun
    }
  });

  const fetchedAt = new Date().toISOString();

  try {
    const seeds = await fetchCreatorSeeds(options.seedLimit);
    if (!seeds.length) {
      console.log("No creator seeds found.");
      await finishStatsJobRun(run, { status: "skipped", metadata: { reason: "no_creator_seeds" } });
      return;
    }

    let failedSeeds = 0;
    let candidatesSeen = 0;
    let existing = 0;
    let insertable = 0;
    let inserted = 0;
    console.log(
      `Starting creator discovery: ${seeds.length} creator seeds, max pages ${options.maxPages}, page limit ${CREATOR_GAMES_PAGE_LIMIT}, dryRun=${options.dryRun}`
    );

    for (const [index, seed] of seeds.entries()) {
      try {
        const results = await fetchCreatorCandidates(seed, options.maxPages);
        const result = await insertNewUniverseCandidates({
          source: "roblox_creator_games",
          candidates: results,
          fetchDetailsOptions: REQUEST_OPTIONS,
          fetchedAt,
          dryRun: options.dryRun
        });
        candidatesSeen += result.candidates;
        existing += result.existing;
        insertable += result.insertable;
        inserted += result.inserted;
        console.log(
          ` • ${index + 1}/${seeds.length} ${seed.type}:${seed.id}: ${result.candidates} candidates, ${result.inserted}/${result.insertable} inserted`
        );
      } catch (error) {
        failedSeeds += 1;
        console.warn(
          ` • ${index + 1}/${seeds.length} ${seed.type}:${seed.id}: skipped after error: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    const status = failedSeeds > 0 ? "partial" : "success";
    await finishStatsJobRun(run, {
      status,
      rowsClaimed: seeds.length,
      rowsSucceeded: inserted,
      rowsFailed: failedSeeds,
      metadata: {
        candidates: candidatesSeen,
        existing,
        insertable,
        inserted,
        failed_seeds: failedSeeds
      }
    });

    console.log(
      `Creator discovery complete: ${candidatesSeen} candidates, ${existing} existing, ${insertable} insertable, ${inserted} inserted, ${failedSeeds} failed seeds.`
    );
  } catch (error) {
    await finishStatsJobRun(run, { status: "failed", error });
    throw error;
  }
}

main().catch((error) => {
  console.error("Roblox creator discovery failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
