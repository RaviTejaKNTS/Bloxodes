import { describe, expect, it } from "vitest";

import {
  addCreatorRewardHoldDays,
  calculateAudienceExpansionReward,
  calculateDailyCreatorReward,
  formatCents,
  formatHundredths
} from "../roblox-platform-tools/creator-rewards-estimator";

describe("Roblox Creator Rewards estimator", () => {
  it("calculates published Daily Engagement rewards", () => {
    expect(calculateDailyCreatorReward({ mode: "single-total", eventsInput: "0" }).result?.rewardHundredths).toBe(0n);
    expect(calculateDailyCreatorReward({ mode: "single-total", eventsInput: "17" }).result?.rewardHundredths).toBe(8_500n);
    expect(calculateDailyCreatorReward({ mode: "daily-average", eventsInput: "20", daysInput: "30" }).result?.rewardHundredths).toBe(300_000n);
    expect(calculateDailyCreatorReward({ mode: "daily-average", eventsInput: "12.5", daysInput: "28" }).result).toMatchObject({ plannedEventsHundredths: 35_000n, rewardHundredths: 175_000n, isScenario: true });
    expect(calculateDailyCreatorReward({ mode: "single-total", eventsInput: "1.5" }).result).toBeNull();
  });

  it("validates per-user Audience Expansion ceilings", () => {
    expect(calculateAudienceExpansionReward([{ type: "new", usersInput: "1", eligibleBaseInput: "100.01" }]).result).toBeNull();
    expect(calculateAudienceExpansionReward([{ type: "new", usersInput: "0", eligibleBaseInput: "1" }]).result).toBeNull();
  });

  it("calculates the 35% share and separate theoretical Robux", () => {
    const one = calculateAudienceExpansionReward([{ type: "new", usersInput: "1", eligibleBaseInput: "100" }]).result;
    expect(formatCents(one!.displayedShareCents)).toBe("$35.00");
    expect(formatHundredths(one!.theoreticalRobuxHundredths)).toBe("9,210.53");

    const combined = calculateAudienceExpansionReward([
      { type: "new", usersInput: "1", eligibleBaseInput: "80" },
      { type: "reactivated", usersInput: "1", eligibleBaseInput: "35" }
    ]).result;
    expect(formatCents(combined!.displayedShareCents)).toBe("$40.25");
  });

  it("supports aggregate qualified cohorts under their combined cap", () => {
    const result = calculateAudienceExpansionReward([{ type: "new", usersInput: "3", eligibleBaseInput: "240" }]).result;
    expect(formatCents(result!.displayedShareCents)).toBe("$84.00");
    expect(formatHundredths(result!.theoreticalRobuxHundredths)).toBe("22,105.26");
  });

  it("adds 60 calendar days safely", () => {
    expect(addCreatorRewardHoldDays("2026-08-31")).toBe("2026-10-30");
    expect(addCreatorRewardHoldDays("2024-02-29")).toBe("2024-04-29");
    expect(addCreatorRewardHoldDays("2026-12-15")).toBe("2027-02-13");
  });
});
