// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.1/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type EventRow = {
  id: string;
  entity_type:
    | "code"
    | "article"
    | "author"
    | "event"
    | "checklist"
    | "tool"
    | "catalog"
    | "music"
    | "quiz"
    | "puzzle"
    | "wiki"
    | "wiki_collection"
    | "stats";
  slug: string;
};

type WorkerRunRow = {
  id?: string;
};

// Accept both legacy and dashboard-provided env names.
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const revalidateEndpoint = Deno.env.get("REVALIDATE_ENDPOINT");
const revalidateSecret = Deno.env.get("REVALIDATE_SECRET");
const batchSize = Number(Deno.env.get("REVALIDATE_BATCH_SIZE") ?? 100);
const statsBatchShare = Math.min(Math.max(Number(Deno.env.get("REVALIDATE_STATS_BATCH_SHARE") ?? 0.8), 0), 1);
const requestDelayMs = Number(Deno.env.get("REVALIDATE_REQUEST_DELAY_MS") ?? 0);

const supabase = createClient(supabaseUrl, serviceRoleKey);

function logInfo(message: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ level: "info", message, ...data }));
}

function logError(message: string, data?: Record<string, unknown>) {
  console.error(JSON.stringify({ level: "error", message, ...data }));
}

async function fetchEvents(limit = 50): Promise<EventRow[]> {
  const statsLimit = Math.max(1, Math.ceil(limit * statsBatchShare));
  const { data: statsData, error: statsError } = await supabase
    .from("revalidation_events")
    .select("id, entity_type, slug")
    .eq("entity_type", "stats")
    .order("created_at", { ascending: true })
    .limit(statsLimit);
  if (statsError) throw statsError;

  const statsEvents = (statsData ?? []) as EventRow[];
  const remaining = Math.max(0, limit - statsEvents.length);
  if (remaining <= 0) return statsEvents;

  const { data, error } = await supabase
    .from("revalidation_events")
    .select("id, entity_type, slug")
    .neq("entity_type", "stats")
    .order("created_at", { ascending: true })
    .limit(remaining);
  if (error) throw error;
  return [...statsEvents, ...((data ?? []) as EventRow[])];
}

async function deleteEvents(ids: string[]) {
  if (!ids.length) return;
  await supabase.from("revalidation_events").delete().in("id", ids);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function revalidateEvents(events: EventRow[]): Promise<boolean> {
  if (!revalidateEndpoint || !revalidateSecret) return false;
  if (!events.length) return true;

  const body =
    events.length === 1
      ? { type: events[0].entity_type, slug: events[0].slug }
      : {
          type: "batch",
          events: events.map((event) => ({ type: event.entity_type, slug: event.slug }))
        };

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(revalidateEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${revalidateSecret}`
      },
      body: JSON.stringify(body)
    });

    if (res.ok) return true;

    if (attempt < 3) {
      // Backoff between retries to avoid hammering Vercel.
      const backoffMs = 200 * attempt + Math.floor(Math.random() * 100);
      await sleep(backoffMs);
      continue;
    }

    const responseBody = await res.text().catch(() => "");
    logError("Revalidate request failed", {
      status: res.status,
      statusText: res.statusText,
      body: responseBody,
      events: events.map((event) => ({ type: event.entity_type, slug: event.slug })),
      attempt
    });
  }

  return false;
}

async function startWorkerRun(batchSizeValue: number): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("revalidation_worker_runs")
      .insert({
        status: "running",
        batch_size: batchSizeValue
      })
      .select("id")
      .single();
    if (error) throw error;
    return ((data ?? {}) as WorkerRunRow).id ?? null;
  } catch (error) {
    logError("Failed to record revalidation worker start", { error: String(error) });
    return null;
  }
}

async function finishWorkerRun(
  id: string | null,
  input: {
    status: "success" | "failed" | "skipped";
    fetchedCount: number;
    processedCount: number;
    failedCount: number;
    durationMs: number;
    error?: string;
    events: EventRow[];
    responseBody?: string;
  }
) {
  if (!id) return;
  try {
    const { error } = await supabase
      .from("revalidation_worker_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: input.status,
        fetched_count: input.fetchedCount,
        processed_count: input.processedCount,
        failed_count: input.failedCount,
        duration_ms: input.durationMs,
        error: input.error ?? null,
        events: input.events.map((event) => ({ type: event.entity_type, slug: event.slug })),
        response_body: input.responseBody ?? null
      })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    logError("Failed to record revalidation worker finish", { error: String(error) });
  }
}

serve(async (req) => {
  if (!revalidateEndpoint || !revalidateSecret) {
    logError("Missing REVALIDATE env vars");
    return new Response(
      JSON.stringify({ error: "Missing REVALIDATE_ENDPOINT or REVALIDATE_SECRET env vars" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const startedAt = Date.now();
  const effectiveBatchSize = Math.max(1, batchSize);
  const runId = await startWorkerRun(effectiveBatchSize);

  try {
    const events = await fetchEvents(100);
    logInfo("Fetched events", { count: events.length });
    const eventsToProcess = events.slice(0, effectiveBatchSize);
    const ok = await revalidateEvents(eventsToProcess);

    if (requestDelayMs > 0) {
      await sleep(requestDelayMs);
    }

    if (ok) {
      await deleteEvents(eventsToProcess.map((event) => event.id));
    }

    await finishWorkerRun(runId, {
      status: ok ? "success" : "failed",
      fetchedCount: events.length,
      processedCount: ok ? eventsToProcess.length : 0,
      failedCount: ok ? 0 : eventsToProcess.length,
      durationMs: Date.now() - startedAt,
      events: eventsToProcess
    });

    logInfo("Batch result", {
      processed: ok ? eventsToProcess.length : 0,
      failed: ok ? 0 : eventsToProcess.length,
      failedEvents: ok ? [] : eventsToProcess.map((f) => ({ type: f.entity_type, slug: f.slug }))
    });

    return new Response(
      JSON.stringify({
        processed: ok ? eventsToProcess.length : 0,
        failed: ok ? 0 : eventsToProcess.length,
        failures: ok ? [] : eventsToProcess
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    logError("Unhandled error", { error: String(error) });
    await finishWorkerRun(runId, {
      status: "failed",
      fetchedCount: 0,
      processedCount: 0,
      failedCount: 0,
      durationMs: Date.now() - startedAt,
      error: String(error),
      events: []
    });
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
