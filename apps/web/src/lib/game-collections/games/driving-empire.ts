import type { GameCollectionGroup } from "../types";

export const drivingEmpireCollectionGroup = {
  gameSlug: "driving-empire",
  gameName: "Driving Empire",
  universeId: 1202096104,
  universeNames: ["Driving Empire", "Driving Empire Car Racing RP", "Driving Empire Car RacingRP"],
  collections: ["vehicles",
      "houses",
      "locations",
      "customization-upgrades"
    ]
} satisfies GameCollectionGroup;
