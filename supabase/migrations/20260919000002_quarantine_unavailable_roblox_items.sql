-- Keep repeatedly unavailable marketplace IDs out of high-frequency stats
-- lanes while the enrichment queue continues its lower-frequency recovery
-- checks. Freshness SLAs describe items Roblox can currently return.

create or replace function public.claim_roblox_item_stats_rows(
  p_worker_id text,
  p_tier text default 'HOT',
  p_limit integer default 100,
  p_lease_minutes integer default 45,
  p_asset_ids bigint[] default null
)
returns setof public.roblox_catalog_items
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select item.asset_id
    from public.roblox_catalog_items item
    where item.is_deleted = false
      and item.catalog_status not in ('deleted', 'private', 'unavailable')
      and (
        item.item_stats_refresh_locked_at is null
        or item.item_stats_refresh_locked_at < now() - make_interval(mins => greatest(1, coalesce(p_lease_minutes, 45)))
      )
      and (
        p_asset_ids is not null and item.asset_id = any(p_asset_ids)
        or p_asset_ids is null and (
          coalesce(nullif(upper(p_tier), ''), 'HOT') = 'ALL'
          or item.item_stats_tier = upper(p_tier)
        ) and (
          item.next_item_stats_refresh_at is null
          or item.next_item_stats_refresh_at <= now()
        )
      )
    order by
      item.next_item_stats_refresh_at asc nulls first,
      item.last_item_stats_refreshed_at asc nulls first,
      item.favorite_count desc nulls last,
      item.asset_id
    limit greatest(1, least(coalesce(p_limit, 100), 2000))
    for update skip locked
  ), claimed as (
    update public.roblox_catalog_items item
    set
      item_stats_refresh_locked_at = now(),
      item_stats_refresh_locked_by = coalesce(nullif(p_worker_id, ''), 'item-stats'),
      item_stats_refresh_attempt_count = item.item_stats_refresh_attempt_count + 1,
      last_item_stats_refresh_error = null
    from candidates
    where item.asset_id = candidates.asset_id
    returning item.*
  )
  select * from claimed;
end;
$$;

create or replace function public.get_roblox_item_pipeline_health()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select *
    from public.roblox_catalog_items
    where is_deleted = false
      and catalog_status not in ('deleted', 'private', 'unavailable')
  )
  select jsonb_build_object(
    'generated_at', now(),
    'catalog', jsonb_build_object(
      'active_total', (select count(*) from eligible),
      'discovered_24h', (select count(*) from eligible where first_seen_at >= now() - interval '24 hours'),
      'metadata_never_verified', (select count(*) from eligible where last_metadata_verified_at is null),
      'metadata_stale_7d', (select count(*) from eligible where last_metadata_verified_at is null or last_metadata_verified_at < now() - interval '7 days'),
      'thumbnail_never_verified', (select count(*) from eligible where last_thumbnail_verified_at is null),
      'stats_never_refreshed', (select count(*) from eligible where last_item_stats_refreshed_at is null),
      'stats_stale_24h', (select count(*) from eligible where last_item_stats_refreshed_at is null or last_item_stats_refreshed_at < now() - interval '24 hours'),
      'stats_stale_7d', (select count(*) from eligible where last_item_stats_refreshed_at is null or last_item_stats_refreshed_at < now() - interval '7 days'),
      'broken_media', (select count(*) from eligible where thumbnail_http_status >= 400),
      'duplicate_canonical_keys', (select count(*) from (select catalog_item_key from public.roblox_catalog_items group by catalog_item_key having count(*) > 1) duplicates),
      'tiers', coalesce((select jsonb_object_agg(item_stats_tier, item_count) from (select item_stats_tier, count(*) item_count from eligible group by item_stats_tier) tier_counts), '{}'::jsonb),
      'statuses', coalesce((select jsonb_object_agg(catalog_status, item_count) from (select catalog_status, count(*) item_count from public.roblox_catalog_items group by catalog_status) status_counts), '{}'::jsonb)
    ),
    'queue', jsonb_build_object(
      'total', (select count(*) from public.roblox_catalog_refresh_queue),
      'due', (select count(*) from public.roblox_catalog_refresh_queue where status in ('pending', 'retry') and next_run_at <= now()),
      'pending', (select count(*) from public.roblox_catalog_refresh_queue where status = 'pending'),
      'retry', (select count(*) from public.roblox_catalog_refresh_queue where status = 'retry'),
      'processing', (select count(*) from public.roblox_catalog_refresh_queue where status = 'processing'),
      'expired_leases', (select count(*) from public.roblox_catalog_refresh_queue where status = 'processing' and lease_until < now()),
      'dead', (select count(*) from public.roblox_catalog_refresh_queue where status = 'dead'),
      'oldest_due_at', (select min(next_run_at) from public.roblox_catalog_refresh_queue where status in ('pending', 'retry') and next_run_at <= now())
    ),
    'free_items', jsonb_build_object(
      'direct', (select count(*) from public.roblox_catalog_items where is_deleted = false and free_claimability = 'direct'),
      'verified_24h', (select count(*) from public.roblox_catalog_items where free_verification_source = 'roblox' and free_verified_at >= now() - interval '24 hours'),
      'latest_verified_at', (select max(free_verified_at) from public.roblox_catalog_items where free_verification_source = 'roblox')
    ),
    'stats', jsonb_build_object(
      'index_total', (select count(*) from public.stats_item_current_index),
      'index_latest_at', (select max(indexed_at) from public.stats_item_current_index),
      'hourly_total', (select count(*) from public.roblox_catalog_item_stats_hourly),
      'hourly_24h', (select count(*) from public.roblox_catalog_item_stats_hourly where hour_start >= now() - interval '24 hours'),
      'hourly_latest_at', (select max(hour_start) from public.roblox_catalog_item_stats_hourly),
      'daily_total', (select count(*) from public.roblox_catalog_item_stats_daily),
      'daily_latest_date', (select max(stat_date) from public.roblox_catalog_item_stats_daily),
      'resale_total', (select count(*) from public.roblox_catalog_item_resale_points),
      'resale_latest_date', (select max(point_date) from public.roblox_catalog_item_resale_points)
    ),
    'latest_discovery', (select to_jsonb(run_row) from (select run_id, strategy, category, status, started_at, finished_at, notes from public.roblox_catalog_discovery_runs order by started_at desc limit 1) run_row),
    'recent_jobs', coalesce((select jsonb_agg(to_jsonb(job_row) order by started_at desc) from (select job_name, status, started_at, finished_at, rows_claimed, rows_succeeded, rows_failed, error from public.stats_job_runs where job_name like 'stats_items_%' or job_name like 'catalog_%' order by started_at desc limit 30) job_row), '[]'::jsonb)
  );
$$;

revoke all on function public.claim_roblox_item_stats_rows(text, text, integer, integer, bigint[]) from public;
revoke all on function public.get_roblox_item_pipeline_health() from public;
grant execute on function public.claim_roblox_item_stats_rows(text, text, integer, integer, bigint[]) to service_role;
grant execute on function public.get_roblox_item_pipeline_health() to service_role;
