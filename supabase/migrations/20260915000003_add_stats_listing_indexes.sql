create index if not exists idx_roblox_universes_stats_slug_universe
  on public.roblox_universes (universe_id)
  where slug is not null;

create index if not exists idx_roblox_universes_stats_playing
  on public.roblox_universes (playing desc nulls last, universe_id asc)
  where slug is not null;

create index if not exists idx_roblox_universes_stats_visits
  on public.roblox_universes (visits desc nulls last, universe_id asc)
  where slug is not null;

create index if not exists idx_roblox_universes_stats_favorites
  on public.roblox_universes (favorites desc nulls last, universe_id asc)
  where slug is not null;

create index if not exists idx_roblox_universes_stats_updated
  on public.roblox_universes (updated_at_api desc nulls last, universe_id asc)
  where slug is not null;

create index if not exists idx_roblox_universes_stats_created
  on public.roblox_universes (created_at_api asc nulls last, universe_id asc)
  where slug is not null;

create index if not exists idx_roblox_universes_stats_genre_l1
  on public.roblox_universes (genre_l1 asc nulls last, genre asc nulls last)
  where slug is not null;

create index if not exists idx_roblox_universes_stats_genre_l1_playing
  on public.roblox_universes (genre_l1, playing desc nulls last, universe_id asc)
  where slug is not null;

create index if not exists idx_roblox_universes_stats_genre_playing
  on public.roblox_universes (genre, playing desc nulls last, universe_id asc)
  where slug is not null;
