import { describe, expect, it } from "vitest";

import { calculateBadgeAwardBudget, planBadgeCreations } from "../roblox-platform-tools/badge-cost-quota-planner";

function plan(plannedInput: string, remainingTodayInput: string, daysAvailableInput: string) {
  return planBadgeCreations({
    rows: [{ label: "Experience", plannedInput, remainingTodayInput }],
    daysAvailableInput,
    startUtcDate: "2026-08-31"
  });
}

describe("Roblox badge cost and quota planner", () => {
  it("uses the per-universe free quota and paid creation cost", () => {
    expect(plan("5", "5", "1").result?.rows[0]).toMatchObject({ freeByDeadline: 5, paidByDeadline: 0, costByDeadline: 0, freeOnlyDaysUsed: 1 });
    expect(plan("6", "5", "1").result?.rows[0]).toMatchObject({ freeByDeadline: 5, paidByDeadline: 1, costByDeadline: 100, freeOnlyDaysUsed: 2 });
    expect(plan("6", "5", "2").result?.rows[0]).toMatchObject({ freeByDeadline: 6, paidByDeadline: 0, costByDeadline: 0, freeOnlyFinishDate: "2026-09-01" });
    expect(plan("13", "2", "3").result?.rows[0]).toMatchObject({ freeByDeadline: 12, paidByDeadline: 1, costByDeadline: 100, freeOnlyDaysUsed: 4 });
  });

  it("handles zero plans and zero remaining quota", () => {
    expect(plan("0", "5", "1").result?.rows[0]).toMatchObject({ freeOnlyDaysUsed: 0, freeOnlyFinishDate: null });
    expect(plan("5", "0", "1").result?.rows[0]).toMatchObject({ freeByDeadline: 0, paidByDeadline: 5, costByDeadline: 500, freeOnlyFinishDate: "2026-09-01" });
  });

  it("does not pool free slots between universes", () => {
    const { result } = planBadgeCreations({
      rows: [
        { label: "A", universeId: "1", plannedInput: "8", remainingTodayInput: "0" },
        { label: "B", universeId: "2", plannedInput: "8", remainingTodayInput: "5" }
      ],
      daysAvailableInput: "2",
      startUtcDate: "2026-08-31"
    });
    expect(result).toMatchObject({ totalPlanned: 16, totalPaidByDeadline: 3, totalCostByDeadline: 300 });
  });

  it("rejects invalid quotas, days, and duplicate universe rows", () => {
    expect(plan("1", "6", "1").result).toBeNull();
    expect(plan("1", "5", "0").result).toBeNull();
    const duplicate = planBadgeCreations({
      rows: [
        { label: "A", universeId: "12", plannedInput: "1", remainingTodayInput: "5" },
        { label: "B", universeId: "12", plannedInput: "1", remainingTodayInput: "5" }
      ],
      daysAvailableInput: "1",
      startUtcDate: "2026-08-31"
    });
    expect(duplicate.result).toBeNull();
  });

  it("calculates the published award call budget", () => {
    expect(calculateBadgeAwardBudget("0", "51").result).toEqual({ users: 0, plannedCalls: 51, ceiling: 50, headroom: 0, overage: 1 });
    expect(calculateBadgeAwardBudget("10", "375").result).toEqual({ users: 10, plannedCalls: 375, ceiling: 400, headroom: 25, overage: 0 });
    expect(calculateBadgeAwardBudget("100", "3600").result).toEqual({ users: 100, plannedCalls: 3600, ceiling: 3550, headroom: 0, overage: 50 });
  });
});
