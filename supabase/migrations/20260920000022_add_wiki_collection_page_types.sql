begin;

alter table public.wiki_collection_pages
  add column if not exists page_type text not null default 'database';

alter table public.wiki_collection_pages
  drop constraint if exists wiki_collection_pages_page_type_check;

alter table public.wiki_collection_pages
  add constraint wiki_collection_pages_page_type_check
  check (page_type in ('database', 'checklist'));

create index if not exists idx_wiki_collection_pages_page_type
  on public.wiki_collection_pages (wiki_slug, page_type, wiki_sort_order, title)
  where is_published = true;

drop view if exists public.wiki_collection_pages_view;

create view public.wiki_collection_pages_view
with (security_invoker = true)
as
select
  wcp.id,
  wcp.wiki_page_id,
  wcp.universe_id,
  wcp.wiki_slug,
  wcp.collection_slug,
  wcp.code,
  wcp.page_type,
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
  greatest(wcp.updated_at, coalesce(wcp.published_at, wcp.updated_at)) as content_updated_at,
  wcp.published_dataset_id
from public.wiki_collection_pages wcp;

revoke all on table public.wiki_collection_pages_view from anon, authenticated;
grant select on table public.wiki_collection_pages_view to anon, authenticated;
grant all on table public.wiki_collection_pages_view to service_role;

commit;
