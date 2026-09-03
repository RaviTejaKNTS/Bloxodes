-- Remove the unshipped GTA tools surface until there is a real tool to publish.
begin;

delete from public.comments where entity_type = 'gta_tool';
delete from public.revalidation_events where entity_type = 'gta_tool';
delete from public.search_index where entity_type = 'gta_tool';

create or replace function public.trg_comments_revalidate_entity()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  target_entity_type text;
  target_entity_id uuid;
  event_source text;
begin
  if tg_op = 'DELETE' then
    target_entity_type := old.entity_type;
    target_entity_id := old.entity_id;
    event_source := 'comments_delete';
  else
    target_entity_type := new.entity_type;
    target_entity_id := new.entity_id;
    event_source := 'comments_' || lower(tg_op);
  end if;

  if target_entity_type = 'code' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'code', lower(page.slug), event_source from public.code_pages page where page.id = target_entity_id;
  elsif target_entity_type = 'article' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'article', lower(page.slug), event_source from public.articles page where page.id = target_entity_id;
  elsif target_entity_type = 'catalog' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'catalog', lower(page.code), event_source from public.catalog_pages page where page.id = target_entity_id;
  elsif target_entity_type = 'event' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'event', lower(page.slug), event_source from public.events_pages page where page.id = target_entity_id;
  elsif target_entity_type = 'tool' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'tool', lower(page.code), event_source from public.tools page where page.id = target_entity_id;
  elsif target_entity_type = 'wiki' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'wiki', lower(page.slug), event_source from public.wiki_pages page where page.id = target_entity_id;
  elsif target_entity_type = 'wiki_collection' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'wiki_collection', lower(page.wiki_slug || '/' || page.collection_slug), event_source
    from public.wiki_collection_pages page where page.id = target_entity_id;
  elsif target_entity_type = 'gta_wiki' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'gta_wiki', lower(page.slug), event_source from public.gta_wiki_pages page where page.id = target_entity_id;
  elsif target_entity_type = 'gta_wiki_collection' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'gta_wiki_collection', lower(page.wiki_slug || '/' || page.collection_slug), event_source
    from public.gta_wiki_collection_pages page where page.id = target_entity_id;
  end if;
  return null;
end;
$$;

drop view if exists public.gta_tools_view;
drop table if exists public.gta_tools;

alter table public.revalidation_events drop constraint if exists revalidation_events_entity_type_check;
alter table public.revalidation_events add constraint revalidation_events_entity_type_check
  check (entity_type in (
    'code','article','author','event','checklist','tool','catalog','music','quiz','wiki','wiki_collection','stats','puzzle',
    'gta_game','gta_wiki','gta_wiki_collection'
  ));

alter table public.comments drop constraint if exists comments_entity_type_check;
alter table public.comments add constraint comments_entity_type_check
  check (entity_type in (
    'code','article','catalog','event','tool','wiki','wiki_collection',
    'gta_wiki','gta_wiki_collection'
  ));

create or replace function public.trg_enqueue_revalidation_gta_content()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  event_type text;
  event_slug text;
  old_slug text;
begin
  event_type := case tg_table_name
    when 'gta_games' then 'gta_game'
    when 'gta_wiki_pages' then 'gta_wiki'
    when 'gta_wiki_collection_pages' then 'gta_wiki_collection'
  end;

  if tg_op = 'DELETE' then
    if coalesce((to_jsonb(old) ->> 'is_published')::boolean, false) then
      event_slug := case
        when tg_table_name = 'gta_wiki_collection_pages' then (to_jsonb(old) ->> 'wiki_slug') || '/' || (to_jsonb(old) ->> 'collection_slug')
        else to_jsonb(old) ->> 'slug'
      end;
      perform public.enqueue_revalidation(event_type, event_slug, tg_table_name || '_delete');
    end if;
    return null;
  end if;

  if coalesce((to_jsonb(new) ->> 'is_published')::boolean, false) then
    event_slug := case
      when tg_table_name = 'gta_wiki_collection_pages' then (to_jsonb(new) ->> 'wiki_slug') || '/' || (to_jsonb(new) ->> 'collection_slug')
      else to_jsonb(new) ->> 'slug'
    end;
    perform public.enqueue_revalidation(event_type, event_slug, tg_table_name || '_' || lower(tg_op));
  end if;

  old_slug := case
    when tg_op <> 'UPDATE' then null
    when tg_table_name = 'gta_wiki_collection_pages' then (to_jsonb(old) ->> 'wiki_slug') || '/' || (to_jsonb(old) ->> 'collection_slug')
    else to_jsonb(old) ->> 'slug'
  end;

  if tg_op = 'UPDATE' and coalesce((to_jsonb(old) ->> 'is_published')::boolean, false) and (
    not coalesce((to_jsonb(new) ->> 'is_published')::boolean, false)
    or old_slug is distinct from event_slug
  ) then
    perform public.enqueue_revalidation(event_type, old_slug, tg_table_name || '_old_slug_or_unpublish');
  end if;

  return null;
end;
$$;

create or replace function public.trg_search_index_gta_content()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  kind text;
  target_slug text;
  target_title text;
  target_subtitle text;
  target_url text;
  target_search text;
begin
  if tg_table_name = 'gta_games' then
    delete from public.search_index
    where entity_type = 'gta_game'
      and entity_id = case when tg_op = 'DELETE' then old.id::text else new.id::text end;
    return null;
  end if;

  kind := case tg_table_name
    when 'gta_wiki_pages' then 'gta_wiki'
    when 'gta_wiki_collection_pages' then 'gta_wiki_collection'
  end;

  if tg_op = 'DELETE' then
    delete from public.search_index where entity_type = kind and entity_id = old.id::text;
    return null;
  end if;

  if tg_table_name = 'gta_wiki_pages' then
    target_slug := new.slug;
    target_title := new.title;
    target_subtitle := 'GTA wiki';
    target_url := '/gta/wiki/' || new.slug;
    target_search := concat_ws(' ', new.title, new.slug, new.seo_title, new.meta_description, new.description_md, new.tips_md);
  else
    target_slug := new.wiki_slug || '/' || new.collection_slug;
    target_title := new.title;
    target_subtitle := 'GTA wiki collection';
    target_url := '/gta/wiki/' || target_slug;
    target_search := concat_ws(' ', new.title, new.display_name, new.code, new.wiki_slug, new.collection_slug, new.seo_title, new.meta_description, new.intro_md, new.description_md, new.how_it_works_md, new.wiki_md);
  end if;

  perform public.upsert_search_index(
    kind,
    new.id::text,
    target_slug,
    target_title,
    target_subtitle,
    target_url,
    new.updated_at,
    new.is_published,
    left(target_search, 4000)
  );
  return null;
end;
$$;

revoke all on function public.trg_enqueue_revalidation_gta_content() from public;
revoke all on function public.trg_search_index_gta_content() from public;
grant execute on function public.trg_enqueue_revalidation_gta_content() to service_role;
grant execute on function public.trg_search_index_gta_content() to service_role;

notify pgrst, 'reload schema';

commit;
