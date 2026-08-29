-- Allow the managed-development wiki queue to lease two independent games at
-- once. The slot index is the database backstop; the runner may use one or two
-- slots without changing the queue contract again.

alter table public.wiki_generation_queue
  add column if not exists processing_slot smallint;

with assigned as (
  select id, row_number() over (order by started_at nulls last, created_at, id) as slot
  from public.wiki_generation_queue
  where status = 'processing'
)
update public.wiki_generation_queue as queue
set processing_slot = assigned.slot
from assigned
where queue.id = assigned.id;

alter table public.wiki_generation_queue
  drop constraint if exists wiki_generation_queue_processing_slot_state;

alter table public.wiki_generation_queue
  add constraint wiki_generation_queue_processing_slot_state check (
    (status = 'processing' and processing_slot between 1 and 2)
    or
    (status <> 'processing' and processing_slot is null)
  );

drop index if exists public.wiki_generation_queue_one_processing_idx;

create unique index if not exists wiki_generation_queue_processing_slot_idx
  on public.wiki_generation_queue (processing_slot)
  where status = 'processing';

drop function if exists public.claim_wiki_generation_queue_item(text, integer);

create function public.claim_wiki_generation_queue_item(
  p_worker text,
  p_lease_minutes integer default 360,
  p_queue_id uuid default null
)
returns setof public.wiki_generation_queue
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_id uuid;
  claimed_slot smallint;
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
    processing_slot = null,
    heartbeat_at = now(),
    next_attempt_at = case when attempts >= max_attempts then null else now() end,
    completed_at = case when attempts >= max_attempts then now() else completed_at end,
    last_error = 'Recovered after an expired homelab wiki workflow lease.'
  where status = 'processing'
    and lease_expires_at < now();

  select slot::smallint into claimed_slot
  from pg_catalog.generate_series(1, 2) as available(slot)
  where not exists (
    select 1
    from public.wiki_generation_queue active
    where active.status = 'processing'
      and active.processing_slot = available.slot
  )
  order by slot
  limit 1;

  if claimed_slot is null then
    return;
  end if;

  select id into claimed_id
  from public.wiki_generation_queue
  where status in ('queued', 'retry')
    and (p_queue_id is null or id = p_queue_id)
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
    processing_slot = claimed_slot,
    heartbeat_at = now(),
    started_at = coalesce(started_at, now()),
    next_attempt_at = null,
    last_error = null
  where id = claimed_id
  returning *;
end;
$$;

revoke all on function public.claim_wiki_generation_queue_item(text, integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_wiki_generation_queue_item(text, integer, uuid) to service_role;

create or replace function public.wiki_generation_queue_concurrency_contract()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'max_processing', 2,
    'slot_index', exists (
      select 1
      from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = 'wiki_generation_queue_processing_slot_idx'
        and relation.relkind = 'i'
    ),
    'slot_constraint', exists (
      select 1
      from pg_catalog.pg_constraint constraint_row
      join pg_catalog.pg_class relation on relation.oid = constraint_row.conrelid
      join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = 'wiki_generation_queue'
        and constraint_row.conname = 'wiki_generation_queue_processing_slot_state'
        and constraint_row.convalidated
    )
  );
$$;

revoke all on function public.wiki_generation_queue_concurrency_contract() from public, anon, authenticated;
grant execute on function public.wiki_generation_queue_concurrency_contract() to service_role;

comment on table public.wiki_generation_queue is
  'Managed-development control plane for up to two concurrent homelab wiki hub and collection workflows.';
