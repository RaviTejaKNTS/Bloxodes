import * as cheerio from "cheerio";
import type { AnyNode } from "cheerio";

export type SocialLinkType = "roblox" | "community" | "discord" | "twitter" | "youtube";

export type SocialLinks = Partial<Record<SocialLinkType, string>>;

export type SocialLinkDetail = {
  provider: Provider;
  sourceUrl: string;
  value: string;
};

export type Provider = "beebom" | "robloxden" | "destructoid" | "progameguides";

type ProviderResult = {
  provider: Provider;
  sourceUrl: string;
  links: SocialLinks;
};

const PROVIDER_PRIORITY: Provider[] = ["beebom", "robloxden", "destructoid", "progameguides"];
const PROVIDER_RANK: Record<Provider, number> = {
  beebom: 0,
  robloxden: 1,
  destructoid: 2,
  progameguides: 3
};

const USER_AGENT = "Mozilla/5.0 (compatible; RobloxCodesSocialBot/1.0)";
const TWITTER_HANDLE_BLOCKLIST = new Set([
  "ishanxxi",
  "sanmaysays",
  "beebom",
  "beebomco",
  "destructoid",
  "dtoid",
  "pggroblox",
  "progamerguides",
  "progameguides"
]);
const YOUTUBE_PATH_BLOCKLIST = new Set([
  "@dtoid",
  "@beebomco",
  "@progameguides",
  "beebomco",
  "channel/uc9lhxd5ubbsa0hfifyumaa",
  "channel/uc9lhxd5ubbsao0hfifyumaa"
]);
const SITE_SOCIAL_CONTEXT_PATTERN =
  /\b(beebom|destructoid|dtoid|pgg\s*roblox|pro\s*game\s*guides|progamerguides)\b/i;
const EXCLUDED_CONTAINER_SELECTOR =
  "aside, header, footer, nav, .author, .author-box, .author-card, .post-author, .byline, .post-share, .social-share, .article-share, .beebom-social-share, .social-wrap, .sidebar, .related-articles, .toast, .network, .site-footer";

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "mkt_tok",
  "utm_name",
  "utm_reader",
  "utm_place",
  "utm_social",
  "utm_social-type",
  "ref_src",
  "fbclid",
  "gclid",
  "twclid"
];

function stripTrackingParams(url: URL) {
  for (const key of TRACKING_PARAMS) {
    url.searchParams.delete(key);
  }
}

function normalizeAbsoluteUrl(raw: string | undefined, baseUrl: string): URL | null {
  if (!raw) return null;
  try {
    const resolved = new URL(raw.trim(), baseUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }
    if (resolved.protocol === "http:") {
      resolved.protocol = "https:";
    }
    resolved.hash = "";
    stripTrackingParams(resolved);
    return resolved;
  } catch {
    return null;
  }
}

function detectSocialProvider(rawUrl: string): Provider | null {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host.endsWith("beebom.com")) return "beebom";
    if (host.endsWith("robloxden.com")) return "robloxden";
    if (host.endsWith("destructoid.com")) return "destructoid";
    if (host.endsWith("progameguides.com")) return "progameguides";
  } catch {
    return null;
  }
  return null;
}

function isRobloxExperiencePath(pathname: string, searchParams: URLSearchParams): boolean {
  if (pathname.includes("/games/") || pathname.includes("/game/")) return true;
  if (searchParams.has("placeId") || searchParams.has("universeId")) return true;
  return false;
}

function isRobloxCommunityPath(pathname: string): boolean {
  return pathname.includes("/communities/") || pathname.includes("/groups/");
}

function classifyLink(url: URL): SocialLinkType | null {
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  const pathname = url.pathname.toLowerCase();

  if (host.endsWith("roblox.com")) {
    if (isRobloxExperiencePath(pathname, url.searchParams)) {
      return "roblox";
    }
    if (isRobloxCommunityPath(pathname)) {
      return "community";
    }
    return null;
  }

  if (host === "discord.gg" || host.endsWith("discord.com")) {
    return "discord";
  }

  if (host === "x.com" || host.endsWith("twitter.com")) {
    return "twitter";
  }

  if (host.endsWith("youtube.com") || host === "youtu.be" || host === "m.youtube.com") {
    return "youtube";
  }

  return null;
}

async function fetchHtml(url: string): Promise<cheerio.CheerioAPI> {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const html = await response.text();
  return cheerio.load(html);
}

function normalizedTwitterHandle(url: URL): string | null {
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "twitter.com" && host !== "x.com") {
    return null;
  }
  if (url.pathname.startsWith("/intent/") || url.pathname.startsWith("/share")) {
    return "__blocked_intent__";
  }
  const [handle] = url.pathname.split("/").filter(Boolean);
  return handle ? handle.toLowerCase() : null;
}

function normalizedYoutubePath(url: URL): string | null {
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (!host.endsWith("youtube.com") && host !== "youtu.be" && host !== "m.youtube.com") {
    return null;
  }
  return url.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
}

function isSiteOwnedSocialLink(url: URL, label: string, context: string): boolean {
  const twitterHandle = normalizedTwitterHandle(url);
  if (twitterHandle === "__blocked_intent__") return true;
  if (twitterHandle && TWITTER_HANDLE_BLOCKLIST.has(twitterHandle)) return true;

  const youtubePath = normalizedYoutubePath(url);
  if (youtubePath && YOUTUBE_PATH_BLOCKLIST.has(youtubePath)) return true;

  const text = `${label} ${context}`;
  return SITE_SOCIAL_CONTEXT_PATTERN.test(text) && !/\b(roblox group|discord server|developer|creator)\b/i.test(text);
}

function extractLinksFromAnchors(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<AnyNode>,
  baseUrl: string
): SocialLinks {
  const result: SocialLinks = {};
  root.find("a[href]").each((_, element) => {
    const anchor = $(element);
    if (anchor.closest(EXCLUDED_CONTAINER_SELECTOR).length > 0) {
      return;
    }
    const href = anchor.attr("href");
    const normalized = normalizeAbsoluteUrl(href, baseUrl);
    if (!normalized) return;
    const label = anchor.text().replace(/\s+/g, " ").trim();
    const context = anchor.parent().text().replace(/\s+/g, " ").trim();
    if (isSiteOwnedSocialLink(normalized, label, context)) return;
    const type = classifyLink(normalized);
    if (!type) return;
    if (!result[type]) {
      result[type] = normalized.toString();
    }
  });
  return result;
}

function mergeMissingLinks(primary: SocialLinks, fallback: SocialLinks): SocialLinks {
  const merged: SocialLinks = { ...primary };
  for (const [type, value] of Object.entries(fallback) as [SocialLinkType, string][]) {
    if (value && !merged[type]) {
      merged[type] = value;
    }
  }
  return merged;
}

function isRobloxdenGameFooterText(value: string): boolean {
  return /\bon\s+roblox\b/i.test(value);
}

function extractRobloxdenPageLinks($: cheerio.CheerioAPI, baseUrl: string): SocialLinks {
  const result: SocialLinks = {};
  $("a[href]").each((_, element) => {
    const anchor = $(element);
    const href = anchor.attr("href");
    const normalized = normalizeAbsoluteUrl(href, baseUrl);
    if (!normalized) return;
    const label = anchor.text().replace(/\s+/g, " ").trim();
    const context = anchor.parent().text().replace(/\s+/g, " ").trim();
    if (isSiteOwnedSocialLink(normalized, label, context)) return;

    const type = classifyLink(normalized);
    if (!type || result[type]) return;

    if (type === "roblox") {
      const label = anchor.text().replace(/\s+/g, " ").trim();
      if (!isRobloxdenGameFooterText(label)) return;
    }

    result[type] = normalized.toString();
  });
  return result;
}

function selectArticleContainer(
  $: cheerio.CheerioAPI,
  selectors: string[]
): cheerio.Cheerio<AnyNode> | null {
  for (const selector of selectors) {
    const candidate = $(selector).first();
    if (candidate.length) {
      return candidate;
    }
  }
  return null;
}

async function scrapeRobloxdenLinks(url: string): Promise<SocialLinks> {
  const $ = await fetchHtml(url);
  const container =
    selectArticleContainer($, [
      ".section__main article",
      ".section__main .section__body",
      ".article__content",
      ".section__body"
    ]) ?? null;
  const contentLinks = container ? extractLinksFromAnchors($, container, url) : {};
  const pageLinks = extractRobloxdenPageLinks($, url);
  return mergeMissingLinks(contentLinks, pageLinks);
}

async function scrapeBeebomLinks(url: string): Promise<SocialLinks> {
  const $ = await fetchHtml(url);
  const container =
    selectArticleContainer($, [
      ".beebom-single-content.entry-content.highlight",
      ".entry-content",
      "article .content-area"
    ]) ?? null;
  if (!container) {
    return {};
  }
  return extractLinksFromAnchors($, container, url);
}

async function scrapeDestructoidLinks(url: string): Promise<SocialLinks> {
  const $ = await fetchHtml(url);
  const container =
    selectArticleContainer($, [
      ".wp-block-gamurs-article-content",
      ".post-content",
      "article .wp-block-post-content",
      ".article__body"
    ]) ?? null;
  if (!container) {
    return {};
  }
  return extractLinksFromAnchors($, container, url);
}

async function scrapeProGameGuidesLinks(url: string): Promise<SocialLinks> {
  const $ = await fetchHtml(url);
  const container =
    selectArticleContainer($, [
      ".entry-content.wp-block-gamurs-article-content",
      ".wp-block-gamurs-article-content",
      "article .entry-content"
    ]) ?? null;
  if (!container) {
    return {};
  }
  return extractLinksFromAnchors($, container, url);
}

export async function scrapeSocialLinksFromUrl(url: string): Promise<ProviderResult | null> {
  const provider = detectSocialProvider(url);
  if (!provider) {
    return null;
  }

  let links: SocialLinks = {};
  switch (provider) {
    case "beebom":
      links = await scrapeBeebomLinks(url);
      break;
    case "robloxden":
      links = await scrapeRobloxdenLinks(url);
      break;
    case "destructoid":
      links = await scrapeDestructoidLinks(url);
      break;
    case "progameguides":
      links = await scrapeProGameGuidesLinks(url);
      break;
    default:
      break;
  }

  return { provider, sourceUrl: url, links };
}

export async function scrapeSocialLinksFromSources(
  urls: string[]
): Promise<{ links: SocialLinks; details: Partial<Record<SocialLinkType, SocialLinkDetail>>; errors: string[] }> {
  const unique = Array.from(
    new Set(
      urls
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0)
    )
  );

  const candidates: Array<ProviderResult & { order: number }> = [];
  const errors: string[] = [];

  for (const [index, rawUrl] of unique.entries()) {
    try {
      const result = await scrapeSocialLinksFromUrl(rawUrl);
      if (result) {
        candidates.push({ ...result, order: index });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
    }
  }

  if (candidates.length === 0) {
    return { links: {}, details: {}, errors };
  }

  candidates.sort((a, b) => {
    const priorityDiff = PROVIDER_RANK[a.provider] - PROVIDER_RANK[b.provider];
    if (priorityDiff !== 0) return priorityDiff;
    return a.order - b.order;
  });

  const merged: SocialLinks = {};
  const details: Partial<Record<SocialLinkType, SocialLinkDetail>> = {};

  for (const candidate of candidates) {
    for (const [type, value] of Object.entries(candidate.links) as [SocialLinkType, string][]) {
      if (value && !merged[type]) {
        merged[type] = value;
        details[type] = {
          provider: candidate.provider,
          sourceUrl: candidate.sourceUrl,
          value
        };
      }
    }
  }

  return { links: merged, details, errors };
}

export const SOCIAL_LINK_FIELDS: SocialLinkType[] = ["roblox", "community", "discord", "twitter", "youtube"];

export function providerPriorityList(): Provider[] {
  return [...PROVIDER_PRIORITY];
}
