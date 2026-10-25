-- The nightly prune still fell behind after 20261024021500.
--
-- 1. Each batch picked its rows with a plain `limit`, so the planner chose a
--    sequential scan from the start of the table. Rows deleted by earlier
--    batches stay there as dead tuples until vacuum, so every batch read more
--    dead pages than the last and soon hit the 8 s statement timeout (on
--    October 25 even 500-row batches timed out). Ordering by hour_start uses
--    the hour_start indexes and starts at the oldest live rows.
-- 2. The 1% autovacuum trigger is about 1.8M dead rows on the ~180M-row rank
--    table, more than one night's prune leaves, so autovacuum and autoanalyze
--    had never run there. Use fixed row thresholds instead.
create or replace function public.prune_roblox_universe_hourly_history(
  p_cutoff timestamptz,
  p_batch_size integer default 5000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  stats_deleted integer := 0;
  rank_deleted integer := 0;
begin
  with doomed as (
    select ctid
    from public.roblox_universe_stats_hourly
    where hour_start < p_cutoff
    order by hour_start
    limit greatest(p_batch_size, 1)
  ),
  deleted as (
    delete from public.roblox_universe_stats_hourly h
    using doomed
    where h.ctid = doomed.ctid
    returning 1
  )
  select count(*) into stats_deleted from deleted;

  with doomed as (
    select ctid
    from public.roblox_universe_rank_snapshots_hourly
    where hour_start < p_cutoff
    order by hour_start
    limit greatest(p_batch_size, 1)
  ),
  deleted as (
    delete from public.roblox_universe_rank_snapshots_hourly h
    using doomed
    where h.ctid = doomed.ctid
    returning 1
  )
  select count(*) into rank_deleted from deleted;

  return jsonb_build_object(
    'stats_deleted', stats_deleted,
    'rank_deleted', rank_deleted,
    'cutoff', p_cutoff
  );
end;
$$;

revoke all on function public.prune_roblox_universe_hourly_history(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.prune_roblox_universe_hourly_history(timestamptz, integer) to service_role;

-- Changing storage parameters takes only a SHARE UPDATE EXCLUSIVE lock.
alter table public.roblox_universe_stats_hourly set (
  autovacuum_vacuum_scale_factor = 0,
  autovacuum_vacuum_threshold = 200000,
  autovacuum_analyze_scale_factor = 0,
  autovacuum_analyze_threshold = 1000000
);

alter table public.roblox_universe_rank_snapshots_hourly set (
  autovacuum_vacuum_scale_factor = 0,
  autovacuum_vacuum_threshold = 200000,
  autovacuum_analyze_scale_factor = 0,
  autovacuum_analyze_threshold = 1000000
);
