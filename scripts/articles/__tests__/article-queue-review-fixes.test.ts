import assert from "node:assert/strict";
import test from "node:test";
import { duplicateQueueRow, type ArticleQueueRow, type NotionArticleQueue } from "../notion-article-queue";
import { confirmArticleQueueClaim } from "../article-queue-claim";

const queued = (extra: Record<string, any>) => ({
  id: "11111111-1111-1111-1111-111111111111", article_title: "Fisch Kraken Boss Guide", status: "pending",
  topic_key: "fisch-kraken-boss-guide", idempotency_key: "global:fisch-kraken-boss-guide", ...extra,
}) as unknown as ArticleQueueRow;

test("a matching topic key is a duplicate even when the titles read differently", () => {
  const existing = queued({});
  const incoming = { article_title: "Kraken Boss Strategy in Fisch", topic_key: "fisch-kraken-boss-guide", idempotency_key: "global:other" };
  assert.equal(duplicateQueueRow([existing], incoming)?.id, existing.id);
});

test("a matching idempotency key is a duplicate even when the titles read differently", () => {
  const existing = queued({});
  const incoming = { article_title: "Kraken Boss Strategy in Fisch", topic_key: "other", idempotency_key: "global:fisch-kraken-boss-guide" };
  assert.equal(duplicateQueueRow([existing], incoming)?.id, existing.id);
});

test("a skipped row's keys don't block a topic", () => {
  const existing = queued({ status: "skipped" });
  const incoming = { article_title: "Kraken Boss Strategy in Fisch", topic_key: "fisch-kraken-boss-guide" };
  assert.equal(duplicateQueueRow([existing], incoming), null);
});

test("claim read-back retries a failed read and then hands back the token", async () => {
  const token = "t3-content-factory#22222222-2222-2222-2222-222222222222";
  const claimedAt = "2026-11-16T12:00:00.000Z";
  let reads = 0;
  const flaky = { get: async () => {
    reads++;
    if (reads < 3) throw new Error("Notion 502");
    return { id: "x", status: "processing", locked_by: token, locked_at: claimedAt };
  } } as unknown as NotionArticleQueue;
  const row = await confirmArticleQueueClaim(flaky, "x", token, claimedAt, async () => {});
  assert.equal(row.locked_by, token);
  assert.equal(reads, 3);

  const down = { get: async () => { throw new Error("Notion 502"); } } as unknown as NotionArticleQueue;
  await assert.rejects(confirmArticleQueueClaim(down, "x", token, claimedAt, async () => {}), (error: Error) => error.message.includes(token));
});
