-- Only the small published results are stored. The nightly worker reads the
-- original history in bounded universe batches using its existing
-- (universe_id, stat_date) index. No index build, trigger or backfill runs on
-- the large history table inside the release transaction.
create table public.stats_visit_share_summaries (
  since_date date not null,
  until_date date not null,
  rows jsonb not null check (jsonb_typeof(rows) = 'array'),
  source_started_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  primary key (since_date, until_date),
  check (until_date - since_date in (1, 7, 14, 30, 90))
);

alter table public.stats_visit_share_summaries enable row level security;
revoke all on public.stats_visit_share_summaries from public, anon, authenticated;
grant all on public.stats_visit_share_summaries to service_role;

-- Scalar JSON avoids PostgREST's row cap. All bigint values cross JSON as
-- strings so the worker can add and rank them without floating-point loss.
-- Paging the FK parent includes every history universe, even games excluded
-- from the current stats index or quarantined by the refresh tiers.
create function public.get_stats_visit_share_source_batch(
  p_since date,
  p_until date,
  p_after_universe_id bigint default 0,
  p_limit integer default 250
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if p_since is null or p_until is null or p_until - p_since not between 0 and 91 then
    raise exception 'Visit-share source window must span at most 92 calendar dates';
  end if;

  with batch as materialized (
    select u.universe_id
    from public.roblox_universes u
    where u.universe_id > p_after_universe_id
    order by u.universe_id
    limit greatest(1, least(coalesce(p_limit, 250), 500))
  ), games as (
    select b.universe_id, daily.visits
    from batch b
    cross join lateral (
      select coalesce(jsonb_object_agg(d.stat_date::text, d.visit_delta::text), '{}'::jsonb) as visits
      from (
        select h.stat_date,
          greatest(coalesce(h.visit_delta, h.visits_end - h.visits_start, 0), 0)::bigint as visit_delta
        from public.roblox_universe_stats_daily h
        where h.universe_id = b.universe_id
          and h.stat_date >= p_since and h.stat_date <= p_until
      ) d
      where d.visit_delta > 0
    ) daily
  )
  select jsonb_build_object(
    'next_after', (select max(b.universe_id)::text from batch b),
    'games', coalesce(jsonb_agg(jsonb_build_object(
      'universe_id', g.universe_id::text, 'visits', g.visits
    ) order by g.universe_id), '[]'::jsonb)
  ) into result from games g;

  return result;
end;
$$;

-- All five ranges for today AND tomorrow replace their previous results in
-- one transaction. Tomorrow's windows prevent a cache miss at UTC midnight;
-- they use the same available daily rows, with the next day's cutoff.
create function public.replace_stats_visit_share_summaries(
  p_until date,
  p_windows jsonb,
  p_source_started_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if p_until is null or p_source_started_at is null
    or jsonb_typeof(p_windows) is distinct from 'array'
    or jsonb_array_length(p_windows) <> 10 then
    raise exception 'Expected five visit-share windows for each of two dates';
  end if;

  if (select count(distinct (w.since_date, w.until_date))
      from jsonb_to_recordset(p_windows) as w(since_date date, until_date date, rows jsonb)
      where w.until_date in (p_until, p_until + 1)
        and w.until_date - w.since_date in (1, 7, 14, 30, 90)
        and jsonb_typeof(w.rows) = 'array') <> 10 then
    raise exception 'Incomplete or duplicate visit-share windows';
  end if;

  -- Serialize only publication, never the expensive history reads. An older
  -- worker finishing later must not overwrite a newer successful result.
  perform pg_advisory_xact_lock(hashtextextended('stats_visit_share_summaries', 0));
  if exists (
    select 1 from public.stats_visit_share_summaries s
    where s.until_date in (p_until, p_until + 1)
      and s.source_started_at > p_source_started_at
  ) then
    return 0;
  end if;

  insert into public.stats_visit_share_summaries (since_date, until_date, rows, source_started_at)
  select w.since_date, w.until_date, w.rows, p_source_started_at
  from jsonb_to_recordset(p_windows) as w(since_date date, until_date date, rows jsonb)
  on conflict (since_date, until_date) do update
    set rows = excluded.rows,
        source_started_at = excluded.source_started_at,
        recorded_at = now();
  get diagnostics affected = row_count;

  delete from public.stats_visit_share_summaries where until_date < p_until - 2;
  return affected;
end;
$$;

-- Preserve the exact live implementation for unusual dates/bucket parameters
-- and for comparing prepared results during GitHub managed-development QA.
alter function public.get_stats_visit_share_chart(date, date, integer, integer, integer)
  rename to get_stats_visit_share_chart_live;

create function public.get_stats_visit_share_chart(
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
language plpgsql
security definer
set search_path = ''
as $$
declare
  prepared_rows jsonb;
begin
  if p_top_games = 8 and p_top_group = 100 and p_wide_group = 1000 then
    select s.rows into prepared_rows
    from public.stats_visit_share_summaries s
    where s.since_date = p_since and s.until_date = p_until;

    if found then
      return query
      select b.stat_date, b.bucket_key,
        case when b.universe_id is not null
          then coalesce(nullif(u.display_name, ''), u.name, b.universe_id::text)
          else b.bucket_name end,
        b.universe_id,
        case when b.universe_id is not null then u.slug else null::text end,
        case when b.universe_id is not null then u.icon_url else null::text end,
        b.bucket_rank_start, b.bucket_rank_end, b.is_group, b.visit_delta,
        b.denominator_visit_delta, b.denominator_game_count
      from jsonb_to_recordset(prepared_rows) as b(
        stat_date date, bucket_key text, bucket_name text, universe_id bigint,
        bucket_rank_start integer, bucket_rank_end integer, is_group boolean,
        visit_delta bigint, denominator_visit_delta bigint, denominator_game_count integer
      )
      left join public.roblox_universes u on u.universe_id = b.universe_id
      order by b.stat_date, b.bucket_rank_start, b.bucket_rank_end, b.bucket_key;
      return;
    end if;

    -- Never put an unbounded history scan back on the public request path
    -- during initial warmup or after a missed refresh. The web's existing
    -- error path retains the last good result instead of accepting empty data.
    if p_until = (now() at time zone 'UTC')::date and p_until - p_since in (1, 7, 14, 30, 90) then
      raise exception using errcode = '55000', message = 'Visit-share summary is not ready';
    end if;
  end if;

  return query select * from public.get_stats_visit_share_chart_live(
    p_since, p_until, p_top_games, p_top_group, p_wide_group
  );
end;
$$;

revoke all on function public.get_stats_visit_share_source_batch(date, date, bigint, integer) from public, anon, authenticated;
revoke all on function public.replace_stats_visit_share_summaries(date, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.get_stats_visit_share_chart(date, date, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.get_stats_visit_share_chart_live(date, date, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.get_stats_visit_share_source_batch(date, date, bigint, integer) to service_role;
grant execute on function public.replace_stats_visit_share_summaries(date, jsonb, timestamptz) to service_role;
grant execute on function public.get_stats_visit_share_chart(date, date, integer, integer, integer) to service_role;
grant execute on function public.get_stats_visit_share_chart_live(date, date, integer, integer, integer) to service_role;

notify pgrst, 'reload schema';
