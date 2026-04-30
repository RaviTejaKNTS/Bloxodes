import "../shared/load-env";

import { randomUUID } from "node:crypto";

import { slugify } from "@/lib/slug";
import { supabaseAdmin } from "@/lib/supabase-admin";

const GAME_DETAILS_API = "https://games.roblox.com/v1/games";
const GROUP_GAMES_API = (groupId: number) => `https://games.roblox.com/v2/groups/${groupId}/gamesV2`;
const USER_GAMES_API = (userId: number) => `https://games.roblox.com/v2/users/${userId}/games`;
const USER_AGENT = "BloxodesCreatorExpansion/1.0";

const DEFAULT_JOB_LIMIT = Number(process.env.ROBLOX_CREATOR_EXPAND_JOB_LIMIT ?? "50");
const DEFAULT_SEED_LIMIT = Number(process.env.ROBLOX_CREATOR_EXPAND_SEED_LIMIT ?? "1000");
const DEFAULT_MAX_PAGES = Number(process.env.ROBLOX_CREATOR_EXPAND_MAX_PAGES ?? "3");
const REQUEST_INTERVAL_MS = Number(process.env.ROBLOX_CREATOR_EXPAND_REQUEST_INTERVAL_MS ?? "1200");
const RETRY_LIMIT = Number(process.env.ROBLOX_CREATOR_EXPAND_RETRY_LIMIT ?? "5");
const RETRY_BASE_DELAY_MS = Number(process.env.ROBLOX_CREATOR_EXPAND_RETRY_BASE_DELAY_MS ?? "5000");
const RETRY_MAX_DELAY_MS = Number(process.env.ROBLOX_CREATOR_EXPAND_RETRY_MAX_DELAY_MS ?? "90000");
const STALE_LOCK_MINUTES = Number(process.env.ROBLOX_CREATOR_EXPAND_STALE_LOCK_MINUTES ?? "60");

type DiscoveryJob = {
  id: string;
  job_key: string;
  source: string;
  strategy: "group_games" | "user_games";
  query: string | null;
  params: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

type CreatorSeedRow = {
  creator_id: number | null;
  creator_type: string | null;
  creator_name: string | null;
  group_id: number | null;
  group_name: string | null;
  quality_score: number | null;
  is_quality_candidate: boolean | null;
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

type CreatorGameCandidate = {
  universeId: number;
  rootPlaceId: number | null;
  name: string | null;
  description: string | null;
  creatorId: number | null;
  creatorName: string | null;
  creatorType: string | null;
  raw: Record<string, unknown>;
};

type CreatorPage = {
  candidates: CreatorGameCandidate[];
  nextCursor: string | null;
};

let nextRequestAt = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length ? value.trim() : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function pickNumber(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = toNumber(source[key]);
    if (value != null) return value;
  }
  return null;
}

function pickString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = toStringOrNull(source[key]);
    if (value) return value;
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

function normalizeCreatorType(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function buildCreatorJob(row: CreatorSeedRow) {
  const creatorType = normalizeCreatorType(row.creator_type);
  const groupId = row.group_id ?? (creatorType === "group" ? row.creator_id : null);
  if (groupId) {
    return {
      job_key: `roblox-creator:group:${groupId}`,
      source: "roblox_creator",
      strategy: "group_games",
      query: `group:${groupId}`,
      params: {
        groupId,
        groupName: row.group_name ?? (creatorType === "group" ? row.creator_name : null)
      },
      status: "pending",
      priority: Math.max(Math.round(row.quality_score ?? 0), 1),
      next_run_at: nowIso()
    };
  }

  if (creatorType === "user" && row.creator_id) {
    return {
      job_key: `roblox-creator:user:${row.creator_id}`,
      source: "roblox_creator",
      strategy: "user_games",
      query: `user:${row.creator_id}`,
      params: {
        userId: row.creator_id,
        userName: row.creator_name
      },
      status: "pending",
      priority: Math.max(Math.round(row.quality_score ?? 0), 1),
      next_run_at: nowIso()
    };
  }

  return null;
}

async function seedCreatorJobs(seedLimit: number, qualityOnly: boolean) {
  const sb = supabaseAdmin();
  let query = sb
    .from("roblox_universes")
    .select("creator_id, creator_type, creator_name, group_id, group_name, quality_score, is_quality_candidate")
    .or("creator_id.not.is.null,group_id.not.is.null")
    .order("quality_score", { ascending: false })
    .limit(seedLimit);

  if (qualityOnly) {
    query = query.eq("is_quality_candidate", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = ((data ?? []) as unknown) as CreatorSeedRow[];
  const jobs = rows
    .map(buildCreatorJob)
    .filter((value): value is NonNullable<typeof value> => value != null);

  const uniqueJobs = Array.from(new Map(jobs.map((job) => [job.job_key, job])).values());
  if (!uniqueJobs.length) return 0;

  const { error: upsertError } = await sb
    .from("roblox_universe_discovery_jobs")
    .upsert(uniqueJobs, { onConflict: "job_key", ignoreDuplicates: true });
  if (upsertError) throw upsertError;
  return uniqueJobs.length;
}

async function claimJobs(limit: number): Promise<DiscoveryJob[]> {
  if (limit <= 0) return [];
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_universe_discovery_jobs")
    .select("id, job_key, source, strategy, query, params, attempts, max_attempts")
    .eq("source", "roblox_creator")
    .in("status", ["pending", "failed"])
    .lte("next_run_at", nowIso())
    .or(`cooldown_until.is.null,cooldown_until.lte.${nowIso()}`)
    .order("priority", { ascending: false })
    .order("next_run_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const jobs = ((data ?? []) as DiscoveryJob[]).filter(
    (job) => job.strategy === "group_games" || job.strategy === "user_games"
  );
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
      last_error: `Released stale roblox_creator lock after ${STALE_LOCK_MINUTES} minutes`,
      next_run_at: nowIso()
    }, { count: "exact" })
    .eq("source", "roblox_creator")
    .eq("status", "in_progress")
    .lt("locked_at", cutoff);
  if (error) throw error;
  if (count) {
    console.log(`Released ${count} stale Roblox creator expansion jobs.`);
  }
}

function buildCreatorGamesUrl(job: DiscoveryJob, cursor: string | null) {
  const params = new URLSearchParams({
    accessFilter: "Public",
    sortOrder: "Asc",
    limit: "100"
  });
  if (cursor) params.set("cursor", cursor);

  if (job.strategy === "group_games") {
    const groupId = toNumber(job.params.groupId);
    if (!groupId) throw new Error(`Creator expansion job ${job.id} is missing groupId`);
    return `${GROUP_GAMES_API(groupId)}?${params.toString()}`;
  }

  const userId = toNumber(job.params.userId);
  if (!userId) throw new Error(`Creator expansion job ${job.id} is missing userId`);
  return `${USER_GAMES_API(userId)}?${params.toString()}`;
}

function normalizeCandidate(value: unknown, job: DiscoveryJob): CreatorGameCandidate | null {
  const source = readRecord(value);
  if (!source) return null;
  const universeId = pickNumber(source, ["id", "universeId", "universe_id"]);
  if (!universeId) return null;

  const creator = readRecord(source.creator);
  const creatorId =
    creator && pickNumber(creator, ["id", "creatorId"]) != null
      ? pickNumber(creator, ["id", "creatorId"])
      : job.strategy === "group_games"
        ? toNumber(job.params.groupId)
        : toNumber(job.params.userId);
  const creatorType =
    creator && pickString(creator, ["type", "creatorType"])
      ? pickString(creator, ["type", "creatorType"])
      : job.strategy === "group_games"
        ? "Group"
        : "User";

  return {
    universeId,
    rootPlaceId: pickNumber(source, ["rootPlaceId", "root_place_id", "placeId"]),
    name: pickString(source, ["name", "displayName", "title"]),
    description: pickString(source, ["description"]),
    creatorId,
    creatorName:
      (creator ? pickString(creator, ["name", "creatorName", "username"]) : null) ??
      toStringOrNull(job.params.groupName) ??
      toStringOrNull(job.params.userName),
    creatorType,
    raw: source
  };
}

async function fetchCreatorPage(job: DiscoveryJob, cursor: string | null): Promise<CreatorPage> {
  const raw = await fetchJson(buildCreatorGamesUrl(job, cursor), job.query ?? job.job_key);
  const data = Array.isArray(raw.data) ? raw.data : [];
  return {
    candidates: data
      .map((value) => normalizeCandidate(value, job))
      .filter((value): value is CreatorGameCandidate => value != null),
    nextCursor: toStringOrNull(raw.nextPageCursor) ?? toStringOrNull(raw.nextCursor)
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

function mapCandidateToUniversePayload(
  candidate: CreatorGameCandidate,
  detail: RobloxGameDetail | undefined,
  fetchedAt: string
) {
  const rootPlaceId = detail?.rootPlaceId ?? candidate.rootPlaceId;
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
      typeof detail?.creator?.hasVerifiedBadge === "boolean" ? detail.creator.hasVerifiedBadge : null,
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
    is_sponsored: typeof detail?.isSponsoredGame === "boolean" ? detail.isSponsoredGame : null,
    last_seen_in_search: fetchedAt,
    raw_details: detail ? { games: detail } : {},
    raw_metadata: { discovery: { source: "roblox_creator", fetched_at: fetchedAt } },
    discovery_sources: ["roblox_creator"]
  };
}

async function processJob(job: DiscoveryJob, maxPages: number) {
  const sb = supabaseAdmin();
  const fetchedAt = nowIso();
  const sessionId = randomUUID();
  const candidatesById = new Map<number, CreatorGameCandidate>();
  let cursor: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const result = await fetchCreatorPage(job, cursor);
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
    .map((candidate) => mapCandidateToUniversePayload(candidate, details.get(candidate.universeId), fetchedAt))
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
    query: job.query ?? job.job_key,
    universe_id: candidate.universeId,
    place_id: details.get(candidate.universeId)?.rootPlaceId ?? candidate.rootPlaceId,
    position: index,
    session_id: sessionId,
    source: "creator-expansion",
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
  const nextRunAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
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
  const options: Record<string, string | number | boolean> = {
    seed: false,
    qualityOnly: false
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--seed") {
      options.seed = true;
    } else if (arg === "--quality-creators-only") {
      options.qualityOnly = true;
    } else if (arg === "--all-creators") {
      options.qualityOnly = false;
    } else if (arg === "--seed-limit") {
      options.seedLimit = Number(args[i + 1]);
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
  return options;
}

function printHelp() {
  console.log(`
Usage: npm run expand:creators -- [options]

Options:
  --seed                 Seed creator/group expansion jobs from roblox_universes
  --quality-creators-only  Seed from only is_quality_candidate creators
  --all-creators           Seed from all creators (default)
  --seed-limit <number>    Max universe rows to inspect when seeding (default: ${DEFAULT_SEED_LIMIT})
  -l, --limit <number>     Creator expansion jobs to process (default: ${DEFAULT_JOB_LIMIT})
  --max-pages <number>     Creator game pages per job (default: ${DEFAULT_MAX_PAGES})
  -h, --help               Show this help text
`);
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const seedLimit =
    typeof options.seedLimit === "number" && Number.isFinite(options.seedLimit) && options.seedLimit > 0
      ? options.seedLimit
      : DEFAULT_SEED_LIMIT;
  if (options.seed) {
    const seeded = await seedCreatorJobs(seedLimit, options.qualityOnly !== false);
    console.log(
      `Seeded ${seeded} Roblox creator expansion jobs (${options.qualityOnly !== false ? "quality creators only" : "all creators"}).`
    );
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
    console.log("No ready Roblox creator expansion jobs.");
    return;
  }

  let totalResults = 0;
  let totalNew = 0;
  console.log(`Processing ${jobs.length} Roblox creator expansion jobs (max pages ${maxPages})...`);
  for (const job of jobs) {
    try {
      const result = await processJob(job, maxPages);
      await completeJob(job, result.results, result.newUniverses);
      totalResults += result.results;
      totalNew += result.newUniverses;
      console.log(`  • ${job.query ?? job.job_key}: ${result.results} results, ${result.newUniverses} new universes`);
    } catch (error) {
      await failJob(job, error);
      console.error(`  • ${job.query ?? job.job_key}: failed - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`Done. Creator expansion results: ${totalResults}; new universes: ${totalNew}.`);
}

main().catch((error) => {
  console.error("Roblox creator expansion failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
