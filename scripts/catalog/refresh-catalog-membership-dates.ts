import "../shared/load-env";
import { supabaseAdmin } from "../../apps/web/src/lib/supabase-admin";

// run-job.sh bounds the container; each HTTP request also has its own deadline.
async function main() {
  const db = supabaseAdmin();
  const { data: run, error: startError } = await db.from("stats_job_runs").insert({
    job_name: "catalog-membership-dates", worker_id: process.env.HOSTNAME ?? "stats-worker",
    status: "running", started_at: new Date().toISOString()
  }).select("id").single().abortSignal(AbortSignal.timeout(10_000));
  if (startError || !run) throw new Error("Cannot record catalog membership job start");
  let failure: Error | null = null;
  let changed = 0;
  try {
    const { data, error } = await db.rpc("refresh_catalog_membership_dates")
      .abortSignal(AbortSignal.timeout(70_000));
    if (error) throw new Error(`Catalog membership reconciliation failed: ${error.message}`);
    changed = Number(data);
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
  }
  const { error: finishError } = await db.from("stats_job_runs").update({
    status: failure ? "failed" : "success", finished_at: new Date().toISOString(),
    rows_succeeded: changed, error: failure?.message ?? null,
    metadata: { changed_pages: changed }
  }).eq("id", run.id).abortSignal(AbortSignal.timeout(10_000));
  if (finishError) throw new Error("Cannot record catalog membership job result");
  if (failure) throw failure;
  console.log(`Catalog membership reconciliation completed; ${changed} page dates changed.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
