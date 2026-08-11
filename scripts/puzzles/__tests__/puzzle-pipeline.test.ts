import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  formatUnknownError,
  isPuzzlePayloadStructurallyValid,
  isSamePuzzleAnswer,
  resolveWordlePuzzleNumber
} from "../pipeline-utils";

test("Wordle uses the public days-since-launch number instead of the internal record id", () => {
  assert.equal(resolveWordlePuzzleNumber({ id: 1863, days_since_launch: 1879 }), 1879);
  assert.equal(resolveWordlePuzzleNumber({ id: 1863 }), 1863);
});

test("plain Supabase errors retain their useful message", () => {
  assert.equal(formatUnknownError({ message: "database unavailable", code: "PGRST000" }), "database unavailable");
  assert.equal(formatUnknownError({ code: "PGRST000" }), '{"code":"PGRST000"}');
});

test("unchanged puzzle answers can skip a redundant upsert", () => {
  const existing = {
    puzzle_id: "1879",
    source_url: "https://example.com",
    extracted_from: "example",
    answer_summary: { answer: "TEST" },
    payload: { answer: "TEST", rows: [1, 2] }
  };
  const next = {
    puzzleId: 1879,
    sourceUrl: "https://example.com",
    extractedFrom: "example",
    answerSummary: { answer: "TEST" },
    payload: { answer: "TEST", rows: [1, 2] }
  };

  assert.equal(isSamePuzzleAnswer(existing, next), true);
  assert.equal(isSamePuzzleAnswer(existing, { ...next, payload: { ...next.payload, rows: [1, 3] } }), false);
});

test("payload validation rejects incomplete answer shapes", () => {
  assert.equal(
    isPuzzlePayloadStructurallyValid(
      "connections",
      { categories: [{}, {}, {}, {}], startingCards: Array.from({ length: 16 }, () => ({})) },
      {}
    ),
    true
  );
  assert.equal(isPuzzlePayloadStructurallyValid("connections", { categories: [], startingCards: [] }, {}), false);
  assert.equal(isPuzzlePayloadStructurallyValid("wordle", { answer: "TESTS" }, { answer: "TESTS" }), true);
});

test("the scheduled full sweep enforces freshness and is followed by a strict audit", () => {
  const cron = readFileSync(new URL("../../ops/vps-scheduled-automation.crontab", import.meta.url), "utf8");
  assert.match(cron, /puzzles-full-sweep .*--require-current-date/);
  assert.match(cron, /puzzles-audit "npm run audit:puzzles -- --strict"/);
});
