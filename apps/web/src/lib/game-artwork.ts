import "server-only";
import { supabaseAdmin } from "./supabase";
import { gameImageUrl } from "./game-images";

/** Page views without artwork columns still use the exact owning game, never a sibling. */
export async function readGameArtwork(namespace: string, gameId: string) {
  const { data, error } = await supabaseAdmin().from("games").select("cover_image,hero_image").eq("namespace", namespace).eq("id", gameId).eq("is_published", true).maybeSingle();
  if (error) throw new Error(`Game artwork read failed: ${error.message}`);
  return data ? { cover_image: gameImageUrl(data.cover_image), hero_image: gameImageUrl(data.hero_image) } : null;
}
