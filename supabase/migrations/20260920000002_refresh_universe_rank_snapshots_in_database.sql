-- Compute universe rank snapshots inside PostgreSQL. Pulling every sorted
-- universe through PostgREST makes deep cursor pages exceed its statement
-- timeout once the fresh population approaches 100,000 rows.

create or replace function public.refresh_universe_rank_snapshots(
  p_granularity text default 'hourly',
  p_rank_set text default 'playing',
  p_snapshot_scope text default 'relevant',
  p_sampled_at timestamptz default now(),
  p_global_limit integer default 10000,
  p_scoped_limit integer default 1000
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '240s'
as $$
declare
  normalized_granularity text := lower(coalesce(nullif(btrim(p_granularity), ''), 'hourly'));
  normalized_rank_set text := lower(coalesce(nullif(btrim(p_rank_set), ''), 'playing'));
  normalized_snapshot_scope text := lower(coalesce(nullif(btrim(p_snapshot_scope), ''), 'relevant'));
  target_sampled_at timestamptz := coalesce(p_sampled_at, now());
  target_hour timestamptz;
  target_date date;
  global_playing_count integer := 0;
  genre_playing_count integer := 0;
  subgenre_playing_count integer := 0;
  global_visits_count integer := 0;
  global_favorites_count integer := 0;
  global_rating_count integer := 0;
  written_count integer := 0;
begin
  if normalized_granularity not in ('hourly', 'daily') then
    raise exception 'Invalid rank granularity: %', normalized_granularity;
  end if;
  if normalized_rank_set not in ('playing', 'all') then
    raise exception 'Invalid rank set: %', normalized_rank_set;
  end if;
  if normalized_snapshot_scope not in ('relevant', 'all') then
    raise exception 'Invalid rank snapshot scope: %', normalized_snapshot_scope;
  end if;

  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(
    'refresh_universe_rank_snapshots:' || normalized_granularity || ':' || normalized_rank_set,
    0
  )) then
    return pg_catalog.jsonb_build_object('skipped', true, 'reason', 'lock_busy');
  end if;

  target_hour := pg_catalog.date_trunc('hour', target_sampled_at);
  target_date := target_sampled_at::date;

  drop table if exists pg_temp.universe_rank_payload_tmp;
  create temporary table universe_rank_payload_tmp on commit drop as
  with playing_ranked as materialized (
    select
      universe.universe_id,
      universe.stats_tier,
      universe.playing,
      universe.genre_l1,
      universe.genre_l2,
      pg_catalog.row_number() over (
        order by universe.playing desc nulls last, universe.universe_id
      )::integer as global_playing_rank,
      case when universe.genre_l1 is not null then
        pg_catalog.row_number() over (
          partition by universe.genre_l1
          order by universe.playing desc nulls last, universe.universe_id
        )::integer
      end as genre_playing_rank,
      case when universe.genre_l2 is not null then
        pg_catalog.row_number() over (
          partition by universe.genre_l2
          order by universe.playing desc nulls last, universe.universe_id
        )::integer
      end as subgenre_playing_rank
    from public.roblox_universes universe
    where universe.playing is not null
      and (universe.stats_tier is null or universe.stats_tier <> 'NEW')
      and universe.last_playing_refreshed_at >= now() - interval '24 hours'
  ), metric_base as materialized (
    select
      universe.universe_id,
      universe.stats_tier,
      universe.visits,
      universe.favorites,
      case
        when coalesce(universe.likes, 0) + coalesce(universe.dislikes, 0) >= 20
        then pg_catalog.round(
          coalesce(universe.likes, 0)::numeric
          / (coalesce(universe.likes, 0) + coalesce(universe.dislikes, 0))::numeric
          * 100,
          1
        )
      end as rating_percent
    from public.roblox_universes universe
    where universe.stats_tier is null or universe.stats_tier <> 'NEW'
  ), metric_ranked as materialized (
    select
      metric.*,
      pg_catalog.row_number() over (
        order by metric.visits desc nulls last, metric.universe_id
      )::integer as global_visits_rank,
      pg_catalog.row_number() over (
        order by metric.favorites desc nulls last, metric.universe_id
      )::integer as global_favorites_rank,
      pg_catalog.row_number() over (
        order by metric.rating_percent desc nulls last, metric.universe_id
      )::integer as global_rating_rank
    from metric_base metric
  )
  select
    ranked.universe_id,
    'global_playing'::text as rank_type,
    ranked.global_playing_rank as rank_value,
    ranked.playing::numeric as metric_value
  from playing_ranked ranked
  where normalized_snapshot_scope = 'all'
    or ranked.stats_tier in ('HOT', 'WARM')
    or ranked.global_playing_rank <= greatest(1, coalesce(p_global_limit, 10000))

  union all

  select
    ranked.universe_id,
    'genre_playing'::text,
    ranked.genre_playing_rank,
    ranked.playing::numeric
  from playing_ranked ranked
  where ranked.genre_l1 is not null
    and (
      normalized_snapshot_scope = 'all'
      or ranked.stats_tier in ('HOT', 'WARM')
      or ranked.genre_playing_rank <= greatest(1, coalesce(p_scoped_limit, 1000))
    )

  union all

  select
    ranked.universe_id,
    'subgenre_playing'::text,
    ranked.subgenre_playing_rank,
    ranked.playing::numeric
  from playing_ranked ranked
  where ranked.genre_l2 is not null
    and (
      normalized_snapshot_scope = 'all'
      or ranked.stats_tier in ('HOT', 'WARM')
      or ranked.subgenre_playing_rank <= greatest(1, coalesce(p_scoped_limit, 1000))
    )

  union all

  select
    ranked.universe_id,
    'global_visits'::text,
    ranked.global_visits_rank,
    ranked.visits::numeric
  from metric_ranked ranked
  where normalized_rank_set = 'all'
    and ranked.visits is not null
    and (
      normalized_snapshot_scope = 'all'
      or ranked.stats_tier in ('HOT', 'WARM')
      or ranked.global_visits_rank <= greatest(1, coalesce(p_global_limit, 10000))
    )

  union all

  select
    ranked.universe_id,
    'global_favorites'::text,
    ranked.global_favorites_rank,
    ranked.favorites::numeric
  from metric_ranked ranked
  where normalized_rank_set = 'all'
    and ranked.favorites is not null
    and (
      normalized_snapshot_scope = 'all'
      or ranked.stats_tier in ('HOT', 'WARM')
      or ranked.global_favorites_rank <= greatest(1, coalesce(p_global_limit, 10000))
    )

  union all

  select
    ranked.universe_id,
    'global_rating'::text,
    ranked.global_rating_rank,
    ranked.rating_percent
  from metric_ranked ranked
  where normalized_rank_set = 'all'
    and ranked.rating_percent is not null
    and (
      normalized_snapshot_scope = 'all'
      or ranked.stats_tier in ('HOT', 'WARM')
      or ranked.global_rating_rank <= greatest(1, coalesce(p_global_limit, 10000))
    );

  select
    count(*) filter (where rank_type = 'global_playing'),
    count(*) filter (where rank_type = 'genre_playing'),
    count(*) filter (where rank_type = 'subgenre_playing'),
    count(*) filter (where rank_type = 'global_visits'),
    count(*) filter (where rank_type = 'global_favorites'),
    count(*) filter (where rank_type = 'global_rating'),
    count(*)
  into
    global_playing_count,
    genre_playing_count,
    subgenre_playing_count,
    global_visits_count,
    global_favorites_count,
    global_rating_count,
    written_count
  from pg_temp.universe_rank_payload_tmp;

  if normalized_granularity = 'hourly' then
    insert into public.roblox_universe_rank_snapshots_hourly (
      universe_id,
      rank_type,
      hour_start,
      rank_value,
      metric_value,
      sampled_at
    )
    select
      payload.universe_id,
      payload.rank_type,
      target_hour,
      payload.rank_value,
      payload.metric_value,
      target_hour
    from pg_temp.universe_rank_payload_tmp payload
    on conflict (universe_id, rank_type, hour_start) do update
    set
      rank_value = excluded.rank_value,
      metric_value = excluded.metric_value,
      sampled_at = excluded.sampled_at;
  else
    insert into public.roblox_universe_rank_snapshots_daily (
      universe_id,
      rank_type,
      stat_date,
      rank_value,
      metric_value,
      sampled_at
    )
    select
      payload.universe_id,
      payload.rank_type,
      target_date,
      payload.rank_value,
      payload.metric_value,
      target_sampled_at
    from pg_temp.universe_rank_payload_tmp payload
    on conflict (universe_id, rank_type, stat_date) do update
    set
      rank_value = excluded.rank_value,
      metric_value = excluded.metric_value,
      sampled_at = excluded.sampled_at;
  end if;

  return pg_catalog.jsonb_build_object(
    'skipped', false,
    'sampled_at', target_sampled_at,
    'rows_written', written_count,
    'global_playing', global_playing_count,
    'genre_playing', genre_playing_count,
    'subgenre_playing', subgenre_playing_count,
    'global_visits', global_visits_count,
    'global_favorites', global_favorites_count,
    'global_rating', global_rating_count
  );
end;
$$;

revoke all on function public.refresh_universe_rank_snapshots(text, text, text, timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.refresh_universe_rank_snapshots(text, text, text, timestamptz, integer, integer) to service_role;
