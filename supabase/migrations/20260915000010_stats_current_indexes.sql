create table if not exists public.stats_game_current_index (
  universe_id bigint primary key references public.roblox_universes(universe_id) on delete cascade,
  root_place_id bigint,
  slug text not null,
  name text not null,
  display_name text,
  description text,
  creator_id bigint,
  creator_name text,
  creator_type text,
  genre text,
  genre_l1 text,
  genre_l2 text,
  age_rating text,
  icon_url text,
  thumbnail_urls jsonb not null default '[]'::jsonb,
  playing bigint,
  visits bigint,
  favorites bigint,
  likes bigint,
  dislikes bigint,
  rating_percent numeric,
  stats_tier text,
  created_at_api timestamptz,
  updated_at_api timestamptz,
  last_stats_refreshed_at timestamptz,
  last_playing_refreshed_at timestamptz,
  desktop_enabled boolean,
  mobile_enabled boolean,
  tablet_enabled boolean,
  console_enabled boolean,
  vr_enabled boolean,
  baseline_playing_24h bigint,
  baseline_playing_7d bigint,
  growth_24h bigint,
  growth_24h_percent numeric,
  growth_7d bigint,
  growth_7d_percent numeric,
  peak_24h bigint,
  peak_7d bigint,
  global_playing_rank integer,
  genre_playing_rank integer,
  subgenre_playing_rank integer,
  indexed_at timestamptz not null default now()
);

create index if not exists idx_stats_game_current_playing
  on public.stats_game_current_index (playing desc nulls last, universe_id asc);

create index if not exists idx_stats_game_current_visits
  on public.stats_game_current_index (visits desc nulls last, universe_id asc);

create index if not exists idx_stats_game_current_favorites
  on public.stats_game_current_index (favorites desc nulls last, universe_id asc);

create index if not exists idx_stats_game_current_growth_24h
  on public.stats_game_current_index (growth_24h desc nulls last, playing desc nulls last, universe_id asc);

create index if not exists idx_stats_game_current_growth_7d
  on public.stats_game_current_index (growth_7d desc nulls last, playing desc nulls last, universe_id asc);

create index if not exists idx_stats_game_current_rating
  on public.stats_game_current_index (rating_percent desc nulls last, playing desc nulls last, universe_id asc);

create index if not exists idx_stats_game_current_peak_24h
  on public.stats_game_current_index (peak_24h desc nulls last, playing desc nulls last, universe_id asc);

create index if not exists idx_stats_game_current_updated
  on public.stats_game_current_index (updated_at_api desc nulls last, universe_id asc);

create index if not exists idx_stats_game_current_created
  on public.stats_game_current_index (created_at_api asc nulls last, universe_id asc);

create index if not exists idx_stats_game_current_genre
  on public.stats_game_current_index (genre_l1, playing desc nulls last, universe_id asc);

create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_stats_game_current_name_trgm
  on public.stats_game_current_index
  using gin (name extensions.gin_trgm_ops);

create index if not exists idx_stats_game_current_display_name_trgm
  on public.stats_game_current_index
  using gin (display_name extensions.gin_trgm_ops);

create index if not exists idx_stats_game_current_creator_name_trgm
  on public.stats_game_current_index
  using gin (creator_name extensions.gin_trgm_ops);

create table if not exists public.stats_genre_current_index (
  genre_slug text primary key,
  genre text not null,
  games integer not null default 0,
  playing bigint not null default 0,
  visits bigint not null default 0,
  top_universe_id bigint references public.roblox_universes(universe_id) on delete set null,
  top_name text,
  top_slug text,
  top_icon_url text,
  top_playing bigint,
  indexed_at timestamptz not null default now()
);

create index if not exists idx_stats_genre_current_playing
  on public.stats_genre_current_index (playing desc, genre asc);

create table if not exists public.stats_risers_current_index (
  universe_id bigint primary key references public.roblox_universes(universe_id) on delete cascade,
  slug text not null,
  name text not null,
  icon_url text,
  genre text,
  playing bigint not null,
  baseline_playing_24h bigint not null,
  growth_24h bigint not null,
  growth_24h_percent numeric not null,
  riser_score numeric not null,
  eligibility_threshold integer not null default 1000,
  rank_value integer not null,
  indexed_at timestamptz not null default now()
);

create index if not exists idx_stats_risers_current_rank
  on public.stats_risers_current_index (rank_value asc);

create index if not exists idx_stats_risers_current_score
  on public.stats_risers_current_index (riser_score desc, growth_24h desc, playing desc);

create table if not exists public.revalidation_worker_runs (
  id uuid primary key default extensions.uuid_generate_v4(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  batch_size integer not null default 0,
  fetched_count integer not null default 0,
  processed_count integer not null default 0,
  failed_count integer not null default 0,
  status_code integer,
  duration_ms integer,
  error text,
  events jsonb not null default '[]'::jsonb,
  response_body text,
  created_at timestamptz not null default now(),
  constraint revalidation_worker_runs_status_check
    check (status in ('running', 'success', 'failed', 'skipped'))
);

create index if not exists idx_revalidation_worker_runs_started
  on public.revalidation_worker_runs (started_at desc);

create index if not exists idx_revalidation_worker_runs_status_started
  on public.revalidation_worker_runs (status, started_at desc);

alter table public.stats_game_current_index enable row level security;
alter table public.stats_genre_current_index enable row level security;
alter table public.stats_risers_current_index enable row level security;
alter table public.revalidation_worker_runs enable row level security;

grant select on table public.stats_game_current_index to anon, authenticated, service_role;
grant select on table public.stats_genre_current_index to anon, authenticated, service_role;
grant select on table public.stats_risers_current_index to anon, authenticated, service_role;
grant all on table public.stats_game_current_index to service_role;
grant all on table public.stats_genre_current_index to service_role;
grant all on table public.stats_risers_current_index to service_role;
grant all on table public.revalidation_worker_runs to service_role;

create or replace function public.percent_delta(p_current numeric, p_previous numeric)
returns numeric
language sql
immutable
as $$
  select case
    when p_current is null or p_previous is null or p_previous <= 0 then null
    else round(((p_current - p_previous) / p_previous) * 1000) / 10
  end;
$$;

create or replace function public.slugify_stats_label(p_value text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(regexp_replace(lower(coalesce(p_value, 'uncategorized')), '[^a-z0-9]+', '-', 'g'), ''), 'uncategorized');
$$;

create or replace function public.refresh_stats_current_indexes()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  refreshed_at timestamptz := now();
  game_count integer := 0;
  genre_count integer := 0;
  riser_count integer := 0;
begin
  delete from public.stats_risers_current_index;
  delete from public.stats_genre_current_index;
  delete from public.stats_game_current_index;

  with latest_global_rank as (
    select distinct on (universe_id)
      universe_id,
      rank_value
    from public.roblox_universe_rank_snapshots_hourly
    where rank_type = 'global_playing'
    order by universe_id, hour_start desc
  ),
  latest_genre_rank as (
    select distinct on (universe_id)
      universe_id,
      rank_value
    from public.roblox_universe_rank_snapshots_hourly
    where rank_type = 'genre_playing'
    order by universe_id, hour_start desc
  ),
  latest_subgenre_rank as (
    select distinct on (universe_id)
      universe_id,
      rank_value
    from public.roblox_universe_rank_snapshots_hourly
    where rank_type = 'subgenre_playing'
    order by universe_id, hour_start desc
  )
  insert into public.stats_game_current_index (
    universe_id,
    root_place_id,
    slug,
    name,
    display_name,
    description,
    creator_id,
    creator_name,
    creator_type,
    genre,
    genre_l1,
    genre_l2,
    age_rating,
    icon_url,
    thumbnail_urls,
    playing,
    visits,
    favorites,
    likes,
    dislikes,
    rating_percent,
    stats_tier,
    created_at_api,
    updated_at_api,
    last_stats_refreshed_at,
    last_playing_refreshed_at,
    desktop_enabled,
    mobile_enabled,
    tablet_enabled,
    console_enabled,
    vr_enabled,
    baseline_playing_24h,
    baseline_playing_7d,
    growth_24h,
    growth_24h_percent,
    growth_7d,
    growth_7d_percent,
    peak_24h,
    peak_7d,
    global_playing_rank,
    genre_playing_rank,
    subgenre_playing_rank,
    indexed_at
  )
  select
    u.universe_id,
    u.root_place_id,
    u.slug,
    u.name,
    u.display_name,
    u.description,
    u.creator_id,
    u.creator_name,
    u.creator_type,
    u.genre,
    u.genre_l1,
    u.genre_l2,
    u.age_rating,
    u.icon_url,
    coalesce(u.thumbnail_urls, '[]'::jsonb),
    u.playing,
    u.visits,
    u.favorites,
    u.likes,
    u.dislikes,
    case
      when coalesce(u.likes, 0) + coalesce(u.dislikes, 0) <= 0 then null
      else round((coalesce(u.likes, 0)::numeric / (coalesce(u.likes, 0) + coalesce(u.dislikes, 0))::numeric) * 1000) / 10
    end,
    u.stats_tier,
    u.created_at_api,
    u.updated_at_api,
    u.last_stats_refreshed_at,
    u.last_playing_refreshed_at,
    u.desktop_enabled,
    u.mobile_enabled,
    u.tablet_enabled,
    u.console_enabled,
    u.vr_enabled,
    baseline_24h.playing,
    baseline_7d.playing,
    case when u.playing is not null and baseline_24h.playing is not null then u.playing - baseline_24h.playing else null end,
    public.percent_delta(u.playing::numeric, baseline_24h.playing::numeric),
    case when u.playing is not null and baseline_7d.playing is not null then u.playing - baseline_7d.playing else null end,
    public.percent_delta(u.playing::numeric, baseline_7d.playing::numeric),
    peak_24h.peak_playing,
    peak_7d.peak_playing,
    latest_global_rank.rank_value,
    latest_genre_rank.rank_value,
    latest_subgenre_rank.rank_value,
    refreshed_at
  from public.roblox_universes u
  left join lateral (
    select h.playing
    from public.roblox_universe_stats_hourly h
    where h.universe_id = u.universe_id
      and h.playing is not null
      and h.hour_start between refreshed_at - interval '25 hours 30 minutes' and refreshed_at - interval '22 hours 30 minutes'
    order by abs(extract(epoch from (h.hour_start - (refreshed_at - interval '24 hours'))))
    limit 1
  ) baseline_24h on true
  left join lateral (
    select h.playing
    from public.roblox_universe_stats_hourly h
    where h.universe_id = u.universe_id
      and h.playing is not null
      and h.hour_start between refreshed_at - interval '7 days 90 minutes' and refreshed_at - interval '7 days' + interval '90 minutes'
    order by abs(extract(epoch from (h.hour_start - (refreshed_at - interval '7 days'))))
    limit 1
  ) baseline_7d on true
  left join lateral (
  select max(h.peak_playing)::bigint as peak_playing
    from public.roblox_universe_stats_hourly h
    where h.universe_id = u.universe_id
      and h.hour_start >= refreshed_at - interval '24 hours'
  ) peak_24h on true
  left join lateral (
    select max(h.peak_playing)::bigint as peak_playing
    from public.roblox_universe_stats_hourly h
    where h.universe_id = u.universe_id
      and h.hour_start >= refreshed_at - interval '7 days'
  ) peak_7d on true
  left join latest_global_rank on latest_global_rank.universe_id = u.universe_id
  left join latest_genre_rank on latest_genre_rank.universe_id = u.universe_id
  left join latest_subgenre_rank on latest_subgenre_rank.universe_id = u.universe_id
  where u.slug is not null;

  get diagnostics game_count = row_count;

  with ranked as (
    select
      public.slugify_stats_label(coalesce(genre_l1, genre, 'Uncategorized')) as genre_slug,
      coalesce(genre_l1, genre, 'Uncategorized') as genre,
      universe_id,
      name,
      slug,
      icon_url,
      playing,
      visits,
      row_number() over (
        partition by coalesce(genre_l1, genre, 'Uncategorized')
        order by playing desc nulls last, universe_id asc
      ) as rn
    from public.stats_game_current_index
  )
  insert into public.stats_genre_current_index (
    genre_slug,
    genre,
    games,
    playing,
    visits,
    top_universe_id,
    top_name,
    top_slug,
    top_icon_url,
    top_playing,
    indexed_at
  )
  select
    genre_slug,
    min(genre) as genre,
    count(*)::integer as games,
    coalesce(sum(playing), 0)::bigint as playing,
    coalesce(sum(visits), 0)::bigint as visits,
    max(universe_id) filter (where rn = 1) as top_universe_id,
    max(name) filter (where rn = 1) as top_name,
    max(slug) filter (where rn = 1) as top_slug,
    max(icon_url) filter (where rn = 1) as top_icon_url,
    max(playing) filter (where rn = 1) as top_playing,
    refreshed_at
  from ranked
  group by genre_slug;

  get diagnostics genre_count = row_count;

  with eligible as (
    select
      universe_id,
      slug,
      name,
      icon_url,
      coalesce(genre_l1, genre) as genre,
      playing,
      baseline_playing_24h,
      growth_24h,
      growth_24h_percent,
      (
        least(greatest(coalesce(growth_24h, 0), 0), 50000)::numeric / 50000 * 55
        + least(greatest(coalesce(growth_24h_percent, 0), 0), 300)::numeric / 300 * 30
        + least(log(greatest(coalesce(playing, 1), 1)::numeric) / log(1000000::numeric), 1) * 15
      ) as riser_score
    from public.stats_game_current_index
    where playing >= 1000
      and baseline_playing_24h is not null
      and growth_24h is not null
      and growth_24h > 0
      and growth_24h_percent is not null
  ),
  ranked as (
    select
      *,
      row_number() over (order by riser_score desc, growth_24h desc, playing desc, universe_id asc) as rank_value
    from eligible
  )
  insert into public.stats_risers_current_index (
    universe_id,
    slug,
    name,
    icon_url,
    genre,
    playing,
    baseline_playing_24h,
    growth_24h,
    growth_24h_percent,
    riser_score,
    eligibility_threshold,
    rank_value,
    indexed_at
  )
  select
    universe_id,
    slug,
    name,
    icon_url,
    genre,
    playing,
    baseline_playing_24h,
    growth_24h,
    growth_24h_percent,
    riser_score,
    1000,
    rank_value,
    refreshed_at
  from ranked;

  get diagnostics riser_count = row_count;

  return jsonb_build_object(
    'indexed_at', refreshed_at,
    'games', game_count,
    'genres', genre_count,
    'risers', riser_count
  );
end;
$$;

revoke all on function public.refresh_stats_current_indexes() from public, anon, authenticated;
grant execute on function public.refresh_stats_current_indexes() to service_role;

alter table public.roblox_universes
  add column if not exists stats_ingest_status text,
  add column if not exists stats_ingest_status_updated_at timestamptz;

create index if not exists idx_roblox_universes_stats_ingest_status
  on public.roblox_universes (stats_ingest_status, stats_ingest_status_updated_at desc)
  where stats_tier = 'NEW';
