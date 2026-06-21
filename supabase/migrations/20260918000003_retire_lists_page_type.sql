-- Retire the /lists page type. Old web routes now redirect to /stats, so the
-- backing DB objects and automation hooks should stop emitting list work.

delete from public.search_index
where entity_type = 'list';

delete from public.comments
where entity_type = 'list';

delete from public.revalidation_events
where entity_type = 'list';

delete from public.cache_warm_events
where path = '/lists'
   or path like '/lists/%'
   or path = '/sitemaps/lists.xml';

create or replace function public.trg_enqueue_revalidation_code_pages() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      perform public.enqueue_revalidation('code', old.slug, 'code_pages_delete');
      perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'code_pages_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    perform public.enqueue_revalidation('code', new.slug, 'code_pages_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_universe(new.universe_id, 'code_pages_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'code_pages_wiki_update_old');

    if old.slug is distinct from new.slug or new.is_published is distinct from true then
      perform public.enqueue_revalidation('code', old.slug, 'code_pages_old_slug_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.trg_enqueue_revalidation_codes() returns trigger
language plpgsql
as $$
declare
  target_code_page_ids uuid[];
  code_page_record record;
begin
  if tg_op = 'DELETE' then
    target_code_page_ids := array_remove(array[old.code_page_id], null);
  elsif tg_op = 'INSERT' then
    target_code_page_ids := array_remove(array[new.code_page_id], null);
  else
    target_code_page_ids := array_remove(array[old.code_page_id, new.code_page_id], null);
  end if;

  for code_page_record in
    select distinct cp.id, cp.slug, cp.universe_id
    from public.code_pages cp
    where cp.id = any(target_code_page_ids)
      and cp.is_published = true
      and cp.slug is not null
      and trim(cp.slug) <> ''
  loop
    perform public.enqueue_revalidation('code', code_page_record.slug, 'codes_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_universe(code_page_record.universe_id, 'codes_wiki_' || lower(tg_op));
  end loop;

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
  should_revalidate boolean := false;
begin
  if tg_op = 'DELETE' then
    target_entity_type := old.entity_type;
    target_entity_id := old.entity_id;
    should_revalidate := old.status = 'approved';
  elsif tg_op = 'INSERT' then
    target_entity_type := new.entity_type;
    target_entity_id := new.entity_id;
    should_revalidate := new.status = 'approved';
  else
    target_entity_type := new.entity_type;
    target_entity_id := new.entity_id;
    should_revalidate :=
      old.status = 'approved'
      or new.status = 'approved'
      or old.body_md is distinct from new.body_md
      or old.entity_type is distinct from new.entity_type
      or old.entity_id is distinct from new.entity_id;
  end if;

  if not should_revalidate or target_entity_id is null then
    return null;
  end if;

  if target_entity_type = 'code' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'code', lower(cp.slug), 'comments_code_' || lower(tg_op)
    from public.code_pages cp
    where cp.id = target_entity_id
      and cp.is_published = true
      and cp.slug is not null
      and trim(cp.slug) <> ''
    on conflict (entity_type, slug)
    do update set created_at = now(), source = excluded.source;
  elsif target_entity_type = 'article' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'article', lower(a.slug), 'comments_article_' || lower(tg_op)
    from public.articles a
    where a.id = target_entity_id
      and a.is_published = true
      and a.slug is not null
      and trim(a.slug) <> ''
    on conflict (entity_type, slug)
    do update set created_at = now(), source = excluded.source;
  elsif target_entity_type = 'catalog' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'catalog', lower(c.code), 'comments_catalog_' || lower(tg_op)
    from public.catalog_pages c
    where c.id = target_entity_id
      and c.is_published = true
      and c.code is not null
      and trim(c.code) <> ''
    on conflict (entity_type, slug)
    do update set created_at = now(), source = excluded.source;
  elsif target_entity_type = 'event' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'event', lower(e.slug), 'comments_event_' || lower(tg_op)
    from public.events_pages e
    where e.id = target_entity_id
      and e.is_published = true
      and e.slug is not null
      and trim(e.slug) <> ''
    on conflict (entity_type, slug)
    do update set created_at = now(), source = excluded.source;
  elsif target_entity_type = 'tool' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'tool', lower(t.code), 'comments_tool_' || lower(tg_op)
    from public.tools t
    where t.id = target_entity_id
      and t.is_published = true
      and t.code is not null
      and trim(t.code) <> ''
    on conflict (entity_type, slug)
    do update set created_at = now(), source = excluded.source;
  elsif target_entity_type = 'wiki' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'wiki', lower(w.slug), 'comments_wiki_' || lower(tg_op)
    from public.wiki_pages w
    where w.id = target_entity_id
      and w.is_published = true
      and w.slug is not null
      and trim(w.slug) <> ''
    on conflict (entity_type, slug)
    do update set created_at = now(), source = excluded.source;
  elsif target_entity_type = 'wiki_catalog' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'wiki_catalog', lower(wcp.wiki_slug || '/' || wcp.collection_slug), 'comments_wiki_catalog_' || lower(tg_op)
    from public.wiki_catalog_pages wcp
    where wcp.id = target_entity_id
      and wcp.is_published = true
      and wcp.wiki_slug is not null
      and trim(wcp.wiki_slug) <> ''
      and wcp.collection_slug is not null
      and trim(wcp.collection_slug) <> ''
    on conflict (entity_type, slug)
    do update set created_at = now(), source = excluded.source;
  end if;

  return null;
end;
$$;

do $$
begin
  if to_regclass('public.game_list_entries') is not null then
    drop trigger if exists trg_enqueue_revalidation_game_list_entries on public.game_list_entries;
    drop trigger if exists trg_game_list_entries_updated_at on public.game_list_entries;
  end if;

  if to_regclass('public.game_lists') is not null then
    drop trigger if exists trg_enqueue_revalidation_game_lists on public.game_lists;
    drop trigger if exists trg_game_lists_updated_at on public.game_lists;
    drop trigger if exists trg_search_index_game_lists on public.game_lists;
  end if;

  if to_regclass('public.roblox_universes') is not null then
    drop trigger if exists trg_enqueue_revalidation_lists_roblox_universes on public.roblox_universes;
  end if;
end
$$;

drop view if exists public.game_lists_view;
drop view if exists public.game_lists_index_view;

drop table if exists public.game_list_entries;
drop table if exists public.game_lists;

drop function if exists public.enqueue_list_revalidation_for_universe(bigint, text);
drop function if exists public.enqueue_wiki_revalidation_for_list(uuid, text);
drop function if exists public.run_game_list_sql(text, integer);
drop function if exists public.trg_enqueue_revalidation_game_list_entries();
drop function if exists public.trg_enqueue_revalidation_game_lists();
drop function if exists public.trg_enqueue_revalidation_lists_roblox_universe();
drop function if exists public.trg_search_index_game_lists();

alter table public.comments
  drop constraint if exists comments_entity_type_check;

alter table public.comments
  add constraint comments_entity_type_check
  check (entity_type in ('code', 'article', 'catalog', 'event', 'tool', 'wiki', 'wiki_catalog'));

alter table public.revalidation_events
  drop constraint if exists revalidation_events_entity_type_check;

alter table public.revalidation_events
  add constraint revalidation_events_entity_type_check
  check (entity_type in ('code','article','author','event','checklist','tool','catalog','music','quiz','wiki','wiki_catalog','stats','puzzle'));
