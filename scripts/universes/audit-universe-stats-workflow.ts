import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";
import { STATS_TIERS, type StatsTier } from "./stats-tier";

type CountQuery = any;

async function countRows(label: string, apply?: (query: CountQuery) => CountQuery) {
  let query: CountQuery = supabaseAdmin().from("roblox_universes").select("universe_id", { count: "exact", head: true });
  if (apply) {
    query = apply(query) as typeof query;
  }
  const { count, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return count ?? 0;
}

async function tierCounts() {
  const result: Record<StatsTier, number> = {
    NEW: 0,
    HOT: 0,
    WARM: 0,
    COLD: 0
  };
  for (const tier of STATS_TIERS) {
    result[tier] = await countRows(`tier ${tier}`, (query) => query.eq("stats_tier", tier));
  }
  return result;
}

async function latestHourly() {
  const { data, error } = await supabaseAdmin()
    .from("roblox_universe_stats_hourly")
    .select("hour_start")
    .order("hour_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.hour_start ?? null;
}

async function latestValue(table: string, column: string) {
  const { data, error } = await supabaseAdmin()
    .from(table)
    .select(column)
    .order(column, { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Record<string, unknown> | null)?.[column] ?? null;
}

async function tableCount(table: string) {
  const { count, error } = await supabaseAdmin().from(table).select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  const run = await startStatsJobRun({ jobName: "stats_universe_audit" });
  const now = new Date();
  const stale24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const stale7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const counts = {
      total: await countRows("total"),
      withRootPlace: await countRows("with root place", (query) => query.not("root_place_id", "is", null)),
      withSlug: await countRows("with slug", (query) => query.not("slug", "is", null)),
      withIcon: await countRows("with icon", (query) => query.not("icon_url", "is", null)),
      neverStatsRefreshed: await countRows("never stats refreshed", (query) => query.is("last_stats_refreshed_at", null)),
      staleOver24h: await countRows("stale over 24h", (query) =>
        query.or(`last_stats_refreshed_at.is.null,last_stats_refreshed_at.lt.${stale24h}`)
      ),
      staleOver7d: await countRows("stale over 7d", (query) =>
        query.or(`last_stats_refreshed_at.is.null,last_stats_refreshed_at.lt.${stale7d}`)
      ),
      missingIconHot: await countRows("missing HOT icons", (query) => query.eq("stats_tier", "HOT").is("icon_url", null)),
      missingIconWarm: await countRows("missing WARM icons", (query) => query.eq("stats_tier", "WARM").is("icon_url", null)),
      currentIndexRows: await tableCount("stats_game_current_index"),
      hourlyRows: await tableCount("roblox_universe_stats_hourly"),
      dailyRows: await tableCount("roblox_universe_stats_daily"),
      rankHourlyRows: await tableCount("roblox_universe_rank_snapshots_hourly"),
      rankDailyRows: await tableCount("roblox_universe_rank_snapshots_daily")
    };

    const summary = {
      generatedAt: now.toISOString(),
      latestHourly: await latestHourly(),
      latestDaily: await latestValue("roblox_universe_stats_daily", "stat_date"),
      latestRankHourly: await latestValue("roblox_universe_rank_snapshots_hourly", "hour_start"),
      latestRankDaily: await latestValue("roblox_universe_rank_snapshots_daily", "stat_date"),
      tiers: await tierCounts(),
      counts
    };

    await finishStatsJobRun(run, {
      status: "success",
      rowsClaimed: counts.total,
      rowsSucceeded: counts.currentIndexRows,
      metadata: summary
    });
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await finishStatsJobRun(run, { status: "failed", error });
    throw error;
  }
}

main().catch((error) => {
  console.error("Universe stats workflow audit failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
