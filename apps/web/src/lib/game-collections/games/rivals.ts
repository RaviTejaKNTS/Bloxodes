import type { GameCollectionGroup } from "../types";

export const rivalsCollectionGroup = {
    gameSlug: "rivals",
    gameName: "RIVALS",
    dataDir: "RIVALS",
    universeNames: ["RIVALS"],
    collections: ["weapons", "maps", "skins", "wraps", "charms", "finishers", "emotes", "ugc", "gamemodes", "ranks", "currencies", "loot-boxes"]
  } satisfies GameCollectionGroup;
