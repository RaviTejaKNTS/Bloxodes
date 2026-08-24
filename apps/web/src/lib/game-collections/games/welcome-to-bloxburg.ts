import type { GameCollectionGroup } from "../types";

export const welcomeToBloxburgCollectionGroup = {
    gameSlug: "welcome-to-bloxburg",
    gameName: "Welcome to Bloxburg",
    universeId: 88070565,
    dataDir: "Welcome to Bloxburg",
    universeNames: ["Welcome to Bloxburg"],
    collections: [
      "recipes",
      "vehicles",
      "jobs",
      "skills",
      "plants",
      "locations"
    ]
  } satisfies GameCollectionGroup;
