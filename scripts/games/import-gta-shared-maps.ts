import "../shared/load-env";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

async function read(file: string) { return JSON.parse(await fs.readFile(`apps/web/src/data/${file}`,"utf8")); }
async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.SUPABASE_URL!;
  if (new URL(url).origin === "https://database.bloxodes.com") {
    if (process.env.NODE_ENV !== "production" || !process.argv.includes("--allow-prod")) throw new Error("Production requires its explicit environment and --allow-prod.");
  } else assertManagedDevelopmentSupabaseUrl(url,"GTA shared map import");
  const sb=createClient(url,process.env.SUPABASE_SERVICE_ROLE!,{auth:{persistSession:false}});
  const { data: games,error }=await sb.from("games").select("id,slug").eq("namespace","gta");
  if(error)throw error;
  const registry=await read("gta-maps/registry.json");
  const rows=[];
  for(const definition of registry) {
    const game=games.find(game=>game.slug===definition.wikiSlug);
    if(!game)throw new Error(`Missing GTA identity ${definition.wikiSlug}`);
    rows.push({namespace:"gta",game_id:game.id,slug:definition.slug,title:definition.mapTitle,meta_description:definition.description,canonical_path:definition.route,renderer_key:"gta-layered",map_data:{definition,points:(await read(`gta-maps/${definition.slug}.json`)).points},is_published:true});
  }
  const gta5=games.find(game=>game.slug==="gta-5");
  if(!gta5)throw new Error("Missing GTA V identity");
  rows.push({namespace:"gta",game_id:gta5.id,slug:"gta5",title:"GTA 5 Interactive Map: Story Mode Collectibles & Challenges",meta_description:"Explore 377 GTA 5 Story Mode collectible and challenge locations on a full-screen Los Santos map. Search 11 collections, browse 92 named places, and track your progress.",canonical_path:"/gta/maps/gta5",renderer_key:"gta5",map_data:{points:await read("gta5-map-points.json"),places:await read("gta5-map-places.json"),markerSnapshot:await read("gta5-map-marker-snapshot.json")},is_published:true});
  // Existing maps must match their reviewed snapshots before an ordinary repeat.
  const {data:existing,error:existingError}=await sb.from("game_map_pages").select("id,slug,game_id,map_data").eq("namespace","gta");
  if(existingError)throw existingError;
  const canonical=(value:unknown):string=>Array.isArray(value)?`[${value.map(canonical).join(",")}]`:value&&typeof value==="object"?`{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,val])=>JSON.stringify(key)+":"+canonical(val)).join(",")}}`:JSON.stringify(value);
  const hash=(value:unknown)=>createHash("sha256").update(canonical(value)).digest("hex");
  const pending=[];
  for(const row of rows) {
    const previous=existing.find(page=>page.slug===row.slug);
    if(previous) {
      if(previous.game_id!==row.game_id || hash(previous.map_data)!==hash(row.map_data))throw new Error(`Stored map ${row.slug} differs from its reviewed snapshot; use a separate reviewed update.`);
      continue;
    }
    pending.push(row);
  }
  if(pending.length) {
    const {error:publicationError}=await sb.rpc("publish_game_content_batch",{target_namespace:"gta",payload:{maps:pending},apply_changes:apply});
    if(publicationError)throw publicationError;
  }
  if(apply) {
    const {data:saved,error:readError}=await sb.from("game_map_pages").select("slug,map_data").eq("namespace","gta").in("slug",rows.map(row=>row.slug));
    if(readError)throw readError;
    if(saved.length!==rows.length || rows.some(row=>hash(saved.find(page=>page.slug===row.slug)?.map_data)!==hash(row.map_data)))throw new Error("Map data readback differs from the frozen source.");
  }
  console.log(`${rows.length} GTA map snapshots checked; ${pending.length} ${apply?"imported":"validated and rolled back"}. All original map fields are preserved.`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
