import type { GameCollectionViewConfig as BaseGameCollectionViewConfig } from "@/components/game-collections/GameCollectionView";
import type { GameCollectionGroup } from "../types";

export type GrowGardenCollectionConfig = BaseGameCollectionViewConfig & {
  file: string;
  navDescription: string;
  description: string;
  groupKey: string;
  groupLabel: string;
  stats: Array<{ key: string; label: string }>;
};

export const GROW_GARDEN_COLLECTIONS: GrowGardenCollectionConfig[] = [
  {
    slug: "crops",
    label: "Crops",
    file: "crops.json",
    navDescription: "Values, weights, harvest behavior, and availability.",
    description: "Browse every crop in Grow a Garden with value, weight, harvest behavior, and availability notes.",
    groupKey: "collectionGroup",
    groupLabel: "Tier",
    badgeKey: "tierBadge",
    subtitleKeys: ["harvestMode", "availability"],
    descriptionKey: "farmSummary",
    cardDescriptionKey: "farmSummary",
    hideImages: false,
    stats: [
      { key: "purchasePrice", label: "Price" },
      { key: "averageValue", label: "Average value" },
      { key: "averageWeight", label: "Average weight" },
      { key: "hugeChance", label: "Huge chance" }
    ],
    maxStats: 4
  },
  {
    slug: "seeds",
    label: "Seeds",
    file: "seeds.json",
    navDescription: "Shop access, crafting, and seed pack sources.",
    description: "Compare Grow a Garden seeds by tier, harvest type, shop access, crafting routes, and pack availability.",
    groupKey: "collectionGroup",
    groupLabel: "Tier",
    badgeKey: "tierBadge",
    subtitleKeys: ["harvestType", "availability"],
    descriptionKey: "secondarySummary",
    cardDescriptionKey: "secondarySummary",
    hideImages: false,
    stats: [
      { key: "shopCount", label: "Shop entries" },
      { key: "craftingCount", label: "Crafting" },
      { key: "packCount", label: "Seed packs" }
    ],
    maxStats: 3
  },
  {
    slug: "pets",
    label: "Pets",
    file: "pets.json",
    navDescription: "Egg sources, merchant sources, and abilities.",
    description: "See every Grow a Garden pet grouped by rarity with egg sources, merchant availability, and ability counts.",
    groupKey: "collectionGroup",
    groupLabel: "Rarity",
    badgeKey: "tierBadge",
    subtitleKeys: ["availability"],
    descriptionKey: "secondarySummary",
    cardDescriptionKey: "secondarySummary",
    hideImages: false,
    stats: [
      { key: "eggCount", label: "Eggs" },
      { key: "merchantCount", label: "Merchants" },
      { key: "abilityCount", label: "Abilities" }
    ],
    maxStats: 3
  },
  {
    slug: "eggs",
    label: "Eggs",
    file: "eggs.json",
    navDescription: "Hatch times, drop pools, and availability.",
    description: "Track Grow a Garden egg types by shop category, hatch time, obtainable status, and pet drop pool size.",
    groupKey: "collectionGroup",
    groupLabel: "Egg category",
    subtitleKeys: ["hatchTime", "availability"],
    descriptionKey: "probabilityText",
    cardDescriptionKey: "probabilityText",
    hideImages: false,
    stats: [{ key: "dropCount", label: "Pet drops" }],
    maxStats: 1
  },
  {
    slug: "gears",
    label: "Gears",
    file: "gears.json",
    navDescription: "Gear categories, prices, stock, and effects.",
    description: "Browse Grow a Garden gear by category with price, stock ranges, and what each tool actually does.",
    groupKey: "collectionGroup",
    groupLabel: "Category",
    subtitleKeys: ["availability"],
    descriptionKey: "use",
    cardDescriptionKey: "use",
    stats: [
      { key: "price", label: "Price" },
      { key: "stock", label: "Stock" }
    ],
    maxStats: 2
  },
  {
    slug: "crop-mutations",
    label: "Crop Mutations",
    file: "crop-mutations.json",
    navDescription: "Multipliers, visuals, and trigger sources.",
    description: "Review Grow a Garden crop mutations with multipliers, appearance notes, and the ways each mutation can be applied.",
    groupKey: "collectionGroup",
    groupLabel: "Category",
    badgeKey: "multiplier",
    descriptionKey: "obtainment",
    cardDescriptionKey: "visualDescription",
    hideImages: false,
    stats: [{ key: "multiplier", label: "Multiplier" }],
    maxStats: 1
  },
  {
    slug: "pet-mutations",
    label: "Pet Mutations",
    file: "pet-mutations.json",
    navDescription: "Mutation types, odds, and passive boosts.",
    description: "Compare Grow a Garden pet mutations by type, chance, XP boost, and sell multiplier.",
    groupKey: "collectionGroup",
    groupLabel: "Type",
    descriptionKey: "passive",
    cardDescriptionKey: "passive",
    hideImages: false,
    stats: [
      { key: "amount", label: "Amount" },
      { key: "chance", label: "Chance" },
      { key: "petSellMultiplier", label: "Sell" }
    ],
    maxStats: 3
  },
  {
    slug: "weather",
    label: "Weather",
    file: "weather.json",
    navDescription: "Standard, event, and admin weather effects.",
    description: "Browse Grow a Garden weather types and see which effects, mutations, and gameplay changes each one brings.",
    groupKey: "collectionGroup",
    groupLabel: "Category",
    descriptionKey: "details",
    cardDescriptionKey: "effects",
    hideImages: false,
    stats: [],
    maxStats: 0
  },
  {
    slug: "merchants",
    label: "Merchants",
    file: "merchants.json",
    navDescription: "Spawn merchants and what they sell.",
    description: "See Grow a Garden merchants, how they appear, and the kinds of seeds, pets, gear, or event items they offer.",
    groupKey: "collectionGroup",
    groupLabel: "Type",
    descriptionKey: "function",
    cardDescriptionKey: "function",
    hideImages: false,
    stats: [],
    maxStats: 0
  },
  {
    slug: "npcs",
    label: "NPCs",
    file: "npcs.json",
    navDescription: "Important NPC roles and interaction notes.",
    description: "Track Grow a Garden NPCs and what each one does, from quest helpers to themed event characters and shop mascots.",
    groupKey: "collectionGroup",
    groupLabel: "Type",
    subtitleKeys: ["birthday"],
    descriptionKey: "function",
    cardDescriptionKey: "function",
    hideImages: false,
    stats: [],
    maxStats: 0
  },
  {
    slug: "shops",
    label: "Shops",
    file: "shops.json",
    navDescription: "Refresh cycles, currencies, and NPC owners.",
    description: "Compare Grow a Garden shops by owner, currency, and refresh cadence so you know where items rotate in and out.",
    groupKey: "collectionGroup",
    groupLabel: "Currency",
    badgeKey: "npc",
    subtitleKeys: ["refreshCadence"],
    descriptionKey: "description",
    cardDescriptionKey: "description",
    hideImages: false,
    stats: [],
    maxStats: 0
  },
  {
    slug: "seed-packs",
    label: "Seed Packs",
    file: "seed-packs.json",
    navDescription: "Pack types, contents, prices, and dates added.",
    description: "Browse Grow a Garden seed packs with obtainment notes, pack contents, prices, and release timing.",
    groupKey: "collectionGroup",
    groupLabel: "Pack type",
    badgeKey: "availability",
    subtitleKeys: ["dateAdded"],
    descriptionKey: "obtainment",
    cardDescriptionKey: "obtainment",
    stats: [
      { key: "price", label: "Price" },
      { key: "contentsCount", label: "Contents" }
    ],
    maxStats: 2
  },
  {
    slug: "crafting-recipes",
    label: "Crafting Recipes",
    file: "crafting-recipes.json",
    navDescription: "Seed, sprinkler, and item crafting routes.",
    description: "Check Grow a Garden crafting recipes by category with craft time, ingredient summary, and alternative prices.",
    groupKey: "collectionGroup",
    groupLabel: "Category",
    subtitleKeys: ["craftTime"],
    descriptionKey: "recipe",
    cardDescriptionKey: "recipe",
    hideImages: false,
    stats: [{ key: "alternativePrices", label: "Alternative price" }],
    maxStats: 1
  },
  {
    slug: "food",
    label: "Food",
    file: "food.json",
    navDescription: "Cooking outputs, recipe groups, and base stats.",
    description: "Browse Grow a Garden food recipes with recipe groups, cook time, and base weight for each dish.",
    groupKey: "collectionGroup",
    groupLabel: "Category",
    descriptionKey: "recipes",
    cardDescriptionKey: "recipes",
    hideImages: false,
    stats: [
      { key: "baseTime", label: "Base time" },
      { key: "baseWeight", label: "Base weight" }
    ],
    maxStats: 2
  },
  {
    slug: "currencies",
    label: "Currencies",
    file: "currencies.json",
    navDescription: "Core currencies and how they are earned.",
    description: "See the main currencies used in Grow a Garden and the primary ways players earn or exchange them.",
    groupKey: "collectionGroup",
    groupLabel: "Category",
    badgeKey: "availability",
    descriptionKey: "obtainment",
    cardDescriptionKey: "obtainment",
    hideImages: false,
    stats: [],
    maxStats: 0
  },
  {
    slug: "cosmetics",
    label: "Cosmetics",
    file: "cosmetics.json",
    navDescription: "Every cosmetic with price and source.",
    description: "Browse every Grow a Garden cosmetic by source, from the cosmetics shop and crates to event, code, and achievement rewards.",
    groupKey: "collectionGroup",
    groupLabel: "Source",
    subtitleKeys: [],
    descriptionKey: "flavor",
    cardDescriptionKey: "flavor",
    hideImages: false,
    stats: [
      { key: "price", label: "Price" },
      { key: "dropChance", label: "Drop chance" }
    ],
    maxStats: 2,
    fieldPresentation: {
      price: { kind: "chip", label: "Price", omitWhenEmpty: true },
      dropChance: { kind: "chip", label: "Drop chance", omitWhenEmpty: true },
      flavor: { kind: "detail", label: "Description", omitWhenEmpty: true }
    }
  },
  {
    slug: "cosmetic-crates",
    label: "Cosmetic Crates",
    file: "cosmetic-crates.json",
    navDescription: "Crate prices, tiers, and drop pools.",
    description: "Compare Grow a Garden cosmetic crates by price, tier, and what their drop pools contain.",
    groupKey: "collectionGroup",
    groupLabel: "Group",
    badgeKey: "tier",
    subtitleKeys: ["added"],
    descriptionKey: "poolSample",
    cardDescriptionKey: "poolSample",
    hideImages: false,
    stats: [
      { key: "price", label: "Price" },
      { key: "tier", label: "Tier" }
    ],
    maxStats: 2
  },
  {
    slug: "ascension-upgrades",
    label: "Ascension Upgrades",
    file: "ascension-upgrades.json",
    navDescription: "Garden Coin upgrades from the ascension shop.",
    description: "See every Garden Ascension shop upgrade with its effect, purchase cap, and Garden Coin price.",
    groupKey: "collectionGroup",
    groupLabel: "Group",
    subtitleKeys: ["maxPurchases"],
    descriptionKey: "effect",
    cardDescriptionKey: "effect",
    hideImages: false,
    stats: [
      { key: "price", label: "Price" },
      { key: "maxPurchases", label: "Max buys" }
    ],
    maxStats: 2
  }
];

export const growAGardenCollectionGroup = {
  gameSlug: "grow-a-garden",
  gameName: "Grow a Garden",
  universeId: 7436755782,
  dataDir: "Grow a Garden",
  universeNames: ["Grow a Garden"],
  collections: GROW_GARDEN_COLLECTIONS.map(({ slug }) => slug)
} satisfies GameCollectionGroup;
