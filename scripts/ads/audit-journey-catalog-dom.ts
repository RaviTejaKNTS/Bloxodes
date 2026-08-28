import { load } from "cheerio";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const INDEXABLE_PATHS = new Set([
  "/catalog/roblox-music-ids",
  "/catalog/roblox-decal-ids"
]);

function isIndexablePath(pathname: string): boolean {
  if (INDEXABLE_PATHS.has(pathname)) return true;
  return /^\/catalog\/roblox-(music|decal)-ids\/games\/[^/]+$/.test(pathname);
}

type PageSnapshot = {
  html: string;
  requestedPath: string;
  responseUrl: string;
};

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

async function fetchPage(baseUrl: string, requestedPath: string): Promise<PageSnapshot> {
  const url = new URL(requestedPath.replace(/^\//, ""), baseUrl);
  const response = await fetch(url, {
    headers: { "user-agent": "Bloxodes Journey DOM audit" },
    redirect: "follow"
  });
  if (!response.ok) {
    throw new Error(`${requestedPath} returned ${response.status} at ${response.url}`);
  }
  return {
    html: await response.text(),
    requestedPath,
    responseUrl: response.url
  };
}

function auditPage(snapshot: PageSnapshot) {
  const $ = load(snapshot.html);
  const content = $("#article-body");
  const directItems = content.children("[data-journey-item]");
  const allItems = content.find("[data-journey-item]");
  const failures: string[] = [];

  if (content.length !== 1) {
    failures.push(`expected one #article-body, found ${content.length}`);
  }
  if (content.children().length < 2) {
    failures.push(`expected multiple direct content blocks, found ${content.children().length}`);
  }
  if (directItems.length < 1) {
    failures.push("expected at least one direct Journey item");
  }
  if (directItems.length !== allItems.length) {
    failures.push(`${allItems.length - directItems.length} Journey items are nested below another wrapper`);
  }
  if ($(".content_hint,.content_mobile_hint,.content_desktop_hint").length > 0) {
    failures.push("manual Mediavine content hints are present and would disable automatic placement");
  }

  const title = $("head title").text().trim();
  const description = $('head meta[name="description"]').attr("content")?.trim() ?? "";
  const canonical = $('head link[rel="canonical"]');
  const h1Count = $("main h1").length;
  const robots = $('head meta[name="robots"]').attr("content")?.toLowerCase() ?? "";
  const responsePathname = new URL(snapshot.responseUrl).pathname;
  const shouldIndex = isIndexablePath(responsePathname);
  if (!title) failures.push("SEO title is missing");
  if (!description) failures.push("meta description is missing");
  if (shouldIndex && (canonical.length !== 1 || !canonical.attr("href"))) {
    failures.push(`expected one populated canonical on the primary page, found ${canonical.length}`);
  }
  if (canonical.length > 1) failures.push(`found ${canonical.length} canonical links`);
  if (h1Count !== 1) failures.push(`expected one main h1, found ${h1Count}`);
  if (shouldIndex && robots.includes("noindex")) failures.push("primary catalog page is unexpectedly noindex");
  if (!shouldIndex && !robots.includes("noindex")) failures.push("secondary catalog route is unexpectedly indexable");

  const canonicalHref = canonical.attr("href");
  if (canonicalHref) {
    try {
      const canonicalUrl = new URL(canonicalHref);
      if (canonicalUrl.protocol !== "https:" || canonicalUrl.hostname !== "bloxodes.com") {
        failures.push(`canonical points outside the production HTTPS origin: ${canonicalHref}`);
      }
    } catch {
      failures.push(`canonical is not an absolute URL: ${canonicalHref}`);
    }
  }

  const jsonLdScripts = $('script[type="application/ld+json"]');
  if (!jsonLdScripts.length) failures.push("JSON-LD is missing");
  jsonLdScripts.each((index, element) => {
    try {
      JSON.parse($(element).text());
    } catch {
      failures.push(`JSON-LD script ${index + 1} is invalid JSON`);
    }
  });

  const ids = content
    .find("[id]")
    .map((_, element) => $(element).attr("id"))
    .get()
    .filter(Boolean);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length) {
    failures.push(`duplicate IDs found: ${[...new Set(duplicateIds)].join(", ")}`);
  }

  const imagesWithoutAlt = $("img").filter((_, element) => $(element).attr("alt") === undefined);
  if (imagesWithoutAlt.length) {
    failures.push(`${imagesWithoutAlt.length} images are missing alt attributes`);
  }

  directItems.each((index, element) => {
    const classNames = ($(element).attr("class") ?? "").split(/\s+/);
    if (classNames.includes("flex") || classNames.includes("inline-flex")) {
      failures.push(`direct Journey item ${index + 1} is a flex element`);
    }
  });

  if (failures.length) {
    throw new Error(`${snapshot.requestedPath}: ${failures.join("; ")}`);
  }

  return {
    directChildren: content.children().length,
    directItems: directItems.length,
    jsonLdScripts: jsonLdScripts.length,
    indexable: shouldIndex,
    requestedPath: snapshot.requestedPath,
    responsePath: new URL(snapshot.responseUrl).pathname + new URL(snapshot.responseUrl).search,
    selectorTag: content.get(0)?.tagName ?? "unknown",
    titleLength: title.length
  };
}

function discoverDetailPaths(snapshot: PageSnapshot, prefix: string): string[] {
  const $ = load(snapshot.html);
  const hrefs = $("#article-body > [data-journey-item] a")
    .map((_, element) => $(element).attr("href"))
    .get()
    .filter((value): value is string => Boolean(value?.startsWith(prefix) && !value.includes("/page/")));
  if (!hrefs.length) {
    throw new Error(`${snapshot.requestedPath}: could not discover a detail URL under ${prefix}`);
  }
  return [...new Set(hrefs)];
}

function discoverPageTwo(snapshot: PageSnapshot): string | null {
  const $ = load(snapshot.html);
  return $("a[href]")
    .map((_, element) => $(element).attr("href"))
    .get()
    .find((value): value is string => Boolean(value?.match(/\/page\/2(?:\?|$)/))) ?? null;
}

async function discoverPaginatedDetail(baseUrl: string, detailPaths: string[]): Promise<string | null> {
  for (const detailPath of detailPaths) {
    const snapshot = await fetchPage(baseUrl, detailPath);
    const pageTwo = discoverPageTwo(snapshot);
    if (pageTwo) return pageTwo;
  }
  return null;
}

async function main() {
  const baseUrl = normalizeBaseUrl(readArg("--base-url") ?? DEFAULT_BASE_URL);
  const requestedPaths = new Set<string>([
    "/catalog/roblox-music-ids",
    "/catalog/roblox-music-ids/page/2",
    "/catalog/roblox-music-ids/trending",
    "/catalog/roblox-music-ids/trending/page/2",
    "/catalog/roblox-music-ids/charts?range=weekly",
    "/catalog/roblox-music-ids/charts?range=monthly",
    "/catalog/roblox-music-ids/charts?range=yearly",
    "/catalog/roblox-music-ids/charts/page/2?range=weekly",
    "/catalog/roblox-music-ids/daily-top-500",
    "/catalog/roblox-music-ids/daily-top-500/page/2",
    "/catalog/roblox-music-ids/weekly",
    "/catalog/roblox-music-ids/weekly/page/2",
    "/catalog/roblox-music-ids/monthly",
    "/catalog/roblox-music-ids/monthly/page/2",
    "/catalog/roblox-music-ids/yearly",
    "/catalog/roblox-music-ids/yearly/page/2",
    "/catalog/roblox-music-ids/games",
    "/catalog/roblox-music-ids/genres",
    "/catalog/roblox-music-ids/artists",
    "/catalog/roblox-decal-ids",
    "/catalog/roblox-decal-ids/page/2",
    "/catalog/roblox-decal-ids/curated",
    "/catalog/roblox-decal-ids/curated/page/2",
    "/catalog/roblox-decal-ids/categories",
    "/catalog/roblox-decal-ids/games"
  ]);

  const genreHub = await fetchPage(baseUrl, "/catalog/roblox-music-ids/genres");
  const artistHub = await fetchPage(baseUrl, "/catalog/roblox-music-ids/artists");
  const decalCategoryHub = await fetchPage(baseUrl, "/catalog/roblox-decal-ids/categories");
  const musicGamesHub = await fetchPage(baseUrl, "/catalog/roblox-music-ids/games");
  const decalGamesHub = await fetchPage(baseUrl, "/catalog/roblox-decal-ids/games");
  const genrePaths = discoverDetailPaths(genreHub, "/catalog/roblox-music-ids/genres/");
  const artistPaths = discoverDetailPaths(artistHub, "/catalog/roblox-music-ids/artists/");
  const decalCategoryPaths = discoverDetailPaths(decalCategoryHub, "/catalog/roblox-decal-ids/categories/");
  const musicGamePaths = discoverDetailPaths(musicGamesHub, "/catalog/roblox-music-ids/games/");
  const decalGamePaths = discoverDetailPaths(decalGamesHub, "/catalog/roblox-decal-ids/games/");
  const genrePath = genrePaths[0]!;
  const artistPath = artistPaths[0]!;
  const decalCategoryPath = decalCategoryPaths[0]!;
  const musicGamePath = musicGamePaths[0]!;
  const decalGamePath = decalGamePaths[0]!;
  requestedPaths.add(genrePath);
  requestedPaths.add(artistPath);
  requestedPaths.add(decalCategoryPath);
  requestedPaths.add(musicGamePath);
  requestedPaths.add(decalGamePath);

  const paginatedDetailPaths = await Promise.all([
    discoverPaginatedDetail(baseUrl, genrePaths),
    discoverPaginatedDetail(baseUrl, artistPaths),
    discoverPaginatedDetail(baseUrl, decalCategoryPaths),
    discoverPaginatedDetail(baseUrl, musicGamePaths),
    discoverPaginatedDetail(baseUrl, decalGamePaths)
  ]);
  for (const pageTwo of paginatedDetailPaths) {
    if (pageTwo) requestedPaths.add(pageTwo);
  }

  const results = [];
  for (const requestedPath of requestedPaths) {
    const snapshot = await fetchPage(baseUrl, requestedPath);
    results.push(auditPage(snapshot));
  }

  console.table(results);
  console.log(`Journey DOM audit passed for ${results.length} Music IDs and Decal IDs route variants.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
