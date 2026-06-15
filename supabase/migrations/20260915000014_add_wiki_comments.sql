alter table public.comments
  add column if not exists page_type text,
  add column if not exists page_url text;

alter table public.comments
  drop constraint if exists comments_entity_type_check;

update public.comments c
set entity_type = 'wiki_catalog'
from public.wiki_catalog_pages wcp
where c.entity_type = 'catalog'
  and c.entity_id = wcp.id;

alter table public.comments
  add constraint comments_entity_type_check
  check (entity_type in ('code', 'article', 'catalog', 'event', 'list', 'tool', 'wiki', 'wiki_catalog'));

create index if not exists idx_comments_page_type_created
  on public.comments (page_type, created_at desc);

update public.comments c
set
  page_type = 'Code',
  page_url = 'https://bloxodes.com/codes/' || g.slug
from public.games g
where c.entity_type = 'code'
  and c.entity_id = g.id
  and g.slug is not null
  and trim(g.slug) <> '';

update public.comments c
set
  page_type = 'Article',
  page_url = 'https://bloxodes.com/articles/' || a.slug
from public.articles a
where c.entity_type = 'article'
  and c.entity_id = a.id
  and a.slug is not null
  and trim(a.slug) <> '';

update public.comments c
set
  page_type = 'Catalog',
  page_url = 'https://bloxodes.com/catalog/' || cp.code
from public.catalog_pages cp
where c.entity_type = 'catalog'
  and c.entity_id = cp.id
  and cp.code is not null
  and trim(cp.code) <> '';

update public.comments c
set
  page_type = 'Event',
  page_url = 'https://bloxodes.com/events/' || ep.slug
from public.events_pages ep
where c.entity_type = 'event'
  and c.entity_id = ep.id
  and ep.slug is not null
  and trim(ep.slug) <> '';

update public.comments c
set
  page_type = 'List',
  page_url = 'https://bloxodes.com/lists/' || gl.slug
from public.game_lists gl
where c.entity_type = 'list'
  and c.entity_id = gl.id
  and gl.slug is not null
  and trim(gl.slug) <> '';

update public.comments c
set
  page_type = 'Tool',
  page_url = 'https://bloxodes.com/tools/' || t.code
from public.tools t
where c.entity_type = 'tool'
  and c.entity_id = t.id
  and t.code is not null
  and trim(t.code) <> '';

update public.comments c
set
  page_type = 'Wiki',
  page_url = 'https://bloxodes.com/wiki/' || wp.slug
from public.wiki_pages wp
where c.entity_type = 'wiki'
  and c.entity_id = wp.id
  and wp.slug is not null
  and trim(wp.slug) <> '';

update public.comments c
set
  page_type = 'Wiki Catalog',
  page_url = 'https://bloxodes.com/wiki/' || wcp.wiki_slug || '/' || wcp.collection_slug
from public.wiki_catalog_pages wcp
where c.entity_type = 'wiki_catalog'
  and c.entity_id = wcp.id
  and wcp.wiki_slug is not null
  and trim(wcp.wiki_slug) <> ''
  and wcp.collection_slug is not null
  and trim(wcp.collection_slug) <> '';

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
    select 'code', lower(g.slug), 'comments_code_' || lower(tg_op)
    from public.games g
    where g.id = target_entity_id
      and g.is_published = true
      and g.slug is not null
      and trim(g.slug) <> ''
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
  elsif target_entity_type = 'list' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'list', lower(gl.slug), 'comments_list_' || lower(tg_op)
    from public.game_lists gl
    where gl.id = target_entity_id
      and gl.is_published = true
      and gl.slug is not null
      and trim(gl.slug) <> ''
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
