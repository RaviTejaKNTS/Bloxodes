// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.1/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type WarmEventRow = {
  id: string;
  path: string;
  attempts: number;
};

type WorkerRunRow = {
  id?: string;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const siteUrl = (Deno.env.get("CACHE_WARM_SITE_URL") || "https://bloxodes.com").replace(/\/+$/, "");
const batchSize = readPositiveInt("CACHE_WARM_BATCH_SIZE", 80, 500);
const concurrency = readPositiveInt("CACHE_WARM_CONCURRENCY", 4, 20);
const requestTimeoutMs = readPositiveInt("CACHE_WARM_REQUEST_TIMEOUT_MS", 15000, 60000);
const maxAttempts = readPositiveInt("CACHE_WARM_MAX_ATTEMPTS", 3, 10);

const supabase = createClient(supabaseUrl, serviceRoleKey);

function readPositiveInt(name: string, fallback: number, max: number) {
  const raw = Deno.env.get(name)?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(Math.floor(value), max);
}

function logInfo(message: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ level: "info", message, ...data }));
}

function logError(message: string, data?: Record<string, unknown>) {
  console.error(JSON.stringify({ level: "error", message, ...data }));
}

function isAuthorized(req: Request) {
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return token === serviceRoleKey;
}

function normalizePath(path: string) {
  const trimmed = path.trim();
  if (!trimmed || !trimmed.startsWith("/") || /[?#]/.test(trimmed) || /\[[^/\]]+\]/.test(trimmed)) {
    return null;
  }
  return trimmed === "/" ? "/" : trimmed.replace(/\/+$/, "");
}

async function runLimited<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker));
  return results;
}

async function startWorkerRun(batchSizeValue: number): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("cache_warm_worker_runs")
      .insert({
        status: "running",
        batch_size: batchSizeValue
      })
      .select("id")
      .single();
    if (error) throw error;
    return ((data ?? {}) as WorkerRunRow).id ?? null;
  } catch (error) {
    logError("Failed to record cache warm worker start", { error: String(error) });
    return null;
  }
}

async function finishWorkerRun(
  id: string | null,
  input: {
    status: "success" | "failed" | "skipped";
    fetchedCount: number;
    warmedCount: number;
    failedCount: number;
    droppedCount: number;
    durationMs: number;
    paths: string[];
    error?: string;
  }
) {
  if (!id) return;
  try {
    const { error } = await supabase
      .from("cache_warm_worker_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: input.status,
        fetched_count: input.fetchedCount,
        warmed_count: input.warmedCount,
        failed_count: input.failedCount,
        dropped_count: input.droppedCount,
        duration_ms: input.durationMs,
        paths: input.paths,
        error: input.error ?? null
      })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    logError("Failed to record cache warm worker finish", { error: String(error) });
  }
}

async function fetchWarmEvents(): Promise<WarmEventRow[]> {
  const { data, error } = await supabase
    .from("cache_warm_events")
    .select("id, path, attempts")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(batchSize);
  if (error) throw error;
  return (data ?? []) as WarmEventRow[];
}

async function warmPath(path: string) {
  const normalizedPath = normalizePath(path);
  if (!normalizedPath) {
    return { ok: false, path, error: "invalid-path" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${siteUrl}${normalizedPath}`, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "BloxodesDeferredCacheWarm/1.0"
      }
    });
    await response.arrayBuffer();
    if (response.ok) {
      return { ok: true, path: normalizedPath, retryable: false };
    }
    return { ok: false, path: normalizedPath, error: `http-${response.status}`, retryable: response.status !== 404 };
  } catch (error) {
    return {
      ok: false,
      path: normalizedPath,
      error: error instanceof Error ? error.message : String(error),
      retryable: true
    };
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const startedAt = Date.now();
  const runId = await startWorkerRun(batchSize);

  try {
    const events = await fetchWarmEvents();
    if (!events.length) {
      await finishWorkerRun(runId, {
        status: "skipped",
        fetchedCount: 0,
        warmedCount: 0,
        failedCount: 0,
        droppedCount: 0,
        durationMs: Date.now() - startedAt,
        paths: []
      });
      return new Response(JSON.stringify({ warmed: 0, failed: 0, dropped: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const results = await runLimited(events, concurrency, async (event) => ({
      event,
      result: await warmPath(event.path)
    }));

    const successfulIds = results.filter((entry) => entry.result.ok).map((entry) => entry.event.id);
    const failed = results.filter((entry) => !entry.result.ok);
    const retryFailures = failed.filter((entry) => entry.result.retryable && entry.event.attempts + 1 < maxAttempts);
    const droppedFailures = failed.filter((entry) => !entry.result.retryable || entry.event.attempts + 1 >= maxAttempts);

    if (successfulIds.length) {
      await supabase.from("cache_warm_events").delete().in("id", successfulIds);
    }

    await Promise.all(
      retryFailures.map((entry) =>
        supabase
          .from("cache_warm_events")
          .update({
            attempts: entry.event.attempts + 1,
            last_error: entry.result.error,
            updated_at: new Date().toISOString()
          })
          .eq("id", entry.event.id)
      )
    );

    if (droppedFailures.length) {
      await supabase.from("cache_warm_events").delete().in("id", droppedFailures.map((entry) => entry.event.id));
    }

    const warmedCount = successfulIds.length;
    const failedCount = retryFailures.length;
    const droppedCount = droppedFailures.length;
    await finishWorkerRun(runId, {
      status: failedCount > 0 ? "failed" : "success",
      fetchedCount: events.length,
      warmedCount,
      failedCount,
      droppedCount,
      durationMs: Date.now() - startedAt,
      paths: events.map((event) => event.path),
      error: failedCount ? `${failedCount} warm requests failed and will retry` : undefined
    });

    logInfo("Cache warm batch result", {
      fetched: events.length,
      warmed: warmedCount,
      failed: failedCount,
      dropped: droppedCount
    });

    return new Response(
      JSON.stringify({
        warmed: warmedCount,
        failed: failedCount,
        dropped: droppedCount
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    logError("Unhandled cache warm error", { error: String(error) });
    await finishWorkerRun(runId, {
      status: "failed",
      fetchedCount: 0,
      warmedCount: 0,
      failedCount: 0,
      droppedCount: 0,
      durationMs: Date.now() - startedAt,
      paths: [],
      error: String(error)
    });
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
