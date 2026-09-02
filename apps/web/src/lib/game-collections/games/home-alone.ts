import type { GameCollectionGroup } from "../types";

export const homeAloneCollectionGroup = {
  gameSlug: "home-alone",
  gameName: "Home Alone",
  universeId: 10123059921,
  universeNames: [
    "Home Alone",
    "Home Alone (Anomaly)",
    "[NEW] Home Alone (Anomaly)"
  ],
  collections: [
    "anomalies",
    "items",
    "chores"
  ]
} satisfies GameCollectionGroup;
