import { describe, expect, it } from "vitest";
import { isSuspiciousEmptyCodeRefresh } from "../code-refresh-safety";

describe("code refresh safety", () => {
  it("rejects a completely empty scrape when active codes already exist", () => {
    expect(
      isSuspiciousEmptyCodeRefresh({
        existingActiveCount: 4,
        scrapedActiveCount: 0,
        scrapedExpiredCount: 0,
      })
    ).toBe(true);
  });

  it("allows explicit expired results and genuinely empty new pages", () => {
    expect(
      isSuspiciousEmptyCodeRefresh({
        existingActiveCount: 4,
        scrapedActiveCount: 0,
        scrapedExpiredCount: 4,
      })
    ).toBe(false);
    expect(
      isSuspiciousEmptyCodeRefresh({
        existingActiveCount: 0,
        scrapedActiveCount: 0,
        scrapedExpiredCount: 0,
      })
    ).toBe(false);
  });
});
