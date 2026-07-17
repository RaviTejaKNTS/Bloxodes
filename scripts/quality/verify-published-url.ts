import { load } from "cheerio";

type Expectation = "present" | "absent";

type Options = {
  baseUrl: string;
  path: string;
  sitemapPath: string;
  expectation: Expectation;
  attempts: number;
  delayMs: number;
  timeoutMs: number;
};

const SITEMAP_BY_PREFIX = [
  ["/articles/", "/sitemaps/articles.xml"],
  ["/authors/", "/sitemaps/authors.xml"],
  ["/catalog/", "/sitemaps/catalog.xml"],
  ["/checklists/", "/sitemaps/checklists.xml"],
  ["/codes/", "/sitemaps/codes.xml"],
  ["/events/", "/sitemaps/events.xml"],
  ["/puzzles/", "/sitemaps/puzzles.xml"],
  ["/quizzes/", "/sitemaps/quizzes.xml"],
  ["/stats/", "/sitemaps/stats.xml"],
  ["/tools/", "/sitemaps/tools.xml"],
  ["/wiki/", "/sitemaps/wiki.xml"]
] as const;

function normalizeOrigin(value: string) {
  return new URL(value).origin;
}

function normalizePath(value: string) {
  const url = new URL(value, "https://bloxodes.invalid");
  return `${url.pathname}${url.search}`;
}

function comparableUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function inferSitemapPath(pathname: string) {
  return SITEMAP_BY_PREFIX.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "/sitemaps/main.xml";
}

function positiveInteger(value: string | undefined, fallback: number, name: string) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function parseOptions(): Options {
  const args = process.argv.slice(2);
  let path = "";
  let baseUrl = process.env.PUBLISH_VERIFY_BASE_URL || process.env.SITE_URL || "https://bloxodes.com";
  let sitemapPath = "";
  let expectation: Expectation = "present";
  let attempts = 6;
  let delayMs = 5_000;
  let timeoutMs = 15_000;

  const next = (name: string) => {
    const value = args.shift();
    if (!value) throw new Error(`${name} requires a value`);
    return value;
  };

  while (args.length) {
    const arg = args.shift();
    if (arg === "--path") path = next(arg);
    else if (arg === "--base-url") baseUrl = next(arg);
    else if (arg === "--sitemap") sitemapPath = next(arg);
    else if (arg === "--expect") {
      const value = next(arg);
      if (value !== "present" && value !== "absent") throw new Error("--expect must be present or absent");
      expectation = value;
    } else if (arg === "--attempts") attempts = positiveInteger(next(arg), attempts, arg);
    else if (arg === "--delay-ms") delayMs = positiveInteger(next(arg), delayMs, arg);
    else if (arg === "--timeout-ms") timeoutMs = positiveInteger(next(arg), timeoutMs, arg);
    else if (arg === "--help") {
      console.log(
        "Usage: npm run verify:published-url -- --path /wiki/game/collection [--expect present|absent] [--sitemap /sitemaps/wiki.xml] [--base-url https://bloxodes.com]"
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!path) throw new Error("--path is required");
  const normalizedPath = normalizePath(path);
  return {
    baseUrl: normalizeOrigin(baseUrl),
    path: normalizedPath,
    sitemapPath: sitemapPath ? normalizePath(sitemapPath) : inferSitemapPath(new URL(normalizedPath, baseUrl).pathname),
    expectation,
    attempts,
    delayMs,
    timeoutMs
  };
}

async function fetchText(url: string, timeoutMs: number) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "user-agent": "Bloxodes targeted publish verifier" },
    signal: AbortSignal.timeout(timeoutMs)
  });
  return { response, body: await response.text() };
}

async function verifyOnce(options: Options) {
  const canonicalUrl = `${options.baseUrl}${options.path}`;
  const sitemapUrl = `${options.baseUrl}${options.sitemapPath}`;
  const [page, sitemap] = await Promise.all([
    fetchText(canonicalUrl, options.timeoutMs),
    fetchText(sitemapUrl, options.timeoutMs)
  ]);
  if (sitemap.response.status !== 200) throw new Error(`Sitemap returned ${sitemap.response.status}`);

  const sitemapDocument = load(sitemap.body, { xmlMode: true });
  const sitemapUrls = new Set(
    sitemapDocument("url > loc")
      .toArray()
      .map((element) => sitemapDocument(element).text().trim())
      .filter(Boolean)
      .map(comparableUrl)
  );
  const listed = sitemapUrls.has(comparableUrl(canonicalUrl));

  if (options.expectation === "absent") {
    if (listed) throw new Error("URL is still present in its sitemap");
    if (page.response.status !== 404) throw new Error(`Expected route 404 while absent, received ${page.response.status}`);
    return;
  }

  if (page.response.status !== 200) throw new Error(`Expected route 200, received ${page.response.status}`);
  if (!page.response.headers.get("content-type")?.includes("html")) throw new Error("Route did not return HTML");
  const document = load(page.body);
  const canonical = document('link[rel~="canonical"]').first().attr("href")?.trim();
  const robots = document('meta[name="robots"], meta[name="googlebot"]')
    .toArray()
    .map((element) => document(element).attr("content")?.toLowerCase() ?? "")
    .join(",");
  if (!document("title").first().text().trim()) throw new Error("Route has no title");
  if (!canonical || comparableUrl(new URL(canonical, options.baseUrl).toString()) !== comparableUrl(canonicalUrl)) {
    throw new Error(`Canonical mismatch: ${canonical || "missing"}`);
  }
  if (/(^|[,\s])(noindex|none)([,\s]|$)/.test(robots)) throw new Error(`Route is noindex: ${robots}`);
  if (!listed) throw new Error("URL is not present in its family sitemap");
}

async function main() {
  const options = parseOptions();
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      await verifyOnce(options);
      console.log(
        `Verified ${options.expectation}: ${options.baseUrl}${options.path} (${options.sitemapPath}, attempt ${attempt})`
      );
      return;
    } catch (error) {
      lastError = error;
      if (attempt < options.attempts) {
        console.log(
          `Publish verification attempt ${attempt}/${options.attempts} failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
    }
  }

  throw lastError;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
