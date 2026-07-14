import type { GameCollectionGroup } from "../types";

export const animalHospitalCollectionGroup = {
    gameSlug: "animal-hospital",
    gameName: "Animal Hospital",
    universeId: 10148749921,
    dataDir: "Animal Hospital",
    universeNames: ["Animal Hospital", "Animal Hospital (Anomaly)", "Animal Hospital (Anomaly) 🧪"],
    collections: [
      "anomalies",
      "rooms",
      "emergencies",
      "locations",
      "classes",
      "items",
      "enemies",
      "characters",
      "skins"
    ]
  } satisfies GameCollectionGroup;
