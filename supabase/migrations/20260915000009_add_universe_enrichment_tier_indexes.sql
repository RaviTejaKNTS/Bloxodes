create index if not exists idx_roblox_universes_tier_light_enrichment_v2
  on public.roblox_universes (
    stats_tier,
    last_light_enriched_at asc nulls first,
    universe_id
  )
  where root_place_id is not null;

create index if not exists idx_roblox_universes_tier_deep_enrichment_v2
  on public.roblox_universes (
    stats_tier,
    last_deep_enriched_at asc nulls first,
    universe_id
  )
  where root_place_id is not null;
