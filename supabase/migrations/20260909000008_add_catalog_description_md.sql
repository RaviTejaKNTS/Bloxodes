-- Add writer-friendly Markdown body copy for catalog pages.
-- description_json stays for optional ordered/section-positioned content.

drop view if exists public.catalog_pages_view;

alter table if exists public.catalog_pages
  add column if not exists description_md text;

create or replace view public.catalog_pages_view
with (security_invoker = true)
as
select
  id,
  code,
  title,
  seo_title,
  meta_description,
  intro_md,
  how_it_works_md,
  description_md,
  description_json,
  faq_json,
  schema_ld_json,
  thumb_url,
  is_published,
  published_at,
  created_at,
  updated_at,
  universe_id,
  wiki_md,
  wiki_sort_order,
  greatest(updated_at, coalesce(published_at, updated_at)) as content_updated_at
from public.catalog_pages cp;

create or replace function public.trg_search_index_catalog_pages()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'catalog'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.title,
      new.code,
      new.seo_title,
      new.meta_description,
      new.intro_md,
      new.description_md,
      new.how_it_works_md
    ),
    3000
  );

  perform public.upsert_search_index(
    'catalog',
    new.id::text,
    new.code,
    new.title,
    'Catalog',
    '/catalog/' || new.code,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;
