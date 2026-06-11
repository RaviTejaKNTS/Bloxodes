import "../shared/load-env";

import { randomUUID } from "node:crypto";

import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";
import {
  fetchGameDetails,
  fetchJson,
  insertNewUniverseCandidates,
  pickBoolean,
  pickNumber,
  pickString,
  readPositiveNumber,
  readRecord,
  type FetchJsonOptions,
  type UniverseDiscoveryCandidate
} from "./discovery-utils";

const OMNI_SEARCH_API = "https://apis.roblox.com/search-api/omni-search";

const REQUEST_OPTIONS: FetchJsonOptions = {
  userAgent: "BloxodesUniverseSearchDiscovery/1.0",
  requestIntervalMs: readPositiveNumber("ROBLOX_SEARCH_REQUEST_INTERVAL_MS", 1200),
  retryLimit: readPositiveNumber("ROBLOX_SEARCH_RETRY_LIMIT", 5),
  retryBaseDelayMs: readPositiveNumber("ROBLOX_SEARCH_RETRY_BASE_DELAY_MS", 4000),
  retryMaxDelayMs: readPositiveNumber("ROBLOX_SEARCH_RETRY_MAX_DELAY_MS", 90000)
};

const DEFAULT_MAX_PAGES = readPositiveNumber("ROBLOX_SEARCH_MAX_PAGES", 2);
const DEFAULT_LIMIT = readPositiveNumber("ROBLOX_SEARCH_QUERY_LIMIT", 0);

const SEED_TERMS = [
  "anime",
  "basketball",
  "battle",
  "bike",
  "boxing",
  "car",
  "city",
  "clicker",
  "driving",
  "escape",
  "football",
  "fps",
  "garden",
  "hangout",
  "horror",
  "obby",
  "pets",
  "police",
  "prison",
  "racing",
  "roleplay",
  "rpg",
  "rng",
  "shooter",
  "simulator",
  "soccer",
  "survival",
  "tower defense",
  "tycoon",
  "ultimate",
  "ultimatum",
  "vv",
  "zombie"
];

const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");
const DIGITS = "0123456789".split("");

type Options = {
  queries: string[];
  limit: number;
  offset: number;
  maxPages: number;
  dryRun: boolean;
};

function buildDefaultQueries() {
  const twoLetterPrefixes = ALPHABET.flatMap((first) => ALPHABET.map((second) => `${first}${second}`));
  return Array.from(new Set([...SEED_TERMS, ...ALPHABET, ...twoLetterPrefixes, ...DIGITS]));
}

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    queries: [],
    limit: Number.isFinite(DEFAULT_LIMIT) && DEFAULT_LIMIT > 0 ? DEFAULT_LIMIT : 0,
    offset: 0,
    maxPages: Number.isFinite(DEFAULT_MAX_PAGES) && DEFAULT_MAX_PAGES > 0 ? DEFAULT_MAX_PAGES : 2,
    dryRun: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--query") {
      const value = args[i + 1];
      if (!value) throw new Error("--query requires a value");
      options.queries.push(value);
      i += 1;
    } else if (arg === "--queries") {
      const value = args[i + 1];
      if (!value) throw new Error("--queries requires a comma-separated value");
      options.queries.push(...value.split(","));
      i += 1;
    } else if (arg === "--limit" || arg === "-l") {
      options.limit = readCliNonNegativeInteger(args[i + 1], "limit");
      i += 1;
    } else if (arg === "--offset") {
      options.offset = readCliNonNegativeInteger(args[i + 1], "offset");
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

  const queries = options.queries.length ? options.queries : buildDefaultQueries();
  const uniqueQueries = Array.from(new Set(queries.map(normalizeQuery).filter(Boolean)));
  const offsetQueries = uniqueQueries.slice(options.offset);
  options.queries = options.limit > 0 ? offsetQueries.slice(0, options.limit) : offsetQueries;
  return options;
}

function readCliPositiveInteger(value: string | undefined, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`--${label} must be a positive integer`);
  return parsed;
}

function readCliNonNegativeInteger(value: string | undefined, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`--${label} must be a non-negative integer`);
  return parsed;
}

function printHelp() {
  console.log(`
Usage: npm run discover:universes:search -- [options]

Discovers Roblox universes through Roblox omni-search and inserts only missing
rows into roblox_universes as NEW. Existing universe rows are not overwritten.

Options:
  --query <text>       Search one query. Repeatable.
  --queries <csv>      Comma-separated search queries.
  -l, --limit <n>      Limit query count after offset. 0 means all. Default ${DEFAULT_LIMIT}.
  --offset <n>         Skip the first n default queries.
  --max-pages <n>      Search result pages per query. Default ${DEFAULT_MAX_PAGES}.
  --dry-run            Fetch and report without inserting rows.
  -h, --help           Show this help text.
`);
}

function buildSearchUrl(query: string, sessionId: string, cursor: string | null) {
  const params = new URLSearchParams({
    searchQuery: query,
    sessionId,
    pageType: "all",
    vertical: "experiences"
  });
  if (cursor) {
    params.set("pageToken", cursor);
    params.set("cursor", cursor);
  }
  return `${OMNI_SEARCH_API}?${params.toString()}`;
}

function findCursor(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findCursor(item);
      if (found) return found;
    }
    return null;
  }

  const source = value as Record<string, unknown>;
  for (const key of ["nextPageCursor", "nextPageToken", "nextCursor", "pageToken"]) {
    const cursor = pickString(source, [key]);
    if (cursor) return cursor;
  }
  for (const nested of Object.values(source)) {
    const cursor = findCursor(nested);
    if (cursor) return cursor;
  }
  return null;
}

function universeIdFromRecord(source: Record<string, unknown>) {
  const explicit = pickNumber(source, ["universeId", "universe_id", "universeID"]);
  if (explicit != null) return explicit;

  const hasPlaceIdentity = pickNumber(source, ["rootPlaceId", "root_place_id", "placeId", "place_id"]) != null;
  if (!hasPlaceIdentity) return null;
  return pickNumber(source, ["id"]);
}

function candidateFromRecord(
  source: Record<string, unknown>,
  query: string,
  fallbackPosition: number
): UniverseDiscoveryCandidate | null {
  const nestedUniverse = readRecord(source.universe);
  const nestedExperience = readRecord(source.experience);
  const nestedGame = readRecord(source.game);
  const nestedContent = readRecord(source.content);
  const universeSource = nestedUniverse ?? nestedExperience ?? nestedGame ?? nestedContent ?? source;
  const universeId = universeIdFromRecord(universeSource) ?? universeIdFromRecord(source);
  if (!universeId) return null;

  const creator = readRecord(universeSource.creator) ?? readRecord(source.creator);
  return {
    universeId,
    rootPlaceId:
      pickNumber(universeSource, ["rootPlaceId", "root_place_id", "placeId", "place_id"]) ??
      pickNumber(source, ["rootPlaceId", "root_place_id", "placeId", "place_id"]),
    name: pickString(universeSource, ["name", "displayName", "title"]) ?? pickString(source, ["name", "title"]),
    description: pickString(universeSource, ["description"]) ?? pickString(source, ["description"]),
    creatorId: creator ? pickNumber(creator, ["id", "creatorId", "userId", "groupId"]) : null,
    creatorName: creator ? pickString(creator, ["name", "creatorName", "username"]) : null,
    creatorType: creator ? pickString(creator, ["type", "creatorType"]) : null,
    creatorHasVerifiedBadge:
      pickBoolean(universeSource, ["creatorHasVerifiedBadge", "hasVerifiedBadge"]) ??
      (creator ? pickBoolean(creator, ["hasVerifiedBadge"]) : null),
    query,
    position:
      pickNumber(source, ["position", "rank", "index"]) ??
      pickNumber(universeSource, ["position", "rank", "index"]) ??
      fallbackPosition,
    raw: source
  };
}

function extractCandidates(raw: Record<string, unknown>, query: string) {
  const candidates = new Map<number, UniverseDiscoveryCandidate>();
  let fallbackPosition = 0;

  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    const source = value as Record<string, unknown>;
    const candidate = candidateFromRecord(source, query, fallbackPosition);
    if (candidate && !candidates.has(candidate.universeId)) {
      candidates.set(candidate.universeId, candidate);
      fallbackPosition += 1;
    }

    for (const nested of Object.values(source)) visit(nested);
  }

  visit(raw);
  return Array.from(candidates.values());
}

async function fetchSearchCandidates(query: string, maxPages: number) {
  const sessionId = randomUUID();
  const candidates = new Map<number, UniverseDiscoveryCandidate>();
  let cursor: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const raw = await fetchJson(buildSearchUrl(query, sessionId, cursor), `omni-search "${query}"`, REQUEST_OPTIONS);
    for (const candidate of extractCandidates(raw, query)) {
      if (!candidates.has(candidate.universeId)) candidates.set(candidate.universeId, candidate);
    }
    cursor = findCursor(raw);
    if (!cursor) break;
  }

  return Array.from(candidates.values());
}

async function main() {
  const options = parseArgs();
  const run = await startStatsJobRun({
    jobName: "discover_universes_search",
    metadata: {
      query_count: options.queries.length,
      limit: options.limit,
      offset: options.offset,
      max_pages: options.maxPages,
      dry_run: options.dryRun
    }
  });

  if (!options.queries.length) {
    console.log("No search queries selected.");
    await finishStatsJobRun(run, { status: "skipped", metadata: { reason: "no_queries" } });
    return;
  }

  const fetchedAt = new Date().toISOString();
  const candidates = new Map<number, UniverseDiscoveryCandidate>();
  const failedQueries: Array<{ query: string; error: string }> = [];
  console.log(
    `Starting Roblox search discovery: ${options.queries.length} queries, max pages ${options.maxPages}, dryRun=${options.dryRun}`
  );

  try {
    for (const [index, query] of options.queries.entries()) {
      try {
        const results = await fetchSearchCandidates(query, options.maxPages);
        for (const candidate of results) {
          if (!candidates.has(candidate.universeId)) candidates.set(candidate.universeId, candidate);
        }
        console.log(` • ${index + 1}/${options.queries.length} "${query}": ${results.length} candidates`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failedQueries.push({ query, error: message });
        console.warn(` • ${index + 1}/${options.queries.length} "${query}": skipped after error: ${message}`);
      }
    }

    const candidateRows = Array.from(candidates.values());
    const details = await fetchGameDetails(candidateRows.map((candidate) => candidate.universeId), REQUEST_OPTIONS);
    const result = await insertNewUniverseCandidates({
      source: "roblox_omni_search",
      candidates: candidateRows,
      details,
      fetchedAt,
      dryRun: options.dryRun
    });

    await finishStatsJobRun(run, {
      status: failedQueries.length ? "partial" : "success",
      rowsClaimed: options.queries.length,
      rowsSucceeded: result.inserted,
      rowsFailed: failedQueries.length,
      metadata: {
        candidates: result.candidates,
        existing: result.existing,
        insertable: result.insertable,
        inserted: result.inserted,
        failed_queries: failedQueries
      }
    });

    console.log(
      `Search discovery complete: ${result.candidates} candidates, ${result.existing} existing, ${result.insertable} insertable, ${result.inserted} inserted, ${failedQueries.length} failed queries.`
    );
  } catch (error) {
    await finishStatsJobRun(run, { status: "failed", error });
    throw error;
  }
}

main().catch((error) => {
  console.error("Roblox search discovery failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
