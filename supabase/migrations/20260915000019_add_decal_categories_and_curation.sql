-- Add refreshable category and curation fields for the Roblox decal ID catalog.

alter table if exists public.roblox_decal_ids
  add column if not exists categories text[] not null default '{}'::text[],
  add column if not exists primary_category text,
  add column if not exists curated_score double precision not null default 0,
  add column if not exists curated_rank integer,
  add column if not exists curated_tier text,
  add column if not exists curated_reason text;

create index if not exists idx_roblox_decal_ids_categories
  on public.roblox_decal_ids using gin (categories);

create index if not exists idx_roblox_decal_ids_primary_category
  on public.roblox_decal_ids (primary_category);

create index if not exists idx_roblox_decal_ids_curated_score
  on public.roblox_decal_ids (curated_score desc);

create index if not exists idx_roblox_decal_ids_curated_rank
  on public.roblox_decal_ids (curated_rank);

drop view if exists public.roblox_decal_categories_view;
drop view if exists public.roblox_decal_ids_ranked_view;

create or replace view public.roblox_decal_ids_ranked_view
with (security_invoker = true) as
select
  rd.asset_id,
  rd.texture_id,
  rd.name,
  rd.description,
  rd.creator_id,
  rd.creator_type,
  rd.creator_name,
  rd.creator_verified,
  rd.roblox_created_at,
  rd.roblox_updated_at,
  rd.is_public_domain,
  rd.is_for_sale,
  rd.price_in_robux,
  rd.sales,
  rd.purchasable,
  rd.vote_count,
  rd.upvote_percent,
  rd.thumbnail_url,
  rd.thumbnail_state,
  rd.thumbnail_checked_at,
  rd.status,
  rd.status_reason,
  rd.source,
  rd.raw_payload,
  rd.first_seen_at,
  rd.last_seen_at,
  rd.verified_at,
  rd.popularity_score,
  rd.categories,
  rd.primary_category,
  rd.curated_score,
  rd.curated_rank,
  rd.curated_tier,
  rd.curated_reason,
  rd.created_at,
  rd.updated_at,
  case
    when rd.thumbnail_state = 'Completed' and rd.thumbnail_url is not null then true
    else false
  end as thumbnail_ready,
  case
    when rd.roblox_created_at is null then 999
    when rd.roblox_created_at >= now() - interval '30 days' then 0
    when rd.roblox_created_at >= now() - interval '180 days' then 1
    when rd.roblox_created_at >= now() - interval '1 year' then 2
    else 3
  end as age_bucket,
  coalesce(src.source_count, 0)::integer as source_count
from public.roblox_decal_ids rd
left join (
  select asset_id, count(*) as source_count
  from public.roblox_decal_id_sources
  group by asset_id
) src on src.asset_id = rd.asset_id
where rd.status = 'active';

create or replace view public.roblox_decal_categories_view
with (security_invoker = true) as
select
  category.slug,
  count(*)::integer as item_count,
  max(rd.verified_at) as latest_verified_at,
  max(rd.curated_score) as top_curated_score
from public.roblox_decal_ids rd
cross join lateral unnest(rd.categories) as category(slug)
where
  rd.status = 'active'
  and rd.thumbnail_state = 'Completed'
  and rd.thumbnail_url is not null
group by category.slug;

grant all on table public.roblox_decal_ids_ranked_view to anon;
grant all on table public.roblox_decal_ids_ranked_view to authenticated;
grant all on table public.roblox_decal_ids_ranked_view to service_role;

grant all on table public.roblox_decal_categories_view to anon;
grant all on table public.roblox_decal_categories_view to authenticated;
grant all on table public.roblox_decal_categories_view to service_role;
