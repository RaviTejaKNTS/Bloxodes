-- Speed up public Roblox decal ID catalog reads. These pages always require
-- active decals with completed thumbnails, so partial indexes keep the hot path
-- much smaller than the full refresh table.

create index if not exists idx_roblox_decal_ids_public_recommended
  on public.roblox_decal_ids (
    curated_score desc nulls last,
    popularity_score desc nulls last,
    last_seen_at desc nulls last,
    verified_at desc nulls last
  )
  where status = 'active'
    and thumbnail_state = 'Completed'
    and thumbnail_url is not null;

create index if not exists idx_roblox_decal_ids_public_curated
  on public.roblox_decal_ids (
    curated_rank asc nulls last,
    curated_score desc nulls last,
    popularity_score desc nulls last
  )
  where status = 'active'
    and thumbnail_state = 'Completed'
    and thumbnail_url is not null
    and curated_rank is not null;

create index if not exists idx_roblox_decal_ids_public_newest
  on public.roblox_decal_ids (roblox_created_at desc nulls last)
  where status = 'active'
    and thumbnail_state = 'Completed'
    and thumbnail_url is not null;

create index if not exists idx_roblox_decal_ids_public_oldest
  on public.roblox_decal_ids (roblox_created_at asc nulls last)
  where status = 'active'
    and thumbnail_state = 'Completed'
    and thumbnail_url is not null;

create index if not exists idx_roblox_decal_ids_public_name
  on public.roblox_decal_ids (name asc nulls last)
  where status = 'active'
    and thumbnail_state = 'Completed'
    and thumbnail_url is not null;

create index if not exists idx_roblox_decal_ids_public_creator
  on public.roblox_decal_ids (creator_name asc nulls last)
  where status = 'active'
    and thumbnail_state = 'Completed'
    and thumbnail_url is not null;

create index if not exists idx_roblox_decal_ids_public_categories
  on public.roblox_decal_ids using gin (categories)
  where status = 'active'
    and thumbnail_state = 'Completed'
    and thumbnail_url is not null;
