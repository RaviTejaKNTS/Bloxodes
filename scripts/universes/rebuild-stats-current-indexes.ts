import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { enqueueRevalidationEvents } from "../shared/revalidation-events";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";

async function main() {
  const run = await startStatsJobRun({
    jobName: "stats_current_index_rebuild",
    metadata: { source: "rebuild-stats-current-indexes" }
  });

  try {
    const { data, error } = await supabaseAdmin().rpc("refresh_stats_current_indexes");
    if (error) throw error;

    const result = (data ?? {}) as { games?: number; genres?: number; risers?: number; indexed_at?: string };
    const queued = await enqueueRevalidationEvents(
      [
        { type: "stats", slug: "stats" },
        { type: "stats", slug: "games" }
      ],
      "stats_current_index_rebuild"
    );

    await finishStatsJobRun(run, {
      status: "success",
      rowsSucceeded: result.games ?? 0,
      metadata: {
        ...result,
        revalidation_events: queued.events
      }
    });

    console.log(
      `Rebuilt stats indexes: games=${result.games ?? 0}, genres=${result.genres ?? 0}, risers=${result.risers ?? 0}; queued=${queued.queued}`
    );
  } catch (error) {
    await finishStatsJobRun(run, { status: "failed", error });
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
