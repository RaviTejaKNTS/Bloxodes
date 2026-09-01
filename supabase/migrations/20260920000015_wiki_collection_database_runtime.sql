create table if not exists public.wiki_collection_datasets (
  id uuid primary key default extensions.uuid_generate_v4(),
  collection_page_id uuid not null,
  schema_version integer not null default 2,
  content_hash text not null,
  item_count integer not null,
  meta_json jsonb not null default '{}'::jsonb,
  validation_json jsonb not null default '{}'::jsonb,
  source_manifest_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wiki_collection_datasets_page_fkey
    foreign key (collection_page_id)
    references public.wiki_collection_pages(id),
  constraint wiki_collection_datasets_page_hash_key
    unique (collection_page_id, content_hash),
  constraint wiki_collection_datasets_id_page_key
    unique (id, collection_page_id),
  constraint wiki_collection_datasets_schema_version_positive
    check (schema_version > 0),
  constraint wiki_collection_datasets_item_count_nonnegative
    check (item_count >= 0),
  constraint wiki_collection_datasets_content_hash_sha256
    check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint wiki_collection_datasets_meta_object
    check (jsonb_typeof(meta_json) = 'object'),
  constraint wiki_collection_datasets_validation_object
    check (jsonb_typeof(validation_json) = 'object'),
  constraint wiki_collection_datasets_source_manifest_object
    check (jsonb_typeof(source_manifest_json) = 'object')
);

create table if not exists public.wiki_collection_items (
  id uuid primary key default extensions.uuid_generate_v4(),
  dataset_id uuid not null,
  item_slug text not null,
  item_name text not null,
  section text not null,
  sort_order integer not null,
  image_key text,
  image_mime text,
  image_width integer,
  image_height integer,
  image_bytes bigint,
  image_sha256 text,
  fields_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wiki_collection_items_dataset_fkey
    foreign key (dataset_id)
    references public.wiki_collection_datasets(id)
    on delete cascade,
  constraint wiki_collection_items_dataset_slug_key unique (dataset_id, item_slug),
  constraint wiki_collection_items_slug_not_blank check (length(btrim(item_slug)) > 0),
  constraint wiki_collection_items_name_not_blank check (length(btrim(item_name)) > 0),
  constraint wiki_collection_items_section_not_blank check (length(btrim(section)) > 0),
  constraint wiki_collection_items_image_key_not_blank
    check (image_key is null or length(btrim(image_key)) > 0),
  constraint wiki_collection_items_image_mime_supported
    check (image_mime is null or image_mime in ('image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp')),
  constraint wiki_collection_items_image_width_positive check (image_width is null or image_width > 0),
  constraint wiki_collection_items_image_height_positive check (image_height is null or image_height > 0),
  constraint wiki_collection_items_image_bytes_nonnegative check (image_bytes is null or image_bytes >= 0),
  constraint wiki_collection_items_image_sha256_format
    check (image_sha256 is null or image_sha256 ~ '^[0-9a-f]{64}$'),
  constraint wiki_collection_items_fields_object check (jsonb_typeof(fields_json) = 'object')
);

alter table public.wiki_collection_pages
  add column if not exists published_dataset_id uuid;

alter table public.wiki_collection_pages
  add constraint wiki_collection_pages_published_dataset_owner_fkey
  foreign key (published_dataset_id, id)
  references public.wiki_collection_datasets(id, collection_page_id)
  deferrable initially deferred;

create index if not exists idx_wiki_collection_datasets_page_created
  on public.wiki_collection_datasets(collection_page_id, created_at desc);

create index if not exists idx_wiki_collection_pages_published_dataset
  on public.wiki_collection_pages(published_dataset_id, id)
  where published_dataset_id is not null;

create index if not exists idx_wiki_collection_items_dataset_sort
  on public.wiki_collection_items(dataset_id, sort_order, item_slug);

create index if not exists idx_wiki_collection_items_dataset_section_sort
  on public.wiki_collection_items(dataset_id, section, sort_order, item_slug);

create or replace function public.protect_published_wiki_collection_runtime()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_dataset_id uuid;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Wiki collection runtime revisions are immutable. Publish a new revision instead.';
  end if;

  target_dataset_id := case
    when tg_table_name = 'wiki_collection_datasets' then old.id
    else old.dataset_id
  end;

  if exists (
    select 1
    from public.wiki_collection_pages page
    where page.published_dataset_id = target_dataset_id
  ) then
    raise exception 'Published wiki collection dataset % is immutable. Publish a new revision instead.', target_dataset_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_published_wiki_collection_dataset on public.wiki_collection_datasets;
create trigger trg_protect_published_wiki_collection_dataset
before update or delete on public.wiki_collection_datasets
for each row execute function public.protect_published_wiki_collection_runtime();

drop trigger if exists trg_protect_published_wiki_collection_item on public.wiki_collection_items;
create trigger trg_protect_published_wiki_collection_item
before update or delete on public.wiki_collection_items
for each row execute function public.protect_published_wiki_collection_runtime();

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
  greatest(wcp.updated_at, coalesce(wcp.published_at, wcp.updated_at)) as content_updated_at,
  wcp.published_dataset_id
from public.wiki_collection_pages wcp;

alter table public.wiki_collection_datasets enable row level security;
alter table public.wiki_collection_items enable row level security;

revoke all on table public.wiki_collection_datasets from anon, authenticated;
revoke all on table public.wiki_collection_items from anon, authenticated;
grant all on table public.wiki_collection_datasets to service_role;
grant all on table public.wiki_collection_items to service_role;

revoke all on function public.protect_published_wiki_collection_runtime() from public;
grant execute on function public.protect_published_wiki_collection_runtime() to service_role;

revoke all on table public.wiki_collection_pages_view from anon, authenticated;
grant select on table public.wiki_collection_pages_view to anon, authenticated;
grant all on table public.wiki_collection_pages_view to service_role;
