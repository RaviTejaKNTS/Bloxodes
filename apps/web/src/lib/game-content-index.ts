import "server-only";
import { supabaseAdmin } from "./supabase";
export type GameContentIndexEntry = { canonical_path: string; title: string; meta_description: string | null; updated_at: string | null; published_at: string | null; created_at: string | null };
export async function listSharedGameDiscoveryPages(): Promise<GameContentIndexEntry[]> {
 const sb = supabaseAdmin();
 const groups = ["game_wiki_pages_view", "game_collection_pages_view", "game_tool_pages_view", "game_code_pages_view"];
 const results = await Promise.all(groups.map(async table => {
  const rows: GameContentIndexEntry[] = [];
  for(let offset=0;;offset+=1000) {
   let query = sb.from(table).select("canonical_path,title,meta_description,updated_at,published_at,created_at").eq("is_published",true).order("id");
   // Existing platform sitemaps keep their URL and pagination policies.
   if(table.includes("wiki") || table.includes("collection")) query=query.not("namespace","in","(gta,red-dead,minecraft)");
   else if(table.includes("tool")) query=query.neq("namespace","minecraft");
   const {data,error} = await query.range(offset,offset+999);
   if(error) throw new Error(`Game discovery read failed: ${error.message}`);
   rows.push(...data as GameContentIndexEntry[]);
   if(data.length<1000) return rows;
  }
 }));
 return results.flat();
}
