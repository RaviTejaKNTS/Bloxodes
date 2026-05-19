import { describe, expect, it } from "vitest";
import { buildQuizAttempt, buildServerQuizAttempt } from "@/lib/quiz-attempts";
import type { QuizData, QuizQuestion } from "@/lib/quiz-types";

function question(id: string): QuizQuestion {
  return {
    id,
    question: `Question ${id}`,
    correctOptionId: `${id}-a`,
    options: [
      { id: `${id}-a`, text: "A" },
      { id: `${id}-b`, text: "B" },
      { id: `${id}-c`, text: "C" }
    ]
  };
}

function data(countPerLevel = 8): QuizData {
  return {
    easy: Array.from({ length: countPerLevel }, (_, index) => question(`easy-${index + 1}`)),
    medium: Array.from({ length: countPerLevel }, (_, index) => question(`medium-${index + 1}`)),
    hard: Array.from({ length: countPerLevel }, (_, index) => question(`hard-${index + 1}`))
  };
}

describe("quiz attempts", () => {
  it("builds the public quiz attempt in easy, medium, hard order", () => {
    const attempt = buildServerQuizAttempt(data(), "sample-quiz");

    expect(attempt).toHaveLength(15);
    expect(attempt.slice(0, 5).every((entry) => entry.difficulty === "easy")).toBe(true);
    expect(attempt.slice(5, 10).every((entry) => entry.difficulty === "medium")).toBe(true);
    expect(attempt.slice(10, 15).every((entry) => entry.difficulty === "hard")).toBe(true);
  });

  it("keeps the server attempt deterministic for the same quiz code", () => {
    const quizData = data();

    const first = buildServerQuizAttempt(quizData, "adopt-me");
    const second = buildServerQuizAttempt(quizData, "adopt-me");

    expect(second.map((entry) => entry.id)).toEqual(first.map((entry) => entry.id));
    expect(second.map((entry) => entry.options.map((option) => option.id))).toEqual(
      first.map((entry) => entry.options.map((option) => option.id))
    );
  });

  it("prefers unseen questions before recycling seen questions", () => {
    const quizData = data(7);
    const seenIds = ["easy-1", "easy-2", "medium-1", "medium-2", "hard-1", "hard-2"];

    const attempt = buildQuizAttempt(quizData, seenIds, () => 0.99);

    expect(attempt.filter((entry) => seenIds.includes(entry.id))).toHaveLength(0);
  });
});
