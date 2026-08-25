import assert from "node:assert/strict";
import test from "node:test";

import { reduceGroqCompletionBudget, validateDecisions } from "../curate-article-topics";

const candidates = [{
  id: "candidate-1",
  source_name: "Publisher",
  source_url: "https://example.com/game-update",
  source_title: "Game Name major update patch notes",
  source_published_at: "2026-08-10T00:00:00.000Z",
  source_discovered_at: "2026-08-10T00:00:00.000Z",
  source_description: "The update adds a new boss and crafting system.",
  source_evidence: { headings: ["How to beat the new boss", "How crafting works"], excerpt: "" },
  source_categories: ["Roblox"],
  discovered_from: "https://example.com/roblox"
}];

test("allows one source lead to support multiple distinct approved angles", () => {
  const decisions = validateDecisions({ decisions: [
    {
      candidate_ids: ["C0"], decision: "approve" as const,
      canonical_title: "Game Name New Boss Guide", article_type: "guide" as const,
      topic_key: "game-name-new-boss", primary_candidate_id: "C0",
      reason_code: "approved" as const, reason: "Source evidence supports the boss task.", confidence: 0.9
    },
    {
      candidate_ids: ["C0"], decision: "approve" as const,
      canonical_title: "Game Name Crafting System Explained", article_type: "explainer" as const,
      topic_key: "game-name-crafting-system", primary_candidate_id: "C0",
      reason_code: "approved" as const, reason: "Source evidence supports the crafting mechanic.", confidence: 0.88
    }
  ] }, candidates);
  assert.equal(decisions.length, 2);
});

test("allows differently titled sources when both evidence packets support the derived angle", () => {
  const paired = [candidates[0], {
    ...candidates[0],
    id: "candidate-2",
    source_url: "https://other.example.com/game-boss-guide",
    source_title: "How to defeat the Omega boss in Game Name",
    source_evidence: { headings: ["Omega boss location", "Best strategy for the Omega boss"], excerpt: "" }
  }];
  assert.doesNotThrow(() => validateDecisions({ decisions: [{
    candidate_ids: ["C0", "C1"], decision: "approve" as const,
    canonical_title: "Game Name Omega Boss Guide", article_type: "guide" as const,
    topic_key: "game-name-omega-boss", primary_candidate_id: "C1",
    reason_code: "approved" as const, reason: "Both evidence packets support the boss angle.", confidence: 0.9
  }] }, paired));
});

test("rejects a candidate that is both approved and rejected", () => {
  assert.throws(() => validateDecisions({ decisions: [
    {
      candidate_ids: ["C0"], decision: "approve" as const,
      canonical_title: "Game Name New Boss Guide", article_type: "guide" as const,
      topic_key: "game-name-new-boss", primary_candidate_id: "C0",
      reason_code: "approved" as const, reason: "Supported.", confidence: 0.9
    },
    {
      candidate_ids: ["C0"], decision: "reject" as const,
      canonical_title: null, article_type: null, topic_key: null, primary_candidate_id: null,
      reason_code: "thin_topic" as const, reason: "Not supported.", confidence: 0.7
    }
  ] }, candidates), /both approved and rejected/);
});

test("reduces Groq completion tokens when the request exceeds the provider token cap", () => {
  assert.equal(
    reduceGroqCompletionBudget(
      2980,
      "Request too large for model on tokens per minute (TPM): Limit 8000, Requested 8017"
    ),
    2707
  );
});

test("ignores Groq errors that do not include an exceeded request token cap", () => {
  assert.equal(reduceGroqCompletionBudget(2980, "temporary upstream failure"), null);
  assert.equal(reduceGroqCompletionBudget(2980, "Limit 8000, Requested 7999"), null);
});
