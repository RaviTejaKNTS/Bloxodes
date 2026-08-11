import "../shared/load-env";
import * as cheerio from "cheerio";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { formatPuzzleDate, shiftPuzzleDate } from "@/lib/puzzle-dates";
import {
  ALL_PUZZLE_SLUGS,
  formatUnknownError,
  isSamePuzzleAnswer,
  resolveWordlePuzzleNumber,
  type AnyRecord,
  type PuzzleSlug
} from "./pipeline-utils";

type PuzzleId = string | number | null;
type PuzzleGroup =
  | "early-nyt"
  | "beebom"
  | "beebom-with-early"
  | "late-nyt"
  | "linkedin"
  | "late-nyt-and-linkedin"
  | "all";

type PuzzleAnswerResult = {
  puzzleSlug: PuzzleSlug;
  answerDate: string;
  puzzleId?: string | number | null;
  sourceUrl: string;
  fetchedAt: string;
  extractedFrom: string;
  answerSummary: AnyRecord;
  payload: AnyRecord;
};

const NYT_BOT_USER_AGENT = "Mozilla/5.0 (compatible; BloxodesPuzzleBot/1.0)";
const GENERIC_USER_AGENT = "Mozilla/5.0 (compatible; BloxodesPuzzleBot/1.0)";
const WORDLE_SOURCE_URL = "https://www.nytimes.com/svc/wordle/v2";
const CONNECTIONS_SOURCE_URL = "https://www.nytimes.com/svc/connections/v2";
const STRANDS_SOURCE_URL = "https://www.nytimes.com/svc/strands/v2";
const SPELLING_BEE_SOURCE_URL = "https://www.nytimes.com/puzzles/spelling-bee";
const LETTER_BOXED_SOURCE_URL = "https://www.nytimes.com/puzzles/letter-boxed";
const SUDOKU_SOURCE_URL = "https://www.nytimes.com/puzzles/sudoku/easy";
const PIPS_SOURCE_URL = "https://www.nytimes.com/svc/pips/v1";
const CONTEXTO_SOURCE_URL = "https://beebom.com/puzzle/contexto-answer-today/";
const LETROSO_SOURCE_URL = "https://beebom.com/puzzle/letroso-answer-today/";
const VOYAGER_QUERY_ID = "voyagerIdentityDashGames.882556aa369e9517b26dadb09a426063";
const VOYAGER_BASE_URL = "https://www.linkedin.com/voyager/api/graphql";

const ALL_PUZZLES = ALL_PUZZLE_SLUGS;

const PUZZLE_GROUPS: Record<PuzzleGroup, PuzzleSlug[]> = {
  "early-nyt": ["wordle", "connections", "strands", "sudoku", "pips"],
  beebom: ["contexto", "letroso"],
  "beebom-with-early": ["contexto", "letroso", "wordle", "connections", "strands", "sudoku", "pips"],
  "late-nyt": ["spelling-bee", "letter-boxed"],
  linkedin: ["linkedin-zip", "linkedin-crossclimb", "linkedin-queens", "linkedin-tango", "linkedin-mini-sudoku"],
  "late-nyt-and-linkedin": ["spelling-bee", "letter-boxed", "linkedin-zip", "linkedin-crossclimb", "linkedin-queens", "linkedin-tango", "linkedin-mini-sudoku"],
  all: [...ALL_PUZZLES]
};

const LINKEDIN_GAME_CONFIG: Record<Extract<PuzzleSlug, `linkedin-${string}`>, { gameTypeId: number; gamePageUrl: string; gameName: string }> = {
  "linkedin-zip": { gameTypeId: 6, gamePageUrl: "https://www.linkedin.com/games/view/zip/desktop/", gameName: "Zip" },
  "linkedin-crossclimb": { gameTypeId: 2, gamePageUrl: "https://www.linkedin.com/games/view/crossclimb/desktop/", gameName: "Crossclimb" },
  "linkedin-queens": { gameTypeId: 3, gamePageUrl: "https://www.linkedin.com/games/view/queens/desktop/", gameName: "Queens" },
  "linkedin-tango": { gameTypeId: 5, gamePageUrl: "https://www.linkedin.com/games/view/tango/desktop/", gameName: "Tango" },
  "linkedin-mini-sudoku": { gameTypeId: 7, gamePageUrl: "https://www.linkedin.com/games/view/mini-sudoku/desktop/", gameName: "Mini Sudoku" }
};

function parseArgs() {
  const args = process.argv.slice(2);
  const puzzles: PuzzleSlug[] = [];
  let group: PuzzleGroup | undefined;
  let answerDate: string | undefined;
  let dryRun = false;
  let backfillDays = 0;
  let skipLinkedIn = false;
  let skipLinkedInIfMissing = false;
  let requireCurrentDate = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--puzzle" || arg === "-p") {
      const value = args[index + 1];
      if (!value) throw new Error("Missing value for --puzzle");
      puzzles.push(parsePuzzleSlug(value));
      index += 1;
    } else if (arg.startsWith("--puzzle=")) {
      puzzles.push(parsePuzzleSlug(arg.slice("--puzzle=".length)));
    } else if (arg === "--group") {
      group = parsePuzzleGroup(requireNextArg(args, index, "--group"));
      index += 1;
    } else if (arg.startsWith("--group=")) {
      group = parsePuzzleGroup(arg.slice("--group=".length));
    } else if (arg === "--date") {
      answerDate = requireNextArg(args, index, "--date");
      index += 1;
    } else if (arg.startsWith("--date=")) {
      answerDate = arg.slice("--date=".length);
    } else if (arg === "--backfill-days") {
      backfillDays = Number(requireNextArg(args, index, "--backfill-days"));
      index += 1;
    } else if (arg.startsWith("--backfill-days=")) {
      backfillDays = Number(arg.slice("--backfill-days=".length));
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--skip-linkedin") {
      skipLinkedIn = true;
    } else if (arg === "--skip-linkedin-if-missing") {
      skipLinkedInIfMissing = true;
    } else if (arg === "--require-current-date") {
      requireCurrentDate = true;
    }
  }

  if (answerDate) validateAnswerDate(answerDate);
  if (!Number.isFinite(backfillDays) || backfillDays < 0) backfillDays = 0;

  const targetPuzzles = puzzles.length ? puzzles : group ? PUZZLE_GROUPS[group] : ALL_PUZZLES;
  return {
    puzzles: Array.from(new Set(targetPuzzles)),
    answerDate,
    dryRun,
    backfillDays: Math.floor(backfillDays),
    skipLinkedIn,
    skipLinkedInIfMissing,
    requireCurrentDate
  };
}

function requireNextArg(args: string[], index: number, name: string) {
  const value = args[index + 1];
  if (!value) throw new Error(`Missing value for ${name}`);
  return value;
}

function parsePuzzleSlug(value: string): PuzzleSlug {
  const normalized = value.trim().toLowerCase() as PuzzleSlug;
  if (!ALL_PUZZLES.includes(normalized)) {
    throw new Error(`Unsupported puzzle: ${value}. Expected one of ${ALL_PUZZLES.join(", ")}`);
  }
  return normalized;
}

function parsePuzzleGroup(value: string): PuzzleGroup {
  const normalized = value.trim().toLowerCase() as PuzzleGroup;
  if (!(normalized in PUZZLE_GROUPS)) {
    throw new Error(`Unsupported puzzle group: ${value}. Expected one of ${Object.keys(PUZZLE_GROUPS).join(", ")}`);
  }
  return normalized;
}

function validateAnswerDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid answer date: ${value}. Expected YYYY-MM-DD.`);
}

function getRequestedDate(answerDate: string | undefined, timezone = process.env.PUZZLES_TIMEZONE || "America/New_York") {
  const date = answerDate || formatPuzzleDate(new Date(), timezone);
  validateAnswerDate(date);
  return date;
}

function addDays(answerDate: string, days: number) {
  return shiftPuzzleDate(answerDate, days);
}

function normalizeAnswer(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

function normalizeWordList(values: unknown) {
  return Array.isArray(values) ? values.map(normalizeAnswer).filter(Boolean) : [];
}

function normalizeLetterList(values: unknown) {
  return Array.isArray(values) ? values.map((value) => String(value ?? "").trim().toUpperCase()).filter(Boolean) : [];
}

function normalizePuzzleId(value: unknown): PuzzleId {
  if (typeof value === "string" || typeof value === "number") return value;
  return null;
}

function toPlainObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function fetchJson<T>(sourceUrl: string, userAgent = NYT_BOT_USER_AGENT): Promise<T> {
  const response = await fetch(sourceUrl, { headers: { "user-agent": userAgent } });
  if (!response.ok) throw new Error(`Failed to fetch ${sourceUrl}: ${response.status}`);
  return (await response.json()) as T;
}

async function fetchJsonIfExists<T>(sourceUrl: string): Promise<T | null> {
  const response = await fetch(sourceUrl, { headers: { "user-agent": NYT_BOT_USER_AGENT } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to fetch ${sourceUrl}: ${response.status}`);
  return (await response.json()) as T;
}

async function fetchHtml(sourceUrl: string, userAgent = NYT_BOT_USER_AGENT) {
  const response = await fetch(sourceUrl, { headers: { "user-agent": userAgent } });
  if (!response.ok) throw new Error(`Failed to fetch ${sourceUrl}: ${response.status}`);
  return response.text();
}

function extractWindowGameData<T>(html: string, sourceUrl: string): T {
  const marker = "window.gameData = ";
  const startIndex = html.indexOf(marker);
  if (startIndex === -1) throw new Error(`Could not find window.gameData in ${sourceUrl}.`);
  const scriptEndIndex = html.indexOf("</script>", startIndex);
  if (scriptEndIndex === -1) throw new Error(`Could not find the end of the gameData script in ${sourceUrl}.`);
  const rawJson = html.slice(startIndex + marker.length, scriptEndIndex).trim().replace(/;$/, "");
  return JSON.parse(rawJson) as T;
}

function ensureDate(value: unknown, sourceUrl: string) {
  const date = String(value ?? "").trim();
  validateAnswerDate(date);
  if (!date) throw new Error(`Response from ${sourceUrl} did not include a print date.`);
  return date;
}

function ensureExactDate(value: unknown, expected: string, sourceUrl: string) {
  const actual = ensureDate(value, sourceUrl);
  if (actual !== expected) throw new Error(`Source ${sourceUrl} returned ${actual}, but ${expected} was requested.`);
  return actual;
}

async function revealWordle(answerDate?: string): Promise<PuzzleAnswerResult> {
  const requestedDate = getRequestedDate(answerDate);
  const sourceUrl = `${WORDLE_SOURCE_URL}/${requestedDate}.json`;
  const payload = await fetchJson<AnyRecord>(sourceUrl);
  const answerDateValue = ensureExactDate(payload.print_date ?? requestedDate, requestedDate, sourceUrl);
  const answer = normalizeAnswer(payload.solution);
  if (!answer) throw new Error(`Wordle response from ${sourceUrl} did not include a solution.`);
  const wordleNumber = resolveWordlePuzzleNumber(payload);

  return {
    puzzleSlug: "wordle",
    answerDate: answerDateValue,
    puzzleId: wordleNumber,
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    extractedFrom: "nyt:wordle-endpoint",
    answerSummary: { answer, puzzleId: wordleNumber, wordleNumber, nytRecordId: payload.id ?? null },
    payload: { ...payload, answer, answerDate: answerDateValue }
  };
}

async function revealConnections(answerDate?: string): Promise<PuzzleAnswerResult> {
  const requestedDate = getRequestedDate(answerDate);
  const sourceUrl = `${CONNECTIONS_SOURCE_URL}/${requestedDate}.json`;
  const payload = await fetchJson<AnyRecord>(sourceUrl);
  const rawCategories = Array.isArray(payload.categories) ? payload.categories.map((entry) => entry as AnyRecord) : [];
  if (!rawCategories.length) throw new Error(`Connections response from ${sourceUrl} did not include categories.`);
  const colors = ["yellow", "green", "blue", "purple"];
  const categories = rawCategories.map((category, index) => ({
    color: colors[index] ?? "purple",
    title: String(category.title ?? "").trim(),
    cards: Array.isArray(category.cards)
      ? category.cards.map((card) => {
          const row = card as AnyRecord;
          const rawPosition = Number(row.position);
          return {
            content: String(row.content ?? row.image_alt_text ?? "").trim(),
            position: Number.isFinite(rawPosition) ? rawPosition : null
          };
        })
      : []
  }));
  const startingCards = categories
    .flatMap((category, categoryIndex) =>
      category.cards.map((card, cardIndex) => ({
        color: category.color,
        content: card.content,
        fallbackPosition: categoryIndex * 4 + cardIndex,
        position: card.position,
        title: category.title
      }))
    )
    .filter((card) => card.content)
    .sort((a, b) => (a.position ?? a.fallbackPosition) - (b.position ?? b.fallbackPosition))
    .map(({ fallbackPosition, ...card }) => card);
  const answerDateValue = ensureExactDate(payload.print_date ?? requestedDate, requestedDate, sourceUrl);

  return {
    puzzleSlug: "connections",
    answerDate: answerDateValue,
    puzzleId: normalizePuzzleId(payload.id),
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    extractedFrom: "nyt:connections-endpoint",
    answerSummary: { puzzleId: payload.id, categoryCount: categories.length, categories: categories.map((category) => category.title) },
    payload: { ...payload, answerDate: answerDateValue, categories, startingCards }
  };
}

async function revealStrands(answerDate?: string): Promise<PuzzleAnswerResult> {
  const requestedDate = getRequestedDate(answerDate);
  const sourceUrl = `${STRANDS_SOURCE_URL}/${requestedDate}.json`;
  const payload = await fetchJson<AnyRecord>(sourceUrl);
  const rawThemeWords = Array.isArray(payload.themeWords) ? payload.themeWords.map(String) : [];
  if (!rawThemeWords.length) throw new Error(`Strands response from ${sourceUrl} did not include theme words.`);
  const themeWords = rawThemeWords.map(normalizeAnswer);
  const answerDateValue = ensureExactDate(payload.printDate ?? requestedDate, requestedDate, sourceUrl);

  return {
    puzzleSlug: "strands",
    answerDate: answerDateValue,
    puzzleId: normalizePuzzleId(payload.id),
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    extractedFrom: "nyt:strands-endpoint",
    answerSummary: { puzzleId: payload.id, spangram: normalizeAnswer(payload.spangram), themeWordCount: themeWords.length },
    payload: {
      ...payload,
      answerDate: answerDateValue,
      spangram: normalizeAnswer(payload.spangram),
      themeWords,
      startingBoard: Array.isArray(payload.startingBoard) ? payload.startingBoard : []
    }
  };
}

function collectSpellingBeeCandidates(pageData: AnyRecord) {
  const candidates: AnyRecord[] = [];
  if (pageData.today && typeof pageData.today === "object") candidates.push(pageData.today as AnyRecord);
  if (pageData.yesterday && typeof pageData.yesterday === "object") candidates.push(pageData.yesterday as AnyRecord);
  const pastPuzzles = pageData.pastPuzzles && typeof pageData.pastPuzzles === "object" ? (pageData.pastPuzzles as AnyRecord) : {};
  for (const value of Object.values(pastPuzzles)) {
    if (Array.isArray(value)) candidates.push(...(value.filter((entry) => entry && typeof entry === "object") as AnyRecord[]));
    else if (value && typeof value === "object") candidates.push(value as AnyRecord);
  }
  return candidates;
}

async function revealSpellingBee(answerDate?: string): Promise<PuzzleAnswerResult> {
  const html = await fetchHtml(SPELLING_BEE_SOURCE_URL);
  const pageData = extractWindowGameData<AnyRecord>(html, SPELLING_BEE_SOURCE_URL);
  const requestedDate = answerDate ? getRequestedDate(answerDate) : null;
  const candidates = collectSpellingBeeCandidates(pageData);
  const payload =
    requestedDate
      ? candidates.find((candidate) => String(candidate.printDate ?? "").trim() === requestedDate)
      : (pageData.today as AnyRecord | undefined) ?? candidates.sort((a, b) => String(b.printDate).localeCompare(String(a.printDate)))[0];
  if (!payload) throw new Error(`Spelling Bee page data did not include ${requestedDate ?? "a current puzzle"}.`);
  const answerDateValue = requestedDate
    ? ensureExactDate(payload.printDate, requestedDate, SPELLING_BEE_SOURCE_URL)
    : ensureDate(payload.printDate, SPELLING_BEE_SOURCE_URL);
  const pangrams = normalizeWordList(payload.pangrams);
  const answers = normalizeWordList(payload.answers);

  return {
    puzzleSlug: "spelling-bee",
    answerDate: answerDateValue,
    puzzleId: normalizePuzzleId(payload.id),
    sourceUrl: SPELLING_BEE_SOURCE_URL,
    fetchedAt: new Date().toISOString(),
    extractedFrom: "nyt:spelling-bee-window-gameData",
    answerSummary: { puzzleId: payload.id, centerLetter: String(payload.centerLetter ?? "").toUpperCase(), answerCount: answers.length, pangramCount: pangrams.length },
    payload: {
      ...payload,
      answerDate: answerDateValue,
      centerLetter: String(payload.centerLetter ?? "").toUpperCase(),
      outerLetters: normalizeLetterList(payload.outerLetters),
      validLetters: normalizeLetterList(payload.validLetters ?? [payload.centerLetter, ...(Array.isArray(payload.outerLetters) ? payload.outerLetters : [])]),
      pangrams,
      answers
    }
  };
}

async function revealLetterBoxed(answerDate?: string): Promise<PuzzleAnswerResult> {
  const html = await fetchHtml(LETTER_BOXED_SOURCE_URL);
  const payload = extractWindowGameData<AnyRecord>(html, LETTER_BOXED_SOURCE_URL);
  const requestedDate = answerDate ? getRequestedDate(answerDate) : null;
  const answerDateValue = requestedDate
    ? ensureExactDate(payload.printDate, requestedDate, LETTER_BOXED_SOURCE_URL)
    : ensureDate(payload.printDate, LETTER_BOXED_SOURCE_URL);
  const solution = normalizeWordList(payload.ourSolution);
  if (!solution.length) throw new Error(`Letter Boxed page data did not include a solution.`);

  return {
    puzzleSlug: "letter-boxed",
    answerDate: answerDateValue,
    puzzleId: normalizePuzzleId(payload.id),
    sourceUrl: LETTER_BOXED_SOURCE_URL,
    fetchedAt: new Date().toISOString(),
    extractedFrom: "nyt:letter-boxed-window-gameData",
    answerSummary: { puzzleId: payload.id, solution, par: payload.par ?? null },
    payload: { ...payload, answerDate: answerDateValue, sides: normalizeLetterList(payload.sides), solution, par: payload.par ?? null }
  };
}

function normalizeSudokuDifficulty(name: "easy" | "medium" | "hard", data: AnyRecord) {
  const puzzleData = data.puzzle_data && typeof data.puzzle_data === "object" ? (data.puzzle_data as AnyRecord) : {};
  return {
    difficulty: name,
    answerDate: ensureDate(data.print_date, SUDOKU_SOURCE_URL),
    puzzleId: data.puzzle_id,
    version: data.version,
    hints: Array.isArray(puzzleData.hints) ? puzzleData.hints : [],
    puzzle: Array.isArray(puzzleData.puzzle) ? puzzleData.puzzle : [],
    solution: Array.isArray(puzzleData.solution) ? puzzleData.solution : []
  };
}

async function revealSudoku(answerDate?: string): Promise<PuzzleAnswerResult> {
  const html = await fetchHtml(SUDOKU_SOURCE_URL);
  const pageData = extractWindowGameData<AnyRecord>(html, SUDOKU_SOURCE_URL);
  const easy = normalizeSudokuDifficulty("easy", pageData.easy as AnyRecord);
  const medium = normalizeSudokuDifficulty("medium", pageData.medium as AnyRecord);
  const hard = normalizeSudokuDifficulty("hard", pageData.hard as AnyRecord);
  const expectedDate = answerDate ? getRequestedDate(answerDate) : easy.answerDate;
  for (const entry of [easy, medium, hard]) {
    if (entry.answerDate !== expectedDate) throw new Error(`Sudoku ${entry.difficulty} returned ${entry.answerDate}, expected ${expectedDate}.`);
  }

  return {
    puzzleSlug: "sudoku",
    answerDate: expectedDate,
    puzzleId: `${easy.puzzleId}/${medium.puzzleId}/${hard.puzzleId}`,
    sourceUrl: SUDOKU_SOURCE_URL,
    fetchedAt: new Date().toISOString(),
    extractedFrom: "nyt:sudoku-window-gameData",
    answerSummary: { easyPuzzleId: easy.puzzleId, mediumPuzzleId: medium.puzzleId, hardPuzzleId: hard.puzzleId },
    payload: { answerDate: expectedDate, easy, medium, hard }
  };
}

function normalizePipsDifficulty(name: "easy" | "medium" | "hard", data: AnyRecord) {
  return {
    difficulty: name,
    puzzleId: data.id,
    backendId: data.backendId,
    constructors: typeof data.constructors === "string" ? data.constructors : null,
    dominoes: Array.isArray(data.dominoes) ? data.dominoes : [],
    regions: Array.isArray(data.regions) ? data.regions : [],
    solution: Array.isArray(data.solution) ? data.solution : []
  };
}

async function revealPips(answerDate?: string): Promise<PuzzleAnswerResult> {
  const requestedDate = getRequestedDate(answerDate);
  let sourceUrl = `${PIPS_SOURCE_URL}/${requestedDate}.json`;
  let payload: AnyRecord | null = null;
  if (answerDate) {
    payload = await fetchJson<AnyRecord>(sourceUrl);
  } else {
    for (const candidate of [requestedDate, addDays(requestedDate, -1)]) {
      const candidateUrl = `${PIPS_SOURCE_URL}/${candidate}.json`;
      const candidatePayload = await fetchJsonIfExists<AnyRecord>(candidateUrl);
      if (candidatePayload) {
        payload = candidatePayload;
        sourceUrl = candidateUrl;
        break;
      }
    }
  }
  if (!payload) throw new Error("Could not find a current Pips payload.");
  const answerDateValue = answerDate ? ensureExactDate(payload.printDate, requestedDate, sourceUrl) : ensureDate(payload.printDate, sourceUrl);
  const easy = normalizePipsDifficulty("easy", payload.easy as AnyRecord);
  const medium = normalizePipsDifficulty("medium", payload.medium as AnyRecord);
  const hard = normalizePipsDifficulty("hard", payload.hard as AnyRecord);

  return {
    puzzleSlug: "pips",
    answerDate: answerDateValue,
    puzzleId: `${easy.puzzleId}/${medium.puzzleId}/${hard.puzzleId}`,
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    extractedFrom: "nyt:pips-endpoint",
    answerSummary: { easyPuzzleId: easy.puzzleId, mediumPuzzleId: medium.puzzleId, hardPuzzleId: hard.puzzleId },
    payload: { ...payload, answerDate: answerDateValue, easy, medium, hard }
  };
}

function resolveBeebomDate(input: { title?: string; ogTitle?: string; publishedAt?: string; modifiedAt?: string; fetchedAt: string }) {
  const haystack = [input.title, input.ogTitle].filter(Boolean).join(" ");
  const match = haystack.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/i);
  if (match) {
    const month = "january february march april may june july august september october november december".split(" ").indexOf(match[1].toLowerCase()) + 1;
    return `${match[3]}-${String(month).padStart(2, "0")}-${String(Number(match[2])).padStart(2, "0")}`;
  }
  const fallback = input.modifiedAt || input.publishedAt || input.fetchedAt;
  return fallback.slice(0, 10);
}

async function revealBeebomAnswer(puzzleSlug: "contexto" | "letroso"): Promise<PuzzleAnswerResult> {
  const sourceUrl = puzzleSlug === "contexto" ? CONTEXTO_SOURCE_URL : LETROSO_SOURCE_URL;
  const html = await fetchHtml(sourceUrl, GENERIC_USER_AGENT);
  const fetchedAt = new Date().toISOString();
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  const publishedAt = $('meta[property="article:published_time"]').attr("content")?.trim();
  const modifiedAt = $('meta[property="article:modified_time"]').attr("content")?.trim();
  const container = $(".wp-block-beebom-puzzle-features-answer-reveal .answer-reveal__container").first();
  let answer = String(container.attr("data-answer") ?? "").trim().toUpperCase();
  if (!answer) {
    const tiles = container.find(".answer-reveal__tile").toArray().map((tile) => $(tile).attr("data-letter") || $(tile).text()).join("");
    answer = tiles.trim().toUpperCase();
  }
  if (!answer) {
    const schemaText = $('script[type="application/ld+json"]').toArray().map((node) => $(node).text()).join("\n");
    const answerMatch = schemaText.match(/"text"\s*:\s*"([^"]+)"/i);
    answer = answerMatch?.[1]?.trim().toUpperCase() ?? "";
  }
  if (!answer) throw new Error(`Could not extract ${puzzleSlug} answer from ${sourceUrl}.`);
  const meaning = puzzleSlug === "letroso" ? $("p").toArray().map((node) => $(node).text().trim()).find((text) => text.toUpperCase().includes(answer) && text.length < 260) ?? null : null;

  return {
    puzzleSlug,
    answerDate: resolveBeebomDate({ title, ogTitle, publishedAt, modifiedAt, fetchedAt }),
    puzzleId: null,
    sourceUrl,
    fetchedAt,
    extractedFrom: "beebom:answer-reveal",
    answerSummary: { answer, meaning },
    payload: { answer, meaning, pageTitle: title, ogTitle, publishedAt, modifiedAt }
  };
}

async function getJsessionId(gamePageUrl: string, liAt: string): Promise<string> {
  const response = await fetch(gamePageUrl, {
    headers: { cookie: `li_at=${liAt}`, "user-agent": GENERIC_USER_AGENT },
    redirect: "follow"
  });
  const setCookies: string[] =
    typeof (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (response.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : [response.headers.get("set-cookie") ?? ""];
  for (const header of setCookies) {
    const match = header.match(/JSESSIONID="?([^;,"]+)"?/i);
    if (match) return match[1].replace(/^"(.*)"$/, "$1");
  }
  throw new Error(`Could not extract JSESSIONID from ${gamePageUrl}. Check LINKEDIN_LI_AT.`);
}

async function fetchVoyagerGame(gameTypeId: number, liAt: string, jsessionId: string): Promise<AnyRecord> {
  const url = `${VOYAGER_BASE_URL}?includeWebMetadata=true&variables=(gameTypeId:${gameTypeId})&queryId=${VOYAGER_QUERY_ID}`;
  const response = await fetch(url, {
    headers: {
      cookie: `li_at=${liAt}; JSESSIONID="${jsessionId}"`,
      "csrf-token": jsessionId,
      "user-agent": GENERIC_USER_AGENT,
      accept: "application/vnd.linkedin.normalized+json+2.1",
      "x-restli-protocol-version": "2.0.0"
    }
  });
  if (!response.ok) throw new Error(`LinkedIn Voyager API returned ${response.status} for gameTypeId=${gameTypeId}`);
  return (await response.json()) as AnyRecord;
}

function extractLinkedInPuzzleEntry(data: AnyRecord, gameName: string) {
  const included = Array.isArray(data.included) ? (data.included as AnyRecord[]) : [];
  const entry = included.find((item) => item.gamePuzzle && typeof item.gamePuzzle === "object");
  if (!entry) throw new Error(`No gamePuzzle found in Voyager API response for ${gameName}`);
  const gamePuzzle = entry.gamePuzzle as AnyRecord;
  const puzzleId = Number(entry.puzzleId ?? entry.id ?? 0);
  const playedOn = (entry.playedOn ?? gamePuzzle.playedOn) as AnyRecord | undefined;
  let answerDate = new Date().toISOString().slice(0, 10);
  if (playedOn?.year && playedOn?.month && playedOn?.day) {
    answerDate = `${Number(playedOn.year)}-${String(Number(playedOn.month)).padStart(2, "0")}-${String(Number(playedOn.day)).padStart(2, "0")}`;
  }
  return { entry, gamePuzzle, puzzleId, answerDate };
}

async function revealLinkedIn(slug: Extract<PuzzleSlug, `linkedin-${string}`>): Promise<PuzzleAnswerResult> {
  const liAt = process.env.LINKEDIN_LI_AT?.trim();
  if (!liAt) throw new Error("LINKEDIN_LI_AT is required for LinkedIn puzzle sync.");
  const config = LINKEDIN_GAME_CONFIG[slug];
  const fetchedAt = new Date().toISOString();
  const jsessionId = await getJsessionId(config.gamePageUrl, liAt);
  const data = await fetchVoyagerGame(config.gameTypeId, liAt, jsessionId);
  const { gamePuzzle, puzzleId, answerDate } = extractLinkedInPuzzleEntry(data, config.gameName);
  const sourceUrl = `${VOYAGER_BASE_URL}?variables=(gameTypeId:${config.gameTypeId})`;
  let payload: AnyRecord;
  let answerSummary: AnyRecord = { puzzleId };

  if (slug === "linkedin-zip") {
    const puzzle = gamePuzzle.trailGamePuzzle as AnyRecord;
    payload = {
      answerDate,
      puzzleId,
      gridSize: Number(puzzle.gridSize ?? puzzle.grid_size ?? 0),
      solution: Array.isArray(puzzle.solution) ? puzzle.solution.map(Number) : [],
      orderedSequence: Array.isArray(puzzle.orderedSequence) ? puzzle.orderedSequence.map(Number) : [],
      walls: Array.isArray(puzzle.walls) ? puzzle.walls : []
    };
    answerSummary = { ...answerSummary, gridSize: payload.gridSize, pathLength: Array.isArray(payload.solution) ? payload.solution.length : 0 };
  } else if (slug === "linkedin-crossclimb") {
    const puzzle = gamePuzzle.crossClimbGamePuzzle as AnyRecord;
    const rungs = Array.isArray(puzzle.rungs) ? [...(puzzle.rungs as AnyRecord[])] : [];
    const ordered = rungs.sort((a, b) => Number(a.solutionRungIndex ?? 0) - Number(b.solutionRungIndex ?? 0));
    payload = { answerDate, puzzleId, words: ordered.map((rung) => String(rung.word ?? "")), clues: ordered.map((rung) => String(rung.clue ?? "")) };
    answerSummary = { ...answerSummary, words: payload.words };
  } else if (slug === "linkedin-queens") {
    const puzzle = gamePuzzle.queensGamePuzzle as AnyRecord;
    const rawColorGrid = Array.isArray(puzzle.colorGrid) ? (puzzle.colorGrid as AnyRecord[]) : [];
    payload = {
      answerDate,
      puzzleId,
      gridSize: Number(puzzle.gridSize ?? 0),
      solution: Array.isArray(puzzle.solution) ? puzzle.solution : [],
      colorGrid: rawColorGrid.flatMap((row) => (Array.isArray(row.colors) ? row.colors : []))
    };
    answerSummary = { ...answerSummary, gridSize: payload.gridSize };
  } else if (slug === "linkedin-tango") {
    const puzzle = gamePuzzle.lotkaGamePuzzle as AnyRecord;
    payload = {
      answerDate,
      puzzleId,
      gridSize: Number(puzzle.gridSize ?? 0),
      solution: Array.isArray(puzzle.solution) ? puzzle.solution : [],
      presetCellIdxes: Array.isArray(puzzle.presetCellIdxes) ? puzzle.presetCellIdxes : [],
      edges: Array.isArray(puzzle.edges) ? puzzle.edges : []
    };
    answerSummary = { ...answerSummary, gridSize: payload.gridSize };
  } else {
    const puzzle = gamePuzzle.miniSudokuGamePuzzle as AnyRecord;
    payload = {
      answerDate,
      puzzleId,
      name: String(puzzle.name ?? ""),
      gridRowSize: Number(puzzle.gridRowSize ?? 0),
      gridColSize: Number(puzzle.gridColSize ?? 0),
      solution: Array.isArray(puzzle.solution) ? puzzle.solution : [],
      presetCellIdxes: Array.isArray(puzzle.presetCellIdxes) ? puzzle.presetCellIdxes : []
    };
    answerSummary = { ...answerSummary, name: payload.name, grid: `${payload.gridRowSize}x${payload.gridColSize}` };
  }

  return { puzzleSlug: slug, answerDate, puzzleId, sourceUrl, fetchedAt, extractedFrom: "linkedin:voyager-api", answerSummary, payload };
}

async function revealPuzzle(slug: PuzzleSlug, answerDate?: string): Promise<PuzzleAnswerResult> {
  if (slug === "wordle") return revealWordle(answerDate);
  if (slug === "connections") return revealConnections(answerDate);
  if (slug === "strands") return revealStrands(answerDate);
  if (slug === "spelling-bee") return revealSpellingBee(answerDate);
  if (slug === "letter-boxed") return revealLetterBoxed(answerDate);
  if (slug === "sudoku") return revealSudoku(answerDate);
  if (slug === "pips") return revealPips(answerDate);
  if (slug === "contexto" || slug === "letroso") return revealBeebomAnswer(slug);
  return revealLinkedIn(slug);
}

async function saveAnswer(result: PuzzleAnswerResult, dryRun: boolean) {
  if (dryRun) return "dry-run" as const;
  const sb = supabaseAdmin();
  const { data: existing, error: readError } = await sb
    .from("puzzle_answers")
    .select("puzzle_id, source_url, extracted_from, answer_summary, payload")
    .eq("puzzle_slug", result.puzzleSlug)
    .eq("answer_date", result.answerDate)
    .maybeSingle();
  if (readError) throw readError;
  if (existing && isSamePuzzleAnswer(existing, result)) return "unchanged" as const;

  const { error } = await sb.from("puzzle_answers").upsert(
    {
      puzzle_slug: result.puzzleSlug,
      answer_date: result.answerDate,
      puzzle_id: result.puzzleId === null || result.puzzleId === undefined ? null : String(result.puzzleId),
      source_url: result.sourceUrl,
      fetched_at: result.fetchedAt,
      extracted_from: result.extractedFrom,
      answer_summary: toPlainObject(result.answerSummary),
      payload: toPlainObject(result.payload)
    },
    { onConflict: "puzzle_slug,answer_date" }
  );
  if (error) throw error;
  return existing ? "updated" as const : "inserted" as const;
}

async function recordRun(puzzleSlug: string, status: string, issue: string | null, payload: AnyRecord, dryRun: boolean) {
  if (dryRun) return;
  const sb = supabaseAdmin();
  const { error } = await sb.from("puzzle_sync_runs").insert({
    puzzle_slug: puzzleSlug,
    status,
    issue,
    payload: toPlainObject(payload)
  });
  if (error) console.warn(`Failed to record puzzle sync run for ${puzzleSlug}: ${error.message}`);
}

async function main() {
  const args = parseArgs();
  const linkedInCredentialMissing = !process.env.LINKEDIN_LI_AT?.trim();
  const baseDate = getRequestedDate(args.answerDate);
  const dates = args.backfillDays > 0
    ? Array.from({ length: args.backfillDays }, (_, index) => addDays(baseDate, -index))
    : [args.answerDate];
  let hadFailures = false;

  for (const date of dates) {
    const expectedDate = date ?? baseDate;
    for (const puzzle of args.puzzles) {
      if (puzzle.startsWith("linkedin-") && args.skipLinkedIn) {
        console.log(`[skip] ${puzzle} was explicitly excluded`);
        continue;
      }
      if (puzzle.startsWith("linkedin-") && args.skipLinkedInIfMissing && linkedInCredentialMissing) {
        const message = "LINKEDIN_LI_AT is missing; the published LinkedIn puzzle cannot be refreshed.";
        await recordRun(puzzle, "blocked", message, { expectedDate }, args.dryRun);
        console.error(`[blocked] ${puzzle}: ${message}`);
        if (args.requireCurrentDate) hadFailures = true;
        continue;
      }
      if ((puzzle === "contexto" || puzzle === "letroso") && date) {
        console.log(`[skip] ${puzzle} does not support historical date fetch from Beebom source`);
        continue;
      }

      try {
        const result = await revealPuzzle(puzzle, date);
        if (result.answerDate !== expectedDate) {
          const message = `Source returned ${result.answerDate}; expected ${expectedDate}.`;
          await recordRun(puzzle, "not_ready", message, { answerDate: result.answerDate, expectedDate }, args.dryRun);
          console.warn(`[not-ready] ${puzzle}: ${message}`);
          if (args.requireCurrentDate) hadFailures = true;
          continue;
        }

        const writeAction = await saveAnswer(result, args.dryRun);
        await recordRun(
          puzzle,
          "ok",
          null,
          { answerDate: result.answerDate, summary: result.answerSummary, writeAction },
          args.dryRun
        );
        console.log(`[ok] ${puzzle} ${result.answerDate} (${writeAction})`);
      } catch (error) {
        const message = formatUnknownError(error);
        await recordRun(puzzle, "error", message, { expectedDate }, args.dryRun);
        console.error(`[error] ${puzzle}${date ? ` ${date}` : ""}: ${message}`);
        hadFailures = true;
      }
    }
  }

  if (hadFailures) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
