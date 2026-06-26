import type { GameCollectionGroup } from "../types";

export const slimeRngCollectionGroup = {
    gameSlug: "slime-rng",
    gameName: "Slime RNG",
    dataDir: "Slime RNG",
    universeNames: ["Slime RNG"],
    collections: [
      "slimes",
      "zones",
      "crafting-recipes",
      "items",
      "power-fruits",
      "rebirths",
      "index-rewards"
    ]
  } satisfies GameCollectionGroup;
