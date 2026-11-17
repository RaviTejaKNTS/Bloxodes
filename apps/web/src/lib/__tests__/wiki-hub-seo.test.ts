import { describe, expect, it } from "vitest";
import { wikiHubGameName, wikiHubSeoTitle } from "../wiki-hub-seo";

const collections = ["Fruits", "Swords", "Accessories", "Quests"].map(display_name => ({
  display_name, collection_slug: display_name.toLowerCase(), page_type: "database"
}));
const title = (count: number, seoTitle?: string | null) => wikiHubSeoTitle({
  gameName: "Blox Fruits", seoTitle, collections: collections.slice(0, count)
});

describe("wiki hub search titles", () => {
  it.each([0, 1])("keeps the bare title with %i collections", count => {
    expect(title(count)).toBe("Blox Fruits Wiki");
  });

  it("keeps Roblox when it belongs to the stored game name", () => {
    expect(wikiHubSeoTitle({ gameName: wikiHubGameName("My Roblox Wiki", "My Roblox"), seoTitle: "My Roblox Wiki", collections: collections.slice(0, 2) }))
      .toBe("My Roblox Wiki: Fruits, Swords and Tips");
    expect(wikiHubGameName("My Roblox Wiki", null, " ")).toBe("My Roblox");
    expect(wikiHubGameName("Old Wiki", "My Roblox")).toBe("My Roblox");
  });
  it("uses two short labels", () => {
    expect(title(2)).toBe("Blox Fruits Wiki: Fruits, Swords and Tips");
  });

  it.each([3, 4])("uses only the first three of %i collections", count => {
    expect(title(count)).toBe("Blox Fruits Wiki: Fruits, Swords, Accessories and Tips");
  });

  it.each([null, "", "   ", "Blox Fruits Wiki", "bLoX fRuItS wIkI", "Blox Fruits Roblox Wiki", "BLOX FRUITS ROBLOX WIKI"])("expands an empty or bare title: %s", seoTitle => {
    expect(title(2, seoTitle)).toBe("Blox Fruits Wiki: Fruits, Swords and Tips");
  });

  it("always preserves a stored non-bare SEO title, including a long one", () => {
    const stored = "Blox Fruits Wiki: " + "A useful stored title ".repeat(4);
    expect(title(3, stored)).toBe(stored.trim());
    expect(title(3, "Other Game Wiki")).toBe("Other Game Wiki");
  });

  it("keeps a title exactly 60 characters and drops the third label at 61", () => {
    const base = collections.slice(0, 2);
    const exact = { display_name: "A".repeat(17), collection_slug: "third" };
    const input = { gameName: "Blox Fruits", collections: [...base, exact] };
    expect(wikiHubSeoTitle(input)).toHaveLength(60);
    expect(wikiHubSeoTitle({ ...input, collections: [...base, { ...exact, display_name: "A".repeat(18) }] }))
      .toBe("Blox Fruits Wiki: Fruits, Swords and Tips");
  });

  it("falls back to bare when even two labels exceed the limit", () => {
    expect(wikiHubSeoTitle({ gameName: "Blox Fruits", collections: collections.map(c => ({ ...c, display_name: "A".repeat(30) })) }))
      .toBe("Blox Fruits Wiki");
  });

  it("uses hub group order while preserving order within each group", () => {
    expect(wikiHubSeoTitle({ gameName: "Example", collections: [
      { display_name: "Badges", collection_slug: "badges", page_type: "collectible" },
      ...collections.slice(0, 2)
    ] })).toBe("Example Wiki: Fruits, Swords, Badges and Tips");
  });

  it("derives absent short labels from slugs, never from long page titles", () => {
    expect(wikiHubSeoTitle({ gameName: "Example", collections: [
      { display_name: " ", collection_slug: "fighting-styles" },
      { collection_slug: "fruits" }
    ] })).toBe("Example Wiki: Fighting Styles, Fruits and Tips");
  });

  it("recognizes the full game name when a hub uses its short name", () => {
    expect(wikiHubSeoTitle({ gameName: "GTA VI", gameNameAliases: ["Grand Theft Auto VI"], seoTitle: "Grand Theft Auto VI Wiki", collections: collections.slice(0, 2) }))
      .toBe("GTA VI Wiki: Fruits, Swords and Tips");
  });
});
