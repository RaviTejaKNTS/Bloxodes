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
      "gamepasses",
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
  acquisition: "acquisition",
  available: "availability",
  availability: "availability",
  benefits: "benefits",
  bonus: "bonus",
  bosses: "bosses",
  building: "building",
  cashBonus: "cash bonus",
  category: "category",
  chances: "chances",
  cooldown: "cooldown",
  cost: "cost",
  costBucks: "Bucks cost",
  costStars: "Star cost",
  description: "description",
  dodges: "dodges",
  drops: "drops",
  effect: "effect",
  exp: "EXP",
  expNeeded: "EXP needed",
  fields: "listed fields",
  howToUse: "how to use",
  image: "image",
  income: "income",
  level: "level",
  location: "location",
  maxChance: "max chance",
  money: "money cost",
  multiplier: "multiplier",
  notes: "notes",
  obtainment: "obtainment",
  overview: "overview",
  price: "price",
  rarity: "rarity",
  requiredBrainrots: "required brainrots",
  requiredCash: "required cash",
  requirements: "requirements",
  rewardCategory: "reward type",
  robux: "Robux cost",
  sea: "sea",
  seats: "seats",
  source: "source",
  sourceType: "source type",
  special: "special reward",
  status: "status",
  stats: "stats",
  tier: "tier",
  type: "type",
  unlock: "unlock",
  usageTips: "usage tips",
  whatItDoes: "what it does",
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
  "sections"
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
  return `/catalog/${code}`;
}

export function getGameDatasetCatalogConfigByCode(code: string): GameDatasetCatalogConfig | null {
  const normalized = code.trim().toLowerCase();
  return GAME_DATASET_CATALOGS.find((entry) => entry.code === normalized) ?? null;
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
    `Browse ${countLabel} ${config.gameName} ${lowerLabel} with ${fieldSummary}.`
  );

  const intro = `${config.label} matter in ${config.gameName} because players use them to compare ${focus}. This catalog lists ${countLabel} ${lowerLabel} and keeps the important fields in one place: ${fieldSummary}.

Use it to check names, images, requirements, prices, rewards, availability, and other listed details without opening each item one by one. When a value is blank, that detail was not listed clearly in the current data.`;

  const how = `Start with the grouped sections, then compare the fields that matter for this collection: ${fieldSummary}. Images help identify entries when the game uses icons or thumbnails, while the list view is better for scanning many rows quickly. Missing values are left empty instead of guessed.`;

  return {
    code: config.code,
    title,
    seo_title: title,
    meta_description: metaDescription,
    intro_md: intro,
    how_it_works_md: how,
    description_json: {},
    faq_json: [
      {
        q: `What is included in this ${config.gameName} ${lowerLabel} catalog?`,
        a: `It includes every ${lowerLabel} entry currently collected for ${config.gameName}, with the item fields that are available in the dataset.`
      },
      {
        q: "Why are some values blank?",
        a: "Blank values mean that detail was not listed clearly for that entry. We keep the item visible and avoid filling missing stats with guesses."
      },
      {
        q: "How should I use this page?",
        a: `Use the card view for quick visual browsing and the list view when you want to compare ${fieldSummary} across many entries.`
      }
    ],
    cta_label: `Open ${lowerLabel} catalog`,
    cta_url: buildGameDatasetCatalogPath(config.code),
    wiki_md: `${config.label} are part of ${config.gameName}'s in-game reference data. Use this catalog to compare ${focus} before you choose what to collect, unlock, buy, fight, or track next.`,
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
