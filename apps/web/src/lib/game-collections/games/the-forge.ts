import type {
  CollectionFieldKind,
  CollectionFieldPresentation,
  GameCollectionViewConfig as BaseGameCollectionViewConfig
} from "@/components/game-collections/GameCollectionView";
import type { GameCollectionGroup } from "../types";

export type GameCollectionViewConfig = BaseGameCollectionViewConfig & {
  file: string;
  navDescription: string;
  description: string;
  groupKey: string;
  groupLabel: string;
  stats: Array<{ key: string; label: string }>;
  fieldPresentation?: Record<string, CollectionFieldPresentation | CollectionFieldKind>;
  linkKey?: string;
};

export const THE_FORGE_COLLECTIONS: GameCollectionViewConfig[] = [
  {
    slug: "ores",
    label: "Ores",
    file: "ores.json",
    navDescription: "Regions, rarities, drop chances, and multipliers.",
    description: "Browse every ore in The Forge with drop chances, multipliers, and regions.",
    groupKey: "region",
    groupLabel: "Region",
    badgeKey: "rarity",
    descriptionKey: "description",
    stats: [
      { key: "dropChance", label: "Drop" },
      { key: "multiplier", label: "Multiplier" },
      { key: "sellPrice", label: "Sell" },
      { key: "rocks", label: "Rock" },
      { key: "trait", label: "Trait" }
    ],
    maxStats: 4
  },
  {
    slug: "weapons",
    label: "Weapons",
    file: "weapons.json",
    navDescription: "Weapon classes with damage, speed, and range.",
    description: "Compare every forgeable weapon in The Forge grouped by class.",
    groupKey: "class",
    groupLabel: "Weapon class",
    stats: [
      { key: "baseDamage", label: "Damage" },
      { key: "attackSpeed", label: "Speed" },
      { key: "range", label: "Range" },
      { key: "sellPrice", label: "Sell" },
      { key: "chance", label: "Forge" }
    ],
    maxStats: 4
  },
  {
    slug: "armors",
    label: "Armors",
    file: "armors.json",
    navDescription: "Armor classes and slots with health values.",
    description: "See every armor piece in The Forge, grouped by armor class.",
    groupKey: "class",
    groupLabel: "Armor class",
    badgeKey: "slot",
    stats: [
      { key: "baseHealth", label: "Base health" },
      { key: "sellPrice", label: "Sell" },
      { key: "chance", label: "Forge" }
    ],
    maxStats: 3
  },
  {
    slug: "pickaxes",
    label: "Pickaxes",
    file: "pickaxes.json",
    navDescription: "Power, speed, luck, and where to find them.",
    description: "Explore every pickaxe in The Forge with power, speed, and luck stats.",
    groupKey: "category",
    groupLabel: "Region",
    subtitleKeys: ["location"],
    stats: [
      { key: "power", label: "Power" },
      { key: "speed", label: "Speed" },
      { key: "luck", label: "Luck" },
      { key: "slots", label: "Slots" },
      { key: "cost", label: "Cost" }
    ],
    linkKey: "link",
    maxStats: 4
  },
  {
    slug: "runes",
    label: "Runes",
    file: "runes.json",
    navDescription: "Elements, rarities, and effects.",
    description: "All The Forge runes with elements, rarities, and effects.",
    groupKey: "element",
    groupLabel: "Element",
    badgeKey: "rarity",
    descriptionKey: "effect",
    stats: [{ key: "primaryDrop", label: "Primary drop" }],
    linkKey: "link",
    maxStats: 2
  },
  {
    slug: "races",
    label: "Races",
    file: "races.json",
    navDescription: "Race tiers, rarities, and stat bonuses.",
    description: "Every The Forge race with tiers, roll chances, and stat bonuses.",
    groupKey: "tier",
    groupLabel: "Tier",
    badgeKey: "rarity",
    stats: [
      { key: "rollChance", label: "Roll" },
      { key: "damage", label: "Damage" },
      { key: "health", label: "Health" },
      { key: "speed", label: "Speed" }
    ],
    linkKey: "link",
    maxStats: 4
  },
  {
    slug: "essences",
    label: "Essences",
    file: "essences.json",
    navDescription: "Essence tiers with quick descriptions.",
    description: "All The Forge essences organized by tier.",
    groupKey: "tier",
    groupLabel: "Tier",
    descriptionKey: "description",
    stats: [],
    linkKey: "link",
    maxStats: 2
  },
  {
    slug: "totems",
    label: "Totems",
    file: "totems.json",
    navDescription: "Totem costs and effects.",
    description: "Every The Forge totem with cost and effect details.",
    groupKey: "section",
    groupLabel: "Section",
    descriptionKey: "effect",
    stats: [{ key: "cost", label: "Cost" }],
    linkKey: "link",
    maxStats: 2
  },
  {
    slug: "potions",
    label: "Potions",
    file: "potions.json",
    navDescription: "Potion costs and effects.",
    description: "Every The Forge potion with cost and effect details.",
    groupKey: "section",
    groupLabel: "Section",
    descriptionKey: "effect",
    stats: [{ key: "cost", label: "Cost" }],
    linkKey: "link",
    maxStats: 2
  },
  {
    slug: "enemies",
    label: "Enemies",
    file: "enemies.json",
    navDescription: "Enemy stats and rewards by area.",
    description: "The Forge enemy list with stats, gold, and experience rewards.",
    groupKey: "area",
    groupLabel: "Area",
    badgeKey: "level",
    subtitleKeys: ["group"],
    stats: [
      { key: "health", label: "Health" },
      { key: "damage", label: "Damage" },
      { key: "gold", label: "Gold" },
      { key: "experience", label: "XP" }
    ],
    linkKey: "link",
    maxStats: 4
  },
  {
    slug: "npcs",
    label: "NPCs",
    file: "npcs.json",
    navDescription: "NPC roles and locations.",
    description: "The Forge NPC roster and their roles.",
    groupKey: "area",
    groupLabel: "Area",
    badgeKey: "role",
    subtitleKeys: ["location"],
    hideImages: true,
    stats: [],
    maxStats: 0
  },
  {
    slug: "quests",
    label: "Quests",
    file: "quests.json",
    navDescription: "Quest objectives grouped by world and NPC.",
    description: "Track The Forge quests by world, NPC, and listed objectives.",
    groupKey: "world",
    groupLabel: "World",
    badgeKey: "status",
    subtitleKeys: ["npc"],
    descriptionKey: "objectives",
    cardDescriptionKey: "objectives",
    hideImages: true,
    stats: [],
    maxStats: 0
  },
  {
    slug: "skills",
    label: "Skills",
    file: "skills.json",
    navDescription: "Achievement skills, unlock requirements, and boosts.",
    description: "Compare The Forge skill boosts and the achievements used to unlock them.",
    groupKey: "boost",
    groupLabel: "Boost",
    badgeKey: "boost",
    subtitleKeys: ["requirement"],
    descriptionKey: "summary",
    cardDescriptionKey: "summary",
    hideImages: true,
    stats: [],
    maxStats: 0
  },
  {
    slug: "blueprints",
    label: "Blueprints",
    file: "blueprints.json",
    navDescription: "Weapon and armor blueprints with sources and availability.",
    description: "See The Forge blueprints, where they come from, and whether they are available.",
    groupKey: "source",
    groupLabel: "Source",
    badgeKey: "availability",
    subtitleKeys: ["itemType"],
    descriptionKey: "howToGet",
    cardDescriptionKey: "howToGet",
    hideImages: true,
    stats: [],
    maxStats: 0
  },
  {
    slug: "locations",
    label: "Locations",
    file: "locations.json",
    navDescription: "Important locations grouped by area.",
    description: "The Forge locations organized by area and type.",
    groupKey: "area",
    groupLabel: "Area",
    badgeKey: "type",
    descriptionKey: "description",
    stats: [],
    linkKey: "link",
    maxStats: 2
  }
];

export const theForgeCollectionGroup = {
  gameSlug: "the-forge",
  gameName: "The Forge",
  dataDir: "The Forge",
  universeNames: ["The Forge"],
  collections: THE_FORGE_COLLECTIONS.map(({ slug }) => slug)
} satisfies GameCollectionGroup;
