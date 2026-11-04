begin;
set local lock_timeout='3s';
select pg_catalog.pg_advisory_xact_lock(7823462194301);
create table public.game_article_pages (
 id uuid primary key default gen_random_uuid(), namespace text not null, game_id uuid not null,
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), title text not null check(length(btrim(title))>0),
 seo_title text, meta_description text, content_md text not null check(length(btrim(content_md))>0), cover_image text,
 author_id uuid references public.authors(id), tags text[] not null default '{}',
 sources_json jsonb not null default '[]' check(jsonb_typeof(sources_json)='array'),
 faq_json jsonb not null default '[]' check(jsonb_typeof(faq_json)='array'), word_count integer,
 canonical_path text not null unique, is_published boolean not null default false,
 published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(namespace,slug), unique(id,namespace), foreign key(game_id,namespace) references public.games(id,namespace)
);
create index game_article_owner_idx on public.game_article_pages(game_id,namespace);
create index game_article_published_idx on public.game_article_pages(published_at desc,id) where is_published;
alter table public.game_article_pages enable row level security;
revoke all on public.game_article_pages from public,anon,authenticated;
grant all on public.game_article_pages to service_role;
create view public.game_article_pages_view with(security_invoker=true) as
 select p.*,g.title game_title,g.slug game_slug from public.game_article_pages p join public.games g on g.id=p.game_id
 where p.is_published and g.is_published and (p.published_at is null or p.published_at<=now())
 and not exists(select 1 from public.games parent where parent.id=g.parent_id and not parent.is_published);
revoke all on public.game_article_pages_view from public,anon,authenticated;
grant select on public.game_article_pages_view to service_role;
create or replace function public.expected_game_page_path(p_game_id uuid,p_type text,p_slug text default null) returns text
language plpgsql stable set search_path='' as $$
declare g public.games; base text; section text;
begin
 select * into strict g from public.games where id=p_game_id;
 if p_type='article' then return '/articles/'||p_slug; end if;
 if p_type not in ('hub','wiki','collection','code','tool','checklist','map','quiz','catalog') then raise exception 'Unknown game page type: %',p_type; end if;
 if g.namespace='minecraft' and g.slug='minecraft' and g.parent_id is not null and p_type in ('wiki','collection') then
  if g.url_style='page_type' and not public.is_archived_minecraft_game(g.id) then raise exception 'Legacy Minecraft must remain unpublished'; end if;
  return '/minecraft/wiki/'||case when p_type='wiki' then 'legacy-minecraft' else p_slug end;
 end if;
 if g.url_style='page_type' then
  base:=case when g.kind='franchise' and g.parent_id is null then '/games/'||g.namespace else '/wiki/'||g.slug end;
  if p_type in ('wiki','hub') then return base; end if;
  if p_type='collection' then
   if g.kind='franchise' and g.parent_id is null then raise exception 'Franchise roots cannot own collections'; end if;
   return base||'/'||p_slug;
  end if;
  if p_type='code' then return '/codes/'||g.slug; end if;
  section:=case p_type when 'tool' then 'tools' when 'quiz' then 'quizzes' when 'checklist' then 'checklists' when 'map' then 'maps' else 'catalog' end;
  return '/'||section||'/'||case when p_type in ('tool','catalog') and p_slug<>g.namespace and not starts_with(p_slug,g.namespace||'-') then g.namespace||'-' else '' end||p_slug;
 end if;
 base:='/'||g.namespace;
 if p_type='hub' then return base; end if;
 if p_type in ('wiki','collection') then
  if g.namespace='minecraft' and g.slug in ('minecraft-java','minecraft-bedrock') then
   base:=base||'/'||substr(g.slug,11)||'/wiki';
  else
   base:=base||'/wiki'||case when g.parent_id is null then '' when g.namespace='minecraft' and g.slug='minecraft' then '/legacy-minecraft' else '/'||coalesce(nullif(p_slug,''),g.slug) end;
   if p_type='collection' then
    select canonical_path into base from public.game_wiki_pages where game_id=g.id;
   end if;
  end if;
  return base||case when p_type='collection' then '/'||p_slug else '' end;
 end if;
 if p_type='code' then return base||'/codes'||case when g.parent_id is null then '' else '/'||g.slug end; end if;
 section:=case p_type when 'tool' then 'tools' when 'quiz' then 'quizzes' when 'checklist' then 'checklists' when 'map' then 'maps' else 'catalog' end;
 return base||'/'||section||'/'||p_slug;
end $$;
create trigger site_route_write_lock before insert or delete or update of id, canonical_path, game_id on public.game_article_pages for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.game_article_pages for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, canonical_path, game_id on public.game_article_pages for each row when (old.id is distinct from new.id or old.canonical_path is distinct from new.canonical_path or old.game_id is distinct from new.game_id) execute function public.sync_site_page_route();
create trigger prepare_game_extended_page before insert or update on public.game_article_pages for each row execute function public.prepare_game_extended_page();
create trigger game_content_changed after insert or update or delete on public.game_article_pages for each row execute function public.trg_game_content_changed();
create or replace function public.refresh_game_content_index(target_namespace text) returns void language plpgsql set search_path='' as $$
begin
 insert into public.search_index(entity_type,entity_id,slug,title,subtitle,url,updated_at,is_published,search_text)
 select 'game_'||page_kind,id::text,lower(trim(slug)),title,namespace||' '||page_kind,canonical_path,updated_at,coalesce(visible,false),left(concat_ws(' ',title,summary,slug),4000)
 from (
  select w.id,w.namespace,w.slug,w.title,w.meta_description summary,w.canonical_path,w.updated_at,w.is_published and g.is_published and coalesce(parent.is_published,true) visible,'wiki' page_kind from public.game_wiki_pages w join public.games g on g.id=w.game_id left join public.games parent on parent.id=g.parent_id where w.namespace=target_namespace or target_namespace is null
  union all
  select p.id,p.namespace,p.code,p.title,p.meta_description,p.canonical_path,p.updated_at,p.is_published and w.is_published and g.is_published and coalesce(parent.is_published,true) and p.published_dataset_id is not null,'collection' from public.game_collection_pages p join public.game_wiki_pages w on w.id=p.wiki_page_id join public.games g on g.id=p.game_id left join public.games parent on parent.id=g.parent_id where p.namespace=target_namespace or target_namespace is null
  union all
  select p.id,p.namespace,p.slug,p.title,p.meta_description,p.canonical_path,p.updated_at,p.is_published and g.is_published and coalesce(parent.is_published,true),'tool' from public.game_tool_pages p join public.games g on g.id=p.game_id left join public.games parent on parent.id=g.parent_id where p.namespace=target_namespace or target_namespace is null
  union all
  select p.id,p.namespace,p.slug,p.title,p.meta_description,p.canonical_path,p.updated_at,p.is_published and g.is_published and coalesce(parent.is_published,true),'code' from public.game_code_pages p join public.games g on g.id=p.game_id left join public.games parent on parent.id=g.parent_id where p.namespace=target_namespace or target_namespace is null
  union all
  select p.id,p.namespace,p.slug,p.title,p.seo_description,p.canonical_path,p.updated_at,p.is_public and p.published_at<=now() and g.is_published and coalesce(parent.is_published,true),'checklist' from public.game_checklist_pages p join public.games g on g.id=p.game_id left join public.games parent on parent.id=g.parent_id where p.namespace=target_namespace or target_namespace is null
  union all
  select p.id,p.namespace,p.slug,p.title,p.meta_description,p.canonical_path,p.updated_at,p.is_published and g.is_published and coalesce(parent.is_published,true) and coalesce(p.published_at<=now(),true),'map' from public.game_map_pages p join public.games g on g.id=p.game_id left join public.games parent on parent.id=g.parent_id where p.namespace=target_namespace or target_namespace is null
  union all
  select p.id,p.namespace,p.slug,p.title,p.meta_description,p.canonical_path,p.updated_at,p.is_published and g.is_published and coalesce(parent.is_published,true) and coalesce(p.published_at<=now(),true),'quiz' from public.game_quiz_pages p join public.games g on g.id=p.game_id left join public.games parent on parent.id=g.parent_id where p.namespace=target_namespace or target_namespace is null
 union all
  select p.id,p.namespace,p.slug,p.title,p.meta_description,p.canonical_path,p.updated_at,p.is_published and g.is_published and coalesce(parent.is_published,true) and coalesce(p.published_at<=now(),true),'article' from public.game_article_pages p join public.games g on g.id=p.game_id left join public.games parent on parent.id=g.parent_id where p.namespace=target_namespace or target_namespace is null
  union all
  select p.id,p.namespace,p.slug,p.title,p.meta_description,p.canonical_path,p.updated_at,p.is_published and g.is_published and coalesce(parent.is_published,true) and coalesce(p.published_at<=now(),true),'catalog' from public.game_catalog_pages p join public.games g on g.id=p.game_id left join public.games parent on parent.id=g.parent_id where p.namespace=target_namespace or target_namespace is null
 ) pages
 where nullif(trim(slug),'') is not null and nullif(trim(title),'') is not null and nullif(trim(canonical_path),'') is not null
 on conflict(entity_type,entity_id) do update set
 slug=excluded.slug,title=excluded.title,subtitle=excluded.subtitle,url=excluded.url,
 updated_at=excluded.updated_at,is_published=excluded.is_published,search_text=excluded.search_text;
end $$;
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
  for new_path in select canonical_path from public.game_wiki_pages where namespace=ns union select canonical_path from public.game_collection_pages where namespace=ns union select canonical_path from public.game_tool_pages where namespace=ns union select canonical_path from public.game_checklist_pages where namespace=ns union select canonical_path from public.game_code_pages where namespace=ns union select canonical_path from public.game_map_pages where namespace=ns union select canonical_path from public.game_article_pages where namespace=ns union select canonical_path from public.game_quiz_pages where namespace=ns union select canonical_path from public.game_catalog_pages where namespace=ns loop
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
CREATE OR REPLACE FUNCTION public.trg_comments_revalidate_game_content() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
declare row_data jsonb; target_table text; page_path text;
begin
 for row_data in select v from (values(case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end),(case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end)) r(v) where v is not null loop
  target_table:=case when row_data->>'entity_type' ='game_wiki' then 'game_wiki_pages' when row_data->>'entity_type' ='game_collection' then 'game_collection_pages' when row_data->>'entity_type' ='game_tool' then 'game_tool_pages' when row_data->>'entity_type'='game_code' then 'game_code_pages' when row_data->>'entity_type'='game_map' then 'game_map_pages' when row_data->>'entity_type'='game_article' then 'game_article_pages' when row_data->>'entity_type'='game_quiz' then 'game_quiz_pages' when row_data->>'entity_type'='game_catalog' then 'game_catalog_pages' end;
  if target_table is not null then
   execute format('select canonical_path from public.%I where id=$1',target_table) into page_path using (row_data->>'entity_id')::uuid;
   if page_path is not null then perform public.enqueue_revalidation('game_content',ltrim(page_path,'/'),'comments_'||lower(tg_op)); end if;
  end if;
 end loop;
 return null;
end $_$;
create or replace function public.publish_game_content_batch(target_namespace text,payload jsonb,apply_changes boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare group_name text; table_name text; conflict_columns text; row_value jsonb; columns_sql text; updates_sql text; result_id uuid; results jsonb:='[]'::jsonb;
begin
 if target_namespace !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or target_namespace='roblox' then raise exception 'Invalid game namespace'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload='{}'::jsonb or exists(select 1 from jsonb_object_keys(payload) key where key not in ('games','wiki','codesPages','tools','maps','quizzes','articles','catalog','checklists','checklistItems','codes')) then raise exception 'Invalid game publication groups'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('game-publish:'||target_namespace,0));
 begin
  foreach group_name in array array['games','wiki','codesPages','tools','maps','quizzes','articles','catalog','checklists','checklistItems','codes'] loop
   if not payload ? group_name then continue; end if;
   if jsonb_typeof(payload->group_name) is distinct from 'array' or jsonb_array_length(payload->group_name)=0 then raise exception 'Invalid % rows',group_name; end if;
   case group_name
    when 'games' then table_name:='games';conflict_columns:='namespace,slug,kind';
    when 'wiki' then table_name:='game_wiki_pages';conflict_columns:='game_id';
    when 'codesPages' then table_name:='game_code_pages';conflict_columns:='game_id';
    when 'tools' then table_name:='game_tool_pages';conflict_columns:='namespace,slug';
    when 'maps' then table_name:='game_map_pages';conflict_columns:='namespace,slug';
    when 'articles' then table_name:='game_article_pages';conflict_columns:='namespace,slug';
    when 'quizzes' then table_name:='game_quiz_pages';conflict_columns:='namespace,slug';
    when 'catalog' then table_name:='game_catalog_pages';conflict_columns:='namespace,slug';
    when 'checklists' then table_name:='game_checklist_pages';conflict_columns:='namespace,slug';
    when 'checklistItems' then table_name:='game_checklist_items';conflict_columns:='page_id,item_key';
    else table_name:='game_codes';conflict_columns:='code_page_id,code';
   end case;
   for row_value in select value from jsonb_array_elements(payload->group_name) loop
    if jsonb_typeof(row_value) is distinct from 'object' or row_value='{}'::jsonb then raise exception 'Invalid % row',group_name; end if;
    if row_value ? 'namespace' and row_value->>'namespace' is distinct from target_namespace then raise exception 'Cross-namespace publication rejected'; end if;
    if group_name='codes' then
     if not exists(select 1 from public.game_code_pages where id=(row_value->>'code_page_id')::uuid and namespace=target_namespace) then raise exception 'Code page ownership mismatch'; end if;
    else row_value:=row_value||jsonb_build_object('namespace',target_namespace); end if;
    if exists(select 1 from jsonb_object_keys(row_value) fields(key) where not exists(select 1 from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=table_name and a.attname=key and a.attnum>0 and not a.attisdropped and a.attgenerated='')) then raise exception 'Unknown or generated publication column in %',group_name; end if;
    select string_agg(format('%I',key),',' order by key),string_agg(format('%1$I=excluded.%1$I',key),',' order by key) filter(where key<>'id') into columns_sql,updates_sql from jsonb_object_keys(row_value) fields(key);
    if updates_sql is null then raise exception 'Publication row requires content'; end if;
    execute format('insert into public.%1$I (%2$s) select %2$s from pg_catalog.jsonb_populate_record(null::public.%1$I,$1) on conflict (%3$s) do update set %4$s returning id',table_name,columns_sql,conflict_columns,updates_sql) into result_id using row_value;
    if row_value ? 'id' and (row_value->>'id')::uuid<>result_id then raise exception 'Existing % identity does not match the reviewed ID',group_name; end if;
    if exists(select 1 from jsonb_array_elements(results) prior where prior->>'group'=group_name and prior->>'id'=result_id::text) then raise exception 'Duplicate % row in publication batch',group_name; end if;
    results:=results||jsonb_build_array(jsonb_build_object('group',group_name,'id',result_id));
   end loop;
  end loop;
  if exists(select 1 from public.game_checklist_pages p where p.namespace=target_namespace and p.is_public and p.id in (select (entry->>'id')::uuid from jsonb_array_elements(results) entry where entry->>'group'='checklists' union select i.page_id from public.game_checklist_items i join jsonb_array_elements(results) entry on i.id=(entry->>'id')::uuid where entry->>'group'='checklistItems') and not exists(select 1 from public.game_checklist_items i where i.page_id=p.id and cardinality(string_to_array(i.section_code,'.'))=3)) then raise exception 'Public checklists need checkable tasks'; end if;
  if apply_changes is not true then raise exception 'Validated rollback-only publication' using errcode='PT001'; end if;
 exception when sqlstate 'PT001' then null;
 end;
 return jsonb_build_object('applied',coalesce(apply_changes,false),'rows',results);
end $$;
create or replace function public.move_game_namespace_to_page_type_urls(p_namespace text) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='3s' as $$
declare root public.games; t text; section text; r record; col record; mapping jsonb:='{}'; main_path text; changed bigint; page_count bigint:=0; rewritten bigint:=0; field_count bigint:=0; legacy public.games; legacy_wiki public.game_wiki_pages; target public.site_routes;
begin
 -- BEFORE row/table locks: identical order to Phase 2 publishers/backfill.
 perform pg_catalog.pg_advisory_xact_lock(7823462194301);
 lock table public.games,public.game_wiki_pages,public.game_code_pages,public.game_tool_pages,public.game_map_pages,public.game_quiz_pages,public.game_article_pages,public.game_catalog_pages,public.game_checklist_pages,public.game_collection_pages,public.code_pages,public.wiki_pages,public.wiki_collection_pages,public.quiz_pages,public.checklist_pages,public.tools,public.events_pages,public.articles,public.catalog_pages,public.puzzle_pages in share row exclusive mode;
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
  foreach t in array array['code','tool','map','quiz','article','catalog','checklist'] loop
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
 foreach t in array array['wiki','code','tool','map','quiz','article','catalog','checklist','collection'] loop
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
create or replace function public.rewrite_moved_game_links(p_namespace text) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='3s' as $$
declare mapping jsonb; collection_paths jsonb; col record; changed bigint; rewritten bigint:=0; field_count bigint:=0;
 after_id text; batch_ids text[]; column_changed boolean;
begin
 if position(','||p_namespace||',' in coalesce(current_setting('bloxodes.namespaces_moved_in_transaction',true),''))>0 then
  raise exception 'Link rewrite must run after the namespace move commits: %',p_namespace;
 end if;
 if not exists(select 1 from public.games where namespace=p_namespace and url_style='page_type')
 or exists(select 1 from public.games where namespace=p_namespace and url_style<>'page_type') then
  raise exception 'Namespace must be moved before rewriting links: %',p_namespace;
 end if;
 select coalesce(jsonb_object_agg(path,public.site_route_target(r,path)),'{}'::jsonb) into mapping
 from public.site_routes r where status='old'
 and (path='/'||p_namespace or starts_with(path,'/'||p_namespace||'/'))
 and public.site_route_target(r,path) is not null;
 select coalesce(jsonb_agg(path),'[]'::jsonb) into collection_paths
 from public.site_routes where status='old' and page_type='collection'
 and starts_with(path,'/'||p_namespace||'/');
 -- Only mutable public content columns. Immutable collection revisions/items,
 -- source URLs, identifiers, canonical paths and progress are never rewritten.
 for col in select table_name,column_name,data_type from information_schema.columns
  where table_schema='public' and table_name in ('games','game_wiki_pages','game_collection_pages','game_code_pages','game_tool_pages','game_map_pages','game_quiz_pages','game_article_pages','game_catalog_pages','game_checklist_pages','wiki_pages','wiki_collection_pages','code_pages','quiz_pages','checklist_pages','tools','articles','catalog_pages','events_pages')
  and (column_name like '%\_md' escape '\' or column_name in ('faq_json','description_json','controls_json','quiz_data','map_data','catalog_data')) and data_type in ('text','jsonb','json')
 loop
  after_id:=null; column_changed:=false;
  loop
   execute format('select array_agg(id::text order by id::text) from (select id from public.%I where ($1 is null or id::text>$1) and %I::text like $2 order by id::text limit 200) candidates',col.table_name,col.column_name)
    into batch_ids using after_id,'%/'||p_namespace||'%';
   exit when batch_ids is null;
   after_id:=batch_ids[array_length(batch_ids,1)];
   execute format('update public.%I set %I=(public.rewrite_game_url_links(to_jsonb(%I),$1,$3)%s)::%s where id::text=any($2) and to_jsonb(%I) is distinct from public.rewrite_game_url_links(to_jsonb(%I),$1,$3)',col.table_name,col.column_name,col.column_name,case when col.data_type='text' then '#>>''{}''' else '' end,col.data_type,col.column_name,col.column_name) using mapping,batch_ids,collection_paths;
   get diagnostics changed=row_count;
   rewritten:=rewritten+changed;
   if changed>0 then column_changed:=true; end if;
  end loop;
  if column_changed then field_count:=field_count+1; end if;
 end loop;

 return jsonb_build_object('fields_rewritten',field_count,'row_field_updates',rewritten);
end $$;
create or replace view public.expected_site_routes with (security_invoker=true) as
select 'code_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.code_pages p cross join lateral public.site_page_route('code_pages',to_jsonb(p)) r
union all
select 'wiki_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.wiki_pages p cross join lateral public.site_page_route('wiki_pages',to_jsonb(p)) r
union all
select 'wiki_collection_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.wiki_collection_pages p cross join lateral public.site_page_route('wiki_collection_pages',to_jsonb(p)) r
union all
select 'quiz_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.quiz_pages p cross join lateral public.site_page_route('quiz_pages',to_jsonb(p)) r
union all
select 'checklist_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.checklist_pages p cross join lateral public.site_page_route('checklist_pages',to_jsonb(p)) r
union all
select 'tools'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.tools p cross join lateral public.site_page_route('tools',to_jsonb(p)) r
union all
select 'events_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.events_pages p cross join lateral public.site_page_route('events_pages',to_jsonb(p)) r
union all
select 'articles'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.articles p cross join lateral public.site_page_route('articles',to_jsonb(p)) r
union all
select 'catalog_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.catalog_pages p cross join lateral public.site_page_route('catalog_pages',to_jsonb(p)) r where p.id=(select candidate.id from public.catalog_pages candidate where public.site_catalog_path(candidate.code)=r.path order by (split_part(lower(btrim(candidate.code)),'/',1)='roblox-free-items'),candidate.id::text limit 1) or r.path is null
union all
select 'game_wiki_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.game_wiki_pages p cross join lateral public.site_page_route('game_wiki_pages',to_jsonb(p)) r where not public.is_archived_minecraft_game(p.game_id)
union all
select 'game_collection_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.game_collection_pages p cross join lateral public.site_page_route('game_collection_pages',to_jsonb(p)) r where not public.is_archived_minecraft_game(p.game_id)
union all
select 'game_code_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.game_code_pages p cross join lateral public.site_page_route('game_code_pages',to_jsonb(p)) r
union all
select 'game_tool_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.game_tool_pages p cross join lateral public.site_page_route('game_tool_pages',to_jsonb(p)) r
union all
select 'game_checklist_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.game_checklist_pages p cross join lateral public.site_page_route('game_checklist_pages',to_jsonb(p)) r
union all
select 'game_map_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.game_map_pages p cross join lateral public.site_page_route('game_map_pages',to_jsonb(p)) r
union all
select 'game_quiz_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.game_quiz_pages p cross join lateral public.site_page_route('game_quiz_pages',to_jsonb(p)) r
union all
select 'game_catalog_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.game_catalog_pages p cross join lateral public.site_page_route('game_catalog_pages',to_jsonb(p)) r
union all
select 'puzzle_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.puzzle_pages p cross join lateral public.site_page_route('puzzle_pages',to_jsonb(p)) r
union all
select 'games'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.games p cross join lateral public.site_page_route('games',to_jsonb(p)) r where p.parent_id is null and p.url_style='namespace'
union all
select 'game_article_pages',p.id::text,r.path,r.source,r.page_type,r.game_id from public.game_article_pages p cross join lateral public.site_page_route('game_article_pages',to_jsonb(p)) r;
alter table public.comments drop constraint comments_entity_type_check;
alter table public.comments add constraint comments_entity_type_check check(entity_type in ('code','article','catalog','event','tool','wiki','wiki_collection','gta_wiki','gta_wiki_collection','red_dead_wiki','red_dead_wiki_collection','minecraft_wiki','minecraft_wiki_collection','minecraft_tool','game_wiki','game_collection','game_tool','game_code','game_map','game_article','game_quiz','game_catalog'));
create view public.published_articles_view with(security_invoker=true) as
 select a.id,a.slug,a.title,to_jsonb(a)->>'seo_title' seo_title,a.meta_description,a.cover_image,a.author_id,a.universe_id,
 a.is_published,a.published_at,a.created_at,a.updated_at,null::text namespace,null::uuid game_id,null::text game_title,
 case when u.universe_id is null then null else jsonb_build_object('universe_id',u.universe_id,'slug',u.slug,'display_name',u.display_name,'name',u.name,'icon_url',u.icon_url) end universe,case when au.id is null then null else jsonb_build_object('id',au.id,'name',au.name,'slug',au.slug,'avatar_url',au.avatar_url,'gravatar_email',au.gravatar_email) end author
 from public.articles a left join public.roblox_universes u on u.universe_id=a.universe_id left join public.authors au on au.id=a.author_id where a.is_published
 union all
 select a.id,a.slug,a.title,a.seo_title,a.meta_description,a.cover_image,a.author_id,null::bigint,
 a.is_published,a.published_at,a.created_at,a.updated_at,a.namespace,a.game_id,a.game_title,null::jsonb,case when au.id is null then null else jsonb_build_object('id',au.id,'name',au.name,'slug',au.slug,'avatar_url',au.avatar_url,'gravatar_email',au.gravatar_email) end
 from public.game_article_pages_view a left join public.authors au on au.id=a.author_id;
revoke all on public.published_articles_view from public,anon,authenticated;
grant select on public.published_articles_view to service_role;
create view public.game_article_game_summary with(security_invoker=true) as
 select p.game_id,p.namespace,g.slug game_slug,g.title,g.hero_image icon_url,count(*) article_count,max(p.updated_at) latest_updated_at
 from public.game_article_pages_view p join public.games g on g.id=p.game_id
 group by p.game_id,p.namespace,g.slug,g.title,g.hero_image;
revoke all on public.game_article_game_summary from public,anon,authenticated;
grant select on public.game_article_game_summary to service_role;
notify pgrst,'reload schema';
commit;
