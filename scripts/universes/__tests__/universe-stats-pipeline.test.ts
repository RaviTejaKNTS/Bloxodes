import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { statsPipelineLeaseName } from "../../shared/stats-pipeline-lease";
import { shouldUseDatabaseRankRefresh } from "../rank-universe-stats";
import { assignStatsTier } from "../stats-tier";
import { hasAnyFreshUniverseStat, universeClaimBatchSize } from "../update-universe-hourly-stats";

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

test("scheduled full-population rank jobs use the database implementation", () => {
  assert.equal(shouldUseDatabaseRankRefresh({ tier: "ALL", limit: 0, dryRun: false }), true);
  assert.equal(shouldUseDatabaseRankRefresh({ tier: "HOT", limit: 0, dryRun: false }), false);
  assert.equal(shouldUseDatabaseRankRefresh({ tier: "ALL", limit: 1000, dryRun: false }), false);
  assert.equal(shouldUseDatabaseRankRefresh({ tier: "ALL", limit: 0, dryRun: true }), false);
});

test("every valid universe tier remains visible inside the 24-hour freshness window", () => {
  assert.equal(assignStatsTier({ playing: 100, lastStatsRefreshedAt: "2026-01-01T00:00:00Z" }).refreshHours, 1);
  assert.equal(assignStatsTier({ visits: 10_000_000, lastStatsRefreshedAt: "2026-01-01T00:00:00Z" }).refreshHours, 12);
  assert.equal(assignStatsTier({ playing: 0, visits: 0, lastStatsRefreshedAt: "2026-01-01T00:00:00Z" }).refreshHours, 23);
});

test("all-null Roblox detail responses are not treated as successful refreshes", () => {
  assert.equal(
    hasAnyFreshUniverseStat({ playing: null, visits: null, favorites: null, likes: null, dislikes: null }),
    false
  );
  assert.equal(
    hasAnyFreshUniverseStat({ playing: 0, visits: null, favorites: null, likes: null, dislikes: null }),
    true
  );
});

test("database scheduling keeps visibility headroom without bypassing unavailable cooldowns", () => {
  const migration = readFileSync(
    new URL("../../../supabase/migrations/20260920000003_align_cold_stats_with_public_freshness.sql", import.meta.url),
    "utf8"
  );

  assert.match(migration, /last_playing_refreshed_at \+ interval '23 hours'/);
  assert.match(migration, /statement_timestamp\(\) \+ interval '1 hour'/);
  assert.match(migration, /stats_tier_reason = 'game_details_unavailable'/);
  assert.match(migration, /before update of/);
});

test("VPS owns database-only ranks and the serialized index exactly once", () => {
  const cron = readFileSync(new URL("../../ops/vps-universe-stats.crontab", import.meta.url), "utf8");
  const lines = cron.split("\n").filter((line) => line && !line.startsWith("#"));

  assert.equal(lines.filter((line) => line.includes(" stats-hourly-ranks ")).length, 1);
  assert.equal(lines.filter((line) => line.includes(" stats-daily-ranks ")).length, 1);
  assert.equal(lines.filter((line) => line.includes(" stats-current-index ")).length, 1);
  assert.equal(lines.some((line) => line.includes("stats:refresh:hot")), false);
  assert.equal(lines.filter((line) => line.includes("stats-hourly-ranks")).some((line) => line.includes("JOB_LOCK_GROUP")), false);
  assert.equal(lines.filter((line) => line.includes("stats-daily-ranks")).some((line) => line.includes("JOB_LOCK_GROUP")), false);
});

test("universe refresh capacity cannot be starved by the item API lock", () => {
  const universeCron = readFileSync(new URL("../../ops/vps-universe-stats.crontab", import.meta.url), "utf8");
  const itemCron = readFileSync(new URL("../../ops/vps-scheduled-automation.crontab", import.meta.url), "utf8");
  const universeLines = universeCron.split("\n").filter((line) => line && !line.startsWith("#"));
  const groupedUniverseLines = universeLines.filter((line) => line.includes("JOB_LOCK_GROUP"));

  assert.ok(groupedUniverseLines.length > 0);
  assert.equal(groupedUniverseLines.every((line) => line.includes("JOB_LOCK_GROUP=roblox-universe-api")), true);
  assert.equal(itemCron.includes("JOB_LOCK_GROUP=roblox-universe-api"), false);
  for (const job of ["stats-new-refresh", "stats-warm-refresh", "stats-cold-refresh"]) {
    const line = universeLines.find((candidate) => candidate.includes(` ${job} `));
    assert.ok(line);
    assert.match(line, /JOB_LOCK_WAIT_SECONDS=1800/);
  }
  const warmLine = universeLines.find((line) => line.includes(" stats-warm-refresh "));
  assert.ok(warmLine);
  assert.match(warmLine, /^32 \*\/6 \* \* \*/);
});

test("VPS runner uses the internal Supabase network and fails closed when it is absent", () => {
  const runner = readFileSync(new URL("../../ops/vps-run-job.sh", import.meta.url), "utf8");

  assert.match(runner, /STATS_WORKER_DOCKER_NETWORK:-supabase_default/);
  assert.match(runner, /STATS_WORKER_SUPABASE_INTERNAL_URL:-http:\/\/supabase-kong:8000/);
  assert.match(runner, /docker network inspect "\$DOCKER_NETWORK"/);
  assert.match(runner, /--network "\$DOCKER_NETWORK"/);
  assert.match(runner, /-e SUPABASE_URL="\$SUPABASE_INTERNAL_URL"/);
  assert.match(runner, /JOB_LOCK_WAIT_SECONDS/);
  assert.match(runner, /flock -w "\$LOCK_WAIT_SECONDS"/);
  assert.match(runner, /timed out waiting for lock group/);
});
