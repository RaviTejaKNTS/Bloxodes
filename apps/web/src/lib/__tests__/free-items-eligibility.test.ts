import { describe, expect, it } from "vitest";

import { classifyFreeItemEligibility } from "@/lib/free-items-eligibility";

const baseInput = {
  priceRobux: 0,
  isForSale: true,
  hasResellers: false,
  lowestResalePriceRobux: 0,
  saleLocationType: "ShopAndAllExperiences",
  isLimited: false,
  remaining: null,
  unitsAvailableForConsumption: null,
};

describe("classifyFreeItemEligibility", () => {
  it("accepts a zero-price item sold directly in the Roblox shop", () => {
    expect(classifyFreeItemEligibility(baseInput)).toEqual({ claimability: "direct", reason: null });
  });

  it("keeps experience-only rewards off the direct catalog", () => {
    expect(
      classifyFreeItemEligibility({ ...baseInput, saleLocationType: "ExperiencesDevApiOnly" })
    ).toEqual({ claimability: "experience", reason: "experience_only" });
  });

  it("rejects off-sale and paid items", () => {
    expect(classifyFreeItemEligibility({ ...baseInput, isForSale: false })).toEqual({
      claimability: "unavailable",
      reason: "off_sale",
    });
    expect(classifyFreeItemEligibility({ ...baseInput, priceRobux: 1 })).toEqual({
      claimability: "unavailable",
      reason: "not_free",
    });
  });

  it("rejects resale-only and exhausted limited items", () => {
    expect(classifyFreeItemEligibility({ ...baseInput, hasResellers: true })).toEqual({
      claimability: "unavailable",
      reason: "resale_only",
    });
    expect(
      classifyFreeItemEligibility({
        ...baseInput,
        isLimited: true,
        unitsAvailableForConsumption: 0,
      })
    ).toEqual({ claimability: "unavailable", reason: "out_of_stock" });
  });

  it("fails closed when Roblox does not identify a direct sale location", () => {
    expect(classifyFreeItemEligibility({ ...baseInput, saleLocationType: null })).toEqual({
      claimability: "unavailable",
      reason: "unknown_sale_location",
    });
  });
});
