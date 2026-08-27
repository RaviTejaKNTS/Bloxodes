import type { GameCollectionGroup } from "../types";

export const wizardAlchemyCollectionGroup = {
    gameSlug: "wizard-alchemy",
    gameName: "Wizard Alchemy",
    universeId: 10006104044,
    dataDir: "Wizard Alchemy",
    universeNames: ["Wizard Alchemy"],
    collections: [
      "materials",
      "potions",
      "races",
      "wands",
      "brooms",
      "robes",
      "wizard-hats",
      "enemies",
      "chests",
      "enchantments",
      "locations",
      "npcs",
      "resource-nodes"
    ]
  } satisfies GameCollectionGroup;
