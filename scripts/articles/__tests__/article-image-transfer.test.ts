import assert from "node:assert/strict";
import test from "node:test";
import { markArticleImageUnavailable, uploadArticleImageWithRetries } from "../../content/article-image-transfer";
import { checkArticleImageReadiness, type ArticleImageEntry } from "../../content/article-image-readiness";

test("storage upload retries returned fetch failures and transient HTTP status with bounded backoff", async () => {
  let attempts = 0; const delays: number[] = [];
  await uploadArticleImageWithRetries(async () => ({ error: ++attempts === 1 ? { message: "fetch failed" } : attempts === 2 ? { message: "unavailable", statusCode: "503" } : null }), async ms => { delays.push(ms); });
  assert.equal(attempts, 3); assert.deepEqual(delays, [1000, 2000]);
  attempts = 0;
  await assert.rejects(uploadArticleImageWithRetries(async () => { attempts++; throw Error("fetch failed"); }, async () => {}), /3 attempt/);
  assert.equal(attempts, 3);
  attempts = 0;
  await assert.rejects(uploadArticleImageWithRetries(async () => { attempts++; return { error: { message: "forbidden", statusCode: 403 } }; }, async () => {}), /forbidden/);
  assert.equal(attempts, 1);
});
test("an unavailable optional image stays missing and permits an image-free article", () => {
  const entry: ArticleImageEntry = { id: "location", label: "Location", required: true, placement_heading: "Location", status: "verified", public_url: "https://example.com/image", uploaded_path: "old" };
  markArticleImageUnavailable(entry, "transfer", Error("fetch failed after retries"));
  assert.equal(entry.status, "missing"); assert.equal(entry.public_url, null);
  const result = checkArticleImageReadiness({ manifest: { schema: 1, article_slug: "article", visual_type: "locations", required: true, expected_count: 1, entries: [entry] }, finalJson: { slug: "article", content_md: "## Location\n\nFollow the landmark." } });
  assert.equal(result.ready, true, result.errors.join("\n")); assert.equal(result.summary.missing, 1);
});
