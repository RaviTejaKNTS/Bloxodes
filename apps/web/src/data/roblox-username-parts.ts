export const ROBLOX_USERNAME_VIBES = [
  "any",
  "cool",
  "cute",
  "aesthetic",
  "funny",
  "fantasy",
  "space",
  "nature",
  "sporty",
  "competitive",
  "classic"
] as const;

export type RobloxUsernameVibe = (typeof ROBLOX_USERNAME_VIBES)[number];

type VibeParts = {
  first: readonly string[];
  second: readonly string[];
};

export const ROBLOX_USERNAME_PARTS: Record<Exclude<RobloxUsernameVibe, "any">, VibeParts> = {
  cool: {
    first: ["Neon", "Frost", "Silent", "Swift", "Rogue", "Iron", "Pixel", "Lunar", "Ember", "Turbo", "Vivid", "Crimson"],
    second: ["Falcon", "Viper", "Storm", "Drift", "Blade", "Echo", "Quest", "Pulse", "Comet", "Raven", "Lynx", "Spark"]
  },
  cute: {
    first: ["Mochi", "Honey", "Tiny", "Cozy", "Peachy", "Sunny", "Puffy", "Berry", "Happy", "Bubbly", "Dandy", "Toasty"],
    second: ["Bunny", "Panda", "Sprout", "Paws", "Peach", "Bean", "Kitten", "Dumpling", "Otter", "Pebble", "Puff", "Plum"]
  },
  aesthetic: {
    first: ["Velvet", "Pastel", "Soft", "Dreamy", "Misty", "Moonlit", "Quiet", "Lilac", "Golden", "Rosy", "Satin", "Dewy"],
    second: ["Aura", "Bloom", "Cloud", "Dusk", "Petal", "Glow", "Melody", "Dew", "Muse", "Haze", "Lily", "Dawn"]
  },
  funny: {
    first: ["Wobbly", "Sneaky", "Sleepy", "Tiny", "Dizzy", "Crispy", "Silly", "Bouncy", "Grumpy", "Wiggly", "Toasty", "Fuzzy"],
    second: ["Potato", "Goose", "Pickle", "Waffle", "Noodle", "Toaster", "Spoon", "Sock", "Taco", "Blob", "Muffin", "Turnip"]
  },
  fantasy: {
    first: ["Arcane", "Mystic", "Runic", "Fabled", "Silver", "Ember", "Crystal", "Ancient", "Moon", "Royal", "Wild", "Hidden"],
    second: ["Knight", "Mage", "Warden", "Phoenix", "Sprite", "Griffin", "Relic", "Quest", "Rune", "Willow", "Crown", "Wyvern"]
  },
  space: {
    first: ["Lunar", "Solar", "Nova", "Cosmic", "Orbit", "Astro", "Comet", "Nebula", "Stellar", "Zenith", "Meteor", "Galaxy"],
    second: ["Pilot", "Rover", "Quasar", "Meteor", "Eclipse", "Moon", "Star", "Orbit", "Beacon", "Voyager", "Ray", "Drift"]
  },
  nature: {
    first: ["Mossy", "River", "Cedar", "Fern", "Clover", "Willow", "Maple", "Ocean", "Birch", "Meadow", "Rainy", "Sunny"],
    second: ["Fox", "Wolf", "Bloom", "Leaf", "Grove", "Creek", "Sparrow", "Stone", "Pine", "Rain", "Finch", "Brook"]
  },
  sporty: {
    first: ["Rapid", "Swift", "Ace", "Rally", "Sprint", "Turbo", "Power", "Quick", "Prime", "Victory", "Agile", "Fleet"],
    second: ["Striker", "Racer", "Runner", "Volley", "Hoops", "Keeper", "Dash", "Goal", "Serve", "Skate", "Sprint", "Rally"]
  },
  competitive: {
    first: ["Clutch", "Ranked", "Elite", "Rapid", "Sharp", "Focus", "Prime", "Strike", "Rival", "Victory", "Swift", "Tactical"],
    second: ["Ace", "Raider", "Tactic", "Rush", "Blitz", "Dash", "Scope", "Carry", "Peak", "Win", "Flank", "Tempo"]
  },
  classic: {
    first: ["Brick", "Retro", "Pixel", "Classic", "Blocky", "Golden", "OldSchool", "Stud", "Crafty", "Square", "Vintage", "Arcade"],
    second: ["Quest", "Crafter", "Player", "Builder", "Explorer", "Tycoon", "Racer", "Captain", "Hero", "Adventurer", "Pal", "Scout"]
  }
};

export const ROBLOX_USERNAME_INVENTED_PREFIXES = [
  "Aven",
  "Ceri",
  "Kiro",
  "Lumi",
  "Miro",
  "Nori",
  "Sora",
  "Tavi",
  "Vela",
  "Zavi",
  "Luma",
  "Rivo"
] as const;

export const ROBLOX_USERNAME_INVENTED_SUFFIXES = [
  "lia",
  "lyn",
  "mira",
  "nori",
  "ren",
  "rio",
  "sora",
  "ven",
  "vix",
  "zen",
  "rin",
  "via"
] as const;

export const ROBLOX_USERNAME_SUFFIXES = [
  "Ace",
  "Dash",
  "Echo",
  "Glow",
  "Nova",
  "Plays",
  "Quest",
  "Ray",
  "Spark",
  "Wave",
  "Wing",
  "Zone"
] as const;

export const ROBLOX_USERNAME_BLOCKED_FRAGMENTS = [
  "roblox",
  "robux",
  "blox",
  "admin",
  "moderator",
  "official",
  "verified",
  "staff",
  "support",
  "password",
  "email",
  "phone",
  "address",
  "discordgg",
  "http",
  "www"
] as const;
