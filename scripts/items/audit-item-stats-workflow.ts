import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";

type HealthSnapshot = {
  generated_at: string;
  catalog: {
    active_total: number;
    discovered_24h: number;
    metadata_never_verified: number;
    metadata_stale_7d: number;
    thumbnail_never_verified: number;
    stats_never_refreshed: number;
    stats_stale_24h: number;
    stats_stale_7d: number;
    stats_overdue: number;
    broken_media: number;
    duplicate_canonical_keys: number;
    stale_discovery_runs: number;
    stale_job_runs: number;
    tiers: Record<string, number>;
    statuses: Record<string, number>;
  };
  queue: {
    total: number;
    due: number;
    pending: number;
    retry: number;
    processing: number;
    expired_leases: number;
    dead: number;
    oldest_due_at: string | null;
  };
  free_items: { direct: number; verified_24h: number; latest_verified_at: string | null };
  stats: {
    index_total: number;
    index_latest_at: string | null;
    hourly_total: number;
    hourly_24h: number;
    hourly_latest_at: string | null;
    daily_total: number;
    daily_latest_date: string | null;
    resale_total: number;
    resale_latest_date: string | null;
  };
  latest_discovery: Record<string, unknown> | null;
  recent_jobs: Array<Record<string, unknown>>;
};

type Check = { name: string; status: "pass" | "warn" | "fail"; value: unknown; expectation: string };

const STRICT = process.argv.includes("--strict");

function ageHours(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - new Date(value).getTime()) / 3_600_000);
}

function check(name: string, value: unknown, status: Check["status"], expectation: string): Check {
  return { name, status, value, expectation };
}

function evaluate(snapshot: HealthSnapshot): Check[] {
  const active = Math.max(1, Number(snapshot.catalog.active_total));
  const neverMetadataRatio = Number(snapshot.catalog.metadata_never_verified) / active;
  const overdueStatsRatio = Number(snapshot.catalog.stats_overdue) / active;
  const indexAge = ageHours(snapshot.stats.index_latest_at);
  const freeAge = ageHours(snapshot.free_items.latest_verified_at);
  const discoveryFinishedAt = (snapshot.latest_discovery?.finished_at as string | null) ?? null;
  const discoveryStatus = (snapshot.latest_discovery?.status as string | null) ?? null;
  const discoveryAge = ageHours(discoveryFinishedAt);

  return [
    check("catalog_growth", snapshot.catalog.discovered_24h, snapshot.catalog.discovered_24h > 0 ? "pass" : "warn", "> 0 items discovered in 24h"),
    check("metadata_coverage", neverMetadataRatio, neverMetadataRatio <= 0.02 ? "pass" : neverMetadataRatio <= 0.1 ? "warn" : "fail", "<= 2% never verified"),
    check("stats_refresh_sla", overdueStatsRatio, overdueStatsRatio <= 0.05 ? "pass" : overdueStatsRatio <= 0.2 ? "warn" : "fail", "<= 5% past tier-specific refresh due time"),
    check("queue_expired_leases", snapshot.queue.expired_leases, snapshot.queue.expired_leases === 0 ? "pass" : "fail", "0 expired leases"),
    check("queue_dead", snapshot.queue.dead, snapshot.queue.dead === 0 ? "pass" : "warn", "0 dead jobs"),
    check("canonical_duplicates", snapshot.catalog.duplicate_canonical_keys, snapshot.catalog.duplicate_canonical_keys === 0 ? "pass" : "warn", "0 legacy duplicate keys"),
    check("stale_discovery_runs", snapshot.catalog.stale_discovery_runs, snapshot.catalog.stale_discovery_runs === 0 ? "pass" : "fail", "0 discovery runs left running for over 2h"),
    check("stale_job_runs", snapshot.catalog.stale_job_runs, snapshot.catalog.stale_job_runs === 0 ? "pass" : "fail", "0 job runs left running for over 6h"),
    check("free_items_freshness_hours", freeAge, freeAge <= 30 ? "pass" : freeAge <= 48 ? "warn" : "fail", "<= 30h"),
    check("discovery_last_status", discoveryStatus, discoveryStatus === "completed" || discoveryStatus === "success" ? "pass" : discoveryStatus === "partial" ? "warn" : "fail", "latest discovery run completed"),
    check("discovery_freshness_hours", discoveryAge, discoveryAge <= 30 ? "pass" : discoveryAge <= 48 ? "warn" : "fail", "<= 30h"),
    check("stats_index_freshness_hours", indexAge, indexAge <= 2 ? "pass" : indexAge <= 26 ? "warn" : "fail", "<= 2h; application falls back to live catalog when stale"),
    check("hourly_stats_activity", snapshot.stats.hourly_24h, snapshot.stats.hourly_24h > 0 ? "pass" : "fail", "> 0 hourly samples in 24h")
  ];
}

async function main() {
  const run = await startStatsJobRun({ jobName: "stats_items_audit", metadata: { strict: STRICT } });
  try {
    const { data, error } = await supabaseAdmin().rpc("get_roblox_item_pipeline_health");
    if (error) throw new Error(`Failed to load item pipeline health: ${error.message}`);
    const snapshot = data as HealthSnapshot;
    const staleCutoff = new Date(Date.now() - 120 * 60_000).toISOString();
    const { count: staleDiscoveryRuns, error: staleDiscoveryError } = await supabaseAdmin()
      .from("roblox_catalog_discovery_runs")
      .select("run_id", { count: "exact", head: true })
      .eq("status", "running")
      .lt("started_at", staleCutoff);
    if (staleDiscoveryError) throw new Error(`Failed to audit stale discovery runs: ${staleDiscoveryError.message}`);
    snapshot.catalog.stale_discovery_runs = staleDiscoveryRuns ?? 0;
    const staleJobCutoff = new Date(Date.now() - 360 * 60_000).toISOString();
    const { count: staleJobRuns, error: staleJobError } = await supabaseAdmin()
      .from("stats_job_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "running")
      .lt("started_at", staleJobCutoff);
    if (staleJobError) throw new Error(`Failed to audit stale job runs: ${staleJobError.message}`);
    snapshot.catalog.stale_job_runs = staleJobRuns ?? 0;
    const checks = evaluate(snapshot);
    const failures = checks.filter((entry) => entry.status === "fail");
    const warnings = checks.filter((entry) => entry.status === "warn");
    const health = failures.length ? "unhealthy" : warnings.length ? "degraded" : "healthy";
    const report = { health, strict: STRICT, checks, snapshot };

    await finishStatsJobRun(run, {
      status: failures.length ? "partial" : "success",
      rowsSucceeded: checks.length - failures.length,
      rowsFailed: failures.length,
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
  console.error("Item pipeline audit failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
