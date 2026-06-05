alter table public.wiki_catalog_pages
  add column if not exists display_name text,
  add column if not exists item_count integer;

alter table public.wiki_catalog_pages
  drop constraint if exists wiki_catalog_pages_display_name_not_blank,
  drop constraint if exists wiki_catalog_pages_item_count_nonnegative;

alter table public.wiki_catalog_pages
  add constraint wiki_catalog_pages_display_name_not_blank
    check (display_name is null or length(btrim(display_name)) > 0),
  add constraint wiki_catalog_pages_item_count_nonnegative
    check (item_count is null or item_count >= 0);

update public.wiki_catalog_pages wcp
set
  display_name = coalesce(
    nullif(btrim(wcp.display_name), ''),
    nullif(
      btrim(
        regexp_replace(
          regexp_replace(
            regexp_replace(wcp.title, '^All\s+\d+\s+', '', 'i'),
            '\s+in\s+' || regexp_replace(coalesce(ctx.universe_display_name, ctx.universe_name, ctx.wiki_title, ''), '([\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:\-])', '\\\1', 'g') || '(\s*:.*)?$',
            '',
            'i'
          ),
          '\s+in\s+' || regexp_replace(coalesce(ctx.wiki_title, ''), '([\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:\-])', '\\\1', 'g') || '(\s*:.*)?$',
          '',
          'i'
        )
      ),
      ''
    )
  ),
  item_count = coalesce(
    wcp.item_count,
    nullif(substring(wcp.title from '^All\s+(\d+)\s+'), '')::integer
  )
from (
  select
    source.id,
    wp.title as wiki_title,
    u.display_name as universe_display_name,
    u.name as universe_name
  from public.wiki_catalog_pages source
  left join public.wiki_pages wp on wp.slug = source.wiki_slug
  left join public.roblox_universes u on u.universe_id = coalesce(source.universe_id, wp.universe_id)
) ctx
where ctx.id = wcp.id
  and (
    wcp.display_name is null
    or btrim(wcp.display_name) = ''
    or wcp.item_count is null
  );

drop view if exists public.wiki_catalog_pages_view;

create or replace view public.wiki_catalog_pages_view
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
from public.wiki_catalog_pages wcp;

grant all on table public.wiki_catalog_pages_view to anon;
grant all on table public.wiki_catalog_pages_view to authenticated;
grant all on table public.wiki_catalog_pages_view to service_role;

create or replace function public.trg_search_index_wiki_catalog_pages()
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
    where entity_type = 'wiki_catalog'
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
    'wiki_catalog',
    new.id::text,
    v_slug,
    new.title,
    'Wiki catalog',
    '/wiki/' || v_slug,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;
