import fs from "node:fs/promises";
import { repoPath } from "@/lib/paths";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { CatalogSelectNav } from "@/components/CatalogSelectNav";
import { processHtmlLinks } from "@/lib/link-utils";
import { breadcrumbJsonLd, SITE_URL, webPageJsonLd } from "@/lib/seo";
import { ForgeCatalogView } from "../the-forge/ForgeCatalogView";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { ContentFaq } from "@/components/ContentFaq";
import { renderPageContentNodes } from "@/lib/page-content";
import {
  buildGameDatasetCatalogPath,
  GAME_DATASET_CATALOGS,
  getFieldLabel,
  getGameDatasetCatalogConfigByCode,
  type GameDatasetCatalogConfig
} from "@/lib/game-dataset-catalogs";

const FALLBACK_IMAGE = "/og-image.png";

export type GameDatasetCatalogContentHtml = {
  id?: string | null;
  title?: string | null;
  introHtml?: string;
  howHtml?: string;
  descriptionHtml?: Array<{ key: string; html: string }>;
  faqHtml?: Array<{ q: string; a: string }>;
  updatedAt?: string | null;
};

type GameDatasetSource = {
  label?: string | null;
  url?: string | null;
  accessed?: string | null;
};

export type GameDatasetMeta = {
  title?: string | null;
  updatedAt?: string | null;
  sources?: GameDatasetSource[] | null;
  columns?: string[] | null;
};

export type GameDatasetCatalogItem = {
  id: string;
  name: string;
  image?: string | null;
  [key: string]: unknown;
};

export type GameDatasetCatalogDataset = {
  meta: GameDatasetMeta | null;
  columns: string[];
  items: GameDatasetCatalogItem[];
};

type GenericViewConfig = {
  slug: string;
  label: string;
  groupLabel: string;
  groupKey: string;
  stats: Array<{ key: string; label: string }>;
  maxStats?: number;
  badgeKey?: string;
  subtitleKeys?: string[];
  descriptionKey?: string;
  cardDescriptionKey?: string;
  hideImages?: boolean;
};

type CatalogSectionOverride = {
  groupKey: string;
  groupLabel: string;
  sectionOrder: string[];
  getSectionLabel: (item: GameDatasetCatalogItem) => string | null;
  hiddenKeys?: string[];
  additionalColumns?: string[];
  maxStats?: number;
  transformItem?: (item: GameDatasetCatalogItem) => GameDatasetCatalogItem;
};

const DESCRIPTION_MD_KEY = "description-md";

const ADOPT_ME_GIFTS_SECTION_ORDER = [
  "Gift Display rolls",
  "Accessory and wing chests",
  "Special reward boxes",
  "Event pet boxes",
  "Standard and premium event boxes",
  "Mixed seasonal gift boxes"
];

const ADOPT_ME_GIFTS_SECTION_BY_NAME: Record<string, string> = {
  "Small Gift": "Gift Display rolls",
  "Big Gift": "Gift Display rolls",
  "Massive Gift": "Gift Display rolls",
  "Standard Chest": "Accessory and wing chests",
  "Regal Chest": "Accessory and wing chests",
  "Standard Wing Chest": "Accessory and wing chests",
  "Regal Wing Chest": "Accessory and wing chests",
  "RGB Reward Box": "Special reward boxes",
  "2D Box": "Special reward boxes",
  "Admin Abuse Box": "Special reward boxes",
  "1000 Bucks Silk Bag": "Special reward boxes",
  "Rat Box": "Event pet boxes",
  "Bat Box": "Event pet boxes",
  "Ox Box": "Event pet boxes",
  "Halloween Mummy Cat Box": "Event pet boxes",
  "Walrus Box": "Event pet boxes",
  "Lunar Tiger Box": "Event pet boxes",
  "Wolf Box": "Event pet boxes",
  "Pony Box": "Event pet boxes",
  "Moon Bear Box": "Event pet boxes",
  "Duckling Box": "Event pet boxes",
  "Hermit Crab Box": "Event pet boxes",
  "Scarecrow Box": "Event pet boxes",
  "Hare Box": "Event pet boxes",
  "Easter Eggy Box": "Event pet boxes",
  "Halloween Chick Box": "Event pet boxes",
  "Ice Tray": "Event pet boxes",
  "Kaijunior Box": "Event pet boxes",
  "Kelp Raider Box": "Event pet boxes",
  "Spider Box": "Event pet boxes",
  "Aberdeen Angus Box": "Event pet boxes",
  "Choccybunny Box": "Event pet boxes",
  "Monkey Box": "Standard and premium event boxes",
  "Premium Monkey Box": "Standard and premium event boxes",
  "Standard Gorilla Box": "Standard and premium event boxes",
  "Premium Gorilla Box": "Standard and premium event boxes",
  "Standard Capuchin Box": "Standard and premium event boxes",
  "Premium Capuchin Box": "Standard and premium event boxes",
  "Standard Gibbon Box": "Standard and premium event boxes",
  "Premium Gibbon Box": "Standard and premium event boxes",
  "Christmas Gift": "Mixed seasonal gift boxes",
  "Golden Gift": "Mixed seasonal gift boxes",
  "Lunar New Year Gift Box": "Mixed seasonal gift boxes",
  "Special Lunar New Year Gift Box": "Mixed seasonal gift boxes",
  "Box of Jokes": "Mixed seasonal gift boxes",
  "Golden Mistletoe": "Mixed seasonal gift boxes"
};

const SAILOR_PIECE_FRUITS_SECTION_ORDER = ["S+", "S", "A", "B", "C", "D"];
const SAILOR_PIECE_TIER_SECTION_ORDER = ["S+", "S", "A", "B", "C", "D"];
const SAILOR_PIECE_TOP_TIER_SECTION_ORDER = ["S+", "S", "A", "B", "C"];
const SAILOR_PIECE_ISLANDS_SECTION_ORDER = ["Early Islands", "Mid Islands", "Endgame Islands"];
const SAILOR_PIECE_DUNGEONS_SECTION_ORDER = [
  "15-wave farming runs",
  "Shadow Monarch boss dungeon",
  "Endless tower climb"
];
const SAILOR_PIECE_TITLE_SECTION_ORDER = ["Damage", "Farming", "Luck"];
const SAILOR_PIECE_GUILD_SECTION_ORDER = ["Guild Key Sources", "Guild Upgrades"];
const SAILOR_PIECE_RELIC_SECTION_ORDER = ["Raw damage", "Drop farming", "Critical stats"];
const SAILOR_PIECE_HAKI_SECTION_ORDER = [
  "First defensive unlock",
  "Main damage unlock",
  "Endgame Haki unlock"
];

const SAILOR_PIECE_RAW_CARD_KEYS = [
  "description",
  "stats",
  "abilities",
  "pros",
  "cons",
  "drops",
  "acquisition",
  "unlock",
  "strategy",
  "obtainment",
  "usageTips",
  "sections",
  "type",
  "category"
];

const CATALOG_SECTION_OVERRIDES: Record<string, CatalogSectionOverride> = {
  "sailor-piece-fruits": {
    groupKey: "tier",
    groupLabel: "Fruit tier",
    sectionOrder: SAILOR_PIECE_FRUITS_SECTION_ORDER,
    additionalColumns: ["bestFor", "combatRole", "mainStrength", "mainLimit", "spinChance"],
    hiddenKeys: [
      "description",
      "stats",
      "abilities",
      "pros",
      "cons",
      "drops",
      "acquisition",
      "unlock",
      "strategy",
      "obtainment",
      "usageTips",
      "category"
    ],
    getSectionLabel: getTierSection
  },
  "sailor-piece-islands": {
    groupKey: "sea",
    groupLabel: "Island stage",
    sectionOrder: SAILOR_PIECE_ISLANDS_SECTION_ORDER,
    additionalColumns: ["mainRole", "keyContent", "progressionUse"],
    hiddenKeys: [
      "description",
      "activities",
      "raw",
      "sections",
      "location",
      "cost",
      "maxLevel",
      "maxBonus",
      "tier",
      "difficulty",
      "boss",
      "time"
    ],
    getSectionLabel: getSeaSection
  },
  "sailor-piece-accessories": {
    groupKey: "tier",
    groupLabel: "Accessory tier",
    sectionOrder: SAILOR_PIECE_TIER_SECTION_ORDER,
    additionalColumns: ["defense", "damage", "damageReduction", "sourceRoute", "dropOrCost", "bestFor"],
    hiddenKeys: SAILOR_PIECE_RAW_CARD_KEYS,
    getSectionLabel: getTierSection
  },
  "sailor-piece-dungeons": {
    groupKey: "catalogSection",
    groupLabel: "Dungeon type",
    sectionOrder: SAILOR_PIECE_DUNGEONS_SECTION_ORDER,
    additionalColumns: [
      "runType",
      "level",
      "entryItem",
      "location",
      "maxPlayers",
      "formatTime",
      "bossCheckpoint",
      "mainRewards",
      "importantRule"
    ],
    hiddenKeys: SAILOR_PIECE_RAW_CARD_KEYS,
    maxStats: 8,
    getSectionLabel: getCatalogSection
  },
  "sailor-piece-races": {
    groupKey: "tier",
    groupLabel: "Race tier",
    sectionOrder: SAILOR_PIECE_TOP_TIER_SECTION_ORDER,
    additionalColumns: ["rollRarity", "bestFor", "coreBonus", "hasV4", "requiredFor"],
    hiddenKeys: [...SAILOR_PIECE_RAW_CARD_KEYS, "rarity"],
    getSectionLabel: getTierSection
  },
  "sailor-piece-traits": {
    groupKey: "tier",
    groupLabel: "Trait tier",
    sectionOrder: SAILOR_PIECE_TIER_SECTION_ORDER,
    additionalColumns: ["damageMultiplier", "defenseMultiplier", "cooldownReduction", "bestFor"],
    hiddenKeys: SAILOR_PIECE_RAW_CARD_KEYS,
    getSectionLabel: getTierSection
  },
  "sailor-piece-bloodlines": {
    groupKey: "tier",
    groupLabel: "Bloodline tier",
    sectionOrder: ["S+", "A", "B", "C", "D"],
    additionalColumns: ["damage", "hp", "luck", "weaponBonus", "sustainDefense", "utilityBonus", "sourcePity", "specialUse"],
    hiddenKeys: [...SAILOR_PIECE_RAW_CARD_KEYS, "effect", "bonus", "recipe", "requirements", "tags", "rarity"],
    maxStats: 8,
    getSectionLabel: getTierSection
  },
  "sailor-piece-bosses": {
    groupKey: "bossStage",
    groupLabel: "Boss stage",
    sectionOrder: SAILOR_PIECE_ISLANDS_SECTION_ORDER,
    additionalColumns: ["difficulty", "level", "hp", "encounterType", "respawnAccess", "dropCount", "notableDrops"],
    hiddenKeys: [...SAILOR_PIECE_RAW_CARD_KEYS, "tier", "rarity", "region"],
    maxStats: 7,
    getSectionLabel: getBossStage
  },
  "sailor-piece-swords": {
    groupKey: "tier",
    groupLabel: "Sword tier",
    sectionOrder: SAILOR_PIECE_TOP_TIER_SECTION_ORDER,
    additionalColumns: ["baseDamage", "attackSpeed", "masteryRequired", "sourceRoute", "bestFor", "unlockNote"],
    hiddenKeys: SAILOR_PIECE_RAW_CARD_KEYS,
    getSectionLabel: getTierSection
  },
  "sailor-piece-guilds": {
    groupKey: "catalogSection",
    groupLabel: "Guild system",
    sectionOrder: SAILOR_PIECE_GUILD_SECTION_ORDER,
    additionalColumns: [
      "location",
      "encounter",
      "dropChance",
      "spawnRequirement",
      "maxBonus",
      "appliesTo",
      "upgradeRole"
    ],
    hiddenKeys: [...SAILOR_PIECE_RAW_CARD_KEYS, "tier", "rarity", "effect", "bonus", "recipe", "requirements", "tags"],
    maxStats: 7,
    getSectionLabel: getCatalogSection
  },
  "sailor-piece-titles": {
    groupKey: "titleRole",
    groupLabel: "Title role",
    sectionOrder: SAILOR_PIECE_TITLE_SECTION_ORDER,
    additionalColumns: ["tier", "bonus", "unlockRoute", "requirement", "dropOrPity", "availability", "bestFor"],
    hiddenKeys: [...SAILOR_PIECE_RAW_CARD_KEYS, "effect", "recipe", "requirements", "tags", "rarity"],
    maxStats: 7,
    getSectionLabel: getTitleRoleSection
  },
  "sailor-piece-melee-specs": {
    groupKey: "tier",
    groupLabel: "Melee tier",
    sectionOrder: SAILOR_PIECE_TIER_SECTION_ORDER,
    additionalColumns: [
      "statPriority",
      "unlockRoute",
      "sourceLocation",
      "abilityCount",
      "signatureMove",
      "mainStrength",
      "mainLimit",
      "verificationNote"
    ],
    hiddenKeys: [...SAILOR_PIECE_RAW_CARD_KEYS, "rarity"],
    maxStats: 8,
    getSectionLabel: getTierSection
  },
  "sailor-piece-runes": {
    groupKey: "tier",
    groupLabel: "Rune tier",
    sectionOrder: SAILOR_PIECE_TIER_SECTION_ORDER,
    additionalColumns: ["displayRarity", "source", "bonusType", "baseEffect", "maxEffect", "bestFor", "dropNote"],
    hiddenKeys: [...SAILOR_PIECE_RAW_CARD_KEYS, "rarity"],
    maxStats: 7,
    getSectionLabel: getTierSection
  },
  "sailor-piece-clans": {
    groupKey: "tier",
    groupLabel: "Clan tier",
    sectionOrder: SAILOR_PIECE_TOP_TIER_SECTION_ORDER,
    additionalColumns: ["rarity", "bestFor", "bonusSummary", "passive", "requirement"],
    hiddenKeys: SAILOR_PIECE_RAW_CARD_KEYS,
    maxStats: 5,
    getSectionLabel: getTierSection
  },
  "sailor-piece-relics": {
    groupKey: "catalogSection",
    groupLabel: "Relic role",
    sectionOrder: SAILOR_PIECE_RELIC_SECTION_ORDER,
    additionalColumns: ["effect", "recipe", "partRoute", "bestFor"],
    hiddenKeys: [...SAILOR_PIECE_RAW_CARD_KEYS, "bonus", "tags", "rarity"],
    getSectionLabel: getCatalogSection
  },
  "sailor-piece-haki": {
    groupKey: "catalogSection",
    groupLabel: "Progression role",
    sectionOrder: SAILOR_PIECE_HAKI_SECTION_ORDER,
    additionalColumns: ["role", "unlockRoute", "requirements", "maxLevel", "maxEffect", "levelingRoute"],
    hiddenKeys: [...SAILOR_PIECE_RAW_CARD_KEYS, "rarity"],
    maxStats: 6,
    getSectionLabel: getCatalogSection
  },
  "adopt-me-accessory-shop": {
    groupKey: "category",
    groupLabel: "Shop section",
    sectionOrder: ["Accessory Chests", "Obtainable Pets"],
    getSectionLabel: getCategorySection
  },
  "adopt-me-eggs": {
    groupKey: "catalogSection",
    groupLabel: "Egg route",
    sectionOrder: [
      "Nursery and VIP eggs",
      "Rotating gumball eggs",
      "Star Rewards eggs",
      "Pet Releaser eggs",
      "Event and special eggs",
      "Admin Abuse egg"
    ],
    getSectionLabel: getAdoptMeEggSection
  },
  "adopt-me-food": {
    groupKey: "category",
    groupLabel: "Food type",
    sectionOrder: ["Edible Food", "Drinkable Drinks", "Candy", "Potions", "Special Potions"],
    getSectionLabel: getCategorySection
  },
  "adopt-me-gift-prizes": {
    groupKey: "catalogSection",
    groupLabel: "Prize rarity",
    sectionOrder: ["Common", "Uncommon", "Rare", "Ultra-Rare", "Legendary", "Legacy or uncategorized prizes"],
    getSectionLabel: getAdoptMeGiftPrizeSection,
    hiddenKeys: ["rarity"],
    additionalColumns: ["displayRarity"],
    transformItem: withDisplayRarity
  },
  "adopt-me-gifts": {
    groupKey: "catalogSection",
    groupLabel: "Gift type",
    sectionOrder: ADOPT_ME_GIFTS_SECTION_ORDER,
    getSectionLabel: (item) => ADOPT_ME_GIFTS_SECTION_BY_NAME[item.name] ?? null
  },
  "adopt-me-pet-ages": {
    groupKey: "catalogSection",
    groupLabel: "Age path",
    sectionOrder: ["Pet age stages"],
    getSectionLabel: () => "Pet age stages",
    hiddenKeys: ["age", "number"]
  },
  "adopt-me-pets": {
    groupKey: "catalogSection",
    groupLabel: "Source family",
    sectionOrder: [
      "Egg and hatch-pool pets",
      "Robux shop and premium treat pets",
      "Event and seasonal pets",
      "Reward, box, lure, and activity pets",
      "Temporary and special-case pets"
    ],
    getSectionLabel: getAdoptMePetSection,
    hiddenKeys: ["rarity"],
    additionalColumns: ["displayRarity"],
    transformItem: withDisplayRarity
  },
  "adopt-me-potions": {
    groupKey: "catalogSection",
    groupLabel: "Potion type",
    sectionOrder: [
      "Sky Castle Potions",
      "Age Potions",
      "Gamepass Potion",
      "Event/Gift Potions",
      "Cauldron Potions",
      "Tim's Cauldron Potions",
      "Legacy and special potions"
    ],
    getSectionLabel: getAdoptMePotionSection
  },
  "adopt-me-star-rewards": {
    groupKey: "category",
    groupLabel: "Star Rewards page",
    sectionOrder: ["First page of the Star Rewards", "Second page of the Star Rewards"],
    getSectionLabel: getCategorySection
  },
  "adopt-me-strollers": {
    groupKey: "category",
    groupLabel: "Source",
    sectionOrder: ["Baby Shop Strollers", "Other Obtainable Strollers", "Gifts Display Strollers", "Event Strollers"],
    getSectionLabel: getCategorySection
  },
  "adopt-me-toys": {
    groupKey: "catalogSection",
    groupLabel: "Toy role",
    sectionOrder: [
      "Pet play and leashes",
      "Movement toys",
      "Grapples, gliders, and teleport toys",
      "Roleplay and collectibles",
      "Music and performance toys",
      "Stands, seats, and placeable utility",
      "Event tools and special-use items"
    ],
    getSectionLabel: getAdoptMeToySection,
    hiddenKeys: ["rarity"],
    additionalColumns: ["displayRarity"],
    transformItem: withDisplayRarity
  },
  "adopt-me-vehicles": {
    groupKey: "category",
    groupLabel: "Source",
    sectionOrder: [
      "Vehicle Dealership Vehicles",
      "Other Obtainable Vehicles",
      "Gifts Display Vehicles",
      "Event Vehicles",
      "Premium Vehicles",
      "Star Rewards Vehicles",
      "RGB Reward Box Vehicles",
      "Redemption Kiosk Vehicles",
      "Temporary Vehicle"
    ],
    getSectionLabel: getCategorySection
  }
};

const STANDARD_RARITIES = new Set(["Common", "Uncommon", "Rare", "Ultra-Rare", "Legendary", "Event"]);

function getCategorySection(item: GameDatasetCatalogItem): string | null {
  return normalizeValue(item.category);
}

function getTierSection(item: GameDatasetCatalogItem): string | null {
  return normalizeValue(item.tier);
}

function getSeaSection(item: GameDatasetCatalogItem): string | null {
  return normalizeValue(item.sea);
}

function getCatalogSection(item: GameDatasetCatalogItem): string | null {
  return normalizeValue(item.catalogSection);
}

function getBossStage(item: GameDatasetCatalogItem): string | null {
  return normalizeValue(item.bossStage);
}

function getTitleRoleSection(item: GameDatasetCatalogItem): string | null {
  return normalizeValue(item.titleRole ?? item.category);
}

function withDisplayRarity(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  const rarity = normalizeValue(item.rarity);
  return {
    ...item,
    displayRarity: rarity && STANDARD_RARITIES.has(rarity) ? rarity : null
  };
}

function getAdoptMeEggSection(item: GameDatasetCatalogItem): string {
  const name = normalizeValue(item.name) ?? "";
  const key = name.toLowerCase();

  if (["starter egg", "cracked egg", "pet egg", "royal egg", "retired egg"].includes(key)) {
    return "Nursery and VIP eggs";
  }

  if (["golden egg", "diamond egg"].includes(key)) {
    return "Star Rewards eggs";
  }

  if (["basic egg", "crystal egg"].includes(key)) {
    return "Pet Releaser eggs";
  }

  if (key === "admin abuse egg") {
    return "Admin Abuse egg";
  }

  if (
    [
      "safari egg",
      "jungle egg",
      "farm egg",
      "aussie egg",
      "fossil egg",
      "ocean egg",
      "mythic egg",
      "woodland egg",
      "japan egg",
      "southeast asia egg",
      "danger egg",
      "urban egg",
      "desert egg",
      "garden egg",
      "moon egg",
      "royal moon egg",
      "aztec egg",
      "royal aztec egg",
      "endangered egg"
    ].includes(key)
  ) {
    return "Rotating gumball eggs";
  }

  return "Event and special eggs";
}

function getAdoptMeGiftPrizeSection(item: GameDatasetCatalogItem): string {
  const rarity = normalizeValue(item.rarity);
  return rarity && STANDARD_RARITIES.has(rarity) ? rarity : "Legacy or uncategorized prizes";
}

function getAdoptMePotionSection(item: GameDatasetCatalogItem): string {
  const category = normalizeValue(item.category);
  return category && category !== "Unknown" ? category : "Legacy and special potions";
}

function getAdoptMePetSection(item: GameDatasetCatalogItem): string {
  const name = normalizeValue(item.name) ?? "";
  const cost = normalizeValue(item.cost) ?? "";
  const availability = normalizeValue(item.availability) ?? "";
  const sourceTables = Array.isArray(item.sourceTables)
    ? item.sourceTables.map((value) => normalizeValue(value) ?? "").join(" ")
    : normalizeValue(item.sourceTables) ?? "";
  const haystack = `${name} ${cost} ${availability} ${sourceTables}`.toLowerCase();

  if (
    haystack.includes("temporary") ||
    haystack.includes("scoob") ||
    haystack.includes("2d kitty") ||
    haystack.includes("pumpkin friend")
  ) {
    return "Temporary and special-case pets";
  }

  if (
    haystack.includes("robux pets") ||
    haystack.includes("robux") ||
    haystack.includes("bundle") ||
    haystack.includes("golden clam") ||
    haystack.includes("honey") ||
    haystack.includes("golden wheat") ||
    haystack.includes("golden bone") ||
    haystack.includes("golden goldfish") ||
    haystack.includes("golden lettuce") ||
    haystack.includes("golden corn") ||
    haystack.includes("golden dandelion") ||
    haystack.includes("golden seed ball") ||
    haystack.includes("maple leaf treat") ||
    haystack.includes("mud ball") ||
    haystack.includes("diamond lavender") ||
    haystack.includes("golden petunia")
  ) {
    return "Robux shop and premium treat pets";
  }

  if (
    haystack.includes("box") ||
    haystack.includes("reward") ||
    haystack.includes("lure") ||
    haystack.includes("star reward") ||
    haystack.includes("mission") ||
    haystack.includes("ticket") ||
    haystack.includes("pet releaser") ||
    haystack.includes("rgb") ||
    haystack.includes("subscription") ||
    haystack.includes("pass") ||
    haystack.includes("task")
  ) {
    return "Reward, box, lure, and activity pets";
  }

  if (
    haystack.includes("event") ||
    haystack.includes("festival") ||
    haystack.includes("winter") ||
    haystack.includes("christmas") ||
    haystack.includes("halloween") ||
    haystack.includes("easter") ||
    haystack.includes("lunar") ||
    haystack.includes("summer") ||
    haystack.includes("spring") ||
    haystack.includes("sugar") ||
    haystack.includes("cherry blossom") ||
    haystack.includes("pride") ||
    haystack.includes("april fool") ||
    haystack.includes("birthday") ||
    haystack.includes("fairground") ||
    haystack.includes("state fair") ||
    haystack.includes("fossil isle") ||
    haystack.includes("games") ||
    haystack.includes("sunshine games") ||
    haystack.includes("monkey fairground") ||
    haystack.includes("gorilla fairground") ||
    haystack.includes("capuchin fairground") ||
    haystack.includes("gibbon fairground")
  ) {
    return "Event and seasonal pets";
  }

  return "Egg and hatch-pool pets";
}

function getAdoptMeToySection(item: GameDatasetCatalogItem): string {
  const name = normalizeValue(item.name) ?? "";
  const category = normalizeValue(item.category) ?? "";
  const interaction = normalizeValue(item.interaction) ?? "";
  const obtainedBy = normalizeValue(item.obtainedBy) ?? "";
  const haystack = `${name} ${category} ${interaction} ${obtainedBy}`.toLowerCase();

  if (
    haystack.includes("treasure key") ||
    haystack.includes("priceless jewel") ||
    haystack.includes("paint") ||
    haystack.includes("ingredient") ||
    haystack.includes("event tool") ||
    haystack.includes("mega neon") ||
    haystack.includes("event-specific")
  ) {
    return "Event tools and special-use items";
  }

  if (
    haystack.includes("leash") ||
    haystack.includes("throw toy") ||
    haystack.includes("chew toy") ||
    haystack.includes("flying disc") ||
    haystack.includes("ball") ||
    haystack.includes("fetch") ||
    haystack.includes("pet chase") ||
    haystack.includes("bring it back") ||
    haystack.includes("connects the player and pet")
  ) {
    return "Pet play and leashes";
  }

  if (
    haystack.includes("grappl") ||
    haystack.includes("glider") ||
    haystack.includes("teleport") ||
    haystack.includes("magic house door") ||
    haystack.includes("homeing rocket") ||
    haystack.includes("slimingo feather")
  ) {
    return "Grapples, gliders, and teleport toys";
  }

  if (
    haystack.includes("pogo") ||
    haystack.includes("balloon") ||
    haystack.includes("propeller") ||
    haystack.includes("float") ||
    haystack.includes("kite") ||
    haystack.includes("jump") ||
    haystack.includes("bounce") ||
    haystack.includes("fly up") ||
    haystack.includes("float into") ||
    haystack.includes("levitate")
  ) {
    return "Movement toys";
  }

  if (
    haystack.includes("stand") ||
    haystack.includes("bench") ||
    haystack.includes("tent") ||
    haystack.includes("sleeping bag") ||
    haystack.includes("throne") ||
    haystack.includes("seat") ||
    haystack.includes("sell") ||
    haystack.includes("sit")
  ) {
    return "Stands, seats, and placeable utility";
  }

  if (
    haystack.includes("drum") ||
    haystack.includes("guitar") ||
    haystack.includes("trumpet") ||
    haystack.includes("instrument") ||
    haystack.includes("bongos") ||
    haystack.includes("piano") ||
    haystack.includes("conch") ||
    haystack.includes("dance") ||
    haystack.includes("music") ||
    haystack.includes("play sound")
  ) {
    return "Music and performance toys";
  }

  return "Roleplay and collectibles";
}

const GROUP_KEY_PRIORITY = [
  "rarity",
  "tier",
  "category",
  "type",
  "sea",
  "sourceType",
  "status",
  "rewardCategory",
  "machine",
  "location",
  "building",
  "level"
];

const BADGE_KEY_PRIORITY = ["displayRarity", "rarity", "tier", "status", "type", "category", "sea"];

const SUBTITLE_KEY_PRIORITY = [
  "category",
  "type",
  "sea",
  "location",
  "building",
  "source",
  "sourceType",
  "availability",
  "status",
  "level",
  "cost",
  "price",
  "money",
  "robux",
  "requirements"
];

const DESCRIPTION_KEY_PRIORITY = [
  "description",
  "overview",
  "summary",
  "whatItDoes",
  "use",
  "effect",
  "benefits",
  "obtainment",
  "acquisition",
  "unlock",
  "usageTips",
  "notes",
  "visuals",
  "changesNotes",
  "appearance",
  "formation",
  "weather",
  "specialItemsAbilities",
  "reason",
  "descriptionNotes"
];

const STAT_KEY_PRIORITY = [
  "income",
  "cost",
  "price",
  "costBucks",
  "costStars",
  "money",
  "robux",
  "requiredCash",
  "requiredBrainrots",
  "multiplier",
  "maxChance",
  "spawnChance",
  "level",
  "exp",
  "expNeeded",
  "dodges",
  "health",
  "seats",
  "cannons",
  "speed",
  "requirements",
  "obtainment",
  "source",
  "bonuses",
  "drops",
  "abilities",
  "stats",
  "chances",
  "available",
  "availability"
];

const HIDDEN_FIELD_KEYS = new Set([
  "id",
  "slug",
  "name",
  "image",
  "sourceImageUrl",
  "sourcePage",
  "wikiUrl",
  "imageCandidate",
  "sourceTables",
  "fields",
  "raw",
  "rawText",
  "sections",
  "displayRarity",
  "updatedAt"
]);

export function getGameDatasetCatalogConfig(collectionCode: string): GameDatasetCatalogConfig | null {
  return getGameDatasetCatalogConfigByCode(collectionCode);
}

async function readDataset(
  config: GameDatasetCatalogConfig
): Promise<{ meta: GameDatasetMeta | null; rows: Record<string, unknown>[] }> {
  const datasetPath = repoPath("data", config.dataDir, config.file);
  const raw = await fs.readFile(datasetPath, "utf8");
  const parsed = JSON.parse(raw) as
    | { meta?: GameDatasetMeta | null; items?: Record<string, unknown>[] | null; data?: Record<string, unknown>[] | null }
    | Record<string, unknown>[];

  if (Array.isArray(parsed)) {
    return { meta: null, rows: parsed };
  }

  return {
    meta: parsed.meta ?? null,
    rows: parsed.items ?? parsed.data ?? []
  };
}

export async function loadGameDatasetCatalogDataset(
  config: GameDatasetCatalogConfig
): Promise<GameDatasetCatalogDataset> {
  try {
    const { meta, rows } = await readDataset(config);
    const items = uniquifyIds(rows.map(normalizeItem).filter(Boolean) as GameDatasetCatalogItem[]);
    return {
      meta,
      columns: resolveColumns(meta, rows, items),
      items
    };
  } catch (error) {
    console.error(`Failed to load ${config.code} catalog dataset`, error);
    return { meta: null, columns: [], items: [] };
  }
}

function normalizeItem(row: Record<string, unknown>): GameDatasetCatalogItem | null {
  const cleanedRow = cleanDatasetRecord(row) as Record<string, unknown>;
  const name = normalizeText(cleanedRow.name) ?? normalizeText(cleanedRow.title) ?? normalizeText(cleanedRow.item);
  if (!name) return null;

  const fields = isRecord(cleanedRow.fields) ? cleanedRow.fields : {};
  const flattenedFields = Object.fromEntries(
    Object.entries(fields).filter(([key]) => !(key in cleanedRow) && key !== "image" && key !== "item")
  );
  const rawSlug = normalizeText(cleanedRow.slug);
  const slug = rawSlug && !isHtmlDerivedSlug(rawSlug) ? rawSlug : toSlug(name);

  return {
    ...flattenedFields,
    ...cleanedRow,
    id: toSlug(slug || name),
    name,
    image: normalizeImage(row.image) ?? normalizeImage(row.imageCandidate) ?? null
  };
}

function cleanDatasetRecord(value: unknown, key = ""): unknown {
  if (typeof value === "string") {
    return shouldPreserveRawString(key) ? value : htmlToPlainText(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => cleanDatasetRecord(entry));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [entryKey, cleanDatasetRecord(entryValue, entryKey)])
    );
  }

  return value;
}

function shouldPreserveRawString(key: string): boolean {
  const normalizedKey = key.toLowerCase();
  return normalizedKey.includes("url") || normalizedKey.includes("image") || normalizedKey === "src";
}

function isHtmlDerivedSlug(value: string): boolean {
  return /^(a-href|img-|span-|div-)-/i.test(value) || /static-wikia-nocookie|mw-file-description/i.test(value);
}

function htmlToPlainText(value: string): string {
  const trimmed = value.trim();
  if (!/[<&]/.test(trimmed)) return trimmed.replace(/\s+/g, " ");

  const fallbackFromImage = extractImageLabel(trimmed);
  const withoutHidden = trimmed
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const stripped = decodeHtmlEntities(
    withoutHidden
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );

  return stripped || fallbackFromImage || trimmed.replace(/\s+/g, " ");
}

function extractImageLabel(value: string): string | null {
  const attrMatch =
    value.match(/\bdata-image-name=(["'])(.*?)\1/i) ??
    value.match(/\balt=(["'])(.*?)\1/i) ??
    value.match(/\bdata-image-key=(["'])(.*?)\1/i);
  if (!attrMatch?.[2]) return null;

  const decoded = decodeHtmlEntities(attrMatch[2])
    .replace(/\.(png|jpe?g|webp|gif|svg)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return decoded || null;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, token: string) => {
    const lowered = token.toLowerCase();
    if (lowered.startsWith("#x")) {
      const codePoint = Number.parseInt(lowered.slice(2), 16);
      return isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    if (lowered.startsWith("#")) {
      const codePoint = Number.parseInt(lowered.slice(1), 10);
      return isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }

    const named: Record<string, string> = {
      amp: "&",
      apos: "'",
      gt: ">",
      lt: "<",
      nbsp: " ",
      quot: "\""
    };

    return named[lowered] ?? entity;
  });
}

function isValidCodePoint(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff;
}

function uniquifyIds(items: GameDatasetCatalogItem[]): GameDatasetCatalogItem[] {
  const seen = new Map<string, number>();
  const used = new Set<string>();

  return items.map((item) => {
    const baseId = item.id || "item";
    const occurrence = (seen.get(baseId) ?? 0) + 1;
    seen.set(baseId, occurrence);

    let nextId = occurrence === 1 ? baseId : `${baseId}-${occurrence}`;
    let suffix = occurrence;
    while (used.has(nextId)) {
      suffix += 1;
      nextId = `${baseId}-${suffix}`;
    }
    used.add(nextId);

    return nextId === item.id ? item : { ...item, id: nextId };
  });
}

function resolveColumns(
  meta: GameDatasetMeta | null,
  rows: Record<string, unknown>[],
  items: GameDatasetCatalogItem[]
): string[] {
  const fromMeta = (meta?.columns ?? []).filter(Boolean);
  const seen = new Set<string>(fromMeta);
  for (const row of [...rows.slice(0, 20), ...items.slice(0, 20)]) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
      }
    }
  }
  return Array.from(seen);
}

function buildViewConfig(
  config: GameDatasetCatalogConfig,
  dataset: GameDatasetCatalogDataset,
  sectionOverride?: CatalogSectionOverride | null
): GenericViewConfig {
  const columns = dataset.columns;
  const hiddenFieldKeys = new Set([...HIDDEN_FIELD_KEYS, ...(sectionOverride?.hiddenKeys ?? [])]);
  const groupKey =
    sectionOverride?.groupKey ??
    pickFirstUsefulKey(dataset, GROUP_KEY_PRIORITY, { requireMultipleValues: true }) ??
    "catalogGroup";
  const badgeKey = pickFirstUsefulKey(
    dataset,
    BADGE_KEY_PRIORITY.filter((key) => key !== groupKey && !hiddenFieldKeys.has(key))
  );
  const descriptionKey = pickFirstUsefulKey(
    dataset,
    DESCRIPTION_KEY_PRIORITY.filter((key) => !hiddenFieldKeys.has(key))
  );
  const subtitleKeys = SUBTITLE_KEY_PRIORITY.filter(
    (key) =>
      columns.includes(key) &&
      !hiddenFieldKeys.has(key) &&
      key !== groupKey &&
      key !== badgeKey &&
      hasUsefulValues(dataset.items, key)
  ).slice(0, 2);
  const statKeys = [
    ...STAT_KEY_PRIORITY.filter((key) => columns.includes(key) && hasUsefulValues(dataset.items, key)),
    ...columns.filter((key) => !hiddenFieldKeys.has(key) && hasUsefulValues(dataset.items, key))
  ].filter(
    (key) =>
      !hiddenFieldKeys.has(key) &&
      key !== groupKey &&
      key !== badgeKey &&
      key !== descriptionKey &&
      !subtitleKeys.includes(key)
  );
  const maxStats = sectionOverride?.maxStats ?? Math.min(6, statKeys.length);
  const stats = Array.from(new Set(statKeys))
    .slice(0, maxStats)
    .map((key) => ({ key, label: getFieldLabel(key) }));
  const hasImages = dataset.items.some((item) => Boolean(normalizeText(item.image)));

  if (groupKey === "catalogGroup") {
    dataset.items.forEach((item) => {
      item.catalogGroup = "Items";
    });
  }

  return {
    slug: config.code,
    label: config.label,
    groupKey,
    groupLabel: sectionOverride?.groupLabel ?? (groupKey === "catalogGroup" ? "Group" : getFieldLabel(groupKey)),
    badgeKey: badgeKey ?? undefined,
    subtitleKeys,
    descriptionKey: descriptionKey ?? undefined,
    cardDescriptionKey: descriptionKey ?? undefined,
    stats,
    maxStats,
    hideImages: !hasImages
  };
}

function getUsefulValueSet(items: GameDatasetCatalogItem[], key: string): Set<string> {
  const values = new Set<string>();
  for (const item of items) {
    const normalized = normalizeValue(item[key]);
    if (normalized) values.add(normalized);
  }
  return values;
}

function hasUsefulValues(items: GameDatasetCatalogItem[], key: string, options?: { requireMultipleValues?: boolean }) {
  const values = getUsefulValueSet(items, key);
  return options?.requireMultipleValues ? values.size > 1 : values.size > 0;
}

function pickFirstUsefulKey(
  dataset: GameDatasetCatalogDataset,
  keys: string[],
  options?: { requireMultipleValues?: boolean }
): string | null {
  return (
    keys.find((key) => dataset.columns.includes(key) && hasUsefulValues(dataset.items, key, options)) ?? null
  );
}

function withCatalogSectionOverride(
  config: GameDatasetCatalogConfig,
  dataset: GameDatasetCatalogDataset
): { dataset: GameDatasetCatalogDataset; sectionOverride: CatalogSectionOverride | null } {
  const sectionOverride = CATALOG_SECTION_OVERRIDES[config.code] ?? null;
  if (!sectionOverride) {
    return { dataset, sectionOverride: null };
  }

  const items = dataset.items.map((item) => {
    const transformedItem = sectionOverride.transformItem ? sectionOverride.transformItem(item) : item;
    return {
      ...transformedItem,
      [sectionOverride.groupKey]: sectionOverride.getSectionLabel(transformedItem) ?? "Other"
    };
  });
  const nextColumns = new Set([...dataset.columns, sectionOverride.groupKey, ...(sectionOverride.additionalColumns ?? [])]);

  return {
    dataset: {
      ...dataset,
      columns: Array.from(nextColumns),
      items
    },
    sectionOverride
  };
}

function buildGroupedSections(
  items: GameDatasetCatalogItem[],
  groupKey: string,
  sectionOrder?: string[] | null
) {
  const groups = new Map<string, GameDatasetCatalogItem[]>();
  items.forEach((item) => {
    const label = normalizeValue(item[groupKey]) ?? "Other";
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)?.push(item);
  });

  const orderIndex = new Map((sectionOrder ?? []).map((label, index) => [label, index]));

  return Array.from(groups.entries())
    .sort((a, b) => {
      const left = orderIndex.get(a[0]);
      const right = orderIndex.get(b[0]);
      if (left !== undefined && right !== undefined) return left - right;
      if (left !== undefined) return -1;
      if (right !== undefined) return 1;
      return a[0].localeCompare(b[0]);
    })
    .map(([label, entries]) => ({
      id: `section-${toSectionKey(label || "items")}`,
      label,
      items: entries
    }));
}

function pickFirstExistingKey(columns: string[], keys: string[]): string | null {
  return keys.find((key) => columns.includes(key)) ?? null;
}

function resolveDataUpdatedAt(meta: GameDatasetMeta | null): string | null {
  if (!meta) return null;
  if (meta.updatedAt) return meta.updatedAt;
  const sources = meta.sources ?? [];
  return sources.find((source) => source?.accessed)?.accessed ?? null;
}

function resolveLatestUpdatedAt(values: Array<string | null | undefined>): string | null {
  let latestValue: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    if (!value) continue;
    const time = Date.parse(value);
    if (Number.isNaN(time)) continue;
    if (time > latestTime) {
      latestTime = time;
      latestValue = value;
    }
  }

  return latestValue ?? values.find((value): value is string => Boolean(value)) ?? null;
}

function resolveAbsoluteUrl(value: string | null | undefined): string {
  if (!value) return `${SITE_URL}${FALLBACK_IMAGE}`;
  if (value.startsWith("http")) return value;
  return `${SITE_URL.replace(/\/$/, "")}/${value.replace(/^\//, "")}`;
}

function buildItemListSchema({
  title,
  description,
  url,
  items
}: {
  title: string;
  description: string;
  url: string;
  items: GameDatasetCatalogItem[];
}) {
  const itemListElement = items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "Thing",
      name: item.name,
      url: `${url}#item-${item.id}`,
      image: resolveAbsoluteUrl(item.image ?? FALLBACK_IMAGE)
    }
  }));

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description,
    url,
    numberOfItems: items.length,
    itemListElement
  });
}

function DatasetCatalogNav({
  config,
  className
}: {
  config: GameDatasetCatalogConfig;
  className?: string;
}) {
  const options = GAME_DATASET_CATALOGS.filter((entry) => entry.gameSlug === config.gameSlug).map((entry) => ({
    value: entry.code,
    label: entry.label,
    href: buildGameDatasetCatalogPath(entry.code)
  }));

  return <CatalogSelectNav label={`${config.gameName} catalog`} value={config.code} className={className} options={options} />;
}

function SectionNav({
  sections,
  className
}: {
  sections: Array<{ id: string; label: string; count: number }>;
  className?: string;
}) {
  if (!sections.length) return null;
  return (
    <CatalogSelectNav
      label="Jump to section"
      placeholder="Choose a section"
      className={className}
      options={sections.map((section) => ({
        value: section.id,
        label: section.label,
        count: section.count,
        targetId: section.id
      }))}
    />
  );
}

export function renderGameDatasetCatalogPage({
  config,
  dataset,
  contentHtml
}: {
  config: GameDatasetCatalogConfig;
  dataset: GameDatasetCatalogDataset;
  contentHtml?: GameDatasetCatalogContentHtml | null;
}) {
  const { dataset: displayDataset, sectionOverride } = withCatalogSectionOverride(config, dataset);
  const items = displayDataset.items;
  const itemCount = items.length;
  const pageTitle =
    contentHtml?.title?.trim() ||
    `All ${itemCount.toLocaleString("en-US")} ${config.label} in ${config.gameName}`;
  const pageDescription = `${config.gameName} ${config.label.toLowerCase()} catalog with ${itemCount.toLocaleString("en-US")} tracked entries.`;
  const introHtml = contentHtml?.introHtml?.trim() ? contentHtml.introHtml : "";
  const descriptionHtml = contentHtml?.descriptionHtml ?? [];
  const howHtml = contentHtml?.howHtml?.trim() ? contentHtml.howHtml : "";
  const faqHtml = contentHtml?.faqHtml ?? [];
  const dataUpdatedAt = resolveDataUpdatedAt(dataset.meta);
  const contentUpdatedAt = contentHtml?.updatedAt ?? null;
  const updatedAt = resolveLatestUpdatedAt([dataUpdatedAt, contentUpdatedAt]);
  const updatedDate = updatedAt ? new Date(updatedAt) : null;
  const canonicalPath = buildGameDatasetCatalogPath(config.code);
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const updatedIso = updatedDate?.toISOString() ?? null;
  const viewConfig = buildViewConfig(config, displayDataset, sectionOverride);
  const groupedSections = buildGroupedSections(items, viewConfig.groupKey, sectionOverride?.sectionOrder);
  const sectionNoteEntries = new Map<string, { key: string; html: string }>();
  descriptionHtml
    .filter((entry) => entry.key !== DESCRIPTION_MD_KEY)
    .forEach((entry) => {
      sectionNoteEntries.set(toSectionKey(entry.key), entry);
    });
  const usedSectionNoteKeys = new Set<string>();
  const groupedSectionsWithNotes = groupedSections.map((section) => {
    const noteEntry = sectionNoteEntries.get(toSectionKey(section.label));
    if (noteEntry) {
      usedSectionNoteKeys.add(toSectionKey(noteEntry.key));
    }
    return {
      ...section,
      noteHtml: noteEntry ? processHtmlLinks(noteEntry.html).__html : null
    };
  });
  const detailDescriptionHtml = descriptionHtml.filter(
    (entry) => entry.key === DESCRIPTION_MD_KEY || !usedSectionNoteKeys.has(toSectionKey(entry.key))
  );
  const sectionNav = groupedSections.map((section) => ({
    id: section.id,
    label: section.label,
    count: section.items.length
  }));
  const hasDetails = Boolean(detailDescriptionHtml.length) || Boolean(howHtml) || Boolean(faqHtml.length);

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Wiki", href: "/wiki" },
    { label: config.gameName, href: `/wiki/${config.gameSlug}` },
    { label: config.label, href: null }
  ];

  const introNodes = introHtml ? renderPageContentNodes(introHtml, `${config.code}-intro`) : null;
  const descriptionNodes = detailDescriptionHtml.flatMap((entry) =>
    renderPageContentNodes(entry.html, `${config.code}-description-${entry.key}`)
  );
  const howNodes = howHtml ? renderPageContentNodes(howHtml, `${config.code}-how`) : null;
  const faqNodes = faqHtml.map((faq, idx) => ({
    ...faq,
    nodes: renderPageContentNodes(faq.a, `${config.code}-faq-${idx}`)
  }));

  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Wiki", url: `${SITE_URL.replace(/\/$/, "")}/wiki` },
      { name: config.gameName, url: `${SITE_URL.replace(/\/$/, "")}/wiki/${config.gameSlug}` },
      { name: config.label, url: canonicalUrl }
    ])
  );

  const listSchema = buildItemListSchema({
    title: pageTitle,
    description: pageDescription,
    url: canonicalUrl,
    items
  });

  const pageSchema = JSON.stringify(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: canonicalPath.replace(/^\//, ""),
      title: pageTitle,
      description: pageDescription,
      image: `${SITE_URL}/og-image.png`,
      author: null,
      publishedAt: updatedIso,
      updatedAt: updatedIso
    })
  );

  return (
    <div className="catalog-surface space-y-10">
      <header className="space-y-4">
        <PageBreadcrumb items={breadcrumbItems} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{pageTitle}</h1>
        <UpdatedTimestamp value={updatedDate} />
      </header>

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space space-y-6">
        {introNodes ? introNodes : null}

        <CatalogAdSlot />

        <div className="grid gap-4 md:grid-cols-2 md:items-end">
          <DatasetCatalogNav config={config} className="max-w-none" />
          {sectionNav.length > 1 ? <SectionNav sections={sectionNav} className="max-w-none" /> : null}
        </div>

        <ForgeCatalogView sections={groupedSectionsWithNotes} config={viewConfig} />

        <CatalogAdSlot />

        {hasDetails ? (
          <>
            {descriptionNodes.length ? descriptionNodes : null}

            {howNodes ? howNodes : null}

            <ContentFaq
              items={faqNodes.map((faq, idx) => ({
                id: `${faq.q}-${idx}`,
                question: faq.q,
                answer: faq.nodes
              }))}
            />
          </>
        ) : null}
      </section>

      {contentHtml?.id ? (
        <div className="mt-10">
          <CommentsSection entityType="catalog" entityId={contentHtml.id} />
        </div>
      ) : null}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value) || isRecord(value)) return null;
  if (typeof value === "string") {
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (!trimmed) return null;
    const lowered = trimmed.toLowerCase();
    if (["none", "n/a", "na", "null"].includes(lowered)) return null;
    return trimmed;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value.toLocaleString("en-US");
  }
  return String(value);
}

function normalizeValue(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (normalized) return normalized;
  if (Array.isArray(value)) {
    const parts = value.map((entry) => normalizeValue(entry)).filter(Boolean) as string[];
    return parts.length ? parts.join("; ") : null;
  }
  if (isRecord(value)) {
    const parts = Object.entries(value)
      .map(([key, entry]) => {
        const entryValue = normalizeValue(entry);
        return entryValue ? `${getFieldLabel(key)}: ${entryValue}` : null;
      })
      .filter(Boolean) as string[];
    return parts.length ? parts.join("; ") : null;
  }
  return null;
}

function normalizeImage(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized || normalized.startsWith("data:image")) return null;
  return normalized;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toSectionKey(value: string): string {
  return toSlug(value.replace(/\+/g, " plus "));
}
