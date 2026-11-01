create function pg_temp.url_assert(ok boolean, msg text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception '%',msg; end if; end $$;
insert into public.games(id,namespace,slug,url_style) values('10000000-0000-0000-0000-000000000001','url-fixture','url-fixture','namespace');
insert into public.game_wiki_pages(id,namespace,game_id,slug,description_md) values('10000000-0000-0000-0000-000000000002','url-fixture','10000000-0000-0000-0000-000000000001','url-fixture','[Items](/url-fixture/wiki/items) [Other](/url-fixture/wiki/items-other)');
insert into public.game_collection_pages(namespace,game_id,wiki_page_id,wiki_slug,collection_slug) values('url-fixture','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','url-fixture','items');
select pg_temp.url_assert(public.expected_game_page_path('10000000-0000-0000-0000-000000000001','tool','calculator')='/url-fixture/tools/calculator','namespace tool');
insert into public.game_quiz_pages(namespace,game_id,slug) values('url-fixture','10000000-0000-0000-0000-000000000001','knowledge');
create temp table url_move_result as select public.move_game_namespace_to_page_type_urls('url-fixture') result;
select pg_temp.url_assert((select result->>'pages_moved'='3' and result->>'fields_rewritten'='0' and result->>'row_field_updates'='0' from url_move_result),'exact move and rewrite counts');
select pg_temp.url_assert((select resolved_target='/wiki/url-fixture' from public.resolve_site_route('/url-fixture/quizzes')),'existing directory alias');
select pg_temp.url_assert((select canonical_path='/wiki/url-fixture' from public.game_wiki_pages where namespace='url-fixture'),'moved wiki');
select pg_temp.url_assert((select resolved_target='/wiki/url-fixture/items/page/2' from public.resolve_site_route('/url-fixture/wiki/items/page/2')),'SQL pagination');
select pg_temp.url_assert((select resolved_target='/wiki/url-fixture' from public.resolve_site_route('/url-fixture')),'root alias');
select pg_temp.url_assert(public.expected_game_page_path('10000000-0000-0000-0000-000000000001','tool','calculator')='/tools/url-fixture-calculator','tool prefix');
select pg_temp.url_assert(public.expected_game_page_path('10000000-0000-0000-0000-000000000001','catalog','url-fixture-items')='/catalog/url-fixture-items','no double prefix');
select pg_temp.url_assert((public.move_game_namespace_to_page_type_urls('url-fixture')->>'pages_moved')::int=0,'idempotent');
select pg_temp.url_assert((select description_md like '%](/url-fixture/wiki/items)%' from public.game_wiki_pages where namespace='url-fixture'),'route move leaves content untouched');
select public.rewrite_moved_game_links('url-fixture');
select pg_temp.url_assert((select description_md like '%](/wiki/url-fixture/items)%' from public.game_wiki_pages where namespace='url-fixture'),'markdown rewritten');
insert into public.game_tool_pages(namespace,game_id,slug) values('url-fixture','10000000-0000-0000-0000-000000000001','calculator');
select pg_temp.url_assert((select canonical_path='/tools/url-fixture-calculator' from public.game_tool_pages where namespace='url-fixture'),'publisher insert moved');
do $$ begin
 begin perform public.move_game_namespace_to_page_type_urls('unknown-url-fixture'); raise exception 'expected unknown rejection'; exception when no_data_found then raise; when others then if sqlerrm not like 'Unknown game namespace:%' then raise; end if; end;
 begin update public.game_tool_pages set canonical_path='/wrong' where namespace='url-fixture'; raise exception 'expected guard'; exception when others then if sqlerrm not like 'Page route does not match%' then raise; end if; end;
end $$;
-- New roots default to page_type; child inserts inherit their franchise.
insert into public.games(id,namespace,slug,kind,url_style) values('20000000-0000-0000-0000-000000000001','franchise-fixture','franchise-fixture','franchise','namespace');
insert into public.games(id,namespace,slug,kind,parent_id) values('20000000-0000-0000-0000-000000000002','franchise-fixture','franchise-fixture','game','20000000-0000-0000-0000-000000000001');
select pg_temp.url_assert((select url_style='namespace' from public.games where id='20000000-0000-0000-0000-000000000002'),'child inherits style');
insert into public.game_wiki_pages(namespace,game_id,slug) values('franchise-fixture','20000000-0000-0000-0000-000000000001','franchise-fixture'),('franchise-fixture','20000000-0000-0000-0000-000000000002','legacy-child');
select pg_temp.url_assert((select canonical_path='/franchise-fixture/wiki/legacy-child' from public.game_wiki_pages where game_id='20000000-0000-0000-0000-000000000002'),'namespace permanent wiki slug');
select public.move_game_namespace_to_page_type_urls('franchise-fixture');
select pg_temp.url_assert(public.expected_game_page_path('20000000-0000-0000-0000-000000000001','wiki')='/games/franchise-fixture','franchise main');
select pg_temp.url_assert(public.expected_game_page_path('20000000-0000-0000-0000-000000000002','wiki','legacy-child')='/wiki/franchise-fixture','same-slug child distinct from franchise');
select pg_temp.url_assert(public.expected_game_page_path('20000000-0000-0000-0000-000000000002','code','unused')='/codes/franchise-fixture','codes use game identity');
select pg_temp.url_assert(public.expected_game_page_path('20000000-0000-0000-0000-000000000002','map','world')='/maps/world','map');
select pg_temp.url_assert(public.expected_game_page_path('20000000-0000-0000-0000-000000000002','quiz','knowledge')='/quizzes/knowledge','quiz');
select pg_temp.url_assert(public.expected_game_page_path('20000000-0000-0000-0000-000000000002','checklist','completion')='/checklists/completion','checklist');
insert into public.games(id,namespace,slug) values('30000000-0000-0000-0000-000000000001','new-fixture','new-fixture');
select pg_temp.url_assert((select url_style='page_type' from public.games where namespace='new-fixture'),'new root default');
insert into public.games(id,namespace,slug,url_style) values('30000000-0000-0000-0000-000000000002','unmoved-fixture','unmoved-fixture','namespace');
insert into public.game_tool_pages(namespace,game_id,slug) values('unmoved-fixture','30000000-0000-0000-0000-000000000002','calculator');
select pg_temp.url_assert((select canonical_path='/unmoved-fixture/tools/calculator' from public.game_tool_pages where namespace='unmoved-fixture'),'publisher insert unmoved');
-- Text/JSON rewrites keep object keys and suffix slugs intact.
select pg_temp.url_assert(public.rewrite_game_url_links('{"/old/wiki":"/old/wiki/items-other","items":["/old/wiki/items?x=1","https://example.com/old/wiki/items"]}'::jsonb,'{"/old/wiki/items":"/wiki/new/items"}'::jsonb)='{"/old/wiki":"/old/wiki/items-other","items":["/wiki/new/items?x=1","https://example.com/old/wiki/items"]}'::jsonb,'JSON values, internal URLs and path boundaries');

-- Every page type has both style contracts, including a single-game root.
select pg_temp.url_assert(public.expected_game_page_path('30000000-0000-0000-0000-000000000002',kind,slug)=expected,'namespace '||kind)
from (values ('hub',null,'/unmoved-fixture'),('wiki',null,'/unmoved-fixture/wiki'),('code',null,'/unmoved-fixture/codes'),('tool','calc','/unmoved-fixture/tools/calc'),('quiz','quiz','/unmoved-fixture/quizzes/quiz'),('map','map','/unmoved-fixture/maps/map'),('catalog','items','/unmoved-fixture/catalog/items'),('checklist','tasks','/unmoved-fixture/checklists/tasks')) cases(kind,slug,expected);
insert into public.game_wiki_pages(namespace,game_id,slug) values('new-fixture','30000000-0000-0000-0000-000000000001','new-fixture');
insert into public.game_tool_pages(namespace,game_id,slug) values('new-fixture','30000000-0000-0000-0000-000000000001','calculator');
select pg_temp.url_assert((select canonical_path='/tools/new-fixture-calculator' from public.game_tool_pages where namespace='new-fixture'),'publisher new namespace');

do $$ declare ns text; begin
 foreach ns in array array['gta','red-dead','minecraft'] loop
  begin
   perform public.move_game_namespace_to_page_type_urls(ns);
   raise exception 'expected renderer refusal';
  exception when others then
   if sqlerrm not like 'Namespace % cannot move until its GTA/Red Dead/Minecraft renderer follow-up PR' then raise; end if;
  end;
 end loop;
 begin
  perform public.move_game_namespace_to_page_type_urls('unmoved-fixture');
  raise exception 'expected root wiki prerequisite';
 exception when others then if sqlerrm not like 'Namespace needs a root wiki before moving:%' then raise; end if; end;
 begin
  update public.games set url_style='page_type' where namespace='unmoved-fixture';
  raise exception 'expected ordinary style write rejection';
 exception when others then if sqlerrm not like 'Change URL style only through%' then raise; end if; end;
 begin
  update public.game_tool_pages set slug='changed' where namespace='url-fixture';
  raise exception 'expected slug permanence';
 exception when others then if sqlerrm not like 'Page %' then raise; end if; end;
 begin
  perform public.expected_game_page_path('20000000-0000-0000-0000-000000000001','collection','items');
  raise exception 'expected franchise collection refusal';
 exception when others then if sqlerrm<>'Franchise roots cannot own collections' then raise; end if; end;
end $$;

-- A live Roblox owner causes the entire move to roll back, including its style.
insert into public.games(id,namespace,slug,url_style) values('40000000-0000-0000-0000-000000000001','clash-fixture','clash-fixture','namespace');
insert into public.game_wiki_pages(namespace,game_id,slug) values('clash-fixture','40000000-0000-0000-0000-000000000001','clash-fixture');
insert into public.wiki_pages(slug) values('clash-fixture');
create temp table clash_snapshot as select
 (select jsonb_agg(to_jsonb(g) order by id) from public.games g) games,
 (select jsonb_agg(to_jsonb(p) order by id) from public.game_wiki_pages p) pages,
 (select jsonb_agg(to_jsonb(r) order by path) from public.site_routes r) routes,
 (select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from public.site_route_conflicts c) conflicts;
do $$ begin
 begin
  perform public.move_game_namespace_to_page_type_urls('clash-fixture');
  raise exception 'expected live clash';
 exception when unique_violation then
  if sqlstate<>'23505' or sqlerrm not like 'Site route /wiki/clash-fixture is live for roblox/wiki/%; cannot assign to game/wiki/%' then raise; end if;
 end;
 perform pg_temp.url_assert((select games=(select jsonb_agg(to_jsonb(g) order by id) from public.games g) and pages=(select jsonb_agg(to_jsonb(p) order by id) from public.game_wiki_pages p) and routes=(select jsonb_agg(to_jsonb(r) order by path) from public.site_routes r) and conflicts=(select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from public.site_route_conflicts c) from clash_snapshot),'clash fully restores games, pages and registry');
 perform pg_temp.url_assert((select url_style='namespace' from public.games where namespace='clash-fixture'),'clash restores style');
 perform pg_temp.url_assert((select canonical_path='/clash-fixture/wiki' from public.game_wiki_pages where namespace='clash-fixture'),'clash restores canonical');
 perform pg_temp.url_assert(not exists(select 1 from public.site_routes where path='/clash-fixture/wiki' and status='old'),'clash restores registry');
end $$;

-- Exercise the deployed publisher, not a lookalike INSERT: all page groups it
-- supports, then update those same IDs without supplying canonical_path.
do $$
declare ns text; gid uuid; style text; payload jsonb; group_name text; typ text; table_name text; row_id uuid; expected text; prior_ids jsonb; pass int; r record;
begin
 for ns,gid,style in select * from (values
  ('url-fixture','10000000-0000-0000-0000-000000000001'::uuid,'page_type'),
  ('unmoved-fixture','30000000-0000-0000-0000-000000000002'::uuid,'namespace'),
  ('batch-new','50000000-0000-0000-0000-000000000001'::uuid,'page_type')
 ) cases(ns,gid,style) loop
  if ns='batch-new' then
   perform public.publish_game_content_batch(ns,jsonb_build_object('games',jsonb_build_array(jsonb_build_object('id',gid,'slug',ns,'kind','game'))),true);
  end if;
  prior_ids:='{}';
  for pass in 1..2 loop
   foreach group_name in array array['wiki','codesPages','tools','maps','quizzes','catalog','checklists'] loop
    typ:=case group_name when 'wiki' then 'wiki' when 'codesPages' then 'code' when 'tools' then 'tool' when 'maps' then 'map' when 'quizzes' then 'quiz' when 'catalog' then 'catalog' else 'checklist' end;
    table_name:='game_'||typ||'_pages';
    payload:=jsonb_build_object('game_id',gid,'slug',case when typ='wiki' then ns else ns||'-batch' end,'title','batch pass '||pass);
    if typ='checklist' then payload:=payload||'{"is_public":false}'; end if;
    perform public.publish_game_content_batch(ns,jsonb_build_object(group_name,jsonb_build_array(payload)),true);
    execute format('select id,canonical_path from public.%I where game_id=$1 and slug=$2',table_name) into strict r using gid,payload->>'slug';
    expected:=public.expected_game_page_path(gid,typ,payload->>'slug');
    perform pg_temp.url_assert(r.canonical_path=expected,ns||' batch stored '||typ||' pass '||pass);
    perform pg_temp.url_assert(exists(select 1 from public.site_routes where path=expected and status='live' and source='game' and page_type=typ and page_id=r.id::text and game_id=gid),ns||' batch live '||typ);
    if pass=1 then prior_ids:=prior_ids||jsonb_build_object(typ,r.id);
    else
     perform pg_temp.url_assert(prior_ids->>typ=r.id::text,ns||' in-place '||typ);
     execute format('select title from public.%I where id=$1',table_name) into expected using r.id;
     perform pg_temp.url_assert(expected='batch pass 2',ns||' updated content '||typ);
    end if;
   end loop;
  end loop;
  perform pg_temp.url_assert((select url_style=style from public.games where id=gid),ns||' retains style');
 end loop;
end $$;

-- Publisher-created children inherit both unmoved and moved franchise styles.
do $$ declare ns text; root_id uuid; child_id uuid; expected text; style text; r record; begin
 for ns,root_id,child_id,style in select * from (values
  ('batch-legacy','60000000-0000-0000-0000-000000000001'::uuid,'60000000-0000-0000-0000-000000000002'::uuid,'namespace'),
  ('batch-modern','60000000-0000-0000-0000-000000000003'::uuid,'60000000-0000-0000-0000-000000000004'::uuid,'page_type')
 ) cases(ns,root_id,child_id,style) loop
  perform public.publish_game_content_batch(ns,jsonb_build_object('games',jsonb_build_array(jsonb_build_object('id',root_id,'slug',ns,'kind','franchise','url_style','namespace')),'wiki',jsonb_build_array(jsonb_build_object('game_id',root_id,'slug',ns))),true);
  if style='page_type' then perform public.move_game_namespace_to_page_type_urls(ns); end if;
  perform public.publish_game_content_batch(ns,jsonb_build_object('games',jsonb_build_array(jsonb_build_object('id',child_id,'slug',ns||'-child','kind','game','parent_id',root_id)),'wiki',jsonb_build_array(jsonb_build_object('game_id',child_id,'slug','permanent-'||ns))),true);
  perform pg_temp.url_assert((select url_style=style from public.games where id=child_id),'batch child inherits '||style);
  expected:=case style when 'namespace' then '/'||ns||'/wiki/permanent-'||ns else '/wiki/'||ns||'-child' end;
  select * into strict r from public.game_wiki_pages where game_id=child_id;
  perform pg_temp.url_assert(r.canonical_path=expected,'batch child canonical '||style);
  perform pg_temp.url_assert(exists(select 1 from public.site_routes where path=expected and page_id=r.id::text and game_id=child_id and source='game' and page_type='wiki' and status='live'),'batch child live '||style);
 end loop;
end $$;

-- Independent literal expectations for every page type in each style.
select pg_temp.url_assert(public.expected_game_page_path(gid,typ,slug)=expected,style||' path '||typ)
from (values
 ('namespace','30000000-0000-0000-0000-000000000002'::uuid),
 ('page_type','50000000-0000-0000-0000-000000000001'::uuid)
) games(style,gid)
cross join lateral (values
 ('hub',null,case style when 'namespace' then '/unmoved-fixture' else '/wiki/batch-new' end),
 ('wiki',null,case style when 'namespace' then '/unmoved-fixture/wiki' else '/wiki/batch-new' end),
 ('collection','items',case style when 'namespace' then '/unmoved-fixture/wiki/items' else '/wiki/batch-new/items' end),
 ('code','ignored',case style when 'namespace' then '/unmoved-fixture/codes' else '/codes/batch-new' end),
 ('tool','calc',case style when 'namespace' then '/unmoved-fixture/tools/calc' else '/tools/batch-new-calc' end),
 ('map','world',case style when 'namespace' then '/unmoved-fixture/maps/world' else '/maps/world' end),
 ('quiz','knowledge',case style when 'namespace' then '/unmoved-fixture/quizzes/knowledge' else '/quizzes/knowledge' end),
 ('catalog','items',case style when 'namespace' then '/unmoved-fixture/catalog/items' else '/catalog/batch-new-items' end),
 ('checklist','tasks',case style when 'namespace' then '/unmoved-fixture/checklists/tasks' else '/checklists/tasks' end)
) paths(typ,slug,expected);
select pg_temp.url_assert(public.expected_game_page_path('60000000-0000-0000-0000-000000000002',typ,slug)=expected,'namespace child '||typ)
from (values ('wiki','permanent-batch-legacy','/batch-legacy/wiki/permanent-batch-legacy'),('code','ignored','/batch-legacy/codes/batch-legacy-child'),('collection','items','/batch-legacy/wiki/permanent-batch-legacy/items')) paths(typ,slug,expected);

-- Real Minecraft identities, including the archived child with a permanent URL.
insert into public.games(id,namespace,slug,kind,url_style) values('70000000-0000-0000-0000-000000000001','minecraft','minecraft','franchise','namespace');
insert into public.games(id,namespace,slug,parent_id) values
 ('70000000-0000-0000-0000-000000000002','minecraft','minecraft-java','70000000-0000-0000-0000-000000000001'),
 ('70000000-0000-0000-0000-000000000003','minecraft','minecraft-bedrock','70000000-0000-0000-0000-000000000001'),
 ('70000000-0000-0000-0000-000000000004','minecraft','minecraft','70000000-0000-0000-0000-000000000001');
insert into public.game_wiki_pages(namespace,game_id,slug) values
 ('minecraft','70000000-0000-0000-0000-000000000002','minecraft-java'),
 ('minecraft','70000000-0000-0000-0000-000000000003','minecraft-bedrock'),
 ('minecraft','70000000-0000-0000-0000-000000000004','minecraft');
select pg_temp.url_assert(public.expected_game_page_path(gid,'wiki',slug)=base and public.expected_game_page_path(gid,'collection','items')=base||'/items','Minecraft '||slug)
from (values
 ('70000000-0000-0000-0000-000000000002'::uuid,'minecraft-java','/minecraft/java/wiki'),
 ('70000000-0000-0000-0000-000000000003'::uuid,'minecraft-bedrock','/minecraft/bedrock/wiki'),
 ('70000000-0000-0000-0000-000000000004'::uuid,'minecraft','/minecraft/wiki/legacy-minecraft')
) editions(gid,slug,base);
do $$ begin
 begin perform public.move_game_namespace_to_page_type_urls('minecraft'); raise exception 'expected Minecraft refusal';
 exception when others then if sqlerrm not like 'Namespace minecraft cannot move until%' then raise; end if; end;
 perform pg_temp.url_assert(not exists(select 1 from public.games where namespace='minecraft' and url_style<>'namespace'),'Minecraft stays namespace');
end $$;

-- Mutating both owner and path together cannot evade permanent ownership.
do $$ begin
 begin
  update public.game_tool_pages set game_id='50000000-0000-0000-0000-000000000001',namespace='batch-new',canonical_path='/tools/batch-new-calculator' where namespace='url-fixture' and slug='calculator';
  raise exception 'owner mutation accepted';
 exception when others then if sqlerrm<>'Page ownership and slug are permanent' then raise; end if; end;
 begin
  update public.game_wiki_pages set game_id='50000000-0000-0000-0000-000000000001',namespace='batch-new',canonical_path='/wiki/batch-new' where namespace='url-fixture';
  raise exception 'wiki page owner mutation accepted';
 exception when others then if sqlerrm<>'Page ownership and slug are permanent' then raise; end if; end;
 begin
  update public.game_collection_pages set wiki_page_id=(select id from public.game_wiki_pages where namespace='batch-new'),wiki_slug='batch-new' where namespace='url-fixture';
  raise exception 'wiki owner mutation accepted';
 exception when others then if sqlerrm not in ('Collection wiki ownership mismatch','Collection route identity is permanent') then raise; end if; end;
end $$;

-- Every directory family and every mutable copy column, including cross-game
-- and Roblox links. Sources and unrelated text must survive byte for byte.
insert into public.games(id,namespace,slug,url_style) values('80000000-0000-0000-0000-000000000001','rewrite-fixture','rewrite-fixture','namespace');
insert into public.game_wiki_pages(id,namespace,game_id,slug) values('80000000-0000-0000-0000-000000000002','rewrite-fixture','80000000-0000-0000-0000-000000000001','rewrite-fixture');
insert into public.game_collection_pages(namespace,game_id,wiki_page_id,wiki_slug,collection_slug) values('rewrite-fixture','80000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000002','rewrite-fixture','items');
do $$ declare typ text; t text; col record; begin
 foreach typ in array array['code','tool','map','quiz','catalog','checklist'] loop
  execute format('insert into public.game_%I_pages(namespace,game_id,slug) values($1,$2,$3)',typ) using 'rewrite-fixture','80000000-0000-0000-0000-000000000001'::uuid,'rewrite-'||typ;
 end loop;
 foreach t in array array['wiki_pages','wiki_collection_pages','code_pages','quiz_pages','checklist_pages','tools','articles','catalog_pages','events_pages'] loop
  execute format('insert into public.%I(slug,code,wiki_slug,collection_slug) values($1,$1,$1,$2)',t) using 'rewrite-'||replace(t,'_','-'),'items';
 end loop;
 -- Inspect the installed schema so newly added *_md columns cannot silently
 -- escape coverage. Every listed table has a fixture row above.
 for col in select table_name,column_name,data_type from information_schema.columns
 where table_schema='public' and table_name in ('games','game_wiki_pages','game_collection_pages','game_code_pages','game_tool_pages','game_map_pages','game_quiz_pages','game_catalog_pages','game_checklist_pages','wiki_pages','wiki_collection_pages','code_pages','quiz_pages','checklist_pages','tools','articles','catalog_pages','events_pages')
 and (column_name like '%\_md' escape '\' or column_name in ('faq_json','description_json','controls_json','quiz_data','map_data','catalog_data')) and data_type in ('text','jsonb','json') loop
  execute format('update public.%I set %I=$1::%s',col.table_name,col.column_name,col.data_type)
   using case when col.data_type='text' then '[Items](/rewrite-fixture/wiki/items) https://bloxodes.com/rewrite-fixture/wiki/items?view=list' else '{"nested":["/rewrite-fixture/wiki/items"],"number":42,"/rewrite-fixture/wiki/items":"key stays"}' end;
 end loop;
end $$;
update public.game_wiki_pages set sources_json='[{"title":"Original source","url":"https://bloxodes.com/rewrite-fixture/wiki/items"}]' where namespace='rewrite-fixture';
select public.move_game_namespace_to_page_type_urls('rewrite-fixture');
create temp table rewrite_result as select public.rewrite_moved_game_links('rewrite-fixture') result;
select pg_temp.url_assert((select resolved_target=case when path='/rewrite-fixture/codes' then '/codes/rewrite-fixture' else '/wiki/rewrite-fixture' end from public.resolve_site_route(path)),'move alias '||path)
from (values ('/rewrite-fixture'),('/rewrite-fixture/wiki'),('/rewrite-fixture/codes'),('/rewrite-fixture/tools'),('/rewrite-fixture/maps'),('/rewrite-fixture/quizzes'),('/rewrite-fixture/checklists'),('/rewrite-fixture/catalog')) aliases(path);
select pg_temp.url_assert((select resolved_target=new_path from public.resolve_site_route(old_path)),'page alias '||old_path)
from (values
 ('/rewrite-fixture/wiki/items','/wiki/rewrite-fixture/items'),
 ('/rewrite-fixture/codes','/codes/rewrite-fixture'),
 ('/rewrite-fixture/tools/rewrite-tool','/tools/rewrite-fixture-rewrite-tool'),
 ('/rewrite-fixture/maps/rewrite-map','/maps/rewrite-map'),
 ('/rewrite-fixture/quizzes/rewrite-quiz','/quizzes/rewrite-quiz'),
 ('/rewrite-fixture/catalog/rewrite-catalog','/catalog/rewrite-fixture-rewrite-catalog'),
 ('/rewrite-fixture/checklists/rewrite-checklist','/checklists/rewrite-checklist')
) aliases(old_path,new_path);
do $$ declare col record; ok boolean; expected jsonb; fields int:=0; begin
 for col in select table_name,column_name,data_type from information_schema.columns
 where table_schema='public' and table_name in ('games','game_wiki_pages','game_collection_pages','game_code_pages','game_tool_pages','game_map_pages','game_quiz_pages','game_catalog_pages','game_checklist_pages','wiki_pages','wiki_collection_pages','code_pages','quiz_pages','checklist_pages','tools','articles','catalog_pages','events_pages')
 and (column_name like '%\_md' escape '\' or column_name in ('faq_json','description_json','controls_json','quiz_data','map_data','catalog_data')) and data_type in ('text','jsonb','json') loop
  expected:=case when col.data_type='text' then to_jsonb('[Items](/wiki/rewrite-fixture/items) https://bloxodes.com/wiki/rewrite-fixture/items?view=list'::text) else '{"nested":["/wiki/rewrite-fixture/items"],"number":42,"/rewrite-fixture/wiki/items":"key stays"}'::jsonb end;
  execute format('select count(*)>0 and bool_and(to_jsonb(%I)=$1) from public.%I',col.column_name,col.table_name) into ok using expected;
  perform pg_temp.url_assert(ok,'rewrites '||col.table_name||'.'||col.column_name);
  fields:=fields+1;
 end loop;
 perform pg_temp.url_assert((select (result->>'fields_rewritten')::int=fields from rewrite_result),'every rewrite column counted');
end $$;

select pg_temp.url_assert((select sources_json='[{"title":"Original source","url":"https://bloxodes.com/rewrite-fixture/wiki/items"}]'::jsonb from public.game_wiki_pages where namespace='rewrite-fixture'),'sources never rewritten');
-- With child codes there is a real directory as well as a page alias. A root
-- codes page above instead keeps /<namespace>/codes linked to that page.
select public.publish_game_content_batch('batch-legacy','{"codesPages":[{"game_id":"60000000-0000-0000-0000-000000000002","slug":"permanent-batch-legacy"}]}',true);
select public.move_game_namespace_to_page_type_urls('batch-legacy');
select pg_temp.url_assert((select resolved_target='/games/batch-legacy' from public.resolve_site_route('/batch-legacy/codes')),'child codes directory alias');
select pg_temp.url_assert((select resolved_target='/codes/batch-legacy-child' from public.resolve_site_route('/batch-legacy/codes/batch-legacy-child')),'child codes page alias');
select pg_temp.url_assert((select resolved_target='/wiki/batch-legacy-child' from public.resolve_site_route('/batch-legacy/wiki/permanent-batch-legacy')),'permanent child wiki alias');

-- Real overlapping root, directory and page maps together. A failed specific
-- match must not fall through to the root; query-string URLs are not links.
select pg_temp.url_assert(public.rewrite_game_url_links(
 '["/peak","/peak/wiki","/peak/wiki/items","/peak/wiki/items/page/2?x=1","/peak/wiki/items-other","/peak/wiki/unknown","/peak/page/2","/peak/wiki/page/2","https://bloxodes.com/peak/wiki/items#x","https://other.test/?next=/peak/wiki/items","https://other.test/?next=https://bloxodes.com/peak/wiki/items"]'::jsonb,
 '{"/peak":"/wiki/peak","/peak/wiki":"/wiki/peak","/peak/wiki/items":"/wiki/peak/items"}'::jsonb,'["/peak/wiki/items"]'::jsonb)
 = '["/wiki/peak","/wiki/peak","/wiki/peak/items","/wiki/peak/items/page/2?x=1","/peak/wiki/items-other","/peak/wiki/unknown","/peak/page/2","/peak/wiki/page/2","https://bloxodes.com/wiki/peak/items#x","https://other.test/?next=/peak/wiki/items","https://other.test/?next=https://bloxodes.com/peak/wiki/items"]'::jsonb,
 'whole links with overlapping real mappings');

select pg_temp.url_assert((public.rewrite_moved_game_links('rewrite-fixture')->>'row_field_updates')::int=0,'separate rewrite is idempotent');
