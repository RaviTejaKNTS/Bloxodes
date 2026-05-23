import "server-only";
import fs from "node:fs/promises";
import { unstable_cache } from "next/cache";
import { repoPath } from "@/lib/paths";

export type WizardAlchemyPotion = {
  name: string;
  slug?: string;
  image?: string;
  category: string;
  minMagic: number;
  power: number | null;
  effect: string;
  recommendedShard: string | null;
  compatibleRace: string | null;
};

export type WizardAlchemyMaterial = {
  name: string;
  slug?: string;
  image?: string;
  catalogSection: string;
  magicPower: number | null;
  elementEffect: string | null;
  source: string;
};

export type WizardAlchemyRace = {
  name: string;
  slug?: string;
  image?: string;
  catalogSection: string;
  rarity: string;
  rollChance: string;
  bestFor: string;
  coreBonus: string;
  passive: string | null;
  mainLimit: string;
  elementSynergy: string;
  keepPriority: string;
};

async function readDataset<T>(fileName: string): Promise<T[]> {
  const raw = await fs.readFile(repoPath("data", "Wizard Alchemy", fileName), "utf8");
  const parsed = JSON.parse(raw) as { items?: T[] };
  return parsed.items ?? [];
}

async function readPotionPlannerData() {
  const [potions, materials] = await Promise.all([
    readDataset<WizardAlchemyPotion>("potions.json"),
    readDataset<WizardAlchemyMaterial>("materials.json")
  ]);
  return { potions, materials };
}

async function readRaceRerollData() {
  const races = await readDataset<WizardAlchemyRace>("races.json");
  return { races };
}

export const loadWizardAlchemyPotionPlannerData = unstable_cache(
  readPotionPlannerData,
  ["wizard-alchemy-potion-planner-data"],
  { revalidate: 21600 }
);

export const loadWizardAlchemyRaceRerollData = unstable_cache(
  readRaceRerollData,
  ["wizard-alchemy-race-reroll-data"],
  { revalidate: 21600 }
);
