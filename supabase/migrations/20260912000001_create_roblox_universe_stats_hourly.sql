create table if not exists public.roblox_universe_stats_hourly (
  universe_id bigint not null references public.roblox_universes(universe_id) on delete cascade,
  hour_start timestamptz not null,
  playing bigint,
  avg_playing numeric,
  peak_playing bigint,
  min_playing bigint,
  visits bigint,
  visits_start bigint,
  visits_end bigint,
  visit_delta bigint,
  favorites bigint,
  favorites_start bigint,
  favorites_end bigint,
  favorite_delta bigint,
  likes bigint,
  likes_start bigint,
  likes_end bigint,
  like_delta bigint,
  dislikes bigint,
  dislikes_start bigint,
  dislikes_end bigint,
  dislike_delta bigint,
  rating_percent numeric,
  sample_count integer not null default 1 check (sample_count > 0),
  first_sampled_at timestamptz not null,
  last_sampled_at timestamptz not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (universe_id, hour_start)
);

create index if not exists idx_roblox_universe_stats_hourly_hour
  on public.roblox_universe_stats_hourly (hour_start desc);

create index if not exists idx_roblox_universe_stats_hourly_universe_hour
  on public.roblox_universe_stats_hourly (universe_id, hour_start desc);

create index if not exists idx_roblox_universe_stats_hourly_playing
  on public.roblox_universe_stats_hourly (playing desc, hour_start desc);

create index if not exists idx_roblox_universe_stats_hourly_peak_playing
  on public.roblox_universe_stats_hourly (peak_playing desc, hour_start desc);

drop trigger if exists trg_roblox_universe_stats_hourly_updated_at on public.roblox_universe_stats_hourly;
create trigger trg_roblox_universe_stats_hourly_updated_at before update on public.roblox_universe_stats_hourly
for each row execute function public.set_updated_at();

alter table public.roblox_universe_stats_hourly enable row level security;

grant select on table public.roblox_universe_stats_hourly to anon;
grant select on table public.roblox_universe_stats_hourly to authenticated;
grant all on table public.roblox_universe_stats_hourly to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'roblox_universe_stats_hourly'
      and policyname = 'roblox_universe_stats_hourly_select'
  ) then
    create policy roblox_universe_stats_hourly_select
      on public.roblox_universe_stats_hourly
      for select
      using (true);
  end if;
end $$;

alter table public.roblox_universe_stats_daily
  add column if not exists avg_playing numeric,
  add column if not exists peak_playing bigint,
  add column if not exists min_playing bigint,
  add column if not exists visits_start bigint,
  add column if not exists visits_end bigint,
  add column if not exists visit_delta bigint,
  add column if not exists favorites_start bigint,
  add column if not exists favorites_end bigint,
  add column if not exists favorite_delta bigint,
  add column if not exists likes_start bigint,
  add column if not exists likes_end bigint,
  add column if not exists like_delta bigint,
  add column if not exists dislikes_start bigint,
  add column if not exists dislikes_end bigint,
  add column if not exists dislike_delta bigint,
  add column if not exists rating_start numeric,
  add column if not exists rating_end numeric,
  add column if not exists sample_count integer,
  add column if not exists is_finalized boolean not null default false,
  add column if not exists finalized_at timestamptz;

create or replace function public.calculate_roblox_rating_percent(
  p_likes bigint,
  p_dislikes bigint
)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(p_likes, 0) + coalesce(p_dislikes, 0) <= 0 then null
    else round((coalesce(p_likes, 0)::numeric / (coalesce(p_likes, 0) + coalesce(p_dislikes, 0))::numeric) * 100, 2)
  end;
$$;

create or replace function public.upsert_roblox_universe_stats_hourly(
  p_universe_id bigint,
  p_sampled_at timestamptz,
  p_playing bigint default null,
  p_visits bigint default null,
  p_favorites bigint default null,
  p_likes bigint default null,
  p_dislikes bigint default null,
  p_snapshot jsonb default '{}'::jsonb
)
returns void
language plpgsql
as $$
declare
  bucket timestamptz := date_trunc('hour', coalesce(p_sampled_at, now()));
  rating numeric := public.calculate_roblox_rating_percent(p_likes, p_dislikes);
begin
  insert into public.roblox_universe_stats_hourly (
    universe_id,
    hour_start,
    playing,
    avg_playing,
    peak_playing,
    min_playing,
    visits,
    visits_start,
    visits_end,
    visit_delta,
    favorites,
    favorites_start,
    favorites_end,
    favorite_delta,
    likes,
    likes_start,
    likes_end,
    like_delta,
    dislikes,
    dislikes_start,
    dislikes_end,
    dislike_delta,
    rating_percent,
    sample_count,
    first_sampled_at,
    last_sampled_at,
    snapshot
  )
  values (
    p_universe_id,
    bucket,
    p_playing,
    p_playing,
    p_playing,
    p_playing,
    p_visits,
    p_visits,
    p_visits,
    0,
    p_favorites,
    p_favorites,
    p_favorites,
    0,
    p_likes,
    p_likes,
    p_likes,
    0,
    p_dislikes,
    p_dislikes,
    p_dislikes,
    0,
    rating,
    1,
    coalesce(p_sampled_at, now()),
    coalesce(p_sampled_at, now()),
    coalesce(p_snapshot, '{}'::jsonb)
  )
  on conflict (universe_id, hour_start) do update
  set
    playing = coalesce(excluded.playing, roblox_universe_stats_hourly.playing),
    avg_playing = case
      when excluded.playing is null then roblox_universe_stats_hourly.avg_playing
      when roblox_universe_stats_hourly.avg_playing is null then excluded.playing
      else ((roblox_universe_stats_hourly.avg_playing * roblox_universe_stats_hourly.sample_count) + excluded.playing)
        / (roblox_universe_stats_hourly.sample_count + 1)
    end,
    peak_playing = greatest(
      coalesce(roblox_universe_stats_hourly.peak_playing, excluded.peak_playing),
      coalesce(excluded.peak_playing, roblox_universe_stats_hourly.peak_playing)
    ),
    min_playing = least(
      coalesce(roblox_universe_stats_hourly.min_playing, excluded.min_playing),
      coalesce(excluded.min_playing, roblox_universe_stats_hourly.min_playing)
    ),
    visits = coalesce(excluded.visits, roblox_universe_stats_hourly.visits),
    visits_start = coalesce(roblox_universe_stats_hourly.visits_start, excluded.visits_start),
    visits_end = coalesce(excluded.visits_end, roblox_universe_stats_hourly.visits_end),
    visit_delta = case
      when coalesce(excluded.visits_end, roblox_universe_stats_hourly.visits_end) is null
        or coalesce(roblox_universe_stats_hourly.visits_start, excluded.visits_start) is null then null
      else coalesce(excluded.visits_end, roblox_universe_stats_hourly.visits_end)
        - coalesce(roblox_universe_stats_hourly.visits_start, excluded.visits_start)
    end,
    favorites = coalesce(excluded.favorites, roblox_universe_stats_hourly.favorites),
    favorites_start = coalesce(roblox_universe_stats_hourly.favorites_start, excluded.favorites_start),
    favorites_end = coalesce(excluded.favorites_end, roblox_universe_stats_hourly.favorites_end),
    favorite_delta = case
      when coalesce(excluded.favorites_end, roblox_universe_stats_hourly.favorites_end) is null
        or coalesce(roblox_universe_stats_hourly.favorites_start, excluded.favorites_start) is null then null
      else coalesce(excluded.favorites_end, roblox_universe_stats_hourly.favorites_end)
        - coalesce(roblox_universe_stats_hourly.favorites_start, excluded.favorites_start)
    end,
    likes = coalesce(excluded.likes, roblox_universe_stats_hourly.likes),
    likes_start = coalesce(roblox_universe_stats_hourly.likes_start, excluded.likes_start),
    likes_end = coalesce(excluded.likes_end, roblox_universe_stats_hourly.likes_end),
    like_delta = case
      when coalesce(excluded.likes_end, roblox_universe_stats_hourly.likes_end) is null
        or coalesce(roblox_universe_stats_hourly.likes_start, excluded.likes_start) is null then null
      else coalesce(excluded.likes_end, roblox_universe_stats_hourly.likes_end)
        - coalesce(roblox_universe_stats_hourly.likes_start, excluded.likes_start)
    end,
    dislikes = coalesce(excluded.dislikes, roblox_universe_stats_hourly.dislikes),
    dislikes_start = coalesce(roblox_universe_stats_hourly.dislikes_start, excluded.dislikes_start),
    dislikes_end = coalesce(excluded.dislikes_end, roblox_universe_stats_hourly.dislikes_end),
    dislike_delta = case
      when coalesce(excluded.dislikes_end, roblox_universe_stats_hourly.dislikes_end) is null
        or coalesce(roblox_universe_stats_hourly.dislikes_start, excluded.dislikes_start) is null then null
      else coalesce(excluded.dislikes_end, roblox_universe_stats_hourly.dislikes_end)
        - coalesce(roblox_universe_stats_hourly.dislikes_start, excluded.dislikes_start)
    end,
    rating_percent = coalesce(excluded.rating_percent, roblox_universe_stats_hourly.rating_percent),
    sample_count = roblox_universe_stats_hourly.sample_count + 1,
    last_sampled_at = greatest(roblox_universe_stats_hourly.last_sampled_at, excluded.last_sampled_at),
    snapshot = coalesce(roblox_universe_stats_hourly.snapshot, '{}'::jsonb) || coalesce(excluded.snapshot, '{}'::jsonb);
end;
$$;

revoke all on function public.calculate_roblox_rating_percent(bigint, bigint) from public, anon, authenticated;
grant execute on function public.calculate_roblox_rating_percent(bigint, bigint) to service_role;

revoke all on function public.upsert_roblox_universe_stats_hourly(bigint, timestamptz, bigint, bigint, bigint, bigint, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.upsert_roblox_universe_stats_hourly(bigint, timestamptz, bigint, bigint, bigint, bigint, bigint, jsonb) to service_role;

create or replace function public.rollup_roblox_universe_stats_daily(
  p_stat_date date,
  p_finalize boolean default false,
  p_universe_ids bigint[] default null
)
returns integer
language plpgsql
as $$
declare
  affected_count integer := 0;
begin
  with hourly as (
    select *
    from public.roblox_universe_stats_hourly h
    where h.hour_start >= p_stat_date::timestamptz
      and h.hour_start < (p_stat_date + 1)::timestamptz
      and (p_universe_ids is null or h.universe_id = any(p_universe_ids))
  ),
  numbered as (
    select
      h.*,
      row_number() over (partition by h.universe_id order by h.hour_start asc) as rn_first,
      row_number() over (partition by h.universe_id order by h.hour_start desc) as rn_last
    from hourly h
  ),
  rolled as (
    select
      universe_id,
      max(peak_playing) as peak_playing,
      sum(avg_playing * greatest(sample_count, 1)) filter (where avg_playing is not null)
        / nullif(sum(greatest(sample_count, 1)) filter (where avg_playing is not null), 0) as avg_playing,
      min(min_playing) as min_playing,
      max(visits_start) filter (where rn_first = 1) as visits_start,
      max(visits_end) filter (where rn_last = 1) as visits_end,
      max(favorites_start) filter (where rn_first = 1) as favorites_start,
      max(favorites_end) filter (where rn_last = 1) as favorites_end,
      max(likes_start) filter (where rn_first = 1) as likes_start,
      max(likes_end) filter (where rn_last = 1) as likes_end,
      max(dislikes_start) filter (where rn_first = 1) as dislikes_start,
      max(dislikes_end) filter (where rn_last = 1) as dislikes_end,
      max(rating_percent) filter (where rn_first = 1) as rating_start,
      max(rating_percent) filter (where rn_last = 1) as rating_end,
      sum(sample_count) as sample_count,
      max(last_sampled_at) as recorded_at
    from numbered
    group by universe_id
  ),
  upserted as (
    insert into public.roblox_universe_stats_daily (
      universe_id,
      stat_date,
      playing,
      visits,
      favorites,
      likes,
      dislikes,
      avg_playing,
      peak_playing,
      min_playing,
      visits_start,
      visits_end,
      visit_delta,
      favorites_start,
      favorites_end,
      favorite_delta,
      likes_start,
      likes_end,
      like_delta,
      dislikes_start,
      dislikes_end,
      dislike_delta,
      rating_start,
      rating_end,
      sample_count,
      snapshot,
      recorded_at,
      is_finalized,
      finalized_at
    )
    select
      universe_id,
      p_stat_date,
      peak_playing,
      visits_end,
      favorites_end,
      likes_end,
      dislikes_end,
      avg_playing,
      peak_playing,
      min_playing,
      visits_start,
      visits_end,
      case when visits_end is null or visits_start is null then null else visits_end - visits_start end,
      favorites_start,
      favorites_end,
      case when favorites_end is null or favorites_start is null then null else favorites_end - favorites_start end,
      likes_start,
      likes_end,
      case when likes_end is null or likes_start is null then null else likes_end - likes_start end,
      dislikes_start,
      dislikes_end,
      case when dislikes_end is null or dislikes_start is null then null else dislikes_end - dislikes_start end,
      rating_start,
      rating_end,
      sample_count,
      jsonb_build_object(
        'source', 'roblox_universe_stats_hourly',
        'finalized', p_finalize,
        'rating_end', rating_end,
        'rolled_up_at', now()
      ),
      coalesce(recorded_at, now()),
      p_finalize,
      case when p_finalize then now() else null end
    from rolled
    on conflict (universe_id, stat_date) do update
    set
      playing = excluded.playing,
      visits = excluded.visits,
      favorites = excluded.favorites,
      likes = excluded.likes,
      dislikes = excluded.dislikes,
      avg_playing = excluded.avg_playing,
      peak_playing = excluded.peak_playing,
      min_playing = excluded.min_playing,
      visits_start = excluded.visits_start,
      visits_end = excluded.visits_end,
      visit_delta = excluded.visit_delta,
      favorites_start = excluded.favorites_start,
      favorites_end = excluded.favorites_end,
      favorite_delta = excluded.favorite_delta,
      likes_start = excluded.likes_start,
      likes_end = excluded.likes_end,
      like_delta = excluded.like_delta,
      dislikes_start = excluded.dislikes_start,
      dislikes_end = excluded.dislikes_end,
      dislike_delta = excluded.dislike_delta,
      rating_start = excluded.rating_start,
      rating_end = excluded.rating_end,
      sample_count = excluded.sample_count,
      snapshot = coalesce(roblox_universe_stats_daily.snapshot, '{}'::jsonb) || excluded.snapshot,
      recorded_at = excluded.recorded_at,
      is_finalized = excluded.is_finalized,
      finalized_at = excluded.finalized_at
    returning 1
  )
  select count(*) into affected_count from upserted;

  return affected_count;
end;
$$;

revoke all on function public.rollup_roblox_universe_stats_daily(date, boolean, bigint[]) from public, anon, authenticated;
grant execute on function public.rollup_roblox_universe_stats_daily(date, boolean, bigint[]) to service_role;

create table if not exists public.roblox_universe_rank_snapshots (
  universe_id bigint not null references public.roblox_universes(universe_id) on delete cascade,
  rank_type text not null,
  rank_value integer not null,
  metric_value numeric,
  sampled_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (universe_id, rank_type, sampled_at)
);

create index if not exists idx_roblox_universe_rank_snapshots_type_time
  on public.roblox_universe_rank_snapshots (rank_type, sampled_at desc, rank_value asc);

create index if not exists idx_roblox_universe_rank_snapshots_universe
  on public.roblox_universe_rank_snapshots (universe_id, sampled_at desc);

alter table public.roblox_universe_rank_snapshots enable row level security;

grant select on table public.roblox_universe_rank_snapshots to anon;
grant select on table public.roblox_universe_rank_snapshots to authenticated;
grant all on table public.roblox_universe_rank_snapshots to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'roblox_universe_rank_snapshots'
      and policyname = 'roblox_universe_rank_snapshots_select'
  ) then
    create policy roblox_universe_rank_snapshots_select
      on public.roblox_universe_rank_snapshots
      for select
      using (true);
  end if;
end $$;
