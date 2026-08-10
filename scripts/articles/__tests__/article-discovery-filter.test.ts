import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_ARTICLE_DISCOVERY_MAX_AGE_HOURS,
  filterRecentDiscoveryCandidates,
  validateDiscoveryMaxAgeHours
} from "../article-discovery-filter";

const NOW = Date.parse("2026-08-10T12:00:00.000Z");

test("uses an 18-hour window and refuses 24 hours or more", () => {
  assert.equal(DEFAULT_ARTICLE_DISCOVERY_MAX_AGE_HOURS, 18);
  assert.equal(validateDiscoveryMaxAgeHours(23.5), 23.5);
  assert.throws(() => validateDiscoveryMaxAgeHours(24), /less than 24/);
  assert.throws(() => validateDiscoveryMaxAgeHours(96), /less than 24/);
});

test("reports each discovery loss stage and keeps only fresh non-code rows", () => {
  const result = filterRecentDiscoveryCandidates([
    { sourceUrl: "https://source.test/fresh", title: "Fisch Trident Striker Ritual Guide", publishedAt: "2026-08-10T06:00:00.000Z" },
    { sourceUrl: "https://source.test/codes", title: "Fisch Codes", publishedAt: "2026-08-10T05:00:00.000Z" },
    { sourceUrl: "https://source.test/stale", title: "Old Roblox Guide", publishedAt: "2026-08-09T12:00:00.000Z" },
    { sourceUrl: "https://source.test/no-title", title: "", publishedAt: "2026-08-10T04:00:00.000Z" },
    { sourceUrl: "https://source.test/no-date", title: "No Date Guide", publishedAt: null },
    { sourceUrl: "https://source.test/fresh", title: "Duplicate URL Guide", publishedAt: "2026-08-10T07:00:00.000Z" }
  ], {
    maxAgeHours: 18,
    limit: 25,
    now: NOW,
    exclude: (candidate) => /\bcodes\b/i.test(candidate.title)
  });

  assert.deepEqual(result.candidates.map((candidate) => candidate.title), ["Fisch Trident Striker Ritual Guide"]);
  assert.equal(result.stats.raw, 6);
  assert.equal(result.stats.excluded, 1);
  assert.equal(result.stats.stale, 1);
  assert.equal(result.stats.missingTitle, 1);
  assert.equal(result.stats.missingPublishedAt, 1);
  assert.equal(result.stats.duplicateUrl, 1);
  assert.equal(result.stats.eligible, 1);
});
