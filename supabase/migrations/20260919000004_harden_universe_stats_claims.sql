-- Make universe stats refresh claims atomic and honor the retry/SLA columns
-- already present on roblox_universes. Unavailable experiences remain on a
-- recoverable cooldown rather than repeatedly starving NEW and HOT work.

create or replace function public.claim_roblox_universe_stats_rows(
  p_worker_id text,
  p_tier text default 'HOT',
  p_limit integer default 100,
  p_lease_minutes integer default 45,
  p_universe_ids bigint[] default null
)
returns setof public.roblox_universes
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select universe.universe_id
    from public.roblox_universes universe
    where universe.root_place_id > 0
      and (
        universe.stats_refresh_locked_at is null
        or universe.stats_refresh_locked_at < now() - make_interval(mins => greatest(1, coalesce(p_lease_minutes, 45)))
      )
      and (
        p_universe_ids is not null and universe.universe_id = any(p_universe_ids)
        or p_universe_ids is null and (
          coalesce(nullif(upper(p_tier), ''), 'HOT') = 'ALL'
          or universe.stats_tier = upper(p_tier)
        ) and (
          universe.next_stats_refresh_at is null
          or universe.next_stats_refresh_at <= now()
        )
      )
    order by
      universe.next_stats_refresh_at asc nulls first,
      universe.last_stats_refreshed_at asc nulls first,
      case when upper(p_tier) = 'NEW' then universe.last_seen_in_sort end desc nulls last,
      case when upper(p_tier) = 'NEW' then universe.last_seen_in_search end desc nulls last,
      universe.playing desc nulls last,
      universe.visits desc nulls last,
      universe.universe_id
    limit greatest(1, least(coalesce(p_limit, 100), 20000))
    for update skip locked
  ), claimed as (
    update public.roblox_universes universe
    set
      stats_refresh_locked_at = now(),
      stats_refresh_locked_by = coalesce(nullif(p_worker_id, ''), 'universe-stats'),
      stats_refresh_attempt_count = universe.stats_refresh_attempt_count + 1,
      last_stats_refresh_error = null
    from candidates
    where universe.universe_id = candidates.universe_id
    returning universe.*
  )
  select * from claimed;
end;
$$;

create or replace function public.release_roblox_universe_stats_rows(
  p_worker_id text,
  p_universe_ids bigint[],
  p_error text default null,
  p_next_run_at timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
begin
  update public.roblox_universes
  set
    stats_refresh_locked_at = null,
    stats_refresh_locked_by = null,
    last_stats_refresh_error = p_error,
    next_stats_refresh_at = coalesce(p_next_run_at, next_stats_refresh_at)
  where universe_id = any(coalesce(p_universe_ids, '{}'::bigint[]))
    and stats_refresh_locked_by = coalesce(nullif(p_worker_id, ''), 'universe-stats');

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.claim_roblox_universe_stats_rows(text, text, integer, integer, bigint[]) from public, anon, authenticated;
revoke all on function public.release_roblox_universe_stats_rows(text, bigint[], text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_roblox_universe_stats_rows(text, text, integer, integer, bigint[]) to service_role;
grant execute on function public.release_roblox_universe_stats_rows(text, bigint[], text, timestamptz) to service_role;
