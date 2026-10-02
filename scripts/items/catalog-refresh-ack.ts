import type { SupabaseClient } from "@supabase/supabase-js";
import { runDataApiOperation } from "../shared/data-api-retry";

// Only completed metadata/thumbnail observations can settle unclaimed work.
export async function acknowledgeCatalogRefreshFromStats(db: SupabaseClient, rows: Record<string, unknown>[]) {
  const groups = new Map<string, { observedAt: string; nextRunAt: string; ids: number[] }>();
  for (const row of rows) {
    const observedAt = row.last_metadata_verified_at;
    if (typeof observedAt !== "string" || row.last_thumbnail_verified_at !== observedAt
      || typeof row.next_item_stats_refresh_at !== "string" || typeof row.asset_id !== "number") continue;
    const key = `${observedAt}/${row.next_item_stats_refresh_at}`;
    const group = groups.get(key) ?? { observedAt, nextRunAt: row.next_item_stats_refresh_at, ids: [] };
    group.ids.push(row.asset_id); groups.set(key, group);
  }
  for (const { observedAt, nextRunAt, ids } of groups.values()) {
    await runDataApiOperation("Acknowledge verified catalog work", () => db.from("roblox_catalog_refresh_queue").update({
      status: "pending", attempts: 0, last_success_at: observedAt,
      next_run_at: nextRunAt, last_error: null, last_error_code: null, last_error_kind: null
    }).in("asset_id", ids).in("status", ["pending", "retry"])
      .or(`last_attempt_at.is.null,last_attempt_at.lte.${observedAt}`));
  }
}
