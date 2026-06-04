create table if not exists public.roblox_universe_update_events (
  id uuid primary key default uuid_generate_v4(),
  universe_id bigint not null references public.roblox_universes(universe_id) on delete cascade,
  previous_updated_at_api timestamptz,
  updated_at_api timestamptz not null,
  detected_at timestamptz not null default now(),
  sampled_at timestamptz not null,
  source text not null default 'update-universe-hourly-stats',
  label text,
  description text,
  stats_tier text,
  playing bigint,
  visits bigint,
  favorites bigint,
  likes bigint,
  dislikes bigint,
  rating_percent numeric,
  raw_game_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (universe_id, updated_at_api)
);

create index if not exists idx_roblox_universe_update_events_detected
  on public.roblox_universe_update_events (detected_at desc);

create index if not exists idx_roblox_universe_update_events_universe_updated
  on public.roblox_universe_update_events (universe_id, updated_at_api desc);

create index if not exists idx_roblox_universe_update_events_updated
  on public.roblox_universe_update_events (updated_at_api desc);

alter table public.roblox_universe_update_events enable row level security;

grant select on table public.roblox_universe_update_events to anon;
grant select on table public.roblox_universe_update_events to authenticated;
grant all on table public.roblox_universe_update_events to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'roblox_universe_update_events'
      and policyname = 'roblox_universe_update_events_select'
  ) then
    create policy roblox_universe_update_events_select
      on public.roblox_universe_update_events
      for select
      using (true);
  end if;
end $$;
