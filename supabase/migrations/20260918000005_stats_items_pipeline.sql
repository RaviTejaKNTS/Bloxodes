-- Stats-grade Roblox item pipeline support for /stats/items and /stats/items/[assetId].

alter table public.roblox_catalog_items
  add column if not exists item_stats_tier text not null default 'NEW',
  add column if not exists next_item_stats_refresh_at timestamptz,
  add column if not exists item_stats_refresh_locked_at timestamptz,
  add column if not exists item_stats_refresh_locked_by text,
  add column if not exists item_stats_refresh_attempt_count integer not null default 0,
  add column if not exists last_item_stats_refresh_error text,
  add column if not exists last_item_stats_refreshed_at timestamptz,
  add column if not exists last_resale_data_fetched_at timestamptz,
  add column if not exists last_thumbnail_health_checked_at timestamptz,
  add column if not exists thumbnail_http_status integer,
  add column if not exists thumbnail_last_error text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'roblox_catalog_items_item_stats_tier_check'
      and conrelid = 'public.roblox_catalog_items'::regclass
  ) then
    alter table public.roblox_catalog_items
      add constraint roblox_catalog_items_item_stats_tier_check
      check (item_stats_tier in ('NEW', 'HOT', 'WARM', 'COLD', 'TRADE', 'STALE', 'BROKEN_MEDIA'));
  end if;
end;
$$;

create index if not exists idx_roblox_catalog_items_stats_refresh_lease
  on public.roblox_catalog_items (
    item_stats_tier,
    next_item_stats_refresh_at asc nulls first,
    item_stats_refresh_locked_at asc nulls first,
    last_item_stats_refreshed_at asc nulls first,
    asset_id
  )
  where is_deleted = false;

create index if not exists idx_roblox_catalog_items_stats_tier_value
  on public.roblox_catalog_items (
    item_stats_tier,
    favorite_count desc nulls last,
    lowest_resale_price_robux desc nulls last,
    asset_id
  )
  where is_deleted = false;

create index if not exists idx_roblox_catalog_items_resale_candidates
  on public.roblox_catalog_items (
    last_resale_data_fetched_at asc nulls first,
    lowest_resale_price_robux desc nulls last,
    asset_id
  )
  where is_deleted = false
    and (
      has_resellers = true
      or lowest_resale_price_robux > 0
      or collectible_item_id is not null
    );

create table if not exists public.roblox_catalog_item_stats_hourly (
  asset_id bigint not null references public.roblox_catalog_items(asset_id) on delete cascade,
  hour_start timestamptz not null,
  sampled_at timestamptz not null default now(),
  item_type text,
  price_robux bigint,
  lowest_price_robux bigint,
  lowest_resale_price_robux bigint,
  favorite_count bigint,
  is_for_sale boolean,
  has_resellers boolean,
  is_limited boolean,
  is_limited_unique boolean,
  remaining bigint,
  total_quantity bigint,
  units_available_for_consumption bigint,
  quantity_limit_per_user bigint,
  sale_location_type text,
  off_sale_deadline timestamptz,
  collectible_item_id text,
  rap bigint,
  rap_sales integer,
  rap_stock integer,
  thumbnail_state text,
  thumbnail_url text,
  source text not null default 'item_stats_refresh',
  raw_snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (asset_id, hour_start)
);

create index if not exists idx_item_stats_hourly_hour
  on public.roblox_catalog_item_stats_hourly (hour_start desc);

create index if not exists idx_item_stats_hourly_asset_hour
  on public.roblox_catalog_item_stats_hourly (asset_id, hour_start desc);

create index if not exists idx_item_stats_hourly_resale
  on public.roblox_catalog_item_stats_hourly (lowest_resale_price_robux desc nulls last, hour_start desc);

create table if not exists public.roblox_catalog_item_stats_daily (
  asset_id bigint not null references public.roblox_catalog_items(asset_id) on delete cascade,
  stat_date date not null,
  sample_count integer not null default 0,
  price_open bigint,
  price_close bigint,
  price_min bigint,
  price_max bigint,
  resale_open bigint,
  resale_close bigint,
  resale_min bigint,
  resale_max bigint,
  favorites_open bigint,
  favorites_close bigint,
  favorites_delta bigint,
  units_available_min bigint,
  units_available_close bigint,
  last_sampled_at timestamptz,
  finalized boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (asset_id, stat_date)
);

create index if not exists idx_item_stats_daily_date
  on public.roblox_catalog_item_stats_daily (stat_date desc);

create index if not exists idx_item_stats_daily_asset_date
  on public.roblox_catalog_item_stats_daily (asset_id, stat_date desc);

create table if not exists public.roblox_catalog_item_resale_points (
  asset_id bigint not null references public.roblox_catalog_items(asset_id) on delete cascade,
  point_date date not null,
  resale_price_robux bigint,
  resale_volume integer,
  fetched_at timestamptz not null default now(),
  source text not null default 'roblox_resale_data',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (asset_id, point_date)
);

create index if not exists idx_item_resale_points_asset_date
  on public.roblox_catalog_item_resale_points (asset_id, point_date desc);

create index if not exists idx_item_resale_points_date
  on public.roblox_catalog_item_resale_points (point_date desc);

create table if not exists public.stats_item_current_index (
  asset_id bigint primary key references public.roblox_catalog_items(asset_id) on delete cascade,
  item_type text not null,
  asset_type_id integer,
  name text not null,
  description text,
  category text,
  subcategory text,
  creator_id bigint,
  creator_target_id bigint,
  creator_name text,
  creator_type text,
  creator_has_verified_badge boolean,
  price_robux bigint,
  price_status text,
  lowest_price_robux bigint,
  lowest_resale_price_robux bigint,
  is_for_sale boolean,
  has_resellers boolean,
  is_limited boolean,
  is_limited_unique boolean,
  remaining bigint,
  total_quantity bigint,
  units_available_for_consumption bigint,
  quantity_limit_per_user bigint,
  sale_location_type text,
  off_sale_deadline timestamptz,
  collectible_item_id text,
  favorite_count bigint,
  item_stats_tier text,
  first_seen_at timestamptz,
  created_at timestamptz,
  last_seen_at timestamptz,
  last_item_stats_refreshed_at timestamptz,
  last_resale_data_fetched_at timestamptz,
  last_thumbnail_health_checked_at timestamptz,
  thumbnail_http_status integer,
  thumbnail_state text,
  thumbnail_url text,
  thumbnail_updated_at timestamptz,
  roblox_url text,
  baseline_price_24h bigint,
  baseline_resale_24h bigint,
  baseline_favorites_24h bigint,
  price_change_24h bigint,
  price_change_24h_percent numeric,
  resale_change_24h bigint,
  resale_change_24h_percent numeric,
  favorite_change_24h bigint,
  favorite_change_24h_percent numeric,
  baseline_price_7d bigint,
  baseline_resale_7d bigint,
  baseline_favorites_7d bigint,
  price_change_7d bigint,
  price_change_7d_percent numeric,
  resale_change_7d bigint,
  resale_change_7d_percent numeric,
  favorite_change_7d bigint,
  favorite_change_7d_percent numeric,
  global_favorites_rank integer,
  global_resale_rank integer,
  category_favorites_rank integer,
  category_resale_rank integer,
  indexed_at timestamptz not null default now()
);

create index if not exists idx_stats_item_current_favorites
  on public.stats_item_current_index (favorite_count desc nulls last, asset_id asc);

create index if not exists idx_stats_item_current_price_high
  on public.stats_item_current_index (price_robux desc nulls last, favorite_count desc nulls last, asset_id asc);

create index if not exists idx_stats_item_current_price_low
  on public.stats_item_current_index (price_robux asc nulls last, favorite_count desc nulls last, asset_id asc);

create index if not exists idx_stats_item_current_resale_low
  on public.stats_item_current_index (lowest_resale_price_robux asc nulls last, favorite_count desc nulls last, asset_id asc)
  where has_resellers = true and lowest_resale_price_robux > 0;

create index if not exists idx_stats_item_current_seen
  on public.stats_item_current_index (last_seen_at desc nulls last, asset_id asc);

create index if not exists idx_stats_item_current_category
  on public.stats_item_current_index (category, subcategory, favorite_count desc nulls last, asset_id asc);

create index if not exists idx_stats_item_current_creator
  on public.stats_item_current_index (creator_name, favorite_count desc nulls last, asset_id asc);

create index if not exists idx_stats_item_current_tier
  on public.stats_item_current_index (item_stats_tier, last_item_stats_refreshed_at desc nulls last, asset_id asc);

create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_stats_item_current_name_trgm
  on public.stats_item_current_index
  using gin (name extensions.gin_trgm_ops);

create index if not exists idx_stats_item_current_description_trgm
  on public.stats_item_current_index
  using gin (description extensions.gin_trgm_ops);

create index if not exists idx_stats_item_current_creator_name_trgm
  on public.stats_item_current_index
  using gin (creator_name extensions.gin_trgm_ops);

create table if not exists public.stats_item_price_movers_current_index (
  asset_id bigint primary key references public.roblox_catalog_items(asset_id) on delete cascade,
  name text not null,
  item_type text not null,
  category text,
  subcategory text,
  creator_name text,
  thumbnail_url text,
  price_robux bigint,
  lowest_resale_price_robux bigint,
  resale_change_24h bigint,
  resale_change_24h_percent numeric,
  price_change_24h bigint,
  price_change_24h_percent numeric,
  favorite_change_24h bigint,
  mover_score numeric not null default 0,
  rank_value integer not null,
  indexed_at timestamptz not null default now()
);

create index if not exists idx_stats_item_price_movers_rank
  on public.stats_item_price_movers_current_index (rank_value asc);

create index if not exists idx_stats_item_price_movers_score
  on public.stats_item_price_movers_current_index (mover_score desc, asset_id asc);

alter table public.roblox_catalog_item_stats_hourly enable row level security;
alter table public.roblox_catalog_item_stats_daily enable row level security;
alter table public.roblox_catalog_item_resale_points enable row level security;
alter table public.stats_item_current_index enable row level security;
alter table public.stats_item_price_movers_current_index enable row level security;

grant select on table public.roblox_catalog_item_stats_hourly to anon, authenticated, service_role;
grant select on table public.roblox_catalog_item_stats_daily to anon, authenticated, service_role;
grant select on table public.roblox_catalog_item_resale_points to anon, authenticated, service_role;
grant select on table public.stats_item_current_index to anon, authenticated, service_role;
grant select on table public.stats_item_price_movers_current_index to anon, authenticated, service_role;

grant all on table public.roblox_catalog_item_stats_hourly to service_role;
grant all on table public.roblox_catalog_item_stats_daily to service_role;
grant all on table public.roblox_catalog_item_resale_points to service_role;
grant all on table public.stats_item_current_index to service_role;
grant all on table public.stats_item_price_movers_current_index to service_role;

create or replace function public.stats_item_roblox_url(p_asset_id bigint, p_item_type text, p_raw_catalog_json jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(p_raw_catalog_json ->> 'roblox_url', ''),
    case
      when p_item_type = 'Bundle' then 'https://www.roblox.com/bundles/' || abs(p_asset_id)::text
      else 'https://www.roblox.com/catalog/' || p_asset_id::text
    end
  );
$$;

create or replace function public.stats_item_percent_delta(p_current numeric, p_previous numeric)
returns numeric
language sql
immutable
as $$
  select case
    when p_current is null or p_previous is null or p_previous = 0 then null
    else round(((p_current - p_previous) / p_previous) * 100, 2)
  end;
$$;

create or replace function public.refresh_stats_item_current_indexes()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  refreshed_at timestamptz := now();
  item_count integer := 0;
  mover_count integer := 0;
begin
  delete from public.stats_item_price_movers_current_index where true;
  delete from public.stats_item_current_index where true;

  with source_items_base as (
    select
      item.*,
      image.image_url as thumbnail_url,
      image.state as thumbnail_state,
      image.updated_at as thumbnail_updated_at
    from public.roblox_catalog_items item
    left join lateral (
      select i.image_url, i.state, i.updated_at
      from public.roblox_catalog_item_images i
      where i.asset_id = item.asset_id
        and i.image_url is not null
      order by
        case when i.size = '420x420' then 0 else 1 end,
        case when i.format = 'Png' then 0 else 1 end,
        i.updated_at desc
      limit 1
    ) image on true
    where item.is_deleted = false
      and item.name is not null
      and item.category is not null
      and item.subcategory is not null
      and item.favorite_count is not null
  ),
  source_items as (
    select distinct on (
      case
        when item_type = 'Bundle' then 'Bundle:' || abs(asset_id)::text
        else 'Asset:' || asset_id::text
      end
    )
      *
    from source_items_base
    order by
      case
        when item_type = 'Bundle' then 'Bundle:' || abs(asset_id)::text
        else 'Asset:' || asset_id::text
      end,
      favorite_count desc nulls last,
      last_item_stats_refreshed_at desc nulls last,
      case when item_type = 'Bundle' and asset_id < 0 then 0 else 1 end,
      asset_id asc
  ),
  enriched as (
    select
      item.*,
      baseline_24h.price_robux as baseline_price_24h,
      baseline_24h.lowest_resale_price_robux as baseline_resale_24h,
      baseline_24h.favorite_count as baseline_favorites_24h,
      baseline_7d.price_robux as baseline_price_7d,
      baseline_7d.lowest_resale_price_robux as baseline_resale_7d,
      baseline_7d.favorite_count as baseline_favorites_7d
    from source_items item
    left join lateral (
      select h.price_robux, h.lowest_resale_price_robux, h.favorite_count
      from public.roblox_catalog_item_stats_hourly h
      where h.asset_id = item.asset_id
        and h.hour_start between refreshed_at - interval '25 hours 30 minutes' and refreshed_at - interval '22 hours 30 minutes'
      order by abs(extract(epoch from (h.hour_start - (refreshed_at - interval '24 hours'))))
      limit 1
    ) baseline_24h on true
    left join lateral (
      select h.price_robux, h.lowest_resale_price_robux, h.favorite_count
      from public.roblox_catalog_item_stats_hourly h
      where h.asset_id = item.asset_id
        and h.hour_start between refreshed_at - interval '7 days 90 minutes' and refreshed_at - interval '7 days' + interval '90 minutes'
      order by abs(extract(epoch from (h.hour_start - (refreshed_at - interval '7 days'))))
      limit 1
    ) baseline_7d on true
  ),
  ranked as (
    select
      enriched.*,
      row_number() over (order by favorite_count desc nulls last, asset_id asc)::integer as global_favorites_rank,
      case
        when has_resellers = true and lowest_resale_price_robux > 0
          then row_number() over (
            partition by (has_resellers = true and lowest_resale_price_robux > 0)
            order by lowest_resale_price_robux asc nulls last, favorite_count desc nulls last, asset_id asc
          )::integer
        else null
      end as global_resale_rank,
      row_number() over (partition by category order by favorite_count desc nulls last, asset_id asc)::integer as category_favorites_rank,
      case
        when has_resellers = true and lowest_resale_price_robux > 0
          then row_number() over (
            partition by category, (has_resellers = true and lowest_resale_price_robux > 0)
            order by lowest_resale_price_robux asc nulls last, favorite_count desc nulls last, asset_id asc
          )::integer
        else null
      end as category_resale_rank
    from enriched
  )
  insert into public.stats_item_current_index (
    asset_id,
    item_type,
    asset_type_id,
    name,
    description,
    category,
    subcategory,
    creator_id,
    creator_target_id,
    creator_name,
    creator_type,
    creator_has_verified_badge,
    price_robux,
    price_status,
    lowest_price_robux,
    lowest_resale_price_robux,
    is_for_sale,
    has_resellers,
    is_limited,
    is_limited_unique,
    remaining,
    total_quantity,
    units_available_for_consumption,
    quantity_limit_per_user,
    sale_location_type,
    off_sale_deadline,
    collectible_item_id,
    favorite_count,
    item_stats_tier,
    first_seen_at,
    created_at,
    last_seen_at,
    last_item_stats_refreshed_at,
    last_resale_data_fetched_at,
    last_thumbnail_health_checked_at,
    thumbnail_http_status,
    thumbnail_state,
    thumbnail_url,
    thumbnail_updated_at,
    roblox_url,
    baseline_price_24h,
    baseline_resale_24h,
    baseline_favorites_24h,
    price_change_24h,
    price_change_24h_percent,
    resale_change_24h,
    resale_change_24h_percent,
    favorite_change_24h,
    favorite_change_24h_percent,
    baseline_price_7d,
    baseline_resale_7d,
    baseline_favorites_7d,
    price_change_7d,
    price_change_7d_percent,
    resale_change_7d,
    resale_change_7d_percent,
    favorite_change_7d,
    favorite_change_7d_percent,
    global_favorites_rank,
    global_resale_rank,
    category_favorites_rank,
    category_resale_rank,
    indexed_at
  )
  select
    asset_id,
    item_type,
    asset_type_id,
    name,
    description,
    category,
    subcategory,
    creator_id,
    creator_target_id,
    creator_name,
    creator_type,
    creator_has_verified_badge,
    price_robux,
    price_status,
    lowest_price_robux,
    lowest_resale_price_robux,
    is_for_sale,
    has_resellers,
    is_limited,
    is_limited_unique,
    remaining,
    total_quantity,
    units_available_for_consumption,
    quantity_limit_per_user,
    sale_location_type,
    off_sale_deadline,
    collectible_item_id,
    favorite_count,
    item_stats_tier,
    first_seen_at,
    created_at,
    last_seen_at,
    last_item_stats_refreshed_at,
    last_resale_data_fetched_at,
    last_thumbnail_health_checked_at,
    thumbnail_http_status,
    thumbnail_state,
    thumbnail_url,
    thumbnail_updated_at,
    public.stats_item_roblox_url(asset_id, item_type, raw_catalog_json),
    baseline_price_24h,
    baseline_resale_24h,
    baseline_favorites_24h,
    case when price_robux is not null and baseline_price_24h is not null then price_robux - baseline_price_24h else null end,
    public.stats_item_percent_delta(price_robux::numeric, baseline_price_24h::numeric),
    case when lowest_resale_price_robux is not null and baseline_resale_24h is not null then lowest_resale_price_robux - baseline_resale_24h else null end,
    public.stats_item_percent_delta(lowest_resale_price_robux::numeric, baseline_resale_24h::numeric),
    case when favorite_count is not null and baseline_favorites_24h is not null then favorite_count - baseline_favorites_24h else null end,
    public.stats_item_percent_delta(favorite_count::numeric, baseline_favorites_24h::numeric),
    baseline_price_7d,
    baseline_resale_7d,
    baseline_favorites_7d,
    case when price_robux is not null and baseline_price_7d is not null then price_robux - baseline_price_7d else null end,
    public.stats_item_percent_delta(price_robux::numeric, baseline_price_7d::numeric),
    case when lowest_resale_price_robux is not null and baseline_resale_7d is not null then lowest_resale_price_robux - baseline_resale_7d else null end,
    public.stats_item_percent_delta(lowest_resale_price_robux::numeric, baseline_resale_7d::numeric),
    case when favorite_count is not null and baseline_favorites_7d is not null then favorite_count - baseline_favorites_7d else null end,
    public.stats_item_percent_delta(favorite_count::numeric, baseline_favorites_7d::numeric),
    global_favorites_rank,
    global_resale_rank,
    category_favorites_rank,
    category_resale_rank,
    refreshed_at
  from ranked;

  get diagnostics item_count = row_count;

  insert into public.stats_item_price_movers_current_index (
    asset_id,
    name,
    item_type,
    category,
    subcategory,
    creator_name,
    thumbnail_url,
    price_robux,
    lowest_resale_price_robux,
    resale_change_24h,
    resale_change_24h_percent,
    price_change_24h,
    price_change_24h_percent,
    favorite_change_24h,
    mover_score,
    rank_value,
    indexed_at
  )
  select
    asset_id,
    name,
    item_type,
    category,
    subcategory,
    creator_name,
    thumbnail_url,
    price_robux,
    lowest_resale_price_robux,
    resale_change_24h,
    resale_change_24h_percent,
    price_change_24h,
    price_change_24h_percent,
    favorite_change_24h,
    (
      coalesce(abs(resale_change_24h_percent), 0) * 10
      + coalesce(abs(price_change_24h_percent), 0) * 5
      + least(coalesce(abs(favorite_change_24h), 0), 100000)::numeric / 1000
    ) as mover_score,
    row_number() over (
      order by (
        coalesce(abs(resale_change_24h_percent), 0) * 10
        + coalesce(abs(price_change_24h_percent), 0) * 5
        + least(coalesce(abs(favorite_change_24h), 0), 100000)::numeric / 1000
      ) desc, asset_id asc
    )::integer as rank_value,
    refreshed_at
  from public.stats_item_current_index
  where coalesce(abs(resale_change_24h_percent), abs(price_change_24h_percent), abs(favorite_change_24h)) is not null
  order by mover_score desc nulls last, asset_id asc
  limit 500;

  get diagnostics mover_count = row_count;

  return jsonb_build_object(
    'items', item_count,
    'price_movers', mover_count,
    'indexed_at', refreshed_at
  );
end;
$$;

revoke all on function public.refresh_stats_item_current_indexes() from public, anon, authenticated;
grant execute on function public.refresh_stats_item_current_indexes() to service_role;

create or replace function public.trg_enqueue_revalidation_stats_items()
returns trigger
language plpgsql
as $$
begin
  perform public.enqueue_revalidation('stats', 'items', tg_table_name || '_' || lower(tg_op));
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_stats_items_catalog_items on public.roblox_catalog_items;
create trigger trg_enqueue_revalidation_stats_items_catalog_items
after insert or update or delete on public.roblox_catalog_items
for each row execute function public.trg_enqueue_revalidation_stats_items();

drop trigger if exists trg_enqueue_revalidation_stats_items_catalog_images on public.roblox_catalog_item_images;
create trigger trg_enqueue_revalidation_stats_items_catalog_images
after insert or update or delete on public.roblox_catalog_item_images
for each row execute function public.trg_enqueue_revalidation_stats_items();
