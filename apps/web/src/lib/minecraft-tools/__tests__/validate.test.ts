import { describe, expect, it } from "vitest";
import { validateMinecraftToolRules } from "../validate";

const base = { revision: "reviewed-r1", editions: ["java"], versions: { java: "26.3" } };
const item = { id: "stone", name: "Stone", stackSize: 64, editions: ["java"] };

describe("Minecraft tool publication rules", () => {
  it("rejects route keys outside the implemented registry", () => {
    expect(() => validateMinecraftToolRules("invented-tool", base)).toThrow("Unknown Minecraft tool_key");
  });
  it("requires verified rows for every supported edition", () => {
    expect(() => validateMinecraftToolRules("stack-and-storage-calculator", {
      ...base, editions: ["java", "bedrock"], versions: { java: "26.3", bedrock: "26.52" }, items: [item]
    })).toThrow("missing a supported edition");
  });
  it("rejects duplicate edition identities, invalid stack sizes and air", () => {
    expect(() => validateMinecraftToolRules("stack-and-storage-calculator", { ...base, items: [item, item] })).toThrow("duplicates");
    expect(() => validateMinecraftToolRules("stack-and-storage-calculator", { ...base, items: [{ ...item, stackSize: NaN }] })).toThrow("positive integer");
    expect(() => validateMinecraftToolRules("stack-and-storage-calculator", { ...base, items: [{ ...item, id: "air" }] })).toThrow("empty-slot sentinel");
  });
  it("requires actual recipe choices and keeps proved crafting remainders", () => {
    const rules = { ...base, items: [item], recipes: [{ id: "recipe", output: "stone", count: 1, station: "crafting_table", ingredients: [{ choices: ["stone"], count: 1, remainder: "bucket" }] }] };
    expect(validateMinecraftToolRules("crafting-materials-planner", rules).recipes?.[0].ingredients[0].remainder).toBe("bucket");
    expect(() => validateMinecraftToolRules("crafting-materials-planner", { ...rules, recipes: [{ ...rules.recipes[0], ingredients: [{ choices: ["#planks"], count: 1 }] }] })).toThrow("verified ingredient identities");
  });
  it("rejects mismatched row editions and missing command registries", () => {
    expect(() => validateMinecraftToolRules("stack-and-storage-calculator", { ...base, items: [{ ...item, editions: ["bedrock"] }] })).toThrow("unsupported edition");
    expect(() => validateMinecraftToolRules("command-generator", { ...base, editionRules: { java: { commandItems: ["stone"], commandBlocks: ["stone"] } } })).toThrow("commandEffects");
  });
});
