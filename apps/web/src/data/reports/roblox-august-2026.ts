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

const augustDates = Array.from({ length: 31 }, (_, index) => `2026-08-${String(index + 1).padStart(2, "0")}`);

function toDailyPoints(values: readonly number[]): DailyChartPoint[] {
  if (values.length !== augustDates.length) throw new Error("August report series must contain 31 values");
  return augustDates.map((date, index) => ({ date, players: values[index] }));
}

function toIndexedPoints(values: readonly number[]): IndexedPoint[] {
  if (values.length !== augustDates.length) throw new Error("August report series must contain 31 values");
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  return augustDates.map((date, index) => ({ date, index: Number(((values[index] / average) * 100).toFixed(1)) }));
}

const adoptMeDaily = [
  183797, 154195, 141195, 132971, 109596, 146828, 155318, 187882, 151385, 142628, 139068,
  143085, 128448, 242862, 288155, 285253, 290746, 290151, 336766, 176509, 221352, 298783,
  261786, 243503, 233684, 229239, 227508, 253982, 396858, 332377, 275461
];

const doorsDaily = [
  18612, 18672, 17617, 18065, 15107, 17178, 18945, 18677, 18553, 17667, 19760, 19046, 16371,
  23215, 21202, 22024, 20326, 19470, 19289, 18697, 21606, 22063, 23771, 20621, 20107, 21780,
  22755, 49820, 84558, 77509, 59117
];

const towerOfHellDaily = [
  30875, 30450, 30725, 32126, 28806, 39212, 36123, 34697, 33470, 34520, 36104, 36936, 29110,
  46113, 38961, 39127, 39834, 40450, 39954, 36118, 43363, 41082, 43192, 42832, 42163, 49256,
  45184, 47628, 47679, 48397, 43488
];

const bloxFruitsDaily = [
  469581, 439481, 303602, 296589, 278599, 322357, 357865, 375581, 373131, 326725, 316763, 327699,
  295012, 373324, 398754, 398480, 348131, 335480, 346725, 303355, 337537, 365687, 380682, 315293,
  306179, 325182, 324232, 350389, 396145, 414512, 332026
];

const growAGardenTwoDaily = [
  548047, 470101, 476975, 471227, 437913, 481924, 491542, 478538, 464799, 438976, 395404, 415561,
  453417, 396327, 345221, 302177, 227677, 178535, 162072, 54752, 66130, 60681, 53666, 48090,
  25559, 29346, 27947, 28554, 29422, 28759, 26166
];

const murderMysteryTwoDaily = [
  491641, 502465, 469878, 482999, 474690, 667930, 655162, 725840, 810935, 869164, 901560, 953186,
  905956, 1153207, 982322, 1102976, 1072519, 563339, 486851, 673499, 690158, 658773, 671872,
  314285, 297961, 293548, 281838, 283010, 316358, 324709, 269191
];

const animalHospitalDaily = [
  315846, 308547, 246482, 231296, 196969, 212207, 217064, 300936, 327607, 258825, 232522, 206712,
  173176, 208632, 210330, 206768, 166326, 140378, 126548, 122780, 131054, 186448, 206709, 152778,
  140271, 125102, 112921, 109106, 126426, 121888, 82568
];

export const robloxAugust2026Report = {
  slug: "roblox-august-2026",
  title: "Roblox Stats August 2026 Report: Adopt Me! Rose While Big Hits Cooled",
  seoTitle: "Roblox Stats August 2026 Report: Adopt Me! Rose While Big Hits Cooled",
  seoDescription:
    "August 2026 Roblox stats report covering Adopt Me!'s late-month rise, different paths for older games, selected genre movement, and major cool-downs.",
  subtitle: "Adopt Me! gained ground as DOORS and Tower of Hell climbed, while several large hits cooled into the final week.",
  dataWindowLabel: "August 1–31, 2026",
  publishedAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",

  featureImage: {
    src: "/images/reports/roblox-august-2026.png",
    alt: "August 2026 Roblox stats report cover showing Adopt Me!'s uneven daily path rising to its strongest seven-day stretch at the end of the month.",
    month: "August 2026",
    reportLabel: "Roblox August Stats Report",
    headlineLines: ["Adopt Me! rose as", "big hits cooled"],
    metric: "278,444 average players online · strongest 7 days",
    chartSeriesPath: "adoptMe.points",
    chartValueKey: "players",
    accent: "#2563eb"
  },

  adoptMe: {
    slug: "adopt-me-383310974",
    points: toDailyPoints(adoptMeDaily),
    markers: [
      { date: "2026-08-14", shortLabel: "Update", label: "Adopt Me! weekly update window" },
      { date: "2026-08-28", shortLabel: "Update", label: "Adopt Me! weekly update window" }
    ] satisfies EventMarker[]
  },

  establishedGames: {
    markers: [
      { date: "2026-08-07", shortLabel: "Summer", label: "Tower of Hell Seaside Summer event" },
      { date: "2026-08-28", shortLabel: "Archives", label: "DOORS The Archives Update" }
    ] satisfies EventMarker[],
    series: [
      {
        name: "Adopt Me!",
        slug: "adopt-me-383310974",
        color: "#2563eb",
        points: toIndexedPoints(adoptMeDaily)
      },
      {
        name: "DOORS",
        slug: "doors-2440500124",
        color: "#7c3aed",
        points: toIndexedPoints(doorsDaily)
      },
      {
        name: "Tower of Hell",
        slug: "tower-of-hell-703124385",
        color: "#0f766e",
        points: toIndexedPoints(towerOfHellDaily)
      },
      {
        name: "Blox Fruits",
        slug: "blox-fruits-994732206",
        color: "#c2410c",
        points: toIndexedPoints(bloxFruitsDaily)
      }
    ] satisfies IndexedGameSeries[]
  },

  genreMovement: [
    { genre: "RPG", stableGames: 14, typicalChangePercent: 1.9, shareRosePercent: 54, combinedDailyAverage: 473866 },
    {
      genre: "Roleplay & Avatar Sim",
      stableGames: 35,
      typicalChangePercent: 1.6,
      shareRosePercent: 54,
      combinedDailyAverage: 1233866
    },
    { genre: "Shooter", stableGames: 17, typicalChangePercent: -2.0, shareRosePercent: 42, combinedDailyAverage: 356489 },
    { genre: "Action", stableGames: 30, typicalChangePercent: -2.0, shareRosePercent: 25, combinedDailyAverage: 583785 },
    {
      genre: "Obby & Platformer",
      stableGames: 18,
      typicalChangePercent: -2.3,
      shareRosePercent: 42,
      combinedDailyAverage: 149040
    },
    { genre: "Adventure", stableGames: 13, typicalChangePercent: -4.0, shareRosePercent: 46, combinedDailyAverage: 121236 },
    { genre: "Simulation", stableGames: 165, typicalChangePercent: -7.3, shareRosePercent: 29, combinedDailyAverage: 2583440 },
    { genre: "Puzzle", stableGames: 5, typicalChangePercent: -7.6, shareRosePercent: 29, combinedDailyAverage: 16223 },
    {
      genre: "Party & Casual",
      stableGames: 21,
      typicalChangePercent: -10.1,
      shareRosePercent: 38,
      combinedDailyAverage: 154240
    },
    {
      genre: "Sports & Racing",
      stableGames: 12,
      typicalChangePercent: -14.8,
      shareRosePercent: 17,
      combinedDailyAverage: 172579
    },
    { genre: "Survival", stableGames: 50, typicalChangePercent: -14.9, shareRosePercent: 42, combinedDailyAverage: 1724616 },
    { genre: "Strategy", stableGames: 12, typicalChangePercent: -25.2, shareRosePercent: 8, combinedDailyAverage: 179647 }
  ] satisfies GenreMovementRow[],

  coolDownGames: {
    markers: [
      { date: "2026-08-22", shortLabel: "Muffin", label: "Grow a Garden 2 Muffin Bake event" },
      { date: "2026-08-23", shortLabel: "Summer ends", label: "Murder Mystery 2 Summer 2026 event ends" }
    ] satisfies EventMarker[],
    series: [
      {
        name: "Grow a Garden 2",
        slug: "grow-a-garden-2",
        color: "#c2410c",
        points: toIndexedPoints(growAGardenTwoDaily)
      },
      {
        name: "Murder Mystery 2",
        slug: "murder-mystery-2-66654135",
        color: "#7c3aed",
        points: toIndexedPoints(murderMysteryTwoDaily)
      },
      {
        name: "Animal Hospital",
        slug: "animal-hospital",
        color: "#0f766e",
        points: toIndexedPoints(animalHospitalDaily)
      }
    ] satisfies IndexedGameSeries[]
  },

  endnote:
    "We used repeated Bloxodes readings of public Roblox player counts from August 1–31, 2026, averaged by day. The figures show players online at the same time, not unique people, and cover a selected set of games that reached meaningful scale during the month. Events and platform announcements are linked to their original sources; timing alone does not show what caused a rise or fall."
} as const;
