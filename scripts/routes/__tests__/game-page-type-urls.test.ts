import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildRedirectSnapshot, resolveSiteRoute, type RedirectRoute } from "../../../apps/web/src/lib/site-route-resolver";
const migration = (name: string) => readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8").replace(/^begin;\s*/i, "").replace(/commit;\s*$/i, "");

test("old collection pagination follows its current live owner", () => {
  const row: RedirectRoute = { path:"/peak/wiki/items",status:"old",match_type:"exact",tail_mode:"append",match_self:true,page_type:"collection",page_id:"collection-id",target_url:null,resolved_target:"/wiki/peak/items",redirect_code:301,origin:"trigger" };
  assert.equal(resolveSiteRoute(buildRedirectSnapshot([row]), row.path + "/page/2")?.target, "/wiki/peak/items/page/2");
  for (const tail of ["/page/0","/page/-1","/page/2junk","/other"]) assert.equal(resolveSiteRoute(buildRedirectSnapshot([row]),row.path+tail),null);
  const blocker = {...row,path:row.path+"/page/2",status:"live" as const};
  assert.equal(resolveSiteRoute(buildRedirectSnapshot([row,blocker]),blocker.path)?.target,null);
  assert.equal(resolveSiteRoute(buildRedirectSnapshot([{...row,page_type:"wiki"}]),row.path+"/page/2"),null);
});

test("game URL styles, atomic moves, immutable ownership and publisher paths", {skip:process.env.CI!=="true"}, () => {
 const url = process.env.CI_TRANSACTION_DATABASE_URL;
 assert.ok(url);
 assert.ok(["localhost","127.0.0.1"].includes(new URL(url).hostname));
 const db = "game_urls_"+randomUUID().replaceAll("-","");
 const target = new URL(url); target.pathname="/"+db;
 const sql = (connection: string, input: string) => execFileSync("psql",[connection,"-X","-v","ON_ERROR_STOP=1","-q"],{input,encoding:"utf8",stdio:["pipe","pipe","pipe"]});
 const tables = ["code_pages","wiki_pages","wiki_collection_pages","quiz_pages","checklist_pages","tools","events_pages","articles","catalog_pages","puzzle_pages",...["wiki","collection","code","tool","checklist","map","quiz","catalog"].map(kind=>`game_${kind}_pages`)];
 try {
  sql(url,`create database ${db};`);
  sql(target.toString(),`begin;
   do $$ begin
    begin create role anon; exception when duplicate_object or unique_violation then null; end;
    begin create role authenticated; exception when duplicate_object or unique_violation then null; end;
    begin create role service_role; exception when duplicate_object or unique_violation then null; end;
   end $$;
   create table public.games(id uuid primary key default gen_random_uuid(),namespace text,slug text,kind text default 'game',parent_id uuid,is_published boolean default true,description_md text);
   ${tables.map(table=>`create table public.${table}(id uuid primary key default gen_random_uuid(),namespace text,slug text,code text,wiki_slug text,collection_slug text,canonical_path text,game_id uuid references public.games(id),wiki_page_id uuid,old_slugs text[] default '{}',is_published boolean default true,is_public boolean default true,published_at timestamptz,updated_at timestamptz,title text,intro_md text,tips_md text,description_md text,how_it_works_md text,wiki_md text,body_md text,content_md text,redeem_md text,rewards_md text,troubleshoot_md text,find_codes_md text,game_description_md text,event_details_md text,event_summary_md text,how_to_play_md text,interlinking_ai_copy_md text,faq_json jsonb,description_json jsonb,controls_json jsonb,quiz_data jsonb,map_data jsonb,catalog_data jsonb,sources_json jsonb default '[]');`).join("\n")}
   create table public.game_checklist_items(id uuid primary key,page_id uuid,namespace text,item_key text,section_code text);
   ${migration("20261031194915_site_routes_registry.sql")}
   ${migration("20261101120000_game_page_type_urls.sql")}
   ${migration("20261101130000_fix_rewrite_game_url_links.sql")}
   ${migration("20261006114354_shared_game_namespace_publication_safety.sql")}
   alter table public.games add unique(namespace,slug,kind);
   ${['wiki','code'].map(kind=>`alter table public.game_${kind}_pages add unique(game_id);`).join('\n')}
   ${['tool','map','quiz','catalog','checklist'].map(kind=>`alter table public.game_${kind}_pages add unique(namespace,slug);`).join('\n')}
   ${['wiki','collection','code','tool','checklist'].map(kind=>`create trigger zz_game_route_identity before insert or update on public.game_${kind}_pages for each row execute function public.validate_game_route_identity();`).join('\n')}
   create trigger prepare_game_content before insert or update on public.games for each row execute function public.prepare_game_content();
   ${["wiki","collection","code","tool","checklist"].map(kind=>`create trigger prepare_game_content before insert or update on public.game_${kind}_pages for each row execute function public.prepare_game_content();`).join("\n")}
   ${["map","quiz","catalog"].map(kind=>`create trigger prepare_game_extended_page before insert or update on public.game_${kind}_pages for each row execute function public.prepare_game_extended_page();`).join("\n")}
   ${readFileSync(new URL("../../../supabase/tests/game_page_type_urls.sql",import.meta.url),"utf8")}
   rollback;`);
 } finally { sql(url,`drop database if exists ${db} with (force);`); }
});
