export const CACHE_TAG_HEADER = "Cache-Tag";

export type PublicCacheEventType =
  | "code"
  | "article"
  | "author"
  | "event"
  | "checklist"
  | "tool"
  | "catalog"
  | "music"
  | "quiz"
  | "puzzle"
  | "wiki"
  | "wiki_collection"
  | "stats";

export type PublicCacheEvent = {
  type: PublicCacheEventType;
  slug: string;
};

const MUSIC_CATALOG_CODE = "roblox-music-ids";
const DECAL_CATALOG_CODE = "roblox-decal-ids";
const FREE_ITEMS_CATALOG_CODE = "free-roblox-items";
const LEGACY_FREE_ITEMS_CATALOG_CODE = "roblox-free-items";
const AVATAR_CATALOG_MASTER_CODE = "roblox-items-and-bundles";
const AVATAR_CATALOG_LEGACY_MASTER_CODE = "roblox-avatar-items";
const AVATAR_CATALOG_LEGACY_PREFIXES = [
  "roblox-accessories",
  "roblox-clothing",
  "roblox-body-parts",
  "roblox-emotes",
  "roblox-animations",
  "roblox-makeup"
];

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function normalizeCacheSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
}

function normalizePathname(pathname: string) {
  const path = pathname.split("?")[0]?.split("#")[0] || "/";
  if (path === "/") return "/";
  return `/${path.replace(/^\/+|\/+$/g, "")}`;
}

function slugTag(prefix: string, slug: string) {
  const normalized = normalizeCacheSlug(slug);
  return normalized ? `${prefix}:${normalized}` : "";
}

function sitemapTags(name?: string) {
  return unique(name ? ["site", `sitemap:${name}`] : ["site", "sitemap"]);
}

function freeItemScopeTags(slug: string) {
  const parts = normalizeCacheSlug(slug).split("/").filter(Boolean);
  const prefix = parts[0];
  const category = parts[1];
  const subcategory = parts[2];
  const tags = ["free-items-catalog", slugTag("catalog", FREE_ITEMS_CATALOG_CODE)];

  if (prefix === FREE_ITEMS_CATALOG_CODE || prefix === LEGACY_FREE_ITEMS_CATALOG_CODE) {
    if (category && category !== "page") tags.push(`free-items-category:${category}`);
    if (category && category !== "page" && subcategory && subcategory !== "page") {
      tags.push(`free-items-subcategory:${category}/${subcategory}`);
    }
  }

  return tags;
}

function musicScopeTags(slug: string) {
  const parts = normalizeCacheSlug(slug).split("/").filter(Boolean);
  const section = parts[1];
  const value = parts[2];
  const tags = ["music-catalog", slugTag("catalog", MUSIC_CATALOG_CODE)];

  if (section === "genres" && value) tags.push(`music-genre:${value}`);
  if (section === "artists" && value) tags.push(`music-artist:${value}`);
  if (section === "games" && value) tags.push(`music-game:${value}`);

  return tags;
}

function decalScopeTags(slug: string) {
  const parts = normalizeCacheSlug(slug).split("/").filter(Boolean);
  const section = parts[1];
  const value = parts[2];
  const tags = ["decal-catalog", slugTag("catalog", DECAL_CATALOG_CODE)];

  if (section === "categories" && value) tags.push(`decal-category:${value}`);
  if (section === "games" && value) tags.push(`decal-game:${value}`);

  return tags;
}

function normalizeAvatarCatalogSlugForTags(slug: string) {
  const parts = normalizeCacheSlug(slug).split("/").filter(Boolean);
  const [prefix, ...rest] = parts;

  if (prefix === AVATAR_CATALOG_MASTER_CODE) {
    return parts.join("/");
  }

  if (prefix === AVATAR_CATALOG_LEGACY_MASTER_CODE) {
    return [AVATAR_CATALOG_MASTER_CODE, ...rest].join("/");
  }

  if (AVATAR_CATALOG_LEGACY_PREFIXES.some((entry) => entry === prefix)) {
    return [AVATAR_CATALOG_MASTER_CODE, ...parts].join("/");
  }

  return parts.join("/");
}

function isAvatarCatalogSlug(slug: string) {
  const normalized = normalizeAvatarCatalogSlugForTags(slug);
  return normalized === AVATAR_CATALOG_MASTER_CODE || normalized.startsWith(`${AVATAR_CATALOG_MASTER_CODE}/`);
}

function avatarCatalogScopeTags(slug: string) {
  const normalized = normalizeAvatarCatalogSlugForTags(slug);
  const parts = normalized.split("/").filter(Boolean);
  const familyCode = parts.length > 1 ? parts.slice(0, 2).join("/") : "";
  return unique([
    "avatar-catalog",
    slugTag("avatar-catalog", AVATAR_CATALOG_MASTER_CODE),
    slugTag("avatar-catalog", normalized),
    familyCode ? slugTag("avatar-catalog", familyCode) : "",
    slugTag("catalog", normalized)
  ]);
}

export function cacheTagsForPath(pathname: string) {
  const pathnameOnly = normalizePathname(pathname);
  const segments = pathnameOnly.split("/").filter(Boolean);
  const [first, second, third, fourth] = segments;
  const tags = ["site"];

  if (pathnameOnly === "/") {
    return unique([...tags, "home"]);
  }

  if (pathnameOnly === "/feed.xml") {
    return unique([...tags, "feed"]);
  }

  if (
    [
      "/about",
      "/contact",
      "/privacy-policy",
      "/terms-of-service",
      "/editorial-guidelines",
      "/disclaimer",
      "/how-we-gather-and-verify-codes",
      "/cookie-settings"
    ].includes(pathnameOnly)
  ) {
    return unique([...tags, "main"]);
  }

  if (pathnameOnly === "/sitemap.xml") {
    return sitemapTags();
  }

  if (first === "sitemaps") {
    return sitemapTags(second?.replace(/\.xml$/i, ""));
  }

  if (first === "codes") {
    if (!second || second === "page") return unique([...tags, "codes-index"]);
    return unique([...tags, "codes", slugTag("code", second)]);
  }

  if (first === "articles") {
    if (!second || second === "page") return unique([...tags, "articles-index"]);
    if (second === "games") {
      if (!third || third === "page") return unique([...tags, "articles-index", "articles-games"]);
      return unique([...tags, "articles-index", "articles-games", slugTag("article-game", third)]);
    }
    return unique([...tags, "articles", slugTag("article", second)]);
  }

  if (first === "authors") {
    if (!second || second === "page") return unique([...tags, "authors-index"]);
    return unique([...tags, "authors", slugTag("author", second)]);
  }

  if (first === "events") {
    if (!second || second === "page") return unique([...tags, "events-index"]);
    return unique([...tags, "events", slugTag("event", second)]);
  }

  if (first === "checklists") {
    if (!second || second === "page") return unique([...tags, "checklists-index"]);
    return unique([...tags, "checklists", slugTag("checklist", second)]);
  }

  if (first === "quizzes") {
    if (!second || second === "page") return unique([...tags, "quizzes-index"]);
    return unique([...tags, "quizzes", slugTag("quiz", second)]);
  }

  if (first === "puzzles") {
    if (!second || second === "page") return unique([...tags, "puzzles-index"]);
    return unique([...tags, "puzzles", slugTag("puzzle", second)]);
  }

  if (first === "tools") {
    if (!second || second === "page") return unique([...tags, "tools-index"]);
    return unique([...tags, "tools", slugTag("tool", segments.join("/").replace(/^tools\//, ""))]);
  }

  if (first === "stats") {
    if (!second) return unique([...tags, "stats", "stats-home"]);
    if (second === "games" && !third) return unique([...tags, "stats", "stats-games"]);
    if (second === "games" && third) return unique([...tags, "stats", "stats-games", slugTag("stats-game", third)]);
    if (second === "creators") return unique([...tags, "stats", "stats-creators"]);
    if (second === "items") return unique([...tags, "stats", "stats-items"]);
    return unique([...tags, "stats"]);
  }

  if (first === "wiki") {
    if (!second || second === "page") return unique([...tags, "wiki-index"]);
    if (third && third !== "page") {
      return unique([
        ...tags,
        "wiki-collection-index",
        slugTag("wiki", second),
        slugTag("wiki-collection", `${second}/${third}`)
      ]);
    }
    return unique([...tags, "wiki", slugTag("wiki", second)]);
  }

  if (first === "catalog") {
    if (!second || second === "page") return unique([...tags, "catalog-index"]);

    const catalogSlug = segments.slice(1).join("/");
    const catalogSlugForTags = catalogSlug.replace(/\/page(?:\/\d+)?$/i, "");
    const catalogTags = [...tags, "catalog", slugTag("catalog", second)];

    if (second === FREE_ITEMS_CATALOG_CODE || second === LEGACY_FREE_ITEMS_CATALOG_CODE) {
      catalogTags.push(...freeItemScopeTags(catalogSlug));
      if (third && third !== "page") catalogTags.push(`free-items-category:${third}`);
      if (third && third !== "page" && fourth && fourth !== "page") {
        catalogTags.push(`free-items-subcategory:${third}/${fourth}`);
      }
    }

    if (second === MUSIC_CATALOG_CODE) {
      catalogTags.push(...musicScopeTags(catalogSlug));
      if (third === "genres" && fourth) catalogTags.push(`music-genre:${fourth}`);
      if (third === "artists" && fourth) catalogTags.push(`music-artist:${fourth}`);
    }

    if (second === DECAL_CATALOG_CODE) {
      catalogTags.push(...decalScopeTags(catalogSlug));
      if (third === "categories" && fourth) catalogTags.push(`decal-category:${fourth}`);
      if (third === "games" && fourth) catalogTags.push(`decal-game:${fourth}`);
    }

    if (isAvatarCatalogSlug(catalogSlugForTags)) {
      catalogTags.push(...avatarCatalogScopeTags(catalogSlugForTags));
    }

    return unique(catalogTags);
  }

  return [];
}

export function cacheTagsForEvent(type: PublicCacheEventType, slug: string) {
  const normalized = normalizeCacheSlug(slug);
  const base: string[] = [];

  switch (type) {
    case "code":
      return unique([...base, slugTag("code", normalized), "codes", "codes-index", "home", "feed", "sitemap", "sitemap:codes"]);
    case "article":
      return unique([
        ...base,
        slugTag("article", normalized),
        "articles",
        "articles-index",
        "articles-games",
        "home",
        "feed",
        "sitemap",
        "sitemap:articles"
      ]);
    case "author":
      return unique([...base, slugTag("author", normalized), "authors-index", "sitemap", "sitemap:authors"]);
    case "event":
      return unique([...base, slugTag("event", normalized), "events", "events-index", "home", "feed", "sitemap", "sitemap:events"]);
    case "checklist":
      return unique([
        ...base,
        slugTag("checklist", normalized),
        "checklists",
        "checklists-index",
        "home",
        "feed",
        "sitemap",
        "sitemap:checklists"
      ]);
    case "tool":
      return unique([...base, slugTag("tool", normalized), "tools", "tools-index", "home", "sitemap", "sitemap:tools"]);
    case "quiz":
      return unique([...base, slugTag("quiz", normalized), "quizzes", "quizzes-index", "home", "sitemap", "sitemap:quizzes"]);
    case "puzzle": {
      const [puzzleSlug] = normalized.split("/");
      return unique([
        ...base,
        puzzleSlug ? slugTag("puzzle", puzzleSlug) : "",
        "puzzles",
        "puzzles-index",
        "home",
        "feed",
        "sitemap",
        "sitemap:puzzles"
      ]);
    }
    case "wiki":
      return unique([...base, slugTag("wiki", normalized), "wiki-index", "home", "sitemap", "sitemap:wiki"]);
    case "stats":
      return unique([
        ...base,
        "stats",
        normalized === "home" || normalized === "stats" ? "stats-home" : "",
        normalized === "games" ? "stats-games" : "",
        normalized === "creators" ? "stats-creators" : "",
        normalized === "items" ? "stats-items" : "",
        normalized.startsWith("games/") ? "stats-games" : "",
        normalized.startsWith("games/") ? slugTag("stats-game", normalized.replace(/^games\//, "")) : "",
        "home",
        "sitemap",
        "sitemap:stats"
      ]);
    case "wiki_collection": {
      const [wikiSlug, collectionSlug] = normalized.split("/");
      const flatCatalogSlug = wikiSlug && collectionSlug ? `${wikiSlug}-${collectionSlug}` : "";
      return unique([
        ...base,
        wikiSlug ? slugTag("wiki", wikiSlug) : "",
        wikiSlug && collectionSlug ? slugTag("wiki-collection", `${wikiSlug}/${collectionSlug}`) : "",
        flatCatalogSlug ? slugTag("catalog", flatCatalogSlug) : "",
        "wiki-index",
        "wiki-collection-index",
        "home",
        "sitemap",
        "sitemap:wiki",
        "sitemap:catalog"
      ]);
    }
    case "catalog": {
      const tags = [
        ...base,
        slugTag("catalog", normalized),
        "catalog-index",
        "home",
        "sitemap",
        "sitemap:catalog"
      ];

      if (normalized === MUSIC_CATALOG_CODE || normalized.startsWith(`${MUSIC_CATALOG_CODE}/`)) {
        tags.push(...musicScopeTags(normalized));
      }

      if (normalized === DECAL_CATALOG_CODE || normalized.startsWith(`${DECAL_CATALOG_CODE}/`)) {
        tags.push(...decalScopeTags(normalized));
      }

      if (
        normalized === FREE_ITEMS_CATALOG_CODE ||
        normalized.startsWith(`${FREE_ITEMS_CATALOG_CODE}/`) ||
        normalized === LEGACY_FREE_ITEMS_CATALOG_CODE ||
        normalized.startsWith(`${LEGACY_FREE_ITEMS_CATALOG_CODE}/`)
      ) {
        tags.push(...freeItemScopeTags(normalized));
      }

      if (isAvatarCatalogSlug(normalized)) {
        tags.push(...avatarCatalogScopeTags(normalized));
      }

      return unique(tags);
    }
    case "music":
      return unique([
        ...base,
        ...musicScopeTags(normalized || MUSIC_CATALOG_CODE),
        "catalog-index",
        "home",
        "sitemap",
        "sitemap:catalog"
      ]);
    default:
      return unique(base);
  }
}

export function cacheTagsForEvents(events: PublicCacheEvent[]) {
  return unique(events.flatMap((event) => cacheTagsForEvent(event.type, event.slug)));
}

export function serializeCacheTags(tags: string[]) {
  return unique(tags).join(",");
}
