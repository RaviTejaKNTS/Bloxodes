export type DailyChartPoint = { date: string; players: number };
export type EventMarker = { date: string; shortLabel: string; label: string; sourceUrl: string };
export type GenreMovementRow = {
  genre: string;
  stableGames: number;
  typicalChangePercent: number;
  shareRosePercent: number;
  combinedDailyAverage: number;
};
export type IndexedPoint = { date: string; index: number };
export type IndexedGameSeries = { name: string; slug: string; color: string; points: IndexedPoint[] };

const dates = Array.from({ length: 26 }, (_, index) => `2026-09-${String(index + 5).padStart(2, "0")}`);

function toDailyPoints(values: readonly number[]): DailyChartPoint[] {
  if (values.length !== dates.length) throw new Error("September report series must contain 26 values");
  return dates.map((date, index) => ({ date, players: values[index] }));
}

function toIndexedPoints(values: readonly number[]): IndexedPoint[] {
  if (values.length !== dates.length) throw new Error("September report series must contain 26 values");
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  return dates.map((date, index) => ({ date, index: Number(((values[index] / average) * 100).toFixed(1)) }));
}

const animeDiceDaily = [
  4868.833333333333,
  8806.083333333334,
  11191.166666666668,
  14042.166666666668,
  16911.76923076923,
  21112.333333333332,
  25825.083333333332,
  28576.666666666668,
  39164.083333333336,
  40889.42857142857,
  39137.307692307695,
  36179.846153846156,
  37107.692307692305,
  37071.857142857145,
  36645.5,
  45262.642857142855,
  43006.75,
  45302.916666666664,
  45681.916666666664,
  47168.083333333336,
  48275.75,
  50336.083333333336,
  53457.153846153844,
  64874.75,
  67720.33333333333,
  68076.33333333333
];

const lumberTycoonDaily = [
  1758.5,
  1950.4166666666667,
  1671,
  1444.5384615384614,
  1418.3333333333333,
  1449.9166666666667,
  1551.6666666666667,
  1986.1538461538462,
  2766.3333333333335,
  2039.8461538461538,
  2286,
  2150.6153846153848,
  2465.4615384615386,
  15620.785714285714,
  19215.384615384613,
  15187.538461538463,
  8588.75,
  6927.833333333333,
  6567,
  6419.666666666667,
  9549.083333333334,
  26955.583333333332,
  21645.384615384613,
  11614.166666666668,
  7336.833333333333,
  7036.166666666667
];

const jailbreakDaily = [
  9865.083333333334,
  10979.916666666668,
  9154,
  7242,
  6657.083333333333,
  6401.083333333333,
  6979.666666666667,
  9329.846153846154,
  10158,
  6549.307692307692,
  6120.214285714285,
  5708.076923076923,
  6333.461538461538,
  22186.5,
  30608.333333333332,
  25204.64285714286,
  15528.75,
  14310.666666666668,
  11318.333333333332,
  11133.833333333332,
  14087.23076923077,
  19264.666666666668,
  17977.75,
  10718.416666666666,
  7613,
  7226.923076923077
];

const bloxFruitsDaily = [
  638566.1666666666,
  630582.25,
  444612.4166666667,
  353332.46153846156,
  331344.1666666667,
  331188.1666666667,
  359945.75,
  422303.8461538461,
  420029.25,
  287974.23076923075,
  272432.78571428574,
  265006.3076923077,
  255731.38461538462,
  273801.78571428574,
  362089,
  348772.5,
  243079.58333333334,
  213914.75,
  195597,
  192614.75,
  220887.41666666666,
  285154.6153846154,
  284804.1666666667,
  194134.5,
  187080.08333333334,
  181557.58333333334
];

const animalHospitalDaily = [
  132455.33333333334,
  164025.66666666666,
  119471.08333333333,
  88943.69230769231,
  81037.16666666667,
  76446.16666666667,
  84252.16666666667,
  111070.76923076923,
  105957.25,
  55107.53846153846,
  46423.769230769234,
  45529,
  42549.53846153846,
  48203.42857142857,
  85015.38461538461,
  82800.46153846153,
  43537.75,
  37398.75,
  35579.166666666664,
  35765.416666666664,
  45316.833333333336,
  60740.25,
  58121.92307692308,
  32258.416666666668,
  28566.833333333332,
  27452.25
];

const stealABrainrotDaily = [
  142306.83333333334,
  122295.33333333333,
  82731,
  138820.15384615384,
  77910.83333333333,
  73773.33333333333,
  83868.33333333333,
  147812.07692307694,
  107812.16666666667,
  81640.92307692308,
  143803.23076923078,
  91351.42857142857,
  82446.69230769231,
  106746.57142857143,
  158889.75,
  121604.76923076923,
  83372.75,
  111993.07692307692,
  50306.75,
  59023.75,
  91471.41666666667,
  168292.58333333334,
  168785.46153846153,
  107113.58333333333,
  158581.08333333334,
  95970.91666666667
];

export const robloxSeptember2026Report = {
  slug: "roblox-september-2026",
  title: "Roblox stats September 2026 report: Anime Dice kept climbing",
  seoTitle: "Roblox stats September 2026 report: Anime Dice kept climbing",
  seoDescription: "September 2026 Roblox stats report on Anime Dice's sustained climb, The Hunt's anniversary waves, genre trends, cooling hits, and platform news.",
  subtitle: "Anime Dice held its gains, The Hunt brought older games into focus, and several bigger hits lost ground.",
  dataWindowLabel: "September 2026 · Player trends from September 5 through 30",
  publishedAt: "2026-10-02T18:54:23.888Z",
  updatedAt: "2026-10-02T18:54:23.888Z",
  featureImage: {
    src: "/images/reports/roblox-september-2026.png",
    alt: "September 2026 Roblox stats report showing Anime Dice's daily average rising to a strongest seven-day average of 57,130 players online.",
    month: "September 2026",
    reportLabel: "Roblox September Stats Report",
    headlineLines: ["Anime Dice", "kept climbing"],
    metric: "57,130 average players · best 7 days",
    chartSeriesPath: "lead.points",
    chartValueKey: "players",
    accent: "#2563eb"
  },
  lead: {
    universeId: 10708913337,
    slug: "anime-dice",
    points: toDailyPoints(animeDiceDaily),
    markers: [
      { date: "2026-09-12", shortLabel: "Update 4", label: "Anime Dice Update 4 event begins", sourceUrl: "https://www.roblox.com/events/5130353600144474748" },
      { date: "2026-09-27", shortLabel: "Update 6", label: "Anime Dice scheduled Update 6 event begins", sourceUrl: "https://www.roblox.com/events/6257923988715078223" }
    ] satisfies EventMarker[]
  },
  anniversaryGames: {
    markers: [
      { date: "2026-09-17", shortLabel: "Hunt starts", label: "The Hunt: Roblox 20 begins", sourceUrl: "https://about.roblox.com/newsroom/2026/09/join-the-hunt-roblox-20" },
      { date: "2026-09-28", shortLabel: "Hunt ends", label: "The Hunt: Roblox 20 ends", sourceUrl: "https://about.roblox.com/newsroom/2026/09/join-the-hunt-roblox-20" }
    ] satisfies EventMarker[],
    series: [
      { name: "Lumber Tycoon 2", slug: "lumber-tycoon-2-2471084", color: "#0f766e", points: toIndexedPoints(lumberTycoonDaily) },
      { name: "Jailbreak", slug: "jailbreak-245662005", color: "#7c3aed", points: toIndexedPoints(jailbreakDaily) }
    ] satisfies IndexedGameSeries[]
  },
  genreMovement: [
  {
    "genre": "Sports & Racing",
    "stableGames": 12,
    "typicalChangePercent": 3.6,
    "shareRosePercent": 79,
    "combinedDailyAverage": 172753
  },
  {
    "genre": "Shooter",
    "stableGames": 16,
    "typicalChangePercent": -1.0,
    "shareRosePercent": 37,
    "combinedDailyAverage": 321390
  },
  {
    "genre": "Action",
    "stableGames": 35,
    "typicalChangePercent": -2.6,
    "shareRosePercent": 32,
    "combinedDailyAverage": 545802
  },
  {
    "genre": "Roleplay & Avatar Sim",
    "stableGames": 31,
    "typicalChangePercent": -3.3,
    "shareRosePercent": 32,
    "combinedDailyAverage": 900558
  },
  {
    "genre": "Party & Casual",
    "stableGames": 12,
    "typicalChangePercent": -3.9,
    "shareRosePercent": 32,
    "combinedDailyAverage": 100424
  },
  {
    "genre": "Survival",
    "stableGames": 43,
    "typicalChangePercent": -6.7,
    "shareRosePercent": 5,
    "combinedDailyAverage": 969041
  },
  {
    "genre": "Simulation",
    "stableGames": 113,
    "typicalChangePercent": -7.3,
    "shareRosePercent": 16,
    "combinedDailyAverage": 3282691
  },
  {
    "genre": "Adventure",
    "stableGames": 12,
    "typicalChangePercent": -8.9,
    "shareRosePercent": 32,
    "combinedDailyAverage": 112448
  },
  {
    "genre": "Obby & Platformer",
    "stableGames": 13,
    "typicalChangePercent": -10.6,
    "shareRosePercent": 11,
    "combinedDailyAverage": 124013
  },
  {
    "genre": "Strategy",
    "stableGames": 13,
    "typicalChangePercent": -17.5,
    "shareRosePercent": 26,
    "combinedDailyAverage": 95916
  },
  {
    "genre": "RPG",
    "stableGames": 15,
    "typicalChangePercent": -18.3,
    "shareRosePercent": 0,
    "combinedDailyAverage": 429042
  }
] satisfies GenreMovementRow[],
  coolDownGames: {
    markers: [] satisfies EventMarker[],
    series: [
      { name: "Blox Fruits", slug: "blox-fruits-994732206", color: "#c2410c", points: toIndexedPoints(bloxFruitsDaily) },
      { name: "Animal Hospital", slug: "animal-hospital", color: "#7c3aed", points: toIndexedPoints(animalHospitalDaily) },
      { name: "Steal a Brainrot", slug: "steal-a-brainrot-7709344486", color: "#0f766e", points: toIndexedPoints(stealABrainrotDaily) }
    ] satisfies IndexedGameSeries[]
  },
  endnote: "We averaged Bloxodes' repeated readings of public Roblox player counts from September 5 through 30, 2026. They show players online at the same time, not unique people, across a selected set of games. September 1 through 4 were excluded from trend calculations because fewer selected games had readings. Event dates and news link to their sources; timing alone does not establish what caused a rise or fall."
} as const;
