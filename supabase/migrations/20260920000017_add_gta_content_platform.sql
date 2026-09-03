-- Keep GTA content in its own platform-owned tables while sharing the existing Bloxodes page patterns.
begin;

create table public.gta_games (
  id uuid primary key default extensions.uuid_generate_v4(),
  slug text not null,
  title text not null,
  short_title text,
  installment text,
  developer text,
  publisher text,
  description_md text,
  cover_image text,
  hero_image text,
  official_url text,
  release_dates_json jsonb not null default '{}'::jsonb,
  platforms_json jsonb not null default '[]'::jsonb,
  status text not null default 'released',
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gta_games_slug_not_blank check (length(btrim(slug)) > 0),
  constraint gta_games_title_not_blank check (length(btrim(title)) > 0),
  constraint gta_games_release_dates_object check (jsonb_typeof(release_dates_json) = 'object'),
  constraint gta_games_platforms_array check (jsonb_typeof(platforms_json) = 'array'),
  constraint gta_games_status_check check (status in ('announced', 'upcoming', 'released')),
  constraint gta_games_id_pair_key unique (id, slug)
);

create unique index gta_games_slug_lower_key on public.gta_games (lower(slug));
create index gta_games_published_updated_idx
  on public.gta_games (updated_at desc, id)
  where is_published = true;

create table public.gta_wiki_pages (
  id uuid primary key default extensions.uuid_generate_v4(),
  game_id uuid not null references public.gta_games(id) on delete cascade,
  slug text not null,
  title text not null,
  seo_title text,
  meta_description text,
  description_md text,
  cover_image text,
  controls_json jsonb not null default '[]'::jsonb,
  tips_md text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gta_wiki_pages_game_key unique (game_id),
  constraint gta_wiki_pages_slug_not_blank check (length(btrim(slug)) > 0),
  constraint gta_wiki_pages_title_not_blank check (length(btrim(title)) > 0),
  constraint gta_wiki_pages_controls_array check (jsonb_typeof(controls_json) = 'array'),
  constraint gta_wiki_pages_id_game_key unique (id, game_id)
);

create unique index gta_wiki_pages_slug_lower_key on public.gta_wiki_pages (lower(slug));
create index gta_wiki_pages_published_updated_idx
  on public.gta_wiki_pages (updated_at desc, id)
  where is_published = true;

create table public.gta_wiki_collection_pages (
  id uuid primary key default extensions.uuid_generate_v4(),
  wiki_page_id uuid not null,
  game_id uuid not null,
  wiki_slug text not null,
  collection_slug text not null,
  code text not null,
  title text not null,
  display_name text not null,
  item_count integer not null default 0,
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
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gta_wiki_collection_pages_wiki_game_fkey
    foreign key (wiki_page_id, game_id)
    references public.gta_wiki_pages(id, game_id)
    on delete cascade,
  constraint gta_wiki_collection_pages_code_key unique (code),
  constraint gta_wiki_collection_pages_path_key unique (wiki_slug, collection_slug),
  constraint gta_wiki_collection_pages_wiki_slug_not_blank check (length(btrim(wiki_slug)) > 0),
  constraint gta_wiki_collection_pages_collection_slug_not_blank check (length(btrim(collection_slug)) > 0),
  constraint gta_wiki_collection_pages_code_not_blank check (length(btrim(code)) > 0),
  constraint gta_wiki_collection_pages_display_name_not_blank check (length(btrim(display_name)) > 0),
  constraint gta_wiki_collection_pages_item_count_nonnegative check (item_count >= 0),
  constraint gta_wiki_collection_pages_description_object check (jsonb_typeof(description_json) = 'object'),
  constraint gta_wiki_collection_pages_faq_array check (jsonb_typeof(faq_json) = 'array')
);

create index gta_wiki_collection_pages_game_idx on public.gta_wiki_collection_pages (game_id);
create index gta_wiki_collection_pages_wiki_sort_idx
  on public.gta_wiki_collection_pages (wiki_slug, wiki_sort_order, title)
  where is_published = true;

create table public.gta_wiki_collection_datasets (
  id uuid primary key default extensions.uuid_generate_v4(),
  collection_page_id uuid not null references public.gta_wiki_collection_pages(id),
  schema_version integer not null default 2,
  content_hash text not null,
  item_count integer not null,
  meta_json jsonb not null default '{}'::jsonb,
  validation_json jsonb not null default '{}'::jsonb,
  source_manifest_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gta_wiki_collection_datasets_page_hash_key unique (collection_page_id, content_hash),
  constraint gta_wiki_collection_datasets_id_page_key unique (id, collection_page_id),
  constraint gta_wiki_collection_datasets_schema_version_positive check (schema_version > 0),
  constraint gta_wiki_collection_datasets_item_count_nonnegative check (item_count >= 0),
  constraint gta_wiki_collection_datasets_content_hash_sha256 check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint gta_wiki_collection_datasets_meta_object check (jsonb_typeof(meta_json) = 'object'),
  constraint gta_wiki_collection_datasets_validation_object check (jsonb_typeof(validation_json) = 'object'),
  constraint gta_wiki_collection_datasets_source_manifest_object check (jsonb_typeof(source_manifest_json) = 'object')
);

alter table public.gta_wiki_collection_pages
  add column published_dataset_id uuid;

alter table public.gta_wiki_collection_pages
  add constraint gta_wiki_collection_pages_published_dataset_owner_fkey
  foreign key (published_dataset_id, id)
  references public.gta_wiki_collection_datasets(id, collection_page_id)
  deferrable initially deferred;

create index gta_wiki_collection_datasets_page_created_idx
  on public.gta_wiki_collection_datasets (collection_page_id, created_at desc);
create index gta_wiki_collection_pages_published_dataset_idx
  on public.gta_wiki_collection_pages (published_dataset_id, id)
  where published_dataset_id is not null;

create table public.gta_wiki_collection_items (
  id uuid primary key default extensions.uuid_generate_v4(),
  dataset_id uuid not null references public.gta_wiki_collection_datasets(id) on delete cascade,
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
  constraint gta_wiki_collection_items_dataset_slug_key unique (dataset_id, item_slug),
  constraint gta_wiki_collection_items_slug_not_blank check (length(btrim(item_slug)) > 0),
  constraint gta_wiki_collection_items_name_not_blank check (length(btrim(item_name)) > 0),
  constraint gta_wiki_collection_items_section_not_blank check (length(btrim(section)) > 0),
  constraint gta_wiki_collection_items_image_key_not_blank check (image_key is null or length(btrim(image_key)) > 0),
  constraint gta_wiki_collection_items_image_mime_supported
    check (image_mime is null or image_mime in ('image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp')),
  constraint gta_wiki_collection_items_image_width_positive check (image_width is null or image_width > 0),
  constraint gta_wiki_collection_items_image_height_positive check (image_height is null or image_height > 0),
  constraint gta_wiki_collection_items_image_bytes_nonnegative check (image_bytes is null or image_bytes >= 0),
  constraint gta_wiki_collection_items_image_sha256_format check (image_sha256 is null or image_sha256 ~ '^[0-9a-f]{64}$'),
  constraint gta_wiki_collection_items_fields_object check (jsonb_typeof(fields_json) = 'object')
);

create index gta_wiki_collection_items_dataset_sort_idx
  on public.gta_wiki_collection_items (dataset_id, sort_order, item_slug);
create index gta_wiki_collection_items_dataset_section_sort_idx
  on public.gta_wiki_collection_items (dataset_id, section, sort_order, item_slug);

create or replace function public.set_gta_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_published = true and new.published_at is null then
    if tg_op = 'INSERT' or old.is_published is distinct from true then
      new.published_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_gta_games_updated_at before update on public.gta_games
for each row execute function public.set_updated_at();
create trigger trg_gta_games_published_at before insert or update on public.gta_games
for each row execute function public.set_gta_published_at();
create trigger trg_gta_wiki_pages_updated_at before update on public.gta_wiki_pages
for each row execute function public.set_updated_at();
create trigger trg_gta_wiki_pages_published_at before insert or update on public.gta_wiki_pages
for each row execute function public.set_gta_published_at();
create trigger trg_gta_wiki_collection_pages_updated_at before update on public.gta_wiki_collection_pages
for each row execute function public.set_updated_at();
create trigger trg_gta_wiki_collection_pages_published_at before insert or update on public.gta_wiki_collection_pages
for each row execute function public.set_gta_published_at();
create or replace function public.protect_published_gta_wiki_collection_runtime()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_dataset_id uuid;
begin
  if tg_op = 'UPDATE' then
    raise exception 'GTA wiki collection runtime revisions are immutable. Publish a new revision instead.';
  end if;

  target_dataset_id := case
    when tg_table_name = 'gta_wiki_collection_datasets' then old.id
    else old.dataset_id
  end;

  if exists (
    select 1 from public.gta_wiki_collection_pages page
    where page.published_dataset_id = target_dataset_id
  ) then
    raise exception 'Published GTA wiki collection dataset % is immutable. Publish a new revision instead.', target_dataset_id;
  end if;

  return old;
end;
$$;

create trigger trg_protect_published_gta_wiki_collection_dataset
before update or delete on public.gta_wiki_collection_datasets
for each row execute function public.protect_published_gta_wiki_collection_runtime();
create trigger trg_protect_published_gta_wiki_collection_item
before update or delete on public.gta_wiki_collection_items
for each row execute function public.protect_published_gta_wiki_collection_runtime();

create or replace view public.gta_wiki_pages_view
with (security_invoker = true)
as
select
  wp.*,
  greatest(wp.updated_at, coalesce(wp.published_at, wp.updated_at)) as content_updated_at,
  g.title as game_title,
  g.short_title as game_short_title,
  g.installment as game_installment,
  g.developer as game_developer,
  g.publisher as game_publisher,
  g.description_md as game_description_md,
  g.cover_image as game_cover_image,
  g.hero_image as game_hero_image,
  g.official_url as game_official_url,
  g.release_dates_json as game_release_dates_json,
  g.platforms_json as game_platforms_json,
  g.status as game_status
from public.gta_wiki_pages wp
join public.gta_games g on g.id = wp.game_id;

create or replace view public.gta_wiki_collection_pages_view
with (security_invoker = true)
as
select
  page.*,
  greatest(page.updated_at, coalesce(page.published_at, page.updated_at)) as content_updated_at,
  game.title as game_title,
  game.short_title as game_short_title,
  game.cover_image as game_cover_image,
  game.hero_image as game_hero_image
from public.gta_wiki_collection_pages page
join public.gta_games game on game.id = page.game_id;

alter table public.gta_games enable row level security;
alter table public.gta_wiki_pages enable row level security;
alter table public.gta_wiki_collection_pages enable row level security;
alter table public.gta_wiki_collection_datasets enable row level security;
alter table public.gta_wiki_collection_items enable row level security;

revoke all on table public.gta_games from anon, authenticated;
revoke all on table public.gta_wiki_pages from anon, authenticated;
revoke all on table public.gta_wiki_collection_pages from anon, authenticated;
revoke all on table public.gta_wiki_collection_datasets from anon, authenticated;
revoke all on table public.gta_wiki_collection_items from anon, authenticated;
grant all on table public.gta_games to service_role;
grant all on table public.gta_wiki_pages to service_role;
grant all on table public.gta_wiki_collection_pages to service_role;
grant all on table public.gta_wiki_collection_datasets to service_role;
grant all on table public.gta_wiki_collection_items to service_role;

revoke all on table public.gta_wiki_pages_view from anon, authenticated;
revoke all on table public.gta_wiki_collection_pages_view from anon, authenticated;
grant select on table public.gta_wiki_pages_view to anon, authenticated;
grant select on table public.gta_wiki_collection_pages_view to anon, authenticated;
grant all on table public.gta_wiki_pages_view to service_role;
grant all on table public.gta_wiki_collection_pages_view to service_role;

alter table public.revalidation_events drop constraint if exists revalidation_events_entity_type_check;
alter table public.revalidation_events add constraint revalidation_events_entity_type_check
  check (entity_type in (
    'code','article','author','event','checklist','tool','catalog','music','quiz','wiki','wiki_collection','stats','puzzle',
    'gta_game','gta_wiki','gta_wiki_collection'
  ));

alter table public.comments drop constraint if exists comments_entity_type_check;
alter table public.comments add constraint comments_entity_type_check
  check (entity_type in (
    'code','article','catalog','event','tool','wiki','wiki_collection',
    'gta_wiki','gta_wiki_collection'
  ));

create or replace function public.trg_enqueue_revalidation_gta_content()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  event_type text;
  event_slug text;
  old_slug text;
begin
  event_type := case tg_table_name
    when 'gta_games' then 'gta_game'
    when 'gta_wiki_pages' then 'gta_wiki'
    when 'gta_wiki_collection_pages' then 'gta_wiki_collection'
  end;

  if tg_op = 'DELETE' then
    if coalesce((to_jsonb(old) ->> 'is_published')::boolean, false) then
      event_slug := case
        when tg_table_name = 'gta_wiki_collection_pages' then (to_jsonb(old) ->> 'wiki_slug') || '/' || (to_jsonb(old) ->> 'collection_slug')
        else to_jsonb(old) ->> 'slug'
      end;
      perform public.enqueue_revalidation(event_type, event_slug, tg_table_name || '_delete');
    end if;
    return null;
  end if;

  if coalesce((to_jsonb(new) ->> 'is_published')::boolean, false) then
    event_slug := case
      when tg_table_name = 'gta_wiki_collection_pages' then (to_jsonb(new) ->> 'wiki_slug') || '/' || (to_jsonb(new) ->> 'collection_slug')
      else to_jsonb(new) ->> 'slug'
    end;
    perform public.enqueue_revalidation(event_type, event_slug, tg_table_name || '_' || lower(tg_op));
  end if;

  old_slug := case
    when tg_op <> 'UPDATE' then null
    when tg_table_name = 'gta_wiki_collection_pages' then (to_jsonb(old) ->> 'wiki_slug') || '/' || (to_jsonb(old) ->> 'collection_slug')
    else to_jsonb(old) ->> 'slug'
  end;

  if tg_op = 'UPDATE' and coalesce((to_jsonb(old) ->> 'is_published')::boolean, false) and (
    not coalesce((to_jsonb(new) ->> 'is_published')::boolean, false)
    or old_slug is distinct from event_slug
  ) then
    event_slug := old_slug;
    perform public.enqueue_revalidation(event_type, event_slug, tg_table_name || '_old_slug_or_unpublish');
  end if;

  return null;
end;
$$;

create trigger trg_enqueue_revalidation_gta_games
after insert or update or delete on public.gta_games
for each row execute function public.trg_enqueue_revalidation_gta_content();
create trigger trg_enqueue_revalidation_gta_wiki_pages
after insert or update or delete on public.gta_wiki_pages
for each row execute function public.trg_enqueue_revalidation_gta_content();
create trigger trg_enqueue_revalidation_gta_wiki_collection_pages
after insert or update or delete on public.gta_wiki_collection_pages
for each row execute function public.trg_enqueue_revalidation_gta_content();
create or replace function public.trg_search_index_gta_content()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  kind text;
  target_slug text;
  target_title text;
  target_subtitle text;
  target_url text;
  target_search text;
begin
  if tg_table_name = 'gta_games' then
    delete from public.search_index
    where entity_type = 'gta_game'
      and entity_id = case when tg_op = 'DELETE' then old.id::text else new.id::text end;
    return null;
  end if;

  kind := case tg_table_name
    when 'gta_wiki_pages' then 'gta_wiki'
    when 'gta_wiki_collection_pages' then 'gta_wiki_collection'
  end;

  if tg_op = 'DELETE' then
    delete from public.search_index where entity_type = kind and entity_id = old.id::text;
    return null;
  end if;

  if tg_table_name = 'gta_wiki_pages' then
    target_slug := new.slug;
    target_title := new.title;
    target_subtitle := 'GTA wiki';
    target_url := '/gta/wiki/' || new.slug;
    target_search := concat_ws(' ', new.title, new.slug, new.seo_title, new.meta_description, new.description_md, new.tips_md);
  else
    target_slug := new.wiki_slug || '/' || new.collection_slug;
    target_title := new.title;
    target_subtitle := 'GTA wiki collection';
    target_url := '/gta/wiki/' || target_slug;
    target_search := concat_ws(' ', new.title, new.display_name, new.code, new.wiki_slug, new.collection_slug, new.seo_title, new.meta_description, new.intro_md, new.description_md, new.how_it_works_md, new.wiki_md);
  end if;

  perform public.upsert_search_index(
    kind,
    new.id::text,
    target_slug,
    target_title,
    target_subtitle,
    target_url,
    new.updated_at,
    new.is_published,
    left(target_search, 4000)
  );
  return null;
end;
$$;

create trigger trg_search_index_gta_games after insert or update or delete on public.gta_games
for each row execute function public.trg_search_index_gta_content();
create trigger trg_search_index_gta_wiki_pages after insert or update or delete on public.gta_wiki_pages
for each row execute function public.trg_search_index_gta_content();
create trigger trg_search_index_gta_wiki_collection_pages after insert or update or delete on public.gta_wiki_collection_pages
for each row execute function public.trg_search_index_gta_content();
create or replace function public.trg_comments_revalidate_entity()
returns trigger
language plpgsql
set search_path = pg_catalog, public
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
    select 'code', lower(page.slug), event_source from public.code_pages page where page.id = target_entity_id;
  elsif target_entity_type = 'article' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'article', lower(page.slug), event_source from public.articles page where page.id = target_entity_id;
  elsif target_entity_type = 'catalog' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'catalog', lower(page.code), event_source from public.catalog_pages page where page.id = target_entity_id;
  elsif target_entity_type = 'event' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'event', lower(page.slug), event_source from public.events_pages page where page.id = target_entity_id;
  elsif target_entity_type = 'tool' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'tool', lower(page.code), event_source from public.tools page where page.id = target_entity_id;
  elsif target_entity_type = 'wiki' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'wiki', lower(page.slug), event_source from public.wiki_pages page where page.id = target_entity_id;
  elsif target_entity_type = 'wiki_collection' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'wiki_collection', lower(page.wiki_slug || '/' || page.collection_slug), event_source
    from public.wiki_collection_pages page where page.id = target_entity_id;
  elsif target_entity_type = 'gta_wiki' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'gta_wiki', lower(page.slug), event_source from public.gta_wiki_pages page where page.id = target_entity_id;
  elsif target_entity_type = 'gta_wiki_collection' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'gta_wiki_collection', lower(page.wiki_slug || '/' || page.collection_slug), event_source
    from public.gta_wiki_collection_pages page where page.id = target_entity_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_comments_revalidate_entity on public.comments;
create trigger trg_comments_revalidate_entity
after insert or update or delete on public.comments
for each row execute function public.trg_comments_revalidate_entity();

revoke all on function public.set_gta_published_at() from public;
revoke all on function public.protect_published_gta_wiki_collection_runtime() from public;
revoke all on function public.trg_enqueue_revalidation_gta_content() from public;
revoke all on function public.trg_search_index_gta_content() from public;
grant execute on function public.set_gta_published_at() to service_role;
grant execute on function public.protect_published_gta_wiki_collection_runtime() to service_role;
grant execute on function public.trg_enqueue_revalidation_gta_content() to service_role;
grant execute on function public.trg_search_index_gta_content() to service_role;

notify pgrst, 'reload schema';

commit;
