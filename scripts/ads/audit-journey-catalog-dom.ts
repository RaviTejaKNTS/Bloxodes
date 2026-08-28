import { load } from "cheerio";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const INDEXABLE_PATHS = new Set([
  "/catalog/roblox-music-ids",
  "/catalog/roblox-music-ids/trending",
  "/catalog/roblox-decal-ids",
  "/catalog/roblox-decal-ids/curated",
  "/catalog/roblox-dictionary",
  "/catalog/roblox-font-ids",
  "/catalog/roblox-mesh-ids",
  "/catalog/roblox-color-codes",
  "/catalog/roblox-errors-and-fixes",
  "/catalog/roblox-promo-codes",
  "/catalog/free-roblox-items",
  "/catalog/roblox-items-and-bundles",
  "/catalog/roblox-items-and-bundles/roblox-accessories",
  "/catalog/roblox-items-and-bundles/roblox-clothing",
  "/catalog/roblox-items-and-bundles/roblox-body-parts",
  "/catalog/roblox-items-and-bundles/roblox-emotes",
  "/catalog/roblox-items-and-bundles/roblox-animations",
  "/catalog/roblox-items-and-bundles/roblox-makeup",
  "/catalog/admin-commands",
  "/articles",
  "/codes",
  "/checklists",
  "/quizzes",
  "/tools",
  "/events",
  "/authors",
  "/wiki",
  "/catalog",
  "/puzzles",
  "/stats/reports"
]);

function isIndexablePath(pathname: string): boolean {
  if (INDEXABLE_PATHS.has(pathname)) return true;
  return [
    /^\/catalog\/roblox-(music|decal)-ids\/games\/[^/]+$/,
    /^\/articles\/[^/]+$/,
    /^\/articles\/games\/[^/]+$/,
    /^\/wiki\/[^/]+$/,
    /^\/wiki\/[^/]+\/[^/]+$/,
    /^\/puzzles\/[^/]+$/,
    /^\/authors\/[^/]+$/,
    /^\/(?:codes|checklists|events|quizzes)\/[^/]+$/,
    /^\/tools\/(?!page\/)[^/]+(?:\/[^/]+)*$/,
    /^\/stats\/reports\/[^/]+$/
  ].some((pattern) => pattern.test(pathname));
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

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= values.length) return;
      results[index] = await mapper(values[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(concurrency, 1), values.length) }, () => worker())
  );
  return results;
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

async function filterExistingPaths(baseUrl: string, paths: string[], label: string): Promise<string[]> {
  const uniquePaths = [...new Set(paths)];
  const checkedPaths = await mapWithConcurrency(uniquePaths, 4, async (path) => {
    const url = new URL(path.replace(/^\//, ""), baseUrl);
    const response = await fetch(url, {
      headers: { "user-agent": "Bloxodes Journey DOM audit" },
      redirect: "follow"
    });
    if (response.ok) return path;
    if (response.status === 404) {
      console.warn(`Skipped missing ${label} route: ${path}`);
      return null;
    }
    throw new Error(`${path} returned ${response.status} while validating ${label} routes`);
  });
  return checkedPaths.filter((path): path is string => Boolean(path));
}

function auditPage(snapshot: PageSnapshot) {
  const $ = load(snapshot.html);
  const content = $("#article-body");
  const directItems = content.children("[data-journey-item]");
  const allItems = content.find("[data-journey-item]");
  const hasEmptyState = content.is('[class*="border-dashed"]') || content.find('[class*="border-dashed"]').length > 0;
  const isJourneyStream = content.hasClass("journey-content-stream");
  const isStructuredStream =
    content.hasClass("journey-content-stream--prose") ||
    content.hasClass("journey-content-stream--interactive");
  const failures: string[] = [];

  if (content.length !== 1) {
    failures.push(`expected one #article-body, found ${content.length}`);
  }
  if (!isJourneyStream) {
    failures.push("#article-body is missing the Journey content stream contract");
  }
  if (!isStructuredStream && content.children().length < 2 && directItems.length > 1 && !hasEmptyState) {
    failures.push(`expected multiple direct content blocks, found ${content.children().length}`);
  }
  if (!isStructuredStream && directItems.length < 1 && !hasEmptyState) {
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
    emptyState: hasEmptyState,
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
  return [...new Set(hrefs)];
}

function discoverArticleBodyPaths(snapshot: PageSnapshot, prefix: string): string[] {
  const $ = load(snapshot.html);
  const hrefs = $("#article-body a[href]")
    .map((_, element) => $(element).attr("href"))
    .get()
    .filter((value): value is string => Boolean(value?.startsWith(prefix) && !value.includes("/page/")));
  return [...new Set(hrefs)];
}

function discoverPageTwo(snapshot: PageSnapshot): string | null {
  const $ = load(snapshot.html);
  return $("a[href]")
    .map((_, element) => $(element).attr("href"))
    .get()
    .find((value): value is string => Boolean(value?.match(/\/page\/2(?:\?|$)/))) ?? null;
}

async function discoverPaginatedDetails(baseUrl: string, detailPaths: string[]): Promise<string[]> {
  const pageTwoPaths = new Set<string>();
  const discovered = await mapWithConcurrency(detailPaths, 4, async (detailPath) => {
    const snapshot = await fetchPage(baseUrl, detailPath);
    return discoverPageTwo(snapshot);
  });
  for (const pageTwo of discovered) {
    if (pageTwo) pageTwoPaths.add(pageTwo);
  }
  return [...pageTwoPaths];
}

async function main() {
  const baseUrl = normalizeBaseUrl(readArg("--base-url") ?? DEFAULT_BASE_URL);
  const requestedPaths = new Set<string>([
    "/catalog/roblox-music-ids",
    "/catalog/roblox-music-ids/trending",
    "/catalog/roblox-music-ids/charts?range=weekly",
    "/catalog/roblox-music-ids/charts?range=monthly",
    "/catalog/roblox-music-ids/charts?range=yearly",
    "/catalog/roblox-music-ids/daily-top-500",
    "/catalog/roblox-music-ids/weekly",
    "/catalog/roblox-music-ids/monthly",
    "/catalog/roblox-music-ids/yearly",
    "/catalog/roblox-music-ids/games",
    "/catalog/roblox-music-ids/genres",
    "/catalog/roblox-music-ids/artists",
    "/catalog/roblox-decal-ids",
    "/catalog/roblox-decal-ids/curated",
    "/catalog/roblox-decal-ids/categories",
    "/catalog/roblox-decal-ids/games",
    "/catalog/roblox-dictionary",
    "/catalog/roblox-font-ids",
    "/catalog/roblox-mesh-ids",
    "/catalog/roblox-color-codes",
    "/catalog/roblox-errors-and-fixes",
    "/catalog/roblox-promo-codes",
    "/catalog/free-roblox-items",
    "/catalog/roblox-items-and-bundles",
    "/catalog/roblox-items-and-bundles/roblox-accessories",
    "/catalog/roblox-items-and-bundles/roblox-clothing",
    "/catalog/roblox-items-and-bundles/roblox-body-parts",
    "/catalog/roblox-items-and-bundles/roblox-emotes",
    "/catalog/roblox-items-and-bundles/roblox-animations",
    "/catalog/roblox-items-and-bundles/roblox-makeup",
    "/catalog/admin-commands",
    "/articles",
    "/codes",
    "/checklists",
    "/quizzes",
    "/tools",
    "/events",
    "/authors",
    "/wiki",
    "/catalog",
    "/puzzles",
    "/stats/reports"
  ]);

  const paginatedIndexRoots = [
    "/catalog/roblox-music-ids",
    "/catalog/roblox-music-ids/trending",
    "/catalog/roblox-music-ids/charts?range=weekly",
    "/catalog/roblox-music-ids/charts?range=monthly",
    "/catalog/roblox-music-ids/charts?range=yearly",
    "/catalog/roblox-music-ids/daily-top-500",
    "/catalog/roblox-music-ids/weekly",
    "/catalog/roblox-music-ids/monthly",
    "/catalog/roblox-music-ids/yearly",
    "/catalog/roblox-decal-ids",
    "/catalog/roblox-decal-ids/curated",
    "/articles",
    "/codes",
    "/checklists",
    "/tools",
    "/catalog/free-roblox-items",
    "/catalog/roblox-items-and-bundles",
    "/catalog/roblox-mesh-ids"
  ];
  const paginatedIndexPaths = await Promise.all(
    paginatedIndexRoots.map(async (rootPath) => discoverPageTwo(await fetchPage(baseUrl, rootPath)))
  );
  const existingPaginatedIndexPaths = await filterExistingPaths(
    baseUrl,
    paginatedIndexPaths.filter((path): path is string => Boolean(path)),
    "index pagination"
  );
  for (const pageTwo of existingPaginatedIndexPaths) {
    if (pageTwo) requestedPaths.add(pageTwo);
  }

  const genreHub = await fetchPage(baseUrl, "/catalog/roblox-music-ids/genres");
  const artistHub = await fetchPage(baseUrl, "/catalog/roblox-music-ids/artists");
  const decalCategoryHub = await fetchPage(baseUrl, "/catalog/roblox-decal-ids/categories");
  const musicGamesHub = await fetchPage(baseUrl, "/catalog/roblox-music-ids/games");
  const decalGamesHub = await fetchPage(baseUrl, "/catalog/roblox-decal-ids/games");
  const genrePaths = discoverDetailPaths(genreHub, "/catalog/roblox-music-ids/genres/");
  const artistPaths = discoverDetailPaths(artistHub, "/catalog/roblox-music-ids/artists/");
  const decalCategoryPaths = discoverArticleBodyPaths(decalCategoryHub, "/catalog/roblox-decal-ids/categories/");
  const musicGamePaths = discoverArticleBodyPaths(musicGamesHub, "/catalog/roblox-music-ids/games/");
  const decalGamePaths = discoverArticleBodyPaths(decalGamesHub, "/catalog/roblox-decal-ids/games/");
  const freeItemPaths = discoverArticleBodyPaths(
    await fetchPage(baseUrl, "/catalog/free-roblox-items"),
    "/catalog/free-roblox-items/"
  );
  const avatarCatalogPaths = discoverArticleBodyPaths(
    await fetchPage(baseUrl, "/catalog/roblox-items-and-bundles"),
    "/catalog/roblox-items-and-bundles/"
  );
  const structuredDetailRoots = [
    { root: "/articles", prefix: "/articles/" },
    { root: "/wiki", prefix: "/wiki/" },
    { root: "/puzzles", prefix: "/puzzles/" },
    { root: "/tools", prefix: "/tools/" },
    { root: "/authors", prefix: "/authors/" },
    { root: "/stats/reports", prefix: "/stats/reports/" },
    { root: "/codes", prefix: "/codes/" },
    { root: "/checklists", prefix: "/checklists/" },
    { root: "/events", prefix: "/events/" },
    { root: "/quizzes", prefix: "/quizzes/" }
  ] as const;
  const structuredDetailPaths = new Set<string>();
  const structuredRootDiscoveries = await mapWithConcurrency(structuredDetailRoots, 6, async ({ root, prefix }) => {
    const snapshot = await fetchPage(baseUrl, root);
    return discoverArticleBodyPaths(snapshot, prefix);
  });
  for (const detailPaths of structuredRootDiscoveries) {
    for (const detailPath of detailPaths) structuredDetailPaths.add(detailPath);
  }

  // Wiki hubs link to their collection pages, while collection pages can also
  // expose related collections. Follow a bounded number of passes so the audit
  // covers the deeper route family without wandering through unrelated links.
  for (let pass = 0; pass < 1; pass += 1) {
    const wikiPaths = await filterExistingPaths(
      baseUrl,
      [...structuredDetailPaths].filter((path) => /^\/wiki\/[^/]+(?:\/[^/]+)?$/.test(path)),
      "wiki discovery"
    );
    const wikiDiscoveries = await mapWithConcurrency(wikiPaths, 2, async (wikiPath) => {
      const snapshot = await fetchPage(baseUrl, wikiPath);
      return discoverArticleBodyPaths(snapshot, "/wiki/");
    });
    for (const detailPaths of wikiDiscoveries) {
      for (const detailPath of detailPaths) structuredDetailPaths.add(detailPath);
    }
  }

  const existingDetailPaths = await filterExistingPaths(
    baseUrl,
    [
      ...genrePaths,
      ...artistPaths,
      ...decalCategoryPaths,
      ...musicGamePaths,
      ...decalGamePaths,
      ...freeItemPaths,
      ...avatarCatalogPaths,
      ...structuredDetailPaths
    ],
    "discovered"
  );
  for (const detailPath of existingDetailPaths) {
    requestedPaths.add(detailPath);
  }

  const paginatedDetailPaths = await Promise.all([
    discoverPaginatedDetails(baseUrl, existingDetailPaths.filter((path) => genrePaths.includes(path))),
    discoverPaginatedDetails(baseUrl, existingDetailPaths.filter((path) => artistPaths.includes(path))),
    discoverPaginatedDetails(baseUrl, existingDetailPaths.filter((path) => decalCategoryPaths.includes(path))),
    discoverPaginatedDetails(baseUrl, existingDetailPaths.filter((path) => musicGamePaths.includes(path))),
    discoverPaginatedDetails(baseUrl, existingDetailPaths.filter((path) => decalGamePaths.includes(path))),
    discoverPaginatedDetails(baseUrl, existingDetailPaths.filter((path) => freeItemPaths.includes(path))),
    discoverPaginatedDetails(baseUrl, existingDetailPaths.filter((path) => avatarCatalogPaths.includes(path))),
    discoverPaginatedDetails(baseUrl, existingDetailPaths.filter((path) => structuredDetailPaths.has(path)))
  ]);
  const existingPaginatedDetailPaths = await filterExistingPaths(
    baseUrl,
    paginatedDetailPaths.flat(),
    "detail pagination"
  );
  for (const pageTwo of existingPaginatedDetailPaths) {
    requestedPaths.add(pageTwo);
  }

  console.log(`Auditing ${requestedPaths.size} server-rendered route variants.`);
  const results = await mapWithConcurrency([...requestedPaths], 2, async (requestedPath) => {
    const snapshot = await fetchPage(baseUrl, requestedPath);
    return auditPage(snapshot);
  });

  console.table(results);
  console.log(`Journey DOM audit passed for ${results.length} route variants.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
