-- Match the public recommended and popular ordering for Roblox decal ID list pages.
-- The hot path shows active decals with completed thumbnails and ranks
-- curated rows ahead of the broader verified pool.

create index if not exists idx_roblox_decal_ids_public_recommended_rank
  on public.roblox_decal_ids (
    curated_rank asc nulls last,
    curated_score desc nulls last,
    popularity_score desc nulls last,
    last_seen_at desc nulls last
  )
  where status = 'active'
    and thumbnail_state = 'Completed'
    and thumbnail_url is not null;

create index if not exists idx_roblox_decal_ids_public_popular_votes
  on public.roblox_decal_ids (
    vote_count desc nulls last,
    popularity_score desc nulls last,
    last_seen_at desc nulls last
  )
  where status = 'active'
    and thumbnail_state = 'Completed'
    and thumbnail_url is not null;
