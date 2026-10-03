export const MINECRAFT_TOOL_SLUGS = ["nether-coordinate-converter", "stack-and-storage-calculator", "furnace-fuel-calculator", "pixel-circle-generator", "anvil-enchantment-planner", "crafting-materials-planner", "brewing-planner", "xp-calculator", "beacon-materials-calculator", "building-materials-estimator", "gear-comparison", "command-generator", "stronghold-triangulation"] as const;
export type MinecraftToolSlug = typeof MINECRAFT_TOOL_SLUGS[number];
export function isMinecraftToolSlug(slug: string): slug is MinecraftToolSlug { return (MINECRAFT_TOOL_SLUGS as readonly string[]).includes(slug); }

export const MINECRAFT_TOOL_COLLECTIONS: Record<MinecraftToolSlug, readonly string[]> = {
  "nether-coordinate-converter": ["biomes", "structures"],
  "stack-and-storage-calculator": ["items", "blocks"],
  "furnace-fuel-calculator": ["fuels", "recipes", "ores", "food"],
  "pixel-circle-generator": ["blocks"],
  "anvil-enchantment-planner": ["enchantments", "tools", "weapons", "armor"],
  "crafting-materials-planner": ["recipes", "items", "blocks"],
  "brewing-planner": ["potions", "status-effects"],
  "xp-calculator": ["enchantments", "advancements"],
  "beacon-materials-calculator": ["ores", "blocks", "status-effects"],
  "building-materials-estimator": ["blocks", "recipes"],
  "gear-comparison": ["tools", "weapons", "armor", "enchantments"],
  "command-generator": ["commands", "items", "blocks", "status-effects"],
  "stronghold-triangulation": ["structures"]
};
