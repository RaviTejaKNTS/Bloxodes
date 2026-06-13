create or replace function public.refresh_stats_current_indexes()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  refreshed_at timestamptz := now();
  target_24h timestamptz := date_trunc('hour', now() - interval '24 hours');
  target_7d timestamptz := date_trunc('hour', now() - interval '7 days');
  game_count integer := 0;
  genre_count integer := 0;
  riser_count integer := 0;
begin
  perform set_config('statement_timeout', '120000', true);

  delete from public.stats_risers_current_index where true;
  delete from public.stats_genre_current_index where true;
  delete from public.stats_game_current_index where true;

  with baseline_24h as (
    select distinct on (h.universe_id)
      h.universe_id,
      h.playing
    from public.roblox_universe_stats_hourly h
    where h.playing is not null
      and h.hour_start between target_24h - interval '90 minutes' and target_24h + interval '90 minutes'
    order by h.universe_id, abs(extract(epoch from (h.hour_start - target_24h)))
  ),
  baseline_7d as (
    select distinct on (h.universe_id)
      h.universe_id,
      h.playing
    from public.roblox_universe_stats_hourly h
    where h.playing is not null
      and h.hour_start between target_7d - interval '90 minutes' and target_7d + interval '90 minutes'
    order by h.universe_id, abs(extract(epoch from (h.hour_start - target_7d)))
  ),
  peak_24h as (
    select h.universe_id, max(h.peak_playing)::bigint as peak_playing
    from public.roblox_universe_stats_hourly h
    where h.hour_start >= refreshed_at - interval '24 hours'
    group by h.universe_id
  ),
  peak_7d as (
    select h.universe_id, max(h.peak_playing)::bigint as peak_playing
    from public.roblox_universe_stats_hourly h
    where h.hour_start >= refreshed_at - interval '7 days'
    group by h.universe_id
  ),
  latest_rank_hour as (
    select max(hour_start) as hour_start
    from public.roblox_universe_rank_snapshots_hourly
  ),
  latest_global_rank as (
    select universe_id, rank_value
    from public.roblox_universe_rank_snapshots_hourly
    where rank_type = 'global_playing'
      and hour_start = (select hour_start from latest_rank_hour)
  ),
  latest_genre_rank as (
    select universe_id, rank_value
    from public.roblox_universe_rank_snapshots_hourly
    where rank_type = 'genre_playing'
      and hour_start = (select hour_start from latest_rank_hour)
  ),
  latest_subgenre_rank as (
    select universe_id, rank_value
    from public.roblox_universe_rank_snapshots_hourly
    where rank_type = 'subgenre_playing'
      and hour_start = (select hour_start from latest_rank_hour)
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
  left join baseline_24h on baseline_24h.universe_id = u.universe_id
  left join baseline_7d on baseline_7d.universe_id = u.universe_id
  left join peak_24h on peak_24h.universe_id = u.universe_id
  left join peak_7d on peak_7d.universe_id = u.universe_id
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
