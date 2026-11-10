import type { SupabaseClient } from "@supabase/supabase-js";

const MIN_UPDATE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const LOOKUP_BATCH_SIZE = 200;

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
