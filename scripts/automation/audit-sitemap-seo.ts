import "../shared/load-env";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

const DEFAULT_SITE_URL = "https://bloxodes.com";
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_MAX_SITEMAPS = 500;
const DEFAULT_MAX_URLS = 50_000;
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_REDIRECTS = 8;
const DEFAULT_RETRIES = 1;
const DEFAULT_REQUEST_DELAY_MS = 0;
const DEFAULT_ROBOTS_USER_AGENT = "Googlebot";
const DEFAULT_OUTPUT_DIR = "tmp/seo-audits";
const USER_AGENT = "BloxodesSeoAudit/1.0 (+https://bloxodes.com)";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

type CliArgs = Record<string, string | boolean>;

type AuditConfig = {
  siteOrigin: string;
  sitemapUrl: string;
  host: string;
  concurrency: number;
  maxSitemaps: number;
  maxUrls: number;
  limit: number | null;
  timeoutMs: number;
  maxRedirects: number;
  retries: number;
  requestDelayMs: number;
  robotsUserAgent: string;
  outputDir: string;
  failOnError: boolean;
};

type SitemapPageEntry = {
  url: string;
  sitemapUrl: string;
  sitemapName: string;
  lastmod: string | null;
  changefreq: string | null;
  priority: string | null;
};

type DiscoveredSitemaps = {
  entries: SitemapPageEntry[];
  sitemapUrls: string[];
};

type HeaderSnapshot = {
  contentType: string | null;
  contentLength: string | null;
  xRobotsTag: string | null;
  cfCacheStatus: string | null;
  nextCacheStatus: string | null;
};

type RedirectHop = {
  url: string;
  status: number;
  location: string;
};

type PageFetchResult = {
  status: number;
  finalUrl: string;
  headers: HeaderSnapshot;
  body: string;
  redirectChain: RedirectHop[];
  durationMs: number;
  attempts: number;
  error: string | null;
};

type SeoDetails = {
  isHtml: boolean;
  lang: string | null;
  viewport: string | null;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1s: string[];
  canonical: string | null;
  canonicalMatchesFinal: boolean | null;
  canonicalHostMatches: boolean | null;
  metaRobots: string[];
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterCard: string | null;
  jsonLdTypes: string[];
  invalidJsonLdCount: number;
  wordCount: number;
  metaRefresh: string | null;
};

type PageAudit = SitemapPageEntry & {
  status: number;
  ok: boolean;
  indexable: boolean;
  finalUrl: string;
  redirected: boolean;
  redirectCount: number;
  redirectChain: RedirectHop[];
  durationMs: number;
  attempts: number;
  contentType: string | null;
  contentLength: string | null;
  xRobotsTag: string | null;
  robotsTxtAllowed: boolean | null;
  error: string | null;
  seo: SeoDetails;
  indexabilityIssues: string[];
  seoIssues: string[];
};

type RobotsRule = {
  type: "allow" | "disallow";
  pattern: string;
};

type RobotsGroup = {
  agents: string[];
  rules: RobotsRule[];
};

type RobotsPolicy = {
  groups: RobotsGroup[];
};

type RobotsAudit = {
  url: string;
  checked: boolean;
  status: number | null;
  error: string | null;
  policy: RobotsPolicy | null;
};

type AuditReport = {
  generatedAt: string;
  config: Omit<AuditConfig, "outputDir"> & { outputDir: string };
  totals: Record<string, number>;
  byStatus: Record<string, number>;
  bySitemap: Record<string, number>;
  issueCounts: Record<string, number>;
  robots: Omit<RobotsAudit, "policy"> & { groupCount: number };
  sitemapUrls: string[];
  pages: PageAudit[];
};

function printHelp() {
  console.log(`Bloxodes sitemap SEO audit

Usage:
  npm run audit:seo
  npm run audit:seo -- --site https://bloxodes.com --limit 100

Options:
  --site <url>              Site origin. Defaults to SEO_AUDIT_SITE_URL, SITE_URL, NEXT_PUBLIC_SITE_URL, or ${DEFAULT_SITE_URL}
  --sitemap <url>           Sitemap URL. Defaults to <site>/sitemap.xml
  --concurrency <n>         Parallel page requests. Default ${DEFAULT_CONCURRENCY}
  --max-sitemaps <n>        Safety cap for sitemap files. Default ${DEFAULT_MAX_SITEMAPS}
  --max-urls <n>            Safety cap for discovered page URLs. Default ${DEFAULT_MAX_URLS}
  --limit <n>               Audit only the first n sitemap URLs for a quick smoke test
  --timeout-ms <n>          Per-request timeout. Default ${DEFAULT_TIMEOUT_MS}
  --retries <n>             Retries for network/5xx/429 failures. Default ${DEFAULT_RETRIES}
  --request-delay-ms <n>    Delay after each request per worker. Default ${DEFAULT_REQUEST_DELAY_MS}
  --robots-user-agent <ua>  robots.txt user agent to evaluate. Default ${DEFAULT_ROBOTS_USER_AGENT}
  --output-dir <path>       Report directory. Default ${DEFAULT_OUTPUT_DIR}
  --fail-on-error           Exit 1 when non-indexable pages or HTTP failures are found
`);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    if (!raw?.startsWith("--")) continue;

    const withoutPrefix = raw.slice(2);
    const equalsIndex = withoutPrefix.indexOf("=");
    if (equalsIndex >= 0) {
      const key = withoutPrefix.slice(0, equalsIndex);
      const value = withoutPrefix.slice(equalsIndex + 1);
      args[key] = value;
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[withoutPrefix] = next;
      index += 1;
    } else {
      args[withoutPrefix] = true;
    }
  }

  return args;
}

function cliString(args: CliArgs, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseBoolean(value: string | boolean | undefined, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function clampNumber(value: string | boolean | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function normalizeOrigin(raw: string): string {
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Invalid site URL protocol: ${parsed.protocol}`);
  }
  return `${parsed.protocol}//${parsed.host}`;
}

function normalizeAbsoluteUrl(raw: string, base: string): string {
  const parsed = new URL(raw, base);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }
  parsed.hash = "";
  return parsed.toString();
}

function normalizeForComparison(raw: string): string {
  const parsed = new URL(raw);
  parsed.hash = "";
  if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }
  return parsed.toString();
}

function urlsEquivalent(left: string, right: string): boolean {
  try {
    return normalizeForComparison(left) === normalizeForComparison(right);
  } catch {
    return false;
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function resolveConfig(): AuditConfig {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    printHelp();
    process.exit(0);
  }

  const siteOrigin = normalizeOrigin(
    cliString(args, "site") ||
      process.env.SEO_AUDIT_SITE_URL?.trim() ||
      process.env.SITE_URL?.trim() ||
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      DEFAULT_SITE_URL
  );

  const sitemapUrl = normalizeAbsoluteUrl(
    cliString(args, "sitemap") || process.env.SEO_AUDIT_SITEMAP_URL?.trim() || `${siteOrigin}/sitemap.xml`,
    siteOrigin
  );

  const outputDir = path.resolve(
    repoRoot,
    cliString(args, "output-dir") || process.env.SEO_AUDIT_OUTPUT_DIR?.trim() || DEFAULT_OUTPUT_DIR
  );

  return {
    siteOrigin,
    sitemapUrl,
    host: new URL(siteOrigin).host,
    concurrency: clampNumber(args.concurrency ?? process.env.SEO_AUDIT_CONCURRENCY, DEFAULT_CONCURRENCY, 1, 32),
    maxSitemaps: clampNumber(args["max-sitemaps"] ?? process.env.SEO_AUDIT_MAX_SITEMAPS, DEFAULT_MAX_SITEMAPS, 1, 10_000),
    maxUrls: clampNumber(args["max-urls"] ?? process.env.SEO_AUDIT_MAX_URLS, DEFAULT_MAX_URLS, 1, 250_000),
    limit:
      args.limit || process.env.SEO_AUDIT_LIMIT
        ? clampNumber(args.limit ?? process.env.SEO_AUDIT_LIMIT, 0, 1, 250_000)
        : null,
    timeoutMs: clampNumber(args["timeout-ms"] ?? process.env.SEO_AUDIT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1000, 120_000),
    maxRedirects: clampNumber(
      args["max-redirects"] ?? process.env.SEO_AUDIT_MAX_REDIRECTS,
      DEFAULT_MAX_REDIRECTS,
      0,
      20
    ),
    retries: clampNumber(args.retries ?? process.env.SEO_AUDIT_RETRIES, DEFAULT_RETRIES, 0, 5),
    requestDelayMs: clampNumber(
      args["request-delay-ms"] ?? process.env.SEO_AUDIT_REQUEST_DELAY_MS,
      DEFAULT_REQUEST_DELAY_MS,
      0,
      10_000
    ),
    robotsUserAgent:
      cliString(args, "robots-user-agent") ||
      process.env.SEO_AUDIT_ROBOTS_USER_AGENT?.trim() ||
      DEFAULT_ROBOTS_USER_AGENT,
    outputDir,
    failOnError: parseBoolean(args["fail-on-error"] ?? process.env.SEO_AUDIT_FAIL_ON_ERROR, false)
  };
}

function sitemapNameFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  const match = pathname.match(/\/sitemaps\/([^/.]+)\.xml$/i);
  if (match?.[1]) return match[1].toLowerCase();
  if (pathname === "/sitemap.xml") return "index";
  return "unknown";
}

async function fetchText(url: string, config: AuditConfig, accept: string): Promise<{ status: number; body: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        accept,
        "user-agent": USER_AGENT
      },
      signal: controller.signal
    });
    const body = await response.text();
    return { status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

function parseSitemapXml(xml: string, sitemapUrl: string): { sitemapUrls: string[]; pages: SitemapPageEntry[] } {
  const $ = load(xml, { xmlMode: true });
  const sitemapUrls: string[] = [];
  const pages: SitemapPageEntry[] = [];
  const isSitemapIndex = $("sitemapindex").length > 0;
  const isUrlSet = $("urlset").length > 0;

  if (isSitemapIndex) {
    $("sitemap").each((_, element) => {
      const loc = normalizeText($(element).find("loc").first().text());
      if (loc) sitemapUrls.push(loc);
    });
    return { sitemapUrls, pages };
  }

  if (isUrlSet) {
    const sitemapName = sitemapNameFromUrl(sitemapUrl);
    $("url").each((_, element) => {
      const item = $(element);
      const loc = normalizeText(item.find("loc").first().text());
      if (!loc) return;

      pages.push({
        url: loc,
        sitemapUrl,
        sitemapName,
        lastmod: normalizeText(item.find("lastmod").first().text()) || null,
        changefreq: normalizeText(item.find("changefreq").first().text()) || null,
        priority: normalizeText(item.find("priority").first().text()) || null
      });
    });
  }

  return { sitemapUrls, pages };
}

function lastmodTime(entry: SitemapPageEntry): number {
  if (!entry.lastmod) return 0;
  const parsed = Date.parse(entry.lastmod);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function collectUrlsFromSitemaps(config: AuditConfig): Promise<DiscoveredSitemaps> {
  const queue = [config.sitemapUrl];
  const seenSitemaps = new Set<string>();
  const pageEntries = new Map<string, SitemapPageEntry>();

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;

    const currentUrl = normalizeAbsoluteUrl(current, config.siteOrigin);
    if (seenSitemaps.has(currentUrl)) continue;
    if (seenSitemaps.size >= config.maxSitemaps) {
      throw new Error(`Sitemap crawl exceeded max-sitemaps=${config.maxSitemaps}.`);
    }

    seenSitemaps.add(currentUrl);
    console.log(`Sitemap ${seenSitemaps.size}: ${currentUrl}`);

    const { status, body } = await fetchText(currentUrl, config, "application/xml,text/xml,*/*");
    if (status < 200 || status >= 300) {
      throw new Error(`Failed to fetch sitemap ${currentUrl}: HTTP ${status}`);
    }

    const parsed = parseSitemapXml(body, currentUrl);
    for (const nested of parsed.sitemapUrls) {
      let nestedUrl: string;
      try {
        nestedUrl = normalizeAbsoluteUrl(nested, currentUrl);
      } catch {
        console.warn(`Skipping invalid sitemap URL: ${nested}`);
        continue;
      }
      if (new URL(nestedUrl).host !== config.host) {
        console.warn(`Skipping cross-host sitemap: ${nestedUrl}`);
        continue;
      }
      if (!seenSitemaps.has(nestedUrl)) queue.push(nestedUrl);
    }

    for (const page of parsed.pages) {
      let pageUrl: string;
      try {
        pageUrl = normalizeAbsoluteUrl(page.url, currentUrl);
      } catch {
        console.warn(`Skipping invalid page URL: ${page.url}`);
        continue;
      }
      if (new URL(pageUrl).host !== config.host) {
        console.warn(`Skipping cross-host page URL: ${pageUrl}`);
        continue;
      }

      const normalizedPage = { ...page, url: pageUrl };
      const existing = pageEntries.get(pageUrl);
      if (!existing || lastmodTime(normalizedPage) > lastmodTime(existing)) {
        pageEntries.set(pageUrl, normalizedPage);
      }

      if (pageEntries.size >= config.maxUrls) {
        console.warn(`Reached max-urls=${config.maxUrls}; sitemap collection stopped early.`);
        return { entries: Array.from(pageEntries.values()), sitemapUrls: Array.from(seenSitemaps) };
      }
    }
  }

  return { entries: Array.from(pageEntries.values()), sitemapUrls: Array.from(seenSitemaps) };
}

function snapshotHeaders(headers: Headers): HeaderSnapshot {
  return {
    contentType: headers.get("content-type"),
    contentLength: headers.get("content-length"),
    xRobotsTag: headers.get("x-robots-tag"),
    cfCacheStatus: headers.get("cf-cache-status"),
    nextCacheStatus: headers.get("x-nextjs-cache")
  };
}

async function fetchPageOnce(url: string, config: AuditConfig): Promise<PageFetchResult> {
  const startedAt = Date.now();
  const redirectChain: RedirectHop[] = [];
  let currentUrl = url;

  try {
    for (let redirectIndex = 0; redirectIndex <= config.maxRedirects; redirectIndex += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const response = await fetch(currentUrl, {
          redirect: "manual",
          headers: {
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "user-agent": USER_AGENT
          },
          signal: controller.signal
        });

        const location = response.headers.get("location");
        if (response.status >= 300 && response.status < 400 && location) {
          const nextUrl = normalizeAbsoluteUrl(location, currentUrl);
          redirectChain.push({
            url: currentUrl,
            status: response.status,
            location: nextUrl
          });
          currentUrl = nextUrl;
          continue;
        }

        const body = await response.text().catch(() => "");
        return {
          status: response.status,
          finalUrl: currentUrl,
          headers: snapshotHeaders(response.headers),
          body,
          redirectChain,
          durationMs: Date.now() - startedAt,
          attempts: 1,
          error: null
        };
      } finally {
        clearTimeout(timeout);
      }
    }

    return {
      status: 0,
      finalUrl: currentUrl,
      headers: {
        contentType: null,
        contentLength: null,
        xRobotsTag: null,
        cfCacheStatus: null,
        nextCacheStatus: null
      },
      body: "",
      redirectChain,
      durationMs: Date.now() - startedAt,
      attempts: 1,
      error: `Exceeded max redirects (${config.maxRedirects})`
    };
  } catch (error) {
    return {
      status: 0,
      finalUrl: currentUrl,
      headers: {
        contentType: null,
        contentLength: null,
        xRobotsTag: null,
        cfCacheStatus: null,
        nextCacheStatus: null
      },
      body: "",
      redirectChain,
      durationMs: Date.now() - startedAt,
      attempts: 1,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function shouldRetry(result: PageFetchResult): boolean {
  return result.status === 0 || result.status === 408 || result.status === 429 || result.status >= 500;
}

async function fetchPageWithRetries(url: string, config: AuditConfig): Promise<PageFetchResult> {
  let lastResult: PageFetchResult | null = null;

  for (let attempt = 0; attempt <= config.retries; attempt += 1) {
    const result = await fetchPageOnce(url, config);
    lastResult = { ...result, attempts: attempt + 1 };
    if (!shouldRetry(result) || attempt === config.retries) return lastResult;
    await sleep(250 * (attempt + 1));
  }

  return lastResult ?? fetchPageOnce(url, config);
}

function hasHtmlBody(contentType: string | null, body: string): boolean {
  const normalizedType = contentType?.toLowerCase() ?? "";
  if (normalizedType.includes("text/html") || normalizedType.includes("application/xhtml+xml")) return true;
  return /^\s*<!doctype html|^\s*<html[\s>]/i.test(body);
}

function attrContent($: ReturnType<typeof load>, selector: string): string | null {
  const value = $(selector).first().attr("content");
  return value ? normalizeText(value) : null;
}

function parseRobotsMeta($: ReturnType<typeof load>): string[] {
  const values: string[] = [];
  $('meta[name="robots"], meta[name="googlebot"]').each((_, element) => {
    const name = normalizeText($(element).attr("name") ?? "").toLowerCase();
    const content = normalizeText($(element).attr("content") ?? "");
    if (name && content) values.push(`${name}: ${content}`);
  });
  return values;
}

function parseJsonLdTypes($: ReturnType<typeof load>): { types: string[]; invalidCount: number } {
  const types = new Set<string>();
  let invalidCount = 0;

  function addTypes(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) addTypes(item);
      return;
    }

    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const typeValue = record["@type"];
    if (typeof typeValue === "string" && typeValue.trim()) {
      types.add(typeValue.trim());
    } else if (Array.isArray(typeValue)) {
      for (const item of typeValue) {
        if (typeof item === "string" && item.trim()) types.add(item.trim());
      }
    }

    if (Array.isArray(record["@graph"])) addTypes(record["@graph"]);
  }

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text().trim();
    if (!raw) return;
    try {
      addTypes(JSON.parse(raw));
    } catch {
      invalidCount += 1;
    }
  });

  return { types: Array.from(types).sort(), invalidCount };
}

function countBodyWords($: ReturnType<typeof load>): number {
  const body = $("body").clone();
  body.find("script, style, noscript, svg").remove();
  const text = normalizeText(body.text());
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function parseSeoDetails(fetchResult: PageFetchResult, config: AuditConfig): SeoDetails {
  const isHtml = hasHtmlBody(fetchResult.headers.contentType, fetchResult.body);
  if (!isHtml) {
    return {
      isHtml: false,
      lang: null,
      viewport: null,
      title: null,
      titleLength: 0,
      metaDescription: null,
      metaDescriptionLength: 0,
      h1s: [],
      canonical: null,
      canonicalMatchesFinal: null,
      canonicalHostMatches: null,
      metaRobots: [],
      ogTitle: null,
      ogDescription: null,
      ogImage: null,
      twitterCard: null,
      jsonLdTypes: [],
      invalidJsonLdCount: 0,
      wordCount: 0,
      metaRefresh: null
    };
  }

  const $ = load(fetchResult.body);
  const title = normalizeText($("title").first().text()) || null;
  const description = attrContent($, 'meta[name="description"]');
  const rawCanonical =
    $('link[rel="canonical"]').first().attr("href") || $('link[rel~="canonical"]').first().attr("href") || null;
  const canonical = rawCanonical ? safeAbsoluteUrl(rawCanonical, fetchResult.finalUrl) : null;
  const h1s = $("h1")
    .toArray()
    .map((element) => normalizeText($(element).text()))
    .filter(Boolean);
  const jsonLd = parseJsonLdTypes($);

  return {
    isHtml: true,
    lang: normalizeText($("html").attr("lang") ?? "") || null,
    viewport: attrContent($, 'meta[name="viewport"]'),
    title,
    titleLength: title?.length ?? 0,
    metaDescription: description,
    metaDescriptionLength: description?.length ?? 0,
    h1s,
    canonical,
    canonicalMatchesFinal: canonical ? urlsEquivalent(canonical, fetchResult.finalUrl) : null,
    canonicalHostMatches: canonical ? new URL(canonical).host === config.host : null,
    metaRobots: parseRobotsMeta($),
    ogTitle: attrContent($, 'meta[property="og:title"]'),
    ogDescription: attrContent($, 'meta[property="og:description"]'),
    ogImage: attrContent($, 'meta[property="og:image"]'),
    twitterCard: attrContent($, 'meta[name="twitter:card"]'),
    jsonLdTypes: jsonLd.types,
    invalidJsonLdCount: jsonLd.invalidCount,
    wordCount: countBodyWords($),
    metaRefresh: $("meta[http-equiv]")
      .toArray()
      .find((element) => normalizeText($(element).attr("http-equiv") ?? "").toLowerCase() === "refresh")
      ? attrContent($, "meta[http-equiv]")
      : null
  };
}

function safeAbsoluteUrl(raw: string, base: string): string | null {
  try {
    return normalizeAbsoluteUrl(raw, base);
  } catch {
    return null;
  }
}

function splitRobotsDirectives(values: Array<string | null>): Set<string> {
  const directives = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const token of value.toLowerCase().split(/[,\s]+/)) {
      const trimmed = token.trim();
      if (trimmed) directives.add(trimmed);
    }
  }
  return directives;
}

function hasNoindexSignal(seo: SeoDetails, xRobotsTag: string | null): boolean {
  const values = [
    xRobotsTag,
    ...seo.metaRobots.map((value) => value.replace(/^[^:]+:\s*/, ""))
  ];
  const directives = splitRobotsDirectives(values);
  return directives.has("noindex") || directives.has("none");
}

function parseRobotsTxt(body: string): RobotsPolicy {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let currentHasRules = false;

  function finishCurrent() {
    if (current && current.agents.length) groups.push(current);
    current = null;
    currentHasRules = false;
  }

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;

    const separator = line.indexOf(":");
    if (separator < 0) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (!current || currentHasRules) {
        finishCurrent();
        current = { agents: [], rules: [] };
      }
      current.agents.push(value.toLowerCase());
      continue;
    }

    if (field === "allow" || field === "disallow") {
      if (!current) current = { agents: ["*"], rules: [] };
      currentHasRules = true;
      current.rules.push({ type: field, pattern: value });
    }
  }

  finishCurrent();
  return { groups };
}

function regexEscape(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function robotsPatternMatches(pattern: string, pathWithSearch: string): boolean {
  if (!pattern) return false;
  const anchored = pattern.endsWith("$");
  const patternBody = anchored ? pattern.slice(0, -1) : pattern;
  const regex = new RegExp(`^${regexEscape(patternBody).replace(/\\\*/g, ".*")}${anchored ? "$" : ""}`);
  return regex.test(pathWithSearch);
}

function agentMatchLength(group: RobotsGroup, userAgent: string): number {
  const normalized = userAgent.toLowerCase();
  let best = 0;
  for (const agent of group.agents) {
    if (agent === "*") {
      best = Math.max(best, 1);
      continue;
    }
    if (agent && normalized.includes(agent)) {
      best = Math.max(best, agent.length);
    }
  }
  return best;
}

function isAllowedByRobots(policy: RobotsPolicy, url: string, userAgent: string): boolean {
  const parsed = new URL(url);
  const pathWithSearch = `${parsed.pathname}${parsed.search}`;
  const matchingGroups = policy.groups
    .map((group) => ({ group, score: agentMatchLength(group, userAgent) }))
    .filter((item) => item.score > 0);

  if (!matchingGroups.length) return true;
  const bestScore = Math.max(...matchingGroups.map((item) => item.score));
  const rules = matchingGroups
    .filter((item) => item.score === bestScore)
    .flatMap((item) => item.group.rules);

  let bestRule: RobotsRule | null = null;
  let bestLength = -1;
  for (const rule of rules) {
    if (!robotsPatternMatches(rule.pattern, pathWithSearch)) continue;
    const length = rule.pattern.length;
    if (length > bestLength || (length === bestLength && rule.type === "allow")) {
      bestRule = rule;
      bestLength = length;
    }
  }

  return bestRule ? bestRule.type === "allow" : true;
}

async function loadRobotsAudit(config: AuditConfig): Promise<RobotsAudit> {
  const robotsUrl = `${config.siteOrigin}/robots.txt`;

  try {
    const { status, body } = await fetchText(robotsUrl, config, "text/plain,*/*");
    if (status === 404) {
      return { url: robotsUrl, checked: true, status, error: null, policy: null };
    }
    if (status < 200 || status >= 300) {
      return { url: robotsUrl, checked: false, status, error: `HTTP ${status}`, policy: null };
    }
    return { url: robotsUrl, checked: true, status, error: null, policy: parseRobotsTxt(body) };
  } catch (error) {
    return {
      url: robotsUrl,
      checked: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
      policy: null
    };
  }
}

function robotsAllowedForUrl(robots: RobotsAudit, url: string, userAgent: string): boolean | null {
  if (!robots.checked) return null;
  if (!robots.policy) return true;
  return isAllowedByRobots(robots.policy, url, userAgent);
}

function evaluateIndexability(
  fetchResult: PageFetchResult,
  seo: SeoDetails,
  robotsTxtAllowed: boolean | null
): { indexable: boolean; issues: string[] } {
  const issues: string[] = [];

  if (fetchResult.error) issues.push("fetch-error");
  if (fetchResult.status < 200 || fetchResult.status >= 300) issues.push(`http-${fetchResult.status || "error"}`);
  if (!seo.isHtml) issues.push("non-html-response");
  if (robotsTxtAllowed === false) issues.push("robots-txt-blocked");
  if (robotsTxtAllowed === null) issues.push("robots-txt-unchecked");
  if (hasNoindexSignal(seo, fetchResult.headers.xRobotsTag)) issues.push("noindex");
  if (seo.canonical && seo.canonicalMatchesFinal === false) issues.push("canonical-points-elsewhere");

  const indexable = !issues.some((issue) =>
    [
      "fetch-error",
      "non-html-response",
      "robots-txt-blocked",
      "robots-txt-unchecked",
      "noindex",
      "canonical-points-elsewhere"
    ].includes(issue) || issue.startsWith("http-")
  );

  return { indexable, issues };
}

function evaluateSeoIssues(entry: SitemapPageEntry, fetchResult: PageFetchResult, seo: SeoDetails): string[] {
  const issues: string[] = [];

  if (fetchResult.redirectChain.length) issues.push("sitemap-url-redirects");
  if (!urlsEquivalent(entry.url, fetchResult.finalUrl)) issues.push("final-url-differs-from-sitemap");
  if (!seo.isHtml) return issues;
  if (!seo.title) issues.push("missing-title");
  if (seo.title && seo.titleLength < 20) issues.push("short-title");
  if (seo.titleLength > 65) issues.push("long-title");
  if (!seo.metaDescription) issues.push("missing-meta-description");
  if (seo.metaDescription && seo.metaDescriptionLength < 50) issues.push("short-meta-description");
  if (seo.metaDescriptionLength > 170) issues.push("long-meta-description");
  if (seo.h1s.length === 0) issues.push("missing-h1");
  if (seo.h1s.length > 1) issues.push("multiple-h1");
  if (!seo.canonical) issues.push("missing-canonical");
  if (seo.canonical && seo.canonicalHostMatches === false) issues.push("canonical-cross-host");
  if (seo.canonical && seo.canonicalMatchesFinal === false) issues.push("canonical-mismatch");
  if (!seo.lang) issues.push("missing-html-lang");
  if (!seo.viewport) issues.push("missing-viewport");
  if (!seo.ogTitle) issues.push("missing-og-title");
  if (!seo.ogDescription) issues.push("missing-og-description");
  if (!seo.ogImage) issues.push("missing-og-image");
  if (!seo.twitterCard) issues.push("missing-twitter-card");
  if (!seo.jsonLdTypes.length) issues.push("missing-json-ld");
  if (seo.invalidJsonLdCount > 0) issues.push("invalid-json-ld");
  if (seo.metaRefresh) issues.push("meta-refresh");
  if (seo.wordCount > 0 && seo.wordCount < 120) issues.push("thin-body-copy");

  return issues;
}

async function auditPage(entry: SitemapPageEntry, config: AuditConfig, robots: RobotsAudit): Promise<PageAudit> {
  const fetchResult = await fetchPageWithRetries(entry.url, config);
  const seo = parseSeoDetails(fetchResult, config);
  const robotsTxtAllowed = robotsAllowedForUrl(robots, fetchResult.finalUrl || entry.url, config.robotsUserAgent);
  const indexability = evaluateIndexability(fetchResult, seo, robotsTxtAllowed);
  const seoIssues = evaluateSeoIssues(entry, fetchResult, seo);

  return {
    ...entry,
    status: fetchResult.status,
    ok: fetchResult.status >= 200 && fetchResult.status < 300,
    indexable: indexability.indexable,
    finalUrl: fetchResult.finalUrl,
    redirected: fetchResult.redirectChain.length > 0,
    redirectCount: fetchResult.redirectChain.length,
    redirectChain: fetchResult.redirectChain,
    durationMs: fetchResult.durationMs,
    attempts: fetchResult.attempts,
    contentType: fetchResult.headers.contentType,
    contentLength: fetchResult.headers.contentLength,
    xRobotsTag: fetchResult.headers.xRobotsTag,
    robotsTxtAllowed,
    error: fetchResult.error,
    seo,
    indexabilityIssues: indexability.issues,
    seoIssues
  };
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  delayMs: number
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;

      const item = items[index];
      if (!item) return;
      results[index] = await worker(item, index);
      if (delayMs > 0) await sleep(delayMs);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
  return results;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pushUnique(values: string[], issue: string): void {
  if (!values.includes(issue)) values.push(issue);
}

function addDuplicateIssues(pages: PageAudit[]): void {
  const byTitle = new Map<string, PageAudit[]>();
  const byDescription = new Map<string, PageAudit[]>();
  const byCanonical = new Map<string, PageAudit[]>();

  for (const page of pages) {
    if (!page.seo.isHtml || !page.ok) continue;

    const title = page.seo.title?.toLowerCase();
    if (title) byTitle.set(title, [...(byTitle.get(title) ?? []), page]);

    const description = page.seo.metaDescription?.toLowerCase();
    if (description) byDescription.set(description, [...(byDescription.get(description) ?? []), page]);

    if (page.seo.canonical) {
      const canonical = normalizeForComparison(page.seo.canonical);
      byCanonical.set(canonical, [...(byCanonical.get(canonical) ?? []), page]);
    }
  }

  for (const matches of byTitle.values()) {
    if (matches.length > 1) matches.forEach((page) => pushUnique(page.seoIssues, "duplicate-title"));
  }
  for (const matches of byDescription.values()) {
    if (matches.length > 1) matches.forEach((page) => pushUnique(page.seoIssues, "duplicate-meta-description"));
  }
  for (const matches of byCanonical.values()) {
    const uniqueFinalUrls = new Set(matches.map((page) => normalizeForComparison(page.finalUrl)));
    if (uniqueFinalUrls.size > 1) matches.forEach((page) => pushUnique(page.seoIssues, "duplicate-canonical"));
  }
}

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function buildReport(config: AuditConfig, robots: RobotsAudit, discovered: DiscoveredSitemaps, pages: PageAudit[]): AuditReport {
  const byStatus: Record<string, number> = {};
  const bySitemap: Record<string, number> = {};
  const issueCounts: Record<string, number> = {};

  for (const page of pages) {
    increment(byStatus, String(page.status));
    increment(bySitemap, page.sitemapName);
    for (const issue of page.indexabilityIssues) increment(issueCounts, issue);
    for (const issue of page.seoIssues) increment(issueCounts, issue);
  }

  const totals = {
    pages: pages.length,
    ok: pages.filter((page) => page.ok).length,
    notOk: pages.filter((page) => !page.ok).length,
    indexable: pages.filter((page) => page.indexable).length,
    nonIndexable: pages.filter((page) => !page.indexable).length,
    redirected: pages.filter((page) => page.redirected).length,
    noindex: pages.filter((page) => hasNoindexSignal(page.seo, page.xRobotsTag)).length,
    robotsBlocked: pages.filter((page) => page.robotsTxtAllowed === false).length,
    missingCanonical: pages.filter((page) => page.seoIssues.includes("missing-canonical")).length,
    canonicalMismatch: pages.filter((page) => page.seoIssues.includes("canonical-mismatch")).length,
    missingTitle: pages.filter((page) => page.seoIssues.includes("missing-title")).length,
    missingDescription: pages.filter((page) => page.seoIssues.includes("missing-meta-description")).length
  };

  return {
    generatedAt: new Date().toISOString(),
    config: {
      ...config,
      outputDir: config.outputDir
    },
    totals,
    byStatus,
    bySitemap,
    issueCounts: Object.fromEntries(Object.entries(issueCounts).sort(([, a], [, b]) => b - a || 0)),
    robots: {
      url: robots.url,
      checked: robots.checked,
      status: robots.status,
      error: robots.error,
      groupCount: robots.policy?.groups.length ?? 0
    },
    sitemapUrls: discovered.sitemapUrls,
    pages
  };
}

function csvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join("; ") : value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(pages: PageAudit[]): string {
  const columns = [
    "url",
    "sitemap_name",
    "sitemap_url",
    "lastmod",
    "changefreq",
    "priority",
    "status",
    "ok",
    "indexable",
    "final_url",
    "redirect_count",
    "duration_ms",
    "attempts",
    "content_type",
    "content_length",
    "x_robots_tag",
    "robots_txt_allowed",
    "meta_robots",
    "title",
    "title_length",
    "meta_description",
    "meta_description_length",
    "h1_count",
    "h1",
    "canonical",
    "canonical_matches_final",
    "og_title",
    "og_description",
    "og_image",
    "twitter_card",
    "json_ld_types",
    "word_count",
    "indexability_issues",
    "seo_issues",
    "error"
  ];

  const rows = pages.map((page) => [
    page.url,
    page.sitemapName,
    page.sitemapUrl,
    page.lastmod,
    page.changefreq,
    page.priority,
    page.status,
    page.ok,
    page.indexable,
    page.finalUrl,
    page.redirectCount,
    page.durationMs,
    page.attempts,
    page.contentType,
    page.contentLength,
    page.xRobotsTag,
    page.robotsTxtAllowed,
    page.seo.metaRobots,
    page.seo.title,
    page.seo.titleLength,
    page.seo.metaDescription,
    page.seo.metaDescriptionLength,
    page.seo.h1s.length,
    page.seo.h1s[0] ?? null,
    page.seo.canonical,
    page.seo.canonicalMatchesFinal,
    page.seo.ogTitle,
    page.seo.ogDescription,
    page.seo.ogImage,
    page.seo.twitterCard,
    page.seo.jsonLdTypes,
    page.seo.wordCount,
    page.indexabilityIssues,
    page.seoIssues,
    page.error
  ]);

  return [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

async function writeReports(report: AuditReport, outputDir: string): Promise<{ jsonPath: string; csvPath: string }> {
  const stamp = report.generatedAt.replace(/[:.]/g, "-");
  await mkdir(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, `sitemap-seo-audit-${stamp}.json`);
  const csvPath = path.join(outputDir, `sitemap-seo-audit-${stamp}.csv`);

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(csvPath, `${toCsv(report.pages)}\n`, "utf8");

  return { jsonPath, csvPath };
}

function printSummary(report: AuditReport, paths: { jsonPath: string; csvPath: string }) {
  const topIssues = Object.entries(report.issueCounts)
    .slice(0, 12)
    .map(([issue, count]) => `${issue}=${count}`)
    .join(", ");

  console.log("");
  console.log("SEO audit complete.");
  console.log(
    `Pages=${report.totals.pages}, OK=${report.totals.ok}, not OK=${report.totals.notOk}, indexable=${report.totals.indexable}, non-indexable=${report.totals.nonIndexable}, redirected=${report.totals.redirected}`
  );
  console.log(`Status counts: ${Object.entries(report.byStatus).map(([status, count]) => `${status}=${count}`).join(", ")}`);
  if (topIssues) console.log(`Top issues: ${topIssues}`);
  console.log(`JSON: ${paths.jsonPath}`);
  console.log(`CSV: ${paths.csvPath}`);

  const failures = report.pages.filter((page) => !page.ok || !page.indexable);
  if (failures.length) {
    console.log("");
    console.log("First failures/non-indexable pages:");
    for (const page of failures.slice(0, 20)) {
      const issues = [...page.indexabilityIssues, ...page.seoIssues].slice(0, 6).join(", ");
      console.log(`- ${page.status} indexable=${page.indexable} ${page.url} :: ${issues || page.error || "unknown"}`);
    }
  }
}

async function main() {
  const config = resolveConfig();

  console.log("Sitemap SEO audit starting...");
  console.log(`Site origin: ${config.siteOrigin}`);
  console.log(`Sitemap root: ${config.sitemapUrl}`);
  console.log(`Concurrency: ${config.concurrency}`);
  console.log(`Max URLs: ${config.maxUrls}`);
  console.log(`Limit: ${config.limit ?? "none"}`);
  console.log(`robots.txt user agent: ${config.robotsUserAgent}`);

  const robots = await loadRobotsAudit(config);
  if (!robots.checked) {
    console.warn(`robots.txt could not be checked: ${robots.error ?? "unknown error"}`);
  } else {
    console.log(`robots.txt checked: ${robots.status ?? "unknown"} (${robots.policy?.groups.length ?? 0} groups)`);
  }

  const discovered = await collectUrlsFromSitemaps(config);
  const pagesToAudit = config.limit ? discovered.entries.slice(0, config.limit) : discovered.entries;
  console.log(`Discovered ${discovered.entries.length} page URLs from ${discovered.sitemapUrls.length} sitemap files.`);
  console.log(`Auditing ${pagesToAudit.length} page URLs.`);

  const pages = await runWithConcurrency(
    pagesToAudit,
    config.concurrency,
    async (entry, index) => {
      const page = await auditPage(entry, config, robots);
      const outcome = page.ok ? "OK" : "ERR";
      const indexable = page.indexable ? "indexable" : "blocked";
      console.log(
        `[${index + 1}/${pagesToAudit.length}] ${outcome} ${page.status} ${indexable} ${page.durationMs}ms ${entry.url}`
      );
      return page;
    },
    config.requestDelayMs
  );

  addDuplicateIssues(pages);
  const report = buildReport(config, robots, discovered, pages);
  const reportPaths = await writeReports(report, config.outputDir);
  printSummary(report, reportPaths);

  if (config.failOnError && report.pages.some((page) => !page.ok || !page.indexable)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Sitemap SEO audit failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
