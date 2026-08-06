import * as cheerio from "cheerio";
import type { ScrapeResult, ScrapedCode } from "./scraper-types";
import { stripTrailingCopyButtonText } from "./code-normalization";

const USER_AGENT = "Mozilla/5.0 (compatible; RobloxCodesBot/1.0)";
const LIST_SEPARATOR_REGEX = /\s*:\s*|\s*[–—]\s*|(?:\s+-\s*|\s*-\s+)/;
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";
const CODES_CONTAINER_SELECTOR = "ul, ol, table";
const ACTIVE_CODES_HEADING_REGEX =
  /(?:\b(?:active|working)\b.*\bcodes?\b|\bcodes?\b.*\b(?:active|working)\b)/i;
const TROUBLESHOOTING_HEADING_REGEX =
  /\b(?:not\s+working|not\s+work|why\s+(?:are|is)\s+my|how\s+to\s+fix|troubleshoot)\b/i;
const NON_ACTIVE_SECTION_REGEX = /\b(?:expired|inactive|redeem|how to|get more|where to find)\b/i;
const REDEMPTION_INSTRUCTION_REGEXES = [
  /^go(?:to)?(?:the)?shop$/i,
  /^select(?:the)?redeem(?:option|button)?$/i,
  /^enter(?:the)?code(?:and)?redeem$/i,
  /^click(?:the|on|a|an).*(?:arrow|button|menu|screen|server)$/i,
  /^run(?:the)?.*experience(?:onroblox)?$/i,
];
const NO_CODES_STATUS_REGEX =
  /^(?:thereare)?(?:currently)?no(?:working|active|new|valid|available|redeemable)*codes?(?:for.*)?$/i;

function normalizeCode(raw: string): string | null {
  if (!raw) return null;
  let code = raw.replace(/[`"'“”‘’]/g, "").trim();
  code = code.replace(/^code[:\s-]*/i, "").trim();

  // 🧹 Remove anything inside parentheses
  code = code.replace(/\(.*?\)/g, "").trim();

  if (!code) return null;

  const spacedParts = code.split(/\s+/).filter(Boolean);
  const hasSingleLetterSegments =
    spacedParts.length > 1 && spacedParts.every((segment) => segment.length === 1);
  if (hasSingleLetterSegments) return null;

  return code.replace(/\s+/g, "");
}

export function isLikelyRedemptionInstruction(raw: string): boolean {
  const compact = raw.replace(/[^a-z0-9]/gi, "");
  return REDEMPTION_INSTRUCTION_REGEXES.some((pattern) => pattern.test(compact));
}

export function isLikelyNonCodeText(raw: string): boolean {
  const compact = raw.replace(/[^a-z0-9]/gi, "");
  return isLikelyRedemptionInstruction(raw) || NO_CODES_STATUS_REGEX.test(compact);
}

const NEW_REGEX = /\(\s*new\s*(?:code)?\s*\)/i;

function stripNewFlag(value: string): { cleaned: string; isNew: boolean } {
  const hasNew = NEW_REGEX.test(value);
  const cleaned = value.replace(NEW_REGEX, "").trim();
  return { cleaned, isNew: hasNew };
}

const COPY_CONTROL_SELECTOR =
  ".copy-code-list__copy-button, button[data-copy-text], button[data-copy]";

function textWithoutCopyControls(
  $: cheerio.CheerioAPI,
  node: cheerio.Cheerio<cheerio.Element>
): string {
  const clone = node.clone();
  clone.find(COPY_CONTROL_SELECTOR).remove();
  return clone.text().replace(/\s+/g, " ").trim();
}

function extractCopyCode(node: cheerio.Cheerio<cheerio.Element>): string | null {
  const copyControl = node.find("[data-copy-text], [data-copy]").first();
  const value = copyControl.attr("data-copy-text") || copyControl.attr("data-copy");
  return value?.trim() || null;
}

function sanitizeRewardText(value: string): string {
  return (stripTrailingCopyButtonText(value) ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Finds the correct code list or table
 * - Looks only inside .beebom-single-content.entry-content.highlight
 * - Skips divider lists and menus
 * - No regex restriction for code patterns (Beebom may list codes without rewards)
 */
function findContainerBeforeNextHeading(
  $: cheerio.CheerioAPI,
  heading: cheerio.Cheerio<cheerio.Element>
): cheerio.Cheerio<cheerio.Element> | null {
  const isEligible = (el: cheerio.Element) => {
    const container = $(el);
    return (
      !container.hasClass("is-style-inline-divider-list") &&
      !container.hasClass("menu") &&
      container.attr("id") !== "primary-menu" &&
      Boolean(container.text().trim())
    );
  };
  let pointer = heading.next();

  while (pointer.length) {
    if (pointer.is(HEADING_SELECTOR)) return null;

    if (pointer.is(CODES_CONTAINER_SELECTOR) && isEligible(pointer.get(0)!)) {
      return pointer;
    }

    const nested = pointer.find(CODES_CONTAINER_SELECTOR).filter((_, el) => isEligible(el)).first();
    if (nested.length) return nested;

    pointer = pointer.next();
  }

  return null;
}

function findCodesContainer($: cheerio.CheerioAPI): cheerio.Cheerio<cheerio.Element> | null {
  const content = $(".beebom-single-content.entry-content.highlight");
  if (!content.length) return null;

  const activeHeadings = content.find(HEADING_SELECTOR).filter((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    return (
      ACTIVE_CODES_HEADING_REGEX.test(text) &&
      !NON_ACTIVE_SECTION_REGEX.test(text) &&
      !TROUBLESHOOTING_HEADING_REGEX.test(text)
    );
  });

  for (const headingEl of activeHeadings.toArray()) {
    const container = findContainerBeforeNextHeading($, $(headingEl));
    if (container?.length) return container;
  }

  // Some Beebom pages use plain "All New ... Codes" headings. Keep this
  // fallback heading-bound so redemption and troubleshooting lists cannot
  // become code data.
  const genericHeadings = content.find(HEADING_SELECTOR).filter((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    return (
      /\bcodes?\b/i.test(text) &&
      !NON_ACTIVE_SECTION_REGEX.test(text) &&
      !TROUBLESHOOTING_HEADING_REGEX.test(text)
    );
  });

  for (const headingEl of genericHeadings.toArray()) {
    const container = findContainerBeforeNextHeading($, $(headingEl));
    if (container?.length) return container;
  }

  return null;
}

function findExpiredCodes($: cheerio.CheerioAPI): { code: string; provider: "beebom" }[] {
  const content = $(".beebom-single-content.entry-content.highlight");
  if (!content.length) return [];

  const expired: { code: string; provider: "beebom" }[] = [];

  const headings = content.find(HEADING_SELECTOR).filter((_, el) => {
    const text = $(el).text().toLowerCase();
    return text.includes("expired");
  });

  headings.each((_, headingEl) => {
    const heading = $(headingEl);
    let pointer = heading.next();
    let list: cheerio.Cheerio<cheerio.Element> | null = null;

    while (pointer.length) {
      if (pointer.is(HEADING_SELECTOR)) {
        break; // stop at next heading
      }
      if (pointer.is("ul, ol")) {
        list = pointer;
        break;
      }
      pointer = pointer.next();
    }

    if (!list || !list.length) {
      return;
    }

    list.find("li").each((_: number, li: cheerio.Element) => {
      const item = $(li);
      const text = extractCopyCode(item) || textWithoutCopyControls($, item);
      if (!text || isLikelyNonCodeText(text)) return;
      expired.push({ code: text, provider: "beebom" });
    });
  });

  return expired;
}

export function parseBeebomHtml(html: string): ScrapeResult {
  const $ = cheerio.load(html);
  const container = findCodesContainer($);
  const codes: ScrapedCode[] = [];
  const expiredCodes = findExpiredCodes($);

  if (container && container.length) {
    if (container.is("table")) {
      const rows = container.find("tbody tr");
      const targetRows = rows.length ? rows : container.find("tr");

      targetRows.each((_: number, row: cheerio.Element) => {
        const cells = $(row).find("td");
        if (!cells.length) return;

        const codeCell = $(cells[0]);
        const rewardCell = cells.length > 1 ? $(cells[1]) : null;

        const codeText =
          extractCopyCode(codeCell) ||
          codeCell.find("strong").first().text().trim() ||
          textWithoutCopyControls($, codeCell);
        const rewardText = rewardCell ? textWithoutCopyControls($, rewardCell) : "";

        const { cleaned: codeClean, isNew: codeNew } = stripNewFlag(codeText);
        const { cleaned: rawRewardClean, isNew: rewardNew } = stripNewFlag(rewardText);
        const rewardClean = sanitizeRewardText(rawRewardClean);
        const normalized = normalizeCode(codeClean);
        if (!normalized || isLikelyNonCodeText(codeClean)) return;

        const entry: ScrapedCode = {
          code: normalized,
          status: "active",
          provider: "beebom",
        };

        if (rewardClean) entry.rewardsText = rewardClean;
        if (codeNew || rewardNew) entry.isNew = true;

        codes.push(entry);
      });
    } else {
      container.find("li").each((_: number, li: cheerio.Element) => {
        const item = $(li);
        const text = textWithoutCopyControls($, item);
        if (!text) return;

        const [beforeSeparator, rewardPart = ""] = text.split(LIST_SEPARATOR_REGEX, 2);
        const rewardRaw = rewardPart.trim();

        const copiedCode = extractCopyCode(item);
        const { cleaned: codeClean, isNew: codeNew } = stripNewFlag(
          copiedCode || beforeSeparator
        );
        const { cleaned: rawRewardClean, isNew: rewardNew } = stripNewFlag(rewardRaw);
        const rewardClean = sanitizeRewardText(rawRewardClean);
        const normalized = normalizeCode(codeClean);
        if (!normalized || isLikelyNonCodeText(codeClean)) return;
        const entry: ScrapedCode = {
          code: normalized,
          status: "active",
          provider: "beebom",
        };

        if (rewardClean) entry.rewardsText = rewardClean;
        if (codeNew || rewardNew) entry.isNew = true;

        codes.push(entry);
      });
    }
  }

  return {
    codes,
    expiredCodes,
  };
}

export async function scrapeBeebomPage(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }

  return parseBeebomHtml(await res.text());
}
