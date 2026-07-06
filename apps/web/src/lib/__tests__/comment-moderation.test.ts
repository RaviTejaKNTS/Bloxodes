import { describe, expect, it } from "vitest";
import { evaluateModerationResponse } from "@/lib/comment-moderation";

describe("comment moderation helpers", () => {
  it("approves a safe OpenAI moderation response", () => {
    expect(
      evaluateModerationResponse({
        results: [
          {
            flagged: false,
            categories: { harassment: false },
            category_scores: { harassment: 0.01 }
          }
        ]
      })
    ).toBe(true);
  });

  it("blocks a flagged OpenAI moderation response", () => {
    expect(
      evaluateModerationResponse({
        results: [
          {
            flagged: true,
            categories: { harassment: true },
            category_scores: { harassment: 0.99 }
          }
        ]
      })
    ).toBe(false);
  });

  it("blocks suggestive OpenAI moderation scores for Roblox pages", () => {
    expect(
      evaluateModerationResponse({
        results: [
          {
            flagged: false,
            categories: { sexual: false },
            category_scores: { sexual: 0.11 }
          }
        ]
      })
    ).toBe(false);
  });

  it("blocks missing OpenAI moderation responses", () => {
    expect(evaluateModerationResponse(null)).toBe(false);
  });

  it("blocks malformed OpenAI moderation responses", () => {
    expect(evaluateModerationResponse({ results: [] })).toBe(false);
  });
});
