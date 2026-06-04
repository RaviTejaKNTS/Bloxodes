create table if not exists public.roblox_universe_rank_snapshots_hourly (
  universe_id bigint not null references public.roblox_universes(universe_id) on delete cascade,
  rank_type text not null,
  hour_start timestamptz not null,
  rank_value integer not null,
  metric_value numeric,
  sampled_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (universe_id, rank_type, hour_start)
);

create table if not exists public.roblox_universe_rank_snapshots_daily (
  universe_id bigint not null references public.roblox_universes(universe_id) on delete cascade,
  rank_type text not null,
  stat_date date not null,
  rank_value integer not null,
  metric_value numeric,
  sampled_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (universe_id, rank_type, stat_date)
);

do $$
begin
  if to_regclass('public.roblox_universe_rank_snapshots') is not null then
    insert into public.roblox_universe_rank_snapshots_hourly (
      universe_id,
      rank_type,
      hour_start,
      rank_value,
      metric_value,
      sampled_at,
      created_at
    )
    select distinct on (universe_id, rank_type, date_trunc('hour', sampled_at))
      universe_id,
      rank_type,
      date_trunc('hour', sampled_at) as hour_start,
      rank_value,
      metric_value,
      sampled_at,
      created_at
    from public.roblox_universe_rank_snapshots
    where sampled_at >= now() - interval '90 days'
    order by universe_id, rank_type, date_trunc('hour', sampled_at), sampled_at desc
    on conflict (universe_id, rank_type, hour_start) do update
      set rank_value = excluded.rank_value,
          metric_value = excluded.metric_value,
          sampled_at = excluded.sampled_at;

    insert into public.roblox_universe_rank_snapshots_daily (
      universe_id,
      rank_type,
      stat_date,
      rank_value,
      metric_value,
      sampled_at,
      created_at
    )
    select distinct on (universe_id, rank_type, sampled_at::date)
      universe_id,
      rank_type,
      sampled_at::date as stat_date,
      rank_value,
      metric_value,
      sampled_at,
      created_at
    from public.roblox_universe_rank_snapshots
    order by universe_id, rank_type, sampled_at::date, sampled_at desc
    on conflict (universe_id, rank_type, stat_date) do update
      set rank_value = excluded.rank_value,
          metric_value = excluded.metric_value,
          sampled_at = excluded.sampled_at;
  end if;
end $$;

alter table public.roblox_universe_rank_snapshots_hourly enable row level security;
alter table public.roblox_universe_rank_snapshots_daily enable row level security;

grant select on table public.roblox_universe_rank_snapshots_hourly to anon;
grant select on table public.roblox_universe_rank_snapshots_hourly to authenticated;
grant all on table public.roblox_universe_rank_snapshots_hourly to service_role;

grant select on table public.roblox_universe_rank_snapshots_daily to anon;
grant select on table public.roblox_universe_rank_snapshots_daily to authenticated;
grant all on table public.roblox_universe_rank_snapshots_daily to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'roblox_universe_rank_snapshots_hourly'
      and policyname = 'roblox_universe_rank_snapshots_hourly_select'
  ) then
    create policy roblox_universe_rank_snapshots_hourly_select
      on public.roblox_universe_rank_snapshots_hourly
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'roblox_universe_rank_snapshots_daily'
      and policyname = 'roblox_universe_rank_snapshots_daily_select'
  ) then
    create policy roblox_universe_rank_snapshots_daily_select
      on public.roblox_universe_rank_snapshots_daily
      for select
      using (true);
  end if;
end $$;

create or replace function public.prune_roblox_universe_hourly_history(
  p_cutoff timestamptz,
  p_batch_size integer default 5000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  stats_deleted integer := 0;
  rank_deleted integer := 0;
begin
  with doomed as (
    select ctid
    from public.roblox_universe_stats_hourly
    where hour_start < p_cutoff
    limit greatest(p_batch_size, 1)
  ),
  deleted as (
    delete from public.roblox_universe_stats_hourly h
    using doomed
    where h.ctid = doomed.ctid
    returning 1
  )
  select count(*) into stats_deleted from deleted;

  with doomed as (
    select ctid
    from public.roblox_universe_rank_snapshots_hourly
    where hour_start < p_cutoff
    limit greatest(p_batch_size, 1)
  ),
  deleted as (
    delete from public.roblox_universe_rank_snapshots_hourly h
    using doomed
    where h.ctid = doomed.ctid
    returning 1
  )
  select count(*) into rank_deleted from deleted;

  return jsonb_build_object(
    'stats_deleted', stats_deleted,
    'rank_deleted', rank_deleted,
    'cutoff', p_cutoff
  );
end;
$$;

revoke all on function public.prune_roblox_universe_hourly_history(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.prune_roblox_universe_hourly_history(timestamptz, integer) to service_role;
