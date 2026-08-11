-- Keep the universe-stats audit inside one database statement. The prior audit
-- issued many independent exact-count requests through PostgREST and routinely
-- hit the statement timeout, so freshness failures were not observable.

create or replace function public.get_roblox_universe_pipeline_health()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with universe_counts as (
    select
      count(*)::bigint as total,
      count(*) filter (where root_place_id > 0)::bigint as eligible_total,
      count(*) filter (where root_place_id > 0 and slug is not null)::bigint as with_slug,
      count(*) filter (where root_place_id > 0 and icon_url is not null)::bigint as with_icon,
      count(*) filter (where root_place_id > 0 and last_stats_refreshed_at is null)::bigint as never_stats_refreshed,
      count(*) filter (where root_place_id > 0 and last_playing_refreshed_at is null)::bigint as never_playing_refreshed,
      count(*) filter (
        where root_place_id > 0
          and (last_stats_refreshed_at is null or last_stats_refreshed_at < now() - interval '24 hours')
      )::bigint as stale_over_24h,
      count(*) filter (
        where root_place_id > 0
          and (last_stats_refreshed_at is null or last_stats_refreshed_at < now() - interval '7 days')
      )::bigint as stale_over_7d,
      count(*) filter (
        where root_place_id > 0
          and playing is not null
          and (last_playing_refreshed_at is null or last_playing_refreshed_at < now() - interval '24 hours')
      )::bigint as stale_player_values_over_24h,
      count(*) filter (
        where root_place_id > 0
          and playing is not null
          and (last_playing_refreshed_at is null or last_playing_refreshed_at < now() - interval '7 days')
      )::bigint as stale_player_values_over_7d,
      count(*) filter (
        where root_place_id > 0 and playing is not null and last_playing_refreshed_at >= now() - interval '24 hours'
      )::bigint as fresh_player_values_24h,
      count(*) filter (where stats_tier = 'HOT' and icon_url is null)::bigint as missing_icon_hot,
      count(*) filter (where stats_tier = 'WARM' and icon_url is null)::bigint as missing_icon_warm,
      count(*) filter (where stats_refresh_locked_at is not null)::bigint as active_stats_leases,
      count(*) filter (
        where stats_refresh_locked_at is not null and stats_refresh_locked_at < now() - interval '45 minutes'
      )::bigint as expired_stats_leases,
      count(*) filter (
        where last_stats_refresh_error is not null and next_stats_refresh_at > now()
      )::bigint as retry_backoff,
      count(*) filter (
        where stats_tier_reason = 'game_details_unavailable' and next_stats_refresh_at > now()
      )::bigint as unavailable_cooldowns,
      count(*) filter (where root_place_id > 0 and next_stats_refresh_at is not null)::bigint as rows_with_refresh_sla,
      count(*) filter (
        where root_place_id > 0 and (next_stats_refresh_at is null or next_stats_refresh_at <= now())
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
      count(*) filter (where playing is not null)::bigint as playing_total,
      count(*) filter (
        where playing is not null and last_playing_refreshed_at >= now() - interval '24 hours'
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
      'total', universe_counts.total,
      'eligible_total', universe_counts.eligible_total,
      'with_root_place', universe_counts.eligible_total,
      'with_slug', universe_counts.with_slug,
      'with_icon', universe_counts.with_icon,
      'never_stats_refreshed', universe_counts.never_stats_refreshed,
      'never_playing_refreshed', universe_counts.never_playing_refreshed,
      'stale_over_24h', universe_counts.stale_over_24h,
      'stale_over_7d', universe_counts.stale_over_7d,
      'stale_player_values_over_24h', universe_counts.stale_player_values_over_24h,
      'stale_player_values_over_7d', universe_counts.stale_player_values_over_7d,
      'fresh_player_values_24h', universe_counts.fresh_player_values_24h,
      'missing_icon_hot', universe_counts.missing_icon_hot,
      'missing_icon_warm', universe_counts.missing_icon_warm,
      'active_stats_leases', universe_counts.active_stats_leases,
      'expired_stats_leases', universe_counts.expired_stats_leases,
      'retry_backoff', universe_counts.retry_backoff,
      'unavailable_cooldowns', universe_counts.unavailable_cooldowns,
      'rows_with_refresh_sla', universe_counts.rows_with_refresh_sla,
      'stats_overdue', universe_counts.stats_overdue,
      'current_index_rows', index_counts.total,
      'current_index_playing_rows', index_counts.playing_total,
      'current_index_fresh_playing_24h', index_counts.fresh_playing_24h
    ),
    'latest', jsonb_build_object(
      'current_index', index_counts.latest_at,
      'hourly', (select hour_start from public.roblox_universe_stats_hourly order by hour_start desc limit 1),
      'daily', (select stat_date from public.roblox_universe_stats_daily order by stat_date desc limit 1),
      'rank_hourly', (select hour_start from public.roblox_universe_rank_snapshots_hourly order by hour_start desc limit 1),
      'rank_daily', (select stat_date from public.roblox_universe_rank_snapshots_daily order by stat_date desc limit 1)
    ),
    'recent_refresh_runs', recent_refresh_runs.value,
    'stale_job_runs', (
      select count(*)
      from public.stats_job_runs
      where status = 'running' and started_at < now() - interval '2 hours'
    )
  )
  from universe_counts
  cross join tier_counts
  cross join index_counts
  cross join recent_refresh_runs;
$$;

revoke all on function public.get_roblox_universe_pipeline_health() from public, anon, authenticated;
grant execute on function public.get_roblox_universe_pipeline_health() to service_role;

comment on function public.get_roblox_universe_pipeline_health() is
  'Single-statement game-stats freshness, scheduler, lease, and public-index health snapshot for strict automation audits.';
