import assert from "node:assert/strict";
import test from "node:test";

import { statsPipelineLeaseName } from "../../shared/stats-pipeline-lease";
import { assignStatsTier } from "../stats-tier";
import { universeClaimBatchSize } from "../update-universe-hourly-stats";

test("universe claims stay below the production Data API response cap", () => {
  assert.equal(universeClaimBatchSize(Number.POSITIVE_INFINITY), 500);
  assert.equal(universeClaimBatchSize(20_000), 500);
  assert.equal(universeClaimBatchSize(237), 237);
  assert.equal(universeClaimBatchSize(20_000, 5_000), 500);
  assert.equal(universeClaimBatchSize(20_000, 250), 250);
});

test("pipeline lease names are stable across hosts", () => {
  assert.equal(statsPipelineLeaseName(["Universe-Refresh", "HOT"]), "universe-refresh:hot");
  assert.equal(statsPipelineLeaseName(["universe-rank", "hourly", "playing"]), "universe-rank:hourly:playing");
});

test("every valid universe tier remains visible inside the 24-hour freshness window", () => {
  assert.equal(assignStatsTier({ playing: 100, lastStatsRefreshedAt: "2026-01-01T00:00:00Z" }).refreshHours, 1);
  assert.equal(assignStatsTier({ visits: 10_000_000, lastStatsRefreshedAt: "2026-01-01T00:00:00Z" }).refreshHours, 12);
  assert.equal(assignStatsTier({ playing: 0, visits: 0, lastStatsRefreshedAt: "2026-01-01T00:00:00Z" }).refreshHours, 24);
});
