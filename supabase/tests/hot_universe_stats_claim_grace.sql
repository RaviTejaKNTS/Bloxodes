-- GitHub-only fixture, inside the transaction opened by hot-claim-sql.test.ts.
-- The harness creates an empty minimal table and rolls everything back.
insert into public.roblox_universes (
  universe_id, root_place_id, stats_tier, next_stats_refresh_at,
  last_stats_refreshed_at, stats_refresh_attempt_count, last_stats_refresh_error,
  stats_refresh_locked_at, stats_refresh_locked_by, stats_tier_reason
)
values
  -- Reproduce a :12 claim missing samples taken during the previous run.
  (1, 1, 'HOT', now() + interval '30 seconds', now() - interval '59 minutes 30 seconds', 0, null, null, null, null),
  (2, 2, 'HOT', now() + interval '6 minutes', now() - interval '54 minutes', 0, null, null, null, null),
  (3, 3, 'HOT', now() + interval '15 minutes', now() - interval '45 minutes', 0, null, null, null, null),
  (4, 4, 'HOT', now() + interval '15 minutes 1 second', now() - interval '45 minutes', 0, null, null, null, null),
  (5, 5, 'HOT', now() + interval '6 minutes', now() - interval '1 hour', 1, 'retry', null, null, null),
  (6, 6, 'HOT', now() + interval '6 minutes', now() - interval '1 hour', 0, 'retry', null, null, null),
  (7, 7, 'HOT', now() + interval '6 minutes', now() - interval '1 hour', 0, null, null, null, 'game_details_unavailable'),
  (8, 8, 'HOT', now() - interval '1 minute', now() - interval '1 hour', 1, 'retry', null, null, null),
  (9, 9, 'HOT', null, null, 0, null, null, null, null),
  (10, 10, 'HOT', now() + interval '6 minutes', now() - interval '1 hour', 0, null, now(), 'active', null),
  (11, 11, 'HOT', now() + interval '6 minutes', now() - interval '1 hour', 0, null, now() - interval '46 minutes', 'gone', null),
  (12, 0, 'HOT', now(), null, 0, null, null, null, null),
  -- WARM keeps its one-hour grace; the other tiers get none.
  (13, 13, 'WARM', now() + interval '28 minutes', now(), 0, null, null, null, null),
  (14, 14, 'WARM', now() + interval '1 hour 1 second', now(), 0, null, null, null, null),
  (15, 15, 'COLD', now() + interval '6 minutes', now(), 0, null, null, null, null),
  (16, 16, 'NEW', now() + interval '6 minutes', null, 0, null, null, null, null);

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

  -- ALL still claims only due work, with no grace.
  select array_agg(universe_id order by universe_id) into ids
  from public.claim_roblox_universe_stats_rows('all-worker', 'ALL', 500, 45);
  if ids is distinct from array[8,9]::bigint[] then
    raise exception 'ALL selection changed: %', ids;
  end if;
  update public.roblox_universes set stats_refresh_locked_at = null, stats_refresh_locked_by = null,
    stats_refresh_attempt_count = case when universe_id = 8 then 1 else 0 end,
    last_stats_refresh_error = case when universe_id = 8 then 'retry' else null end
  where universe_id in (8,9);

  select array_agg(universe_id order by universe_id) into ids
  from public.claim_roblox_universe_stats_rows('hot-one', ' hot ', 500, 45);
  if ids is distinct from array[1,2,3,8,9,11]::bigint[] then
    raise exception 'HOT grace, backoff or lease selection is wrong: %', ids;
  end if;
  if exists (select 1 from public.claim_roblox_universe_stats_rows('hot-two', 'HOT', 500, 45)) then
    raise exception 'Another worker reclaimed active leases';
  end if;

  -- Simulate successful samples taken during this run, then check every later
  -- batch of the run still excludes them after lease release.
  update public.roblox_universes
  set last_stats_refreshed_at = now() + interval '5 minutes',
    next_stats_refresh_at = now() + interval '1 hour 5 minutes',
    stats_refresh_locked_at = null, stats_refresh_locked_by = null,
    stats_refresh_attempt_count = 0, last_stats_refresh_error = null
  where universe_id = any(ids);
  if exists (select 1 from public.claim_roblox_universe_stats_rows('hot-one', 'HOT', 500, 45)) then
    raise exception 'Successful HOT rows were claimed twice in the same run';
  end if;

  -- Advance the deadlines by an hour to model the next :12 run. Samples taken
  -- up to 5 minutes into this run must be eligible, rather than waiting 2 hours.
  update public.roblox_universes
  set next_stats_refresh_at = next_stats_refresh_at - interval '1 hour'
  where universe_id = any(ids);
  select array_agg(universe_id order by universe_id) into ids
  from public.claim_roblox_universe_stats_rows('hot-next-run', 'HOT', 500, 45);
  if ids is distinct from array[1,2,3,8,9,11]::bigint[] then
    raise exception 'HOT missed the next hourly run: %', ids;
  end if;

  select array_agg(universe_id order by universe_id) into ids
  from public.claim_roblox_universe_stats_rows('warm', 'WARM', 500, 45);
  if ids is distinct from array[13]::bigint[] then
    raise exception 'WARM grace changed: %', ids;
  end if;

  foreach tier in array array['COLD', 'NEW'] loop
    if exists (select 1 from public.claim_roblox_universe_stats_rows('other-tier', tier, 500, 45)) then
      raise exception 'Grace leaked into tier %', tier;
    end if;
  end loop;

  -- Explicit IDs retain their intentional due-time and tier override.
  select * into claimed from public.claim_roblox_universe_stats_rows('explicit', 'COLD', 500, 45, array[4]::bigint[]);
  if claimed.universe_id is distinct from 4::bigint then
    raise exception 'Explicit-ID override changed';
  end if;
end;
$$;

-- Preserve the bounded response cap and disjoint batches under grace.
truncate public.roblox_universes;
insert into public.roblox_universes (universe_id, root_place_id, stats_tier, next_stats_refresh_at)
select value, value, 'HOT', now() + interval '6 minutes' from generate_series(1, 501) value;
do $$
declare
  first_count integer;
  second_count integer;
begin
  select count(*) into first_count from public.claim_roblox_universe_stats_rows('one', 'HOT', 20000, 45);
  select count(*) into second_count from public.claim_roblox_universe_stats_rows('two', 'HOT', 20000, 45);
  if first_count <> 500 or second_count <> 1 then
    raise exception 'Grace broke bounded disjoint batches: %, %', first_count, second_count;
  end if;
end;
$$;
