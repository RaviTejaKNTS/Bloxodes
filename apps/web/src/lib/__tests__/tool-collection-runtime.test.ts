import { beforeAll, describe, expect, it, vi } from "vitest";

const runtimeState = vi.hoisted(() => ({
  documents: new Map<string, Record<string, unknown>>(),
  getByCode: vi.fn(async (code: string) => {
    const document = runtimeState.documents.get(code);
    return document ? { document } : null;
  })
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/wiki-collection-runtime", () => ({
  getPublishedWikiCollectionRuntimeByCode: runtimeState.getByCode,
  shouldFallbackToLocalWikiCollectionData: vi.fn(() => false)
}));

import { loadForgeArmorDataset } from "@/lib/forge/armors";
import { loadForgeOreDataset } from "@/lib/forge/ores";
import { loadForgeWeaponDataset } from "@/lib/forge/weapons";
import { loadCropDataset } from "@/lib/grow-a-garden/crops";
import { loadGrowGarden2ValueDataset } from "@/lib/grow-a-garden-2/value-calculator";
import {
  getGrowGardenCollectionConfig,
  loadGrowGardenCollectionDataset
} from "@/app/(site)/wiki/collections/games/grow-a-garden";
import {
  loadWizardAlchemyPotionPlannerData,
  loadWizardAlchemyRaceRerollData
} from "@/lib/wizard-alchemy/data";

function runtimeDocument(item: Record<string, unknown>, section = "Items") {
  const name = String(item.name);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return {
    meta: { schemaVersion: 2 },
    items: [{
      item,
      system: {
        slug,
        section,
        sortOrder: 1,
        image: `https://media.bloxodes.com/wiki/test/${slug}.webp`
      }
    }]
  };
}

beforeAll(() => {
  runtimeState.documents.set("grow-a-garden-2-seeds", runtimeDocument({
    name: "Carrot",
    price: "$10",
    rarity: "Common",
    harvestType: "Single harvest",
    availability: "Available",
    whereToGet: "Seed Shop"
  }, "Common"));
  runtimeState.documents.set("grow-a-garden-2-mutations", runtimeDocument({
    name: "Wet",
    multiplier: "2x",
    whereToGet: "Rain weather",
    bestUse: "Stacking crop value"
  }, "Weather mutations"));
  runtimeState.documents.set("grow-a-garden-crops", runtimeDocument({
    name: "Carrot",
    tier: "Common",
    averageValue: "20",
    averageWeight: "0.24 kg",
    priceFloorValue: "18",
    priceFloorWeight: "0.24 kg",
    minimumWeight: "0.20 kg",
    hugeChance: "0.5%",
    stock: "Common",
    obtainable: "Yes"
  }, "Common"));
  runtimeState.documents.set("the-forge-ores", runtimeDocument({
    name: "Stone",
    region: "Stone Wakes Cross",
    rarity: "Common",
    multiplier: "0.2x",
    trait: "None",
    rocks: "Pebble",
    description: "A common ore.",
    dropChance: "1/1",
    sellPrice: "$3"
  }, "Common"));
  runtimeState.documents.set("the-forge-weapons", runtimeDocument({
    name: "Dagger",
    class: "Daggers",
    baseDamage: "4.3",
    attackSpeed: "0.35",
    range: "6",
    sellPrice: "$68",
    chance: "1/1"
  }));
  runtimeState.documents.set("the-forge-armors", runtimeDocument({
    name: "Light Helmet",
    class: "Light",
    slot: "Helmet",
    baseHealth: "3.75%",
    sellPrice: "$65",
    chance: "1/1"
  }, "Helmet"));
  runtimeState.documents.set("wizard-alchemy-potions", runtimeDocument({
    name: "Wind Blade Potion",
    category: "Departure Isle potions",
    minMagic: 6,
    power: 24,
    effect: "Starter wind attack.",
    recommendedShard: "Wind Shard"
  }, "Departure Isle potions"));
  runtimeState.documents.set("wizard-alchemy-materials", runtimeDocument({
    name: "Blueberry",
    rarity: "Common",
    materialRole: "Magic ingredient",
    magicPower: 3,
    source: "Blueberry Bushes"
  }, "Departure Isle materials"));
  runtimeState.documents.set("wizard-alchemy-races", runtimeDocument({
    name: "Human",
    rarity: "Common",
    rollChance: "25%",
    rollRoute: "Starter race",
    bestFor: "Starting only",
    coreBonus: "No passive bonuses",
    mainLimit: "No bonuses",
    elementSynergy: "None",
    keepPriority: "Reroll when ready"
  }, "Common races"));
});

describe("tool datasets use published collection runtimes", () => {
  it("loads all Forge calculator datasets from database-shaped documents", async () => {
    const [ores, weapons, armors] = await Promise.all([
      loadForgeOreDataset(),
      loadForgeWeaponDataset(),
      loadForgeArmorDataset()
    ]);

    expect(ores.ores.length).toBeGreaterThan(0);
    expect(weapons.weapons.length).toBeGreaterThan(0);
    expect(armors.armorPieces.length).toBeGreaterThan(0);
    expect(ores.ores.find((item) => item.imageUrl)?.imageUrl).toMatch(/^https:\/\/media\.bloxodes\.com\/wiki\//);
  });

  it("loads both garden tool families from database-shaped documents", async () => {
    const [garden, garden2] = await Promise.all([
      loadCropDataset(),
      loadGrowGarden2ValueDataset()
    ]);

    expect(garden.crops.length).toBeGreaterThan(0);
    expect(garden2.crops.length).toBeGreaterThan(0);
    expect(garden2.mutations.length).toBeGreaterThan(0);
    expect(garden.crops.find((item) => item.imageUrl)?.imageUrl).toMatch(/^https:\/\/media\.bloxodes\.com\/wiki\//);
  });

  it("loads the specialized Grow a Garden collection page from the database document", async () => {
    const config = getGrowGardenCollectionConfig("crops");
    expect(config).not.toBeNull();
    const dataset = await loadGrowGardenCollectionDataset(config!);

    expect(dataset.items.length).toBeGreaterThan(0);
    expect(dataset.items.find((item) => item.image)?.image).toMatch(/^https:\/\/media\.bloxodes\.com\/wiki\//);
  });

  it("loads Wizard Alchemy planner datasets from database-shaped documents", async () => {
    const [planner, rerolls] = await Promise.all([
      loadWizardAlchemyPotionPlannerData(),
      loadWizardAlchemyRaceRerollData()
    ]);

    expect(planner.potions.length).toBeGreaterThan(0);
    expect(planner.materials.length).toBeGreaterThan(0);
    expect(rerolls.races.length).toBeGreaterThan(0);
    expect(planner.potions.find((item) => item.image)?.image).toMatch(/^https:\/\/media\.bloxodes\.com\/wiki\//);
  });
});
