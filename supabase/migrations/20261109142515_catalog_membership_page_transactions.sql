-- One RPC is one page transaction. Never restore a multi-page write RPC.
set local lock_timeout = '2s';
drop function public.refresh_catalog_membership_dates();
create function public.list_catalog_membership_pages() returns setof text
language sql stable security definer set search_path = '' as $$
 select code from public.catalog_pages where code in ('roblox-items-and-bundles','roblox-items-and-bundles' || '/roblox-accessories','roblox-items-and-bundles' || '/roblox-clothing','roblox-items-and-bundles' || '/roblox-body-parts','roblox-items-and-bundles' || '/roblox-emotes','roblox-items-and-bundles' || '/roblox-animations','roblox-items-and-bundles' || '/roblox-makeup','roblox-items-and-bundles' || '/roblox-accessories/hair-accessories','roblox-items-and-bundles' || '/roblox-accessories/head-accessories','roblox-items-and-bundles' || '/roblox-accessories/face-accessories','roblox-items-and-bundles' || '/roblox-accessories/neck-accessories','roblox-items-and-bundles' || '/roblox-accessories/shoulder-accessories','roblox-items-and-bundles' || '/roblox-accessories/front-accessories','roblox-items-and-bundles' || '/roblox-accessories/back-accessories','roblox-items-and-bundles' || '/roblox-accessories/waist-accessories','roblox-items-and-bundles' || '/roblox-accessories/gear','roblox-items-and-bundles' || '/roblox-clothing/layered-t-shirts','roblox-items-and-bundles' || '/roblox-clothing/shirts','roblox-items-and-bundles' || '/roblox-clothing/sweaters','roblox-items-and-bundles' || '/roblox-clothing/jackets','roblox-items-and-bundles' || '/roblox-clothing/pants','roblox-items-and-bundles' || '/roblox-clothing/shorts','roblox-items-and-bundles' || '/roblox-clothing/dresses-skirts','roblox-items-and-bundles' || '/roblox-clothing/shoes','roblox-items-and-bundles' || '/roblox-clothing/classic-shirts','roblox-items-and-bundles' || '/roblox-clothing/classic-t-shirts','roblox-items-and-bundles' || '/roblox-clothing/classic-pants','roblox-items-and-bundles' || '/roblox-body-parts/full-bodies','roblox-items-and-bundles' || '/roblox-body-parts/dynamic-heads','roblox-items-and-bundles' || '/roblox-body-parts/classic-heads','roblox-items-and-bundles' || '/roblox-body-parts/classic-faces','free-roblox-items','roblox-music-ids','roblox-decal-ids','roblox-font-ids','roblox-mesh-ids','roblox-emote-commands','roblox-promo-codes')
 or code like 'roblox-music-ids/games/%' or code like 'roblox-decal-ids/games/%'
 union select unnest(array['roblox-decal-ids/curated','roblox-music-ids/trending','roblox-music-ids/weekly','roblox-music-ids/monthly','roblox-music-ids/yearly'])
 order by code
$$;
create function public.refresh_catalog_membership_date(p_code text) returns integer
language plpgsql security definer set search_path = ''
set statement_timeout = '10s' set lock_timeout = '1s' set jit = off as $$
declare r record; prior public.catalog_membership_snapshots; changed integer := 0;
begin
 -- Only reconcilers take this lock. It is released at the end of this RPC.
 if not pg_try_advisory_xact_lock(723462, 1) then
   raise exception 'Catalog membership reconciliation already running' using errcode='55P03';
 end if;
 if not exists (select 1 from public.list_catalog_membership_pages() c where c=p_code) then
   raise exception 'Unknown catalog membership page: %', p_code;
 end if;
 with members as not materialized (
select 'roblox-items-and-bundles' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = any(array['Accessories','Body','Clothing','AvatarAnimations','Makeup'])) and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-accessories' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Accessories' or (i.category = 'Body' and i.subcategory = 'HairAccessories')) and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-clothing' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Clothing') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-body-parts' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Body' and i.subcategory <> 'HairAccessories') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-emotes' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'AvatarAnimations' and i.subcategory = 'EmoteAnimations') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-animations' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'AvatarAnimations' and i.subcategory = 'AnimationBundles') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-makeup' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Makeup' or i.asset_type_id = any(array[76,77,88,89,90])) and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-accessories/hair-accessories' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Body' and i.subcategory = 'HairAccessories') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-accessories/head-accessories' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Accessories' and i.subcategory = 'HeadAccessories') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-accessories/face-accessories' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Accessories' and i.subcategory = 'FaceAccessories') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-accessories/neck-accessories' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Accessories' and i.subcategory = 'NeckAccessories') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-accessories/shoulder-accessories' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Accessories' and i.subcategory = 'ShoulderAccessories') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-accessories/front-accessories' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Accessories' and i.subcategory = 'FrontAccessories') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-accessories/back-accessories' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Accessories' and i.subcategory = 'BackAccessories') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-accessories/waist-accessories' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Accessories' and i.subcategory = 'WaistAccessories') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-accessories/gear' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Accessories' and i.subcategory = 'Gear') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-clothing/layered-t-shirts' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Clothing' and i.subcategory = 'TShirtAccessories') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-clothing/shirts' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Clothing' and i.subcategory = 'ShirtAccessories') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-clothing/sweaters' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Clothing' and i.subcategory = 'SweaterAccessories') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-clothing/jackets' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Clothing' and i.subcategory = 'JacketAccessories') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-clothing/pants' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Clothing' and i.subcategory = 'PantsAccessories') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-clothing/shorts' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Clothing' and i.subcategory = 'ShortsAccessories') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-clothing/dresses-skirts' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Clothing' and i.subcategory = 'DressSkirtAccessories') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-clothing/shoes' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Clothing' and i.subcategory = 'ShoesBundles') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-clothing/classic-shirts' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Clothing' and i.subcategory = 'ClassicShirts') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-clothing/classic-t-shirts' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Clothing' and i.subcategory = 'ClassicTShirts') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-clothing/classic-pants' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Clothing' and i.subcategory = 'ClassicPants') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-body-parts/full-bodies' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Body' and i.subcategory = 'BodyPartsBundles') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-body-parts/dynamic-heads' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Body' and i.subcategory = 'DynamicHeads') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-body-parts/classic-heads' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Body' and i.subcategory = 'Heads') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-items-and-bundles' || '/roblox-body-parts/classic-faces' as code, i.asset_id::text as identity from public.roblox_catalog_items i where (i.category = 'Body' and i.subcategory = 'Faces') and i.is_deleted=false and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null
 union all
select 'roblox-music-ids', asset_id::text from public.roblox_music_ids where duration_seconds>0
 union all
select 'roblox-decal-ids', asset_id::text from public.roblox_decal_ids where status='active' and thumbnail_state='Completed' and thumbnail_url is not null and thumbnail_url not ilike '%/UnknownImage/%'
 union all
select 'roblox-font-ids', asset_id::text from public.roblox_font_ids where status='active' and thumbnail_state='Completed' and thumbnail_url is not null
 union all
select 'roblox-mesh-ids', asset_id::text from public.roblox_mesh_ids where status='active' and thumbnail_state='Completed' and thumbnail_url is not null
 union all
select 'roblox-emote-commands', code::text from public.roblox_emote_commands where is_published=true
 union all
select 'roblox-promo-codes', id::text from public.roblox_promo_rewards where status in ('verified_claimable','expired','unavailable') or (status='source_listed_unverified' and claim_type='experience_code')
 union all
select * from public.catalog_complex_memberships(case when p_code='free-roblox-items' then 'free' end)
 union all
select * from public.catalog_complex_memberships(case when p_code like 'roblox-music-ids/%' then 'music' end)
 union all
select * from public.catalog_complex_memberships(case when p_code like 'roblox-decal-ids/%' then 'decal' end)
 )
 select p_code as code, count(*)::text || ':' || coalesce(sum(hashtextextended(identity,0)::numeric),0)::text || ':' || coalesce(sum(hashtextextended(identity,1)::numeric),0)::text as fingerprint
 into r from (select distinct identity from members where code=p_code) m;
   select * into prior from public.catalog_membership_snapshots where code=r.code;
   if not found then
     -- First observation establishes a baseline and preserves the editorial date.
     insert into public.catalog_membership_snapshots(code,fingerprint,updated_at)
     values(r.code,r.fingerprint,coalesce((select updated_at from public.catalog_pages where code=r.code),
       (select updated_at from public.catalog_pages where code=split_part(r.code,'/',1)),now()));
   elsif prior.fingerprint is distinct from r.fingerprint then
     update public.catalog_membership_snapshots set fingerprint=r.fingerprint,updated_at=now() where code=r.code;
     update public.catalog_pages set updated_at=now() where code=r.code;
     -- Derived routes share the normal catalog event path, without touching the
     -- parent date or emitting a second broad family event.
     if not found then perform public.enqueue_revalidation('catalog',r.code,'catalog_membership'); end if;
     changed := changed+1;
   end if;

 return changed;
end $$;
revoke all on function public.list_catalog_membership_pages() from public, anon, authenticated;
revoke all on function public.refresh_catalog_membership_date(text) from public, anon, authenticated;
grant execute on function public.list_catalog_membership_pages() to service_role;
grant execute on function public.refresh_catalog_membership_date(text) to service_role;
