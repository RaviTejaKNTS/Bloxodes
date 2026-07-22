import { describe, expect, it } from "vitest";
import {
  parseRobloxDenPromoRewards,
  planPromoRewardMissingState,
  robloxPromoItemUrl,
} from "../robloxden-promo-rewards";

type CardOptions = {
  slug?: string;
  assetId?: string;
  sourceType?: string;
  name?: string;
  code?: string | null;
  eventName?: string | null;
  requirement?: string | null;
  destination?: string;
};

function card({
  slug = "spider-cola",
  assetId = "3164811019",
  sourceType = "code",
  name = "Spider Cola",
  code = "SPIDERCOLA",
  eventName = null,
  requirement = null,
  destination = "https://roblox.com/promocodes",
}: CardOptions = {}) {
  return `
    <li class="image-card" data-asset-id="${assetId}" data-tags='["${sourceType}"]'>
      <img data-src="https://static.robloxden.com/do-not-copy.webp" alt="${name}">
      <a href="/promo-codes/${slug}"><h2 class="image-card__title"> ${name} </h2></a>
      <p class="image-card__description">Source prose that must not be copied.</p>
      ${code === null ? "" : `<button data-copy="${code}">Copy</button>`}
      ${eventName === null ? "" : `<p class="image-card__event-title">${eventName}</p>`}
      ${requirement === null ? "" : `<span class="image-card__event-reward">${requirement}</span>`}
      <div class="image-card__claim"><a href="${destination}">Claim</a></div>
    </li>`;
}

function page(cards: string, count: number) {
  return `<html><head><title>All ${count} Roblox Promo Codes</title></head><body>
    <p>There are currently <strong>${count} active promo codes in our database</strong>.</p>
    <ul class="promo-codes__container">${cards}</ul>
  </body></html>`;
}

describe("RobloxDen promo reward parsing", () => {
  it("normalizes code and event cards without retaining source descriptions or images", () => {
    const parsed = parseRobloxDenPromoRewards(
      page(
        card({ code: "  SpiderCola  " }) +
          card({
            slug: "event-hat",
            assetId: "6042665602",
            sourceType: "event",
            name: "Event Hat",
            code: null,
            eventName: "Example Experience",
            requirement: "Complete Quest 1",
            destination: "https://www.roblox.com/games/123/example",
          }),
        2,
      ),
    );

    expect(parsed.advertisedCount).toBe(2);
    expect(parsed.items[0]).toMatchObject({
      sourceKey: "spider-cola",
      sourceUrl: "https://robloxden.com/promo-codes/spider-cola",
      assetId: 3164811019,
      sourceType: "code",
      claimType: "web_promo_code",
      promoCode: "SpiderCola",
      promoCodeNormalized: "SPIDERCOLA",
      destinationUrl: "https://roblox.com/promocodes",
      robloxItemUrl: "https://www.roblox.com/catalog/3164811019",
    });
    expect(parsed.items[1]).toMatchObject({
      claimType: "event_task",
      promoCode: null,
      eventName: "Example Experience",
      requirementText: "Complete Quest 1",
    });
    expect(JSON.stringify(parsed)).not.toContain("Source prose");
    expect(JSON.stringify(parsed)).not.toContain("static.robloxden.com");
  });

  it("recognizes in-experience codes and creator challenges", () => {
    const parsed = parseRobloxDenPromoRewards(
      page(
        card({ destination: "https://www.roblox.com/games/123/example" }) +
          card({
            slug: "challenge-hat",
            assetId: "2309346267",
            sourceType: "creator-challenge",
            name: "Challenge Hat",
            code: null,
            eventName: "Creator Challenge",
            requirement: "Complete Challenge 1",
            destination: "https://www.roblox.com/games/456/challenge",
          }),
        2,
      ),
    );
    expect(parsed.items.map((item) => item.claimType)).toEqual(["experience_code", "creator_challenge"]);
  });

  it("normalizes catalog claims, collaborations, and gift card promotions", () => {
    const parsed = parseRobloxDenPromoRewards(
      page(
        card({
          slug: "catalog-hat",
          assetId: "1001",
          sourceType: "catalog-claim",
          name: "Catalog Hat",
          code: null,
          destination: "https://www.roblox.com/catalog/1001",
        }) +
          card({
            slug: "collaboration-hat",
            assetId: "1002",
            sourceType: "collaboration",
            name: "Collaboration Hat",
            code: null,
            destination: "https://www.roblox.com/catalog/1002",
          }) +
          card({
            slug: "gift-card-hat",
            assetId: "1003",
            sourceType: "collaboration",
            name: "Gift Card Hat",
            code: null,
            eventName: "Roblox Gift Card Promotion",
            destination: "https://partner.example/gift-card",
          }),
        3,
      ),
    );
    expect(parsed.items.map((item) => item.claimType)).toEqual([
      "catalog_claim",
      "collaboration",
      "gift_card_promotion",
    ]);
    expect(parsed.items[2].destinationUrl).toBeNull();
  });

  it("treats both Roblox web redemption routes as web promo codes", () => {
    const parsed = parseRobloxDenPromoRewards(page(card({ destination: "https://www.roblox.com/redeem" }), 1));
    expect(parsed.items[0].claimType).toBe("web_promo_code");
  });

  it("rejects a missing container or advertised-count mismatch", () => {
    expect(() => parseRobloxDenPromoRewards("<title>All 0 Roblox Promo Codes</title>")).toThrow(/container/);
    expect(() => parseRobloxDenPromoRewards(page("", 0))).toThrow(/empty promo list/);
    expect(() => parseRobloxDenPromoRewards(page(card(), 2))).toThrow(/advertised 2 promos but parsed 1/);
  });

  it("rejects duplicate source keys", () => {
    expect(() => parseRobloxDenPromoRewards(page(card() + card({ assetId: "123" }), 2))).toThrow(/duplicated/);
  });

  it("rejects invalid asset IDs, unknown types, and code rows without codes", () => {
    expect(() => parseRobloxDenPromoRewards(page(card({ assetId: "not-an-id" }), 1))).toThrow(/invalid asset ID/);
    expect(() => parseRobloxDenPromoRewards(page(card({ sourceType: "mystery" }), 1))).toThrow(/unknown source type/);
    expect(() => parseRobloxDenPromoRewards(page(card({ code: null }), 1))).toThrow(/without a code/);
  });

  it("rejects non-Roblox claim destinations", () => {
    expect(() =>
      parseRobloxDenPromoRewards(page(card({ destination: "https://example.com/phishing" }), 1)),
    ).toThrow(/non-Roblox destination/);
  });

  it("increments the first complete-source miss, retires at the threshold, and leaves inactive rows alone", () => {
    expect(planPromoRewardMissingState("source_listed_unverified", 0, 2)).toEqual({
      action: "increment",
      consecutiveMisses: 1,
    });
    expect(planPromoRewardMissingState("source_listed_unverified", 1, 2)).toEqual({
      action: "retire",
      consecutiveMisses: 2,
    });
    expect(planPromoRewardMissingState("inactive", 2, 2)).toEqual({
      action: "none",
      consecutiveMisses: 2,
    });
  });

  it("builds distinct official item URLs for assets and bundles", () => {
    expect(robloxPromoItemUrl(123, "Asset")).toBe("https://www.roblox.com/catalog/123");
    expect(robloxPromoItemUrl(456, "Bundle")).toBe("https://www.roblox.com/bundles/456");
  });
});
