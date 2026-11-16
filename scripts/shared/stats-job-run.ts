import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase-admin";

type StatsJobStatus = "running" | "success" | "failed" | "partial" | "skipped";

// Roblox removes a few rows per run, and those are handled outcomes, not failed work.
// Many missing at once looks like a bad Roblox response, so it must not read as success.
// Rows Roblox already left out on earlier runs (knownMissingRows) are expected to stay
// missing, such as quarantined games on their weekly retry, so they never count as suspect.
const SUSPECT_MISSING_MIN_ROWS = 30;
const SUSPECT_MISSING_SHARE = 0.1;
// A row with this many failed or missing earlier attempts since its last success is known missing.
export const KNOWN_MISSING_PRIOR_MISSES = 2;

export function statsRefreshRunStatus(
  succeededRows: number,
  failedRows: number,
  missingRows: number,
  knownMissingRows = 0
): "success" | "partial" | "failed" {
  const unexpectedMissing = Math.max(0, missingRows - knownMissingRows);
  const suspectMissing =
    unexpectedMissing >= SUSPECT_MISSING_MIN_ROWS &&
    unexpectedMissing / (succeededRows + failedRows + unexpectedMissing) > SUSPECT_MISSING_SHARE;
  if (failedRows === 0 && !suspectMissing) return "success";
  return succeededRows > 0 ? "partial" : "failed";
}

type StartStatsJobInput = {
  jobName: string;
  workerId?: string;
  metadata?: Record<string, unknown>;
};

type FinishStatsJobInput = {
  status: Exclude<StatsJobStatus, "running">;
  rowsClaimed?: number;
  rowsSucceeded?: number;
  rowsFailed?: number;
  error?: unknown;
  metadata?: Record<string, unknown>;
};

export type StatsJobRun = {
  id: string | null;
  jobName: string;
  startedAt: string;
  metadata: Record<string, unknown>;
};

function defaultWorkerId() {
  return (
    process.env.STATS_WORKER_ID ||
    process.env.NORTHFLANK_JOB_NAME ||
    process.env.HOSTNAME ||
    `local-${randomUUID().slice(0, 8)}`
  );
}

function errorMessage(error: unknown) {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      // Fall through to the generic string representation.
    }
  }
  return String(error);
}

export async function startStatsJobRun(input: StartStatsJobInput): Promise<StatsJobRun> {
  const startedAt = new Date().toISOString();
  const row = {
    job_name: input.jobName,
    worker_id: input.workerId ?? defaultWorkerId(),
    started_at: startedAt,
    status: "running",
    metadata: input.metadata ?? {}
  };

  try {
    const { data, error } = await supabaseAdmin()
      .from("stats_job_runs")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    return {
      id: (data as { id?: string } | null)?.id ?? null,
      jobName: input.jobName,
      startedAt,
      metadata: input.metadata ?? {}
    };
  } catch (error) {
    console.warn(`Unable to record stats job start for ${input.jobName}: ${errorMessage(error)}`);
    return { id: null, jobName: input.jobName, startedAt, metadata: input.metadata ?? {} };
  }
}

export async function finishStatsJobRun(run: StatsJobRun, input: FinishStatsJobInput) {
  if (!run.id) return;
  const metadata = {
    ...run.metadata,
    ...(input.metadata ?? {}),
    started_at: run.startedAt
  };
  const row = {
    finished_at: new Date().toISOString(),
    status: input.status,
    rows_claimed: input.rowsClaimed ?? 0,
    rows_succeeded: input.rowsSucceeded ?? 0,
    rows_failed: input.rowsFailed ?? 0,
    error: errorMessage(input.error),
    metadata
  };

  try {
    const { error } = await supabaseAdmin()
      .from("stats_job_runs")
      .update(row)
      .eq("id", run.id);
    if (error) throw error;
  } catch (error) {
    console.warn(`Unable to record stats job finish for ${run.jobName}: ${errorMessage(error)}`);
  }
}
