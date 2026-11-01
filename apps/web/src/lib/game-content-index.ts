import "server-only";
import { supabaseAdmin } from "./supabase";
export type GameContentIndexEntry = { namespace: string; canonical_path: string; title: string; meta_description: string | null; updated_at: string | null; content_updated_at?: string | null; published_at: string | null; created_at: string | null };
export async function listSharedGameDiscoveryPages(): Promise<GameContentIndexEntry[]> {
 const sb = supabaseAdmin();
 const groups = ["game_wiki_pages_view", "game_collection_pages_view", "game_tool_pages_view", "game_code_pages_view", "game_map_pages_view", "game_quiz_pages_view", "game_catalog_pages_view", "game_checklist_pages_view"];
 const results = await Promise.all(groups.map(async table => {
  const rows: GameContentIndexEntry[] = [];
  for(let offset=0;;offset+=1000) {
   const checklist = table === "game_checklist_pages_view";
   const hasContentDate = ["game_wiki_pages_view", "game_collection_pages_view", "game_tool_pages_view", "game_checklist_pages_view"].includes(table);
   const columns = checklist ? "namespace,canonical_path,title,meta_description:seo_description,updated_at,published_at,created_at" : "namespace,canonical_path,title,meta_description,updated_at,published_at,created_at";
   let query = sb.from(table).select(columns + (hasContentDate ? ",content_updated_at" : "")).order("id");
   if (!checklist) query = query.eq("is_published",true);
   const {data,error} = await query.range(offset,offset+999);
   if(error) throw new Error(`Game discovery read failed: ${error.message}`);
   rows.push(...(data as unknown as GameContentIndexEntry[]));
   if(data.length<1000) return rows;
  }
 }));
 return results.flat();
}
