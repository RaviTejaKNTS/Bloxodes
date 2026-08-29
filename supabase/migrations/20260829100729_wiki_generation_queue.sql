-- Durable, service-role-only queue for the homelab wiki + collection workflow.

create table if not exists public.wiki_generation_queue (
  id uuid primary key default gen_random_uuid(),
  -- The ranked production universe may not have been mirrored into managed dev yet.
  universe_id bigint not null,
  root_place_id bigint,
  game_name text not null,
  wiki_slug text not null,
  rank_at_claim integer not null check (rank_at_claim between 1 and 100),
  current_ccu bigint check (current_ccu is null or current_ccu >= 0),
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'managed_dev_ready', 'publishing', 'published', 'retry', 'blocked', 'failed')
  ),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  lease_token uuid,
  lease_owner text,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  next_attempt_at timestamptz,
  started_at timestamptz,
  managed_dev_completed_at timestamptz,
  published_at timestamptz,
  completed_at timestamptz,
  suggestions_path text,
  result_root text,
  wiki_final_path text,
  approved_collections jsonb not null default '[]'::jsonb check (jsonb_typeof(approved_collections) = 'array'),
  blocked_collections jsonb not null default '[]'::jsonb check (jsonb_typeof(blocked_collections) = 'array'),
  collection_manifests jsonb not null default '[]'::jsonb check (jsonb_typeof(collection_manifests) = 'array'),
  managed_dev_receipt jsonb not null default '{}'::jsonb check (jsonb_typeof(managed_dev_receipt) = 'object'),
  production_receipt jsonb not null default '{}'::jsonb check (jsonb_typeof(production_receipt) = 'object'),
  last_error text,
  outcome_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wiki_generation_queue_universe_unique unique (universe_id),
  constraint wiki_generation_queue_slug_format check (wiki_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint wiki_generation_queue_lease_state check (
    (status = 'processing' and lease_token is not null and lease_owner is not null and lease_expires_at is not null)
    or
    (status <> 'processing' and lease_token is null and lease_owner is null and lease_expires_at is null)
  )
);

drop trigger if exists trg_wiki_generation_queue_updated_at on public.wiki_generation_queue;
create trigger trg_wiki_generation_queue_updated_at
before update on public.wiki_generation_queue
for each row execute function public.set_updated_at();

create unique index if not exists wiki_generation_queue_one_processing_idx
  on public.wiki_generation_queue ((status))
  where status = 'processing';

create index if not exists wiki_generation_queue_ready_idx
  on public.wiki_generation_queue (rank_at_claim asc, created_at asc)
  where status in ('queued', 'retry');

create unique index if not exists wiki_generation_queue_slug_unique_idx
  on public.wiki_generation_queue (lower(wiki_slug));

create index if not exists wiki_generation_queue_lease_idx
  on public.wiki_generation_queue (lease_expires_at)
  where status = 'processing';

alter table public.wiki_generation_queue enable row level security;
revoke all on table public.wiki_generation_queue from public, anon, authenticated;
grant all on table public.wiki_generation_queue to service_role;

create or replace function public.claim_wiki_generation_queue_item(
  p_worker text,
  p_lease_minutes integer default 360
)
returns setof public.wiki_generation_queue
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_id uuid;
  claimed_token uuid := gen_random_uuid();
  safe_lease_minutes integer := greatest(30, least(coalesce(p_lease_minutes, 360), 720));
begin
  if nullif(btrim(p_worker), '') is null then
    raise exception 'worker is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('bloxodes:wiki-generation', 0)
  );

  update public.wiki_generation_queue
  set
    status = case when attempts >= max_attempts then 'failed' else 'retry' end,
    lease_token = null,
    lease_owner = null,
    lease_expires_at = null,
    heartbeat_at = now(),
    next_attempt_at = case when attempts >= max_attempts then null else now() end,
    completed_at = case when attempts >= max_attempts then now() else completed_at end,
    last_error = 'Recovered after an expired homelab wiki workflow lease.'
  where status = 'processing'
    and lease_expires_at < now();

  if exists (select 1 from public.wiki_generation_queue where status = 'processing') then
    return;
  end if;

  select id into claimed_id
  from public.wiki_generation_queue
  where status in ('queued', 'retry')
    and attempts < max_attempts
    and (next_attempt_at is null or next_attempt_at <= now())
  order by rank_at_claim asc, created_at asc
  for update skip locked
  limit 1;

  if claimed_id is null then
    return;
  end if;

  return query
  update public.wiki_generation_queue
  set
    status = 'processing',
    attempts = attempts + 1,
    lease_token = claimed_token,
    lease_owner = btrim(p_worker),
    lease_expires_at = now() + make_interval(mins => safe_lease_minutes),
    heartbeat_at = now(),
    started_at = coalesce(started_at, now()),
    next_attempt_at = null,
    last_error = null
  where id = claimed_id
  returning *;
end;
$$;

create or replace function public.heartbeat_wiki_generation_queue_item(
  p_id uuid,
  p_lease_token uuid,
  p_lease_minutes integer default 360
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with refreshed as (
    update public.wiki_generation_queue
    set
      heartbeat_at = now(),
      lease_expires_at = now() + make_interval(mins => greatest(30, least(coalesce(p_lease_minutes, 360), 720)))
    where id = p_id
      and status = 'processing'
      and lease_token = p_lease_token
    returning 1
  )
  select exists(select 1 from refreshed);
$$;

revoke all on function public.claim_wiki_generation_queue_item(text, integer) from public, anon, authenticated;
revoke all on function public.heartbeat_wiki_generation_queue_item(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_wiki_generation_queue_item(text, integer) to service_role;
grant execute on function public.heartbeat_wiki_generation_queue_item(uuid, uuid, integer) to service_role;

comment on table public.wiki_generation_queue is
  'Managed-development control plane for one-at-a-time homelab wiki hub and collection generation.';
