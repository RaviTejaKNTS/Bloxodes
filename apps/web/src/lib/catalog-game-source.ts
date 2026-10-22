import { supabaseAdmin } from "@/lib/supabase";

// Decide the dataset before applying eligibility, search or page offsets. A
// mapping with no matching search results must never broaden to preset rows.
export async function hasCatalogGameMappings(
  view: "roblox_music_ids_game_view" | "roblox_decal_ids_game_view",
  gameSlug: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from(view)
    .select("asset_id")
    .eq("game_slug", gameSlug)
    .limit(1);
  if (error) throw error;
  if (!data) throw new Error("Catalog mapping lookup returned no result");
  return data.length > 0;
}
