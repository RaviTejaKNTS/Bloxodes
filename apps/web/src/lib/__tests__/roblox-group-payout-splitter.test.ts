import { describe, expect, it } from "vitest";

import { allocateGroupPayout } from "../roblox-platform-tools/group-payout-splitter";

function split(poolInput: string, mode: "percentage" | "weight" | "fixed", values: string[]) {
  return allocateGroupPayout({
    poolInput,
    mode,
    recipients: values.map((value, index) => ({ name: `Person ${index + 1}`, value }))
  });
}

describe("Roblox group payout splitter", () => {
  it("splits clean percentages", () => {
    const { result } = split("100", "percentage", ["50", "30", "20"]);
    expect(result?.allocations.map((row) => row.allocation)).toEqual([50n, 30n, 20n]);
    expect(result?.leftInGroup).toBe(0n);
  });

  it("uses largest remainder with row order as the final tie-break", () => {
    const largest = split("10", "percentage", ["33.33", "33.33", "33.34"]).result;
    expect(largest?.allocations.map((row) => row.allocation)).toEqual([3n, 3n, 4n]);
    expect(largest?.allocations[2]?.receivedRoundingRobux).toBe(true);

    const tied = split("3", "percentage", ["50", "50"]).result;
    expect(tied?.allocations.map((row) => row.allocation)).toEqual([2n, 1n]);
  });

  it("does not normalize an intentionally unassigned percentage", () => {
    const { result } = split("101", "percentage", ["25", "25"]);
    expect(result?.allocations.map((row) => row.allocation)).toEqual([25n, 25n]);
    expect(result?.leftInGroup).toBe(51n);
    expect(result?.warnings[0]).toContain("50%");
  });

  it("allocates a weighted pool exactly", () => {
    const { result } = split("11", "weight", ["3", "2", "1"]);
    expect(result?.allocations.map((row) => row.allocation)).toEqual([5n, 4n, 2n]);
    expect(result?.leftInGroup).toBe(0n);
  });

  it("leaves fixed remainder in the group", () => {
    const { result } = split("100", "fixed", ["20", "30", "0"]);
    expect(result?.totalAllocated).toBe(50n);
    expect(result?.leftInGroup).toBe(50n);
  });

  it("rejects invalid totals and duplicate recipient identity", () => {
    expect(split("100", "percentage", ["60", "50"]).result).toBeNull();
    expect(split("100", "fixed", ["70", "40"]).result).toBeNull();
    expect(split("100", "weight", ["0", "0"]).result).toBeNull();
    expect(split("100", "percentage", ["33.3333333"]).result).toBeNull();

    const duplicate = allocateGroupPayout({
      poolInput: "100",
      mode: "percentage",
      recipients: [
        { name: "Ada", userId: "123", value: "50" },
        { name: " ada ", userId: "123", value: "50" }
      ]
    });
    expect(duplicate.result).toBeNull();
    expect(duplicate.errors.join(" ")).toContain("unique");
  });

  it("builds a numeric two-column CSV draft", () => {
    const { result } = allocateGroupPayout({
      poolInput: "10",
      mode: "fixed",
      recipients: [
        { name: "Ada", userId: "123", value: "7" },
        { name: "Bo", userId: "456", value: "3" }
      ]
    });
    expect(result?.csvDraft).toBe("userId,payoutInRobux\n123,7\n456,3");
  });
});
