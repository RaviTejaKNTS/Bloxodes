import "../shared/load-env";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import {
  CRITICAL_SEO_PATHS,
  SEO_ROUTE_CONTRACTS,
  expectedCanonicalPath,
  findSeoRouteContract,
  isPrivateRoute,
  type SeoRouteFamily
} from "../../apps/web/src/lib/seo-contracts";
import {
  structuredDataTypes,
  validateStructuredData,
  type StructuredDataIssue
} from "../../apps/web/src/lib/structured-data";

type AuditMode = "sitemaps" | "seo" | "routes" | "smoke" | "postdeploy";
type Severity = "error" | "warning";

type AuditIssue = {
  severity: Severity;
  scope: "sitemap" | "page" | "route" | "health";
  code: string;
  url: string;
  message: string;
  userAgent?: string;
};

type SitemapEntry = {
  loc: string;
  sitemapUrl: string;
  sitemapPath: string;
  family: SeoRouteFamily | "main" | "unknown";
  lastmod: string | null;
  changefreq: string | null;
  priority: string | null;
};

type SitemapResult = {
  url: string;
  status: number;
  contentType: string;
  kind: "index" | "urlset" | "invalid";
  entryCount: number;
  durationMs: number;
};

type PageSeo = {
  title: string | null;
  titleCount: number;
  description: string | null;
  descriptionCount: number;
  canonical: string | null;
  canonicalCount: number;
  robots: string[];
  h1s: string[];
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterCard: string | null;
  jsonLdTypes: string[];
  jsonLdDates: Array<{ type: string; published: string | null; modified: string | null }>;
  structuredDataIssues: StructuredDataIssue[];
  invalidJsonLd: number;
  visibleDates: string[];
  bodyTextLength: number;
  hasMain: boolean;
  challengePage: boolean;
  internalErrorPage: boolean;
};

type PageResult = {
  canonicalUrl: string;
  fetchUrl: string;
  family: SeoRouteFamily | "unknown";
  userAgent: string;
  status: number;
  finalUrl: string;
  redirectCount: number;
  durationMs: number;
  bytes: number;
  contentType: string;
  cacheControl: string | null;
  cacheTag: string | null;
  cfCacheStatus: string | null;
  error: string | null;
  seo: PageSeo;
};

type Options = {
  mode: AuditMode;
  fetchOrigin: string;
  canonicalOrigin: string;
  reportDir: string;
  all: boolean;
  limit: number | null;
  expectedSha: string | null;
  timeoutMs: number;
  retries: number;
};

type AuditReport = {
  generatedAt: string;
  options: Options;
  totals: {
    sitemaps: number;
    sitemapEntries: number;
    pageRequests: number;
    errors: number;
    warnings: number;
  };
  sitemaps: SitemapResult[];
  entries: SitemapEntry[];
  pages: PageResult[];
  issues: AuditIssue[];
};

type RouteDateContract = {
  route: string;
  table: string;
  identity: string;
  publishedAt: string | null;
  modifiedAt: string | null;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_REPORT_DIR = path.join(repoRoot, "tmp/test-reports");
const MAX_SITEMAPS = 500;
const MAX_URLS = 50_000;
const MAX_REDIRECTS = 8;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const REDIRECT_CONTRACTS = [
  { source: "/lists", destination: "/stats" },
  { source: "/catalog/roblox-music-ids/weekly", destination: "/catalog/roblox-music-ids/charts?range=weekly" },
  { source: "/catalog/roblox-music-ids/monthly", destination: "/catalog/roblox-music-ids/charts?range=monthly" },
  { source: "/catalog/roblox-music-ids/daily-top-500", destination: "/catalog/roblox-music-ids/trending" }
] as const;
const NOINDEX_FOLLOW_PATHS = [
  "/articles/page/1",
  "/codes/page/1",
  "/checklists/page/1",
  "/tools/page/1"
] as const;
const PRIVATE_NOINDEX_PATHS = ["/login"] as const;

const USER_AGENTS = {
  browser:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Safari/537.36",
  googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  bingbot: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  curl: "curl/8.7.1"
} as const;

function normalizeOrigin(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`Invalid origin: ${raw}`);
  return url.origin;
}

function parsePositiveInt(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${flag} requires a positive integer`);
  return parsed;
}

function parseOptions(): Options {
  const args = process.argv.slice(2);
  const modeArg = args.shift() ?? "seo";
  if (!["sitemaps", "seo", "routes", "smoke", "postdeploy"].includes(modeArg)) {
    throw new Error(`Unknown audit mode: ${modeArg}`);
  }

  let fetchOrigin = process.env.TEST_BASE_URL || process.env.SEO_AUDIT_FETCH_ORIGIN || "http://127.0.0.1:3000";
  let canonicalOrigin = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://bloxodes.com";
  let reportDir = DEFAULT_REPORT_DIR;
  let all = false;
  let limit: number | null = null;
  let expectedSha = process.env.EXPECTED_BUILD_SHA?.trim() || null;
  let timeoutMs = 20_000;
  let retries = 1;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = () => {
      const value = args[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      index += 1;
      return value;
    };
    if (arg === "--fetch-origin" || arg === "--site") fetchOrigin = next();
    else if (arg === "--canonical-origin") canonicalOrigin = next();
    else if (arg === "--report-dir") reportDir = path.resolve(repoRoot, next());
    else if (arg === "--expected-sha") expectedSha = next();
    else if (arg === "--timeout-ms") timeoutMs = parsePositiveInt(next(), arg);
    else if (arg === "--retries") retries = Math.min(5, parsePositiveInt(next(), arg));
    else if (arg === "--limit") limit = parsePositiveInt(next(), arg);
    else if (arg === "--all") all = true;
    else if (arg === "--help") {
      console.log(`Usage: tsx scripts/quality/site-audit.ts <sitemaps|seo|routes|smoke|postdeploy> [options]\n\nOptions:\n  --fetch-origin <origin>      Origin to request (default http://127.0.0.1:3000)\n  --canonical-origin <origin>  Public canonical origin (default https://bloxodes.com)\n  --all                        Fetch every sitemap page URL\n  --limit <n>                  Cap selected page URLs\n  --expected-sha <sha>         Require /api/health build SHA\n  --report-dir <path>          Default tmp/test-reports\n  --timeout-ms <n>\n  --retries <n>`);
      process.exit(0);
    } else throw new Error(`Unknown option: ${arg}`);
  }

  return {
    mode: modeArg as AuditMode,
    fetchOrigin: normalizeOrigin(fetchOrigin),
    canonicalOrigin: normalizeOrigin(canonicalOrigin),
    reportDir,
    all,
    limit,
    expectedSha,
    timeoutMs,
    retries
  };
}

function canonicalToFetchUrl(canonicalUrl: string, options: Options): string {
  const url = new URL(canonicalUrl);
  return `${options.fetchOrigin}${url.pathname}${url.search}`;
}

function normalizeComparableUrl(raw: string): string {
  const url = new URL(raw);
  url.hash = "";
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function issue(
  issues: AuditIssue[],
  severity: Severity,
  scope: AuditIssue["scope"],
  code: string,
  url: string,
  message: string,
  userAgent?: string
) {
  issues.push({ severity, scope, code, url, message, ...(userAgent ? { userAgent } : {}) });
}

async function fetchWithTimeout(
  url: string,
  options: Options,
  init: RequestInit = {}
): Promise<{ response: Response; body: string; durationMs: number }> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    const started = Date.now();
    try {
      const response = await fetch(url, {
        ...init,
        cache: "no-store",
        signal: AbortSignal.timeout(options.timeoutMs)
      });
      const body = await response.text();
      if ((response.status === 429 || response.status >= 500) && attempt < options.retries) continue;
      return { response, body, durationMs: Date.now() - started };
    } catch (error) {
      lastError = error;
      if (attempt >= options.retries) throw error;
    }
  }
  throw lastError;
}

function sitemapFamily(pathname: string): SeoRouteFamily | "main" | "unknown" {
  if (pathname === "/sitemaps/main.xml") return "main";
  return SEO_ROUTE_CONTRACTS.find((contract) => contract.sitemapPath === pathname)?.family ?? "unknown";
}

function validateLastmod(value: string, url: string, issues: AuditIssue[]) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    issue(issues, "error", "sitemap", "invalid-lastmod", url, `${value} is not a valid date`);
  } else if (timestamp > Date.now() + FUTURE_TOLERANCE_MS) {
    issue(issues, "error", "sitemap", "future-lastmod", url, `${value} is in the future`);
  }
}

async function crawlSitemaps(options: Options, issues: AuditIssue[]) {
  const rootCanonical = `${options.canonicalOrigin}/sitemap.xml`;
  const queue = [rootCanonical];
  const queued = new Set(queue);
  const seenSitemaps = new Set<string>();
  const seenPages = new Map<string, string>();
  const results: SitemapResult[] = [];
  const entries: SitemapEntry[] = [];

  while (queue.length) {
    const canonicalUrl = queue.shift();
    if (!canonicalUrl) continue;
    if (seenSitemaps.size >= MAX_SITEMAPS) throw new Error(`Sitemap count exceeded ${MAX_SITEMAPS}`);
    seenSitemaps.add(canonicalUrl);
    const fetchUrl = canonicalToFetchUrl(canonicalUrl, options);
    let fetched: Awaited<ReturnType<typeof fetchWithTimeout>>;
    try {
      fetched = await fetchWithTimeout(fetchUrl, options, {
        headers: { accept: "application/xml,text/xml,*/*", "user-agent": USER_AGENTS.browser }
      });
    } catch (error) {
      issue(issues, "error", "sitemap", "fetch-error", canonicalUrl, error instanceof Error ? error.message : String(error));
      results.push({ url: canonicalUrl, status: 0, contentType: "", kind: "invalid", entryCount: 0, durationMs: 0 });
      continue;
    }

    const { response, body, durationMs } = fetched;
    const contentType = response.headers.get("content-type") ?? "";
    if (response.status !== 200) {
      issue(issues, "error", "sitemap", "unexpected-status", canonicalUrl, `Expected 200, received ${response.status}`);
    }
    if (!contentType.includes("xml")) {
      issue(issues, "error", "sitemap", "invalid-content-type", canonicalUrl, `Expected XML, received ${contentType || "missing"}`);
    }

    const $ = load(body, { xmlMode: true });
    const indexNodes = $("sitemapindex");
    const urlsetNodes = $("urlset");
    const kind: SitemapResult["kind"] = indexNodes.length === 1 && urlsetNodes.length === 0
      ? "index"
      : urlsetNodes.length === 1 && indexNodes.length === 0
        ? "urlset"
        : "invalid";

    if (kind === "invalid") {
      issue(issues, "error", "sitemap", "invalid-xml-root", canonicalUrl, "Expected exactly one sitemapindex or urlset root");
    }

    const localLocs = new Set<string>();
    const nodes = kind === "index" ? $("sitemap") : kind === "urlset" ? $("url") : $([]);
    nodes.each((_, element) => {
      const node = $(element);
      const loc = node.find("loc").first().text().trim();
      const lastmod = node.find("lastmod").first().text().trim() || null;
      if (!loc) {
        issue(issues, "error", "sitemap", "missing-loc", canonicalUrl, "Sitemap entry has no loc");
        return;
      }
      if (localLocs.has(loc)) issue(issues, "error", "sitemap", "duplicate-loc", canonicalUrl, loc);
      localLocs.add(loc);
      if (lastmod) validateLastmod(lastmod, loc, issues);

      let parsed: URL;
      try {
        parsed = new URL(loc);
      } catch {
        issue(issues, "error", "sitemap", "invalid-loc", canonicalUrl, loc);
        return;
      }
      if (parsed.origin !== options.canonicalOrigin) {
        issue(issues, "error", "sitemap", "wrong-origin", loc, `Expected ${options.canonicalOrigin}`);
        return;
      }
      if (parsed.hash || parsed.username || parsed.password) {
        issue(issues, "error", "sitemap", "invalid-url-components", loc, "Sitemap URL contains a hash or credentials");
      }

      if (kind === "index") {
        const normalized = normalizeComparableUrl(loc);
        if (queued.has(normalized) || seenSitemaps.has(normalized)) {
          issue(issues, "error", "sitemap", "duplicate-sitemap", canonicalUrl, loc);
        } else {
          queued.add(normalized);
          queue.push(normalized);
        }
        return;
      }

      if (isPrivateRoute(parsed.pathname)) {
        issue(issues, "error", "sitemap", "private-route", loc, "Private route must not appear in a sitemap");
      }
      const normalized = normalizeComparableUrl(loc);
      const existing = seenPages.get(normalized);
      if (existing) {
        issue(issues, "error", "sitemap", "duplicate-page-url", loc, `Already listed in ${existing}`);
      } else {
        seenPages.set(normalized, canonicalUrl);
      }
      if (!findSeoRouteContract(parsed.pathname)) {
        issue(issues, "error", "sitemap", "unknown-route-family", loc, "No SEO route contract owns this URL");
      }
      entries.push({
        loc,
        sitemapUrl: canonicalUrl,
        sitemapPath: new URL(canonicalUrl).pathname,
        family: sitemapFamily(new URL(canonicalUrl).pathname),
        lastmod,
        changefreq: node.find("changefreq").first().text().trim() || null,
        priority: node.find("priority").first().text().trim() || null
      });
      if (entries.length > MAX_URLS) throw new Error(`Sitemap URL count exceeded ${MAX_URLS}`);
    });

    results.push({ url: canonicalUrl, status: response.status, contentType, kind, entryCount: nodes.length, durationMs });
  }

  const discoveredPaths = new Set(results.map((result) => new URL(result.url).pathname));
  for (const contract of SEO_ROUTE_CONTRACTS) {
    if (!discoveredPaths.has(contract.sitemapPath)) {
      issue(issues, "error", "sitemap", "missing-family-sitemap", rootCanonical, contract.sitemapPath);
    }
  }
  const pageUrls = new Set(entries.map((entry) => normalizeComparableUrl(entry.loc)));
  for (const criticalPath of CRITICAL_SEO_PATHS) {
    const expected = normalizeComparableUrl(`${options.canonicalOrigin}${criticalPath}`);
    if (!pageUrls.has(expected)) issue(issues, "error", "sitemap", "missing-critical-url", expected, "Critical route is absent from sitemaps");
  }

  return { results, entries };
}

function htmlText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseJsonLdDates(value: unknown): Array<{ type: string; published: string | null; modified: string | null }> {
  if (Array.isArray(value)) return value.flatMap(parseJsonLdDates);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const typeValue = record["@type"];
  const type = Array.isArray(typeValue) ? typeValue.filter((entry) => typeof entry === "string").join("|") : String(typeValue ?? "unknown");
  const current = record.datePublished || record.dateModified
    ? [{
        type,
        published: typeof record.datePublished === "string" ? record.datePublished : null,
        modified: typeof record.dateModified === "string" ? record.dateModified : null
      }]
    : [];
  return [...current, ...(Array.isArray(record["@graph"]) ? record["@graph"].flatMap(parseJsonLdDates) : [])];
}

function analyzeHtml(body: string, expectedOrigin: string): PageSeo {
  const $ = load(body);
  const bodyText = htmlText($("body").text());
  const visibleDates = Array.from(
    new Set(
      bodyText.match(
        /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/g
      ) ?? []
    )
  );
  const jsonLdTypes = new Set<string>();
  const jsonLdDates: PageSeo["jsonLdDates"] = [];
  const structuredDataIssues: StructuredDataIssue[] = [];
  let invalidJsonLd = 0;

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text().trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      for (const type of structuredDataTypes(parsed)) jsonLdTypes.add(type);
      jsonLdDates.push(...parseJsonLdDates(parsed));
      structuredDataIssues.push(...validateStructuredData(parsed, { expectedOrigin }));

      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const record = node as Record<string, unknown>;
        const graph = Array.isArray(record["@graph"]) ? record["@graph"] : [];
        for (const candidate of [record, ...graph]) {
          if (!candidate || typeof candidate !== "object") continue;
          const candidateRecord = candidate as Record<string, unknown>;
          if (candidateRecord["@type"] === "FAQPage" && Array.isArray(candidateRecord.mainEntity)) {
            for (const entity of candidateRecord.mainEntity) {
              if (!entity || typeof entity !== "object") continue;
              const question = htmlText(String((entity as Record<string, unknown>).name ?? ""));
              if (question && !bodyText.includes(question)) {
                structuredDataIssues.push({ code: "faq-not-visible", path: "$.mainEntity", message: question });
              }
            }
          }
        }
      }
    } catch {
      invalidJsonLd += 1;
    }
  });

  const titleNodes = $("title");
  const descriptionNodes = $('meta[name="description"]');
  const canonicalNodes = $('link[rel~="canonical"]');
  const robots = $('meta[name="robots"], meta[name="googlebot"], meta[name="bingbot"]')
    .toArray()
    .map((element) => htmlText($(element).attr("content") ?? "").toLowerCase())
    .filter(Boolean);
  const lowerBody = body.toLowerCase();

  return {
    title: htmlText(titleNodes.first().text()) || null,
    titleCount: titleNodes.length,
    description: htmlText(descriptionNodes.first().attr("content") ?? "") || null,
    descriptionCount: descriptionNodes.length,
    canonical: canonicalNodes.first().attr("href")?.trim() || null,
    canonicalCount: canonicalNodes.length,
    robots,
    h1s: $("h1").toArray().map((element) => htmlText($(element).text())).filter(Boolean),
    ogTitle: $('meta[property="og:title"]').first().attr("content")?.trim() || null,
    ogDescription: $('meta[property="og:description"]').first().attr("content")?.trim() || null,
    ogImage: $('meta[property="og:image"]').first().attr("content")?.trim() || null,
    twitterCard: $('meta[name="twitter:card"]').first().attr("content")?.trim() || null,
    jsonLdTypes: Array.from(jsonLdTypes).sort(),
    jsonLdDates,
    structuredDataIssues,
    invalidJsonLd,
    visibleDates,
    bodyTextLength: bodyText.length,
    hasMain: $("main").length === 1 && htmlText($("main").text()).length > 0,
    challengePage:
      lowerBody.includes("cf-chl-") ||
      lowerBody.includes("challenge-platform") ||
      lowerBody.includes("just a moment...") ||
      lowerBody.includes("attention required! | cloudflare"),
    internalErrorPage:
      lowerBody.includes("internal server error") ||
      lowerBody.includes("application error: a server-side exception") ||
      lowerBody.includes("this page could not be rendered")
  };
}

function emptySeo(): PageSeo {
  return {
    title: null,
    titleCount: 0,
    description: null,
    descriptionCount: 0,
    canonical: null,
    canonicalCount: 0,
    robots: [],
    h1s: [],
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
    twitterCard: null,
    jsonLdTypes: [],
    jsonLdDates: [],
    structuredDataIssues: [],
    invalidJsonLd: 0,
    visibleDates: [],
    bodyTextLength: 0,
    hasMain: false,
    challengePage: false,
    internalErrorPage: false
  };
}

async function fetchPage(
  canonicalUrl: string,
  userAgent: keyof typeof USER_AGENTS,
  options: Options
): Promise<PageResult> {
  const initialFetchUrl = canonicalToFetchUrl(canonicalUrl, options);
  const started = Date.now();
  let currentUrl = initialFetchUrl;
  let redirectCount = 0;
  try {
    while (true) {
      const { response, body } = await fetchWithTimeout(currentUrl, options, {
        redirect: "manual",
        headers: { "accept-encoding": "identity", "user-agent": USER_AGENTS[userAgent] }
      });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location && redirectCount < MAX_REDIRECTS) {
        currentUrl = new URL(location, currentUrl).toString();
        redirectCount += 1;
        continue;
      }
      const contentType = response.headers.get("content-type") ?? "";
      return {
        canonicalUrl,
        fetchUrl: initialFetchUrl,
        family: findSeoRouteContract(new URL(canonicalUrl).pathname)?.family ?? "unknown",
        userAgent,
        status: response.status,
        finalUrl: currentUrl,
        redirectCount,
        durationMs: Date.now() - started,
        bytes: Buffer.byteLength(body),
        contentType,
        cacheControl: response.headers.get("cache-control"),
        cacheTag: response.headers.get("cache-tag"),
        cfCacheStatus: response.headers.get("cf-cache-status"),
        error: null,
        seo: contentType.includes("html") || body.trimStart().startsWith("<!DOCTYPE html")
          ? analyzeHtml(body, options.canonicalOrigin)
          : emptySeo()
      };
    }
  } catch (error) {
    return {
      canonicalUrl,
      fetchUrl: initialFetchUrl,
      family: findSeoRouteContract(new URL(canonicalUrl).pathname)?.family ?? "unknown",
      userAgent,
      status: 0,
      finalUrl: currentUrl,
      redirectCount,
      durationMs: Date.now() - started,
      bytes: 0,
      contentType: "",
      cacheControl: null,
      cacheTag: null,
      cfCacheStatus: null,
      error: error instanceof Error ? error.message : String(error),
      seo: emptySeo()
    };
  }
}

function selectPageUrls(entries: SitemapEntry[], options: Options): string[] {
  const selected = new Set<string>(CRITICAL_SEO_PATHS.map((pathname) => `${options.canonicalOrigin}${pathname}`));
  if (options.all) {
    for (const entry of entries) selected.add(entry.loc);
  } else {
    for (const contract of SEO_ROUTE_CONTRACTS) {
      const familyEntries = entries.filter((entry) => entry.family === contract.family);
      for (const entry of familyEntries.slice(0, contract.sampleSize)) selected.add(entry.loc);
    }
  }
  const values = Array.from(selected);
  return options.limit ? values.slice(0, options.limit) : values;
}

function validatePage(result: PageResult, options: Options, issues: AuditIssue[], expectedStatus = 200) {
  const agent = result.userAgent;
  if (result.error) issue(issues, "error", "page", "fetch-error", result.canonicalUrl, result.error, agent);
  if (result.status !== expectedStatus) {
    issue(issues, "error", "page", "unexpected-status", result.canonicalUrl, `Expected ${expectedStatus}, received ${result.status}`, agent);
  }
  if (expectedStatus !== 200) return;
  if (result.redirectCount) issue(issues, "error", "page", "unexpected-redirect", result.canonicalUrl, `${result.redirectCount} redirects`, agent);
  if (!result.contentType.includes("html")) {
    issue(issues, "error", "page", "non-html", result.canonicalUrl, result.contentType || "missing content-type", agent);
    return;
  }
  const seo = result.seo;
  if (seo.challengePage) issue(issues, "error", "page", "challenge-page", result.canonicalUrl, "Cloudflare challenge HTML", agent);
  if (seo.internalErrorPage) issue(issues, "error", "page", "internal-error-html", result.canonicalUrl, "Internal error HTML", agent);
  if (seo.titleCount !== 1 || !seo.title) issue(issues, "error", "page", "title-count", result.canonicalUrl, `Found ${seo.titleCount}`, agent);
  if (seo.descriptionCount !== 1 || !seo.description) issue(issues, "error", "page", "description-count", result.canonicalUrl, `Found ${seo.descriptionCount}`, agent);
  if (seo.canonicalCount !== 1 || !seo.canonical) issue(issues, "error", "page", "canonical-count", result.canonicalUrl, `Found ${seo.canonicalCount}`, agent);
  if (seo.canonical) {
    const url = new URL(result.canonicalUrl);
    const expected = `${options.canonicalOrigin}${expectedCanonicalPath(url.pathname)}${url.search}`;
    try {
      if (normalizeComparableUrl(new URL(seo.canonical, options.canonicalOrigin).toString()) !== normalizeComparableUrl(expected)) {
        issue(issues, "error", "page", "canonical-mismatch", result.canonicalUrl, `${seo.canonical} != ${expected}`, agent);
      }
    } catch {
      issue(issues, "error", "page", "invalid-canonical", result.canonicalUrl, seo.canonical, agent);
    }
  }
  if (seo.robots.some((value) => /(^|[,\s])(noindex|none)([,\s]|$)/.test(value))) {
    issue(issues, "error", "page", "unexpected-noindex", result.canonicalUrl, seo.robots.join("; "), agent);
  }
  if (seo.h1s.length !== 1) issue(issues, "error", "page", "h1-count", result.canonicalUrl, `Found ${seo.h1s.length}`, agent);
  if (!seo.hasMain) issue(issues, "error", "page", "missing-main", result.canonicalUrl, "Expected one nonempty main element", agent);
  if (!result.cacheTag) issue(issues, "error", "page", "missing-cache-tag", result.canonicalUrl, "Public HTML has no Cache-Tag", agent);
  if (options.mode === "postdeploy") {
    const cacheStatus = result.cfCacheStatus?.toUpperCase() ?? "";
    if (!cacheStatus || ["BYPASS", "DYNAMIC"].includes(cacheStatus)) {
      issue(
        issues,
        "error",
        "page",
        "edge-cache-contract",
        result.canonicalUrl,
        `Expected a cacheable Cloudflare response, received ${cacheStatus || "missing CF-Cache-Status"}`,
        agent
      );
    }
  }
  if (seo.bodyTextLength < 120) issue(issues, "error", "page", "thin-body", result.canonicalUrl, `${seo.bodyTextLength} text characters`, agent);
  if (!seo.ogTitle) issue(issues, "error", "page", "missing-og-title", result.canonicalUrl, "Missing og:title", agent);
  if (!seo.ogDescription) issue(issues, "error", "page", "missing-og-description", result.canonicalUrl, "Missing og:description", agent);
  const reportWarnings = agent === "browser";
  if (reportWarnings && !seo.ogImage) issue(issues, "warning", "page", "missing-og-image", result.canonicalUrl, "Missing og:image", agent);
  if (reportWarnings && !seo.twitterCard) issue(issues, "warning", "page", "missing-twitter-card", result.canonicalUrl, "Missing twitter:card", agent);
  const contract = findSeoRouteContract(new URL(result.canonicalUrl).pathname);
  if (contract?.requireJsonLd && !seo.jsonLdTypes.length) {
    issue(issues, "error", "page", "missing-json-ld", result.canonicalUrl, "No structured data types", agent);
  }
  if (seo.invalidJsonLd) issue(issues, "error", "page", "invalid-json-ld", result.canonicalUrl, `${seo.invalidJsonLd} blocks`, agent);
  for (const structuredIssue of seo.structuredDataIssues) {
    issue(issues, "error", "page", structuredIssue.code, result.canonicalUrl, structuredIssue.message, agent);
  }
  if (reportWarnings && ((seo.title?.length ?? 0) > 65 || (seo.title?.length ?? 0) < 20)) {
    issue(issues, "warning", "page", "title-length", result.canonicalUrl, `${seo.title?.length ?? 0} characters`, agent);
  }
  if (reportWarnings && ((seo.description?.length ?? 0) > 170 || (seo.description?.length ?? 0) < 50)) {
    issue(issues, "warning", "page", "description-length", result.canonicalUrl, `${seo.description?.length ?? 0} characters`, agent);
  }
  if (reportWarnings && result.durationMs > 2_000) issue(issues, "warning", "page", "slow-response", result.canonicalUrl, `${result.durationMs}ms`, agent);
  if (result.bytes > 2_000_000) {
    issue(issues, "error", "page", "html-size-limit", result.canonicalUrl, `${result.bytes} bytes`, agent);
  } else if (reportWarnings && result.bytes > 1_000_000) {
    issue(issues, "warning", "page", "html-size-warning", result.canonicalUrl, `${result.bytes} bytes`, agent);
  }
}

async function loadRouteDateContracts(reportDir: string): Promise<Map<string, RouteDateContract>> {
  try {
    const raw = await readFile(path.join(reportDir, "published-content.json"), "utf8");
    const parsed = JSON.parse(raw) as { routeDates?: RouteDateContract[] };
    return new Map((parsed.routeDates ?? []).map((entry) => [entry.route, entry]));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw error;
  }
}

function addSitemapDateContractIssues(
  entries: SitemapEntry[],
  contracts: Map<string, RouteDateContract>,
  issues: AuditIssue[]
) {
  for (const entry of entries) {
    const route = new URL(entry.loc).pathname.replace(/\/+$/, "") || "/";
    const contract = contracts.get(route);
    if (!contract?.modifiedAt) continue;
    if (!entry.lastmod) {
      issue(issues, "error", "sitemap", "missing-lastmod", entry.loc, `${contract.table}:${contract.identity}`);
      continue;
    }
    const parsed = new Date(entry.lastmod);
    if (!Number.isFinite(parsed.getTime())) continue;
    if (parsed.getTime() < new Date(contract.modifiedAt).getTime()) {
      issue(
        issues,
        "error",
        "sitemap",
        "lastmod-before-database-modified",
        entry.loc,
        `${parsed.toISOString()} < ${contract.modifiedAt} (${contract.table}:${contract.identity})`
      );
    }
  }
}

function addRenderedDateContractIssues(
  pages: PageResult[],
  contracts: Map<string, RouteDateContract>,
  issues: AuditIssue[]
) {
  for (const page of pages) {
    if (page.userAgent !== "browser" || page.status !== 200) continue;
    const route = new URL(page.canonicalUrl).pathname.replace(/\/+$/, "") || "/";
    const contract = contracts.get(route);
    if (!contract) continue;
    for (const dates of page.seo.jsonLdDates) {
      if (dates.published && contract.publishedAt) {
        const parsed = new Date(dates.published);
        if (!Number.isFinite(parsed.getTime())) continue;
        const actual = parsed.toISOString();
        if (Math.abs(parsed.getTime() - new Date(contract.publishedAt).getTime()) > 1_000) {
          issue(
            issues,
            "error",
            "page",
            "date-published-contract-mismatch",
            page.canonicalUrl,
            `${actual} != ${contract.publishedAt} (${contract.table}:${contract.identity})`
          );
        }
      }
      if (dates.modified && contract.modifiedAt) {
        const parsed = new Date(dates.modified);
        if (!Number.isFinite(parsed.getTime())) continue;
        const actual = parsed.toISOString();
        if (parsed.getTime() < new Date(contract.modifiedAt).getTime()) {
          issue(
            issues,
            "error",
            "page",
            "date-modified-before-database",
            page.canonicalUrl,
            `${actual} < ${contract.modifiedAt} (${contract.table}:${contract.identity})`
          );
        }
      }
    }
  }
}

function addCrossSurfaceDateIssues(
  pages: PageResult[],
  entries: SitemapEntry[],
  contracts: Map<string, RouteDateContract>,
  issues: AuditIssue[]
) {
  const sitemapByPath = new Map(
    entries.map((entry) => [new URL(entry.loc).pathname.replace(/\/+$/, "") || "/", entry])
  );
  for (const page of pages) {
    if (page.userAgent !== "browser" || page.status !== 200) continue;
    const route = new URL(page.canonicalUrl).pathname.replace(/\/+$/, "") || "/";
    if (!contracts.has(route)) continue;
    const modifiedValues = page.seo.jsonLdDates
      .map((dates) => dates.modified)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value))
      .filter((value) => Number.isFinite(value.getTime()));
    if (!modifiedValues.length) continue;
    const modified = modifiedValues.reduce((latest, value) => value.getTime() > latest.getTime() ? value : latest);
    const expectedVisible = modified.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    });
    if (!page.seo.visibleDates.includes(expectedVisible)) {
      issue(
        issues,
        "error",
        "page",
        "visible-modified-date-mismatch",
        page.canonicalUrl,
        `Expected ${expectedVisible}; found ${page.seo.visibleDates.join(", ") || "none"}`
      );
    }
    const sitemap = sitemapByPath.get(route);
    if (!sitemap?.lastmod) continue;
    const sitemapDate = new Date(sitemap.lastmod);
    if (Number.isFinite(sitemapDate.getTime()) && sitemapDate.toISOString() !== modified.toISOString()) {
      issue(
        issues,
        "error",
        "page",
        "sitemap-jsonld-date-mismatch",
        page.canonicalUrl,
        `${sitemapDate.toISOString()} != ${modified.toISOString()}`
      );
    }
  }
}

function addDuplicateSeoIssues(pages: PageResult[], issues: AuditIssue[]) {
  const browserPages = pages.filter(
    (page) =>
      page.userAgent === "browser" &&
      page.status === 200 &&
      page.redirectCount === 0 &&
      page.family !== "unknown" &&
      !page.seo.robots.some((value) => /(^|[,\s])(noindex|none)([,\s]|$)/.test(value))
  );
  for (const [field, code] of [
    ["title", "duplicate-title"],
    ["description", "duplicate-description"],
    ["canonical", "duplicate-canonical"]
  ] as const) {
    const groups = new Map<string, PageResult[]>();
    for (const page of browserPages) {
      const value = page.seo[field]?.trim().toLowerCase();
      if (!value) continue;
      groups.set(value, [...(groups.get(value) ?? []), page]);
    }
    for (const matches of groups.values()) {
      const urls = new Set(matches.map((page) => page.canonicalUrl));
      if (urls.size <= 1) continue;
      for (const page of matches) issue(issues, "error", "page", code, page.canonicalUrl, Array.from(urls).join(", "));
    }
  }
}

function addUserAgentParityIssues(pages: PageResult[], issues: AuditIssue[]) {
  const groups = new Map<string, PageResult[]>();
  for (const page of pages) groups.set(page.canonicalUrl, [...(groups.get(page.canonicalUrl) ?? []), page]);
  for (const [url, matches] of groups) {
    const baseline = matches.find((page) => page.userAgent === "browser");
    if (!baseline || baseline.status !== 200) continue;
    for (const page of matches) {
      if (page === baseline || page.status !== 200) continue;
      if (page.seo.title !== baseline.seo.title || page.seo.canonical !== baseline.seo.canonical) {
        issue(issues, "error", "route", "user-agent-parity", url, "Title or canonical differs from browser response", page.userAgent);
      }
      if (page.seo.bodyTextLength < Math.min(120, baseline.seo.bodyTextLength * 0.25)) {
        issue(issues, "error", "route", "user-agent-thin-content", url, "Bot response has substantially less content", page.userAgent);
      }
    }
  }
}

async function checkHealth(options: Options, issues: AuditIssue[]) {
  const canonicalUrl = `${options.canonicalOrigin}/api/health`;
  const fetchUrl = `${options.fetchOrigin}/api/health`;
  try {
    const { response, body } = await fetchWithTimeout(fetchUrl, options, { headers: { "user-agent": USER_AGENTS.browser } });
    if (response.status !== 200) issue(issues, "error", "health", "health-status", canonicalUrl, String(response.status));
    let payload: {
      ok?: unknown;
      build?: { sha?: unknown };
      checks?: {
        database?: { ok?: unknown; error?: unknown };
        statsIndex?: { latestAt?: unknown; stale?: unknown; source?: unknown };
      };
    };
    try {
      payload = JSON.parse(body) as typeof payload;
    } catch {
      issue(issues, "error", "health", "invalid-health-json", canonicalUrl, "Response did not parse");
      return;
    }
    if (payload.ok !== true) issue(issues, "error", "health", "health-not-ok", canonicalUrl, "ok was not true");
    if (payload.checks?.database?.ok !== true) {
      issue(
        issues,
        "error",
        "health",
        "database-health",
        canonicalUrl,
        typeof payload.checks?.database?.error === "string" ? payload.checks.database.error : "Database check was not healthy"
      );
    }
    if (payload.checks?.statsIndex?.stale === true) {
      issue(
        issues,
        "warning",
        "health",
        "stale-stats-index",
        canonicalUrl,
        `${String(payload.checks.statsIndex.latestAt ?? "missing")} via ${String(payload.checks.statsIndex.source ?? "unknown")}`
      );
    }
    const sha = typeof payload.build?.sha === "string" ? payload.build.sha : "";
    if (!sha || sha === "unknown") issue(issues, "error", "health", "unknown-sha", canonicalUrl, "Build SHA missing");
    if (options.expectedSha && sha && !sha.startsWith(options.expectedSha) && !options.expectedSha.startsWith(sha)) {
      issue(issues, "error", "health", "sha-mismatch", canonicalUrl, `${sha} != ${options.expectedSha}`);
    }
  } catch (error) {
    issue(issues, "error", "health", "health-fetch-error", canonicalUrl, error instanceof Error ? error.message : String(error));
  }
}

async function checkCriticalApis(options: Options, issues: AuditIssue[]) {
  const targets = [
    {
      path: "/api/game-top-nav?path=%2Fcodes%2Fvampire-town",
      validate: (payload: unknown) =>
        Boolean(payload && typeof payload === "object" && "gameNav" in payload && "catalogNav" in payload)
    },
    {
      path: "/api/stats/platform/chart?range=1d&resolution=hourly",
      validate: (payload: unknown) =>
        Boolean(payload && typeof payload === "object" && Array.isArray((payload as { points?: unknown }).points))
    }
  ];

  for (const target of targets) {
    const canonicalUrl = `${options.canonicalOrigin}${target.path}`;
    try {
      const fetched = await fetchWithTimeout(`${options.fetchOrigin}${target.path}`, options, {
        headers: { accept: "application/json", "user-agent": USER_AGENTS.browser }
      });
      const cacheControl = fetched.response.headers.get("cache-control") ?? "";
      const cacheTag = fetched.response.headers.get("cache-tag") ?? "";
      if (fetched.response.status !== 200) {
        issue(issues, "error", "route", "api-status", canonicalUrl, `Expected 200, received ${fetched.response.status}`);
        continue;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(fetched.body) as unknown;
      } catch {
        issue(issues, "error", "route", "api-json", canonicalUrl, "Response did not parse as JSON");
        continue;
      }
      if (!target.validate(payload)) issue(issues, "error", "route", "api-contract", canonicalUrl, "Unexpected response shape");
      if (!/\bpublic\b/i.test(cacheControl) || /\b(?:private|no-store)\b/i.test(cacheControl)) {
        issue(issues, "error", "route", "api-cache-control", canonicalUrl, cacheControl || "missing Cache-Control");
      }
      if (!cacheTag) issue(issues, "error", "route", "api-cache-tag", canonicalUrl, "Missing Cache-Tag");
      if (fetched.durationMs > 2_000) {
        issue(issues, "warning", "route", "api-slow-response", canonicalUrl, `${fetched.durationMs}ms`);
      }
      if (target.path.startsWith("/api/stats/") && Array.isArray((payload as { points?: unknown }).points)) {
        if ((payload as { points: unknown[] }).points.length === 0) {
          issue(issues, "warning", "route", "api-empty-stats", canonicalUrl, "Stats chart contains no points");
        }
      }
    } catch (error) {
      issue(issues, "error", "route", "api-fetch-error", canonicalUrl, error instanceof Error ? error.message : String(error));
    }
  }
}

async function checkDiscoveryRoutes(entries: SitemapEntry[], options: Options, issues: AuditIssue[]) {
  const sitemapRoutes = new Set(entries.map((entry) => normalizeComparableUrl(entry.loc)));
  const robotsUrl = `${options.fetchOrigin}/robots.txt`;
  try {
    const fetched = await fetchWithTimeout(robotsUrl, options, { headers: { "user-agent": USER_AGENTS.googlebot } });
    const canonicalUrl = `${options.canonicalOrigin}/robots.txt`;
    if (fetched.response.status !== 200) {
      issue(issues, "error", "route", "robots-status", canonicalUrl, String(fetched.response.status));
    }
    if (!fetched.body.includes(`Sitemap: ${options.canonicalOrigin}/sitemap.xml`)) {
      issue(issues, "error", "route", "robots-sitemap", canonicalUrl, "Canonical sitemap declaration is missing");
    }
    if (!/Disallow:\s*\/api\//i.test(fetched.body)) {
      issue(issues, "error", "route", "robots-private-routes", canonicalUrl, "/api/ is not disallowed");
    }
  } catch (error) {
    issue(issues, "error", "route", "robots-fetch-error", `${options.canonicalOrigin}/robots.txt`, error instanceof Error ? error.message : String(error));
  }

  const canonicalFeedUrl = `${options.canonicalOrigin}/feed.xml`;
  try {
    const fetched = await fetchWithTimeout(`${options.fetchOrigin}/feed.xml`, options, {
      headers: { accept: "application/rss+xml,application/xml,text/xml", "user-agent": USER_AGENTS.browser }
    });
    if (fetched.response.status !== 200) {
      issue(issues, "error", "route", "feed-status", canonicalFeedUrl, String(fetched.response.status));
      return;
    }
    const $ = load(fetched.body, { xmlMode: true });
    if ($("rss").length !== 1 || $("channel").length !== 1) {
      issue(issues, "error", "route", "feed-xml", canonicalFeedUrl, "Expected one RSS channel");
    }
    $("item").each((_, element) => {
      const node = $(element);
      const link = node.find("link").first().text().trim();
      const pubDate = node.find("pubDate").first().text().trim();
      if (!link) issue(issues, "error", "route", "feed-link", canonicalFeedUrl, "Feed item has no link");
      else {
        try {
          const parsed = new URL(link);
          if (parsed.origin !== options.canonicalOrigin) {
            issue(issues, "error", "route", "feed-origin", link, `Expected ${options.canonicalOrigin}`);
          } else if (!sitemapRoutes.has(normalizeComparableUrl(link))) {
            issue(issues, "error", "route", "feed-link-not-in-sitemap", link, "Feed item is absent from sitemaps");
          }
        } catch {
          issue(issues, "error", "route", "feed-link", canonicalFeedUrl, link);
        }
      }
      const timestamp = Date.parse(pubDate);
      if (!Number.isFinite(timestamp) || timestamp > Date.now() + FUTURE_TOLERANCE_MS) {
        issue(issues, "error", "route", "feed-date", link || canonicalFeedUrl, pubDate || "missing pubDate");
      }
    });
  } catch (error) {
    issue(issues, "error", "route", "feed-fetch-error", canonicalFeedUrl, error instanceof Error ? error.message : String(error));
  }
}

async function runPageChecks(entries: SitemapEntry[], options: Options, issues: AuditIssue[]) {
  const canonicalUrls = selectPageUrls(entries, options);
  const agentNames: Array<keyof typeof USER_AGENTS> =
    options.mode === "routes" || options.mode === "smoke" || options.mode === "postdeploy"
      ? ["browser", "googlebot", "bingbot", "curl"]
      : ["browser"];
  const jobs = canonicalUrls.flatMap((url) => agentNames.map((agent) => ({ url, agent })));
  const pages: PageResult[] = [];
  let cursor = 0;
  const concurrency = Math.min(8, jobs.length);

  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      const result = await fetchPage(job.url, job.agent, options);
      pages.push(result);
      validatePage(result, options, issues);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  const missingCanonical = `${options.canonicalOrigin}/__bloxodes_quality_missing_route__`;
  if (options.mode === "routes" || options.mode === "smoke" || options.mode === "postdeploy") {
    for (const agent of agentNames) {
      const result = await fetchPage(missingCanonical, agent, options);
      pages.push(result);
      validatePage(result, options, issues, 404);
    }
    for (const redirect of REDIRECT_CONTRACTS) {
      const canonicalUrl = `${options.canonicalOrigin}${redirect.source}`;
      for (const agent of agentNames) {
        const result = await fetchPage(canonicalUrl, agent, options);
        pages.push(result);
        const final = new URL(result.finalUrl);
        const actualDestination = `${final.pathname}${final.search}`;
        if (!result.redirectCount || result.status !== 200 || actualDestination !== redirect.destination) {
          issue(
            issues,
            "error",
            "route",
            "redirect-contract-mismatch",
            canonicalUrl,
            `Expected ${redirect.destination}; received ${result.status} ${actualDestination} after ${result.redirectCount} redirects`,
            agent
          );
        }
      }
    }
    for (const pathname of NOINDEX_FOLLOW_PATHS) {
      const canonicalUrl = `${options.canonicalOrigin}${pathname}`;
      const result = await fetchPage(canonicalUrl, "browser", options);
      pages.push(result);
      const robots = result.seo.robots.join(",");
      if (result.status !== 200 || !/(^|[,\s])noindex([,\s]|$)/.test(robots) || !/(^|[,\s])follow([,\s]|$)/.test(robots)) {
        issue(
          issues,
          "error",
          "route",
          "pagination-robots-contract",
          canonicalUrl,
          `Expected 200 noindex,follow; received ${result.status} ${robots || "missing robots"}`,
          "browser"
        );
      }
    }
    for (const pathname of PRIVATE_NOINDEX_PATHS) {
      const canonicalUrl = `${options.canonicalOrigin}${pathname}`;
      const result = await fetchPage(canonicalUrl, "browser", options);
      pages.push(result);
      const robots = result.seo.robots.join(",");
      if (result.status !== 200 || !/(^|[,\s])(noindex|none)([,\s]|$)/.test(robots)) {
        issue(
          issues,
          "error",
          "route",
          "private-robots-contract",
          canonicalUrl,
          `Expected 200 noindex; received ${result.status} ${robots || "missing robots"}`,
          "browser"
        );
      }
    }
  }
  addDuplicateSeoIssues(pages, issues);
  if (agentNames.length > 1) addUserAgentParityIssues(pages, issues);
  const dateContracts = await loadRouteDateContracts(options.reportDir);
  addRenderedDateContractIssues(pages, dateContracts, issues);
  addCrossSurfaceDateIssues(pages, entries, dateContracts, issues);
  return pages;
}

async function runSitemapUrlStatusChecks(entries: SitemapEntry[], options: Options, issues: AuditIssue[]) {
  const targets = options.limit ? entries.slice(0, options.limit) : entries;
  const pages: PageResult[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < targets.length) {
      const entry = targets[cursor++];
      const result = await fetchPage(entry.loc, "browser", options);
      pages.push(result);
      if (result.error) issue(issues, "error", "route", "fetch-error", entry.loc, result.error, "browser");
      if (result.status !== 200) {
        issue(issues, "error", "route", "sitemap-url-status", entry.loc, `Expected 200, received ${result.status}`, "browser");
      }
      if (result.redirectCount) {
        issue(issues, "error", "route", "sitemap-url-redirect", entry.loc, `${result.redirectCount} redirects`, "browser");
      }
      if (!result.contentType.includes("html")) {
        issue(issues, "error", "route", "sitemap-url-non-html", entry.loc, result.contentType || "missing", "browser");
      }
      if (result.seo.challengePage || result.seo.internalErrorPage) {
        issue(issues, "error", "route", "sitemap-url-error-html", entry.loc, "Challenge or internal error HTML", "browser");
      }
      if (result.seo.robots.some((value) => /(^|[,\s])(noindex|none)([,\s]|$)/.test(value))) {
        issue(issues, "error", "route", "sitemap-url-noindex", entry.loc, result.seo.robots.join("; "), "browser");
      }
      if (result.seo.canonical) {
        try {
          if (normalizeComparableUrl(new URL(result.seo.canonical, options.canonicalOrigin).toString()) !== normalizeComparableUrl(entry.loc)) {
            issue(issues, "error", "route", "sitemap-url-canonical", entry.loc, result.seo.canonical, "browser");
          }
        } catch {
          issue(issues, "error", "route", "sitemap-url-canonical", entry.loc, "Invalid canonical", "browser");
        }
      } else {
        issue(issues, "error", "route", "sitemap-url-canonical", entry.loc, "Missing canonical", "browser");
      }
    }
  }
  // Keep the exhaustive crawl below the local Supabase/Docker saturation point.
  // Six workers still finish quickly while avoiding a burst of hundreds of SSR reads.
  await Promise.all(Array.from({ length: Math.min(6, targets.length) }, worker));
  return pages;
}

function tsvCell(value: unknown) {
  return String(value ?? "").replace(/[\t\r\n]+/g, " ");
}

function reportMarkdown(report: AuditReport) {
  const lines = [
    `# ${report.options.mode} verification`,
    "",
    `Generated: ${report.generatedAt}`,
    `Fetch origin: ${report.options.fetchOrigin}`,
    `Canonical origin: ${report.options.canonicalOrigin}`,
    "",
    `- Sitemaps: ${report.totals.sitemaps}`,
    `- Sitemap URLs: ${report.totals.sitemapEntries}`,
    `- Page requests: ${report.totals.pageRequests}`,
    `- Errors: ${report.totals.errors}`,
    `- Warnings: ${report.totals.warnings}`,
    "",
    "## Issues",
    "",
    ...(report.issues.length
      ? report.issues.map((entry) =>
          `- [${entry.severity}] ${entry.scope}/${entry.code}: ${entry.url} - ${entry.message}${entry.userAgent ? ` (${entry.userAgent})` : ""}`
        )
      : ["- None"])
  ];
  return `${lines.join("\n")}\n`;
}

async function writeReports(report: AuditReport) {
  await mkdir(report.options.reportDir, { recursive: true });
  await writeFile(path.join(report.options.reportDir, "seo-summary.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(report.options.reportDir, "seo-summary.md"), reportMarkdown(report));
  await writeFile(
    path.join(report.options.reportDir, "sitemap-status.tsv"),
    [
      "url\tstatus\tcontent_type\tkind\tentries\tduration_ms",
      ...report.sitemaps.map((entry) =>
        [entry.url, entry.status, entry.contentType, entry.kind, entry.entryCount, entry.durationMs].map(tsvCell).join("\t")
      )
    ].join("\n") + "\n"
  );
  await writeFile(
    path.join(report.options.reportDir, "route-status.tsv"),
    [
      "canonical_url\tfetch_url\tfamily\tuser_agent\tstatus\tfinal_url\tredirects\tduration_ms\tbytes\tcontent_type\tcache_control\tcache_tag\tcf_cache_status\tcanonical\ttitle\terror",
      ...report.pages.map((entry) =>
        [
          entry.canonicalUrl,
          entry.fetchUrl,
          entry.family,
          entry.userAgent,
          entry.status,
          entry.finalUrl,
          entry.redirectCount,
          entry.durationMs,
          entry.bytes,
          entry.contentType,
          entry.cacheControl,
          entry.cacheTag,
          entry.cfCacheStatus,
          entry.seo.canonical,
          entry.seo.title,
          entry.error
        ].map(tsvCell).join("\t")
      )
    ].join("\n") + "\n"
  );
  await writeFile(
    path.join(report.options.reportDir, "date-audit.tsv"),
    [
      "url\tuser_agent\ttype\tdate_published\tdate_modified",
      ...report.pages.flatMap((page) =>
        page.seo.jsonLdDates.map((dates) =>
          [page.canonicalUrl, page.userAgent, dates.type, dates.published, dates.modified].map(tsvCell).join("\t")
        )
      )
    ].join("\n") + "\n"
  );
  const structuredErrors = report.pages.flatMap((page) =>
    page.seo.structuredDataIssues.map((entry) => ({ url: page.canonicalUrl, userAgent: page.userAgent, ...entry }))
  );
  await writeFile(
    path.join(report.options.reportDir, "structured-data-errors.json"),
    `${JSON.stringify(structuredErrors, null, 2)}\n`
  );
  if (report.options.mode === "smoke" || report.options.mode === "postdeploy") {
    await writeFile(path.join(report.options.reportDir, "production-smoke.md"), reportMarkdown(report));
  }
}

async function main() {
  const options = parseOptions();
  const issues: AuditIssue[] = [];
  if (options.mode === "smoke" || options.mode === "postdeploy") await checkHealth(options, issues);
  const { results: sitemaps, entries } = await crawlSitemaps(options, issues);
  addSitemapDateContractIssues(entries, await loadRouteDateContracts(options.reportDir), issues);
  const pages = options.mode === "sitemaps"
    ? await runSitemapUrlStatusChecks(entries, options, issues)
    : await runPageChecks(entries, options, issues);
  if (options.mode === "routes" || options.mode === "smoke" || options.mode === "postdeploy") {
    await checkCriticalApis(options, issues);
    await checkDiscoveryRoutes(entries, options, issues);
  }
  const generatedAt = new Date().toISOString();
  const report: AuditReport = {
    generatedAt,
    options,
    totals: {
      sitemaps: sitemaps.length,
      sitemapEntries: entries.length,
      pageRequests: pages.length,
      errors: issues.filter((entry) => entry.severity === "error").length,
      warnings: issues.filter((entry) => entry.severity === "warning").length
    },
    sitemaps,
    entries,
    pages,
    issues
  };
  await writeReports(report);
  console.log(
    `${options.mode}: ${report.totals.sitemaps} sitemaps, ${report.totals.sitemapEntries} URLs, ${report.totals.pageRequests} page requests, ${report.totals.errors} errors, ${report.totals.warnings} warnings`
  );
  console.log(`Reports: ${options.reportDir}`);
  if (report.totals.errors) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
