// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.1/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type EventRow = {
  id: string;
  entity_type:
    | "code"
    | "article"
    | "list"
    | "author"
    | "event"
    | "checklist"
    | "tool"
    | "catalog"
    | "music"
    | "quiz"
    | "puzzle"
    | "wiki"
    | "wiki_catalog"
    | "stats";
  slug: string;
};

// Accept both legacy and dashboard-provided env names.
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const revalidateEndpoint = Deno.env.get("REVALIDATE_ENDPOINT");
const revalidateSecret = Deno.env.get("REVALIDATE_SECRET");
const batchSize = Number(Deno.env.get("REVALIDATE_BATCH_SIZE") ?? 100);
const requestDelayMs = Number(Deno.env.get("REVALIDATE_REQUEST_DELAY_MS") ?? 0);

const supabase = createClient(supabaseUrl, serviceRoleKey);

function logInfo(message: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ level: "info", message, ...data }));
}

function logError(message: string, data?: Record<string, unknown>) {
  console.error(JSON.stringify({ level: "error", message, ...data }));
}

async function fetchEvents(limit = 50): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from("revalidation_events")
    .select("id, entity_type, slug")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as EventRow[];
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

serve(async (req) => {
  if (!revalidateEndpoint || !revalidateSecret) {
    logError("Missing REVALIDATE env vars");
    return new Response(
      JSON.stringify({ error: "Missing REVALIDATE_ENDPOINT or REVALIDATE_SECRET env vars" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const events = await fetchEvents(100);
    logInfo("Fetched events", { count: events.length });
    const eventsToProcess = events.slice(0, Math.max(1, batchSize));
    const ok = await revalidateEvents(eventsToProcess);

    if (requestDelayMs > 0) {
      await sleep(requestDelayMs);
    }

    if (ok) {
      await deleteEvents(eventsToProcess.map((event) => event.id));
    }

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
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
