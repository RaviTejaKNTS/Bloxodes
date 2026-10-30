-- WARM runs every six hours, but successful samples schedule their next run
-- twelve hours after sampling, just after the next matching cron slot starts.
-- Allow the WARM tier worker to claim healthy rows up to one hour early. This
-- covers batch processing and the bounded 30-minute lock wait without adding
-- a cron run or shortening the successful twelve-hour recurrence.
--
-- Keep retry backoff, unavailable cooldowns, explicit-ID overrides, ALL and
-- other tier selection unchanged. A successful row is scheduled twelve hours
-- out, well beyond the grace window, so later batches cannot claim it again.
-- Preserve the narrow 500-row return contract and atomic SKIP LOCKED leases.

create or replace function public.claim_roblox_universe_stats_rows(
  p_worker_id text,
  p_tier text default 'HOT',
  p_limit integer default 100,
  p_lease_minutes integer default 45,
  p_universe_ids bigint[] default null
)
returns table (
  universe_id bigint,
  root_place_id bigint,
  slug text,
  playing bigint,
  visits bigint,
  favorites bigint,
  likes bigint,
  dislikes bigint,
  created_at_api timestamptz,
  updated_at_api timestamptz,
  stats_tier text,
  last_stats_refreshed_at timestamptz,
  last_seen_in_search timestamptz,
  last_seen_in_sort timestamptz,
  stats_refresh_attempt_count integer
)
language plpgsql
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  claim_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
  lease_cutoff timestamptz := now() - make_interval(mins => greatest(1, coalesce(p_lease_minutes, 45)));
  normalized_tier text := coalesce(nullif(upper(btrim(p_tier)), ''), 'HOT');
  normalized_worker text := coalesce(nullif(btrim(p_worker_id), ''), 'universe-stats');
begin
  if normalized_tier not in ('NEW', 'HOT', 'WARM', 'COLD', 'ALL') then
    raise exception 'Invalid universe stats tier: %', normalized_tier;
  end if;

  -- Reclaim a bounded number of abandoned leases on every claim.
  with expired as (
    select stale.universe_id
    from public.roblox_universes stale
    where stale.stats_refresh_locked_at < lease_cutoff
    order by stale.stats_refresh_locked_at, stale.universe_id
    limit claim_limit
    for update skip locked
  )
  update public.roblox_universes stale
  set
    stats_refresh_locked_at = null,
    stats_refresh_locked_by = null
  from expired
  where stale.universe_id = expired.universe_id;

  if p_universe_ids is not null then
    return query
    with candidates as (
      select candidate.universe_id
      from public.roblox_universes candidate
      where candidate.root_place_id > 0
        and candidate.stats_refresh_locked_at is null
        and candidate.universe_id = any(p_universe_ids)
      order by candidate.universe_id
      limit claim_limit
      for update skip locked
    ), claimed as (
      update public.roblox_universes claimed_row
      set
        stats_refresh_locked_at = now(),
        stats_refresh_locked_by = normalized_worker,
        stats_refresh_attempt_count = coalesce(claimed_row.stats_refresh_attempt_count, 0) + 1,
        last_stats_refresh_error = null
      from candidates
      where claimed_row.universe_id = candidates.universe_id
      returning
        claimed_row.universe_id, claimed_row.root_place_id, claimed_row.slug,
        claimed_row.playing, claimed_row.visits, claimed_row.favorites,
        claimed_row.likes, claimed_row.dislikes, claimed_row.created_at_api,
        claimed_row.updated_at_api, claimed_row.stats_tier,
        claimed_row.last_stats_refreshed_at, claimed_row.last_seen_in_search,
        claimed_row.last_seen_in_sort, claimed_row.stats_refresh_attempt_count
    )
    select
      claimed.universe_id, claimed.root_place_id, claimed.slug, claimed.playing,
      claimed.visits, claimed.favorites, claimed.likes, claimed.dislikes,
      claimed.created_at_api, claimed.updated_at_api, claimed.stats_tier,
      claimed.last_stats_refreshed_at, claimed.last_seen_in_search,
      claimed.last_seen_in_sort, claimed.stats_refresh_attempt_count
    from claimed;
    return;
  end if;

  if normalized_tier = 'ALL' then
    return query
    with candidates as (
      select candidate.universe_id
      from public.roblox_universes candidate
      where candidate.root_place_id > 0
        and candidate.stats_refresh_locked_at is null
        and (candidate.next_stats_refresh_at is null or candidate.next_stats_refresh_at <= now())
      order by
        candidate.next_stats_refresh_at asc nulls first,
        candidate.last_stats_refreshed_at asc nulls first,
        candidate.universe_id
      limit claim_limit
      for update skip locked
    ), claimed as (
      update public.roblox_universes claimed_row
      set
        stats_refresh_locked_at = now(),
        stats_refresh_locked_by = normalized_worker,
        stats_refresh_attempt_count = coalesce(claimed_row.stats_refresh_attempt_count, 0) + 1,
        last_stats_refresh_error = null
      from candidates
      where claimed_row.universe_id = candidates.universe_id
      returning
        claimed_row.universe_id, claimed_row.root_place_id, claimed_row.slug,
        claimed_row.playing, claimed_row.visits, claimed_row.favorites,
        claimed_row.likes, claimed_row.dislikes, claimed_row.created_at_api,
        claimed_row.updated_at_api, claimed_row.stats_tier,
        claimed_row.last_stats_refreshed_at, claimed_row.last_seen_in_search,
        claimed_row.last_seen_in_sort, claimed_row.stats_refresh_attempt_count
    )
    select
      claimed.universe_id, claimed.root_place_id, claimed.slug, claimed.playing,
      claimed.visits, claimed.favorites, claimed.likes, claimed.dislikes,
      claimed.created_at_api, claimed.updated_at_api, claimed.stats_tier,
      claimed.last_stats_refreshed_at, claimed.last_seen_in_search,
      claimed.last_seen_in_sort, claimed.stats_refresh_attempt_count
    from claimed;
    return;
  end if;

  return query
  with candidates as (
    select candidate.universe_id
    from public.roblox_universes candidate
    where candidate.root_place_id > 0
      and candidate.stats_refresh_locked_at is null
      and candidate.stats_tier = normalized_tier
      and (
        candidate.next_stats_refresh_at is null
        or candidate.next_stats_refresh_at <= now()
        or (
          normalized_tier = 'WARM'
          and candidate.next_stats_refresh_at <= now() + interval '1 hour'
          and coalesce(candidate.stats_refresh_attempt_count, 0) = 0
          and candidate.last_stats_refresh_error is null
          and candidate.stats_tier_reason is distinct from 'game_details_unavailable'
        )
      )
    order by
      candidate.next_stats_refresh_at asc nulls first,
      candidate.last_stats_refreshed_at asc nulls first,
      candidate.universe_id
    limit claim_limit
    for update skip locked
  ), claimed as (
    update public.roblox_universes claimed_row
    set
      stats_refresh_locked_at = now(),
      stats_refresh_locked_by = normalized_worker,
      stats_refresh_attempt_count = coalesce(claimed_row.stats_refresh_attempt_count, 0) + 1,
      last_stats_refresh_error = null
    from candidates
    where claimed_row.universe_id = candidates.universe_id
    returning
      claimed_row.universe_id, claimed_row.root_place_id, claimed_row.slug,
      claimed_row.playing, claimed_row.visits, claimed_row.favorites,
      claimed_row.likes, claimed_row.dislikes, claimed_row.created_at_api,
      claimed_row.updated_at_api, claimed_row.stats_tier,
      claimed_row.last_stats_refreshed_at, claimed_row.last_seen_in_search,
      claimed_row.last_seen_in_sort, claimed_row.stats_refresh_attempt_count
  )
  select
    claimed.universe_id, claimed.root_place_id, claimed.slug, claimed.playing,
    claimed.visits, claimed.favorites, claimed.likes, claimed.dislikes,
    claimed.created_at_api, claimed.updated_at_api, claimed.stats_tier,
    claimed.last_stats_refreshed_at, claimed.last_seen_in_search,
    claimed.last_seen_in_sort, claimed.stats_refresh_attempt_count
  from claimed;
end;
$$;

revoke all on function public.claim_roblox_universe_stats_rows(text, text, integer, integer, bigint[]) from public, anon, authenticated;
grant execute on function public.claim_roblox_universe_stats_rows(text, text, integer, integer, bigint[]) to service_role;

notify pgrst, 'reload schema';
