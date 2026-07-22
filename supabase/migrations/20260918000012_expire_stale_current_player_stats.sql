-- Current player counts are observations, not durable totals. Keep the last raw
-- value on roblox_universes for history, but stop publishing it as current after
-- 24 hours without a matching Roblox response.

create or replace function public.sanitize_stats_game_current_player()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.last_playing_refreshed_at is null
    or new.last_playing_refreshed_at < now() - interval '24 hours'
  then
    new.playing := null;
    new.baseline_playing_24h := null;
    new.baseline_playing_7d := null;
    new.growth_24h := null;
    new.growth_24h_percent := null;
    new.growth_7d := null;
    new.growth_7d_percent := null;
    new.peak_24h := null;
    new.global_playing_rank := null;
    new.genre_playing_rank := null;
    new.subgenre_playing_rank := null;
  end if;
  return new;
end;
$$;

revoke all on function public.sanitize_stats_game_current_player() from public, anon, authenticated;
grant execute on function public.sanitize_stats_game_current_player() to postgres, service_role;

drop trigger if exists trg_sanitize_stats_game_current_player on public.stats_game_current_index;
create trigger trg_sanitize_stats_game_current_player
before insert or update on public.stats_game_current_index
for each row execute function public.sanitize_stats_game_current_player();

create or replace function public.sanitize_stats_creator_top_player()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.top_universe_id is not null and not exists (
    select 1
    from public.stats_game_current_index g
    where g.universe_id = new.top_universe_id
      and g.playing is not null
  ) then
    new.top_playing := null;
  end if;
  return new;
end;
$$;

revoke all on function public.sanitize_stats_creator_top_player() from public, anon, authenticated;
grant execute on function public.sanitize_stats_creator_top_player() to postgres, service_role;

drop trigger if exists trg_sanitize_stats_creator_top_player on public.stats_creator_current_index;
create trigger trg_sanitize_stats_creator_top_player
before insert or update on public.stats_creator_current_index
for each row execute function public.sanitize_stats_creator_top_player();

drop view if exists public.wiki_pages_view;

create or replace view public.wiki_pages_view
with (security_invoker = true)
as
select
  wp.*,
  greatest(wp.updated_at, coalesce(wp.published_at, wp.updated_at)) as content_updated_at,
  u.root_place_id as universe_root_place_id,
  u.name as universe_name,
  u.display_name as universe_display_name,
  u.slug as universe_slug,
  u.description as universe_description,
  u.game_description_md as universe_game_description_md,
  u.creator_id as universe_creator_id,
  u.creator_name as universe_creator_name,
  u.creator_type as universe_creator_type,
  u.creator_has_verified_badge as universe_creator_has_verified_badge,
  u.group_id as universe_group_id,
  u.group_name as universe_group_name,
  u.group_has_verified_badge as universe_group_has_verified_badge,
  u.genre as universe_genre,
  u.genre_l1 as universe_genre_l1,
  u.genre_l2 as universe_genre_l2,
  u.age_rating as universe_age_rating,
  u.universe_avatar_type,
  u.desktop_enabled,
  u.mobile_enabled,
  u.tablet_enabled,
  u.console_enabled,
  u.vr_enabled,
  u.voice_chat_enabled,
  u.price,
  u.private_server_price_robux,
  u.create_vip_servers_allowed,
  u.max_players,
  u.server_size,
  case
    when u.last_playing_refreshed_at >= now() - interval '24 hours' then u.playing
    else null
  end as playing,
  u.visits,
  u.favorites,
  u.likes,
  u.dislikes,
  u.icon_url,
  u.thumbnail_urls,
  u.social_links,
  u.created_at_api,
  u.updated_at_api,
  u.updated_at as universe_updated_at,
  u.last_playing_refreshed_at
from public.wiki_pages wp
left join public.roblox_universes u on u.universe_id = wp.universe_id;

grant select on public.wiki_pages_view to anon, authenticated, service_role;

create or replace function public.get_stats_platform_current_summary()
returns table (
  live_players bigint,
  total_visits bigint,
  fresh_games integer,
  last_updated_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(sum(u.playing) filter (
      where u.last_playing_refreshed_at >= now() - interval '24 hours'
    ), 0)::bigint as live_players,
    coalesce(sum(u.visits), 0)::bigint as total_visits,
    count(*) filter (
      where u.playing is not null
        and u.last_playing_refreshed_at >= now() - interval '24 hours'
    )::integer as fresh_games,
    max(u.last_playing_refreshed_at) filter (
      where u.last_playing_refreshed_at >= now() - interval '24 hours'
    ) as last_updated_at
  from public.roblox_universes u
  where u.slug is not null;
$$;

revoke all on function public.get_stats_platform_current_summary() from public, anon, authenticated;
grant execute on function public.get_stats_platform_current_summary() to service_role;

-- Rebuild immediately when this migration is applied so already-stale rows stop
-- contributing to game, genre, creator, riser, and platform-facing read models.
select public.refresh_stats_current_indexes();
select public.refresh_stats_creator_current_index();
