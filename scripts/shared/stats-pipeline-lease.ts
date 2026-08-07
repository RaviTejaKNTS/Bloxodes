import { supabaseAdmin } from "@/lib/supabase-admin";

export const DEFAULT_STATS_PIPELINE_LEASE_MINUTES = 120;

export function statsPipelineLeaseName(parts: Array<string | number>) {
  return parts.map((part) => String(part).trim().toLowerCase()).filter(Boolean).join(":");
}

export async function claimStatsPipelineLease(input: {
  leaseName: string;
  workerId: string;
  leaseMinutes?: number;
}) {
  const { data, error } = await supabaseAdmin().rpc("claim_stats_pipeline_lease", {
    p_lease_name: input.leaseName,
    p_worker_id: input.workerId,
    p_lease_minutes: input.leaseMinutes ?? DEFAULT_STATS_PIPELINE_LEASE_MINUTES
  });
  if (error) throw new Error(`Failed to claim stats pipeline lease ${input.leaseName}: ${error.message}`);
  return data === true;
}

export async function releaseStatsPipelineLease(input: { leaseName: string; workerId: string }) {
  const { error } = await supabaseAdmin().rpc("release_stats_pipeline_lease", {
    p_lease_name: input.leaseName,
    p_worker_id: input.workerId
  });
  if (error) {
    console.warn(`Failed to release stats pipeline lease ${input.leaseName}: ${error.message}`);
  }
}
