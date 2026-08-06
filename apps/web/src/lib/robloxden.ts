import * as cheerio from "cheerio";
import type { ScrapedCode, ScrapeResult } from "./scraper-types";

const USER_AGENT = "Mozilla/5.0 (compatible; RobloxCodesBot/1.0)";
const FETCH_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 1_500;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000;
  }

  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return null;
}

async function fetchRobloxdenHtml(url: string): Promise<string> {
  let lastStatus: number | null = null;

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
    });

    if (res.ok) return res.text();

    lastStatus = res.status;
    const shouldRetry = RETRYABLE_STATUS_CODES.has(res.status) && attempt < FETCH_ATTEMPTS;
    if (!shouldRetry) {
      throw new Error(`Failed to fetch ${url}: ${res.status}`);
    }

    const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));
    const fallbackDelayMs = BASE_RETRY_DELAY_MS * attempt;
    await sleep(Math.max(retryAfterMs ?? 0, fallbackDelayMs));
  }

  throw new Error(`Failed to fetch ${url}: ${lastStatus ?? "unknown status"}`);
}

function isAdRow($item: cheerio.Cheerio<cheerio.Element>, $: cheerio.CheerioAPI): boolean {
  const adClassSelectors = [".table__ad-placement-row", ".codes-list__ad", ".codes-list__promo"];
  for (const sel of adClassSelectors) {
    if ($item.is(sel) || $item.find(sel).length > 0) {
      return true;
    }
  }

  const adAttributes = ["data-native-campaign", "data-native-widget", "data-native-ad", "data-ad-slot"];
  for (const attr of adAttributes) {
    if ($item.attr(attr) != null) return true;
    if ($item.find(`[${attr}]`).length > 0) return true;
  }

  return false;
}

function extractCode($item: cheerio.Cheerio<cheerio.Element>, $: cheerio.CheerioAPI): string | null {
  // Primary: contenteditable container
  const primary = $item
    .find(".codes-list__copy-container [contenteditable], .copy-button [contenteditable]")
    .first()
    .text()
    .trim();
  if (primary) return primary;

  // Fallback 1: data-search-terms (JSON array)
  const dataTerms = $item.attr("data-search-terms");
  if (dataTerms) {
    try {
      const arr = JSON.parse(dataTerms);
      if (Array.isArray(arr) && arr[0]) return String(arr[0]).trim();
    } catch {}
  }

  // Fallback 2: copy controls. RobloxDen has used both buttons and divs.
  const copyControl = $item.find("[data-copy-text], [data-copy]").first();
  const copiedCode = copyControl.attr("data-copy-text") || copyControl.attr("data-copy");
  if (copiedCode) return String(copiedCode).trim();

  // Fallback 3: any [data-code], [data-clipboard-text]
  const any =
    $item.find("[data-code],[data-clipboard-text]").attr("data-code") ||
    $item.find("[data-clipboard-text]").attr("data-clipboard-text");
  if (any) return String(any).trim();

  return null;
}

function extractStatus(
  $item: cheerio.Cheerio<cheerio.Element>,
  $: cheerio.CheerioAPI,
): "active" | "expired" | "check" {
  // Explicit expired markers
  if ($item.attr("data-expired") === "true") return "expired";
  if ($item.find('[data-expired="true"]').length > 0) return "expired";
  if ($item.find(".badge--inactive, .badge--expired").length > 0) return "expired";

  // Robloxden uses a "Check" badge for codes that may be inactive
  if ($item.find(".badge--check").length > 0) return "check";

  // If there is an "active" badge or class
  if ($item.find(".badge--active").length > 0) return "active";

  // Default assume active; if we cannot confirm, mark "check"
  const txt = $item.text().toLowerCase();
  if (/\b(expired|inactive)\b/.test(txt)) return "expired";
  if (/\b(check)\b/.test(txt)) return "check";

  return "active";
}

function sanitizeRewardText(text: string): string {
  let t = text.replace(/\s+/g, " ").trim();
  t = t.replace(/^Copy\s*/i, "");
  t = t.replace(/\s*(Active|Expired|Check)\s*$/i, "");
  t = t.replace(/this code credits your account with/i, "This code gives you");
  return t.trim();
}

function extractRewards($item: cheerio.Cheerio<cheerio.Element>, $: cheerio.CheerioAPI): string | undefined {
  // Try common containers
  const candidates = [
    ".search-term",
    ".codes-list__description",
    ".codes-list__rewards",
    ".codes-list__reward",
    ".codes-list__desc",
    ".codes-list__text",
  ];
  for (const sel of candidates) {
    const node = $item.find(sel).first();
    const raw = node.text();
    const cleaned = sanitizeRewardText(raw);
    if (cleaned) return cleaned;
  }
  // Fallback: entire item text minus code and button labels
  let text = $item.text();
  const code = extractCode($item, $);
  if (code) text = text.replace(code, "");
  const cleaned = sanitizeRewardText(text);
  return cleaned || undefined;
}

function parseLevelValue(raw?: string | null): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d{1,4})/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function extractLevel(
  $item: cheerio.Cheerio<cheerio.Element>,
  $: cheerio.CheerioAPI,
  rewardsText?: string,
): number | null {
  const attrCandidates = [
    "data-level",
    "data-level-required",
    "data-level_requirement",
    "data-required-level",
    "data-levelreq",
  ];
  for (const attr of attrCandidates) {
    const direct = parseLevelValue($item.attr(attr) ?? undefined);
    if (direct != null) return direct;
    const nestedAttr = $item.find(`[${attr}]`).first().attr(attr);
    const nestedParsed = parseLevelValue(nestedAttr ?? undefined);
    if (nestedParsed != null) return nestedParsed;
  }

  const selectors = [
    ".codes-list__level",
    ".codes-list__meta",
    ".codes-list__requirement",
    ".codes-list__details",
    ".codes-list__info",
    ".codes-list__footer",
    ".badge--level",
    ".badge--req",
  ];
  for (const sel of selectors) {
    const text = $item.find(sel).first().text();
    if (text && /(?:level|lvl)/i.test(text)) {
      const parsed = parseLevelValue(text);
      if (parsed != null) return parsed;
    }
  }

  const anyLevel = $item
    .find('*')
    .filter((_, el) => {
      const text = $(el).text();
      return /(?:level|lvl)/i.test(text) && /\d/.test(text);
    })
    .first()
    .text();
  const parsedAny = parseLevelValue(anyLevel || undefined);
  if (parsedAny != null) return parsedAny;

  if (rewardsText) {
    const rewardMatch = rewardsText.match(/(?:level|lvl)\s*[:\-]?\s*(\d{1,4})/i);
    if (rewardMatch) return Number(rewardMatch[1]);
  }

  const fallback = $item.text().match(/(?:level|lvl)\s*[:\-]?\s*(\d{1,4})/i);
  return fallback ? Number(fallback[1]) : null;
}

function extractIsNew($item: cheerio.Cheerio<cheerio.Element>, $: cheerio.CheerioAPI): boolean {
  return $item.find(".badge--new, .badge--fresh, .badge--just-in, .codes-list__new-badge").length > 0;
}

export async function scrapeRobloxdenPage(url: string): Promise<ScrapeResult> {
  const html = await fetchRobloxdenHtml(url);
  return parseRobloxdenHtml(html);
}

export function parseRobloxdenHtml(html: string): ScrapeResult {
  const $ = cheerio.load(html);

  // RobloxDen has used both masonry cards and table rows for game codes.
  const items = $(
    "#masonry .codes-list__item, .codes-list__item, tr[data-search='game-codes']"
  );
  const activeCodes: ScrapedCode[] = [];
  const expiredCodes: { code: string; provider: "robloxden" }[] = [];

  items.each((_, el) => {
    const $item = $(el);
    if (isAdRow($item, $)) return;
    const code = extractCode($item, $);
    if (!code) return;

    const status = extractStatus($item, $);
    if (status === "expired") {
      expiredCodes.push({ code, provider: "robloxden" });
      return;
    }

    const rewards = extractRewards($item, $);
    const level = extractLevel($item, $, rewards);
    const isNew = extractIsNew($item, $);

    activeCodes.push({
      code,
      status,
      rewardsText: rewards,
      levelRequirement: level,
      isNew,
      provider: "robloxden",
    });
  });

  return {
    codes: activeCodes,
    expiredCodes,
  };
}
