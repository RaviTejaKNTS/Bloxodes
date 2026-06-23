import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";
import { assignItemStatsTier, chunkArray, type ItemStatsSourceRow } from "./item-stats-utils";

type Options = {
  limit: number;
  apply: boolean;
};

const DEFAULT_LIMIT = 0;

function readNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    limit: readNumber(process.env.ITEM_STATS_TIER_LIMIT, DEFAULT_LIMIT),
    apply: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--limit") {
      options.limit = readNumber(args[index + 1], options.limit);
      index += 1;
    } else if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npm run stats:items:tier -- [--apply] [--limit <n>]

Classifies Roblox marketplace items into NEW, HOT, WARM, COLD, TRADE, STALE, or BROKEN_MEDIA.
Dry-run by default; pass --apply to update roblox_catalog_items.
`);
      process.exit(0);
    }
  }

  return options;
}

async function loadRows(limit: number) {
  const pageSize = 1000;
  const rows: ItemStatsSourceRow[] = [];
  let from = 0;

  while (true) {
    const remaining = limit > 0 ? limit - rows.length : pageSize;
    if (limit > 0 && remaining <= 0) break;
    const size = limit > 0 ? Math.min(pageSize, remaining) : pageSize;
    const { data, error } = await supabaseAdmin()
      .from("roblox_catalog_items")
      .select(`
        asset_id, name, category, subcategory, favorite_count,
        lowest_resale_price_robux, has_resellers, collectible_item_id,
        is_limited, is_limited_unique, last_item_stats_refreshed_at,
        item_stats_tier, next_item_stats_refresh_at, thumbnail_http_status
      `)
      .eq("is_deleted", false)
      .order("last_item_stats_refreshed_at", { ascending: true, nullsFirst: true })
      .order("favorite_count", { ascending: false, nullsFirst: false })
      .range(from, from + size - 1);

    if (error) throw new Error(`Failed to load catalog items for tiering: ${error.message}`);
    rows.push(...((data ?? []) as ItemStatsSourceRow[]));
    if ((data?.length ?? 0) < size) break;
    from += size;
  }

  return rows;
}

async function updateRows(rows: Record<string, unknown>[]) {
  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await supabaseAdmin().from("roblox_catalog_items").upsert(chunk, { onConflict: "asset_id" });
    if (error) throw new Error(`Failed to update item tiers: ${error.message}`);
  }
}

async function main() {
  const options = parseArgs();
  const run = await startStatsJobRun({
    jobName: "stats_items_tier",
    metadata: { limit: options.limit, apply: options.apply }
  });

  try {
    const nowIso = new Date().toISOString();
    const rows = await loadRows(options.limit);
    const updates: Record<string, unknown>[] = [];
    const counts = new Map<string, number>();

    for (const row of rows) {
      const assigned = assignItemStatsTier(row);
      counts.set(assigned.tier, (counts.get(assigned.tier) ?? 0) + 1);
      if (row.item_stats_tier !== assigned.tier || !row.next_item_stats_refresh_at) {
        updates.push({
          asset_id: row.asset_id,
          item_stats_tier: assigned.tier,
          next_item_stats_refresh_at: row.next_item_stats_refresh_at ?? nowIso,
          last_item_stats_refresh_error: null
        });
      }
    }

    if (options.apply) {
      await updateRows(updates);
    }

    await finishStatsJobRun(run, {
      status: "success",
      rowsClaimed: rows.length,
      rowsSucceeded: options.apply ? updates.length : 0,
      metadata: {
        dry_run: !options.apply,
        tier_counts: Object.fromEntries(counts),
        changed_rows: updates.length
      }
    });

    console.log(JSON.stringify({ dryRun: !options.apply, scanned: rows.length, changed: updates.length, tiers: Object.fromEntries(counts) }, null, 2));
  } catch (error) {
    await finishStatsJobRun(run, { status: "failed", error });
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
