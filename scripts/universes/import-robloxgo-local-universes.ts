import "../shared/load-env";

import * as cheerio from "cheerio";

import { cleanRobloxUniverseDisplayName } from "@/lib/roblox/display-name";
import { slugify } from "@/lib/slug";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ROBLOXGO_BASE = "https://www.robloxgo.com";
const PLACE_TO_UNIVERSE_API = (placeId: number) =>
  `https://apis.roblox.com/universes/v1/places/${placeId}/universe`;
const GAME_DETAILS_API = "https://games.roblox.com/v1/games";

const DEFAULT_PAGE_DELAY_MS = Number(process.env.ROBLOXGO_PAGE_DELAY_MS ?? "700");
const DEFAULT_PAGE_RETRY_LIMIT = Number(process.env.ROBLOXGO_PAGE_RETRY_LIMIT ?? "3");
const DEFAULT_RESOLVE_CONCURRENCY = Number(process.env.ROBLOXGO_RESOLVE_CONCURRENCY ?? "1");
const DEFAULT_RESOLVE_INTERVAL_MS = Number(process.env.ROBLOX_RESOLVE_INTERVAL_MS ?? "1100");
const DEFAULT_RESOLVE_RETRY_LIMIT = Number(process.env.ROBLOX_RESOLVE_RETRY_LIMIT ?? "5");
const DEFAULT_DETAIL_DELAY_MS = Number(process.env.ROBLOX_DETAIL_DELAY_MS ?? "1000");
const DEFAULT_DETAIL_RETRY_LIMIT = Number(process.env.ROBLOX_DETAIL_RETRY_LIMIT ?? "5");
const DEFAULT_MAX_PAGES_PER_ROUTE = Number(process.env.ROBLOXGO_MAX_PAGES_PER_ROUTE ?? "50");
const DEFAULT_USER_AGENT =
  process.env.ROBLOXGO_USER_AGENT ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type Options = {
  apply: boolean;
  clean: boolean;
  maxPagesPerRoute: number | null;
  maxRoutes: number | null;
  routeFilters: string[];
  pageDelayMs: number;
  resolveConcurrency: number;
  resolveIntervalMs: number;
  placeIdLimit: number | null;
};

type RouteSeed = {
  path: string;
  label: string;
};

type PageResult = {
  path: string;
  placeIds: number[];
  routeLinks: string[];
  maxPage: number;
};

type RobloxGameDetail = {
  id: number;
  rootPlaceId?: number;
  name?: string;
  description?: string;
  created?: string;
  updated?: string;
  creator?: {
    id?: number;
    name?: string;
    type?: string;
    hasVerifiedBadge?: boolean;
  };
  genre?: string;
  genre_l1?: string;
  genre_l2?: string;
  isAllGenre?: boolean;
  price?: number;
  voiceEnabled?: boolean;
  serverSize?: number;
  maxPlayers?: number;
  playing?: number;
  visits?: number;
  favorites?: number;
  favoritedCount?: number;
  votes?: {
    upVotes?: number;
    downVotes?: number;
  };
  totalUpVotes?: number;
  totalDownVotes?: number;
  isSponsoredGame?: boolean;
  universeAvatarType?: string;
  ageRecommendation?: string;
  createVipServersAllowed?: boolean;
  studioAccessToApisAllowed?: boolean;
  [key: string]: unknown;
};

type UniverseInsert = {
  universe_id: number;
  root_place_id: number;
  name: string;
  display_name: string | null;
  slug: string;
  description: string | null;
  description_source: string | null;
  creator_id: number | null;
  creator_name: string | null;
  creator_type: string | null;
  creator_has_verified_badge: boolean | null;
  genre: string | null;
  genre_l1: string | null;
  genre_l2: string | null;
  is_all_genre: boolean | null;
  price: number | null;
  voice_chat_enabled: boolean | null;
  server_size: number | null;
  max_players: number | null;
  playing: number | null;
  visits: number | null;
  favorites: number | null;
  likes: number | null;
  dislikes: number | null;
  is_sponsored: boolean | null;
  age_rating: string | null;
  universe_avatar_type: string | null;
  create_vip_servers_allowed: boolean | null;
  studio_access_allowed: boolean | null;
  created_at_api: string | null;
  updated_at_api: string | null;
  raw_details: Record<string, unknown>;
  raw_metadata: Record<string, unknown>;
};

const STATIC_ROUTES: RouteSeed[] = [
  { path: "/games/most_played", label: "Most played games" },
  { path: "/games/new", label: "New games" },
  { path: "/games/top_ranked", label: "Top ranked games" },
  { path: "/games/favorite", label: "Favorite games" },
  { path: "/games/vote_up", label: "Most liked games" }
];

const NULLABLE_UNIVERSE_REFERENCES = [
  "article_generation_artifacts",
  "article_generation_queue",
  "articles",
  "catalog_pages",
  "event_guide_generation_queue",
  "games",
  "quiz_pages",
  "tools",
  "wiki_catalog_pages",
  "wiki_pages"
];

const DELETE_UNIVERSE_REFERENCES = [
  "checklist_pages",
  "events_pages",
  "game_list_entries",
  "roblox_universe_badges",
  "roblox_universe_gamepasses",
  "roblox_universe_media",
  "roblox_universe_place_servers",
  "roblox_universe_rank_snapshots",
  "roblox_universe_search_snapshots",
  "roblox_universe_social_links",
  "roblox_universe_sort_entries",
  "roblox_universe_stats_daily",
  "roblox_universe_stats_hourly",
  "roblox_virtual_events"
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    apply: false,
    clean: true,
    maxPagesPerRoute: DEFAULT_MAX_PAGES_PER_ROUTE,
    maxRoutes: null,
    routeFilters: [],
    pageDelayMs: DEFAULT_PAGE_DELAY_MS,
    resolveConcurrency: DEFAULT_RESOLVE_CONCURRENCY,
    resolveIntervalMs: DEFAULT_RESOLVE_INTERVAL_MS,
    placeIdLimit: null
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--no-clean") {
      options.clean = false;
    } else if (arg === "--max-pages-per-route") {
      options.maxPagesPerRoute = readPositiveInteger(args[i + 1], "max-pages-per-route");
      i += 1;
    } else if (arg === "--max-routes") {
      options.maxRoutes = readPositiveInteger(args[i + 1], "max-routes");
      i += 1;
    } else if (arg === "--route") {
      const value = args[i + 1]?.trim();
      if (!value) throw new Error("--route requires a path or substring");
      options.routeFilters.push(value);
      i += 1;
    } else if (arg === "--page-delay-ms") {
      options.pageDelayMs = readPositiveInteger(args[i + 1], "page-delay-ms");
      i += 1;
    } else if (arg === "--resolve-concurrency") {
      options.resolveConcurrency = readPositiveInteger(args[i + 1], "resolve-concurrency");
      i += 1;
    } else if (arg === "--resolve-interval-ms") {
      options.resolveIntervalMs = readPositiveInteger(args[i + 1], "resolve-interval-ms");
      i += 1;
    } else if (arg === "--place-id-limit") {
      options.placeIdLimit = readPositiveInteger(args[i + 1], "place-id-limit");
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function readPositiveInteger(value: string | undefined, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`--${label} must be a non-negative integer`);
  }
  return parsed;
}

function printHelp() {
  console.log(`
Usage: tsx scripts/universes/import-robloxgo-local-universes.ts [options]

One-time local-only RobloxGo seed import. It fetches public RobloxGo pages,
extracts Roblox place IDs from /game/<placeId>/ links, resolves universe IDs
through Roblox, and inserts official Roblox game rows into local roblox_universes.

Options:
  --apply                     Write to local Supabase. Without this, dry-run only.
  --no-clean                  Do not clean local universe rows before inserting.
  --max-pages-per-route <n>   Limit pages per route. Default ${DEFAULT_MAX_PAGES_PER_ROUTE}; 0 means no pages.
  --max-routes <n>            Limit routes after discovery.
  --route <text>              Only process routes containing this text. Repeatable.
  --page-delay-ms <n>         Delay between RobloxGo page requests. Default ${DEFAULT_PAGE_DELAY_MS}.
  --resolve-concurrency <n>   Concurrent Roblox place resolution requests. Default ${DEFAULT_RESOLVE_CONCURRENCY}.
  --resolve-interval-ms <n>   Minimum delay between resolver requests. Default ${DEFAULT_RESOLVE_INTERVAL_MS}.
  --place-id-limit <n>        Limit unique place IDs before resolving. Useful for local smoke imports.
  -h, --help                  Show this help.
`);
}

function isLocalSupabaseUrl(value: string | undefined) {
  return Boolean(value && /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/i.test(value));
}

function assertLocalSupabase() {
  if (isLocalSupabaseUrl(process.env.SUPABASE_URL)) return;
  throw new Error(
    `Refusing to write because SUPABASE_URL is not local (${process.env.SUPABASE_URL ?? "unset"}).`
  );
}

async function fetchText(url: string, label: string) {
  for (let attempt = 0; attempt <= DEFAULT_PAGE_RETRY_LIMIT; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          "user-agent": DEFAULT_USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });
    } catch (error) {
      if (attempt >= DEFAULT_PAGE_RETRY_LIMIT) throw error;
      const delay = Math.min(30_000, 2_000 * (attempt + 1));
      console.warn(`  ${label} fetch error; retrying in ${Math.round(delay / 1000)}s`);
      await sleep(delay);
      continue;
    }

    if (res.ok) return res.text();

    const body = await res.text().catch(() => "");
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= DEFAULT_PAGE_RETRY_LIMIT) {
      throw new Error(`${label} failed (${res.status}): ${body.slice(0, 240)}`);
    }

    const delay = retryAfterMs(res.headers) ?? Math.min(30_000, 2_000 * (attempt + 1));
    console.warn(`  ${label} got ${res.status}; retrying in ${Math.round(delay / 1000)}s`);
    await sleep(delay);
  }

  throw new Error(`${label} failed after retries`);
}

function normalizeRoutePath(value: string) {
  try {
    const parsed = new URL(value, ROBLOXGO_BASE);
    if (parsed.origin !== ROBLOXGO_BASE) return null;
    return parsed.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
}

function extractPlaceIdFromGameHref(href: string) {
  const path = normalizeRoutePath(href);
  if (!path) return null;
  const match = path.match(/^\/game\/(\d+)(?:\/|$)/);
  return match ? Number(match[1]) : null;
}

function extractSeedRouteLinks($: cheerio.CheerioAPI) {
  const routes = new Set<string>();
  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    const path = normalizeRoutePath(href);
    if (!path) return;
    if (/^\/(?:genres|chart|list)\/[a-z0-9_-]+$/i.test(path)) {
      routes.add(path);
    }
  });
  return Array.from(routes).sort();
}

function parsePage(path: string, html: string): PageResult {
  const $ = cheerio.load(html);
  const placeIds = new Set<number>();
  const routeLinks = extractSeedRouteLinks($);
  const basePath = path.replace(/\/\d+$/, "");
  let maxPage = 1;

  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    const placeId = extractPlaceIdFromGameHref(href);
    if (placeId) {
      placeIds.add(placeId);
      return;
    }

    const routePath = normalizeRoutePath(href);
    if (!routePath || !routePath.startsWith(`${basePath}/`)) return;
    const pageMatch = routePath.slice(basePath.length + 1).match(/^(\d+)$/);
    if (pageMatch) {
      maxPage = Math.max(maxPage, Number(pageMatch[1]));
    }
  });

  return {
    path,
    placeIds: Array.from(placeIds),
    routeLinks,
    maxPage
  };
}

async function discoverRoutes() {
  const routeMap = new Map(STATIC_ROUTES.map((route) => [route.path, route]));
  const indexPaths = ["/charts", "/lists", "/genres"];

  for (const indexPath of indexPaths) {
    const html = await fetchText(`${ROBLOXGO_BASE}${indexPath}`, `RobloxGo ${indexPath}`);
    const $ = cheerio.load(html);
    for (const path of extractSeedRouteLinks($)) {
      routeMap.set(path, { path, label: path });
    }
    console.log(`Discovered ${routeMap.size} total route seeds after ${indexPath}.`);
    await sleep(DEFAULT_PAGE_DELAY_MS);
  }

  return Array.from(routeMap.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function routePagePath(routePath: string, page: number) {
  return page === 1 ? routePath : `${routePath}/${page}`;
}

async function collectPlaceIds(routes: RouteSeed[], options: Options) {
  const placeIds = new Set<number>();
  const failedPages: Array<{ path: string; error: string }> = [];
  const routeSummaries: Array<{ path: string; pages: number; placeIds: number }> = [];

  for (const [routeIndex, route] of routes.entries()) {
    console.log(`\n[${routeIndex + 1}/${routes.length}] ${route.path}`);
    const firstPagePath = routePagePath(route.path, 1);
    let firstPage: PageResult;

    try {
      const html = await fetchText(`${ROBLOXGO_BASE}${firstPagePath}`, firstPagePath);
      firstPage = parsePage(firstPagePath, html);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failedPages.push({ path: firstPagePath, error: message });
      console.warn(`  failed first page: ${message}`);
      continue;
    }

    let pagesToFetch = firstPage.maxPage;
    if (options.maxPagesPerRoute != null) {
      pagesToFetch = Math.min(pagesToFetch, options.maxPagesPerRoute);
    }

    let routePlaceCount = 0;
    for (const placeId of firstPage.placeIds) {
      if (!placeIds.has(placeId)) routePlaceCount += 1;
      placeIds.add(placeId);
    }
    const capNote = pagesToFetch < firstPage.maxPage ? `, capped from ${firstPage.maxPage}` : "";
    console.log(`  page 1/${pagesToFetch}: ${firstPage.placeIds.length} links, max page ${firstPage.maxPage}${capNote}`);

    for (let page = 2; page <= pagesToFetch; page += 1) {
      const pagePath = routePagePath(route.path, page);
      await sleep(options.pageDelayMs);
      try {
        const html = await fetchText(`${ROBLOXGO_BASE}${pagePath}`, pagePath);
        const parsed = parsePage(pagePath, html);
        let newForRoute = 0;
        for (const placeId of parsed.placeIds) {
          if (!placeIds.has(placeId)) newForRoute += 1;
          placeIds.add(placeId);
        }
        routePlaceCount += newForRoute;
        console.log(`  page ${page}/${pagesToFetch}: ${parsed.placeIds.length} links, ${newForRoute} new`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failedPages.push({ path: pagePath, error: message });
        console.warn(`  failed page ${page}: ${message}`);
      }
    }

    routeSummaries.push({ path: route.path, pages: pagesToFetch, placeIds: routePlaceCount });
  }

  return {
    placeIds: Array.from(placeIds),
    failedPages,
    routeSummaries
  };
}

class FetchHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs: number | null
  ) {
    super(message);
  }
}

function retryAfterMs(headers: Headers) {
  const value = headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(seconds * 1000, 0);
  const dateMs = Date.parse(value);
  return Number.isNaN(dateMs) ? null : Math.max(dateMs - Date.now(), 0);
}

async function fetchJson<T>(url: string, label: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "user-agent": "BloxodesRobloxOfficialResolver/1.0",
      accept: "application/json"
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new FetchHttpError(`${label} failed (${res.status}): ${body.slice(0, 240)}`, res.status, retryAfterMs(res.headers));
  }
  return (await res.json()) as T;
}

let nextResolveAt = 0;

async function waitForResolveSlot(intervalMs: number) {
  if (intervalMs <= 0) return;
  const now = Date.now();
  if (nextResolveAt > now) {
    await sleep(nextResolveAt - now);
  }
  nextResolveAt = Date.now() + intervalMs;
}

async function resolvePlaceId(placeId: number, intervalMs: number) {
  for (let attempt = 0; attempt <= DEFAULT_RESOLVE_RETRY_LIMIT; attempt += 1) {
    await waitForResolveSlot(intervalMs);
    try {
      const payload = await fetchJson<{ universeId?: number }>(PLACE_TO_UNIVERSE_API(placeId), `place ${placeId}`);
      return typeof payload.universeId === "number" ? payload.universeId : null;
    } catch (error) {
      if (!(error instanceof FetchHttpError)) throw error;
      const retryable = error.status === 429 || error.status >= 500;
      if (!retryable || attempt >= DEFAULT_RESOLVE_RETRY_LIMIT) throw error;
      const delay = error.retryAfterMs ?? Math.min(60_000, 5_000 * (attempt + 1));
      await sleep(delay);
    }
  }
  return null;
}

async function resolvePlaceIds(placeIds: number[], concurrency: number, intervalMs: number) {
  const resolved = new Map<number, number>();
  const failed: Array<{ placeId: number; error: string }> = [];
  let nextIndex = 0;

  async function worker(workerId: number) {
    while (nextIndex < placeIds.length) {
      const index = nextIndex;
      nextIndex += 1;
      const placeId = placeIds[index];
      try {
        const universeId = await resolvePlaceId(placeId, intervalMs);
        if (universeId) {
          resolved.set(placeId, universeId);
        } else {
          failed.push({ placeId, error: "Roblox returned no universeId" });
        }
      } catch (error) {
        failed.push({ placeId, error: error instanceof Error ? error.message : String(error) });
      }

      if ((index + 1) % 100 === 0 || index + 1 === placeIds.length) {
        console.log(
          `  resolver ${workerId}: ${index + 1}/${placeIds.length} place IDs processed; ${resolved.size} resolved, ${failed.length} failed`
        );
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(concurrency, 1) }, (_value, index) => worker(index + 1)));
  return { resolved, failed };
}

async function fetchGameDetails(universeIds: number[]) {
  const details = new Map<number, RobloxGameDetail>();
  const failedBatches: Array<{ ids: number[]; error: string }> = [];
  const chunks: number[][] = [];

  for (let index = 0; index < universeIds.length; index += 50) {
    chunks.push(universeIds.slice(index, index + 50));
  }

  for (const [chunkIndex, chunk] of chunks.entries()) {
    if (chunkIndex > 0 && DEFAULT_DETAIL_DELAY_MS > 0) {
      await sleep(DEFAULT_DETAIL_DELAY_MS);
    }
    const params = new URLSearchParams({ universeIds: chunk.join(",") });
    try {
      const payload = await fetchGameDetailChunk(
        `${GAME_DETAILS_API}?${params.toString()}`,
        `game details batch ${chunkIndex + 1}/${chunks.length}`
      );
      for (const entry of payload.data ?? []) {
        if (typeof entry.id === "number") details.set(entry.id, entry);
      }
      console.log(`  detail batch ${chunkIndex + 1}/${chunks.length}: fetched ${(payload.data ?? []).length}/${chunk.length}`);
    } catch (error) {
      failedBatches.push({ ids: chunk, error: error instanceof Error ? error.message : String(error) });
      console.warn(
        `  detail batch ${chunkIndex + 1}/${chunks.length} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return { details, failedBatches };
}

async function fetchGameDetailChunk(url: string, label: string) {
  for (let attempt = 0; attempt <= DEFAULT_DETAIL_RETRY_LIMIT; attempt += 1) {
    try {
      return await fetchJson<{ data?: RobloxGameDetail[] }>(url, label);
    } catch (error) {
      if (!(error instanceof FetchHttpError)) throw error;
      const retryable = error.status === 429 || error.status >= 500;
      if (!retryable || attempt >= DEFAULT_DETAIL_RETRY_LIMIT) throw error;
      const delay = error.retryAfterMs ?? Math.min(60_000, 5_000 * (attempt + 1));
      console.warn(`  ${label} got ${error.status}; retrying in ${Math.round(delay / 1000)}s`);
      await sleep(delay);
    }
  }
  throw new Error(`${label} failed after retries`);
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function boolValue(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function buildUniverseRow(detail: RobloxGameDetail): UniverseInsert | null {
  const rootPlaceId = typeof detail.rootPlaceId === "number" ? detail.rootPlaceId : null;
  if (!rootPlaceId) return null;

  const name = detail.name?.trim() || `Universe ${detail.id}`;
  const displayName = cleanRobloxUniverseDisplayName(name);
  const slug = slugify(displayName ?? name) || `universe-${detail.id}`;
  const votes = detail.votes ?? {};
  const favorites =
    typeof detail.favorites === "number"
      ? detail.favorites
      : typeof detail.favoritedCount === "number"
        ? detail.favoritedCount
        : null;

  return {
    universe_id: detail.id,
    root_place_id: rootPlaceId,
    name,
    display_name: displayName,
    slug,
    description: typeof detail.description === "string" ? detail.description : null,
    description_source: typeof detail.description === "string" && detail.description ? "games" : null,
    creator_id: typeof detail.creator?.id === "number" ? detail.creator.id : null,
    creator_name: typeof detail.creator?.name === "string" ? detail.creator.name : null,
    creator_type: typeof detail.creator?.type === "string" ? detail.creator.type : null,
    creator_has_verified_badge: boolValue(detail.creator?.hasVerifiedBadge),
    genre: typeof detail.genre === "string" ? detail.genre : null,
    genre_l1:
      typeof detail.genre_l1 === "string"
        ? detail.genre_l1
        : typeof detail.genre === "string"
          ? detail.genre
          : null,
    genre_l2: typeof detail.genre_l2 === "string" ? detail.genre_l2 : null,
    is_all_genre: boolValue(detail.isAllGenre),
    price: typeof detail.price === "number" ? detail.price : null,
    voice_chat_enabled: boolValue(detail.voiceEnabled),
    server_size: typeof detail.serverSize === "number" ? detail.serverSize : null,
    max_players: typeof detail.maxPlayers === "number" ? detail.maxPlayers : null,
    playing: typeof detail.playing === "number" ? detail.playing : null,
    visits: typeof detail.visits === "number" ? detail.visits : null,
    favorites,
    likes:
      typeof votes.upVotes === "number"
        ? votes.upVotes
        : typeof detail.totalUpVotes === "number"
          ? detail.totalUpVotes
          : null,
    dislikes:
      typeof votes.downVotes === "number"
        ? votes.downVotes
        : typeof detail.totalDownVotes === "number"
          ? detail.totalDownVotes
          : null,
    is_sponsored: boolValue(detail.isSponsoredGame),
    age_rating: typeof detail.ageRecommendation === "string" ? detail.ageRecommendation : null,
    universe_avatar_type: typeof detail.universeAvatarType === "string" ? detail.universeAvatarType : null,
    create_vip_servers_allowed: boolValue(detail.createVipServersAllowed),
    studio_access_allowed: boolValue(detail.studioAccessToApisAllowed),
    created_at_api: normalizeTimestamp(detail.created),
    updated_at_api: normalizeTimestamp(detail.updated),
    raw_details: { games: detail },
    raw_metadata: {}
  };
}

async function updateUniverseReferencesToNull(table: string) {
  const sb = supabaseAdmin();
  const { error, count } = await sb
    .from(table)
    .update({ universe_id: null }, { count: "exact" })
    .not("universe_id", "is", null);
  if (error) {
    console.warn(`  cleanup warning: ${table} not updated (${error.message})`);
    return 0;
  }
  return count ?? 0;
}

async function deleteUniverseReferenceRows(table: string) {
  const sb = supabaseAdmin();
  const { error, count } = await sb.from(table).delete({ count: "exact" }).not("universe_id", "is", null);
  if (error) {
    console.warn(`  cleanup warning: ${table} not deleted (${error.message})`);
    return 0;
  }
  return count ?? 0;
}

async function cleanupLocalUniverseData() {
  console.log("\nCleaning local universe references...");
  let detachedRows = 0;
  let deletedChildRows = 0;

  for (const table of NULLABLE_UNIVERSE_REFERENCES) {
    const count = await updateUniverseReferencesToNull(table);
    detachedRows += count;
    if (count) console.log(`  detached ${count} rows from ${table}`);
  }

  for (const table of DELETE_UNIVERSE_REFERENCES) {
    const count = await deleteUniverseReferenceRows(table);
    deletedChildRows += count;
    if (count) console.log(`  deleted ${count} rows from ${table}`);
  }

  const sb = supabaseAdmin();
  const { error, count } = await sb.from("roblox_universes").delete({ count: "exact" }).neq("universe_id", -1);
  if (error) {
    throw new Error(`Failed to clean roblox_universes: ${error.message}`);
  }

  console.log(
    `Cleanup complete: detached ${detachedRows} content refs, deleted ${deletedChildRows} child rows, deleted ${count ?? 0} universe rows.`
  );
}

async function insertUniverseRows(rows: UniverseInsert[]) {
  const sb = supabaseAdmin();
  let inserted = 0;
  const failed: Array<{ offset: number; error: string }> = [];

  for (let index = 0; index < rows.length; index += 500) {
    const chunk = rows.slice(index, index + 500);
    const { error } = await sb.from("roblox_universes").upsert(chunk, { onConflict: "universe_id" });
    if (error) {
      failed.push({ offset: index, error: error.message });
      console.warn(`  insert failed at rows ${index + 1}-${index + chunk.length}: ${error.message}`);
    } else {
      inserted += chunk.length;
      console.log(`  inserted/upserted ${inserted}/${rows.length}`);
    }
  }

  return { inserted, failed };
}

function filterRoutes(routes: RouteSeed[], options: Options) {
  let filtered = routes;
  if (options.routeFilters.length) {
    filtered = filtered.filter((route) => options.routeFilters.some((filter) => route.path.includes(filter)));
  }
  if (options.maxRoutes != null) {
    filtered = filtered.slice(0, options.maxRoutes);
  }
  return filtered;
}

async function main() {
  const options = parseArgs();
  console.log(`RobloxGo local universe import (${options.apply ? "apply" : "dry-run"})`);
  console.log(`Supabase target: ${process.env.SUPABASE_URL ?? "unset"}`);

  if (options.apply) {
    assertLocalSupabase();
  }

  const discoveredRoutes = await discoverRoutes();
  const routes = filterRoutes(discoveredRoutes, options);
  console.log(`\nRoute plan: ${routes.length}/${discoveredRoutes.length} routes selected.`);
  if (!routes.length) {
    console.log("No routes selected.");
    return;
  }

  const collection = await collectPlaceIds(routes, options);
  let collectedPlaceIds = collection.placeIds;
  if (options.placeIdLimit != null) {
    collectedPlaceIds = collectedPlaceIds.slice(0, options.placeIdLimit);
  }
  console.log(`\nCollected ${collection.placeIds.length} unique Roblox place IDs from ${routes.length} routes.`);
  if (options.placeIdLimit != null) {
    console.log(`Applying --place-id-limit ${options.placeIdLimit}: resolving ${collectedPlaceIds.length} place IDs.`);
  }
  if (collection.failedPages.length) {
    console.log(`Failed pages: ${collection.failedPages.length}`);
    for (const failure of collection.failedPages.slice(0, 10)) {
      console.log(`  ${failure.path}: ${failure.error}`);
    }
    if (collection.failedPages.length > 10) {
      console.log(`  ...${collection.failedPages.length - 10} more failed pages`);
    }
  }

  if (!collectedPlaceIds.length) {
    console.log("No place IDs collected.");
    return;
  }

  console.log(`\nResolving ${collectedPlaceIds.length} place IDs through Roblox...`);
  const resolved = await resolvePlaceIds(collectedPlaceIds, options.resolveConcurrency, options.resolveIntervalMs);
  const universeIds = Array.from(new Set(resolved.resolved.values())).sort((a, b) => a - b);
  console.log(
    `Resolved ${resolved.resolved.size}/${collectedPlaceIds.length} place IDs into ${universeIds.length} unique universes; failed ${resolved.failed.length}.`
  );
  if (resolved.failed.length) {
    for (const failure of resolved.failed.slice(0, 10)) {
      console.log(`  failed place ${failure.placeId}: ${failure.error}`);
    }
    if (resolved.failed.length > 10) console.log(`  ...${resolved.failed.length - 10} more failed place IDs`);
  }

  console.log(`\nFetching official Roblox details for ${universeIds.length} universes...`);
  const details = await fetchGameDetails(universeIds);
  const rows = Array.from(details.details.values())
    .map(buildUniverseRow)
    .filter((row): row is UniverseInsert => row != null);
  console.log(
    `Prepared ${rows.length} insertable universe rows; details missing ${universeIds.length - details.details.size}; detail batches failed ${details.failedBatches.length}.`
  );

  if (!options.apply) {
    console.log("\nDry-run complete. Re-run with --apply to clean and insert into local Supabase.");
    return;
  }

  if (options.clean) {
    await cleanupLocalUniverseData();
  } else {
    console.log("\nSkipping cleanup because --no-clean was passed.");
  }

  console.log(`\nInserting ${rows.length} official Roblox universe rows...`);
  const insertResult = await insertUniverseRows(rows);

  console.log("\nRun summary");
  console.log(`  routes selected: ${routes.length}`);
  console.log(`  pages failed: ${collection.failedPages.length}`);
  console.log(`  unique place IDs collected: ${collection.placeIds.length}`);
  console.log(`  unique place IDs resolved: ${collectedPlaceIds.length}`);
  console.log(`  place IDs resolved: ${resolved.resolved.size}`);
  console.log(`  place IDs failed: ${resolved.failed.length}`);
  console.log(`  unique universes: ${universeIds.length}`);
  console.log(`  official details fetched: ${details.details.size}`);
  console.log(`  insertable rows: ${rows.length}`);
  console.log(`  rows inserted/upserted: ${insertResult.inserted}`);
  console.log(`  insert batches failed: ${insertResult.failed.length}`);
}

main().catch((error) => {
  console.error("RobloxGo local import failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
