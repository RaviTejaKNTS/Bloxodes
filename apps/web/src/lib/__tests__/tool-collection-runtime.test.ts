import fs from "node:fs/promises";
import path from "node:path";
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

const FIXTURES: Record<string, string> = {
  "grow-a-garden-2-mutations": "data/Grow a Garden 2/mutations.json",
  "grow-a-garden-2-seeds": "data/Grow a Garden 2/seeds.json",
  "grow-a-garden-crops": "data/Grow a Garden/crops.json",
  "the-forge-armors": "data/The Forge/armors.json",
  "the-forge-ores": "data/The Forge/ores.json",
  "the-forge-weapons": "data/The Forge/weapons.json",
  "wizard-alchemy-materials": "data/Wizard Alchemy/materials.json",
  "wizard-alchemy-potions": "data/Wizard Alchemy/potions.json",
  "wizard-alchemy-races": "data/Wizard Alchemy/races.json"
};

beforeAll(async () => {
  for (const [code, relativePath] of Object.entries(FIXTURES)) {
    const document = JSON.parse(
      await fs.readFile(path.resolve(process.cwd(), "../..", relativePath), "utf8")
    ) as { items?: Array<{ system?: { image?: string | null } }> };
    for (const row of document.items ?? []) {
      if (row.system?.image) {
        row.system.image = `https://media.bloxodes.com/wiki/test/${code}/${path.basename(row.system.image)}`;
      }
    }
    runtimeState.documents.set(code, document as Record<string, unknown>);
  }
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
