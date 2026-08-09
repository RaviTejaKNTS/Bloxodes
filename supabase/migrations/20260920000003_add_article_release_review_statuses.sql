-- Separate locally completed article work from the human release decision.

alter table public.article_generation_queue
  add column if not exists published_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists production_url text;

alter table public.article_generation_queue
  drop constraint if exists article_generation_queue_status_check;

alter table public.article_generation_queue
  add constraint article_generation_queue_status_check
  check (status in ('pending', 'processing', 'completed', 'published', 'rejected', 'skipped', 'failed'));

alter table public.article_generation_queue
  drop constraint if exists article_generation_queue_production_url_check;

alter table public.article_generation_queue
  add constraint article_generation_queue_production_url_check
  check (
    production_url is null
    or production_url ~ '^https://(www\.)?bloxodes\.com/articles/[a-z0-9]+(?:-[a-z0-9]+)*$'
  );

drop index if exists public.idx_article_generation_queue_topic_key;

create unique index idx_article_generation_queue_topic_key
  on public.article_generation_queue (topic_key)
  where topic_key is not null
    and status in ('pending', 'processing', 'completed', 'published', 'rejected');

create index if not exists idx_article_generation_queue_release_review
  on public.article_generation_queue (completed_at desc, created_at)
  where workflow_mode = 'agent_runner'
    and status = 'completed';
