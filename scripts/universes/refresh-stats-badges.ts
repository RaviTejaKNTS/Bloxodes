import "../shared/load-env";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { startStatsJobRun, finishStatsJobRun } from "../shared/stats-job-run";
import { claimStatsPipelineLease, releaseStatsPipelineLease } from "../shared/stats-pipeline-lease";
import { enqueueRevalidationEvents } from "../shared/revalidation-events";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";
import { listPublishedWikiUniverseIds } from "./refresh-wiki-game-passes";
import { ATTACHMENT_HOT_CAP, ATTACHMENT_REQUEST_CAP, listHotAttachmentUniverseIds } from "./attachment-refresh-scope";
import { createGamePassHttp, PASS_REFRESH_RUN_BUDGET_MS } from "./game-pass-http";
import { refreshBadges } from "./badges";

// Shared env loader supplies SUPABASE_URL/SUPABASE_SERVICE_ROLE. Writes only
// badge metadata/statistics, the stats ledger, and existing revalidation events.
export async function runStatsBadgeRefresh(deps = {
  database: supabaseAdmin, claimLease: claimStatsPipelineLease, releaseLease: releaseStatsPipelineLease,
  startRun: startStatsJobRun, finishRun: finishStatsJobRun, http: createGamePassHttp
}) {
  const workerId = process.env.HOSTNAME ?? randomUUID();
  const leaseName = "stats-badges";
  if (!await deps.claimLease({ leaseName, workerId, leaseMinutes: 15 })) return;
  let run: Awaited<ReturnType<typeof startStatsJobRun>> | undefined;
  try {
    run = await deps.startRun({ jobName: "stats_badges_refresh", workerId });
    const db = deps.database();
    const http = deps.http({ maxRequests: ATTACHMENT_REQUEST_CAP, userAgent: "BloxodesStatsBadgeRefresh/1.0" });
    const wikiIds = await listPublishedWikiUniverseIds(db);
    const hotIds = await listHotAttachmentUniverseIds(db);
    const ids = [...new Set([...wikiIds, ...hotIds])];
    const result = await refreshBadges(db, ids, http);
    await deps.finishRun(run, {
      status: result.failed.length || result.deferred.length ? "partial" : "success",
      rowsClaimed: ids.length, rowsSucceeded: result.refreshed.length, rowsFailed: result.failed.length + result.deferred.length,
      metadata: { scope: "published_wikis_and_hot", hot_cap: ATTACHMENT_HOT_CAP, wiki_universes: wikiIds.length,
        hot_universes: hotIds.length, request_cap: ATTACHMENT_REQUEST_CAP, requests: http.requestCount,
        run_budget_ms: PASS_REFRESH_RUN_BUDGET_MS, stopped_reason: http.stoppedReason,
        badges: result.badgesCount, refreshed_universe_ids: result.refreshed, failed_universe_ids: result.failed, deferred_universe_ids: result.deferred }
    });
    console.log(JSON.stringify(result));
    return result;
  } catch (error) {
    if (run) await deps.finishRun(run, { status: "failed", error });
    throw error;
  } finally { await deps.releaseLease({ leaseName, workerId }); }
}
async function main() {
  if (!process.argv.includes("--allow-live") && !isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL)) throw new Error("Badge refresh requires managed development or explicit --allow-live for the scheduled worker.");
  const result = await runStatsBadgeRefresh();
  if (result?.refreshed.length) await enqueueRevalidationEvents([{ type: "stats", slug: "games" }], "stats_badges_refresh");
  if (result && (result.failed.length || result.deferred.length)) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
