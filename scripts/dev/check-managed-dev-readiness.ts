import "../shared/load-env";

import { createClient } from "@supabase/supabase-js";
import { assertManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
assertManagedDevelopmentSupabaseUrl(url, "managed-development readiness check");
if (!serviceRole) throw new Error("SUPABASE_SERVICE_ROLE is required for managed-development readiness.");
const managedUrl = url;

const supabase = createClient(managedUrl, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const checks: Array<{ name: string; ok: boolean; error: string | null }> = [];

  async function table(name: string, columns: string) {
    const { error } = await supabase.from(name).select(columns, { head: true, count: "exact" }).limit(1);
    checks.push({ name: `table:${name}`, ok: !error, error: error?.message ?? null });
  }

  await table("articles", "id,slug");
  await table("article_generation_queue", "id,status,published_at,rejected_at,production_url");
  await table(
    "article_discovery_candidates",
    "id,source_evidence,source_content_hash,last_seen_at,curation_prompt_version,queue_ids,recuration_count"
  );
  await table("article_curation_runs", "id,degraded,degraded_reason");
  await table("roblox_universes", "universe_id,next_stats_refresh_at,stats_tier_reason");

  const { error: healthError } = await supabase.rpc("get_roblox_universe_pipeline_health_v4");
  checks.push({ name: "rpc:get_roblox_universe_pipeline_health_v4", ok: !healthError, error: healthError?.message ?? null });
  const { error: chartError } = await supabase.rpc("get_stats_visit_share_chart", {
    p_since: new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10),
    p_until: new Date().toISOString().slice(0, 10),
    p_top_games: 1,
    p_top_group: 1,
    p_wide_group: 1
  });
  checks.push({ name: "rpc:get_stats_visit_share_chart", ok: !chartError, error: chartError?.message ?? null });

  const failed = checks.filter((check) => !check.ok);
  if (failed.length) {
    console.error(`Managed-development readiness failed for ${failed.length} check(s):`);
    for (const check of failed) console.error(`- ${check.name}: ${check.error}`);
    process.exit(1);
  }

  console.log(`Managed development ready: ${new URL(managedUrl).hostname}, ${checks.length} schema/API checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
