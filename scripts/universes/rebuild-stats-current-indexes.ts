import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { formatDataApiError, runDataApiOperation } from "../shared/data-api-retry";
import { enqueueRevalidationEvents } from "../shared/revalidation-events";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";

async function main() {
  const run = await startStatsJobRun({
    jobName: "stats_current_index_rebuild",
    metadata: { source: "rebuild-stats-current-indexes" }
  });

  try {
    const sb = supabaseAdmin();
    const { data } = await runDataApiOperation("Refresh serialized stats current indexes", () =>
      sb.rpc("refresh_stats_current_indexes_serialized")
    );

    const result = (data ?? {}) as {
      games?: number;
      genres?: number;
      risers?: number;
      creators?: number;
      indexed_at?: string;
      skipped?: boolean;
      reason?: string;
    };
    if (result.skipped) {
      await finishStatsJobRun(run, { status: "skipped", metadata: result });
      console.log(`Stats index rebuild skipped: ${result.reason ?? "lock_busy"}`);
      return;
    }
    const queued = await enqueueRevalidationEvents(
      [
        { type: "stats", slug: "stats" },
        { type: "stats", slug: "games" },
        { type: "stats", slug: "creators" }
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
      `Rebuilt stats indexes: games=${result.games ?? 0}, genres=${result.genres ?? 0}, risers=${result.risers ?? 0}, creators=${result.creators ?? 0}; queued=${queued.queued}`
    );
  } catch (error) {
    await finishStatsJobRun(run, { status: "failed", error });
    throw error;
  }
}

main().catch((error) => {
  console.error(formatDataApiError(error));
  process.exit(1);
});
