import { describe, expect, it } from "vitest";
import { beaconPlan, brewingPlan, buildingPlan, circleGrid, circleSvg, furnacePlan, portalCoordinates, storagePlan, triangulate, xpAtLevel, xpPlan, xpToNext } from "../calculations";

describe("Minecraft coordinate and inventory planning", () => {
  it("scales horizontal positions and floors negative blocks", () => {
    expect(portalCoordinates(-1, 80, 800, "to-nether")).toMatchObject({ x: -0.125, y: 80, z: 100, blockX: -1 });
    expect(portalCoordinates(100, 64, -50, "to-overworld")).toMatchObject({ x: 800, z: -400 });
    expect(() => portalCoordinates(4_000_000, 64, 0, "to-overworld")).toThrow("world boundary");
  });
  it("plans unstackable and small-stack items without losing a remainder", () => {
    expect(storagePlan(17, { id: "snowball", name: "Snowball", stackSize: 16 })).toMatchObject({ fullStacks: 1, remainder: 1, occupiedSlots: 2, containers: 1 });
    expect(storagePlan(55, { id: "sword", name: "Sword", stackSize: 1 }, 54)).toMatchObject({ fullStacks: 55, containers: 2, freeSlots: 53 });
    expect(storagePlan(0, { id: "stone", name: "Stone", stackSize: 64 })).toMatchObject({ containers: 0, occupiedSlots: 0 });
    expect(() => storagePlan(1.5, { id: "stone", name: "Stone", stackSize: 64 })).toThrow("whole number");
  });
  it("keeps fast-station fuel efficiency and rounds each parallel station", () => {
    const coal = { id: "coal", name: "Coal", burnTicks: 1600 };
    expect(furnacePlan(9, coal, "furnace")).toMatchObject({ fuelCount: 2, seconds: 90, unusedCapacity: 7 });
    expect(furnacePlan(9, coal, "smoker")).toMatchObject({ fuelCount: 2, seconds: 45 });
    expect(furnacePlan(9, coal, "furnace", 3)).toMatchObject({ fuelCount: 3, seconds: 30, unusedCapacity: 15 });
    expect(furnacePlan(1, { id: "stick", name: "Stick", burnTicks: 100 }, "furnace").fuelCount).toBe(2);
    expect(furnacePlan(0, coal, "furnace", 3)).toMatchObject({ fuelCount: 0, seconds: 0, stationsUsed: 0 });
  });
});
describe("Minecraft geometry and progress", () => {
  it("keeps even and odd circles symmetric and exports exactly the counted cells", () => {
    for (const diameter of [1, 2, 3, 20, 21, 64]) for (const filled of [true, false]) {
      const { grid, count } = circleGrid(diameter, filled);
      expect(grid.every(row => row.join() === [...row].reverse().join())).toBe(true);
      expect(grid.map(row => row.join()).join() === [...grid].reverse().map(row => row.join()).join()).toBe(true);
      expect(circleSvg(grid).match(/<rect x=/g)?.length).toBe(count);
    }
    expect(circleGrid(3, true).count).toBe(9);
    expect(circleGrid(3).count).toBe(8);
  });
  it("checks cumulative XP boundaries and current-level progress", () => {
    expect([0, 16, 17, 31, 32].map(xpAtLevel)).toEqual([0, 352, 394, 1507, 1628]);
    expect(xpAtLevel(30)).toBe(1395);
    expect(xpPlan(20, 50, 30)).toMatchObject({ currentXp: 581, needed: 814 });
    for (const level of [0, 15, 16, 17, 30, 31, 32, 100]) expect(xpToNext(level)).toBe(level >= 31 ? 9 * level - 158 : level >= 16 ? 5 * level - 38 : 2 * level + 7);
    expect(xpPlan(9999, 0, 10000).needed).toBeGreaterThan(0);
    expect(() => xpPlan(10000, 0, 10000)).toThrow("Current level");
  });
  it("counts shared beacon layers and avoids double-counted room corners", () => {
    expect(beaconPlan(4)).toMatchObject({ blocks: 164, mineralItems: 1476, layerCounts: [9, 25, 49, 81] });
    expect(beaconPlan(4, 3, 2).blocks).toBe(244);
    expect(buildingPlan("room", 3, 3, 3).blocks).toBe(26);
    expect(buildingPlan("walls", 3, 3, 3).blocks).toBe(24);
    expect(buildingPlan("floor", 3, 3, 10).blocks).toBe(9);
    expect(buildingPlan("room", 1, 1, 1).blocks).toBe(1);
    expect(() => buildingPlan("box", 2, 2, 2, 9)).toThrow("Removed blocks");
  });
  it("intersects forward Minecraft yaw bearings and flags unstable ranges", () => {
    const result = triangulate({ x: 0, z: 0, yaw: -45 }, { x: 1000, z: 0, yaw: 45 }, 0.25);
    expect(result.x).toBeCloseTo(500); expect(result.z).toBeCloseTo(500);
    expect(result.uncertainty!.minX).toBeLessThan(result.x);
    expect(result.uncertainty!.maxX).toBeGreaterThan(result.x);
    expect(() => triangulate({ x: 0, z: 0, yaw: 0 }, { x: 10, z: 0, yaw: 0 }, 1)).toThrow("parallel");
    expect(() => triangulate({ x: 0, z: 0, yaw: 45 }, { x: 1000, z: 0, yaw: -45 }, 0.25)).toThrow("behind");
    expect(triangulate({ x: 0, z: 0, yaw: -1.5 }, { x: 10, z: 0, yaw: 0 }, 1).unstable).toBe(true);
  });
});
describe("Minecraft brewing", () => {
  it("rounds three-bottle batches and counts variant/form steps", () => {
    const result = brewingPlan({ id: "strength", name: "Strength", steps: [{ ingredient: "nether_wart", result: "awkward" }, { ingredient: "blaze_powder", result: "strength" }], enhance: "strong_strength" }, "lingering", "strong", 4);
    expect(result).toMatchObject({ batches: 2, operations: 10, blazePowder: 1, seconds: 200 });
    expect(result.ingredients).toMatchObject({ glass_bottle: 4, nether_wart: 2, blaze_powder: 3, glowstone_dust: 2, gunpowder: 2, dragon_breath: 2 });
    expect(() => brewingPlan({ id: "weakness", name: "Weakness", steps: [] }, "drink", "strong", 3)).toThrow("stronger");
  });
});
