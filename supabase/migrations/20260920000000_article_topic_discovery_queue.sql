-- Separate source-discovered article leads from the legacy generator queue.

alter table public.article_generation_queue
  add column if not exists workflow_mode text not null default 'legacy_generator',
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists source_published_at timestamptz,
  add column if not exists source_discovered_at timestamptz not null default now(),
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists result_slug text,
  add column if not exists result_path text,
  add column if not exists outcome_reason text,
  add column if not exists source_urls jsonb not null default '[]'::jsonb,
  add column if not exists source_items jsonb not null default '[]'::jsonb,
  add column if not exists topic_key text,
  add column if not exists curation_model text,
  add column if not exists curation_prompt_version text,
  add column if not exists curation_reason text,
  add column if not exists curation_confidence numeric,
  add column if not exists curation_run_id uuid,
  add column if not exists curated_at timestamptz;

alter table public.article_generation_queue
  drop constraint if exists article_generation_queue_workflow_mode_check;

alter table public.article_generation_queue
  add constraint article_generation_queue_workflow_mode_check
  check (workflow_mode in ('legacy_generator', 'agent_runner'));

alter table public.article_generation_queue
  drop constraint if exists article_generation_queue_status_check;

alter table public.article_generation_queue
  add constraint article_generation_queue_status_check
  check (status in ('pending', 'processing', 'completed', 'skipped', 'failed'));

alter table public.article_generation_queue
  drop constraint if exists article_generation_queue_article_type_check;

alter table public.article_generation_queue
  add constraint article_generation_queue_article_type_check
  check (article_type in ('listicle', 'how_to', 'explainer', 'opinion', 'news', 'guide', 'tier_list'));

create unique index if not exists idx_article_generation_queue_source_url
  on public.article_generation_queue (source_url)
  where source_url is not null;

create index if not exists idx_article_generation_queue_agent_work
  on public.article_generation_queue (workflow_mode, status, created_at)
  where workflow_mode = 'agent_runner';

create unique index if not exists idx_article_generation_queue_topic_key
  on public.article_generation_queue (topic_key)
  where topic_key is not null
    and status in ('pending', 'processing', 'completed');

create table if not exists public.article_curation_runs (
  id uuid primary key default uuid_generate_v4(),
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  model text not null,
  prompt_version text not null,
  candidate_count integer not null default 0,
  approved_group_count integer not null default 0,
  approved_candidate_count integer not null default 0,
  rejected_candidate_count integer not null default 0,
  raw_response jsonb,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.article_generation_queue
  drop constraint if exists article_generation_queue_curation_run_id_fkey;

alter table public.article_generation_queue
  add constraint article_generation_queue_curation_run_id_fkey
  foreign key (curation_run_id) references public.article_curation_runs(id) on delete set null;

alter table public.article_generation_queue
  drop constraint if exists article_generation_queue_curation_confidence_check;

alter table public.article_generation_queue
  add constraint article_generation_queue_curation_confidence_check
  check (curation_confidence is null or (curation_confidence >= 0 and curation_confidence <= 1));

create table if not exists public.article_discovery_candidates (
  id uuid primary key default uuid_generate_v4(),
  source_name text not null,
  source_url text not null unique,
  source_title text not null,
  source_published_at timestamptz not null,
  source_discovered_at timestamptz not null default now(),
  source_description text,
  source_categories text[] not null default '{}'::text[],
  discovered_from text not null,
  curation_status text not null default 'pending'
    check (curation_status in ('pending', 'processing', 'approved', 'rejected')),
  curation_reason_code text,
  curation_reason text,
  curation_model text,
  curation_confidence numeric,
  curation_run_id uuid references public.article_curation_runs(id) on delete set null,
  queue_id uuid references public.article_generation_queue(id) on delete set null,
  topic_key text,
  curated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.article_discovery_candidates
  drop constraint if exists article_discovery_candidates_curation_confidence_check;

alter table public.article_discovery_candidates
  add constraint article_discovery_candidates_curation_confidence_check
  check (curation_confidence is null or (curation_confidence >= 0 and curation_confidence <= 1));

create index if not exists idx_article_discovery_candidates_pending
  on public.article_discovery_candidates (curation_status, source_published_at desc, created_at)
  where curation_status in ('pending', 'processing');

create index if not exists idx_article_discovery_candidates_queue
  on public.article_discovery_candidates (queue_id)
  where queue_id is not null;

drop trigger if exists trg_article_discovery_candidates_updated_at on public.article_discovery_candidates;
create trigger trg_article_discovery_candidates_updated_at
before update on public.article_discovery_candidates
for each row execute function public.set_updated_at();

alter table public.article_curation_runs enable row level security;
alter table public.article_discovery_candidates enable row level security;

revoke all on table public.article_curation_runs from anon, authenticated;
revoke all on table public.article_discovery_candidates from anon, authenticated;
grant all on table public.article_curation_runs to service_role;
grant all on table public.article_discovery_candidates to service_role;

-- Keep the existing automated generator isolated from agent-runner discoveries.
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
  where q.workflow_mode = 'legacy_generator'
    and q.status = 'pending'
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
  where workflow_mode = 'legacy_generator'
    and status = 'processing'
    and locked_at is not null
    and locked_at < now() - interval '30 minutes'
    and attempts >= effective_max_attempts;

  update public.article_generation_queue
  set
    status = 'pending',
    next_attempt_at = now(),
    locked_at = null,
    locked_by = null
  where workflow_mode = 'legacy_generator'
    and status = 'processing'
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
    where candidate.workflow_mode = 'legacy_generator'
      and candidate.status = 'pending'
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
