\set ON_ERROR_STOP on

begin;

insert into public.roblox_catalog_items (
  asset_id, item_type, name, category, subcategory, favorite_count,
  price_robux, lowest_resale_price_robux, has_resellers, first_seen_at, last_seen_at
) values
  (910000000001, 'Asset', 'Pipeline Asset', 'Accessories', 'Hats', 1000, 100, 80, true, now(), now()),
  (-910000000001, 'Bundle', 'Pipeline Bundle', 'Body', 'Bundles', 500, 0, null, false, now(), now()),
  (910000000002, 'Asset', 'Second Worker Asset', 'Clothing', 'Shirts', 100, 50, null, false, now(), now());

select public.upsert_roblox_catalog_discovery_items(jsonb_build_array(jsonb_build_object(
  'asset_id', 910000000001,
  'item_type', 'Asset',
  'name', null,
  'favorite_count', 1200,
  'last_seen_at', now()
)));

do $$
declare row_record public.roblox_catalog_items;
begin
  select * into row_record from public.roblox_catalog_items where asset_id = 910000000001;
  if row_record.name <> 'Pipeline Asset' or row_record.favorite_count <> 1200 then
    raise exception 'null-safe discovery upsert failed';
  end if;
  if row_record.catalog_item_key <> 'Asset:910000000001' then
    raise exception 'asset canonical identity failed';
  end if;
  select * into row_record from public.roblox_catalog_items where asset_id = -910000000001;
  if row_record.catalog_item_key <> 'Bundle:910000000001' or row_record.roblox_item_id <> 910000000001 then
    raise exception 'bundle canonical identity failed';
  end if;
end;
$$;

select public.enqueue_roblox_catalog_refresh(
  array[910000000001, -910000000001, 910000000002],
  'new',
  'pipeline_test',
  now()
);

create temporary table worker_one_claims as
select asset_id from public.claim_roblox_catalog_refresh_queue('worker-one', 2, 10);
create temporary table worker_two_claims as
select asset_id from public.claim_roblox_catalog_refresh_queue('worker-two', 2, 10);

do $$
begin
  if (select count(*) from worker_one_claims) <> 2 or (select count(*) from worker_two_claims) <> 1 then
    raise exception 'atomic queue claims did not split work';
  end if;
  if exists (select asset_id from worker_one_claims intersect select asset_id from worker_two_claims) then
    raise exception 'two queue workers claimed the same item';
  end if;
end;
$$;

select public.finish_roblox_catalog_refresh(asset_id, 'worker-one', 'success', now() + interval '1 day')
from worker_one_claims;
select public.finish_roblox_catalog_refresh(asset_id, 'worker-two', 'success', now() + interval '1 day')
from worker_two_claims;

update public.roblox_catalog_items
set item_stats_tier = 'NEW', next_item_stats_refresh_at = now()
where asset_id in (910000000001, -910000000001, 910000000002);

create temporary table stats_worker_one as
select asset_id from public.claim_roblox_item_stats_rows('stats-one', 'NEW', 2, 10, null);
create temporary table stats_worker_two as
select asset_id from public.claim_roblox_item_stats_rows('stats-two', 'NEW', 2, 10, null);

do $$
begin
  if (select count(*) from stats_worker_one) <> 2 or (select count(*) from stats_worker_two) <> 1 then
    raise exception 'atomic stats claims did not split work';
  end if;
  if exists (select asset_id from stats_worker_one intersect select asset_id from stats_worker_two) then
    raise exception 'two stats workers claimed the same item';
  end if;
end;
$$;

select public.release_roblox_item_stats_rows('stats-one', array_agg(asset_id), null, now() + interval '1 hour')
from stats_worker_one;
select public.release_roblox_item_stats_rows('stats-two', array_agg(asset_id), null, now() + interval '1 hour')
from stats_worker_two;

insert into public.roblox_catalog_item_images (asset_id, size, format, image_url, state)
values (910000000001, '420x420', 'Png', 'https://example.com/item.png', 'Completed');

insert into public.roblox_catalog_item_stats_daily (
  asset_id, stat_date, sample_count, price_close, resale_close, favorites_close, finalized
) values
  (910000000001, current_date - 1, 1, 90, 75, 1100, true),
  (910000000001, current_date - 7, 1, 70, 60, 900, true);

select public.refresh_stats_item_current_indexes();

do $$
declare index_row public.stats_item_current_index;
begin
  select * into index_row from public.stats_item_current_index where asset_id = 910000000001;
  if index_row.thumbnail_url <> 'https://example.com/item.png' then
    raise exception 'fast index did not select the preferred thumbnail';
  end if;
  if index_row.price_change_24h <> 10 or index_row.favorite_change_7d <> 300 then
    raise exception 'fast index did not calculate durable daily deltas';
  end if;
end;
$$;

rollback;
