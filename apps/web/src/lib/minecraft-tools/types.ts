export type Edition = "java" | "bedrock";
export type ItemRule = { id: string; name: string; stackSize: number; editions?: Edition[] };
export type FuelRule = { id: string; name: string; burnTicks: number; remainder?: string; editions?: Edition[] };
export type ProcessingRule = { id: string; name: string; station: "furnace" | "blast-furnace" | "smoker"; editions?: Edition[] };
export type Ingredient = { count: number; choices: string[]; remainder?: string };
export type RecipeRule = { id: string; output: string; count: number; ingredients: Ingredient[]; station: string; editions?: Edition[] };
export type EnchantmentRule = { id: string; name: string; maxLevel: number; bookMultiplier: number; conflicts: string[]; equipment: string[]; editions?: Edition[] };
export type BrewingRule = { id: string; name: string; steps: Array<{ ingredient: string; result: string }>; editions?: Edition[]; extend?: string; enhance?: string };
export type EquipmentRule = { id: string; name: string; kind: string; durability?: number; attackDamage?: number; attackSpeed?: number; armor?: number; toughness?: number; repair?: string; compatibleEnchantments?: string; editions?: Edition[]; editionStats?: Partial<Record<Edition, { attackDamage?: number; attackSpeed?: number; armor?: number; toughness?: number; durability?: number }>> };
export type ToolRules = {
  revision: string;
  editions: Edition[];
  versions?: Partial<Record<Edition, string>>;
  sources?: Array<{ title: string; url: string }>;
  items?: ItemRule[];
  fuels?: FuelRule[];
  processing?: ProcessingRule[];
  recipes?: RecipeRule[];
  enchantments?: EnchantmentRule[];
  brewing?: BrewingRule[];
  equipment?: EquipmentRule[];
  commandItems?: string[];
  commandBlocks?: string[];
  commandEffects?: string[];
  editionRules?: Partial<Record<Edition, { commandItems?: string[]; commandBlocks?: string[]; commandEffects?: string[] }>>;
};
export function inEdition<T extends { editions?: Edition[] }>(rows: T[], edition: Edition): T[] {
  return rows.filter(row => !row.editions || row.editions.includes(edition));
}
