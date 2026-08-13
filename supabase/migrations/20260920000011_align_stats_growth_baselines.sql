-- Compare current CCU with history on the same observation clock. The old
-- global +/-90-minute windows were incompatible with 12-hour WARM and
-- 20-hour COLD sampling, so valid history appeared as "Not tracked".

alter function public.refresh_stats_current_indexes()
  rename to refresh_stats_current_indexes_legacy_20260920;

revoke all on function public.refresh_stats_current_indexes_legacy_20260920()
  from public, anon, authenticated, service_role;

create or replace function public.refresh_stats_current_indexes()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
set statement_timeout = '240s'
as $$
declare
  base_result jsonb := '{}'::jsonb;
  refreshed_at timestamptz := statement_timestamp();
  riser_count integer := 0;
begin
  base_result := public.refresh_stats_current_indexes_legacy_20260920();
  perform set_config('statement_timeout', '240000', true);

  with baselines as materialized (
    select
      game.universe_id,
      baseline_24h.playing as playing_24h,
      baseline_7d.playing as playing_7d
    from public.stats_game_current_index game
    left join lateral (
      select history.playing
      from public.roblox_universe_stats_hourly history
      where history.universe_id = game.universe_id
        and history.playing is not null
        and history.hour_start between
          date_trunc('hour', game.last_playing_refreshed_at - interval '24 hours')
            - case game.stats_tier
                when 'HOT' then interval '90 minutes'
                when 'WARM' then interval '7 hours'
                else interval '12 hours'
              end
          and date_trunc('hour', game.last_playing_refreshed_at - interval '24 hours')
            + case game.stats_tier
                when 'HOT' then interval '90 minutes'
                when 'WARM' then interval '7 hours'
                else interval '12 hours'
              end
      order by
        abs(extract(epoch from (
          history.hour_start - date_trunc('hour', game.last_playing_refreshed_at - interval '24 hours')
        ))),
        history.hour_start desc
      limit 1
    ) baseline_24h on game.last_playing_refreshed_at is not null
    left join lateral (
      select history.playing
      from public.roblox_universe_stats_hourly history
      where history.universe_id = game.universe_id
        and history.playing is not null
        and history.hour_start between
          date_trunc('hour', game.last_playing_refreshed_at - interval '7 days')
            - case game.stats_tier
                when 'HOT' then interval '90 minutes'
                when 'WARM' then interval '7 hours'
                else interval '12 hours'
              end
          and date_trunc('hour', game.last_playing_refreshed_at - interval '7 days')
            + case game.stats_tier
                when 'HOT' then interval '90 minutes'
                when 'WARM' then interval '7 hours'
                else interval '12 hours'
              end
      order by
        abs(extract(epoch from (
          history.hour_start - date_trunc('hour', game.last_playing_refreshed_at - interval '7 days')
        ))),
        history.hour_start desc
      limit 1
    ) baseline_7d on game.last_playing_refreshed_at is not null
  )
  update public.stats_game_current_index game
  set
    baseline_playing_24h = baselines.playing_24h,
    baseline_playing_7d = baselines.playing_7d,
    growth_24h = case
      when game.playing is not null and baselines.playing_24h is not null
      then game.playing - baselines.playing_24h
      else null
    end,
    growth_24h_percent = public.percent_delta(game.playing::numeric, baselines.playing_24h::numeric),
    growth_7d = case
      when game.playing is not null and baselines.playing_7d is not null
      then game.playing - baselines.playing_7d
      else null
    end,
    growth_7d_percent = public.percent_delta(game.playing::numeric, baselines.playing_7d::numeric)
  from baselines
  where game.universe_id = baselines.universe_id;

  delete from public.stats_risers_current_index where true;

  with eligible as (
    select
      universe_id,
      slug,
      name,
      icon_url,
      coalesce(genre_l1, genre) as genre,
      playing,
      baseline_playing_24h,
      growth_24h,
      growth_24h_percent,
      (
        least(greatest(coalesce(growth_24h, 0), 0), 50000)::numeric / 50000 * 55
        + least(greatest(coalesce(growth_24h_percent, 0), 0), 300)::numeric / 300 * 30
        + least(log(greatest(coalesce(playing, 1), 1)::numeric) / log(1000000::numeric), 1) * 15
      ) as riser_score
    from public.stats_game_current_index
    where playing >= 1000
      and baseline_playing_24h is not null
      and growth_24h > 0
      and growth_24h_percent is not null
  ), ranked as (
    select
      *,
      row_number() over (
        order by riser_score desc, growth_24h desc, playing desc, universe_id
      ) as rank_value
    from eligible
  )
  insert into public.stats_risers_current_index (
    universe_id,
    slug,
    name,
    icon_url,
    genre,
    playing,
    baseline_playing_24h,
    growth_24h,
    growth_24h_percent,
    riser_score,
    eligibility_threshold,
    rank_value,
    indexed_at
  )
  select
    universe_id,
    slug,
    name,
    icon_url,
    genre,
    playing,
    baseline_playing_24h,
    growth_24h,
    growth_24h_percent,
    riser_score,
    1000,
    rank_value,
    refreshed_at
  from ranked;

  get diagnostics riser_count = row_count;
  return base_result || jsonb_build_object(
    'growth_baselines', 'tier_aware',
    'risers', riser_count
  );
end;
$$;

revoke all on function public.refresh_stats_current_indexes()
  from public, anon, authenticated;
grant execute on function public.refresh_stats_current_indexes()
  to service_role;
