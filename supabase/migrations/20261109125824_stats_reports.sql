begin;
create table public.stats_reports (
 id uuid primary key default gen_random_uuid(),
 slug text unique not null check (slug ~ '^roblox-[a-z]+-[0-9]{4}$'),
 month date unique not null check (extract(day from month) = 1),
 title text not null, meta_description text not null, dek text not null,
 content jsonb not null, data jsonb not null, feature_image_url text not null,
 visibility text not null default 'hidden' check (visibility in ('hidden','public')),
 contract text not null check (contract = 'stats-report@1'), data_sha256 text not null,
 published_at timestamptz, updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
alter table public.stats_reports enable row level security;
revoke all on public.stats_reports from anon, authenticated;
grant select on public.stats_reports to anon, authenticated;
grant all on public.stats_reports to service_role;
create policy public_stats_reports on public.stats_reports for select to anon, authenticated using (visibility = 'public');
commit;
