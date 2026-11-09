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
  const failedPages: { code: string; error: string }[] = [];
  try {
    const { data: pages, error: listError } = await db.rpc("list_catalog_membership_pages")
      .abortSignal(AbortSignal.timeout(10_000));
    if (listError) throw new Error(`Cannot list catalog pages: ${listError.message}`);
    for (const code of pages as string[]) {
      try {
        const { data, error } = await db.rpc("refresh_catalog_membership_date", { p_code: code })
          .abortSignal(AbortSignal.timeout(15_000));
        if (error) throw new Error(error.message);
        changed += Number(data);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failedPages.push({ code, error: message });
        console.error(`Catalog membership page ${code} failed: ${message}`);
      }
    }
    if (failedPages.length) throw new Error(`${failedPages.length} catalog pages failed`);
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
  }
  const { error: finishError } = await db.from("stats_job_runs").update({
    status: failure ? "failed" : "success", finished_at: new Date().toISOString(),
    rows_succeeded: changed, error: failure?.message ?? null,
    metadata: { changed_pages: changed, failed_pages: failedPages }
  }).eq("id", run.id).abortSignal(AbortSignal.timeout(10_000));
  if (finishError) throw new Error("Cannot record catalog membership job result");
  if (failure) throw failure;
  console.log(`Catalog membership reconciliation completed; ${changed} page dates changed.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
