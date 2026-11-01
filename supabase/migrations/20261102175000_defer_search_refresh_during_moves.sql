begin;
set local lock_timeout = '3s';

-- Every page update rebuilt its whole namespace's search index, so moving a
-- namespace was quadratic: GTA's ~320 pages exceeded the production release's
-- 55-second Studio query limit. During a move (bloxodes.url_move_namespace set
-- by the move function) page triggers skip the rebuild and the move rebuilds
-- once at the end. Sorts before the pending moves so they use these versions.
create or replace function public.trg_game_content_changed() returns trigger language plpgsql set search_path='' as $$
declare moving boolean; ns text; old_path text; new_path text; target_id text; target_type text; roots text[];
begin
 ns:=case when tg_op='DELETE' then old.namespace else new.namespace end;
 moving:=current_setting('bloxodes.url_move_namespace',true) is not distinct from ns;
 -- During a namespace move the move function rebuilds the index once and
 -- enqueues one namespace event; each page still enqueues its old and new URL.
 if moving and tg_table_name='games' then return null; end if;
 if tg_table_name='games' then
  perform public.refresh_game_content_index(ns);
  for new_path in select canonical_path from public.game_wiki_pages where namespace=ns union select canonical_path from public.game_collection_pages where namespace=ns union select canonical_path from public.game_tool_pages where namespace=ns union select canonical_path from public.game_checklist_pages where namespace=ns union select canonical_path from public.game_code_pages where namespace=ns union select canonical_path from public.game_map_pages where namespace=ns union select canonical_path from public.game_quiz_pages where namespace=ns union select canonical_path from public.game_catalog_pages where namespace=ns loop
   perform public.enqueue_revalidation('game_content',ltrim(new_path,'/'),'games_'||lower(tg_op));
  end loop;
 else
  target_id:=case when tg_op='DELETE' then old.id::text else new.id::text end;
  old_path:=case when tg_op in ('DELETE','UPDATE') then old.canonical_path else null end;
  new_path:=case when tg_op='DELETE' then null else new.canonical_path end;
  if tg_op='DELETE' then delete from public.search_index where entity_id=target_id and url=old_path; end if;
  if not moving then perform public.refresh_game_content_index(ns); end if;
  if old_path is not null then perform public.enqueue_revalidation('game_content',ltrim(old_path,'/'),tg_table_name||'_'||lower(tg_op)); end if;
  if new_path is not null and new_path is distinct from old_path then perform public.enqueue_revalidation('game_content',ltrim(new_path,'/'),tg_table_name||'_'||lower(tg_op)); end if;
 end if;
 if not moving then perform public.enqueue_revalidation('game_content',ns||'/wiki',tg_table_name||'_'||lower(tg_op)); end if;
 return null;
end $$;

create or replace function public.move_game_namespace_to_page_type_urls(p_namespace text) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='3s' as $$
declare root public.games; t text; section text; r record; col record; mapping jsonb:='{}'; main_path text; changed bigint; page_count bigint:=0; rewritten bigint:=0; field_count bigint:=0; legacy public.games; legacy_wiki public.game_wiki_pages; target public.site_routes;
begin
 -- BEFORE row/table locks: identical order to Phase 2 publishers/backfill.
 perform pg_catalog.pg_advisory_xact_lock(7823462194301);
 lock table public.games,public.game_wiki_pages,public.game_code_pages,public.game_tool_pages,public.game_map_pages,public.game_quiz_pages,public.game_catalog_pages,public.game_checklist_pages,public.game_collection_pages,public.code_pages,public.wiki_pages,public.wiki_collection_pages,public.quiz_pages,public.checklist_pages,public.tools,public.events_pages,public.articles,public.catalog_pages,public.puzzle_pages in share row exclusive mode;
 select * into root from public.games where namespace=p_namespace and parent_id is null;
 if not found then raise exception 'Unknown game namespace: %',p_namespace; end if;
 if not exists(select 1 from public.game_wiki_pages where game_id=root.id) then raise exception 'Namespace needs a root wiki before moving: %',p_namespace; end if;
 if not exists(select 1 from public.games where namespace=p_namespace and url_style<>'page_type') then
  return jsonb_build_object('namespace',p_namespace,'pages_moved',0,'fields_rewritten',0,'row_field_updates',0,'paths','{}'::jsonb);
 end if;
 -- Fail closed before changing any identity or route. The legacy child may be
 -- published or unpublished; the move archives it after all shape checks pass.
 if p_namespace='minecraft' then
  select * into legacy from public.games where namespace='minecraft' and slug='minecraft' and parent_id=root.id;
  select * into legacy_wiki from public.game_wiki_pages where game_id=legacy.id;
  if root.kind<>'franchise' or not root.is_published or legacy.id is null
   or legacy_wiki.slug is distinct from 'minecraft' or not legacy_wiki.is_published
   or legacy_wiki.canonical_path is distinct from '/minecraft/wiki/legacy-minecraft'
   or (select count(*) from public.game_wiki_pages where game_id=legacy.id)<>1
   or (select count(*) from public.game_collection_pages where game_id=legacy.id)<>25
   or exists(select 1 from public.game_collection_pages where game_id=legacy.id and
     (wiki_page_id<>legacy_wiki.id or wiki_slug<>'minecraft' or canonical_path<>'/minecraft/wiki/'||collection_slug))
   or not exists(select 1 from public.game_collection_pages where game_id=legacy.id and collection_slug='achievements' and is_published)
   or (select count(*) from public.games where namespace='minecraft')<>4
   or (select count(*) from public.game_wiki_pages w join public.games g on g.id=w.game_id
     where g.namespace='minecraft' and g.slug in ('minecraft-java','minecraft-bedrock') and g.parent_id=root.id and g.is_published and w.is_published and w.slug=g.slug and w.canonical_path='/minecraft/'||substr(g.slug,11)||'/wiki')<>2
   or not exists(select 1 from public.game_wiki_pages where game_id=root.id and slug='minecraft-hub' and is_published and canonical_path='/minecraft/wiki')
   or not exists(select 1 from public.game_collection_pages c join public.games g on g.id=c.game_id where g.namespace='minecraft' and g.slug='minecraft-bedrock' and c.collection_slug='achievements' and c.is_published)
  then raise exception 'Unexpected Minecraft legacy shape'; end if;
  if exists(select 1 from public.site_routes where source='game' and game_id=legacy.id and status='old') then raise exception 'Unexpected Minecraft legacy shape: previous aliases'; end if;
  foreach t in array array['code','tool','map','quiz','catalog','checklist'] loop
   execute format('select exists(select 1 from public.game_%I_pages where game_id=$1)',t) into r using legacy.id;
   if r.exists then raise exception 'Unexpected Minecraft legacy shape: extra % pages',t; end if;
  end loop;
  for r in select g.id from public.games g where g.namespace='minecraft' and g.slug in ('minecraft-java','minecraft-bedrock') loop
   if (select count(*) from public.game_collection_pages where game_id=r.id)<>24 then raise exception 'Unexpected Minecraft legacy shape: edition count'; end if;
  end loop;
 end if;
 -- Save every old route before the style change retires synthetic hubs.
 for r in select path from public.site_routes where source='game' and status='live' and game_id in(select id from public.games where namespace=p_namespace) loop
  mapping:=mapping||jsonb_build_object(r.path,r.path);
 end loop;
 perform pg_catalog.set_config('bloxodes.namespaces_moved_in_transaction',coalesce(current_setting('bloxodes.namespaces_moved_in_transaction',true),'')||','||p_namespace||',',true);
 perform pg_catalog.set_config('bloxodes.url_move_namespace',p_namespace,true);
 -- Archive only the game row before its page_type style triggers the permanent
 -- publication guard. Preserve the legacy wiki, collections and their data.
 if legacy.id is not null then
  update public.games set is_published=false where id=legacy.id and is_published;
 end if;
 -- Root first: a child's path rules (including the Minecraft archive check)
 -- read the root's style, so children must switch after it.
 update public.games set url_style='page_type' where namespace=p_namespace and parent_id is null;
 update public.games set url_style='page_type' where namespace=p_namespace and parent_id is not null;
 main_path:=public.expected_game_page_path(root.id,'wiki');
 if legacy.id is not null then
  delete from public.site_routes where source='game' and game_id=legacy.id and status='live' and page_type in ('wiki','collection');
 end if;
 foreach t in array array['wiki','code','tool','map','quiz','catalog','checklist','collection'] loop
  for r in execute format('select id,canonical_path,public.expected_game_page_path(game_id,%L,%s) destination from public.game_%I_pages where namespace=$1 and not public.is_archived_minecraft_game(game_id)',t,case when t='collection' then 'collection_slug' else 'slug' end,t) using p_namespace loop
   if r.canonical_path=r.destination then continue; end if;
   mapping:=mapping||jsonb_build_object(r.canonical_path,r.destination);
   execute format('update public.game_%I_pages set canonical_path=$1 where id=$2',t) using r.destination,r.id;
   page_count:=page_count+1;
  end loop;
 end loop;
 if legacy.id is not null then
  mapping:=mapping||jsonb_build_object('/minecraft/wiki/legacy-minecraft',main_path);
  for r in select c.collection_slug,c.canonical_path from public.game_collection_pages c where c.game_id=legacy.id loop
   select sr.* into target from public.game_collection_pages c join public.games g on g.id=c.game_id
    join public.site_routes sr on sr.source='game' and sr.page_type='collection' and sr.page_id=c.id::text and sr.status='live'
    where c.namespace='minecraft' and c.collection_slug=r.collection_slug and c.is_published and g.is_published
    and g.slug in ('minecraft-java','minecraft-bedrock')
    and (r.collection_slug<>'achievements' or g.slug='minecraft-bedrock')
    order by (g.slug='minecraft-java') desc limit 1;
   mapping:=mapping||jsonb_build_object(r.canonical_path,coalesce(target.path,main_path));
  end loop;
 end if;
 if p_namespace='minecraft' then
  for r in select distinct collection_slug from public.game_collection_pages where namespace='minecraft' loop
   select c.canonical_path into main_path from public.game_collection_pages c join public.games g on g.id=c.game_id
    where c.namespace='minecraft' and c.collection_slug=r.collection_slug and c.is_published and g.is_published
    and g.slug in ('minecraft-java','minecraft-bedrock') and (r.collection_slug<>'achievements' or g.slug='minecraft-bedrock')
    order by (g.slug='minecraft-java') desc limit 1;
   mapping:=mapping||jsonb_build_object('/minecraft/wiki/'||r.collection_slug,coalesce(main_path,'/games/minecraft'));
  end loop;
  main_path:='/games/minecraft';
 end if;
 -- Synthetic roots and real directories are aliases, not competing page owners.
 mapping:=mapping||jsonb_build_object('/'||p_namespace,main_path,'/'||p_namespace||'/wiki',main_path);
 foreach section in array array['codes','tools','maps','quizzes','checklists','catalog'] loop
  t:=case section when 'codes' then 'code' when 'tools' then 'tool' when 'maps' then 'map' when 'quizzes' then 'quiz' when 'checklists' then 'checklist' else 'catalog' end;
  execute format('select exists(select 1 from public.game_%I_pages where namespace=$1)',t) into r using p_namespace;
  if r.exists and not exists(select 1 from public.site_routes where path='/'||p_namespace||'/'||section and status='old' and page_id is not null) then
   mapping:=mapping||jsonb_build_object('/'||p_namespace||'/'||section,main_path);
  end if;
 end loop;
 for r in select key,value#>>'{}' destination from jsonb_each(mapping) where key<>value#>>'{}' loop
  -- Page-linked old rows created by the route trigger must remain linked.
  if exists(select 1 from public.site_routes where path=r.key and status='old' and page_id is not null) then
   if (select public.site_route_target(sr,r.key) from public.site_routes sr where path=r.key) is distinct from r.destination then raise exception 'Move alias conflicts with existing owner: %',r.key; end if;
   continue;
  end if;
  if exists(select 1 from public.site_routes where path=r.key and status='live') then raise exception 'Move alias would replace a live path: %',r.key; end if;
  delete from public.site_routes where path=r.key and status='gone' and source='game' and page_type='hub' and page_id=root.id::text;
  -- Only the two imported Minecraft compatibility prefixes may be replaced.
  -- Other old/gone claimants must agree; claim_site_route deliberately retains
  -- a different old owner, so verify the resulting alias below as well.
  if p_namespace='minecraft' then
   delete from public.site_routes where path=r.key and status='old' and page_id is null
    and origin='minecraft-legacy' and (path,target_url) in
      (('/minecraft/wiki','/minecraft/java/wiki'),('/minecraft/wiki/achievements','/minecraft/bedrock/wiki/achievements'));
  end if;
  select * into target from public.site_routes where path=r.destination and status='live';
  if target.page_id is null then raise exception 'Move alias has no live destination: % -> %',r.key,r.destination; end if;
  perform public.claim_site_route(jsonb_build_object('path',r.key,'status','old','source',target.source,'page_type',target.page_type,'page_id',target.page_id,'game_id',target.game_id,'origin','namespace-move'));
  if (select public.site_route_target(sr,r.key) from public.site_routes sr where path=r.key) is distinct from r.destination then
   raise exception 'Move alias collision: % -> %',r.key,r.destination;
  end if;

 end loop;
 if p_namespace='minecraft' then
  update public.site_routes set target_url='/wiki/minecraft-java',updated_at=now()
   where path='/minecraft/wiki' and status='old' and match_type='prefix' and page_id is null;
 end if;
 -- Page triggers skipped the per-row index rebuild during the move; rebuild once.
 perform public.refresh_game_content_index(p_namespace);
 perform public.enqueue_revalidation('game_content',p_namespace,'namespace_move');
 perform pg_catalog.set_config('bloxodes.url_move_namespace','',true);
 return jsonb_build_object('namespace',p_namespace,'pages_moved',page_count,'fields_rewritten',field_count,'row_field_updates',rewritten,'paths',mapping);
end $$;
revoke all on function public.move_game_namespace_to_page_type_urls(text) from public,anon,authenticated;
grant execute on function public.move_game_namespace_to_page_type_urls(text) to service_role;

commit;
