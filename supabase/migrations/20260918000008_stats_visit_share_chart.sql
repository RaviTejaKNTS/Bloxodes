create or replace function public.get_stats_visit_share_chart(
  p_since date,
  p_until date,
  p_top_games integer default 8,
  p_top_group integer default 100,
  p_wide_group integer default 1000
)
returns table (
  stat_date date,
  bucket_key text,
  bucket_name text,
  universe_id bigint,
  slug text,
  icon_url text,
  bucket_rank_start integer,
  bucket_rank_end integer,
  is_group boolean,
  visit_delta bigint,
  denominator_visit_delta bigint,
  denominator_game_count integer
)
language sql
security definer
set search_path = ''
as $$
  with daily_source as (
    select
      d.universe_id,
      d.stat_date,
      greatest(
        coalesce(d.visit_delta, d.visits_end - d.visits_start, 0),
        0
      )::bigint as visit_delta
    from public.roblox_universe_stats_daily d
    where d.stat_date >= p_since
      and d.stat_date <= p_until
  ),
  positive_daily as (
    select *
    from daily_source
    where visit_delta > 0
  ),
  game_totals as (
    select
      universe_id,
      sum(visit_delta)::bigint as total_visits
    from positive_daily
    group by universe_id
  ),
  ranked_games as (
    select
      gt.universe_id,
      row_number() over (order by gt.total_visits desc, gt.universe_id asc)::integer as visit_rank,
      gt.total_visits,
      coalesce(nullif(u.display_name, ''), u.name) as game_name,
      u.slug,
      u.icon_url
    from game_totals gt
    left join public.roblox_universes u
      on u.universe_id = gt.universe_id
  ),
  daily_denominator as (
    select
      stat_date,
      sum(visit_delta)::bigint as denominator_visit_delta,
      count(distinct universe_id)::integer as denominator_game_count
    from positive_daily
    group by stat_date
  ),
  top_bucketed as (
    select
      d.stat_date,
      case
        when rg.visit_rank <= p_top_games then 'g' || rg.universe_id::text
        when rg.visit_rank <= p_top_group then 'rank_' || (p_top_games + 1)::text || '_' || p_top_group::text
        when rg.visit_rank <= p_wide_group then 'rank_' || (p_top_group + 1)::text || '_' || p_wide_group::text
      end as bucket_key,
      case
        when rg.visit_rank <= p_top_games then coalesce(rg.game_name, rg.universe_id::text)
        when rg.visit_rank <= p_top_group then 'Ranks ' || (p_top_games + 1)::text || '-' || p_top_group::text
        when rg.visit_rank <= p_wide_group then 'Ranks ' || (p_top_group + 1)::text || '-' || p_wide_group::text
      end as bucket_name,
      case when rg.visit_rank <= p_top_games then rg.universe_id else null end as universe_id,
      case when rg.visit_rank <= p_top_games then rg.slug else null end as slug,
      case when rg.visit_rank <= p_top_games then rg.icon_url else null end as icon_url,
      case
        when rg.visit_rank <= p_top_games then rg.visit_rank
        when rg.visit_rank <= p_top_group then p_top_games + 1
        when rg.visit_rank <= p_wide_group then p_top_group + 1
      end as bucket_rank_start,
      case
        when rg.visit_rank <= p_top_games then rg.visit_rank
        when rg.visit_rank <= p_top_group then p_top_group
        when rg.visit_rank <= p_wide_group then p_wide_group
      end as bucket_rank_end,
      rg.visit_rank > p_top_games as is_group,
      sum(d.visit_delta)::bigint as visit_delta
    from positive_daily d
    inner join ranked_games rg
      on rg.universe_id = d.universe_id
    where rg.visit_rank <= p_wide_group
    group by
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9
  ),
  top_totals_by_date as (
    select
      stat_date,
      sum(visit_delta)::bigint as top_visit_delta
    from top_bucketed
    group by stat_date
  ),
  other_bucket as (
    select
      dd.stat_date,
      'other_tracked'::text as bucket_key,
      'Other tracked games'::text as bucket_name,
      null::bigint as universe_id,
      null::text as slug,
      null::text as icon_url,
      p_wide_group + 1 as bucket_rank_start,
      dd.denominator_game_count as bucket_rank_end,
      true as is_group,
      greatest(dd.denominator_visit_delta - coalesce(tt.top_visit_delta, 0), 0)::bigint as visit_delta
    from daily_denominator dd
    left join top_totals_by_date tt
      on tt.stat_date = dd.stat_date
    where greatest(dd.denominator_visit_delta - coalesce(tt.top_visit_delta, 0), 0) > 0
  )
  select
    b.stat_date,
    b.bucket_key,
    b.bucket_name,
    b.universe_id,
    b.slug,
    b.icon_url,
    b.bucket_rank_start,
    b.bucket_rank_end,
    b.is_group,
    b.visit_delta,
    dd.denominator_visit_delta,
    dd.denominator_game_count
  from (
    select * from top_bucketed
    union all
    select * from other_bucket
  ) b
  inner join daily_denominator dd
    on dd.stat_date = b.stat_date
  order by
    b.stat_date asc,
    b.bucket_rank_start asc,
    b.bucket_rank_end asc,
    b.bucket_key asc;
$$;

revoke all on function public.get_stats_visit_share_chart(date, date, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.get_stats_visit_share_chart(date, date, integer, integer, integer) to service_role;
