import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  calculateCommissionBreakEven,
  calculateMarketplaceCommission,
  calculateMarketplaceRate
} from "../roblox-platform-tools/marketplace-fee-calculator";

describe("Roblox Marketplace fee calculator", () => {
  it("uses published progressive checkpoints exactly", () => {
    expect(calculateMarketplaceRate(100, 100)).toMatchObject({ ratePercent: 30, kind: "published" });
    expect(calculateMarketplaceRate(200, 100)).toMatchObject({ ratePercent: 50, kind: "published" });
    expect(calculateMarketplaceRate(600, 100)).toMatchObject({ ratePercent: 70, kind: "published" });
  });

  it("labels interpolation between checkpoints as an estimate", () => {
    const rate = calculateMarketplaceRate(115, 100);
    expect(rate?.kind).toBe("estimated");
    expect(rate?.ratePercent).toBeCloseTo(33.5, 8);
  });

  it("rejects below-floor and above-supported-range Marketplace inputs", () => {
    expect(calculateMarketplaceRate(99, 100)).toBeNull();
    expect(calculateMarketplaceRate(1_001, 100)?.kind).toBe("unsupported");
    expect(calculateMarketplaceCommission({ listedPrice: 1_001, currentFloor: 100, location: "marketplace" })).toBeNull();
  });

  it("uses the published in-experience 30/40/30 split", () => {
    const result = calculateMarketplaceCommission({
      listedPrice: 100,
      currentFloor: 100,
      location: "in-experience",
      sameOwner: true,
      sales: 10
    });
    expect(result).toMatchObject({
      creatorPerSale: 30,
      gameOwnerPerSale: 40,
      robloxPerSale: 30,
      ownerCombinedPerSale: 70,
      ownerCombinedTotal: 700
    });
  });

  it("calculates commission-only break-even and the 30-day hold date", () => {
    expect(calculateCommissionBreakEven(1_580, 70)).toBe(23);
    expect(addCalendarDays("2026-08-31", 30)).toBe("2026-09-30");
  });
});
