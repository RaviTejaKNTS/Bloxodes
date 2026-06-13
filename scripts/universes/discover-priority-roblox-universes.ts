import "../shared/load-env";

import { randomUUID } from "node:crypto";

import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";
import {
  fetchJson,
  insertNewUniverseCandidates,
  pickNumber,
  pickString,
  readPositiveNumber,
  type FetchJsonOptions,
  type UniverseDiscoveryCandidate
} from "./discovery-utils";

const EXPLORE_SORT_CONTENT_API = "https://apis.roblox.com/explore-api/v1/get-sort-content";

const DEFAULT_SORTS = ["top-playing-now", "top-trending", "up-and-coming"];
const DEFAULT_DEVICES = ["computer", "phone", "tablet", "console", "vr"];
const DEFAULT_COUNTRIES = ["us", "gb", "ca", "au", "br", "ph", "id", "tr", "de", "fr", "jp", "kr"];

const REQUEST_OPTIONS: FetchJsonOptions = {
  userAgent: "BloxodesPriorityExploreDiscovery/1.0",
  requestIntervalMs: readPositiveNumber("ROBLOX_PRIORITY_EXPLORE_REQUEST_INTERVAL_MS", 900),
  retryLimit: readPositiveNumber("ROBLOX_PRIORITY_EXPLORE_RETRY_LIMIT", 5),
  retryBaseDelayMs: readPositiveNumber("ROBLOX_PRIORITY_EXPLORE_RETRY_BASE_DELAY_MS", 4000),
  retryMaxDelayMs: readPositiveNumber("ROBLOX_PRIORITY_EXPLORE_RETRY_MAX_DELAY_MS", 90000)
};

const MAX_PAGES = readPositiveNumber("ROBLOX_PRIORITY_EXPLORE_MAX_PAGES", 0);
const CPU_CORES = process.env.ROBLOX_CPU_CORES ?? "8";
const MAX_RESOLUTION = process.env.ROBLOX_MAX_RESOLUTION ?? "1440x900";
const MAX_MEMORY = process.env.ROBLOX_MAX_MEMORY ?? "8192";
const NETWORK_TYPE = process.env.ROBLOX_NETWORK_TYPE ?? "4g";

type Options = {
  sorts: string[];
  devices: string[];
  countries: string[];
  maxPages: number;
  dryRun: boolean;
};

type ExploreGameEntry = {
  universeId?: number | string;
  rootPlaceId?: number | string;
  placeId?: number | string;
  name?: string;
  displayName?: string;
  description?: string;
  creatorId?: number | string;
  creatorName?: string;
  creatorType?: string;
  creatorHasVerifiedBadge?: boolean;
  hasVerifiedBadge?: boolean;
  playing?: number;
  playerCount?: number;
  visits?: number;
  [key: string]: unknown;
};

function readList(name: string, fallback: string[]) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length ? values : fallback;
}

function readCsv(value: string | undefined, label: string) {
  if (!value) throw new Error(`--${label} requires a comma-separated value`);
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readCliNonNegativeInteger(value: string | undefined, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`--${label} must be a non-negative integer`);
  return parsed;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    sorts: readList("ROBLOX_PRIORITY_EXPLORE_SORTS", DEFAULT_SORTS),
    devices: readList("ROBLOX_PRIORITY_EXPLORE_DEVICES", DEFAULT_DEVICES),
    countries: readList("ROBLOX_PRIORITY_EXPLORE_COUNTRIES", DEFAULT_COUNTRIES),
    maxPages: Number.isFinite(MAX_PAGES) && MAX_PAGES >= 0 ? MAX_PAGES : 0,
    dryRun: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--sorts") {
      options.sorts = readCsv(args[i + 1], "sorts");
      i += 1;
    } else if (arg === "--devices") {
      options.devices = readCsv(args[i + 1], "devices");
      i += 1;
    } else if (arg === "--countries") {
      options.countries = readCsv(args[i + 1], "countries");
      i += 1;
    } else if (arg === "--max-pages") {
      options.maxPages = readCliNonNegativeInteger(args[i + 1], "max-pages");
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

  options.sorts = Array.from(new Set(options.sorts));
  options.devices = Array.from(new Set(options.devices));
  options.countries = Array.from(new Set(options.countries));
  return options;
}

function printHelp() {
  console.log(`
Usage: npm run discover:universes:priority -- [options]

Discovers breakout Roblox universes from priority Explore sorts and inserts
missing rows into roblox_universes as NEW after each sort page.

Options:
  --sorts <csv>       Explore sort ids. Default ${DEFAULT_SORTS.join(",")}.
  --devices <csv>     Devices to crawl. Default ${DEFAULT_DEVICES.join(",")}.
  --countries <csv>   Countries to crawl. Default ${DEFAULT_COUNTRIES.join(",")}.
  --max-pages <n>     Pages per sort/device/country. 0 means until Roblox stops. Default ${MAX_PAGES}.
  --dry-run           Fetch and report without inserting rows.
  -h, --help          Show this help text.
`);
}

function extractGames(payload: Record<string, unknown>): ExploreGameEntry[] {
  if (Array.isArray(payload.games)) return payload.games as ExploreGameEntry[];
  if (Array.isArray(payload.gameList)) return payload.gameList as ExploreGameEntry[];
  if (Array.isArray(payload.content)) return payload.content as ExploreGameEntry[];
  for (const value of Object.values(payload)) {
    if (Array.isArray(value) && value.length && typeof value[0] === "object" && "universeId" in (value[0] as Record<string, unknown>)) {
      return value as ExploreGameEntry[];
    }
  }
  return [];
}

function buildSortUrl(params: {
  sortId: string;
  device: string;
  country: string;
  sessionId: string;
  pageToken: string | null;
}) {
  const search = new URLSearchParams({
    sortId: params.sortId,
    device: params.device,
    country: params.country,
    sessionId: params.sessionId
  });
  if (CPU_CORES) search.set("cpuCores", CPU_CORES);
  if (MAX_RESOLUTION) search.set("maxResolution", MAX_RESOLUTION);
  if (MAX_MEMORY) search.set("maxMemory", MAX_MEMORY);
  if (NETWORK_TYPE) search.set("networkType", NETWORK_TYPE);
  if (params.pageToken) search.set("pageToken", params.pageToken);
  return `${EXPLORE_SORT_CONTENT_API}?${search.toString()}`;
}

function candidateFromGame(
  game: ExploreGameEntry,
  context: { sortId: string; device: string; country: string; page: number; rank: number }
): UniverseDiscoveryCandidate | null {
  const universeId = pickNumber(game, ["universeId", "universe_id"]);
  const rootPlaceId = pickNumber(game, ["rootPlaceId", "root_place_id", "placeId", "place_id"]);
  if (!universeId || !rootPlaceId) return null;
  return {
    universeId,
    rootPlaceId,
    name: pickString(game, ["name", "displayName", "title"]),
    description: pickString(game, ["description"]),
    creatorId: pickNumber(game, ["creatorId", "creator_id"]),
    creatorName: pickString(game, ["creatorName", "creator_name"]),
    creatorType: pickString(game, ["creatorType", "creator_type"]),
    creatorHasVerifiedBadge:
      typeof game.creatorHasVerifiedBadge === "boolean"
        ? game.creatorHasVerifiedBadge
        : typeof game.hasVerifiedBadge === "boolean"
          ? game.hasVerifiedBadge
          : null,
    query: context.sortId,
    position: context.rank,
    raw: {
      ...game,
      priority_context: context
    }
  };
}

async function insertPageCandidates(params: {
  candidates: UniverseDiscoveryCandidate[];
  fetchedAt: string;
  dryRun: boolean;
}) {
  return insertNewUniverseCandidates({
    source: "roblox_explore_priority",
    candidates: params.candidates,
    fetchDetailsOptions: REQUEST_OPTIONS,
    fetchedAt: params.fetchedAt,
    seenField: "last_seen_in_sort",
    dryRun: params.dryRun
  });
}

async function main() {
  const options = parseArgs();
  const fetchedAt = new Date().toISOString();
  const run = await startStatsJobRun({
    jobName: "discover_universes_priority",
    metadata: {
      sorts: options.sorts,
      devices: options.devices,
      countries: options.countries,
      max_pages: options.maxPages,
      dry_run: options.dryRun
    }
  });

  let pagesProcessed = 0;
  let candidatesSeen = 0;
  let existing = 0;
  let insertable = 0;
  let inserted = 0;
  const failedPages: Array<{ sort: string; device: string; country: string; page: number; error: string }> = [];

  try {
    console.log(
      `Starting priority Roblox discovery: ${options.sorts.length} sorts, ${options.devices.length} devices, ${options.countries.length} countries, dryRun=${options.dryRun}`
    );

    for (const sortId of options.sorts) {
      for (const device of options.devices) {
        for (const country of options.countries) {
          const sessionId = randomUUID();
          let nextPageToken: string | null = null;
          let page = 0;
          let rankOffset = 0;
          do {
            if (options.maxPages > 0 && page >= options.maxPages) break;
            page += 1;
            try {
              const payload = await fetchJson(
                buildSortUrl({ sortId, device, country, sessionId, pageToken: nextPageToken }),
                `priority explore ${sortId}/${device}/${country}/page-${page}`,
                REQUEST_OPTIONS
              );
              pagesProcessed += 1;
              const games = extractGames(payload);
              const candidates = games
                .map((game, index) =>
                  candidateFromGame(game, {
                    sortId,
                    device,
                    country,
                    page,
                    rank: rankOffset + index + 1
                  })
                )
                .filter((candidate): candidate is UniverseDiscoveryCandidate => candidate != null);

              if (candidates.length) {
                const result = await insertPageCandidates({ candidates, fetchedAt, dryRun: options.dryRun });
                candidatesSeen += result.candidates;
                existing += result.existing;
                insertable += result.insertable;
                inserted += result.inserted;
                console.log(
                  ` • ${sortId}/${device}/${country}/page-${page}: ${result.candidates} candidates, ${result.inserted}/${result.insertable} inserted`
                );
              } else {
                console.log(` • ${sortId}/${device}/${country}/page-${page}: 0 candidates`);
              }

              rankOffset += games.length;
              nextPageToken = pickString(payload, ["nextPageToken", "nextPageCursor", "nextCursor", "pageToken"]);
              if (!games.length) break;
            } catch (error) {
              failedPages.push({
                sort: sortId,
                device,
                country,
                page,
                error: error instanceof Error ? error.message : String(error)
              });
              console.warn(
                ` • ${sortId}/${device}/${country}/page-${page}: skipped after error: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
              break;
            }
          } while (nextPageToken);
        }
      }
    }

    await finishStatsJobRun(run, {
      status: failedPages.length ? "partial" : "success",
      rowsClaimed: pagesProcessed,
      rowsSucceeded: inserted,
      rowsFailed: failedPages.length,
      metadata: {
        candidates: candidatesSeen,
        existing,
        insertable,
        inserted,
        failed_pages: failedPages
      }
    });

    console.log(
      `Priority discovery complete: ${pagesProcessed} pages, ${candidatesSeen} candidates, ${inserted}/${insertable} inserted, ${failedPages.length} failed pages.`
    );
  } catch (error) {
    await finishStatsJobRun(run, {
      status: "failed",
      rowsClaimed: pagesProcessed,
      rowsSucceeded: inserted,
      rowsFailed: failedPages.length,
      error
    });
    throw error;
  }
}

main().catch((error) => {
  console.error("Priority Roblox discovery failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
