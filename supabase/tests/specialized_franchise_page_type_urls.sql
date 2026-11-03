-- Uses the same disposable PostgreSQL harness and pg_temp.url_assert as the
-- generic URL contract. Never execute against managed development/production.
do $$ declare ns text; rid uuid; child uuid; wid uuid; begin
 foreach ns in array array['gta','red-dead'] loop
  insert into public.games(namespace,slug,kind,url_style) values(ns,ns,'franchise','namespace') returning id into rid;
  insert into public.games(namespace,slug,parent_id) values(ns,ns||'-fixture',rid) returning id into child;
  insert into public.game_wiki_pages(namespace,game_id,slug) values(ns,rid,ns||'-hub');
  insert into public.game_wiki_pages(namespace,game_id,slug) values(ns,child,ns||'-fixture') returning id into wid;
  insert into public.game_collection_pages(namespace,game_id,wiki_page_id,wiki_slug,collection_slug) values(ns,child,wid,ns||'-fixture','items');
  if ns='gta' then
   insert into public.game_map_pages(namespace,game_id,slug) values(ns,child,'gta5');
   insert into public.game_checklist_pages(namespace,game_id,slug) values(ns,child,'gta-fixture');
  end if;
  perform public.move_game_namespace_to_page_type_urls(ns);
  perform pg_temp.url_assert((select resolved_target='/games/'||ns from public.resolve_site_route('/'||ns||'/wiki')),'franchise root alias '||ns);
  perform pg_temp.url_assert((select resolved_target='/wiki/'||ns||'-fixture/items/page/3' from public.resolve_site_route('/'||ns||'/wiki/'||ns||'-fixture/items/page/3')),'specialist pagination '||ns);
  perform pg_temp.url_assert((public.move_game_namespace_to_page_type_urls(ns)->>'pages_moved')::int=0,'specialist idempotence '||ns);
 end loop;
end $$;
select pg_temp.url_assert((select resolved_target='/maps/gta5' from public.resolve_site_route('/gta/maps/gta5')),'GTA5 exact alias');
select pg_temp.url_assert((select page_id is not null and status='old' from public.site_routes where path='/gta/maps'),'map directory page linked');

-- Complete the Minecraft identities created by the generic fixture. The live
-- fixture starts with the legacy child published, as allowed by the move.
insert into public.game_wiki_pages(namespace,game_id,slug) values('minecraft','70000000-0000-0000-0000-000000000001','minecraft-hub');
insert into public.game_tool_pages(namespace,game_id,slug) values('minecraft','70000000-0000-0000-0000-000000000001','nether-portal-calculator');
insert into public.game_collection_pages(namespace,game_id,wiki_page_id,wiki_slug,collection_slug)
select 'minecraft',w.game_id,w.id,w.slug,slugs.slug
from public.game_wiki_pages w cross join lateral (
 select 'achievements' slug where w.slug in ('minecraft','minecraft-bedrock')
 union all select case when w.slug='minecraft-bedrock' and n=23 then 'bedrock-only' else 'entry-'||n end from generate_series(1,case when w.slug='minecraft-java' then 24 else 23 end) n
 union all select 'legacy-only' where w.slug='minecraft'
) slugs where w.slug in ('minecraft','minecraft-java','minecraft-bedrock');
create temp table legacy_snapshot as select to_jsonb(c) row from public.game_collection_pages c where wiki_slug='minecraft';
create temp table legacy_wiki_snapshot as select to_jsonb(w) row from public.game_wiki_pages w where game_id='70000000-0000-0000-0000-000000000004';
create temp table legacy_game_snapshot as select to_jsonb(g) row from public.games g where id='70000000-0000-0000-0000-000000000004';
select pg_temp.url_assert((select is_published from public.games where id='70000000-0000-0000-0000-000000000004'),'legacy starts published');
-- An unexpected count must also fail without changing rows or routes.
delete from public.game_collection_pages where wiki_slug='minecraft' and collection_slug='legacy-only';
do $$ begin
 begin perform public.move_game_namespace_to_page_type_urls('minecraft'); raise exception 'expected count refusal';
 exception when others then if sqlerrm<>'Unexpected Minecraft legacy shape' then raise; end if; end;
end $$;
insert into public.game_collection_pages select (jsonb_populate_record(null::public.game_collection_pages,row)).* from legacy_snapshot where row->>'collection_slug'='legacy-only';
-- Both edition counts remain strict. Roll back each deliberate malformed
-- fixture, including DELETE's route effects, before testing the next edition.
do $$ declare edition text; begin
 foreach edition in array array['minecraft-java','minecraft-bedrock'] loop
  begin
   delete from public.game_collection_pages where wiki_slug=edition and collection_slug='entry-1';
   begin perform public.move_game_namespace_to_page_type_urls('minecraft'); raise exception 'expected edition count refusal';
   exception when others then if sqlerrm<>'Unexpected Minecraft legacy shape: edition count' then raise; end if; end;
   perform pg_temp.url_assert((select is_published from public.games where id='70000000-0000-0000-0000-000000000004'),'edition refusal preserves legacy publication');
   raise exception using errcode='PT002', message='restore edition fixture';
  exception when sqlstate 'PT002' then null; end;
 end loop;
end $$;
update public.game_collection_pages set is_published=false where wiki_slug='minecraft-bedrock' and collection_slug='achievements';
do $$ begin
 begin perform public.move_game_namespace_to_page_type_urls('minecraft'); raise exception 'expected missing achievements target refusal';
 exception when others then if sqlerrm<>'Unexpected Minecraft legacy shape' then raise; end if; end;
end $$;
update public.game_collection_pages set is_published=true where wiki_slug='minecraft-bedrock' and collection_slug='achievements';
select pg_temp.url_assert((select bool_and(url_style='namespace') from public.games where namespace='minecraft'),'shape refusals preserve URL styles');
select pg_temp.url_assert((select to_jsonb(g)=s.row from public.games g cross join legacy_game_snapshot s where g.id='70000000-0000-0000-0000-000000000004'),'shape refusals preserve published legacy game');
-- A collision occurs after archival starts. The failed move must restore the
-- published legacy game as well as the namespace paths and registry.
do $$ declare routes_before jsonb; begin
 begin
  insert into public.wiki_pages(slug) values('minecraft-java');
  select jsonb_agg(to_jsonb(r) order by path) into routes_before from public.site_routes r;
  begin perform public.move_game_namespace_to_page_type_urls('minecraft'); raise exception 'expected edition route collision';
  exception when unique_violation then
   if sqlerrm not like 'Site route /wiki/minecraft-java is live for roblox/wiki/%; cannot assign to game/wiki/%' then raise; end if;
  end;
  perform pg_temp.url_assert((select to_jsonb(g)=s.row from public.games g cross join legacy_game_snapshot s where g.id='70000000-0000-0000-0000-000000000004'),'collision restores published legacy game');
  perform pg_temp.url_assert((select bool_and(url_style='namespace') from public.games where namespace='minecraft'),'collision restores namespace styles');
  perform pg_temp.url_assert((select to_jsonb(w)=s.row from public.game_wiki_pages w cross join legacy_wiki_snapshot s where w.game_id='70000000-0000-0000-0000-000000000004'),'collision preserves legacy wiki');
  perform pg_temp.url_assert((select jsonb_agg(to_jsonb(r) order by path)=routes_before from public.site_routes r),'collision restores registry');
  raise exception using errcode='PT002', message='remove collision fixture';
 exception when sqlstate 'PT002' then null; end;
end $$;
-- Prove the production starting state as well. This successful move is rolled
-- back deliberately so the final move exercises the published starting state.
do $$ begin
 begin
  update public.games set is_published=false where id='70000000-0000-0000-0000-000000000004';
  perform public.move_game_namespace_to_page_type_urls('minecraft');
  perform pg_temp.url_assert((select not is_published and url_style='page_type' from public.games where id='70000000-0000-0000-0000-000000000004'),'unpublished legacy moves successfully');
  perform pg_temp.url_assert((select resolved_target='/wiki/minecraft-bedrock/achievements/page/7' from public.resolve_site_route('/minecraft/wiki/achievements/page/7')),'unpublished legacy achievements alias');
  perform pg_temp.url_assert((public.move_game_namespace_to_page_type_urls('minecraft')->>'pages_moved')::int=0,'unpublished legacy move idempotent');
  raise exception using errcode='PT002', message='restore published fixture';
 exception when sqlstate 'PT002' then null; end;
end $$;
select pg_temp.url_assert((select is_published and url_style='namespace' from public.games where id='70000000-0000-0000-0000-000000000004'),'published fixture restored');
select public.move_game_namespace_to_page_type_urls('minecraft');
select pg_temp.url_assert((select not is_published and url_style='page_type' from public.games where id='70000000-0000-0000-0000-000000000004'),'published legacy is archived during move');
select pg_temp.url_assert((select to_jsonb(g)-'is_published'-'url_style'=s.row-'is_published'-'url_style' from public.games g cross join legacy_game_snapshot s where g.id='70000000-0000-0000-0000-000000000004'),'legacy game changes only publication and URL style');
select pg_temp.url_assert((select to_jsonb(w)=s.row from public.game_wiki_pages w cross join legacy_wiki_snapshot s where w.game_id='70000000-0000-0000-0000-000000000004'),'legacy wiki byte-for-byte preserved');
select pg_temp.url_assert((select count(*)=25 from public.game_collection_pages where wiki_slug='minecraft'),'legacy count retained');
select pg_temp.url_assert(not exists(
 select 1 from legacy_snapshot s full join (select to_jsonb(c) row from public.game_collection_pages c where wiki_slug='minecraft') c using(row) where s.row is null or c.row is null
),'legacy rows byte-for-byte preserved');
select pg_temp.url_assert(not exists(select 1 from public.site_routes where game_id='70000000-0000-0000-0000-000000000004' and status='live'),'hidden legacy gets no live routes');
select pg_temp.url_assert(not exists(select 1 from public.expected_site_routes where game_id='70000000-0000-0000-0000-000000000004'),'audit excludes archived owners');
select pg_temp.url_assert((select resolved_target=expected from public.resolve_site_route(path)),'Minecraft one-hop '||path)
from (values
 ('/minecraft','/games/minecraft'),('/minecraft/wiki','/games/minecraft'),
 ('/minecraft/wiki/legacy-minecraft','/games/minecraft'),
 ('/minecraft/java/wiki','/wiki/minecraft-java'),('/minecraft/bedrock/wiki','/wiki/minecraft-bedrock'),
 ('/minecraft/tools','/games/minecraft'),
 ('/minecraft/tools/nether-portal-calculator','/tools/minecraft-nether-portal-calculator'),
 ('/minecraft/wiki/achievements','/wiki/minecraft-bedrock/achievements'),
 ('/minecraft/wiki/achievements/page/7','/wiki/minecraft-bedrock/achievements/page/7'),
 ('/minecraft/wiki/entry-1','/wiki/minecraft-java/entry-1'),
 ('/minecraft/wiki/entry-24','/wiki/minecraft-java/entry-24'),
 ('/minecraft/wiki/legacy-only','/games/minecraft'),
 ('/minecraft/wiki/bedrock-only','/wiki/minecraft-bedrock/bedrock-only')
) aliases(path,expected);
select pg_temp.url_assert(not exists(select 1 from public.site_routes old join public.site_routes next on next.path=public.site_route_target(old,old.path) where old.path like '/minecraft/%' and old.status='old' and next.status<>'live'),'Minecraft aliases have final live destinations');
select pg_temp.url_assert((public.move_game_namespace_to_page_type_urls('minecraft')->>'pages_moved')::int=0,'Minecraft idempotence');
do $$ begin
 begin update public.games set is_published=true where id='70000000-0000-0000-0000-000000000004'; raise exception 'expected republish refusal';
 exception when others then if sqlerrm<>'Legacy Minecraft must remain unpublished' then raise; end if; end;
end $$;
