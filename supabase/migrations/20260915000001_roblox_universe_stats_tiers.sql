alter table public.roblox_universes
  add column if not exists stats_tier text not null default 'NEW',
  add column if not exists stats_tier_updated_at timestamptz,
  add column if not exists stats_tier_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'roblox_universes_stats_tier_check'
  ) then
    alter table public.roblox_universes
      add constraint roblox_universes_stats_tier_check
      check (stats_tier in ('NEW', 'HOT', 'WARM', 'COLD'));
  end if;
end
$$;

update public.roblox_universes
set
  stats_tier = case
    when last_stats_refreshed_at is null or (playing is null and visits is null) then 'NEW'
    when coalesce(playing, 0) >= 100 or coalesce(visits, 0) >= 250000000 then 'HOT'
    when coalesce(playing, 0) >= 30 or coalesce(visits, 0) >= 10000000 then 'WARM'
    else 'COLD'
  end,
  stats_tier_updated_at = coalesce(stats_tier_updated_at, now()),
  stats_tier_reason = case
    when last_stats_refreshed_at is null or (playing is null and visits is null) then 'new_or_missing_stats'
    when coalesce(playing, 0) >= 100 then 'playing_gte_100'
    when coalesce(visits, 0) >= 250000000 then 'visits_gte_250m'
    when coalesce(playing, 0) >= 30 then 'playing_gte_30'
    when coalesce(visits, 0) >= 10000000 then 'visits_gte_10m'
    else 'remaining_valid_game'
  end;

create index if not exists idx_roblox_universes_stats_tier_refresh
  on public.roblox_universes (stats_tier, last_stats_refreshed_at asc nulls first, playing desc nulls last, visits desc nulls last);

create index if not exists idx_roblox_universes_stats_tier_playing
  on public.roblox_universes (stats_tier, playing desc nulls last);

create index if not exists idx_roblox_universes_stats_tier_visits
  on public.roblox_universes (stats_tier, visits desc nulls last);

alter table public.roblox_universe_media
  add column if not exists first_seen_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists source text;

create unique index if not exists idx_roblox_universe_media_unique_image
  on public.roblox_universe_media (universe_id, media_type, image_url)
  where image_url is not null;

create unique index if not exists idx_roblox_universe_media_unique_video
  on public.roblox_universe_media (universe_id, media_type, video_url)
  where video_url is not null;

drop index if exists public.idx_roblox_universes_quality;
drop index if exists public.idx_roblox_universes_deep_enriched;

create index if not exists idx_roblox_universes_deep_enriched_stats_tier
  on public.roblox_universes (last_deep_enriched_at asc nulls first, stats_tier, playing desc nulls last, visits desc nulls last);

alter table public.roblox_universes
  drop constraint if exists roblox_universes_quality_tier_check,
  drop column if exists discovery_score,
  drop column if exists quality_score,
  drop column if exists quality_tier,
  drop column if exists quality_reasons,
  drop column if exists last_quality_scored_at,
  drop column if exists is_quality_candidate;
