import { describe, expect, it } from "vitest";

import { calculateServerAllocatedMemoryGiB, calculateServerMemoryCapacity, type ServerMemoryCapacityInput } from "../roblox-platform-tools/server-memory-capacity-planner";

function base(overrides: Partial<ServerMemoryCapacityInput> = {}): ServerMemoryCapacityInput {
  return { maxPlayers: "50", targetPlayers: "20", lowSamplePlayers: "0", lowSampleMemoryGiB: "1", highSamplePlayers: "20", highSampleMemoryGiB: "3", eventReserveGiB: "0.5", growthMiBPerHour: "512", plannedUptimeHours: "2", safetyPercent: "50", measuredHeartbeat: "60", ...overrides };
}

describe("Roblox server memory and capacity planner", () => {
  it("uses Roblox's binary-unit allocation formula", () => {
    expect(calculateServerAllocatedMemoryGiB(0)).toBe(6.25);
    expect(calculateServerAllocatedMemoryGiB(30)).toBeCloseTo(9.1796875, 8);
  });

  it("derives marginal and baseline memory from two samples", () => {
    const result = calculateServerMemoryCapacity(base()).result!;
    expect(result.marginalGiBPerPlayer).toBeCloseTo(0.1, 10);
    expect(result.baselineGiB).toBeCloseTo(1, 10);
    expect(result.longSessionReserveGiB).toBe(1);
    expect(result.projectedUsedGiB).toBeCloseTo(4.5, 10);
    expect(result.safetyCeilingGiB).toBeCloseTo(calculateServerAllocatedMemoryGiB(20) * 0.5, 10);
  });

  it("normalizes swapped sample order", () => {
    const normal = calculateServerMemoryCapacity(base()).result!;
    const swapped = calculateServerMemoryCapacity(base({ lowSamplePlayers: "20", lowSampleMemoryGiB: "3", highSamplePlayers: "0", highSampleMemoryGiB: "1" })).result!;
    expect(swapped.marginalGiBPerPlayer).toBe(normal.marginalGiBPerPlayer);
    expect(swapped.baselineGiB).toBe(normal.baselineGiB);
  });

  it("keeps heartbeat separate from memory", () => {
    expect(calculateServerMemoryCapacity(base({ measuredHeartbeat: "60" })).result?.heartbeatStatus).toBe("pass");
    expect(calculateServerMemoryCapacity(base({ measuredHeartbeat: "59" })).result?.heartbeatStatus).toBe("warn");
  });

  it("finds the greatest memory-only player count within MaxPlayers", () => {
    const result = calculateServerMemoryCapacity(base({ maxPlayers: "100", targetPlayers: "30", eventReserveGiB: "0", growthMiBPerHour: "0", plannedUptimeHours: "0" })).result!;
    expect(result.memoryOnlyCapacity).toBeGreaterThan(0);
    expect(result.memoryOnlyCapacity).toBeLessThanOrEqual(100);
    expect(result.targetExceedsMemoryCapacity).toBe(result.targetPlayers > result.memoryOnlyCapacity);
  });

  it("rejects unstable and impossible samples", () => {
    expect(calculateServerMemoryCapacity(base({ highSamplePlayers: "0" })).result).toBeNull();
    expect(calculateServerMemoryCapacity(base({ highSampleMemoryGiB: "0.5" })).result).toBeNull();
    expect(calculateServerMemoryCapacity(base({ lowSamplePlayers: "10", lowSampleMemoryGiB: "0.1", highSamplePlayers: "20", highSampleMemoryGiB: "2" })).result).toBeNull();
    expect(calculateServerMemoryCapacity(base({ maxPlayers: "10", targetPlayers: "11" })).result).toBeNull();
    expect(calculateServerMemoryCapacity(base({ safetyPercent: "51" })).result).toBeNull();
  });
});
