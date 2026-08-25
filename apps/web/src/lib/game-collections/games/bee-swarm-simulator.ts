import type { GameCollectionGroup } from "../types";

export const beeSwarmSimulatorCollectionGroup = {
  gameSlug: "bee-swarm-simulator",
  gameName: "Bee Swarm Simulator",
  universeId: 601130232,
  dataDir: "Bee Swarm Simulator",
  universeNames: ["Bee Swarm Simulator"],
  collections: [
    "bees",
    "equipment",
    "fields",
    "planters",
    "bears",
    "mobs-and-bosses",
    "materials",
    "beequips"
  ]
} satisfies GameCollectionGroup;
