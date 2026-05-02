-- Catalog links are derived from code as /catalog/[code].
-- Wiki catalog CTA labels use catalog_pages.title directly.
drop view if exists public.catalog_pages_view;

alter table public.catalog_pages
  drop column if exists cta_label,
  drop column if exists cta_url,
  drop column if exists wiki_item_count;

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
  wiki_image_urls,
  greatest(updated_at, coalesce(published_at, updated_at)) as content_updated_at
from public.catalog_pages cp;
