-- Wiki catalog preview images are now derived from local dataset files by catalog code.
drop view if exists public.catalog_pages_view;

alter table if exists public.catalog_pages
  drop column if exists wiki_image_urls;

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
