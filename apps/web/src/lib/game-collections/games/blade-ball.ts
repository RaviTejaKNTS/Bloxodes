import type { GameCollectionGroup } from "../types";

// The hub remains seedable, but the high-churn collection scopes stay explicitly
// unregistered until an independent current-complete roster proof clears them.
export const bladeBallCollectionGroup = {
  gameSlug: "blade-ball",
  gameName: "Blade Ball",
  universeId: 4777817887,
  dataDir: "Blade Ball",
  universeNames: ["Blade Ball"],
  collections: [],
} satisfies GameCollectionGroup;
