\set ON_ERROR_STOP on

-- Run only against a CI/development database, after migrations. All changes roll back.
begin;

delete from public.stats_job_runs
where job_name in ('stats_refresh_new', 'stats_refresh_warm', 'stats_refresh_cold');

-- Previous WARM success survives both a 30-minute lock delay and startup time.
insert into public.stats_job_runs (job_name, started_at, finished_at, status, rows_succeeded)
values
  ('stats_refresh_warm', now() - interval '6 hours 40 minutes', now() - interval '6 hours 30 minutes', 'success', 500),
  ('stats_refresh_warm', now() - interval '5 minutes', null, 'running', 0),
  ('stats_refresh_cold', now() - interval '6 hours 1 minute', now() - interval '6 hours', 'success', 100),
  ('stats_refresh_new', now() - interval '6 hours 1 minute', now() - interval '6 hours', 'success', 100);

do $$
declare
  runs jsonb := public.get_roblox_universe_pipeline_health_v4()->'recent_refresh_runs';
begin
  if (runs->'stats_refresh_warm'->>'started')::integer is distinct from 2
    or (runs->'stats_refresh_warm'->>'rows_succeeded')::integer is distinct from 500 then
    raise exception 'WARM lost the previous success during lock/startup grace: %', runs;
  end if;
  if runs ? 'stats_refresh_cold' or runs ? 'stats_refresh_new' then
    raise exception 'COLD/NEW six-hour windows were widened: %', runs;
  end if;
end;
$$;

-- A start without rows cannot hide the lack of success for more than seven hours.
update public.stats_job_runs
set started_at = now() - interval '7 hours 1 minute'
where job_name = 'stats_refresh_warm' and status = 'success';

do $$
declare
  warm jsonb := public.get_roblox_universe_pipeline_health_v4()->'recent_refresh_runs'->'stats_refresh_warm';
begin
  if (warm->>'started')::integer is distinct from 1 or (warm->>'rows_succeeded')::integer is distinct from 0 then
    raise exception 'Expired WARM success still masks a zero-row run: %', warm;
  end if;
end;
$$;

delete from public.stats_job_runs where job_name = 'stats_refresh_warm' and status = 'running';

do $$
begin
  if (public.get_roblox_universe_pipeline_health_v4()->'recent_refresh_runs') ? 'stats_refresh_warm' then
    raise exception 'A missed WARM run remains inside the health window after seven hours';
  end if;
end;
$$;

rollback;
