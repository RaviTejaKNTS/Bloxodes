import "../shared/load-env";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { runDataApiOperation } from "../shared/data-api-retry";

async function main() {
  const snapshot = process.env.STATS_WORKER_ACTIVE_CONTAINER_IDS;
  if (snapshot === undefined) throw new Error("A host Docker snapshot is required; use the VPS job wrapper.");
  const active = snapshot.split(/\s+/).filter(Boolean);
  if (active.some(id => !/^[0-9a-f]{12,64}$/.test(id))) throw new Error("Invalid Docker snapshot.");
  const cutoff = new Date(Date.now() - 6 * 3600_000).toISOString();
  const db = supabaseAdmin();
  const result = await runDataApiOperation("Inspect stale worker ledger", () => db.from("stats_job_runs")
    .select("id,worker_id,job_name,started_at").eq("status", "running").lt("started_at", cutoff).limit(1000));
  const orphans = (result.data ?? []).filter(row => /^[0-9a-f]{12,64}$/.test(row.worker_id || "")
    && !active.some(id => id.startsWith(row.worker_id) || row.worker_id.startsWith(id)));
  console.log(`Stale Docker worker ledger: ${orphans.length} inactive execution records.`);
  if (!process.argv.includes("--apply")) return;
  for (const row of orphans) {
    await runDataApiOperation("Reconcile orphan worker ledger", () => db.from("stats_job_runs").update({
      status: "failed", finished_at: new Date().toISOString(),
      error: "Execution container absent from host snapshot after the six-hour ledger deadline."
    }).eq("id", row.id).eq("status", "running").eq("worker_id", row.worker_id).lt("started_at", cutoff));
  }
  console.log(`Reconciled ${orphans.length} orphan records; active and non-Docker workers retained.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
