create table if not exists public.cache_warm_events (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  source text not null default 'revalidate',
  priority integer not null default 100,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cache_warm_events_path_key unique (path),
  constraint cache_warm_events_path_check check (path ~ '^/[^?#]*$'),
  constraint cache_warm_events_attempts_check check (attempts >= 0)
);

create index if not exists idx_cache_warm_events_priority_created
  on public.cache_warm_events (priority asc, created_at asc);

create index if not exists idx_cache_warm_events_updated
  on public.cache_warm_events (updated_at desc);

alter table public.cache_warm_events enable row level security;

grant all on table public.cache_warm_events to service_role;

create table if not exists public.cache_warm_worker_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running',
  batch_size integer not null,
  fetched_count integer not null default 0,
  warmed_count integer not null default 0,
  failed_count integer not null default 0,
  dropped_count integer not null default 0,
  duration_ms integer,
  paths jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint cache_warm_worker_runs_status_check
    check (status in ('running', 'success', 'failed', 'skipped'))
);

create index if not exists idx_cache_warm_worker_runs_created
  on public.cache_warm_worker_runs (created_at desc);

create index if not exists idx_cache_warm_worker_runs_status_created
  on public.cache_warm_worker_runs (status, created_at desc);

alter table public.cache_warm_worker_runs enable row level security;

grant all on table public.cache_warm_worker_runs to service_role;

create or replace function public.invoke_cache_warm_worker()
returns bigint
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  cache_warm_jwt text;
  request_id bigint;
begin
  select decrypted_secret
  into cache_warm_jwt
  from vault.decrypted_secrets
  where name = 'revalidate_cron_jwt'
  limit 1;

  if nullif(trim(coalesce(cache_warm_jwt, '')), '') is null then
    raise exception 'Missing Vault secret revalidate_cron_jwt for cache warm cron';
  end if;

  select net.http_post(
    url := 'https://bloxodesdb.ravitejaknts.com/functions/v1/cache-warm',
    body := '{}'::jsonb,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || cache_warm_jwt,
      'apikey', cache_warm_jwt,
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 60000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function public.invoke_cache_warm_worker() from public;
grant execute on function public.invoke_cache_warm_worker() to postgres;
