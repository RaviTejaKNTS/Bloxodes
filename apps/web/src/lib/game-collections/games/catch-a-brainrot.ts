import type { GameCollectionGroup } from "../types";

export const catchABrainrotCollectionGroup = {
  gameSlug: "catch-a-brainrot",
  gameName: "Catch a Brainrot",
  universeId: 10204207151,
  dataDir: "Catch a Brainrot",
  universeNames: ["Catch a Brainrot"],
  collections: [
    "abilities",
    "rotboxes",
    "brainrots"
  ]
} satisfies GameCollectionGroup;
