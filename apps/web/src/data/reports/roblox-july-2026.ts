export type DailyChartPoint = {
  date: string;
  players: number;
};

export type EventMarker = {
  date: string;
  shortLabel: string;
  label: string;
};

export type GenreMovementRow = {
  genre: string;
  stableGames: number;
  typicalChangePercent: number;
  shareRosePercent: number;
  combinedDailyAverage: number;
};

export type IndexedPoint = {
  date: string;
  index: number;
};

export type IndexedGameSeries = {
  name: string;
  slug: string;
  color: string;
  points: IndexedPoint[];
};

const julyDates = [
  "2026-07-02",
  "2026-07-03",
  "2026-07-04",
  "2026-07-05",
  "2026-07-06",
  "2026-07-07",
  "2026-07-08",
  "2026-07-09",
  "2026-07-10",
  "2026-07-11",
  "2026-07-12",
  "2026-07-13",
  "2026-07-14",
  "2026-07-15",
  "2026-07-16",
  "2026-07-17",
  "2026-07-18",
  "2026-07-19",
  "2026-07-20",
  "2026-07-21",
  "2026-07-22",
  "2026-07-23",
  "2026-07-24",
  "2026-07-25",
  "2026-07-26",
  "2026-07-27",
  "2026-07-28",
  "2026-07-29",
  "2026-07-30",
  "2026-07-31"
];

function toDailyPoints(values: readonly number[]): DailyChartPoint[] {
  return julyDates.map((date, i) => ({ date, players: values[i] }));
}

function toIndexedPoints(values: readonly number[]): IndexedPoint[] {
  return julyDates.map((date, i) => ({ date, index: values[i] }));
}

export const robloxJuly2026Report = {
  slug: "roblox-july-2026",
  title: "Roblox Stats July 2026 Report: Murder Mystery 2's Summer Surge",
  seoTitle: "Roblox Stats July 2026 Report: Murder Mystery 2's Summer Surge",
  seoDescription:
    "July 2026 Roblox stats report covering Murder Mystery 2's summer surge, comeback paths for older games, cooling genres, and major Roblox platform news.",
  subtitle: "The games, genres, comebacks, cool-downs, and major Roblox changes that defined July 2026.",
  dataWindowLabel: "July 2–31, 2026",
  publishedAt: "2026-08-03T00:00:00.000Z",
  updatedAt: "2026-08-03T00:00:00.000Z",

  featureImage: {
    src: "/images/reports/roblox-july-2026.png",
    alt: "July 2026 Roblox stats report cover showing Murder Mystery 2's daily average climbing sharply after July 23 and reaching 674,963 on July 27.",
    month: "July 2026",
    reportLabel: "Roblox July Stats Report",
    headlineLines: ["Murder Mystery 2's", "summer surge"],
    metric: "596,960 average players online · strongest 7 days",
    chartSeriesPath: "murderMystery2.points",
    chartValueKey: "players",
    accent: "#84a9ff"
  },

  murderMystery2: {
    slug: "murder-mystery-2-66654135",
    points: toDailyPoints([
      257947, 252420, 253692, 257683, 260186, 265898, 269884, 276437, 273376, 268916, 283080, 284328, 280075, 291459,
      291763, 294305, 290293, 293830, 300427, 301358, 297041, 373872, 554899, 572996, 636030, 674963, 647134, 563580,
      529113, 511403
    ]) satisfies DailyChartPoint[],
    markers: [{ date: "2026-07-23", shortLabel: "Summer 2026", label: "Summer 2026 event" }] satisfies EventMarker[]
  },

  comebackGames: {
    eventMarker: { date: "2026-07-23", shortLabel: "Flee summer event", label: "Flee the Facility summer event" } satisfies EventMarker,
    series: [
      {
        name: "Shindo Life",
        slug: "shinobi-life-2-1511883870",
        color: "#0f766e",
        points: toIndexedPoints([
          22.2, 22.7, 22.6, 22.4, 21.6, 15.9, 25.2, 27.7, 31.1, 37.4, 43.7, 43.2, 47.0, 53.2, 57.9, 62.5, 74.1, 100.5,
          127.6, 132.9, 151.3, 175.0, 193.6, 222.5, 219.4, 213.4, 213.7, 213.6, 203.9, 202.5
        ])
      },
      {
        name: "Flee the Facility",
        slug: "flee-the-facility-372226183",
        color: "#2563eb",
        points: toIndexedPoints([
          70.9, 78.8, 78.5, 76.8, 79.5, 81.4, 79.9, 81.6, 78.3, 81.1, 81.9, 83.8, 86.9, 89.8, 87.9, 90.1, 90.1, 88.8,
          98.9, 100.9, 99.1, 172.9, 160.4, 142.7, 131.1, 130.0, 126.8, 118.9, 118.1, 113.9
        ])
      },
      {
        name: "Bee Swarm Simulator",
        slug: "bee-swarm-simulator-601130232",
        color: "#c2410c",
        points: toIndexedPoints([
          89.9, 89.8, 91.5, 93.1, 93.3, 93.2, 93.9, 94.3, 94.4, 95.3, 96.9, 97.3, 96.7, 97.7, 97.5, 98.3, 100.5, 103.2,
          101.5, 104.1, 102.5, 102.0, 105.0, 108.3, 109.9, 108.8, 109.5, 110.2, 110.4, 111.0
        ])
      }
    ] satisfies IndexedGameSeries[]
  },

  genreMovement: [
    { genre: "Shooter", stableGames: 17, typicalChangePercent: 4.0, shareRosePercent: 65, combinedDailyAverage: 335205 },
    { genre: "Action", stableGames: 27, typicalChangePercent: 1.4, shareRosePercent: 74, combinedDailyAverage: 552541 },
    {
      genre: "Obby & Platformer",
      stableGames: 11,
      typicalChangePercent: 1.3,
      shareRosePercent: 52,
      combinedDailyAverage: 120584
    },
    { genre: "RPG", stableGames: 14, typicalChangePercent: 1.2, shareRosePercent: 52, combinedDailyAverage: 379318 },
    {
      genre: "Sports & Racing",
      stableGames: 12,
      typicalChangePercent: 0.1,
      shareRosePercent: 52,
      combinedDailyAverage: 220197
    },
    { genre: "Survival", stableGames: 51, typicalChangePercent: -2.8, shareRosePercent: 39, combinedDailyAverage: 1818191 },
    {
      genre: "Roleplay & Avatar Sim",
      stableGames: 30,
      typicalChangePercent: -2.8,
      shareRosePercent: 26,
      combinedDailyAverage: 1320869
    },
    {
      genre: "Simulation",
      stableGames: 142,
      typicalChangePercent: -4.3,
      shareRosePercent: 22,
      combinedDailyAverage: 2802965
    },
    {
      genre: "Party & Casual",
      stableGames: 19,
      typicalChangePercent: -7.3,
      shareRosePercent: 30,
      combinedDailyAverage: 148429
    },
    { genre: "Adventure", stableGames: 12, typicalChangePercent: -19.1, shareRosePercent: 4, combinedDailyAverage: 182070 },
    { genre: "Strategy", stableGames: 9, typicalChangePercent: -20.2, shareRosePercent: 39, combinedDailyAverage: 114069 }
  ] satisfies GenreMovementRow[],

  coolDownGames: {
    series: [
      {
        name: "Adopt Me!",
        slug: "adopt-me-383310974",
        color: "#be123c",
        points: toIndexedPoints([
          119.6, 113.1, 128.7, 123.0, 108.0, 110.2, 118.3, 118.3, 111.3, 132.2, 124.0, 119.9, 120.8, 118.8, 108.0,
          107.3, 114.6, 114.8, 99.0, 103.3, 91.0, 86.9, 71.0, 74.9, 57.9, 61.8, 59.9, 62.0, 59.6, 61.9
        ])
      },
      {
        name: "Animal Hospital",
        slug: "animal-hospital",
        color: "#7c3aed",
        points: toIndexedPoints([
          104.2, 113.0, 119.1, 123.1, 116.2, 117.3, 112.8, 112.3, 135.4, 145.3, 133.4, 115.6, 104.5, 99.7, 96.4, 95.2,
          98.3, 93.8, 81.5, 75.3, 68.8, 69.6, 71.3, 91.1, 112.6, 92.5, 82.2, 75.8, 72.8, 70.7
        ])
      },
      {
        name: "Evomon",
        slug: "evomon",
        color: "#a16207",
        points: toIndexedPoints([
          125.9, 137.0, 160.9, 164.1, 152.9, 149.1, 139.8, 136.9, 122.9, 120.3, 110.2, 97.6, 101.6, 94.4, 116.3,
          116.9, 109.9, 101.1, 82.5, 79.5, 72.6, 70.8, 66.1, 62.9, 60.5, 52.0, 50.7, 44.0, 50.7, 49.9
        ])
      }
    ] satisfies IndexedGameSeries[]
  },

  endnote:
    "We used Bloxodes' repeated readings of public Roblox player counts from July 2–31, 2026, averaged by day. The figures show players online at the same time, not unique people, and cover a selected set of games that reached meaningful scale during the month. Events and platform announcements are linked to their original sources; timing alone does not show what caused a rise or fall."
} as const;
