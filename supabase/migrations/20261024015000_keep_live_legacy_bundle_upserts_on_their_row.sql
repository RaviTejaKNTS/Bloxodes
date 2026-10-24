-- Item writers upsert with on conflict (asset_id) and send the positive Roblox
-- bundle id. The BEFORE INSERT trigger runs before the conflict check, so it
-- used to flip every bundle to its negative canonical id. For the ~5,000 live
-- legacy bundle rows that still have no canonical row, the flipped insert then
-- missed the legacy row and hit idx_roblox_catalog_live_canonical_key (23505),
-- failing the whole HOT, WARM, discovery or enrichment batch.
--
-- Keep the positive id when a live legacy row already holds it, so the upsert
-- updates that row. New bundles and retired aliases still go to the canonical
-- negative row.
create or replace function public.set_roblox_catalog_item_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  new.item_type := case when new.item_type = 'Bundle' then 'Bundle' else 'Asset' end;
  if new.item_type = 'Bundle' and new.asset_id > 0 then
    if tg_op = 'INSERT' then
      if not exists (select 1 from public.roblox_catalog_items legacy
        where legacy.asset_id = new.asset_id and legacy.item_type = 'Bundle'
          and legacy.is_deleted = false) then
        new.asset_id := -new.asset_id;
      end if;
    elsif exists (select 1 from public.roblox_catalog_items canonical
      where canonical.asset_id = -new.asset_id and canonical.item_type = 'Bundle') then
      new.is_deleted := true;
    end if;
  end if;
  new.roblox_item_id := case when new.item_type = 'Bundle' then abs(new.asset_id) else new.asset_id end;
  new.catalog_item_key := new.item_type || ':' || new.roblox_item_id::text;
  return new;
end;
$$;
