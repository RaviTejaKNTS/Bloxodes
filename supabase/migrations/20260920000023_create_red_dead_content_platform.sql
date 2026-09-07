-- Keep Red Dead content in its own platform-owned tables while sharing the
-- existing Bloxodes wiki/collection dataset and renderer contracts.
begin;

create table if not exists public.red_dead_games (
  id uuid primary key default extensions.uuid_generate_v4(),
  slug text not null,
  title text not null,
  short_title text,
  installment text,
  content_kind text not null default 'game',
  parent_game_id uuid references public.red_dead_games(id) on delete set null,
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
  constraint red_dead_games_slug_not_blank check (length(btrim(slug)) > 0),
  constraint red_dead_games_title_not_blank check (length(btrim(title)) > 0),
  constraint red_dead_games_content_kind_check check (content_kind in ('game', 'expansion', 'online')),
  constraint red_dead_games_parent_not_self check (parent_game_id is null or parent_game_id <> id),
  constraint red_dead_games_release_dates_object check (jsonb_typeof(release_dates_json) = 'object'),
  constraint red_dead_games_platforms_array check (jsonb_typeof(platforms_json) = 'array'),
  constraint red_dead_games_status_check check (status in ('announced', 'upcoming', 'released')),
  constraint red_dead_games_id_pair_key unique (id, slug)
);

create unique index if not exists red_dead_games_slug_lower_key on public.red_dead_games (lower(slug));
create index if not exists red_dead_games_parent_idx on public.red_dead_games (parent_game_id);
create index if not exists red_dead_games_published_updated_idx
  on public.red_dead_games (updated_at desc, id)
  where is_published = true;

create table if not exists public.red_dead_wiki_pages (
  id uuid primary key default extensions.uuid_generate_v4(),
  game_id uuid not null references public.red_dead_games(id) on delete cascade,
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
  constraint red_dead_wiki_pages_game_key unique (game_id),
  constraint red_dead_wiki_pages_slug_not_blank check (length(btrim(slug)) > 0),
  constraint red_dead_wiki_pages_title_not_blank check (length(btrim(title)) > 0),
  constraint red_dead_wiki_pages_controls_array check (jsonb_typeof(controls_json) = 'array'),
  constraint red_dead_wiki_pages_id_game_key unique (id, game_id)
);

create unique index if not exists red_dead_wiki_pages_slug_lower_key on public.red_dead_wiki_pages (lower(slug));
create index if not exists red_dead_wiki_pages_published_updated_idx
  on public.red_dead_wiki_pages (updated_at desc, id)
  where is_published = true;

create table if not exists public.red_dead_wiki_collection_pages (
  id uuid primary key default extensions.uuid_generate_v4(),
  wiki_page_id uuid not null,
  game_id uuid not null,
  wiki_slug text not null,
  collection_slug text not null,
  code text not null,
  page_type text not null default 'database',
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
  constraint red_dead_wiki_collection_pages_wiki_game_fkey
    foreign key (wiki_page_id, game_id)
    references public.red_dead_wiki_pages(id, game_id)
    on delete cascade,
  constraint red_dead_wiki_collection_pages_code_key unique (code),
  constraint red_dead_wiki_collection_pages_path_key unique (wiki_slug, collection_slug),
  constraint red_dead_wiki_collection_pages_wiki_slug_not_blank check (length(btrim(wiki_slug)) > 0),
  constraint red_dead_wiki_collection_pages_collection_slug_not_blank check (length(btrim(collection_slug)) > 0),
  constraint red_dead_wiki_collection_pages_code_not_blank check (length(btrim(code)) > 0),
  constraint red_dead_wiki_collection_pages_page_type_check check (page_type in ('database', 'checklist')),
  constraint red_dead_wiki_collection_pages_display_name_not_blank check (length(btrim(display_name)) > 0),
  constraint red_dead_wiki_collection_pages_item_count_nonnegative check (item_count >= 0),
  constraint red_dead_wiki_collection_pages_description_object check (jsonb_typeof(description_json) = 'object'),
  constraint red_dead_wiki_collection_pages_faq_array check (jsonb_typeof(faq_json) = 'array')
);

create index if not exists red_dead_wiki_collection_pages_game_idx
  on public.red_dead_wiki_collection_pages (game_id);
create index if not exists red_dead_wiki_collection_pages_wiki_game_idx
  on public.red_dead_wiki_collection_pages (wiki_page_id, game_id);
create index if not exists red_dead_wiki_collection_pages_wiki_sort_idx
  on public.red_dead_wiki_collection_pages (wiki_slug, wiki_sort_order, title)
  where is_published = true;
create index if not exists red_dead_wiki_collection_pages_type_idx
  on public.red_dead_wiki_collection_pages (wiki_slug, page_type, wiki_sort_order, title)
  where is_published = true;

create table if not exists public.red_dead_wiki_collection_datasets (
  id uuid primary key default extensions.uuid_generate_v4(),
  collection_page_id uuid not null references public.red_dead_wiki_collection_pages(id),
  schema_version integer not null default 2,
  content_hash text not null,
  item_count integer not null,
  meta_json jsonb not null default '{}'::jsonb,
  validation_json jsonb not null default '{}'::jsonb,
  source_manifest_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint red_dead_wiki_collection_datasets_page_hash_key unique (collection_page_id, content_hash),
  constraint red_dead_wiki_collection_datasets_id_page_key unique (id, collection_page_id),
  constraint red_dead_wiki_collection_datasets_schema_version_positive check (schema_version > 0),
  constraint red_dead_wiki_collection_datasets_item_count_nonnegative check (item_count >= 0),
  constraint red_dead_wiki_collection_datasets_content_hash_sha256 check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint red_dead_wiki_collection_datasets_meta_object check (jsonb_typeof(meta_json) = 'object'),
  constraint red_dead_wiki_collection_datasets_validation_object check (jsonb_typeof(validation_json) = 'object'),
  constraint red_dead_wiki_collection_datasets_source_manifest_object check (jsonb_typeof(source_manifest_json) = 'object')
);

alter table public.red_dead_wiki_collection_pages
  add column if not exists published_dataset_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.red_dead_wiki_collection_pages'::regclass
      and conname = 'red_dead_wiki_collection_pages_published_dataset_owner_fkey'
  ) then
    alter table public.red_dead_wiki_collection_pages
      add constraint red_dead_wiki_collection_pages_published_dataset_owner_fkey
      foreign key (published_dataset_id, id)
      references public.red_dead_wiki_collection_datasets(id, collection_page_id)
      deferrable initially deferred;
  end if;
end;
$$;

create index if not exists red_dead_wiki_collection_datasets_page_created_idx
  on public.red_dead_wiki_collection_datasets (collection_page_id, created_at desc);
create index if not exists red_dead_wiki_collection_pages_published_dataset_idx
  on public.red_dead_wiki_collection_pages (published_dataset_id, id)
  where published_dataset_id is not null;

create table if not exists public.red_dead_wiki_collection_items (
  id uuid primary key default extensions.uuid_generate_v4(),
  dataset_id uuid not null references public.red_dead_wiki_collection_datasets(id) on delete cascade,
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
  constraint red_dead_wiki_collection_items_dataset_slug_key unique (dataset_id, item_slug),
  constraint red_dead_wiki_collection_items_slug_not_blank check (length(btrim(item_slug)) > 0),
  constraint red_dead_wiki_collection_items_name_not_blank check (length(btrim(item_name)) > 0),
  constraint red_dead_wiki_collection_items_section_not_blank check (length(btrim(section)) > 0),
  constraint red_dead_wiki_collection_items_image_key_not_blank check (image_key is null or length(btrim(image_key)) > 0),
  constraint red_dead_wiki_collection_items_image_mime_supported
    check (image_mime is null or image_mime in ('image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp')),
  constraint red_dead_wiki_collection_items_image_width_positive check (image_width is null or image_width > 0),
  constraint red_dead_wiki_collection_items_image_height_positive check (image_height is null or image_height > 0),
  constraint red_dead_wiki_collection_items_image_bytes_nonnegative check (image_bytes is null or image_bytes >= 0),
  constraint red_dead_wiki_collection_items_image_sha256_format check (image_sha256 is null or image_sha256 ~ '^[0-9a-f]{64}$'),
  constraint red_dead_wiki_collection_items_fields_object check (jsonb_typeof(fields_json) = 'object')
);

create index if not exists red_dead_wiki_collection_items_dataset_sort_idx
  on public.red_dead_wiki_collection_items (dataset_id, sort_order, item_slug);
create index if not exists red_dead_wiki_collection_items_dataset_section_sort_idx
  on public.red_dead_wiki_collection_items (dataset_id, section, sort_order, item_slug);

create or replace function public.set_red_dead_published_at()
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

drop trigger if exists trg_red_dead_games_updated_at on public.red_dead_games;
create trigger trg_red_dead_games_updated_at
before update on public.red_dead_games
for each row execute function public.set_updated_at();
drop trigger if exists trg_red_dead_games_published_at on public.red_dead_games;
create trigger trg_red_dead_games_published_at
before insert or update on public.red_dead_games
for each row execute function public.set_red_dead_published_at();
drop trigger if exists trg_red_dead_wiki_pages_updated_at on public.red_dead_wiki_pages;
create trigger trg_red_dead_wiki_pages_updated_at
before update on public.red_dead_wiki_pages
for each row execute function public.set_updated_at();
drop trigger if exists trg_red_dead_wiki_pages_published_at on public.red_dead_wiki_pages;
create trigger trg_red_dead_wiki_pages_published_at
before insert or update on public.red_dead_wiki_pages
for each row execute function public.set_red_dead_published_at();
drop trigger if exists trg_red_dead_wiki_collection_pages_updated_at on public.red_dead_wiki_collection_pages;
create trigger trg_red_dead_wiki_collection_pages_updated_at
before update on public.red_dead_wiki_collection_pages
for each row execute function public.set_updated_at();
drop trigger if exists trg_red_dead_wiki_collection_pages_published_at on public.red_dead_wiki_collection_pages;
create trigger trg_red_dead_wiki_collection_pages_published_at
before insert or update on public.red_dead_wiki_collection_pages
for each row execute function public.set_red_dead_published_at();

create or replace function public.protect_published_red_dead_wiki_collection_runtime()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_dataset_id uuid;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Red Dead wiki collection runtime revisions are immutable. Publish a new revision instead.';
  end if;

  target_dataset_id := case
    when tg_table_name = 'red_dead_wiki_collection_datasets' then old.id
    else old.dataset_id
  end;

  if exists (
    select 1
    from public.red_dead_wiki_collection_pages page
    where page.published_dataset_id = target_dataset_id
  ) then
    raise exception 'Published Red Dead wiki collection dataset % is immutable. Publish a new revision instead.', target_dataset_id;
  end if;

  return old;
end;
$$;

drop trigger if exists trg_protect_published_red_dead_wiki_collection_dataset on public.red_dead_wiki_collection_datasets;
create trigger trg_protect_published_red_dead_wiki_collection_dataset
before update or delete on public.red_dead_wiki_collection_datasets
for each row execute function public.protect_published_red_dead_wiki_collection_runtime();
drop trigger if exists trg_protect_published_red_dead_wiki_collection_item on public.red_dead_wiki_collection_items;
create trigger trg_protect_published_red_dead_wiki_collection_item
before update or delete on public.red_dead_wiki_collection_items
for each row execute function public.protect_published_red_dead_wiki_collection_runtime();

create or replace view public.red_dead_wiki_pages_view
with (security_invoker = true)
as
select
  wp.*,
  greatest(wp.updated_at, coalesce(wp.published_at, wp.updated_at)) as content_updated_at,
  game.title as game_title,
  game.short_title as game_short_title,
  game.installment as game_installment,
  game.content_kind as game_content_kind,
  game.parent_game_id as game_parent_game_id,
  game.developer as game_developer,
  game.publisher as game_publisher,
  game.description_md as game_description_md,
  game.cover_image as game_cover_image,
  game.hero_image as game_hero_image,
  game.official_url as game_official_url,
  game.release_dates_json as game_release_dates_json,
  game.platforms_json as game_platforms_json,
  game.status as game_status
from public.red_dead_wiki_pages wp
join public.red_dead_games game on game.id = wp.game_id;

create or replace view public.red_dead_wiki_collection_pages_view
with (security_invoker = true)
as
select
  page.*,
  greatest(page.updated_at, coalesce(page.published_at, page.updated_at)) as content_updated_at,
  game.title as game_title,
  game.short_title as game_short_title,
  game.content_kind as game_content_kind,
  game.parent_game_id as game_parent_game_id,
  game.cover_image as game_cover_image,
  game.hero_image as game_hero_image
from public.red_dead_wiki_collection_pages page
join public.red_dead_games game on game.id = page.game_id;

create table if not exists public.user_red_dead_collection_progress (
  user_id uuid not null references public.app_users(user_id) on delete cascade,
  collection_code text not null,
  checked_item_slugs text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, collection_code),
  constraint user_red_dead_collection_progress_code_not_blank check (length(btrim(collection_code)) > 0),
  constraint user_red_dead_collection_progress_code_length check (length(collection_code) <= 200)
);

create index if not exists idx_user_red_dead_collection_progress_code
  on public.user_red_dead_collection_progress (collection_code);

alter table public.red_dead_games enable row level security;
alter table public.red_dead_wiki_pages enable row level security;
alter table public.red_dead_wiki_collection_pages enable row level security;
alter table public.red_dead_wiki_collection_datasets enable row level security;
alter table public.red_dead_wiki_collection_items enable row level security;
alter table public.user_red_dead_collection_progress enable row level security;

revoke all on table public.red_dead_games from anon, authenticated;
revoke all on table public.red_dead_wiki_pages from anon, authenticated;
revoke all on table public.red_dead_wiki_collection_pages from anon, authenticated;
revoke all on table public.red_dead_wiki_collection_datasets from anon, authenticated;
revoke all on table public.red_dead_wiki_collection_items from anon, authenticated;
revoke all on table public.user_red_dead_collection_progress from anon, authenticated;
grant all on table public.red_dead_games to service_role;
grant all on table public.red_dead_wiki_pages to service_role;
grant all on table public.red_dead_wiki_collection_pages to service_role;
grant all on table public.red_dead_wiki_collection_datasets to service_role;
grant all on table public.red_dead_wiki_collection_items to service_role;
grant all on table public.user_red_dead_collection_progress to service_role;

revoke all on table public.red_dead_wiki_pages_view from anon, authenticated;
revoke all on table public.red_dead_wiki_collection_pages_view from anon, authenticated;
grant select on table public.red_dead_wiki_pages_view to anon, authenticated;
grant select on table public.red_dead_wiki_collection_pages_view to anon, authenticated;
grant all on table public.red_dead_wiki_pages_view to service_role;
grant all on table public.red_dead_wiki_collection_pages_view to service_role;

drop policy if exists user_red_dead_collection_progress_select on public.user_red_dead_collection_progress;
create policy user_red_dead_collection_progress_select
  on public.user_red_dead_collection_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
drop policy if exists user_red_dead_collection_progress_insert on public.user_red_dead_collection_progress;
create policy user_red_dead_collection_progress_insert
  on public.user_red_dead_collection_progress
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
drop policy if exists user_red_dead_collection_progress_update on public.user_red_dead_collection_progress;
create policy user_red_dead_collection_progress_update
  on public.user_red_dead_collection_progress
  for update
  to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())))
  with check ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
drop policy if exists user_red_dead_collection_progress_delete on public.user_red_dead_collection_progress;
create policy user_red_dead_collection_progress_delete
  on public.user_red_dead_collection_progress
  for delete
  to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));

drop trigger if exists trg_user_red_dead_collection_progress_updated_at on public.user_red_dead_collection_progress;
create trigger trg_user_red_dead_collection_progress_updated_at
before update on public.user_red_dead_collection_progress
for each row execute function public.set_updated_at();

alter table public.revalidation_events drop constraint if exists revalidation_events_entity_type_check;
alter table public.revalidation_events add constraint revalidation_events_entity_type_check
  check (entity_type in (
    'code','article','author','event','checklist','tool','catalog','music','quiz','wiki','wiki_collection','stats','puzzle',
    'gta_game','gta_wiki','gta_wiki_collection',
    'red_dead_game','red_dead_wiki','red_dead_wiki_collection'
  ));

alter table public.comments drop constraint if exists comments_entity_type_check;
alter table public.comments add constraint comments_entity_type_check
  check (entity_type in (
    'code','article','catalog','event','tool','wiki','wiki_collection',
    'gta_wiki','gta_wiki_collection',
    'red_dead_wiki','red_dead_wiki_collection'
  ));

create or replace function public.trg_enqueue_revalidation_red_dead_content()
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
    when 'red_dead_games' then 'red_dead_game'
    when 'red_dead_wiki_pages' then 'red_dead_wiki'
    when 'red_dead_wiki_collection_pages' then 'red_dead_wiki_collection'
  end;

  if tg_op = 'DELETE' then
    if coalesce((to_jsonb(old) ->> 'is_published')::boolean, false) then
      event_slug := case
        when tg_table_name = 'red_dead_wiki_collection_pages' then (to_jsonb(old) ->> 'wiki_slug') || '/' || (to_jsonb(old) ->> 'collection_slug')
        else to_jsonb(old) ->> 'slug'
      end;
      perform public.enqueue_revalidation(event_type, event_slug, tg_table_name || '_delete');
    end if;
    return null;
  end if;

  if coalesce((to_jsonb(new) ->> 'is_published')::boolean, false) then
    event_slug := case
      when tg_table_name = 'red_dead_wiki_collection_pages' then (to_jsonb(new) ->> 'wiki_slug') || '/' || (to_jsonb(new) ->> 'collection_slug')
      else to_jsonb(new) ->> 'slug'
    end;
    perform public.enqueue_revalidation(event_type, event_slug, tg_table_name || '_' || lower(tg_op));
  end if;

  old_slug := case
    when tg_op <> 'UPDATE' then null
    when tg_table_name = 'red_dead_wiki_collection_pages' then (to_jsonb(old) ->> 'wiki_slug') || '/' || (to_jsonb(old) ->> 'collection_slug')
    else to_jsonb(old) ->> 'slug'
  end;

  if tg_op = 'UPDATE' and coalesce((to_jsonb(old) ->> 'is_published')::boolean, false) and (
    not coalesce((to_jsonb(new) ->> 'is_published')::boolean, false)
    or old_slug is distinct from event_slug
  ) then
    perform public.enqueue_revalidation(event_type, old_slug, tg_table_name || '_old_slug_or_unpublish');
  end if;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_red_dead_games on public.red_dead_games;
create trigger trg_enqueue_revalidation_red_dead_games
after insert or update or delete on public.red_dead_games
for each row execute function public.trg_enqueue_revalidation_red_dead_content();
drop trigger if exists trg_enqueue_revalidation_red_dead_wiki_pages on public.red_dead_wiki_pages;
create trigger trg_enqueue_revalidation_red_dead_wiki_pages
after insert or update or delete on public.red_dead_wiki_pages
for each row execute function public.trg_enqueue_revalidation_red_dead_content();
drop trigger if exists trg_enqueue_revalidation_red_dead_wiki_collection_pages on public.red_dead_wiki_collection_pages;
create trigger trg_enqueue_revalidation_red_dead_wiki_collection_pages
after insert or update or delete on public.red_dead_wiki_collection_pages
for each row execute function public.trg_enqueue_revalidation_red_dead_content();

create or replace function public.trg_search_index_red_dead_content()
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
  if tg_table_name = 'red_dead_games' then
    delete from public.search_index
    where entity_type = 'red_dead_game'
      and entity_id = case when tg_op = 'DELETE' then old.id::text else new.id::text end;
    return null;
  end if;

  kind := case tg_table_name
    when 'red_dead_wiki_pages' then 'red_dead_wiki'
    when 'red_dead_wiki_collection_pages' then 'red_dead_wiki_collection'
  end;

  if tg_op = 'DELETE' then
    delete from public.search_index where entity_type = kind and entity_id = old.id::text;
    return null;
  end if;

  if tg_table_name = 'red_dead_wiki_pages' then
    target_slug := new.slug;
    target_title := new.title;
    target_subtitle := 'Red Dead wiki';
    target_url := '/red-dead/wiki/' || new.slug;
    target_search := concat_ws(' ', new.title, new.slug, new.seo_title, new.meta_description, new.description_md, new.tips_md);
  else
    target_slug := new.wiki_slug || '/' || new.collection_slug;
    target_title := new.title;
    target_subtitle := 'Red Dead wiki collection';
    target_url := '/red-dead/wiki/' || target_slug;
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

drop trigger if exists trg_search_index_red_dead_games on public.red_dead_games;
create trigger trg_search_index_red_dead_games
after insert or update or delete on public.red_dead_games
for each row execute function public.trg_search_index_red_dead_content();
drop trigger if exists trg_search_index_red_dead_wiki_pages on public.red_dead_wiki_pages;
create trigger trg_search_index_red_dead_wiki_pages
after insert or update or delete on public.red_dead_wiki_pages
for each row execute function public.trg_search_index_red_dead_content();
drop trigger if exists trg_search_index_red_dead_wiki_collection_pages on public.red_dead_wiki_collection_pages;
create trigger trg_search_index_red_dead_wiki_collection_pages
after insert or update or delete on public.red_dead_wiki_collection_pages
for each row execute function public.trg_search_index_red_dead_content();

create or replace function public.trg_comments_revalidate_red_dead_entity()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  event_source text;
begin
  if tg_op <> 'INSERT' then
    event_source := 'comments_' || lower(tg_op) || '_old';

    if old.entity_type = 'red_dead_wiki' then
      perform public.enqueue_revalidation(
        'red_dead_wiki',
        (select lower(page.slug) from public.red_dead_wiki_pages page where page.id = old.entity_id),
        event_source
      );
    elsif old.entity_type = 'red_dead_wiki_collection' then
      perform public.enqueue_revalidation(
        'red_dead_wiki_collection',
        (
          select lower(page.wiki_slug || '/' || page.collection_slug)
          from public.red_dead_wiki_collection_pages page
          where page.id = old.entity_id
        ),
        event_source
      );
    end if;
  end if;

  if tg_op <> 'DELETE' then
    event_source := 'comments_' || lower(tg_op);

    if new.entity_type = 'red_dead_wiki' then
      perform public.enqueue_revalidation(
        'red_dead_wiki',
        (select lower(page.slug) from public.red_dead_wiki_pages page where page.id = new.entity_id),
        event_source
      );
    elsif new.entity_type = 'red_dead_wiki_collection' then
      perform public.enqueue_revalidation(
        'red_dead_wiki_collection',
        (
          select lower(page.wiki_slug || '/' || page.collection_slug)
          from public.red_dead_wiki_collection_pages page
          where page.id = new.entity_id
        ),
        event_source
      );
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_comments_revalidate_red_dead_entity on public.comments;
create trigger trg_comments_revalidate_red_dead_entity
after insert or update or delete on public.comments
for each row execute function public.trg_comments_revalidate_red_dead_entity();

revoke all on function public.set_red_dead_published_at() from public;
revoke all on function public.protect_published_red_dead_wiki_collection_runtime() from public;
revoke all on function public.trg_enqueue_revalidation_red_dead_content() from public;
revoke all on function public.trg_search_index_red_dead_content() from public;
revoke all on function public.trg_comments_revalidate_red_dead_entity() from public;
grant execute on function public.set_red_dead_published_at() to service_role;
grant execute on function public.protect_published_red_dead_wiki_collection_runtime() to service_role;
grant execute on function public.trg_enqueue_revalidation_red_dead_content() to service_role;
grant execute on function public.trg_search_index_red_dead_content() to service_role;
grant execute on function public.trg_comments_revalidate_red_dead_entity() to service_role;

notify pgrst, 'reload schema';

commit;
