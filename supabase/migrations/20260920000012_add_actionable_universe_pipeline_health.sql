-- Report trackable current-player coverage separately from quarantined and
-- never-successful games, and include recent worker outcomes rather than only
-- worker starts.

create or replace function public.get_roblox_universe_pipeline_health_v4()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with universe_counts as (
    select
      count(*) filter (
        where root_place_id > 0 and slug is not null
      )::bigint as indexable_total,
      count(*) filter (
        where root_place_id > 0
          and playing is not null
          and stats_tier_reason is distinct from 'game_details_unavailable'
      )::bigint as trackable_player_total,
      count(*) filter (
        where root_place_id > 0
          and playing is not null
          and stats_tier_reason is distinct from 'game_details_unavailable'
          and last_playing_refreshed_at >= now() - interval '24 hours'
      )::bigint as fresh_trackable_player_values_24h,
      count(*) filter (
        where root_place_id > 0
          and stats_tier_reason = 'game_details_unavailable'
      )::bigint as unavailable_total,
      count(*) filter (
        where root_place_id > 0
          and stats_tier = 'NEW'
          and last_stats_refreshed_at is null
      )::bigint as new_never_successful_total,
      count(*) filter (
        where root_place_id > 0
          and stats_tier = 'NEW'
          and last_stats_refreshed_at is null
          and created_at < now() - interval '24 hours'
      )::bigint as new_never_successful_over_24h,
      count(*) filter (
        where stats_refresh_locked_at is not null
          and stats_refresh_locked_at < now() - interval '45 minutes'
      )::bigint as expired_stats_leases,
      count(*) filter (
        where root_place_id > 0
          and stats_tier_reason is distinct from 'game_details_unavailable'
          and (next_stats_refresh_at is null or next_stats_refresh_at <= now())
      )::bigint as stats_overdue
    from public.roblox_universes
  ), tier_counts as (
    select coalesce(jsonb_object_agg(stats_tier, tier_total), '{}'::jsonb) as value
    from (
      select stats_tier, count(*)::bigint as tier_total
      from public.roblox_universes
      where root_place_id > 0 and stats_tier is not null
      group by stats_tier
    ) grouped
  ), index_counts as (
    select
      count(*)::bigint as total,
      count(*) filter (
        where playing is not null
          and last_playing_refreshed_at >= now() - interval '24 hours'
      )::bigint as fresh_playing_24h,
      max(indexed_at) as latest_at
    from public.stats_game_current_index
  ), recent_refresh_runs as (
    select coalesce(jsonb_object_agg(job_name, run_health), '{}'::jsonb) as value
    from (
      select
        job_name,
        jsonb_build_object(
          'started', count(*),
          'successful', count(*) filter (where status = 'success'),
          'rows_succeeded', coalesce(sum(rows_succeeded), 0),
          'rows_failed', coalesce(sum(rows_failed), 0),
          'latest_started_at', max(started_at),
          'latest_finished_at', max(finished_at)
        ) as run_health
      from public.stats_job_runs
      where started_at >= now() - interval '6 hours'
        and job_name in ('stats_refresh_new', 'stats_refresh_warm', 'stats_refresh_cold')
      group by job_name
    ) grouped
  )
  select jsonb_build_object(
    'generated_at', now(),
    'tiers', tier_counts.value,
    'counts', jsonb_build_object(
      'indexable_total', universe_counts.indexable_total,
      'trackable_player_total', universe_counts.trackable_player_total,
      'fresh_trackable_player_values_24h', universe_counts.fresh_trackable_player_values_24h,
      'unavailable_total', universe_counts.unavailable_total,
      'new_never_successful_total', universe_counts.new_never_successful_total,
      'new_never_successful_over_24h', universe_counts.new_never_successful_over_24h,
      'expired_stats_leases', universe_counts.expired_stats_leases,
      'stats_overdue', universe_counts.stats_overdue,
      'current_index_rows', index_counts.total,
      'current_index_fresh_playing_24h', index_counts.fresh_playing_24h
    ),
    'latest', jsonb_build_object(
      'current_index', index_counts.latest_at,
      'hourly', (select hour_start from public.roblox_universe_stats_hourly order by hour_start desc limit 1),
      'rank_hourly', (select hour_start from public.roblox_universe_rank_snapshots_hourly order by hour_start desc limit 1)
    ),
    'recent_refresh_runs', recent_refresh_runs.value,
    'stale_job_runs', (
      select count(*)
      from public.stats_job_runs
      where status = 'running'
        and started_at >= now() - interval '24 hours'
        and started_at < now() - interval '2 hours'
        and (
          job_name like 'stats_refresh_%'
          or job_name like 'stats_universe_%'
          or job_name like 'discover_universes_%'
          or job_name in ('stats_current_index_rebuild', 'stats_rank_playing')
        )
    )
  )
  from universe_counts
  cross join tier_counts
  cross join index_counts
  cross join recent_refresh_runs;
$$;

revoke all on function public.get_roblox_universe_pipeline_health_v4()
  from public, anon, authenticated;
grant execute on function public.get_roblox_universe_pipeline_health_v4()
  to service_role;
