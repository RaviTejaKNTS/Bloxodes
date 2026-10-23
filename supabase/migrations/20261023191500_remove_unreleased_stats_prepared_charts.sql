-- Managed development applied the unreleased prepared-charts schema from PR 113
-- (20261023100441 and 20261023131347). That plan was replaced by a smaller fix
-- and never reached production. Remove its objects where they exist; this is a
-- no-op in production and takes no locks there.
do $$
begin
  if to_regnamespace('stats_prepared_private') is null
    and to_regclass('public.stats_prepared_control') is null then
    return;
  end if;

  drop trigger if exists stats_prepared_insert on public.roblox_universe_stats_hourly;
  drop trigger if exists stats_prepared_update on public.roblox_universe_stats_hourly;
  drop trigger if exists stats_prepared_delete on public.roblox_universe_stats_hourly;
  drop trigger if exists stats_prepared_truncate on public.roblox_universe_stats_hourly;
  drop trigger if exists stats_prepared_insert on public.roblox_universe_stats_daily;
  drop trigger if exists stats_prepared_update on public.roblox_universe_stats_daily;
  drop trigger if exists stats_prepared_delete on public.roblox_universe_stats_daily;
  drop trigger if exists stats_prepared_truncate on public.roblox_universe_stats_daily;
  drop trigger if exists stats_prepared_insert on public.roblox_universes;
  drop trigger if exists stats_prepared_update on public.roblox_universes;
  drop trigger if exists stats_prepared_delete on public.roblox_universes;

  drop function if exists public.get_stats_prepared_platform_chart_v1(text, text, boolean);
  drop function if exists public.get_stats_prepared_visit_share_v1(text);
  drop function if exists public.get_stats_prepared_health_v1();
  drop function if exists public.claim_stats_prepared_work_v1(text, uuid);
  drop function if exists public.run_stats_prepared_step_v1(uuid, bigint, uuid, jsonb);
  drop function if exists public.get_stats_prepared_receipt_v1(uuid);
  drop function if exists public.finish_stats_prepared_work_v1(uuid, bigint, jsonb);

  -- Only the private helper functions remain in this schema. One of them takes
  -- a stats_prepared_versions row, so it must go before the tables.
  drop schema if exists stats_prepared_private cascade;

  drop table if exists
    public.stats_prepared_receipts,
    public.stats_prepared_visit_ranges,
    public.stats_prepared_visit_totals,
    public.stats_prepared_visit_universes,
    public.stats_prepared_generations,
    public.stats_prepared_visits,
    public.stats_prepared_buckets,
    public.stats_prepared_versions,
    public.stats_prepared_dirty,
    public.stats_prepared_members,
    public.stats_prepared_control;
end $$;

notify pgrst, 'reload schema';
