export type BreakoutChartPoint = {
  date: string;
  players: number | null;
};

export type BreakoutMarker = {
  date: string;
  shortLabel: string;
  label: string;
};

export type GenreRow = {
  genre: string;
  games: number;
  weeklyChangePercent: number;
  shareRosePercent: number;
  combinedDailyAverage: number;
};

export type IndexedPoint = {
  date: string;
  index: number | null;
};

export type IndexedGameSeries = {
  name: string;
  slug: string;
  color: string;
  points: IndexedPoint[];
};

export const robloxJune2026Report = {
  slug: "roblox-june-2026",
  title: "The hospital game that took over Roblox in June",
  subtitle:
    "One breakout hit, a month of Saturday events, and the games that kept climbing while others cooled off.",
  dataWindowLabel: "June 6–30, 2026",
  publishedAt: "2026-07-31T00:00:00.000Z",
  updatedAt: "2026-07-31T00:00:00.000Z",
  featureImage: {
    src: "/images/reports/roblox-june-2026.png",
    alt: "June 2026 Roblox report cover showing Animal Hospital average players rising from 884 to 429,721.",
    month: "June 2026",
    reportLabel: "Roblox June Stats Report",
    headlineLines: ["Animal Hospital took over", "Roblox in June"],
    metric: "884 → 429,721 players online",
    chartSeriesPath: "animalHospital.points",
    chartValueKey: "players",
    accent: "#84a9ff"
  },

  animalHospital: {
    slug: "animal-hospital",
    points: [
      { date: "2026-06-06", players: null },
      { date: "2026-06-07", players: null },
      { date: "2026-06-08", players: null },
      { date: "2026-06-09", players: 884 },
      { date: "2026-06-10", players: 1211 },
      { date: "2026-06-11", players: 2502 },
      { date: "2026-06-12", players: 3704 },
      { date: "2026-06-13", players: 10025 },
      { date: "2026-06-14", players: 16172 },
      { date: "2026-06-15", players: 18265 },
      { date: "2026-06-16", players: 26778 },
      { date: "2026-06-17", players: 41151 },
      { date: "2026-06-18", players: 53015 },
      { date: "2026-06-19", players: 65407 },
      { date: "2026-06-20", players: 88435 },
      { date: "2026-06-21", players: 109508 },
      { date: "2026-06-22", players: 113672 },
      { date: "2026-06-23", players: 125770 },
      { date: "2026-06-24", players: 149321 },
      { date: "2026-06-25", players: 178278 },
      { date: "2026-06-26", players: 233546 },
      { date: "2026-06-27", players: 312944 },
      { date: "2026-06-28", players: 368532 },
      { date: "2026-06-29", players: 397448 },
      { date: "2026-06-30", players: 429721 }
    ] satisfies BreakoutChartPoint[],
    markers: [
      { date: "2026-06-12", shortLabel: "Ambulance", label: "The Ambulance Arrives" },
      { date: "2026-06-19", shortLabel: "Class Update", label: "Class Update & QoL Pt.1" }
    ] satisfies BreakoutMarker[]
  },

  genreMomentum: [
    { genre: "Survival", games: 41, weeklyChangePercent: 16.4, shareRosePercent: 94, combinedDailyAverage: 1280835 },
    { genre: "Adventure", games: 18, weeklyChangePercent: 11.6, shareRosePercent: 100, combinedDailyAverage: 188976 },
    { genre: "Sports & Racing", games: 14, weeklyChangePercent: 11.1, shareRosePercent: 83, combinedDailyAverage: 164095 },
    { genre: "Roleplay & Avatar Sim", games: 31, weeklyChangePercent: 5.3, shareRosePercent: 89, combinedDailyAverage: 1281573 },
    { genre: "Obby & Platformer", games: 14, weeklyChangePercent: 5.1, shareRosePercent: 67, combinedDailyAverage: 110018 },
    { genre: "Simulation", games: 120, weeklyChangePercent: 2.2, shareRosePercent: 72, combinedDailyAverage: 2251207 },
    { genre: "Shooter", games: 13, weeklyChangePercent: 2.1, shareRosePercent: 56, combinedDailyAverage: 335123 },
    { genre: "Action", games: 32, weeklyChangePercent: 2.0, shareRosePercent: 67, combinedDailyAverage: 523746 },
    { genre: "Strategy", games: 14, weeklyChangePercent: -3.0, shareRosePercent: 39, combinedDailyAverage: 169050 },
    { genre: "Party & Casual", games: 13, weeklyChangePercent: -5.9, shareRosePercent: 28, combinedDailyAverage: 102237 },
    { genre: "RPG", games: 16, weeklyChangePercent: -6.4, shareRosePercent: 6, combinedDailyAverage: 442959 }
  ] satisfies GenreRow[],

  eventRhythm: {
    saturdays: ["2026-06-06", "2026-06-13", "2026-06-20", "2026-06-27"],
    series: [
      {
        name: "Steal a Brainrot",
        slug: "steal-a-brainrot-7709344486",
        color: "#0f766e",
        points: [
          { date: "2026-06-06", index: 101.4 },
          { date: "2026-06-07", index: 75.0 },
          { date: "2026-06-08", index: 59.7 },
          { date: "2026-06-09", index: 84.0 },
          { date: "2026-06-10", index: 59.4 },
          { date: "2026-06-11", index: 67.7 },
          { date: "2026-06-12", index: 69.6 },
          { date: "2026-06-13", index: 148.2 },
          { date: "2026-06-14", index: 103.8 },
          { date: "2026-06-15", index: 78.6 },
          { date: "2026-06-16", index: 107.0 },
          { date: "2026-06-17", index: 70.5 },
          { date: "2026-06-18", index: 67.4 },
          { date: "2026-06-19", index: 64.8 },
          { date: "2026-06-20", index: 151.9 },
          { date: "2026-06-21", index: 127.2 },
          { date: "2026-06-22", index: 107.3 },
          { date: "2026-06-23", index: 136.1 },
          { date: "2026-06-24", index: 95.0 },
          { date: "2026-06-25", index: 95.1 },
          { date: "2026-06-26", index: 100.6 },
          { date: "2026-06-27", index: 171.1 },
          { date: "2026-06-28", index: 116.1 },
          { date: "2026-06-29", index: 105.9 },
          { date: "2026-06-30", index: 136.6 }
        ] satisfies IndexedPoint[]
      },
      {
        name: "+1 Speed Keyboard Escape",
        slug: "1-speed-keyboard-escape-candy-chocolate",
        color: "#2563eb",
        points: [
          { date: "2026-06-06", index: 136.7 },
          { date: "2026-06-07", index: 76.2 },
          { date: "2026-06-08", index: 53.3 },
          { date: "2026-06-09", index: 53.1 },
          { date: "2026-06-10", index: 57.8 },
          { date: "2026-06-11", index: 61.0 },
          { date: "2026-06-12", index: 74.5 },
          { date: "2026-06-13", index: 147.5 },
          { date: "2026-06-14", index: 97.6 },
          { date: "2026-06-15", index: 71.4 },
          { date: "2026-06-16", index: 72.7 },
          { date: "2026-06-17", index: 124.0 },
          { date: "2026-06-18", index: 80.0 },
          { date: "2026-06-19", index: 82.4 },
          { date: "2026-06-20", index: 176.3 },
          { date: "2026-06-21", index: 107.8 },
          { date: "2026-06-22", index: 81.3 },
          { date: "2026-06-23", index: 82.4 },
          { date: "2026-06-24", index: 141.1 },
          { date: "2026-06-25", index: 89.5 },
          { date: "2026-06-26", index: 92.2 },
          { date: "2026-06-27", index: 208.8 },
          { date: "2026-06-28", index: 130.6 },
          { date: "2026-06-29", index: 103.6 },
          { date: "2026-06-30", index: 98.6 }
        ] satisfies IndexedPoint[]
      },
      {
        name: "99 Nights in the Forest",
        slug: "99-nights-in-the-forest-7326934954",
        color: "#c2410c",
        points: [
          { date: "2026-06-06", index: 91.6 },
          { date: "2026-06-07", index: 91.5 },
          { date: "2026-06-08", index: 64.2 },
          { date: "2026-06-09", index: 61.1 },
          { date: "2026-06-10", index: 66.2 },
          { date: "2026-06-11", index: 87.0 },
          { date: "2026-06-12", index: 91.4 },
          { date: "2026-06-13", index: 140.6 },
          { date: "2026-06-14", index: 129.6 },
          { date: "2026-06-15", index: 98.1 },
          { date: "2026-06-16", index: 92.9 },
          { date: "2026-06-17", index: 90.2 },
          { date: "2026-06-18", index: 89.7 },
          { date: "2026-06-19", index: 94.2 },
          { date: "2026-06-20", index: 121.8 },
          { date: "2026-06-21", index: 106.1 },
          { date: "2026-06-22", index: 88.2 },
          { date: "2026-06-23", index: 86.4 },
          { date: "2026-06-24", index: 84.7 },
          { date: "2026-06-25", index: 84.3 },
          { date: "2026-06-26", index: 90.2 },
          { date: "2026-06-27", index: 141.4 },
          { date: "2026-06-28", index: 152.8 },
          { date: "2026-06-29", index: 130.3 },
          { date: "2026-06-30", index: 125.5 }
        ] satisfies IndexedPoint[]
      },
      {
        name: "100 Days At Sea",
        slug: "100-days-at-sea-9167377564",
        color: "#7c3aed",
        points: [
          { date: "2026-06-06", index: 41.4 },
          { date: "2026-06-07", index: 47.9 },
          { date: "2026-06-08", index: 35.9 },
          { date: "2026-06-09", index: 50.1 },
          { date: "2026-06-10", index: 61.7 },
          { date: "2026-06-11", index: 66.5 },
          { date: "2026-06-12", index: 78.6 },
          { date: "2026-06-13", index: 88.9 },
          { date: "2026-06-14", index: 107.3 },
          { date: "2026-06-15", index: 81.1 },
          { date: "2026-06-16", index: 106.2 },
          { date: "2026-06-17", index: 108.4 },
          { date: "2026-06-18", index: 111.3 },
          { date: "2026-06-19", index: 113.7 },
          { date: "2026-06-20", index: 133.4 },
          { date: "2026-06-21", index: 148.9 },
          { date: "2026-06-22", index: 123.3 },
          { date: "2026-06-23", index: 123.8 },
          { date: "2026-06-24", index: 134.4 },
          { date: "2026-06-25", index: 127.7 },
          { date: "2026-06-26", index: 127.7 },
          { date: "2026-06-27", index: 127.5 },
          { date: "2026-06-28", index: 132.2 },
          { date: "2026-06-29", index: 111.1 },
          { date: "2026-06-30", index: 111.1 }
        ] satisfies IndexedPoint[]
      }
    ] satisfies IndexedGameSeries[]
  },

  coolingGames: {
    series: [
      {
        name: "Slime RNG",
        slug: "slime-rng",
        color: "#c2410c",
        points: [
          { date: "2026-06-06", index: 391.5 },
          { date: "2026-06-07", index: 216.3 },
          { date: "2026-06-08", index: 174.8 },
          { date: "2026-06-09", index: 157.8 },
          { date: "2026-06-10", index: 145.7 },
          { date: "2026-06-11", index: 138.8 },
          { date: "2026-06-12", index: 129.8 },
          { date: "2026-06-13", index: 183.8 },
          { date: "2026-06-14", index: 115.1 },
          { date: "2026-06-15", index: 91.3 },
          { date: "2026-06-16", index: 85.9 },
          { date: "2026-06-17", index: 78.4 },
          { date: "2026-06-18", index: 72.2 },
          { date: "2026-06-19", index: 68.7 },
          { date: "2026-06-20", index: 70.0 },
          { date: "2026-06-21", index: 57.1 },
          { date: "2026-06-22", index: 48.8 },
          { date: "2026-06-23", index: 44.9 },
          { date: "2026-06-24", index: 41.2 },
          { date: "2026-06-25", index: 37.8 },
          { date: "2026-06-26", index: 35.7 },
          { date: "2026-06-27", index: 34.9 },
          { date: "2026-06-28", index: 29.4 },
          { date: "2026-06-29", index: 25.9 },
          { date: "2026-06-30", index: 24.4 }
        ] satisfies IndexedPoint[]
      },
      {
        name: "Build A Ring Farm",
        slug: "build-a-ring-farm",
        color: "#b45309",
        points: [
          { date: "2026-06-06", index: 260.5 },
          { date: "2026-06-07", index: 216.6 },
          { date: "2026-06-08", index: 143.8 },
          { date: "2026-06-09", index: 125.0 },
          { date: "2026-06-10", index: 112.5 },
          { date: "2026-06-11", index: 110.1 },
          { date: "2026-06-12", index: 102.8 },
          { date: "2026-06-13", index: 147.9 },
          { date: "2026-06-14", index: 117.4 },
          { date: "2026-06-15", index: 86.1 },
          { date: "2026-06-16", index: 81.1 },
          { date: "2026-06-17", index: 77.3 },
          { date: "2026-06-18", index: 73.9 },
          { date: "2026-06-19", index: 71.9 },
          { date: "2026-06-20", index: 112.6 },
          { date: "2026-06-21", index: 86.6 },
          { date: "2026-06-22", index: 72.4 },
          { date: "2026-06-23", index: 68.2 },
          { date: "2026-06-24", index: 60.6 },
          { date: "2026-06-25", index: 55.5 },
          { date: "2026-06-26", index: 53.8 },
          { date: "2026-06-27", index: 87.1 },
          { date: "2026-06-28", index: 64.8 },
          { date: "2026-06-29", index: 57.1 },
          { date: "2026-06-30", index: 54.2 }
        ] satisfies IndexedPoint[]
      },
      {
        name: "Survive Zombie Arena",
        slug: "survive-zombie-arena",
        color: "#a16207",
        points: [
          { date: "2026-06-06", index: 192.5 },
          { date: "2026-06-07", index: 207.9 },
          { date: "2026-06-08", index: 130.7 },
          { date: "2026-06-09", index: 117.4 },
          { date: "2026-06-10", index: 123.5 },
          { date: "2026-06-11", index: 131.3 },
          { date: "2026-06-12", index: 135.0 },
          { date: "2026-06-13", index: 165.7 },
          { date: "2026-06-14", index: 149.2 },
          { date: "2026-06-15", index: 93.3 },
          { date: "2026-06-16", index: 88.5 },
          { date: "2026-06-17", index: 80.8 },
          { date: "2026-06-18", index: 76.3 },
          { date: "2026-06-19", index: 84.7 },
          { date: "2026-06-20", index: 102.8 },
          { date: "2026-06-21", index: 96.2 },
          { date: "2026-06-22", index: 66.8 },
          { date: "2026-06-23", index: 63.0 },
          { date: "2026-06-24", index: 58.1 },
          { date: "2026-06-25", index: 53.7 },
          { date: "2026-06-26", index: 59.5 },
          { date: "2026-06-27", index: 69.2 },
          { date: "2026-06-28", index: 63.8 },
          { date: "2026-06-29", index: 45.7 },
          { date: "2026-06-30", index: 44.3 }
        ] satisfies IndexedPoint[]
      },
      {
        name: "Kick a Lucky Block",
        slug: "kick-a-lucky-block",
        color: "#be123c",
        points: [
          { date: "2026-06-06", index: 138.4 },
          { date: "2026-06-07", index: 135.0 },
          { date: "2026-06-08", index: 101.3 },
          { date: "2026-06-09", index: 96.6 },
          { date: "2026-06-10", index: 98.6 },
          { date: "2026-06-11", index: 107.8 },
          { date: "2026-06-12", index: 109.4 },
          { date: "2026-06-13", index: 187.7 },
          { date: "2026-06-14", index: 131.5 },
          { date: "2026-06-15", index: 96.5 },
          { date: "2026-06-16", index: 93.9 },
          { date: "2026-06-17", index: 89.7 },
          { date: "2026-06-18", index: 87.5 },
          { date: "2026-06-19", index: 92.1 },
          { date: "2026-06-20", index: 145.1 },
          { date: "2026-06-21", index: 100.3 },
          { date: "2026-06-22", index: 81.0 },
          { date: "2026-06-23", index: 75.7 },
          { date: "2026-06-24", index: 70.3 },
          { date: "2026-06-25", index: 65.9 },
          { date: "2026-06-26", index: 70.3 },
          { date: "2026-06-27", index: 114.5 },
          { date: "2026-06-28", index: 80.6 },
          { date: "2026-06-29", index: 67.7 },
          { date: "2026-06-30", index: 62.6 }
        ] satisfies IndexedPoint[]
      },
      {
        name: "Grow a Garden",
        slug: "grow-a-garden-7436755782",
        color: "#7c3aed",
        points: [
          { date: "2026-06-06", index: 222.1 },
          { date: "2026-06-07", index: 125.1 },
          { date: "2026-06-08", index: 94.4 },
          { date: "2026-06-09", index: 89.2 },
          { date: "2026-06-10", index: 97.0 },
          { date: "2026-06-11", index: 102.3 },
          { date: "2026-06-12", index: 112.4 },
          { date: "2026-06-13", index: 136.5 },
          { date: "2026-06-14", index: 118.1 },
          { date: "2026-06-15", index: 90.2 },
          { date: "2026-06-16", index: 88.2 },
          { date: "2026-06-17", index: 88.7 },
          { date: "2026-06-18", index: 80.8 },
          { date: "2026-06-19", index: 82.0 },
          { date: "2026-06-20", index: 117.5 },
          { date: "2026-06-21", index: 110.4 },
          { date: "2026-06-22", index: 89.5 },
          { date: "2026-06-23", index: 83.6 },
          { date: "2026-06-24", index: 85.9 },
          { date: "2026-06-25", index: 80.2 },
          { date: "2026-06-26", index: 78.7 },
          { date: "2026-06-27", index: 104.8 },
          { date: "2026-06-28", index: 85.7 },
          { date: "2026-06-29", index: 70.4 },
          { date: "2026-06-30", index: 66.5 }
        ] satisfies IndexedPoint[]
      }
    ] satisfies IndexedGameSeries[]
  },

  endnote:
    "This story uses Bloxodes' repeated readings of public Roblox player counts from June 6–30, averaged by day. The numbers show players online at the same time, not unique people. Events and news are linked to their original sources. A few earlier June collection days were incomplete, so the charts begin on June 6."
} as const;
