import { load } from "cheerio";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

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
    requestedPath: snapshot.requestedPath,
    responsePath: new URL(snapshot.responseUrl).pathname + new URL(snapshot.responseUrl).search,
    selectorTag: content.get(0)?.tagName ?? "unknown"
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
    "/catalog/roblox-music-ids/genres",
    "/catalog/roblox-music-ids/artists",
    "/catalog/roblox-decal-ids",
    "/catalog/roblox-decal-ids/page/2",
    "/catalog/roblox-decal-ids/curated",
    "/catalog/roblox-decal-ids/curated/page/2",
    "/catalog/roblox-decal-ids/categories"
  ]);

  const genreHub = await fetchPage(baseUrl, "/catalog/roblox-music-ids/genres");
  const artistHub = await fetchPage(baseUrl, "/catalog/roblox-music-ids/artists");
  const decalCategoryHub = await fetchPage(baseUrl, "/catalog/roblox-decal-ids/categories");
  const genrePaths = discoverDetailPaths(genreHub, "/catalog/roblox-music-ids/genres/");
  const artistPaths = discoverDetailPaths(artistHub, "/catalog/roblox-music-ids/artists/");
  const decalCategoryPaths = discoverDetailPaths(decalCategoryHub, "/catalog/roblox-decal-ids/categories/");
  const genrePath = genrePaths[0]!;
  const artistPath = artistPaths[0]!;
  const decalCategoryPath = decalCategoryPaths[0]!;
  requestedPaths.add(genrePath);
  requestedPaths.add(artistPath);
  requestedPaths.add(decalCategoryPath);

  const paginatedDetailPaths = await Promise.all([
    discoverPaginatedDetail(baseUrl, genrePaths),
    discoverPaginatedDetail(baseUrl, artistPaths),
    discoverPaginatedDetail(baseUrl, decalCategoryPaths)
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
