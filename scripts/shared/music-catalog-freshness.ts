import type { SupabaseClient } from "@supabase/supabase-js";

const CATALOG_CODE = "roblox-music-ids";
const MIN_UPDATE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const LOOKUP_BATCH_SIZE = 200;

type MusicCatalogChanges = {
  addedSongs: number;
  removedSongs?: number;
  retiredSongs?: number;
};

export async function getExistingMusicAssetIds(client: SupabaseClient, assetIds: number[]): Promise<Set<number>> {
  const ids = [...new Set(assetIds)];
  const existing = new Set<number>();
  for (let offset = 0; offset < ids.length; offset += LOOKUP_BATCH_SIZE) {
    const { data, error } = await client
      .from("roblox_music_ids")
      .select("asset_id")
      .in("asset_id", ids.slice(offset, offset + LOOKUP_BATCH_SIZE));
    if (error) throw new Error(`Failed to check existing music IDs: ${error.message}`);
    for (const row of data ?? []) existing.add(row.asset_id);
  }
  return existing;
}

export async function updateMusicCatalogTimestamp(
  client: SupabaseClient,
  changes: MusicCatalogChanges,
  now = new Date()
): Promise<boolean> {
  if (changes.addedSongs <= 0 && (changes.removedSongs ?? 0) <= 0 && (changes.retiredSongs ?? 0) <= 0) {
    return false;
  }

  // Apply the age condition in the write so concurrent collectors cannot both bump it.
  const cutoff = new Date(now.getTime() - MIN_UPDATE_INTERVAL_MS).toISOString();
  const { data, error } = await client
    .from("catalog_pages")
    .update({ updated_at: now.toISOString() })
    .eq("code", CATALOG_CODE)
    .lte("updated_at", cutoff)
    .select("code");
  if (error) throw new Error(`Failed to update music catalog timestamp: ${error.message}`);
  return Boolean(data?.length);
}
