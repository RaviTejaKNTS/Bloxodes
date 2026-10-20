import type { SupabaseClient } from "@supabase/supabase-js";

export async function previewContentUniverse(universeId: number) {
  const { previewRobloxUniverse } = await import("../universes/enrich-roblox-universes");
  return previewRobloxUniverse(universeId);
}

export async function ensureContentUniverse(
  db: SupabaseClient,
  universeId: number,
  apply: boolean,
  importUniverse = async (client: SupabaseClient, id: number) => {
    const { importRobloxUniverse } = await import("../universes/enrich-roblox-universes");
    await importRobloxUniverse(client, id);
  }
) {
  const read = () => db.from("roblox_universes")
    .select("universe_id,root_place_id,name,display_name,slug,icon_url,thumbnail_urls")
    .eq("universe_id", universeId).maybeSingle();
  const existing = await read();
  if (existing.error) throw new Error(`Universe identity could not be read in the selected target: ${existing.error.message}.`);
  if (existing.data) return existing.data;
  if (!apply) {
    console.log(`NOTE will import universe ${universeId} on apply`);
    return null;
  }
  await importUniverse(db, universeId);
  const stored = await read();
  if (stored.error || !stored.data || Number(stored.data.universe_id) !== universeId || !Number.isSafeInteger(Number(stored.data.root_place_id)) || Number(stored.data.root_place_id) <= 0 || !stored.data.name || !stored.data.slug) {
    throw new Error(`Universe ${universeId} import readback failed. No content pages were written.`);
  }
  console.log(`PASS imported and verified universe ${universeId}`);
  return stored.data;
}
