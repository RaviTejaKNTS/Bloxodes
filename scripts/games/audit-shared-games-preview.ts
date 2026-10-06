import "../shared/load-env";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { assertManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";
const args=process.argv.slice(2);const index=args.indexOf("--base-url");
const base=args[index+1] || "http://127.0.0.1:3106";
async function main() {
 assertManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL,"shared game preview audit");
 assert.equal(new URL(process.env.SUPABASE_URL!).hostname,"bbtcaurrtyoukvjbxbbj.supabase.co");
 const sb=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE!,{auth:{persistSession:false}});
 const paths=new Set<string>();
 for(const table of ["game_wiki_pages_view","game_collection_pages_view","game_tool_pages_view","game_code_pages_view","game_checklist_pages_view"]) {
  const {data,error}=await sb.from(table).select("canonical_path").eq(table.includes("checklist")?"is_public":"is_published",true);
  if(error) throw error;
  for(const page of data) paths.add(page.canonical_path);
 }
 const originalCount=paths.size;
 const results:Array<{path:string;status:number;canonical:string;bytes:number}>=[];
 const queue=[...paths];let position=0;
 async function worker() {
  while(position<queue.length) {
   const route=queue[position++];
   const response=await fetch(`${base}${route}`,{signal:AbortSignal.timeout(180000)});
   const html=await response.text();
   assert.equal(response.status,200,`Page status ${route}`);
   assert.equal((html.match(/id="article-body"/g)??[]).length,1,`Article body ${route}`);
   assert.match(html,/<h1[ >]/,`Page title ${route}`);
   const canonical=/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/.exec(html)?.[1];
   assert.equal(canonical,`https://bloxodes.com${route}`,`Canonical ${route}`);
   for(const script of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)) JSON.parse(script[1]);
   for(const link of html.matchAll(/href="([^"?#]*\/page\/[1-9]\d*)"/g)) {
    const path=link[1];if(!path.startsWith("/")||!path.startsWith(`/${route.split("/")[1]}/`) || !path.includes("/wiki/")) continue;
    if(!paths.has(path)){paths.add(path);queue.push(path);}
   }
   results.push({path:route,status:response.status,canonical:canonical!,bytes:Buffer.byteLength(html)});
   if(results.length%20===0) console.log(`${results.length} pages verified; ${queue.length} discovered`);
  }
 }
 await Promise.all([worker(),worker(),worker()]);
 for(const route of ["/gta/wiki/not-a-real-game","/minecraft/not-an-edition/wiki","/shared-verification/wiki/not-a-real-collection","/shared-verification/wiki/machines/page/999999"]) assert.equal((await fetch(`${base}${route}`,{signal:AbortSignal.timeout(60000)})).status,404,`Invalid route ${route}`);
 for(const ns of ["gta","red-dead","shared-verification"]) {
  const endpoint=ns==="shared-verification"?`/api/games/${ns}/collections/progress`:`/api/${ns}/collections/progress`;
  assert.equal((await fetch(`${base}${endpoint}`)).status,401,`Anonymous progress ${ns}`);
  assert.equal((await fetch(`${base}${endpoint}`,{method:"PUT",headers:{Origin:"https://untrusted.example","Content-Type":"application/json"},body:'{}'})).status,403,`Origin guard ${ns}`);
 }
 for(const path of ["/sitemaps/games.xml","/sitemaps/gta.xml","/sitemaps/red-dead.xml","/sitemaps/minecraft.xml","/sitemap.xml","/feed.xml"]) {
  const response=await fetch(`${base}${path}`,{signal:AbortSignal.timeout(120000)});assert.equal(response.status,200,`Discovery ${path}`);
  const body=await response.text();assert.match(body,/<\?xml|<urlset|<sitemapindex|<rss/,`XML ${path}`);
 }
 await fs.mkdir("tmp/shared-games/verification",{recursive:true});
 await fs.writeFile("tmp/shared-games/verification/pages.json",JSON.stringify({checkedAt:new Date().toISOString(),base,originalCount,total:results.length,results},null,2));
 console.log(`Verified ${originalCount} published pages and ${results.length-originalCount} discovered pagination pages, route failures, progress guards and discovery feeds.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
