-- Make the Roblox item catalog queue, enrichment, and stats workers truthful and concurrency-safe.

alter table public.roblox_catalog_items
  add column if not exists roblox_item_id bigint,
  add column if not exists catalog_item_key text,
  add column if not exists catalog_status text not null default 'unknown',
  add column if not exists catalog_status_checked_at timestamptz,
  add column if not exists catalog_status_failure_count integer not null default 0,
  add column if not exists last_metadata_verified_at timestamptz,
  add column if not exists last_thumbnail_verified_at timestamptz,
  add column if not exists item_stats_tier_reason text,
  add column if not exists item_stats_tier_updated_at timestamptz;

-- The two data-only backfills below must not enqueue tens of thousands of
-- per-row cache revalidations. Trigger state is transactional, so a failed
-- migration restores the original state automatically.
do $$
declare trigger_name text;
begin
  foreach trigger_name in array array[
    'trg_enqueue_revalidation_avatar_catalog_items',
    'trg_enqueue_revalidation_free_items_catalog',
    'trg_enqueue_revalidation_stats_items_catalog_items',
    'trg_roblox_catalog_items_updated_at'
  ] loop
    if exists (
      select 1 from pg_trigger
      where tgrelid = 'public.roblox_catalog_items'::regclass
        and tgname = trigger_name
        and not tgisinternal
    ) then
      execute format('alter table public.roblox_catalog_items disable trigger %I', trigger_name);
    end if;
  end loop;
end;
$$;

update public.roblox_catalog_items
set item_stats_tier = case
  when item_stats_tier = 'TRADE' then 'HOT'
  when item_stats_tier = 'BROKEN_MEDIA' then 'NEW'
  when item_stats_tier = 'STALE' then 'COLD'
  else item_stats_tier
end
where item_stats_tier in ('TRADE', 'BROKEN_MEDIA', 'STALE');

alter table public.roblox_catalog_items
  drop constraint if exists roblox_catalog_items_item_stats_tier_check;

alter table public.roblox_catalog_items
  add constraint roblox_catalog_items_item_stats_tier_check
  check (item_stats_tier in ('NEW', 'HOT', 'WARM', 'COLD'));

update public.roblox_catalog_items
set
  roblox_item_id = case when item_type = 'Bundle' then abs(asset_id) else asset_id end,
  catalog_item_key = case
    when item_type = 'Bundle' then 'Bundle:' || abs(asset_id)::text
    else 'Asset:' || asset_id::text
  end
where roblox_item_id is null
   or catalog_item_key is null;

alter table public.roblox_catalog_items
  alter column roblox_item_id set not null,
  alter column catalog_item_key set not null;

alter table public.roblox_catalog_items
  drop constraint if exists roblox_catalog_items_catalog_status_check;

alter table public.roblox_catalog_items
  add constraint roblox_catalog_items_catalog_status_check
  check (catalog_status in ('unknown', 'active', 'unavailable', 'private', 'deleted'));

do $$
declare trigger_name text;
begin
  foreach trigger_name in array array[
    'trg_enqueue_revalidation_avatar_catalog_items',
    'trg_enqueue_revalidation_free_items_catalog',
    'trg_enqueue_revalidation_stats_items_catalog_items',
    'trg_roblox_catalog_items_updated_at'
  ] loop
    if exists (
      select 1 from pg_trigger
      where tgrelid = 'public.roblox_catalog_items'::regclass
        and tgname = trigger_name
        and not tgisinternal
    ) then
      execute format('alter table public.roblox_catalog_items enable trigger %I', trigger_name);
    end if;
  end loop;
end;
$$;

create or replace function public.set_roblox_catalog_item_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.item_type := case when new.item_type = 'Bundle' then 'Bundle' else 'Asset' end;
  new.roblox_item_id := case when new.item_type = 'Bundle' then abs(new.asset_id) else new.asset_id end;
  new.catalog_item_key := new.item_type || ':' || new.roblox_item_id::text;
  return new;
end;
$$;

drop trigger if exists trg_roblox_catalog_item_identity on public.roblox_catalog_items;
create trigger trg_roblox_catalog_item_identity
before insert or update of asset_id, item_type
on public.roblox_catalog_items
for each row execute function public.set_roblox_catalog_item_identity();

-- New collectors store bundles under negative internal IDs so Asset and Bundle IDs
-- cannot collide. Legacy positive-ID bundle rows are intentionally left untouched;
-- catalog_item_key makes them auditable without rewriting or deleting production data.
create index if not exists idx_roblox_catalog_items_catalog_key
  on public.roblox_catalog_items (catalog_item_key, asset_id);

create index if not exists idx_roblox_catalog_items_metadata_freshness
  on public.roblox_catalog_items (last_metadata_verified_at asc nulls first, asset_id)
  where is_deleted = false;

create index if not exists idx_roblox_catalog_items_thumbnail_freshness
  on public.roblox_catalog_items (last_thumbnail_verified_at asc nulls first, asset_id)
  where is_deleted = false;

alter table public.roblox_catalog_refresh_queue
  add column if not exists status text not null default 'pending',
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists lease_until timestamptz,
  add column if not exists last_success_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists last_error_kind text,
  add column if not exists refresh_reason text not null default 'discovery';

update public.roblox_catalog_refresh_queue
set status = 'pending'
where status is null
   or status not in ('pending', 'processing', 'retry', 'dead');

alter table public.roblox_catalog_refresh_queue
  drop constraint if exists roblox_catalog_refresh_queue_status_check;

alter table public.roblox_catalog_refresh_queue
  add constraint roblox_catalog_refresh_queue_status_check
  check (status in ('pending', 'processing', 'retry', 'dead'));

drop index if exists public.idx_roblox_catalog_refresh_queue_next_run_at;
drop index if exists public.idx_roblox_catalog_refresh_queue_priority;

create index if not exists idx_roblox_catalog_refresh_queue_ready
  on public.roblox_catalog_refresh_queue (
    next_run_at,
    (case priority
      when 'critical' then 0
      when 'new' then 1
      when 'high' then 2
      when 'normal' then 3
      else 4
    end),
    asset_id
  )
  where status in ('pending', 'retry');

create index if not exists idx_roblox_catalog_refresh_queue_lease
  on public.roblox_catalog_refresh_queue (lease_until, asset_id)
  where status = 'processing';

create or replace function public.upsert_roblox_catalog_discovery_items(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
begin
  insert into public.roblox_catalog_items (
    asset_id, item_type, asset_type_id, category, subcategory, name, description,
    price_robux, price_status, lowest_price_robux, lowest_resale_price_robux,
    is_for_sale, is_limited, is_limited_unique, remaining,
    creator_id, creator_target_id, creator_name, creator_type, creator_has_verified_badge,
    product_id, collectible_item_id, favorite_count, has_resellers,
    total_quantity, units_available_for_consumption, quantity_limit_per_user,
    sale_location_type, off_sale_deadline, item_status, item_restrictions, bundled_items,
    first_seen_at, last_seen_at, is_deleted, raw_catalog_json,
    catalog_status, catalog_status_checked_at
  )
  select
    row.asset_id,
    case when row.item_type = 'Bundle' then 'Bundle' else 'Asset' end,
    row.asset_type_id, row.category, row.subcategory, row.name, row.description,
    row.price_robux, row.price_status, row.lowest_price_robux, row.lowest_resale_price_robux,
    row.is_for_sale, row.is_limited, row.is_limited_unique, row.remaining,
    row.creator_id, row.creator_target_id, row.creator_name, row.creator_type, row.creator_has_verified_badge,
    row.product_id, row.collectible_item_id, row.favorite_count, row.has_resellers,
    row.total_quantity, row.units_available_for_consumption, row.quantity_limit_per_user,
    row.sale_location_type, row.off_sale_deadline, row.item_status, row.item_restrictions, row.bundled_items,
    coalesce(row.first_seen_at, now()), coalesce(row.last_seen_at, now()), false, coalesce(row.raw_catalog_json, '{}'::jsonb),
    'active', coalesce(row.last_seen_at, now())
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as row (
    asset_id bigint,
    item_type text,
    asset_type_id integer,
    category text,
    subcategory text,
    name text,
    description text,
    price_robux bigint,
    price_status text,
    lowest_price_robux bigint,
    lowest_resale_price_robux bigint,
    is_for_sale boolean,
    is_limited boolean,
    is_limited_unique boolean,
    remaining bigint,
    creator_id bigint,
    creator_target_id bigint,
    creator_name text,
    creator_type text,
    creator_has_verified_badge boolean,
    product_id bigint,
    collectible_item_id text,
    favorite_count bigint,
    has_resellers boolean,
    total_quantity bigint,
    units_available_for_consumption bigint,
    quantity_limit_per_user bigint,
    sale_location_type text,
    off_sale_deadline timestamptz,
    item_status jsonb,
    item_restrictions jsonb,
    bundled_items jsonb,
    first_seen_at timestamptz,
    last_seen_at timestamptz,
    raw_catalog_json jsonb
  )
  where row.asset_id is not null
  on conflict (asset_id) do update set
    item_type = excluded.item_type,
    asset_type_id = coalesce(excluded.asset_type_id, public.roblox_catalog_items.asset_type_id),
    category = coalesce(excluded.category, public.roblox_catalog_items.category),
    subcategory = coalesce(excluded.subcategory, public.roblox_catalog_items.subcategory),
    name = coalesce(excluded.name, public.roblox_catalog_items.name),
    description = coalesce(excluded.description, public.roblox_catalog_items.description),
    price_robux = coalesce(excluded.price_robux, public.roblox_catalog_items.price_robux),
    price_status = coalesce(excluded.price_status, public.roblox_catalog_items.price_status),
    lowest_price_robux = coalesce(excluded.lowest_price_robux, public.roblox_catalog_items.lowest_price_robux),
    lowest_resale_price_robux = coalesce(excluded.lowest_resale_price_robux, public.roblox_catalog_items.lowest_resale_price_robux),
    is_for_sale = coalesce(excluded.is_for_sale, public.roblox_catalog_items.is_for_sale),
    is_limited = coalesce(excluded.is_limited, public.roblox_catalog_items.is_limited),
    is_limited_unique = coalesce(excluded.is_limited_unique, public.roblox_catalog_items.is_limited_unique),
    remaining = coalesce(excluded.remaining, public.roblox_catalog_items.remaining),
    creator_id = coalesce(excluded.creator_id, public.roblox_catalog_items.creator_id),
    creator_target_id = coalesce(excluded.creator_target_id, public.roblox_catalog_items.creator_target_id),
    creator_name = coalesce(excluded.creator_name, public.roblox_catalog_items.creator_name),
    creator_type = coalesce(excluded.creator_type, public.roblox_catalog_items.creator_type),
    creator_has_verified_badge = coalesce(excluded.creator_has_verified_badge, public.roblox_catalog_items.creator_has_verified_badge),
    product_id = coalesce(excluded.product_id, public.roblox_catalog_items.product_id),
    collectible_item_id = coalesce(excluded.collectible_item_id, public.roblox_catalog_items.collectible_item_id),
    favorite_count = coalesce(excluded.favorite_count, public.roblox_catalog_items.favorite_count),
    has_resellers = coalesce(excluded.has_resellers, public.roblox_catalog_items.has_resellers),
    total_quantity = coalesce(excluded.total_quantity, public.roblox_catalog_items.total_quantity),
    units_available_for_consumption = coalesce(excluded.units_available_for_consumption, public.roblox_catalog_items.units_available_for_consumption),
    quantity_limit_per_user = coalesce(excluded.quantity_limit_per_user, public.roblox_catalog_items.quantity_limit_per_user),
    sale_location_type = coalesce(excluded.sale_location_type, public.roblox_catalog_items.sale_location_type),
    off_sale_deadline = coalesce(excluded.off_sale_deadline, public.roblox_catalog_items.off_sale_deadline),
    item_status = coalesce(excluded.item_status, public.roblox_catalog_items.item_status),
    item_restrictions = coalesce(excluded.item_restrictions, public.roblox_catalog_items.item_restrictions),
    bundled_items = coalesce(excluded.bundled_items, public.roblox_catalog_items.bundled_items),
    last_seen_at = greatest(excluded.last_seen_at, public.roblox_catalog_items.last_seen_at),
    is_deleted = false,
    raw_catalog_json = coalesce(public.roblox_catalog_items.raw_catalog_json, '{}'::jsonb) || coalesce(excluded.raw_catalog_json, '{}'::jsonb),
    catalog_status = 'active',
    catalog_status_checked_at = greatest(excluded.catalog_status_checked_at, public.roblox_catalog_items.catalog_status_checked_at);

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.enqueue_roblox_catalog_refresh(
  p_asset_ids bigint[],
  p_priority text default 'new',
  p_reason text default 'discovery',
  p_next_run_at timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
begin
  insert into public.roblox_catalog_refresh_queue (
    asset_id,
    priority,
    refresh_reason,
    status,
    next_run_at,
    attempts,
    last_error,
    last_error_code,
    last_error_kind,
    locked_at,
    locked_by,
    lease_until
  )
  select
    item.asset_id,
    coalesce(nullif(p_priority, ''), 'new'),
    coalesce(nullif(p_reason, ''), 'discovery'),
    'pending',
    coalesce(p_next_run_at, now()),
    0,
    null,
    null,
    null,
    null,
    null,
    null
  from public.roblox_catalog_items item
  where item.asset_id = any(coalesce(p_asset_ids, '{}'::bigint[]))
  on conflict (asset_id) do update set
    priority = case
      when excluded.priority = 'critical' then excluded.priority
      when excluded.priority = 'new' and public.roblox_catalog_refresh_queue.priority not in ('critical') then excluded.priority
      when excluded.priority = 'high' and public.roblox_catalog_refresh_queue.priority not in ('critical', 'new') then excluded.priority
      else public.roblox_catalog_refresh_queue.priority
    end,
    refresh_reason = excluded.refresh_reason,
    status = case
      when public.roblox_catalog_refresh_queue.status = 'processing'
        and public.roblox_catalog_refresh_queue.lease_until > now()
        then public.roblox_catalog_refresh_queue.status
      else 'pending'
    end,
    next_run_at = least(public.roblox_catalog_refresh_queue.next_run_at, excluded.next_run_at),
    attempts = case
      when public.roblox_catalog_refresh_queue.status = 'dead' then 0
      else public.roblox_catalog_refresh_queue.attempts
    end,
    last_error = case when public.roblox_catalog_refresh_queue.status = 'dead' then null else public.roblox_catalog_refresh_queue.last_error end,
    last_error_code = case when public.roblox_catalog_refresh_queue.status = 'dead' then null else public.roblox_catalog_refresh_queue.last_error_code end,
    last_error_kind = case when public.roblox_catalog_refresh_queue.status = 'dead' then null else public.roblox_catalog_refresh_queue.last_error_kind end;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.claim_roblox_catalog_refresh_queue(
  p_worker_id text,
  p_limit integer default 100,
  p_lease_minutes integer default 30
)
returns table (
  asset_id bigint,
  priority text,
  attempts integer,
  next_run_at timestamptz,
  refresh_reason text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select queue.asset_id
    from public.roblox_catalog_refresh_queue queue
    where (
        queue.status in ('pending', 'retry')
        and queue.next_run_at <= now()
      )
      or (
        queue.status = 'processing'
        and queue.lease_until <= now()
      )
    order by
      queue.next_run_at,
      case queue.priority
        when 'critical' then 0
        when 'new' then 1
        when 'high' then 2
        when 'normal' then 3
        else 4
      end,
      queue.asset_id
    limit greatest(1, least(coalesce(p_limit, 100), 1000))
    for update skip locked
  ), claimed as (
    update public.roblox_catalog_refresh_queue queue
    set
      status = 'processing',
      locked_at = now(),
      locked_by = coalesce(nullif(p_worker_id, ''), 'catalog-enrichment'),
      lease_until = now() + make_interval(mins => greatest(1, coalesce(p_lease_minutes, 30))),
      last_attempt_at = now(),
      attempts = queue.attempts + 1
    from candidates
    where queue.asset_id = candidates.asset_id
    returning queue.asset_id, queue.priority, queue.attempts, queue.next_run_at, queue.refresh_reason
  )
  select claimed.asset_id, claimed.priority, claimed.attempts, claimed.next_run_at, claimed.refresh_reason
  from claimed;
end;
$$;

create or replace function public.finish_roblox_catalog_refresh(
  p_asset_id bigint,
  p_worker_id text,
  p_status text,
  p_next_run_at timestamptz,
  p_error text default null,
  p_error_code text default null,
  p_error_kind text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
  normalized_status text := case
    when p_status in ('pending', 'retry', 'dead') then p_status
    else 'pending'
  end;
begin
  update public.roblox_catalog_refresh_queue
  set
    status = normalized_status,
    next_run_at = coalesce(p_next_run_at, now()),
    attempts = case when normalized_status = 'pending' and p_error is null then 0 else attempts end,
    last_success_at = case when normalized_status = 'pending' and p_error is null then now() else last_success_at end,
    last_error = p_error,
    last_error_code = p_error_code,
    last_error_kind = p_error_kind,
    locked_at = null,
    locked_by = null,
    lease_until = null
  where asset_id = p_asset_id
    and locked_by = coalesce(nullif(p_worker_id, ''), 'catalog-enrichment');

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

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
      and item.catalog_status not in ('deleted', 'private')
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

create or replace function public.release_roblox_item_stats_rows(
  p_worker_id text,
  p_asset_ids bigint[],
  p_error text default null,
  p_next_run_at timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
begin
  update public.roblox_catalog_items
  set
    item_stats_refresh_locked_at = null,
    item_stats_refresh_locked_by = null,
    last_item_stats_refresh_error = p_error,
    next_item_stats_refresh_at = coalesce(p_next_run_at, next_item_stats_refresh_at)
  where asset_id = any(coalesce(p_asset_ids, '{}'::bigint[]))
    and item_stats_refresh_locked_by = coalesce(nullif(p_worker_id, ''), 'item-stats');

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.get_roblox_item_pipeline_health()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'generated_at', now(),
    'catalog', jsonb_build_object(
      'active_total', (select count(*) from public.roblox_catalog_items where is_deleted = false),
      'discovered_24h', (select count(*) from public.roblox_catalog_items where is_deleted = false and first_seen_at >= now() - interval '24 hours'),
      'metadata_never_verified', (select count(*) from public.roblox_catalog_items where is_deleted = false and last_metadata_verified_at is null),
      'metadata_stale_7d', (select count(*) from public.roblox_catalog_items where is_deleted = false and (last_metadata_verified_at is null or last_metadata_verified_at < now() - interval '7 days')),
      'thumbnail_never_verified', (select count(*) from public.roblox_catalog_items where is_deleted = false and last_thumbnail_verified_at is null),
      'stats_never_refreshed', (select count(*) from public.roblox_catalog_items where is_deleted = false and last_item_stats_refreshed_at is null),
      'stats_stale_24h', (select count(*) from public.roblox_catalog_items where is_deleted = false and (last_item_stats_refreshed_at is null or last_item_stats_refreshed_at < now() - interval '24 hours')),
      'stats_stale_7d', (select count(*) from public.roblox_catalog_items where is_deleted = false and (last_item_stats_refreshed_at is null or last_item_stats_refreshed_at < now() - interval '7 days')),
      'broken_media', (select count(*) from public.roblox_catalog_items where is_deleted = false and thumbnail_http_status >= 400),
      'duplicate_canonical_keys', (select count(*) from (select catalog_item_key from public.roblox_catalog_items group by catalog_item_key having count(*) > 1) duplicates),
      'tiers', coalesce((select jsonb_object_agg(item_stats_tier, item_count) from (select item_stats_tier, count(*) item_count from public.roblox_catalog_items where is_deleted = false group by item_stats_tier) tier_counts), '{}'::jsonb),
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

-- Rebuild the public read index with one scan per source table. The previous
-- implementation performed two lateral hourly-history probes for every item;
-- that became slower than the API timeout as the catalog grew. Daily rollups
-- are the durable 24h/7d baseline and make this rebuild predictable.
create or replace function public.refresh_stats_item_current_indexes()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
set statement_timeout = '120s'
as $$
declare
  refreshed_at timestamptz := now();
  item_count integer := 0;
  refreshed_count integer := 0;
  mover_count integer := 0;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('refresh_stats_item_current_indexes', 0)) then
    raise exception 'stats item index rebuild is already running' using errcode = '55P03';
  end if;

  delete from public.stats_item_price_movers_current_index where true;
  delete from public.stats_item_current_index index_row
  where not exists (
    select 1 from public.roblox_catalog_items item
    where item.asset_id = index_row.asset_id and item.is_deleted = false
  );

  create temporary table changed_stats_item_index
    (like public.stats_item_current_index including defaults)
    on commit drop;

  with preferred_images as (
    select distinct on (image.asset_id)
      image.asset_id,
      image.image_url as thumbnail_url,
      image.state as thumbnail_state,
      image.updated_at as thumbnail_updated_at
    from public.roblox_catalog_item_images image
    where image.image_url is not null
    order by
      image.asset_id,
      case when image.size = '420x420' then 0 else 1 end,
      case when image.format = 'Png' then 0 else 1 end,
      image.updated_at desc
  ), source_items_base as (
    select
      item.*,
      image.thumbnail_url,
      image.thumbnail_state,
      image.thumbnail_updated_at
    from public.roblox_catalog_items item
    left join preferred_images image on image.asset_id = item.asset_id
    where item.is_deleted = false
      and item.name is not null
      and item.category is not null
      and item.subcategory is not null
      and item.favorite_count is not null
  ), source_items as (
    select distinct on (catalog_item_key) *
    from source_items_base
    order by
      catalog_item_key,
      favorite_count desc nulls last,
      last_item_stats_refreshed_at desc nulls last,
      case when item_type = 'Bundle' and asset_id < 0 then 0 else 1 end,
      asset_id
  ), enriched as (
    select
      item.*,
      day_1.price_close as baseline_price_24h,
      day_1.resale_close as baseline_resale_24h,
      day_1.favorites_close as baseline_favorites_24h,
      day_7.price_close as baseline_price_7d,
      day_7.resale_close as baseline_resale_7d,
      day_7.favorites_close as baseline_favorites_7d,
      day_1.updated_at as baseline_updated_at_24h,
      day_7.updated_at as baseline_updated_at_7d
    from source_items item
    left join public.roblox_catalog_item_stats_daily day_1
      on day_1.asset_id = item.asset_id and day_1.stat_date = current_date - 1
    left join public.roblox_catalog_item_stats_daily day_7
      on day_7.asset_id = item.asset_id and day_7.stat_date = current_date - 7
  ), ranked as (
    select
      enriched.*,
      row_number() over (order by favorite_count desc nulls last, asset_id)::integer as global_favorites_rank,
      case when has_resellers = true and lowest_resale_price_robux > 0 then
        row_number() over (
          partition by (has_resellers = true and lowest_resale_price_robux > 0)
          order by lowest_resale_price_robux asc nulls last, favorite_count desc nulls last, asset_id
        )::integer
      end as global_resale_rank,
      row_number() over (partition by category order by favorite_count desc nulls last, asset_id)::integer as category_favorites_rank,
      case when has_resellers = true and lowest_resale_price_robux > 0 then
        row_number() over (
          partition by category, (has_resellers = true and lowest_resale_price_robux > 0)
          order by lowest_resale_price_robux asc nulls last, favorite_count desc nulls last, asset_id
        )::integer
      end as category_resale_rank
    from enriched
  ), changed as materialized (
    select ranked.*
    from ranked
    left join public.stats_item_current_index index_row on index_row.asset_id = ranked.asset_id
    where ranked.updated_at > coalesce(index_row.indexed_at, '-infinity'::timestamptz)
      or ranked.baseline_updated_at_24h > coalesce(index_row.indexed_at, '-infinity'::timestamptz)
      or ranked.baseline_updated_at_7d > coalesce(index_row.indexed_at, '-infinity'::timestamptz)
      or index_row.asset_id is null
    order by index_row.indexed_at asc nulls first, ranked.updated_at asc, ranked.asset_id
    limit 2000
  )
  insert into changed_stats_item_index
  select (
    jsonb_populate_record(
      null::public.stats_item_current_index,
      to_jsonb(changed) || jsonb_build_object(
        'roblox_url', public.stats_item_roblox_url(asset_id, item_type, raw_catalog_json),
        'price_change_24h', case when price_robux is not null and baseline_price_24h is not null then price_robux - baseline_price_24h end,
        'price_change_24h_percent', public.stats_item_percent_delta(price_robux::numeric, baseline_price_24h::numeric),
        'resale_change_24h', case when lowest_resale_price_robux is not null and baseline_resale_24h is not null then lowest_resale_price_robux - baseline_resale_24h end,
        'resale_change_24h_percent', public.stats_item_percent_delta(lowest_resale_price_robux::numeric, baseline_resale_24h::numeric),
        'favorite_change_24h', case when favorite_count is not null and baseline_favorites_24h is not null then favorite_count - baseline_favorites_24h end,
        'favorite_change_24h_percent', public.stats_item_percent_delta(favorite_count::numeric, baseline_favorites_24h::numeric),
        'price_change_7d', case when price_robux is not null and baseline_price_7d is not null then price_robux - baseline_price_7d end,
        'price_change_7d_percent', public.stats_item_percent_delta(price_robux::numeric, baseline_price_7d::numeric),
        'resale_change_7d', case when lowest_resale_price_robux is not null and baseline_resale_7d is not null then lowest_resale_price_robux - baseline_resale_7d end,
        'resale_change_7d_percent', public.stats_item_percent_delta(lowest_resale_price_robux::numeric, baseline_resale_7d::numeric),
        'favorite_change_7d', case when favorite_count is not null and baseline_favorites_7d is not null then favorite_count - baseline_favorites_7d end,
        'favorite_change_7d_percent', public.stats_item_percent_delta(favorite_count::numeric, baseline_favorites_7d::numeric),
        'indexed_at', refreshed_at
      )
    )
  ).*
  from changed;

  delete from public.stats_item_current_index index_row
  using changed_stats_item_index changed
  where index_row.asset_id = changed.asset_id;

  insert into public.stats_item_current_index
  select * from changed_stats_item_index;

  get diagnostics refreshed_count = row_count;
  select count(*) into item_count from public.stats_item_current_index;

  insert into public.stats_item_price_movers_current_index (
    asset_id, name, item_type, category, subcategory, creator_name, thumbnail_url,
    price_robux, lowest_resale_price_robux, resale_change_24h, resale_change_24h_percent,
    price_change_24h, price_change_24h_percent, favorite_change_24h,
    mover_score, rank_value, indexed_at
  )
  select
    asset_id, name, item_type, category, subcategory, creator_name, thumbnail_url,
    price_robux, lowest_resale_price_robux, resale_change_24h, resale_change_24h_percent,
    price_change_24h, price_change_24h_percent, favorite_change_24h,
    coalesce(abs(resale_change_24h_percent), 0) * 10
      + coalesce(abs(price_change_24h_percent), 0) * 5
      + least(coalesce(abs(favorite_change_24h), 0), 100000)::numeric / 1000 as mover_score,
    row_number() over (
      order by (
        coalesce(abs(resale_change_24h_percent), 0) * 10
        + coalesce(abs(price_change_24h_percent), 0) * 5
        + least(coalesce(abs(favorite_change_24h), 0), 100000)::numeric / 1000
      ) desc, asset_id
    )::integer,
    refreshed_at
  from public.stats_item_current_index
  where coalesce(abs(resale_change_24h_percent), abs(price_change_24h_percent), abs(favorite_change_24h)) is not null
  order by mover_score desc nulls last, asset_id
  limit 500;

  get diagnostics mover_count = row_count;
  return jsonb_build_object('items', item_count, 'refreshed_items', refreshed_count, 'price_movers', mover_count, 'indexed_at', refreshed_at);
end;
$$;

revoke all on function public.enqueue_roblox_catalog_refresh(bigint[], text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.upsert_roblox_catalog_discovery_items(jsonb) from public, anon, authenticated;
revoke all on function public.claim_roblox_catalog_refresh_queue(text, integer, integer) from public, anon, authenticated;
revoke all on function public.finish_roblox_catalog_refresh(bigint, text, text, timestamptz, text, text, text) from public, anon, authenticated;
revoke all on function public.claim_roblox_item_stats_rows(text, text, integer, integer, bigint[]) from public, anon, authenticated;
revoke all on function public.release_roblox_item_stats_rows(text, bigint[], text, timestamptz) from public, anon, authenticated;
revoke all on function public.get_roblox_item_pipeline_health() from public, anon, authenticated;
revoke all on function public.refresh_stats_item_current_indexes() from public, anon, authenticated;

grant execute on function public.enqueue_roblox_catalog_refresh(bigint[], text, text, timestamptz) to service_role;
grant execute on function public.upsert_roblox_catalog_discovery_items(jsonb) to service_role;
grant execute on function public.claim_roblox_catalog_refresh_queue(text, integer, integer) to service_role;
grant execute on function public.finish_roblox_catalog_refresh(bigint, text, text, timestamptz, text, text, text) to service_role;
grant execute on function public.claim_roblox_item_stats_rows(text, text, integer, integer, bigint[]) to service_role;
grant execute on function public.release_roblox_item_stats_rows(text, bigint[], text, timestamptz) to service_role;
grant execute on function public.get_roblox_item_pipeline_health() to service_role;
grant execute on function public.refresh_stats_item_current_indexes() to service_role;

comment on column public.roblox_catalog_items.catalog_item_key is
  'Canonical Roblox marketplace identity, including item type, such as Asset:123 or Bundle:123.';
comment on column public.roblox_catalog_items.last_metadata_verified_at is
  'Last successful authoritative Roblox catalog metadata response for this item.';
comment on column public.roblox_catalog_items.last_thumbnail_verified_at is
  'Last successful Roblox thumbnail API response for this item.';
comment on function public.claim_roblox_catalog_refresh_queue(text, integer, integer) is
  'Atomically claims due catalog enrichment rows with FOR UPDATE SKIP LOCKED.';
comment on function public.get_roblox_item_pipeline_health() is
  'Returns one service-role-only health snapshot for discovery, enrichment, free items, stats, resale, and read indexes.';
