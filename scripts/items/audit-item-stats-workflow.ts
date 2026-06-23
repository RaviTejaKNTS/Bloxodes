import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";

type CountQuery = any;

async function countRows(table: string, label: string, apply?: (query: CountQuery) => CountQuery) {
  let query: CountQuery = supabaseAdmin().from(table).select("*", { count: "exact", head: true });
  if (apply) query = apply(query);
  const { count, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return count ?? 0;
}

async function latestRow(table: string, select: string, orderColumn: string) {
  const { data, error } = await supabaseAdmin()
    .from(table)
    .select(select)
    .order(orderColumn, { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? null;
}

async function main() {
  const run = await startStatsJobRun({ jobName: "stats_items_audit" });
  const now = new Date();
  const stale24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const stale7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const stale30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const summary = {
      generatedAt: now.toISOString(),
      catalogItems: {
        total: await countRows("roblox_catalog_items", "items total", (query) => query.eq("is_deleted", false)),
        neverStatsRefreshed: await countRows("roblox_catalog_items", "never stats refreshed", (query) =>
          query.eq("is_deleted", false).is("last_item_stats_refreshed_at", null)
        ),
        staleOver24h: await countRows("roblox_catalog_items", "stale over 24h", (query) =>
          query.eq("is_deleted", false).or(`last_item_stats_refreshed_at.is.null,last_item_stats_refreshed_at.lt.${stale24h}`)
        ),
        staleOver7d: await countRows("roblox_catalog_items", "stale over 7d", (query) =>
          query.eq("is_deleted", false).or(`last_item_stats_refreshed_at.is.null,last_item_stats_refreshed_at.lt.${stale7d}`)
        ),
        dueNow: await countRows("roblox_catalog_items", "due now", (query) =>
          query.eq("is_deleted", false).or(`next_item_stats_refresh_at.is.null,next_item_stats_refresh_at.lte.${now.toISOString()}`)
        ),
        brokenMedia: await countRows("roblox_catalog_items", "broken media", (query) =>
          query.eq("is_deleted", false).gte("thumbnail_http_status", 400)
        )
      },
      currentIndex: {
        total: await countRows("stats_item_current_index", "current index total"),
        latestIndexed: await latestRow("stats_item_current_index", "asset_id,indexed_at", "indexed_at")
      },
      hourly: {
        rows: await countRows("roblox_catalog_item_stats_hourly", "hourly rows"),
        rowsLast24h: await countRows("roblox_catalog_item_stats_hourly", "hourly rows last 24h", (query) => query.gt("hour_start", stale24h)),
        latest: await latestRow("roblox_catalog_item_stats_hourly", "asset_id,hour_start,sampled_at", "hour_start")
      },
      daily: {
        rows: await countRows("roblox_catalog_item_stats_daily", "daily rows"),
        latest: await latestRow("roblox_catalog_item_stats_daily", "asset_id,stat_date,last_sampled_at", "stat_date")
      },
      resale: {
        candidates: await countRows("roblox_catalog_items", "resale candidates", (query) =>
          query.eq("is_deleted", false).or("has_resellers.eq.true,lowest_resale_price_robux.gt.0,collectible_item_id.not.is.null")
        ),
        points: await countRows("roblox_catalog_item_resale_points", "resale points"),
        staleOver30d: await countRows("roblox_catalog_items", "resale stale", (query) =>
          query
            .eq("is_deleted", false)
            .or("has_resellers.eq.true,lowest_resale_price_robux.gt.0,collectible_item_id.not.is.null")
            .or(`last_resale_data_fetched_at.is.null,last_resale_data_fetched_at.lt.${stale30d}`)
        )
      }
    };

    await finishStatsJobRun(run, {
      status: "success",
      rowsSucceeded: summary.currentIndex.total,
      metadata: summary
    });

    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await finishStatsJobRun(run, { status: "failed", error });
    throw error;
  }
}

main().catch((error) => {
  console.error("Item stats workflow audit failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
