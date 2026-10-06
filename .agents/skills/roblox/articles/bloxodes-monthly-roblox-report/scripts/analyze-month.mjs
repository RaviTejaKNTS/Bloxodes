#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";

function usage() {
  console.log(`Usage:
  node analyze-month.mjs --month YYYY-MM --input raw.json --output analysis.json

Options:
  --min-peak <number>          Candidate-game monthly peak threshold (default: 10000)
  --date-coverage <ratio>      Minimum share of the best-observed date (default: 0.80)
  --game-coverage <ratio>      Minimum usable dates per stable game (default: 0.88)
  --min-genre-games <number>   Minimum stable games per genre (default: 5)
  --help                       Show this message

Input contract:
  {"daily":[],"universes":[],"events":[],"updates":[]}`);
}

function parseArgs(argv) {
  const options = {
    minPeak: 10_000,
    dateCoverage: 0.8,
    gameCoverage: 0.88,
    minGenreGames: 5
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--help") {
      usage();
      process.exit(0);
    }
    if (flag === "--month") options.month = value;
    else if (flag === "--input") options.input = value;
    else if (flag === "--output") options.output = value;
    else if (flag === "--min-peak") options.minPeak = Number(value);
    else if (flag === "--date-coverage") options.dateCoverage = Number(value);
    else if (flag === "--game-coverage") options.gameCoverage = Number(value);
    else if (flag === "--min-genre-games") options.minGenreGames = Number(value);
    else throw new Error(`Unknown option: ${flag}`);
    index += 1;
  }

  if (!/^\d{4}-\d{2}$/.test(options.month ?? "")) throw new Error("--month must use YYYY-MM");
  if (!options.input) throw new Error("--input is required");
  if (!options.output) throw new Error("--output is required");
  if (!Number.isFinite(options.minPeak) || options.minPeak < 0) throw new Error("--min-peak must be non-negative");
  for (const key of ["dateCoverage", "gameCoverage"]) {
    if (!Number.isFinite(options[key]) || options[key] <= 0 || options[key] > 1) {
      throw new Error(`--${key === "dateCoverage" ? "date-coverage" : "game-coverage"} must be between 0 and 1`);
    }
  }
  if (!Number.isInteger(options.minGenreGames) || options.minGenreGames < 1) {
    throw new Error("--min-genre-games must be a positive integer");
  }
  return options;
}

function monthDates(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: lastDay }, (_, index) => {
    return new Date(Date.UTC(year, monthNumber - 1, index + 1)).toISOString().slice(0, 10);
  });
}

function longestContiguousRun(allDates, accepted) {
  let best = [];
  let current = [];
  for (const date of allDates) {
    if (accepted.has(date)) {
      current.push(date);
      if (current.length >= best.length) best = [...current];
    } else {
      current = [];
    }
  }
  return best;
}

const mean = (values) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function standardDeviation(values) {
  const average = mean(values);
  if (average == null) return null;
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function cleanName(value) {
  return String(value ?? "")
    .replace(/\[[^\]]*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function rowAverage(row) {
  const value = row.avg_playing ?? row.average_playing ?? row.playing;
  return value == null || !Number.isFinite(Number(value)) ? null : Number(value);
}

function rowPeak(row) {
  const values = [row.peak_playing, row.playing, row.avg_playing]
    .filter((value) => value != null && Number.isFinite(Number(value)))
    .map(Number);
  return values.length ? Math.max(...values) : null;
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function overlapsMonth(row, startDate, endDate) {
  const start = String(row.start_utc ?? row.updated_at_api ?? row.detected_at ?? "").slice(0, 10);
  const end = String(row.end_utc ?? row.updated_at_api ?? row.detected_at ?? start).slice(0, 10);
  return Boolean(start && end && start <= endDate && end >= startDate);
}

function summarizeSeries(rows, analysisDates) {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map(sorted.map((row) => [row.date, row]));
  const values = sorted.map((row) => row.average);
  const weeklyComparisons = [];

  for (const row of sorted) {
    const previous = byDate.get(addDays(row.date, -7));
    if (!previous || previous.average <= 0) continue;
    weeklyComparisons.push({
      date: row.date,
      priorDate: previous.date,
      percent: ((row.average - previous.average) / previous.average) * 100,
      absolute: row.average - previous.average
    });
  }

  const rollingWindows = [];
  for (let endIndex = 6; endIndex < analysisDates.length; endIndex += 1) {
    const dates = analysisDates.slice(endIndex - 6, endIndex + 1);
    const windowRows = dates.map((date) => byDate.get(date)).filter(Boolean);
    if (windowRows.length < 6) continue;
    rollingWindows.push({
      start: dates[0],
      end: dates[6],
      average: mean(windowRows.map((row) => row.average)),
      observations: windowRows.length
    });
  }

  const weekdayValues = new Map();
  for (const row of sorted) {
    const weekday = new Date(`${row.date}T00:00:00Z`).toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC"
    });
    const valuesForDay = weekdayValues.get(weekday) ?? [];
    valuesForDay.push(row.average);
    weekdayValues.set(weekday, valuesForDay);
  }

  const weekdayAverages = [...weekdayValues]
    .map(([weekday, weekdayRows]) => ({ weekday, average: mean(weekdayRows) }))
    .sort((left, right) => right.average - left.average);
  const peak = [...sorted].sort((left, right) => right.average - left.average)[0] ?? null;
  const low = [...sorted].sort((left, right) => left.average - right.average)[0] ?? null;
  const strongestRolling = [...rollingWindows].sort((left, right) => right.average - left.average)[0] ?? null;
  const weakestRolling = [...rollingWindows].sort((left, right) => left.average - right.average)[0] ?? null;
  const average = mean(values);

  return {
    observations: sorted.length,
    average,
    median: median(values),
    peak,
    low,
    coefficientOfVariation: average > 0 ? standardDeviation(values) / average : null,
    medianWeeklyPercent: median(weeklyComparisons.map((pair) => pair.percent)),
    meanWeeklyAbsolute: mean(weeklyComparisons.map((pair) => pair.absolute)),
    positiveWeeklyShare: weeklyComparisons.length
      ? weeklyComparisons.filter((pair) => pair.percent > 0).length / weeklyComparisons.length
      : null,
    weeklyComparisons,
    strongestRolling,
    weakestRolling,
    rollingLiftPercent:
      strongestRolling && weakestRolling && weakestRolling.average > 0
        ? ((strongestRolling.average - weakestRolling.average) / weakestRolling.average) * 100
        : null,
    weekdayAverages,
    topWeekday: weekdayAverages[0] ?? null,
    daily: sorted
  };
}

function compactGame(game) {
  return {
    universeId: game.universeId,
    name: game.name,
    slug: game.slug,
    genre: game.genre,
    subgenre: game.subgenre,
    createdAt: game.createdAt,
    observations: game.observations,
    average: game.average,
    peak: game.peak,
    low: game.low,
    coefficientOfVariation: game.coefficientOfVariation,
    medianWeeklyPercent: game.medianWeeklyPercent,
    meanWeeklyAbsolute: game.meanWeeklyAbsolute,
    positiveWeeklyShare: game.positiveWeeklyShare,
    strongestRolling: game.strongestRolling,
    weakestRolling: game.weakestRolling,
    rollingLiftPercent: game.rollingLiftPercent,
    weekdayAverages: game.weekdayAverages,
    topWeekday: game.topWeekday,
    events: game.events,
    updates: game.updates,
    daily: game.daily
  };
}

const options = parseArgs(process.argv.slice(2));
const requestedDates = monthDates(options.month);
const monthStart = requestedDates[0];
const monthEnd = requestedDates.at(-1);
const raw = JSON.parse(await readFile(resolve(options.input), "utf8"));

for (const key of ["daily", "universes", "events", "updates"]) {
  if (!Array.isArray(raw[key])) throw new Error(`Input field '${key}' must be an array`);
}

const dailyInMonth = raw.daily.filter((row) => {
  const date = String(row.stat_date ?? "");
  return date >= monthStart && date <= monthEnd;
});

const candidateIds = new Set();
for (const row of dailyInMonth) {
  const peak = rowPeak(row);
  if (peak != null && peak >= options.minPeak) candidateIds.add(String(row.universe_id));
}
if (!candidateIds.size) throw new Error(`No games met the ${options.minPeak} monthly peak threshold`);

const observedCountByDate = new Map(requestedDates.map((date) => [date, 0]));
for (const row of dailyInMonth) {
  if (!candidateIds.has(String(row.universe_id)) || rowAverage(row) == null) continue;
  const date = String(row.stat_date);
  observedCountByDate.set(date, (observedCountByDate.get(date) ?? 0) + 1);
}

const maxObservedGames = Math.max(...observedCountByDate.values());
const acceptedDates = new Set(
  [...observedCountByDate]
    .filter(([, count]) => count >= maxObservedGames * options.dateCoverage)
    .map(([date]) => date)
);
const analysisDates = longestContiguousRun(requestedDates, acceptedDates);
if (analysisDates.length < 14) {
  throw new Error(`Only ${analysisDates.length} contiguous well-observed dates were found; at least 14 are required`);
}
const analysisDateSet = new Set(analysisDates);
const stableObservationMinimum = Math.ceil(analysisDates.length * options.gameCoverage);

const universeById = new Map(raw.universes.map((row) => [String(row.universe_id), row]));
const rowsByUniverse = new Map();
for (const row of dailyInMonth) {
  const universeId = String(row.universe_id);
  const average = rowAverage(row);
  if (!candidateIds.has(universeId) || !analysisDateSet.has(String(row.stat_date)) || average == null) continue;
  const rows = rowsByUniverse.get(universeId) ?? [];
  rows.push({
    date: String(row.stat_date),
    average,
    peak: rowPeak(row),
    samples: row.sample_count == null ? null : Number(row.sample_count),
    finalized: row.is_finalized == null ? null : Boolean(row.is_finalized)
  });
  rowsByUniverse.set(universeId, rows);
}

const eventsByUniverse = new Map();
for (const event of raw.events.filter((row) => overlapsMonth(row, monthStart, monthEnd))) {
  const key = String(event.universe_id);
  const rows = eventsByUniverse.get(key) ?? [];
  rows.push(event);
  eventsByUniverse.set(key, rows);
}

const updatesByUniverse = new Map();
for (const update of raw.updates.filter((row) => overlapsMonth(row, monthStart, monthEnd))) {
  const key = String(update.universe_id);
  const rows = updatesByUniverse.get(key) ?? [];
  rows.push(update);
  updatesByUniverse.set(key, rows);
}

const games = [];
for (const [universeId, rows] of rowsByUniverse) {
  if (rows.length < stableObservationMinimum) continue;
  const metadata = universeById.get(universeId);
  games.push({
    universeId: Number(universeId),
    name: cleanName(metadata?.name ?? universeId),
    rawName: metadata?.name ?? universeId,
    slug: metadata?.slug ?? null,
    genre: metadata?.genre_l1 || "Uncategorized",
    subgenre: metadata?.genre_l2 || "Uncategorized",
    createdAt: metadata?.created_at_api ?? null,
    events: eventsByUniverse.get(universeId) ?? [],
    updates: updatesByUniverse.get(universeId) ?? [],
    ...summarizeSeries(rows, analysisDates)
  });
}

const stableIds = new Set(games.map((game) => String(game.universeId)));
const genreRows = new Map();
for (const date of analysisDates) {
  const totals = new Map();
  for (const row of dailyInMonth) {
    if (String(row.stat_date) !== date || !stableIds.has(String(row.universe_id))) continue;
    const average = rowAverage(row);
    if (average == null) continue;
    const genre = universeById.get(String(row.universe_id))?.genre_l1 || "Uncategorized";
    totals.set(genre, (totals.get(genre) ?? 0) + average);
  }
  for (const [genre, average] of totals) {
    const rows = genreRows.get(genre) ?? [];
    rows.push({ date, average, peak: null, samples: null, finalized: null });
    genreRows.set(genre, rows);
  }
}

const genreMomentum = [...genreRows]
  .map(([genre, rows]) => ({
    genre,
    games: games.filter((game) => game.genre === genre).length,
    ...summarizeSeries(rows, analysisDates)
  }))
  .filter((genre) => genre.games >= options.minGenreGames)
  .sort((left, right) => (right.medianWeeklyPercent ?? -Infinity) - (left.medianWeeklyPercent ?? -Infinity));

const minimumWeeklyComparisons = Math.max(4, Math.floor((analysisDates.length - 7) / 2));
const meaningful = games.filter(
  (game) => game.average >= 5_000 && game.weeklyComparisons.length >= minimumWeeklyComparisons
);
const legacyCutoff = `${Number(options.month.slice(0, 4)) - 4}-${options.month.slice(5)}-01`;
const top = (rows, count = 30) => rows.slice(0, count).map(compactGame);

const output = {
  requestedPeriod: { month: options.month, startDate: monthStart, endDate: monthEnd },
  analysisWindow: {
    startDate: analysisDates[0],
    endDate: analysisDates.at(-1),
    days: analysisDates.length,
    dates: analysisDates
  },
  internalDataQuality: {
    candidateGameCount: candidateIds.size,
    stableGameCount: games.length,
    stableObservationMinimum,
    maxObservedGamesOnOneDate: maxObservedGames,
    excludedDates: requestedDates.filter((date) => !analysisDateSet.has(date)).map((date) => ({
      date,
      observedGames: observedCountByDate.get(date) ?? 0
    })),
    thresholds: {
      minPeak: options.minPeak,
      dateCoverage: options.dateCoverage,
      gameCoverage: options.gameCoverage,
      minGenreGames: options.minGenreGames
    }
  },
  method: {
    primaryTrend: "Median percent change against the same weekday seven days earlier",
    persistence: "Share of usable same-weekday comparisons that increased",
    wave: "Strongest and weakest seven-day rolling averages with at least six observed days",
    warning: "Timing is descriptive and does not prove causation"
  },
  genreMomentum,
  genreScale: [...genreMomentum].sort((left, right) => (right.average ?? 0) - (left.average ?? 0)),
  risingByAbsolute: top([...meaningful].sort((left, right) => right.meanWeeklyAbsolute - left.meanWeeklyAbsolute)),
  risingByPersistence: top(
    [...meaningful]
      .filter((game) => game.medianWeeklyPercent > 3)
      .sort(
        (left, right) =>
          right.positiveWeeklyShare - left.positiveWeeklyShare ||
          right.medianWeeklyPercent - left.medianWeeklyPercent
      )
  ),
  fallingByAbsolute: top([...meaningful].sort((left, right) => left.meanWeeklyAbsolute - right.meanWeeklyAbsolute)),
  fallingByPersistence: top(
    [...meaningful]
      .filter((game) => game.medianWeeklyPercent < -3)
      .sort(
        (left, right) =>
          left.positiveWeeklyShare - right.positiveWeeklyShare ||
          left.medianWeeklyPercent - right.medianWeeklyPercent
      )
  ),
  biggestSevenDayWaves: top(
    [...meaningful].sort((left, right) => right.rollingLiftPercent - left.rollingLiftPercent)
  ),
  mostVolatile: top(
    [...meaningful].sort((left, right) => right.coefficientOfVariation - left.coefficientOfVariation)
  ),
  legacyComebacks: top(
    [...meaningful]
      .filter((game) => game.createdAt && game.createdAt < legacyCutoff && game.medianWeeklyPercent > 3)
      .sort((left, right) => right.meanWeeklyAbsolute - left.meanWeeklyAbsolute),
    20
  ),
  games: games
    .sort((left, right) => right.average - left.average)
    .map(compactGame)
};

await mkdir(dirname(resolve(options.output)), { recursive: true });
await writeFile(resolve(options.output), `${JSON.stringify(output, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      output: resolve(options.output),
      analysisWindow: output.analysisWindow,
      candidateGames: candidateIds.size,
      stableGames: games.length,
      genres: genreMomentum.length
    },
    null,
    2
  )
);
