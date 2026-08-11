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

test("universe refresh capacity is protected from item and discovery work", () => {
  const universeCron = readFileSync(new URL("../../ops/vps-universe-stats.crontab", import.meta.url), "utf8");
  const itemCron = readFileSync(new URL("../../ops/vps-scheduled-automation.crontab", import.meta.url), "utf8");
  const universeLines = universeCron.split("\n").filter((line) => line && !line.startsWith("#"));

  for (const job of ["stats-new-refresh", "stats-warm-refresh", "stats-cold-refresh"]) {
    const line = universeLines.find((candidate) => candidate.includes(` ${job} `));
    assert.ok(line);
    assert.match(line, /JOB_LOCK_GROUP=roblox-universe-refresh/);
    assert.match(line, /JOB_LOCK_WAIT_SECONDS=1800/);
  }
  assert.equal(itemCron.includes("JOB_LOCK_GROUP=roblox-universe-refresh"), false);
  assert.equal(
    universeLines
      .filter((line) => line.includes("JOB_LOCK_GROUP=roblox-universe-refresh"))
      .every((line) => / stats-(new|warm|cold)-refresh /.test(line)),
    true
  );

  const priorityDiscoveryLine = universeLines.find((line) => line.includes(" stats-discovery-priority "));
  assert.ok(priorityDiscoveryLine);
  assert.match(priorityDiscoveryLine, /JOB_LOCK_GROUP=roblox-universe-discovery/);
  assert.match(priorityDiscoveryLine, /--max-pages 1/);
  assert.match(priorityDiscoveryLine, /--devices computer/);
  assert.match(priorityDiscoveryLine, /--countries us,br,ph/);

  for (const disabledJob of [
    "stats-discovery ",
    "stats-discovery-search ",
    "stats-discovery-creators ",
    "stats-deep-enrichment "
  ]) {
    assert.equal(universeLines.some((line) => line.includes(` ${disabledJob}`)), false);
  }

  const newLine = universeLines.find((line) => line.includes(" stats-new-refresh "));
  assert.ok(newLine);
  assert.doesNotMatch(newLine, /enrich:universes/);
  const warmLine = universeLines.find((line) => line.includes(" stats-warm-refresh "));
  assert.ok(warmLine);
  assert.match(warmLine, /^32 \*\/6 \* \* \*/);
});

test("the COLD schedule has full-day capacity above the tracked population", () => {
  const cron = readFileSync(new URL("../../ops/vps-universe-stats.crontab", import.meta.url), "utf8");
  const coldLine = cron
    .split("\n")
    .find((line) => line && !line.startsWith("#") && line.includes(" stats-cold-refresh "));
  assert.ok(coldLine);
  assert.match(coldLine, /^47 \* \* \* \*/);
  const limit = Number(coldLine.match(/stats:refresh:cold -- --limit (\d+)/)?.[1] ?? 0);
  const dailyCapacity = 24 * limit;
  assert.equal(limit, 5_000);
  assert.ok(dailyCapacity >= 120_000, `expected at least 120K COLD rows/day, got ${dailyCapacity}`);
});

test("the scheduled universe audit is strict and uses one health RPC", () => {
  const cron = readFileSync(new URL("../../ops/vps-universe-stats.crontab", import.meta.url), "utf8");
  const audit = readFileSync(new URL("../audit-universe-stats-workflow.ts", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../../../supabase/migrations/20260920000006_add_universe_pipeline_health_rpc.sql", import.meta.url),
    "utf8"
  );

  assert.match(cron, /stats-audit "npm run stats:audit -- --strict"/);
  assert.match(audit, /rpc\("get_roblox_universe_pipeline_health"\)/);
  assert.match(audit, /public_playing_coverage/);
  assert.match(audit, /cold_refresh_starts_6h/);
  assert.match(audit, /if \(STRICT && failures\.length\) process\.exitCode = 1/);
  assert.match(migration, /create or replace function public\.get_roblox_universe_pipeline_health\(\)/);
  assert.match(migration, /last_playing_refreshed_at >= now\(\) - interval '24 hours'/);
  assert.match(migration, /started_at >= now\(\) - interval '6 hours'/);
  assert.match(migration, /grant execute .* to service_role/);
});

test("broad search discovery is bounded and rate-limit circuit broken by default", () => {
  const search = readFileSync(new URL("../search-roblox-universes.ts", import.meta.url), "utf8");

  assert.match(search, /ROBLOX_SEARCH_QUERY_LIMIT", 24/);
  assert.match(search, /ROBLOX_SEARCH_MAX_PAGES", 1/);
  assert.match(search, /ROBLOX_SEARCH_MAX_RUNTIME_SECONDS", 600/);
  assert.match(search, /ROBLOX_SEARCH_MAX_CONSECUTIVE_RATE_LIMITS/);
  assert.match(search, /stoppedReason = "consecutive_rate_limits"/);
  assert.match(search, /dailyRotationOffset/);
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
