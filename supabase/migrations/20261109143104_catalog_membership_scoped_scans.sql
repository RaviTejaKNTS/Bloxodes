-- Push the page predicate inside the SQL helper before family aggregation.
create or replace function public.catalog_scoped_complex_memberships(family text, p_code text)
returns table(code text, identity text) language sql stable set search_path = '' as $$
 select * from (
 select 'free-roblox-items', i.asset_id::text from public.roblox_catalog_items i
 where family = 'free' and i.price_robux = 0 and i.is_deleted = false and i.is_for_sale = true
 and i.has_resellers = false and i.lowest_resale_price_robux = 0
 and i.free_claimability = 'direct' and i.free_verification_source = 'roblox'
 and i.free_verified_at >= now() - interval '72 hours'
 and i.name is not null and i.category is not null and i.subcategory is not null and i.favorite_count is not null

 union all select 'roblox-music-ids/games/jujutsu-shenanigans', i.asset_id::text from public.roblox_music_ids i where family = 'music' and i.duration_seconds > 0 and i.duration_seconds <= 20
 and not exists (select 1 from public.roblox_music_ids_game_view v where v.game_slug = 'jujutsu-shenanigans')

 union all select 'roblox-music-ids/games/murder-mystery-2', i.asset_id::text from public.roblox_music_ids i where family = 'music' and i.duration_seconds between 30 and 600
 and not exists (select 1 from public.roblox_music_ids_game_view v where v.game_slug = 'murder-mystery-2')

 union all select 'roblox-music-ids/games/the-strongest-battlegrounds', i.asset_id::text from public.roblox_music_ids i where family = 'music' and i.duration_seconds > 0 and i.duration_seconds <= 20
 and not exists (select 1 from public.roblox_music_ids_game_view v where v.game_slug = 'the-strongest-battlegrounds')

 union all select 'roblox-music-ids/games/forsaken', i.asset_id::text from public.roblox_music_ids i where family = 'music' and i.duration_seconds > 0 and i.duration_seconds <= 20
 and not exists (select 1 from public.roblox_music_ids_game_view v where v.game_slug = 'forsaken')

 union all select 'roblox-music-ids/games/adopt-me', i.asset_id::text from public.roblox_music_ids i where family = 'music' and i.duration_seconds between 30 and 600
 and not exists (select 1 from public.roblox_music_ids_game_view v where v.game_slug = 'adopt-me')

 union all select 'roblox-music-ids/games/brookhaven-rp', i.asset_id::text from public.roblox_music_ids i where family = 'music' and i.duration_seconds between 30 and 600
 and not exists (select 1 from public.roblox_music_ids_game_view v where v.game_slug = 'brookhaven-rp')

 union all select 'roblox-music-ids/games/fisch', i.asset_id::text from public.roblox_music_ids i where family = 'music' and i.duration_seconds between 30 and 600
 and not exists (select 1 from public.roblox_music_ids_game_view v where v.game_slug = 'fisch')

 union all select 'roblox-music-ids/games/driving-empire', i.asset_id::text from public.roblox_music_ids i where family = 'music' and i.duration_seconds between 30 and 600
 and not exists (select 1 from public.roblox_music_ids_game_view v where v.game_slug = 'driving-empire')

 union all select 'roblox-music-ids/games/evade', i.asset_id::text from public.roblox_music_ids i where family = 'music' and i.duration_seconds between 30 and 600
 and not exists (select 1 from public.roblox_music_ids_game_view v where v.game_slug = 'evade')

 union all select 'roblox-music-ids/games/3008', i.asset_id::text from public.roblox_music_ids i where family = 'music' and i.duration_seconds between 30 and 600
 and not exists (select 1 from public.roblox_music_ids_game_view v where v.game_slug = '3008')

 union all select 'roblox-music-ids/games/a-dusty-trip', i.asset_id::text from public.roblox_music_ids i where family = 'music' and i.duration_seconds between 30 and 600
 and not exists (select 1 from public.roblox_music_ids_game_view v where v.game_slug = 'a-dusty-trip')

 union all select 'roblox-music-ids/games/basketball-zero', i.asset_id::text from public.roblox_music_ids i where family = 'music' and i.duration_seconds between 30 and 600
 and not exists (select 1 from public.roblox_music_ids_game_view v where v.game_slug = 'basketball-zero')

 union all select 'roblox-music-ids/games/grand-piece-online', i.asset_id::text from public.roblox_music_ids i where family = 'music' and i.duration_seconds between 30 and 600
 and not exists (select 1 from public.roblox_music_ids_game_view v where v.game_slug = 'grand-piece-online')

 union all select 'roblox-music-ids/games/da-hood', i.asset_id::text from public.roblox_music_ids i where family = 'music' and i.duration_seconds between 30 and 600
 and not exists (select 1 from public.roblox_music_ids_game_view v where v.game_slug = 'da-hood')

 union all select 'roblox-music-ids/games/retail-tycoon-2', i.asset_id::text from public.roblox_music_ids i where family = 'music' and i.duration_seconds between 30 and 600
 and not exists (select 1 from public.roblox_music_ids_game_view v where v.game_slug = 'retail-tycoon-2')

 union all select 'roblox-music-ids/games/nicos-nextbots', i.asset_id::text from public.roblox_music_ids i where family = 'music' and i.duration_seconds between 30 and 600
 and not exists (select 1 from public.roblox_music_ids_game_view v where v.game_slug = 'nicos-nextbots')

 union all select 'roblox-decal-ids/games/da-hood', i.asset_id::text from public.roblox_decal_ids i where family = 'decal' and i.name ilike '%crosshair%' and i.status = 'active' and i.thumbnail_state = 'Completed' and i.thumbnail_url is not null and i.thumbnail_url not ilike '%/UnknownImage/%'
 and not exists (select 1 from public.roblox_decal_ids_game_view v where v.game_slug = 'da-hood')

 union all select 'roblox-decal-ids/games/shindo-life', i.asset_id::text from public.roblox_decal_ids i where family = 'decal' and i.categories && array['faces'] and i.status = 'active' and i.thumbnail_state = 'Completed' and i.thumbnail_url is not null and i.thumbnail_url not ilike '%/UnknownImage/%' and i.texture_id > 0
 and not exists (select 1 from public.roblox_decal_ids_game_view v where v.game_slug = 'shindo-life')

 union all select 'roblox-decal-ids/games/berry-avenue', i.asset_id::text from public.roblox_decal_ids i where family = 'decal' and i.categories && array['posters','aesthetic','textures'] and i.status = 'active' and i.thumbnail_state = 'Completed' and i.thumbnail_url is not null and i.thumbnail_url not ilike '%/UnknownImage/%'
 and not exists (select 1 from public.roblox_decal_ids_game_view v where v.game_slug = 'berry-avenue')

 union all select 'roblox-decal-ids/games/bloxburg', i.asset_id::text from public.roblox_decal_ids i where family = 'decal' and i.categories && array['posters','aesthetic','textures'] and i.status = 'active' and i.thumbnail_state = 'Completed' and i.thumbnail_url is not null and i.thumbnail_url not ilike '%/UnknownImage/%' and i.texture_id > 0
 and not exists (select 1 from public.roblox_decal_ids_game_view v where v.game_slug = 'bloxburg')

 union all select 'roblox-decal-ids/games/jujutsu-shenanigans', i.asset_id::text from public.roblox_decal_ids i where family = 'decal' and i.categories && array['anime','memes','characters','posters'] and i.status = 'active' and i.thumbnail_state = 'Completed' and i.thumbnail_url is not null and i.thumbnail_url not ilike '%/UnknownImage/%' and i.texture_id > 0
 and not exists (select 1 from public.roblox_decal_ids_game_view v where v.game_slug = 'jujutsu-shenanigans')

 union all select 'roblox-decal-ids/games/spray-paint', i.asset_id::text from public.roblox_decal_ids i where family = 'decal' and i.curated_rank is not null and i.status = 'active' and i.thumbnail_state = 'Completed' and i.thumbnail_url is not null and i.thumbnail_url not ilike '%/UnknownImage/%'
 and not exists (select 1 from public.roblox_decal_ids_game_view v where v.game_slug = 'spray-paint')

 union all select 'roblox-decal-ids/games/bloxstrike', i.asset_id::text from public.roblox_decal_ids i where family = 'decal' and i.name ilike '%crosshair%' and i.status = 'active' and i.thumbnail_state = 'Completed' and i.thumbnail_url is not null and i.thumbnail_url not ilike '%/UnknownImage/%'
 and not exists (select 1 from public.roblox_decal_ids_game_view v where v.game_slug = 'bloxstrike')
 union all select 'roblox-music-ids/games/' || v.game_slug, v.asset_id::text from public.roblox_music_ids_game_view v where family = 'music'
 union all select 'roblox-decal-ids/curated', i.asset_id::text from public.roblox_decal_ids i where family = 'decal' and i.status = 'active' and i.thumbnail_state = 'Completed' and i.thumbnail_url is not null and i.thumbnail_url not ilike '%/UnknownImage/%' and i.curated_rank is not null
 union all select 'roblox-decal-ids/games/' || v.game_slug, v.asset_id::text from public.roblox_decal_ids_game_view v where family = 'decal' and (v.game_slug not in ('shindo-life','bloxburg','jujutsu-shenanigans') or v.texture_id > 0)
 union all select 'roblox-music-ids/trending', i.asset_id::text from public.roblox_music_ids i where family='music' and i.duration_seconds > 0 and i.rank <= 500
 union all select 'roblox-music-ids/weekly', i.asset_id::text from public.roblox_music_ids i where family='music' and i.duration_seconds > 0 and i.source='creator_store_top_week'
 union all select 'roblox-music-ids/monthly', i.asset_id::text from public.roblox_music_ids i where family='music' and i.duration_seconds > 0 and i.source='creator_store_top_month'
 union all select 'roblox-music-ids/yearly', i.asset_id::text from public.roblox_music_ids i where family='music' and i.duration_seconds > 0 and i.source='creator_store_top_year'
) members(code, identity) where code=p_code
$$;
revoke all on function public.catalog_scoped_complex_memberships(text,text) from public, anon, authenticated;
create or replace function public.refresh_catalog_membership_date(p_code text) returns integer
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
select * from public.catalog_scoped_complex_memberships(case when p_code='free-roblox-items' then 'free' end, p_code)
 union all
select * from public.catalog_scoped_complex_memberships(case when p_code like 'roblox-music-ids/%' then 'music' end, p_code)
 union all
select * from public.catalog_scoped_complex_memberships(case when p_code like 'roblox-decal-ids/%' then 'decal' end, p_code)
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
