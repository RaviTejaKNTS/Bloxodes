-- Run only through scripts/routes/__tests__/site-routes.test.ts on GitHub.
-- Assertions roll back; the committed migration lives only in its disposable CI database.
create function pg_temp.route_assert(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'site_routes: %',message; end if; end $$;
select pg_temp.route_assert((select status='live' from public.site_routes where path='/codes/slap-battles'),'draft code owns its path');
select pg_temp.route_assert((select page_type='wiki' from public.site_routes where path='/fixture-game'),'stored root beats synthetic hub');
select pg_temp.route_assert(exists(select from public.site_route_conflicts where path='/fixture-game' and origin='backfill'),'backfill clash logged');
select pg_temp.route_assert((select count(*)=360 from public.site_routes where origin='slug_oldslugs'),'all 360 frozen root aliases');
select pg_temp.route_assert((select count(*)=12 from public.site_routes where origin='article-redirect-slugs'),'all 12 articles');
select pg_temp.route_assert((select page_id='00000000-0000-0000-0000-000000000001' from public.site_routes where path='/codes/previous-slap'),'old_slugs linked');
select pg_temp.route_assert((select resolved_target='/codes/slap-battles' from public.resolve_site_route('/slap-battles-codes')),'existing page-linked root alias');
select pg_temp.route_assert((select target_url is not null from public.site_routes where path='/bikeworld-codes'),'missing page uses literal target');
select pg_temp.route_assert((select resolved_target='/articles/all-fisch-enchantments-guide' from public.resolve_site_route('/all-fisch-enchantments-guide')),'article linked');
select pg_temp.route_assert((select resolved_target='/catalog/roblox-music-ids' and (route).redirect_code=308 from public.resolve_site_route('/catalog/roblox-music-ids/games/work-at-a-pizza-place/page/9')),'Next permanent drops tail with 308');
select pg_temp.route_assert((select resolved_target like 'https://adstxt.mediavine.com/%' and (route).redirect_code=301 from public.resolve_site_route('/ads.txt')),'external 301');
select pg_temp.route_assert(not exists(select from public.resolve_site_route('/minecraft/wiki')),'bare Minecraft is not redirected');
select pg_temp.route_assert((select resolved_target='/minecraft/java/wiki/mobs/page/2' and (route).redirect_code=308 from public.resolve_site_route('/minecraft/wiki/mobs/page/2')),'Minecraft arbitrary tail');
select pg_temp.route_assert((select resolved_target='/minecraft/bedrock/wiki/achievements/page/2' from public.resolve_site_route('/minecraft/wiki/achievements/page/2')),'longest prefix');
select pg_temp.route_assert((select resolved_target='/minecraft/java/wiki/achievements-other' from public.resolve_site_route('/minecraft/wiki/achievements-other')),'segment boundary');
select pg_temp.route_assert((select resolved_target='/stats' from public.resolve_site_route('/lists/unknown/deeper')),'unknown lists');
select pg_temp.route_assert((select resolved_target='/stats' from public.resolve_site_route('/lists')),'bare lists');
select pg_temp.route_assert((select resolved_target='/stats/games?genre=Action&subgenre=Battlegrounds+%26+Fighting' from public.resolve_site_route('/lists/top-trending-roblox-battlegrounds-fighting-games/extra')),'known list query and ignored extra segments');
select pg_temp.route_assert((select resolved_target='/catalog/free-roblox-items' from public.resolve_site_route('/catalog/free-roblox-items/categories')),'free items base');
select pg_temp.route_assert((select resolved_target='/catalog/free-roblox-items/hair' from public.resolve_site_route('/catalog/free-roblox-items/categories/hair')),'free category');
select pg_temp.route_assert((select resolved_target='/catalog/free-roblox-items/hair/short' from public.resolve_site_route('/catalog/free-roblox-items/categories/hair/short')),'free subcategory');
select pg_temp.route_assert((select resolved_target='/catalog/free-roblox-items/hair/page/2' from public.resolve_site_route('/catalog/free-roblox-items/categories/hair/page/02junk')),'parseInt category');
select pg_temp.route_assert((select resolved_target='/catalog/free-roblox-items/hair/short/page/1' from public.resolve_site_route('/catalog/free-roblox-items/categories/hair/short/page/-2')),'page fallback subcategory');
select pg_temp.route_assert(not exists(select from public.resolve_site_route('/catalog/free-roblox-items/categories/a/b/c')),'unsupported folder does not redirect');
select pg_temp.route_assert(public.site_catalog_path('roblox-items-and-bundles/roblox-accessories/hair-accessories')='/catalog/roblox-items-and-bundles/roblox-accessories/hair-accessories','avatar configured child');
select pg_temp.route_assert(public.site_catalog_path('the-forge-missing') is null,'unproven catalog excluded');

-- Published retired rows must not mask the Next prefix at its exact base.
select pg_temp.route_assert(public.site_catalog_path('roblox-music-ids/games/work-at-a-pizza-place') is null,'retired catalog excluded');
select pg_temp.route_assert((select resolved_target='/catalog/roblox-music-ids' from public.resolve_site_route('/catalog/roblox-music-ids/games/work-at-a-pizza-place')),'retired base redirects despite published row');
select pg_temp.route_assert((select page_id='00000000-0000-0000-0000-000000000021' from public.site_routes where path='/catalog/free-roblox-items'),'canonical catalog wins backfill with legacy UUID first');
savepoint catalog_precedence;
update public.catalog_pages set code=code where code='roblox-free-items';
select pg_temp.route_assert((select page_id='00000000-0000-0000-0000-000000000021' from public.site_routes where path='/catalog/free-roblox-items'),'legacy update keeps canonical');
delete from public.catalog_pages where code='free-roblox-items';
select pg_temp.route_assert((select page_id='00000000-0000-0000-0000-000000000020' from public.site_routes where path='/catalog/free-roblox-items'),'delete canonical restores fallback');
insert into public.catalog_pages(id,code) values('00000000-0000-0000-0000-000000000021','free-roblox-items');
select pg_temp.route_assert((select page_id='00000000-0000-0000-0000-000000000021' from public.site_routes where path='/catalog/free-roblox-items'),'canonical insert supersedes fallback');
update public.catalog_pages set code='free-roblox-items/hair' where code='free-roblox-items';
select pg_temp.route_assert((select page_id='00000000-0000-0000-0000-000000000020' from public.site_routes where path='/catalog/free-roblox-items'),'canonical rename restores fallback');
insert into public.catalog_pages(code) values('roblox-free-items/hair');
select pg_temp.route_assert((select page_id='00000000-0000-0000-0000-000000000021' from public.site_routes where path='/catalog/free-roblox-items/hair'),'legacy insert preserves canonical category');
delete from public.catalog_pages where code='roblox-free-items/hair';
update public.catalog_pages set code='free-roblox-items/hats' where code='free-roblox-items/hair';
select pg_temp.route_assert((select resolved_target='/catalog/free-roblox-items/hats' from public.resolve_site_route('/catalog/free-roblox-items/hair')),'catalog rename preserves page-linked redirect without fallback');
rollback to catalog_precedence;
select pg_temp.route_assert(not exists(select from public.expected_site_routes where page_table='catalog_pages' and page_id='00000000-0000-0000-0000-000000000020' and path='/catalog/free-roblox-items'),'fallback omitted from expected ownership');

-- Migration was committed by the harness. These savepoints release locks from
-- each probe so a preceding route write cannot hide an accidental acquisition.
create function pg_temp.route_lock_held() returns boolean language sql as $$
 select exists(select from pg_catalog.pg_locks
  where locktype='advisory' and pid=pg_backend_pid() and granted
   and classid=(7823462194301::bigint >> 32)::oid
   and objid=(7823462194301::bigint & 4294967295)::oid and objsubid=1)
$$;
select pg_temp.route_assert(not pg_temp.route_lock_held(),'fresh transaction has no route lock');
-- Check both trigger column lists against the mapping contract, including owner
-- IDs, and require a WHEN guard on every row-level UPDATE trigger.
do $$ declare t text; expected text[]; actual text[]; trigger_name text; begin
 foreach t in array array['code_pages','wiki_pages','wiki_collection_pages','quiz_pages','checklist_pages','tools','events_pages','articles','catalog_pages','puzzle_pages','game_wiki_pages','game_collection_pages','game_code_pages','game_tool_pages','game_checklist_pages','game_map_pages','game_quiz_pages','game_catalog_pages','games'] loop
  expected:=case
   when t='code_pages' then array['id','slug','old_slugs']
   when t='wiki_collection_pages' then array['id','wiki_slug','collection_slug']
   when t='games' then array['id','namespace','parent_id']
   when t like 'game\_%' escape '\' then array['id','canonical_path','game_id']
   when t in ('quiz_pages','tools','catalog_pages') then array['id','code']
   else array['id','slug'] end;
  foreach trigger_name in array array['site_route_write_lock','site_route_sync_update'] loop
   select array_agg(a.attname::text order by c.ordinality) into actual
    from pg_trigger tr cross join lateral unnest(tr.tgattr::smallint[]) with ordinality c(attnum,ordinality)
    join pg_attribute a on a.attrelid=tr.tgrelid and a.attnum=c.attnum
    where tr.tgrelid=('public.'||t)::regclass and tr.tgname=trigger_name;
   perform pg_temp.route_assert(actual=expected,'exact UPDATE columns for '||t||'/'||trigger_name);
  end loop;
  perform pg_temp.route_assert(exists(select from pg_trigger where tgrelid=('public.'||t)::regclass and tgname='site_route_sync_update' and tgqual is not null),'WHEN guard for '||t);
 end loop;
end $$;

savepoint unrelated_updates;
create temporary table route_before as select ctid::text tuple_id,to_jsonb(r) contents from public.site_routes r;
-- A sentinel makes ANY attempted hub restore fail, even if it would change no row.
create or replace function public.restore_site_hubs(p_namespace text) returns void
language plpgsql security definer set search_path='' as $$
begin raise exception 'Unrelated update called restore_site_hubs(%)',p_namespace; end $$;
do $$ declare t text; begin
 foreach t in array array['code_pages','wiki_pages','wiki_collection_pages','quiz_pages','checklist_pages','tools','events_pages','articles','catalog_pages','puzzle_pages','game_wiki_pages','game_collection_pages','game_code_pages','game_tool_pages','game_checklist_pages','game_map_pages','game_quiz_pages','game_catalog_pages','games'] loop
  execute format('update public.%I set is_published=true',t);
  perform pg_temp.route_assert(not pg_temp.route_lock_held(),'unrelated UPDATE takes no lock: '||t);
 end loop;
end $$;
-- Collection runtime publication changes a dataset pointer, not its URL.
update public.game_collection_pages set dataset_revision_id=gen_random_uuid();
select pg_temp.route_assert(not pg_temp.route_lock_held(),'collection dataset update takes no lock');
select pg_temp.route_assert(not exists(
 (select ctid::text,to_jsonb(r) from public.site_routes r except select * from route_before)
 union all (select * from route_before except select ctid::text,to_jsonb(r) from public.site_routes r)
),'unrelated updates do not rewrite route tuples or values');
rollback to unrelated_updates;

savepoint no_op_route_update;
create temporary table route_before as select ctid::text tuple_id,to_jsonb(r) contents from public.site_routes r;
update public.code_pages set slug=slug;
select pg_temp.route_assert(pg_temp.route_lock_held(),'SET of route column locks before rows even if unchanged');
select pg_temp.route_assert(not exists(
 (select ctid::text,to_jsonb(r) from public.site_routes r except select * from route_before)
 union all (select * from route_before except select ctid::text,to_jsonb(r) from public.site_routes r)
),'WHEN prevents route rewrites for unchanged route values');
rollback to no_op_route_update;

savepoint changed_route_update;
update public.code_pages set old_slugs=array_append(old_slugs,'route-column-alias') where slug='slap-battles';
select pg_temp.route_assert(pg_temp.route_lock_held(),'changed route column acquires lock');
select pg_temp.route_assert(exists(select from public.site_routes where path='/codes/route-column-alias'),'old_slugs-only change syncs');
rollback to changed_route_update;

-- Spy on hub calls while retaining the actual helper, then roll all probes back.
savepoint hub_probes;
create temporary table hub_calls(namespace text);
do $$ declare definition text; begin
 select pg_get_functiondef('public.restore_site_hubs(text)'::regprocedure) into definition;
 execute replace(definition,E'begin\n',E'begin\n insert into pg_temp.hub_calls values(p_namespace);\n');
end $$;
insert into public.games(id,namespace) values('00000000-0000-0000-0000-000000000011','other-fixture');
insert into public.game_collection_pages(id,game_id,canonical_path)
 values('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000002','/fixture-game/collection');
update public.game_collection_pages set dataset_revision_id=gen_random_uuid() where id='00000000-0000-0000-0000-000000000012';
update public.game_collection_pages set canonical_path=canonical_path where id='00000000-0000-0000-0000-000000000012';
update public.game_collection_pages set game_id='00000000-0000-0000-0000-000000000011' where id='00000000-0000-0000-0000-000000000012';
select pg_temp.route_assert(not exists(select from hub_calls),'insert, dataset, no-op path and owner-only update skip hub restore');
select pg_temp.route_assert((select game_id='00000000-0000-0000-0000-000000000011' from public.site_routes where path='/fixture-game/collection'),'game_id-only change syncs owner');
update public.game_wiki_pages set canonical_path='/fixture-game/wiki' where canonical_path='/fixture-game';
select pg_temp.route_assert((select array_agg(namespace)=array['fixture-game'] from hub_calls),'root move restores only vacated namespace');
select pg_temp.route_assert((select status='live' and page_type='hub' from public.site_routes where path='/fixture-game'),'moved root restores hub');
insert into public.game_wiki_pages(game_id,canonical_path) values('00000000-0000-0000-0000-000000000002','/fixture-game');
select pg_temp.route_assert((select status='live' and page_type='wiki' from public.site_routes where path='/fixture-game'),'new stored root replaces synthetic hub');
truncate hub_calls;
delete from public.game_wiki_pages where canonical_path='/fixture-game';
select pg_temp.route_assert((select array_agg(namespace)=array['fixture-game'] from hub_calls),'root delete restores only vacated namespace');
truncate hub_calls;
update public.games set namespace='renamed-fixture' where namespace='other-fixture';
select pg_temp.route_assert((select status='old' from public.site_routes where path='/other-fixture'),'game namespace change retains old path');
select pg_temp.route_assert((select status='live' from public.site_routes where path='/renamed-fixture'),'game namespace change syncs new hub');
update public.games set parent_id='00000000-0000-0000-0000-000000000002' where namespace='renamed-fixture';
select pg_temp.route_assert((select status='gone' from public.site_routes where path='/renamed-fixture'),'parent change removes synthetic root');
-- Deleting an ordinary collection cannot uncover a bare root.
truncate hub_calls;
delete from public.game_collection_pages where id='00000000-0000-0000-0000-000000000012';
select pg_temp.route_assert(not exists(select from hub_calls),'non-root collection delete skips restore');
rollback to hub_probes;

-- Real row triggers: insert, rename, rename back, repeated upsert, delete/reinsert.
insert into public.code_pages(id,slug,old_slugs) values('00000000-0000-0000-0000-000000000003','trigger-first',array['new-old-alias']);
update public.code_pages set slug='trigger-second' where id='00000000-0000-0000-0000-000000000003';
select pg_temp.route_assert((select resolved_target='/codes/trigger-second' from public.resolve_site_route('/codes/trigger-first')),'rename follows current live path');
select pg_temp.route_assert((select moved_at is not null from public.site_routes where path='/codes/trigger-first'),'move timestamp');
select pg_temp.route_assert((select resolved_target='/codes/trigger-second' from public.resolve_site_route('/codes/new-old-alias')),'new old_slugs kept in sync');
update public.code_pages set slug='trigger-first' where id='00000000-0000-0000-0000-000000000003';
insert into public.code_pages(id,slug) values('00000000-0000-0000-0000-000000000003','trigger-first') on conflict(id) do update set slug=excluded.slug;
select pg_temp.route_assert((select status='live' and moved_at is null from public.site_routes where path='/codes/trigger-first'),'rename back and upsert');
select pg_temp.route_assert((select count(*)=1 from public.site_routes where page_id='00000000-0000-0000-0000-000000000003' and status='live'),'one live per owner');
delete from public.code_pages where id='00000000-0000-0000-0000-000000000003';
select pg_temp.route_assert((select status='gone' from public.site_routes where path='/codes/trigger-first'),'delete gone');
select pg_temp.route_assert((select resolved_target is null from public.resolve_site_route('/codes/trigger-second')),'deleted target not resolved');
insert into public.code_pages(slug) values('trigger-first');
select pg_temp.route_assert(exists(select from public.site_route_conflicts where path='/codes/trigger-first' and reason='Live page took over old/gone route'),'deleted page replacement logged');
do $$ begin
 begin
  insert into public.code_pages(slug) values('trigger-first');
  raise exception 'live clash did not raise';
 exception when unique_violation then null;
 end;
end $$;
-- Live takes over redirect (the root code alias /bikeworld-codes).
insert into public.game_tool_pages(game_id,canonical_path) values('00000000-0000-0000-0000-000000000002','/bikeworld-codes');
select pg_temp.route_assert(exists(select from public.site_route_conflicts where path='/bikeworld-codes'),'redirect takeover logged');
-- An exact live page wins over a broader redirect prefix.
insert into public.game_map_pages(game_id,canonical_path) values('00000000-0000-0000-0000-000000000002','/lists/a-real-page');
select pg_temp.route_assert((select (route).status='live' from public.resolve_site_route('/lists/a-real-page')),'exact wins');
delete from public.game_wiki_pages where canonical_path='/fixture-game';
select pg_temp.route_assert((select status='live' and page_type='hub' from public.site_routes where path='/fixture-game'),'deleted root restores hub');

-- Every routed page table has an active trigger and correct identity mapping.
do $$ declare t text; kind text; r record; begin
 foreach t in array array['wiki_pages','wiki_collection_pages','quiz_pages','checklist_pages','tools','events_pages','articles','catalog_pages','puzzle_pages','game_wiki_pages','game_collection_pages','game_code_pages','game_tool_pages','game_checklist_pages','game_map_pages','game_quiz_pages','game_catalog_pages'] loop
  execute format('insert into public.%I(slug,code,wiki_slug,collection_slug,canonical_path,game_id) values($1,$1,$1,$1,$2,$3)',t)
   using 'test-'||t,'/fixture-game/test-'||t,'00000000-0000-0000-0000-000000000002'::uuid;
  select * into r from public.expected_site_routes where page_table=t and path like '%test-'||t||'%';
  perform pg_temp.route_assert(exists(select from public.site_routes where path=r.path and page_id=r.page_id and status='live'),'insert trigger for '||t);
 end loop;
end $$;
select pg_temp.route_assert((public.site_routes_report()->>'code_old_slugs_added')::int>=1,'report old slug count');
select pg_temp.route_assert(jsonb_array_length(public.site_routes_report()->'unmapped_catalogs')=2,'report excluded catalogs');
select pg_temp.route_assert(jsonb_array_length(public.site_routes_report()->'orphaned_redirects')>=1,'report deleted-page redirects');
select pg_temp.route_assert(not has_table_privilege('anon','public.site_routes','SELECT'),'no anon routes read');
select pg_temp.route_assert(not has_table_privilege('authenticated','public.site_route_conflicts','SELECT'),'no authenticated conflict read');
select pg_temp.route_assert(not has_function_privilege('anon','public.resolve_site_route(text)','EXECUTE'),'no anon RPC');
select pg_temp.route_assert(not has_function_privilege('authenticated','public.sync_site_catalog_route(text)','EXECUTE'),'no public catalog reconciliation');
select pg_temp.route_assert(not has_function_privilege('authenticated','public.claim_site_route(jsonb,boolean)','EXECUTE'),'no authenticated writes');
select pg_temp.route_assert(has_function_privilege('service_role','public.resolve_site_route(text)','EXECUTE'),'service RPC granted');
select pg_temp.route_assert((select relrowsecurity from pg_class where oid='public.site_routes'::regclass),'RLS on');
select pg_temp.route_assert(not exists(select from pg_policies where tablename in ('site_routes','site_route_conflicts')),'no public policies');
