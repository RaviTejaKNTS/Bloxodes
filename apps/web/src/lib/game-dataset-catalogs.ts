export type GameDatasetCatalogGroup = {
  gameSlug: string;
  gameName: string;
  dataDir: string;
  universeNames: string[];
  collections: string[];
};

export type GameDatasetCatalogConfig = {
  code: string;
  gameSlug: string;
  gameName: string;
  dataDir: string;
  file: string;
  slug: string;
  label: string;
  sortOrder: number;
  universeNames: string[];
};

export type GameDatasetCatalogCopyInput = {
  config: GameDatasetCatalogConfig;
  itemCount: number;
  columns: string[];
  imageUrls: string[];
};

export type GameDatasetCatalogCopy = {
  code: string;
  title: string;
  seo_title: string;
  meta_description: string;
  intro_md: string;
  description_md: string;
  how_it_works_md: string;
  description_json: Record<string, string>;
  faq_json: Array<{ q: string; a: string }>;
  cta_label: string;
  cta_url: string;
  wiki_md: string;
  wiki_sort_order: number;
  wiki_item_count: number;
  thumb_url: string | null;
};

export const GAME_DATASET_CATALOG_GROUPS: GameDatasetCatalogGroup[] = [
  {
    gameSlug: "steal-a-brainrot",
    gameName: "Steal a Brainrot",
    dataDir: "Steal a Brainrot",
    universeNames: ["Steal a Brainrot"],
    collections: [
      "brainrots",
      "rebirths",
      "rituals",
      "fuse-machine",
      "mutations",
      "rarities",
      "traits",
      "lucky-blocks",
      "gears",
      "machines"
    ]
  },
  {
    gameSlug: "sailor-piece",
    gameName: "Sailor Piece",
    dataDir: "Sailor Piece",
    universeNames: ["Sailor Piece"],
    collections: [
      "fruits",
      "islands",
      "accessories",
      "dungeons",
      "races",
      "traits",
      "bloodlines",
      "bosses",
      "swords",
      "guilds",
      "titles",
      "melee-specs",
      "runes",
      "clans",
      "relics",
      "haki"
    ]
  },
  {
    gameSlug: "brookhaven-rp",
    gameName: "Brookhaven RP",
    dataDir: "Brookhaven RP",
    universeNames: ["Brookhaven RP", "Brookhaven"],
    collections: [
      "locations",
      "jobs",
      "roleplay-outfits",
      "props",
      "houses",
      "map-themes",
      "weather-and-disasters",
      "emotes",
      "secrets",
      "inventory-items",
      "vehicles",
      "gamepasses"
    ]
  },
  {
    gameSlug: "adopt-me",
    gameName: "Adopt Me",
    dataDir: "Adopt Me",
    universeNames: ["Adopt Me", "Adopt Me!"],
    collections: [
      "accessory-shop",
      "eggs",
      "food",
      "furniture",
      "gift-prizes",
      "gifts",
      "house-surfaces",
      "pet-ages",
      "pets",
      "potions",
      "star-rewards",
      "strollers",
      "toys",
      "vehicles"
    ]
  },
  {
    gameSlug: "blox-fruits",
    gameName: "Blox Fruits",
    dataDir: "Blox Fruits",
    universeNames: ["Blox Fruits"],
    collections: [
      "abilities",
      "accessories",
      "aura-stages",
      "aura-visuals",
      "boats",
      "bosses",
      "enemies",
      "fighting-styles",
      "fruits",
      "guns",
      "instinct-levels",
      "locations",
      "materials",
      "npcs",
      "quests",
      "races",
      "sea-events",
      "special-titles",
      "swords",
      "title-colors",
      "titles"
    ]
  }
];

const COLLECTION_LABEL_OVERRIDES: Record<string, string> = {
  "accessory-shop": "Accessory Shop Items",
  "aura-stages": "Aura Stages",
  "aura-visuals": "Aura Visuals",
  "fighting-styles": "Fighting Styles",
  "fuse-machine": "Fuse Machine Results",
  gamepasses: "Gamepasses",
  haki: "Haki",
  "house-surfaces": "House Surfaces",
  "instinct-levels": "Instinct Levels",
  "inventory-items": "Inventory Items",
  "lucky-blocks": "Lucky Blocks",
  "map-themes": "Map Themes",
  "melee-specs": "Melee Specs",
  npcs: "NPCs",
  "pet-ages": "Pet Ages",
  "roleplay-outfits": "Roleplay Outfits",
  "sea-events": "Sea Events",
  "special-titles": "Special Titles",
  "star-rewards": "Star Rewards",
  "title-colors": "Title Colors",
  "weather-and-disasters": "Weather and Disasters"
};

const COLLECTION_FOCUS: Record<string, string> = {
  abilities: "what each ability does, where it comes from, and what it changes in play",
  accessories: "rarity, type, stats, obtainment, and build value",
  "accessory-shop": "chests, accessory shop items, prices, rarity chances, and obtainment notes",
  "aura-stages": "aura progression, stage requirements, visuals, and buffs",
  "aura-visuals": "how each aura stage appears on the character",
  bloodlines: "rarity, effects, bonuses, requirements, and obtainment",
  boats: "price, speed, health, seats, cannons, and travel use",
  bosses: "boss names, locations, levels, drops, rewards, and fight details",
  brainrots: "rarity, income, cost, status, rituals, mutations, traits, and release details",
  clans: "clan effects, bonuses, rarity, requirements, and obtainment",
  dungeons: "entry rules, wave structure, rewards, difficulty, and dungeon purpose",
  eggs: "price, rarity chances, availability, events, and obtainment",
  emotes: "available emote entries and their catalog images",
  enemies: "enemy levels, seas, locations, notes, and progression value",
  "fighting-styles": "price, requirements, obtainment, upgrading, and combat role",
  "fuse-machine": "possible fuse results, rarities, income values, and max chances",
  food: "food names, prices, effects, uses, availability, and event notes",
  fruits: "rarity, type, price, Robux cost, obtainment, upgrading, and ability value",
  furniture: "furniture names, categories, prices, and home customization use",
  gamepasses: "costs, unlocks, benefits, availability, and purchase value",
  gears: "cost, rebirth requirements, cooldowns, effects, and practical use",
  "gift-prizes": "gift prize names, rarity, categories, images, and listed item fields",
  gifts: "gift prices, rarity chances, availability, and reward context",
  guilds: "guild effects, requirements, bonuses, and progression role",
  haki: "Haki types, unlock routes, levels, effects, and combat use",
  "house-surfaces": "wall and floor surfaces, prices, categories, and home design options",
  houses: "house names, categories, costs, requirements, images, and unlock notes",
  "instinct-levels": "Instinct level progression, experience, dodges, and buffs",
  "inventory-items": "tools, roleplay items, categories, descriptions, and images",
  islands: "level ranges, seas, bosses, costs, and travel progression",
  jobs: "job names, categories, buildings, images, and roleplay use",
  locations: "areas, types, descriptions, map placement, and related details",
  "lucky-blocks": "cost, rarity, status, contents, appearance, and reward context",
  machines: "machine names, how to use them, what they do, and whether they are in game",
  materials: "rarity, source, requirements, obtainment, and upgrade use",
  "map-themes": "theme names, categories, requirements, costs, and map effects",
  "melee-specs": "melee specs, rarity, stats, abilities, drops, and acquisition",
  mutations: "mutation categories, multipliers, visual changes, and availability",
  npcs: "NPC names, roles, locations, descriptions, and related wiki details",
  "pet-ages": "pet age stages, tricks unlocked, and special tricks",
  pets: "rarity, cost, availability, source tables, images, and pet collection progress",
  potions: "price, effect, use, availability, and obtainment",
  props: "prop categories, names, and catalog images for roleplay setup",
  quests: "quest givers, islands, levels, XP, money, objectives, and special rewards",
  races: "race names, rarity, effects, bonuses, requirements, and progression use",
  rarities: "rarity counts, income ranges, cost ranges, spawn chance, and descriptions",
  rebirths: "rebirth levels, cash requirements, required brainrots, multipliers, and unlocks",
  relics: "relic effects, bonuses, rarity, requirements, and obtainment",
  rituals: "ritual names, required formations, spawned brainrots, weather, and income results",
  "roleplay-outfits": "outfit names, buildings, categories, and roleplay images",
  runes: "rune rarity, effects, stats, requirements, drops, and use",
  secrets: "secret names, summaries, steps, and images where listed",
  "sea-events": "event names, images, descriptions, and sea-event context",
  "special-titles": "special title names and exact obtainment requirements",
  "star-rewards": "star costs, reward types, rarity, and reward images",
  strollers: "stroller names, prices, rarity, availability, and event notes",
  swords: "rarity, type, price, requirements, obtainment, upgrading, and combat role",
  "title-colors": "title color names and obtainment requirements",
  titles: "title numbers, title text, obtainment, and unlock requirements",
  toys: "toy names, rarity, prices, effects, availability, and event notes",
  traits: "trait categories, multipliers, visuals, obtainment, and notes",
  vehicles: "vehicle names, categories, costs, seats, requirements, and availability"
};

const FIELD_LABELS: Record<string, string> = {
  abilities: "abilities",
  accessRespawn: "access / respawn",
  accessSpawn: "access / spawn",
  accessTravel: "access / travel",
  acquisition: "acquisition",
  armsVisual: "arms visual",
  abilityCount: "ability count",
  appliesTo: "applies to",
  available: "availability",
  availability: "availability",
  availabilityNote: "availability note",
  baseDamage: "base damage",
  baseDodges: "base dodges",
  baseEffect: "base effect",
  baseFruit: "base fruit",
  benefits: "benefits",
  bestFor: "best for",
  bodyCoverage: "body coverage",
  bonus: "bonus",
  bonusEffect: "bonus / effect",
  bonusSummary: "bonuses",
  bonusType: "bonus type",
  bossCheckpoint: "boss checkpoint",
  bossStage: "boss stage",
  bosses: "bosses",
  building: "building",
  cashBonus: "cash bonus",
  catalogSection: "section",
  category: "category",
  chances: "chances",
  combat: "combat",
  combatLevel: "level",
  combatRole: "role",
  cooldown: "cooldown",
  cooldownReduction: "cooldown reduction",
  cost: "cost",
  costOrDrop: "cost / drop",
  costBucks: "Bucks cost",
  costStars: "Star cost",
  costSummary: "cost",
  coreBonus: "core bonus",
  craftCost: "craft cost",
  damage: "damage",
  damageMultiplier: "damage multiplier",
  damageReduction: "damage reduction",
  dangerLevel: "danger level",
  description: "description",
  defenseMultiplier: "defense multiplier",
  displayLevel: "level",
  displayArea: "sea / area",
  displayCannons: "cannons",
  displayRarity: "rarity",
  displayCost: "cost",
  displayHealth: "health",
  displayLocation: "location",
  displayPrice: "price",
  displaySea: "sea",
  displaySeats: "seats",
  displaySpeed: "speed",
  displayStage: "stage",
  displayTitleNumber: "title number",
  displayType: "type",
  dodges: "dodges",
  dropChance: "drop chance",
  dropCount: "drop count",
  dropNote: "drop note",
  dropOrCost: "drop / cost",
  dropOrPity: "drop / pity",
  drops: "drops",
  dropsRewards: "drops / rewards",
  effect: "effect",
  encounter: "encounter",
  encounterType: "encounter type",
  entryItem: "entry item",
  extraUnlock: "extra unlock",
  exp: "EXP",
  expNeeded: "EXP needed",
  expRange: "EXP range",
  expReward: "EXP reward",
  equipUseNote: "equip / use note",
  farmRoute: "farm route",
  fields: "listed fields",
  formatTime: "format",
  grantRoute: "grant route",
  hasV4: "V4 status",
  howToUse: "how to use",
  hp: "HP",
  holderTarget: "holder / target",
  image: "image",
  income: "income",
  importantRule: "important rule",
  islandArea: "island / area",
  islandRegion: "island / region",
  keyContent: "key content",
  keyUse: "key use",
  level: "level",
  levelRange: "level range",
  levelRequirement: "level requirement",
  levelingRoute: "leveling route",
  location: "location",
  locationType: "location type",
  legsVisual: "legs visual",
  mainLimit: "limit",
  mainNpcs: "main NPCs / bosses",
  mainReward: "main reward",
  mainRole: "main role",
  mainStrength: "strength",
  mainRewards: "main rewards",
  maxBonus: "max bonus",
  maxChance: "max chance",
  maxEffect: "max effect",
  maxLevel: "max level",
  maxPlayers: "max players",
  masteryGate: "mastery gate",
  masteryRequired: "mastery required",
  levelMasteryRequirement: "level / mastery requirement",
  money: "money cost",
  moneyPrice: "money price",
  moneyReward: "money reward",
  multiplier: "multiplier",
  normalPlayerRoute: "normal-player route",
  notes: "notes",
  npcRole: "role",
  objective: "objective",
  obtainment: "obtainment",
  obtainmentNote: "obtainment note",
  overview: "overview",
  partRoute: "part route",
  passive: "passive",
  price: "price",
  permanentPrice: "permanent price",
  progressionRole: "progression role",
  progressionNote: "progression note",
  progressionUse: "route use",
  questGiverName: "quest giver",
  questSource: "quest / source",
  rarity: "rarity",
  requirement: "requirement",
  requiredBrainrots: "required brainrots",
  requiredCash: "required cash",
  requiredSetup: "required setup",
  requiredFor: "required for",
  requirements: "requirements",
  requirementMastery: "requirement / mastery",
  relatedRoute: "related route",
  relatedTarget: "related target",
  respawnAccess: "access / respawn",
  rewardCategory: "reward type",
  robux: "Robux cost",
  role: "role",
  routeNote: "route note",
  routeRole: "route role",
  routeUse: "route / use",
  rollRarity: "roll rarity",
  rerollStatus: "reroll status",
  runType: "run type",
  sea: "sea",
  seaStage: "sea / stage",
  seaEventRole: "sea-event role",
  seats: "seats",
  signatureMove: "signature move",
  source: "source",
  sourceLocation: "source location",
  sourcePity: "source / pity",
  sourceRoute: "source",
  sourceTeacher: "teacher",
  sourceType: "source type",
  sourceAccess: "source / access",
  spawnAccess: "spawn / access",
  special: "special reward",
  specialUse: "special use",
  spawnRequirement: "spawn requirement",
  spinChance: "spin chance",
  status: "status",
  stats: "stats",
  statPriority: "stat priority",
  sustainDefense: "sustain / defense",
  tier: "tier",
  titleCountNeeded: "title count needed",
  titleRole: "title role",
  type: "type",
  unlock: "unlock",
  unlockNote: "unlock note",
  unlockRoute: "unlock route",
  unlockRequirement: "unlock requirement",
  unlockStage: "unlock stage",
  use: "use",
  usageTips: "usage tips",
  utilityBonus: "utility bonus",
  verificationNote: "verification note",
  awakeningCost: "awakening cost",
  auraExpNeeded: "Aura EXP needed",
  combatTravelRole: "combat / travel role",
  v4Title: "V4 title",
  v4Trial: "V4 trial",
  visualRole: "visual role",
  visualStage: "visual stage",
  whatItDoes: "what it does",
  weaponBonus: "weapon bonus",
  statEffect: "stat effect",
  teacherSource: "teacher / source",
  upgradePath: "upgrade path",
  upgradeUse: "upgrade / use note",
  wikiUrl: "wiki page"
};

const OMITTED_FIELD_KEYS = new Set([
  "id",
  "slug",
  "name",
  "image",
  "sourceImageUrl",
  "wikiUrl",
  "sourcePage",
  "sourceTables",
  "imageCandidate",
  "raw",
  "rawText",
  "sections",
  "updatedAt"
]);

export const GAME_DATASET_CATALOGS: GameDatasetCatalogConfig[] = GAME_DATASET_CATALOG_GROUPS.flatMap(
  (group) =>
    group.collections.map((collection, index) => ({
      code: buildGameDatasetCatalogCode(group.gameSlug, collection),
      gameSlug: group.gameSlug,
      gameName: group.gameName,
      dataDir: group.dataDir,
      file: `${collection}.json`,
      slug: collection,
      label: getCollectionLabel(collection),
      sortOrder: (GAME_DATASET_CATALOG_GROUPS.indexOf(group) + 1) * 1000 + (index + 1) * 10,
      universeNames: group.universeNames
    }))
);

export function buildGameDatasetCatalogCode(gameSlug: string, collectionSlug: string): string {
  return `${gameSlug}-${collectionSlug}`;
}

export function buildGameDatasetCatalogPath(code: string): string {
  const config = getGameDatasetCatalogConfigByCode(code);
  if (!config) return `/catalog/${code}`;
  return `/wiki/${config.gameSlug}/${config.slug}`;
}

export function getGameDatasetCatalogConfigByCode(code: string): GameDatasetCatalogConfig | null {
  const normalized = code.trim().toLowerCase();
  return GAME_DATASET_CATALOGS.find((entry) => entry.code === normalized) ?? null;
}

export function getGameDatasetCatalogConfigByWikiPath(
  gameSlug: string,
  collectionSlug: string
): GameDatasetCatalogConfig | null {
  const normalizedGameSlug = gameSlug.trim().toLowerCase();
  const normalizedCollectionSlug = collectionSlug.trim().toLowerCase();
  return (
    GAME_DATASET_CATALOGS.find(
      (entry) => entry.gameSlug === normalizedGameSlug && entry.slug === normalizedCollectionSlug
    ) ?? null
  );
}

export function getCollectionFocus(slug: string): string {
  return COLLECTION_FOCUS[slug] ?? `${getCollectionLabel(slug).toLowerCase()} details, requirements, and availability`;
}

export function getFieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? humanizeKey(key);
}

export function getUsefulColumnLabels(columns: string[], limit = 6): string[] {
  const labels = columns
    .filter((key) => !OMITTED_FIELD_KEYS.has(key))
    .map(getFieldLabel)
    .filter(Boolean);
  return Array.from(new Set(labels)).slice(0, limit);
}

export function buildGameDatasetCatalogCopy({
  config,
  itemCount,
  columns,
  imageUrls
}: GameDatasetCatalogCopyInput): GameDatasetCatalogCopy {
  const countLabel = itemCount.toLocaleString("en-US");
  const lowerLabel = config.label.toLowerCase();
  const focus = getCollectionFocus(config.slug);
  const columnLabels = getUsefulColumnLabels(columns, 7);
  const fieldSummary = toReadableList(columnLabels.length ? columnLabels : ["names", "images", "details"]);
  const title = `All ${countLabel} ${config.label} in ${config.gameName}`;
  const metaDescription = truncateMeta(
    `Compare ${countLabel} ${config.gameName} ${lowerLabel} by ${fieldSummary}.`
  );

  const intro = `${config.gameName} ${lowerLabel} cover ${focus}. The ${countLabel} tracked entries show ${fieldSummary}, so it is easier to spot which items are useful right now and which ones mostly matter for collection, trading, or completion.

Rarity is only one clue. Source, availability, price, effect, requirement, or reward details usually explain whether an item is easy to replace, worth saving, or locked behind an older update.`;

  const description = `The grouped sections give quick context for the kind of entry you are looking at, but the best field changes by collection. A combat item usually comes down to stats and requirements. A shop item comes down to price and availability. A reward item comes down to source, drop chance, event timing, or whether that reward can still be earned.

Blank fields are left empty instead of padded with guesses. That matters because Roblox game collections rarely share one perfect shape; a pet, boss, vehicle, consumable, quest, and material all need different details to make sense.`;

  const how = `The group heading gives the first read on each item type, then the useful fields carry the decision: ${fieldSummary}. Images help with quick recognition, while list view is better when you need to scan many entries at once. If an entry is missing a value, treat that detail as not clearly listed instead of assuming it works like nearby items.`;

  return {
    code: config.code,
    title,
    seo_title: title,
    meta_description: metaDescription,
    intro_md: intro,
    description_md: description,
    how_it_works_md: how,
    description_json: {},
    faq_json: [
      {
        q: `Which ${config.gameName} ${lowerLabel} fields matter most?`,
        a: `Start with the fields that change the player's decision: ${fieldSummary}. Rarity helps with sorting, but source, effect, requirement, price, or availability usually explains the real value.`
      },
      {
        q: "Why are some values blank?",
        a: "Blank values mean that detail was not listed clearly for that entry. The item stays visible, but missing stats are not filled with guesses."
      },
      {
        q: "Can a low-rarity item still be hard to replace?",
        a: "Yes. A low-rarity item from an old event, removed shop, limited reward, or rare drop can be harder to get than a higher-rarity item that is still sold or farmed normally."
      }
    ],
    cta_label: `Open ${lowerLabel} catalog`,
    cta_url: buildGameDatasetCatalogPath(config.code),
    wiki_md: `${config.gameName} ${lowerLabel} connect to ${focus}. Source and availability usually matter as much as rarity because older rewards, event items, shop rotations, and progression unlocks do not all stay equally easy to replace.`,
    wiki_sort_order: config.sortOrder,
    wiki_item_count: itemCount,
    thumb_url: imageUrls[0] ?? null
  };
}

function getCollectionLabel(slug: string): string {
  return COLLECTION_LABEL_OVERRIDES[slug] ?? humanizeKey(slug);
}

function humanizeKey(value: string): string {
  return value
    .replace(/[_-]/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      if (["npc", "npcs", "xp", "ugc"].includes(word.toLowerCase())) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function toReadableList(values: string[]): string {
  const unique = Array.from(new Set(values.filter(Boolean)));
  if (unique.length <= 1) return unique[0] ?? "";
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")}, and ${unique[unique.length - 1]}`;
}

function truncateMeta(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 158) return trimmed;
  return `${trimmed.slice(0, 155).replace(/\s+\S*$/, "")}...`;
}
