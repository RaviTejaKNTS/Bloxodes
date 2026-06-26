begin;

drop view if exists public.wiki_collection_pages_view;
drop view if exists public.wiki_catalog_pages_view;

alter table if exists public.comments
  drop constraint if exists comments_entity_type_check;

alter table if exists public.revalidation_events
  drop constraint if exists revalidation_events_entity_type_check;

update public.comments
set entity_type = 'wiki_collection'
where entity_type = 'wiki_catalog';

update public.revalidation_events
set entity_type = 'wiki_collection'
where entity_type = 'wiki_catalog';

update public.search_index
set
  entity_type = 'wiki_collection',
  subtitle = case when subtitle = 'Wiki catalog' then 'Wiki collection' else subtitle end
where entity_type = 'wiki_catalog';

alter table if exists public.wiki_catalog_pages
  rename to wiki_collection_pages;

alter table if exists public.wiki_collection_pages
  rename constraint wiki_catalog_pages_pkey to wiki_collection_pages_pkey;
alter table if exists public.wiki_collection_pages
  rename constraint wiki_catalog_pages_code_key to wiki_collection_pages_code_key;
alter table if exists public.wiki_collection_pages
  rename constraint wiki_catalog_pages_path_key to wiki_collection_pages_path_key;
alter table if exists public.wiki_collection_pages
  rename constraint wiki_catalog_pages_wiki_slug_not_blank to wiki_collection_pages_wiki_slug_not_blank;
alter table if exists public.wiki_collection_pages
  rename constraint wiki_catalog_pages_collection_slug_not_blank to wiki_collection_pages_collection_slug_not_blank;
alter table if exists public.wiki_collection_pages
  rename constraint wiki_catalog_pages_code_not_blank to wiki_collection_pages_code_not_blank;
alter table if exists public.wiki_collection_pages
  rename constraint wiki_catalog_pages_display_name_not_blank to wiki_collection_pages_display_name_not_blank;
alter table if exists public.wiki_collection_pages
  rename constraint wiki_catalog_pages_item_count_nonnegative to wiki_collection_pages_item_count_nonnegative;
alter table if exists public.wiki_collection_pages
  rename constraint wiki_catalog_pages_universe_id_fkey to wiki_collection_pages_universe_id_fkey;
alter table if exists public.wiki_collection_pages
  rename constraint wiki_catalog_pages_wiki_page_id_fkey to wiki_collection_pages_wiki_page_id_fkey;

alter index if exists public.idx_wiki_catalog_pages_is_published
  rename to idx_wiki_collection_pages_is_published;
alter index if exists public.idx_wiki_catalog_pages_universe_id
  rename to idx_wiki_collection_pages_universe_id;
alter index if exists public.idx_wiki_catalog_pages_wiki_sort
  rename to idx_wiki_collection_pages_wiki_sort;

do $$
begin
  if to_regprocedure('public.trg_enqueue_revalidation_wiki_catalog_pages()') is not null
     and to_regprocedure('public.trg_enqueue_revalidation_wiki_collection_pages()') is null then
    alter function public.trg_enqueue_revalidation_wiki_catalog_pages()
      rename to trg_enqueue_revalidation_wiki_collection_pages;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('public.trg_search_index_wiki_catalog_pages()') is not null
     and to_regprocedure('public.trg_search_index_wiki_collection_pages()') is null then
    alter function public.trg_search_index_wiki_catalog_pages()
      rename to trg_search_index_wiki_collection_pages;
  end if;
end
$$;

alter table public.comments
  add constraint comments_entity_type_check
  check (entity_type in ('code', 'article', 'catalog', 'event', 'tool', 'wiki', 'wiki_collection'));

alter table public.revalidation_events
  add constraint revalidation_events_entity_type_check
  check (entity_type in ('code','article','author','event','checklist','tool','catalog','music','quiz','wiki','wiki_collection','stats','puzzle'));

create or replace view public.wiki_collection_pages_view
with (security_invoker = true)
as
select
  wcp.id,
  wcp.wiki_page_id,
  wcp.universe_id,
  wcp.wiki_slug,
  wcp.collection_slug,
  wcp.code,
  wcp.title,
  wcp.display_name,
  wcp.item_count,
  wcp.seo_title,
  wcp.meta_description,
  wcp.intro_md,
  wcp.how_it_works_md,
  wcp.description_md,
  wcp.description_json,
  wcp.faq_json,
  wcp.schema_ld_json,
  wcp.thumb_url,
  wcp.wiki_md,
  wcp.wiki_sort_order,
  wcp.is_published,
  wcp.published_at,
  wcp.created_at,
  wcp.updated_at,
  greatest(wcp.updated_at, coalesce(wcp.published_at, wcp.updated_at)) as content_updated_at
from public.wiki_collection_pages wcp;

grant all on table public.wiki_collection_pages_view to anon;
grant all on table public.wiki_collection_pages_view to authenticated;
grant all on table public.wiki_collection_pages_view to service_role;

grant all on table public.wiki_collection_pages to anon;
grant all on table public.wiki_collection_pages to authenticated;
grant all on table public.wiki_collection_pages to service_role;

create or replace function public.trg_enqueue_revalidation_wiki_collection_pages()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  new_slug text;
  old_slug text;
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      old_slug := old.wiki_slug || '/' || old.collection_slug;
      perform public.enqueue_revalidation('wiki_collection', old_slug, 'wiki_collection_pages_delete');
      perform public.enqueue_revalidation('wiki', old.wiki_slug, 'wiki_collection_pages_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    new_slug := new.wiki_slug || '/' || new.collection_slug;
    perform public.enqueue_revalidation('wiki_collection', new_slug, 'wiki_collection_pages_' || lower(tg_op));
    perform public.enqueue_revalidation('wiki', new.wiki_slug, 'wiki_collection_pages_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('wiki', old.wiki_slug, 'wiki_collection_pages_wiki_update_old');

    if old.wiki_slug is distinct from new.wiki_slug
      or old.collection_slug is distinct from new.collection_slug
      or new.is_published is distinct from true then
      old_slug := old.wiki_slug || '/' || old.collection_slug;
      perform public.enqueue_revalidation('wiki_collection', old_slug, 'wiki_collection_pages_old_slug_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.trg_search_index_wiki_collection_pages()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_search text;
  v_slug text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'wiki_collection'
      and entity_id = old.id::text;
    return null;
  end if;

  v_slug := new.wiki_slug || '/' || new.collection_slug;
  v_search := left(
    concat_ws(
      ' ',
      new.title,
      new.display_name,
      new.code,
      new.wiki_slug,
      new.collection_slug,
      new.seo_title,
      new.meta_description,
      new.intro_md,
      new.description_md,
      new.how_it_works_md,
      new.wiki_md
    ),
    3000
  );

  perform public.upsert_search_index(
    'wiki_collection',
    new.id::text,
    v_slug,
    new.title,
    'Wiki collection',
    '/wiki/' || v_slug,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;

create or replace function public.trg_comments_revalidate_entity()
returns trigger
language plpgsql
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
    select 'code', lower(g.slug), event_source
    from public.code_pages g
    where g.id = target_entity_id;
  elsif target_entity_type = 'article' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'article', lower(a.slug), event_source
    from public.articles a
    where a.id = target_entity_id;
  elsif target_entity_type = 'catalog' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'catalog', lower(c.code), event_source
    from public.catalog_pages c
    where c.id = target_entity_id;
  elsif target_entity_type = 'event' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'event', lower(e.slug), event_source
    from public.events_pages e
    where e.id = target_entity_id;
  elsif target_entity_type = 'tool' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'tool', lower(t.code), event_source
    from public.tools t
    where t.id = target_entity_id;
  elsif target_entity_type = 'wiki' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'wiki', lower(w.slug), event_source
    from public.wiki_pages w
    where w.id = target_entity_id;
  elsif target_entity_type = 'wiki_collection' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'wiki_collection', lower(wcp.wiki_slug || '/' || wcp.collection_slug), event_source
    from public.wiki_collection_pages wcp
    where wcp.id = target_entity_id;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_wiki_catalog_pages on public.wiki_collection_pages;
drop trigger if exists trg_enqueue_revalidation_wiki_collection_pages on public.wiki_collection_pages;
create trigger trg_enqueue_revalidation_wiki_collection_pages
after insert or update or delete on public.wiki_collection_pages
for each row execute function public.trg_enqueue_revalidation_wiki_collection_pages();

drop trigger if exists trg_search_index_wiki_catalog_pages on public.wiki_collection_pages;
drop trigger if exists trg_search_index_wiki_collection_pages on public.wiki_collection_pages;
create trigger trg_search_index_wiki_collection_pages
after insert or update or delete on public.wiki_collection_pages
for each row execute function public.trg_search_index_wiki_collection_pages();

drop trigger if exists trg_set_wiki_catalog_page_published_at on public.wiki_collection_pages;
drop trigger if exists trg_set_wiki_collection_page_published_at on public.wiki_collection_pages;
create trigger trg_set_wiki_collection_page_published_at
before insert or update on public.wiki_collection_pages
for each row execute function public.set_catalog_page_published_at();

drop trigger if exists trg_wiki_catalog_pages_updated_at on public.wiki_collection_pages;
drop trigger if exists trg_wiki_collection_pages_updated_at on public.wiki_collection_pages;
create trigger trg_wiki_collection_pages_updated_at
before update on public.wiki_collection_pages
for each row execute function public.set_updated_at();

drop trigger if exists trg_comments_revalidate_entity on public.comments;
create trigger trg_comments_revalidate_entity
after insert or update or delete on public.comments
for each row execute function public.trg_comments_revalidate_entity();

grant all on function public.trg_enqueue_revalidation_wiki_collection_pages() to anon;
grant all on function public.trg_enqueue_revalidation_wiki_collection_pages() to authenticated;
grant all on function public.trg_enqueue_revalidation_wiki_collection_pages() to service_role;
grant all on function public.trg_search_index_wiki_collection_pages() to anon;
grant all on function public.trg_search_index_wiki_collection_pages() to authenticated;
grant all on function public.trg_search_index_wiki_collection_pages() to service_role;

commit;
