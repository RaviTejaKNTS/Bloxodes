-- Fix broad Roblox avatar catalog collection/enrichment support.

alter table public.roblox_catalog_items
  alter column collectible_item_id type text using collectible_item_id::text;

create index if not exists idx_roblox_catalog_items_category_subcategory_favorites
  on public.roblox_catalog_items (category, subcategory, favorite_count desc nulls last)
  where is_deleted = false;

create index if not exists idx_roblox_catalog_items_asset_type_favorites
  on public.roblox_catalog_items (asset_type_id, favorite_count desc nulls last)
  where is_deleted = false;

create index if not exists idx_roblox_catalog_items_item_type
  on public.roblox_catalog_items (item_type);

create index if not exists idx_roblox_catalog_items_creator_target_id
  on public.roblox_catalog_items (creator_target_id);

insert into public.roblox_catalog_categories (
  category,
  name,
  category_id,
  order_index,
  is_searchable,
  asset_type_ids,
  bundle_type_ids
)
values (
  'Makeup',
  'Makeup',
  null,
  100,
  true,
  array[76, 77, 88, 89, 90]::integer[],
  '{}'::integer[]
)
on conflict (category) do update set
  name = excluded.name,
  is_searchable = excluded.is_searchable,
  asset_type_ids = excluded.asset_type_ids,
  bundle_type_ids = excluded.bundle_type_ids;

insert into public.roblox_catalog_subcategories (
  subcategory,
  category,
  name,
  short_name,
  subcategory_id,
  asset_type_ids,
  bundle_type_ids
)
values
  ('Eyebrows', 'Makeup', 'Eyebrows', null, null, array[76]::integer[], '{}'::integer[]),
  ('Eyelashes', 'Makeup', 'Eyelashes', null, null, array[77]::integer[], '{}'::integer[]),
  ('FaceMakeup', 'Makeup', 'Face Makeup', null, null, array[88]::integer[], '{}'::integer[]),
  ('LipMakeup', 'Makeup', 'Lip Makeup', null, null, array[89]::integer[], '{}'::integer[]),
  ('EyeMakeup', 'Makeup', 'Eye Makeup', null, null, array[90]::integer[], '{}'::integer[])
on conflict (subcategory) do update set
  category = excluded.category,
  name = excluded.name,
  asset_type_ids = excluded.asset_type_ids,
  bundle_type_ids = excluded.bundle_type_ids;

create or replace function public.avatar_catalog_slugs_for_catalog_item(
  p_category text,
  p_subcategory text,
  p_asset_type_id integer
)
returns text[]
language plpgsql
immutable
as $$
declare
  v_category text := coalesce(p_category, '');
  v_subcategory text := coalesce(p_subcategory, '');
  v_slugs text[] := array[]::text[];
begin
  if v_category in ('Accessories', 'Body', 'Clothing', 'AvatarAnimations', 'Makeup')
    or p_asset_type_id = any(array[76, 77, 88, 89, 90]::integer[])
  then
    v_slugs := array_append(v_slugs, 'roblox-items-and-bundles');
  end if;

  if v_category = 'Accessories' then
    v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories');
    case v_subcategory
      when 'HeadAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories/head-accessories');
      when 'FaceAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories/face-accessories');
      when 'NeckAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories/neck-accessories');
      when 'ShoulderAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories/shoulder-accessories');
      when 'FrontAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories/front-accessories');
      when 'BackAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories/back-accessories');
      when 'WaistAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories/waist-accessories');
      when 'Gear' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories/gear');
      else null;
    end case;
  end if;

  if v_category = 'Body' and v_subcategory = 'HairAccessories' then
    v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories');
    v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories/hair-accessories');
  elsif v_category = 'Body' then
    v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-body-parts');
    case v_subcategory
      when 'BodyPartsBundles' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-body-parts/full-bodies');
      when 'DynamicHeads' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-body-parts/dynamic-heads');
      when 'Heads' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-body-parts/classic-heads');
      when 'Faces' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-body-parts/classic-faces');
      else null;
    end case;
  end if;

  if v_category = 'Clothing' then
    v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing');
    case v_subcategory
      when 'TShirtAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/layered-t-shirts');
      when 'ShirtAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/shirts');
      when 'SweaterAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/sweaters');
      when 'JacketAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/jackets');
      when 'PantsAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/pants');
      when 'ShortsAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/shorts');
      when 'DressSkirtAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/dresses-skirts');
      when 'ShoesBundles' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/shoes');
      when 'ClassicShirts' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/classic-shirts');
      when 'ClassicTShirts' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/classic-t-shirts');
      when 'ClassicPants' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/classic-pants');
      else null;
    end case;
  end if;

  if v_category = 'AvatarAnimations' then
    case v_subcategory
      when 'EmoteAnimations' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-emotes');
      when 'AnimationBundles' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-animations');
      else null;
    end case;
  end if;

  if v_category = 'Makeup' or p_asset_type_id = any(array[76, 77, 88, 89, 90]::integer[]) then
    v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-makeup');
  end if;

  return array(
    select distinct slug
    from unnest(v_slugs) as slug
    where slug is not null and slug <> ''
  );
end;
$$;

create or replace function public.trg_enqueue_revalidation_avatar_catalog_items()
returns trigger
language plpgsql
as $$
declare
  page_slug text;
  old_slugs text[] := array[]::text[];
  new_slugs text[] := array[]::text[];
begin
  if tg_op <> 'INSERT' then
    old_slugs := public.avatar_catalog_slugs_for_catalog_item(old.category, old.subcategory, old.asset_type_id);
  end if;

  if tg_op <> 'DELETE' then
    new_slugs := public.avatar_catalog_slugs_for_catalog_item(new.category, new.subcategory, new.asset_type_id);
  end if;

  for page_slug in
    select distinct slug
    from unnest(old_slugs || new_slugs) as slug
  loop
    perform public.enqueue_revalidation('catalog', page_slug, 'roblox_avatar_catalog_items_' || lower(tg_op));
  end loop;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_avatar_catalog_items on public.roblox_catalog_items;
create trigger trg_enqueue_revalidation_avatar_catalog_items
after insert or update or delete on public.roblox_catalog_items
for each row execute function public.trg_enqueue_revalidation_avatar_catalog_items();

create or replace function public.trg_enqueue_revalidation_avatar_catalog_images()
returns trigger
language plpgsql
as $$
declare
  target_asset_id bigint;
  item_record record;
  page_slug text;
begin
  if tg_op = 'DELETE' then
    target_asset_id := old.asset_id;
  else
    target_asset_id := new.asset_id;
  end if;

  if target_asset_id is null then
    return null;
  end if;

  select item.category, item.subcategory, item.asset_type_id
  into item_record
  from public.roblox_catalog_items item
  where item.asset_id = target_asset_id;

  if not found then
    return null;
  end if;

  for page_slug in
    select distinct slug
    from unnest(public.avatar_catalog_slugs_for_catalog_item(
      item_record.category,
      item_record.subcategory,
      item_record.asset_type_id
    )) as slug
  loop
    perform public.enqueue_revalidation('catalog', page_slug, 'roblox_avatar_catalog_images_' || lower(tg_op));
  end loop;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_avatar_catalog_images on public.roblox_catalog_item_images;
create trigger trg_enqueue_revalidation_avatar_catalog_images
after insert or update or delete on public.roblox_catalog_item_images
for each row execute function public.trg_enqueue_revalidation_avatar_catalog_images();
