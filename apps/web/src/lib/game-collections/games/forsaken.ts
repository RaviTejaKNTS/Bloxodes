import type { GameCollectionGroup } from "../types";

export const forsakenCollectionGroup = {
    gameSlug: "forsaken",
    gameName: "Forsaken",
    universeId: 6331902150,
    dataDir: "Forsaken",
    universeNames: ["Forsaken"],
    collections: [
      "killers",
      "maps",
      "emotes",
      "survivors",
      "skins",
      "items",
      "status-effects",
      "npcs"
    ]
  } satisfies GameCollectionGroup;
