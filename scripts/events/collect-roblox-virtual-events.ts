import "../shared/load-env";

import { isDeepStrictEqual } from "node:util";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { enqueueRevalidationEvents, type RevalidationEvent } from "../shared/revalidation-events";

const VIRTUAL_EVENTS_API_BASE = "https://apis.roblox.com/virtual-events/v1/universes";
const CHUNK_SIZE = 200;
const DEFAULT_UNIVERSE_LIMIT = Number(process.env.ROBLOX_VIRTUAL_EVENTS_LIMIT ?? "100");
const REQUEST_DELAY_MS = Number(process.env.ROBLOX_VIRTUAL_EVENTS_DELAY_MS ?? "150");

type RawEvent = Record<string, unknown>;

type EventRow = {
  event_id: string;
  universe_id: number | null;
  place_id: number | null;
  title: string | null;
  display_title: string | null;
  subtitle: string | null;
  display_subtitle: string | null;
  description: string | null;
  display_description: string | null;
  tagline: string | null;
  start_utc: string | null;
  end_utc: string | null;
  created_utc: string | null;
  updated_utc: string | null;
  event_status: string | null;
  event_visibility: string | null;
  featuring_status: string | null;
  all_thumbnails_created: boolean | null;
  host_name: string | null;
  host_has_verified_badge: boolean | null;
  host_type: string | null;
  host_id: number | null;
  raw_event_json: RawEvent;
};

type CategoryRow = {
  event_id: string;
  category: string;
  rank: number;
};

type ThumbnailRow = {
  event_id: string;
  media_id: number;
  rank: number;
};

type StoredEventRow = EventRow & {
  first_live_at: string | null;
  categories: CategoryRow[];
  thumbnails: ThumbnailRow[];
};

const TIMESTAMP_FIELDS = new Set(["start_utc", "end_utc", "created_utc", "updated_utc"]);

function eventHasChanged(
  row: EventRow,
  stored: StoredEventRow | undefined,
  categories: CategoryRow[],
  thumbnails: ThumbnailRow[]
) {
  if (!stored) return true;
  const fieldsMatch = (Object.keys(row) as Array<keyof EventRow>).every((key) => {
    const incoming = row[key];
    const previous = stored[key];
    // Postgres returns timestamptz values with a different offset/precision spelling.
    if (TIMESTAMP_FIELDS.has(key) && typeof incoming === "string" && typeof previous === "string") {
      return Date.parse(incoming) === Date.parse(previous);
    }
    return isDeepStrictEqual(incoming, previous);
  });
  const byRank = <T extends { rank: number }>(rows: T[]) => [...rows].sort((a, b) => a.rank - b.rank);
  const needsFirstLiveAt = !stored.first_live_at &&
    row.event_status?.toLowerCase() === "active" && row.event_visibility?.toLowerCase() === "public";
  return !fieldsMatch || needsFirstLiveAt ||
    !isDeepStrictEqual(byRank(categories), byRank(stored.categories)) ||
    !isDeepStrictEqual(byRank(thumbnails), byRank(stored.thumbnails));
}

async function loadStoredEvents(eventIds: string[]): Promise<Map<string, StoredEventRow>> {
  const stored = new Map<string, StoredEventRow>();
  for (const chunk of chunkArray(eventIds, CHUNK_SIZE)) {
    const { data, error } = await supabaseAdmin()
      .from("roblox_virtual_events")
      .select("*, categories:roblox_virtual_event_categories(event_id, category, rank), thumbnails:roblox_virtual_event_thumbnails(event_id, media_id, rank)")
      .in("event_id", chunk);
    if (error) throw new Error(`Failed to load existing events: ${error.message}`);
    for (const row of (data ?? []) as StoredEventRow[]) stored.set(row.event_id, row);
  }
  return stored;
}

async function enqueueChangedUniverseRevalidation(universeIds: number[]) {
  const events: RevalidationEvent[] = [];
  const sb = supabaseAdmin();
  for (const chunk of chunkArray(universeIds, CHUNK_SIZE)) {
    const { data: wikis, error: wikiError } = await sb.from("wiki_pages")
      .select("slug, universe_id").in("universe_id", chunk).eq("is_published", true);
    if (wikiError) throw new Error(`Failed to look up event wiki pages: ${wikiError.message}`);
    for (const wiki of wikis ?? []) {
      if (wiki.slug) events.push({ type: "wiki", slug: wiki.slug });
    }

    const { data: pages, error: pageError } = await sb.from("events_pages")
      .select("slug, universe_id").in("universe_id", chunk).eq("is_published", true);
    if (pageError) throw new Error(`Failed to look up events pages: ${pageError.message}`);
    for (const page of pages ?? []) {
      if (page.slug) events.push({ type: "event", slug: page.slug });
    }

    const { data: universes, error: universeError } = await sb.from("roblox_universes")
      .select("slug").in("universe_id", chunk);
    if (universeError) throw new Error(`Failed to look up event stats pages: ${universeError.message}`);
    for (const universe of universes ?? []) {
      if (universe.slug) events.push({ type: "stats", slug: `games/${universe.slug}` });
    }

    // An event revalidation already refreshes codes/articles/quizzes sidebars.
    // Tools and checklists are also hosts, but the worker doesn't look those up.
    // Sidebar event links only exist for games with a published events page.
    const sidebarIds = (pages ?? []).filter((page) => page.slug).map((page) => page.universe_id);
    if (!sidebarIds.length) continue;
    for (const [table, column, publishedColumn, type] of [
      ["checklist_pages", "slug", "is_public", "checklist"],
      ["tools", "code", "is_published", "tool"]
    ] as const) {
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await sb.from(table).select(column)
          .in("universe_id", sidebarIds).eq(publishedColumn, true)
          .order("id").range(offset, offset + 999);
        if (error) throw new Error(`Failed to look up event sidebar hosts in ${table}: ${error.message}`);
        for (const row of (data ?? []) as unknown as Record<string, string | null>[]) {
          const slug = row[column];
          if (slug) events.push({ type, slug });
        }
        if (!data || data.length < 1000) break;
      }
    }

    // Collection layouts can inherit the universe from their parent wiki.
    const wikiSlugs = (wikis ?? [])
      .filter((wiki) => sidebarIds.includes(wiki.universe_id))
      .map((wiki) => wiki.slug).filter(Boolean);
    for (const inherited of [false, true]) {
      const filterChunks = inherited ? chunkArray(wikiSlugs, CHUNK_SIZE) : [sidebarIds];
      for (const filterChunk of filterChunks) {
        for (let offset = 0; ; offset += 1000) {
          let query = sb.from("wiki_collection_pages").select("wiki_slug, collection_slug")
            .eq("is_published", true).order("id").range(offset, offset + 999);
          query = inherited
            ? query.is("universe_id", null).in("wiki_slug", filterChunk)
            : query.in("universe_id", filterChunk);
          const { data, error } = await query;
          if (error) throw new Error(`Failed to look up event collection sidebars: ${error.message}`);
          for (const page of data ?? []) {
            if (page.wiki_slug && page.collection_slug) {
              events.push({ type: "wiki_collection", slug: `${page.wiki_slug}/${page.collection_slug}` });
            }
          }
          if (!data || data.length < 1000) break;
        }
      }
    }
  }
  const result = await enqueueRevalidationEvents(events, "virtual_events_vps");
  console.log(`Queued ${result.queued} virtual event revalidation event(s).`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function pickValue(source: Record<string, unknown> | null, keys: string[]): unknown {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return value;
  }
  return null;
}

function extractEvents(payload: unknown): RawEvent[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  const direct = pickValue(payload, ["data", "events"]);
  if (Array.isArray(direct)) return direct.filter(isRecord);
  if (isRecord(direct)) {
    const nested = pickValue(direct, ["data", "events", "items", "results"]);
    if (Array.isArray(nested)) return nested.filter(isRecord);
  }
  return [];
}

function extractArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) {
    const nested = pickValue(value, ["data", "items", "results"]);
    if (Array.isArray(nested)) return nested;
  }
  return [];
}

function assignRank(used: Set<number>, candidate: number | null, fallback: number): number {
  let rank = Number.isFinite(candidate ?? NaN) ? Math.floor(candidate as number) : fallback;
  if (!Number.isFinite(rank)) rank = fallback;
  if (rank < 0) rank = fallback;
  while (used.has(rank)) {
    rank += 1;
  }
  used.add(rank);
  return rank;
}

function buildEventRow(event: RawEvent, universeId: number | null): EventRow | null {
  const rawId = pickValue(event, ["id", "eventId", "event_id"]);
  const eventId = typeof rawId === "string" ? rawId.trim() : typeof rawId === "number" ? String(rawId) : null;
  if (!eventId) return null;

  const eventTimeRaw = pickValue(event, ["eventTime", "event_time"]);
  const eventTime = isRecord(eventTimeRaw) ? eventTimeRaw : null;

  const hostRaw = pickValue(event, ["host", "creator", "eventHost"]);
  const host = isRecord(hostRaw) ? hostRaw : null;

  const row: EventRow = {
    event_id: eventId,
    universe_id: normalizeNumber(pickValue(event, ["universeId", "universe_id"])) ?? universeId,
    place_id: normalizeNumber(pickValue(event, ["placeId", "place_id"])),
    title: normalizeText(pickValue(event, ["title"])),
    display_title: normalizeText(pickValue(event, ["displayTitle", "display_title"])),
    subtitle: normalizeText(pickValue(event, ["subtitle"])),
    display_subtitle: normalizeText(pickValue(event, ["displaySubtitle", "display_subtitle"])),
    description: normalizeText(pickValue(event, ["description"])),
    display_description: normalizeText(pickValue(event, ["displayDescription", "display_description"])),
    tagline: normalizeText(pickValue(event, ["tagline"])),
    start_utc: normalizeTimestamp(pickValue(eventTime, ["startUtc", "start_utc", "startUTC"])),
    end_utc: normalizeTimestamp(pickValue(eventTime, ["endUtc", "end_utc", "endUTC"])),
    created_utc: normalizeTimestamp(pickValue(event, ["createdUtc", "created_utc", "createdAt", "created_at"])),
    updated_utc: normalizeTimestamp(pickValue(event, ["updatedUtc", "updated_utc", "updatedAt", "updated_at"])),
    event_status: normalizeText(pickValue(event, ["eventStatus", "event_status", "status"])),
    event_visibility: normalizeText(pickValue(event, ["eventVisibility", "event_visibility", "visibility"])),
    featuring_status: normalizeText(pickValue(event, ["featuringStatus", "featuring_status"])),
    all_thumbnails_created: normalizeBoolean(pickValue(event, ["allThumbnailsCreated", "all_thumbnails_created"])),
    host_name: normalizeText(pickValue(host, ["name", "displayName"])) ?? normalizeText(pickValue(event, ["hostName", "host_name"])),
    host_has_verified_badge:
      normalizeBoolean(pickValue(host, ["hasVerifiedBadge", "has_verified_badge"])) ??
      normalizeBoolean(pickValue(event, ["hostHasVerifiedBadge", "host_has_verified_badge"])),
    host_type: normalizeText(pickValue(host, ["type", "hostType"])) ?? normalizeText(pickValue(event, ["hostType", "host_type"])),
    host_id: normalizeNumber(pickValue(host, ["id", "hostId", "host_id"])) ?? normalizeNumber(pickValue(event, ["hostId", "host_id"])),
    raw_event_json: event
  };

  return row;
}

function buildCategoryRows(event: RawEvent, eventId: string): CategoryRow[] {
  const raw = pickValue(event, ["eventCategories", "event_categories", "categories"]);
  const entries = extractArray(raw);
  const rows: CategoryRow[] = [];
  const usedRanks = new Set<number>();
  entries.forEach((entry, index) => {
    let categoryValue: unknown = entry;
    let rankValue: unknown = null;
    if (isRecord(entry)) {
      categoryValue = pickValue(entry, ["category", "name", "type", "displayName"]);
      rankValue = pickValue(entry, ["rank", "order", "index", "position"]);
    }
    const category = normalizeText(categoryValue);
    if (!category) return;
    const rank = assignRank(usedRanks, normalizeNumber(rankValue), index + 1);
    rows.push({ event_id: eventId, category, rank });
  });
  return rows;
}

function buildThumbnailRows(event: RawEvent, eventId: string): ThumbnailRow[] {
  const raw = pickValue(event, ["thumbnails", "media", "eventThumbnails"]);
  const entries = extractArray(raw);
  const rows: ThumbnailRow[] = [];
  const usedRanks = new Set<number>();
  entries.forEach((entry, index) => {
    let mediaValue: unknown = entry;
    let rankValue: unknown = null;
    if (isRecord(entry)) {
      mediaValue = pickValue(entry, ["mediaId", "media_id", "id", "assetId"]);
      rankValue = pickValue(entry, ["rank", "order", "index", "position"]);
    }
    const mediaId = normalizeNumber(mediaValue);
    if (mediaId === null) return;
    const rank = assignRank(usedRanks, normalizeNumber(rankValue), index + 1);
    rows.push({ event_id: eventId, media_id: mediaId, rank });
  });
  return rows;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function clampLimit(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(1, Math.floor(value));
}

async function sleep(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchVirtualEvents(universeId: number): Promise<RawEvent[]> {
  const url = `${VIRTUAL_EVENTS_API_BASE}/${universeId}/virtual-events`;
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "BloxodesVirtualEvents/1.0"
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch virtual events (${res.status}): ${body.slice(0, 200)}`);
  }
  const payload = await res.json();
  return extractEvents(payload);
}

async function upsertEvents(rows: EventRow[]) {
  if (!rows.length) return;
  const sb = supabaseAdmin();
  for (const chunk of chunkArray(rows, CHUNK_SIZE)) {
    const { error } = await sb.from("roblox_virtual_events").upsert(chunk, { onConflict: "event_id" });
    if (error) {
      throw new Error(`Failed to upsert events: ${error.message}`);
    }
  }
}

async function replaceChildRows<T extends CategoryRow | ThumbnailRow>(table: string, storedRows: T[], rows: T[]) {
  const sb = supabaseAdmin();
  for (const chunk of chunkArray(rows, CHUNK_SIZE)) {
    const { error } = await sb.from(table).upsert(chunk, { onConflict: "event_id,rank" });
    if (error) {
      throw new Error(`Failed to upsert ${table} rows: ${error.message}`);
    }
  }

  // Only remove stored ranks that disappeared, after all upserts succeed.
  const incomingKeys = new Set(rows.map((row) => JSON.stringify([row.event_id, row.rank])));
  const staleRanks = new Map<string, number[]>();
  for (const row of storedRows) {
    if (incomingKeys.has(JSON.stringify([row.event_id, row.rank]))) continue;
    const ranks = staleRanks.get(row.event_id) ?? [];
    ranks.push(row.rank);
    staleRanks.set(row.event_id, ranks);
  }
  for (const [eventId, ranks] of staleRanks) {
    for (const chunk of chunkArray(ranks, CHUNK_SIZE)) {
      const { error } = await sb.from(table).delete().eq("event_id", eventId).in("rank", chunk);
      if (error) throw new Error(`Failed to delete stale ${table} rows: ${error.message}`);
    }
  }
}

async function stampFirstLiveAt(eventIds: string[]) {
  if (!eventIds.length) return;
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("roblox_virtual_events")
    .update({ first_live_at: new Date().toISOString() })
    .in("event_id", eventIds)
    .is("first_live_at", null)
    .ilike("event_status", "active")
    .ilike("event_visibility", "public");

  if (error) {
    throw new Error(`Failed to stamp first_live_at: ${error.message}`);
  }
}

async function fetchTopUniverses(limit: number): Promise<number[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_universes")
    .select("universe_id, playing")
    .not("playing", "is", null)
    .order("playing", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(`Failed to fetch top universes: ${error.message}`);
  }
  return (data ?? [])
    .map((row) => (typeof row?.universe_id === "number" ? row.universe_id : null))
    .filter((value): value is number => typeof value === "number");
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in environment.");
  }

  const arg = process.env.ROBLOX_VIRTUAL_EVENTS_UNIVERSE_ID ?? process.argv[2];
  const limit = clampLimit(DEFAULT_UNIVERSE_LIMIT, 100);
  const universeIds = arg
    ? [Number(arg)].filter((value) => Number.isFinite(value))
    : await fetchTopUniverses(limit);

  if (!universeIds.length) {
    console.log("No universe IDs available to fetch.");
    return;
  }

  console.log(`Fetching virtual events for ${universeIds.length} universes...`);
  const updatedUniverses = new Set<number>();

  for (const universeId of universeIds) {
    try {
      const events = await fetchVirtualEvents(universeId);
      if (!events.length) {
        console.log(`  • ${universeId}: no events`);
        continue;
      }

      const eventMap = new Map<string, EventRow>();
      const categories = new Map<string, CategoryRow[]>();
      const thumbnails = new Map<string, ThumbnailRow[]>();

      events.forEach((event) => {
        const row = buildEventRow(event, universeId);
        if (!row) return;
        eventMap.set(row.event_id, row);
        categories.set(row.event_id, buildCategoryRows(event, row.event_id));
        thumbnails.set(row.event_id, buildThumbnailRows(event, row.event_id));
      });

      const eventRows = Array.from(eventMap.values());
      if (!eventRows.length) {
        console.log(`  • ${universeId}: no valid events`);
        continue;
      }

      const stored = await loadStoredEvents(eventRows.map((row) => row.event_id));
      const changedRows = eventRows.filter((row) => eventHasChanged(
        row, stored.get(row.event_id), categories.get(row.event_id) ?? [], thumbnails.get(row.event_id) ?? []
      ));
      for (const chunk of chunkArray(changedRows, CHUNK_SIZE)) {
        await upsertEvents(chunk);
        // Keep successful writes eligible for refresh even if child writes fail.
        for (const row of chunk) {
          if (row.universe_id !== null) updatedUniverses.add(row.universe_id);
          const previousUniverseId = stored.get(row.event_id)?.universe_id;
          if (previousUniverseId != null) updatedUniverses.add(previousUniverseId);
        }
        const eventIds = chunk.map((row) => row.event_id);
        await stampFirstLiveAt(eventIds);
        await replaceChildRows(
          "roblox_virtual_event_categories",
          chunk.flatMap((row) => stored.get(row.event_id)?.categories ?? []),
          chunk.flatMap((row) => categories.get(row.event_id) ?? [])
        );
        await replaceChildRows(
          "roblox_virtual_event_thumbnails",
          chunk.flatMap((row) => stored.get(row.event_id)?.thumbnails ?? []),
          chunk.flatMap((row) => thumbnails.get(row.event_id) ?? [])
        );
      }

      console.log(
        `  • ${universeId}: ${eventRows.length} events, ${changedRows.length} changed`
      );
    } catch (error) {
      console.error(`  • ${universeId}: failed -`, (error as Error).message);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  if (updatedUniverses.size) {
    const changedUniverseIds = Array.from(updatedUniverses);
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await enqueueChangedUniverseRevalidation(changedUniverseIds);
        break;
      } catch (error) {
        console.error(`Virtual event revalidation attempt ${attempt}/${maxAttempts} failed:`, (error as Error).message);
        if (attempt === maxAttempts) {
          console.error(`Virtual event revalidation was not queued for universe IDs: ${changedUniverseIds.join(", ")}`);
          process.exitCode = 1;
        } else {
          await sleep(250 * attempt);
        }
      }
    }
  }
  console.log("Virtual events collection complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
