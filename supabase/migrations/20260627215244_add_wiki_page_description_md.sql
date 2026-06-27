-- Move wiki-owned game overview copy onto wiki_pages while keeping
-- roblox_universes.game_description_md available for non-wiki surfaces.

alter table if exists public.wiki_pages
  add column if not exists description_md text;

update public.wiki_pages wp
set description_md = coalesce(nullif(trim(wp.description_md), ''), nullif(trim(u.game_description_md), ''), nullif(trim(u.description), ''))
from public.roblox_universes u
where wp.universe_id = u.universe_id
  and nullif(trim(wp.description_md), '') is null
  and (
    nullif(trim(u.game_description_md), '') is not null
    or nullif(trim(u.description), '') is not null
  );

drop view if exists public.wiki_pages_view;

create or replace view public.wiki_pages_view
with (security_invoker = true) as
select
  wp.id,
  wp.slug,
  wp.title,
  wp.seo_title,
  wp.meta_description,
  wp.universe_id,
  wp.controls_json,
  wp.tips_md,
  wp.is_published,
  wp.published_at,
  wp.created_at,
  wp.updated_at,
  wp.cover_image,
  wp.description_md,
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
  u.playing,
  u.visits,
  u.favorites,
  u.likes,
  u.dislikes,
  u.icon_url,
  u.thumbnail_urls,
  u.social_links,
  u.created_at_api,
  u.updated_at_api,
  u.updated_at as universe_updated_at
from public.wiki_pages wp
left join public.roblox_universes u on u.universe_id = wp.universe_id;

grant all on table public.wiki_pages_view to anon;
grant all on table public.wiki_pages_view to authenticated;
grant all on table public.wiki_pages_view to service_role;
