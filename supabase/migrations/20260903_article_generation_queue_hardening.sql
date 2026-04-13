-- Harden article generation queue claiming and persist generation artifacts.

alter table if exists public.article_generation_queue
  drop constraint if exists article_generation_queue_status_check;

alter table if exists public.article_generation_queue
  add constraint article_generation_queue_status_check
  check (status in ('pending', 'processing', 'completed', 'failed'));

alter table if exists public.article_generation_queue
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists article_id uuid references public.articles(id) on delete set null,
  add column if not exists idempotency_key text;

create or replace function public.article_generation_queue_idempotency_key(
  title text,
  universe_id bigint
) returns text
language sql
immutable
as $$
  select case
    when nullif(trim(both '-' from regexp_replace(lower(coalesce(title, '')), '[^a-z0-9]+', '-', 'g')), '') is null
      then null
    else coalesce(universe_id::text, 'global') || ':' ||
      trim(both '-' from regexp_replace(lower(coalesce(title, '')), '[^a-z0-9]+', '-', 'g'))
  end;
$$;

create or replace function public.set_article_generation_queue_idempotency_key()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.idempotency_key := public.article_generation_queue_idempotency_key(new.article_title, new.universe_id);
  return new;
end;
$$;

drop trigger if exists trg_article_generation_queue_idempotency_key on public.article_generation_queue;
create trigger trg_article_generation_queue_idempotency_key
before insert or update of article_title, universe_id
on public.article_generation_queue
for each row execute function public.set_article_generation_queue_idempotency_key();

update public.article_generation_queue
set idempotency_key = public.article_generation_queue_idempotency_key(article_title, universe_id)
where idempotency_key is distinct from public.article_generation_queue_idempotency_key(article_title, universe_id);

with ranked as (
  select
    id,
    row_number() over (
      partition by idempotency_key
      order by created_at asc, id asc
    ) as rn
  from public.article_generation_queue
  where status in ('pending', 'processing')
    and event_id is null
    and idempotency_key is not null
)
update public.article_generation_queue q
set
  status = 'failed',
  last_error = 'Duplicate active article generation queue item for topic/universe.',
  next_attempt_at = null,
  locked_at = null,
  locked_by = null
from ranked r
where q.id = r.id
  and r.rn > 1;

create index if not exists idx_article_generation_queue_pending_backoff
  on public.article_generation_queue (status, next_attempt_at, created_at);

create unique index if not exists idx_article_generation_queue_active_idempotency
  on public.article_generation_queue (idempotency_key)
  where status in ('pending', 'processing')
    and event_id is null
    and idempotency_key is not null;

create table if not exists public.article_generation_artifacts (
  id uuid primary key default uuid_generate_v4(),
  queue_id uuid references public.article_generation_queue(id) on delete set null,
  article_id uuid references public.articles(id) on delete set null,
  prompt_version text not null,
  model text not null,
  topic text,
  universe_id bigint references public.roblox_universes(universe_id) on delete set null,
  status text not null check (status in ('completed', 'failed')),
  error text,
  sources jsonb not null default '[]'::jsonb,
  extracted_facts jsonb not null default '[]'::jsonb,
  coverage_checklist jsonb,
  fact_check_feedback jsonb,
  link_candidates jsonb not null default '[]'::jsonb,
  token_usage jsonb not null default '[]'::jsonb,
  validation_results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_article_generation_artifacts_queue
  on public.article_generation_artifacts (queue_id, created_at desc);

create index if not exists idx_article_generation_artifacts_article
  on public.article_generation_artifacts (article_id, created_at desc);

drop trigger if exists trg_article_generation_artifacts_updated_at on public.article_generation_artifacts;
create trigger trg_article_generation_artifacts_updated_at
before update on public.article_generation_artifacts
for each row execute function public.set_updated_at();

alter table public.article_generation_artifacts enable row level security;

create or replace function public.claim_article_generation_queue_item(
  p_queue_id uuid default null,
  p_worker_id text default null,
  p_max_attempts integer default 3
) returns public.article_generation_queue
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.article_generation_queue;
  effective_max_attempts integer := greatest(coalesce(p_max_attempts, 3), 1);
begin
  update public.article_generation_queue q
  set
    status = 'failed',
    last_error = 'Duplicate completed article generation queue item for topic/universe.',
    next_attempt_at = null,
    locked_at = null,
    locked_by = null
  where q.status = 'pending'
    and (p_queue_id is null or q.id = p_queue_id)
    and q.event_id is null
    and q.idempotency_key is not null
    and exists (
      select 1
      from public.article_generation_queue completed
      where completed.idempotency_key = q.idempotency_key
        and completed.id <> q.id
        and completed.status = 'completed'
    );

  update public.article_generation_queue
  set
    status = 'failed',
    last_error = 'Queue item exceeded max attempts after a stale processing lock.',
    next_attempt_at = null,
    locked_at = null,
    locked_by = null
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - interval '30 minutes'
    and attempts >= effective_max_attempts;

  update public.article_generation_queue
  set
    status = 'pending',
    next_attempt_at = now(),
    locked_at = null,
    locked_by = null
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - interval '30 minutes'
    and attempts < effective_max_attempts;

  update public.article_generation_queue q
  set
    status = 'processing',
    attempts = coalesce(q.attempts, 0) + 1,
    last_attempted_at = now(),
    last_error = null,
    locked_at = now(),
    locked_by = coalesce(nullif(p_worker_id, ''), 'article-generator'),
    next_attempt_at = null
  where q.id = (
    select candidate.id
    from public.article_generation_queue candidate
    where candidate.status = 'pending'
      and (p_queue_id is null or candidate.id = p_queue_id)
      and coalesce(candidate.attempts, 0) < effective_max_attempts
      and (candidate.next_attempt_at is null or candidate.next_attempt_at <= now())
      and (candidate.event_id is null or candidate.event_id = '')
      and not exists (
        select 1
        from public.article_generation_queue active
        where active.idempotency_key = candidate.idempotency_key
          and active.id <> candidate.id
          and active.status = 'processing'
      )
    order by candidate.created_at asc, candidate.id asc
    for update skip locked
    limit 1
  )
  returning * into claimed;

  return claimed;
end;
$$;

revoke all on function public.claim_article_generation_queue_item(uuid, text, integer) from public;
grant execute on function public.claim_article_generation_queue_item(uuid, text, integer) to service_role;
