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
   ${migration("20261006114354_shared_game_namespace_publication_safety.sql")}
   -- Search and revalidation side effects are out of scope for these route tests.
   create function public.refresh_game_content_index(text) returns void language plpgsql as $$ begin end $$;
   create function public.enqueue_revalidation(text,text,text) returns void language plpgsql as $$ begin end $$;
   ${migration("20261031194915_site_routes_registry.sql")}
   ${migration("20261101120000_game_page_type_urls.sql")}
   ${migration("20261101130000_fix_rewrite_game_url_links.sql")}
   ${migration("20261102130000_specialized_franchise_page_type_urls.sql")}
   ${migration("20261102140000_move_switch_root_style_first.sql")}
   ${migration("20261102150000_prepare_game_content_check_after_inherit.sql")}
   ${migration("20261102175000_defer_search_refresh_during_moves.sql")}
   alter table public.games add unique(namespace,slug,kind);
   ${['wiki','code'].map(kind=>`alter table public.game_${kind}_pages add unique(game_id);`).join('\n')}
   ${['tool','map','quiz','catalog','checklist'].map(kind=>`alter table public.game_${kind}_pages add unique(namespace,slug);`).join('\n')}
   ${['wiki','collection','code','tool','checklist'].map(kind=>`create trigger zz_game_route_identity before insert or update on public.game_${kind}_pages for each row execute function public.validate_game_route_identity();`).join('\n')}
   create trigger prepare_game_content before insert or update on public.games for each row execute function public.prepare_game_content();
   ${["wiki","collection","code","tool","checklist"].map(kind=>`create trigger prepare_game_content before insert or update on public.game_${kind}_pages for each row execute function public.prepare_game_content();`).join("\n")}
   ${["map","quiz","catalog"].map(kind=>`create trigger prepare_game_extended_page before insert or update on public.game_${kind}_pages for each row execute function public.prepare_game_extended_page();`).join("\n")}
   ${readFileSync(new URL("../../../supabase/tests/game_page_type_urls.sql",import.meta.url),"utf8")}
   ${readFileSync(new URL("../../../supabase/tests/specialized_franchise_page_type_urls.sql",import.meta.url),"utf8")}
   -- Minimal plumbing schema, using the same disposable GitHub database.
   ${['wiki','collection','tool','code','map','quiz','catalog'].map(kind=>`alter table public.game_${kind}_pages add column meta_description text;`).join('\n')}
   alter table public.game_checklist_pages add column seo_description text;
   alter table public.game_collection_pages add column published_dataset_id uuid;
   create table public.comments(id uuid primary key default gen_random_uuid(),entity_type text,entity_id uuid,parent_id uuid,body_md text,status text,
    constraint comments_entity_type_check check(entity_type in ('wiki','game_wiki','gta_wiki','game_collection','minecraft_tool','game_tool')));
   insert into public.comments(entity_type,entity_id,body_md,status) values('gta_wiki',gen_random_uuid(),'Keep this body','approved');
   create temporary table comment_before as select * from public.comments;
   create table public.search_index(id uuid primary key default gen_random_uuid(),entity_type text,entity_id text,slug text,title text,subtitle text,url text,updated_at timestamptz,is_published boolean,search_text text,unique(entity_type,entity_id));
   insert into public.search_index(entity_type,entity_id,slug,title,url,is_published)
   select kind,'legacy-'||kind,'legacy','Legacy fixture','/wiki/legacy',true
   from unnest(array['gta_game','gta_wiki','gta_wiki_collection','gta_checklist','red_dead_game','red_dead_wiki','red_dead_wiki_collection','minecraft_game','minecraft_wiki','minecraft_wiki_collection','minecraft_tool']) kind;
   insert into public.search_index(entity_type,entity_id,slug,title,url,is_published)
   values('wiki','roblox-fixture','the-forge','The Forge','/wiki/the-forge',true);
   create temporary table search_before as select * from public.search_index;
   create table public.revalidation_events(entity_type text);
   ${migration("20261102210000_unify_game_discovery_and_comments.sql")}
   select pg_temp.url_assert(not exists((select * from search_before except select * from public.search_index) union all (select * from public.search_index except select * from search_before)),'cutover leaves all search rows unchanged');
   select pg_temp.url_assert((select count(*)=1 from public.comments c join comment_before b using(id) where c.entity_type='game_wiki' and (c.entity_id,c.parent_id,c.body_md,c.status) is not distinct from (b.entity_id,b.parent_id,b.body_md,b.status)),'comment identity and content preserved');
   ${["wiki","collection","tool","code","map","quiz","catalog","checklist"].map(kind=>`update public.game_${kind}_pages set title=coalesce(title,slug,code,'Fixture');`).join("\n")}
   set local bloxodes.plumbing_phase='legacy';
   ${readFileSync(new URL("../../../supabase/tests/unified_game_plumbing.sql",import.meta.url),"utf8").replace(/^--[^\n]*\n/,'').replace(/^begin;\s*/i,'').replace(/rollback;\s*$/i,'')}
   -- Mirror tmp/streamline-later/20261102220000_reindex_shared_game_search.sql;
   -- CI must not depend on an ignored tmp file. Test both upsert and retired-key deletion.
   select public.refresh_game_content_index(null);
   delete from public.search_index where entity_type in
    ('gta_game','gta_wiki','gta_wiki_collection','gta_checklist','red_dead_game','red_dead_wiki','red_dead_wiki_collection','minecraft_game','minecraft_wiki','minecraft_wiki_collection','minecraft_tool');
   set local bloxodes.plumbing_phase='reindexed';
   ${readFileSync(new URL("../../../supabase/tests/unified_game_plumbing.sql",import.meta.url),"utf8").replace(/^--[^\n]*\n/,'').replace(/^begin;\s*/i,'').replace(/rollback;\s*$/i,'')}
   select pg_temp.url_assert(not exists(select * from search_before where entity_type='wiki' except select * from public.search_index),'deferred rebuild preserves Roblox rows');
   rollback;`);
 } finally { sql(url,`drop database if exists ${db} with (force);`); }
});
