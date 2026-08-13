import { describe, expect, it } from "vitest";
import { evaluateStatsPipelineHealth, type StatsPipelineHealthSnapshot } from "../stats-pipeline-health";

const now = Date.parse("2026-08-13T02:00:00.000Z");

function snapshot(overrides: Partial<StatsPipelineHealthSnapshot["counts"]> = {}): StatsPipelineHealthSnapshot {
  return {
    generated_at: new Date(now).toISOString(),
    tiers: {},
    counts: {
      indexable_total: 100_000,
      trackable_player_total: 98_000,
      fresh_trackable_player_values_24h: 97_900,
      unavailable_total: 1_400,
      new_never_successful_total: 100,
      new_never_successful_over_24h: 50,
      expired_stats_leases: 0,
      stats_overdue: 2_000,
      current_index_rows: 99_800,
      current_index_fresh_playing_24h: 97_900,
      ...overrides
    },
    latest: {
      current_index: "2026-08-13T01:45:00.000Z",
      hourly: "2026-08-13T01:00:00.000Z",
      rank_hourly: "2026-08-13T01:00:00.000Z"
    },
    recent_refresh_runs: {
      stats_refresh_cold: { started: 6, rows_succeeded: 20_000 },
      stats_refresh_warm: { started: 1, rows_succeeded: 500 }
    },
    stale_job_runs: 0
  };
}

describe("evaluateStatsPipelineHealth", () => {
  it("does not count quarantined unavailable games against player coverage", () => {
    expect(evaluateStatsPipelineHealth(snapshot(), now).status).toBe("healthy");
  });

  it("fails when previously trackable games collapse out of freshness", () => {
    expect(evaluateStatsPipelineHealth(snapshot({ fresh_trackable_player_values_24h: 7_000 }), now).status).toBe("unhealthy");
  });

  it("fails a worker that starts but refreshes zero rows", () => {
    const value = snapshot();
    value.recent_refresh_runs.stats_refresh_cold = { started: 6, rows_succeeded: 0 };
    expect(evaluateStatsPipelineHealth(value, now).status).toBe("unhealthy");
  });
});
