create table if not exists public.roblox_platform_stats_hourly (
  hour_start timestamptz primary key,
  playing bigint not null default 0,
  peak_players bigint not null default 0,
  avg_players numeric,
  visits bigint,
  favorites bigint,
  likes bigint,
  dislikes bigint,
  rating_percent numeric,
  tracked_games integer not null default 0,
  samples bigint not null default 0,
  recorded_at timestamptz not null default now()
);

create table if not exists public.roblox_platform_stats_daily (
  stat_date date primary key,
  playing bigint not null default 0,
  peak_players bigint not null default 0,
  avg_players numeric,
  visits bigint,
  favorites bigint,
  likes bigint,
  dislikes bigint,
  rating_percent numeric,
  tracked_games integer not null default 0,
  samples bigint not null default 0,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_roblox_platform_stats_hourly_hour_desc
  on public.roblox_platform_stats_hourly (hour_start desc);

create index if not exists idx_roblox_platform_stats_daily_date_desc
  on public.roblox_platform_stats_daily (stat_date desc);

alter table public.roblox_platform_stats_hourly enable row level security;
alter table public.roblox_platform_stats_daily enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'roblox_platform_stats_hourly'
      and policyname = 'roblox_platform_stats_hourly_select'
  ) then
    create policy roblox_platform_stats_hourly_select
      on public.roblox_platform_stats_hourly
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'roblox_platform_stats_daily'
      and policyname = 'roblox_platform_stats_daily_select'
  ) then
    create policy roblox_platform_stats_daily_select
      on public.roblox_platform_stats_daily
      for select
      using (true);
  end if;
end $$;

grant select on table public.roblox_platform_stats_hourly to anon, authenticated;
grant select on table public.roblox_platform_stats_daily to anon, authenticated;
grant all on table public.roblox_platform_stats_hourly to service_role;
grant all on table public.roblox_platform_stats_daily to service_role;

create or replace function public.refresh_roblox_platform_stats_hourly(
  p_since timestamptz default now() - interval '30 days'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_count integer := 0;
begin
  with source_rows as (
    select
      h.hour_start,
      coalesce(h.avg_playing, h.playing::numeric) as avg_player_value,
      coalesce(h.peak_playing, h.playing, 0) as peak_player_value,
      h.visits_end,
      h.favorites_end,
      h.likes_end,
      h.dislikes_end,
      h.rating_percent,
      greatest(coalesce(h.sample_count, 0), 1) as sample_weight
    from public.roblox_universe_stats_hourly h
    inner join public.stats_game_current_index g
      on g.universe_id = h.universe_id
    where h.hour_start >= date_trunc('hour', p_since)
  ),
  rolled as (
    select
      hour_start,
      coalesce(round(sum(avg_player_value))::bigint, 0::bigint) as playing,
      coalesce(sum(peak_player_value)::bigint, 0::bigint) as peak_players,
      coalesce(sum(avg_player_value), 0::numeric) as avg_players,
      coalesce(sum(coalesce(visits_end, 0))::bigint, 0::bigint) as visits,
      coalesce(sum(coalesce(favorites_end, 0))::bigint, 0::bigint) as favorites,
      coalesce(sum(coalesce(likes_end, 0))::bigint, 0::bigint) as likes,
      coalesce(sum(coalesce(dislikes_end, 0))::bigint, 0::bigint) as dislikes,
      case
        when sum(sample_weight) filter (where rating_percent is not null) > 0 then
          round(
            sum(rating_percent * sample_weight) filter (where rating_percent is not null)
            / sum(sample_weight) filter (where rating_percent is not null),
            1
          )
        else null
      end as rating_percent,
      count(*)::integer as tracked_games,
      coalesce(sum(sample_weight)::bigint, 0::bigint) as samples
    from source_rows
    group by hour_start
  ),
  upserted as (
    insert into public.roblox_platform_stats_hourly (
      hour_start,
      playing,
      peak_players,
      avg_players,
      visits,
      favorites,
      likes,
      dislikes,
      rating_percent,
      tracked_games,
      samples,
      recorded_at
    )
    select
      hour_start,
      playing,
      peak_players,
      avg_players,
      visits,
      favorites,
      likes,
      dislikes,
      rating_percent,
      tracked_games,
      samples,
      now()
    from rolled
    on conflict (hour_start) do update
      set playing = excluded.playing,
          peak_players = excluded.peak_players,
          avg_players = excluded.avg_players,
          visits = excluded.visits,
          favorites = excluded.favorites,
          likes = excluded.likes,
          dislikes = excluded.dislikes,
          rating_percent = excluded.rating_percent,
          tracked_games = excluded.tracked_games,
          samples = excluded.samples,
          recorded_at = excluded.recorded_at
    returning 1
  )
  select count(*) into affected_count from upserted;

  return affected_count;
end;
$$;

create or replace function public.refresh_roblox_platform_stats_daily(
  p_since date default current_date - 180
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_count integer := 0;
begin
  with source_rows as (
    select
      d.stat_date,
      coalesce(d.avg_playing, d.playing::numeric) as avg_player_value,
      coalesce(d.peak_playing, d.playing, 0) as peak_player_value,
      d.visits,
      d.favorites,
      d.likes,
      d.dislikes,
      d.rating_end,
      greatest(coalesce(d.sample_count, 0), 1) as sample_weight
    from public.roblox_universe_stats_daily d
    inner join public.stats_game_current_index g
      on g.universe_id = d.universe_id
    where d.stat_date >= p_since
  ),
  rolled as (
    select
      stat_date,
      coalesce(round(sum(avg_player_value))::bigint, 0::bigint) as playing,
      coalesce(sum(peak_player_value)::bigint, 0::bigint) as peak_players,
      coalesce(sum(avg_player_value), 0::numeric) as avg_players,
      coalesce(sum(coalesce(visits, 0))::bigint, 0::bigint) as visits,
      coalesce(sum(coalesce(favorites, 0))::bigint, 0::bigint) as favorites,
      coalesce(sum(coalesce(likes, 0))::bigint, 0::bigint) as likes,
      coalesce(sum(coalesce(dislikes, 0))::bigint, 0::bigint) as dislikes,
      case
        when sum(sample_weight) filter (where rating_end is not null) > 0 then
          round(
            sum(rating_end * sample_weight) filter (where rating_end is not null)
            / sum(sample_weight) filter (where rating_end is not null),
            1
          )
        else null
      end as rating_percent,
      count(*)::integer as tracked_games,
      coalesce(sum(sample_weight)::bigint, 0::bigint) as samples
    from source_rows
    group by stat_date
  ),
  upserted as (
    insert into public.roblox_platform_stats_daily (
      stat_date,
      playing,
      peak_players,
      avg_players,
      visits,
      favorites,
      likes,
      dislikes,
      rating_percent,
      tracked_games,
      samples,
      recorded_at
    )
    select
      stat_date,
      playing,
      peak_players,
      avg_players,
      visits,
      favorites,
      likes,
      dislikes,
      rating_percent,
      tracked_games,
      samples,
      now()
    from rolled
    on conflict (stat_date) do update
      set playing = excluded.playing,
          peak_players = excluded.peak_players,
          avg_players = excluded.avg_players,
          visits = excluded.visits,
          favorites = excluded.favorites,
          likes = excluded.likes,
          dislikes = excluded.dislikes,
          rating_percent = excluded.rating_percent,
          tracked_games = excluded.tracked_games,
          samples = excluded.samples,
          recorded_at = excluded.recorded_at
    returning 1
  )
  select count(*) into affected_count from upserted;

  return affected_count;
end;
$$;

revoke all on function public.refresh_roblox_platform_stats_hourly(timestamptz) from public, anon, authenticated;
revoke all on function public.refresh_roblox_platform_stats_daily(date) from public, anon, authenticated;
grant execute on function public.refresh_roblox_platform_stats_hourly(timestamptz) to service_role;
grant execute on function public.refresh_roblox_platform_stats_daily(date) to service_role;
