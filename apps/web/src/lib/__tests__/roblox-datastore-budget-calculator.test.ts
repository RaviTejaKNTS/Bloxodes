import { describe, expect, it } from "vitest";

import { calculateDataStoreBudget, calculatePerKeyThroughput, getDefaultServerLimit, getExperienceLimit, type DataStoreBudgetInput } from "../roblox-platform-tools/datastore-budget-calculator";

function base(overrides: Partial<DataStoreBudgetInput> = {}): DataStoreBudgetInput {
  return {
    players: "0", concurrentUsers: "0", serverCount: "1", safetyPercent: "80", averageReadBytes: "0", averageWriteBytes: "0",
    operations: { standardGets: "0", standardWrites: "0", standardUpdates: "0", standardLists: "0", standardRemoves: "0", orderedReads: "0", orderedWrites: "0", orderedUpdates: "0", orderedLists: "0", orderedRemoves: "0" },
    ...overrides
  };
}

describe("Roblox DataStore budget calculator", () => {
  it("uses the documented default server formulas", () => {
    expect(getDefaultServerLimit("standardRead", 0)).toBe(60);
    expect(getDefaultServerLimit("orderedWrite", 0)).toBe(30);
    expect(getDefaultServerLimit("standardList", 0)).toBe(5);
    expect(getDefaultServerLimit("standardRead", 10)).toBe(460);
    expect(getDefaultServerLimit("orderedWrite", 10)).toBe(80);
    expect(getDefaultServerLimit("orderedList", 10)).toBe(25);
  });

  it("uses the documented shared experience formulas", () => {
    expect(getExperienceLimit("standardWrite", 100)).toBe(2300);
    expect(getExperienceLimit("orderedRead", 100)).toBe(4300);
    expect(getExperienceLimit("standardList", 100)).toBe(500);
  });

  it("counts updates against read and write", () => {
    const result = calculateDataStoreBudget(base({ operations: { ...base().operations, standardUpdates: "1", orderedUpdates: "2" } })).result!;
    expect(result.rows.find((row) => row.bucket === "standardRead")?.serverDemand).toBe(1);
    expect(result.rows.find((row) => row.bucket === "standardWrite")?.serverDemand).toBe(1);
    expect(result.rows.find((row) => row.bucket === "orderedRead")?.serverDemand).toBe(2);
    expect(result.rows.find((row) => row.bucket === "orderedWrite")?.serverDemand).toBe(2);
    expect(result.hasUpdates).toBe(true);
  });

  it("applies safety warnings and documented-limit failures", () => {
    const pass = calculateDataStoreBudget(base({ operations: { ...base().operations, standardGets: "48" } })).result!;
    const warn = calculateDataStoreBudget(base({ operations: { ...base().operations, standardGets: "49" } })).result!;
    const fail = calculateDataStoreBudget(base({ operations: { ...base().operations, standardGets: "61" } })).result!;
    expect(pass.rows[0]?.status).toBe("pass");
    expect(warn.rows[0]?.status).toBe("warn");
    expect(fail.rows[0]?.status).toBe("fail");
  });

  it("can pass a server layer while failing experience demand", () => {
    const result = calculateDataStoreBudget(base({ concurrentUsers: "0", serverCount: "10", operations: { ...base().operations, standardGets: "40" } })).result!;
    expect(result.rows[0]).toMatchObject({ serverDemand: 40, experienceDemand: 400, status: "fail", limitingLayer: "experience" });
  });

  it("corrects impossible CCU and estimates rounded per-key throughput", () => {
    const result = calculateDataStoreBudget(base({ players: "10", concurrentUsers: "5" })).result!;
    expect(result).toMatchObject({ effectiveConcurrentUsers: 10, concurrentUsersCorrected: true });
    expect(calculatePerKeyThroughput(800, "read")).toMatchObject({ roundedKilobytes: 1, estimatedRequestsPerMinute: 25000 });
    expect(calculatePerKeyThroughput(1200, "write")).toMatchObject({ roundedKilobytes: 2, estimatedRequestsPerMinute: 2000 });
    expect(calculatePerKeyThroughput(0, "read")).toBeNull();
  });

  it("rejects non-whole and out-of-range inputs", () => {
    expect(calculateDataStoreBudget(base({ players: "1.5" })).result).toBeNull();
    expect(calculateDataStoreBudget(base({ safetyPercent: "0" })).result).toBeNull();
    expect(calculateDataStoreBudget(base({ serverCount: "0" })).result).toBeNull();
  });
});
