import assert from "node:assert/strict";
import test from "node:test";

import { createOrFindQueueItem, markRepeatedZeroApprovalDegraded, validateDecisions } from "../curate-article-topics";
import { ARTICLE_CURATION_PROMPT_VERSION } from "../article-curation-config";
import type { NotionArticleQueue } from "../notion-article-queue";

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

for (const status of ["completed", "published", "processing", "pending", "blocked"]) test(`curation reuses a ${status} topic without modifying its evidence`, async () => {
  const queue = {
    put: async () => ({ created: false, row: { id: "existing-topic", status, source_items: [], source_urls: [] } }),
    update: async () => { assert.fail("Curation must not merge evidence into an existing article result"); },
  } as unknown as NotionArticleQueue;
  const id = await createOrFindQueueItem(queue, {
    candidate_ids: ["C0"], primary_candidate_id: "C0", decision: "approve", canonical_title: "Game Name New Boss Guide", article_type: "guide",
    topic_key: "new-boss", reason_code: "approved", reason: "Supports the boss task.", confidence: 0.9,
  }, candidates, "run", "test-model");
  assert.equal(id, "existing-topic");
});

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

test("runs with no candidates never count toward the zero-approval warning", () => {
  const done = (candidate_count: number) => ({ prompt_version: ARTICLE_CURATION_PROMPT_VERSION, status: "completed", approved_group_count: 0, candidate_count });
  const empty = { runs: [done(0), done(0), done(0)] };
  assert.equal(markRepeatedZeroApprovalDegraded(empty, done(0)), false);
  assert.equal(markRepeatedZeroApprovalDegraded(empty, done(5)), false);
  const real = { runs: [done(4), done(0), done(3), done(2)] };
  const run = done(2);
  assert.equal(markRepeatedZeroApprovalDegraded(real, run), true);
  assert.equal((run as any).degraded, true);
});
