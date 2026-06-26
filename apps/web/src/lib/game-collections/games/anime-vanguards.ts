import type { GameCollectionGroup } from "../types";

export const animeVanguardsCollectionGroup = {
    gameSlug: "anime-vanguards",
    gameName: "Anime Vanguards",
    universeId: 5578556129,
    dataDir: "Anime Vanguards",
    universeNames: ["Anime Vanguards", "Anime Vanguards: Eternal Adversaries"],
    collections: [
      "units",
      "items",
      "evolutions",
      "traits",
      "memorias",
      "familiars",
      "elements",
      "enemies",
      "maps-stages"
    ]
  } satisfies GameCollectionGroup;
