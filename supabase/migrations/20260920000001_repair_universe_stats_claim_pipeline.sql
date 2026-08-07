-- Keep universe refresh claims smaller than the Data API response cap, return
-- only worker-required columns, and serialize cross-host stats jobs.

create index if not exists idx_roblox_universes_stats_due_unlocked
  on public.roblox_universes (
    stats_tier,
    next_stats_refresh_at asc nulls first,
    last_stats_refreshed_at asc nulls first,
    universe_id
  )
  where root_place_id > 0 and stats_refresh_locked_at is null;

create index if not exists idx_roblox_universes_stats_locked_at
  on public.roblox_universes (stats_refresh_locked_at, universe_id)
  where stats_refresh_locked_at is not null;

-- Repair leases hidden by the previous set-returning RPC response cap.
update public.roblox_universes
set
  stats_refresh_locked_at = null,
  stats_refresh_locked_by = null
where stats_refresh_locked_at < now() - interval '45 minutes';

-- The public listing intentionally expires player counts after 24 hours, so a
-- COLD row cannot retain a seven-day next-run timestamp.
update public.roblox_universes
set next_stats_refresh_at = coalesce(last_stats_refreshed_at, now()) + interval '24 hours'
where stats_tier = 'COLD'
  and next_stats_refresh_at > coalesce(last_stats_refreshed_at, now()) + interval '24 hours';

drop function if exists public.claim_roblox_universe_stats_rows(text, text, integer, integer, bigint[]);

create function public.claim_roblox_universe_stats_rows(
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

  -- Reclaim a bounded number of abandoned leases on every claim. The initial
  -- migration update above repairs the existing large leak in one operation.
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
end;
$$;

revoke all on function public.claim_roblox_universe_stats_rows(text, text, integer, integer, bigint[]) from public, anon, authenticated;
grant execute on function public.claim_roblox_universe_stats_rows(text, text, integer, integer, bigint[]) to service_role;

create table if not exists public.stats_pipeline_leases (
  lease_name text primary key,
  locked_by text not null,
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.stats_pipeline_leases enable row level security;
revoke all on table public.stats_pipeline_leases from public, anon, authenticated;
grant all on table public.stats_pipeline_leases to service_role;

create or replace function public.claim_stats_pipeline_lease(
  p_lease_name text,
  p_worker_id text,
  p_lease_minutes integer default 120
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  acquired boolean := false;
  normalized_name text := nullif(btrim(p_lease_name), '');
  normalized_worker text := nullif(btrim(p_worker_id), '');
begin
  if normalized_name is null or normalized_worker is null then
    raise exception 'A non-empty lease name and worker ID are required';
  end if;

  insert into public.stats_pipeline_leases as lease (
    lease_name,
    locked_by,
    locked_at,
    expires_at,
    updated_at
  ) values (
    normalized_name,
    normalized_worker,
    now(),
    now() + make_interval(mins => greatest(1, least(coalesce(p_lease_minutes, 120), 360))),
    now()
  )
  on conflict (lease_name) do update
  set
    locked_by = excluded.locked_by,
    locked_at = excluded.locked_at,
    expires_at = excluded.expires_at,
    updated_at = excluded.updated_at
  where lease.expires_at <= now()
  returning true into acquired;

  return coalesce(acquired, false);
end;
$$;

create or replace function public.release_stats_pipeline_lease(
  p_lease_name text,
  p_worker_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  released boolean := false;
begin
  delete from public.stats_pipeline_leases
  where lease_name = nullif(btrim(p_lease_name), '')
    and locked_by = nullif(btrim(p_worker_id), '')
  returning true into released;

  return coalesce(released, false);
end;
$$;

revoke all on function public.claim_stats_pipeline_lease(text, text, integer) from public, anon, authenticated;
revoke all on function public.release_stats_pipeline_lease(text, text) from public, anon, authenticated;
grant execute on function public.claim_stats_pipeline_lease(text, text, integer) to service_role;
grant execute on function public.release_stats_pipeline_lease(text, text) to service_role;

create or replace function public.refresh_stats_current_indexes_serialized()
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '240s'
as $$
declare
  game_result jsonb := '{}'::jsonb;
  creator_result jsonb := '{}'::jsonb;
begin
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('refresh_stats_current_indexes', 0)) then
    return jsonb_build_object('skipped', true, 'reason', 'lock_busy');
  end if;

  game_result := public.refresh_stats_current_indexes();
  creator_result := public.refresh_stats_creator_current_index();

  return coalesce(game_result, '{}'::jsonb)
    || coalesce(creator_result, '{}'::jsonb)
    || jsonb_build_object('skipped', false);
end;
$$;

revoke all on function public.refresh_stats_current_indexes_serialized() from public, anon, authenticated;
grant execute on function public.refresh_stats_current_indexes_serialized() to service_role;
