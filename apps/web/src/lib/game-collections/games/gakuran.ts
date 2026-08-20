import type { GameCollectionGroup } from "../types";

export const gakuranCollectionGroup = {
  gameSlug: "gakuran",
  gameName: "Gakuran",
  universeId: 9199655655,
  dataDir: "Gakuran",
  universeNames: ["(学乱) Gakuran", "Gakuran"],
  collections: [
    "ethnicities",
    "fighting-styles",
    "accessories",
    "locations",
      "phone-apps",
      "songs"
    ]
} satisfies GameCollectionGroup;
