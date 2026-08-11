-- Scope the universe audit's stale-run signal to recent universe work. The
-- base snapshot intentionally remains unchanged for migration history; this
-- wrapper overrides only the stale_job_runs field so old item-pipeline records
-- cannot make the game-stats audit permanently unhealthy.

create or replace function public.get_roblox_universe_pipeline_health_v2()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_set(
    public.get_roblox_universe_pipeline_health(),
    '{stale_job_runs}',
    to_jsonb((
      select count(*)
      from public.stats_job_runs
      where status = 'running'
        and started_at >= now() - interval '24 hours'
        and started_at < now() - interval '2 hours'
        and (
          job_name like 'stats_refresh_%'
          or job_name like 'stats_universe_%'
          or job_name like 'discover_universes_%'
          or job_name in ('stats_current_index_rebuild', 'stats_rank_playing', 'stats_rank_all')
        )
    )),
    true
  );
$$;

revoke all on function public.get_roblox_universe_pipeline_health_v2() from public, anon, authenticated;
grant execute on function public.get_roblox_universe_pipeline_health_v2() to service_role;

comment on function public.get_roblox_universe_pipeline_health_v2() is
  'Universe pipeline health with the stale-run signal limited to relevant jobs from the last 24 hours.';
