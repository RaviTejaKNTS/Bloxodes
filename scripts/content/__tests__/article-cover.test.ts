import assert from "node:assert/strict";
import test from "node:test";

import {
  articleCoverStoragePath,
  normalizeCoverOverlayTitle,
} from "../../shared/article-cover";

test("article cover paths are stable and article-owned", () => {
  assert.equal(
    articleCoverStoragePath("speed-monkey-escape-events-guide"),
    "articles/speed-monkey-escape-events-guide/speed-monkey-escape-events-guide-cover.webp",
  );
  assert.equal(
    articleCoverStoragePath("evomon-season-2-tier-list", "evomon-season-2-tier-list-edited"),
    "articles/evomon-season-2-tier-list/evomon-season-2-tier-list-edited-cover.webp",
  );
});

test("cover overlay titles are whitespace-normalized and bounded", () => {
  assert.equal(normalizeCoverOverlayTitle("  Evomon   Season 2  "), "Evomon Season 2");
  assert.equal(normalizeCoverOverlayTitle("1234567890".repeat(8), 10)?.length, 10);
  assert.equal(normalizeCoverOverlayTitle("   "), null);
});
