create table if not exists public.site_feedback (
  id uuid primary key default extensions.uuid_generate_v4(),
  body text not null,
  email text,
  page_url text,
  page_path text,
  viewport_width integer,
  viewport_height integer,
  user_agent text,
  ip_address text,
  status text not null default 'new',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint site_feedback_body_not_blank check (length(btrim(body)) > 0),
  constraint site_feedback_status_check check (status in ('new', 'reviewed', 'closed', 'spam'))
);

create index if not exists idx_site_feedback_created_at
  on public.site_feedback (created_at desc);

create index if not exists idx_site_feedback_status_created_at
  on public.site_feedback (status, created_at desc);

alter table public.site_feedback enable row level security;

grant all on table public.site_feedback to service_role;
