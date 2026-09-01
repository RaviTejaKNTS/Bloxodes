import { describe, expect, it } from "vitest";

import {
  calculateGamepassPriceForTarget,
  calculateGamepassSplit,
  formatTenths
} from "@/lib/roblox-platform-tools/gamepass-calculator";

describe("Roblox gamepass calculator", () => {
  it("calculates a clean 70/30 split", () => {
    const result = calculateGamepassSplit(100, 10);

    expect(result).not.toBeNull();
    expect(formatTenths(result!.creatorShareTenths)).toBe("70");
    expect(formatTenths(result!.robloxFeeTenths)).toBe("30");
    expect(formatTenths(result!.creatorTotalTenths)).toBe("700");
    expect(result!.buyerSpend).toBe(1000n);
    expect(result!.hasFractionalSplit).toBe(false);
  });

  it("keeps fractional published shares instead of inventing a rounding rule", () => {
    const result = calculateGamepassSplit(99);

    expect(formatTenths(result!.creatorShareTenths)).toBe("69.3");
    expect(formatTenths(result!.robloxFeeTenths)).toBe("29.7");
    expect(result!.hasFractionalSplit).toBe(true);
  });

  it("finds the formula-based minimum and clean-split alternative", () => {
    const result = calculateGamepassPriceForTarget(100);

    expect(result?.price).toBe(143);
    expect(result?.cleanSplitPrice).toBe(150);
    expect(formatTenths(result!.creatorShareTenths)).toBe("100.1");
    expect(formatTenths(result!.formulaExcessTenths)).toBe("0.1");
  });

  it("rejects invalid prices and unreachable targets", () => {
    expect(calculateGamepassSplit(0)).toBeNull();
    expect(calculateGamepassSplit(1_000_000_001)).toBeNull();
    expect(calculateGamepassSplit(99.5)).toBeNull();
    expect(calculateGamepassPriceForTarget(700_000_001)).toBeNull();
  });
});
