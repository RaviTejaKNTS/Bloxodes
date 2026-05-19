create table if not exists public.wiki_catalog_pages (
  id uuid primary key default extensions.uuid_generate_v4(),
  wiki_page_id uuid references public.wiki_pages(id) on delete set null,
  universe_id bigint references public.roblox_universes(universe_id) on delete set null,
  wiki_slug text not null,
  collection_slug text not null,
  code text not null,
  title text not null,
  seo_title text not null,
  meta_description text not null,
  intro_md text,
  how_it_works_md text,
  description_md text,
  description_json jsonb not null default '{}'::jsonb,
  faq_json jsonb not null default '[]'::jsonb,
  schema_ld_json jsonb,
  thumb_url text,
  wiki_md text,
  wiki_sort_order integer,
  is_published boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wiki_catalog_pages_code_key unique (code),
  constraint wiki_catalog_pages_path_key unique (wiki_slug, collection_slug),
  constraint wiki_catalog_pages_wiki_slug_not_blank check (length(btrim(wiki_slug)) > 0),
  constraint wiki_catalog_pages_collection_slug_not_blank check (length(btrim(collection_slug)) > 0),
  constraint wiki_catalog_pages_code_not_blank check (length(btrim(code)) > 0)
);

create index if not exists idx_wiki_catalog_pages_is_published
  on public.wiki_catalog_pages (is_published);

create index if not exists idx_wiki_catalog_pages_universe_id
  on public.wiki_catalog_pages (universe_id);

create index if not exists idx_wiki_catalog_pages_wiki_sort
  on public.wiki_catalog_pages (wiki_slug, wiki_sort_order)
  where is_published = true;

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

create or replace function public.trg_enqueue_revalidation_wiki_catalog_pages()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_slug text;
begin
  if tg_op = 'DELETE' then
    v_slug := old.wiki_slug || '/' || old.collection_slug;
    perform public.enqueue_revalidation('wiki_catalog', v_slug, 'wiki_catalog_pages_delete');
  elsif new.is_published = true then
    v_slug := new.wiki_slug || '/' || new.collection_slug;
    perform public.enqueue_revalidation('wiki_catalog', v_slug, 'wiki_catalog_pages_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_published = true then
    v_slug := old.wiki_slug || '/' || old.collection_slug;
    perform public.enqueue_revalidation('wiki_catalog', v_slug, 'wiki_catalog_pages_unpublish');
  end if;
  return null;
end;
$$;

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

drop trigger if exists trg_wiki_catalog_pages_updated_at on public.wiki_catalog_pages;
create trigger trg_wiki_catalog_pages_updated_at
before update on public.wiki_catalog_pages
for each row execute function public.set_updated_at();

drop trigger if exists trg_set_wiki_catalog_page_published_at on public.wiki_catalog_pages;
create trigger trg_set_wiki_catalog_page_published_at
before insert or update on public.wiki_catalog_pages
for each row execute function public.set_catalog_page_published_at();

drop trigger if exists trg_enqueue_revalidation_wiki_catalog_pages on public.wiki_catalog_pages;
create trigger trg_enqueue_revalidation_wiki_catalog_pages
after insert or update or delete on public.wiki_catalog_pages
for each row execute function public.trg_enqueue_revalidation_wiki_catalog_pages();

drop trigger if exists trg_search_index_wiki_catalog_pages on public.wiki_catalog_pages;
create trigger trg_search_index_wiki_catalog_pages
after insert or update or delete on public.wiki_catalog_pages
for each row execute function public.trg_search_index_wiki_catalog_pages();

alter table public.revalidation_events
  drop constraint if exists revalidation_events_entity_type_check;

alter table public.revalidation_events
  add constraint revalidation_events_entity_type_check
  check (entity_type in ('code','article','list','author','event','checklist','tool','catalog','music','quiz','wiki','wiki_catalog'));

alter table public.wiki_catalog_pages enable row level security;

-- Copy existing game-specific catalog page rows into the new wiki catalog table.
-- Do not delete from catalog_pages in this migration; old flat URLs keep redirecting
-- until the production wiki catalog routes are deployed and verified.
with game_prefixes(wiki_slug) as (
  values
    ('adopt-me'),
    ('blox-fruits'),
    ('brookhaven-rp'),
    ('grow-a-garden'),
    ('sailor-piece'),
    ('steal-a-brainrot'),
    ('the-forge')
),
moved_raw as (
  select
    cp.*,
    gp.wiki_slug,
    substr(cp.code, length(gp.wiki_slug) + 2) as collection_slug,
    gp.wiki_slug || '-' || substr(cp.code, length(gp.wiki_slug) + 2) as canonical_code,
    wp.id as resolved_wiki_page_id,
    coalesce(cp.universe_id, wp.universe_id) as resolved_universe_id,
    row_number() over (
      partition by gp.wiki_slug, substr(cp.code, length(gp.wiki_slug) + 2)
      order by
        case when cp.code = gp.wiki_slug || '-' || substr(cp.code, length(gp.wiki_slug) + 2) then 0 else 1 end,
        cp.updated_at desc
    ) as move_rank
  from public.catalog_pages cp
  join game_prefixes gp
    on cp.code like gp.wiki_slug || '-%'
    or cp.code like gp.wiki_slug || '/%'
  left join public.wiki_pages wp
    on wp.slug = gp.wiki_slug
  where substr(cp.code, length(gp.wiki_slug) + 2) <> ''
),
moved as (
  select *
  from moved_raw
  where move_rank = 1
)
insert into public.wiki_catalog_pages (
  id,
  wiki_page_id,
  universe_id,
  wiki_slug,
  collection_slug,
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
  wiki_md,
  wiki_sort_order,
  is_published,
  published_at,
  created_at,
  updated_at
)
select
  id,
  resolved_wiki_page_id,
  resolved_universe_id,
  wiki_slug,
  collection_slug,
  canonical_code,
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
  wiki_md,
  wiki_sort_order,
  is_published,
  published_at,
  created_at,
  updated_at
from moved
on conflict (wiki_slug, collection_slug) do update set
  wiki_page_id = excluded.wiki_page_id,
  universe_id = excluded.universe_id,
  code = excluded.code,
  title = excluded.title,
  seo_title = excluded.seo_title,
  meta_description = excluded.meta_description,
  intro_md = excluded.intro_md,
  how_it_works_md = excluded.how_it_works_md,
  description_md = excluded.description_md,
  description_json = excluded.description_json,
  faq_json = excluded.faq_json,
  schema_ld_json = excluded.schema_ld_json,
  thumb_url = excluded.thumb_url,
  wiki_md = excluded.wiki_md,
  wiki_sort_order = excluded.wiki_sort_order,
  is_published = excluded.is_published,
  published_at = coalesce(public.wiki_catalog_pages.published_at, excluded.published_at),
  created_at = least(public.wiki_catalog_pages.created_at, excluded.created_at),
  updated_at = greatest(public.wiki_catalog_pages.updated_at, excluded.updated_at);
