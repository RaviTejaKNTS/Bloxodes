-- Drop legacy code-page body columns that are no longer rendered.
-- Codes now use intro/redeem/rewards/troubleshoot/find-codes sections only.

create or replace function public.trg_search_index_games()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'code'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.name,
      new.slug,
      array_to_string(new.old_slugs, ' '),
      new.seo_title,
      new.seo_description,
      new.intro_md,
      new.redeem_md,
      new.rewards_md,
      new.troubleshoot_md,
      new.find_codes_md
    ),
    4000
  );

  perform public.upsert_search_index(
    'code',
    new.id::text,
    new.slug,
    new.name,
    'Codes',
    '/codes/' || new.slug,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;

drop view if exists public.code_pages_view;

alter table if exists public.games
  drop column if exists description_md,
  drop column if exists about_game_md;

create or replace view public.code_pages_view as
with code_stats as (
  select
    game_id,
    jsonb_agg(c order by c.status, c.last_seen_at desc) filter (where c.id is not null) as codes,
    count(*) filter (where c.status = 'active') as active_code_count,
    max(c.first_seen_at) filter (where c.status = 'active') as latest_code_first_seen_at
  from public.codes c
  group by game_id
)
select
  g.id,
  g.name,
  g.slug,
  g.old_slugs,
  g.roblox_link,
  g.universe_id,
  g.community_link,
  g.discord_link,
  g.twitter_link,
  g.youtube_link,
  g.expired_codes,
  g.cover_image,
  g.seo_title,
  g.seo_description,
  g.intro_md,
  g.redeem_md,
  g.find_codes_md,
  g.troubleshoot_md,
  g.rewards_md,
  g.internal_links,
  g.is_published,
  g.re_rewritten_at,
  g.created_at,
  g.updated_at,
  u.genre_l1,
  u.genre_l2,
  coalesce(cs.codes, '[]'::jsonb) as codes,
  coalesce(cs.active_code_count, 0) as active_code_count,
  cs.latest_code_first_seen_at,
  greatest(
    coalesce(cs.latest_code_first_seen_at, g.updated_at),
    g.updated_at
  ) as content_updated_at,
  case when u.universe_id is null then null else jsonb_build_object(
    'universe_id', u.universe_id,
    'slug', u.slug,
    'display_name', u.display_name,
    'name', u.name,
    'creator_name', u.creator_name,
    'creator_id', u.creator_id,
    'creator_type', u.creator_type,
    'social_links', u.social_links,
    'icon_url', u.icon_url,
    'genre_l1', u.genre_l1,
    'genre_l2', u.genre_l2,
    'playing', u.playing,
    'visits', u.visits,
    'favorites', u.favorites,
    'likes', u.likes,
    'dislikes', u.dislikes,
    'age_rating', u.age_rating,
    'desktop_enabled', u.desktop_enabled,
    'mobile_enabled', u.mobile_enabled,
    'tablet_enabled', u.tablet_enabled,
    'console_enabled', u.console_enabled,
    'vr_enabled', u.vr_enabled,
    'updated_at', u.updated_at,
    'description', u.description,
    'game_description_md', u.game_description_md
  ) end as universe,
  (
    select coalesce(
      jsonb_agg(rec order by rec.active_code_count desc, rec.updated_at desc),
      '[]'::jsonb
    )
    from (
      select
        g2.id,
        g2.name,
        g2.slug,
        g2.cover_image,
        coalesce(cs2.active_code_count, 0) as active_code_count,
        greatest(coalesce(cs2.latest_code_first_seen_at, g2.updated_at), g2.updated_at) as content_updated_at,
        g2.updated_at,
        u2.genre_l1,
        u2.genre_l2
      from public.games g2
      left join code_stats cs2 on cs2.game_id = g2.id
      left join public.roblox_universes u2 on u2.universe_id = g2.universe_id
      where g2.is_published = true
        and g2.id <> g.id
      order by coalesce(cs2.active_code_count, 0) desc, g2.updated_at desc
      limit 6
    ) rec
  ) as recommended_games,
  g.interlinking_ai_copy_md
from public.games g
left join code_stats cs on cs.game_id = g.id
left join public.roblox_universes u on u.universe_id = g.universe_id;

alter view if exists public.code_pages_view set (security_invoker = true);

delete from public.search_index
where entity_type = 'code';

select public.upsert_search_index(
  'code',
  g.id::text,
  g.slug,
  g.name,
  'Codes',
  '/codes/' || g.slug,
  g.updated_at,
  g.is_published,
  left(
    concat_ws(
      ' ',
      g.name,
      g.slug,
      array_to_string(g.old_slugs, ' '),
      g.seo_title,
      g.seo_description,
      g.intro_md,
      g.redeem_md,
      g.rewards_md,
      g.troubleshoot_md,
      g.find_codes_md
    ),
    4000
  )
)
from public.games g
where g.slug is not null
  and trim(g.slug) <> '';
