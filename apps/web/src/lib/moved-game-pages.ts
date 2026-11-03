import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "./supabase";
import { loadPublishedMovedGamePages } from "./published-moved-game-pages";

export const listMovedGamePages = cache(async (kind: string): Promise<Array<{ title: string; canonical_path: string }>> => {
  try {
    return (await loadPublishedMovedGamePages(supabaseAdmin(), kind)).sort((a, b) => a.title.localeCompare(b.title));
  } catch {
    console.error("[game-directories] Published game directory unavailable.");
    return [];
  }
});
