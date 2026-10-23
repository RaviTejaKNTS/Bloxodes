import "../shared/load-env";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { startStatsJobRun, finishStatsJobRun } from "../shared/stats-job-run";
import { claimStatsPipelineLease, releaseStatsPipelineLease } from "../shared/stats-pipeline-lease";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";
import { createGamePassHttp, PASS_REFRESH_RUN_BUDGET_MS } from "./game-pass-http";
import { refreshGamePasses } from "./game-passes";

// Service-role database access only; side effects are game-pass upserts/pruning
// and the existing stats ledger/wiki revalidation triggers. No deep enrichment.
export async function listPublishedWikiUniverseIds(db: ReturnType<typeof supabaseAdmin>) {
  const ids = new Set<number>();
  let afterSlug = "";
  while (true) {
    const { data, error } = await db.from("wiki_pages").select("slug,universe_id")
      .eq("is_published", true).not("universe_id", "is", null)
      .gt("slug", afterSlug).order("slug").limit(200);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const id = Number(row.universe_id);
      if (Number.isSafeInteger(id) && id > 0) ids.add(id);
    }
    afterSlug = data[data.length - 1].slug;
  }
  return [...ids];
}

export async function runWikiGamePassRefresh(deps = {
  database: supabaseAdmin,
  claimLease: claimStatsPipelineLease,
  releaseLease: releaseStatsPipelineLease,
  startRun: startStatsJobRun,
  finishRun: finishStatsJobRun,
  http: createGamePassHttp
}) {
  const workerId = process.env.HOSTNAME ?? randomUUID();
  const leaseName = "wiki-game-passes";
  // Fifteen minutes covers the wrapper's ten-minute timeout and cleanup.
  if (!await deps.claimLease({ leaseName, workerId, leaseMinutes: 15 })) return;
  let run: Awaited<ReturnType<typeof startStatsJobRun>> | undefined;
  try {
    const http = deps.http();
    run = await deps.startRun({ jobName: "wiki_game_passes_refresh", workerId });
    const db = deps.database();
    const ids = await listPublishedWikiUniverseIds(db);
    const result = await refreshGamePasses(db, ids, http.fetchJson, { shouldStop: http.shouldStop });
    await deps.finishRun(run, {
      status: result.failed.length || result.deferred.length ? "partial" : "success",
      rowsClaimed: ids.length, rowsSucceeded: result.refreshed.length, rowsFailed: result.failed.length + result.deferred.length,
      metadata: {
        passes: result.passesCount, refreshed_universe_ids: result.refreshed, failed_universe_ids: result.failed,
        deferred_universe_ids: result.deferred, stopped_reason: http.stoppedReason, run_budget_ms: PASS_REFRESH_RUN_BUDGET_MS
      }
    });
    console.log(JSON.stringify(result));
    return result;
  } catch (error) {
    if (run) await deps.finishRun(run, { status: "failed", error });
    throw error;
  } finally {
    await deps.releaseLease({ leaseName, workerId });
  }
}

async function main() {
  if (!process.argv.includes("--allow-live") && !isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL)) {
    throw new Error("Wiki pass refresh requires managed development or explicit --allow-live for the scheduled worker.");
  }
  const result = await runWikiGamePassRefresh();
  if (result && (result.failed.length || result.deferred.length)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
