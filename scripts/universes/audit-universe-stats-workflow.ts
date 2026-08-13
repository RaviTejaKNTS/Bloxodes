import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";
import {
  evaluateStatsPipelineHealth,
  type StatsPipelineHealthSnapshot
} from "@/lib/stats-pipeline-health";

const STRICT = process.argv.includes("--strict");

async function main() {
  const run = await startStatsJobRun({ jobName: "stats_universe_audit", metadata: { strict: STRICT } });

  try {
    const { data, error } = await supabaseAdmin().rpc("get_roblox_universe_pipeline_health_v4");
    if (error) throw new Error(`Failed to load universe pipeline health: ${error.message}`);
    const snapshot = data as StatsPipelineHealthSnapshot;
    const evaluated = evaluateStatsPipelineHealth(snapshot);
    const { checks, failures, warnings } = evaluated;
    const report = { health: evaluated.status, strict: STRICT, checks, snapshot };

    await finishStatsJobRun(run, {
      status: failures.length ? "partial" : "success",
      rowsClaimed: Number(snapshot.counts.trackable_player_total),
      rowsSucceeded: Number(snapshot.counts.fresh_trackable_player_values_24h),
      rowsFailed: Math.max(0, Number(snapshot.counts.trackable_player_total) - Number(snapshot.counts.fresh_trackable_player_values_24h)),
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
