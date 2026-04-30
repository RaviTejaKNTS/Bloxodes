import "../shared/load-env";

import { randomUUID } from "node:crypto";

import { slugify } from "@/lib/slug";
import { supabaseAdmin } from "@/lib/supabase-admin";

const OMNI_SEARCH_API = "https://apis.roblox.com/search-api/omni-search";
const GAME_DETAILS_API = "https://games.roblox.com/v1/games";
const USER_AGENT = "BloxodesUniverseSearchDiscovery/1.0";

const DEFAULT_JOB_LIMIT = Number(process.env.ROBLOX_SEARCH_JOB_LIMIT ?? "50");
const DEFAULT_MAX_PAGES = Number(process.env.ROBLOX_SEARCH_MAX_PAGES ?? "2");
const REQUEST_INTERVAL_MS = Number(process.env.ROBLOX_SEARCH_REQUEST_INTERVAL_MS ?? "1500");
const RETRY_LIMIT = Number(process.env.ROBLOX_SEARCH_RETRY_LIMIT ?? "5");
const RETRY_BASE_DELAY_MS = Number(process.env.ROBLOX_SEARCH_RETRY_BASE_DELAY_MS ?? "5000");
const RETRY_MAX_DELAY_MS = Number(process.env.ROBLOX_SEARCH_RETRY_MAX_DELAY_MS ?? "90000");
const CONTENT_TERM_LIMIT = Number(process.env.ROBLOX_SEARCH_CONTENT_TERM_LIMIT ?? "500");
const STALE_LOCK_MINUTES = Number(process.env.ROBLOX_SEARCH_STALE_LOCK_MINUTES ?? "60");

const SEED_TERMS = [
  "obby",
  "tycoon",
  "simulator",
  "roleplay",
  "anime",
  "tower defense",
  "pets",
  "racing",
  "driving",
  "car",
  "bike",
  "fps",
  "shooter",
  "zombie",
  "horror",
  "survival",
  "escape",
  "parkour",
  "football",
  "soccer",
  "basketball",
  "baseball",
  "boxing",
  "wrestling",
  "battle",
  "war",
  "military",
  "police",
  "prison",
  "city",
  "school",
  "hospital",
  "hotel",
  "mall",
  "restaurant",
  "pizza",
  "cafe",
  "fashion",
  "dress",
  "avatar",
  "voice chat",
  "hangout",
  "party",
  "social",
  "minigames",
  "puzzle",
  "quiz",
  "math",
  "learning",
  "drawing",
  "music",
  "dance",
  "concert",
  "adventure",
  "story",
  "quest",
  "rpg",
  "dungeon",
  "magic",
  "dragon",
  "pirate",
  "ninja",
  "superhero",
  "marvel",
  "minecraft",
  "pokemon",
  "sonic",
  "fnaf",
  "rainbow",
  "cat",
  "dog",
  "horse",
  "farm",
  "garden",
  "island",
  "ocean",
  "space",
  "moon",
  "planet",
  "airport",
  "train",
  "ship",
  "bus",
  "plane",
  "truck",
  "fire",
  "snow",
  "christmas",
  "halloween",
  "easter",
  "summer",
  "winter",
  "free admin",
  "admin",
  "donation",
  "plushie",
  "merch",
  "robux",
  "clicker",
  "incremental",
  "factory",
  "mining",
  "fishing"
];

const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");
const STOP_WORDS = new Set([
  "and",
  "are",
  "best",
  "code",
  "codes",
  "for",
  "from",
  "game",
  "games",
  "guide",
  "how",
  "ids",
  "new",
  "roblox",
  "the",
  "tier",
  "wiki",
  "with",
  "you"
]);

function buildSeedTerms() {
  const prefixes = [
    ...ALPHABET,
    ...ALPHABET.flatMap((first) => ALPHABET.map((second) => `${first}${second}`))
  ];
  return Array.from(new Set([...SEED_TERMS, ...prefixes]));
}

function normalizeSeedText(value: string) {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTermsFromText(value: string | null | undefined) {
  if (!value) return [];
  const normalized = normalizeSeedText(value);
  if (!normalized) return [];

  const tokens = normalized
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/.test(token));
  const terms = new Set<string>();

  if (tokens.length >= 2 && tokens.length <= 4) {
    terms.add(tokens.join(" "));
  }
  for (const token of tokens) {
    terms.add(token);
  }
  for (let i = 0; i < tokens.length - 1; i += 1) {
    terms.add(`${tokens[i]} ${tokens[i + 1]}`);
  }

  return Array.from(terms).filter((term) => term.length >= 3 && term.length <= 50);
}

type DiscoveryJob = {
  id: string;
  job_key: string;
  source: string;
  strategy: string;
  query: string | null;
  params: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

type RobloxGameDetail = {
  id: number;
  rootPlaceId?: number;
  name?: string;
  description?: string;
  creator?: {
    id?: number;
    name?: string;
    type?: string;
    hasVerifiedBadge?: boolean;
  };
  genre?: string;
  genre_l1?: string;
  genre_l2?: string;
  playing?: number;
  visits?: number;
  favorites?: number;
  favoritedCount?: number;
  totalUpVotes?: number;
  totalDownVotes?: number;
  isSponsoredGame?: boolean;
  votes?: {
    upVotes?: number;
    downVotes?: number;
  };
  [key: string]: unknown;
};

type SearchCandidate = {
  universeId: number;
  placeId: number | null;
  position: number | null;
  name: string | null;
  description: string | null;
  creatorId: number | null;
  creatorName: string | null;
  creatorType: string | null;
  hasVerifiedBadge: boolean | null;
  isSponsored: boolean | null;
  raw: Record<string, unknown>;
};

type SearchPage = {
  candidates: SearchCandidate[];
  nextCursor: string | null;
  raw: Record<string, unknown>;
};

let nextRequestAt = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length ? value.trim() : null;
}

function toBooleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function parseResourceId(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/(\d+)/g);
  if (!match?.length) return null;
  return Number(match[match.length - 1]);
}

function readNestedRecord(source: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = source[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function pickNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const direct = toNumber(source[key]);
    if (direct != null) return direct;
    const parsed = parseResourceId(source[key]);
    if (parsed != null) return parsed;
  }
  return null;
}

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = toStringOrNull(source[key]);
    if (value) return value;
  }
  return null;
}

function pickBoolean(source: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = toBooleanOrNull(source[key]);
    if (value != null) return value;
  }
  return null;
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

async function waitForRequestSlot() {
  const now = Date.now();
  if (nextRequestAt > now) {
    await sleep(nextRequestAt - now);
  }
  nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;
}

async function fetchJson(url: string, label: string): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt <= RETRY_LIMIT; attempt += 1) {
    await waitForRequestSlot();
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
    if (res.ok) {
      return (await res.json()) as Record<string, unknown>;
    }

    const body = await res.text().catch(() => "");
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= RETRY_LIMIT) {
      throw new Error(`Failed to fetch ${label} (${res.status}): ${body.slice(0, 400)}`);
    }

    const delay =
      retryAfterMs(res.headers) ?? jitter(Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS));
    console.warn(`Rate/temporary failure for ${label} (${res.status}); retrying in ${Math.round(delay / 1000)}s`);
    await sleep(delay);
  }

  throw new Error(`Failed to fetch ${label}`);
}

function buildOmniSearchUrl(query: string, sessionId: string, cursor: string | null) {
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
  for (const key of ["nextPageCursor", "nextPageToken", "nextCursor", "pageToken", "cursor"]) {
    const candidate = toStringOrNull(source[key]);
    if (candidate) return candidate;
  }

  for (const nested of Object.values(source)) {
    const found = findCursor(nested);
    if (found) return found;
  }
  return null;
}

function candidateFromRecord(source: Record<string, unknown>, fallbackPosition: number | null): SearchCandidate | null {
  const nestedUniverse = readNestedRecord(source, "universe");
  const nestedExperience = readNestedRecord(source, "experience");
  const nestedGame = readNestedRecord(source, "game");
  const nestedContent = readNestedRecord(source, "content");
  const nestedCreator = readNestedRecord(source, "creator");

  const universeSource = nestedUniverse ?? nestedExperience ?? nestedGame ?? nestedContent ?? source;
  const universeId =
    pickNumber(universeSource, ["universeId", "universe_id", "universeID", "id", "universe"]) ??
    pickNumber(source, ["universeId", "universe_id", "universeID", "universe"]);
  if (universeId == null) return null;

  const placeId =
    pickNumber(universeSource, ["rootPlaceId", "root_place_id", "placeId", "place_id", "rootPlace"]) ??
    pickNumber(source, ["rootPlaceId", "root_place_id", "placeId", "place_id", "rootPlace"]);
  const creatorSource = nestedCreator ?? readNestedRecord(universeSource, "creator");
  const position =
    pickNumber(source, ["position", "rank", "index"]) ??
    pickNumber(universeSource, ["position", "rank", "index"]) ??
    fallbackPosition;

  return {
    universeId,
    placeId,
    position,
    name: pickString(universeSource, ["name", "displayName", "title"]) ?? pickString(source, ["name", "title"]),
    description: pickString(universeSource, ["description"]) ?? pickString(source, ["description"]),
    creatorId: creatorSource ? pickNumber(creatorSource, ["id", "creatorId", "userId", "groupId"]) : null,
    creatorName: creatorSource ? pickString(creatorSource, ["name", "creatorName", "username"]) : null,
    creatorType: creatorSource ? pickString(creatorSource, ["type", "creatorType"]) : null,
    hasVerifiedBadge:
      pickBoolean(universeSource, ["hasVerifiedBadge", "creatorHasVerifiedBadge"]) ??
      (creatorSource ? pickBoolean(creatorSource, ["hasVerifiedBadge"]) : null),
    isSponsored: pickBoolean(universeSource, ["isSponsored", "isSponsoredGame"]) ?? pickBoolean(source, ["isSponsored"]),
    raw: source
  };
}

function extractCandidates(raw: Record<string, unknown>) {
  const byUniverseId = new Map<number, SearchCandidate>();
  let fallbackPosition = 0;

  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item));
      return;
    }

    const source = value as Record<string, unknown>;
    const candidate = candidateFromRecord(source, fallbackPosition);
    if (candidate && !byUniverseId.has(candidate.universeId)) {
      byUniverseId.set(candidate.universeId, candidate);
      fallbackPosition += 1;
    }

    for (const nested of Object.values(source)) {
      visit(nested);
    }
  }

  visit(raw);
  return Array.from(byUniverseId.values());
}

async function fetchSearchPage(query: string, sessionId: string, cursor: string | null): Promise<SearchPage> {
  const raw = await fetchJson(buildOmniSearchUrl(query, sessionId, cursor), `omni-search "${query}"`);
  return {
    raw,
    candidates: extractCandidates(raw),
    nextCursor: findCursor(raw)
  };
}

async function fetchGameDetails(universeIds: number[]) {
  if (!universeIds.length) return new Map<number, RobloxGameDetail>();
  const details = new Map<number, RobloxGameDetail>();
  for (let i = 0; i < universeIds.length; i += 50) {
    const chunk = universeIds.slice(i, i + 50);
    const params = new URLSearchParams({ universeIds: chunk.join(",") });
    const raw = await fetchJson(`${GAME_DETAILS_API}?${params.toString()}`, "game details");
    const entries = Array.isArray(raw.data) ? (raw.data as RobloxGameDetail[]) : [];
    for (const entry of entries) {
      if (typeof entry.id === "number") details.set(entry.id, entry);
    }
  }
  return details;
}

async function seedJobs(queries: string[]) {
  const sb = supabaseAdmin();
  const rows = Array.from(new Set(queries.map(normalizeText).filter(Boolean))).map((query, index) => ({
    job_key: `roblox-search:keyword:${query.toLowerCase()}`,
    source: "roblox_search",
    strategy: "keyword",
    query,
    params: { seededAt: nowIso() },
    status: "pending",
    priority: Math.max(100 - index, 1),
    next_run_at: nowIso()
  }));

  if (!rows.length) return 0;
  const { error } = await sb
    .from("roblox_universe_discovery_jobs")
    .upsert(rows, { onConflict: "job_key", ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
}

async function fetchContentSeedTerms(limit: number) {
  const sb = supabaseAdmin();
  const termScores = new Map<string, number>();
  const addTerms = (values: Array<string | null | undefined>, weight: number) => {
    for (const value of values) {
      for (const term of extractTermsFromText(value)) {
        termScores.set(term, (termScores.get(term) ?? 0) + weight);
      }
    }
  };

  const universeResult = await sb
    .from("roblox_universes")
    .select("name, display_name, genre, genre_l1, genre_l2, creator_name")
    .order("last_seen_in_sort", { ascending: false })
    .limit(Math.min(limit * 2, 2000));
  if (!universeResult.error) {
    for (const row of ((universeResult.data ?? []) as unknown) as Array<Record<string, string | null>>) {
      addTerms([row.display_name, row.name], 5);
      addTerms([row.genre, row.genre_l1, row.genre_l2, row.creator_name], 2);
    }
  }

  const tableRequests: Array<{
    table: string;
    columns: string;
    fields: string[];
    weight: number;
  }> = [
    { table: "games", columns: "name", fields: ["name"], weight: 5 },
    { table: "articles", columns: "title", fields: ["title"], weight: 3 },
    { table: "catalog_pages", columns: "title", fields: ["title"], weight: 3 },
    { table: "wiki_pages", columns: "title", fields: ["title"], weight: 3 }
  ];

  for (const request of tableRequests) {
    const result = await sb.from(request.table).select(request.columns).limit(limit);
    if (result.error) {
      console.warn(`Content seed source ${request.table} skipped: ${result.error.message}`);
      continue;
    }
    for (const row of ((result.data ?? []) as unknown) as Array<Record<string, string | null>>) {
      addTerms(request.fields.map((field) => row[field]), request.weight);
    }
  }

  return Array.from(termScores.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([term]) => term)
    .slice(0, limit);
}

async function claimJobs(limit: number): Promise<DiscoveryJob[]> {
  if (limit <= 0) return [];
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_universe_discovery_jobs")
    .select("id, job_key, source, strategy, query, params, attempts, max_attempts")
    .in("status", ["pending", "failed"])
    .lte("next_run_at", nowIso())
    .or(`cooldown_until.is.null,cooldown_until.lte.${nowIso()}`)
    .order("priority", { ascending: false })
    .order("next_run_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const jobs = ((data ?? []) as DiscoveryJob[]).filter((job) => Boolean(job.query));
  for (const job of jobs) {
    const { error: updateError } = await sb
      .from("roblox_universe_discovery_jobs")
      .update({
        status: "in_progress",
        locked_at: nowIso(),
        locked_by: `local-${process.pid}`,
        attempts: job.attempts + 1
      })
      .eq("id", job.id);
    if (updateError) throw updateError;
  }
  return jobs;
}

async function releaseStaleJobs() {
  const cutoff = new Date(Date.now() - STALE_LOCK_MINUTES * 60 * 1000).toISOString();
  const sb = supabaseAdmin();
  const { error, count } = await sb
    .from("roblox_universe_discovery_jobs")
    .update({
      status: "pending",
      locked_at: null,
      locked_by: null,
      last_error: `Released stale roblox_search lock after ${STALE_LOCK_MINUTES} minutes`,
      next_run_at: nowIso()
    }, { count: "exact" })
    .eq("source", "roblox_search")
    .eq("status", "in_progress")
    .lt("locked_at", cutoff);
  if (error) throw error;
  if (count) {
    console.log(`Released ${count} stale Roblox search discovery jobs.`);
  }
}

function mapGameToUniversePayload(
  candidate: SearchCandidate,
  detail: RobloxGameDetail | undefined,
  fetchedAt: string
) {
  const rootPlaceId = detail?.rootPlaceId ?? candidate.placeId;
  if (!rootPlaceId) return null;
  const name = detail?.name ?? candidate.name ?? `Universe ${candidate.universeId}`;
  const votes = detail?.votes ?? {};
  const likes =
    typeof votes.upVotes === "number"
      ? votes.upVotes
      : typeof detail?.totalUpVotes === "number"
        ? detail.totalUpVotes
        : null;
  const dislikes =
    typeof votes.downVotes === "number"
      ? votes.downVotes
      : typeof detail?.totalDownVotes === "number"
        ? detail.totalDownVotes
        : null;

  return {
    universe_id: candidate.universeId,
    root_place_id: rootPlaceId,
    name,
    display_name: name,
    slug: slugify(name) || `universe-${candidate.universeId}`,
    description: detail?.description ?? candidate.description ?? null,
    description_source: detail?.description ? "games" : null,
    creator_id: detail?.creator?.id ?? candidate.creatorId ?? null,
    creator_name: detail?.creator?.name ?? candidate.creatorName ?? null,
    creator_type: detail?.creator?.type ?? candidate.creatorType ?? null,
    creator_has_verified_badge:
      typeof detail?.creator?.hasVerifiedBadge === "boolean"
        ? detail.creator.hasVerifiedBadge
        : candidate.hasVerifiedBadge,
    genre: typeof detail?.genre === "string" ? detail.genre : null,
    genre_l1: typeof detail?.genre_l1 === "string" ? detail.genre_l1 : null,
    genre_l2: typeof detail?.genre_l2 === "string" ? detail.genre_l2 : null,
    playing: typeof detail?.playing === "number" ? detail.playing : null,
    visits: typeof detail?.visits === "number" ? detail.visits : null,
    favorites:
      typeof detail?.favorites === "number"
        ? detail.favorites
        : typeof detail?.favoritedCount === "number"
          ? detail.favoritedCount
          : null,
    likes,
    dislikes,
    is_sponsored:
      typeof detail?.isSponsoredGame === "boolean" ? detail.isSponsoredGame : candidate.isSponsored,
    last_seen_in_search: fetchedAt,
    raw_details: detail ? { games: detail } : {},
    raw_metadata: { discovery: { source: "roblox_search", fetched_at: fetchedAt } },
    discovery_sources: ["roblox_search"]
  };
}

async function processJob(job: DiscoveryJob, maxPages: number) {
  if (!job.query) return { results: 0, newUniverses: 0 };

  const sb = supabaseAdmin();
  const fetchedAt = nowIso();
  const sessionId = randomUUID();
  const candidatesById = new Map<number, SearchCandidate>();
  let cursor: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const result = await fetchSearchPage(job.query, sessionId, cursor);
    for (const candidate of result.candidates) {
      if (!candidatesById.has(candidate.universeId)) {
        candidatesById.set(candidate.universeId, candidate);
      }
    }
    cursor = result.nextCursor;
    if (!cursor || !result.candidates.length) break;
  }

  const candidates = Array.from(candidatesById.values());
  if (!candidates.length) {
    return { results: 0, newUniverses: 0 };
  }

  const ids = candidates.map((candidate) => candidate.universeId);
  const { data: existing, error: existingError } = await sb
    .from("roblox_universes")
    .select("universe_id")
    .in("universe_id", ids);
  if (existingError) throw existingError;
  const existingIds = new Set<number>(((existing ?? []) as Array<{ universe_id: number }>).map((row) => row.universe_id));

  const details = await fetchGameDetails(ids);
  const newPayload = candidates
    .filter((candidate) => !existingIds.has(candidate.universeId))
    .map((candidate) => mapGameToUniversePayload(candidate, details.get(candidate.universeId), fetchedAt))
    .filter((value): value is NonNullable<typeof value> => value != null);

  if (newPayload.length) {
    const { error: upsertError } = await sb.from("roblox_universes").upsert(newPayload, { onConflict: "universe_id" });
    if (upsertError) throw upsertError;
  }

  for (const candidate of candidates) {
    const { error: updateError } = await sb
      .from("roblox_universes")
      .update({ last_seen_in_search: fetchedAt })
      .eq("universe_id", candidate.universeId);
    if (updateError) throw updateError;
  }

  const snapshotRows = candidates.map((candidate, index) => ({
    query: job.query!,
    universe_id: candidate.universeId,
    place_id: details.get(candidate.universeId)?.rootPlaceId ?? candidate.placeId,
    position: candidate.position ?? index,
    session_id: sessionId,
    has_verified_badge: candidate.hasVerifiedBadge,
    is_sponsored: candidate.isSponsored,
    source: "omni-search",
    raw_payload: candidate.raw,
    fetched_at: fetchedAt
  }));

  if (snapshotRows.length) {
    const { error: snapshotError } = await sb.from("roblox_universe_search_snapshots").insert(snapshotRows);
    if (snapshotError) throw snapshotError;
  }

  return { results: candidates.length, newUniverses: newPayload.length };
}

async function completeJob(job: DiscoveryJob, results: number, newUniverses: number) {
  const sb = supabaseAdmin();
  const nextRunAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await sb
    .from("roblox_universe_discovery_jobs")
    .update({
      status: "pending",
      result_count: results,
      new_universe_count: newUniverses,
      last_error: null,
      last_run_at: nowIso(),
      completed_at: nowIso(),
      locked_at: null,
      locked_by: null,
      next_run_at: nextRunAt,
      cooldown_until: null
    })
    .eq("id", job.id);
  if (error) throw error;
}

async function failJob(job: DiscoveryJob, error: unknown) {
  const sb = supabaseAdmin();
  const message = error instanceof Error ? error.message : String(error);
  const exhausted = job.attempts + 1 >= job.max_attempts;
  const cooldownMs = message.includes("(429)") ? 60 * 60 * 1000 : Math.min(30 * 60 * 1000, 5 * 60 * 1000 * (job.attempts + 1));
  const { error: updateError } = await sb
    .from("roblox_universe_discovery_jobs")
    .update({
      status: exhausted ? "paused" : "failed",
      last_error: message.slice(0, 1000),
      last_run_at: nowIso(),
      locked_at: null,
      locked_by: null,
      cooldown_until: new Date(Date.now() + cooldownMs).toISOString(),
      next_run_at: new Date(Date.now() + cooldownMs).toISOString()
    })
    .eq("id", job.id);
  if (updateError) throw updateError;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string | number | boolean> = {};
  const queries: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--seed") {
      options.seed = true;
    } else if (arg === "--seed-content") {
      options.seedContent = true;
    } else if (arg === "--content-term-limit") {
      options.contentTermLimit = Number(args[i + 1]);
      i += 1;
    } else if (arg === "--query" || arg === "-q") {
      queries.push(args[i + 1]);
      i += 1;
    } else if (arg === "--limit" || arg === "-l") {
      options.limit = Number(args[i + 1]);
      i += 1;
    } else if (arg === "--max-pages") {
      options.maxPages = Number(args[i + 1]);
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }
  return { options, queries: queries.map(normalizeText).filter(Boolean) };
}

function printHelp() {
  console.log(`
Usage: npm run search:universes -- [options]

Options:
  --seed                 Seed the default Roblox keyword discovery jobs
  --seed-content         Seed terms from existing universes, games, articles, catalog, and wiki titles
  --content-term-limit   Max content-derived terms to seed (default: ${CONTENT_TERM_LIMIT})
  -q, --query <query>    Seed one query before processing
  -l, --limit <number>   Jobs to process this run (default: ${DEFAULT_JOB_LIMIT})
  --max-pages <number>   Search result pages per job (default: ${DEFAULT_MAX_PAGES})
  -h, --help             Show this help text

Side effects:
  Upserts new rows into roblox_universes, records roblox_universe_search_snapshots,
  and updates roblox_universe_discovery_jobs.
`);
}

async function main() {
  const { options, queries } = parseArgs();
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const contentTermLimit =
    typeof options.contentTermLimit === "number" &&
    Number.isFinite(options.contentTermLimit) &&
    options.contentTermLimit > 0
      ? options.contentTermLimit
      : CONTENT_TERM_LIMIT;
  const contentTerms = options.seedContent ? await fetchContentSeedTerms(contentTermLimit) : [];
  const seedQueries = [...contentTerms, ...queries, ...(options.seed ? buildSeedTerms() : [])];
  if (seedQueries.length) {
    const count = await seedJobs(seedQueries);
    console.log(`Seeded ${count} Roblox search discovery jobs (${contentTerms.length} content-derived terms).`);
  }

  const limit =
    typeof options.limit === "number" && Number.isFinite(options.limit) && options.limit >= 0
      ? options.limit
      : DEFAULT_JOB_LIMIT;
  const maxPages =
    typeof options.maxPages === "number" && Number.isFinite(options.maxPages) && options.maxPages > 0
      ? options.maxPages
      : DEFAULT_MAX_PAGES;

  await releaseStaleJobs();
  const jobs = await claimJobs(limit);
  if (!jobs.length) {
    console.log("No ready Roblox search discovery jobs.");
    return;
  }

  let totalResults = 0;
  let totalNew = 0;
  console.log(`Processing ${jobs.length} Roblox search jobs (max pages ${maxPages})...`);
  for (const job of jobs) {
    try {
      const result = await processJob(job, maxPages);
      await completeJob(job, result.results, result.newUniverses);
      totalResults += result.results;
      totalNew += result.newUniverses;
      console.log(`  • ${job.query}: ${result.results} results, ${result.newUniverses} new universes`);
    } catch (error) {
      await failJob(job, error);
      console.error(`  • ${job.query}: failed - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`Done. Search results: ${totalResults}; new universes: ${totalNew}.`);
}

main().catch((error) => {
  console.error("Roblox search discovery failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
