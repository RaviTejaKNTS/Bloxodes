import { isDeepStrictEqual } from "node:util";

export type AnyRecord = Record<string, unknown>;

export type PuzzleSlug =
  | "wordle"
  | "connections"
  | "strands"
  | "spelling-bee"
  | "letter-boxed"
  | "sudoku"
  | "pips"
  | "contexto"
  | "letroso"
  | "linkedin-zip"
  | "linkedin-crossclimb"
  | "linkedin-queens"
  | "linkedin-tango"
  | "linkedin-mini-sudoku";

export const ALL_PUZZLE_SLUGS: PuzzleSlug[] = [
  "wordle",
  "connections",
  "strands",
  "spelling-bee",
  "letter-boxed",
  "sudoku",
  "pips",
  "contexto",
  "letroso",
  "linkedin-zip",
  "linkedin-crossclimb",
  "linkedin-queens",
  "linkedin-tango",
  "linkedin-mini-sudoku"
];

export type StoredPuzzleAnswer = {
  puzzle_id?: string | null;
  source_url?: string | null;
  extracted_from?: string | null;
  answer_summary?: AnyRecord | null;
  payload?: AnyRecord | null;
};

export type NextPuzzleAnswer = {
  puzzleId?: string | number | null;
  sourceUrl: string;
  extractedFrom: string;
  answerSummary: AnyRecord;
  payload: AnyRecord;
};

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function nonEmpty(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

export function formatUnknownError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (nonEmpty(message)) return String(message);
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

export function resolveWordlePuzzleNumber(payload: AnyRecord) {
  const value = payload.days_since_launch ?? payload.id;
  return typeof value === "string" || typeof value === "number" ? value : null;
}

export function isSamePuzzleAnswer(existing: StoredPuzzleAnswer, next: NextPuzzleAnswer) {
  const nextPuzzleId = next.puzzleId === null || next.puzzleId === undefined ? null : String(next.puzzleId);
  return (
    (existing.puzzle_id ?? null) === nextPuzzleId &&
    (existing.source_url ?? null) === next.sourceUrl &&
    (existing.extracted_from ?? null) === next.extractedFrom &&
    isDeepStrictEqual(existing.answer_summary ?? {}, next.answerSummary) &&
    isDeepStrictEqual(existing.payload ?? {}, next.payload)
  );
}

export function isPuzzlePayloadStructurallyValid(slug: PuzzleSlug, payloadValue: unknown, summaryValue: unknown) {
  const payload = asRecord(payloadValue);
  const summary = asRecord(summaryValue);

  if (slug === "wordle") return nonEmpty(summary.answer) && nonEmpty(payload.answer);
  if (slug === "connections") return asArray(payload.categories).length === 4 && asArray(payload.startingCards).length === 16;
  if (slug === "strands") return asArray(payload.themeWords).length > 0 && nonEmpty(payload.spangram);
  if (slug === "spelling-bee") {
    return asArray(payload.answers).length > 0 && asArray(payload.pangrams).length > 0 && nonEmpty(payload.centerLetter);
  }
  if (slug === "letter-boxed") return asArray(payload.solution).length > 0 && asArray(payload.sides).length > 0;
  if (slug === "sudoku") {
    return ["easy", "medium", "hard"].every((difficulty) => {
      const row = asRecord(payload[difficulty]);
      return asArray(row.puzzle).length === 81 && asArray(row.solution).length === 81;
    });
  }
  if (slug === "pips") {
    return ["easy", "medium", "hard"].every((difficulty) => {
      const row = asRecord(payload[difficulty]);
      return asArray(row.dominoes).length > 0 && asArray(row.solution).length > 0;
    });
  }
  if (slug === "contexto" || slug === "letroso") return nonEmpty(payload.answer);
  if (slug === "linkedin-crossclimb") return asArray(payload.words).length > 0;
  return asArray(payload.solution).length > 0;
}
