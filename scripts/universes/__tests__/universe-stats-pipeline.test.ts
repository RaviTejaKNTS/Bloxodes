import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { statsPipelineLeaseName } from "../../shared/stats-pipeline-lease";
import { formatDataApiError } from "../../shared/data-api-retry";
import { shouldUseDatabaseRankRefresh } from "../rank-universe-stats";
import { assignStatsTier, shouldPreserveStatsTierReason } from "../stats-tier";
import {
  hasAnyFreshUniverseStat,
  isTransientDataApiFailure,
  runDataApiOperation,
  universeClaimBatchSize
} from "../update-universe-hourly-stats";

const immediateRetry = {
  baseDelayMs: 0,
  maxDelayMs: 0,
  sleep: async () => {}
};

test("universe claims stay below the production Data API response cap", () => {
  assert.equal(universeClaimBatchSize(Number.POSITIVE_INFINITY), 500);
  assert.equal(universeClaimBatchSize(20_000), 500);
  assert.equal(universeClaimBatchSize(237), 237);
  assert.equal(universeClaimBatchSize(20_000, 5_000), 500);
  assert.equal(universeClaimBatchSize(20_000, 250), 250);
});

test("transient Data API failures retry individual operations and then succeed", async () => {
  let calls = 0;
  const result = await runDataApiOperation(
    "test operation",
    async () => {
      calls += 1;
      if (calls < 3) {
        return {
          data: null,
          error: { code: "PGRST001", message: "An invalid response was received from the upstream server" },
          status: 502
        };
      }
      return { data: "ok", error: null, status: 200 };
    },
    { ...immediateRetry, retryLimit: 3 }
  );

  assert.equal(calls, 3);
  assert.equal(result.data, "ok");
});

test("non-transient Data API failures are not retried", async () => {
  let calls = 0;
  await assert.rejects(
    runDataApiOperation(
      "test operation",
      async () => {
        calls += 1;
        return { data: null, error: { code: "23505", message: "duplicate key" }, status: 409 };
      },
      { ...immediateRetry, retryLimit: 3 }
    ),
    /duplicate key/
  );
  assert.equal(calls, 1);
});

test("transient Data API retry exhaustion returns the final failure", async () => {
  let calls = 0;
  await assert.rejects(
    runDataApiOperation(
      "test operation",
      async () => {
        calls += 1;
        return { data: null, error: { code: "PGRST003", message: "pool timeout" }, status: 504 };
      },
      { ...immediateRetry, retryLimit: 2 }
    ),
    /pool timeout/
  );
  assert.equal(calls, 3);
});

test("ambiguous mutation retries reuse one fixed payload", async () => {
  const payload = Object.freeze({ universe_id: 123, hour_start: "2026-08-14T10:00:00.000Z", sample_count: 4 });
  const attemptedPayloads: Array<typeof payload> = [];
  let stored: typeof payload | null = null;
  let calls = 0;

  await runDataApiOperation(
    "hourly upsert",
    async () => {
      calls += 1;
      attemptedPayloads.push(payload);
      stored = { ...payload };
      return calls === 1
        ? { data: null, error: { message: "An invalid response was received from the upstream server" }, status: 502 }
        : { data: null, error: null, status: 201 };
    },
    { ...immediateRetry, retryLimit: 2 }
  );

  assert.equal(calls, 2);
  assert.equal(attemptedPayloads[0], payload);
  assert.equal(attemptedPayloads[1], payload);
  assert.deepEqual(stored, payload);
  assert.equal(stored?.sample_count, 4);
});

test("Data API transient classification stays narrow", () => {
  assert.equal(isTransientDataApiFailure({ status: 503 }), true);
  assert.equal(isTransientDataApiFailure({ error: new TypeError("fetch failed") }), true);
  assert.equal(isTransientDataApiFailure({ error: { code: "PGRST000", message: "database unavailable" } }), true);
  assert.equal(isTransientDataApiFailure({ status: 400, error: { code: "PGRST100", message: "bad request" } }), false);
});

test("structured Data API failures retain useful diagnostics", () => {
  assert.equal(
    formatDataApiError({ message: "upstream failed", details: "connection pool timeout", hint: "retry later" }),
    "upstream failed; connection pool timeout; retry later"
  );
  assert.equal(formatDataApiError({ unexpected: "shape" }), '{"unexpected":"shape"}');
});

test("serialized current-index RPC uses the transient Data API retry boundary", () => {
  const source = readFileSync(new URL("../rebuild-stats-current-indexes.ts", import.meta.url), "utf8");
  assert.match(source, /runDataApiOperation\("Refresh serialized stats current indexes"/);
  assert.match(source, /rpc\("refresh_stats_current_indexes_serialized"\)/);
});

test("claim RPCs remain outside generic retries while writes are guarded and retried", () => {
  const source = readFileSync(new URL("../update-universe-hourly-stats.ts", import.meta.url), "utf8");
  const claimStart = source.indexOf("async function claimUniverseBatch");
  const claimEnd = source.indexOf("async function releaseUniverseLeases", claimStart);
  const claimSource = source.slice(claimStart, claimEnd);

  assert.doesNotMatch(claimSource, /runDataApiOperation/);
  assert.match(source, /\.eq\("stats_refresh_locked_by", WORKER_ID\)/);
  assert.match(source, /runDataApiOperation\("Upsert universe hourly stats"/);
  assert.match(source, /runDataApiOperation\("Upsert universe update events"/);
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
  assert.equal(assignStatsTier({ playing: 0, visits: 0, lastStatsRefreshedAt: "2026-01-01T00:00:00Z" }).refreshHours, 20);
});

test("COLD phase budget remains below the public cutoff", () => {
  const completionMinute = 56;
  const dueHours = 20;
  const maximumPollDelayMinutes = 51;
  const maximumLockWaitMinutes = 30;
  const workAndIndexMinutes = 15;
  const maximumAgeMinutes = dueHours * 60 + maximumPollDelayMinutes + maximumLockWaitMinutes + workAndIndexMinutes;
  assert.ok(completionMinute > 47);
  assert.ok(maximumAgeMinutes < 24 * 60);
});

test("manual tier repair preserves unavailable quarantine", () => {
  assert.equal(shouldPreserveStatsTierReason("game_details_unavailable"), true);
  assert.equal(shouldPreserveStatsTierReason("remaining_valid_game"), false);
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

test("database scheduling keeps phase-safe visibility headroom without bypassing unavailable cooldowns", () => {
  const migration = readFileSync(
    new URL("../../../supabase/migrations/20260920000009_stabilize_universe_stats_recurrence.sql", import.meta.url),
    "utf8"
  );

  assert.match(migration, /last_playing_refreshed_at \+ interval '20 hours'/);
  assert.match(migration, /statement_timestamp\(\) \+ interval '1 hour'/);
  assert.match(migration, /stats_tier_reason = 'game_details_unavailable'/);
  assert.match(migration, /next_stats_refresh_at = statement_timestamp\(\) \+ interval '168 hours'/);
});

test("VPS owns hourly ranks, pauses unused daily ranks, and publishes index after COLD", () => {
  const cron = readFileSync(new URL("../../ops/vps-universe-stats.crontab", import.meta.url), "utf8");
  const lines = cron.split("\n").filter((line) => line && !line.startsWith("#"));

  assert.equal(lines.filter((line) => line.includes(" stats-hourly-ranks ")).length, 1);
  assert.equal(lines.filter((line) => line.includes(" stats-daily-ranks ")).length, 0);
  assert.equal(lines.filter((line) => line.includes(" stats-current-index ")).length, 0);
  assert.equal(lines.some((line) => line.includes("stats:refresh:hot")), false);
  assert.equal(lines.filter((line) => line.includes("stats-hourly-ranks")).some((line) => line.includes("JOB_LOCK_GROUP")), false);
  const coldLine = lines.find((line) => line.includes(" stats-cold-refresh ")) ?? "";
  assert.ok(coldLine.indexOf("stats:refresh:cold") < coldLine.indexOf("stats:index:refresh"));
  assert.equal(lines.filter((line) => line.includes("stats:index:refresh")).length, 1);
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
  assert.doesNotMatch(newLine, /stats:tier/);
  const tierScript = readFileSync(new URL("../assign-universe-stats-tier.ts", import.meta.url), "utf8");
  assert.match(tierScript, /\.gt\("universe_id", afterUniverseId\)/);
  assert.doesNotMatch(tierScript, /\.range\(/);
  const warmLine = universeLines.find((line) => line.includes(" stats-warm-refresh "));
  assert.ok(warmLine);
  assert.match(warmLine, /^32 \*\/6 \* \* \*/);
});

test("the COLD schedule has cadence and failure headroom above the tracked population", () => {
  const cron = readFileSync(new URL("../../ops/vps-universe-stats.crontab", import.meta.url), "utf8");
  const coldLine = cron
    .split("\n")
    .find((line) => line && !line.startsWith("#") && line.includes(" stats-cold-refresh "));
  assert.ok(coldLine);
  assert.match(coldLine, /^47 \* \* \* \*/);
  const limit = Number(coldLine.match(/stats:refresh:cold -- --limit (\d+)/)?.[1] ?? 0);
  const usableDailyCapacity = 24 * limit * 0.9;
  const requiredCapacity = 120_000 * (24 / 20) * 1.05;
  assert.equal(limit, 7_000);
  assert.ok(usableDailyCapacity >= requiredCapacity, `expected ${requiredCapacity} usable rows/day, got ${usableDailyCapacity}`);
});

test("the scheduled universe audit is strict and uses one health RPC", () => {
  const cron = readFileSync(new URL("../../ops/vps-universe-stats.crontab", import.meta.url), "utf8");
  const audit = readFileSync(new URL("../audit-universe-stats-workflow.ts", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../../../supabase/migrations/20260920000006_add_universe_pipeline_health_rpc.sql", import.meta.url),
    "utf8"
  );
  const scopedMigration = readFileSync(
    new URL("../../../supabase/migrations/20260920000007_scope_universe_pipeline_stale_jobs.sql", import.meta.url),
    "utf8"
  );
  const fastMigration = readFileSync(
    new URL("../../../supabase/migrations/20260920000008_add_fast_universe_pipeline_health_rpc.sql", import.meta.url),
    "utf8"
  );

  assert.match(cron, /stats-audit "npm run stats:audit -- --strict"/);
  assert.match(audit, /rpc\("get_roblox_universe_pipeline_health_v4"\)/);
  assert.match(audit, /evaluateStatsPipelineHealth/);
  assert.match(audit, /if \(STRICT && failures\.length\) process\.exitCode = 1/);
  assert.match(migration, /create or replace function public\.get_roblox_universe_pipeline_health\(\)/);
  assert.match(migration, /last_playing_refreshed_at >= now\(\) - interval '24 hours'/);
  assert.match(migration, /started_at >= now\(\) - interval '6 hours'/);
  assert.match(migration, /grant execute .* to service_role/);
  assert.match(scopedMigration, /started_at >= now\(\) - interval '24 hours'/);
  assert.match(scopedMigration, /job_name like 'stats_refresh_%'/);
  assert.match(scopedMigration, /job_name like 'discover_universes_%'/);
  assert.doesNotMatch(scopedMigration, /stats_items_/);
  assert.match(fastMigration, /get_roblox_universe_pipeline_health_v3/);
  assert.match(fastMigration, /current_index_fresh_playing_24h/);
  assert.doesNotMatch(fastMigration, /roblox_universe_stats_daily/);
  assert.doesNotMatch(fastMigration, /roblox_universe_rank_snapshots_daily/);
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

test("stats worker image includes and validates every env-routing runtime dependency", () => {
  const dockerfile = readFileSync(
    new URL("../../../Dockerfile.stats-worker", import.meta.url),
    "utf8"
  );
  const smoke = readFileSync(new URL("../../ops/smoke-stats-worker.ts", import.meta.url), "utf8");

  assert.match(dockerfile, /COPY env\/config\.json \.\/env\/config\.json/);
  assert.match(dockerfile, /RUN npm run stats:worker:smoke/);
  assert.match(smoke, /scripts\/shared\/env-files\.ts/);
  assert.match(smoke, /scripts\/universes\/update-universe-hourly-stats\.ts/);
  assert.match(smoke, /loaded\.profile !== "process-only"/);
});

test("VPS worker promotion is exact-SHA, smoke-gated, and recoverable", () => {
  const builder = readFileSync(
    new URL("../../ops/vps-build-stats-worker.sh", import.meta.url),
    "utf8"
  );
  const runner = readFileSync(new URL("../../ops/vps-run-job.sh", import.meta.url), "utf8");

  assert.match(builder, /--approved-sha/);
  assert.match(builder, /candidate-\$SHORT_SHA/);
  assert.match(builder, /npm run stats:worker:smoke/);
  assert.match(builder, /bloxodes-stats-worker:last-known-good/);
  assert.match(builder, /docker tag "\$CANDIDATE_IMAGE" "\$IMAGE"/);
  assert.doesNotMatch(builder, /reset --hard origin\/production/);
  assert.match(runner, /production image failed smoke/);
  assert.match(runner, /restored last-known-good worker image/);
});
