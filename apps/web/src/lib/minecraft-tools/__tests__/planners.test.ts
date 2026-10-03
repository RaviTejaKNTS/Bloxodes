import { describe, expect, it } from "vitest";
import { anvilPlan, craftingPlan } from "../planners";
import type { EnchantmentRule, RecipeRule } from "../types";

const recipes: RecipeRule[] = [
 { id: "planks", output: "oak_planks", count: 4, station: "crafting", ingredients: [{ count: 1, choices: ["oak_log"] }] },
 { id: "chest", output: "chest", count: 1, station: "crafting", ingredients: [{ count: 8, choices: ["oak_planks", "spruce_planks"] }] },
 { id: "sticks", output: "stick", count: 4, station: "crafting", ingredients: [{ count: 2, choices: ["oak_planks"] }] },
 { id: "iron", output: "iron_ingot", count: 9, station: "crafting", ingredients: [{ count: 1, choices: ["iron_block"] }] },
 { id: "iron_block", output: "iron_block", count: 1, station: "crafting", ingredients: [{ count: 9, choices: ["iron_ingot"] }] },
];
describe("recipe graph and owned inventory", () => {
 it("expands batches and reserves shared inventory once", () => {
  expect(craftingPlan({ chest: 1, stick: 4 }, { oak_planks: 4 }, recipes)).toMatchObject({ raw: { oak_log: 2 }, leftovers: { oak_planks: 2 } });
  expect(craftingPlan({ chest: 1 }, { oak_planks: 8 }, recipes)).toMatchObject({ raw: {}, leftovers: {} });
 });
 it("uses owned ingredient alternatives and preserves leftovers", () => {
  expect(craftingPlan({ chest: 1 }, { spruce_planks: 8 }, recipes)).toMatchObject({ raw: {}, leftovers: {} });
  expect(craftingPlan({ stick: 1 }, {}, recipes)).toMatchObject({ raw: { oak_log: 1 }, leftovers: { oak_planks: 2, stick: 3 } });
 });
 it("treats reversible material packing as gathered by default", () => {
  expect(craftingPlan({ iron_block: 1 }, {}, recipes)).toMatchObject({ raw: { iron_ingot: 9 } });
  expect(craftingPlan({ iron_ingot: 2 }, {}, recipes)).toMatchObject({ raw: { iron_ingot: 2 } });
  expect(craftingPlan({ chest: 1 }, {}, recipes, { oak_planks: "gather" })).toMatchObject({ raw: { oak_planks: 8 } });
 });
 it("returns containers and makes them available to later steps", () => {
  const r: RecipeRule[] = [{ id: "cake", output: "cake", count: 1, station: "crafting", ingredients: [{ count: 3, choices: ["milk_bucket"], remainder: "bucket" }] }];
  expect(craftingPlan({ cake: 1, bucket: 3 }, { milk_bucket: 3 }, r)).toMatchObject({ raw: {}, leftovers: {}, remainders: { bucket: 3 } });
 });
 it("rejects invalid requested values and invalid explicit choices", () => {
  expect(() => craftingPlan({ chest: -1 }, {}, recipes)).toThrow("Requested");
  expect(() => craftingPlan({ chest: 1 }, {}, recipes, { chest: "missing" })).toThrow("unavailable");
 });
});
const enchantments: EnchantmentRule[] = [
 { id: "efficiency", name: "Efficiency", maxLevel: 5, bookMultiplier: 1, conflicts: [], equipment: ["pickaxe"] },
 { id: "unbreaking", name: "Unbreaking", maxLevel: 3, bookMultiplier: 1, conflicts: [], equipment: ["pickaxe"] },
 { id: "mending", name: "Mending", maxLevel: 1, bookMultiplier: 2, conflicts: ["infinity"], equipment: ["pickaxe"] },
 { id: "infinity", name: "Infinity", maxLevel: 1, bookMultiplier: 4, conflicts: ["mending"], equipment: ["pickaxe"] },
];
const gear = { label: "Pickaxe", enchantments: {}, work: 0 };
describe("anvil dynamic programming", () => {
 it("keeps an existing enchantment and charges donor levels and both penalties", () => {
  const plan = anvilPlan("pickaxe", { ...gear, enchantments: { efficiency: 4 }, work: 1 }, [{ label: "Book", enchantments: { efficiency: 4 }, work: 1 }], enchantments);
  expect(plan.cost).toBe(7); expect(plan.enchantments.efficiency).toBe(5); expect(plan.work).toBe(2);
 });
 it("finds the minimum cost among combining orders", () => {
  const plan = anvilPlan("pickaxe", gear, [{ label: "Efficiency", enchantments: { efficiency: 5 }, work: 0 }, { label: "Unbreaking", enchantments: { unbreaking: 3 }, work: 0 }, { label: "Mending", enchantments: { mending: 1 }, work: 0 }], enchantments);
  expect(plan.cost).toBe(14);
  expect(plan.steps).toHaveLength(3);
  expect(plan.steps.every(step => step.cost < 40)).toBe(true);
 });
 it("rejects conflicting books and Survival operations at40 or above", () => {
  expect(() => anvilPlan("pickaxe", gear, [{ label: "Book", enchantments: { mending: 1, infinity: 1 }, work: 0 }], enchantments)).toThrow("conflicts");
  expect(() => anvilPlan("pickaxe", { ...gear, work: 6 }, [{ label: "Book", enchantments: { mending: 1 }, work: 0 }], enchantments)).toThrow("40-level");
  expect(() => anvilPlan("sword", gear, [{ label: "Book", enchantments: { mending: 1 }, work: 0 }], enchantments)).toThrow("cannot be applied");
 });
});
