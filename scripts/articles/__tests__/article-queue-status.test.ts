import assert from "node:assert/strict";
import test from "node:test";

import {
  ARTICLE_TOPIC_DEDUPE_STATUSES,
  assertArticleQueueTransition,
  parseArticleQueueStatus
} from "../article-queue-status";

test("allows the writing and release-review lifecycle", () => {
  assert.doesNotThrow(() => assertArticleQueueTransition("pending", "processing"));
  assert.doesNotThrow(() => assertArticleQueueTransition("processing", "completed"));
  assert.doesNotThrow(() => assertArticleQueueTransition("completed", "published"));
  assert.doesNotThrow(() => assertArticleQueueTransition("completed", "rejected"));
});

test("keeps production decisions terminal", () => {
  assert.throws(() => assertArticleQueueTransition("published", "processing"), /Cannot move published/);
  assert.throws(() => assertArticleQueueTransition("rejected", "published"), /Cannot move rejected/);
});

test("deduplicates terminal editorial decisions", () => {
  assert.deepEqual(ARTICLE_TOPIC_DEDUPE_STATUSES, ["pending", "processing", "completed", "published", "rejected"]);
  assert.equal(parseArticleQueueStatus("published"), "published");
  assert.throws(() => parseArticleQueueStatus("unknown"), /Unsupported queue status/);
});
