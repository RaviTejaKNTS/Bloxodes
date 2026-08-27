import { describe, expect, it, vi } from "vitest";
import { prepareGameCollectionDocument } from "@/app/(site)/wiki/collections/games/generic";

vi.mock("server-only", () => ({}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T extends (...args: never[]) => unknown>(loader: T) => loader };
});

describe("database-backed wiki collection renderer", () => {
  it("prepares a schema-v2 runtime document without a local registry file", () => {
    const prepared = prepareGameCollectionDocument(
      {
        code: "example-game-items",
        gameSlug: "example-game",
        gameName: "Example Game",
        slug: "items",
        label: "Items",
        sortOrder: 10
      },
      {
        meta: {
          schemaVersion: 2,
          itemFields: ["rarity", "cardSummary"],
          columns: ["rarity", "cardSummary"],
          display: {
            groupLabel: "Rarity",
            sectionOrder: ["Rare"],
            badgeField: "rarity",
            subtitleFields: [],
            descriptionField: "cardSummary",
            cardDescriptionField: "cardSummary",
            cardFields: ["rarity", "cardSummary"],
            tableFields: ["rarity", "cardSummary"]
          }
        },
        items: [
          {
            item: { name: "Test Item", rarity: "Rare", cardSummary: "A useful test item." },
            system: {
              slug: "test-item",
              section: "Rare",
              sortOrder: 10,
              image: "https://media.bloxodes.com/wiki/123/items/test-item-abcd.webp"
            }
          }
        ]
      }
    );

    expect(prepared.dataset.items).toHaveLength(1);
    expect(prepared.dataset.items[0].image).toContain("media.bloxodes.com/wiki/");
    expect(prepared.groupedSections.map((section) => section.label)).toEqual(["Rare"]);
    expect(prepared.totalPages).toBe(1);
  });
});
