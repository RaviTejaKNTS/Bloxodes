import type { GameCollectionGroup } from "../types";

export const kickALuckyBlockCollectionGroup = {
    gameSlug: "kick-a-lucky-block",
    gameName: "Kick a Lucky Block",
    universeId: 10004244222,
    dataDir: "Kick a Lucky Block",
    universeNames: ["Kick a Lucky Block", "[🌋] Kick a Lucky Block"],
    collections: ["brainrots", "mutations", "weights", "zones",
      "rebirth-levels"
    ]
  } satisfies GameCollectionGroup;
