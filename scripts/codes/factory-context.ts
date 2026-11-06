import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { codePageFinalSchema } from "./final-contract";

export async function loadCodesContext(sb: SupabaseClient, universeId: number) {
  const universe = await sb.from("roblox_universes").select("universe_id,name,display_name,root_place_id,playing,creator_id,creator_name,genre_l1,genre_l2").eq("universe_id", universeId).maybeSingle();
  if (universe.error) throw new Error(`Game lookup failed: ${universe.error.message}`);
  const overlaps = await sb.from("code_pages").select("id,slug,name,is_published,source_url,source_url_2,roblox_link").eq("universe_id", universeId);
  if (overlaps.error) throw new Error(`Overlap lookup failed: ${overlaps.error.message}`);
  const rows: any[] = [];
  for (let start = 0; ; start += 1000) {
    const result = await sb.from("code_pages").select("id,slug,name,universe_id,internal_links,universe:roblox_universes(creator_id,creator_name,genre_l1,genre_l2)").eq("is_published", true).order("id").range(start, start + 999);
    if (result.error) throw new Error(`Related pages lookup failed: ${result.error.message}`);
    rows.push(...result.data);
    if (result.data.length < 1000) break;
  }
  let game = universe.data;
  // Discovery is read-only and cannot seed a newly found universe. Context
  // can still describe it; the guarded publish command will ensure it exists.
  if (!game) {
    const response = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Roblox game lookup failed (${response.status})`);
    const detail = (await response.json()).data?.[0];
    if (detail?.id !== universeId || !detail.rootPlaceId || !detail.name) throw new Error("Game is absent from both roblox_universes and the Roblox API");
    game = { universe_id: universeId, name: detail.name, display_name: detail.name, root_place_id: detail.rootPlaceId,
      playing: detail.playing ?? null, creator_id: detail.creator?.id ?? null, creator_name: detail.creator?.name ?? null,
      genre_l1: detail.genre ?? null, genre_l2: null };
  }
  const developer = (u: any) => u.creator_id != null ? `id:${u.creator_id}` : u.creator_name?.trim().toLowerCase();
  const genre = (u: any) => (u.genre_l1 || u.genre_l2)?.trim().toLowerCase();
  const related = rows.filter(row => row.universe_id !== universeId).flatMap(row => {
    const u = Array.isArray(row.universe) ? row.universe[0] : row.universe;
    if (!u) return [];
    const basis = developer(game) && developer(game) === developer(u) ? "developer" : genre(game) && genre(game) === genre(u) ? "genre" : null;
    return basis ? [{ id: row.id, slug: row.slug, name: row.name, basis, internal_links: row.internal_links ?? 0 }] : [];
  }).sort((a, b) => a.internal_links - b.internal_links || a.name.localeCompare(b.name)).slice(0, 4);
  return { game, game_identity_source: universe.data ? "roblox_universes" : "roblox_api", existing_code_pages: overlaps.data, related_pages: related,
    slug_rules: "Use a readable editorial game slug. Never copy roblox_universes.slug. Never append -codes or a universe ID. Keep an existing code_pages.slug.",
    final_json_schema: z.toJSONSchema(codePageFinalSchema, { unrepresentable: "any" }) };
}
