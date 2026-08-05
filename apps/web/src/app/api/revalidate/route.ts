import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { purgeCloudflarePublicCache, warmCloudflarePaths } from "@/lib/cloudflare-cache";
import { cacheTagsForEvent, cacheTagsForPath, type PublicCacheEvent, type PublicCacheEventType } from "@/lib/public-cache-tags";
import { AVATAR_CATALOG_MASTER_CODE, buildAvatarCatalogPath } from "@/lib/roblox-avatar-catalog";
import { ROBLOX_ARTICLE_GAME_SLUG, articleGameSlugFromUniverse } from "@/lib/slug";
import { supabaseAdmin } from "@/lib/supabase";

type SinglePayload = PublicCacheEvent;
type Payload = SinglePayload | { type: "batch"; events: SinglePayload[] };

const EVENT_TYPES = new Set<PublicCacheEventType>([
  "code",
  "article",
  "author",
  "event",
  "checklist",
  "tool",
  "catalog",
  "music",
  "quiz",
  "puzzle",
  "wiki",
  "wiki_collection",
  "stats"
]);

const MUSIC_CATALOG_CODES = new Set(["roblox-music-ids"]);
const DECAL_CATALOG_CODE = "roblox-decal-ids";
const DECAL_BASE_PATH = `/catalog/${DECAL_CATALOG_CODE}`;
const MESH_CATALOG_CODE = "roblox-mesh-ids";
const MESH_BASE_PATH = `/catalog/${MESH_CATALOG_CODE}`;
const FREE_ITEMS_CATALOG_CODE = "free-roblox-items";
const LEGACY_FREE_ITEMS_CATALOG_CODE = "roblox-free-items";
const FREE_ITEMS_CATALOG_PREFIXES = [FREE_ITEMS_CATALOG_CODE, LEGACY_FREE_ITEMS_CATALOG_CODE];
const FREE_ITEMS_BASE_PATH = `/catalog/${FREE_ITEMS_CATALOG_CODE}`;
const MUSIC_BASE_PATH = "/catalog/roblox-music-ids";
const AVATAR_CATALOG_PREFIXES = [
  "roblox-items-and-bundles",
  "roblox-avatar-items",
  "roblox-accessories",
  "roblox-clothing",
  "roblox-body-parts",
  "roblox-emotes",
  "roblox-animations",
  "roblox-makeup"
];
const SITEMAP_INDEX_PATH = "/sitemap.xml";
const ARTICLES_SITEMAP_PATH = "/sitemaps/articles.xml";
const CODES_SITEMAP_PATH = "/sitemaps/codes.xml";
const AUTHORS_SITEMAP_PATH = "/sitemaps/authors.xml";
const EVENTS_SITEMAP_PATH = "/sitemaps/events.xml";
const CHECKLISTS_SITEMAP_PATH = "/sitemaps/checklists.xml";
const QUIZZES_SITEMAP_PATH = "/sitemaps/quizzes.xml";
const PUZZLES_SITEMAP_PATH = "/sitemaps/puzzles.xml";
const TOOLS_SITEMAP_PATH = "/sitemaps/tools.xml";
const CATALOG_SITEMAP_PATH = "/sitemaps/catalog.xml";
const WIKI_SITEMAP_PATH = "/sitemaps/wiki.xml";
const STATS_SITEMAP_PATH = "/sitemaps/stats.xml";
const FEED_PATH = "/feed.xml";
const PAGINATED_INDEX_PURGE_LIMIT = 50;
const STATS_DETAIL_PATH_PATTERN = /^\/stats\/games\/[^/?#]+$/;
const WARM_ROUTE_PATTERN_PATH = /^\/[^?#]*$/;

type WarmMode = "inline" | "deferred" | "disabled";

function assertSecret(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return "REVALIDATE_SECRET env is not set";
  }
  const header = request.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (token !== secret) {
    return "Unauthorized";
  }
  return null;
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
}

function applyRevalidation(paths: string[], tags: string[] = []) {
  const uniquePaths = Array.from(new Set(paths));
  const uniqueTags = Array.from(new Set(tags.filter(Boolean)));

  for (const path of uniquePaths) {
    if (/\[[^/\]]+\]/.test(path)) {
      revalidatePath(path, "page");
    } else {
      revalidatePath(path);
    }
  }

  for (const tag of uniqueTags) {
    revalidateTag(tag, { expire: 0 });
  }

  return uniquePaths;
}

function paginatedIndexPaths(basePath: string, pageLimit = PAGINATED_INDEX_PURGE_LIMIT) {
  const normalizedBasePath = basePath === "/" ? "/" : basePath.replace(/\/+$/, "");
  return [
    normalizedBasePath,
    `${normalizedBasePath}/page/[page]`,
    ...Array.from({ length: Math.max(0, pageLimit - 1) }, (_, index) => `${normalizedBasePath}/page/${index + 2}`)
  ];
}

function slugSegmentsAfterPrefix(slug: string, prefixes: string[]) {
  for (const prefix of prefixes) {
    if (slug === prefix) return [];
    if (slug.startsWith(`${prefix}/`)) {
      return slug.slice(prefix.length + 1).split("/").filter(Boolean);
    }
  }
  return [];
}

function revalidateForCode(slug: string) {
  return applyRevalidation(
    [`/codes/${slug}`, ...paginatedIndexPaths("/codes"), "/", FEED_PATH, SITEMAP_INDEX_PATH, CODES_SITEMAP_PATH],
    [`code:${slug}`, "codes", "codes-index", "home"]
  );
}

function revalidateForArticle(slug: string, articleGameSlug?: string | null) {
  const articleGamePaths = articleGameSlug
    ? paginatedIndexPaths(`/articles/games/${articleGameSlug}`)
    : ["/articles/games/[slug]", "/articles/games/[slug]/page/[page]"];
  return applyRevalidation(
    [
      `/articles/${slug}`,
      ...paginatedIndexPaths("/articles"),
      ...articleGamePaths,
      "/articles/games/[slug]",
      "/articles/games/[slug]/page/[page]",
      "/",
      FEED_PATH,
      SITEMAP_INDEX_PATH,
      ARTICLES_SITEMAP_PATH
    ],
    [
      `article:${slug}`,
      articleGameSlug ? `article-game:${articleGameSlug}` : "",
      "articles",
      "articles-index",
      "articles-games",
      "home"
    ]
  );
}

function revalidateForAuthor(slug: string) {
  return applyRevalidation(
    [`/authors/${slug}`, "/authors", SITEMAP_INDEX_PATH, AUTHORS_SITEMAP_PATH],
    [`author:${slug}`, "authors", "authors-index"]
  );
}

function revalidateForEvents(slug: string) {
  return applyRevalidation(
    ["/events", `/events/${slug}`, "/", FEED_PATH, SITEMAP_INDEX_PATH, EVENTS_SITEMAP_PATH],
    ["events-pages", "home"]
  );
}

function revalidateForChecklists(slug: string) {
  return applyRevalidation(
    [
      ...paginatedIndexPaths("/checklists"),
      `/checklists/${slug}`,
      "/",
      FEED_PATH,
      SITEMAP_INDEX_PATH,
      CHECKLISTS_SITEMAP_PATH
    ],
    ["checklists-index", "home"]
  );
}

function revalidateForQuizzes(slug: string) {
  return applyRevalidation(
    ["/quizzes", `/quizzes/${slug}`, "/", SITEMAP_INDEX_PATH, QUIZZES_SITEMAP_PATH],
    ["quizzes-index", "home"]
  );
}

function revalidateForPuzzle(slug: string) {
  const normalized = normalizeSlug(slug);
  const [puzzleSlug, answerDate] = normalized.split("/");
  const scopedPaths = [
    "/puzzles",
    puzzleSlug ? `/puzzles/${puzzleSlug}` : "",
    puzzleSlug && answerDate ? `/puzzles/${puzzleSlug}/${answerDate}` : ""
  ].filter(Boolean) as string[];

  return applyRevalidation(
    [...scopedPaths, "/", FEED_PATH, SITEMAP_INDEX_PATH, PUZZLES_SITEMAP_PATH],
    ["puzzles-index", puzzleSlug ? `puzzle:${puzzleSlug}` : "", "home"]
  );
}

function revalidateForWiki(slug: string) {
  return applyRevalidation(
    ["/wiki", `/wiki/${slug}`, "/", SITEMAP_INDEX_PATH, WIKI_SITEMAP_PATH],
    [`wiki:${slug}`, "wiki-index", "home"]
  );
}

function revalidateForStats(slug: string) {
  const normalized = normalizeSlug(slug);
  const reportSlug = normalized.startsWith("reports/") ? normalized.replace(/^reports\//, "") : "";
  const scopedPaths =
    reportSlug
      ? ["/stats", "/stats/reports", `/stats/reports/${reportSlug}`, FEED_PATH]
      : normalized === "home" || normalized === "stats"
      ? ["/stats", "/stats/roblox-platform"]
      : normalized === "roblox-platform" || normalized === "platform"
        ? ["/stats", "/stats/roblox-platform"]
      : normalized === "games"
        ? ["/stats", "/stats/games"]
        : normalized === "creators"
          ? ["/stats", "/stats/creators"]
          : normalized === "items"
            ? ["/stats", "/stats/items"]
          : normalized.startsWith("games/")
            ? ["/stats", "/stats/games", `/stats/games/${normalized.replace(/^games\//, "")}`]
            : ["/stats", "/stats/roblox-platform", "/stats/games", "/stats/creators", "/stats/items"];
  const detailSlug = normalized.startsWith("games/") ? normalized.replace(/^games\//, "") : null;
  return applyRevalidation(
    [...scopedPaths, "/api/stats/platform/chart", "/api/stats/visit-share", "/api/stats/games", "/api/stats/creators", "/api/stats/items", "/", SITEMAP_INDEX_PATH, STATS_SITEMAP_PATH],
    [
      "stats",
      "stats-home",
      "stats-platform",
      "stats-games",
      "stats-creators",
      "stats-items",
      reportSlug ? "stats-reports" : "",
      detailSlug ? `stats-game:${detailSlug}` : "",
      "home"
    ]
  );
}

function warmableRevalidationPaths(paths: string[]) {
  return paths.filter((path) => !STATS_DETAIL_PATH_PATTERN.test(path));
}

function topNavApiPathForPage(path: string) {
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("/api/")) return null;
  if (trimmed.includes("?") || trimmed.includes("#")) return null;
  if (/\[[^/\]]+\]/.test(trimmed)) return null;
  return `/api/game-top-nav?path=${encodeURIComponent(trimmed === "/" ? "/" : trimmed.replace(/\/+$/, ""))}`;
}

function topNavApiPathsForPages(paths: string[]) {
  return Array.from(new Set(paths.map(topNavApiPathForPage).filter((path): path is string => Boolean(path))));
}

function cacheTagsForPaths(paths: string[]) {
  return Array.from(new Set(paths.flatMap((path) => cacheTagsForPath(path)).filter((tag) => tag !== "site")));
}

function readPositiveInt(name: string, fallback: number, max: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(Math.floor(value), max);
}

function readWarmMode(): WarmMode {
  const value = process.env.CLOUDFLARE_WARM_AFTER_PURGE?.trim().toLowerCase();
  if (value === "false" || value === "0" || value === "off" || value === "disabled") return "disabled";
  if (value === "deferred" || value === "async" || value === "queued") return "deferred";
  return "inline";
}

function normalizeWarmPath(path: string) {
  const trimmed = path.trim();
  if (!trimmed || !trimmed.startsWith("/") || !WARM_ROUTE_PATTERN_PATH.test(trimmed)) return null;
  if (/\[[^/\]]+\]/.test(trimmed)) return null;
  if (trimmed.includes("/page/")) return null;
  if (trimmed === "/") return "/";
  return trimmed.replace(/\/+$/, "");
}

function warmPathPriority(path: string) {
  if (path === "/") return 1;
  if (path === FEED_PATH || path === SITEMAP_INDEX_PATH || path.startsWith("/sitemaps/")) return 10;
  if (
    path === "/codes" ||
    path === "/stats" ||
    path === "/stats/roblox-platform" ||
    path === "/stats/games" ||
    path === "/stats/creators" ||
    path === "/stats/items" ||
    path === "/wiki" ||
    path === "/catalog" ||
    path === "/articles" ||
    path === "/events" ||
    path === "/tools"
  ) {
    return 20;
  }
  if (path.startsWith("/api/")) return 90;
  return 40;
}

function prioritizedWarmPaths(paths: string[]) {
  const maxPaths = readPositiveInt("CLOUDFLARE_DEFERRED_WARM_MAX_PATHS", 40, 500);
  return Array.from(new Set(paths.map(normalizeWarmPath).filter((path): path is string => Boolean(path))))
    .sort((a, b) => warmPathPriority(a) - warmPathPriority(b) || a.localeCompare(b))
    .slice(0, maxPaths);
}

async function queueCloudflareWarmPaths(paths: string[]) {
  const queuedPaths = prioritizedWarmPaths(paths);
  if (!queuedPaths.length) {
    return {
      ok: true,
      attempted: 0,
      queued: 0,
      skipped: 0,
      reason: "no-cacheable-paths"
    };
  }

  const rows = queuedPaths.map((path) => ({
    path,
    source: "revalidate",
    priority: warmPathPriority(path),
    attempts: 0,
    last_error: null,
    updated_at: new Date().toISOString()
  }));

  const { error } = await supabaseAdmin()
    .from("cache_warm_events")
    .upsert(rows, { onConflict: "path" });

  if (error) {
    return {
      ok: false,
      attempted: queuedPaths.length,
      queued: 0,
      skipped: Math.max(0, paths.length - queuedPaths.length),
      reason: error.message
    };
  }

  return {
    ok: true,
    attempted: queuedPaths.length,
    queued: queuedPaths.length,
    skipped: Math.max(0, paths.length - queuedPaths.length),
    reason: "deferred"
  };
}

function revalidateForTools(slug: string) {
  return applyRevalidation(
    [...paginatedIndexPaths("/tools"), `/tools/${slug}`, "/", SITEMAP_INDEX_PATH, TOOLS_SITEMAP_PATH],
    ["tools-index", "home"]
  );
}

function revalidateForMusic(slug = "roblox-music-ids") {
  const [section, valueSlug] = slugSegmentsAfterPrefix(slug, ["roblox-music-ids"]);
  const scopedPaths =
    section === "genres" && valueSlug
      ? paginatedIndexPaths(`${MUSIC_BASE_PATH}/genres/${valueSlug}`)
      : section === "artists" && valueSlug
      ? paginatedIndexPaths(`${MUSIC_BASE_PATH}/artists/${valueSlug}`)
      : [];

  return applyRevalidation([
    "/catalog",
    ...paginatedIndexPaths(MUSIC_BASE_PATH),
    ...paginatedIndexPaths(`${MUSIC_BASE_PATH}/trending`),
    ...paginatedIndexPaths(`${MUSIC_BASE_PATH}/charts`),
    ...paginatedIndexPaths(`${MUSIC_BASE_PATH}/genres`),
    `${MUSIC_BASE_PATH}/genres/[genre]`,
    `${MUSIC_BASE_PATH}/genres/[genre]/page/[page]`,
    ...paginatedIndexPaths(`${MUSIC_BASE_PATH}/artists`),
    `${MUSIC_BASE_PATH}/artists/[artist]`,
    `${MUSIC_BASE_PATH}/artists/[artist]/page/[page]`,
    ...scopedPaths,
    "/",
    SITEMAP_INDEX_PATH,
    CATALOG_SITEMAP_PATH
  ]);
}

function revalidateForDecalIds(slug = DECAL_CATALOG_CODE) {
  const [section, valueSlug] = slugSegmentsAfterPrefix(slug, [DECAL_CATALOG_CODE]);
  const scopedPaths =
    section === "categories" && valueSlug
      ? paginatedIndexPaths(`${DECAL_BASE_PATH}/categories/${valueSlug}`)
      : [];

  return applyRevalidation([
    "/catalog",
    ...paginatedIndexPaths(DECAL_BASE_PATH),
    ...paginatedIndexPaths(`${DECAL_BASE_PATH}/curated`),
    `${DECAL_BASE_PATH}/categories`,
    `${DECAL_BASE_PATH}/categories/[category]`,
    `${DECAL_BASE_PATH}/categories/[category]/page/[page]`,
    ...scopedPaths,
    "/",
    SITEMAP_INDEX_PATH,
    CATALOG_SITEMAP_PATH
  ]);
}

function revalidateForMeshIds() {
  return applyRevalidation(
    [
      "/catalog",
      ...paginatedIndexPaths(MESH_BASE_PATH),
      "/",
      SITEMAP_INDEX_PATH,
      CATALOG_SITEMAP_PATH
    ],
    ["catalog-index", `catalog:${MESH_CATALOG_CODE}`]
  );
}

function isFreeItemsCatalogSlug(slug: string) {
  return FREE_ITEMS_CATALOG_PREFIXES.some((prefix) => slug === prefix || slug.startsWith(`${prefix}/`));
}

function revalidateForFreeItems(slug = FREE_ITEMS_CATALOG_CODE) {
  const [categorySlug, subcategorySlug] = slugSegmentsAfterPrefix(slug, FREE_ITEMS_CATALOG_PREFIXES);
  const scopedPaths = [
    ...(categorySlug ? paginatedIndexPaths(`${FREE_ITEMS_BASE_PATH}/${categorySlug}`) : []),
    ...(categorySlug && subcategorySlug
      ? paginatedIndexPaths(`${FREE_ITEMS_BASE_PATH}/${categorySlug}/${subcategorySlug}`)
      : [])
  ];

  return applyRevalidation(
    [
      "/catalog",
      ...paginatedIndexPaths(FREE_ITEMS_BASE_PATH),
      `${FREE_ITEMS_BASE_PATH}/[category]`,
      `${FREE_ITEMS_BASE_PATH}/[category]/page/[page]`,
      `${FREE_ITEMS_BASE_PATH}/[category]/[subcategory]`,
      `${FREE_ITEMS_BASE_PATH}/[category]/[subcategory]/page/[page]`,
      ...scopedPaths,
      "/",
      SITEMAP_INDEX_PATH,
      CATALOG_SITEMAP_PATH
    ],
    ["free-items-catalog", "home"]
  );
}

function isAvatarCatalogSlug(slug: string) {
  return AVATAR_CATALOG_PREFIXES.some((prefix) => slug === prefix || slug.startsWith(`${prefix}/`));
}

function revalidateForAvatarCatalog(slug: string) {
  const normalizedSlug = normalizeSlug(slug);
  const [prefix] = normalizedSlug.split("/");
  const basePath = buildAvatarCatalogPath(normalizedSlug);
  const legacyBasePath = `/catalog/${normalizedSlug}`;
  const routePatterns = [
    `/catalog/${AVATAR_CATALOG_MASTER_CODE}/[[...segments]]`,
    prefix ? `/catalog/${prefix}/[[...segments]]` : ""
  ].filter(Boolean) as string[];

  return applyRevalidation(
    [
      "/catalog",
      ...paginatedIndexPaths(basePath),
      ...(legacyBasePath !== basePath ? paginatedIndexPaths(legacyBasePath) : []),
      ...routePatterns,
      "/",
      SITEMAP_INDEX_PATH,
      CATALOG_SITEMAP_PATH
    ].filter(Boolean) as string[],
    [
      "avatar-catalog",
      normalizedSlug ? `avatar-catalog:${normalizedSlug}` : "",
      prefix ? `avatar-catalog:${prefix}` : "",
      normalizedSlug ? `catalog:${normalizedSlug}` : "",
      "catalog-index",
      "home"
    ]
  );
}

function revalidateForCatalog(slug: string) {
  return applyRevalidation(
    ["/catalog", slug ? `/catalog/${slug}` : "", "/", SITEMAP_INDEX_PATH, CATALOG_SITEMAP_PATH].filter(Boolean) as string[],
    [`catalog:${slug}`, "catalog-index", "home"]
  );
}

function revalidateForWikiCollection(slug: string) {
  const [wikiSlug, collectionSlug] = slug.split("/");
  const oldFlatCatalogSlug = wikiSlug && collectionSlug ? `${wikiSlug}-${collectionSlug}` : "";
  const wikiCatalogBasePath = wikiSlug && collectionSlug ? `/wiki/${wikiSlug}/${collectionSlug}` : "";
  const wikiCatalogContinuationPaths = wikiCatalogBasePath
    ? Array.from({ length: 39 }, (_, index) => `${wikiCatalogBasePath}/page/${index + 2}`)
    : [];
  return applyRevalidation(
    [
      "/wiki",
      wikiSlug ? `/wiki/${wikiSlug}` : "",
      wikiCatalogBasePath,
      ...wikiCatalogContinuationPaths,
      oldFlatCatalogSlug ? `/catalog/${oldFlatCatalogSlug}` : "",
      "/",
      SITEMAP_INDEX_PATH,
      WIKI_SITEMAP_PATH
    ].filter(Boolean) as string[],
    [
      "wiki-index",
      "wiki-collection-index",
      "home",
      wikiSlug ? `wiki:${wikiSlug}` : "",
      wikiSlug && collectionSlug ? `wiki-collection:${wikiSlug}/${collectionSlug}` : "",
      oldFlatCatalogSlug ? `wiki-collection-code:${oldFlatCatalogSlug}` : ""
    ]
  );
}

function parseUniverseId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function uniqueUniverseIds(rows: Array<{ universe_id?: unknown }>): number[] {
  return Array.from(
    new Set(
      rows
        .map((row) => parseUniverseId(row.universe_id))
        .filter((value): value is number => value !== null)
    )
  );
}

async function lookupUniverseIdsBySlug(table: string, slugColumn: string, values: string[]): Promise<number[]> {
  const candidates = Array.from(new Set(values.map(normalizeSlug).filter(Boolean)));
  if (!candidates.length) return [];

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from(table)
    .select("universe_id")
    .in(slugColumn, candidates)
    .not("universe_id", "is", null);

  if (error) {
    console.warn(`Wiki revalidation lookup failed for ${table}.${slugColumn}`, error.message);
    return [];
  }

  return uniqueUniverseIds((data ?? []) as Array<{ universe_id?: unknown }>);
}

async function lookupWikiSlugsByUniverseIds(universeIds: number[]): Promise<string[]> {
  const ids = Array.from(new Set(universeIds.filter((id) => Number.isFinite(id))));
  if (!ids.length) return [];

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("wiki_pages")
    .select("slug")
    .in("universe_id", ids)
    .eq("is_published", true)
    .not("slug", "is", null);

  if (error) {
    console.warn("Wiki revalidation lookup failed for wiki_pages", error.message);
    return [];
  }

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => normalizeSlug((row as { slug?: string | null }).slug ?? ""))
        .filter(Boolean)
    )
  );
}

async function lookupRelatedWikiSlugs(type: SinglePayload["type"], slug: string): Promise<string[]> {
  if (type === "wiki" || type === "author" || type === "music") return [];

  let universeIds: number[] = [];

  if (type === "code") {
    universeIds = await lookupUniverseIdsBySlug("code_pages", "slug", [slug]);
  } else if (type === "article") {
    universeIds = await lookupUniverseIdsBySlug("articles", "slug", [slug]);
  } else if (type === "event") {
    universeIds = await lookupUniverseIdsBySlug("events_pages", "slug", [slug]);
  } else if (type === "checklist") {
    universeIds = await lookupUniverseIdsBySlug("checklist_pages", "slug", [slug]);
  } else if (type === "tool") {
    universeIds = await lookupUniverseIdsBySlug("tools", "code", [slug]);
  } else if (type === "quiz") {
    universeIds = await lookupUniverseIdsBySlug("quiz_pages", "code", [slug]);
  } else if (type === "catalog") {
    universeIds = await lookupUniverseIdsBySlug("catalog_pages", "code", [slug, slug.replace(/\//g, "-")]);
  } else if (type === "wiki_collection") {
    const [wikiSlug] = slug.split("/");
    return wikiSlug ? [wikiSlug] : [];
  }

  return lookupWikiSlugsByUniverseIds(universeIds);
}

async function resolveUniverseIdsForEvent(type: SinglePayload["type"], slug: string): Promise<number[]> {
  switch (type) {
    case "code":
      return lookupUniverseIdsBySlug("code_pages", "slug", [slug]);
    case "article":
      return lookupUniverseIdsBySlug("articles", "slug", [slug]);
    case "event":
      return lookupUniverseIdsBySlug("events_pages", "slug", [slug]);
    case "checklist":
      return lookupUniverseIdsBySlug("checklist_pages", "slug", [slug]);
    case "tool":
      return lookupUniverseIdsBySlug("tools", "code", [slug]);
    case "quiz":
      return lookupUniverseIdsBySlug("quiz_pages", "code", [slug]);
    case "catalog":
      return lookupUniverseIdsBySlug("catalog_pages", "code", [slug, slug.replace(/\//g, "-")]);
    case "wiki":
      return lookupUniverseIdsBySlug("wiki_pages", "slug", [slug]);
    case "wiki_collection": {
      const [wikiSlug] = slug.split("/");
      return wikiSlug ? lookupUniverseIdsBySlug("wiki_pages", "slug", [wikiSlug]) : [];
    }
    default:
      // author, music, stats — not shown in the game discovery sidebar
      // (stats is a live client poll, so its host pages don't need revalidation).
      return [];
  }
}

async function lookupSlugsByUniverseIds(table: string, slugColumn: string, universeIds: number[]): Promise<string[]> {
  const ids = Array.from(new Set(universeIds.filter((id) => Number.isFinite(id))));
  if (!ids.length) return [];

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from(table)
    .select(slugColumn)
    .in("universe_id", ids)
    .eq("is_published", true)
    .not(slugColumn, "is", null);

  if (error) {
    console.warn(`Sidebar revalidation lookup failed for ${table}.${slugColumn}`, error.message);
    return [];
  }

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => {
          const value = (row as unknown as Record<string, unknown>)[slugColumn];
          return normalizeSlug(typeof value === "string" ? value : "");
        })
        .filter(Boolean)
    )
  );
}

/**
 * The game discovery sidebar lives on codes/articles/events/quizzes pages, so any
 * change to a game's content must revalidate those four page types for the universe
 * (not just its wiki page). Stats are excluded — the sidebar stats card is a live poll.
 */
async function lookupSidebarHostPaths(type: SinglePayload["type"], slug: string): Promise<string[]> {
  const universeIds = await resolveUniverseIdsForEvent(type, slug);
  if (!universeIds.length) return [];

  const [codeSlugs, articleSlugs, eventSlugs, quizCodes] = await Promise.all([
    lookupSlugsByUniverseIds("code_pages", "slug", universeIds),
    lookupSlugsByUniverseIds("articles", "slug", universeIds),
    lookupSlugsByUniverseIds("events_pages", "slug", universeIds),
    lookupSlugsByUniverseIds("quiz_pages", "code", universeIds)
  ]);

  return [
    ...codeSlugs.map((value) => `/codes/${value}`),
    ...articleSlugs.map((value) => `/articles/${value}`),
    ...eventSlugs.map((value) => `/events/${value}`),
    ...quizCodes.map((value) => `/quizzes/${value}`)
  ];
}

async function lookupArticleGameSlugByArticleSlug(slug: string): Promise<string | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("articles")
    .select("universe_id, universe:roblox_universes(universe_id,slug,display_name,name)")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.universe_id) return ROBLOX_ARTICLE_GAME_SLUG;
  const universe = Array.isArray(data.universe) ? data.universe[0] ?? null : data.universe ?? null;
  return universe ? articleGameSlugFromUniverse(universe) : null;
}

function parsePayloadEvents(payload: Payload): SinglePayload[] | { error: string } {
  if (!payload || typeof payload !== "object") {
    return { error: "Invalid payload" };
  }

  if ((payload as { type?: unknown }).type === "batch") {
    const events = (payload as { events?: unknown }).events;
    if (!Array.isArray(events) || events.length === 0) {
      return { error: "Batch payload requires events" };
    }

    if (events.length > 100) {
      return { error: "Batch payload cannot exceed 100 events" };
    }

    const parsedEvents: SinglePayload[] = [];
    for (const event of events) {
      if (!event || typeof event !== "object") {
        return { error: "Invalid batch event" };
      }
      const type = (event as { type?: unknown }).type;
      const slug = (event as { slug?: unknown }).slug;
      if (typeof type !== "string" || !EVENT_TYPES.has(type as PublicCacheEventType)) {
        return { error: "Invalid batch event type" };
      }
      if (typeof slug !== "string" || !normalizeSlug(slug)) {
        return { error: "Invalid batch event slug" };
      }
      parsedEvents.push({ type: type as PublicCacheEventType, slug: normalizeSlug(slug) });
    }
    return parsedEvents;
  }

  const type = (payload as { type?: unknown }).type;
  const slug = (payload as { slug?: unknown }).slug;
  if (typeof type !== "string" || !EVENT_TYPES.has(type as PublicCacheEventType)) {
    return { error: "Unknown type" };
  }
  if (typeof slug !== "string" || !normalizeSlug(slug)) {
    return { error: "Missing slug" };
  }
  return [{ type: type as PublicCacheEventType, slug: normalizeSlug(slug) }];
}

async function collectRevalidationTargets(payload: SinglePayload) {
  const slug = normalizeSlug(payload.slug);
  let purgePaths: string[] = [];
  let purgeTags: string[] = cacheTagsForEvent(payload.type, slug);
  let impactedWikiSlugs: string[] = [];

  switch (payload.type) {
    case "code":
      purgePaths = revalidateForCode(slug);
      break;
    case "article": {
      const articleGameSlug = await lookupArticleGameSlugByArticleSlug(slug);
      purgePaths = revalidateForArticle(slug, articleGameSlug);
      if (articleGameSlug) purgeTags = [...purgeTags, `article-game:${articleGameSlug}`];
      break;
    }
    case "author":
      purgePaths = revalidateForAuthor(slug);
      break;
    case "event":
      purgePaths = revalidateForEvents(slug);
      break;
    case "checklist":
      purgePaths = revalidateForChecklists(slug);
      break;
    case "quiz":
      purgePaths = revalidateForQuizzes(slug);
      break;
    case "puzzle":
      purgePaths = revalidateForPuzzle(slug);
      break;
    case "wiki":
      purgePaths = revalidateForWiki(slug);
      break;
    case "stats":
      purgePaths = revalidateForStats(slug);
      break;
    case "wiki_collection":
      purgePaths = revalidateForWikiCollection(slug);
      break;
    case "tool":
      purgePaths = revalidateForTools(slug);
      break;
    case "catalog":
      if (MUSIC_CATALOG_CODES.has(slug)) {
        purgePaths = [...purgePaths, ...revalidateForMusic(slug)];
      }
      if (slug === DECAL_CATALOG_CODE || slug.startsWith(`${DECAL_CATALOG_CODE}/`)) {
        purgePaths = [...purgePaths, ...revalidateForDecalIds(slug)];
      }
      if (slug === MESH_CATALOG_CODE) {
        purgePaths = [...purgePaths, ...revalidateForMeshIds()];
      }
      if (isFreeItemsCatalogSlug(slug)) {
        purgePaths = [...purgePaths, ...revalidateForFreeItems(slug)];
      }
      if (isAvatarCatalogSlug(slug)) {
        purgePaths = [...purgePaths, ...revalidateForAvatarCatalog(slug)];
      }
      purgePaths = [...purgePaths, ...revalidateForCatalog(slug)];
      break;
    case "music":
      purgePaths = revalidateForMusic(slug);
      break;
  }

  impactedWikiSlugs = await lookupRelatedWikiSlugs(payload.type, slug);
  for (const wikiSlug of impactedWikiSlugs) {
    purgePaths = [...purgePaths, ...revalidateForWiki(wikiSlug)];
    purgeTags = [...purgeTags, ...cacheTagsForEvent("wiki", wikiSlug)];
  }

  // The discovery sidebar embeds the same game's content on codes/articles/events/quizzes
  // pages, so revalidate those host pages for the universe too.
  const sidebarHostPaths = await lookupSidebarHostPaths(payload.type, slug);
  if (sidebarHostPaths.length) {
    purgePaths = [...purgePaths, ...sidebarHostPaths];
    purgeTags = [...purgeTags, ...cacheTagsForPaths(sidebarHostPaths)];
  }

  purgePaths = [...purgePaths, ...topNavApiPathsForPages(purgePaths)];

  return {
    paths: purgePaths,
    tags: purgeTags,
    impactedWikiSlugs,
    impactedListSlugs: []
  };
}

export async function POST(request: Request) {
  const authError = assertSecret(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsedEvents = parsePayloadEvents(payload);
  if ("error" in parsedEvents) {
    return NextResponse.json({ error: parsedEvents.error }, { status: 400 });
  }

  let purgePaths: string[] = [];
  let purgeTags: string[] = [];
  let impactedWikiSlugs: string[] = [];
  let impactedListSlugs: string[] = [];

  for (const event of parsedEvents) {
    const targets = await collectRevalidationTargets(event);
    purgePaths = [...purgePaths, ...targets.paths];
    purgeTags = [...purgeTags, ...targets.tags];
    impactedWikiSlugs = [...impactedWikiSlugs, ...targets.impactedWikiSlugs];
    impactedListSlugs = [...impactedListSlugs, ...targets.impactedListSlugs];
  }

  purgePaths = Array.from(new Set(purgePaths));
  purgeTags = Array.from(new Set(purgeTags));
  impactedWikiSlugs = Array.from(new Set(impactedWikiSlugs));
  impactedListSlugs = Array.from(new Set(impactedListSlugs));

  const cloudflare = await purgeCloudflarePublicCache({ paths: purgePaths, tags: purgeTags });
  const warmPaths = warmableRevalidationPaths(purgePaths);
  const warmMode = readWarmMode();
  const cloudflareWarm = cloudflare.enabled && cloudflare.ok
    ? warmMode === "deferred"
      ? await queueCloudflareWarmPaths(warmPaths).then((result) => ({
          enabled: true,
          ok: true,
          attempted: 0,
          warmed: [],
          skipped: result.skipped,
          reason: result.ok ? "deferred" : "deferred-queue-failed",
          queued: result.queued,
          queueAttempted: result.attempted,
          queueError: result.ok ? undefined : result.reason
        }))
      : warmMode === "disabled"
        ? {
            enabled: false,
            ok: true,
            attempted: 0,
            warmed: [],
            skipped: warmPaths.length,
            reason: "disabled"
          }
        : await warmCloudflarePaths(warmPaths)
    : {
        enabled: false,
        ok: true,
        attempted: 0,
        warmed: [],
        skipped: 0,
        reason: cloudflare.enabled ? "purge-failed" : cloudflare.reason ?? "cloudflare-disabled"
      };
  const indexNow = {
    enabled: false,
    attempted: 0,
    submitted: 0,
    successfulBatches: 0,
    failedBatches: 0,
    reason: "site-disabled"
  };

  if (cloudflare.enabled && !cloudflare.ok) {
    return NextResponse.json(
      {
        error: "Cloudflare purge failed",
        revalidated: true,
        events: parsedEvents,
        processed: parsedEvents.length,
        impactedWikiSlugs,
        impactedListSlugs,
        cacheTags: purgeTags,
        indexNow,
        cloudflare,
        cloudflareWarm
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    revalidated: true,
    type: parsedEvents.length === 1 ? parsedEvents[0].type : "batch",
    slug: parsedEvents.length === 1 ? parsedEvents[0].slug : undefined,
    events: parsedEvents,
    processed: parsedEvents.length,
    impactedWikiSlugs,
    impactedListSlugs,
    cacheTags: purgeTags,
    indexNow,
    cloudflare,
    cloudflareWarm
  });
}
