import type { GameCollectionGroup } from "../types";

export const animeExpeditionsCollectionGroup = {
  gameSlug: "anime-expeditions",
  gameName: "Anime Expeditions",
  universeId: 7613921865,
  dataDir: "Anime Expeditions",
  universeNames: ["Anime Expeditions", "Anime Expeditions [RELEASE]"],
  collections: [
    "maps",
    "equipment",
    "traits",
    "items",
    "units",
    "modifiers",
    "elements",
    "status-effects",
    "achievements"
  ]
} satisfies GameCollectionGroup;
