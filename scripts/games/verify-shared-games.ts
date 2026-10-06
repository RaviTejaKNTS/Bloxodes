import "../shared/load-env";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { assertManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

function canonical(value: unknown): string {
 if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
 if (value && typeof value === "object") return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,val]) => `${JSON.stringify(key)}:${canonical(val)}`).join(",")}}`;
 return JSON.stringify(value);
}
const suffixes: Record<string,string> = { games: "games", wiki_pages: "game_wiki_pages", wiki_collection_pages: "game_collection_pages", wiki_collection_datasets: "game_collection_datasets", wiki_collection_items: "game_collection_items", checklist_pages: "game_checklist_pages", checklist_items: "game_checklist_items", tools: "game_tool_pages", releases: "game_releases" };
async function main() {
 const url = process.env.SUPABASE_URL!;
 assertManagedDevelopmentSupabaseUrl(url, "shared game verification");
 assert.equal(new URL(url).hostname, "bbtcaurrtyoukvjbxbbj.supabase.co");
 const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE!, { auth: { persistSession: false } });
 const root = path.resolve("tmp/shared-games/before/data");
 const receipt = JSON.parse(await fs.readFile(path.join(root,"receipt.json"),"utf8"));
 const results = [];
 for (const baseline of receipt.tables as Array<{table:string;count:number;sha256:string}>) {
  const bytes = await fs.readFile(path.join(root,`${baseline.table}.json`),"utf8");
  assert.equal(createHash("sha256").update(bytes).digest("hex"),baseline.sha256,`Backup hash ${baseline.table}`);
  const oldRows = JSON.parse(bytes) as Array<Record<string,unknown>>;
  let table = baseline.table, namespace = "";
  const progress = /^user_(gta|red_dead)_collection_progress$/.exec(table);
  const match = /^(gta|red_dead|minecraft)_(.+)$/.exec(table);
  if (progress) { table = "game_collection_progress"; namespace = progress[1].replace("_","-"); }
  else if (match) { table = suffixes[match[2]]; namespace = match[1].replace("_","-"); }
  const columns = oldRows.length ? Object.keys(oldRows[0]).join(",") : "*";
  let countQuery = sb.from(table).select("*",{count:"exact",head:true});
  if (namespace) countQuery = countQuery.eq("namespace",namespace);
  const {count,error:countError} = await countQuery;
  if (countError) throw countError;
  const liveRows: Array<Record<string,unknown>> = [];
  for(let offset=0;offset<(count ?? 0);offset+=1000) {
   let query = sb.from(table).select(columns);
   if(namespace) query=query.eq("namespace",namespace);
   if(table === "game_releases") query=query.order("edition").order("release_order");
   else if(table.includes("progress")) query=query.order("user_id").order(table === "user_checklist_progress" ? "checklist_slug" : "collection_code");
   else query=query.order("id");
   const {data,error}=await query.range(offset,offset+999);
   if(error) throw error;
   liveRows.push(...data as unknown as Array<Record<string,unknown>>);
  }
  assert.equal(liveRows.length,count,`Readback count ${table}`);
  const key=(row:Record<string,unknown>)=>String(row.id ?? (table === "game_releases" ? `${row.edition}:${row.version}` : `${row.user_id}:${row.collection_code ?? row.checklist_slug}`));
  const live = new Map(liveRows.map(row=>[key(row),row]));
  for(const row of oldRows) assert.equal(canonical(live.get(key(row))),canonical(row),`Original fields changed in ${baseline.table} row ${key(row)}`);
  // Only new franchise roots and their hub pages may exist beyond the migration copy.
  if(!["games","game_wiki_pages"].includes(table)) assert.equal(liveRows.length,oldRows.length,`Unexpected rows ${table}`);
  results.push({source:baseline.table,target:table,namespace,originalRows:oldRows.length,verified:true});
  console.log(`${baseline.table}: all ${oldRows.length} original rows and fields verified`);
 }
 await fs.mkdir("tmp/shared-games/verification",{recursive:true,mode:0o700});
 await fs.writeFile("tmp/shared-games/verification/data-preservation.json",JSON.stringify({project:new URL(url).hostname,checkedAt:new Date().toISOString(),results},null,2),{mode:0o600});
 console.log("Complete data-preservation check passed.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
