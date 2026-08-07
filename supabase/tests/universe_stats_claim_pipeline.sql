\set ON_ERROR_STOP on

begin;

insert into public.roblox_universes (
  universe_id,
  root_place_id,
  name,
  slug,
  stats_tier,
  next_stats_refresh_at,
  last_stats_refreshed_at
)
select
  920000000000 + value,
  930000000000 + value,
  'Universe claim test ' || value,
  'universe-claim-test-' || value,
  'COLD',
  now() - interval '1 hour',
  now() - interval '2 days'
from generate_series(1, 501) value;

create temporary table universe_claim_test_ids as
select (920000000000 + value)::bigint as universe_id
from generate_series(1, 501) value;

create temporary table universe_claim_one as
select *
from public.claim_roblox_universe_stats_rows(
  'universe-test-one',
  'COLD',
  20000,
  45,
  array(select universe_id from universe_claim_test_ids order by universe_id)
);

create temporary table universe_claim_two as
select *
from public.claim_roblox_universe_stats_rows(
  'universe-test-two',
  'COLD',
  20000,
  45,
  array(select universe_id from universe_claim_test_ids order by universe_id)
);

do $$
begin
  if (select count(*) from universe_claim_one) <> 500 then
    raise exception 'universe claim did not enforce the 500-row API-safe cap';
  end if;
  if (select count(*) from universe_claim_two) <> 1 then
    raise exception 'second universe worker did not receive the remaining row';
  end if;
  if exists (select universe_id from universe_claim_one intersect select universe_id from universe_claim_two) then
    raise exception 'atomic universe claims overlapped';
  end if;
  if (select count(*) from information_schema.columns where table_name = 'universe_claim_one') <> 15 then
    raise exception 'universe claim returned more than the narrow worker contract';
  end if;
end;
$$;

select public.release_roblox_universe_stats_rows(
  'universe-test-one',
  array_agg(universe_id),
  null,
  now() + interval '24 hours'
)
from universe_claim_one;

select public.release_roblox_universe_stats_rows(
  'universe-test-two',
  array_agg(universe_id),
  null,
  now() + interval '24 hours'
)
from universe_claim_two;

do $$
begin
  if not public.claim_stats_pipeline_lease('universe-test-lease', 'worker-one', 5) then
    raise exception 'first pipeline lease claim failed';
  end if;
  if public.claim_stats_pipeline_lease('universe-test-lease', 'worker-two', 5) then
    raise exception 'second pipeline worker acquired an active lease';
  end if;
  if public.release_stats_pipeline_lease('universe-test-lease', 'worker-two') then
    raise exception 'non-owner released a pipeline lease';
  end if;
  if not public.release_stats_pipeline_lease('universe-test-lease', 'worker-one') then
    raise exception 'pipeline lease owner could not release its lease';
  end if;
end;
$$;

rollback;
