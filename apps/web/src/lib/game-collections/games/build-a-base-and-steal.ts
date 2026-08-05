import type { GameCollectionGroup } from "../types";

/** gear, pets (rebirth track), and pet-mutations local datasets. */
export const buildABaseAndStealCollectionGroup = {
  gameSlug: "build-a-base-and-steal",
  gameName: "Build a Base and Steal",
  universeId: 10356701370,
  dataDir: "Build a Base and Steal",
  universeNames: [
    "Build a Base and Steal",
    "Build a Base and Steal😈",
    "[UPD] Build a Base and Steal"
  ],
  collections: ["gear", "pets", "pet-mutations"]
} satisfies GameCollectionGroup;
