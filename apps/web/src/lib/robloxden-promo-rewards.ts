import { load } from "cheerio";

export const ROBLOXDEN_PROMO_SOURCE_URL = "https://robloxden.com/promo-codes";

export const ROBLOXDEN_PROMO_SOURCE_TYPES = [
  "code",
  "event",
  "creator-challenge",
  "catalog-claim",
  "collaboration",
] as const;

export type RobloxDenPromoSourceType = (typeof ROBLOXDEN_PROMO_SOURCE_TYPES)[number];

export type RobloxPromoClaimType =
  | "web_promo_code"
  | "experience_code"
  | "event_task"
  | "creator_challenge"
  | "catalog_claim"
  | "collaboration"
  | "gift_card_promotion";

export type RobloxPromoItemType = "Asset" | "Bundle";

export type ParsedRobloxDenPromoReward = {
  sourceKey: string;
  sourceUrl: string;
  assetId: number;
  rewardName: string;
  sourceType: RobloxDenPromoSourceType;
  claimType: RobloxPromoClaimType;
  promoCode: string | null;
  promoCodeNormalized: string | null;
  eventName: string | null;
  requirementText: string | null;
  claimInstructions: string;
  destinationUrl: string | null;
  robloxItemUrl: string;
  sortOrder: number;
};

export type ParsedRobloxDenPromoPage = {
  advertisedCount: number;
  items: ParsedRobloxDenPromoReward[];
};

export type PromoRewardMissingPlan = {
  action: "none" | "increment" | "retire";
  consecutiveMisses: number;
};

export type PromoRewardSeenStatus = {
  status: string;
  statusReason: string | null;
};

export function planPromoRewardSeenStatus(
  existingStatus: string | undefined,
  existingStatusReason: string | null | undefined,
  enrichmentState: "success" | "transient" | "permanent",
): PromoRewardSeenStatus {
  if (enrichmentState === "permanent") {
    return { status: "unavailable", statusReason: "official_asset_unavailable" };
  }
  if (!existingStatus || existingStatus === "inactive") {
    return { status: "source_listed_unverified", statusReason: null };
  }
  if (
    enrichmentState === "success" &&
    existingStatus === "unavailable" &&
    existingStatusReason === "official_asset_unavailable"
  ) {
    return { status: "source_listed_unverified", statusReason: null };
  }
  return { status: existingStatus, statusReason: existingStatusReason ?? null };
}

const SOURCE_TYPE_SET = new Set<string>(ROBLOXDEN_PROMO_SOURCE_TYPES);
const DETAIL_PATH = /^\/promo-codes\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/i;

function cleanText(value: string | null | undefined): string | null {
  const cleaned = value?.replace(/\s+/g, " ").trim() ?? "";
  return cleaned || null;
}

function parseAdvertisedCount(text: string): number | null {
  const patterns = [
    /currently\s+(\d[\d,]*)\s+active\s+promo\s+codes?/i,
    /all\s+(\d[\d,]*)\s+roblox\s+promo\s+codes?/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const count = Number(match[1].replace(/,/g, ""));
    if (Number.isSafeInteger(count) && count >= 0) return count;
  }
  return null;
}

function parseAssetId(raw: string | undefined, sourceKey: string): number {
  if (!raw || !/^\d+$/.test(raw)) {
    throw new Error(`RobloxDen promo ${sourceKey} has an invalid asset ID`);
  }
  const assetId = Number(raw);
  if (!Number.isSafeInteger(assetId) || assetId <= 0) {
    throw new Error(`RobloxDen promo ${sourceKey} has an invalid asset ID`);
  }
  return assetId;
}

function normalizeSourceType(raw: string | undefined, sourceKey: string): RobloxDenPromoSourceType {
  let tags: unknown;
  try {
    tags = JSON.parse(raw ?? "[]");
  } catch {
    throw new Error(`RobloxDen promo ${sourceKey} has invalid source tags`);
  }
  if (!Array.isArray(tags) || tags.length !== 1 || typeof tags[0] !== "string" || !SOURCE_TYPE_SET.has(tags[0])) {
    throw new Error(`RobloxDen promo ${sourceKey} has an unknown source type`);
  }
  return tags[0] as RobloxDenPromoSourceType;
}

function isRobloxHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return normalized === "roblox.com" || normalized.endsWith(".roblox.com");
}

function normalizeRobloxDestination(raw: string, sourceKey: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`RobloxDen promo ${sourceKey} has an invalid destination URL`);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !isRobloxHostname(url.hostname)) {
    throw new Error(`RobloxDen promo ${sourceKey} has a non-Roblox destination`);
  }
  url.hash = "";
  return url.toString();
}

function classifyClaimType(
  sourceType: RobloxDenPromoSourceType,
  destinationUrl: string | null,
  contextText: string,
): RobloxPromoClaimType {
  if (sourceType === "code") {
    const pathname = new URL(destinationUrl!).pathname.replace(/\/+$/, "").toLowerCase();
    return pathname === "/promocodes" || pathname === "/redeem"
      ? "web_promo_code"
      : "experience_code";
  }
  if (sourceType === "event") return "event_task";
  if (sourceType === "creator-challenge") return "creator_challenge";
  if (sourceType === "catalog-claim") return "catalog_claim";
  return /gift\s*card/i.test(contextText) ? "gift_card_promotion" : "collaboration";
}

function normalizedClaimInstructions(claimType: RobloxPromoClaimType, eventName: string | null): string {
  switch (claimType) {
    case "web_promo_code":
      return "Redeem this code on the official Roblox promo code page.";
    case "experience_code":
      return eventName
        ? `Redeem this code inside ${eventName}.`
        : "Redeem this code inside the linked Roblox experience.";
    case "event_task":
      return "Complete the listed task in the linked Roblox experience.";
    case "creator_challenge":
      return "Complete the listed challenge in the linked Roblox experience.";
    case "catalog_claim":
      return "Claim the reward through the linked Roblox catalog page.";
    case "gift_card_promotion":
      return "Follow the official Roblox route for this gift card promotion.";
    case "collaboration":
      return "Follow the official Roblox route for this collaboration reward.";
  }
}

export function planPromoRewardMissingState(
  status: string,
  consecutiveMisses: number,
  retireAfterMisses = 2,
): PromoRewardMissingPlan {
  if (!Number.isInteger(retireAfterMisses) || retireAfterMisses < 2) {
    throw new Error("Promo reward retirement threshold must be an integer of at least 2");
  }
  const normalizedMisses = Number.isInteger(consecutiveMisses) && consecutiveMisses >= 0 ? consecutiveMisses : 0;
  if (status === "inactive") return { action: "none", consecutiveMisses: normalizedMisses };
  const nextMisses = normalizedMisses + 1;
  return {
    action: nextMisses >= retireAfterMisses ? "retire" : "increment",
    consecutiveMisses: nextMisses,
  };
}

export function robloxPromoItemUrl(assetId: number, itemType: RobloxPromoItemType): string {
  return itemType === "Bundle"
    ? `https://www.roblox.com/bundles/${assetId}`
    : `https://www.roblox.com/catalog/${assetId}`;
}

export function parseRobloxDenPromoRewards(
  html: string,
  sourceListUrl = ROBLOXDEN_PROMO_SOURCE_URL,
): ParsedRobloxDenPromoPage {
  const $ = load(html);
  const container = $("ul.promo-codes__container").first();
  if (!container.length) throw new Error("RobloxDen promo container was not found");

  const advertisedCount = parseAdvertisedCount(
    [$("title").text(), $('meta[name="description"]').attr("content"), $("body").text()].filter(Boolean).join(" "),
  );
  if (advertisedCount === null) throw new Error("RobloxDen advertised promo count was not found");
  if (advertisedCount === 0) throw new Error("RobloxDen advertised an empty promo list");

  const sourceOrigin = new URL(sourceListUrl).origin;
  const items: ParsedRobloxDenPromoReward[] = [];
  const sourceKeys = new Set<string>();

  container.children("li.image-card").each((index, element) => {
    const card = $(element);
    const detailHref = card.find('a[href^="/promo-codes/"]').first().attr("href");
    const detailUrl = detailHref ? new URL(detailHref, sourceOrigin) : null;
    const detailMatch = detailUrl?.pathname.match(DETAIL_PATH);
    if (!detailUrl || detailUrl.origin !== sourceOrigin || !detailMatch) {
      throw new Error(`RobloxDen promo card ${index + 1} has no stable detail slug`);
    }
    const sourceKey = detailMatch[1].toLowerCase();
    if (sourceKeys.has(sourceKey)) throw new Error(`RobloxDen promo source key is duplicated: ${sourceKey}`);
    sourceKeys.add(sourceKey);

    const sourceType = normalizeSourceType(card.attr("data-tags"), sourceKey);
    const assetId = parseAssetId(card.attr("data-asset-id"), sourceKey);
    const rewardName = cleanText(card.find(".image-card__title").first().text());
    if (!rewardName) throw new Error(`RobloxDen promo ${sourceKey} has no reward name`);

    const promoCode = cleanText(
      card.find("[data-copy]").first().attr("data-copy") ?? card.find(".content-editable").first().text(),
    );
    if (sourceType === "code" && !promoCode) {
      throw new Error(`RobloxDen promo ${sourceKey} is a code row without a code`);
    }

    const eventName = cleanText(card.find(".image-card__event-title").first().text());
    const requirementText = cleanText(card.find(".image-card__event-reward").first().text());
    const destinationCandidates = card
      .find(".image-card__event-button[href], .image-card__claim a[href]")
      .map((_, anchor) => $(anchor).attr("href"))
      .get()
      .filter((href): href is string => /^https?:\/\//i.test(href));
    if (!destinationCandidates.length && sourceType !== "collaboration") {
      throw new Error(`RobloxDen promo ${sourceKey} has no claim destination`);
    }
    let destinationUrl: string | null = null;
    if (sourceType === "collaboration") {
      for (const href of destinationCandidates) {
        try {
          destinationUrl = normalizeRobloxDestination(href, sourceKey);
          break;
        } catch {
          // Partner-hosted collaboration routes are retained as non-clickable offers.
        }
      }
    } else {
      const destinations = destinationCandidates.map((href) => normalizeRobloxDestination(href, sourceKey));
      destinationUrl = destinations[0];
    }
    const claimType = classifyClaimType(
      sourceType,
      destinationUrl,
      [rewardName, eventName, requirementText].filter(Boolean).join(" "),
    );

    items.push({
      sourceKey,
      sourceUrl: detailUrl.toString(),
      assetId,
      rewardName,
      sourceType,
      claimType,
      promoCode: sourceType === "code" ? promoCode : null,
      promoCodeNormalized: sourceType === "code" ? promoCode!.toUpperCase() : null,
      eventName,
      requirementText,
      claimInstructions: normalizedClaimInstructions(claimType, eventName),
      destinationUrl,
      robloxItemUrl: robloxPromoItemUrl(assetId, "Asset"),
      sortOrder: index,
    });
  });

  if (items.length !== advertisedCount) {
    throw new Error(`RobloxDen advertised ${advertisedCount} promos but parsed ${items.length}`);
  }
  return { advertisedCount, items };
}
