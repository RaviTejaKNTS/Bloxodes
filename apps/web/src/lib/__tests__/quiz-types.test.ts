import { describe, expect, it } from "vitest";

import { parseQuizData } from "@/lib/quiz-types";

function question(id: string) {
  return {
    id,
    question: `Question ${id}?`,
    options: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
      { id: "c", text: "C" },
      { id: "d", text: "D" }
    ],
    correctOptionId: "a"
  };
}

describe("parseQuizData", () => {
  it("accepts complete difficulty pools", () => {
    const parsed = parseQuizData({
      easy: [question("easy-1")],
      medium: [question("medium-1")],
      hard: [question("hard-1")]
    });
    expect(parsed.hard[0].id).toBe("hard-1");
  });

  it("rejects answers that do not match an option", () => {
    expect(() => parseQuizData({
      easy: [{ ...question("easy-1"), correctOptionId: "missing" }],
      medium: [question("medium-1")],
      hard: [question("hard-1")]
    })).toThrow("does not match an option");
  });

  it("rejects duplicate question ids across difficulties", () => {
    expect(() => parseQuizData({
      easy: [question("duplicate")],
      medium: [question("duplicate")],
      hard: [question("hard-1")]
    })).toThrow("duplicate question id");
  });
});
