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

const FALLBACK_IMAGE = "/Bloxodes.png";

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
  hideImages?: boolean;
  subtitleKeys?: string[];
  transformItem?: (item: GameDatasetCatalogItem) => GameDatasetCatalogItem;
  transformItems?: (items: GameDatasetCatalogItem[]) => GameDatasetCatalogItem[];
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

const BLOX_FRUITS_ACCESSORY_SECTION_ORDER = [
  "First Sea accessories",
  "Second Sea accessories",
  "Third Sea accessories",
  "Multi-sea accessories",
  "Event accessories",
  "Admin-only accessories"
];

const BLOX_FRUITS_ACCESSORY_HIDDEN_KEYS = [
  "type",
  "sea",
  "bonuses",
  "rawText",
  "fields",
  "money",
  "robux",
  "source",
  "price",
  "requirements",
  "obtainment",
  "upgrading",
  "purpose"
];

const BLOX_FRUITS_FRUIT_SECTION_ORDER = [
  "Natural fruits",
  "Elemental fruits",
  "Beast fruits",
  "Fruit mutations",
  "Legacy and unavailable fruits",
  "Admin-only fruits"
];

const BLOX_FRUITS_FRUIT_HIDDEN_KEYS = [
  "type",
  "sea",
  "price",
  "money",
  "robux",
  "awakening",
  "upgrading",
  "unavailableReason",
  "source",
  "requirements",
  "obtainment",
  "purpose",
  "bonuses",
  "rawText",
  "fields"
];

const BLOX_FRUITS_SWORD_SECTION_ORDER = [
  "First Sea swords",
  "Second Sea swords",
  "Third Sea swords",
  "Multi-sea and special swords",
  "Admin-only swords"
];

const BLOX_FRUITS_SWORD_HIDDEN_KEYS = [
  "type",
  "sea",
  "price",
  "money",
  "robux",
  "obtainment",
  "requirements",
  "upgrading",
  "source",
  "purpose",
  "bonuses",
  "rawText",
  "fields"
];

const BLOX_FRUITS_FIGHTING_STYLE_SECTION_ORDER = [
  "Starter and First Sea fighting styles",
  "Second Sea fighting styles",
  "Third Sea fighting styles"
];

const BLOX_FRUITS_FIGHTING_STYLE_HIDDEN_KEYS = [
  "type",
  "price",
  "money",
  "robux",
  "requirements",
  "source",
  "sea",
  "obtainment",
  "upgrading",
  "purpose",
  "bonuses",
  "rawText",
  "fields"
];

const BLOX_FRUITS_MATERIAL_SECTION_ORDER = [
  "Upgrade materials",
  "Unlock and progression materials",
  "Crafting and recipe materials",
  "Event currency and gacha materials",
  "Utility and no-use materials"
];

const BLOX_FRUITS_MATERIAL_HIDDEN_KEYS = [
  "type",
  "sea",
  "source",
  "purpose",
  "price",
  "money",
  "robux",
  "requirements",
  "obtainment",
  "upgrading",
  "bonuses",
  "rawText",
  "fields"
];

const BLOX_FRUITS_RACE_SECTION_ORDER = ["Starter and reroll races", "Quest-only races"];

const BLOX_FRUITS_RACE_HIDDEN_KEYS = [
  "source",
  "titles",
  "overview",
  "rawText",
  "fields",
  "type",
  "sea",
  "price",
  "money",
  "robux",
  "requirements",
  "obtainment",
  "upgrading",
  "purpose",
  "bonuses"
];

const BLOX_FRUITS_BOSS_SECTION_ORDER = [
  "First Sea bosses",
  "Second Sea bosses",
  "Third Sea bosses",
  "Dungeon bosses",
  "Event and multi-sea bosses"
];

const BLOX_FRUITS_BOSS_HIDDEN_KEYS = [
  "type",
  "sea",
  "spawnTime",
  "despawnTime",
  "hp",
  "usesAura",
  "weaponType",
  "previous",
  "overview",
  "fields",
  "wikiUrl",
  "sourceImageUrl"
];

const BLOX_FRUITS_ENEMY_SECTION_ORDER = [
  "First Sea enemies",
  "Second Sea enemies",
  "Third Sea enemies",
  "Raid, sea event, and special enemies"
];

const BLOX_FRUITS_ENEMY_HIDDEN_KEYS = [
  "enemy",
  "sea",
  "elementalBladeLevel",
  "notes",
  "fields",
  "wikiUrl",
  "imageCandidate"
];

const BLOX_FRUITS_LOCATION_SECTION_ORDER = [
  "First Sea locations",
  "Second Sea locations",
  "Third Sea locations",
  "Sea-event locations",
  "Hidden and special locations"
];

const BLOX_FRUITS_LOCATION_HIDDEN_KEYS = [
  "type",
  "sea",
  "level",
  "levelRequirement",
  "location",
  "inhabitants",
  "overview",
  "backgroundMusic",
  "previous",
  "next",
  "fields",
  "wikiUrl",
  "sourceImageUrl"
];

const BLOX_FRUITS_QUEST_SECTION_ORDER = ["First Sea", "Second Sea", "Third Sea"];

const BLOX_FRUITS_QUEST_HIDDEN_KEYS = [
  "sea",
  "island",
  "questGiver",
  "quest",
  "level",
  "exp",
  "expexp",
  "money",
  "special",
  "fields",
  "wikiUrl",
  "sourceImageUrl"
];

const BLOX_FRUITS_SEA_EVENT_SECTION_ORDER = [
  "Basic travel events",
  "Third Sea combat hunts",
  "Rare island spawns",
  "Island follow-up encounters"
];

const BLOX_FRUITS_SEA_EVENT_HIDDEN_KEYS = [
  "type",
  "sea",
  "location",
  "drops",
  "overview",
  "backgroundMusic",
  "atkPerHit",
  "hp",
  "level",
  "weapon",
  "amount",
  "purpose",
  "fields",
  "wikiUrl",
  "sourceImageUrl"
];

const BLOX_FRUITS_ABILITY_SECTION_ORDER = [
  "Core movement unlocks",
  "Combat awareness and Aura systems",
  "Race abilities and awakenings",
  "Special tools and progression utility",
  "Admin or special-space abilities"
];

const BLOX_FRUITS_ABILITY_HIDDEN_KEYS = [
  "type",
  "source",
  "costToBuy",
  "level",
  "levelRequirement",
  "locations",
  "objectsAffected",
  "purpose",
  "overview",
  "releaseDate",
  "dateOfAddition",
  "fields",
  "wikiUrl",
  "sourceImageUrl"
];

const BLOX_FRUITS_AURA_STAGE_SECTION_ORDER = ["Aura stage progression"];

const BLOX_FRUITS_AURA_STAGE_HIDDEN_KEYS = [
  "stage",
  "visualAura",
  "visualAuraArmFsLegFs",
  "buffs",
  "expNeeded",
  "fields",
  "wikiUrl",
  "imageCandidate"
];

const BLOX_FRUITS_AURA_VISUAL_SECTION_ORDER = ["Aura appearance stages"];

const BLOX_FRUITS_AURA_VISUAL_HIDDEN_KEYS = [
  "stage",
  "legs",
  "arms",
  "fields",
  "wikiUrl",
  "sourceImageUrl"
];

const BLOX_FRUITS_BOAT_SECTION_ORDER = [
  "Starter and normal dealer boats",
  "Fast Boats gamepass boats",
  "Unlock and event luxury boats",
  "Leviathan hunt boat"
];

const BLOX_FRUITS_BOAT_HIDDEN_KEYS = [
  "boat",
  "category",
  "price",
  "health",
  "seats",
  "cannons",
  "speed",
  "estimatedSpeedInThirdSeaMetersPerMinute",
  "fields",
  "wikiUrl",
  "sourceImageUrl"
];

const BLOX_FRUITS_GUN_SECTION_ORDER = [
  "First Sea shop guns",
  "First Sea boss drops",
  "Second Sea raid and currency guns",
  "Third Sea boss and special guns"
];

const BLOX_FRUITS_GUN_HIDDEN_KEYS = [
  "rarity",
  "type",
  "sea",
  "money",
  "robux",
  "source",
  "price",
  "requirements",
  "obtainment",
  "upgrading",
  "purpose",
  "bonuses",
  "rawText",
  "fields",
  "wikiUrl",
  "sourcePage",
  "sourceImageUrl"
];

const BLOX_FRUITS_INSTINCT_LEVEL_SECTION_ORDER = ["Starter Instinct", "Main training climb", "V2 preparation"];

const BLOX_FRUITS_INSTINCT_LEVEL_HIDDEN_KEYS = [
  "level",
  "exp",
  "dodges",
  "buffs",
  "fields",
  "wikiUrl",
  "imageCandidate"
];

const BLOX_FRUITS_NPC_SECTION_ORDER = [
  "Quest givers and progression NPCs",
  "Shops, dealers, and exchange NPCs",
  "Trainers, teachers, and system unlocks",
  "Travel, crew, and service NPCs",
  "Enemies and grind targets",
  "Bosses and raid bosses",
  "Event, limited, and special-space NPCs",
  "Admin, removed, and unclear references"
];

const BLOX_FRUITS_NPC_HIDDEN_KEYS = [
  "type",
  "sea",
  "location",
  "overview",
  "previous",
  "next",
  "spawnTime",
  "despawnTime",
  "level",
  "usesAura",
  "weaponType",
  "hp",
  "amount",
  "immunityLevel",
  "atkPerHit",
  "weapon",
  "dateOfAddition",
  "purpose",
  "locations",
  "source",
  "drops",
  "objectsAffected",
  "fields",
  "wikiUrl",
  "sourceImageUrl"
];

const BLOX_FRUITS_TITLE_SECTION_ORDER = [
  "Race evolution titles",
  "Bounty and Honor titles",
  "Fruit awakening titles",
  "Progression and mastery titles",
  "Boss, raid, and enemy titles",
  "Sea event and special activity titles",
  "Event, code, and limited titles",
  "Creator, admin, and community titles",
  "Utility, puzzle, and misc titles",
  "Placeholders and unknown titles"
];

const BLOX_FRUITS_TITLE_HIDDEN_KEYS = [
  "title",
  "titleNumber",
  "obtainment",
  "column1",
  "icon",
  "fields",
  "wikiUrl",
  "sourceImageUrl"
];

const BLOX_FRUITS_SPECIAL_TITLE_SECTION_ORDER = ["Owner and admin titles", "Named account custom titles"];

const BLOX_FRUITS_SPECIAL_TITLE_HIDDEN_KEYS = ["title", "obtainment", "fields", "wikiUrl", "imageCandidate"];

const BLOX_FRUITS_TITLE_COLOR_SECTION_ORDER = [
  "Automatic colors",
  "Early title milestones",
  "Mid title milestones",
  "Late title milestones"
];

const BLOX_FRUITS_TITLE_COLOR_HIDDEN_KEYS = [
  "color",
  "obtainment",
  "column1",
  "fields",
  "wikiUrl",
  "imageCandidate"
];

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

const WIZARD_ALCHEMY_MATERIAL_SECTION_ORDER = [
  "Departure Isle materials",
  "Sea of Oblivion materials",
  "Elemental shards"
];

const WIZARD_ALCHEMY_POTION_SECTION_ORDER = ["Departure Isle potions", "Sea of Oblivion potions"];

const WIZARD_ALCHEMY_RACE_SECTION_ORDER = [
  "Common races",
  "Uncommon races",
  "Rare races",
  "Epic races",
  "Legendary races"
];

const WIZARD_ALCHEMY_WAND_SECTION_ORDER = [
  "Starter wand",
  "Roger's shop wands",
  "Hidden Departure Isle wands",
  "Sea of Oblivion wand"
];

const WIZARD_ALCHEMY_BROOM_SECTION_ORDER = ["Brooms"];

const WIZARD_ALCHEMY_ROBE_SECTION_ORDER = ["Starter robe", "Early robe upgrade", "Late robe upgrade"];

const WIZARD_ALCHEMY_WIZARD_HAT_SECTION_ORDER = ["Roger's shop hats", "Sea of Oblivion hat"];

const WIZARD_ALCHEMY_CHEST_SECTION_ORDER = [
  "Starter-area chests",
  "Forest and mine chests",
  "Island and boss-route chests"
];

const WIZARD_ALCHEMY_ENEMY_SECTION_ORDER = [
  "Departure Isle dwarfs",
  "Departure Isle goblins",
  "Elite and boss enemies",
  "Sea of Oblivion enemies"
];

const WIZARD_ALCHEMY_ENCHANTMENT_SECTION_ORDER = [
  "Damage enchantments",
  "Element damage enchantments",
  "Utility and farming enchantments"
];

const WIZARD_ALCHEMY_LOCATION_SECTION_ORDER = [
  "Departure Isle spawn and services",
  "Forest, river, and mine routes",
  "Beach, boss, and high routes",
  "Sea of Oblivion routes"
];

const WIZARD_ALCHEMY_NPC_SECTION_ORDER = ["Spawn services", "Route and quest NPCs", "Landmark NPCs"];

const WIZARD_ALCHEMY_RESOURCE_NODE_SECTION_ORDER = [
  "Departure Isle gathering nodes",
  "Sea of Oblivion gathering nodes",
  "Shared pickup sources",
  "Enchanted Stone sources"
];

const SLIME_RNG_SLIME_SECTION_ORDER = ["Base", "Big", "Huge", "Shiny", "Inverted"];

const SLIME_RNG_ZONE_SECTION_ORDER = ["Earlygame", "Midgame", "Lategame", "Endgame"];

const SLIME_RNG_CRAFTING_SECTION_ORDER = [
  "Early crafting recipes",
  "Midgame crafting recipes",
  "Late crafting recipes",
  "Endgame crafting recipes"
];

const SLIME_RNG_ITEM_SECTION_ORDER = ["Food", "Potions", "Dice"];

const SLIME_RNG_POWER_FRUIT_SECTION_ORDER = ["Power Fruits"];

const SLIME_RNG_REBIRTH_SECTION_ORDER = ["Rebirths 1-10", "Rebirths 11-20", "Rebirths 21-30"];

const SLIME_RNG_INDEX_REWARD_SECTION_ORDER = ["Basic", "Big", "Huge", "Shiny", "Inverted"];

const KICK_A_LUCKY_BLOCK_BRAINROT_SECTION_ORDER = [
  "Common",
  "Rare",
  "Epic",
  "Legendary",
  "Mythic",
  "Godly",
  "Secret",
  "Divine",
  "Hacked",
  "OG",
  "Celestial",
  "Eternal",
  "Exclusive"
];

const KICK_A_LUCKY_BLOCK_MUTATION_SECTION_ORDER = [
  "Baseline",
  "Cross-checked mutations",
  "Update 5 additions",
  "Limited-data mutations"
];

const KICK_A_LUCKY_BLOCK_WEIGHT_SECTION_ORDER = [
  "Starter weights",
  "Early shop upgrades",
  "High-cost weights",
  "Endgame weights"
];

const KICK_A_LUCKY_BLOCK_ZONE_SECTION_ORDER = ["Starter zones", "Progression zones", "Endgame zones"];
const RIVALS_WEAPON_SECTION_ORDER = ["Primary", "Secondary", "Melee", "Utility"];
const RIVALS_MAP_SECTION_ORDER = [
  "Current regular maps",
  "Big maps",
  "Experimental maps",
  "Legacy private-server maps",
  "Private-server-only maps"
];
const RIVALS_SKIN_SECTION_ORDER = [
  "Case and Daily Shop skins",
  "Event case source skins",
  "Bundle and currency source skins",
  "Pass, ranked, and Glory source skins",
  "Code-origin, UGC, mode, and special-source skins"
];
const RIVALS_WRAP_SECTION_ORDER = [
  "Box and chest roll wraps",
  "Weapon contract and milestone wraps",
  "Shop and bundle purchase wraps",
  "Limited-source cosmetic wraps",
  "Special grant and unobtainable wraps"
];
const RIVALS_CHARM_SECTION_ORDER = [
  "Capsule, chest, and shop source rows",
  "Bundle and paid-offer source rows",
  "Limited-origin source rows",
  "Social, creator, and developer source rows",
  "Restricted and unobtainable source rows"
];
const RIVALS_FINISHER_SECTION_ORDER = [
  "Finisher Pack Sources",
  "Event Chest Sources",
  "Season and Ranked Sources",
  "Bundle and Shop Sources",
  "Contract, UGC, and Milestone Sources",
  "Default and Unobtainable"
];
const RIVALS_EMOTE_SECTION_ORDER = [
  "Shop emotes",
  "Progression and bundle emotes",
  "Limited-source emotes",
  "Special and milestone emotes"
];
const RIVALS_UGC_SECTION_ORDER = [
  "Clothing and character set",
  "Key and weapon accessories",
  "Joke and mascot accessories",
  "Rank badge accessories"
];

const JUJUTSU_SHENANIGANS_CHARACTER_SECTION_ORDER = ["Complete", "Early Access", "Base Only"];
const JUJUTSU_SHENANIGANS_DOMAIN_SECTION_ORDER = [
  "Full combat domains",
  "Non-lethal and awakening domains",
  "Alternate and invasion mechanics",
  "Restricted and special domains"
];
const JUJUTSU_SHENANIGANS_ITEM_SECTION_ORDER = [
  "Public shop, spawn, and map items",
  "Character-created and secret items",
  "Private-server Item Block items"
];
const JUJUTSU_SHENANIGANS_GAMEMODE_SECTION_ORDER = [
  "Public Servers",
  "Duels and Ranked",
  "Roulette Minigames",
  "Custom and Private Servers",
  "Creator Clash"
];
const JUJUTSU_SHENANIGANS_MAP_SECTION_ORDER = [
  "Main public map",
  "Main map landmarks",
  "Duels arenas",
  "Roulette large maps",
  "Roulette small maps",
  "Old and retired maps"
];
const JUJUTSU_SHENANIGANS_EMOTE_SECTION_ORDER = [
  "Stationary",
  "Cosmetic",
  "Traversal",
  "Partner",
  "Kill",
  "Interactive",
  "Limited/Exclusive"
];
const JUJUTSU_SHENANIGANS_COSMETIC_SECTION_ORDER = [
  "Victory Flashes",
  "Taunts",
  "Removed and unavailable taunts"
];
const JUJUTSU_SHENANIGANS_TITLE_SECTION_ORDER = [
  "Leaderboard kill titles",
  "Staff and team titles",
  "Custom and creator titles"
];
const JUJUTSU_SHENANIGANS_INTERACTABLE_SECTION_ORDER = [
  "Throwables",
  "Paid map interactables",
  "Map mechanisms",
  "Minigame interactables"
];
const JUJUTSU_SHENANIGANS_ACHIEVEMENT_SECTION_ORDER = [
  "Stats and server milestones",
  "Mode challenges",
  "General fight interactions",
  "Honored One challenges",
  "Vessel challenges",
  "Restless Gambler challenges",
  "Ten Shadows and Mahoraga challenges",
  "Perfection challenges",
  "Blood Manipulator challenges",
  "Switcher challenges",
  "Defense Attorney challenges",
  "Cursed Partners challenges",
  "Head of the Hei challenges",
  "Salaryman challenges",
  "Other character challenges",
  "Black Death challenges"
];
const JUJUTSU_SHENANIGANS_BUILD_BLOCK_SECTION_ORDER = [
  "Building Blocks",
  "Input Blocks",
  "Output Blocks",
  "Interaction Blocks",
  "Logic Gates",
  "Build Tools"
];
const JUJUTSU_SHENANIGANS_SKILL_BUILDER_SECTION_ORDER = [
  "Timeline nodes",
  "Conditions",
  "Properties",
  "Variant triggers",
  "Timing references"
];

const JUJUTSU_SHENANIGANS_VERBOSE_CARD_KEYS = [
  "baseMoves",
  "awakeningOrSpecial",
  "trigger",
  "counterplay",
  "clashInvasionRule",
  "usesBreakRule",
  "storageDropDespawn",
  "objective",
  "playersTeams",
  "winCondition",
  "progressionImpact",
  "specialRules",
  "landmarks",
  "itemSpawns",
  "hazards",
  "killInteractiveBehavior",
  "equipUseContext",
  "achievementRequirement",
  "whoCanUse",
  "displayBehavior",
  "modeServerLimitation",
  "specialInteractions",
  "relatedMoves",
  "titleReward",
  "emoteReward",
  "modeOrCharacter",
  "triggerBehavior",
  "settings",
  "limitations",
  "relatedNodes",
  "verificationNote",
  "notes"
];

function firstJujutsuValue(item: GameDatasetCatalogItem, keys: string[]): string | null {
  for (const key of keys) {
    const value = normalizeValue(item[key]);
    if (value) return value;
  }
  return null;
}

function withJujutsuCardSummary(keys: string[]) {
  return (item: GameDatasetCatalogItem): GameDatasetCatalogItem => ({
    ...item,
    cardSummary: firstJujutsuValue(item, keys)
  });
}

const SURVIVE_ZOMBIE_ARENA_CLASS_SECTION_ORDER = [
  "Starter and first unlocks",
  "Early utility unlocks",
  "Mid-cost role picks",
  "Legendary endgame classes"
];

const SURVIVE_ZOMBIE_ARENA_WEAPON_SECTION_ORDER = [
  "Starter and early Armory weapons",
  "High-wave Credit and F2P weapons",
  "VIP and Robux weapons",
  "Lava Crate weapons",
  "Galactic Crate weapons"
];

const SURVIVE_ZOMBIE_ARENA_GEAR_SECTION_ORDER = [
  "Defensive structures",
  "Automated damage",
  "Traps and area denial",
  "Healing and repair support"
];

const SURVIVE_ZOMBIE_ARENA_MAP_SECTION_ORDER = ["Active maps", "Retired maps"];

const SURVIVE_ZOMBIE_ARENA_SOURCE_KEYS = [
  "sourcePage",
  "sourceConfidence",
  "verificationNote",
  "imageStatus",
  "sourceImageUrl"
];

const MURDERERS_VS_SHERIFFS_WEAPON_SECTION_ORDER = [
  "Ancient",
  "Mythic",
  "Legendary",
  "Rare",
  "Uncommon",
  "Common"
];
const MURDERERS_VS_SHERIFFS_CRATE_SECTION_ORDER = ["PRO Box", "GOD Box"];
const MURDERERS_VS_SHERIFFS_MODE_SECTION_ORDER = ["Solo practice", "Team queues", "Pro access"];
const MURDERERS_VS_SHERIFFS_DEATH_EFFECT_SECTION_ORDER = ["Direct Robux effects", "Bundle effects"];
const MURDERERS_VS_SHERIFFS_BUNDLE_SECTION_ORDER = ["Verified packs"];

const NINETY_NINE_NIGHTS_CLASS_SECTION_ORDER = [
  "Active classes",
  "Limited and event classes",
  "Removed classes"
];

const NINETY_NINE_NIGHTS_CRAFTING_SECTION_ORDER = [
  "Crafting Bench Tier 1",
  "Crafting Bench Tier 2",
  "Crafting Bench Tier 3",
  "Crafting Bench Tier 4",
  "Crafting Bench Tier 5",
  "Tool Workshop Anvil",
  "Meteor Anvil",
  "Removed and event-only craftables"
];

const NINETY_NINE_NIGHTS_ENTITY_SECTION_ORDER = [
  "Major monsters and bosses",
  "Hostile enemies and raiders",
  "Tameable, neutral, and passive animals",
  "Traders, helpers, and rescue NPCs",
  "Special, event, and admin-only entities"
];

const NINETY_NINE_NIGHTS_FOOD_SECTION_ORDER = [
  "Map, farm, and structure food",
  "Meat and cooked meat",
  "Fish and pond food",
  "Crock Pot and Chef dishes",
  "Special survival food",
  "Event-only or removed food"
];

const NINETY_NINE_NIGHTS_LOCATION_SECTION_ORDER = [
  "Forest structures",
  "Cultist and combat locations",
  "Special or gated locations",
  "Snow Biome locations",
  "Volcanic Biome locations"
];

const NINETY_NINE_NIGHTS_MATERIAL_SECTION_ORDER = [
  "Fuel and camp resources",
  "Scrap sources",
  "Core and trade resources",
  "Pelts and entity drops",
  "Potion ingredients",
  "Meteor and Obsidiron materials"
];

const NINETY_NINE_NIGHTS_WEAPON_SECTION_ORDER = [
  "Melee weapons",
  "Ranged weapons",
  "Throwables and limited-use weapons",
  "Special combat items",
  "Defensive combat gear",
  "Unavailable and admin-only weapons"
];

const NINETY_NINE_NIGHTS_TOOL_SECTION_ORDER = [
  "Storage and sacks",
  "Axes and chopping",
  "Fishing rods",
  "Taming flutes",
  "Flashlights and light",
  "Base utility",
  "Navigation and run control",
  "Hard Mode utility",
  "Admin and update-party tools"
];

const NINETY_NINE_NIGHTS_TAMEABLE_ANIMAL_SECTION_ORDER = [
  "Old Taming Flute",
  "Good Taming Flute",
  "Strong Taming Flute"
];

const NINETY_NINE_NIGHTS_SOURCE_KEYS = [
  "sourcePage",
  "sourceNote",
  "sourceConfidence",
  "secondarySourcePage",
  "sourceStatus",
  "sourceUrls",
  "sourceImage",
  "imageStatus",
  "imageSource",
  "imageMissingReason",
  "sourceImageUrl",
  "verificationNote",
  "blocker",
  "sortOrder"
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

const SPEED_KEYBOARD_TRAIL_SECTION_ORDER = ["Current Robux trails", "Retired or event trails"];
const SPEED_KEYBOARD_AURA_SECTION_ORDER = ["Starter cost tier", "Mid cost tier", "High cost tier"];
const SPEED_KEYBOARD_STAGE_SECTION_ORDER = ["World 1 stages", "World 2 stages"];
const SPEED_KEYBOARD_TREADMILL_SECTION_ORDER = ["Free trainer", "Premium treadmill upgrades"];
const UNTITLED_BOXING_GAME_STYLE_SECTION_ORDER = [
  "Uncommon styles",
  "Rare styles",
  "Mythic styles",
  "Legendary styles",
  "Shiny styles",
  "Unobtainable styles",
  "Removed styles"
];
const UNTITLED_BOXING_GAME_GLOVE_SECTION_ORDER = [
  "Standard crate",
  "Holiday crate",
  "Ranked gloves",
  "Event gloves",
  "Original line and beta gloves"
];
const UNTITLED_BOXING_GAME_EMOTE_SECTION_ORDER = [
  "Uncommon emotes",
  "Rare emotes",
  "Mythic emotes",
  "Legendary emotes"
];
const UNTITLED_BOXING_GAME_KNOCKOUT_EFFECT_SECTION_ORDER = ["Default", "Daily shop rotation", "Event reward"];
const UNTITLED_BOXING_GAME_TITLE_SECTION_ORDER = [
  "Default",
  "Knockdowns",
  "Streak",
  "Streak Hunter",
  "Defense",
  "Punches",
  "Ultimates",
  "Perfect Dodge",
  "Counters",
  "Cash",
  "Ranked",
  "Style titles",
  "Seasonal leaderboard titles",
  "Miscellaneous titles"
];
const UNTITLED_BOXING_GAME_SOURCE_KEYS = [
  "catalogSection",
  "sourcePage",
  "imageStatus",
  "imageSource",
  "sourceStatus",
  "sourceNote",
  "sourceNotes"
];

const DRESS_TO_IMPRESS_SOURCE_KEYS = [
  "catalogSection",
  "categoryIncluded",
  "categoryTags",
  "poseCountStatus",
  "priceValue",
  "priceStatus",
  "rawAvailability",
  "rawSourceRoute",
  "rawSourceId",
  "sourcePage",
  "source",
  "collectionSourcePage",
  "sourceImageFile",
  "sourceImageMime",
  "sourceImagePage",
  "sourcePageTitle",
  "secondarySourcePage",
  "sourceNote",
  "wikiUrl",
  "sourceUrl",
  "sourceUrls",
  "sourceImageUrl",
  "sourceCheckedAt",
  "sourceConfidence",
  "sourceNotes",
  "sourceStatus",
  "setPriceValue",
  "setItemCountValue",
  "officialPriceInRobux",
  "officialName",
  "officialIsForSale",
  "officialCreated",
  "officialUpdated",
  "robloxGamePassId",
  "robloxProductId",
  "robloxIconImageAssetId",
  "variantLightImage",
  "variantDarkImage",
  "codeStatus",
  "liveCodeRows",
  "verificationNote",
  "rawText",
  "rawInfobox",
  "rawHtml",
  "sourceTables",
  "imageStatus",
  "imageMissingReason",
  "sortOrder"
];

const DRESS_TO_IMPRESS_THEME_SECTION_ORDER = [
  "Decades and historical eras",
  "Aesthetics and fashion styles",
  "Colors, patterns, and materials",
  "Formal, glam, and runway",
  "Casual life and daily activities",
  "School, work, and professions",
  "Places, travel, and events",
  "Fantasy, mythology, and royalty",
  "Spooky, horror, and mystery",
  "Nature, seasons, and weather",
  "Media, characters, and pop culture",
  "Duo, versus, and group prompts",
  "Food, objects, and abstract ideas"
];

const DRESS_TO_IMPRESS_POSE_PACK_SECTION_ORDER = [
  "Starter pose packs",
  "Standard shop pose packs",
  "Seasonal pose packs",
  "Reward pose packs",
  "Collaboration pose packs",
  "Retired pose packs"
];

const DRESS_TO_IMPRESS_CURRENCY_ITEM_SECTION_ORDER = [
  "Cash shop items",
  "Weekly Boutique history",
  "Taiyaki seasonal items",
  "Candy Hearts seasonal items",
  "Snowflake seasonal items",
  "Candy seasonal items",
  "Seashell seasonal items",
  "Removed currency items"
];

const DRESS_TO_IMPRESS_FREE_ITEM_SECTION_ORDER = [
  "Full-body",
  "Tops",
  "Skirts",
  "Pants & Shorts",
  "Heels & Shoes",
  "Purses & Bags",
  "Head Accessories",
  "Jewelry & Body Wear",
  "Props",
  "Hidden Items"
];

const DRESS_TO_IMPRESS_CODE_ITEM_SECTION_ORDER = [
  "Creator and influencer code items",
  "Developer, seasonal, and milestone code items",
  "Partnership and collaboration code items",
  "Quest, drop, and special-claim code items"
];

const DRESS_TO_IMPRESS_RANK_SECTION_ORDER = ["Star ranks", "Unlock items"];

const DRESS_TO_IMPRESS_WALK_PACK_SECTION_ORDER = [
  "Cash shop walk packs",
  "Seasonal currency walk packs",
  "Baddie Pass reward walk packs",
  "Advent and special gift walk packs"
];

const DRESS_TO_IMPRESS_RUNWAY_EFFECT_SECTION_ORDER = [
  "Standard Shop effects",
  "Spring seasonal effects",
  "Winter seasonal effects",
  "Halloween seasonal effects",
  "Removed effects"
];

const DRESS_TO_IMPRESS_PATTERN_PACK_SECTION_ORDER = [
  "Seasonal pattern packs",
  "Reward pattern packs",
  "Collaboration pattern packs",
  "Shop pattern packs",
  "DLC fashion pattern packs"
];

const DRESS_TO_IMPRESS_HAIRSTYLE_SECTION_ORDER = [
  "Feminine salon hairstyles",
  "Masculine salon hairstyles",
  "Bangs",
  "Reward hairstyles",
  "Shop and paid set hairstyles",
  "Code-origin hairstyles"
];

const DRESS_TO_IMPRESS_MAKEUP_SECTION_ORDER = [
  "Classic Feminine",
  "Classic Masculine",
  "Toy-code presets",
  "Custom Eyes",
  "Custom Eyebrows",
  "Custom Lips",
  "Custom Contour",
  "Custom Touches/details",
  "Makeup rewards",
  "Makeup packs"
];

const DRESS_TO_IMPRESS_NAIL_SECTION_ORDER = [
  "Standard nails",
  "Reward nails",
  "Rank nails",
  "Code-origin nails",
  "Retired nails"
];

const DRESS_TO_IMPRESS_REWARD_ITEM_SECTION_ORDER = [
  "Quest and challenge rewards",
  "Style Showdown and mode rewards",
  "Collaboration rewards",
  "Limited and retired event rewards"
];

const DRESS_TO_IMPRESS_ROBUX_ITEM_SECTION_ORDER = [
  "Sweet Berry Set",
  "Queen of Hearts Set",
  "French Luxury Set",
  "Haunting Beauty Set",
  "Rich Girl Set",
  "Moongazer Set",
  "Denim Star Set",
  "Limited Luxury Dress",
  "Unavailable Robux items"
];

const DRESS_TO_IMPRESS_VIP_ITEM_SECTION_ORDER = [
  "Dresses",
  "Tops",
  "Bottoms",
  "Shoes",
  "Bags",
  "Accessories",
  "Jewelry"
];

const PET_SIMULATOR_99_PET_SECTION_ORDER = [
  "World and stat pets",
  "Limited and event-origin pets",
  "Regular Exclusive pets",
  "Huge pets",
  "Titanic pets",
  "Gargantuan pets",
  "Admin, merch, and special grants"
];

const PET_SIMULATOR_99_EGG_SECTION_ORDER = [
  "World 1 eggs",
  "Tech World eggs",
  "Void World eggs",
  "Fantasy World eggs",
  "Permanent event-world eggs",
  "PS99 exclusive eggs"
];

const PET_SIMULATOR_99_ENCHANT_SECTION_ORDER = [
  "Farming boosts",
  "Damage and tapping",
  "Hatching and pet odds",
  "Collection and movement",
  "Chest, drop, and event spawns"
];

const PET_SIMULATOR_99_POTION_SECTION_ORDER = ["Standard boost potions", "Special potions", "XP potions"];
const PET_SIMULATOR_99_AREA_SECTION_ORDER = [
  "World 1 - Spawn World",
  "World 2 - Tech World",
  "World 3 - Void World",
  "World 4 - Fantasy World"
];
const PET_SIMULATOR_99_MACHINE_SECTION_ORDER = [
  "Pet and hatch progression",
  "Item upgrade and crafting",
  "Rewards, quests, and boosts",
  "Travel and management hubs"
];
const PET_SIMULATOR_99_CHARM_SECTION_ORDER = [
  "Farming and currency charms",
  "Damage and breakable charms",
  "Movement, leveling, and slot charms",
  "Charm support items"
];
const PET_SIMULATOR_99_HOVERBOARD_SECTION_ORDER = [
  "Free and gameplay unlocks",
  "Achievement and merch-code rewards",
  "Shop, pack, and VIP boards",
  "Gift and event boards",
  "Clan, leaderboard, and partner rewards"
];
const PET_SIMULATOR_99_BOOTH_SECTION_ORDER = [
  "Direct unlocks and shop booths",
  "Gift, pack, and event booths",
  "Clan battle reward booths",
  "Trade-only and retired storefront booths",
  "Untradable account unlocks"
];
const PET_SIMULATOR_99_MASTERY_SECTION_ORDER = [
  "Core farming and hatching",
  "Item upgrade and consume loops",
  "Chest, key, and gift rewards",
  "Minigame and machine grinds"
];
const PET_SIMULATOR_99_MINIGAME_SECTION_ORDER = [
  "Spawn World",
  "Tech World",
  "Void World",
  "Fantasy World"
];
const PET_SIMULATOR_99_SHINY_RELIC_SECTION_ORDER = [
  "Trading Plaza",
  "World 1 - Spawn World",
  "World 2 - Tech World",
  "World 3 - Void World",
  "World 4 - Fantasy World"
];

const PET_SIMULATOR_99_HIDDEN_KEYS = [
  "catalogSection",
  "sortOrder",
  "sourcePage",
  "secondarySourcePage",
  "sourceCheckedAt",
  "sourceGeneratedAt",
  "sourceStatus",
  "sourceTables",
  "sourceTemplate",
  "sourceImageFile",
  "sourceImageUrl",
  "sourceImage",
  "sourceNotes",
  "imageStatus",
  "imageMissingReason",
  "verificationNote",
  "wikiUrl",
  "rawText",
  "rawHtml",
  "rawWikitext",
  "fields"
];

const CATALOG_SECTION_OVERRIDES: Record<string, CatalogSectionOverride> = {
  "pet-simulator-99-pets": {
    groupKey: "catalogSection",
    groupLabel: "Pet group",
    sectionOrder: PET_SIMULATOR_99_PET_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.catalogSection) ?? "Other",
    hiddenKeys: PET_SIMULATOR_99_HIDDEN_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 5,
    subtitleKeys: ["petClass"]
  },
  "pet-simulator-99-eggs": {
    groupKey: "catalogSection",
    groupLabel: "Egg group",
    sectionOrder: PET_SIMULATOR_99_EGG_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.catalogSection) ?? "Other",
    hiddenKeys: PET_SIMULATOR_99_HIDDEN_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 5,
    subtitleKeys: ["route", "world"]
  },
  "pet-simulator-99-enchants": {
    groupKey: "catalogSection",
    groupLabel: "Enchant group",
    sectionOrder: PET_SIMULATOR_99_ENCHANT_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.catalogSection) ?? "Other",
    hiddenKeys: PET_SIMULATOR_99_HIDDEN_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 5,
    subtitleKeys: ["role"]
  },
  "pet-simulator-99-potions": {
    groupKey: "catalogSection",
    groupLabel: "Potion group",
    sectionOrder: PET_SIMULATOR_99_POTION_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.catalogSection) ?? "Other",
    hiddenKeys: PET_SIMULATOR_99_HIDDEN_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 5,
    subtitleKeys: ["type", "family"]
  },
  "pet-simulator-99-areas": {
    groupKey: "catalogSection",
    groupLabel: "World",
    sectionOrder: PET_SIMULATOR_99_AREA_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.catalogSection) ?? "Other",
    hiddenKeys: PET_SIMULATOR_99_HIDDEN_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 5,
    subtitleKeys: ["areaLabel", "subWorld"]
  },
  "pet-simulator-99-machines": {
    groupKey: "catalogSection",
    groupLabel: "Machine type",
    sectionOrder: PET_SIMULATOR_99_MACHINE_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.catalogSection) ?? "Other",
    hiddenKeys: PET_SIMULATOR_99_HIDDEN_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 5,
    subtitleKeys: ["task", "location"]
  },
  "pet-simulator-99-charms": {
    groupKey: "catalogSection",
    groupLabel: "Charm group",
    sectionOrder: PET_SIMULATOR_99_CHARM_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.catalogSection) ?? "Other",
    hiddenKeys: PET_SIMULATOR_99_HIDDEN_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 5,
    subtitleKeys: ["role", "type"]
  },
  "pet-simulator-99-hoverboards": {
    groupKey: "catalogSection",
    groupLabel: "Unlock route",
    sectionOrder: PET_SIMULATOR_99_HOVERBOARD_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.catalogSection) ?? "Other",
    hiddenKeys: PET_SIMULATOR_99_HIDDEN_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 5,
    subtitleKeys: ["rarity", "source"]
  },
  "pet-simulator-99-booths": {
    groupKey: "catalogSection",
    groupLabel: "Booth route",
    sectionOrder: PET_SIMULATOR_99_BOOTH_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.catalogSection) ?? "Other",
    hiddenKeys: PET_SIMULATOR_99_HIDDEN_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 5,
    subtitleKeys: ["rarity", "sourceType"]
  },
  "pet-simulator-99-mastery": {
    groupKey: "catalogSection",
    groupLabel: "Mastery group",
    sectionOrder: PET_SIMULATOR_99_MASTERY_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.catalogSection) ?? "Other",
    hiddenKeys: PET_SIMULATOR_99_HIDDEN_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 5,
    subtitleKeys: ["activity", "bestFor"]
  },
  "pet-simulator-99-minigames": {
    groupKey: "catalogSection",
    groupLabel: "World",
    sectionOrder: PET_SIMULATOR_99_MINIGAME_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.catalogSection) ?? "Other",
    hiddenKeys: [...PET_SIMULATOR_99_HIDDEN_KEYS, "world", "areaNumber", "areaName"],
    additionalColumns: ["catalogSection"],
    maxStats: 5,
    subtitleKeys: ["location", "type"]
  },
  "pet-simulator-99-shiny-relics": {
    groupKey: "catalogSection",
    groupLabel: "World",
    sectionOrder: PET_SIMULATOR_99_SHINY_RELIC_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.catalogSection) ?? "Other",
    hiddenKeys: PET_SIMULATOR_99_HIDDEN_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 5,
    subtitleKeys: ["areaLabel", "locationHint"]
  },
  "sell-lemons-income-sources": {
    groupKey: "progression_stage",
    groupLabel: "Progression stage",
    sectionOrder: ["Early active setup", "Mid-game scaling", "Late-game reset value", "Endgame/global scaling"],
    getSectionLabel: (item) => normalizeValue(item.progression_stage) ?? "Other",
    hiddenKeys: [
      "progression_stage",
      "sourcePage",
      "sourceConfidence",
      "verificationNote",
      "imageStatus",
      "sourceImageUrl",
      "wikiUrl"
    ],
    additionalColumns: ["progression_stage"],
    maxStats: 4,
    subtitleKeys: []
  },
  "sell-lemons-powers": {
    groupKey: "catalogSection",
    groupLabel: "Power phase",
    sectionOrder: ["Early and midgame utility", "Scaling and automation", "Deep reset and endgame"],
    getSectionLabel: (item) => normalizeValue(item.catalogSection) ?? "Other",
    hiddenKeys: ["catalogSection", "phase", "order", "unlock", "resetNote", "sourceConfidence", "verificationNote", "imageStatus", "sourcePage"],
    additionalColumns: ["catalogSection"],
    maxStats: 3,
    subtitleKeys: []
  },
  "sell-lemons-secret-unlocks": {
    groupKey: "unlockChain",
    groupLabel: "Unlock chain",
    sectionOrder: ["Sewer chain", "UFO chain", "Completion chain"],
    getSectionLabel: (item) => normalizeValue(item.unlockChain) ?? "Other",
    hiddenKeys: [
      "unlockChain",
      "evidenceBadges",
      "sourceConfidence",
      "verificationNote",
      "imageStatus",
      "sourcePage",
      "prerequisite",
      "verification"
    ],
    additionalColumns: ["unlockChain"],
    maxStats: 4,
    subtitleKeys: []
  },
  "sell-lemons-evolution-stages": {
    groupKey: "catalogSection",
    groupLabel: "Stage group",
    sectionOrder: ["Current fruit stages"],
    getSectionLabel: (item) => normalizeValue(item.catalogSection) ?? "Current fruit stages",
    hiddenKeys: [
      "catalogSection",
      "stageOrder",
      "sourceStatus",
      "sourcePage",
      "secondarySourcePage",
      "imageStatus",
      "sortOrder",
      "verification",
      "incomeSourceNaming"
    ],
    additionalColumns: ["catalogSection"],
    maxStats: 4,
    subtitleKeys: []
  },
  "sell-lemons-locations": {
    groupKey: "catalogSection",
    groupLabel: "Route section",
    sectionOrder: ["Early and mid-game route", "Secret route", "Endgame route"],
    getSectionLabel: (item) => normalizeValue(item.catalogSection) ?? "Other",
    hiddenKeys: ["catalogSection", "sortOrder", "keyObjectsOrNpcs", "rewardOrReason", "verification"],
    additionalColumns: ["catalogSection"],
    maxStats: 4,
    subtitleKeys: []
  },
  "dress-to-impress-themes": {
    groupKey: "catalogSection",
    groupLabel: "Theme type",
    sectionOrder: DRESS_TO_IMPRESS_THEME_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: DRESS_TO_IMPRESS_SOURCE_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 5,
    hideImages: true
  },
  "dress-to-impress-pose-packs": {
    groupKey: "catalogSection",
    groupLabel: "Unlock route",
    sectionOrder: DRESS_TO_IMPRESS_POSE_PACK_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: DRESS_TO_IMPRESS_SOURCE_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "dress-to-impress-currency-items": {
    groupKey: "catalogSection",
    groupLabel: "Item source",
    sectionOrder: DRESS_TO_IMPRESS_CURRENCY_ITEM_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: DRESS_TO_IMPRESS_SOURCE_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "dress-to-impress-free-items": {
    groupKey: "catalogSection",
    groupLabel: "Wardrobe section",
    sectionOrder: DRESS_TO_IMPRESS_FREE_ITEM_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: DRESS_TO_IMPRESS_SOURCE_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 7
  },
  "dress-to-impress-code-items": {
    groupKey: "catalogSection",
    groupLabel: "Source family",
    sectionOrder: DRESS_TO_IMPRESS_CODE_ITEM_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [...DRESS_TO_IMPRESS_SOURCE_KEYS, "membershipBasis"],
    additionalColumns: ["catalogSection"],
    maxStats: 7
  },
  "dress-to-impress-ranks": {
    groupKey: "catalogSection",
    groupLabel: "Rank section",
    sectionOrder: DRESS_TO_IMPRESS_RANK_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: DRESS_TO_IMPRESS_SOURCE_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "dress-to-impress-walk-packs": {
    groupKey: "catalogSection",
    groupLabel: "Unlock route",
    sectionOrder: DRESS_TO_IMPRESS_WALK_PACK_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: DRESS_TO_IMPRESS_SOURCE_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "dress-to-impress-runway-effects": {
    groupKey: "catalogSection",
    groupLabel: "Effect source",
    sectionOrder: DRESS_TO_IMPRESS_RUNWAY_EFFECT_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: DRESS_TO_IMPRESS_SOURCE_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "dress-to-impress-pattern-packs": {
    groupKey: "catalogSection",
    groupLabel: "Unlock route",
    sectionOrder: DRESS_TO_IMPRESS_PATTERN_PACK_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: DRESS_TO_IMPRESS_SOURCE_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "dress-to-impress-hairstyles": {
    groupKey: "catalogSection",
    groupLabel: "Hair area",
    sectionOrder: DRESS_TO_IMPRESS_HAIRSTYLE_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: DRESS_TO_IMPRESS_SOURCE_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 7
  },
  "dress-to-impress-makeup": {
    groupKey: "catalogSection",
    groupLabel: "Salon section",
    sectionOrder: DRESS_TO_IMPRESS_MAKEUP_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: DRESS_TO_IMPRESS_SOURCE_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 7
  },
  "dress-to-impress-nails": {
    groupKey: "catalogSection",
    groupLabel: "Nail source",
    sectionOrder: DRESS_TO_IMPRESS_NAIL_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: DRESS_TO_IMPRESS_SOURCE_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "dress-to-impress-reward-items": {
    groupKey: "catalogSection",
    groupLabel: "Reward route",
    sectionOrder: DRESS_TO_IMPRESS_REWARD_ITEM_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: DRESS_TO_IMPRESS_SOURCE_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 7
  },
  "dress-to-impress-robux-items": {
    groupKey: "catalogSection",
    groupLabel: "Robux set",
    sectionOrder: DRESS_TO_IMPRESS_ROBUX_ITEM_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: DRESS_TO_IMPRESS_SOURCE_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 7
  },
  "dress-to-impress-vip-items": {
    groupKey: "catalogSection",
    groupLabel: "VIP section",
    sectionOrder: DRESS_TO_IMPRESS_VIP_ITEM_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: DRESS_TO_IMPRESS_SOURCE_KEYS,
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "1-speed-keyboard-escape-trails": {
    groupKey: "catalogSection",
    groupLabel: "Trail availability",
    sectionOrder: SPEED_KEYBOARD_TRAIL_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      "freeOrPremium",
      "notes",
      "robloxGamePassId",
      "robloxProductId",
      "robloxIconAssetId",
      "officialName",
      "officialCreated",
      "officialUpdated",
      "sourceStatus",
      "sourcePage",
      "secondarySourcePage",
      "imageStatus",
      "sortOrder"
    ],
    maxStats: 5
  },
  "1-speed-keyboard-escape-auras": {
    groupKey: "catalogSection",
    groupLabel: "Aura cost tier",
    sectionOrder: SPEED_KEYBOARD_AURA_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      "verificationNote",
      "robloxGamePassId",
      "robloxProductId",
      "robloxIconAssetId",
      "officialName",
      "officialCreated",
      "officialUpdated",
      "sourceStatus",
      "sourcePage",
      "secondarySourcePage",
      "imageStatus",
      "sortOrder"
    ],
    maxStats: 5
  },
  "1-speed-keyboard-escape-stages": {
    groupKey: "catalogSection",
    groupLabel: "World",
    sectionOrder: SPEED_KEYBOARD_STAGE_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "imageStatus", "sortOrder", "sourcePage", "secondarySourcePage", "sourceStatus"],
    maxStats: 4,
    hideImages: true
  },
  "1-speed-keyboard-escape-treadmills": {
    groupKey: "catalogSection",
    groupLabel: "Trainer type",
    sectionOrder: SPEED_KEYBOARD_TREADMILL_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      "robloxGamePassId",
      "robloxProductId",
      "robloxIconAssetId",
      "officialName",
      "officialCreated",
      "officialUpdated",
      "sourcePage",
      "secondarySourcePage",
      "imageStatus",
      "sortOrder"
    ],
    maxStats: 7
  },
  "rivals-weapons": {
    groupKey: "slot",
    groupLabel: "Weapon slot",
    sectionOrder: RIVALS_WEAPON_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.slot),
    hiddenKeys: [
      "slot",
      "isDefault",
      "modeExclusive",
      "modeNote",
      "imageStatus",
      "sourcePage",
      "wikiUrl",
      "sourceImageUrl",
      "verificationNote",
      "contractFamilies"
    ],
    maxStats: 6
  },
  "rivals-maps": {
    groupKey: "catalogSection",
    groupLabel: "Map availability",
    sectionOrder: RIVALS_MAP_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      "mapPool",
      "imageStatus",
      "sourcePage",
      "wikiUrl",
      "sourceImageUrl",
      "verificationNote"
    ],
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "rivals-skins": {
    groupKey: "catalogSection",
    groupLabel: "Skin source",
    sectionOrder: RIVALS_SKIN_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "imageStatus", "sourcePage", "wikiUrl", "sourceImageUrl", "verificationNote"],
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "rivals-wraps": {
    groupKey: "catalogSection",
    groupLabel: "Wrap source",
    sectionOrder: RIVALS_WRAP_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      "imageStatus",
      "sourcePage",
      "wikiUrl",
      "sourceImageUrl",
      "verificationNote"
    ],
    additionalColumns: ["catalogSection"],
    maxStats: 7
  },
  "rivals-charms": {
    groupKey: "catalogSection",
    groupLabel: "Charm source",
    sectionOrder: RIVALS_CHARM_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      "imageStatus",
      "sourcePage",
      "wikiUrl",
      "sourceImageUrl",
      "verificationNote"
    ],
    additionalColumns: ["catalogSection"],
    maxStats: 5,
    transformItem: withRivalsCharmFields
  },
  "rivals-finishers": {
    groupKey: "catalogSection",
    groupLabel: "Finisher source",
    sectionOrder: RIVALS_FINISHER_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      "sourceType",
      "imageStatus",
      "sourcePage",
      "wikiUrl",
      "sourceFile",
      "sourceImageUrl",
      "sourceCheckedAt",
      "verificationNote"
    ],
    additionalColumns: ["catalogSection"],
    maxStats: 4
  },
  "rivals-emotes": {
    groupKey: "catalogSection",
    groupLabel: "Emote source",
    sectionOrder: RIVALS_EMOTE_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "imageStatus", "sourcePage", "wikiUrl", "sourceImageUrl", "verificationNote"],
    additionalColumns: ["catalogSection"],
    maxStats: 5
  },
  "rivals-ugc": {
    groupKey: "catalogSection",
    groupLabel: "UGC item type",
    sectionOrder: RIVALS_UGC_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      "priceRobux",
      "robloxUrl",
      "imageStatus",
      "sourcePage",
      "wikiSourceStatus",
      "verificationNote"
    ],
    additionalColumns: ["catalogSection"],
    maxStats: 5
  },
  "jujutsu-shenanigans-characters": {
    groupKey: "status",
    groupLabel: "Character status",
    sectionOrder: JUJUTSU_SHENANIGANS_CHARACTER_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.status),
    hiddenKeys: [
      "status",
      ...JUJUTSU_SHENANIGANS_VERBOSE_CARD_KEYS,
      "sourcePage",
      "wikiUrl",
      "sourceImageUrl",
      "sourceConfidence",
      "verificationNote",
      "imageStatus",
      "sortOrder"
    ],
    additionalColumns: ["cardSummary"],
    maxStats: 4,
    subtitleKeys: [],
    transformItem: withJujutsuCardSummary(["strength", "limit"])
  },
  "jujutsu-shenanigans-domains": {
    groupKey: "catalogSection",
    groupLabel: "Domain type",
    sectionOrder: JUJUTSU_SHENANIGANS_DOMAIN_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      ...JUJUTSU_SHENANIGANS_VERBOSE_CARD_KEYS,
      "sourcePage",
      "wikiUrl",
      "sourceImageUrl",
      "sourceConfidence",
      "verificationNote",
      "imageStatus",
      "sortOrder"
    ],
    additionalColumns: ["catalogSection", "cardSummary"],
    maxStats: 4,
    subtitleKeys: [],
    transformItem: withJujutsuCardSummary(["effect", "notes", "counterplay"])
  },
  "jujutsu-shenanigans-items": {
    groupKey: "catalogSection",
    groupLabel: "Item source",
    sectionOrder: JUJUTSU_SHENANIGANS_ITEM_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      ...JUJUTSU_SHENANIGANS_VERBOSE_CARD_KEYS,
      "sourcePage",
      "wikiUrl",
      "sourceImageUrl",
      "imageStatus",
      "imageMissingReason",
      "verificationNote",
      "sortOrder"
    ],
    additionalColumns: ["catalogSection", "cardSummary"],
    maxStats: 5,
    subtitleKeys: [],
    transformItem: withJujutsuCardSummary(["effect"])
  },
  "jujutsu-shenanigans-gamemodes": {
    groupKey: "modeGroup",
    groupLabel: "Mode group",
    sectionOrder: JUJUTSU_SHENANIGANS_GAMEMODE_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.modeGroup),
    hiddenKeys: [
      "modeGroup",
      "category",
      ...JUJUTSU_SHENANIGANS_VERBOSE_CARD_KEYS,
      "sourceStatus",
      "sourcePage",
      "supportingSources",
      "sourceImageUrl",
      "sourceConfidence",
      "verificationNote",
      "imageStatus",
      "sortOrder"
    ],
    additionalColumns: ["modeGroup", "cardSummary"],
    maxStats: 5,
    subtitleKeys: [],
    transformItem: withJujutsuCardSummary(["objective", "progressionImpact"])
  },
  "jujutsu-shenanigans-maps": {
    groupKey: "catalogSection",
    groupLabel: "Map section",
    sectionOrder: JUJUTSU_SHENANIGANS_MAP_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      ...JUJUTSU_SHENANIGANS_VERBOSE_CARD_KEYS,
      "sourcePage",
      "sourceImageUrl",
      "sourceConfidence",
      "verificationNote",
      "imageStatus",
      "sortOrder"
    ],
    additionalColumns: ["catalogSection", "cardSummary"],
    maxStats: 5,
    subtitleKeys: [],
    transformItem: withJujutsuCardSummary(["specialRules", "landmarks", "itemSpawns"])
  },
  "jujutsu-shenanigans-emotes": {
    groupKey: "catalogSection",
    groupLabel: "Emote type",
    sectionOrder: JUJUTSU_SHENANIGANS_EMOTE_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      ...JUJUTSU_SHENANIGANS_VERBOSE_CARD_KEYS,
      "imageStatus",
      "sourcePage",
      "sourceImageUrl",
      "rawText",
      "verificationNote",
      "sortOrder"
    ],
    additionalColumns: ["catalogSection", "cardSummary"],
    maxStats: 4,
    hideImages: true,
    subtitleKeys: [],
    transformItem: withJujutsuCardSummary(["effect", "source", "movement"])
  },
  "jujutsu-shenanigans-cosmetics": {
    groupKey: "category",
    groupLabel: "Cosmetic type",
    sectionOrder: JUJUTSU_SHENANIGANS_COSMETIC_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.category),
    hiddenKeys: [
      "category",
      ...JUJUTSU_SHENANIGANS_VERBOSE_CARD_KEYS,
      "imageStatus",
      "sourcePage",
      "wikiUrl",
      "sourceImageUrl",
      "verificationNote"
    ],
    additionalColumns: ["category", "cardSummary"],
    maxStats: 5,
    hideImages: true,
    subtitleKeys: [],
    transformItem: withJujutsuCardSummary(["equipUseContext", "unlockRoute", "audioStatus"])
  },
  "jujutsu-shenanigans-titles": {
    groupKey: "catalogSection",
    groupLabel: "Title route",
    sectionOrder: JUJUTSU_SHENANIGANS_TITLE_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      ...JUJUTSU_SHENANIGANS_VERBOSE_CARD_KEYS,
      "sourcePage",
      "wikiUrl",
      "imageStatus",
      "verificationNote",
      "sortOrder"
    ],
    additionalColumns: ["catalogSection", "cardSummary"],
    maxStats: 4,
    hideImages: true,
    subtitleKeys: [],
    transformItem: withJujutsuCardSummary(["whoCanUse", "displayBehavior"])
  },
  "jujutsu-shenanigans-interactables": {
    groupKey: "catalogSection",
    groupLabel: "Interactable type",
    sectionOrder: JUJUTSU_SHENANIGANS_INTERACTABLE_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      ...JUJUTSU_SHENANIGANS_VERBOSE_CARD_KEYS,
      "sourcePage",
      "wikiUrl",
      "sourceImageUrl",
      "imageStatus",
      "imageMissingReason",
      "verificationNote",
      "sortOrder"
    ],
    additionalColumns: ["catalogSection", "cardSummary"],
    maxStats: 5,
    subtitleKeys: [],
    transformItem: withJujutsuCardSummary(["effect", "specialInteractions"])
  },
  "jujutsu-shenanigans-achievements": {
    groupKey: "catalogSection",
    groupLabel: "Achievement group",
    sectionOrder: JUJUTSU_SHENANIGANS_ACHIEVEMENT_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", ...JUJUTSU_SHENANIGANS_VERBOSE_CARD_KEYS, "sourcePage", "wikiUrl", "verificationNote"],
    additionalColumns: ["catalogSection", "cardSummary"],
    maxStats: 5,
    hideImages: true,
    subtitleKeys: [],
    transformItem: withJujutsuCardSummary(["notes"])
  },
  "jujutsu-shenanigans-build-blocks": {
    groupKey: "catalogSection",
    groupLabel: "Build block type",
    sectionOrder: JUJUTSU_SHENANIGANS_BUILD_BLOCK_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      ...JUJUTSU_SHENANIGANS_VERBOSE_CARD_KEYS,
      "sourcePage",
      "supportingSources",
      "sourceConfidence",
      "imageStatus",
      "verificationNote",
      "sortOrder"
    ],
    additionalColumns: ["catalogSection", "cardSummary"],
    maxStats: 5,
    hideImages: true,
    subtitleKeys: [],
    transformItem: withJujutsuCardSummary(["function", "triggerBehavior"])
  },
  "jujutsu-shenanigans-skill-builder-nodes": {
    groupKey: "catalogSection",
    groupLabel: "Skill Builder section",
    sectionOrder: JUJUTSU_SHENANIGANS_SKILL_BUILDER_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      ...JUJUTSU_SHENANIGANS_VERBOSE_CARD_KEYS,
      "sourcePage",
      "sourceRevision",
      "imageStatus",
      "verificationNote",
      "sortOrder"
    ],
    additionalColumns: ["catalogSection", "cardSummary"],
    maxStats: 5,
    hideImages: true,
    subtitleKeys: [],
    transformItem: withJujutsuCardSummary(["purpose", "notes"])
  },
  "99-nights-in-the-forest-classes": {
    groupKey: "status",
    groupLabel: "Availability",
    sectionOrder: NINETY_NINE_NIGHTS_CLASS_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.status),
    hiddenKeys: ["status", "currency", ...NINETY_NINE_NIGHTS_SOURCE_KEYS],
    maxStats: 5
  },
  "99-nights-in-the-forest-crafting": {
    groupKey: "catalogSection",
    groupLabel: "Crafting group",
    sectionOrder: NINETY_NINE_NIGHTS_CRAFTING_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "ingredients", ...NINETY_NINE_NIGHTS_SOURCE_KEYS],
    maxStats: 5
  },
  "99-nights-in-the-forest-entities": {
    groupKey: "catalogSection",
    groupLabel: "Encounter type",
    sectionOrder: NINETY_NINE_NIGHTS_ENTITY_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", ...NINETY_NINE_NIGHTS_SOURCE_KEYS],
    maxStats: 5
  },
  "99-nights-in-the-forest-locations": {
    groupKey: "biomeGroup",
    groupLabel: "Route group",
    sectionOrder: NINETY_NINE_NIGHTS_LOCATION_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.biomeGroup),
    hiddenKeys: ["biomeGroup", ...NINETY_NINE_NIGHTS_SOURCE_KEYS],
    maxStats: 5
  },
  "99-nights-in-the-forest-weapons": {
    groupKey: "category",
    groupLabel: "Combat role",
    sectionOrder: NINETY_NINE_NIGHTS_WEAPON_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.category),
    hiddenKeys: ["category", ...NINETY_NINE_NIGHTS_SOURCE_KEYS],
    maxStats: 5
  },
  "99-nights-in-the-forest-tools": {
    groupKey: "category",
    groupLabel: "Tool group",
    sectionOrder: NINETY_NINE_NIGHTS_TOOL_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.category),
    hiddenKeys: ["category", ...NINETY_NINE_NIGHTS_SOURCE_KEYS],
    maxStats: 5
  },
  "99-nights-in-the-forest-tameable-animals": {
    groupKey: "fluteLevel",
    groupLabel: "Flute tier",
    sectionOrder: NINETY_NINE_NIGHTS_TAMEABLE_ANIMAL_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.fluteLevel),
    hiddenKeys: [
      "fluteLevel",
      "aliases",
      "foodPerStage",
      "totalFood",
      "imageSource",
      "sourceUrls",
      "sourceStatus",
      "sourceNote",
      "verificationNote",
      "imageStatus",
      "sortOrder"
    ],
    maxStats: 5
  },
  "99-nights-in-the-forest-food": {
    groupKey: "type",
    groupLabel: "Food group",
    sectionOrder: NINETY_NINE_NIGHTS_FOOD_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.type),
    hiddenKeys: ["type", ...NINETY_NINE_NIGHTS_SOURCE_KEYS],
    maxStats: 5
  },
  "99-nights-in-the-forest-materials": {
    groupKey: "catalogSection",
    groupLabel: "Material group",
    sectionOrder: NINETY_NINE_NIGHTS_MATERIAL_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", ...NINETY_NINE_NIGHTS_SOURCE_KEYS],
    maxStats: 5
  },
  "survive-zombie-arena-classes": {
    groupKey: "catalogSection",
    groupLabel: "Unlock bracket",
    sectionOrder: SURVIVE_ZOMBIE_ARENA_CLASS_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "availability", ...SURVIVE_ZOMBIE_ARENA_SOURCE_KEYS],
    maxStats: 7
  },
  "survive-zombie-arena-weapons": {
    groupKey: "unlockStage",
    groupLabel: "Unlock route",
    sectionOrder: SURVIVE_ZOMBIE_ARENA_WEAPON_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.unlockStage),
    hiddenKeys: ["unlockStage", "upgradeNote", ...SURVIVE_ZOMBIE_ARENA_SOURCE_KEYS],
    maxStats: 5
  },
  "survive-zombie-arena-gear": {
    groupKey: "catalogSection",
    groupLabel: "Gear role",
    sectionOrder: SURVIVE_ZOMBIE_ARENA_GEAR_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", ...SURVIVE_ZOMBIE_ARENA_SOURCE_KEYS],
    maxStats: 7
  },
  "survive-zombie-arena-maps": {
    groupKey: "statusSection",
    groupLabel: "Map status",
    sectionOrder: SURVIVE_ZOMBIE_ARENA_MAP_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.statusSection),
    hiddenKeys: ["statusSection", ...SURVIVE_ZOMBIE_ARENA_SOURCE_KEYS],
    maxStats: 5
  },
  "murderers-vs-sheriffs-weapons": {
    groupKey: "catalogSection",
    groupLabel: "Rarity",
    sectionOrder: MURDERERS_VS_SHERIFFS_WEAPON_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      "slug",
      "sourceStatus",
      "imageStatus",
      "imageMissingReason",
      "sourcePage",
      "sourceUrls",
      "sourceImageUrl",
      "productId",
      "sourceGeneratedAt",
      "valueCheckedAt",
      "sortOrder"
    ],
    additionalColumns: ["weaponType", "rarity", "source", "availability", "value"],
    maxStats: 5
  },
  "murderers-vs-sheriffs-crates": {
    groupKey: "catalogSection",
    groupLabel: "Box tier",
    sectionOrder: MURDERERS_VS_SHERIFFS_CRATE_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      "slug",
      "priceRobux",
      "saleState",
      "verificationNote",
      "sourcePage",
      "sourceUrls",
      "sourceImageUrl",
      "imageStatus",
      "sortOrder"
    ],
    additionalColumns: ["tier", "price", "purchaseRoute", "availability", "rewardPool"],
    maxStats: 5
  },
  "murderers-vs-sheriffs-modes": {
    groupKey: "catalogSection",
    groupLabel: "Mode type",
    sectionOrder: MURDERERS_VS_SHERIFFS_MODE_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "placeId", "sourceStatus", "sourceUrls", "sourceCheckedAt", "verificationNote"],
    additionalColumns: ["teamSize", "queuePlace", "accessRequirement", "bestFor", "difficulty"],
    maxStats: 5
  },
  "murderers-vs-sheriffs-death-effects": {
    groupKey: "catalogSection",
    groupLabel: "Effect source",
    sectionOrder: MURDERERS_VS_SHERIFFS_DEATH_EFFECT_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      "slug",
      "sourcePage",
      "sourceUrls",
      "sourceImageUrl",
      "imageStatus",
      "imageMissingReason",
      "verificationNote",
      "sortOrder"
    ],
    additionalColumns: ["effectType", "source", "price", "unlockRoute", "availability"],
    maxStats: 5
  },
  "murderers-vs-sheriffs-bundles": {
    groupKey: "catalogSection",
    groupLabel: "Pack status",
    sectionOrder: MURDERERS_VS_SHERIFFS_BUNDLE_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      "slug",
      "sourceConfidence",
      "sourceStatus",
      "sourceEvidence",
      "sourceUrls",
      "sortOrder"
    ],
    additionalColumns: ["price", "contents", "itemTypes", "availability", "source", "relatedCatalogs"],
    maxStats: 6
  },
  "blox-fruits-accessories": {
    groupKey: "catalogSection",
    groupLabel: "Availability",
    sectionOrder: BLOX_FRUITS_ACCESSORY_SECTION_ORDER,
    additionalColumns: ["displaySea", "bestFor", "damage", "defense", "mobility", "utility"],
    hiddenKeys: BLOX_FRUITS_ACCESSORY_HIDDEN_KEYS,
    maxStats: 6,
    transformItem: withBloxFruitsAccessoryFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-fruits": {
    groupKey: "catalogSection",
    groupLabel: "Fruit group",
    sectionOrder: BLOX_FRUITS_FRUIT_SECTION_ORDER,
    additionalColumns: ["displayType", "moneyPrice", "permanentPrice", "awakeningCost", "status", "baseFruit"],
    hiddenKeys: BLOX_FRUITS_FRUIT_HIDDEN_KEYS,
    maxStats: 6,
    transformItem: withBloxFruitsFruitFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-swords": {
    groupKey: "catalogSection",
    groupLabel: "Sword route",
    sectionOrder: BLOX_FRUITS_SWORD_SECTION_ORDER,
    additionalColumns: ["displaySea", "sourceRoute", "displayCost", "progressionUse"],
    hiddenKeys: BLOX_FRUITS_SWORD_HIDDEN_KEYS,
    maxStats: 4,
    transformItem: withBloxFruitsSwordFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-fighting-styles": {
    groupKey: "catalogSection",
    groupLabel: "Unlock stage",
    sectionOrder: BLOX_FRUITS_FIGHTING_STYLE_SECTION_ORDER,
    additionalColumns: ["sourceTeacher", "costSummary", "masteryGate", "extraUnlock", "progressionRole", "bestFor"],
    hiddenKeys: BLOX_FRUITS_FIGHTING_STYLE_HIDDEN_KEYS,
    maxStats: 6,
    transformItem: withBloxFruitsFightingStyleFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-materials": {
    groupKey: "catalogSection",
    groupLabel: "Material use",
    sectionOrder: BLOX_FRUITS_MATERIAL_SECTION_ORDER,
    additionalColumns: ["displaySea", "sourceRoute", "use", "farmRoute", "craftCost"],
    hiddenKeys: BLOX_FRUITS_MATERIAL_HIDDEN_KEYS,
    maxStats: 5,
    transformItem: withBloxFruitsMaterialFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-races": {
    groupKey: "catalogSection",
    groupLabel: "Unlock route",
    sectionOrder: BLOX_FRUITS_RACE_SECTION_ORDER,
    additionalColumns: ["unlockRoute", "rerollStatus", "bestFor", "mainStrength", "mainLimit"],
    hiddenKeys: BLOX_FRUITS_RACE_HIDDEN_KEYS,
    maxStats: 5,
    transformItem: withBloxFruitsRaceFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-bosses": {
    groupKey: "catalogSection",
    groupLabel: "Boss route",
    sectionOrder: BLOX_FRUITS_BOSS_SECTION_ORDER,
    additionalColumns: ["displaySea", "location", "level", "respawnAccess", "dropsRewards", "routeUse"],
    hiddenKeys: BLOX_FRUITS_BOSS_HIDDEN_KEYS,
    maxStats: 6,
    transformItem: withBloxFruitsBossFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-enemies": {
    groupKey: "catalogSection",
    groupLabel: "Enemy stage",
    sectionOrder: BLOX_FRUITS_ENEMY_SECTION_ORDER,
    additionalColumns: ["seaStage", "level", "islandRegion", "questSource", "dropsRewards"],
    hiddenKeys: BLOX_FRUITS_ENEMY_HIDDEN_KEYS,
    maxStats: 5,
    hideImages: true,
    transformItem: withBloxFruitsEnemyFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-locations": {
    groupKey: "catalogSection",
    groupLabel: "Location route",
    sectionOrder: BLOX_FRUITS_LOCATION_SECTION_ORDER,
    additionalColumns: ["displaySea", "levelRange", "locationType", "routeRole", "accessTravel"],
    hiddenKeys: BLOX_FRUITS_LOCATION_HIDDEN_KEYS,
    maxStats: 5,
    transformItem: withBloxFruitsLocationFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-quests": {
    groupKey: "catalogSection",
    groupLabel: "Sea",
    sectionOrder: BLOX_FRUITS_QUEST_SECTION_ORDER,
    additionalColumns: ["displaySea", "levelRequirement", "islandArea", "questGiverName", "objective"],
    hiddenKeys: BLOX_FRUITS_QUEST_HIDDEN_KEYS,
    maxStats: 5,
    hideImages: true,
    transformItems: withBloxFruitsQuestFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-sea-events": {
    groupKey: "catalogSection",
    groupLabel: "Hunt route",
    sectionOrder: BLOX_FRUITS_SEA_EVENT_SECTION_ORDER,
    additionalColumns: ["dangerLevel", "displayArea", "spawnAccess", "mainReward", "requiredSetup"],
    hiddenKeys: BLOX_FRUITS_SEA_EVENT_HIDDEN_KEYS,
    maxStats: 5,
    transformItem: withBloxFruitsSeaEventFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-abilities": {
    groupKey: "catalogSection",
    groupLabel: "Ability role",
    sectionOrder: BLOX_FRUITS_ABILITY_SECTION_ORDER,
    additionalColumns: ["unlockRoute", "displayCost", "teacherSource", "levelMasteryRequirement", "keyUse"],
    hiddenKeys: BLOX_FRUITS_ABILITY_HIDDEN_KEYS,
    maxStats: 5,
    transformItem: withBloxFruitsAbilityFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-aura-stages": {
    groupKey: "catalogSection",
    groupLabel: "Aura path",
    sectionOrder: BLOX_FRUITS_AURA_STAGE_SECTION_ORDER,
    additionalColumns: ["displayStage", "coverage", "auraExpNeeded", "bonusEffect", "progressionNote"],
    hiddenKeys: BLOX_FRUITS_AURA_STAGE_HIDDEN_KEYS,
    maxStats: 5,
    transformItem: withBloxFruitsAuraStageFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-aura-visuals": {
    groupKey: "catalogSection",
    groupLabel: "Aura visual",
    sectionOrder: BLOX_FRUITS_AURA_VISUAL_SECTION_ORDER,
    additionalColumns: ["visualStage", "bodyCoverage", "armsVisual", "legsVisual", "statEffect", "equipUseNote"],
    hiddenKeys: BLOX_FRUITS_AURA_VISUAL_HIDDEN_KEYS,
    maxStats: 6,
    transformItem: withBloxFruitsAuraVisualFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-boats": {
    groupKey: "catalogSection",
    groupLabel: "Boat route",
    sectionOrder: BLOX_FRUITS_BOAT_SECTION_ORDER,
    additionalColumns: ["sourceAccess", "displayPrice", "displayHealth", "displaySeats", "displaySpeed"],
    hiddenKeys: BLOX_FRUITS_BOAT_HIDDEN_KEYS,
    maxStats: 5,
    transformItem: withBloxFruitsBoatFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-guns": {
    groupKey: "catalogSection",
    groupLabel: "Gun route",
    sectionOrder: BLOX_FRUITS_GUN_SECTION_ORDER,
    additionalColumns: ["displaySea", "sourceRoute", "costOrDrop", "requirementMastery", "combatRole"],
    hiddenKeys: BLOX_FRUITS_GUN_HIDDEN_KEYS,
    maxStats: 5,
    transformItem: withBloxFruitsGunFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-instinct-levels": {
    groupKey: "catalogSection",
    groupLabel: "Instinct path",
    sectionOrder: BLOX_FRUITS_INSTINCT_LEVEL_SECTION_ORDER,
    additionalColumns: ["displayLevel", "expRange", "baseDodges", "progressNote"],
    hiddenKeys: BLOX_FRUITS_INSTINCT_LEVEL_HIDDEN_KEYS,
    maxStats: 4,
    transformItem: withBloxFruitsInstinctLevelFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-npcs": {
    groupKey: "catalogSection",
    groupLabel: "NPC role",
    sectionOrder: BLOX_FRUITS_NPC_SECTION_ORDER,
    additionalColumns: ["npcRole", "displaySea", "displayLocation", "purpose", "combatLevel"],
    hiddenKeys: BLOX_FRUITS_NPC_HIDDEN_KEYS,
    maxStats: 5,
    transformItem: withBloxFruitsNpcFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-titles": {
    groupKey: "catalogSection",
    groupLabel: "Unlock route",
    sectionOrder: BLOX_FRUITS_TITLE_SECTION_ORDER,
    additionalColumns: ["displayTitleNumber", "unlockRequirement", "unlockRoute", "relatedTarget", "availabilityNote"],
    hiddenKeys: BLOX_FRUITS_TITLE_HIDDEN_KEYS,
    maxStats: 5,
    hideImages: true,
    transformItem: withBloxFruitsTitleFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-special-titles": {
    groupKey: "catalogSection",
    groupLabel: "Special title type",
    sectionOrder: BLOX_FRUITS_SPECIAL_TITLE_SECTION_ORDER,
    additionalColumns: ["grantRoute", "holderTarget", "obtainmentNote", "normalPlayerRoute"],
    hiddenKeys: BLOX_FRUITS_SPECIAL_TITLE_HIDDEN_KEYS,
    maxStats: 4,
    transformItem: withBloxFruitsSpecialTitleFields,
    getSectionLabel: getCatalogSection
  },
  "blox-fruits-title-colors": {
    groupKey: "catalogSection",
    groupLabel: "Color unlock",
    sectionOrder: BLOX_FRUITS_TITLE_COLOR_SECTION_ORDER,
    additionalColumns: ["unlockRequirement", "titleCountNeeded", "unlockStage", "visualRole"],
    hiddenKeys: BLOX_FRUITS_TITLE_COLOR_HIDDEN_KEYS,
    maxStats: 4,
    transformItem: withBloxFruitsTitleColorFields,
    getSectionLabel: getCatalogSection
  },
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
    hideImages: true,
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
    additionalColumns: ["runType", "level", "entryItem", "location", "mainRewards"],
    hiddenKeys: SAILOR_PIECE_RAW_CARD_KEYS,
    maxStats: 5,
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
    hideImages: true,
    getSectionLabel: getTierSection
  },
  "sailor-piece-bloodlines": {
    groupKey: "tier",
    groupLabel: "Bloodline tier",
    sectionOrder: ["S+", "A", "B", "C", "D"],
    additionalColumns: ["damage", "hp", "luck", "weaponBonus", "sourcePity"],
    hiddenKeys: [...SAILOR_PIECE_RAW_CARD_KEYS, "effect", "bonus", "recipe", "requirements", "tags", "rarity"],
    maxStats: 5,
    getSectionLabel: getTierSection
  },
  "sailor-piece-bosses": {
    groupKey: "bossStage",
    groupLabel: "Boss stage",
    sectionOrder: SAILOR_PIECE_ISLANDS_SECTION_ORDER,
    additionalColumns: ["difficulty", "level", "hp", "respawnAccess", "notableDrops"],
    hiddenKeys: [...SAILOR_PIECE_RAW_CARD_KEYS, "tier", "rarity", "region"],
    maxStats: 5,
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
    additionalColumns: ["location", "encounter", "dropChance", "spawnRequirement", "maxBonus"],
    hiddenKeys: [...SAILOR_PIECE_RAW_CARD_KEYS, "tier", "rarity", "effect", "bonus", "recipe", "requirements", "tags"],
    maxStats: 5,
    getSectionLabel: getCatalogSection
  },
  "sailor-piece-titles": {
    groupKey: "titleRole",
    groupLabel: "Title role",
    sectionOrder: SAILOR_PIECE_TITLE_SECTION_ORDER,
    additionalColumns: ["tier", "bonus", "unlockRoute", "requirement", "dropOrPity"],
    hiddenKeys: [...SAILOR_PIECE_RAW_CARD_KEYS, "effect", "recipe", "requirements", "tags", "rarity"],
    maxStats: 5,
    hideImages: true,
    getSectionLabel: getTitleRoleSection
  },
  "sailor-piece-melee-specs": {
    groupKey: "tier",
    groupLabel: "Melee tier",
    sectionOrder: SAILOR_PIECE_TIER_SECTION_ORDER,
    additionalColumns: ["statPriority", "unlockRoute", "sourceLocation", "abilityCount", "signatureMove"],
    hiddenKeys: [...SAILOR_PIECE_RAW_CARD_KEYS, "rarity", "verificationNote"],
    maxStats: 5,
    getSectionLabel: getTierSection
  },
  "sailor-piece-runes": {
    groupKey: "tier",
    groupLabel: "Rune tier",
    sectionOrder: SAILOR_PIECE_TIER_SECTION_ORDER,
    additionalColumns: ["displayRarity", "source", "bonusType", "baseEffect", "maxEffect"],
    hiddenKeys: [...SAILOR_PIECE_RAW_CARD_KEYS, "rarity"],
    maxStats: 5,
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
  },
  "wizard-alchemy-materials": {
    groupKey: "catalogSection",
    groupLabel: "Material role",
    sectionOrder: WIZARD_ALCHEMY_MATERIAL_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.catalogSection) ?? null,
    hiddenKeys: ["catalogSection"],
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "wizard-alchemy-potions": {
    groupKey: "category",
    groupLabel: "Potion route",
    sectionOrder: WIZARD_ALCHEMY_POTION_SECTION_ORDER,
    getSectionLabel: getCategorySection,
    hiddenKeys: ["category", "sourcePage", "sourceImageUrl", "rawText"],
    additionalColumns: ["category"],
    maxStats: 7
  },
  "wizard-alchemy-races": {
    groupKey: "catalogSection",
    groupLabel: "Race rarity",
    sectionOrder: WIZARD_ALCHEMY_RACE_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "alternateName", "confidence", "verificationNote"],
    additionalColumns: ["catalogSection"],
    maxStats: 8
  },
  "wizard-alchemy-wands": {
    groupKey: "catalogSection",
    groupLabel: "Wand route",
    sectionOrder: WIZARD_ALCHEMY_WAND_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "priceGold", "verificationNote"],
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "wizard-alchemy-brooms": {
    groupKey: "catalogSection",
    groupLabel: "Travel route",
    sectionOrder: WIZARD_ALCHEMY_BROOM_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "priceCoins", "sourceImageUrl"],
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "wizard-alchemy-robes": {
    groupKey: "catalogSection",
    groupLabel: "Robe stage",
    sectionOrder: WIZARD_ALCHEMY_ROBE_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "priceGold", "verificationNote"],
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "wizard-alchemy-wizard-hats": {
    groupKey: "catalogSection",
    groupLabel: "Hat route",
    sectionOrder: WIZARD_ALCHEMY_WIZARD_HAT_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "priceGold", "verificationNote"],
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "wizard-alchemy-chests": {
    groupKey: "catalogSection",
    groupLabel: "Chest route",
    sectionOrder: WIZARD_ALCHEMY_CHEST_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "verificationNote"],
    additionalColumns: ["catalogSection"],
    maxStats: 8
  },
  "wizard-alchemy-enemies": {
    groupKey: "catalogSection",
    groupLabel: "Enemy route",
    sectionOrder: WIZARD_ALCHEMY_ENEMY_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "family", "verificationNote"],
    additionalColumns: ["catalogSection"],
    maxStats: 8
  },
  "wizard-alchemy-enchantments": {
    groupKey: "catalogSection",
    groupLabel: "Build role",
    sectionOrder: WIZARD_ALCHEMY_ENCHANTMENT_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "verificationNote"],
    additionalColumns: ["catalogSection"],
    maxStats: 7
  },
  "wizard-alchemy-locations": {
    groupKey: "catalogSection",
    groupLabel: "Route stage",
    sectionOrder: WIZARD_ALCHEMY_LOCATION_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "verificationNote"],
    additionalColumns: ["catalogSection"],
    maxStats: 8
  },
  "wizard-alchemy-npcs": {
    groupKey: "catalogSection",
    groupLabel: "NPC role",
    sectionOrder: WIZARD_ALCHEMY_NPC_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "verificationNote"],
    additionalColumns: ["catalogSection"],
    maxStats: 7
  },
  "wizard-alchemy-resource-nodes": {
    groupKey: "catalogSection",
    groupLabel: "Source route",
    sectionOrder: WIZARD_ALCHEMY_RESOURCE_NODE_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "verificationNote"],
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "slime-rng-slimes": {
    groupKey: "catalogSection",
    groupLabel: "Variant",
    sectionOrder: SLIME_RNG_SLIME_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "sortOrder", "sourcePage", "sourceImageUrl"],
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "slime-rng-zones": {
    groupKey: "stage",
    groupLabel: "Stage",
    sectionOrder: SLIME_RNG_ZONE_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.stage),
    hiddenKeys: ["stage", "sortOrder", "sourcePage", "sourceImageUrl", "zoneName"],
    additionalColumns: ["stage"],
    maxStats: 6
  },
  "slime-rng-crafting-recipes": {
    groupKey: "craftingStage",
    groupLabel: "Crafting stage",
    sectionOrder: SLIME_RNG_CRAFTING_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.craftingStage),
    hiddenKeys: [
      "craftingStage",
      "sortOrder",
      "sourcePage",
      "sourceImageUrl",
      "requiredSlimeOne",
      "requiredSlimeTwo",
      "requiredSlimeThree"
    ],
    additionalColumns: ["craftingStage"],
    maxStats: 7
  },
  "slime-rng-items": {
    groupKey: "itemType",
    groupLabel: "Item type",
    sectionOrder: SLIME_RNG_ITEM_SECTION_ORDER,
    getSectionLabel: (item) => normalizeValue(item.itemType),
    hiddenKeys: ["itemType", "effect", "sortOrder", "sourcePage", "sourceImageUrl"],
    additionalColumns: ["itemType"],
    maxStats: 7
  },
  "slime-rng-power-fruits": {
    groupKey: "catalogSection",
    groupLabel: "Fruit list",
    sectionOrder: SLIME_RNG_POWER_FRUIT_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "spawnChanceDenominator", "sortOrder", "sourcePage", "sourceImageUrl"],
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "slime-rng-rebirths": {
    groupKey: "catalogSection",
    groupLabel: "Rebirth range",
    sectionOrder: SLIME_RNG_REBIRTH_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "rebirthRange", "resetNote", "sortOrder", "sourcePage", "sourceImageUrl"],
    additionalColumns: ["catalogSection"],
    maxStats: 3,
    hideImages: true
  },
  "slime-rng-index-rewards": {
    groupKey: "catalogSection",
    groupLabel: "Mutation type",
    sectionOrder: SLIME_RNG_INDEX_REWARD_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "sortOrder", "sourcePage", "rewardSummary"],
    additionalColumns: ["catalogSection"],
    maxStats: 5,
    hideImages: true
  },
  "kick-a-lucky-block-brainrots": {
    groupKey: "catalogSection",
    groupLabel: "Brainrot tier",
    sectionOrder: KICK_A_LUCKY_BLOCK_BRAINROT_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [
      "catalogSection",
      "sortOrder",
      "sourcePage",
      "sourceStatus",
      "sourceConfidence",
      "incomeType",
      "availability"
    ],
    additionalColumns: ["catalogSection"],
    maxStats: 3
  },
  "kick-a-lucky-block-mutations": {
    groupKey: "catalogSection",
    groupLabel: "Mutation confidence",
    sectionOrder: KICK_A_LUCKY_BLOCK_MUTATION_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "sortOrder", "sourcePage", "sourceStatus"],
    additionalColumns: ["catalogSection"],
    maxStats: 4
  },
  "kick-a-lucky-block-weights": {
    groupKey: "catalogSection",
    groupLabel: "Upgrade stage",
    sectionOrder: KICK_A_LUCKY_BLOCK_WEIGHT_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "sortOrder", "sourcePage", "sourceImageUrl", "sourceStatus"],
    additionalColumns: ["catalogSection"],
    maxStats: 4
  },
  "kick-a-lucky-block-zones": {
    groupKey: "catalogSection",
    groupLabel: "Zone stage",
    sectionOrder: KICK_A_LUCKY_BLOCK_ZONE_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: ["catalogSection", "sortOrder", "sourcePage", "sourceStatus"],
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "untitled-boxing-game-styles": {
    groupKey: "catalogSection",
    groupLabel: "Style group",
    sectionOrder: UNTITLED_BOXING_GAME_STYLE_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [...UNTITLED_BOXING_GAME_SOURCE_KEYS],
    additionalColumns: ["catalogSection"],
    maxStats: 5
  },
  "untitled-boxing-game-gloves": {
    groupKey: "catalogSection",
    groupLabel: "Glove route",
    sectionOrder: UNTITLED_BOXING_GAME_GLOVE_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [...UNTITLED_BOXING_GAME_SOURCE_KEYS, "crate"],
    additionalColumns: ["catalogSection"],
    maxStats: 6
  },
  "untitled-boxing-game-emotes": {
    groupKey: "catalogSection",
    groupLabel: "Emote rarity",
    sectionOrder: UNTITLED_BOXING_GAME_EMOTE_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [...UNTITLED_BOXING_GAME_SOURCE_KEYS],
    additionalColumns: ["catalogSection"],
    maxStats: 5,
    hideImages: true
  },
  "untitled-boxing-game-knockout-effects": {
    groupKey: "catalogSection",
    groupLabel: "Effect route",
    sectionOrder: UNTITLED_BOXING_GAME_KNOCKOUT_EFFECT_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [...UNTITLED_BOXING_GAME_SOURCE_KEYS, "effectSummary"],
    additionalColumns: ["catalogSection"],
    maxStats: 5
  },
  "untitled-boxing-game-titles": {
    groupKey: "catalogSection",
    groupLabel: "Unlock category",
    sectionOrder: UNTITLED_BOXING_GAME_TITLE_SECTION_ORDER,
    getSectionLabel: getCatalogSection,
    hiddenKeys: [...UNTITLED_BOXING_GAME_SOURCE_KEYS, "displayName"],
    additionalColumns: ["catalogSection"],
    maxStats: 5,
    hideImages: true
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

function withRivalsCharmFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  const normalizedScope = normalizeValue(item.weaponScope);
  const normalizedWeapon = normalizeValue(item.relatedWeapon);

  return {
    ...item,
    weaponScope: normalizedScope === "Not listed" ? null : item.weaponScope,
    relatedWeapon: normalizedWeapon === "Not listed" ? null : item.relatedWeapon
  };
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

function withBloxFruitsAccessoryFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  const bonusParts = getBloxFruitsBonusParts(item);

  return {
    ...item,
    catalogSection: getBloxFruitsAccessorySection(item),
    displaySea: getBloxFruitsAccessorySeaLabel(item),
    bestFor: getBloxFruitsAccessoryBestFor(bonusParts),
    damage: filterBloxFruitsBonusParts(bonusParts, isBloxFruitsDamageBonus),
    defense: filterBloxFruitsBonusParts(bonusParts, isBloxFruitsDefenseBonus),
    mobility: filterBloxFruitsBonusParts(bonusParts, isBloxFruitsMobilityBonus),
    utility: filterBloxFruitsBonusParts(bonusParts, isBloxFruitsUtilityBonus)
  };
}

function getBloxFruitsAccessorySection(item: GameDatasetCatalogItem): string | null {
  const sea = normalizeValue(item.sea)?.toLowerCase() ?? "";
  if (!sea) return null;
  if (sea.includes("admin")) return "Admin-only accessories";
  if (sea.includes("event")) return "Event accessories";

  const seaNumbers = Array.from(new Set(sea.match(/[123]/g) ?? []));
  if (seaNumbers.length > 1) return "Multi-sea accessories";
  if (seaNumbers[0] === "1") return "First Sea accessories";
  if (seaNumbers[0] === "2") return "Second Sea accessories";
  if (seaNumbers[0] === "3") return "Third Sea accessories";
  return null;
}

function getBloxFruitsAccessorySeaLabel(item: GameDatasetCatalogItem): string | null {
  const sea = normalizeValue(item.sea)?.toLowerCase() ?? "";
  if (!sea) return null;
  if (sea.includes("admin")) return "Admin-only";
  if (sea.includes("event")) return "Event";

  const seaNumbers = Array.from(new Set(sea.match(/[123]/g) ?? []));
  if (!seaNumbers.length) return null;
  const seaLabels: Record<string, string> = {
    "1": "First Sea",
    "2": "Second Sea",
    "3": "Third Sea"
  };
  return seaNumbers.map((value) => seaLabels[value]).filter(Boolean).join(" / ") || null;
}

function getBloxFruitsBonusParts(item: GameDatasetCatalogItem): string[] {
  const raw = normalizeValue(item.bonuses);
  if (!raw) return [];
  return (
    raw
      .match(/[+-]\s*\d[\s\S]*?(?=\s+[+-]\s*\d|$)/g)
      ?.map((part) => normalizeBloxFruitsBonusPart(part))
      .filter(Boolean) ?? []
  );
}

function normalizeBloxFruitsBonusPart(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\bFruit -/g, "Blox Fruit -")
    .replace(/\bFlashStep\b/g, "Flash Step")
    .trim();
}

function filterBloxFruitsBonusParts(
  bonusParts: string[],
  predicate: (value: string) => boolean
): string[] | null {
  const matches = bonusParts.filter(predicate);
  return matches.length ? matches : null;
}

function isBloxFruitsDamageBonus(value: string): boolean {
  const lowered = value.toLowerCase();
  return (
    lowered.includes("damage") &&
    !lowered.includes("damage resistance") &&
    !lowered.includes("damage reduction") &&
    !lowered.includes("defense") &&
    !lowered.includes("material drop rate")
  );
}

function isBloxFruitsDefenseBonus(value: string): boolean {
  const lowered = value.toLowerCase();
  return (
    lowered.includes("damage resistance") ||
    lowered.includes("damage reduction") ||
    lowered.includes("defense") ||
    lowered.includes("health") ||
    lowered.includes("life leech")
  );
}

function isBloxFruitsMobilityBonus(value: string): boolean {
  const lowered = value.toLowerCase();
  return (
    lowered.includes("movement speed") ||
    lowered.includes("dash") ||
    lowered.includes("dashing") ||
    lowered.includes("flash step") ||
    lowered.includes("air jump")
  );
}

function isBloxFruitsUtilityBonus(value: string): boolean {
  const lowered = value.toLowerCase();
  return (
    lowered.includes("energy") ||
    lowered.includes("cooldown") ||
    lowered.includes("instinct") ||
    lowered.includes("vision") ||
    lowered.includes("drop rate") ||
    lowered.includes("boost") ||
    lowered.includes("multiplier") ||
    lowered.includes("terror level") ||
    lowered.includes("meter")
  );
}

function getBloxFruitsAccessoryBestFor(bonusParts: string[]): string[] | null {
  const text = bonusParts.join(" ").toLowerCase();
  if (!text) return null;

  const labels: string[] = [];
  addBloxFruitsBestForLabel(labels, /sea event|sea damage reduction/.test(text), "Sea events");
  addBloxFruitsBestForLabel(labels, /blox fruit - (damage|cooldown|damage resistance)|fruit meter/.test(text), "Blox Fruit builds");
  addBloxFruitsBestForLabel(labels, /sword - (damage|cooldown|damage resistance)/.test(text), "Sword builds");
  addBloxFruitsBestForLabel(labels, /melee - (damage|cooldown|damage resistance)|life leech/.test(text), "Melee builds");
  addBloxFruitsBestForLabel(labels, /gun - (damage|cooldown|damage resistance)/.test(text), "Gun builds");
  addBloxFruitsBestForLabel(labels, /all - (damage|cooldown|damage resistance)/.test(text), "Hybrid builds");
  addBloxFruitsBestForLabel(labels, bonusParts.some(isBloxFruitsMobilityBonus), "Mobility");
  addBloxFruitsBestForLabel(labels, /instinct|vision/.test(text), "PvP tracking");
  addBloxFruitsBestForLabel(labels, bonusParts.some(isBloxFruitsDefenseBonus), "Defense");
  addBloxFruitsBestForLabel(labels, /experience|token|candy|hearts|friendship/.test(text), "Event or EXP farming");

  return labels.length ? labels.slice(0, 4) : null;
}

function addBloxFruitsBestForLabel(labels: string[], shouldAdd: boolean, label: string) {
  if (shouldAdd && !labels.includes(label)) {
    labels.push(label);
  }
}

function withBloxFruitsFruitFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  const status = getBloxFruitsFruitStatus(item);
  const baseFruit = getBloxFruitsMutationBaseFruit(item);

  return {
    ...item,
    catalogSection: getBloxFruitsFruitSection(item),
    displayType: baseFruit ? "Mutation" : normalizeValue(item.type),
    moneyPrice: formatBloxFruitsMoney(item.money),
    permanentPrice: formatBloxFruitsRobux(item.robux),
    awakeningCost: formatBloxFruitsFragments(getBloxFruitsFieldValue(item, "awakening")),
    status,
    baseFruit
  };
}

function getBloxFruitsFruitSection(item: GameDatasetCatalogItem): string | null {
  const unavailableReason = normalizeValue(getBloxFruitsFieldValue(item, "unavailableReason"));
  const type = normalizeValue(item.type);
  if (unavailableReason?.toLowerCase() === "admin-exclusive") return "Admin-only fruits";
  if (unavailableReason) return "Legacy and unavailable fruits";
  if (getBloxFruitsMutationBaseFruit(item)) return "Fruit mutations";
  if (type === "Natural") return "Natural fruits";
  if (type === "Elemental") return "Elemental fruits";
  if (type === "Beast") return "Beast fruits";
  return null;
}

function getBloxFruitsFruitStatus(item: GameDatasetCatalogItem): string {
  const unavailableReason = normalizeValue(getBloxFruitsFieldValue(item, "unavailableReason"));
  if (unavailableReason) return unavailableReason === "Admin-Exclusive" ? "Admin-only" : unavailableReason;
  if (getBloxFruitsMutationBaseFruit(item)) return "Mutation";
  return "Current";
}

function getBloxFruitsMutationBaseFruit(item: GameDatasetCatalogItem): string | null {
  const name = normalizeValue(item.name) ?? "";
  const match = name.match(/\(([^)]+)\)/);
  if (!match?.[1]) return null;
  if (/^(empyrean|fiend|werewolf)\b/i.test(name)) return match[1];
  return null;
}

function withBloxFruitsSwordFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  return {
    ...item,
    catalogSection: getBloxFruitsSwordSection(item),
    displaySea: getBloxFruitsSeaLabel(item.sea),
    sourceRoute: getBloxFruitsSwordSourceRoute(item),
    displayCost: getBloxFruitsSwordCost(item),
    progressionUse: getBloxFruitsSwordProgressionUse(item)
  };
}

function getBloxFruitsSwordSection(item: GameDatasetCatalogItem): string | null {
  const sea = normalizeValue(item.sea)?.toLowerCase() ?? "";
  if (sea.includes("admin")) return "Admin-only swords";

  const seaNumbers = getBloxFruitsSeaNumbers(item.sea);
  if (seaNumbers.length > 1) return "Multi-sea and special swords";
  if (seaNumbers[0] === "1") return "First Sea swords";
  if (seaNumbers[0] === "2") return "Second Sea swords";
  if (seaNumbers[0] === "3") return "Third Sea swords";
  return null;
}

function getBloxFruitsSwordSourceRoute(item: GameDatasetCatalogItem): string | null {
  const name = normalizeValue(item.name) ?? "";
  if (name === "Triple Dark Blade") return "Admin-only";
  if (name === "Fishing Trophy") return "2025 Fishing Tournament";

  const obtainment = normalizeValue(item.obtainment);
  if (!obtainment) return null;

  const fromMatch = obtainment.match(/^(?:[\d,]+|\d(?:\s+\d)+)\s+from\s+(.+)$/i);
  if (fromMatch?.[1]) return normalizeBloxFruitsRouteText(fromMatch[1]);

  if (/^from\s+/i.test(obtainment)) {
    return normalizeBloxFruitsRouteText(obtainment.replace(/^from\s+/i, ""));
  }

  return normalizeBloxFruitsRouteText(obtainment);
}

function getBloxFruitsSwordCost(item: GameDatasetCatalogItem): string | null {
  return formatBloxFruitsMoney(item.money) ?? formatBloxFruitsRobux(item.robux);
}

function getBloxFruitsSwordProgressionUse(item: GameDatasetCatalogItem): string | null {
  const route = getBloxFruitsSwordSourceRoute(item)?.toLowerCase() ?? "";
  const name = normalizeValue(item.name) ?? "";
  if (!route) return name === "Triple Dark Blade" ? "Admin-only reference" : null;
  if (route.includes("shop") || route.includes("dealer")) return "Shop weapon";
  if (route.includes("tournament")) return "Tournament reward";
  if (route.includes("admin")) return "Admin-only reference";
  if (route.includes("scroll") || route.includes("quest") || route.includes("trial")) return "Quest weapon";
  if (route.includes("shrine") || route.includes("rough sea") || route.includes("lightning")) return "Special event route";
  if (/defeat|boss|reaper|queen|prince|king|indra|longma|terrorshark|order|saw/.test(route)) {
    return "Boss drop";
  }
  return null;
}

function withBloxFruitsFightingStyleFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  const name = normalizeValue(item.name) ?? "";
  const details = getBloxFruitsFightingStyleDetails(name);

  return {
    ...item,
    catalogSection: details.section,
    sourceTeacher: details.teacher ?? getBloxFruitsTeacherFromType(item),
    costSummary: details.cost,
    masteryGate: details.masteryGate,
    extraUnlock: details.extraUnlock,
    progressionRole: details.progressionRole,
    bestFor: details.bestFor
  };
}

function getBloxFruitsFightingStyleDetails(name: string) {
  const details: Record<
    string,
    {
      section: string;
      teacher?: string | null;
      cost?: string | null;
      masteryGate?: string | null;
      extraUnlock?: string | null;
      progressionRole?: string | null;
      bestFor?: string | null;
    }
  > = {
    Combat: {
      section: "Starter and First Sea fighting styles",
      teacher: "Starter style",
      progressionRole: "Starter melee",
      bestFor: "New characters"
    },
    "Dark Step": {
      section: "Starter and First Sea fighting styles",
      cost: "$150,000",
      progressionRole: "Death Step base",
      bestFor: "Early mastery path"
    },
    Electric: {
      section: "Starter and First Sea fighting styles",
      cost: "$500,000",
      progressionRole: "Electric Claw base",
      bestFor: "Early mastery path"
    },
    "Water Kung Fu": {
      section: "Starter and First Sea fighting styles",
      cost: "$750,000",
      progressionRole: "Sharkman Karate base",
      bestFor: "Early mastery path"
    },
    "Dragon Breath": {
      section: "Second Sea fighting styles",
      cost: "1,500 fragments",
      progressionRole: "Dragon Talon base",
      bestFor: "Fragment unlock path"
    },
    Superhuman: {
      section: "Second Sea fighting styles",
      cost: "$3,000,000",
      masteryGate: "300 mastery on Dark Step, Electric, Water Kung Fu, and Dragon Breath",
      progressionRole: "Godhuman requirement",
      bestFor: "Midgame melee chain"
    },
    "Death Step": {
      section: "Second Sea fighting styles",
      cost: "$2,500,000 + 5,000 fragments",
      masteryGate: "400 mastery on Dark Step",
      extraUnlock: "Library Key",
      progressionRole: "Dark Step upgrade",
      bestFor: "Godhuman chain"
    },
    "Sharkman Karate": {
      section: "Second Sea fighting styles",
      cost: "$2,500,000 + 5,000 fragments",
      masteryGate: "400 mastery on Water Kung Fu",
      extraUnlock: "Water Key",
      progressionRole: "Water Kung Fu upgrade",
      bestFor: "Godhuman chain"
    },
    "Electric Claw": {
      section: "Third Sea fighting styles",
      cost: "$3,000,000 + 5,000 fragments",
      masteryGate: "400 mastery on Electric",
      extraUnlock: "Previous Hero timed quest",
      progressionRole: "Electric upgrade",
      bestFor: "Godhuman chain"
    },
    "Dragon Talon": {
      section: "Third Sea fighting styles",
      cost: "$3,000,000 + 5,000 fragments",
      masteryGate: "400 mastery on Dragon Breath",
      extraUnlock: "Fire Essence",
      progressionRole: "Dragon Breath upgrade",
      bestFor: "Godhuman chain"
    },
    Godhuman: {
      section: "Third Sea fighting styles",
      cost: "$5,000,000 + 5,000 fragments + materials",
      masteryGate: "400 mastery on Superhuman, Death Step, Electric Claw, Sharkman Karate, and Dragon Talon",
      extraUnlock: "Godhuman material set",
      progressionRole: "Endgame melee chain",
      bestFor: "Endgame melee builds"
    },
    "Sanguine Art": {
      section: "Third Sea fighting styles",
      cost: "Leviathan Heart + $5,000,000 + 5,000 fragments + materials",
      extraUnlock: "Leviathan Heart",
      progressionRole: "Leviathan route",
      bestFor: "Late-game sustain"
    }
  };

  return (
    details[name] ?? {
      section: "Starter and First Sea fighting styles",
      cost: formatBloxFruitsMoney(null),
      progressionRole: null,
      bestFor: null
    }
  );
}

function getBloxFruitsTeacherFromType(item: GameDatasetCatalogItem): string | null {
  const type = normalizeValue(item.type);
  if (!type || type === "Source N/A") return null;
  return type.replace(/^Source\s+/i, "").trim() || null;
}

function withBloxFruitsMaterialFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  return {
    ...item,
    catalogSection: getBloxFruitsMaterialSection(item),
    displaySea: getBloxFruitsSeaLabel(item.sea),
    sourceRoute: normalizeBloxFruitsRouteText(normalizeValue(item.source)),
    use: getBloxFruitsMaterialUse(item),
    farmRoute: getBloxFruitsMaterialFarmRoute(item),
    craftCost: getBloxFruitsMaterialCraftCost(item)
  };
}

function getBloxFruitsMaterialSection(item: GameDatasetCatalogItem): string {
  const purpose = normalizeValue(item.purpose)?.toLowerCase() ?? "";
  const sea = normalizeValue(item.sea)?.toLowerCase() ?? "";
  if (purpose.includes("currency") || purpose.includes("gacha") || purpose.includes("random surprise") || sea.includes("event")) {
    return "Event currency and gacha materials";
  }
  if (
    purpose.includes("obtaining") ||
    purpose.includes("unlocking") ||
    purpose.includes("spawning") ||
    purpose.includes("race awakening")
  ) {
    return "Unlock and progression materials";
  }
  if (purpose.includes("crafting")) return "Crafting and recipe materials";
  if (purpose.includes("upgrading")) return "Upgrade materials";
  if (purpose.includes("repairing") || purpose === "none") return "Utility and no-use materials";
  return "Utility and no-use materials";
}

function getBloxFruitsMaterialUse(item: GameDatasetCatalogItem): string | null {
  const purpose = normalizeValue(item.purpose);
  if (!purpose) return null;
  return purpose.toLowerCase() === "none" ? "No listed use" : normalizeBloxFruitsRouteText(purpose);
}

function getBloxFruitsMaterialFarmRoute(item: GameDatasetCatalogItem): string | null {
  const source = normalizeValue(item.source)?.toLowerCase() ?? "";
  const purpose = normalizeValue(item.purpose)?.toLowerCase() ?? "";
  const sea = normalizeValue(item.sea)?.toLowerCase() ?? "";
  if (sea.includes("event") || purpose.includes("currency") || purpose.includes("gacha")) return "Event or gacha route";
  if (source.includes("various enemies") || source.includes("bushes") || source.includes("trees")) return "World drop";
  if (source.includes("shop") || source.includes("npc") || source.includes("simulation hub")) return "NPC or shop route";
  if (
    /raid|leviathan|terrorshark|shrine|volcano|dough king|darkbeard|fajita|hunter|dragon wizard|soul reaper|captain|admiral|lord|boss|order/.test(
      source
    )
  ) {
    return "Boss, raid, or sea event";
  }
  if (source) return "Named enemy drop";
  return null;
}

function getBloxFruitsMaterialCraftCost(item: GameDatasetCatalogItem): string | null {
  const name = normalizeValue(item.name);
  if (name === "Volcanic Magnet") return "15 Blaze Ember + 10 Scrap Metal";
  return null;
}

function withBloxFruitsRaceFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  const name = normalizeValue(item.name) ?? "";
  const details = getBloxFruitsRaceDetails(name);

  return {
    ...item,
    catalogSection: details.section,
    unlockRoute: details.unlockRoute,
    rerollStatus: details.rerollStatus,
    bestFor: details.bestFor,
    mainStrength: details.mainStrength,
    mainLimit: details.mainLimit,
    v4Trial: details.v4Trial,
    v4Title: details.v4Title
  };
}

function getBloxFruitsRaceDetails(name: string) {
  const details: Record<
    string,
    {
      section: string;
      unlockRoute: string;
      rerollStatus: string;
      bestFor: string;
      mainStrength: string;
      mainLimit: string;
      v4Trial: string;
      v4Title: string;
    }
  > = {
    Human: {
      section: "Starter and reroll races",
      unlockRoute: "Starter/reroll pool",
      rerollStatus: "Rerollable",
      bestFor: "Aggressive PvP combos",
      mainStrength: "Damage and mobility",
      mainLimit: "No built-in defense",
      v4Trial: "Trial of Strength",
      v4Title: "Berserker"
    },
    Rabbit: {
      section: "Starter and reroll races",
      unlockRoute: "Starter/reroll pool",
      rerollStatus: "Rerollable",
      bestFor: "Travel, chasing, and dodging",
      mainStrength: "Speed and movement",
      mainLimit: "Low damage, defense, and healing",
      v4Trial: "Trial of Speed",
      v4Title: "Thunderbolt"
    },
    Shark: {
      section: "Starter and reroll races",
      unlockRoute: "Starter/reroll pool",
      rerollStatus: "Rerollable",
      bestFor: "Defense and early sea events",
      mainStrength: "Damage reduction and water safety",
      mainLimit: "Lower mobility and damage",
      v4Trial: "Trial of Water",
      v4Title: "Leviathan"
    },
    Angel: {
      section: "Starter and reroll races",
      unlockRoute: "Starter/reroll pool",
      rerollStatus: "Rerollable",
      bestFor: "Healing and combo disruption",
      mainStrength: "Healing, jumps, and V4 control",
      mainLimit: "Counterable before stronger awakenings",
      v4Trial: "Trial of the King",
      v4Title: "His Majesty"
    },
    Ghoul: {
      section: "Quest-only races",
      unlockRoute: "Experimic",
      rerollStatus: "Quest unlock",
      bestFor: "Sustain PvP and cooldown pressure",
      mainStrength: "Night speed, life leech, and cooldown pressure",
      mainLimit: "Less armor support than tank races",
      v4Trial: "Trial of Carnage",
      v4Title: "Nightwalker"
    },
    Cyborg: {
      section: "Quest-only races",
      unlockRoute: "Cyborg Puzzle",
      rerollStatus: "Quest unlock",
      bestFor: "Grinding groups, team fights, and Instinct breaks",
      mainStrength: "AoE damage, defense, and combo disruption",
      mainLimit: "Average V3 range and weaker 1v1 V4 damage",
      v4Trial: "Trial of the Machine",
      v4Title: "Genesis"
    },
    Draco: {
      section: "Quest-only races",
      unlockRoute: "Dragon Wizard quest",
      rerollStatus: "Third Sea quest unlock",
      bestFor: "Late-game V4 area pressure",
      mainStrength: "Third Sea exclusive race with damage or reflect-style V4 paths",
      mainLimit: "Not a normal reroll and needs late progression",
      v4Trial: "Trial of Flames",
      v4Title: "Primordial Guardian"
    }
  };

  return (
    details[name] ?? {
      section: "Quest-only races",
      unlockRoute: "Special route",
      rerollStatus: "Quest unlock",
      bestFor: "Build choice",
      mainStrength: "Race-specific bonuses",
      mainLimit: "Check unlock route first",
      v4Trial: "",
      v4Title: ""
    }
  );
}

function withBloxFruitsBossFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  return {
    ...item,
    catalogSection: getBloxFruitsBossSection(item),
    displaySea: getBloxFruitsSeaLabel(getBloxFruitsFieldValue(item, "sea")) ?? getBloxFruitsBossSection(item).replace(" bosses", ""),
    respawnAccess: getBloxFruitsBossRespawnAccess(item),
    dropsRewards: getBloxFruitsBossDropsRewards(item),
    routeUse: getBloxFruitsBossRouteUse(item)
  };
}

function getBloxFruitsBossSection(item: GameDatasetCatalogItem): string {
  const location = normalizeValue(getBloxFruitsFieldValue(item, "location"))?.toLowerCase() ?? "";
  const sea = normalizeValue(getBloxFruitsFieldValue(item, "sea"))?.toLowerCase() ?? "";
  if (location.includes("dungeon")) return "Dungeon bosses";

  const seaNumbers = getBloxFruitsSeaNumbers(getBloxFruitsFieldValue(item, "sea"));
  if (sea.includes("event") || seaNumbers.length > 1 || !seaNumbers.length) return "Event and multi-sea bosses";
  if (seaNumbers[0] === "1") return "First Sea bosses";
  if (seaNumbers[0] === "2") return "Second Sea bosses";
  if (seaNumbers[0] === "3") return "Third Sea bosses";
  return "Event and multi-sea bosses";
}

function getBloxFruitsBossRespawnAccess(item: GameDatasetCatalogItem): string | null {
  const spawnTime = normalizeValue(getBloxFruitsFieldValue(item, "spawnTime"));
  const despawnTime = normalizeValue(getBloxFruitsFieldValue(item, "despawnTime"));
  const overview = normalizeValue(item.overview)?.toLowerCase() ?? "";
  const parts: string[] = [];
  if (spawnTime) parts.push(`Respawns in ${spawnTime.toLowerCase()}`);
  if (despawnTime) parts.push(`despawns after ${despawnTime.toLowerCase()}`);
  if (overview.includes("only accessible") || overview.includes("requires") || overview.includes("summon")) {
    parts.push("special access");
  }
  return parts.length ? sentenceCase(parts.join("; ")) : null;
}

function getBloxFruitsBossDropsRewards(item: GameDatasetCatalogItem): string | null {
  const name = normalizeValue(item.name) ?? "";
  const rewardByName: Record<string, string> = {
    Core: "Factory Raid reward route",
    Darkbeard: "Dark Fragment route",
    Longma: "Tushita route",
    "Saber Expert": "Saber route",
    "The Saw": "Shark Saw route",
    "Rip indra": "Dark Dagger and portal route"
  };
  return rewardByName[name] ?? null;
}

function getBloxFruitsBossRouteUse(item: GameDatasetCatalogItem): string | null {
  const section = getBloxFruitsBossSection(item);
  const location = normalizeValue(getBloxFruitsFieldValue(item, "location"));
  const weaponType = normalizeValue(getBloxFruitsFieldValue(item, "weaponType"));
  if (section === "Dungeon bosses") return "Dungeon checkpoint";
  if (section === "Event and multi-sea bosses") return "Special boss route";
  if (location) return `${location} boss`;
  return weaponType ? `${weaponType} boss` : null;
}

function withBloxFruitsEnemyFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  return {
    ...item,
    catalogSection: getBloxFruitsEnemySection(item),
    seaStage: getBloxFruitsEnemySeaStage(item),
    islandRegion: getBloxFruitsEnemyRegion(item),
    questSource: getBloxFruitsEnemyQuestSource(item),
    dropsRewards: getBloxFruitsEnemyDropsRewards(item),
    accessRespawn: getBloxFruitsEnemyAccess(item),
    grindNote: cleanBloxFruitsNote(item.notes ?? getBloxFruitsFieldValue(item, "notes"))
  };
}

function getBloxFruitsEnemySection(item: GameDatasetCatalogItem): string {
  const sea = normalizeValue(item.sea)?.toLowerCase() ?? "";
  if (sea === "first sea") return "First Sea enemies";
  if (sea === "second sea") return "Second Sea enemies";
  if (sea === "third sea") return "Third Sea enemies";
  return "Raid, sea event, and special enemies";
}

function getBloxFruitsEnemySeaStage(item: GameDatasetCatalogItem): string | null {
  const section = getBloxFruitsEnemySection(item);
  if (section === "Raid, sea event, and special enemies") return "Special route";
  return section.replace(" enemies", "");
}

function getBloxFruitsEnemyRegion(item: GameDatasetCatalogItem): string | null {
  const name = normalizeValue(item.name) ?? "";
  const regionByName: Record<string, string> = {
    Bandits: "Pirate Starter",
    "Bandits/Trainees": "Starter islands",
    Monkeys: "Jungle",
    Gorillas: "Jungle",
    Pirates: "Pirate Village",
    Brutes: "Pirate Village",
    "Desert Bandits": "Desert",
    "Desert Officers": "Desert",
    "Snow Bandits": "Frozen Village",
    Snowmen: "Frozen Village",
    "Chief Petty Officers": "Marine Fortress",
    "Sky Bandits": "Skylands",
    "Dark Masters": "Skylands",
    Prisoner: "Prison",
    "Dangerous Prisoner": "Prison",
    "Toga Warrior": "Colosseum",
    Gladiator: "Colosseum",
    "Fishman Warrior": "Underwater City",
    "Fishman Commando": "Underwater City",
    Raider: "Kingdom of Rose",
    Mercenary: "Kingdom of Rose",
    Zombie: "Graveyard Island",
    Vampire: "Graveyard Island",
    "Sea Soldier": "Forgotten Island",
    "Water Fighter": "Forgotten Island",
    "Pirate Millionaire": "Port Town",
    "Pistol Billionaire": "Port Town",
    "Dragon Crew Warrior": "Hydra Island",
    "Dragon Crew Archer": "Hydra Island",
    "Forest Pirate": "Floating Turtle",
    "Musketeer Pirate": "Floating Turtle",
    "Peanut Scout": "Sea of Treats",
    "Candy Rebel": "Sea of Treats",
    "Reef Bandit": "Submerged Island",
    "Grand Devotee": "Submerged Island",
    Shark: "Sea event",
    Piranha: "Sea event",
    "Ghost Shark": "Haunted Shipwreck",
    "Haunted Crew Member": "Haunted Shipwreck"
  };
  return regionByName[name] ?? null;
}

function getBloxFruitsEnemyQuestSource(item: GameDatasetCatalogItem): string | null {
  const section = getBloxFruitsEnemySection(item);
  if (section === "Raid, sea event, and special enemies") return "Special encounter";
  return "Leveling route";
}

function getBloxFruitsEnemyDropsRewards(item: GameDatasetCatalogItem): string | null {
  const name = normalizeValue(item.name) ?? "";
  const rewards: Record<string, string> = {
    Shark: "Shark Tooth",
    Piranha: "Electric Wing",
    "Ghost Shark": "Shark Tooth, Ectoplasm, Bones",
    "Haunted Crew Member": "Fool's Gold",
    "Ghost Ship Raid": "Fool's Gold, Valor, fragments, fruit chance",
    "Ship Raid": "Fragments, Fool's Gold, fruit chance"
  };
  return rewards[name] ?? null;
}

function getBloxFruitsEnemyAccess(item: GameDatasetCatalogItem): string | null {
  const section = getBloxFruitsEnemySection(item);
  if (section !== "Raid, sea event, and special enemies") return null;
  const name = normalizeValue(item.name) ?? "";
  if (/ghost|haunted/i.test(name)) return "Haunted Shipwreck route";
  if (/shark|piranha|ship raid/i.test(name)) return "Sea-event route";
  if (/raid|dummy|elite/i.test(name)) return "Special activity";
  return "Special route";
}

function withBloxFruitsLocationFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  const details = getBloxFruitsLocationDetails(item);

  return {
    ...item,
    catalogSection: details.section,
    displaySea: details.displaySea,
    levelRange: details.levelRange,
    locationType: details.locationType,
    routeRole: details.routeRole,
    mainNpcs: details.mainNpcs,
    accessTravel: details.accessTravel,
    purpose: details.purpose
  };
}

function getBloxFruitsLocationDetails(item: GameDatasetCatalogItem) {
  const name = normalizeValue(item.name) ?? "";
  const type = normalizeValue(getBloxFruitsFieldValue(item, "type"));
  const location = normalizeValue(getBloxFruitsFieldValue(item, "location"));
  const overview = normalizeValue(item.overview);
  const seaLabel = getBloxFruitsSeaLabel(getBloxFruitsFieldValue(item, "sea"));
  const lowerName = name.toLowerCase();
  const lowerType = type?.toLowerCase() ?? "";
  const lowerLocation = location?.toLowerCase() ?? "";
  const lowerOverview = overview?.toLowerCase() ?? "";
  const seaNumbers = getBloxFruitsSeaNumbers(getBloxFruitsFieldValue(item, "sea"));

  const special = getBloxFruitsLocationSpecialDetails(name);
  if (special) {
    return {
      ...special,
      displaySea: special.displaySea ?? seaLabel ?? "Special",
      levelRange: special.levelRange ?? getBloxFruitsLocationLevelRange(item),
      locationType: special.locationType ?? cleanBloxFruitsLocationType(type, name),
      accessTravel: special.accessTravel ?? location ?? null
    };
  }

  if (lowerType.includes("sea event") || lowerLocation.includes("sea danger")) {
    return {
      section: "Sea-event locations",
      displaySea: seaLabel ?? "Third Sea",
      levelRange: getBloxFruitsLocationLevelRange(item),
      locationType: "Sea event",
      routeRole: "Sea-event spawn",
      mainNpcs: getBloxFruitsLocationNpcHint(name, overview),
      accessTravel: location ?? "Sea Danger route",
      purpose: getBloxFruitsLocationPurpose(name, overview)
    };
  }

  const section =
    seaNumbers.length === 1 && seaNumbers[0] === "1"
      ? "First Sea locations"
      : seaNumbers.length === 1 && seaNumbers[0] === "2"
        ? "Second Sea locations"
        : seaNumbers.length === 1 && seaNumbers[0] === "3"
          ? "Third Sea locations"
          : "Hidden and special locations";

  return {
    section,
    displaySea: seaLabel ?? (section === "Hidden and special locations" ? "Special" : section.replace(" locations", "")),
    levelRange: getBloxFruitsLocationLevelRange(item),
    locationType: cleanBloxFruitsLocationType(type, name),
    routeRole: getBloxFruitsLocationRole(name, lowerName, lowerType, lowerOverview),
    mainNpcs: getBloxFruitsLocationNpcHint(name, overview),
    accessTravel: location,
    purpose: getBloxFruitsLocationPurpose(name, overview)
  };
}

function getBloxFruitsLocationSpecialDetails(name: string) {
  const details: Record<
    string,
    {
      section: string;
      displaySea?: string | null;
      levelRange?: string | null;
      locationType?: string | null;
      routeRole?: string | null;
      mainNpcs?: string | null;
      accessTravel?: string | null;
      purpose?: string | null;
    }
  > = {
    "North Pole": {
      section: "Hidden and special locations",
      displaySea: "All Seas",
      locationType: "Event island",
      routeRole: "Christmas event",
      accessTravel: "Near Frozen Village during the event",
      purpose: "Seasonal event area"
    },
    "Celestial Domain": {
      section: "Hidden and special locations",
      locationType: "Event area",
      routeRole: "Limited event route"
    },
    "Oni Realm": {
      section: "Hidden and special locations",
      locationType: "Event area",
      routeRole: "Limited event route"
    },
    "Party Realm": {
      section: "Hidden and special locations",
      locationType: "Event area",
      routeRole: "Limited event route"
    },
    "Grand Colosseum": {
      section: "Hidden and special locations",
      locationType: "Event arena",
      routeRole: "Special event fight"
    },
    "Dimensional Rift": {
      section: "Hidden and special locations",
      locationType: "Dimension",
      routeRole: "Special access"
    },
    "Pocket Dimension": {
      section: "Hidden and special locations",
      locationType: "Dimension",
      routeRole: "Special access"
    },
    "Pakistan Dimension": {
      section: "Hidden and special locations",
      locationType: "Dimension",
      routeRole: "Special access"
    },
    "Rip Family x Red Legion Arena": {
      section: "Hidden and special locations",
      locationType: "Arena",
      routeRole: "Admin or special event reference"
    }
  };
  return details[name] ?? null;
}

function getBloxFruitsLocationLevelRange(item: GameDatasetCatalogItem): string | null {
  return normalizeBloxFruitsRouteText(
    normalizeValue(getBloxFruitsFieldValue(item, "level")) ?? normalizeValue(getBloxFruitsFieldValue(item, "levelRequirement"))
  );
}

function cleanBloxFruitsLocationType(type: string | null, name: string): string | null {
  if (type) return normalizeBloxFruitsRouteText(type);
  if (/dimension/i.test(name)) return "Dimension";
  if (/room|cave|laboratory|vault|temple|mansion|domain/i.test(name)) return "Subarea";
  return null;
}

function getBloxFruitsLocationRole(name: string, lowerName: string, lowerType: string, lowerOverview: string): string | null {
  if (lowerType.includes("safe")) return "Safe zone";
  if (/starter|jungle|desert|village|fortress|prison|city|skylands|kingdom|zone|castle|outpost|island|town/.test(lowerName)) {
    return "Leveling or hub route";
  }
  if (/raid|factory|laboratory/.test(lowerName) || lowerOverview.includes("raid")) return "Raid or activity access";
  if (/race awakening|temple of time|ancient clock/.test(lowerOverview) || lowerName.includes("temple of time")) {
    return "Race Awakening route";
  }
  if (/boss|domain|crypt/.test(lowerName) || lowerOverview.includes("boss")) return "Boss or unlock route";
  if (/hidden|secret|cave|room|vault/.test(lowerName)) return "Hidden area";
  return null;
}

function getBloxFruitsLocationNpcHint(name: string, overview: string | null): string | null {
  const text = `${name} ${overview ?? ""}`.toLowerCase();
  const labels: string[] = [];
  addBloxFruitsBestForLabel(labels, text.includes("ability teacher"), "Ability Teacher");
  addBloxFruitsBestForLabel(labels, text.includes("advanced fruit dealer"), "Advanced Fruit Dealer");
  addBloxFruitsBestForLabel(labels, text.includes("beautiful pirate"), "Beautiful Pirate");
  addBloxFruitsBestForLabel(labels, text.includes("crypt master"), "Crypt Master");
  addBloxFruitsBestForLabel(labels, text.includes("sharkman master"), "Sharkman Master");
  addBloxFruitsBestForLabel(labels, text.includes("blox fruit dealer"), "Blox Fruit Dealer");
  addBloxFruitsBestForLabel(labels, text.includes("experienced captain"), "Experienced Captain");
  addBloxFruitsBestForLabel(labels, text.includes("ice admiral"), "Ice Admiral");
  return labels.length ? labels.join(", ") : null;
}

function getBloxFruitsLocationPurpose(name: string, overview: string | null): string | null {
  const text = `${name} ${overview ?? ""}`.toLowerCase();
  if (text.includes("second sea")) return "Second Sea access";
  if (text.includes("race awakening") || text.includes("blue gear")) return "Race Awakening";
  if (text.includes("advanced fruit dealer")) return "Advanced Fruit Dealer route";
  if (text.includes("volcanic magnet")) return "Prehistoric Island hunt";
  if (text.includes("sharkman master")) return "Sharkman Karate route";
  if (text.includes("beautiful pirate")) return "Beautiful Pirate access";
  if (text.includes("raid")) return "Raid or activity route";
  if (text.includes("chest")) return "Chest or reward stop";
  return null;
}

function withBloxFruitsQuestFields(items: GameDatasetCatalogItem[]): GameDatasetCatalogItem[] {
  let currentIsland: string | null = null;
  let currentQuestGiver: string | null = null;

  return items.map((item) => {
    const parts = (normalizeValue(item.name) ?? "").split(" - ");
    const sea = normalizeValue(item.sea) ?? parts[0] ?? null;
    const rawIsland = normalizeValue(item.island);
    const rawQuestGiver = normalizeValue(item.questGiver);
    const rawQuest = normalizeValue(item.quest);
    const rawLevel = normalizeValue(item.level);
    const rawExp = normalizeValue(item.exp ?? getBloxFruitsFieldValue(item, "expexp"));
    const rawMoney = normalizeValue(item.money);
    const rawSpecial = normalizeValue(item.special);
    const shiftedByQuestGiver = Boolean(rawQuestGiver && /^\d[\d,]*$/.test(rawQuestGiver) && rawQuest?.includes("EXP"));
    const shiftedByQuest = Boolean(rawQuest && /^\d[\d,]*$/.test(rawQuest) && rawLevel?.includes("EXP"));

    const islandArea = shiftedByQuestGiver || shiftedByQuest ? currentIsland : rawIsland;
    const questGiverName = shiftedByQuestGiver || shiftedByQuest ? currentQuestGiver : rawQuestGiver;
    const objective = shiftedByQuestGiver || shiftedByQuest ? parts[1] ?? rawIsland : rawQuest;
    const levelRequirement = shiftedByQuestGiver ? rawQuestGiver : shiftedByQuest ? rawQuest : rawLevel;
    const expReward = normalizeBloxFruitsExp(shiftedByQuestGiver ? rawQuest : shiftedByQuest ? rawLevel : rawExp);
    const moneyReward = formatBloxFruitsRewardMoney(
      shiftedByQuestGiver ? rawLevel : shiftedByQuest ? null : rawMoney
    );
    const routeNote = cleanBloxFruitsNote(rawSpecial) ?? (shiftedByQuest ? cleanBloxFruitsNote(rawMoney) : null);

    if (!shiftedByQuestGiver && !shiftedByQuest) {
      currentIsland = rawIsland ?? currentIsland;
      currentQuestGiver = rawQuestGiver ?? currentQuestGiver;
    }

    return {
      ...item,
      name: shiftedByQuestGiver || shiftedByQuest ? [sea, islandArea, objective].filter(Boolean).join(" - ") : item.name,
      catalogSection: sea,
      displaySea: sea,
      levelRequirement,
      islandArea,
      questGiverName,
      objective,
      targetType: routeNote?.toLowerCase().includes("boss") ? "Boss quest" : "Enemy quest",
      expReward,
      moneyReward,
      routeNote
    };
  });
}

function withBloxFruitsSeaEventFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  const name = normalizeValue(item.name) ?? "";
  const details = getBloxFruitsSeaEventDetails(name);

  return {
    ...item,
    catalogSection: details.section,
    dangerLevel: details.dangerLevel ?? normalizeValue(getBloxFruitsFieldValue(item, "location")),
    displayArea: details.displayArea ?? getBloxFruitsSeaLabel(getBloxFruitsFieldValue(item, "sea")),
    spawnAccess: details.spawnAccess,
    mainReward: details.mainReward,
    requiredSetup: details.requiredSetup,
    crewNote: details.crewNote,
    farmRoute: details.farmRoute
  };
}

function getBloxFruitsSeaEventDetails(name: string) {
  const basic = {
    section: "Basic travel events",
    farmRoute: "Basic sail encounter"
  };
  const details: Record<
    string,
    {
      section: string;
      dangerLevel?: string | null;
      displayArea?: string | null;
      spawnAccess?: string | null;
      mainReward?: string | null;
      requiredSetup?: string | null;
      crewNote?: string | null;
      farmRoute?: string | null;
    }
  > = {
    "Ship Raid": {
      ...basic,
      dangerLevel: "Open sea",
      displayArea: "Second Sea / Third Sea",
      spawnAccess: "Sail by boat",
      mainReward: "Fragments, Fool's Gold, fruit chance"
    },
    "Sea Beast": {
      ...basic,
      dangerLevel: "Sea Danger Level 1-6",
      displayArea: "Second Sea / Third Sea",
      spawnAccess: "Sail by boat",
      mainReward: "Money, fragments, sea-event drops",
      crewNote: "Team helps on higher danger levels"
    },
    "Shark (Enemy)": {
      ...basic,
      mainReward: "Shark Tooth",
      spawnAccess: "Sea-event enemy"
    },
    Piranha: {
      ...basic,
      mainReward: "Electric Wing",
      spawnAccess: "Sea-event enemy"
    },
    "Rough Sea": {
      ...basic,
      dangerLevel: "Sea Danger Level 1-6",
      spawnAccess: "Random rough-water event",
      mainReward: "Sea-event enemy farming"
    },
    "Treasure Island": {
      ...basic,
      displayArea: "Second Sea / Third Sea",
      spawnAccess: "Sea danger island",
      mainReward: "Chests and rewards"
    },
    Terrorshark: {
      section: "Third Sea combat hunts",
      dangerLevel: "Sea Danger Level 2-6",
      displayArea: "Third Sea",
      spawnAccess: "Danger-level fight",
      mainReward: "Terrorshark materials",
      requiredSetup: "Strong boat recommended",
      crewNote: "Team recommended",
      farmRoute: "Danger-level fight"
    },
    "Rumbling Waters": {
      section: "Third Sea combat hunts",
      dangerLevel: "Sea Danger Level 1-6",
      displayArea: "Third Sea",
      spawnAccess: "Three Sea Beasts",
      mainReward: "Sea Beast rewards",
      requiredSetup: "Boat and damage",
      crewNote: "Team recommended",
      farmRoute: "Multi-boss fight"
    },
    "Haunted Ship Raid": {
      section: "Third Sea combat hunts",
      displayArea: "Haunted Shipwreck",
      spawnAccess: "Haunted Shipwreck route",
      mainReward: "Fool's Gold, Valor, fragments, fruit chance",
      crewNote: "Team helps",
      farmRoute: "Shipwreck fight"
    },
    "Mirage Island": {
      section: "Rare island spawns",
      dangerLevel: "Sea Danger Level 2-6",
      displayArea: "Third Sea",
      spawnAccess: "Rare sea island",
      mainReward: "Advanced Fruit Dealer and Blue Gear",
      farmRoute: "Rare island search"
    },
    "Kitsune Island": {
      section: "Rare island spawns",
      dangerLevel: "Sea Danger Level 6",
      displayArea: "Third Sea",
      spawnAccess: "Full Moon route",
      mainReward: "Kitsune Shrine access",
      requiredSetup: "Full Moon timing",
      crewNote: "Boat owner must stay in boat",
      farmRoute: "Rare island search"
    },
    "Haunted Shipwreck": {
      section: "Rare island spawns",
      dangerLevel: "Sea Danger Level 6",
      displayArea: "Third Sea",
      spawnAccess: "Rare shipwreck spawn",
      mainReward: "Chests and ghost encounters",
      farmRoute: "Rare island search"
    },
    "Frozen Dimension": {
      section: "Rare island spawns",
      dangerLevel: "Sea Danger Level 6",
      displayArea: "Third Sea",
      spawnAccess: "Frozen Watcher route",
      mainReward: "Leviathan access",
      requiredSetup: "Spy bribe helps",
      crewNote: "5+ group needed for Leviathan",
      farmRoute: "Leviathan route"
    },
    "Prehistoric Island": {
      section: "Rare island spawns",
      dangerLevel: "Sea Danger Level 6",
      displayArea: "Third Sea",
      spawnAccess: "Rare island spawn",
      mainReward: "Prehistoric rewards",
      requiredSetup: "Volcanic Magnet recommended",
      crewNote: "Group search helps",
      farmRoute: "Prehistoric hunt"
    },
    "Ghost Ship Raid": {
      section: "Island follow-up encounters",
      displayArea: "Haunted Shipwreck",
      spawnAccess: "Inside Haunted Shipwreck",
      mainReward: "Fool's Gold, Valor, fragments, fruit chance",
      farmRoute: "Nested shipwreck fight"
    },
    "Ghost Shark": {
      section: "Island follow-up encounters",
      displayArea: "Haunted Shipwreck",
      spawnAccess: "Inside Haunted Shipwreck",
      mainReward: "Shark Tooth, Ectoplasm, Bones",
      farmRoute: "Nested shipwreck enemy"
    },
    "Haunted Crew Member": {
      section: "Island follow-up encounters",
      displayArea: "Haunted Shipwreck",
      spawnAccess: "Inside Haunted Shipwreck",
      mainReward: "Fool's Gold",
      farmRoute: "Nested shipwreck enemy"
    },
    "Kitsune Shrine": {
      section: "Island follow-up encounters",
      displayArea: "Kitsune Island",
      spawnAccess: "Kitsune Island shrine",
      mainReward: "Azure Ember rewards",
      requiredSetup: "Kitsune Island active",
      farmRoute: "Shrine exchange"
    },
    Leviathan: {
      section: "Island follow-up encounters",
      displayArea: "Frozen Dimension",
      spawnAccess: "Frozen Watcher summon",
      mainReward: "Leviathan Heart and scales",
      requiredSetup: "Beast Hunter for Heart",
      crewNote: "5+ group for spawn route",
      farmRoute: "Leviathan route"
    }
  };

  return details[name] ?? basic;
}

function withBloxFruitsAbilityFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  const name = normalizeValue(item.name) ?? "";
  const details = getBloxFruitsAbilityDetails(name);

  return {
    ...item,
    catalogSection: details.section,
    unlockRoute: details.unlockRoute,
    displayCost: details.cost ?? formatBloxFruitsMoney(getBloxFruitsFieldValue(item, "costToBuy")),
    teacherSource: details.teacherSource ?? normalizeValue(getBloxFruitsFieldValue(item, "source")),
    levelMasteryRequirement: details.levelMasteryRequirement,
    combatTravelRole: details.combatTravelRole,
    upgradePath: details.upgradePath,
    keyUse: details.keyUse,
    limitation: details.limitation
  };
}

function getBloxFruitsAbilityDetails(name: string) {
  const raceCost = "$2,000,000";
  const aroweRaceSkill = (race: string, use: string) => ({
    section: "Race abilities and awakenings",
    unlockRoute: "Race V3 route",
    cost: raceCost,
    teacherSource: "Arowe",
    levelMasteryRequirement: `${race} race`,
    combatTravelRole: "Race V3 skill",
    upgradePath: "Race V3",
    keyUse: use,
    limitation: "Race-locked"
  });
  const details: Record<
    string,
    {
      section: string;
      unlockRoute?: string | null;
      cost?: string | null;
      teacherSource?: string | null;
      levelMasteryRequirement?: string | null;
      combatTravelRole?: string | null;
      upgradePath?: string | null;
      keyUse?: string | null;
      limitation?: string | null;
    }
  > = {
    "Air Jump": {
      section: "Core movement unlocks",
      unlockRoute: "Ability Teacher",
      cost: "$10,000",
      teacherSource: "Ability Teacher",
      combatTravelRole: "Movement",
      keyUse: "Multiple air jumps",
      limitation: "Uses energy"
    },
    Dashing: {
      section: "Core movement unlocks",
      unlockRoute: "Starter movement",
      combatTravelRole: "Movement",
      keyUse: "Short ground or air dash",
      limitation: "Movement tool, not a damage skill"
    },
    "Flash Step": {
      section: "Core movement unlocks",
      unlockRoute: "Ability Teacher",
      cost: "$100,000",
      teacherSource: "Ability Teacher",
      combatTravelRole: "Escape/chase",
      keyUse: "Short teleport",
      limitation: "Energy, range, and cooldown limits"
    },
    Aura: {
      section: "Combat awareness and Aura systems",
      unlockRoute: "Ability Teacher",
      teacherSource: "Ability Teacher",
      combatTravelRole: "Aura combat",
      upgradePath: "Aura stages",
      keyUse: "Bypass Elemental Reflex and improve non-fruit combat",
      limitation: "Progresses through use"
    },
    Instinct: {
      section: "Combat awareness and Aura systems",
      unlockRoute: "Instinct Teacher",
      cost: "$750,000",
      teacherSource: "Instinct Teacher",
      levelMasteryRequirement: "Level 300 and Saber Puzzle",
      combatTravelRole: "Instinct awareness",
      upgradePath: "Instinct levels",
      keyUse: "Dodge and see entities",
      limitation: "Dodges recharge over time"
    },
    "Instinct/V2": {
      section: "Combat awareness and Aura systems",
      unlockRoute: "Third Sea upgrade",
      cost: "$5,000,000",
      teacherSource: "Hungry Man route",
      levelMasteryRequirement: "Level 1800+ and 5000 Instinct EXP",
      combatTravelRole: "Advanced Instinct",
      upgradePath: "Instinct upgrade",
      keyUse: "Improved awareness and dodge recovery",
      limitation: "Heavy quest requirements"
    },
    "Instinct/Break": {
      section: "Combat awareness and Aura systems",
      unlockRoute: "Combat mechanic",
      combatTravelRole: "Instinct counter",
      keyUse: "Forces an opponent out of Instinct",
      limitation: "Not a purchased ability"
    },
    "Last Resort": aroweRaceSkill("Human", "Damage burst at low health"),
    Agility: aroweRaceSkill("Rabbit", "Speed burst"),
    "Water Body": aroweRaceSkill("Shark", "Damage reduction"),
    "Heavenly Blood": aroweRaceSkill("Angel", "Healing and regeneration"),
    "Heightened Senses": aroweRaceSkill("Ghoul", "Cooldown and awareness pressure"),
    "Energy Core": aroweRaceSkill("Cyborg", "Area burst and damage reduction"),
    "Primordial Reign": {
      section: "Race abilities and awakenings",
      unlockRoute: "Dragon Wizard",
      cost: "$3,000,000",
      teacherSource: "Dragon Wizard",
      levelMasteryRequirement: "Draco route",
      combatTravelRole: "Race skill",
      upgradePath: "Draco progression",
      keyUse: "Draco race power",
      limitation: "Late progression route"
    },
    "Race Awakening": {
      section: "Race abilities and awakenings",
      unlockRoute: "Race V4 system",
      teacherSource: "Temple of Time route",
      combatTravelRole: "Race V4 system",
      upgradePath: "Race Awakening",
      keyUse: "Unlock race trials and gears",
      limitation: "Third Sea progression"
    },
    "Dragon Tether": {
      section: "Special tools and progression utility",
      unlockRoute: "Dragon Wizard",
      teacherSource: "Dragon Wizard",
      levelMasteryRequirement: "Dojo Belt (Black)",
      combatTravelRole: "Dragon progression",
      upgradePath: "Dragon Egg and Draco routes",
      keyUse: "Collect Dragon Eggs",
      limitation: "Specific progression tool"
    },
    Skins: {
      section: "Special tools and progression utility",
      unlockRoute: "Cosmetic system",
      combatTravelRole: "Cosmetic",
      keyUse: "Change ability visuals",
      limitation: "Visual only"
    },
    "Summon Sea Beast": {
      section: "Special tools and progression utility",
      unlockRoute: "Bounty/Honor milestone",
      levelMasteryRequirement: "10,000,000 Bounty or Honor",
      combatTravelRole: "Sea utility",
      keyUse: "Summon Sea Beasts near the sea",
      limitation: "Second/Third Sea use and combat caveats"
    },
    "Brazil World": {
      section: "Admin or special-space abilities",
      unlockRoute: "Admin-only",
      combatTravelRole: "Admin-only",
      keyUse: "Special ability reference",
      limitation: "Not normal player progression"
    },
    "Pakistan Dimension": {
      section: "Admin or special-space abilities",
      unlockRoute: "Special-space reference",
      combatTravelRole: "Special space",
      keyUse: "Enclosed-space reference",
      limitation: "Not a normal ability purchase"
    }
  };

  return (
    details[name] ?? {
      section: "Special tools and progression utility",
      unlockRoute: null,
      combatTravelRole: "Utility",
      keyUse: null,
      limitation: null
    }
  );
}

function withBloxFruitsAuraStageFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  const stage = normalizeValue(item.stage ?? getBloxFruitsFieldValue(item, "stage")) ?? normalizeValue(item.name);
  return {
    ...item,
    name: `Stage ${stage}`,
    catalogSection: "Aura stage progression",
    displayStage: stage,
    coverage: normalizeValue(item.visualAura ?? getBloxFruitsFieldValue(item, "visualAuraArmFsLegFs")),
    auraExpNeeded: normalizeBloxFruitsExp(item.expNeeded ?? getBloxFruitsFieldValue(item, "expNeeded")),
    bonusEffect: cleanBloxFruitsNote(item.buffs ?? getBloxFruitsFieldValue(item, "buffs")),
    progressionNote: getBloxFruitsAuraStageNote(stage)
  };
}

function getBloxFruitsAuraStageNote(stage: string | null): string | null {
  if (stage === "0") return "First Aura coverage";
  if (stage === "5") return "Full-body Aura";
  return stage ? "More coverage and stronger Aura progression" : null;
}

function withBloxFruitsAuraVisualFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  const stage = normalizeValue(item.stage ?? getBloxFruitsFieldValue(item, "stage")) ?? normalizeValue(item.name);
  return {
    ...item,
    name: `Stage ${stage}`,
    catalogSection: "Aura appearance stages",
    visualStage: stage,
    bodyCoverage: getBloxFruitsAuraVisualCoverage(stage),
    armsVisual: normalizeValue(item.arms ?? getBloxFruitsFieldValue(item, "arms")) ?? getBloxFruitsAuraVisualCoverage(stage),
    legsVisual: normalizeValue(item.legs ?? getBloxFruitsFieldValue(item, "legs")) ?? getBloxFruitsAuraVisualCoverage(stage),
    statEffect: "Visual only",
    equipUseNote: "Reflects Aura stage coverage"
  };
}

function getBloxFruitsAuraVisualCoverage(stage: string | null): string | null {
  const coverage: Record<string, string> = {
    "0": "Lower arms and legs",
    "1": "Full arms and legs",
    "2": "Arms, legs, and half torso",
    "3": "Arms, legs, torso, and head",
    "4": "Full body coverage",
    "5": "Full body coverage"
  };
  return stage ? coverage[stage] ?? null : null;
}

function withBloxFruitsBoatFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  return {
    ...item,
    catalogSection: getBloxFruitsBoatSection(item),
    sourceAccess: getBloxFruitsBoatSourceAccess(item),
    displayPrice: normalizeValue(item.price ?? getBloxFruitsFieldValue(item, "price")),
    displayHealth: normalizeValue(item.health ?? getBloxFruitsFieldValue(item, "health")),
    displaySeats: normalizeValue(item.seats ?? getBloxFruitsFieldValue(item, "seats")),
    displayCannons: normalizeValue(item.cannons ?? getBloxFruitsFieldValue(item, "cannons")),
    displaySpeed: normalizeValue(item.speed ?? getBloxFruitsFieldValue(item, "estimatedSpeedInThirdSeaMetersPerMinute")),
    seaEventRole: getBloxFruitsBoatSeaEventRole(item),
    specialUse: getBloxFruitsBoatSpecialUse(item)
  };
}

function getBloxFruitsBoatSection(item: GameDatasetCatalogItem): string {
  const name = normalizeValue(item.name) ?? "";
  const category = normalizeValue(item.category)?.toLowerCase() ?? "";
  if (name === "Beast Hunter") return "Leviathan hunt boat";
  if (["Miracle", "The Sentinel"].includes(name)) return "Fast Boats gamepass boats";
  if (category.includes("luxury")) return "Unlock and event luxury boats";
  return "Starter and normal dealer boats";
}

function getBloxFruitsBoatSourceAccess(item: GameDatasetCatalogItem): string | null {
  const section = getBloxFruitsBoatSection(item);
  if (section === "Fast Boats gamepass boats") return "Fast Boats gamepass";
  if (section === "Leviathan hunt boat") return "Beast Hunter craft route";
  if (section === "Unlock and event luxury boats") return "Luxury Boat Dealer or event route";
  return "Boat Dealer";
}

function getBloxFruitsBoatSeaEventRole(item: GameDatasetCatalogItem): string | null {
  const name = normalizeValue(item.name) ?? "";
  if (name === "Beast Hunter") return "Leviathan Heart route";
  const cannons = Number(normalizeValue(item.cannons)?.match(/\d+/)?.[0] ?? 0);
  const health = Number(normalizeValue(item.health)?.match(/\d+/)?.[0] ?? 0);
  if (cannons >= 4 && health >= 2000) return "Sea-event capable";
  if (cannons > 0) return "Basic sea combat";
  return "Travel";
}

function getBloxFruitsBoatSpecialUse(item: GameDatasetCatalogItem): string | null {
  const name = normalizeValue(item.name) ?? "";
  if (name === "Beast Hunter") return "Carries Leviathan Heart";
  if (["Lantern", "Sleigh"].includes(name)) return "Event-style luxury boat";
  return null;
}

function withBloxFruitsGunFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  return {
    ...item,
    catalogSection: getBloxFruitsGunSection(item),
    displaySea: getBloxFruitsSeaLabel(item.sea),
    sourceRoute: getBloxFruitsGunSourceRoute(item),
    costOrDrop: getBloxFruitsGunCostOrDrop(item),
    requirementMastery: getBloxFruitsGunRequirementMastery(item),
    combatRole: getBloxFruitsGunCombatRole(item),
    upgradeUse: getBloxFruitsGunUpgradeUse(item),
    availability: "Obtainable"
  };
}

function getBloxFruitsGunSection(item: GameDatasetCatalogItem): string {
  const seaNumbers = getBloxFruitsSeaNumbers(item.sea);
  const route = normalizeValue(item.obtainment)?.toLowerCase() ?? "";
  if (seaNumbers[0] === "1" && /dealer/.test(route)) return "First Sea shop guns";
  if (seaNumbers[0] === "1") return "First Sea boss drops";
  if (seaNumbers[0] === "2") return "Second Sea raid and currency guns";
  return "Third Sea boss and special guns";
}

function getBloxFruitsGunSourceRoute(item: GameDatasetCatalogItem): string | null {
  const route = normalizeValue(item.obtainment);
  if (!route) return null;
  if (/weapon dealer/i.test(route)) return route.includes("Advanced") ? "Advanced Weapon Dealer" : "Weapon Dealer";
  if (/factory/i.test(route)) return "Factory Raid";
  if (/el rodolfo/i.test(route)) return "Ectoplasm purchase";
  if (/strongest god/i.test(route)) return "Fragment purchase";
  if (/dragon hunter/i.test(route)) return "Dragon Hunter craft";
  if (/weird machine/i.test(route)) return "Weird Machine";
  return normalizeBloxFruitsRouteText(route.replace(/^defeat\s+/i, "")) ?? route;
}

function getBloxFruitsGunCostOrDrop(item: GameDatasetCatalogItem): string | null {
  const route = normalizeValue(item.obtainment) ?? "";
  const money = formatBloxFruitsMoney(item.money);
  if (money) return money;
  if (/25\s+from\s+el rodolfo/i.test(route)) return "25 Ectoplasm";
  if (/1,?500\s+from\s+the strongest god/i.test(route)) return "1,500 Fragments";
  if (/dragon hunter/i.test(route)) return "Crafting materials";
  if (/weird machine/i.test(route)) return "Dark Fragment, Ectoplasm, Bones, and Fragments";
  if (/defeat/i.test(route)) return "Boss or raid drop";
  return null;
}

function getBloxFruitsGunRequirementMastery(item: GameDatasetCatalogItem): string | null {
  const name = normalizeValue(item.name) ?? "";
  const gates: Record<string, string> = {
    Bazooka: "100 / 250 mastery moves",
    "Bizarre Revolver": "150 / 300 mastery moves",
    "Venom Bow": "125 / 250 mastery moves",
    Dragonstorm: "125 / 250 mastery moves",
    "Skull Guitar": "150 / 300 mastery moves"
  };
  return gates[name] ?? null;
}

function getBloxFruitsGunCombatRole(item: GameDatasetCatalogItem): string | null {
  const name = normalizeValue(item.name) ?? "";
  if (["Slingshot", "Flintlock", "Musket", "Refined Slingshot", "Dual Flintlock"].includes(name)) {
    return "Early ranged weapon";
  }
  if (["Cannon", "Bazooka"].includes(name)) return "Explosive gun";
  if (["Kabucha", "Skull Guitar"].includes(name)) return "PvP support";
  if (name === "Dragonstorm") return "Crafted endgame gun";
  if (name === "Venom Bow") return "Poison bow";
  return "Ranged support";
}

function getBloxFruitsGunUpgradeUse(item: GameDatasetCatalogItem): string | null {
  return normalizeValue(item.upgrading) ? "Blacksmith upgrade available" : null;
}

function withBloxFruitsInstinctLevelFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  const level = normalizeValue(item.level ?? getBloxFruitsFieldValue(item, "level")) ?? normalizeValue(item.name);
  return {
    ...item,
    name: `Level ${level}`,
    catalogSection: getBloxFruitsInstinctLevelSection(level),
    displayLevel: level,
    expRange: normalizeBloxFruitsInstinctExp(item.exp ?? getBloxFruitsFieldValue(item, "exp")),
    baseDodges: normalizeValue(item.dodges ?? getBloxFruitsFieldValue(item, "dodges")),
    progressNote: getBloxFruitsInstinctProgressNote(level, item.buffs ?? getBloxFruitsFieldValue(item, "buffs"))
  };
}

function getBloxFruitsInstinctLevelSection(level: string | null): string {
  const numeric = Number.parseInt(level ?? "", 10);
  if (numeric <= 1) return "Starter Instinct";
  if (numeric >= 7) return "V2 preparation";
  return "Main training climb";
}

function normalizeBloxFruitsInstinctExp(value: unknown): string | null {
  const normalized = normalizeValue(value);
  if (!normalized) return null;
  return `${normalized.replace(/\[|\]/g, "").replace(/\s+/g, " ")} EXP`;
}

function getBloxFruitsInstinctProgressNote(level: string | null, buffs: unknown): string | null {
  if (level === "1") return "First dodge and vision tier";
  if (level === "7") return "Max base Instinct level before V2";
  return cleanBloxFruitsNote(buffs);
}

function withBloxFruitsNpcFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  const details = getBloxFruitsNpcDetails(item);

  return {
    ...item,
    catalogSection: details.section,
    npcRole: details.role,
    displaySea: details.sea,
    displayLocation: details.location,
    purpose: details.purpose,
    combatLevel: details.level,
    accessSpawn: details.accessSpawn,
    combat: details.combat,
    availability: details.availability,
    relatedRoute: details.relatedRoute
  };
}

function getBloxFruitsNpcDetails(item: GameDatasetCatalogItem) {
  const name = normalizeValue(item.name) ?? "";
  const rawType = normalizeValue(getBloxFruitsFieldValue(item, "type")) ?? "";
  const overview = normalizeValue(item.overview) ?? "";
  const haystack = `${name} ${rawType} ${overview}`.toLowerCase();
  const type = rawType.toLowerCase();
  const isBoss = type.includes("boss");
  const isEnemy = type.includes("enemy") || isBloxFruitsSeaEnemyName(name);
  const isQuest = type.includes("quest");
  const isTrainer = isBloxFruitsTrainerNpc(name);
  const isShop = isBloxFruitsShopNpc(name, type);
  const isService = isBloxFruitsServiceNpc(name, haystack);
  const isEvent = isBloxFruitsEventNpc(name, haystack);
  const isUnclear = isBloxFruitsUnclearNpc(name, haystack);

  const section = isUnclear
    ? "Admin, removed, and unclear references"
    : isEvent
      ? "Event, limited, and special-space NPCs"
      : isBoss
        ? "Bosses and raid bosses"
        : isEnemy
          ? "Enemies and grind targets"
          : isTrainer
            ? "Trainers, teachers, and system unlocks"
            : isShop
              ? "Shops, dealers, and exchange NPCs"
              : isQuest
                ? "Quest givers and progression NPCs"
                : isService
                  ? "Travel, crew, and service NPCs"
                  : "Admin, removed, and unclear references";

  return {
    section,
    role: getBloxFruitsNpcRole(name, rawType, section),
    sea: getBloxFruitsSeaLabel(getBloxFruitsFieldValue(item, "sea")),
    location: cleanBloxFruitsLocationList(getBloxFruitsFieldValue(item, "location") ?? getBloxFruitsFieldValue(item, "locations")),
    purpose: getBloxFruitsNpcPurpose(name, section, overview),
    level: isBoss || isEnemy ? normalizeValue(getBloxFruitsFieldValue(item, "level")) : null,
    accessSpawn: getBloxFruitsNpcAccessSpawn(item, section),
    combat: isBoss || isEnemy ? getBloxFruitsNpcCombat(item) : null,
    availability: getBloxFruitsNpcAvailability(name, section, haystack),
    relatedRoute: getBloxFruitsNpcRelatedRoute(name, overview)
  };
}

function isBloxFruitsTrainerNpc(name: string): boolean {
  return /teacher|trainer|master|monk|scientist|wizard|hunter|sage|arowe|uzoth|dojo|instinct|ability|water kung|dark step|mad scientist/i.test(
    name
  );
}

function isBloxFruitsShopNpc(name: string, type: string): boolean {
  return (
    type.includes("shop") ||
    /dealer|gacha|shop|merchant|exchange|seller|blacksmith|blox fruit|weapon|boat|sword|stock|barista|cousin/i.test(name)
  );
}

function isBloxFruitsServiceNpc(name: string, haystack: string): boolean {
  return /captain|set home|titles|crew|manager|expert|remove|plokster|nerd|tort|editor|home point|travel|teleport|bounty|honor/i.test(
    `${name} ${haystack}`
  );
}

function isBloxFruitsEventNpc(name: string, haystack: string): boolean {
  return /event|halloween|summer|christmas|santa|elf|celestial|oni|tournament|lucky|maxer|agony|ashen|rip family|red legion|grand colosseum|limited/i.test(
    `${name} ${haystack}`
  );
}

function isBloxFruitsUnclearNpc(name: string, haystack: string): boolean {
  return /admin|removed|category|raid bosses|elite pirates|official|not available|unknown|unclear/i.test(`${name} ${haystack}`);
}

function isBloxFruitsSeaEnemyName(name: string): boolean {
  return /sea beast|piranha|shark|ghost shark|haunted crew/i.test(name);
}

function getBloxFruitsNpcRole(name: string, rawType: string, section: string): string {
  if (section === "Bosses and raid bosses") return rawType.includes("Raid") ? "Raid boss" : "Boss";
  if (section === "Enemies and grind targets") return "Enemy";
  if (section === "Quest givers and progression NPCs") return "Quest giver";
  if (section === "Shops, dealers, and exchange NPCs") return /gacha/i.test(name) ? "Gacha / exchange NPC" : "Shop or dealer";
  if (section === "Trainers, teachers, and system unlocks") return "Trainer or unlock NPC";
  if (section === "Travel, crew, and service NPCs") return "Service NPC";
  if (section === "Event, limited, and special-space NPCs") return "Event or special NPC";
  return "Reference row";
}

function getBloxFruitsNpcPurpose(name: string, section: string, overview: string): string | null {
  if (name === "Ability Teacher") return "Teaches core abilities";
  if (name === "Instinct Teacher") return "Unlocks Instinct";
  if (/Blox Fruit Dealer/i.test(name)) return "Fruit shop access";
  if (/Blox Fruit Gacha/i.test(name)) return "Random physical fruit roll";
  if (/Boat Dealer/i.test(name)) return "Boat purchase and travel";
  if (/Titles Specialist/i.test(name)) return "Equip titles and title colors";
  if (/Set Home/i.test(name)) return "Sets respawn point";
  if (/Experienced Captain/i.test(name)) return "Sea travel service";
  if (/Arowe/i.test(name)) return "Race V3 upgrade route";
  if (/Dragon Wizard|Dragon Hunter|Dojo|Dragon Talon/i.test(name)) return "Dragon Dojo progression";
  if (/Mysterious Scientist/i.test(name)) return "Raid access";
  if (/Trevor/i.test(name)) return "Don Swan room access";
  if (section === "Quest givers and progression NPCs") return "Starts quest route";
  if (section === "Enemies and grind targets") return "Combat grind target";
  if (section === "Bosses and raid bosses") return "Boss fight route";
  if (section === "Event, limited, and special-space NPCs") return "Event or special route";
  return summarizeBloxFruitsOverview(overview);
}

function getBloxFruitsNpcAccessSpawn(item: GameDatasetCatalogItem, section: string): string | null {
  const spawnTime = normalizeValue(getBloxFruitsFieldValue(item, "spawnTime"));
  const despawnTime = normalizeValue(getBloxFruitsFieldValue(item, "despawnTime"));
  const parts: string[] = [];
  if (spawnTime) parts.push(`spawns in ${spawnTime.toLowerCase()}`);
  if (despawnTime) parts.push(`despawns after ${despawnTime.toLowerCase()}`);
  if (parts.length) return sentenceCase(parts.join("; "));
  if (section === "Event, limited, and special-space NPCs") return "Event or special access";
  return null;
}

function getBloxFruitsNpcCombat(item: GameDatasetCatalogItem): string | null {
  const aura = normalizeValue(getBloxFruitsFieldValue(item, "usesAura"));
  const weapon = normalizeValue(getBloxFruitsFieldValue(item, "weaponType") ?? getBloxFruitsFieldValue(item, "weapon"));
  const parts: string[] = [];
  if (aura) parts.push(`Aura: ${aura === "✔" ? "Yes" : aura === "✘" ? "No" : aura}`);
  if (weapon) parts.push(`Weapon: ${weapon}`);
  return parts.length ? parts.join("; ") : null;
}

function getBloxFruitsNpcAvailability(name: string, section: string, haystack: string): string | null {
  if (section === "Admin, removed, and unclear references") return "Reference or unclear";
  if (/removed|no longer|unavailable/i.test(haystack)) return "Removed or unavailable";
  if (section === "Event, limited, and special-space NPCs") return "Event or special route";
  if (/admin/i.test(name)) return "Admin-only";
  return null;
}

function getBloxFruitsNpcRelatedRoute(name: string, overview: string): string | null {
  const text = `${name} ${overview}`.toLowerCase();
  if (text.includes("title")) return "Titles";
  if (text.includes("fruit")) return "Fruit shop";
  if (text.includes("boat")) return "Boats";
  if (text.includes("raid")) return "Raids";
  if (text.includes("instinct")) return "Instinct";
  if (text.includes("aura")) return "Aura";
  if (text.includes("race")) return "Race progression";
  if (text.includes("dragon")) return "Dragon Dojo";
  if (text.includes("sea beast") || text.includes("leviathan")) return "Sea events";
  if (text.includes("quest")) return "Quest chain";
  return null;
}

function cleanBloxFruitsLocationList(value: unknown): string | null {
  const normalized = normalizeValue(value);
  if (!normalized || normalized === "???") return normalized === "???" ? "Hidden/quest route" : null;
  const knownLocations = [
    "Pirate Starter",
    "Marine Starter",
    "Middle Town",
    "Kingdom of Rose",
    "Frozen Village",
    "Magma Village",
    "Upper Skylands",
    "Mirage Island",
    "Castle on the Sea",
    "Port Town",
    "Mansion",
    "Cafe",
    "Café",
    "Jungle",
    "Marine Fortress",
    "Grand Colosseum",
    "Hot and Cold",
    "Floating Turtle",
    "Hydra Island",
    "Tiki Outpost",
    "Frozen Dimension",
    "Haunted Shipwreck"
  ];
  const matches = knownLocations.filter((location) => normalized.includes(location));
  if (matches.length > 1) return matches.join(" / ");
  return normalizeBloxFruitsRouteText(normalized);
}

function summarizeBloxFruitsOverview(overview: string): string | null {
  const cleaned = overview.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g, "").replace(/Loading Timer|Purge\/Reload the page to continue the countdown/g, "");
  const sentence = cleaned.split(/[.!?]/).map((part) => part.trim()).find(Boolean);
  if (!sentence || sentence.length > 120) return null;
  return sentence;
}

function withBloxFruitsTitleFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  const obtainment = normalizeValue(item.obtainment ?? getBloxFruitsFieldValue(item, "obtainment")) ?? "";
  const details = getBloxFruitsTitleDetails(obtainment);
  return {
    ...item,
    catalogSection: details.section,
    displayTitleNumber: normalizeValue(item.titleNumber ?? getBloxFruitsFieldValue(item, "titleNumber")),
    unlockRequirement: obtainment,
    unlockRoute: details.route,
    relatedTarget: details.relatedTarget,
    availabilityNote: details.availabilityNote
  };
}

function getBloxFruitsTitleDetails(obtainment: string) {
  const text = obtainment.toLowerCase();
  if (/to be added|unknown|secret|wishes to keep it secret/.test(text)) {
    return {
      section: "Placeholders and unknown titles",
      route: "Unknown or placeholder",
      relatedTarget: null,
      availabilityNote: obtainment
    };
  }
  if (/v2|v3|v4|human|rabbit|shark|angel|ghoul|cyborg|draco/.test(text) && /unlock|obtain/.test(text)) {
    return { section: "Race evolution titles", route: "Race evolution", relatedTarget: deriveBloxFruitsTitleTarget(obtainment), availabilityNote: null };
  }
  if (/bounty|honor|marine|pirate/.test(text) && /\d|bounty|honor/.test(text)) {
    return { section: "Bounty and Honor titles", route: "Bounty / Honor", relatedTarget: null, availabilityNote: null };
  }
  if (/awak/.test(text) || /raid/i.test(obtainment) && /fruit/i.test(obtainment)) {
    return { section: "Fruit awakening titles", route: "Fruit awakening", relatedTarget: deriveBloxFruitsTitleTarget(obtainment), availabilityNote: null };
  }
  if (/mastery|level|aura|instinct|title|fishing|fish|max/.test(text)) {
    return { section: "Progression and mastery titles", route: "Progression / mastery", relatedTarget: deriveBloxFruitsTitleTarget(obtainment), availabilityNote: null };
  }
  if (/defeat|kill|boss|prince|king|queen|indra|longma|leviathan|terrorshark|sea beast|enemy|raid boss/.test(text)) {
    return { section: "Boss, raid, and enemy titles", route: "Boss or enemy", relatedTarget: deriveBloxFruitsTitleTarget(obtainment), availabilityNote: null };
  }
  if (/sea event|ship|treasure|prehistoric|mirage|kitsune|shrine|rumbling|ghost|haunted|shark|piranh|volcano/.test(text)) {
    return { section: "Sea event and special activity titles", route: "Sea event / activity", relatedTarget: deriveBloxFruitsTitleTarget(obtainment), availabilityNote: null };
  }
  if (/code|event|christmas|halloween|easter|valentine|limited|redeem|202/.test(text)) {
    return { section: "Event, code, and limited titles", route: "Event / code", relatedTarget: deriveBloxFruitsTitleTarget(obtainment), availabilityNote: null };
  }
  if (/admin|owner|creator|youtube|youtuber|official|crew|community|discord|roblox account|developer/.test(text)) {
    return { section: "Creator, admin, and community titles", route: "Creator / community", relatedTarget: deriveBloxFruitsTitleTarget(obtainment), availabilityNote: null };
  }
  return { section: "Utility, puzzle, and misc titles", route: "Utility / misc", relatedTarget: deriveBloxFruitsTitleTarget(obtainment), availabilityNote: null };
}

function deriveBloxFruitsTitleTarget(obtainment: string): string | null {
  const quoted = obtainment.match(/"([^"]+)"/)?.[1];
  if (quoted) return quoted;
  const patterns = [
    /unlock\s+(.+?)(?:\.|$)/i,
    /defeat\s+(.+?)(?:\.|$)/i,
    /kill\s+(.+?)(?:\.|$)/i,
    /obtain\s+(.+?)(?:\.|$)/i,
    /redeem\s+(.+?)(?:\.|$)/i
  ];
  for (const pattern of patterns) {
    const match = obtainment.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function withBloxFruitsSpecialTitleFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  const obtainment = normalizeValue(item.obtainment ?? getBloxFruitsFieldValue(item, "obtainment")) ?? "";
  const lower = obtainment.toLowerCase();
  const ownerAdmin = /co-owner|admin|owner|official/.test(lower) || /owner|official/i.test(normalizeValue(item.name) ?? "");
  return {
    ...item,
    catalogSection: ownerAdmin ? "Owner and admin titles" : "Named account custom titles",
    grantRoute: ownerAdmin ? "Developer/admin grant" : "Named account grant",
    holderTarget: getBloxFruitsSpecialTitleHolder(obtainment),
    obtainmentNote: obtainment,
    normalPlayerRoute: "Not a normal player unlock"
  };
}

function getBloxFruitsSpecialTitleHolder(obtainment: string): string | null {
  const match = obtainment.match(/Given to (.+?)(?:\.|$)/i);
  return match?.[1]?.trim() ?? null;
}

function withBloxFruitsTitleColorFields(item: GameDatasetCatalogItem): GameDatasetCatalogItem {
  const obtainment = normalizeValue(item.obtainment ?? getBloxFruitsFieldValue(item, "obtainment")) ?? "";
  const count = getBloxFruitsTitleColorCount(obtainment);
  const section =
    count === null ? "Automatic colors" : count <= 50 ? "Early title milestones" : count <= 100 ? "Mid title milestones" : "Late title milestones";
  const stage =
    count === null ? "Automatic" : count <= 50 ? "Early milestone" : count <= 100 ? "Mid milestone" : "Late milestone";
  return {
    ...item,
    catalogSection: section,
    unlockRequirement: obtainment,
    titleCountNeeded: count === null ? "Automatic" : `${count} titles`,
    unlockStage: stage,
    visualRole: "Equipped title color"
  };
}

function getBloxFruitsTitleColorCount(obtainment: string): number | null {
  const match = obtainment.match(/(\d+)\s+Titles?/i);
  return match?.[1] ? Number(match[1]) : null;
}

function getBloxFruitsSeaNumbers(value: unknown): string[] {
  const sea = normalizeValue(value)?.toLowerCase() ?? "";
  const numbers = new Set<string>(sea.match(/[123]/g) ?? []);
  if (sea.includes("first")) numbers.add("1");
  if (sea.includes("second")) numbers.add("2");
  if (sea.includes("third")) numbers.add("3");
  return Array.from(numbers);
}

function getBloxFruitsSeaLabel(value: unknown): string | null {
  const sea = normalizeValue(value)?.toLowerCase() ?? "";
  if (!sea) return null;
  if (sea.includes("admin")) return "Admin-only";
  if (sea.includes("event")) return "Event";

  const seaNumbers = getBloxFruitsSeaNumbers(value);
  if (!seaNumbers.length) return null;
  if (seaNumbers.length === 3) return "All Seas";

  const seaLabels: Record<string, string> = {
    "1": "First Sea",
    "2": "Second Sea",
    "3": "Third Sea"
  };
  return seaNumbers.map((entry) => seaLabels[entry]).filter(Boolean).join(" / ") || null;
}

function getBloxFruitsFieldValue(item: GameDatasetCatalogItem, key: string): unknown {
  if (item[key] !== undefined && item[key] !== null) return item[key];
  return isRecord(item.fields) ? item.fields[key] : null;
}

function formatBloxFruitsMoney(value: unknown): string | null {
  const normalized = normalizeValue(value);
  if (!normalized || normalized.toLowerCase() === "inf") return null;
  return `$${normalized.replace(/^\$/, "")}`;
}

function formatBloxFruitsRewardMoney(value: unknown): string | null {
  const normalized = normalizeValue(value);
  if (!normalized || normalized === "N/A" || /exp/i.test(normalized) || /boss|katana|fruit|aura/i.test(normalized)) {
    return null;
  }
  return /^\$/.test(normalized) ? normalized : `$${normalized}`;
}

function formatBloxFruitsRobux(value: unknown): string | null {
  const normalized = normalizeValue(value);
  if (!normalized) return null;
  return `${normalized.replace(/\s*robux$/i, "")} Robux`;
}

function formatBloxFruitsFragments(value: unknown): string | null {
  const normalized = normalizeValue(value);
  if (!normalized) return null;
  return `${normalized.replace(/\s*fragments?$/i, "")} Fragments`;
}

function normalizeBloxFruitsRouteText(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/\s*\u2022\s*/g, "; ").replace(/\s+/g, " ").trim() || null;
}

function normalizeBloxFruitsExp(value: unknown): string | null {
  const normalized = normalizeValue(value);
  if (!normalized || normalized === "N/A") return null;
  return normalized.replace(/^(.+?EXP)\1$/i, "$1").replace(/\s+/g, " ").trim();
}

function cleanBloxFruitsNote(value: unknown): string | null {
  const normalized = normalizeValue(value);
  if (!normalized || normalized === "N/A") return null;
  return normalizeBloxFruitsRouteText(normalized);
}

function sentenceCase(value: string): string {
  const normalized = value.trim();
  if (!normalized) return normalized;
  return `${normalized[0]?.toUpperCase() ?? ""}${normalized.slice(1)}`;
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
  "cardSummary",
  "description",
  "overview",
  "summary",
  "whatItDoes",
  "use",
  "effect",
  "benefits",
  "benefit",
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
  "zoneNumber",
  "rebirthNumber",
  "slimesNeeded",
  "odds",
  "rarity",
  "variant",
  "power",
  "health",
  "baseIncome",
  "incomeMultiplier",
  "income",
  "chance",
  "cost",
  "price",
  "costBucks",
  "costStars",
  "money",
  "robux",
  "requiredCash",
  "requiredBrainrots",
  "goopRequired",
  "multiplier",
  "luckMultiplier",
  "maxChance",
  "spawnChance",
  "kickPowerBand",
  "earningsBand",
  "mutationChance",
  "totalZoneLuck",
  "enemyHealth",
  "goopPerKill",
  "machineUnlocks",
  "level",
  "exp",
  "xp",
  "expNeeded",
  "dodges",
  "health",
  "seats",
  "cannons",
  "speed",
  "requirements",
  "area",
  "zone",
  "resultChance",
  "resultRarity",
  "requiredSummary",
  "ingredientOddsText",
  "itemType",
  "effect",
  "buff",
  "nextRoll",
  "duration",
  "rule",
  "abilityOne",
  "abilityTwo",
  "upgradeNote",
  "restrictions",
  "appliesTo",
  "survivalNote",
  "rewardOne",
  "rewardTwo",
  "rewardThree",
  "rewardSummary",
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
  "imageStatus",
  "imageMissingReason",
  "imageSource",
  "sourceImageUrl",
  "sourceImage",
  "sourcePage",
  "secondarySourcePage",
  "sourceUrl",
  "sourceUrls",
  "sourceFile",
  "sourceTables",
  "sourceStatus",
  "sourceConfidence",
  "sourceCheckedAt",
  "sourceGeneratedAt",
  "sourceNote",
  "sourceNotes",
  "sourceEvidence",
  "wikiSourceStatus",
  "verification",
  "verificationNote",
  "confidence",
  "blocker",
  "wikiUrl",
  "imageCandidate",
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
  const subtitleKeys =
    sectionOverride?.subtitleKeys ??
    SUBTITLE_KEY_PRIORITY.filter(
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
    hideImages: sectionOverride?.hideImages ?? !hasImages
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

  const sourceItems = sectionOverride.transformItems ? sectionOverride.transformItems(dataset.items) : dataset.items;
  const items = sourceItems.map((item) => {
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

export function buildGameDatasetCatalogSidebarSections(
  config: GameDatasetCatalogConfig,
  dataset: GameDatasetCatalogDataset
): Array<{ id: string; label: string; count: number }> {
  const { dataset: displayDataset, sectionOverride } = withCatalogSectionOverride(config, dataset);
  const viewConfig = buildViewConfig(config, displayDataset, sectionOverride);
  return buildGroupedSections(displayDataset.items, viewConfig.groupKey, sectionOverride?.sectionOrder).map((section) => ({
    id: section.id,
    label: section.label,
    count: section.items.length
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
      noteHtml: noteEntry ? processHtmlLinks(noteEntry.html).__html : null,
      noteNodes: noteEntry ? renderPageContentNodes(noteEntry.html, `${config.code}-section-note-${section.id}`) : null
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
  const howHeading = `How to Use This ${config.gameName} ${config.label} List`;
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
      image: `${SITE_URL}${FALLBACK_IMAGE}`,
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

            {howNodes ? (
              <>
                <h2 data-md-copy className="md-copy-node md-copy-heading md-copy-h2">
                  {howHeading}
                </h2>
                {howNodes}
              </>
            ) : null}

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
