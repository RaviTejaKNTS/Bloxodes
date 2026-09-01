import type { GameCollectionGroup } from "../types";

export const solsRngCollectionGroup = {
  gameSlug: "sols-rng",
  gameName: "Sol's RNG",
  universeId: 5361032378,
  dataDir: "Sols RNG",
  universeNames: ["Sol's RNG", "Sol's RNG [ Summer Event ]"],
  collections: [
    "auras",
    "gears",
    "potions",
    "biomes",
    "runes",
    "lanterns"
  ]
} satisfies GameCollectionGroup;
