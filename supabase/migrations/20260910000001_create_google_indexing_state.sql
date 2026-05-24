create table if not exists public.google_indexing_attempts (
  id bigserial primary key,
  url text not null,
  notification_type text not null check (notification_type in ('URL_UPDATED', 'URL_DELETED')),
  submitted_at timestamptz not null default now(),
  status_code integer,
  response_status text,
  error_message text,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_google_indexing_attempts_submitted_at
  on public.google_indexing_attempts (submitted_at desc);

create index if not exists idx_google_indexing_attempts_type_submitted_at
  on public.google_indexing_attempts (notification_type, submitted_at desc);

create index if not exists idx_google_indexing_attempts_url
  on public.google_indexing_attempts (url);

create table if not exists public.google_indexing_url_state (
  url text not null,
  notification_type text not null check (notification_type in ('URL_UPDATED', 'URL_DELETED')),
  last_submitted_at timestamptz,
  last_status_code integer,
  last_error text,
  attempt_count integer not null default 0,
  success_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (url, notification_type)
);

create index if not exists idx_google_indexing_url_state_last_submitted_at
  on public.google_indexing_url_state (notification_type, last_submitted_at asc nulls first);

create or replace function public.set_google_indexing_url_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_google_indexing_url_state_updated_at on public.google_indexing_url_state;
create trigger trg_google_indexing_url_state_updated_at
before update on public.google_indexing_url_state
for each row
execute function public.set_google_indexing_url_state_updated_at();

alter table public.google_indexing_attempts enable row level security;
alter table public.google_indexing_url_state enable row level security;
