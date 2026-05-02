import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { purgeCloudflarePaths } from "@/lib/cloudflare-cache";

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
  return applyRevalidation(["/events", `/events/${slug}`, SITEMAP_INDEX_PATH, EVENTS_SITEMAP_PATH]);
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
        indexNow,
        cloudflare
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ revalidated: true, type: payload.type, slug, indexNow, cloudflare });
}
