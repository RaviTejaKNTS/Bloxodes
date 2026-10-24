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

// About 5,000 older bundles still live at their positive Roblox ID with no
// negative canonical row. Writers that build negative bundle IDs must switch to
// that stored row before writing the item or anything keyed by it (hits, queue,
// thumbnails); inserting the negative ID collides on
// idx_roblox_catalog_live_canonical_key.
export async function loadLiveLegacyBundleIds(robloxBundleIds: number[]) {
  const ids = Array.from(new Set(robloxBundleIds.map((id) => Math.abs(Math.trunc(id))).filter((id) => id > 0)));
  const live = new Set<number>();
  for (let index = 0; index < ids.length; index += 300) {
    const { data, error } = await supabaseAdmin()
      .from("roblox_catalog_items")
      .select("asset_id")
      .in("asset_id", ids.slice(index, index + 300))
      .eq("item_type", "Bundle")
      .eq("is_deleted", false);
    if (error) throw new Error(`Failed to look up legacy bundle rows: ${error.message}`);
    for (const row of data ?? []) live.add(Number((row as { asset_id: number }).asset_id));
  }
  return live;
}

// Rewrites rows in place so callers that reuse them for hits and the refresh
// queue get the stored ID too.
export function useLiveLegacyBundleIds(rows: DiscoveredCatalogItemRow[], liveLegacyIds: Set<number>) {
  for (const row of rows) {
    if (row.item_type === "Bundle" && row.asset_id < 0 && liveLegacyIds.has(-row.asset_id)) row.asset_id = -row.asset_id;
  }
}

export async function upsertDiscoveredCatalogItems<T extends DiscoveredCatalogItemRow>(rows: T[], dryRun: boolean) {
  if (!rows.length || dryRun) return 0;
  const bundleIds = rows.filter((row) => row.item_type === "Bundle" && row.asset_id < 0).map((row) => row.asset_id);
  useLiveLegacyBundleIds(rows, await loadLiveLegacyBundleIds(bundleIds));
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

export async function expireStaleCatalogDiscoveryRuns(maxAgeMinutes = 120) {
  const cutoff = new Date(Date.now() - Math.max(5, maxAgeMinutes) * 60_000).toISOString();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin()
    .from("roblox_catalog_discovery_runs")
    .update({
      status: "failed",
      finished_at: nowIso,
      notes: "Automatically expired after the discovery worker stopped without finishing."
    })
    .eq("status", "running")
    .lt("started_at", cutoff)
    .select("run_id");
  if (error) throw new Error(`Failed to expire stale catalog discovery runs: ${error.message}`);
  return data?.length ?? 0;
}
