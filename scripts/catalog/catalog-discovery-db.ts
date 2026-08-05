import { supabaseAdmin } from "@/lib/supabase-admin";

export type DiscoveredCatalogItemRow = {
  asset_id: number;
  item_type: string;
};

export function internalCatalogItemId(robloxId: number, itemType: string) {
  const normalized = Math.abs(Math.trunc(robloxId));
  return itemType === "Bundle" ? -normalized : normalized;
}

export function robloxCatalogSortParams(value: string) {
  const normalized = value.trim().toLowerCase();
  const numeric = /^[0-5]$/.test(normalized) ? Number(normalized) : ({
    relevance: 0,
    mostfavorited: 1,
    favorited: 1,
    bestselling: 2,
    sales: 2,
    recentlyupdated: 3,
    recentlycreated: 3,
    priceasc: 4,
    pricedesc: 5
  } as Record<string, number>)[normalized];
  if (numeric == null) throw new Error(`Unsupported Roblox catalog sort type: ${value}`);
  return {
    sortType: String(numeric),
    ...(numeric === 1 || numeric === 2 ? { sortAggregation: "5" } : {})
  };
}

export async function upsertDiscoveredCatalogItems<T extends DiscoveredCatalogItemRow>(rows: T[], dryRun: boolean) {
  if (!rows.length || dryRun) return 0;
  const { data, error } = await supabaseAdmin().rpc("upsert_roblox_catalog_discovery_items", {
    p_rows: rows
  });
  if (error) throw new Error(`Failed to safely upsert discovered catalog items: ${error.message}`);
  return typeof data === "number" ? data : rows.length;
}

export async function enqueueDiscoveredCatalogItems(
  assetIds: number[],
  nowIso: string,
  dryRun: boolean,
  reason = "discovery"
) {
  if (!assetIds.length || dryRun) return 0;
  const { data, error } = await supabaseAdmin().rpc("enqueue_roblox_catalog_refresh", {
    p_asset_ids: Array.from(new Set(assetIds)),
    p_priority: "new",
    p_reason: reason,
    p_next_run_at: nowIso
  });
  if (error) throw new Error(`Failed to enqueue discovered catalog items: ${error.message}`);
  return typeof data === "number" ? data : assetIds.length;
}
