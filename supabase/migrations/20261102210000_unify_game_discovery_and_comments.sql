begin;
set local lock_timeout = '3s';
-- Serialize with namespace moves and publishers; do not change page identities.
select pg_advisory_xact_lock(7823462194301);
-- The existing constraint already allows both shared and legacy values.
-- Keep it for the deployment overlap: no DDL lock or full-table validation here.
update public.comments set entity_type = case
 when entity_type like '%_wiki_collection' then 'game_collection'
 when entity_type like '%_tool' then 'game_tool'
 else 'game_wiki' end
where entity_type in ('gta_wiki','gta_wiki_collection','red_dead_wiki','red_dead_wiki_collection','minecraft_wiki','minecraft_wiki_collection','minecraft_tool');
-- IDs, parent IDs, bodies, moderation, authors and archived page ownership stay intact.
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
  select p.id,p.namespace,p.slug,p.title,p.meta_description,p.canonical_path,p.updated_at,p.is_published and g.is_published and coalesce(parent.is_published,true) and coalesce(p.published_at<=now(),true),'catalog' from public.game_catalog_pages p join public.games g on g.id=p.game_id left join public.games parent on parent.id=g.parent_id where p.namespace=target_namespace or target_namespace is null
 ) pages
 where nullif(trim(slug),'') is not null and nullif(trim(title),'') is not null and nullif(trim(canonical_path),'') is not null
 on conflict(entity_type,entity_id) do update set
 slug=excluded.slug,title=excluded.title,subtitle=excluded.subtitle,url=excluded.url,
 updated_at=excluded.updated_at,is_published=excluded.is_published,search_text=excluded.search_text;
end $$;
-- The bulk search rebuild ships separately. No search rows are changed here.

-- Queued old events must not be rejected by the generic-only endpoint.
-- A namespace event covers every owner, including legacy deleted-page aliases.
do $$ declare ns text; begin
 for ns in select distinct case
  when entity_type like 'gta_%' then 'gta'
  when entity_type like 'red_dead_%' then 'red-dead'
  when entity_type like 'minecraft_%' then 'minecraft' end
 from public.revalidation_events where entity_type ~ '^(gta|red_dead|minecraft)_'
 loop perform public.enqueue_revalidation('game_content',ns,'unified_plumbing'); end loop;
 delete from public.revalidation_events where entity_type ~ '^(gta|red_dead|minecraft)_';
end $$;

-- All old Minecraft links now use the registry's default owner. The bare
-- wiki defaults to Java; achievements already owns an exact Bedrock alias.
do $$ declare w public.game_wiki_pages; begin
 select * into strict w from public.game_wiki_pages
 where namespace='minecraft' and slug='minecraft-java';
 update public.site_routes set source='game',page_type='wiki',page_id=w.id::text,
  game_id=w.game_id,target_url=null,match_type='exact',tail_mode='append',match_self=true,
  redirect_code=308,updated_at=now() where path='/minecraft/wiki' and status='old';
 if not found then raise exception 'Missing legacy Minecraft wiki route'; end if;
 update public.site_routes set redirect_code=308,updated_at=now()
 where status='old' and path like '/minecraft/%';
end $$;
CREATE OR REPLACE FUNCTION public.trg_comments_revalidate_game_content() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
declare row_data jsonb; target_table text; page_path text;
begin
 for row_data in select v from (values(case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end),(case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end)) r(v) where v is not null loop
  target_table:=case when row_data->>'entity_type' ='game_wiki' then 'game_wiki_pages' when row_data->>'entity_type' ='game_collection' then 'game_collection_pages' when row_data->>'entity_type' ='game_tool' then 'game_tool_pages' when row_data->>'entity_type'='game_code' then 'game_code_pages' when row_data->>'entity_type'='game_map' then 'game_map_pages' when row_data->>'entity_type'='game_quiz' then 'game_quiz_pages' when row_data->>'entity_type'='game_catalog' then 'game_catalog_pages' end;
  if target_table is not null then
   execute format('select canonical_path from public.%I where id=$1',target_table) into page_path using (row_data->>'entity_id')::uuid;
   if page_path is not null then perform public.enqueue_revalidation('game_content',ltrim(page_path,'/'),'comments_'||lower(tg_op)); end if;
  end if;
 end loop;
 return null;
end $_$;



notify pgrst, 'reload schema';
commit;
