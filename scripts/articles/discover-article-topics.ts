import "../shared/load-env";

import { gunzipSync } from "node:zlib";

import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";

import {
  DEFAULT_ARTICLE_DISCOVERY_MAX_AGE_HOURS,
  filterRecentDiscoveryCandidates,
  type DiscoveryFunnelStats,
  validateDiscoveryMaxAgeHours
} from "./article-discovery-filter";
import { resolveArticleDevCredentials } from "./article-queue-env";

type SourceName =
  | "pro-game-guides"
  | "destructoid"
  | "beebom"
  | "sportskeeda"
  | "game8"
  | "game-rant"
  | "techwiser";

type Candidate = {
  sourceName: SourceName;
  sourceUrl: string;
  title: string;
  publishedAt: string | null;
  description?: string;
  categories?: string[];
  discoveredFrom: string;
};

type Options = {
  apply: boolean;
  maxAgeHours: number;
  perSource: number;
  sources: Set<SourceName>;
};

const ALL_SOURCES: SourceName[] = [
  "pro-game-guides",
  "destructoid",
  "beebom",
  "sportskeeda",
  "game8",
  "game-rant",
  "techwiser"
];

const SOURCE_LABELS: Record<SourceName, string> = {
  "pro-game-guides": "Pro Game Guides",
  destructoid: "Destructoid",
  beebom: "Beebom",
  sportskeeda: "Sportskeeda",
  game8: "Game8",
  "game-rant": "Game Rant",
  techwiser: "TechWiser"
};

const USER_AGENT = "BloxodesTopicDiscovery/1.0 (+https://bloxodes.com)";
const FETCH_TIMEOUT_MS = 20_000;

function printUsage() {
  console.log(
    "Usage: npm run articles:discover -- [--apply] [--max-age-hours N] [--per-source N] [--source NAME]"
  );
  console.log(`Sources: ${ALL_SOURCES.join(", ")}`);
}

function readPositiveNumber(value: string | undefined, flag: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} requires a positive number.`);
  return parsed;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    apply: false,
    maxAgeHours: DEFAULT_ARTICLE_DISCOVERY_MAX_AGE_HOURS,
    perSource: 25,
    sources: new Set(ALL_SOURCES)
  };
  const selected: SourceName[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--max-age-hours") {
      options.maxAgeHours = readPositiveNumber(argv[++index], arg);
    } else if (arg.startsWith("--max-age-hours=")) {
      options.maxAgeHours = readPositiveNumber(arg.split("=")[1], "--max-age-hours");
    } else if (arg === "--per-source") {
      options.perSource = Math.floor(readPositiveNumber(argv[++index], arg));
    } else if (arg.startsWith("--per-source=")) {
      options.perSource = Math.floor(readPositiveNumber(arg.split("=")[1], "--per-source"));
    } else if (arg === "--source") {
      selected.push(parseSource(argv[++index]));
    } else if (arg.startsWith("--source=")) {
      selected.push(parseSource(arg.split("=")[1]));
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (selected.length) options.sources = new Set(selected);
  options.maxAgeHours = validateDiscoveryMaxAgeHours(options.maxAgeHours);
  return options;
}

function parseSource(value: string | undefined): SourceName {
  if (!value || !ALL_SOURCES.includes(value as SourceName)) {
    throw new Error(`Unknown source: ${value ?? "(missing)"}`);
  }
  return value as SourceName;
}

async function fetchResponse(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.7" },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status} ${response.statusText}`);
  return response;
}

async function fetchText(url: string): Promise<string> {
  return (await fetchResponse(url)).text();
}

function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value.trim());
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanDescription(value: string): string {
  if (!value) return "";
  const text = cleanText(value.includes("<") ? cheerio.load(value).text() : value);
  return text.replace(/\s+The post .+? appeared first on .+?\.?$/i, "").trim();
}

function firstDirectText($node: cheerio.Cheerio<cheerio.Element>, selector: string): string {
  return cleanText($node.find(selector).first().text());
}

function parseRss(
  xml: string,
  sourceName: SourceName,
  discoveredFrom: string,
  requireRoblox: boolean
): Candidate[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  return $("item")
    .toArray()
    .flatMap((element) => {
      const item = $(element);
      const title = firstDirectText(item, "title");
      const sourceUrl = normalizeUrl(firstDirectText(item, "link"));
      const description = cleanDescription(firstDirectText(item, "description"));
      const categories = item
        .find("category")
        .toArray()
        .map((category) => cleanText($(category).text()))
        .filter(Boolean);
      const relevanceText = [title, description, ...categories].join(" ");
      if (!title || !sourceUrl || (requireRoblox && !/\broblox\b/i.test(relevanceText))) return [];
      return [{
        sourceName,
        sourceUrl,
        title,
        publishedAt: toIsoDate(firstDirectText(item, "pubDate") || firstDirectText(item, "dc\\:date")),
        description: description || undefined,
        categories,
        discoveredFrom
      }];
    });
}

async function collectRss(
  sourceName: SourceName,
  feedUrl: string,
  requireRoblox = false
): Promise<Candidate[]> {
  return parseRss(await fetchText(feedUrl), sourceName, feedUrl, requireRoblox);
}

function dateFromElement($element: cheerio.Cheerio<cheerio.Element>): string | null {
  const dateValue =
    $element.find("time[datetime]").first().attr("datetime") ??
    $element.find("[datetime]").first().attr("datetime") ??
    $element.find("time").first().text();
  return toIsoDate(dateValue);
}

async function collectProGameGuides(): Promise<Candidate[]> {
  const discoveredFrom = "https://progameguides.com/roblox/";
  const $ = cheerio.load(await fetchText(discoveredFrom));
  return $("article.m-btm-half")
    .toArray()
    .flatMap((element) => {
      const article = $(element);
      const anchor = article.find("h2.entry-title a, h3.entry-title a, .entry-title a").first();
      const title = cleanText(anchor.text());
      const sourceUrl = normalizeUrl(anchor.attr("href") ?? "");
      if (!title || !sourceUrl) return [];
      return [{ sourceName: "pro-game-guides", sourceUrl, title, publishedAt: dateFromElement(article), discoveredFrom }];
    });
}

async function collectBeebom(): Promise<Candidate[]> {
  const discoveredFrom = "https://beebom.com/tag/roblox/";
  const $ = cheerio.load(await fetchText(discoveredFrom));
  return $("article[id^='article-card-post-']")
    .toArray()
    .flatMap((element) => {
      const article = $(element);
      const anchor = article.find("h2 a, h3 a, a[href*='beebom.com/']").first();
      const title = cleanText(anchor.text()) || cleanText(anchor.attr("aria-label") ?? "");
      const sourceUrl = normalizeUrl(anchor.attr("href") ?? "");
      if (!title || !sourceUrl) return [];
      return [{ sourceName: "beebom", sourceUrl, title, publishedAt: dateFromElement(article), discoveredFrom }];
    });
}

async function collectSportskeedaLanding(): Promise<Candidate[]> {
  const discoveredFrom = "https://www.sportskeeda.com/roblox-news";
  const $ = cheerio.load(await fetchText(discoveredFrom));
  const candidates = $(".fi--article a.hidden-item-cta, .fi--article a[href^='/roblox-news/']")
    .toArray()
    .flatMap((element) => {
      const anchor = $(element);
      const title = cleanText(anchor.attr("title") || anchor.attr("aria-label") || anchor.text());
      const href = anchor.attr("href");
      const sourceUrl = href ? normalizeUrl(new URL(href, discoveredFrom).toString()) : null;
      if (!title || !sourceUrl || sourceUrl === normalizeUrl(discoveredFrom)) return [];
      return [{ sourceName: "sportskeeda" as const, sourceUrl, title, publishedAt: null, discoveredFrom }];
    });
  const unique = [...new Map(candidates.map((candidate) => [candidate.sourceUrl, candidate])).values()].slice(0, 30);
  const codes = unique.filter(isCodesArticle);
  const articles = unique.filter((candidate) => !isCodesArticle(candidate));
  return [...await enrichMissingDates(articles), ...codes];
}

async function collectGameRantLanding(): Promise<Candidate[]> {
  const discoveredFrom = "https://gamerant.com/tag/roblox/";
  const $ = cheerio.load(await fetchText(discoveredFrom));
  const candidates = $(".display-card.article h5.display-card-title a")
    .toArray()
    .flatMap((element) => {
      const anchor = $(element);
      const title = cleanText(anchor.attr("title") || anchor.text());
      const href = anchor.attr("href");
      const sourceUrl = href ? normalizeUrl(new URL(href, discoveredFrom).toString()) : null;
      if (!title || !sourceUrl) return [];
      return [{ sourceName: "game-rant" as const, sourceUrl, title, publishedAt: null, discoveredFrom }];
    })
    .slice(0, 40);
  const codes = candidates.filter(isCodesArticle);
  const articles = candidates.filter((candidate) => !isCodesArticle(candidate));
  return [...await enrichMissingDates(articles), ...codes];
}

type ArticleMetadata = { title: string | null; publishedAt: string | null; description: string | null };

function visitJsonLd(value: unknown, dates: string[], titles: string[]) {
  if (Array.isArray(value)) {
    for (const child of value) visitJsonLd(child, dates, titles);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  for (const key of ["datePublished", "dateModified", "uploadDate"]) {
    if (typeof record[key] === "string") dates.push(record[key]);
  }
  for (const key of ["headline", "name"]) {
    if (typeof record[key] === "string") titles.push(record[key]);
  }
  if (record["@graph"]) visitJsonLd(record["@graph"], dates, titles);
}

async function fetchArticleMetadata(url: string): Promise<ArticleMetadata> {
  const $ = cheerio.load(await fetchText(url));
  const dates: string[] = [];
  const titles: string[] = [];
  $("script[type='application/ld+json']").each((_index, element) => {
    try {
      visitJsonLd(JSON.parse($(element).text()), dates, titles);
    } catch {
      // A malformed JSON-LD block should not discard otherwise usable page metadata.
    }
  });
  const title = cleanText(
    $("meta[property='og:title']").attr("content") ?? titles[0] ?? $("h1").first().text() ?? $("title").text()
  );
  const publishedAt = toIsoDate(
    $("meta[property='article:published_time']").attr("content") ??
      $("meta[name='date']").attr("content") ??
      $("time[datetime]").first().attr("datetime") ??
      dates[0]
  );
  const description = cleanText(
    $("meta[name='description']").attr("content") ?? $("meta[property='og:description']").attr("content") ?? ""
  );
  return { title: title || null, publishedAt, description: description || null };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await mapper(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

async function enrichMissingDates(candidates: Candidate[]): Promise<Candidate[]> {
  return mapWithConcurrency(candidates, 5, async (candidate) => {
    if (candidate.publishedAt) return candidate;
    try {
      const metadata = await fetchArticleMetadata(candidate.sourceUrl);
      return {
        ...candidate,
        title: candidate.title || metadata.title || "",
        publishedAt: metadata.publishedAt,
        description: candidate.description ?? metadata.description ?? undefined
      };
    } catch {
      return candidate;
    }
  });
}

async function collectGame8(maxAgeHours: number): Promise<Candidate[]> {
  const discoveredFrom = "https://game8.co/sitemaps/game_1486.xml.gz";
  const response = await fetchResponse(discoveredFrom);
  let bytes = Buffer.from(await response.arrayBuffer());
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes);
  const $ = cheerio.load(bytes.toString("utf8"), { xmlMode: true });
  const sitemapRows = $("url")
    .toArray()
    .flatMap((element) => {
      const row = $(element);
      const sourceUrl = normalizeUrl(firstDirectText(row, "loc"));
      if (!sourceUrl || !sourceUrl.includes("game8.co/games/Roblox/archives/")) return [];
      return [{ sourceUrl, lastModified: toIsoDate(firstDirectText(row, "lastmod")) }];
    })
    .sort((a, b) => (b.lastModified ?? "").localeCompare(a.lastModified ?? ""))
    .slice(0, 100);

  return mapWithConcurrency(sitemapRows, 5, async (row) => {
    if (!row.lastModified || Date.parse(row.lastModified) < Date.now() - maxAgeHours * 60 * 60 * 1000) {
      return {
        sourceName: "game8" as const,
        sourceUrl: row.sourceUrl,
        title: "",
        publishedAt: row.lastModified,
        discoveredFrom
      };
    }
    try {
      const metadata = await fetchArticleMetadata(row.sourceUrl);
      return {
        sourceName: "game8" as const,
        sourceUrl: row.sourceUrl,
        title: metadata.title ?? "",
        publishedAt: row.lastModified ?? metadata.publishedAt,
        description: metadata.description ?? undefined,
        discoveredFrom
      };
    } catch {
      return {
        sourceName: "game8" as const,
        sourceUrl: row.sourceUrl,
        title: "",
        publishedAt: row.lastModified,
        discoveredFrom
      };
    }
  });
}

function isCodesArticle(candidate: Candidate): boolean {
  const text = `${candidate.title} ${new URL(candidate.sourceUrl).pathname.replace(/[-_/]+/g, " ")}`;
  const withoutTechnicalErrors = text.replace(/\berror codes?\b/gi, "");
  return /\bcodes\b|\b(?:promo|redeem|working|active|expired)\s+code\b/i.test(withoutTechnicalErrors);
}

async function collectSource(sourceName: SourceName, maxAgeHours: number): Promise<Candidate[]> {
  switch (sourceName) {
    case "pro-game-guides":
      return enrichMissingDates(await collectProGameGuides());
    case "destructoid":
      return collectRss(sourceName, "https://www.destructoid.com/category/roblox/feed/");
    case "beebom":
      return enrichMissingDates(await collectBeebom());
    case "sportskeeda":
      return collectSportskeedaLanding();
    case "game8":
      return collectGame8(maxAgeHours);
    case "game-rant":
      return collectGameRantLanding();
    case "techwiser":
      return collectRss(sourceName, "https://techwiser.com/tag/roblox/feed/");
  }
}

async function insertCandidates(candidates: Candidate[]) {
  const dev = resolveArticleDevCredentials();
  const supabase = createClient(dev.url, dev.serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  let inserted = 0;
  let duplicates = 0;
  const bySource = new Map<SourceName, { inserted: number; duplicates: number }>();

  for (const candidate of candidates) {
    const { error } = await supabase.from("article_discovery_candidates").insert({
      source_name: SOURCE_LABELS[candidate.sourceName],
      source_url: candidate.sourceUrl,
      source_title: candidate.title,
      source_published_at: candidate.publishedAt,
      source_discovered_at: new Date().toISOString(),
      source_description: candidate.description?.slice(0, 1200) ?? null,
      source_categories: candidate.categories ?? [],
      discovered_from: candidate.discoveredFrom,
      curation_status: "pending"
    });
    if (!error) {
      inserted += 1;
      const source = bySource.get(candidate.sourceName) ?? { inserted: 0, duplicates: 0 };
      source.inserted += 1;
      bySource.set(candidate.sourceName, source);
    } else if (error.code === "23505") {
      duplicates += 1;
      const source = bySource.get(candidate.sourceName) ?? { inserted: 0, duplicates: 0 };
      source.duplicates += 1;
      bySource.set(candidate.sourceName, source);
    } else {
      throw new Error(`Could not stage ${candidate.sourceUrl}: ${error.message}`);
    }
  }
  return { inserted, duplicates, bySource };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.apply) resolveArticleDevCredentials();

  console.log(`Discovery window: ${options.maxAgeHours} hours; per-source cap: ${options.perSource}.`);
  const sourceNames = [...options.sources];
  const settled = await Promise.allSettled(
    sourceNames.map(async (sourceName) => {
      const filtered = filterRecentDiscoveryCandidates(await collectSource(sourceName, options.maxAgeHours), {
        maxAgeHours: options.maxAgeHours,
        limit: options.perSource,
        exclude: isCodesArticle
      });
      return {
      sourceName,
        ...filtered
      };
    })
  );
  const candidates: Candidate[] = [];
  const errors: string[] = [];
  const funnelRows: Array<DiscoveryFunnelStats & { source: string }> = [];
  for (let index = 0; index < settled.length; index += 1) {
    const result = settled[index];
    if (result.status === "rejected") {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      errors.push(`${SOURCE_LABELS[sourceNames[index]]}: ${message}`);
      continue;
    }
    candidates.push(...result.value.candidates);
    funnelRows.push({ source: SOURCE_LABELS[result.value.sourceName], ...result.value.stats });
  }
  console.table(funnelRows);
  if (errors.length) console.warn(`Source errors (${errors.length}):\n- ${errors.join("\n- ")}`);
  if (!settled.some((result) => result.status === "fulfilled")) throw new Error("Every article source failed.");

  const uniqueCandidates = [...new Map(candidates.map((candidate) => [candidate.sourceUrl, candidate])).values()];
  console.table(
    uniqueCandidates.map((candidate) => ({
      source: SOURCE_LABELS[candidate.sourceName],
      published: candidate.publishedAt,
      title: candidate.title,
      url: candidate.sourceUrl
    }))
  );

  if (!options.apply) {
    console.log(`Dry run: ${uniqueCandidates.length} candidate(s). Pass --apply to stage them for Groq curation.`);
    return;
  }
  const result = await insertCandidates(uniqueCandidates);
  console.log(`Discovery staging updated: ${result.inserted} inserted, ${result.duplicates} already discovered.`);
  console.table(
    [...result.bySource].map(([sourceName, counts]) => ({ source: SOURCE_LABELS[sourceName], ...counts }))
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
