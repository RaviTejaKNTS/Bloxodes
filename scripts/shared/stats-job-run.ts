import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase-admin";

type StatsJobStatus = "running" | "success" | "failed" | "partial" | "skipped";

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
  return error instanceof Error ? error.message : String(error);
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
    return { id: (data as { id?: string } | null)?.id ?? null, jobName: input.jobName, startedAt };
  } catch (error) {
    console.warn(`Unable to record stats job start for ${input.jobName}: ${errorMessage(error)}`);
    return { id: null, jobName: input.jobName, startedAt };
  }
}

export async function finishStatsJobRun(run: StatsJobRun, input: FinishStatsJobInput) {
  if (!run.id) return;
  const metadata = {
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

