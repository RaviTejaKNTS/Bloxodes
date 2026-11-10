-- Retire the rejected development-only implementation. Never replay its SQL.
-- No data scans or baseline computation occur while schema locks are held.
set local lock_timeout = '2s';
do $$
declare r record;
begin
 if to_regclass('cron.job') is not null then
   execute $q$select cron.unschedule(jobid) from cron.job where jobname='catalog-free-membership-expiry'$q$;
 end if;
 for r in select n.nspname, c.relname, t.tgname from pg_trigger t
 join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and not t.tgisinternal and
 (t.tgname in ('catalog_membership_insert','catalog_membership_update','catalog_membership_delete','catalog_data_revalidation')
 or t.tgfoid = to_regprocedure('public.initialize_catalog_membership_snapshot()'))
 loop
   execute format('drop trigger %I on %I.%I',r.tgname,r.nspname,r.relname);
   if r.tgname='catalog_data_revalidation' then
     -- Restore the pre-215 cache trigger only where 215 replaced it.
     execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.%I()',
       case r.relname when 'roblox_music_ids' then 'trg_enqueue_revalidation_music_ids' when 'roblox_decal_ids' then 'trg_enqueue_revalidation_decal_ids' when 'roblox_promo_rewards' then 'trg_enqueue_revalidation_promo_rewards' when 'roblox_music_id_game_usage' then 'trg_enqueue_revalidation_music_game_usage' else 'trg_enqueue_revalidation_decal_game_usage' end,
       r.relname,
       case r.relname when 'roblox_music_ids' then 'trg_enqueue_revalidation_music_ids' when 'roblox_decal_ids' then 'trg_enqueue_revalidation_decal_ids' when 'roblox_promo_rewards' then 'trg_enqueue_revalidation_promo_rewards' when 'roblox_music_id_game_usage' then 'trg_enqueue_revalidation_music_game_usage' else 'trg_enqueue_revalidation_decal_game_usage' end);
   end if;
 end loop;
 for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and (p.proname like 'catalog_membership_%' or p.proname='initialize_catalog_membership_snapshot' or p.proname in ('refresh_catalog_membership_snapshots','catalog_row_memberships','catalog_complex_memberships','catalog_data_revalidation'))
 loop execute format('drop function %s',r.signature); end loop;
end $$;
drop table if exists public.catalog_membership_snapshots;
create or replace function public.catalog_complex_memberships(family text)
returns table(code text, identity text) language sql stable set search_path = '' as $$
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
$$;


revoke all on function public.catalog_complex_memberships(text) from public, anon, authenticated;
create table public.catalog_membership_snapshots (
 code text primary key, fingerprint text not null, updated_at timestamptz not null
);
alter table public.catalog_membership_snapshots enable row level security;
revoke all on public.catalog_membership_snapshots from public, anon, authenticated;
grant select on public.catalog_membership_snapshots to service_role;

create function public.refresh_catalog_membership_dates() returns integer
language plpgsql security definer set search_path = ''
set statement_timeout = '60s' set lock_timeout = '1s' set jit = off as $$
declare r record; prior public.catalog_membership_snapshots; changed integer := 0;
begin
 -- Only reconcilers take this lock. Source writers never participate.
 if not pg_try_advisory_xact_lock(723462, 1) then
   raise exception 'Catalog membership reconciliation already running' using errcode='55P03';
 end if;
 for r in
 with members as materialized (
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
select * from public.catalog_complex_memberships('free')
 union all
select * from public.catalog_complex_memberships('music')
 union all
select * from public.catalog_complex_memberships('decal')
 ), pages as (
 select code from public.catalog_pages where code in ('roblox-items-and-bundles','roblox-items-and-bundles' || '/roblox-accessories','roblox-items-and-bundles' || '/roblox-clothing','roblox-items-and-bundles' || '/roblox-body-parts','roblox-items-and-bundles' || '/roblox-emotes','roblox-items-and-bundles' || '/roblox-animations','roblox-items-and-bundles' || '/roblox-makeup','roblox-items-and-bundles' || '/roblox-accessories/hair-accessories','roblox-items-and-bundles' || '/roblox-accessories/head-accessories','roblox-items-and-bundles' || '/roblox-accessories/face-accessories','roblox-items-and-bundles' || '/roblox-accessories/neck-accessories','roblox-items-and-bundles' || '/roblox-accessories/shoulder-accessories','roblox-items-and-bundles' || '/roblox-accessories/front-accessories','roblox-items-and-bundles' || '/roblox-accessories/back-accessories','roblox-items-and-bundles' || '/roblox-accessories/waist-accessories','roblox-items-and-bundles' || '/roblox-accessories/gear','roblox-items-and-bundles' || '/roblox-clothing/layered-t-shirts','roblox-items-and-bundles' || '/roblox-clothing/shirts','roblox-items-and-bundles' || '/roblox-clothing/sweaters','roblox-items-and-bundles' || '/roblox-clothing/jackets','roblox-items-and-bundles' || '/roblox-clothing/pants','roblox-items-and-bundles' || '/roblox-clothing/shorts','roblox-items-and-bundles' || '/roblox-clothing/dresses-skirts','roblox-items-and-bundles' || '/roblox-clothing/shoes','roblox-items-and-bundles' || '/roblox-clothing/classic-shirts','roblox-items-and-bundles' || '/roblox-clothing/classic-t-shirts','roblox-items-and-bundles' || '/roblox-clothing/classic-pants','roblox-items-and-bundles' || '/roblox-body-parts/full-bodies','roblox-items-and-bundles' || '/roblox-body-parts/dynamic-heads','roblox-items-and-bundles' || '/roblox-body-parts/classic-heads','roblox-items-and-bundles' || '/roblox-body-parts/classic-faces','free-roblox-items','roblox-music-ids','roblox-decal-ids','roblox-font-ids','roblox-mesh-ids','roblox-emote-commands','roblox-promo-codes')
 or code like 'roblox-music-ids/games/%' or code like 'roblox-decal-ids/games/%'
 union select unnest(array['roblox-decal-ids/curated','roblox-music-ids/trending','roblox-music-ids/weekly','roblox-music-ids/monthly','roblox-music-ids/yearly'])
 ), fingerprints as (
 select code, count(*)::text || ':' || sum(hashtextextended(identity,0)::numeric)::text || ':' || sum(hashtextextended(identity,1)::numeric)::text as fingerprint
 from (select distinct code,identity from members) distinct_members group by code
 )
 select p.code, coalesce(f.fingerprint,'0:0:0') as fingerprint from pages p left join fingerprints f using(code) order by p.code
 loop
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
 end loop;
 return changed;
end $$;
revoke all on function public.refresh_catalog_membership_dates() from public, anon, authenticated;
grant execute on function public.refresh_catalog_membership_dates() to service_role;
create or replace function public.refresh_roblox_promo_rewards(
  p_seen_rows jsonb,
  p_checked_at timestamptz,
  p_retire_after_misses integer,
  p_touch_catalog boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_seen_count bigint := 0;
  v_missing_updated bigint := 0;
  v_retired bigint := 0;
  v_catalog_touched bigint := 0;
begin
  if jsonb_typeof(p_seen_rows) is distinct from 'array' then
    raise exception 'p_seen_rows must be a JSON array';
  end if;
  if p_checked_at is null then
    raise exception 'p_checked_at is required';
  end if;
  if p_retire_after_misses is null or p_retire_after_misses < 2 then
    raise exception 'p_retire_after_misses must be at least 2';
  end if;

  select jsonb_array_length(p_seen_rows) into v_seen_count;
  if v_seen_count = 0 then
    raise exception 'p_seen_rows must not be empty';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(73724570123456789);

  insert into public.roblox_promo_rewards (
    source_provider,
    source_key,
    source_list_url,
    source_url,
    asset_id,
    roblox_item_type,
    reward_name,
    source_type,
    claim_type,
    promo_code,
    promo_code_normalized,
    event_name,
    requirement_text,
    claim_instructions,
    destination_url,
    roblox_item_url,
    official_name,
    asset_type_id,
    creator_id,
    creator_name,
    thumbnail_url,
    thumbnail_state,
    thumbnail_checked_at,
    status,
    status_reason,
    consecutive_misses,
    sort_order,
    source_hash,
    last_seen_at,
    last_checked_at,
    verified_at,
    retired_at,
    raw_source_json,
    raw_roblox_json
  )
  select
    input_row.source_provider,
    input_row.source_key,
    input_row.source_list_url,
    input_row.source_url,
    input_row.asset_id,
    input_row.roblox_item_type,
    input_row.reward_name,
    input_row.source_type,
    input_row.claim_type,
    input_row.promo_code,
    input_row.promo_code_normalized,
    input_row.event_name,
    input_row.requirement_text,
    input_row.claim_instructions,
    input_row.destination_url,
    input_row.roblox_item_url,
    input_row.official_name,
    input_row.asset_type_id,
    input_row.creator_id,
    input_row.creator_name,
    input_row.thumbnail_url,
    input_row.thumbnail_state,
    input_row.thumbnail_checked_at,
    input_row.status,
    input_row.status_reason,
    input_row.consecutive_misses,
    input_row.sort_order,
    input_row.source_hash,
    input_row.last_seen_at,
    input_row.last_checked_at,
    input_row.verified_at,
    input_row.retired_at,
    input_row.raw_source_json,
    input_row.raw_roblox_json
  from jsonb_to_recordset(p_seen_rows) as input_row (
    source_provider text,
    source_key text,
    source_list_url text,
    source_url text,
    asset_id bigint,
    roblox_item_type text,
    reward_name text,
    source_type text,
    claim_type text,
    promo_code text,
    promo_code_normalized text,
    event_name text,
    requirement_text text,
    claim_instructions text,
    destination_url text,
    roblox_item_url text,
    official_name text,
    asset_type_id integer,
    creator_id bigint,
    creator_name text,
    thumbnail_url text,
    thumbnail_state text,
    thumbnail_checked_at timestamptz,
    status text,
    status_reason text,
    consecutive_misses integer,
    sort_order integer,
    source_hash text,
    last_seen_at timestamptz,
    last_checked_at timestamptz,
    verified_at timestamptz,
    retired_at timestamptz,
    raw_source_json jsonb,
    raw_roblox_json jsonb
  )
  on conflict (source_provider, source_key) do update set
    source_list_url = excluded.source_list_url,
    source_url = excluded.source_url,
    asset_id = excluded.asset_id,
    roblox_item_type = excluded.roblox_item_type,
    reward_name = excluded.reward_name,
    source_type = excluded.source_type,
    claim_type = excluded.claim_type,
    promo_code = excluded.promo_code,
    promo_code_normalized = excluded.promo_code_normalized,
    event_name = excluded.event_name,
    requirement_text = excluded.requirement_text,
    claim_instructions = excluded.claim_instructions,
    destination_url = excluded.destination_url,
    roblox_item_url = excluded.roblox_item_url,
    official_name = excluded.official_name,
    asset_type_id = excluded.asset_type_id,
    creator_id = excluded.creator_id,
    creator_name = excluded.creator_name,
    thumbnail_url = excluded.thumbnail_url,
    thumbnail_state = excluded.thumbnail_state,
    thumbnail_checked_at = excluded.thumbnail_checked_at,
    status = excluded.status,
    status_reason = excluded.status_reason,
    consecutive_misses = 0,
    sort_order = excluded.sort_order,
    source_hash = excluded.source_hash,
    last_seen_at = excluded.last_seen_at,
    last_checked_at = excluded.last_checked_at,
    verified_at = excluded.verified_at,
    retired_at = null,
    raw_source_json = excluded.raw_source_json,
    raw_roblox_json = excluded.raw_roblox_json;

  with seen_keys as (
    select value ->> 'source_key' as source_key
    from jsonb_array_elements(p_seen_rows)
  ),
  missing_candidates as (
    select
      reward.id,
      reward.consecutive_misses + 1 as next_misses,
      reward.consecutive_misses + 1 >= p_retire_after_misses as will_retire
    from public.roblox_promo_rewards as reward
    where reward.source_provider = 'robloxden'
      and reward.status <> 'inactive'
      and not exists (
        select 1 from seen_keys where seen_keys.source_key = reward.source_key
      )
  ),
  updated_missing as (
    update public.roblox_promo_rewards as reward
    set
      consecutive_misses = candidate.next_misses,
      last_checked_at = p_checked_at,
      status = case when candidate.will_retire then 'inactive' else reward.status end,
      status_reason = case
        when candidate.will_retire
          then 'missing_from_' || p_retire_after_misses::text || '_complete_source_refreshes'
        else reward.status_reason
      end,
      retired_at = case when candidate.will_retire then p_checked_at else reward.retired_at end
    from missing_candidates as candidate
    where reward.id = candidate.id
    returning candidate.will_retire
  )
  select count(*), count(*) filter (where will_retire)
  into v_missing_updated, v_retired
  from updated_missing;

  -- p_touch_catalog is retained for old workers; scheduled reconciliation owns dates.

  return jsonb_build_object(
    'seen_count', v_seen_count,
    'missing_updated', v_missing_updated,
    'retired', v_retired,
    'catalog_touched', v_catalog_touched
  );
end;
$$;


