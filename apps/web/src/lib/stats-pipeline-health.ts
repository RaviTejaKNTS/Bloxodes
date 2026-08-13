export type StatsRefreshRunHealth = {
  started?: number;
  successful?: number;
  rows_succeeded?: number;
  rows_failed?: number;
  latest_started_at?: string | null;
  latest_finished_at?: string | null;
};

export type StatsPipelineHealthSnapshot = {
  generated_at: string;
  tiers: Record<string, number>;
  counts: {
    indexable_total: number;
    trackable_player_total: number;
    fresh_trackable_player_values_24h: number;
    unavailable_total: number;
    new_never_successful_total: number;
    new_never_successful_over_24h: number;
    expired_stats_leases: number;
    stats_overdue: number;
    current_index_rows: number;
    current_index_fresh_playing_24h: number;
  };
  latest: {
    current_index: string | null;
    hourly: string | null;
    rank_hourly: string | null;
  };
  recent_refresh_runs: Record<string, StatsRefreshRunHealth>;
  stale_job_runs: number;
};

export type StatsPipelineCheck = {
  name: string;
  status: "pass" | "warn" | "fail";
  value: unknown;
  expectation: string;
};

function ageHours(value: string | null, nowMs: number) {
  if (!value) return Number.POSITIVE_INFINITY;
  return Math.max(0, (nowMs - Date.parse(value)) / 3_600_000);
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function check(
  name: string,
  value: unknown,
  status: StatsPipelineCheck["status"],
  expectation: string
): StatsPipelineCheck {
  return { name, value, status, expectation };
}

export function evaluateStatsPipelineHealth(snapshot: StatsPipelineHealthSnapshot, nowMs = Date.now()) {
  const counts = snapshot.counts;
  const trackableCoverage = ratio(
    Number(counts.fresh_trackable_player_values_24h),
    Number(counts.trackable_player_total)
  );
  const indexCoverage = ratio(Number(counts.current_index_rows), Number(counts.indexable_total));
  const overdueRatio = ratio(Number(counts.stats_overdue), Number(counts.trackable_player_total));
  const refresh = (job: string) => snapshot.recent_refresh_runs[job] ?? {};
  const checks: StatsPipelineCheck[] = [
    check(
      "trackable_player_coverage",
      trackableCoverage,
      trackableCoverage >= 0.995 ? "pass" : trackableCoverage >= 0.98 ? "warn" : "fail",
      ">= 99.5% of games with a usable stored player observation remain visible"
    ),
    check(
      "current_index_coverage",
      indexCoverage,
      indexCoverage >= 0.995 ? "pass" : indexCoverage >= 0.98 ? "warn" : "fail",
      ">= 99.5% of indexable universes are present in the current read index"
    ),
    check(
      "refresh_overdue_ratio",
      overdueRatio,
      overdueRatio <= 0.1 ? "pass" : overdueRatio <= 0.2 ? "warn" : "fail",
      "<= 10% of trackable universes are currently due"
    ),
    check(
      "new_never_successful_over_24h",
      counts.new_never_successful_over_24h,
      counts.new_never_successful_over_24h <= 100 ? "pass" : counts.new_never_successful_over_24h <= 500 ? "warn" : "fail",
      "<= 100 NEW games remain without one successful refresh for over 24 hours"
    ),
    check("expired_stats_leases", counts.expired_stats_leases, counts.expired_stats_leases === 0 ? "pass" : "fail", "0 expired leases"),
    check("stale_job_runs", snapshot.stale_job_runs, snapshot.stale_job_runs === 0 ? "pass" : "fail", "0 jobs running over 2 hours"),
    check(
      "cold_refresh_outcome_6h",
      refresh("stats_refresh_cold").rows_succeeded ?? 0,
      (refresh("stats_refresh_cold").started ?? 0) >= 5 && (refresh("stats_refresh_cold").rows_succeeded ?? 0) > 0 ? "pass" : "fail",
      ">= 5 COLD starts and at least one successful row in 6 hours"
    ),
    check(
      "warm_refresh_outcome_6h",
      refresh("stats_refresh_warm").rows_succeeded ?? 0,
      (refresh("stats_refresh_warm").started ?? 0) >= 1 && (refresh("stats_refresh_warm").rows_succeeded ?? 0) > 0 ? "pass" : "fail",
      ">= 1 WARM start and at least one successful row in 6 hours"
    ),
    check(
      "current_index_freshness_hours",
      ageHours(snapshot.latest.current_index, nowMs),
      ageHours(snapshot.latest.current_index, nowMs) <= 2 ? "pass" : ageHours(snapshot.latest.current_index, nowMs) <= 3 ? "warn" : "fail",
      "<= 2 hours"
    ),
    check(
      "hourly_stats_freshness_hours",
      ageHours(snapshot.latest.hourly, nowMs),
      ageHours(snapshot.latest.hourly, nowMs) <= 2 ? "pass" : ageHours(snapshot.latest.hourly, nowMs) <= 3 ? "warn" : "fail",
      "<= 2 hours"
    ),
    check(
      "hourly_rank_freshness_hours",
      ageHours(snapshot.latest.rank_hourly, nowMs),
      ageHours(snapshot.latest.rank_hourly, nowMs) <= 2 ? "pass" : ageHours(snapshot.latest.rank_hourly, nowMs) <= 3 ? "warn" : "fail",
      "<= 2 hours"
    )
  ];
  const failures = checks.filter((entry) => entry.status === "fail");
  const warnings = checks.filter((entry) => entry.status === "warn");
  return {
    status: failures.length ? "unhealthy" as const : warnings.length ? "degraded" as const : "healthy" as const,
    checks,
    failures,
    warnings
  };
}
