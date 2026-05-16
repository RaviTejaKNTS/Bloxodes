import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { purgeCloudflarePaths } from "@/lib/cloudflare-cache";
import { supabaseAdmin } from "@/lib/supabase";

type Payload =
  | { type: "code"; slug: string }
  | { type: "article"; slug: string }
  | { type: "list"; slug: string }
  | { type: "author"; slug: string }
  | { type: "event"; slug: string }
  | { type: "checklist"; slug: string }
  | { type: "tool"; slug: string }
  | { type: "catalog"; slug: string }
  | { type: "music"; slug: string }
  | { type: "quiz"; slug: string }
  | { type: "wiki"; slug: string };

const MUSIC_CATALOG_CODES = new Set(["roblox-music-ids"]);
const FREE_ITEMS_CATALOG_CODE = "free-roblox-items";
const LEGACY_FREE_ITEMS_CATALOG_CODE = "roblox-free-items";
const FREE_ITEMS_CATALOG_PREFIXES = [FREE_ITEMS_CATALOG_CODE, LEGACY_FREE_ITEMS_CATALOG_CODE];
const FREE_ITEMS_BASE_PATH = `/catalog/${FREE_ITEMS_CATALOG_CODE}`;
const SITEMAP_INDEX_PATH = "/sitemap.xml";
const ARTICLES_SITEMAP_PATH = "/sitemaps/articles.xml";
const CODES_SITEMAP_PATH = "/sitemaps/codes.xml";
const LISTS_SITEMAP_PATH = "/sitemaps/lists.xml";
const AUTHORS_SITEMAP_PATH = "/sitemaps/authors.xml";
const EVENTS_SITEMAP_PATH = "/sitemaps/events.xml";
const CHECKLISTS_SITEMAP_PATH = "/sitemaps/checklists.xml";
const QUIZZES_SITEMAP_PATH = "/sitemaps/quizzes.xml";
const TOOLS_SITEMAP_PATH = "/sitemaps/tools.xml";
const CATALOG_SITEMAP_PATH = "/sitemaps/catalog.xml";
const WIKI_SITEMAP_PATH = "/sitemaps/wiki.xml";
const PAGINATED_INDEX_PURGE_LIMIT = 50;

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

function revalidateForCode(slug: string) {
  return applyRevalidation(
    [`/codes/${slug}`, ...paginatedIndexPaths("/codes"), "/", SITEMAP_INDEX_PATH, CODES_SITEMAP_PATH],
    [`code:${slug}`, "codes", "codes-index", "home"]
  );
}

function revalidateForArticle(slug: string) {
  return applyRevalidation(
    [`/articles/${slug}`, ...paginatedIndexPaths("/articles"), "/", SITEMAP_INDEX_PATH, ARTICLES_SITEMAP_PATH],
    [`article:${slug}`, "articles", "articles-index"]
  );
}

function revalidateForList(slug: string) {
  return applyRevalidation(
    [`/lists/${slug}`, `/lists/${slug}/page/[page]`, ...paginatedIndexPaths("/lists"), SITEMAP_INDEX_PATH, LISTS_SITEMAP_PATH],
    [`list:${slug}`, "lists", "lists-index"]
  );
}

function revalidateForAuthor(slug: string) {
  return applyRevalidation(
    [`/authors/${slug}`, "/authors", SITEMAP_INDEX_PATH, AUTHORS_SITEMAP_PATH],
    [`author:${slug}`, "authors", "authors-index"]
  );
}

function revalidateForEvents(slug: string) {
  return applyRevalidation(["/events", `/events/${slug}`, SITEMAP_INDEX_PATH, EVENTS_SITEMAP_PATH], ["events-pages"]);
}

function revalidateForChecklists(slug: string) {
  return applyRevalidation(
    [...paginatedIndexPaths("/checklists"), `/checklists/${slug}`, SITEMAP_INDEX_PATH, CHECKLISTS_SITEMAP_PATH],
    ["checklists-index"]
  );
}

function revalidateForQuizzes(slug: string) {
  return applyRevalidation(
    ["/quizzes", `/quizzes/${slug}`, SITEMAP_INDEX_PATH, QUIZZES_SITEMAP_PATH],
    ["quizzes-index"]
  );
}

function revalidateForWiki(slug: string) {
  return applyRevalidation(
    ["/wiki", `/wiki/${slug}`, SITEMAP_INDEX_PATH, WIKI_SITEMAP_PATH],
    [`wiki:${slug}`, "wiki-index"]
  );
}

function revalidateForTools(slug: string) {
  return applyRevalidation(
    [...paginatedIndexPaths("/tools"), `/tools/${slug}`, SITEMAP_INDEX_PATH, TOOLS_SITEMAP_PATH],
    ["tools-index"]
  );
}

function revalidateForMusic() {
  return applyRevalidation([
    "/catalog",
    ...paginatedIndexPaths("/catalog/roblox-music-ids"),
    ...paginatedIndexPaths("/catalog/roblox-music-ids/trending"),
    ...paginatedIndexPaths("/catalog/roblox-music-ids/genres"),
    "/catalog/roblox-music-ids/genres/[genre]",
    "/catalog/roblox-music-ids/genres/[genre]/page/[page]",
    ...paginatedIndexPaths("/catalog/roblox-music-ids/artists"),
    "/catalog/roblox-music-ids/artists/[artist]",
    "/catalog/roblox-music-ids/artists/[artist]/page/[page]",
    SITEMAP_INDEX_PATH,
    CATALOG_SITEMAP_PATH
  ]);
}

function isFreeItemsCatalogSlug(slug: string) {
  return FREE_ITEMS_CATALOG_PREFIXES.some((prefix) => slug === prefix || slug.startsWith(`${prefix}/`));
}

function revalidateForFreeItems() {
  return applyRevalidation(
    [
      "/catalog",
      ...paginatedIndexPaths(FREE_ITEMS_BASE_PATH),
      `${FREE_ITEMS_BASE_PATH}/[category]`,
      `${FREE_ITEMS_BASE_PATH}/[category]/page/[page]`,
      `${FREE_ITEMS_BASE_PATH}/[category]/[subcategory]`,
      `${FREE_ITEMS_BASE_PATH}/[category]/[subcategory]/page/[page]`,
      SITEMAP_INDEX_PATH,
      CATALOG_SITEMAP_PATH
    ],
    ["free-items-catalog"]
  );
}

function revalidateForCatalog(slug: string) {
  return applyRevalidation(
    ["/catalog", slug ? `/catalog/${slug}` : "", SITEMAP_INDEX_PATH, CATALOG_SITEMAP_PATH].filter(Boolean) as string[],
    [`catalog:${slug}`, "catalog-index"]
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

async function lookupListUniverseIds(slug: string): Promise<number[]> {
  const sb = supabaseAdmin();
  const { data: lists, error: listError } = await sb
    .from("game_lists")
    .select("id")
    .eq("slug", slug)
    .eq("is_published", true);

  if (listError) {
    console.warn("Wiki revalidation lookup failed for game_lists", listError.message);
    return [];
  }

  const listIds = (lists ?? [])
    .map((row) => (row as { id?: unknown }).id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (!listIds.length) return [];

  const { data: entries, error: entriesError } = await sb
    .from("game_list_entries")
    .select("universe_id")
    .in("list_id", listIds)
    .lte("rank", 3)
    .not("universe_id", "is", null);

  if (entriesError) {
    console.warn("Wiki revalidation lookup failed for game_list_entries", entriesError.message);
    return [];
  }

  return uniqueUniverseIds((entries ?? []) as Array<{ universe_id?: unknown }>);
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

async function lookupRelatedWikiSlugs(type: Payload["type"], slug: string): Promise<string[]> {
  if (type === "wiki" || type === "author" || type === "music") return [];

  let universeIds: number[] = [];

  if (type === "code") {
    universeIds = await lookupUniverseIdsBySlug("games", "slug", [slug]);
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
  } else if (type === "list") {
    universeIds = await lookupListUniverseIds(slug);
  }

  return lookupWikiSlugsByUniverseIds(universeIds);
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

  if (!payload || typeof payload !== "object" || typeof (payload as any).slug !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const slug = normalizeSlug(payload.slug);
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  let purgePaths: string[] = [];
  let impactedWikiSlugs: string[] = [];

  switch (payload.type) {
    case "code":
      purgePaths = revalidateForCode(slug);
      break;
    case "article":
      purgePaths = revalidateForArticle(slug);
      break;
    case "list":
      purgePaths = revalidateForList(slug);
      break;
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
    case "wiki":
      purgePaths = revalidateForWiki(slug);
      break;
    case "tool":
      purgePaths = revalidateForTools(slug);
      break;
    case "catalog":
      if (MUSIC_CATALOG_CODES.has(slug)) {
        purgePaths = [...purgePaths, ...revalidateForMusic()];
      }
      if (isFreeItemsCatalogSlug(slug)) {
        purgePaths = [...purgePaths, ...revalidateForFreeItems()];
      }
      purgePaths = [...purgePaths, ...revalidateForCatalog(slug)];
      break;
    case "music":
      purgePaths = revalidateForMusic();
      break;
    default:
      return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  }

  impactedWikiSlugs = await lookupRelatedWikiSlugs(payload.type, slug);
  for (const wikiSlug of impactedWikiSlugs) {
    purgePaths = [...purgePaths, ...revalidateForWiki(wikiSlug)];
  }

  const cloudflare = await purgeCloudflarePaths(purgePaths);
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
        type: payload.type,
        slug,
        impactedWikiSlugs,
        indexNow,
        cloudflare
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ revalidated: true, type: payload.type, slug, impactedWikiSlugs, indexNow, cloudflare });
}
