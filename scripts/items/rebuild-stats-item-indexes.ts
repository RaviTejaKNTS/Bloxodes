import "../shared/load-env";

import { enqueueRevalidationEvents } from "../shared/revalidation-events";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";
import { refreshStatsItemCurrentIndexes } from "./item-index-refresh";

async function main() {
  const run = await startStatsJobRun({
    jobName: "stats_items_current_index_rebuild",
    metadata: { source: "rebuild-stats-item-indexes" }
  });

  try {
    const { result, method } = await refreshStatsItemCurrentIndexes();
    const queued = await enqueueRevalidationEvents(
      [
        { type: "stats", slug: "stats" },
        { type: "stats", slug: "items" }
      ],
      "stats_items_current_index_rebuild"
    );

    await finishStatsJobRun(run, {
      status: "success",
      rowsSucceeded: result.items ?? 0,
      metadata: { ...result, method, revalidation_events: queued.events }
    });

    console.log(`Rebuilt stats item indexes: items=${result.items ?? 0}, movers=${result.price_movers ?? 0}; method=${method}; queued=${queued.queued}`);
  } catch (error) {
    await finishStatsJobRun(run, { status: "failed", error });
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
