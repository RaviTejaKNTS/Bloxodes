create or replace function public.get_stats_platform_ccu_trend(
  p_since timestamptz default now() - interval '24 hours'
)
returns table (
  hour_start timestamptz,
  players bigint,
  peak_players bigint,
  avg_players numeric,
  visits bigint,
  favorites bigint,
  rating numeric,
  samples bigint
)
language sql
stable
set search_path = ''
as $$
  with hourly as (
    select
      h.hour_start,
      coalesce(h.avg_playing, h.playing::numeric) as avg_player_value,
      h.peak_playing,
      h.visits_end,
      h.favorites_end,
      h.rating_percent,
      greatest(h.sample_count, 1) as sample_count
    from public.roblox_universe_stats_hourly h
    inner join public.stats_game_current_index g
      on g.universe_id = h.universe_id
    where h.hour_start >= p_since
  )
  select
    h.hour_start,
    coalesce(round(sum(h.avg_player_value))::bigint, 0::bigint) as players,
    coalesce(sum(coalesce(h.peak_playing, 0))::bigint, 0::bigint) as peak_players,
    coalesce(sum(h.avg_player_value), 0::numeric) as avg_players,
    coalesce(sum(coalesce(h.visits_end, 0))::bigint, 0::bigint) as visits,
    coalesce(sum(coalesce(h.favorites_end, 0))::bigint, 0::bigint) as favorites,
    case
      when sum(h.sample_count) filter (where h.rating_percent is not null) > 0 then
        round(
          sum(h.rating_percent * h.sample_count) filter (where h.rating_percent is not null)
          / sum(h.sample_count) filter (where h.rating_percent is not null),
          1
        )
      else null
    end as rating,
    coalesce(sum(h.sample_count)::bigint, 0::bigint) as samples
  from hourly h
  group by h.hour_start
  order by h.hour_start asc;
$$;

revoke all on function public.get_stats_platform_ccu_trend(timestamptz) from public, anon, authenticated;
grant execute on function public.get_stats_platform_ccu_trend(timestamptz) to service_role;
