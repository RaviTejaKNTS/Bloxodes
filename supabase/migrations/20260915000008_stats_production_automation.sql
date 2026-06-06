alter table public.roblox_universes
  add column if not exists next_stats_refresh_at timestamptz,
  add column if not exists stats_refresh_locked_at timestamptz,
  add column if not exists stats_refresh_locked_by text,
  add column if not exists stats_refresh_attempt_count integer not null default 0,
  add column if not exists last_stats_refresh_error text;

create table if not exists public.stats_job_runs (
  id uuid primary key default extensions.uuid_generate_v4(),
  job_name text not null,
  worker_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  rows_claimed integer not null default 0,
  rows_succeeded integer not null default 0,
  rows_failed integer not null default 0,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint stats_job_runs_status_check
    check (status in ('running', 'success', 'failed', 'partial', 'skipped'))
);

create index if not exists idx_stats_job_runs_job_started
  on public.stats_job_runs (job_name, started_at desc);

create index if not exists idx_stats_job_runs_status_started
  on public.stats_job_runs (status, started_at desc);

alter table public.stats_job_runs enable row level security;

grant all on table public.stats_job_runs to service_role;

create index if not exists idx_roblox_universes_stats_refresh_lease
  on public.roblox_universes (
    stats_tier,
    next_stats_refresh_at asc nulls first,
    stats_refresh_locked_at asc nulls first,
    last_stats_refreshed_at asc nulls first,
    universe_id
  )
  where root_place_id is not null;

create index if not exists idx_roblox_universes_stats_tier_refresh_v2
  on public.roblox_universes (
    stats_tier,
    last_stats_refreshed_at asc nulls first,
    last_playing_refreshed_at asc nulls first,
    playing desc nulls last,
    visits desc nulls last,
    universe_id
  )
  where root_place_id is not null;

create index if not exists idx_roblox_universes_new_refresh_v2
  on public.roblox_universes (
    last_stats_refreshed_at asc nulls first,
    universe_id
  )
  where root_place_id is not null
    and (
      stats_tier = 'NEW'
      or last_stats_refreshed_at is null
      or playing is null
      or visits is null
    );

create index if not exists idx_roblox_universes_rank_playing_v2
  on public.roblox_universes (playing desc nulls last, universe_id)
  where playing is not null and (stats_tier is null or stats_tier <> 'NEW');

create index if not exists idx_roblox_universes_rank_visits_v2
  on public.roblox_universes (visits desc nulls last, universe_id)
  where visits is not null and (stats_tier is null or stats_tier <> 'NEW');

create index if not exists idx_roblox_universes_rank_favorites_v2
  on public.roblox_universes (favorites desc nulls last, universe_id)
  where favorites is not null and (stats_tier is null or stats_tier <> 'NEW');

create index if not exists idx_roblox_universes_rank_rating_seed_v2
  on public.roblox_universes (likes desc nulls last, universe_id)
  where likes is not null and (stats_tier is null or stats_tier <> 'NEW');

create index if not exists idx_roblox_universes_genre_playing_rank_v2
  on public.roblox_universes (genre_l1, playing desc nulls last, universe_id)
  where genre_l1 is not null and playing is not null and (stats_tier is null or stats_tier <> 'NEW');

create index if not exists idx_roblox_universes_subgenre_playing_rank_v2
  on public.roblox_universes (genre_l2, playing desc nulls last, universe_id)
  where genre_l2 is not null and playing is not null and (stats_tier is null or stats_tier <> 'NEW');

create index if not exists idx_roblox_rank_hourly_universe_type_hour_v2
  on public.roblox_universe_rank_snapshots_hourly (universe_id, rank_type, hour_start desc);

create index if not exists idx_roblox_rank_daily_universe_type_date_v2
  on public.roblox_universe_rank_snapshots_daily (universe_id, rank_type, stat_date desc);

create index if not exists idx_roblox_rank_hourly_hour_v2
  on public.roblox_universe_rank_snapshots_hourly (hour_start);

create index if not exists idx_roblox_virtual_events_universe_range_v2
  on public.roblox_virtual_events (universe_id, start_utc, end_utc);

create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_roblox_universes_display_name_trgm
  on public.roblox_universes
  using gin (display_name "extensions"."gin_trgm_ops");

create index if not exists idx_roblox_universes_slug_trgm
  on public.roblox_universes
  using gin (slug "extensions"."gin_trgm_ops");

create or replace function public.record_stats_health_check()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  run_id uuid;
  payload jsonb;
begin
  select jsonb_build_object(
    'checked_at', now(),
    'tier_counts', (
      select coalesce(jsonb_object_agg(stats_tier, count), '{}'::jsonb)
      from (
        select coalesce(stats_tier, 'UNKNOWN') as stats_tier, count(*)::integer as count
        from public.roblox_universes
        where root_place_id is not null
        group by coalesce(stats_tier, 'UNKNOWN')
      ) counts
    ),
    'stale', jsonb_build_object(
      'hot_over_90m', (
        select count(*)::integer
        from public.roblox_universes
        where root_place_id is not null
          and stats_tier = 'HOT'
          and (last_stats_refreshed_at is null or last_stats_refreshed_at < now() - interval '90 minutes')
      ),
      'warm_over_14h', (
        select count(*)::integer
        from public.roblox_universes
        where root_place_id is not null
          and stats_tier = 'WARM'
          and (last_stats_refreshed_at is null or last_stats_refreshed_at < now() - interval '14 hours')
      ),
      'cold_over_7d', (
        select count(*)::integer
        from public.roblox_universes
        where root_place_id is not null
          and stats_tier = 'COLD'
          and (last_stats_refreshed_at is null or last_stats_refreshed_at < now() - interval '7 days')
      ),
      'new_total', (
        select count(*)::integer
        from public.roblox_universes
        where root_place_id is not null
          and stats_tier = 'NEW'
      )
    ),
    'latest_hourly_sample', (
      select max(hour_start)
      from public.roblox_universe_stats_hourly
    ),
    'latest_hourly_rank', (
      select max(hour_start)
      from public.roblox_universe_rank_snapshots_hourly
    ),
    'latest_daily_rollup', (
      select max(stat_date)
      from public.roblox_universe_stats_daily
    ),
    'latest_daily_rank', (
      select max(stat_date)
      from public.roblox_universe_rank_snapshots_daily
    )
  )
  into payload;

  insert into public.stats_job_runs (
    job_name,
    worker_id,
    started_at,
    finished_at,
    status,
    metadata
  )
  values (
    'stats-health-check',
    'supabase-cron',
    now(),
    now(),
    'success',
    payload
  )
  returning id into run_id;

  return run_id;
end;
$$;

revoke all on function public.record_stats_health_check() from public, anon, authenticated;
grant execute on function public.record_stats_health_check() to postgres, service_role;

create or replace function public.run_roblox_universe_hourly_prune(
  p_days integer default 90,
  p_batch_size integer default 5000,
  p_max_batches integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := date_trunc('hour', now() - make_interval(days => greatest(p_days, 1)));
  batch integer;
  result jsonb;
  stats_deleted integer;
  rank_deleted integer;
  total_stats_deleted integer := 0;
  total_rank_deleted integer := 0;
begin
  for batch in 1..greatest(p_max_batches, 1) loop
    result := public.prune_roblox_universe_hourly_history(cutoff, greatest(p_batch_size, 1));
    stats_deleted := coalesce((result->>'stats_deleted')::integer, 0);
    rank_deleted := coalesce((result->>'rank_deleted')::integer, 0);
    total_stats_deleted := total_stats_deleted + stats_deleted;
    total_rank_deleted := total_rank_deleted + rank_deleted;
    exit when stats_deleted < greatest(p_batch_size, 1)
      and rank_deleted < greatest(p_batch_size, 1);
  end loop;

  insert into public.stats_job_runs (
    job_name,
    worker_id,
    started_at,
    finished_at,
    status,
    rows_succeeded,
    metadata
  )
  values (
    'hourly-history-prune',
    'supabase-cron',
    now(),
    now(),
    'success',
    total_stats_deleted + total_rank_deleted,
    jsonb_build_object(
      'cutoff', cutoff,
      'days', p_days,
      'batch_size', p_batch_size,
      'max_batches', p_max_batches,
      'stats_deleted', total_stats_deleted,
      'rank_deleted', total_rank_deleted
    )
  );

  return jsonb_build_object(
    'cutoff', cutoff,
    'stats_deleted', total_stats_deleted,
    'rank_deleted', total_rank_deleted
  );
end;
$$;

revoke all on function public.run_roblox_universe_hourly_prune(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.run_roblox_universe_hourly_prune(integer, integer, integer) to postgres, service_role;

do $$
begin
  perform cron.unschedule('stats health check');
exception
  when others then
    null;
end;
$$;

select cron.schedule(
  'stats health check',
  '*/15 * * * *',
  'select public.record_stats_health_check();'
);

do $$
begin
  perform cron.unschedule('stats daily rollup finalize');
exception
  when others then
    null;
end;
$$;

select cron.schedule(
  'stats daily rollup finalize',
  '20 0 * * *',
  'select public.rollup_roblox_universe_stats_daily((current_date - 1)::date, true);'
);

do $$
begin
  perform cron.unschedule('stats hourly history prune');
exception
  when others then
    null;
end;
$$;

select cron.schedule(
  'stats hourly history prune',
  '25 1 * * *',
  'select public.run_roblox_universe_hourly_prune(90, 5000, 200);'
);
