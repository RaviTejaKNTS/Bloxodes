-- Game-specific compatibility and source mappings for the shared Roblox audio and image catalogs.

create table if not exists public.roblox_music_id_game_usage (
  game_slug text not null,
  universe_id bigint,
  asset_id bigint not null,
  use_type text not null,
  display_name text not null,
  category text,
  tags text[] not null default '{}'::text[],
  source_url text not null,
  source_checked_at timestamptz not null,
  compatibility_status text not null default 'community_reported',
  tested_at timestamptz,
  failure_reason text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (game_slug, asset_id, use_type),
  constraint roblox_music_id_game_usage_asset_check check (asset_id > 0),
  constraint roblox_music_id_game_usage_game_slug_check check (game_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint roblox_music_id_game_usage_status_check check (
    compatibility_status in ('community_reported', 'source_verified', 'in_game_verified', 'failed')
  )
);

alter table public.roblox_music_id_game_usage
  add column if not exists source_artist text,
  add column if not exists source_album text,
  add column if not exists source_duration_seconds integer,
  add column if not exists source_album_art_asset_id bigint;

alter table public.roblox_music_id_game_usage
  drop constraint if exists roblox_music_id_game_usage_source_duration_check;
alter table public.roblox_music_id_game_usage
  add constraint roblox_music_id_game_usage_source_duration_check
  check (source_duration_seconds is null or source_duration_seconds >= 0);

comment on table public.roblox_music_id_game_usage is
  'Source-backed uses of a Roblox audio asset inside a specific game. Canonical asset metadata remains in roblox_music_ids.';
comment on column public.roblox_music_id_game_usage.compatibility_status is
  'The strongest evidence available for this game, separate from general Roblox asset availability.';

create table if not exists public.roblox_decal_id_game_usage (
  game_slug text not null,
  universe_id bigint,
  asset_id bigint not null,
  texture_id bigint,
  use_type text not null,
  display_name text not null,
  category text,
  tags text[] not null default '{}'::text[],
  image_url text,
  source_url text not null,
  source_checked_at timestamptz not null,
  compatibility_status text not null default 'community_reported',
  tested_at timestamptz,
  failure_reason text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (game_slug, asset_id, use_type),
  constraint roblox_decal_id_game_usage_asset_check check (asset_id > 0),
  constraint roblox_decal_id_game_usage_texture_check check (texture_id is null or texture_id > 0),
  constraint roblox_decal_id_game_usage_game_slug_check check (game_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint roblox_decal_id_game_usage_status_check check (
    compatibility_status in ('community_reported', 'source_verified', 'in_game_verified', 'failed')
  )
);

comment on table public.roblox_decal_id_game_usage is
  'Source-backed uses of a Roblox decal or image asset inside a specific game. Canonical asset metadata remains in roblox_decal_ids.';
comment on column public.roblox_decal_id_game_usage.texture_id is
  'The image or texture ID to copy when the game does not accept the public decal asset ID.';

create index if not exists idx_music_id_game_usage_public
  on public.roblox_music_id_game_usage (game_slug, compatibility_status, sort_order, asset_id);
create index if not exists idx_decal_id_game_usage_public
  on public.roblox_decal_id_game_usage (game_slug, compatibility_status, sort_order, asset_id);

drop trigger if exists trg_music_id_game_usage_updated_at on public.roblox_music_id_game_usage;
create trigger trg_music_id_game_usage_updated_at
before update on public.roblox_music_id_game_usage
for each row execute function public.set_updated_at();

drop trigger if exists trg_decal_id_game_usage_updated_at on public.roblox_decal_id_game_usage;
create trigger trg_decal_id_game_usage_updated_at
before update on public.roblox_decal_id_game_usage
for each row execute function public.set_updated_at();

create or replace view public.roblox_music_ids_game_view
with (security_invoker = true) as
select
  usage.game_slug,
  usage.universe_id,
  usage.use_type,
  usage.display_name,
  usage.category as game_category,
  usage.tags as game_tags,
  usage.compatibility_status,
  usage.tested_at,
  usage.source_checked_at,
  usage.source_url as game_source_url,
  usage.sort_order as game_sort_order,
  usage.asset_id,
  coalesce(music.title, usage.display_name) as title,
  coalesce(music.artist, usage.source_artist, 'Community source') as artist,
  coalesce(music.album, usage.source_album) as album,
  music.genre,
  coalesce(music.duration_seconds, usage.source_duration_seconds) as duration_seconds,
  coalesce(music.album_art_asset_id, usage.source_album_art_asset_id) as album_art_asset_id,
  music.thumbnail_url,
  music.rank,
  music.source,
  coalesce(music.last_seen_at, usage.source_checked_at) as last_seen_at,
  coalesce(music.popularity_score, 0) as popularity_score,
  case
    when coalesce(music.duration_seconds, usage.source_duration_seconds) is null
      or coalesce(music.duration_seconds, usage.source_duration_seconds) <= 0 then 999
    when coalesce(music.duration_seconds, usage.source_duration_seconds) between 90 and 300 then 0
    when coalesce(music.duration_seconds, usage.source_duration_seconds) < 90
      then ceil((90 - coalesce(music.duration_seconds, usage.source_duration_seconds))::numeric / 30)::int
    else ceil((coalesce(music.duration_seconds, usage.source_duration_seconds) - 300)::numeric / 30)::int
  end as duration_bucket
from public.roblox_music_id_game_usage usage
left join public.roblox_music_ids music on music.asset_id = usage.asset_id
where usage.compatibility_status <> 'failed';

create or replace view public.roblox_decal_ids_game_view
with (security_invoker = true) as
select
  usage.game_slug,
  usage.universe_id,
  usage.use_type,
  usage.display_name,
  usage.category as game_category,
  usage.tags as game_tags,
  usage.compatibility_status,
  usage.tested_at,
  usage.source_checked_at,
  usage.source_url as game_source_url,
  usage.sort_order as game_sort_order,
  usage.asset_id,
  coalesce(decal.texture_id, usage.texture_id) as texture_id,
  coalesce(decal.name, usage.display_name) as name,
  decal.description,
  decal.creator_id,
  decal.creator_type,
  decal.creator_name,
  decal.creator_verified,
  decal.roblox_created_at,
  decal.roblox_updated_at,
  decal.is_public_domain,
  decal.is_for_sale,
  decal.price_in_robux,
  decal.sales,
  decal.purchasable,
  decal.vote_count,
  decal.upvote_percent,
  coalesce(decal.thumbnail_url, usage.image_url) as thumbnail_url,
  case when coalesce(decal.thumbnail_url, usage.image_url) is not null then 'Completed' else decal.thumbnail_state end as thumbnail_state,
  decal.thumbnail_checked_at,
  decal.source,
  coalesce(decal.first_seen_at, usage.source_checked_at) as first_seen_at,
  coalesce(decal.last_seen_at, usage.source_checked_at) as last_seen_at,
  coalesce(decal.verified_at, usage.source_checked_at) as verified_at,
  coalesce(decal.popularity_score, 0) as popularity_score,
  coalesce(decal.categories, usage.tags) as categories,
  coalesce(decal.primary_category, usage.category) as primary_category,
  decal.curated_score,
  decal.curated_rank,
  decal.curated_tier,
  decal.curated_reason
from public.roblox_decal_id_game_usage usage
left join public.roblox_decal_ids decal on decal.asset_id = usage.asset_id
where usage.compatibility_status <> 'failed';

create or replace function public.trg_enqueue_revalidation_music_game_usage()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_slug text := coalesce(new.game_slug, old.game_slug);
begin
  perform public.enqueue_revalidation(
    'music',
    'roblox-music-ids/games/' || target_slug,
    'roblox_music_id_game_usage_' || lower(tg_op)
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.trg_enqueue_revalidation_decal_game_usage()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_slug text := coalesce(new.game_slug, old.game_slug);
begin
  perform public.enqueue_revalidation(
    'catalog',
    'roblox-decal-ids/games/' || target_slug,
    'roblox_decal_id_game_usage_' || lower(tg_op)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_enqueue_revalidation_music_game_usage on public.roblox_music_id_game_usage;
create trigger trg_enqueue_revalidation_music_game_usage
after insert or update or delete on public.roblox_music_id_game_usage
for each row execute function public.trg_enqueue_revalidation_music_game_usage();

drop trigger if exists trg_enqueue_revalidation_decal_game_usage on public.roblox_decal_id_game_usage;
create trigger trg_enqueue_revalidation_decal_game_usage
after insert or update or delete on public.roblox_decal_id_game_usage
for each row execute function public.trg_enqueue_revalidation_decal_game_usage();

alter table public.roblox_music_id_game_usage enable row level security;
alter table public.roblox_decal_id_game_usage enable row level security;

drop policy if exists "music_id_game_usage_public_read" on public.roblox_music_id_game_usage;
create policy "music_id_game_usage_public_read"
  on public.roblox_music_id_game_usage for select to anon, authenticated
  using (compatibility_status <> 'failed');

drop policy if exists "decal_id_game_usage_public_read" on public.roblox_decal_id_game_usage;
create policy "decal_id_game_usage_public_read"
  on public.roblox_decal_id_game_usage for select to anon, authenticated
  using (compatibility_status <> 'failed');

grant select on table public.roblox_music_id_game_usage to anon, authenticated;
grant select on table public.roblox_decal_id_game_usage to anon, authenticated;
grant all on table public.roblox_music_id_game_usage to service_role;
grant all on table public.roblox_decal_id_game_usage to service_role;
grant select on table public.roblox_music_ids_game_view to anon, authenticated, service_role;
grant select on table public.roblox_decal_ids_game_view to anon, authenticated, service_role;
grant execute on function public.trg_enqueue_revalidation_music_game_usage() to service_role;
grant execute on function public.trg_enqueue_revalidation_decal_game_usage() to service_role;
