-- Track Free Items eligibility verified directly against official Roblox APIs.

alter table public.roblox_catalog_items
  add column if not exists free_claimability text,
  add column if not exists free_verified_at timestamptz,
  add column if not exists free_verification_source text,
  add column if not exists free_restriction_reason text;

alter table public.roblox_catalog_items
  drop constraint if exists roblox_catalog_items_free_claimability_check;

alter table public.roblox_catalog_items
  add constraint roblox_catalog_items_free_claimability_check
  check (free_claimability is null or free_claimability in ('direct', 'experience', 'unavailable'));

comment on column public.roblox_catalog_items.free_claimability is
  'Official Roblox verification result: direct, experience, or unavailable.';
comment on column public.roblox_catalog_items.free_verified_at is
  'When free-item claimability was last checked against an official Roblox API.';
comment on column public.roblox_catalog_items.free_verification_source is
  'Source used for the final free-item availability check. Candidate discovery may come from any source; public rows require a current Roblox verification.';
comment on column public.roblox_catalog_items.free_restriction_reason is
  'Machine-readable reason an item is not directly claimable from the Roblox shop.';

create index if not exists idx_roblox_catalog_items_verified_free
  on public.roblox_catalog_items (free_verified_at desc, category, subcategory, favorite_count desc nulls last)
  where free_claimability = 'direct'
    and free_verification_source = 'roblox'
    and price_robux = 0
    and is_for_sale = true
    and is_deleted = false;

create or replace function public.qualifies_for_free_items_catalog(
  p_price_robux bigint,
  p_is_deleted boolean,
  p_is_for_sale boolean,
  p_has_resellers boolean,
  p_lowest_resale_price_robux bigint,
  p_name text,
  p_category text,
  p_subcategory text,
  p_favorite_count bigint,
  p_free_claimability text,
  p_free_verified_at timestamptz,
  p_free_verification_source text
)
returns boolean
language sql
immutable
as $$
  select coalesce(
    p_price_robux = 0
    and p_is_deleted = false
    and p_is_for_sale = true
    and p_has_resellers = false
    and p_lowest_resale_price_robux = 0
    and p_name is not null
    and p_category is not null
    and p_subcategory is not null
    and p_favorite_count is not null
    and p_free_claimability = 'direct'
    and p_free_verified_at is not null
    and p_free_verification_source = 'roblox',
    false
  );
$$;

create or replace function public.trg_enqueue_revalidation_free_items_catalog()
returns trigger
language plpgsql
as $$
declare
  old_qualifies boolean := false;
  new_qualifies boolean := false;
begin
  if tg_op <> 'INSERT' then
    old_qualifies := public.qualifies_for_free_items_catalog(
      old.price_robux,
      old.is_deleted,
      old.is_for_sale,
      old.has_resellers,
      old.lowest_resale_price_robux,
      old.name,
      old.category,
      old.subcategory,
      old.favorite_count,
      old.free_claimability,
      old.free_verified_at,
      old.free_verification_source
    );
  end if;

  if tg_op <> 'DELETE' then
    new_qualifies := public.qualifies_for_free_items_catalog(
      new.price_robux,
      new.is_deleted,
      new.is_for_sale,
      new.has_resellers,
      new.lowest_resale_price_robux,
      new.name,
      new.category,
      new.subcategory,
      new.favorite_count,
      new.free_claimability,
      new.free_verified_at,
      new.free_verification_source
    );
  end if;

  if old_qualifies or new_qualifies then
    perform public.enqueue_revalidation('catalog', 'free-roblox-items', 'roblox_catalog_items_' || lower(tg_op));
  end if;

  if old_qualifies then
    perform public.enqueue_free_items_catalog_scope(
      old.category,
      old.subcategory,
      'roblox_catalog_items_scope_old_' || lower(tg_op)
    );
  end if;

  if new_qualifies then
    perform public.enqueue_free_items_catalog_scope(
      new.category,
      new.subcategory,
      'roblox_catalog_items_scope_' || lower(tg_op)
    );
  end if;

  return null;
end;
$$;

create or replace function public.trg_enqueue_revalidation_free_item_images()
returns trigger
language plpgsql
as $$
declare
  target_asset_id bigint;
  item_record record;
begin
  if tg_op = 'DELETE' then
    target_asset_id := old.asset_id;
  else
    target_asset_id := new.asset_id;
  end if;

  if target_asset_id is null then
    return null;
  end if;

  select *
  into item_record
  from public.roblox_catalog_items item
  where item.asset_id = target_asset_id;

  if not found then
    return null;
  end if;

  if public.qualifies_for_free_items_catalog(
    item_record.price_robux,
    item_record.is_deleted,
    item_record.is_for_sale,
    item_record.has_resellers,
    item_record.lowest_resale_price_robux,
    item_record.name,
    item_record.category,
    item_record.subcategory,
    item_record.favorite_count,
    item_record.free_claimability,
    item_record.free_verified_at,
    item_record.free_verification_source
  ) then
    perform public.enqueue_revalidation('catalog', 'free-roblox-items', 'roblox_catalog_item_images_' || lower(tg_op));
    perform public.enqueue_free_items_catalog_scope(
      item_record.category,
      item_record.subcategory,
      'roblox_catalog_item_images_scope_' || lower(tg_op)
    );
  end if;

  return null;
end;
$$;

drop function if exists public.qualifies_for_free_items_catalog(
  bigint,
  boolean,
  jsonb,
  boolean,
  bigint,
  text,
  text,
  text,
  bigint
);
