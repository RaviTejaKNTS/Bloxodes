import "../shared/load-env";

import * as cheerio from "cheerio";
import { Pool } from "pg";

const ROBLOXGO_BASE = "https://www.robloxgo.com";
const DEFAULT_PAGE_DELAY_MS = Number(process.env.ROBLOXGO_PAGE_DELAY_MS ?? "1500");
const DEFAULT_PAGE_RETRY_LIMIT = Number(process.env.ROBLOXGO_PAGE_RETRY_LIMIT ?? "3");
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = Number(process.env.ROBLOXGO_RATE_LIMIT_COOLDOWN_MS ?? "60000");
const DEFAULT_MAX_PAGES_PER_ROUTE =
  process.env.ROBLOXGO_MAX_PAGES_PER_ROUTE === "all"
    ? null
    : process.env.ROBLOXGO_MAX_PAGES_PER_ROUTE
      ? Number(process.env.ROBLOXGO_MAX_PAGES_PER_ROUTE)
      : null;
const DEFAULT_USER_AGENT =
  process.env.ROBLOXGO_USER_AGENT ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type Options = {
  apply: boolean;
  reset: boolean;
  skipFetched: boolean;
  ensureSchema: boolean;
  maxPagesPerRoute: number | null;
  maxRoutes: number | null;
  pageBudget: number | null;
  routeFilters: string[];
  pageDelayMs: number;
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

type CrawlPageRow = {
  route_path: string;
  page_number: number;
  status: string;
  attempts: number;
  max_page_seen: number | null;
};

type RunStats = {
  pagesFetched: number;
  pagesSkipped: number;
  pagesFailed: number;
  pageLinksFound: number;
  placeRowsInserted: number;
  placeRowsExisting: number;
};

const STATIC_ROUTES: RouteSeed[] = [
  { path: "/games/most_played", label: "Most played games" },
  { path: "/games/new", label: "New games" },
  { path: "/games/top_ranked", label: "Top ranked games" },
  { path: "/games/favorite", label: "Favorite games" },
  { path: "/games/vote_up", label: "Most liked games" }
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    apply: false,
    reset: false,
    skipFetched: true,
    ensureSchema: true,
    maxPagesPerRoute: DEFAULT_MAX_PAGES_PER_ROUTE,
    maxRoutes: null,
    pageBudget: null,
    routeFilters: [],
    pageDelayMs: DEFAULT_PAGE_DELAY_MS
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--reset") {
      options.reset = true;
    } else if (arg === "--no-skip-fetched") {
      options.skipFetched = false;
    } else if (arg === "--no-ensure-schema") {
      options.ensureSchema = false;
    } else if (arg === "--max-pages-per-route") {
      const value = args[i + 1]?.trim();
      if (value === "all") {
        options.maxPagesPerRoute = null;
      } else {
        options.maxPagesPerRoute = readPositiveInteger(value, "max-pages-per-route");
      }
      i += 1;
    } else if (arg === "--max-routes") {
      options.maxRoutes = readPositiveInteger(args[i + 1], "max-routes");
      i += 1;
    } else if (arg === "--page-budget") {
      options.pageBudget = readPositiveInteger(args[i + 1], "page-budget");
      i += 1;
    } else if (arg === "--route") {
      const value = args[i + 1]?.trim();
      if (!value) throw new Error("--route requires a path or substring");
      options.routeFilters.push(value);
      i += 1;
    } else if (arg === "--page-delay-ms") {
      options.pageDelayMs = readPositiveInteger(args[i + 1], "page-delay-ms");
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
Usage: tsx scripts/universes/collect-robloxgo-place-ids-postgres.ts [options]

Discovers Roblox place IDs from public RobloxGo listing pages and stores them
in plain Postgres staging tables using DATABASE_URL. This does not resolve
universe IDs and does not write to roblox_universes.

Options:
  --apply                     Write to Postgres. Without this, dry-run only.
  --reset                     Clear robloxgo discovery/crawl staging tables first.
  --no-skip-fetched           Re-fetch pages already marked fetched.
  --no-ensure-schema          Do not create staging tables before running.
  --max-pages-per-route <n>   Limit pages per route. Use "all" for no cap. Default all.
  --max-routes <n>            Limit discovered routes after filtering.
  --page-budget <n>           Stop after fetching this many uncached route pages.
  --route <text>              Only process routes containing this text. Repeatable.
  --page-delay-ms <n>         Delay between RobloxGo page requests. Default ${DEFAULT_PAGE_DELAY_MS}.
  -h, --help                  Show this help.
`);
}

function databaseLabel() {
  const value = process.env.DATABASE_URL;
  if (!value) return "unset";
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}`;
  } catch {
    return "set-but-not-a-url";
  }
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for the Postgres collector.");
  const wantsSsl = /sslmode=require/i.test(connectionString) || process.env.PGSSLMODE === "require";
  return new Pool({
    connectionString,
    max: 3,
    ssl: wantsSsl ? { rejectUnauthorized: false } : undefined
  });
}

let pool: Pool | null = null;

function getPool() {
  pool ??= createPool();
  return pool;
}

async function ensureSchema() {
  await getPool().query(`
    create table if not exists public.robloxgo_place_discovery (
      place_id bigint primary key,
      universe_id bigint,
      status text not null default 'pending',
      resolve_attempts integer not null default 0,
      last_error text,
      first_seen_route text not null,
      first_seen_page integer not null,
      first_seen_url text not null,
      last_seen_route text not null,
      last_seen_page integer not null,
      last_seen_url text not null,
      seen_count integer not null default 1,
      source text not null default 'robloxgo',
      first_seen_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      resolved_at timestamptz,
      imported_at timestamptz,
      updated_at timestamptz not null default now(),
      constraint robloxgo_place_discovery_status_check check (
        status in ('pending', 'resolved', 'imported', 'failed', 'skipped')
      )
    );

    create index if not exists idx_robloxgo_place_discovery_status
      on public.robloxgo_place_discovery (status, updated_at);

    create index if not exists idx_robloxgo_place_discovery_universe
      on public.robloxgo_place_discovery (universe_id)
      where universe_id is not null;

    create index if not exists idx_robloxgo_place_discovery_seen
      on public.robloxgo_place_discovery (last_seen_at desc);

    create table if not exists public.robloxgo_crawl_pages (
      route_path text not null,
      page_number integer not null,
      page_url text not null,
      max_page_seen integer,
      status text not null default 'pending',
      place_ids_found integer not null default 0,
      new_place_ids integer not null default 0,
      attempts integer not null default 0,
      last_error text,
      first_seen_at timestamptz not null default now(),
      fetched_at timestamptz,
      updated_at timestamptz not null default now(),
      primary key (route_path, page_number),
      constraint robloxgo_crawl_pages_status_check check (
        status in ('pending', 'fetched', 'failed', 'skipped')
      )
    );

    create index if not exists idx_robloxgo_crawl_pages_status
      on public.robloxgo_crawl_pages (status, updated_at);

    create index if not exists idx_robloxgo_crawl_pages_route
      on public.robloxgo_crawl_pages (route_path, page_number);
  `);
}

function retryAfterMs(headers: Headers) {
  const value = headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(seconds * 1000, 0);
  const dateMs = Date.parse(value);
  return Number.isNaN(dateMs) ? null : Math.max(dateMs - Date.now(), 0);
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

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= DEFAULT_PAGE_RETRY_LIMIT) {
      const body = await res.text().catch(() => "");
      throw new Error(`${label} failed (${res.status}): ${body.slice(0, 240)}`);
    }

    const delay =
      retryAfterMs(res.headers) ??
      (res.status === 429 ? DEFAULT_RATE_LIMIT_COOLDOWN_MS : Math.min(30_000, 2_000 * (attempt + 1)));
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

function routePageUrl(routePath: string, page: number) {
  return `${ROBLOXGO_BASE}${routePagePath(routePath, page)}`;
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

async function getCrawledPage(routePath: string, pageNumber: number): Promise<CrawlPageRow | null> {
  const result = await getPool().query<CrawlPageRow>(
    `select route_path, page_number, status, attempts, max_page_seen
     from public.robloxgo_crawl_pages
     where route_path = $1 and page_number = $2`,
    [routePath, pageNumber]
  );
  return result.rows[0] ?? null;
}

async function recordCrawlPage(params: {
  apply: boolean;
  routePath: string;
  pageNumber: number;
  pageUrl: string;
  maxPageSeen: number | null;
  status: "fetched" | "failed" | "skipped";
  placeIdsFound: number;
  newPlaceIds: number;
  attempts: number;
  error?: string | null;
}) {
  if (!params.apply) return;
  await getPool().query(
    `insert into public.robloxgo_crawl_pages (
       route_path, page_number, page_url, max_page_seen, status, place_ids_found,
       new_place_ids, attempts, last_error, fetched_at, updated_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, case when $5 = 'fetched' then now() else null end, now())
     on conflict (route_path, page_number) do update set
       page_url = excluded.page_url,
       max_page_seen = excluded.max_page_seen,
       status = excluded.status,
       place_ids_found = excluded.place_ids_found,
       new_place_ids = excluded.new_place_ids,
       attempts = excluded.attempts,
       last_error = excluded.last_error,
       fetched_at = excluded.fetched_at,
       updated_at = now()`,
    [
      params.routePath,
      params.pageNumber,
      params.pageUrl,
      params.maxPageSeen,
      params.status,
      params.placeIdsFound,
      params.newPlaceIds,
      params.attempts,
      params.error ?? null
    ]
  );
}

async function upsertDiscoveredPlaces(params: {
  apply: boolean;
  routePath: string;
  pageNumber: number;
  pageUrl: string;
  placeIds: number[];
}) {
  if (!params.apply || !params.placeIds.length) {
    return { total: params.placeIds.length, inserted: 0, existing: 0 };
  }

  const discoveries = params.placeIds.map((placeId) => ({
    place_id: placeId,
    route_path: params.routePath,
    page_number: params.pageNumber,
    page_url: params.pageUrl
  }));

  const result = await getPool().query<{ total: number; inserted: number; existing: number }>(
    `with incoming as (
       select distinct on (place_id)
         place_id,
         route_path,
         page_number,
         page_url
       from jsonb_to_recordset($1::jsonb) as x(
         place_id bigint,
         route_path text,
         page_number integer,
         page_url text
       )
       where place_id is not null
       order by place_id
     ),
     existing_rows as (
       select d.place_id
       from public.robloxgo_place_discovery d
       join incoming i on i.place_id = d.place_id
     ),
     summary as (
       select
         count(*)::integer as total,
         count(*) filter (where e.place_id is null)::integer as inserted,
         count(*) filter (where e.place_id is not null)::integer as existing
       from incoming i
       left join existing_rows e on e.place_id = i.place_id
     ),
     upserted as (
       insert into public.robloxgo_place_discovery (
         place_id,
         first_seen_route,
         first_seen_page,
         first_seen_url,
         last_seen_route,
         last_seen_page,
         last_seen_url,
         source
       )
       select
         place_id,
         route_path,
         page_number,
         page_url,
         route_path,
         page_number,
         page_url,
         'robloxgo'
       from incoming
       on conflict (place_id) do update set
         last_seen_route = excluded.last_seen_route,
         last_seen_page = excluded.last_seen_page,
         last_seen_url = excluded.last_seen_url,
         last_seen_at = now(),
         updated_at = now(),
         seen_count = public.robloxgo_place_discovery.seen_count + 1,
         status = case
           when public.robloxgo_place_discovery.status = 'skipped' then 'pending'
           else public.robloxgo_place_discovery.status
         end
       returning place_id
     )
     select
       coalesce(summary.total, 0)::integer as total,
       coalesce(summary.inserted, 0)::integer as inserted,
       coalesce(summary.existing, 0)::integer as existing
     from summary
     cross join (select count(*) from upserted) touched`,
    [JSON.stringify(discoveries)]
  );

  return result.rows[0] ?? { total: params.placeIds.length, inserted: 0, existing: 0 };
}

async function resetDiscoveryTables() {
  const pages = await getPool().query(`delete from public.robloxgo_crawl_pages returning 1`);
  const places = await getPool().query(`delete from public.robloxgo_place_discovery returning 1`);
  console.log(`Reset staging tables: deleted ${places.rowCount ?? 0} places and ${pages.rowCount ?? 0} crawl pages.`);
}

async function tableCount(table: string) {
  const result = await getPool().query(`select count(*)::integer as count from ${table}`);
  return Number(result.rows[0]?.count ?? 0);
}

async function crawlRoute(route: RouteSeed, routeIndex: number, routeTotal: number, options: Options, stats: RunStats) {
  console.log(`\n[${routeIndex + 1}/${routeTotal}] ${route.path}`);
  const firstPageRecord = options.apply ? await getCrawledPage(route.path, 1) : null;
  let firstPage: PageResult | null = null;
  let maxPage = firstPageRecord?.max_page_seen ?? 1;

  if (options.skipFetched && firstPageRecord?.status === "fetched" && firstPageRecord.max_page_seen) {
    stats.pagesSkipped += 1;
    console.log(`  page 1 skipped; max page ${firstPageRecord.max_page_seen} from previous crawl`);
  } else {
    firstPage = await crawlPage(route.path, 1, options, stats, firstPageRecord);
    maxPage = firstPage?.maxPage ?? 1;
  }

  let pagesToFetch = maxPage;
  if (options.maxPagesPerRoute != null) {
    pagesToFetch = Math.min(pagesToFetch, options.maxPagesPerRoute);
  }

  const capNote = pagesToFetch < maxPage ? `, capped from ${maxPage}` : "";
  if (firstPage) {
    console.log(`  page 1/${pagesToFetch}: ${firstPage.placeIds.length} links, max page ${maxPage}${capNote}`);
  } else {
    console.log(`  route max page ${maxPage}${capNote}`);
  }

  for (let page = 2; page <= pagesToFetch; page += 1) {
    if (options.pageBudget != null && stats.pagesFetched >= options.pageBudget) {
      console.log(`  page budget reached (${options.pageBudget}); stopping route.`);
      return false;
    }
    await sleep(options.pageDelayMs);
    const existing = options.apply ? await getCrawledPage(route.path, page) : null;
    if (options.skipFetched && existing?.status === "fetched") {
      stats.pagesSkipped += 1;
      if (page % 100 === 0 || page === pagesToFetch) {
        console.log(`  page ${page}/${pagesToFetch}: skipped fetched page`);
      }
      continue;
    }

    const parsed = await crawlPage(route.path, page, options, stats, existing, maxPage);
    if (parsed) {
      console.log(`  page ${page}/${pagesToFetch}: ${parsed.placeIds.length} links`);
    }
  }

  return true;
}

async function crawlPage(
  routePath: string,
  pageNumber: number,
  options: Options,
  stats: RunStats,
  existing: CrawlPageRow | null,
  knownMaxPage: number | null = null
) {
  const pagePath = routePagePath(routePath, pageNumber);
  const pageUrl = routePageUrl(routePath, pageNumber);
  const attempts = (existing?.attempts ?? 0) + 1;

  try {
    const html = await fetchText(pageUrl, pagePath);
    const parsed = parsePage(pagePath, html);
    const places = await upsertDiscoveredPlaces({
      apply: options.apply,
      routePath,
      pageNumber,
      pageUrl,
      placeIds: parsed.placeIds
    });

    await recordCrawlPage({
      apply: options.apply,
      routePath,
      pageNumber,
      pageUrl,
      maxPageSeen: Math.max(parsed.maxPage, knownMaxPage ?? 1),
      status: "fetched",
      placeIdsFound: places.total,
      newPlaceIds: places.inserted,
      attempts
    });

    stats.pagesFetched += 1;
    stats.pageLinksFound += places.total;
    stats.placeRowsInserted += places.inserted;
    stats.placeRowsExisting += places.existing;
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stats.pagesFailed += 1;
    await recordCrawlPage({
      apply: options.apply,
      routePath,
      pageNumber,
      pageUrl,
      maxPageSeen: knownMaxPage,
      status: "failed",
      placeIdsFound: 0,
      newPlaceIds: 0,
      attempts,
      error: message
    });
    console.warn(`  failed page ${pageNumber}: ${message}`);
    return null;
  }
}

async function main() {
  const options = parseArgs();
  console.log(`RobloxGo Postgres place ID collector (${options.apply ? "apply" : "dry-run"})`);
  console.log(`Database target: ${databaseLabel()}`);

  if (options.apply && options.ensureSchema) {
    await ensureSchema();
    console.log("Ensured Postgres staging schema.");
  }

  if (options.reset) {
    if (!options.apply) throw new Error("--reset requires --apply");
    await resetDiscoveryTables();
  }

  const discoveredRoutes = await discoverRoutes();
  const routes = filterRoutes(discoveredRoutes, options);
  console.log(`\nRoute plan: ${routes.length}/${discoveredRoutes.length} routes selected.`);
  if (options.maxPagesPerRoute == null) {
    console.log("Page cap: all pages per route.");
  } else {
    console.log(`Page cap: ${options.maxPagesPerRoute} pages per route.`);
  }
  if (options.pageBudget != null) {
    console.log(`Page budget: ${options.pageBudget} uncached fetched pages.`);
  }
  if (!routes.length) {
    console.log("No routes selected.");
    return;
  }

  const stats: RunStats = {
    pagesFetched: 0,
    pagesSkipped: 0,
    pagesFailed: 0,
    pageLinksFound: 0,
    placeRowsInserted: 0,
    placeRowsExisting: 0
  };

  for (const [index, route] of routes.entries()) {
    if (options.pageBudget != null && stats.pagesFetched >= options.pageBudget) {
      console.log(`\nPage budget reached (${options.pageBudget}); stopping crawl.`);
      break;
    }
    const shouldContinue = await crawlRoute(route, index, routes.length, options, stats);
    if (!shouldContinue) break;
  }

  console.log("\nRun summary");
  console.log(`  routes selected: ${routes.length}`);
  console.log(`  pages fetched: ${stats.pagesFetched}`);
  console.log(`  pages skipped: ${stats.pagesSkipped}`);
  console.log(`  pages failed: ${stats.pagesFailed}`);
  console.log(`  page place links found: ${stats.pageLinksFound}`);
  console.log(`  place rows inserted: ${stats.placeRowsInserted}`);
  console.log(`  duplicate/existing place sightings: ${stats.placeRowsExisting}`);

  if (options.apply) {
    const placeCount = await tableCount("public.robloxgo_place_discovery");
    const pageCount = await tableCount("public.robloxgo_crawl_pages");
    console.log(`  staging place rows total: ${placeCount}`);
    console.log(`  crawl page rows total: ${pageCount}`);
  } else {
    console.log("\nDry-run complete. Re-run with --apply to write staging rows.");
  }
}

main()
  .catch((error) => {
    console.error("RobloxGo Postgres place ID collection failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool?.end().catch(() => undefined);
  });
