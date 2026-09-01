import { describe, expect, it } from "vitest";
import {
  aggregateOreSelections,
  calculateArmorPieceProbabilities,
  calculateTotalMultiplier,
  calculateTraitActivations,
  calculateWeaponClassProbabilities
} from "../calculator";
import type { Ore } from "../data";

function expectWithin(actual: number, expected: number, tolerance = 0.005) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe("forge calculator", () => {
  const oresById: Record<string, Ore> = {
    stone: {
      id: "stone",
      name: "Stone",
      rarity: "Common",
      areaGroup: "Stonewake",
      dropChanceRatio: 1,
      multiplier: 0.2,
      sellPrice: 3,
      hasTrait: false,
      traitName: null,
      traitEffectShort: null,
      traitType: null
    },
    iron: {
      id: "iron",
      name: "Iron",
      rarity: "Common",
      areaGroup: "Stonewake",
      dropChanceRatio: 5,
      multiplier: 0.35,
      sellPrice: 5.25,
      hasTrait: false,
      traitName: null,
      traitEffectShort: null,
      traitType: null
    },
    poopite: {
      id: "poopite",
      name: "Poopite",
      rarity: "Rare",
      areaGroup: "Stonewake",
      dropChanceRatio: 0,
      multiplier: 1,
      sellPrice: null,
      hasTrait: true,
      traitName: "Poopite",
      traitEffectShort: "Test trait",
      traitType: "both"
    }
  };

  it("calculates weighted multiplier by ore count", () => {
    const { usages, totalCount } = aggregateOreSelections(
      [
        { oreId: "stone", count: 2 },
        { oreId: "iron", count: 1 }
      ],
      oresById
    );

    const multiplier = calculateTotalMultiplier(usages, totalCount);
    expectWithin(multiplier, 0.25, 1e-6);
  });

  it("activates traits at 10% (minor) and 30% (full)", () => {
    const minorMix = aggregateOreSelections(
      [
        { oreId: "poopite", count: 1 },
        { oreId: "stone", count: 9 }
      ],
      oresById
    );
    const minorTraits = calculateTraitActivations(minorMix.usages, minorMix.totalCount);
    expect(minorTraits).toHaveLength(1);
    expect(minorTraits[0].tier).toBe("minor");

    const fullMix = aggregateOreSelections(
      [
        { oreId: "poopite", count: 3 },
        { oreId: "stone", count: 7 }
      ],
      oresById
    );
    const fullTraits = calculateTraitActivations(fullMix.usages, fullMix.totalCount);
    expect(fullTraits).toHaveLength(1);
    expect(fullTraits[0].tier).toBe("full");

    const inactiveMix = aggregateOreSelections(
      [
        { oreId: "poopite", count: 1 },
        { oreId: "stone", count: 10 }
      ],
      oresById
    );
    const inactiveTraits = calculateTraitActivations(inactiveMix.usages, inactiveMix.totalCount);
    expect(inactiveTraits).toHaveLength(0);
  });

  it("matches weapon class anchor probabilities for Straight Sword", () => {
    const atMin = calculateWeaponClassProbabilities(4);
    const straightMin = atMin.find((entry) => entry.class === "Straight Sword");
    expect(straightMin).toBeDefined();
    expectWithin(straightMin?.probability ?? 0, 0.14);

    const atOpt = calculateWeaponClassProbabilities(6);
    const straightOpt = atOpt.find((entry) => entry.class === "Straight Sword");
    expect(straightOpt).toBeDefined();
    expectWithin(straightOpt?.probability ?? 0, 0.86);
  });

  it("matches armor piece anchor probabilities for Light Helmet", () => {
    const atMin = calculateArmorPieceProbabilities(3);
    const lightHelmet = atMin.find((entry) => entry.key === "Light-Helmet");
    expect(lightHelmet).toBeDefined();
    expectWithin(lightHelmet?.probability ?? 0, 1, 1e-6);
  });

  it("matches armor piece anchor probabilities for Light Leggings", () => {
    const atMin = calculateArmorPieceProbabilities(5);
    const lightLeggings = atMin.find((entry) => entry.key === "Light-Leggings");
    expect(lightLeggings).toBeDefined();
    expectWithin(lightLeggings?.probability ?? 0, 0.11);
  });
});
