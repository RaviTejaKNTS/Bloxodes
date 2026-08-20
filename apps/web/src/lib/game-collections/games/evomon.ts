import type { GameCollectionGroup } from "../types";

export const evomonCollectionGroup = {
    gameSlug: "evomon",
    gameName: "Evomon",
    universeId: 9826885587,
    dataDir: "Evomon",
    universeNames: ["Evomon", "Evomon[Release]", "Evomon [Release]"],
    collections: [
      "monsters",
      "islands",
      "balls",
      "adventure-suits",
      "mutations",
      "items",
      "natures",
      "equipment",
      "traits",
      "moves"
    ]
  } satisfies GameCollectionGroup;
