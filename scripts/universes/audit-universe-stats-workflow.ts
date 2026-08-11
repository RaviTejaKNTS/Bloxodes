import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";

type RefreshRunHealth = {
  started?: number;
  successful?: number;
  rows_succeeded?: number;
  latest_started_at?: string | null;
  latest_finished_at?: string | null;
};

type HealthSnapshot = {
  generated_at: string;
  tiers: Record<string, number>;
  counts: {
    total: number;
    eligible_total: number;
    with_root_place: number;
    with_slug: number;
    with_icon: number;
    never_stats_refreshed: number;
    never_playing_refreshed: number;
    stale_over_24h: number;
    stale_over_7d: number;
    stale_player_values_over_24h: number;
    stale_player_values_over_7d: number;
    fresh_player_values_24h: number;
    missing_icon_hot: number;
    missing_icon_warm: number;
    active_stats_leases: number;
    expired_stats_leases: number;
    retry_backoff: number;
    unavailable_cooldowns: number;
    rows_with_refresh_sla: number;
    stats_overdue: number;
    current_index_rows: number;
    current_index_playing_rows: number;
    current_index_fresh_playing_24h: number;
  };
  latest: {
    current_index: string | null;
    hourly: string | null;
    daily: string | null;
    rank_hourly: string | null;
    rank_daily: string | null;
  };
  recent_refresh_runs: Record<string, RefreshRunHealth>;
  stale_job_runs: number;
};

type Check = {
  name: string;
  status: "pass" | "warn" | "fail";
  value: unknown;
  expectation: string;
};

const STRICT = process.argv.includes("--strict");

function ageHours(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - new Date(value).getTime()) / 3_600_000);
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function check(name: string, value: unknown, status: Check["status"], expectation: string): Check {
  return { name, status, value, expectation };
}

function refreshStarts(snapshot: HealthSnapshot, jobName: string) {
  return Number(snapshot.recent_refresh_runs[jobName]?.started ?? 0);
}

function evaluate(snapshot: HealthSnapshot): Check[] {
  const counts = snapshot.counts;
  const publicPlayingCoverage = ratio(
    Number(counts.current_index_fresh_playing_24h),
    Number(counts.current_index_playing_rows)
  );
  const indexCoverage = ratio(Number(counts.current_index_rows), Number(counts.eligible_total));
  const overdueRatio = ratio(Number(counts.stats_overdue), Number(counts.eligible_total));
  const indexAge = ageHours(snapshot.latest.current_index);
  const hourlyAge = ageHours(snapshot.latest.hourly);
  const rankHourlyAge = ageHours(snapshot.latest.rank_hourly);
  const coldStarts = refreshStarts(snapshot, "stats_refresh_cold");
  const warmStarts = refreshStarts(snapshot, "stats_refresh_warm");
  const newStarts = refreshStarts(snapshot, "stats_refresh_new");

  return [
    check(
      "public_playing_coverage",
      publicPlayingCoverage,
      publicPlayingCoverage >= 0.995 ? "pass" : publicPlayingCoverage >= 0.98 ? "warn" : "fail",
      ">= 99.5% of indexed games with stored player stats remain visible inside the 24-hour cutoff"
    ),
    check(
      "current_index_coverage",
      indexCoverage,
      indexCoverage >= 0.995 ? "pass" : indexCoverage >= 0.98 ? "warn" : "fail",
      ">= 99.5% of eligible universes are present in the current read index"
    ),
    check(
      "refresh_overdue_ratio",
      overdueRatio,
      overdueRatio <= 0.1 ? "pass" : overdueRatio <= 0.2 ? "warn" : "fail",
      "<= 10% of eligible universes are currently due"
    ),
    check(
      "expired_stats_leases",
      counts.expired_stats_leases,
      counts.expired_stats_leases === 0 ? "pass" : "fail",
      "0 refresh leases older than 45 minutes"
    ),
    check(
      "stale_job_runs",
      snapshot.stale_job_runs,
      snapshot.stale_job_runs === 0 ? "pass" : "fail",
      "0 stats jobs left running for more than 2 hours"
    ),
    check(
      "cold_refresh_starts_6h",
      coldStarts,
      coldStarts >= 5 ? "pass" : coldStarts >= 4 ? "warn" : "fail",
      ">= 5 COLD refresh workers started in the last 6 hours"
    ),
    check(
      "warm_refresh_starts_6h",
      warmStarts,
      warmStarts >= 1 ? "pass" : "fail",
      ">= 1 WARM refresh worker started in the last 6 hours"
    ),
    check(
      "new_refresh_starts_6h",
      newStarts,
      newStarts >= 2 ? "pass" : newStarts >= 1 ? "warn" : "fail",
      ">= 2 NEW refresh workers started in the last 6 hours"
    ),
    check(
      "current_index_freshness_hours",
      indexAge,
      indexAge <= 2 ? "pass" : indexAge <= 3 ? "warn" : "fail",
      "<= 2 hours"
    ),
    check(
      "hourly_stats_freshness_hours",
      hourlyAge,
      hourlyAge <= 2 ? "pass" : hourlyAge <= 3 ? "warn" : "fail",
      "<= 2 hours"
    ),
    check(
      "hourly_rank_freshness_hours",
      rankHourlyAge,
      rankHourlyAge <= 2 ? "pass" : rankHourlyAge <= 3 ? "warn" : "fail",
      "<= 2 hours"
    )
  ];
}

async function main() {
  const run = await startStatsJobRun({ jobName: "stats_universe_audit", metadata: { strict: STRICT } });

  try {
    const { data, error } = await supabaseAdmin().rpc("get_roblox_universe_pipeline_health");
    if (error) throw new Error(`Failed to load universe pipeline health: ${error.message}`);
    const snapshot = data as HealthSnapshot;
    const checks = evaluate(snapshot);
    const failures = checks.filter((entry) => entry.status === "fail");
    const warnings = checks.filter((entry) => entry.status === "warn");
    const health = failures.length ? "unhealthy" : warnings.length ? "degraded" : "healthy";
    const report = { health, strict: STRICT, checks, snapshot };

    await finishStatsJobRun(run, {
      status: failures.length ? "partial" : "success",
      rowsClaimed: Number(snapshot.counts.eligible_total),
      rowsSucceeded: Number(snapshot.counts.current_index_fresh_playing_24h),
      rowsFailed: Number(snapshot.counts.stale_player_values_over_24h),
      metadata: report
    });
    console.log(JSON.stringify(report, null, 2));
    if (STRICT && failures.length) process.exitCode = 1;
  } catch (error) {
    await finishStatsJobRun(run, { status: "failed", error });
    throw error;
  }
}

main().catch((error) => {
  console.error("Universe stats workflow audit failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
