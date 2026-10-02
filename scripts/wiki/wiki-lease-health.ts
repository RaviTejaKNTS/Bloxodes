import type { SupabaseClient } from "@supabase/supabase-js";

// Only expired leases are eligible. Owner-held blocked rows are never selected.
export async function reconcileExpiredWikiLeases(dev: SupabaseClient, now = new Date()) {
  const cutoff = now.toISOString();
  const query = await dev.from("wiki_generation_queue")
    .select("id,lease_token,attempts,max_attempts").eq("status", "processing")
    .lt("lease_expires_at", cutoff).limit(100);
  if (query.error) throw new Error(`Wiki lease reconciliation failed: ${query.error.message}`);
  let recovered = 0;
  for (const row of query.data ?? []) {
    const terminal = row.attempts >= row.max_attempts;
    const result = await dev.from("wiki_generation_queue").update({
      status: terminal ? "failed" : "retry", lease_token: null, lease_owner: null,
      lease_expires_at: null, processing_slot: null,
      next_attempt_at: terminal ? null : cutoff,
      ...(terminal ? { completed_at: cutoff } : {}),
      last_error: "Recovered after an expired homelab wiki workflow lease."
    }).eq("id", row.id).eq("status", "processing").eq("lease_token", row.lease_token)
      .lt("lease_expires_at", cutoff).select("id");
    if (result.error) throw new Error(`Wiki lease reconciliation failed: ${result.error.message}`);
    recovered += result.data?.length ?? 0;
  }
  return recovered;
}

export class WikiLeaseLostError extends Error {}

export function guardWikiHeartbeat(heartbeat: () => Promise<void>, intervalMs = 60_000) {
  const controller = new AbortController();
  let failures = 0;
  let pending = false;
  const tick = async () => {
    if (pending || controller.signal.aborted) return;
    pending = true;
    try { await heartbeat(); failures = 0; }
    catch (error) {
      failures += 1;
      console.error(`Wiki heartbeat failed, attempt ${failures}/3.`);
      if (error instanceof WikiLeaseLostError || failures >= 3) controller.abort(error);
    } finally { pending = false; }
  };
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  return { signal: controller.signal, stop: () => clearInterval(timer), tick };
}
