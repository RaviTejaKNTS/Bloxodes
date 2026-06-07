export type GameDatasetCatalogGroup = {
  gameSlug: string;
  gameName: string;
  universeId?: number;
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
    gameSlug: "slime-rng",
    gameName: "Slime RNG",
    dataDir: "Slime RNG",
    universeNames: ["Slime RNG"],
    collections: [
      "slimes",
      "zones",
      "crafting-recipes",
      "items",
      "power-fruits",
      "rebirths",
      "index-rewards"
    ]
  },
  {
    gameSlug: "sell-lemons",
    gameName: "Sell Lemons",
    universeId: 7395930870,
    dataDir: "Sell Lemons",
    universeNames: ["Sell Lemons"],
    collections: ["income-sources", "powers", "secret-unlocks", "evolution-stages", "locations"]
  },
  {
    gameSlug: "kick-a-lucky-block",
    gameName: "Kick a Lucky Block",
    dataDir: "Kick a Lucky Block",
    universeNames: ["Kick a Lucky Block", "[🌋] Kick a Lucky Block"],
    collections: ["brainrots", "mutations", "weights", "zones"]
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
  },
  {
    gameSlug: "wizard-alchemy",
    gameName: "Wizard Alchemy",
    dataDir: "Wizard Alchemy",
    universeNames: ["Wizard Alchemy"],
    collections: [
      "materials",
      "potions",
      "races",
      "wands",
      "brooms",
      "robes",
      "wizard-hats",
      "enemies",
      "chests",
      "enchantments",
      "locations",
      "npcs",
      "resource-nodes"
    ]
  },
  {
    gameSlug: "rivals",
    gameName: "RIVALS",
    dataDir: "RIVALS",
    universeNames: ["RIVALS"],
    collections: ["weapons", "maps", "skins", "wraps", "charms", "finishers", "emotes", "ugc"]
  },
  {
    gameSlug: "jujutsu-shenanigans",
    gameName: "Jujutsu Shenanigans",
    dataDir: "Jujutsu Shenanigans",
    universeNames: ["Jujutsu Shenanigans", "[BLACK DEATH] Jujutsu Shenanigans"],
    collections: [
      "characters",
      "domains",
      "items",
      "gamemodes",
      "maps",
      "emotes",
      "cosmetics",
      "titles",
      "interactables",
      "achievements",
      "build-blocks",
      "skill-builder-nodes"
    ]
  },
  {
    gameSlug: "survive-zombie-arena",
    gameName: "Survive Zombie Arena",
    dataDir: "Survive Zombie Arena",
    universeNames: ["Survive Zombie Arena"],
    collections: ["classes", "weapons", "gear", "maps"]
  },
  {
    gameSlug: "99-nights-in-the-forest",
    gameName: "99 Nights in the Forest",
    dataDir: "99 Nights in the Forest",
    universeNames: ["99 Nights in the Forest"],
    collections: [
      "classes",
      "crafting",
      "entities",
      "locations",
      "weapons",
      "tools",
      "food",
      "materials",
      "tameable-animals"
    ]
  },
  {
    gameSlug: "murderers-vs-sheriffs",
    gameName: "Murderers VS Sheriffs",
    universeId: 7219654364,
    dataDir: "Murderers VS Sheriffs",
    universeNames: ["[DUELS] Murderers VS Sheriffs", "[🏖️DUELS] Murderers VS Sheriffs", "Murderers VS Sheriffs"],
    collections: ["weapons", "crates", "modes", "death-effects", "bundles"]
  },
  {
    gameSlug: "dress-to-impress",
    gameName: "Dress To Impress",
    universeId: 5203828273,
    dataDir: "Dress To Impress",
    universeNames: ["Dress To Impress", "Dress To Impress⭐", "Dress to Impress"],
    collections: [
      "themes",
      "free-items",
      "pose-packs",
      "currency-items",
      "code-items",
      "ranks",
      "walk-packs",
      "runway-effects",
      "pattern-packs",
      "hairstyles",
      "makeup",
      "nails",
      "reward-items",
      "robux-items",
      "vip-items"
    ]
  },
  {
    gameSlug: "1-speed-keyboard-escape",
    gameName: "+1 Speed Keyboard Escape",
    universeId: 9584852943,
    dataDir: "+1 Speed Keyboard Escape",
    universeNames: ["+1 Speed Keyboard Escape", "+1 Speed Keyboard Escape | Candy & Chocolate"],
    collections: ["trails", "auras", "stages", "treadmills"]
  }
];

const COLLECTION_LABEL_OVERRIDES: Record<string, string> = {
  "accessory-shop": "Accessory Shop Items",
  "aura-stages": "Aura Stages",
  "aura-visuals": "Aura Visuals",
  crafting: "Crafting Recipes",
  "crafting-recipes": "Crafting Recipes",
  "code-items": "Code Items",
  "currency-items": "Currency Items",
  "death-effects": "Death Effects",
  "fighting-styles": "Fighting Styles",
  "fuse-machine": "Fuse Machine Results",
  "free-items": "Free Items",
  gamepasses: "Gamepasses",
  haki: "Haki",
  "house-surfaces": "House Surfaces",
  "instinct-levels": "Instinct Levels",
  "index-rewards": "Index Rewards",
  "inventory-items": "Inventory Items",
  "lucky-blocks": "Lucky Blocks",
  "map-themes": "Map Themes",
  makeup: "Makeup",
  "melee-specs": "Melee Specs",
  npcs: "NPCs",
  nails: "Nails",
  "pet-ages": "Pet Ages",
  "power-fruits": "Power Fruits",
  "pattern-packs": "Pattern Packs",
  "pose-packs": "Pose Packs",
  "roleplay-outfits": "Roleplay Outfits",
  "reward-items": "Reward Items",
  "robux-items": "Robux Items",
  "runway-effects": "Runway Effects",
  "sea-events": "Sea Events",
  "special-titles": "Special Titles",
  "star-rewards": "Star Rewards",
  "tameable-animals": "Tameable Animals",
  "title-colors": "Title Colors",
  ugc: "UGC Items",
  "vip-items": "VIP Items",
  "walk-packs": "Walk Packs",
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
  brooms: "prices, locations, travel stats, availability, and movement value",
  bundles: "pack prices, confirmed contents, source proof, availability, and related collections",
  charms: "rarity, source route, availability, weapon scope, and cosmetic collection context",
  characters: "character access, HP, base moves, awakenings, domains, and role notes",
  domains: "domain triggers, durations, combat effects, counterplay, clash rules, and access notes",
  cosmetics: "victory flash and taunt unlock routes, costs, availability, equip context, and audio-only use",
  chests: "route order, landmarks, location hints, reward notes, and travel tips",
  clans: "clan effects, bonuses, rarity, requirements, and obtainment",
  classes: "class costs, starter tools, run roles, perks, level requirements, and solo or team unlock value",
  crafting: "crafting stations, bench tiers, recipe costs, effects, limits, unlock requirements, and availability",
  "crafting-recipes": "crafted results, recipe areas, result odds, required slimes, and crafting progression",
  crates: "box prices, purchase routes, availability, reward-pool notes, odds status, and unlock value",
  "code-items": "Code Collection item names, source routes, obtainability, sets, item types, toggles, colors, and images",
  "currency-items": "Cash and seasonal currency prices, source routes, availability, item types, and replacement difficulty",
  "death-effects": "kill effect names, prices, unlock routes, bundle families, availability, and source proof",
  dungeons: "entry rules, wave structure, rewards, difficulty, and dungeon purpose",
  eggs: "price, rarity chances, availability, events, and obtainment",
  emotes: "emote sources, rarity, key prices, availability, and cosmetic use",
  enchantments: "roll stats, tier values, Enchanted Stone costs, build roles, and wand upgrade value",
  enemies: "enemy levels, seas, locations, notes, and progression value",
  "fighting-styles": "price, requirements, obtainment, upgrading, and combat role",
  "fuse-machine": "possible fuse results, rarities, income values, and max chances",
  food: "food names, prices, effects, uses, availability, and event notes",
  finishers: "rarity, source route, availability, and cosmetic kill-effect notes",
  "free-items": "standard Dressing Room item types, toggles, colors, body compatibility, images, and non-VIP outfit-building use",
  fruits: "rarity, type, price, Robux cost, obtainment, upgrading, and ability value",
  furniture: "furniture names, categories, prices, and home customization use",
  gear: "defensive structures, automated damage, traps, healing support, source classes, and placement value",
  gamepasses: "costs, unlocks, benefits, availability, and purchase value",
  gamemodes: "access, objectives, teams, lives, maps, rewards, progression impact, and special rules",
  gears: "cost, rebirth requirements, cooldowns, effects, and practical use",
  "gift-prizes": "gift prize names, rarity, categories, images, and listed item fields",
  gifts: "gift prices, rarity chances, availability, and reward context",
  guilds: "guild effects, requirements, bonuses, and progression role",
  haki: "Haki types, unlock routes, levels, effects, and combat use",
  "house-surfaces": "wall and floor surfaces, prices, categories, and home design options",
  houses: "house names, categories, costs, requirements, images, and unlock notes",
  "instinct-levels": "Instinct level progression, experience, dodges, and buffs",
  "index-rewards": "index milestones, required slime counts, reward bundles, and permanent boosts",
  "inventory-items": "tools, roleplay items, categories, descriptions, and images",
  islands: "level ranges, seas, bosses, costs, and travel progression",
  items: "source routes, prices, effects, damage or healing, use limits, storage rules, and availability",
  jobs: "job names, categories, buildings, images, and roleplay use",
  locations: "areas, structures, access notes, risks, loot, entities, and route value",
  "lucky-blocks": "cost, rarity, status, contents, appearance, and reward context",
  machines: "machine names, how to use them, what they do, and whether they are in game",
  maps: "availability, difficulty, supported modes, ranked pool, creators, and feature notes",
  materials: "sources, drops, farming routes, crafting or trade uses, requirements, availability, and risk",
  "map-themes": "theme names, categories, requirements, costs, and map effects",
  makeup: "Salon makeup sections, preset or custom part type, requirements, source routes, variants, and images",
  "melee-specs": "melee specs, rarity, stats, abilities, drops, and acquisition",
  modes: "queue/team size, access requirements, practice goal, reward caveats, and party fit",
  mutations: "mutation categories, multipliers, visual changes, and availability",
  hairstyles: "salon tabs, unlock routes, toggles, images, source updates, and outfit-building use",
  nails: "Lana Salon nail shapes, unlock routes, status, toggles, customization notes, and images",
  npcs: "NPC names, roles, locations, descriptions, and related wiki details",
  "pet-ages": "pet age stages, tricks unlocked, and special tricks",
  pets: "rarity, cost, availability, source tables, images, and pet collection progress",
  "pattern-packs": "pattern pack sources, costs, pattern counts, availability, and styling use",
  potions: "price, effect, use, availability, and obtainment",
  "pose-packs": "pose pack prices, currencies, unlock routes, availability, duo notes, and runway presentation value",
  "power-fruits": "fruit spawn chances, powers, abilities, upgrade notes, and use restrictions",
  props: "prop categories, names, and catalog images for roleplay setup",
  quests: "quest givers, islands, levels, XP, money, objectives, and special rewards",
  races: "race names, rarity, effects, bonuses, requirements, and progression use",
  rarities: "rarity counts, income ranges, cost ranges, spawn chance, and descriptions",
  rebirths: "rebirth levels, cash requirements, required brainrots, multipliers, and unlocks",
  relics: "relic effects, bonuses, rarity, requirements, and obtainment",
  "reward-items": "reward item sources, unlock routes, availability, item types, and collection value",
  rituals: "ritual names, required formations, spawned brainrots, weather, and income results",
  "robux-items": "Robux Collection item sets, prices, availability, purchase routes, images, and rework notes",
  robes: "HP bonuses, Gold costs, shop source, rarity, and defensive upgrade value",
  "roleplay-outfits": "outfit names, buildings, categories, and roleplay images",
  "resource-nodes": "gathering sources, route safety, material rewards, repeat notes, and farming use",
  runes: "rune rarity, effects, stats, requirements, drops, and use",
  "runway-effects": "runway effect names, prices, currencies, availability, visual behavior, and use context",
  secrets: "secret names, summaries, steps, and images where listed",
  "sea-events": "event names, images, descriptions, and sea-event context",
  skins: "weapon targets, rarity, source routes, availability, and cosmetic effects",
  "special-titles": "special title names and exact obtainment requirements",
  "star-rewards": "star costs, reward types, rarity, and reward images",
  strollers: "stroller names, prices, rarity, availability, and event notes",
  swords: "rarity, type, price, requirements, obtainment, upgrading, and combat role",
  "title-colors": "title color names and obtainment requirements",
  titles: "title numbers, title text, obtainment, and unlock requirements",
  themes: "theme names, plain meanings, outfit directions, style categories, difficulty, and availability notes",
  tools: "tool category, capacity or stat, source route, upgrade route, requirements, availability, and best use",
  "tameable-animals": "flute tier, taming stages, total food, per-stage food, spawn areas, behavior, risks, and companion role",
  auras: "aura names, costs, source, availability, effects, and upgrade context",
  stages: "world order, stage routes, requirements, hazards, rewards, teleport costs, and farming value",
  treadmills: "trainer access, rates, costs, availability, and passive Speed farming value",
  toys: "toy names, rarity, prices, effects, availability, and event notes",
  trails: "trail names, costs, source, availability, effects, and equip context",
  traits: "trait categories, multipliers, visuals, obtainment, and notes",
  ugc: "official Roblox avatar item IDs, prices, creator source, and RIVALS reward progress",
  vehicles: "vehicle names, categories, costs, seats, requirements, and availability",
  "vip-items": "VIP Dressing Room item types, locations, toggles, images, and outfit-building use",
  wands: "cost, Attack, Attack Bonus, special bonuses, source locations, and upgrade value",
  weapons: "weapon type, damage or effect, source route, ammo or use limits, requirements, availability, and combat role",
  weights: "rarity, kick power, cost, progression stage, and weight upgrade value",
  "walk-packs": "walk pack prices, currencies, unlock routes, availability, idle or walk style, and presentation value",
  wraps: "rarity, source route, weapon scope, availability, and animated or special cosmetic notes",
  "wizard-hats": "HP bonuses, Gold costs, lava resistance, source locations, and defensive gear value",
  zones: "zone order, rarity, kick power bands, reward bands, mutation notes, and return-risk context"
};

const FIELD_LABELS: Record<string, string> = {
  abilities: "abilities",
  accessRespawn: "access / respawn",
  accessRequirement: "access requirement",
  accessSpawn: "access / spawn",
  accessTravel: "access / travel",
  acquisition: "acquisition",
  area: "area",
  arenaType: "arena type",
  armsVisual: "arms visual",
  abilityCount: "ability count",
  abilityOne: "Ability 1",
  abilityTwo: "Ability 2",
  ammoOrUses: "ammo / uses",
  appliesTo: "applies to",
  attack: "Attack",
  attackBonus: "Attack Bonus",
  available: "availability",
  availability: "availability",
  availabilityNote: "availability note",
  baseDamage: "base damage",
  baseDodges: "base dodges",
  baseMoves: "base moves",
  baseEffect: "base effect",
  baseFruit: "base fruit",
  benefits: "benefits",
  benefit: "benefit",
  bestAction: "best action",
  bestFor: "best for",
  biome: "biome",
  biomeGroup: "biome group",
  bodyBase: "body / base",
  bodyFit: "body fit",
  bodyCoverage: "body coverage",
  bonus: "bonus",
  bonusEffect: "bonus / effect",
  bonusSummary: "bonuses",
  bonusType: "bonus type",
  buff: "buff",
  bossCheckpoint: "boss checkpoint",
  bossStage: "boss stage",
  bosses: "bosses",
  buildRole: "build role",
  building: "building",
  builderUse: "builder use",
  bundleFamily: "bundle family",
  cashBonus: "cash bonus",
  catalogSection: "section",
  capacityOrStat: "capacity / stat",
  category: "category",
  chance: "chance",
  chances: "chances",
  character: "character",
  clashInvasionRule: "clash / invasion rule",
  combat: "combat",
  combatLevel: "level",
  combatRole: "role",
  compatibleRace: "compatible race",
  classRestriction: "class restriction",
  colorOptions: "color options",
  confidence: "confidence",
  contents: "contents",
  counterplay: "counterplay",
  cooldown: "cooldown",
  cooldownReduction: "cooldown reduction",
  cost: "cost",
  costOrDrop: "cost / drop",
  costBucks: "Bucks cost",
  costObtainment: "cost / obtainment",
  costStars: "Star cost",
  costSummary: "cost",
  contractNote: "contract note",
  coreBonus: "core bonus",
  crateChance: "crate chance",
  creatorName: "creator",
  craftCost: "craft cost",
  craftingUses: "crafting / use",
  craftingStage: "crafting stage",
  craftingRequirement: "crafting requirement",
  cookMethod: "cook method",
  currency: "currency",
  damage: "damage",
  dateAdded: "date added",
  demand: "demand",
  damageHeal: "damage / heal",
  damageMultiplier: "damage multiplier",
  damageReduction: "damage reduction",
  danger: "danger",
  dangerLevel: "danger level",
  description: "description",
  defenseMultiplier: "defense multiplier",
  defaultState: "default / free",
  defaultOrRange: "default / range",
  difficulty: "difficulty",
  detailType: "detail type",
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
  displayBehavior: "display behavior",
  dodges: "dodges",
  domain: "domain",
  domainType: "Domain type",
  dps: "DPS",
  dropChance: "drop chance",
  dropChances: "drop chances",
  dropCount: "drop count",
  dropNote: "drop note",
  dropOrCost: "drop / cost",
  dropOrPity: "drop / pity",
  dropSource: "drop source",
  drops: "drops",
  dropsRewards: "drops / rewards",
  dropSummary: "drop summary",
  duration: "duration",
  effect: "effect",
  effectType: "effect type",
  enemyHealth: "enemy health",
  encounter: "encounter",
  encounterType: "encounter type",
  enemyType: "enemy type",
  entryItem: "entry item",
  extraUnlock: "extra unlock",
  exp: "EXP",
  expNeeded: "EXP needed",
  expRange: "EXP range",
  expReward: "EXP reward",
  equipUseNote: "equip / use note",
  equipUseContext: "equip / use",
  family: "family",
  featureNote: "feature note",
  farmRole: "farm role",
  farmRoute: "farm route",
  farmingTip: "farming tip",
  fluteLevel: "flute level",
  food: "food",
  foodPerStage: "food per stage",
  fields: "listed fields",
  formatTime: "format",
  grantRoute: "grant route",
  function: "function",
  hasV4: "V4 status",
  hazards: "hazards",
  killInteractiveBehavior: "kill / interactive behavior",
  holdStyle: "hold style",
  howToReach: "how to reach",
  howToUse: "how to use",
  health: "Health",
  hostility: "hostility",
  hp: "HP",
  hpBonus: "HP Bonus",
  holderTarget: "holder / target",
  hairArea: "hair area",
  hiddenLocationNote: "hidden / location note",
  image: "image",
  imageMissingReason: "image missing reason",
  income: "income",
  baseIncome: "base income",
  incomeMultiplier: "income multiplier",
  incomeType: "income type",
  ingredientOddsText: "ingredient odds",
  importantRule: "important rule",
  inputs: "inputs",
  islandArea: "island / area",
  islandRegion: "island / region",
  itemSpawns: "item spawns",
  itemsPageOverlap: "items page overlap",
  itemCountInSet: "items in set",
  availableIn: "available in",
  itemTypes: "item types",
  itemType: "type",
  keyNpcs: "key NPCs",
  keyContent: "key content",
  keepPriority: "keep or reroll",
  keyUse: "key use",
  kitSummary: "kit",
  kickPowerBand: "kick power band",
  laneNotes: "lane notes",
  landmark: "landmark",
  level: "level",
  level1: "Level 1",
  level2: "Level 2",
  level2Requirement: "Level 2 requirement",
  level3: "Level 3",
  level3Requirement: "Level 3 requirement",
  lavaResistance: "lava resistance",
  levelRange: "level range",
  levelRequirement: "level requirement",
  levelingRoute: "leveling route",
  location: "location",
  locationHint: "location hint",
  locationType: "location type",
  keyPrice: "Key price",
  mapPool: "map pool",
  legsVisual: "legs visual",
  luckMultiplier: "luck multiplier",
  machineUnlocks: "machine unlocks",
  mainLimit: "limit",
  mainNpcs: "main NPCs / bosses",
  mainReward: "main reward",
  mainRole: "main role",
  mainStrength: "strength",
  mainRewards: "main rewards",
  materialRole: "material role",
  magicPower: "Magic Power",
  maxAcceleration: "max acceleration",
  maxBonus: "max bonus",
  maxChance: "max chance",
  maxEffect: "max effect",
  maxLevel: "max level",
  maxValue: "max value",
  maxPlayers: "max players",
  masteryGate: "mastery gate",
  masteryRequired: "mastery required",
  levelMasteryRequirement: "level / mastery requirement",
  landmarks: "landmarks",
  membershipBasis: "membership basis",
  money: "money cost",
  moneyPrice: "money price",
  moneyReward: "money reward",
  minMagic: "Min Magic",
  modeOrCharacter: "mode / character",
  modeServerLimitation: "server limit",
  modeAccess: "mode access",
  modeGroup: "mode group",
  modeExclusiveNote: "mode-exclusive note",
  motion: "motion",
  multiplier: "multiplier",
  mutationType: "mutation type",
  nextRoll: "next roll",
  normalPlayerRoute: "normal-player route",
  notableDrops: "notable drops",
  notableLoot: "notable loot",
  nodeType: "node type",
  notes: "notes",
  npcRole: "role",
  obtainedFrom: "obtained from",
  objective: "objective",
  obtainment: "obtainment",
  obtainmentNote: "obtainment note",
  obtainability: "obtainability",
  outfitDirection: "outfit direction",
  overview: "overview",
  outputs: "outputs",
  partRoute: "part route",
  partType: "part type",
  partnerType: "partner type",
  partyFriendSupport: "party / friend support",
  passive: "passive",
  power: "Power",
  purpose: "purpose",
  price: "price",
  priceCoins: "coin price",
  priceGold: "gold price",
  privateServerNote: "private-server note",
  permanentPrice: "permanent price",
  placementNote: "placement note",
  plainMeaning: "plain meaning",
  progressionRole: "progression role",
  progressionImpact: "progression impact",
  progressionNote: "progression note",
  progressionUse: "route use",
  priceOrRoute: "price / route",
  priceRobux: "Robux price",
  purchaseRoute: "purchase route",
  rebirthNumber: "rebirth",
  rebirthRange: "rebirth range",
  questGiverName: "quest giver",
  queuePlace: "queue / place",
  questSource: "quest / source",
  rarity: "rarity",
  rarityOrValue: "rarity / value",
  requirement: "requirement",
  requiredSlimeOne: "required slime 1",
  requiredSlimeTwo: "required slime 2",
  requiredSlimeThree: "required slime 3",
  requiredSummary: "required slimes",
  difficultyStage: "difficulty stage",
  requiredBrainrots: "required brainrots",
  requiredCash: "required cash",
  requiredSetup: "required setup",
  requiredFor: "required for",
  requirements: "requirements",
  requirementMastery: "requirement / mastery",
  relatedRoute: "related route",
  relatedCatalogs: "related catalogs",
  relatedMoves: "related moves",
  relatedNodes: "related nodes",
  relatedWeapon: "related weapon",
  relatedSystem: "related system",
  relatedTarget: "related target",
  recommendedShard: "recommended shard",
  respawnAccess: "access / respawn",
  respawnOrRepeatNote: "respawn / repeat note",
  rewardCategory: "reward type",
  rewardFocus: "Reward Focus",
  reward: "reward",
  rewardNotes: "reward notes",
  rewardOne: "Reward 1",
  rewardTwo: "Reward 2",
  rewardThree: "Reward 3",
  rewardSummary: "rewards",
  rewardPool: "reward pool",
  robloxId: "Roblox ID",
  robloxUrl: "Roblox URL",
  robux: "Robux cost",
  role: "role",
  routeNote: "route note",
  routeOrder: "route order",
  routeRole: "route role",
  routeTip: "route tip",
  routeUse: "route / use",
  rollChance: "roll chance",
  rollRoute: "reroll route",
  rollRarity: "roll rarity",
  resultChance: "result odds",
  resultRarity: "result rarity",
  restrictions: "restrictions",
  rankedPool: "ranked pool",
  rule: "rule",
  rerollStatus: "reroll status",
  rateOrReload: "rate / reload",
  reworkNote: "rework note",
  reworkOrAliasNote: "rework / alias note",
  runType: "run type",
  saleState: "sale state",
  sea: "sea",
  seaStage: "sea / stage",
  seaEventRole: "sea-event role",
  seats: "seats",
  settings: "settings",
  set: "set",
  setOrFamily: "set / family",
  setPrice: "set price",
  signatureMove: "signature move",
  slot: "slot",
  sellPrice: "sell price",
  source: "source",
  sourceClass: "source class",
  sourceConfidence: "source confidence",
  sourceUpdate: "source update",
  elementEffect: "element effect",
  elementSynergy: "element synergy",
  farmingStage: "farming stage",
  sourceLocation: "source location",
  sourceImage: "source image",
  sourceNote: "source note",
  station: "station",
  sourcePity: "source / pity",
  sourceRoute: "source",
  sourceDetail: "source detail",
  sourceStatus: "source status",
  sourceTeacher: "teacher",
  sourceType: "source type",
  sourceWeapon: "source weapon",
  sourceAccess: "source / access",
  spawnAccess: "spawn / access",
  spawnBehavior: "spawn behavior",
  spawnCondition: "spawn condition",
  spawnNotes: "spawn notes",
  special: "special reward",
  specialBonus: "special bonus",
  specialEffects: "special effects",
  specialNote: "special note",
  specialInteractions: "special interactions",
  specialRules: "special rules",
  specialUse: "special use",
  spellRole: "spell role",
  spawnRequirement: "spawn requirement",
  spawnChance: "spawn chance",
  slimesNeeded: "slimes needed",
  spinChance: "spin chance",
  status: "status",
  statusSection: "status",
  stats: "stats",
  statPriority: "stat priority",
  starterTools: "starter tools",
  storageDropDespawn: "storage / drop / despawn",
  stageCount: "taming stages",
  survivalNote: "survival note",
  supportedModesSummary: "supported modes",
  sustainDefense: "sustain / defense",
  teamSize: "team size",
  tier: "tier",
  titleCountNeeded: "title count needed",
  titleType: "title type",
  titleReward: "title reward",
  titleRole: "title role",
  toggleCount: "toggle count",
  emoteReward: "emote reward",
  usedFor: "used for",
  playersTeams: "players / teams",
  totalFood: "total food",
  travelTip: "travel tip",
  tameable: "tameable",
  tamingRequirement: "taming requirement",
  earningsBand: "earnings band",
  mutationChance: "mutation chance",
  totalZoneLuck: "total zone luck",
  goopPerKill: "Goop per kill",
  goopRequired: "Goop required",
  tradeNote: "trade note",
  trend: "trend",
  trigger: "trigger",
  triggerBehavior: "trigger behavior",
  type: "type",
  unlock: "unlock",
  unlockPriority: "unlock priority",
  unlockNote: "unlock note",
  unlockRoute: "unlock route",
  unlockRequirement: "unlock requirement",
  unlockStage: "unlock stage",
  winCondition: "win condition",
  whoCanUse: "who can use",
  wearableBy: "wearable by",
  upgradeRoute: "upgrade route",
  use: "use",
  useNote: "use note",
  usesBreakRule: "uses / break rule",
  usageTips: "usage tips",
  utilityBonus: "utility bonus",
  verificationNote: "verification note",
  soloTeamNote: "solo / team note",
  awakeningCost: "awakening cost",
  updateContext: "update context",
  updateSourceNote: "update / source note",
  usefulColorsItems: "colors / items",
  auraExpNeeded: "Aura EXP needed",
  combatTravelRole: "combat / travel role",
  v4Title: "V4 title",
  v4Trial: "V4 trial",
  value: "value",
  valueStatus: "value status",
  valueType: "value type",
  variantHandling: "variant handling",
  visualRole: "visual role",
  visualStage: "visual stage",
  versionAdded: "version added",
  versionFinished: "version finished",
  whatItDoes: "what it does",
  whatTheyDo: "what they do",
  walkspeed: "walk speed",
  weapon: "weapon",
  weaponBonus: "weapon bonus",
  weaponScope: "weapon scope",
  weaponSubtype: "weapon subtype",
  weaponType: "weapon type",
  wikiSourceStatus: "wiki source status",
  statEffect: "stat effect",
  stoneRoute: "stone route",
  teacherSource: "teacher / source",
  tierFive: "Tier V",
  tierOne: "Tier I",
  tierThree: "Tier III",
  upgradePath: "upgrade path",
  upgradeNote: "upgrade note",
  upgradeUse: "upgrade / use note",
  variant: "Variant",
  xp: "XP",
  zoneName: "zone",
  zoneNumber: "zone",
  wikiUrl: "wiki page"
};

const OMITTED_FIELD_KEYS = new Set([
  "id",
  "slug",
  "name",
  "image",
  "imageStatus",
  "imageMissingReason",
  "imageSource",
  "sourceImageUrl",
  "sourceImage",
  "wikiUrl",
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
  const override = buildGameDatasetCatalogCopyOverride({
    config,
    itemCount,
    countLabel,
    imageUrls
  });
  if (override) return override;

  const lowerLabel = config.label.toLowerCase();
  const focus = getCollectionFocus(config.slug);
  const columnLabels = getUsefulColumnLabels(columns, 7);
  const fieldSummary = toReadableList(columnLabels.length ? columnLabels : ["names", "images", "details"]);
  const title = `All ${countLabel} ${config.label} in ${config.gameName}: What Should You Compare First?`;
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

function buildGameDatasetCatalogCopyOverride({
  config,
  itemCount,
  countLabel,
  imageUrls
}: Omit<GameDatasetCatalogCopyInput, "columns"> & { countLabel: string }): GameDatasetCatalogCopy | null {
  if (config.gameSlug === "slime-rng") {
    return buildSlimeRngCatalogCopyOverride({ config, itemCount, countLabel, imageUrls });
  }

  if (config.code === "wizard-alchemy-potions") {
    const title = `All ${countLabel} Potions in Wizard Alchemy`;

    return {
      code: config.code,
      title,
      seo_title: title,
      meta_description:
        "Wizard Alchemy potions list with Departure Isle and Sea of Oblivion spell thresholds, Power values, effects, sell prices, and refining tips.",
      intro_md:
        "Wizard Alchemy potions unlock the spells you use for fighting, farming, travel, defense, and damage buffs. Each brew starts with materials, and the total Magic value decides which potion results can appear in the alchemy table. The current list has 26 potions split between the Departure Isle spell ladder and the newer Sea of Oblivion potion set.",
      description_md:
        "## How brewing targets work\n\nPotions do not work like a normal shop purchase. Materials add Magic to the brew, and the total decides which potion results are allowed to appear. If Wind Blade needs 6 Magic, a 6-Magic brew can roll it. If the same brew climbs high enough to unlock another potion, the result pool changes because the alchemy table now has more possible outcomes.\n\nThat is why the best target is usually close to the potion you want. A small starter brew is fine for Wind Blade, Rock Blast, or Ice Spike. A stronger Departure Isle brew can chase Fire Arrow, Earth Shield, Frost Thorns, Radiant Sword, or Night Wraith. Sea of Oblivion raises the ceiling again with potions such as Thunder Revenge, Incendies, Molten Core, and Solar Flare.\n\n## How to brew toward a specific potion\n\n1. Pick the potion you actually want before adding rare materials.\n2. Add normal Magic Power materials until the total reaches that potion's minimum Magic value.\n3. Avoid pushing far into the next target unless you are fine with the higher potion joining the result pool.\n4. Add a matching shard only when the Magic total already qualifies for the spell route you are chasing.\n5. Finish the brewing minigame carefully because purity affects the final spell stats.\n\n## When to refine or sell duplicates\n\nRefinement gives duplicate potions a second purpose. Matching potions can be combined to raise a spell's grade, which improves power and range over time. Selling is still useful for gold, but rare or high-Magic duplicates are usually worth checking before you cash them out.\n\n| Situation | Better move | Why it helps |\n| --- | --- | --- |\n| Early duplicate starter spells | Sell or refine only if you still use the spell | Low-Magic potions are easier to replace. |\n| A spell you use for farming | Save copies for refinement | Better grade means stronger casts and range. |\n| Rare high-Magic potion | Check refinement before selling | Rebrewing it can cost better materials and shards. |\n| Utility or buff potion | Keep one usable copy | Movement, counter damage, or damage buffs can help outside raw Power checks. |\n\n## What changes in Sea of Oblivion\n\nThe Sea of Oblivion rows make old potion plans feel smaller. Solar Flare has the highest listed Magic and Power value, while Molten Core sits just below it with a heavy 230-Magic requirement. These targets are not early goals. Treat them as late New Mainland brews after your material farming can support much larger Magic totals.",
      how_it_works_md:
        "Each potion card shows the minimum Magic needed before that potion can roll, the listed Power when the spell has one, and the sell price in Gold. `Effect` explains rows that do not behave like plain Power attacks, such as Lithe, Ice Turtle, and Twin Currents. `Spell role` separates attacks from utility, defense, counter damage, and buffs, while shard and race fields only appear where a useful pairing is listed.",
      description_json: {
        "Departure Isle potions":
          "Departure Isle potions start with low-Magic attack spells like Wind Blade, Rock Blast, and Ice Spike, then climb into utility, defense, late attacks, and Night Wraith. This section is still useful after New Mainland because it covers the first spell route most players learn.",
        "Sea of Oblivion potions":
          "Sea of Oblivion potions are the New Mainland spell ladder. Wood Splinter starts at 30 Magic, while Molten Core and Solar Flare sit much higher and need stronger material totals before they can roll."
      },
      faq_json: [
        {
          q: "How do you get potions in Wizard Alchemy?",
          a: "Brew them at the alchemy table with materials. Add up to five materials, reach the Magic total for the potion you want, then finish the brewing minigame to create the potion."
        },
        {
          q: "What is the strongest potion in Wizard Alchemy?",
          a: "Solar Flare Potion has the highest listed values in the current list at 245 Magic and 160 Power. Night Wraith is still the strongest Departure Isle potion listed, with 148 Power."
        },
        {
          q: "Do shards guarantee the potion I want?",
          a: "No. Shards help push a brew toward a matching element, but the Magic total still has to qualify for the potion route first. Save shards for serious attempts instead of spending them on weak totals."
        },
        {
          q: "Should I sell duplicate potions?",
          a: "Only sell duplicates after checking whether you need them for refinement. Extra low-Magic spells are easier to replace, but high-Magic potions can be annoying to brew again."
        },
        {
          q: "Why do some potions show an effect instead of Power?",
          a: "Some potions are utility, counter, or buff spells. Lithe gives movement speed, Ice Turtle deals damage when enemies hit you, and Twin Currents increases damage by 30%."
        }
      ],
      cta_label: "Open potions catalog",
      cta_url: buildGameDatasetCatalogPath(config.code),
      wiki_md:
        "Potions are Wizard Alchemy's spell ladder. Materials decide which Magic thresholds you can reach, while refinement, shards, and New Mainland potion targets shape which spells are worth saving, upgrading, or selling.",
      wiki_sort_order: config.sortOrder,
      wiki_item_count: itemCount,
      thumb_url: "/Wizard%20Alchemy/Potions/wind-blade-potion.png"
    };
  }

  if (config.code === "wizard-alchemy-races") {
    const title = `All ${countLabel} Races in Wizard Alchemy`;

    return {
      code: config.code,
      title,
      seo_title: title,
      meta_description:
        "Wizard Alchemy races list with roll chances, rarity tiers, stat bonuses, passives, drawbacks, and reroll guidance.",
      intro_md:
        "Wizard Alchemy races are reroll traits that change your character's combat stats, movement, sustain, and elemental damage. Every player starts as Human, but Race Rerolls can replace it with a stronger option such as Death Eater, Stellar Ambassador, Ice Crystal, Fiendish Demon, or the 1% Legendary dark race.",
      description_md:
        "## How race rerolls fit progression\n\nRaces matter because they change what your character can survive, how fast you move, and how much damage a spell build can push. Human does nothing, so the first goal is simple: replace it with any useful combat or utility roll. After that, the better question is whether your current race helps the way you actually fight.\n\nA safe early roll is usually Werewolf because it gives HP, Attack Power, movement, and jump height without a major drawback. Death Eater is stronger when you are farming enemies quickly because its 5% Max HP heal triggers after kills. Undead can save you from a fatal hit, but the Max HP penalty means normal mistakes hurt more.\n\nEpic and Legendary races are where builds start to matter. Ice Crystal wants Ice spells, Fiendish Demon wants Fire spells, and Stellar Ambassador works across elements because Attack Power and Skill Speed are useful in almost every setup. The 1% dark race is the chase result because its dark damage bonus, Disaster status, Attack Power, and Skill Speed all point toward high damage.\n\n## How to decide when to stop rerolling\n\n1. Reroll Human first. No passive bonuses means it is only a starting point.\n2. Keep Werewolf if you are new and need a stable early upgrade.\n3. Keep Death Eater if you are farming normal enemies and can keep kill chains going.\n4. Keep Ice Crystal or Fiendish Demon when your spells match that element.\n5. Keep Stellar Ambassador for a general damage and speed setup that does not depend on one element.\n6. Stop immediately on the 1% Legendary dark race unless you are deliberately testing something unusual.\n\n## What to watch before spending more rerolls\n\nRace Rerolls are limited unless you are buying them, so chasing the perfect roll too early can waste a lot of value. A good race does not replace basic progression: stronger potions, better wands, clean parry timing, and enough HP still matter. If your current race helps you clear enemies consistently, it can be smarter to farm materials and upgrades before gambling for a tiny 1% chance.",
      how_it_works_md:
        "Races are grouped by rarity because rarity also shows the roll chance. `Roll chance` is the probability of landing that race from a reroll. `Core bonus` gives the main stat package, `Passive` explains special effects such as kill healing or Disaster, and `Main limit` shows the tradeoff that can make a race harder to use. `Element synergy` matters most for Ice Crystal, Fiendish Demon, and the Legendary dark race because their damage bonuses only shine when your spell setup matches the element.",
      description_json: {
        "Common races":
          "Human is the default starter result. It has no passive bonuses, so it should be replaced once you have Race Rerolls to spend.",
        "Uncommon races":
          "Tree Spirit and Elf are early utility rolls. Tree Spirit gives passive sustain with a movement penalty, while Elf helps movement and jumping without improving combat.",
        "Rare races":
          "Rare races are the first rolls worth thinking through. Werewolf is a safe early upgrade, Death Eater is better for kill-based farming, and Undead is a risky survival pick because its revive passive comes with a Max HP penalty.",
        "Epic races":
          "Epic races start shaping real builds. Ice Crystal and Fiendish Demon reward Ice or Fire spell setups, while Stellar Ambassador gives general Attack Power, Skill Speed, and movement burst value for any element.",
        "Legendary races":
          "Night Knight is the 1% Legendary dark-race entry, and some players may still recognize the same dark stat line as Thestrals. Its dark damage, Disaster status, Attack Power, mobility, and Skill Speed make it the clearest top roll."
      },
      faq_json: [
        {
          q: "How many races are in Wizard Alchemy?",
          a: "There are 10 race entries in the current list: Human, Tree Spirit, Elf, Werewolf, Death Eater, Undead, Ice Crystal, Fiendish Demon, Stellar Ambassador, and the 1% Legendary dark race listed here as Night Knight."
        },
        {
          q: "What is the best race in Wizard Alchemy?",
          a: "The 1% Legendary dark race is the strongest target because it stacks Dark Elemental Damage, Attack Power, Skill Speed, mobility, and the Disaster on-hit effect. Stellar Ambassador is the best all-around Epic roll, while Death Eater is a strong Rare choice for solo farming."
        },
        {
          q: "Should you reroll Human?",
          a: "Yes. Human has no passive bonuses, so any useful combat or movement race is an upgrade. Werewolf is a good early stopping point if you do not want to spend every reroll chasing Epic or Legendary odds."
        },
        {
          q: "Which race should you keep for Fire or Ice builds?",
          a: "Fiendish Demon is the Fire build race because it gives +20% Fire Elemental Damage. Ice Crystal is the Ice build race because it gives +20% Ice Elemental Damage and extra Max HP, though it also lowers movement speed."
        },
        {
          q: "How do you reroll races in Wizard Alchemy?",
          a: "Open the Race menu through the Stat page or through the Shop race reroll option, then spend Race Rerolls to roll a new race. Race Rerolls are mainly earned from active codes or bought from the in-game shop."
        },
        {
          q: "Why do some players say Thestrals instead of Night Knight?",
          a: "Some players may still use Thestrals for the 1% dark Legendary race. The important part is the dark stat package: Dark Elemental Damage, Attack Power, Skill Speed, mobility, and the Disaster on-hit effect."
        }
      ],
      cta_label: "Open races catalog",
      cta_url: buildGameDatasetCatalogPath(config.code),
      wiki_md:
        "Races are Wizard Alchemy's reroll traits. Human has no bonuses, early races help movement or sustain, Rare rolls start supporting combat, and Epic or Legendary rolls can shape Fire, Ice, Dark, farming, or all-around spell builds.",
      wiki_sort_order: config.sortOrder,
      wiki_item_count: itemCount,
      thumb_url: "/Wizard%20Alchemy/Races/night-knight.jpg"
    };
  }

  if (config.code === "wizard-alchemy-wands") {
    const title = `All ${countLabel} Wands in Wizard Alchemy`;

    return {
      code: config.code,
      title,
      seo_title: title,
      meta_description:
        "Wizard Alchemy wands list with starter, shop, hidden, and Sea of Oblivion weapons, costs, attack stats, bonuses, and locations.",
      intro_md:
        "Wands are the main weapon upgrade path in Wizard Alchemy. The starter wand gets you moving, shop wands raise early farming damage, hidden wands add stronger special stats, and the Sea of Oblivion wand gives late-game players another expensive bonus-stacking option. The useful comparison is cost, Attack, Attack Bonus, special bonus, and where the wand is actually found.",
      description_md:
        "## How wands change combat\n\nA wand is not the whole build, but it sets the damage floor for every fight. Potions give spells, races add bonuses, and ascension raises long-term power, but a weak wand still makes enemy farming and boss attempts drag. That is why the early goal is simple: replace the starter wand, then save for the next jump only when your gold route can support it.\n\nAttack is the base number on the wand. Attack Bonus adds a percent boost on top of that. Special bonuses change the feel of combat: Cooldown Reduction helps spell-heavy routes recast faster, while Crit Rate gives more burst when hits land well.\n\n## How to upgrade without wasting gold\n\n1. Replace Twisted Wand first. Wingbird is the cheap first step when 10 Attack starts feeling slow.\n2. Use Azure if you want a smoother early climb before the larger Demon Trident cost.\n3. Save for Demon Trident once normal enemy farming is steady. It is the clean mid-game value point because it jumps to 30 Attack and +15% Attack Bonus.\n4. Choose Ice Star or Ember Staff by playstyle. Ice Star is better when cooldown matters to your spell loop. Ember Staff is better when you want higher raw Attack and crit support.\n5. Treat Ember Wand as a Sea of Oblivion purchase. It costs more than the Departure Isle hidden wands, so judge it by its combined bonuses instead of its 30 Attack alone.\n\n## What the New Mainland wand changes\n\nEmber Wand makes the wand path less linear. Before it, the upgrade route mostly moves from cheap shop damage into expensive hidden damage. Ember Wand costs 50,000 Gold and trades lower raw Attack for stronger bonus stacking: +30% Attack Bonus, +30% Crit Rate, and +30 Cooldown Reduction.\n\nThat makes it a specialist late buy instead of a simple replacement for Ember Staff. If your current problem is basic damage, Ember Staff's 44 Attack is still the cleaner number. If your build cares about faster spell rhythm and crit-heavy farming, Ember Wand is worth reviewing once Sea of Oblivion routes are comfortable.",
      how_it_works_md:
        "`Cost` is the gold gate or starter status. `Attack` is the wand's base damage. `Attack Bonus` is the listed percent boost. `Special bonus` shows extra stats such as Cooldown Reduction or Crit Rate, which can change whether a wand fits spell spam, boss farming, or raw damage. `Source location` matters because some wands are normal shop buys, while others need a hidden waterfall, treehouse, or Sea of Oblivion route.",
      description_json: {
        "Starter wand":
          "Twisted Wand is the free baseline. It has enough damage to start the game, but it should be replaced once a cheap shop wand is affordable.",
        "Roger's shop wands":
          "Roger's shop covers the normal early upgrade route: Wingbird, Azure, then Demon Trident. Demon Trident is the biggest shop jump before hidden wand prices take over.",
        "Hidden Departure Isle wands":
          "Ice Star and Ember Staff are expensive hidden Departure Isle upgrades. Ice Star leans into cooldown reduction, while Ember Staff has the highest raw Attack among the listed wands.",
        "Sea of Oblivion wand":
          "Ember Wand belongs to the New Mainland route. Its raw Attack is lower than Ember Staff, but the stacked Attack Bonus, Crit Rate, and Cooldown Reduction make it a late Sea of Oblivion option."
      },
      faq_json: [
        {
          q: "How many wands are in Wizard Alchemy?",
          a: "There are 7 tracked wands when the starter Twisted Wand and the New Mainland Ember Wand are counted together."
        },
        {
          q: "What is the best wand in Wizard Alchemy?",
          a: "Ember Staff Wand has the highest listed raw Attack at 44 and adds +30% Crit Rate, so it is the cleanest raw damage pick. Ice Star Wand is better for cooldown-focused spell use, while Ember Wand is a late Sea of Oblivion option with stacked bonus stats."
        },
        {
          q: "Where do you get Ice Star Wand?",
          a: "Ice Star Wand is a hidden 20,000 Gold purchase inside the waterfall cave near the starting village."
        },
        {
          q: "Where do you get Ember Wand?",
          a: "Ember Wand is the 50,000 Gold Sea of Oblivion wand found on top of the Volcano."
        },
        {
          q: "Should you buy every wand upgrade?",
          a: "Not always. Replace Twisted early, then use Wingbird, Azure, or Demon Trident based on your gold. For expensive upgrades, choose the stat package that fits your build instead of buying only because the price is higher."
        }
      ],
      cta_label: "Open wands catalog",
      cta_url: buildGameDatasetCatalogPath(config.code),
      wiki_md:
        "Wands set the combat baseline in Wizard Alchemy. The route starts with Twisted Wand, moves through Roger's shop upgrades, branches into hidden Departure Isle picks like Ice Star and Ember Staff, then reaches the Sea of Oblivion Ember Wand for late bonus stacking.",
      wiki_sort_order: config.sortOrder,
      wiki_item_count: itemCount,
      thumb_url: "/Wizard%20Alchemy/Wands/ember-staff-wand.webp"
    };
  }

  if (config.code === "wizard-alchemy-brooms") {
    const title = `All ${countLabel} Brooms in Wizard Alchemy`;

    return {
      code: config.code,
      title,
      seo_title: title,
      meta_description:
        "Wizard Alchemy brooms list with prices, rarity, acceleration stats, max acceleration, and map locations for each travel broom.",
      intro_md:
        "Brooms are Wizard Alchemy's travel upgrade for moving across the map without chaining dash over and over. The current broom list is short, but the two choices have a real gap in price, rarity, acceleration, and where you buy them.",
      description_md:
        "## How to get and use a broom\n\nBrooms are bought from specific map spots with Coins. The Apprentice Broom is the early option under the portal at Departure Isle beach, while the Lava Broom is the expensive upgrade near Alchemy in the Sea of Oblivion.\n\n1. Go to the broom's listed location.\n2. Bring enough Coins for the listed price.\n3. Buy the broom and equip it from your hotbar.\n4. Hold forward to build speed, steer with your camera or movement controls, and point toward the ground when you want to land.\n5. Tap the hotbar slot again when you want to hop off.\n\n## How to choose between the two brooms\n\n| Broom | Best use | Why it matters |\n| --- | --- | --- |\n| Apprentice Broom | Early travel | It is much cheaper and appears on Departure Isle, so it is the practical first broom. |\n| Lava Broom | Faster long-distance travel | It costs far more, but its higher acceleration and max acceleration make it the better movement item once you can afford it. |\n\nThe Apprentice Broom is enough if you are still farming early Coins, materials, and starter enemies. The Lava Broom is the clear upgrade once Sea of Oblivion routes become part of your loop, especially when you are crossing more space between alchemy, enemies, materials, and chests.",
      how_it_works_md:
        "Broom stats are travel stats. `Price` tells you how much to save before checking the purchase spot. `Location` tells you where the broom is bought. `Acceleration` is how quickly the broom builds movement, while `Max Acceleration` is the higher movement ceiling listed for that broom. A bigger number means faster travel, but the cheaper broom can still be the right buy when you are early in the game.",
      description_json: {
        Brooms:
          "Wizard Alchemy currently has two listed brooms. Apprentice Broom is the cheap starter travel item, while Lava Broom is the stronger Sea of Oblivion upgrade with higher movement stats."
      },
      faq_json: [
        {
          q: "How many brooms are in Wizard Alchemy?",
          a: "There are 2 brooms currently listed: Apprentice Broom and Lava Broom."
        },
        {
          q: "What is the best broom in Wizard Alchemy?",
          a: "Lava Broom is the best broom by listed stats. It has 25 acceleration and 50 max acceleration, compared with Apprentice Broom's 10 acceleration and 35 max acceleration."
        },
        {
          q: "How do you get the Apprentice Broom?",
          a: "Buy the Apprentice Broom for 3K Coins under the portal at Departure Isle beach."
        },
        {
          q: "How do you get the Lava Broom?",
          a: "Buy the Lava Broom for 50K Coins to the right of Alchemy in the Sea of Oblivion."
        },
        {
          q: "Do brooms help with combat?",
          a: "Brooms are travel items. Their useful stats are movement stats, so they help you cross the map faster rather than improving wand damage, potion power, or enemy drops."
        }
      ],
      cta_label: "Open brooms catalog",
      cta_url: buildGameDatasetCatalogPath(config.code),
      wiki_md:
        "Brooms are Wizard Alchemy's travel items. Apprentice Broom gives players an early movement option on Departure Isle, while Lava Broom is the faster Sea of Oblivion upgrade once saving 50K Coins is realistic.",
      wiki_sort_order: config.sortOrder,
      wiki_item_count: itemCount,
      thumb_url: "/Wizard%20Alchemy/Brooms/lava-broom.png"
    };
  }

  if (config.code === "wizard-alchemy-robes") {
    const title = `All ${countLabel} Robes in Wizard Alchemy`;

    return {
      code: config.code,
      title,
      seo_title: title,
      meta_description:
        "Wizard Alchemy robes list with HP bonuses, Gold costs, rarity, Roger shop location, and upgrade-stage notes.",
      intro_md:
        "Robes are Wizard Alchemy's HP gear slot. They do not raise wand damage or potion strength; they give you a larger health pool while you farm stronger enemies, learn spell routes, and push boss attempts. The current robe list has Starmoon, Golden Reverie, and Starlight, with the two upper robes both listed at +60 HP.",
      description_md:
        "## How to buy and equip robes\n\nRobes come from Roger's equipment shop. Open the Wizard Robe section, compare the robe's Gold price with its HP bonus, then buy and equip the robe when survivability is blocking your next farming route.\n\n1. Go to Roger's shop near the equipment area.\n2. Open the Wizard Robe section.\n3. Check the in-game Gold price before spending, because current public price lists disagree.\n4. Buy the robe that fits your Gold route.\n5. Equip it before fighting enemies that can burst through your current health pool.\n\n## How to plan robe upgrades around HP\n\n| Robe | HP bonus | Best use |\n| --- | --- | --- |\n| Starmoon Robe | +30 HP | First defensive upgrade when starter health feels too thin. |\n| Golden Reverie Robe | +60 HP | Earlier +60 HP target if the shop price is affordable in your run. |\n| Starlight Robe | +60 HP | Late defensive target and the current S-tier robe listing. |\n\nA robe is worth buying when enemies are killing you before your spell loop finishes. If fights are safe but slow, spend on wand damage or potion progress first. HP without enough damage can make farming feel longer because you survive more hits but still take too long to clear the enemy.\n\n## Why the price caveat matters\n\nThe three robe names and HP bonuses are consistent across the current robe and equipment references, but the Gold costs are not. The listed card prices use the most detailed current robe table. If Roger's shop shows a different number in-game, treat the shop as the final price before saving around exact totals.",
      how_it_works_md:
        "`HP Bonus` is the flat health gain while the robe is worn. `Cost` is the listed Gold price, but exact costs should be checked in Roger's shop because current public price lists disagree. `Rarity` and `Tier` help scan the upgrade order; they do not add damage by themselves. The practical choice is whether you need +30 HP now or can save for a +60 HP robe.",
      description_json: {
        "Starter robe":
          "Starmoon Robe is the first defensive buy. Its +30 HP is the small survival bump to consider once starter damage is no longer your only problem.",
        "Early robe upgrade":
          "Golden Reverie Robe is the first +60 HP robe in the list. It is useful when enemy hits start ending runs before your potion or wand loop finishes.",
        "Late robe upgrade":
          "Starlight Robe is the top tier-list robe, but it shares the same listed +60 HP bonus as Golden Reverie. Treat it as a late defensive target rather than an automatic damage upgrade."
      },
      faq_json: [
        {
          q: "How many robes are in Wizard Alchemy?",
          a: "There are 3 tracked robes: Starmoon Robe, Golden Reverie Robe, and Starlight Robe."
        },
        {
          q: "Where do you buy robes in Wizard Alchemy?",
          a: "Robes are bought from Roger's shop in the Wizard Robe section."
        },
        {
          q: "What is the best robe in Wizard Alchemy?",
          a: "Starlight Robe is the current S-tier robe listing, but Golden Reverie Robe has the same listed +60 HP bonus. If you only care about HP, check the exact shop prices before choosing between the two."
        },
        {
          q: "Why do robe prices differ between Wizard Alchemy references?",
          a: "Current public robe lists agree on the three names and HP bonuses, but they disagree on Gold costs. The listed prices here follow the detailed robe table, so check Roger's shop in-game before saving around exact totals."
        },
        {
          q: "Should you buy a robe before upgrading your wand?",
          a: "Buy a robe when you are dying before a fight finishes. If enemies are safe but slow to clear, a wand or potion upgrade usually helps more than extra HP."
        }
      ],
      cta_label: "Open robes catalog",
      cta_url: buildGameDatasetCatalogPath(config.code),
      wiki_md:
        "Robes are Wizard Alchemy's HP gear slot. Starmoon gives the first +30 HP bump, while Golden Reverie and Starlight are +60 HP upgrades from Roger's Wizard Robe shop; exact Gold costs should be checked in-game because current price lists disagree.",
      wiki_sort_order: config.sortOrder,
      wiki_item_count: itemCount,
      thumb_url: "/Wizard%20Alchemy/Robes/starlight-robe.png"
    };
  }

  if (config.code === "wizard-alchemy-wizard-hats") {
    const title = `All ${countLabel} Wizard Hats in Wizard Alchemy`;

    return {
      code: config.code,
      title,
      seo_title: title,
      meta_description:
        "Wizard Alchemy wizard hats list with Roger shop hats, Lava Wizard Hat, Gold costs, HP bonuses, lava resistance, and locations.",
      intro_md:
        "Wizard hats are Wizard Alchemy's head-slot defensive gear. They add HP so you can survive harder enemy loops, and the Lava Wizard Hat adds lava resistance for Sea of Oblivion routes. The useful comparison is cost, HP, source location, and whether the hat is a normal Roger shop buy or a New Mainland pickup.",
      description_md:
        "## How hats fit into survival\n\nWizard hats are defensive upgrades, not damage upgrades. Extra HP gives you more room when enemies hit hard, but it does not make a weak wand, low-grade potion, or poor spell route clear fights faster. A good hat buy should solve a survival problem without delaying every damage upgrade you still need.\n\nStarmoon Hat is the early safety buy. Golden Reverie Hat is the clean 8K shop upgrade because its +40 HP value is consistent. Starlight Hat may match it, but read the in-game shop stat before spending 8K Gold if you are choosing between the two. Lava Wizard Hat is a different kind of goal because it adds lava resistance for Sea of Oblivion routes.\n\n## How to buy or find the next hat\n\n1. Visit Roger's Equipment Shop at spawn and open the Wizard Hat tab for Starmoon, Golden Reverie, and Starlight.\n2. Buy Starmoon when early enemies are forcing too many heals or respawns.\n3. Move to Golden Reverie or Starlight once 8K Gold is affordable without stalling your wand and potion route.\n4. Check Starlight's shop stat before buying if you need the exact HP number.\n5. Look for Lava Wizard Hat in Sea of Oblivion when lava resistance matters more than a normal shop upgrade.\n\n## How to compare defensive value\n\n| Situation | Better read | Why it matters |\n| --- | --- | --- |\n| Early farming feels risky | Starmoon Hat | It is much cheaper and still adds +20 HP. |\n| You need the safest 8K shop pick | Golden Reverie Hat | Its +40 HP listing is the most stable high-HP shop value. |\n| You want Starlight's look or stat line | Verify in Roger's shop | Its listed HP has appeared inconsistently, so confirm before spending. |\n| Sea of Oblivion lava routes matter | Lava Wizard Hat | It adds +40 HP and +100% lava resistance instead of only HP. |\n\nHP is most useful when it prevents a death that would interrupt farming or boss attempts. If fights are slow because your damage is low, upgrade your wand, brew stronger potions, or refine spells before putting every spare Gold into defensive gear.",
      how_it_works_md:
        "Hats are grouped by obtainment route because the player action changes. `Cost` shows the Gold price, `HP` shows the listed health bonus, and `Lava Resistance` only appears when the hat has that special Sea of Oblivion utility. `Source location` tells you where to buy or find the hat, while `Progression use` explains whether it is an early safety buy, an 8K shop upgrade, or a New Mainland utility pickup.",
      description_json: {
        "Roger's shop hats":
          "Roger's shop hats are the normal defensive route: Starmoon is the cheap early HP buy, while Golden Reverie and Starlight are the 8K Gold options. Check Starlight's in-game stat line before choosing it over Golden Reverie because its HP value has appeared inconsistently.",
        "Sea of Oblivion hat":
          "Lava Wizard Hat belongs to the Sea of Oblivion route instead of Roger's normal shop path. Its +40 HP is useful, but the extra +100% lava resistance is the reason it stands apart from the other hats."
      },
      faq_json: [
        {
          q: "How many wizard hats are in Wizard Alchemy?",
          a: "There are 4 tracked wizard hats: Starmoon Hat, Golden Reverie Hat, Starlight Hat, and Lava Wizard Hat. The first three are Roger shop hats, while Lava Wizard Hat belongs to the Sea of Oblivion route."
        },
        {
          q: "What is the best wizard hat in Wizard Alchemy?",
          a: "Golden Reverie Hat is the safest normal shop answer because it costs 8K Gold and is consistently listed at +40 HP. Lava Wizard Hat is better when you specifically need Sea of Oblivion lava resistance."
        },
        {
          q: "Is Starlight Hat better than Golden Reverie Hat?",
          a: "Treat Starlight Hat as an 8K Gold alternative, but check its in-game stat line before buying. If it shows +40 HP, it matches Golden Reverie by stat and cost. If it shows +20 HP, Golden Reverie is the stronger defensive buy."
        },
        {
          q: "Where do you get wizard hats?",
          a: "Starmoon, Golden Reverie, and Starlight are bought from Roger's Equipment Shop through the Wizard Hat tab. Lava Wizard Hat is listed as a Sea of Oblivion pickup behind the fiery Lava waterfall next to the base."
        },
        {
          q: "Should you buy a hat before upgrading your wand?",
          a: "Buy a hat when low HP is causing deaths, but do not let defense replace damage progression. If enemies take too long to kill, a stronger wand, better potion, or refined spell usually helps more than another HP item."
        }
      ],
      cta_label: "Open wizard hats catalog",
      cta_url: buildGameDatasetCatalogPath(config.code),
      wiki_md:
        "Wizard hats are Wizard Alchemy's head-slot survival gear. Starmoon, Golden Reverie, and Starlight cover the Roger shop HP route, while Lava Wizard Hat adds Sea of Oblivion lava resistance for players moving into New Mainland content.",
      wiki_sort_order: config.sortOrder,
      wiki_item_count: itemCount,
      thumb_url: "/Wizard%20Alchemy/Wizard%20Hats/lava-wizard-hat.webp"
    };
  }

  if (config.code === "wizard-alchemy-enemies") {
    const title = `All ${countLabel} Enemies in Wizard Alchemy`;

    return {
      code: config.code,
      title,
      seo_title: title,
      meta_description:
        "Wizard Alchemy enemies list with Departure Isle and Sea of Oblivion drops, farm roles, locations, and boss targets.",
      intro_md:
        "Enemies are the combat farming targets behind Wizard Alchemy's material loop. Dwarfs and goblins cover the first Departure Isle drops, mutants and Dwarf King carry the late first-island route, and Sea of Oblivion enemies add the New Mainland orc, priest, and Lava Behemoth material pools.",
      description_md:
        "## How enemies fit into farming\n\nEnemy farming fills the gap between safe gathering nodes and stronger potion attempts. Blueberries, mushrooms, nests, and chests can carry the first few brews, but higher Magic Power materials usually push you into combat. That is where enemy drops start to decide the route.\n\nDeparture Isle starts with simple family routes. Pickaxe Dwarf and Warhammer Dwarf cover dwarf materials such as Dwarf Emblem, Golden Tooth, and Flame Crest. Knife Goblin and Archer Goblin cover Goblin Finger, Goblin Bone, and the first Copper Earring chance. Mutant Warhammer Dwarf, Mutant Goblin Archer, and Dwarf King are the harder first-island targets when Furnace Core or Light/Dark Shards become the goal.\n\nSea of Oblivion continues the same idea with New Mainland drops. Sword Orc, Bow Orc, Axe Orc, Orc Priest, Mutant Axe Orc, Mutant Orc Priest, and Lava Behemoth are best read as material drop targets until a full spawn-route map exists.\n\n## How to choose the right enemy to farm\n\n1. Start from the missing material. Goblin Finger points to Knife Goblin or Archer Goblin, while Dwarf Emblem points to Pickaxe Dwarf or Warhammer Dwarf.\n2. Prefer fast kills before harder drops. A weaker enemy you can clear quickly often beats a stronger target that makes every run slow.\n3. Move to Archer Goblin, Warhammer Dwarf, or mutant enemies when Copper Earring, Flame Crest, Furnace Core, Light Shard, or Dark Shard becomes part of your potion plan.\n4. Add Dwarf King only when your wand damage, HP, movement, and potion setup make the fight consistent.\n5. Treat Sea of Oblivion enemies as New Mainland drop-pool targets until exact spawn landmarks are captured in game.\n\n## What to avoid when reading enemy drops\n\nDrop odds are only useful when the fight is repeatable for your build. A 43% material chance still feels bad if you die often or spend too long reaching the enemy. For most players, the cleaner route is to farm the easiest enemy that drops the missing material, brew stronger spells, upgrade gear, then move into mutants and bosses once the clear time feels steady.",
      how_it_works_md:
        "`Area` tells you the broad map stage. `Enemy type` separates normal enemies, elite enemies, and bosses. `Drops` lists the known drop pool and odds when a percentage is known. `Farm role` explains why a player would repeat that target, while `Difficulty stage` gives the practical progression point without inventing HP or damage values. Sea of Oblivion entries have less location detail, so read `Source location` as the current route hint rather than a full spawn map.",
      description_json: {
        "Departure Isle dwarfs":
          "Pickaxe Dwarf is the safer starter dwarf route for Dwarf Emblem and Golden Tooth. Warhammer Dwarf adds Flame Crest once normal fights feel stable.",
        "Departure Isle goblins":
          "Knife Goblin is the starter goblin farm for Goblin Finger and Goblin Bone. Archer Goblin matters later because it adds Copper Earring to the goblin route.",
        "Elite and boss enemies":
          "Mutant enemies and Dwarf King are the late Departure Isle targets for Furnace Core, Light Shard, Dark Shard, and high-value materials. Treat these as upgrade-check fights, not beginner loops.",
        "Sea of Oblivion enemies":
          "Sea of Oblivion enemies are New Mainland drop targets. Their drop pools are clear, but exact spawn landmarks and images still need a clean in-game capture pass."
      },
      faq_json: [
        {
          q: "How many enemies are in Wizard Alchemy?",
          a: "The current list tracks 14 enemies: 7 Departure Isle enemies with full monster details and 7 Sea of Oblivion enemies tied to New Mainland material drops."
        },
        {
          q: "Which enemy should beginners farm first?",
          a: "Knife Goblin and Pickaxe Dwarf are the cleanest first farming loop. They drop early materials, give Gold, and are easier to repeat before stronger wands and potions are ready."
        },
        {
          q: "Which enemies drop Furnace Core?",
          a: "Mutant Warhammer Dwarf, Mutant Goblin Archer, and Dwarf King drop Furnace Core on Departure Isle. Mutant enemies are usually the better volume route, while Dwarf King is the boss route."
        },
        {
          q: "Which enemies drop Light Shard and Dark Shard?",
          a: "Mutant Warhammer Dwarf and Mutant Goblin Archer drop Light Shard and Dark Shard. Save those shards for element planning instead of treating them like normal Magic Power materials."
        },
        {
          q: "Why do some Sea of Oblivion enemies have no image?",
          a: "The Sea of Oblivion enemies are confirmed through material drops, but clean monster portraits and exact spawn landmarks still need an in-game capture pass."
        }
      ],
      cta_label: "Open enemies catalog",
      cta_url: buildGameDatasetCatalogPath(config.code),
      wiki_md:
        "Enemies are the combat side of Wizard Alchemy's material grind. Dwarfs and goblins cover early Departure Isle farming, mutants and Dwarf King handle Furnace Core and shard routes, and Sea of Oblivion adds orc, priest, and Lava Behemoth material targets for New Mainland progression.",
      wiki_sort_order: config.sortOrder,
      wiki_item_count: itemCount,
      thumb_url: "/Wizard%20Alchemy/Enemies/dwarf-king.png"
    };
  }

  if (config.code === "wizard-alchemy-chests") {
    const title = `All ${countLabel} Chest Locations in Wizard Alchemy`;

    return {
      code: config.code,
      title,
      seo_title: title,
      meta_description:
        "Find all 10 Wizard Alchemy chest locations with route hints, landmarks, reward caveats, and New Mainland notes.",
      intro_md:
        "Chests are fixed Wizard Alchemy pickups that help with material farming before every enemy route feels fast. The current verified route has 10 first-island locations across spawn, the river path, the mine, the lighthouse route, Dwarf King's area, the treehouse, and a hidden goblin camp platform.",
      description_md:
        "## How chests fit into material farming\n\nChests are worth routing because they give a chance at useful resources without forcing a fight every few steps. They are especially helpful early, when Pickaxe Dwarfs, Warhammer Dwarfs, goblins, and Dwarf King routes can take longer than a quick pickup loop.\n\nThe listed rewards are broad rather than chest-specific. Chests can give materials, gold or money, emblems, crests, shards, rare materials, and higher-rarity resources, but exact reward tables by location are not clearly listed. Treat the locations as the reliable part and the reward pool as a general farming bonus.\n\n## How to run the full chest loop\n\n1. Start at spawn and grab the shoreline or Top Potions List island chest before leaving the platform area.\n2. Follow the river path to the first farming area and check the rocks near the tree.\n3. Sweep the Traveler camp and bridge route, then move into the mine cluster.\n4. Inside the mine, open the normal cave chest, walk through the illusion wall for the secret cave chest, then climb above the mine for the top chest.\n5. Move toward the beach route and group the lighthouse island, Dwarf King throne, and treehouse checks together.\n6. Check the hidden goblin camp platform if you skipped it while moving between spawn, bridge, and mine routes.\n\n| Route group | Why it helps |\n| --- | --- |\n| Starter-area chests | Fast pickups before combat or long travel starts. |\n| Forest and mine chests | The densest cluster, with one cave, one illusion wall, one climb, and one hidden platform route. |\n| Island and boss-route chests | Longer travel, but easy to combine once you are already near the lighthouse and Dwarf King side. |\n\n## What to check before opening\n\nWalk close to the chest and hold the interact key when the prompt appears. Keep inventory space open before opening, because the game may not hold extra materials for you. Chests are listed as fixed spawns with a one-hour respawn timer, so a missing chest may already have been opened on that server.\n\n## Why Sea of Oblivion is not listed yet\n\nWizard Alchemy now has New Mainland and Sea of Oblivion content, but the verified chest route still points to the 10 first-island locations. Keep the list to the first-island route until exact lava island or Sea of Oblivion spots are confirmed.",
      how_it_works_md:
        "`Route order` is a suggested sweep, not an official in-game number. `Landmark` and `location hint` are the fastest way to find each chest when location names vary. `How to reach` gives the practical movement route, while `difficulty stage` explains whether the stop is a starter pickup, hidden path, climb, island route, or boss-route landmark. Reward notes stay cautious because exact per-chest reward pools are not clearly listed.",
      description_json: {
        "Starter-area chests":
          "The first two stops sit around spawn and the early river route. They are the easiest pickups to grab before enemy farming starts.",
        "Forest and mine chests":
          "This section covers the Traveler camp, mine entrance, illusion wall, mine top, and goblin camp platform. Several are hidden, so landmarks matter more than just running forward.",
        "Island and boss-route chests":
          "These stops sit near the lighthouse, Dwarf King route, and treehouse. Group them together so the beach and high-tree routes are not repeated."
      },
      faq_json: [
        {
          q: "How many chests are in Wizard Alchemy?",
          a: "There are 10 currently verified chest locations in the first-island route. The list covers spawn, river, mine, lighthouse, Dwarf King, treehouse, and hidden platform spots."
        },
        {
          q: "How do you open chests in Wizard Alchemy?",
          a: "Walk up to a chest until the interact prompt appears, then hold the interact key. Make sure your inventory has space before opening so the materials are not wasted."
        },
        {
          q: "How often do Wizard Alchemy chests respawn?",
          a: "The current listed timer is one hour at fixed locations. If a chest is missing, it may have been opened recently on that server."
        },
        {
          q: "What rewards do chests give?",
          a: "Chests are material and resource pickups that can give gold or money, emblems, crests, shards, rare materials, and higher-rarity resources. Exact rewards by chest are not clearly listed."
        },
        {
          q: "Are there Sea of Oblivion chest locations?",
          a: "No separate Sea of Oblivion chest route is verified in this 10-location set yet. The New Mainland update exists, but the chest page should wait for exact Sea of Oblivion locations before adding that section."
        },
        {
          q: "Do you need a broom or movement race for the chest route?",
          a: "No. The verified route can be run on foot, but movement speed, jump height, or a broom makes the mine climb, treehouse path, and long beach route faster."
        }
      ],
      cta_label: "Open chests catalog",
      cta_url: buildGameDatasetCatalogPath(config.code),
      wiki_md:
        "Chests are fixed material pickups across Wizard Alchemy's first-island route. The tracked set covers 10 spawn, mine, lighthouse, boss-route, treehouse, and hidden-platform locations, with reward details kept cautious because exact chest-specific pools are not listed.",
      wiki_sort_order: config.sortOrder,
      wiki_item_count: itemCount,
      thumb_url: "/Wizard%20Alchemy/Chests/spawn-river-rocks.jpg"
    };
  }

  if (config.code === "wizard-alchemy-enchantments") {
    const title = `All ${countLabel} Enchantments in Wizard Alchemy`;

    return {
      code: config.code,
      title,
      seo_title: title,
      meta_description:
        "Compare all 10 Wizard Alchemy enchantments by stat, max tier value, build role, and Enchanted Stone roll route.",
      intro_md:
        "Enchantments are random wand upgrades in Wizard Alchemy. Each roll spends one Enchanted Stone and can give one of 10 enchantment types, with every type scaling from Tier I to Tier V. The useful comparison is the stat, the Tier V max value, and whether the roll fits damage, element damage, farming, movement, or cooldown-heavy play.",
      description_md:
        "## How enchanting works on a wand\n\nEnchanting starts after you have a wand worth improving. Go to the enchanting table on the small island near the main Sea of Oblivion area, equip your wand, hold `E`, and confirm the roll. One roll spends one Enchanted Stone.\n\nThe result is random. You do not choose the enchantment name or the tier, so it is better to farm several stones before chasing a perfect Tier V result. Keep a useful lower-tier roll if it supports your current build, then roll again when you can afford to gamble.\n\n## How to farm Enchanted Stones\n\nEnchanted Stones are the resource that slows the whole system down. Treat guaranteed and repeatable routes as the backbone, then use chance rewards and codes as bonus supply.\n\n- Harryint's lava golem quest is the predictable route because it rewards a stone after the boss quest is completed.\n- Enchanted Sword Ferns on the lava island are repeatable, but they have more HP than normal enemies, so weak builds farm them slowly.\n- Rare chests, mutant enemies such as Mutant Iron Axe Orc, and other quests can add stones while you are already moving through the map.\n- Code rewards can include stones, but codes change quickly. Redeem current codes when they are active instead of planning your whole enchantment route around them.\n\n## Which rolls are worth keeping\n\n| Goal | Rolls to value |\n| --- | --- |\n| Boss burst | Fatal for bigger crits, Critical Hit when more crit triggers matter. |\n| Element builds | Blazing Fire for Fire, Thunder for Thunder, Shadow for Dark, and Ice for Ice. |\n| Potion crafting and rare farming | Luck, especially at higher tiers. |\n| Travel and dodging | Swift when movement speed helps chest loops, stone farming, or boss positioning. |\n| Spell uptime | Staying Calm when cooldown pressure matters more than one-hit damage. |\n| General fallback damage | Magic, mainly when the build does not already have a better crit or element roll. |\n\nDo not judge a roll only by the number. A 20% Ice Damage Boost is better than a 10% Attack Boost if your main spells are Ice-based, while Luck can be the right keep even though it is not a direct boss-damage stat.",
      how_it_works_md:
        "`Stat` names the buff added to the wand. `Tier I`, `Tier III`, and `Tier V` show the main scaling checkpoints, and `Max value` is the Tier V cap. `Build role` and `Best for` translate the stat into a player decision, such as crit burst, element damage, movement, crafting, or cooldown uptime. `Stone route` stays the same for every enchantment because each one comes from a random Enchanted Stone roll at the Sea of Oblivion enchanting table.",
      description_json: {
        "Damage enchantments":
          "Fatal, Critical Hit, and Magic are the general combat rolls. Fatal and Critical Hit form the main crit pair, while Magic is the smaller all-purpose attack boost.",
        "Element damage enchantments":
          "Blazing Fire, Thunder, Shadow, and Ice are strongest when the rest of the build already leans into that element. Blazing Fire has the highest listed element cap at Tier V.",
        "Utility and farming enchantments":
          "Luck, Swift, and Staying Calm are keep-worthy for farming, travel, or spell uptime instead of direct burst. Luck and Staying Calm both reach 50% at Tier V."
      },
      faq_json: [
        {
          q: "How many enchantments are in Wizard Alchemy?",
          a: "There are 10 verified enchantment types: Luck, Swift, Fatal, Critical Hit, Blazing Fire, Thunder, Shadow, Ice, Magic, and Staying Calm."
        },
        {
          q: "Can you choose the enchantment you want?",
          a: "No. Each roll spends one Enchanted Stone and gives a random enchantment at a random tier. Farm extra stones before chasing a specific Tier V roll."
        },
        {
          q: "Where do you enchant a wand?",
          a: "Use the enchanting table on the small island near the main Sea of Oblivion area. Equip your wand, hold `E`, and confirm the roll."
        },
        {
          q: "Which enchantments are best for damage?",
          a: "Fatal and Critical Hit are the main crit pair. Blazing Fire, Thunder, Shadow, and Ice are better when your spell setup already focuses on that element."
        },
        {
          q: "How do you get Enchanted Stones?",
          a: "Farm Enchanted Sword Ferns, complete Harryint's lava golem quest, check rare chests, clear stone-dropping mutant enemies, finish quests, and redeem active codes when they include stones."
        },
        {
          q: "Does every enchantment have five tiers?",
          a: "Yes. Each enchantment scales from Tier I through Tier V. The card values focus on Tier I, Tier III, and Tier V so the starting, middle, and max checkpoints are easy to compare."
        }
      ],
      cta_label: "Open enchantments catalog",
      cta_url: buildGameDatasetCatalogPath(config.code),
      wiki_md:
        "Enchantments add random extra stats to Wizard Alchemy wands through Enchanted Stone rolls. The current set has 10 rolls covering crit damage, crit rate, element damage, attack boost, alchemy luck, movement speed, and cooldown-focused utility.",
      wiki_sort_order: config.sortOrder,
      wiki_item_count: itemCount,
      thumb_url: null
    };
  }

  if (config.code === "wizard-alchemy-locations") {
    const title = `All ${countLabel} Locations in Wizard Alchemy`;

    return {
      code: config.code,
      title,
      seo_title: title,
      meta_description:
        "Wizard Alchemy locations list with spawn services, chest routes, hidden shops, boss landmarks, and Sea of Oblivion stops.",
      intro_md:
        "Wizard Alchemy locations are the route anchors behind the whole upgrade loop. Spawn services handle brewing, selling, quests, and gear, while the forest, mine, beach, boss, and Sea of Oblivion routes decide where you farm materials, open chests, buy hidden items, enchant wands, and push into New Mainland upgrades.",
      description_md:
        "## How to move through the map without wasting runs\n\nLocations work best when you treat them as loops. Start at spawn, choose a goal, then move through the route that gives the material, quest, chest, shop, boss, or upgrade you actually need. Wandering without a target fills your bag with random materials and usually sends you back to Lombart or the Alchemy Table before you have brewed anything useful.\n\nA clean route usually looks like this:\n\n1. Start at Spawn Village to brew, refine, sell extras, take a quest, or buy gear from Roger.\n2. Move down the river path for early Pickaxe Dwarf, chest, and starter material routes.\n3. Treat Traveler camp as the split point for the mine cluster, bridge-side goblin platform, or beach route.\n4. Clear the mine cluster together: normal mine, secret wall cave, and mine mountain top.\n5. Push toward the beach side when you need lighthouse, Dwarf King, treehouse, or waterfall cave routes.\n6. Move into Sea of Oblivion only when New Mainland materials, enchanting, lava-island farming, broom upgrades, or late gear are the goal.\n\n## Which place to learn first by goal\n\n| Goal | Best location to learn | Why it helps |\n| --- | --- | --- |\n| Brew or refine spells | Alchemy Table and Refine Machine | Every material loop becomes useful only after you turn drops into potions or upgrades. |\n| Sell extras safely | Spawn Village and Leaderboard Shoreline | Lombart is the cleanup point when inventory pressure starts slowing your route. |\n| Start gold and material farming | First River Farming Path | It is close to spawn and teaches the early enemy spacing without a long run back. |\n| Run hidden chest routes | Mine Entrance, Secret Mine Cave, Mine Mountain Top | These three stops are close together and teach the cave, illusion wall, and climb pattern. |\n| Prepare for boss farming | Dwarf King Cave and Throne | The boss route is worth learning after your wand, HP gear, movement, and spells are stable. |\n| Chase hidden wand upgrades | Treehouse Branch, Waterfall Cave, Volcano Summit | These locations hold the stronger wand route once normal shop upgrades stop being enough. |\n| Roll wand enchantments | Enchanting Table Island | The table spends Enchanted Stones, so it matters after you can farm stones consistently. |\n\n## What not to over-assume from the map\n\nThe stable landmarks are the useful part: spawn services, chest clusters, hidden caves, boss routes, shops, and New Mainland upgrade stops. Some exact Sea of Oblivion enemy spawns and material node paths are better treated as broad routes, so read New Mainland rows as anchors rather than exact coordinates.\n\nThat caution matters most when farming. If you need a material, start from the location or enemy route tied to that drop, then adjust after you see how fast your build clears the area. A weaker route you can repeat cleanly often beats a late route that causes deaths, long resets, or wasted potion attempts.",
      how_it_works_md:
        "`Area` tells you the broad map region. `Location type` explains whether the place is a spawn service, shop, farm route, hidden route, boss route, island, or New Mainland stop. `Landmark` is the fastest navigation clue when exact directions vary. `Key NPCs` lists the NPC or boss tied to the place when one is known. `Key content` and `related farms` show why the location matters, while `travel tip` gives the practical route habit to use in-game.",
      description_json: {
        "Departure Isle spawn and services":
          "Spawn is the reset point for crafting, selling, quests, leaderboards, and early gear. Learn these stops first because most farming loops eventually send you back here.",
        "Forest, river, and mine routes":
          "These locations cover the first real material and chest loops. They also teach the hidden-route habits Wizard Alchemy uses later: check rocks, tents, caves, climbs, and off-path platforms.",
        "Beach, boss, and high routes":
          "This side of Departure Isle connects mid enemy farming, the lighthouse, Dwarf King, treehouse, and waterfall cave. It is where route planning starts to matter more than running straight from spawn.",
        "Sea of Oblivion routes":
          "Sea of Oblivion is the New Mainland layer for enchanting, lava-island farming, broom upgrades, the volcano wand route, and lava-resistance gear. These rows focus on stable landmarks instead of every enemy or material path."
      },
      faq_json: [
        {
          q: "How many locations are tracked in Wizard Alchemy?",
          a: "There are 20 tracked route and service landmarks in the current list. They cover spawn services, forest and mine routes, beach and boss landmarks, hidden upgrade spots, and Sea of Oblivion stops."
        },
        {
          q: "Which Wizard Alchemy locations should beginners learn first?",
          a: "Learn Spawn Village, the Alchemy Table, Roger's Equipment Shop, Harryint's Wanted Board, the First River Farming Path, Traveler Camp, and the Mine Entrance first. Those locations cover early quests, brewing, selling, gear, enemies, and chests."
        },
        {
          q: "Where is the Alchemy Table in Wizard Alchemy?",
          a: "The Alchemy Table is at the spawn area. Turn around from the spawn point to find it, then use gathered materials to brew potions. The Refine machine sits next to the Alchemy Table for upgrading duplicate potions."
        },
        {
          q: "Where is Dwarf King in Wizard Alchemy?",
          a: "Dwarf King is tied to the Dwarf King Cave route on Departure Isle. Start from the lighthouse side as a route anchor, then look for the mountain area with the hammer wall and chained stone landmark."
        },
        {
          q: "Where do you enchant wands in Wizard Alchemy?",
          a: "Wand enchanting happens at the Enchanting Table Island, a small island near the main Sea of Oblivion area. Bring Enchanted Stones before you roll because each enchantment attempt consumes one stone."
        },
        {
          q: "Are the Sea of Oblivion locations fully mapped?",
          a: "The Sea of Oblivion rows cover stable landmarks such as the main base, enchanting island, lava island, volcano, and lava waterfall. Treat them as route anchors rather than a full coordinate map for every enemy and material path."
        }
      ],
      cta_label: "Open locations catalog",
      cta_url: buildGameDatasetCatalogPath(config.code),
      wiki_md:
        "Locations are the route anchors for Wizard Alchemy progression. Spawn services handle brewing, selling, quests, and gear, while forest, mine, beach, boss, hidden-shop, and Sea of Oblivion landmarks shape the material, chest, enchantment, and New Mainland upgrade loops.",
      wiki_sort_order: config.sortOrder,
      wiki_item_count: itemCount,
      thumb_url: "/Wizard%20Alchemy/Locations/alchemy-table-refine-machine.jpg"
    };
  }

  if (config.code === "wizard-alchemy-npcs") {
    const title = `All ${countLabel} NPCs in Wizard Alchemy`;

    return {
      code: config.code,
      title,
      seo_title: title,
      meta_description:
        "Find Wizard Alchemy NPCs by role, area, location, related system, quests, shops, and useful map landmarks.",
      intro_md:
        "NPCs in Wizard Alchemy point you toward the game's important early systems: Roger handles equipment, Lombart clears materials, Harryint and Fugitive Orc give quest routes, and landmark NPCs such as Traveler, Optimistic Miner, and Lemin help you navigate chest and farming paths.",
      description_md:
        "## How NPCs fit into early routing\n\nWizard Alchemy puts several important NPCs around the starter island, and most of them are useful because they sit beside a system you already need. Roger is the equipment stop for wands, hats, and robes. Lombart is the material-selling NPC in the starter village. Harryint is the spawn-side quest NPC near the Wanted board, while Fugitive Orc is an easy forest quest target if you have berries.\n\nThe remaining named NPCs are still worth tracking because they act as map anchors. Optimistic Miner marks the mine entrance and explains chest rewards. Traveler marks the tent, Cauldron, bridge, and lighthouse route. Lemin marks the spawn leaderboard platform with Lombart and the sandy-island chest route.\n\n## How to route the useful NPCs\n\n1. Start around spawn and identify Roger, Lombart, Harryint, and the leaderboard platform.\n2. Use Harryint when you want repeatable quest Gold and materials before stronger farming routes feel comfortable.\n3. Sell unwanted materials to Lombart only after checking whether they are needed for a potion, quest, or later brew.\n4. Move from spawn toward the forest for Fugitive Orc if you are doing the berry quest or heading toward mutant-route landmarks.\n5. Use Optimistic Miner and Traveler as route anchors when running mine, tent, bridge, lighthouse, or chest paths.\n\n## What counts as an NPC here\n\nThe Alchemy table, Refine machine, Wanted board, Cauldron, chests, and enchanting table are interactables, not NPCs. They matter to progression, but they belong with interactable objects rather than character NPCs.",
      how_it_works_md:
        "`NPC role` tells you whether the character is a shop, quest giver, material seller, hint NPC, or landmark. `Location` is the shortest route clue, while `Related system` tells which part of progression the NPC connects to. `What they do` gives the direct function, and `Player use` explains the practical reason to find them during a normal route.",
      description_json: {
        "Spawn services":
          "Roger and Lombart are the two service NPCs around the starter village. Visit Roger for combat and HP gear, then use Lombart when extra materials are taking up inventory slots.",
        "Route and quest NPCs":
          "Harryint and Fugitive Orc are quest-oriented NPCs. Harryint sits near the Wanted board at spawn, while Fugitive Orc is an early forest side quest tied to berries.",
        "Landmark NPCs":
          "Traveler, Optimistic Miner, and Lemin are most useful as navigation anchors. Their names help locate the tent, mine entrance, leaderboard platform, and nearby chests."
      },
      faq_json: [
        {
          q: "How many NPCs are in Wizard Alchemy?",
          a: "This list tracks 7 named NPCs: Roger, Lombart, Harryint, Fugitive Orc, Lemin, Optimistic Miner, and Traveler."
        },
        {
          q: "Which NPC sells equipment in Wizard Alchemy?",
          a: "Roger is the equipment shop NPC. Visit Roger when you want to buy wands, wizard hats, or wizard robes with Gold."
        },
        {
          q: "What does Lombart do in Wizard Alchemy?",
          a: "Lombart is the material-selling NPC in the starter village. Use him when you want to sell unwanted materials instead of keeping every ingredient in your material bag."
        },
        {
          q: "Where is Harryint in Wizard Alchemy?",
          a: "Harryint is on the right side of the spawn location beside the Wanted board. He is the quest NPC tied to early quest rewards and the later lava golem boss quest route."
        },
        {
          q: "Is Traveler a shop NPC?",
          a: "Treat Traveler as a route landmark. Use Traveler's camp to find the tent, Cauldron, bridge, lighthouse path, and nearby chest route."
        },
        {
          q: "Are the Alchemy table and enchanting table NPCs?",
          a: "No. The Alchemy table, Refine machine, Wanted board, Cauldron, chests, and enchanting table are interactable objects, so they are kept out of the NPC list."
        }
      ],
      cta_label: "Open NPCs catalog",
      cta_url: buildGameDatasetCatalogPath(config.code),
      wiki_md:
        "NPCs connect Wizard Alchemy's early systems: Roger sells equipment, Lombart handles unwanted materials, Harryint and Fugitive Orc offer quest routes, and named landmarks such as Traveler, Optimistic Miner, and Lemin help players find chests and farming paths.",
      wiki_sort_order: config.sortOrder,
      wiki_item_count: itemCount,
      thumb_url: null
    };
  }

  if (config.code === "wizard-alchemy-resource-nodes") {
    const title = `All ${countLabel} Resource Nodes in Wizard Alchemy`;

    return {
      code: config.code,
      title,
      seo_title: title,
      meta_description:
        "Find Wizard Alchemy resource nodes by area, material source, route safety, chest use, and Enchanted Stone caveats.",
      intro_md:
        "Wizard Alchemy resource nodes are the safer side of the material loop: bushes, nests, mushrooms, New Mainland pickups, chests, and one Enchanted Stone source that needs a combat-ready build. The useful split is whether a source is a safe gathering stop, a broad chest pickup, or an enemy-like object.",
      description_md:
        "## How safe gathering fits into potion farming\n\nSafe nodes are useful because they let you collect potion ingredients before every route becomes a fight. Blueberry Bushes, Mushroom Clusters, and Bird Nests cover the first Departure Isle brews. Their materials are low Magic Power, but they are easy to replace and help you learn brewing before goblins, dwarfs, mutants, or Dwarf King routes matter.\n\nSea of Oblivion has its own starter pickups. Fern, Sulphur Lumps, and Volcanic Rock come from New Mainland gathering sources, so they give you a safer way to start the lava-island material loop before orc, priest, mutant, and Lava Behemoth drops become realistic.\n\n## How to run a safer gathering route\n\n1. Start on Departure Isle by sweeping Blueberry Bushes, Mushroom Clusters, and Bird Nests while you learn movement and potion brewing.\n2. Add nearby chests when they are already on your path, but do not treat one chest as a guaranteed source for one specific material.\n3. Move into normal enemies once starter ingredients stop reaching the Magic totals you need.\n4. In Sea of Oblivion, gather Fern, Sulphur Lumps, and Volcanic Rock before pushing too hard into enemy farms.\n5. Save Enchanted Sword Ferns for when your build can handle Sea of Oblivion combat, because they behave like tougher combat farming rather than peaceful gathering.\n\n| Source type | Best read | What to avoid |\n| --- | --- | --- |\n| Safe gathering nodes | Low-risk materials for early or area-starting brews | Expecting them to replace rare enemy drops |\n| Chests | Broad bonus pickups while routing around the map | Assuming a specific chest has a fixed listed material pool |\n| Enemy-like destructible sources | Special resources such as Enchanted Stones | Treating them like peaceful gathering nodes |\n\n## Why some special sources are handled carefully\n\nBig Bird's Nest is not treated like a normal safe node here. Reports tie it to rare materials and shards, which makes it closer to a special farm target than a simple starter pickup. Until its source behavior is clearer, plan around the standard nodes, chests, enemies, and boss routes first.",
      how_it_works_md:
        "`Area` tells you which map stage the source belongs to. `Node type` separates safe gathering, fixed chest pickups, and enemy-like destructible sources. `Materials` names the resource or reward group tied to the source, while `route use` explains why a player would include it in a farming loop. `Difficulty stage` is practical progression language, and `respawn or repeat note` stays cautious when sources do not list exact timers.",
      description_json: {
        "Departure Isle gathering nodes":
          "Blueberry Bushes, Mushroom Clusters, and Bird Nests are the clean starter pickups. They give low-Magic ingredients, but they let new players brew without taking every early fight.",
        "Sea of Oblivion gathering nodes":
          "Fern Bushes, Sulphur Lumps, and Volcanic Rocks are the New Mainland gathering nodes tied to Fern, Sulphur Lumps, and Volcanic Rock. Use them as safer route pieces before enemy drops become comfortable.",
        "Shared pickup sources":
          "Chests are fixed pickups with broad material and shard rewards. They sit between gathering and combat farming because they can pay out useful resources without forcing a fight.",
        "Enchanted Stone sources":
          "Enchanted Sword Ferns are for Enchanted Stones, not normal potion materials. Treat them as a combat-ready Sea of Oblivion farm, not as a peaceful starter node."
      },
      faq_json: [
        {
          q: "How many Wizard Alchemy resource nodes are listed?",
          a: "The list tracks 8 resource sources: 3 Departure Isle gathering nodes, 3 Sea of Oblivion gathering nodes, 1 shared chest pickup source, and 1 Enchanted Stone source."
        },
        {
          q: "What are the safest starter resource nodes?",
          a: "Blueberry Bushes, Mushroom Clusters, and Bird Nests are the safest starter nodes. They give Blueberry, Withered Mushroom, and Seagull Egg for early potion attempts before enemy farming feels steady."
        },
        {
          q: "Are chests already covered somewhere else?",
          a: "Yes. Chests have their own location route. They appear here only as a broad pickup source because they can give materials, shards, and other resources while you move through the map."
        },
        {
          q: "Are Enchanted Sword Ferns safe gathering nodes?",
          a: "No. Enchanted Sword Ferns are tied to Enchanted Stone farming and should be treated as Sea of Oblivion combat farming, not as peaceful gathering."
        },
        {
          q: "Why is Big Bird's Nest not listed?",
          a: "Big Bird's Nest is better treated as a special farm target until its behavior is clearer. It is not listed beside normal safe nodes because the reported drops overlap with rare materials and shards."
        },
        {
          q: "Do resource nodes replace enemy farming?",
          a: "No. Resource nodes are best for starter materials, safer New Mainland pickups, and route bonuses. Once you need Dwarf Emblem, Goblin Finger, Flame Crest, Copper Earring, Furnace Core, or boss materials, enemy farming still matters."
        }
      ],
      cta_label: "Open resource nodes catalog",
      cta_url: buildGameDatasetCatalogPath(config.code),
      wiki_md:
        "Resource nodes cover Wizard Alchemy's safer material sources: starter bushes, mushrooms, nests, New Mainland pickups, broad chest rewards, and the Enchanted Stone source that still needs combat-ready handling.",
      wiki_sort_order: config.sortOrder,
      wiki_item_count: itemCount,
      thumb_url: null
    };
  }

  if (config.code !== "wizard-alchemy-materials") return null;

  const title = `All ${countLabel} Materials in Wizard Alchemy`;

  return {
    code: config.code,
    title,
    seo_title: title,
    meta_description:
      "Wizard Alchemy materials list with Departure Isle and Sea of Oblivion drops, Magic Power values, shard effects, and sources.",
    intro_md:
      "Wizard Alchemy materials feed potion brewing. Normal ingredients from Departure Isle and Sea of Oblivion add Magic Power to a brew, while elemental shards push the result toward Fire, Ice, Light, Dark, Earth, or Wind. The useful choice is where the item drops, how hard the source is to farm, and whether the material should be saved for a later potion attempt.",
    description_md:
      "## How materials fit into potion brewing\n\nPotion attempts use the total Magic Power from normal materials. Blueberry, Withered Mushroom, and Seagull Egg are low-value ingredients, but they are easy to gather and help with early brews. Enemy drops such as Dwarf Emblem, Golden Tooth, Goblin Finger, Flame Crest, Goblin Bone, Copper Earring, and Furnace Core push Departure Isle brewing higher.\n\nSea of Oblivion materials take that same loop into New Mainland. Fern, Sulphur Lumps, and Volcanic Rock come from gathering routes, while Orc Ears, Orc Teeth, Broken Arrow, Iron Armour, Scepter Gem, Golem Core, and Lava Behemoth Remains move the best Magic Power values into orc, priest, mutant, and Lava Behemoth farming.\n\nElemental shards work differently. They are still materials, but they are planning items rather than Magic Power fuel. Add a shard when you care about the element of the result, such as using a Dark Shard for a dark spell route or a Fire Shard for a fire spell route.\n\n## How to farm the missing ingredient\n\n1. Start with safe nodes: Blueberry Bushes, Mushroom Clusters, Bird Nests, Fern Bushes, sulfur nodes, volcanic rocks, and nearby chests give enough early ingredients for starter potion attempts in each area.\n2. Move into normal enemies when low-Magic ingredients stop helping. Dwarfs and goblins cover Departure Isle combat drops, while Sword Orcs, Bow Orcs, Axe Orcs, and Orc Priests cover the early Sea of Oblivion climb.\n3. Farm stronger enemies once your damage is stable. Mutant dwarfs, mutant goblins, Dwarf King, Mutant Axe Orc, Mutant Orc Priest, and Lava Behemoth are where high-value drops start to matter.\n4. Save shards for element targeting. Spending a shard on a weak brew can feel wasteful if the Magic total is not high enough to reach the potion you want.\n5. Sell extras carefully. Common materials are easier to replace, but rare drops and shards can be annoying to recover when a quest or potion target suddenly needs them.\n\n## What to watch before chasing rare drops\n\nLava Behemoth Remains has the highest Magic Power value currently listed, but farming it early can be slow if enemies take too long. A better wand, more HP, cleaner movement, and a stronger race can make material routes faster than forcing the hardest target too soon. For most players, the clean route is to farm what you can defeat quickly, brew better spells, then move into elite and boss drops when the fights are consistent.",
    how_it_works_md:
      "Materials are split by area and role first. `Magic Power` is the number that contributes to potion thresholds, so blank Magic Power on a shard means it is not a normal ingredient. `Element effect` explains which element a shard helps target. `Source` and `Drop chances` show where the item comes from, while `Farming stage` gives the practical route: starter gathering, early enemies, mid enemies, elite targets, bosses, or element planning.",
    description_json: {
      "Departure Isle materials":
        "These materials cover the first island routes: starter nodes, dwarfs, goblins, mutants, and Dwarf King. Furnace Core is the strongest Departure Isle ingredient, but it is still below the top Sea of Oblivion drops.",
      "Sea of Oblivion materials":
        "New Mainland materials raise the Magic Power ceiling with orc, priest, golem, and Lava Behemoth drops. Lava Behemoth Remains is the highest Magic Power material currently listed.",
      "Elemental shards":
        "Shards do not work like normal Magic ingredients. Add them when the Magic total is already high enough and you want a better chance at a matching element."
    },
    faq_json: [
      {
        q: "What is the best material in Wizard Alchemy?",
        a: "Lava Behemoth Remains has the highest Magic Power value currently listed at 65. Furnace Core is still the strongest Departure Isle material at 43, but the New Mainland route pushes the top end higher."
      },
      {
        q: "What do elemental shards do?",
        a: "Elemental shards increase the chance of a matching element on a potion. They do not add normal Magic Power, so they are best used after your other materials already reach the potion threshold you want."
      },
      {
        q: "How do you get materials fast?",
        a: "Farm by the ingredient you are missing. Gather node materials and chests early, then move to dwarfs, goblins, orcs, and priests for mid materials. Save mutant enemies, Dwarf King, Lava Behemoth, and other boss routes for when your clear time is steady."
      },
      {
        q: "Should you sell materials in Wizard Alchemy?",
        a: "Selling extras can help with gold, but rare drops and shards are worth checking before you cash them in. A material that feels extra now can become the exact ingredient needed for a stronger potion, quest, or element plan."
      },
      {
        q: "Why is Magic Power blank for shards?",
        a: "Shards are element-chance materials. They help steer the potion toward Fire, Ice, Light, Dark, Earth, or Wind instead of raising the normal Magic Power total."
      }
    ],
    cta_label: "Open materials catalog",
    cta_url: buildGameDatasetCatalogPath(config.code),
    wiki_md:
      "Materials are the ingredients behind Wizard Alchemy's potion loop. Departure Isle and Sea of Oblivion drops raise Magic Power for stronger brews, while elemental shards help steer a potion toward a chosen element once the Magic total is ready.",
    wiki_sort_order: config.sortOrder,
    wiki_item_count: itemCount,
    thumb_url: imageUrls[0] ?? null
  };
}

function buildSlimeRngCatalogCopyOverride({
  config,
  itemCount,
  countLabel,
  imageUrls
}: Omit<GameDatasetCatalogCopyInput, "columns"> & { countLabel: string }): GameDatasetCatalogCopy | null {
  const common = {
    code: config.code,
    cta_url: buildGameDatasetCatalogPath(config.code),
    wiki_sort_order: config.sortOrder,
    wiki_item_count: itemCount
  };

  switch (config.code) {
    case "slime-rng-slimes": {
      const title = `All ${countLabel} Slime RNG Slimes, Odds, and Stats`;
      return {
        ...common,
        title,
        seo_title: title,
        meta_description: "Slime RNG slimes list with roll odds, rarity, variants, Power, Health, and family names for every tracked slime.",
        intro_md:
          "Slimes are the main rolls and combat units in Slime RNG. Each entry has a roll chance, rarity, variant, Power stat, and Health stat, so a good pull matters both for collection progress and for clearing enemy slimes in later zones.",
        description_json: {
          Base:
            "Base slimes are the normal version of each slime family. They set the starting odds and stats that the Big, Huge, Shiny, and Inverted versions build from.",
          Big:
            "Big slimes are rarer variant pulls with stronger stats than the base form. They are usually the first mutation-style upgrade players notice while rolling.",
          Huge:
            "Huge slimes push the same family into much harder odds and higher combat stats. These pulls matter more once enemy Health starts rising across zones.",
          Shiny:
            "Shiny slimes are rare alternate versions with their own odds and stat values. Treat the listed odds and stats as the useful comparison point until more in-game behavior is verified.",
          Inverted:
            "Inverted slimes are the hardest listed variant in each family. Their odds climb sharply, and their Power and Health usually make them major keepers."
        },
        description_md:
          "## How rolling and variants fit together\n\nEvery slime belongs to a family, such as Goopy, Lucky, Cyber, or Mossy. The variant tells you which version of that family you rolled. Base is the normal form, while Big, Huge, Shiny, and Inverted versions are progressively rarer pulls with different odds and stronger combat stats.\n\n## How to compare a slime pull\n\n1. Check the variant first so you know whether the pull is Base, Big, Huge, Shiny, or Inverted.\n2. Compare the odds to understand how hard that exact entry is to roll again.\n3. Use Power when deciding which slime helps kill enemies faster.\n4. Use Health when deciding which slime can stay alive longer during zone fights.\n5. Keep stronger variants from the same family before spending food on weaker duplicates.\n\n## Why stats matter after the roll\n\nRarity is useful for bragging rights and collection progress, but Power and Health decide how the slime performs in fights. A high-odds pull with better stats can help you push enemies and Goop farming farther than a low-stat slime that only fills the index.",
        how_it_works_md:
          "`Odds` is the listed roll rate for that exact slime entry. `Variant` separates Base, Big, Huge, Shiny, and Inverted versions. `Power` is the combat damage stat, while `Health` is how much damage the slime can take. `Family` links variants back to the same base slime line.",
        faq_json: [
          {
            q: "How many slimes are listed for Slime RNG?",
            a: `There are ${countLabel} tracked slime entries in the current local list, split across Base, Big, Huge, Shiny, and Inverted variants.`
          },
          {
            q: "What is the difference between a slime family and a variant?",
            a: "The family is the base slime line, such as Goopy or Lucky. The variant is the version you rolled, such as Base, Big, Huge, Shiny, or Inverted."
          },
          {
            q: "Which slime stat should you compare first?",
            a: "Start with odds and variant if you care about rarity. Use Power and Health when choosing which slime to level for combat."
          }
        ],
        cta_label: "Open slimes list",
        wiki_md:
          "Slimes are the core Slime RNG collection and combat units. Variants change the odds and stats for each family, while Power and Health decide which pulls are worth feeding before tougher zone enemies.",
        thumb_url: imageUrls[0] ?? null
      };
    }
    case "slime-rng-zones": {
      const title = `All ${countLabel} Slime RNG Zones, Costs, Luck, and Goop`;
      return {
        ...common,
        title,
        seo_title: title,
        meta_description: "Slime RNG zones list with unlock costs, permanent zone luck, enemy Health, Goop per kill, and machine unlocks.",
        intro_md:
          "Zones are Slime RNG's main map progression path. Unlocking a new zone costs Coins, raises your highest-zone luck bonus, changes enemy Health, and increases the Goop you can earn from kills.",
        description_json: {
          Earlygame:
            "Earlygame zones teach the basic loop: unlock the next area, fight tougher enemies, and build enough Coins and slimes to keep moving.",
          Midgame:
            "Midgame zones start raising costs and enemy Health quickly. These areas are where permanent zone luck and stronger slime stats begin to feel important.",
          Lategame:
            "Lategame zones ask for larger Coin jumps and better combat strength. Goop per kill rises, but enemies become much harder to clear with weak slimes.",
          Endgame:
            "Endgame zones are the current high-end route in the completed source list. Plan around both the unlock cost and the enemy Health before pushing ahead."
        },
        description_md:
          "## How zone progress works\n\nZone unlocks are bought with Coins, but the most important long-term reward is zone luck. The highest zone you have reached gives permanent zone luck, and the source notes that re-unlocking zones after a rebirth does not add the same bonus again.\n\n## How to push into the next zone\n\n1. Check the next zone cost before leaving your current farming route.\n2. Compare enemy Health with your best slime Power so fights do not slow down too much.\n3. Use Goop per kill to decide whether the new zone is worth farming after you unlock it.\n4. Watch for machine unlocks, since Crafting Machine and XP Transfer Machine access changes what you can do between rolls.\n5. After rebirthing, rebuild zone progress for access, but remember that highest-zone luck is based on your personal best.\n\n## Why the count stops at completed zones\n\nThe current source headline mentions more zones than the completed card data supports. The local list uses the completed zone cards through Honeycomb and leaves unfinished duplicate rows out until they have reliable names, costs, stats, and images.",
        how_it_works_md:
          "`Cost` is the Coin price to unlock the zone. `Total Zone Luck` is the cumulative permanent luck value shown for reaching that zone. `Enemy Health` shows how much tougher zone fights become, and `Goop Per Kill` shows the reward pace after kills. `Machine Unlocks` appears only where the source lists a machine in that zone.",
        faq_json: [
          {
            q: "Why does the list show completed zones only?",
            a: "The current source includes unfinished zone text beyond the completed card list. Rows without reliable zone data are left out until their cost, luck, enemy Health, Goop, and image are confirmed."
          },
          {
            q: "Does rebirth remove zone luck in Slime RNG?",
            a: "The Zones source says rebirth resets current zone progress, but the permanent luck from your highest reached zone is kept."
          },
          {
            q: "Which zone values matter most?",
            a: "Cost decides whether you can unlock the area, enemy Health decides whether your slimes can fight there, and Goop per kill decides how useful the zone is for rebirth progress."
          }
        ],
        cta_label: "Open zones list",
        wiki_md:
          "Zones control Slime RNG map progress. Coin costs gate each area, permanent zone luck rewards your highest reach, and enemy Health plus Goop per kill decide when a new area becomes a better farm.",
        thumb_url: imageUrls[0] ?? null
      };
    }
    case "slime-rng-crafting-recipes": {
      const title = `All ${countLabel} Slime RNG Crafting Recipes, Locations, and Required Slimes`;
      return {
        ...common,
        title,
        seo_title: title,
        meta_description:
          "Slime RNG crafting recipes list with recipe areas, crafted slime odds, result rarity, and required slimes.",
        intro_md:
          "Crafting lets you trade three specific slimes for a crafted slime result. The useful details are where the recipe belongs, how rare the crafted result is, and which ingredient slimes you need before you spend anything.",
        description_json: {
          "Early crafting recipes":
            "Early recipes sit near the first crafting route and use slimes from the earlier progression climb. They are the safest place to learn the three-slime recipe pattern.",
          "Midgame crafting recipes":
            "Midgame recipes move into rarer ingredients and higher result odds. This is where farming the required slimes matters more than simply reaching the machine.",
          "Late crafting recipes":
            "Late recipes use billion-range result odds and ingredients from deeper zone progress. Check the ingredient list before chasing the result.",
          "Endgame crafting recipes":
            "Endgame recipes are the highest recipes in the current source list. They depend on rare ingredients, so failed preparation can waste valuable slime pulls."
        },
        description_md:
          "## How crafting recipes work\n\nA crafting recipe consumes three listed slimes to create a specific crafted result. The result still has its own rarity and odds, so the recipe is best treated as a planned upgrade route rather than a casual sink for spare slimes.\n\n## How to prepare for a craft\n\n1. Pick the crafted slime you want before spending rare ingredients.\n2. Check the recipe area so you know how far the zone route needs to be unlocked.\n3. Farm or roll the three required slimes and compare their own odds.\n4. Save duplicate ingredient slimes until you are sure they are not needed for another recipe.\n5. Craft only when losing those three slimes is worth the result you are chasing.\n\n## What the recipe odds mean\n\nThe result odds show the rarity of the crafted slime itself, while the required slime fields show the cost of making the attempt. A recipe can look simple because it only needs three ingredients, but those ingredients can be rare enough that the real cost is the rolling time behind them.",
        how_it_works_md:
          "`Area` and `Zone` show where the recipe belongs in progression. `Result odds` and `Result rarity` describe the crafted slime. `Required slimes` lists the three consumed ingredients, and `Ingredient odds` gives a compact look at how hard those ingredient slimes are to replace.",
        faq_json: [
          {
            q: "How many crafting recipes are listed for Slime RNG?",
            a: `There are ${countLabel} crafting recipes in the current local list.`
          },
          {
            q: "Does crafting use up the required slimes?",
            a: "The Crafting source describes recipes as using three other slimes. Treat the required slimes as spent ingredients unless in-game text says otherwise."
          },
          {
            q: "Can crafting create mutated slimes?",
            a: "The source says crafting has a rare chance to give a mutated slime, but it does not list exact mutation odds."
          }
        ],
        cta_label: "Open crafting recipes",
        wiki_md:
          "Crafting recipes turn three required slimes into a crafted result. Recipe area, result odds, rarity, and ingredient odds all matter because a craft can cost rare pulls before it creates the slime you want.",
        thumb_url: imageUrls[0] ?? null
      };
    }
    case "slime-rng-items": {
      const title = `All ${countLabel} Slime RNG Items, Food, Potions, and Dice`;
      return {
        ...common,
        title,
        seo_title: title,
        meta_description:
          "Slime RNG items list with Food XP values, Potion buffs, Dice effects, duration notes, and roll rules.",
        intro_md:
          "Items support the roll and combat loop in Slime RNG. Food levels slimes for better stats, potions give short buffs, and dice change the next roll or reward result.",
        description_json: {
          Food:
            "Food gives XP to slimes. Higher food values are better for important slimes, especially rare variants that you plan to use in fights.",
          Potions:
            "Potions provide short buffs for rolling or farming. The current source describes these buffs as lasting 3 minutes.",
          Dice:
            "Dice affect the next roll or Jackpot result. Mutation dice guarantee a listed mutation type, but the source notes that mutation dice do not stack."
        },
        description_md:
          "## How to use items without wasting them\n\nItems are best saved for the part of the loop they actually improve. Food belongs on slimes you plan to keep. Potions are strongest when you are ready to roll or farm for the full buff window. Dice should be used when you care about the next roll outcome instead of spending them randomly.\n\n## Quick item plan\n\n| Item type | Best use | What to avoid |\n| --- | --- | --- |\n| Food | Leveling strong slimes for combat | Feeding every low-value duplicate |\n| Potions | Short focused rolling or coin sessions | Activating them when you are about to leave |\n| Dice | Forcing a specific next-roll mutation or Jackpot result | Stacking mutation dice when the source says they do not stack |\n\n## Why Power Fruits are separate\n\nPower Fruits behave more like a slime power system than normal consumables. They have spawn chances, ability pages, upgrade notes, and one-fruit restrictions, so they are tracked separately from food, potions, and dice.",
        how_it_works_md:
          "Food rows show `XP`, potion rows show the `Buff` and `Duration`, and dice rows show the `Next roll` effect plus any rule that changes how the dice should be used.",
        faq_json: [
          {
            q: "How many normal items are listed for Slime RNG?",
            a: `There are ${countLabel} Food, Potion, and Dice items in the current local list. Power Fruits are tracked separately.`
          },
          {
            q: "How long do potions last in Slime RNG?",
            a: "The current Items source says potion buffs last 3 minutes."
          },
          {
            q: "Do mutation dice stack?",
            a: "The Items source says mutation dice do not stack, so use one when you want that next-roll mutation effect."
          }
        ],
        cta_label: "Open items list",
        wiki_md:
          "Items support Slime RNG progression outside the slime list itself. Food gives XP, potions create short buff windows, and dice change next-roll outcomes or Jackpot rewards.",
        thumb_url: imageUrls[0] ?? null
      };
    }
    case "slime-rng-power-fruits": {
      const title = `All ${countLabel} Slime RNG Power Fruits and Spawn Chances`;
      return {
        ...common,
        title,
        seo_title: title,
        meta_description:
          "Slime RNG Power Fruits list with spawn chances, powers, known abilities, upgrade notes, and use restrictions.",
        intro_md:
          "Power Fruits are rare fruit drops that give a slime an elemental-style power. They are separate from normal food because they change what a slime can do, have their own spawn chances, and come with important restrictions.",
        description_json: {
          "Power Fruits":
            "Power Fruits are sorted from the most common listed spawn chance to the rarest. Universe Fruit is included, but its ability names are still unknown in the current source."
        },
        description_md:
          "## How Power Fruits work\n\nPower Fruits fall from meteors after the system is unlocked through the Upgrade Tree. Each fruit adds a power to a slime, such as Lightning, Fire, Ice, Sword, Magician, or Universe. Known fruit pages list two abilities for most fruits, while Universe Fruit still has unknown ability text in the current source.\n\n## How to choose a fruit target\n\n1. Check the spawn chance so you know how rare the fruit is compared with the others.\n2. Read the known abilities before giving the fruit to an important slime.\n3. Put a fruit on a slime you plan to keep, because the source warns against normal free switching.\n4. Avoid using fruited slimes as crafting ingredients, since the source says they cannot be used in the crafting machine.\n5. Claim meteor fruits quickly because the source gives a short 2-3 minute claim window.\n\n## What to do with unknown ability data\n\nWhen a fruit has unknown ability text, the safest comparison is spawn chance and power name. Do not assume the missing ability works like another fruit until the in-game description or source page is updated.",
        how_it_works_md:
          "`Spawn Chance` is the listed per-second meteor chance, not a slime roll chance. `Power` names the fruit's power type. `Ability 1` and `Ability 2` show known source descriptions where available. `Restrictions` covers the one-fruit and crafting limits that matter before assigning a fruit.",
        faq_json: [
          {
            q: "How many Power Fruits are in Slime RNG?",
            a: `There are ${countLabel} Power Fruits in the current local list: Lightning, Fire, Ice, Sword, Magician, and Universe.`
          },
          {
            q: "Can a slime have more than one Power Fruit?",
            a: "The Power Fruits source says a slime cannot have more than one fruit."
          },
          {
            q: "Can fruited slimes be used for crafting?",
            a: "The source says slimes with fruits cannot be used in the crafting machine."
          }
        ],
        cta_label: "Open Power Fruits list",
        wiki_md:
          "Power Fruits give slimes special powers and need more planning than normal food. Spawn chance, known abilities, upgrade limits, and one-fruit restrictions decide which slime should receive one.",
        thumb_url: imageUrls[0] ?? null
      };
    }
    case "slime-rng-rebirths": {
      const title = `All ${countLabel} Slime RNG Rebirths, Goop Costs, and Luck Multipliers`;
      return {
        ...common,
        title,
        seo_title: title,
        meta_description:
          "Slime RNG rebirths list with Goop requirements, luck multipliers, reset rules, and displayed rebirth ranges.",
        intro_md:
          "Rebirths are Slime RNG's long-term reset path. Each displayed rebirth asks for more Goop and gives a higher luck multiplier, while resetting coins and current zone progress.",
        description_json: {
          "Rebirths 1-10":
            "The first rebirths introduce the Goop cost climb and give the first major luck multiplier jumps.",
          "Rebirths 11-20":
            "Middle rebirths move the Goop requirement into millions and push multipliers much higher.",
          "Rebirths 21-30":
            "The highest displayed rebirths in the current source require large Goop totals and are not the stated cap."
        },
        description_md:
          "## How rebirth changes a run\n\nA rebirth spends the required Goop and resets your coins and current zone unlocks. The FAQ says slimes, upgrades, and luck are kept, while the Zones source says your highest-zone luck bonus stays tied to the best zone you have reached.\n\n## When to rebirth\n\n1. Check the Goop requirement for your next rebirth.\n2. Make sure you are ready to rebuild coins and zone access after the reset.\n3. Keep your strongest slimes leveled so early zones are faster after rebirth.\n4. Use the luck multiplier jump to decide whether the reset is worth doing now or after one more farming push.\n\n## Why the list says displayed rebirths\n\nThe source lists 30 rebirth rows but also says that is not the maximum. The local list tracks the displayed source rows and avoids guessing future or unlisted rebirth costs.",
        how_it_works_md:
          "`Rebirth` is the numbered rebirth milestone. `Goop required` is the amount needed to activate that rebirth, and `Luck multiplier` is the source-listed multiplier for that stage. Reset details stay in the page copy because repeating the same warning on every card would make the list harder to scan.",
        faq_json: [
          {
            q: "How many rebirths are listed for Slime RNG?",
            a: `There are ${countLabel} displayed rebirth rows in the current local list, and the source says this is not the maximum.`
          },
          {
            q: "What resets when you rebirth?",
            a: "The FAQ says rebirth resets zones and coins only, while keeping slimes, upgrades, and luck."
          },
          {
            q: "Does rebirth remove highest-zone luck?",
            a: "The Zones source says highest-zone permanent luck is kept even though current zone progress resets."
          }
        ],
        cta_label: "Open rebirths list",
        wiki_md:
          "Rebirths turn Goop into long-term luck multipliers. The reset removes coins and current zones, but source notes say slimes, upgrades, luck, and highest-zone progress are kept.",
        thumb_url: null
      };
    }
    case "slime-rng-index-rewards": {
      const title = `All ${countLabel} Slime RNG Index Rewards and Milestones`;
      return {
        ...common,
        title,
        seo_title: title,
        meta_description:
          "Slime RNG index rewards list with Basic, Big, Huge, Shiny, and Inverted milestones plus reward bundles.",
        intro_md:
          "Index rewards are collection milestones for filling out slime variants. Each milestone asks for a number of discovered slimes in a variant track and pays out boosts, currency, Goop, dice, food, or multipliers.",
        description_json: {
          Basic:
            "Basic milestones reward normal slime collection progress. They include early boosts, currency, food, Goop, and multiplier rewards.",
          Big:
            "Big milestones focus on collecting Big variants and include mutation dice, boosts, food, and multiplier rewards.",
          Huge:
            "Huge milestones reward Huge variant collection. These rows start lower than Basic because Huge pulls are harder to fill.",
          Shiny:
            "Shiny milestones reward Shiny variant collection and include Shiny Dice, boosts, food, and multipliers.",
          Inverted:
            "Inverted milestones reward the rarest variant track. These rows are valuable because Inverted pulls are much harder to complete."
        },
        description_md:
          "## How index rewards fit collection progress\n\nThe index rewards system pays you for discovering enough slimes in each variant track. Basic has the largest early collection path, while Big, Huge, Shiny, and Inverted tracks reward rarer variant progress with their own milestones.\n\n## How to plan around index milestones\n\n1. Check the variant track you are closest to finishing.\n2. Compare the next `Slimes Needed` value with your current index progress.\n3. Use guaranteed mutation dice from rewards when they help the next track you are pushing.\n4. Save stronger boosts for focused rolling sessions instead of spending them between short checks.\n5. Treat multiplier rewards as long-term account value because they help more than one roll.\n\n## Why reward focus matters\n\nSome milestones give short-term items such as food, boosts, dice, coins, or Goop. Others give multiplier increases that improve future rolling or coin progress. The best milestone to chase is usually the one close enough to finish soon while still giving a reward you can use immediately.",
        how_it_works_md:
          "`Mutation Type` is the index track. `Slimes Needed` is the count required for that milestone. `Reward 1`, `Reward 2`, and `Reward 3` show the listed payout bundle; blank reward slots mean the source only listed one or two rewards for that milestone.",
        faq_json: [
          {
            q: "How many index rewards are listed for Slime RNG?",
            a: `There are ${countLabel} index reward milestones in the current local list across Basic, Big, Huge, Shiny, and Inverted tracks.`
          },
          {
            q: "Which index track should you work on first?",
            a: "Start with the track closest to its next milestone. Basic milestones are usually easier early, while Big, Huge, Shiny, and Inverted tracks depend on rarer variant pulls."
          },
          {
            q: "Why are row images hidden for index rewards?",
            a: "The rewards are mixed bundles of icons and text, so clean reward fields are easier to scan than repeated per-card images."
          }
        ],
        cta_label: "Open index rewards",
        wiki_md:
          "Index rewards turn slime collection into milestone payouts. Basic, Big, Huge, Shiny, and Inverted tracks each pay boosts, dice, food, currency, Goop, or multipliers as the index fills.",
        thumb_url: null
      };
    }
    default:
      return null;
  }
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
