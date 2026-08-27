import "server-only";
import fs from "node:fs/promises";
import { publicContentCache } from "@/lib/public-content-cache";
import { repoPath } from "@/lib/paths";
import { unwrapDatasetItems } from "@/lib/local-datasets";
import {
  getPublishedWikiCollectionRuntimeByCode,
  shouldFallbackToLocalWikiCollectionData
} from "@/lib/wiki-collection-runtime";

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
  collectionSection: string;
  magicPower: number | null;
  elementEffect: string | null;
  source: string;
};

export type WizardAlchemyRace = {
  name: string;
  slug?: string;
  image?: string;
  collectionSection: string;
  rarity: string;
  rollChance: string;
  bestFor: string;
  coreBonus: string;
  passive: string | null;
  mainLimit: string;
  elementSynergy: string;
  keepPriority: string;
};

async function readDataset<T extends Record<string, unknown>>(collectionSlug: string, fileName: string): Promise<T[]> {
  const code = `wizard-alchemy-${collectionSlug}`;
  const runtime = await getPublishedWikiCollectionRuntimeByCode(code);
  if (runtime) return unwrapDatasetItems(runtime.document) as T[];
  if (!shouldFallbackToLocalWikiCollectionData(code)) {
    throw new Error(`Required database runtime for ${code} did not load. Local fallback is disabled.`);
  }
  const raw = await fs.readFile(repoPath("data", "Wizard Alchemy", fileName), "utf8");
  return unwrapDatasetItems(JSON.parse(raw)) as T[];
}

async function readPotionPlannerData() {
  const [potions, materials] = await Promise.all([
    readDataset<WizardAlchemyPotion>("potions", "potions.json"),
    readDataset<WizardAlchemyMaterial>("materials", "materials.json")
  ]);
  return { potions, materials };
}

async function readRaceRerollData() {
  const races = await readDataset<WizardAlchemyRace>("races", "races.json");
  return { races };
}

export const loadWizardAlchemyPotionPlannerData = publicContentCache(
  readPotionPlannerData,
  ["wizard-alchemy-potion-planner-data"],
  { revalidate: 21600 }
);

export const loadWizardAlchemyRaceRerollData = publicContentCache(
  readRaceRerollData,
  ["wizard-alchemy-race-reroll-data"],
  { revalidate: 21600 }
);
