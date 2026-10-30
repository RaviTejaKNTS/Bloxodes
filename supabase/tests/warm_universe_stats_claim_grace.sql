-- GitHub-only fixture, inside the transaction opened by warm-claim-sql.test.ts.
-- The harness creates an empty minimal table and rolls everything back.
insert into public.roblox_universes (
  universe_id, root_place_id, stats_tier, next_stats_refresh_at,
  last_stats_refreshed_at, stats_refresh_attempt_count, last_stats_refresh_error,
  stats_refresh_locked_at, stats_refresh_locked_by, stats_tier_reason
)
values
  -- Reproduce a 06:32 claim missing samples due between 06:32 and 07:00.
  (1, 1, 'WARM', now() + interval '28 minutes', now() - interval '11 hours 32 minutes', 0, null, null, null, null),
  (2, 2, 'WARM', now() + interval '1 hour', now() - interval '11 hours', 0, null, null, null, null),
  (3, 3, 'WARM', now() + interval '1 hour 1 second', now() - interval '11 hours', 0, null, null, null, null),
  (4, 4, 'WARM', now() + interval '28 minutes', now() - interval '12 hours', 1, 'retry', null, null, null),
  (5, 5, 'WARM', now() + interval '28 minutes', now() - interval '12 hours', 0, 'retry', null, null, null),
  (6, 6, 'WARM', now() + interval '28 minutes', now() - interval '12 hours', 0, null, null, null, 'game_details_unavailable'),
  (7, 7, 'WARM', now() - interval '1 minute', now() - interval '12 hours', 1, 'retry', null, null, null),
  (8, 8, 'WARM', null, null, 0, null, null, null, null),
  (9, 9, 'WARM', now() + interval '28 minutes', now() - interval '12 hours', 0, null, now(), 'active', null),
  (10, 10, 'WARM', now() + interval '28 minutes', now() - interval '12 hours', 0, null, now() - interval '46 minutes', 'expired', null),
  (11, 0, 'WARM', now(), null, 0, null, null, null, null),
  (12, 12, 'HOT', now() + interval '28 minutes', now(), 0, null, null, null, null),
  (13, 13, 'COLD', now() + interval '28 minutes', now(), 0, null, null, null, null),
  (14, 14, 'NEW', now() + interval '28 minutes', null, 0, null, null, null, null);

do $$
declare
  ids bigint[];
  claimed record;
  tier text;
begin
  if has_function_privilege('anon', 'public.claim_roblox_universe_stats_rows(text,text,integer,integer,bigint[])', 'execute')
    or has_function_privilege('authenticated', 'public.claim_roblox_universe_stats_rows(text,text,integer,integer,bigint[])', 'execute')
    or not has_function_privilege('service_role', 'public.claim_roblox_universe_stats_rows(text,text,integer,integer,bigint[])', 'execute') then
    raise exception 'Claim RPC grants are not service-only';
  end if;

  -- ALL still claims only due work, with no WARM grace.
  select array_agg(universe_id order by universe_id) into ids
  from public.claim_roblox_universe_stats_rows('all-worker', 'ALL', 500, 45);
  if ids is distinct from array[7,8]::bigint[] then
    raise exception 'ALL selection changed: %', ids;
  end if;
  update public.roblox_universes set stats_refresh_locked_at = null, stats_refresh_locked_by = null,
    stats_refresh_attempt_count = case when universe_id = 7 then 1 else 0 end,
    last_stats_refresh_error = case when universe_id = 7 then 'retry' else null end
  where universe_id in (7,8);

  select array_agg(universe_id order by universe_id) into ids
  from public.claim_roblox_universe_stats_rows('warm-one', ' warm ', 500, 45);
  if ids is distinct from array[1,2,7,8,10]::bigint[] then
    raise exception 'WARM grace, backoff or lease selection is wrong: %', ids;
  end if;
  if exists (select 1 from public.claim_roblox_universe_stats_rows('warm-two', 'WARM', 500, 45)) then
    raise exception 'Another worker reclaimed active leases';
  end if;

  -- Simulate successful samples taken after the cron slot started, then check
  -- every later batch of this run still excludes them after lease release.
  update public.roblox_universes
  set last_stats_refreshed_at = now() + interval '5 minutes',
    next_stats_refresh_at = now() + interval '12 hours 5 minutes',
    stats_refresh_locked_at = null, stats_refresh_locked_by = null,
    stats_refresh_attempt_count = 0, last_stats_refresh_error = null
  where universe_id = any(ids);
  if exists (select 1 from public.claim_roblox_universe_stats_rows('warm-one', 'WARM', 500, 45)) then
    raise exception 'Successful WARM rows were claimed twice in the same cycle';
  end if;

  -- Advance the deadlines by twelve hours to model the next matching cron
  -- slot. All successful rows must be eligible again, rather than waiting 18h.
  update public.roblox_universes
  set next_stats_refresh_at = next_stats_refresh_at - interval '12 hours'
  where universe_id = any(ids);
  select array_agg(universe_id order by universe_id) into ids
  from public.claim_roblox_universe_stats_rows('warm-next-cycle', 'WARM', 500, 45);
  if ids is distinct from array[1,2,7,8,10]::bigint[] then
    raise exception 'WARM missed the next twelve-hour cycle: %', ids;
  end if;

  foreach tier in array array['HOT', 'COLD', 'NEW'] loop
    if exists (select 1 from public.claim_roblox_universe_stats_rows('other-tier', tier, 500, 45)) then
      raise exception 'Grace leaked into tier %', tier;
    end if;
  end loop;

  -- Explicit IDs retain their intentional due-time and tier override.
  select * into claimed from public.claim_roblox_universe_stats_rows('explicit', 'HOT', 500, 45, array[3]::bigint[]);
  if claimed.universe_id is distinct from 3::bigint then
    raise exception 'Explicit-ID override changed';
  end if;
end;
$$;

-- Preserve the bounded response cap and disjoint batches under grace.
truncate public.roblox_universes;
insert into public.roblox_universes (universe_id, root_place_id, stats_tier, next_stats_refresh_at)
select value, value, 'WARM', now() + interval '28 minutes' from generate_series(1, 501) value;
do $$
declare
  first_count integer;
  second_count integer;
begin
  select count(*) into first_count from public.claim_roblox_universe_stats_rows('one', 'WARM', 20000, 45);
  select count(*) into second_count from public.claim_roblox_universe_stats_rows('two', 'WARM', 20000, 45);
  if first_count <> 500 or second_count <> 1 then
    raise exception 'Grace broke bounded disjoint batches: %, %', first_count, second_count;
  end if;
end;
$$;
