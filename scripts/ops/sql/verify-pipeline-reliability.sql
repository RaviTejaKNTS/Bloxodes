-- Run after the two repair migrations in managed development. Every fixture,
-- trigger event and timestamp change rolls back with this transaction.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$
declare
  page_id uuid;
  saved public.codes%rowtype;
  fixture text := '__PIPELINE_CASE_FIXTURE_20261002__';
  bundle_id bigint := 900000000000001;
begin
  select id into page_id from public.code_pages order by is_published, id limit 1;
  if page_id is null then
    insert into public.code_pages(name,slug,is_published)
      values('Pipeline rollback fixture','pipeline-rollback-fixture-20261002',false) returning id into page_id;
  end if;
  if exists(select 1 from public.codes where code_page_id=page_id and upper(code)=upper(fixture)) then
    raise exception 'Code fixture already exists; do not overwrite it';
  end if;
  perform public.upsert_code(page_id, fixture, 'active', 'fixture reward', null, false, 10);
  perform public.upsert_code(page_id, lower(fixture), 'expired', 'weaker reward', 2, true, 9);
  select * into saved from public.codes where code_page_id=page_id and upper(code)=upper(fixture);
  if saved.code<>fixture or saved.status<>'active' or saved.provider_priority<>10 or saved.rewards_text<>'fixture reward' then
    raise exception 'Weaker provider changed stronger code data';
  end if;
  perform public.upsert_code(page_id, lower(fixture), 'expired', 'equal reward', null, false, 10);
  select * into saved from public.codes where code_page_id=page_id and upper(code)=upper(fixture);
  if saved.code<>fixture or saved.status<>'expired' then raise exception 'Equal-priority case handling failed'; end if;
  update public.codes set first_seen_at='2000-01-01' where id=saved.id;
  perform public.upsert_code(page_id, lower(fixture), 'active', 'stronger reward', 3, true, 11);
  select * into saved from public.codes where code_page_id=page_id and upper(code)=upper(fixture);
  if saved.code<>lower(fixture) or saved.status<>'active' or saved.provider_priority<>11 or saved.first_seen_at<>now() then
    raise exception 'Stronger provider/reactivation failed';
  end if;
  if (select count(*) from public.codes where code_page_id=page_id and upper(code)=upper(fixture))<>1 then
    raise exception 'Case variants produced duplicate codes';
  end if;
  if exists(select 1 from public.roblox_catalog_items where abs(asset_id)=bundle_id) then
    raise exception 'Bundle fixture already exists; do not overwrite it';
  end if;
  insert into public.roblox_catalog_items(asset_id,item_type,name) values(bundle_id,'Bundle','Pipeline bundle fixture');
  insert into public.roblox_catalog_items(asset_id,item_type,name) values(bundle_id,'Bundle','Pipeline bundle fixture')
    on conflict(asset_id) do update set name=excluded.name;
  if (select count(*) from public.roblox_catalog_items where abs(asset_id)=bundle_id)<>1
     or not exists(select 1 from public.roblox_catalog_items where asset_id=-bundle_id and catalog_item_key='Bundle:'||bundle_id) then
    raise exception 'Bundle insert normalization/upsert failed';
  end if;
  insert into public.roblox_catalog_items(asset_id,favorite_count) values(-bundle_id,12)
    on conflict(asset_id) do update set favorite_count=excluded.favorite_count;
  if not exists(select 1 from public.roblox_catalog_items where asset_id=-bundle_id and item_type='Bundle' and favorite_count=12) then
    raise exception 'Partial bundle upsert corrupted identity';
  end if;
  raise notice 'Case-insensitive upsert, provider precedence, reactivation and bundle identity fixtures passed.';
end;
$$;
select count(*) as duplicate_live_keys from
  (select catalog_item_key from public.roblox_catalog_items where is_deleted=false group by catalog_item_key having count(*)>1) duplicates;
rollback;
