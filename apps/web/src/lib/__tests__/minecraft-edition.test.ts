import { describe, expect, it } from "vitest";
import { minecraftCollectionEdition, minecraftCollectionTitleForCount,  parseMinecraftEdition, selectMinecraftEdition, summarizeMinecraftCollectionEditions } from "../minecraft-edition";

const source = {
  meta: { schemaVersion: 2 },
  items: [
    { item: { name: "Shared", effect: "Shared rule" }, system: { slug: "shared", section: "Test", sortOrder: 1, image: null } },
    { item: { name: "Different", effect: "Java rule", editionOverrides: { bedrock: { effect: "Bedrock rule" } } }, system: { slug: "different", section: "Test", sortOrder: 2, image: null } },
    { item: { name: "Java only", editions: ["java"] }, system: { slug: "java-only", section: "Test", sortOrder: 3, image: null } },
    { item: { name: "Bedrock only", editions: ["bedrock"] }, system: { slug: "bedrock-only", section: "Test", sortOrder: 4, image: null } }
  ]
};
describe("Minecraft edition selection", () => {
  it("keeps overview counts equal to the selected collection roster, including text-only entries", () => {
    const rows = source.items.map(row => ({ editions: (row.item as Record<string, unknown>).editions, image: null }));
    const summary = summarizeMinecraftCollectionEditions(rows);
    for (const edition of ["java", "bedrock"] as const) {
      expect(summary[edition].itemCount).toBe(selectMinecraftEdition(source, edition).items.length);
      expect(summary[edition].imageUrls).toEqual([]);
    }
    const exclusive = summarizeMinecraftCollectionEditions([{ editions: ["bedrock"], image: "/achievement.png" }]);
    expect(exclusive.java.itemCount).toBe(0);
    expect(exclusive.bedrock.itemCount).toBe(1);
  });
  it("uses only selected-edition images, without duplicates, and limits previews to six", () => {
    const rows = [
      { editions: ["java"], image: "/java-only.png" },
      { editions: ["bedrock"], image: "/bedrock-only.png" },
      ...Array.from({ length: 8 }, (_, index) => ({ image: `/shared-${index}.png` })),
      { image: "/shared-0.png" }
    ];
    const summary = summarizeMinecraftCollectionEditions(rows);
    expect(summary.java.imageUrls).toEqual(["/java-only.png", ...Array.from({ length: 5 }, (_, index) => `/shared-${index}.png`)]);
    expect(summary.bedrock.imageUrls).toEqual(["/bedrock-only.png", ...Array.from({ length: 5 }, (_, index) => `/shared-${index}.png`)]);
    expect(summary.java.itemCount).toBe(10);
    expect(summary.bedrock.itemCount).toBe(10);
  });

  it("opens edition-exclusive collections with content and preserves explicit choices", () => {
    const achievements = [{ item: { editions: ["bedrock"] } }];
    expect(minecraftCollectionEdition(achievements)).toBe("bedrock");
    expect(minecraftCollectionEdition(achievements, "java")).toBe("java");
    expect(minecraftCollectionEdition(source.items)).toBe("java");
  });
  it("uses the selected roster count without replacing unrelated title numbers", () => {
    expect(minecraftCollectionTitleForCount("All 43 enchantments in Minecraft", 43, 42)).toBe("All 42 enchantments in Minecraft");
    expect(minecraftCollectionTitleForCount("All 3,893 recipes in Minecraft", 3893, 1763)).toBe("All 1,763 recipes in Minecraft");
    expect(minecraftCollectionTitleForCount("Minecraft 26.3 recipes", 3893, 1763)).toBe("Minecraft 26.3 recipes");
  });

  it("accepts only exact supported edition values", () => {
    expect(parseMinecraftEdition("java")).toBe("java");
    expect(parseMinecraftEdition("bedrock")).toBe("bedrock");
    for (const invalid of [null, undefined, "JAVA", "minecraft", ["java"]]) expect(parseMinecraftEdition(invalid)).toBeNull();
  });
  it("filters edition-exclusive rows, applies overrides, and preserves anchors", () => {
    const bedrock = selectMinecraftEdition(source, "bedrock");
    expect(bedrock.items.map(row => row.system.slug)).toEqual(["shared", "different", "bedrock-only"]);
    expect(bedrock.items[1].item.effect).toBe("Bedrock rule");
    expect(bedrock.items[1].item).not.toHaveProperty("editionOverrides");
    expect(bedrock.items[2].item).not.toHaveProperty("editions");
    expect(selectMinecraftEdition(source, "java").items[1].item.effect).toBe("Java rule");
    expect(source.items[1].item.effect).toBe("Java rule");
    expect(source.items).toHaveLength(4);
  });
});
