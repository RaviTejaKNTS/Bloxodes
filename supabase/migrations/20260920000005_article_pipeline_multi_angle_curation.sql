-- Let one source lead produce several distinct article angles while preserving
-- source-level discovery history and prompt-version re-curation state.

drop index if exists public.idx_article_generation_queue_source_url;

alter table public.article_generation_queue
  drop constraint if exists article_generation_queue_status_check;

alter table public.article_generation_queue
  add constraint article_generation_queue_status_check
  check (status in ('pending', 'processing', 'blocked', 'completed', 'published', 'rejected', 'skipped', 'failed'));

drop index if exists public.idx_article_generation_queue_topic_key;

create unique index idx_article_generation_queue_topic_key
  on public.article_generation_queue (topic_key)
  where topic_key is not null
    and status in ('pending', 'processing', 'blocked', 'completed', 'published', 'rejected');

alter table public.article_discovery_candidates
  add column if not exists source_evidence jsonb not null default '{}'::jsonb,
  add column if not exists source_content_hash text,
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists curation_prompt_version text,
  add column if not exists queue_ids uuid[] not null default '{}'::uuid[],
  add column if not exists recuration_count integer not null default 0;

alter table public.article_discovery_candidates
  drop constraint if exists article_discovery_candidates_recuration_count_check;

alter table public.article_discovery_candidates
  add constraint article_discovery_candidates_recuration_count_check
  check (recuration_count >= 0);

create index if not exists idx_article_discovery_candidates_prompt_version
  on public.article_discovery_candidates (curation_prompt_version, curation_status, source_published_at desc);

alter table public.article_curation_runs
  add column if not exists degraded boolean not null default false,
  add column if not exists degraded_reason text;

grant all on table public.article_curation_runs to service_role;
grant all on table public.article_discovery_candidates to service_role;
