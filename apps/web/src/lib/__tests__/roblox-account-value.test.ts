import { describe, expect, it } from "vitest";
import {
  calculateRapConcentration,
  calculateVisibleRobuxTotal,
  getInventoryValueState,
  MAX_MANUAL_ROBUX,
  parseManualRobux
} from "@/lib/roblox-account-value";
import type { CollectiblesInfo } from "@/lib/roblox-profile-checker";

function inventory(overrides: Partial<CollectiblesInfo> = {}): CollectiblesInfo {
  return {
    status: "public",
    canView: true,
    totalRap: 0,
    rapIsPartial: false,
    itemCount: 0,
    fetchedItemCount: 0,
    hasMore: false,
    items: [],
    ...overrides
  };
}

describe("Roblox account value calculations", () => {
  it("adds public RAP and a self-entered balance only when both are known", () => {
    expect(calculateVisibleRobuxTotal(12_500, 2_500)).toBe(15_000);
    expect(calculateVisibleRobuxTotal(null, 2_500)).toBeNull();
    expect(calculateVisibleRobuxTotal(12_500, null)).toBeNull();
  });

  it("does not involve Earned Robux in the visible total", () => {
    expect(calculateVisibleRobuxTotal(1_000, 2_000)).toBe(3_000);
  });

  it("accepts safe whole-number input and rejects malformed values", () => {
    expect(parseManualRobux(" 25000 ")).toEqual({ value: 25_000, error: null });
    expect(parseManualRobux("")).toEqual({ value: null, error: null });
    expect(parseManualRobux("-1").error).toBeTruthy();
    expect(parseManualRobux("1.5").error).toBeTruthy();
    expect(parseManualRobux("1e6").error).toBeTruthy();
    expect(parseManualRobux("R$ 100").error).toBeTruthy();
    expect(parseManualRobux(String(MAX_MANUAL_ROBUX + 1)).error).toBeTruthy();
  });

  it("computes top-item concentration from fetched RAP", () => {
    expect(
      calculateRapConcentration(
        [{ recentAveragePrice: 500 }, { recentAveragePrice: 250 }, { recentAveragePrice: null }],
        1_000,
        2
      )
    ).toBe(75);
    expect(calculateRapConcentration([], 0)).toBeNull();
  });

  it("distinguishes complete, partial, private, unavailable, and empty inventories", () => {
    expect(getInventoryValueState(inventory({ fetchedItemCount: 2, itemCount: 2, totalRap: 10 }))).toBe("complete");
    expect(getInventoryValueState(inventory({ rapIsPartial: true, fetchedItemCount: 300 }))).toBe("partial");
    expect(getInventoryValueState(inventory({ status: "private", canView: false, totalRap: null }))).toBe("private");
    expect(getInventoryValueState(inventory({ status: "unavailable", canView: false, totalRap: null }))).toBe("unavailable");
    expect(getInventoryValueState(inventory())).toBe("empty");
  });
});
