import { supabaseAdmin } from "@/lib/supabase-admin";

const GAME_DETAILS_API = "https://games.roblox.com/v1/games";

export type RobloxGameDetail = {
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
  created?: string;
  updated?: string;
  isSponsoredGame?: boolean;
  [key: string]: unknown;
};

export type UniverseDiscoveryCandidate = {
  universeId: number;
  rootPlaceId?: number | null;
  name?: string | null;
  description?: string | null;
  creatorId?: number | null;
  creatorName?: string | null;
  creatorType?: string | null;
  creatorHasVerifiedBadge?: boolean | null;
  query?: string | null;
  position?: number | null;
  raw?: Record<string, unknown> | null;
};

export type FetchJsonOptions = {
  userAgent: string;
  requestIntervalMs: number;
  retryLimit: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
};

let nextRequestAt = 0;

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value);
  return null;
}

export function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length ? value.trim() : null;
}

export function toBooleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function pickNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = toNumber(source[key]);
    if (value != null) return value;
  }
  return null;
}

export function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = toStringOrNull(source[key]);
    if (value) return value;
  }
  return null;
}

export function pickBoolean(source: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = toBooleanOrNull(source[key]);
    if (value != null) return value;
  }
  return null;
}

export function readPositiveNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function retryAfterMs(headers: Headers): number | null {
  const raw = headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const dateValue = Date.parse(raw);
  return Number.isNaN(dateValue) ? null : Math.max(0, dateValue - Date.now());
}

function jitter(ms: number): number {
  if (ms <= 0) return 0;
  return Math.round(ms * (0.75 + Math.random() * 0.5));
}

async function waitForRequestSlot(intervalMs: number) {
  const now = Date.now();
  if (nextRequestAt > now) await sleep(nextRequestAt - now);
  nextRequestAt = Date.now() + intervalMs;
}

export async function fetchJson(url: string, label: string, options: FetchJsonOptions): Promise<Record<string, unknown>> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= options.retryLimit; attempt += 1) {
    await waitForRequestSlot(options.requestIntervalMs);
    try {
      const res = await fetch(url, { headers: { "user-agent": options.userAgent, accept: "application/json" } });
      if (res.ok) return (await res.json()) as Record<string, unknown>;

      const body = await res.text().catch(() => "");
      const retryable = res.status === 429 || res.status >= 500;
      lastError = new Error(`Failed to fetch ${label} (${res.status}): ${body.slice(0, 400)}`);
      if (!retryable || attempt >= options.retryLimit) throw lastError;

      const delay =
        retryAfterMs(res.headers) ??
        jitter(Math.min(options.retryBaseDelayMs * 2 ** attempt, options.retryMaxDelayMs));
      console.warn(`${label} returned ${res.status}; retrying in ${Math.round(delay / 1000)}s.`);
      await sleep(delay);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt >= options.retryLimit) throw lastError;
      const delay = jitter(Math.min(options.retryBaseDelayMs * 2 ** attempt, options.retryMaxDelayMs));
      console.warn(`${label} failed; retrying in ${Math.round(delay / 1000)}s: ${lastError.message}`);
      await sleep(delay);
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${label}`);
}

export async function fetchGameDetails(universeIds: number[], options: FetchJsonOptions) {
  const details = new Map<number, RobloxGameDetail>();
  const uniqueIds = Array.from(new Set(universeIds.filter((id) => Number.isSafeInteger(id) && id > 0)));
  for (let i = 0; i < uniqueIds.length; i += 50) {
    const chunk = uniqueIds.slice(i, i + 50);
    const params = new URLSearchParams({ universeIds: chunk.join(",") });
    const raw = await fetchJson(`${GAME_DETAILS_API}?${params.toString()}`, "game details", options);
    const rows = Array.isArray(raw.data) ? (raw.data as RobloxGameDetail[]) : [];
    for (const row of rows) {
      if (typeof row.id === "number") details.set(row.id, row);
    }
  }
  return details;
}

async function fetchExistingUniverseIds(universeIds: number[]) {
  const existing = new Set<number>();
  const sb = supabaseAdmin();
  const uniqueIds = Array.from(new Set(universeIds));
  for (let i = 0; i < uniqueIds.length; i += 1000) {
    const chunk = uniqueIds.slice(i, i + 1000);
    const { data, error } = await sb.from("roblox_universes").select("universe_id").in("universe_id", chunk);
    if (error) throw new Error(`Failed to read existing universes: ${error.message}`);
    for (const row of (data ?? []) as Array<{ universe_id: number }>) {
      existing.add(row.universe_id);
    }
  }
  return existing;
}

export async function insertNewUniverseCandidates(params: {
  source: string;
  candidates: UniverseDiscoveryCandidate[];
  details: Map<number, RobloxGameDetail>;
  fetchedAt: string;
  dryRun?: boolean;
}) {
  const uniqueCandidates = Array.from(
    new Map(params.candidates.map((candidate) => [candidate.universeId, candidate])).values()
  ).filter((candidate) => Number.isSafeInteger(candidate.universeId) && candidate.universeId > 0);
  const existingIds = await fetchExistingUniverseIds(uniqueCandidates.map((candidate) => candidate.universeId));
  const insertRows = uniqueCandidates
    .filter((candidate) => !existingIds.has(candidate.universeId))
    .map((candidate) => {
      const detail = params.details.get(candidate.universeId);
      const rootPlaceId = detail?.rootPlaceId ?? candidate.rootPlaceId ?? null;
      if (!rootPlaceId) return null;
      const name = detail?.name ?? candidate.name ?? `Universe ${candidate.universeId}`;
      const creatorType = detail?.creator?.type ?? candidate.creatorType ?? null;
      const creatorId = detail?.creator?.id ?? candidate.creatorId ?? null;
      const creatorName = detail?.creator?.name ?? candidate.creatorName ?? null;
      const creatorIsGroup = creatorType?.toLowerCase() === "group";

      return {
        universe_id: candidate.universeId,
        root_place_id: rootPlaceId,
        name,
        slug: null,
        description: detail?.description ?? candidate.description ?? null,
        description_source: detail?.description ? "games" : candidate.description ? params.source : null,
        creator_id: creatorId,
        creator_name: creatorName,
        creator_type: creatorType,
        creator_has_verified_badge:
          typeof detail?.creator?.hasVerifiedBadge === "boolean"
            ? detail.creator.hasVerifiedBadge
            : candidate.creatorHasVerifiedBadge ?? null,
        group_id: creatorIsGroup ? creatorId : null,
        group_name: creatorIsGroup ? creatorName : null,
        genre: typeof detail?.genre === "string" ? detail.genre : null,
        genre_l1: typeof detail?.genre_l1 === "string" ? detail.genre_l1 : null,
        genre_l2: typeof detail?.genre_l2 === "string" ? detail.genre_l2 : null,
        playing: null,
        visits: null,
        favorites: null,
        likes: null,
        dislikes: null,
        is_sponsored: typeof detail?.isSponsoredGame === "boolean" ? detail.isSponsoredGame : null,
        raw_metadata: {
          source: params.source,
          query: candidate.query ?? null,
          position: candidate.position ?? null,
          fetched_at: params.fetchedAt,
          candidate: candidate.raw ?? null
        },
        raw_details: detail ? { games: detail } : {},
        created_at_api: typeof detail?.created === "string" ? detail.created : null,
        updated_at_api: typeof detail?.updated === "string" ? detail.updated : null,
        last_seen_in_search: params.fetchedAt,
        stats_tier: "NEW",
        stats_tier_reason: "discovered_not_refreshed",
        stats_tier_updated_at: params.fetchedAt
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  if (insertRows.length && !params.dryRun) {
    const sb = supabaseAdmin();
    for (let i = 0; i < insertRows.length; i += 500) {
      const chunk = insertRows.slice(i, i + 500);
      const { error } = await sb.from("roblox_universes").upsert(chunk, {
        onConflict: "universe_id",
        ignoreDuplicates: true
      });
      if (error) throw new Error(`Failed to insert discovered universes: ${error.message}`);
    }
  }

  return {
    candidates: uniqueCandidates.length,
    existing: existingIds.size,
    inserted: params.dryRun ? 0 : insertRows.length,
    insertable: insertRows.length
  };
}
