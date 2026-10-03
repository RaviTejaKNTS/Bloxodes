import { boundedNumber } from "./calculations";
import type { EnchantmentRule, RecipeRule } from "./types";

export type CraftingPlan = { raw: Record<string, number>; leftovers: Record<string, number>; remainders: Record<string, number>; steps: Array<{ recipe: string; output: string; batches: number; produced: number; station: string; ingredients: Array<{ id: string; count: number }> }> };
export function craftingPlan(targets: Record<string, number>, owned: Record<string, number>, recipes: RecipeRule[], preferred: Record<string, string> = {}): CraftingPlan {
  const inventory = { ...owned }, raw: Record<string, number> = {}, remainders: Record<string, number> = {}, steps: CraftingPlan["steps"] = [];
  for (const [id, n] of Object.entries(owned)) boundedNumber(n, `Owned ${id}`, 0, 1_000_000, true);
  const byOutput = new Map<string, RecipeRule[]>();
  for (const recipe of recipes) {
    const group = byOutput.get(recipe.output) ?? [];
    group.push(recipe); byOutput.set(recipe.output, group);
  }
  let operations = 0;
  function need(id: string, quantity: number, ancestors: Set<string>) {
    if (++operations > 50000) throw new Error("This recipe request is too large to plan. Use smaller quantities or fewer outputs.");
    const use = Math.min(inventory[id] ?? 0, quantity);
    inventory[id] = (inventory[id] ?? 0) - use;
    quantity -= use;
    if (!quantity) return;
    const options = byOutput.get(id) ?? [];
    const decompression = (recipe: RecipeRule) => recipe.count > 1 && recipe.ingredients.length === 1 && recipe.ingredients[0].count === 1 && recipe.ingredients[0].choices.some(choice => (byOutput.get(choice) ?? []).some(reverse => reverse.count === 1 && reverse.ingredients.length === 1 && reverse.ingredients[0].count === recipe.count && reverse.ingredients[0].choices.includes(id)));
    const explicit = preferred[id];
    if (explicit === "gather") { raw[id] = (raw[id] ?? 0) + quantity; return; }
    const available = options.filter(recipe => (explicit || !decompression(recipe)) && recipe.ingredients.every(ingredient => ingredient.choices.some(choice => !ancestors.has(choice) && choice !== id)));
    const recipe = explicit ? available.find(r => r.id === explicit) : available.find(r => !r.ingredients.some(i => i.choices.includes(id))) ?? available[0];
    if (explicit && !recipe) throw new Error(`The selected recipe for ${id} is unavailable or creates a cycle.`);
    if (!recipe) {
      if (options.length && ancestors.has(id)) throw new Error(`A recipe cycle includes ${id}. Choose a different recipe or provide it in owned inventory.`);
      raw[id] = (raw[id] ?? 0) + quantity;
      return;
    }
    if (ancestors.has(id)) throw new Error(`A recipe cycle includes ${id}. Choose another recipe.`);
    const next = new Set(ancestors); next.add(id);
    boundedNumber(recipe.count, "Recipe output count", 1, 1024, true);
    const batches = Math.ceil(quantity / recipe.count);
    const chosenIngredients: Array<{ id: string; count: number }> = [];
    for (const ingredient of recipe.ingredients) {
      boundedNumber(ingredient.count, "Ingredient count", 1, 1024, true);
      const choices = ingredient.choices.filter(choice => !next.has(choice));
      if (!choices.length) throw new Error(`No non-cyclic ingredient option exists for ${id}.`);
      const chosen = preferred[`${recipe.id}:${recipe.ingredients.indexOf(ingredient)}`] ?? choices.find(choice => (inventory[choice] ?? 0) >= batches * ingredient.count) ?? choices[0];
      if (!choices.includes(chosen)) throw new Error(`The ingredient choice for ${id} is unavailable.`);
      chosenIngredients.push({ id: chosen, count: batches * ingredient.count });
      need(chosen, batches * ingredient.count, next);
      if (ingredient.remainder) {
        remainders[ingredient.remainder] = (remainders[ingredient.remainder] ?? 0) + batches * ingredient.count;
        inventory[ingredient.remainder] = (inventory[ingredient.remainder] ?? 0) + batches * ingredient.count;
      }
    }
    const produced = batches * recipe.count;
    inventory[id] = (inventory[id] ?? 0) + produced - quantity;
    steps.push({ recipe: recipe.id, output: id, batches, produced, station: recipe.station, ingredients: chosenIngredients });
  }
  for (const [id, quantity] of Object.entries(targets)) {
    boundedNumber(quantity, `Requested ${id}`, 0, 1_000_000, true);
    need(id, quantity, new Set());
  }
  return { raw, leftovers: Object.fromEntries(Object.entries(inventory).filter(([, n]) => n > 0)), remainders, steps };
}

export type AnvilInput = { label: string; enchantments: Record<string, number>; work: number; gear?: boolean };
export type AnvilStep = { left: string; right: string; cost: number; result: string; resultingWork: number };
export type AnvilPlan = { cost: number; steps: AnvilStep[]; enchantments: Record<string, number>; work: number; label: string; gear?: boolean };
export function anvilPlan(equipment: string, gear: AnvilInput, books: AnvilInput[], rules: EnchantmentRule[]): AnvilPlan {
  if (!books.length || books.length > 7) throw new Error("Add between one and seven books. Larger plans need a separate batch.");
  const byId = new Map(rules.map(rule => [rule.id, rule]));
  const inputs = [{ ...gear, gear: true }, ...books.map(book => ({ ...book, gear: false }))];
  const allEnchantments = new Set<string>();
  for (const input of inputs) {
    boundedNumber(input.work, "Prior-work level", 0, 6, true);
    if (!Object.keys(input.enchantments).length && !input.gear) throw new Error("Every book needs at least one enchantment.");
    for (const [id, level] of Object.entries(input.enchantments)) {
      const rule = byId.get(id);
      if (!rule) throw new Error(`Unsupported enchantment ${id}.`);
      boundedNumber(level, rule.name, 1, rule.maxLevel, true);
      if (!rule.equipment.includes(equipment)) throw new Error(`${rule.name} cannot be applied to the selected equipment.`);
      allEnchantments.add(id);
    }
  }
  for (const id of allEnchantments) {
    const conflict = byId.get(id)!.conflicts.find(other => allEnchantments.has(other));
    if (conflict) throw new Error(`${byId.get(id)!.name} conflicts with ${byId.get(conflict)?.name ?? conflict}. Remove one before planning.`);
  }
  function merge(left: AnvilPlan, right: AnvilPlan): AnvilPlan | null {
    if (right.gear) return null;
    const enchantments = { ...left.enchantments };
    let cost = 2 ** left.work - 1 + 2 ** right.work - 1;
    for (const [id, level] of Object.entries(right.enchantments)) {
      const rule = byId.get(id)!;
      const old = enchantments[id] ?? 0;
      const combined = old === level ? Math.min(rule.maxLevel, level + 1) : Math.max(old, level);
      enchantments[id] = combined;
      cost += combined * rule.bookMultiplier;
    }
    if (cost >= 40) return null;
    const work = Math.max(left.work, right.work) + 1;
    const label = `${left.label} + ${right.label}`;
    return { cost: left.cost + right.cost + cost, enchantments, work, label, gear: left.gear, steps: [...left.steps, ...right.steps, { left: left.label, right: right.label, cost, result: label, resultingWork: work }] };
  }
  const size = 1 << inputs.length, dp = new Map<number, AnvilPlan[]>();
  inputs.forEach((input, i) => dp.set(1 << i, [{ ...input, cost: 0, steps: [] }]));
  let combinations = 0;
  for (let mask = 1; mask < size; mask++) {
    if (dp.has(mask)) continue;
    const states = new Map<string, AnvilPlan>();
    for (let leftMask = (mask - 1) & mask; leftMask; leftMask = (leftMask - 1) & mask) {
      const rightMask = mask ^ leftMask;
      if (!rightMask || rightMask & 1) continue;
      for (const left of dp.get(leftMask) ?? []) for (const right of dp.get(rightMask) ?? []) {
        if (++combinations > 2_000_000) throw new Error("This combination has too many possible book merges. Split it into smaller batches.");
        const result = merge(left, right);
        if (!result) continue;
        const key = `${result.work}:${Object.entries(result.enchantments).sort().map(([id, n]) => `${id}=${n}`).join(",")}`;
        const previous = states.get(key);
        if (!previous || result.cost < previous.cost) states.set(key, result);
      }
    }
    dp.set(mask, [...states.values()]);
  }
  const results = dp.get(size - 1) ?? [];
  if (!results.length) throw new Error("No valid Survival combining order fits below the 40-level limit. Reduce the books or prior work.");
  const score = (plan: AnvilPlan) => Object.values(plan.enchantments).reduce((a, b) => a + b, 0);
  // Equal book levels can produce different final levels. Prefer the strongest result, then minimum total levels.
  results.sort((a, b) => score(b) - score(a) || a.cost - b.cost);
  return results[0];
}
