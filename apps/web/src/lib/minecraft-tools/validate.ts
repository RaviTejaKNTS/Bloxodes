import { isMinecraftToolSlug, type MinecraftToolSlug } from "./manifest";
import type { ToolRules } from "./types";

const EDITIONS = new Set(["java", "bedrock"]);
const REQUIRED_ARRAYS: Partial<Record<MinecraftToolSlug, string[]>> = {
  "stack-and-storage-calculator": ["items"],
  "furnace-fuel-calculator": ["fuels", "processing"],
  "anvil-enchantment-planner": ["enchantments"],
  "crafting-materials-planner": ["items", "recipes"],
  "brewing-planner": ["brewing"],
  "gear-comparison": ["equipment"]
};

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string): void {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a nonempty string.`);
}
function strings(value: unknown, label: string, nonempty = false): string[] {
  if (!Array.isArray(value) || (nonempty && !value.length)) throw new Error(`${label} must be ${nonempty ? "a nonempty" : "an"} array.`);
  value.forEach((entry, index) => text(entry, `${label}[${index}]`));
  return value as string[];
}
function positive(value: unknown, label: string, integer = true): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || (integer && !Number.isInteger(value))) {
    throw new Error(`${label} must be a positive ${integer ? "integer" : "number"}.`);
  }
}

/** Validate reviewed rule payloads before publication or a public tool read. */
export function validateMinecraftToolRules(toolKey: unknown, value: unknown): ToolRules {
  if (typeof toolKey !== "string" || !isMinecraftToolSlug(toolKey)) throw new Error("Unknown Minecraft tool_key.");
  const rules = object(value, `${toolKey}.rules_json`);
  text(rules.revision, `${toolKey}.revision`);
  const editions = strings(rules.editions, `${toolKey}.editions`, true);
  if (new Set(editions).size !== editions.length || editions.some(edition => !EDITIONS.has(edition))) throw new Error("Invalid or duplicate rule editions.");
  const versions = object(rules.versions, `${toolKey}.versions`);
  editions.forEach(edition => text(versions[edition], `${toolKey}.versions.${edition}`));

  for (const key of ["items", "fuels", "processing", "recipes", "enchantments", "brewing", "equipment"]) {
    const required = REQUIRED_ARRAYS[toolKey]?.includes(key);
    if (rules[key] === undefined && !required) continue;
    if (!Array.isArray(rules[key]) || (required && !(rules[key] as unknown[]).length)) throw new Error(`${toolKey}.${key} must contain verified rows.`);
    const covered = new Set<string>();
    const identities = new Set<string>();
    (rules[key] as unknown[]).forEach((entry, index) => {
      const label = `${toolKey}.${key}[${index}]`;
      const row = object(entry, label);
      text(row.id, `${label}.id`);
      if (row.id === "air") throw new Error(`${label} must not expose the empty-slot sentinel.`);
      const applicable = row.editions === undefined ? editions : strings(row.editions, `${label}.editions`, true);
      if (new Set(applicable).size !== applicable.length || applicable.some(edition => !editions.includes(edition))) throw new Error(`${label} has an unsupported edition.`);
      applicable.forEach(edition => {
        const identity = `${edition}:${row.id}`;
        if (identities.has(identity)) throw new Error(`${label} duplicates ${identity}.`);
        identities.add(identity);
        covered.add(edition);
      });
      if (key !== "recipes") text(row.name, `${label}.name`);
      if (key === "items") positive(row.stackSize, `${label}.stackSize`);
      if (key === "fuels") positive(row.burnTicks, `${label}.burnTicks`);
      if (key === "processing" && !["furnace", "blast-furnace", "smoker"].includes(String(row.station))) throw new Error(`${label} has an invalid cooking station.`);
      if (key === "recipes") {
        text(row.output, `${label}.output`); positive(row.count, `${label}.count`); text(row.station, `${label}.station`);
        if (!Array.isArray(row.ingredients) || !row.ingredients.length) throw new Error(`${label} needs ingredients.`);
        row.ingredients.forEach((value, ingredientIndex) => {
          const ingredient = object(value, `${label}.ingredients[${ingredientIndex}]`);
          positive(ingredient.count, `${label}.ingredient.count`);
          const choices = strings(ingredient.choices, `${label}.ingredient.choices`, true);
          if (choices.some(choice => choice.startsWith("#") || choice === "air")) throw new Error(`${label} needs verified ingredient identities.`);
          if (ingredient.remainder !== undefined) text(ingredient.remainder, `${label}.ingredient.remainder`);
        });
      }
      if (key === "enchantments") {
        positive(row.maxLevel, `${label}.maxLevel`); positive(row.bookMultiplier, `${label}.bookMultiplier`);
        strings(row.conflicts, `${label}.conflicts`); strings(row.equipment, `${label}.equipment`, true);
      }
      if (key === "brewing") {
        if (!Array.isArray(row.steps)) throw new Error(`${label}.steps must be an array.`);
        row.steps.forEach((entry, step) => { const data = object(entry, `${label}.steps[${step}]`); text(data.ingredient, `${label}.ingredient`); text(data.result, `${label}.result`); });
      }
      if (key === "equipment") {
        text(row.kind, `${label}.kind`);
        for (const stat of ["durability", "attackDamage", "attackSpeed", "armor", "toughness"]) {
          if (row[stat] !== undefined && (typeof row[stat] !== "number" || !Number.isFinite(row[stat]) || (row[stat] as number) < 0)) throw new Error(`${label}.${stat} must be a nonnegative finite number.`);
        }
      }
    });
    if (required && editions.some(edition => !covered.has(edition))) throw new Error(`${toolKey}.${key} is missing a supported edition.`);
  }
  if (toolKey === "command-generator") {
    const editionRules = object(rules.editionRules, `${toolKey}.editionRules`);
    editions.forEach(edition => {
      const registry = object(editionRules[edition], `${toolKey}.${edition}`);
      for (const key of ["commandItems", "commandBlocks", "commandEffects"]) {
        const values = strings(registry[key], `${toolKey}.${edition}.${key}`, true);
        if (key === "commandItems" && values.includes("air")) throw new Error("Command items must not include air.");
      }
    });
  }
  return rules as unknown as ToolRules;
}
