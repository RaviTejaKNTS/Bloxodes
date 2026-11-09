-- Dates follow membership, independently of discovery schedules and writers.
-- PostgreSQL forbids UPDATE OF together with transition tables. Project only
-- membership fields and compare sets before evaluating any page rules.
create function public.catalog_row_memberships(source_table text, r jsonb)
returns setof text language plpgsql stable set search_path = '' as $$
declare base text := 'roblox-items-and-bundles'; c text := r->>'category'; s text := r->>'subcategory';
begin
  if source_table = 'roblox_catalog_items' then
    if r->>'is_deleted' <> 'false' or r->>'name' is null or c is null or s is null or r->>'favorite_count' is null then return; end if;
    if c = any(array['Accessories','Body','Clothing','AvatarAnimations','Makeup']) then return next base; end if;
    if c = 'Accessories' or (c = 'Body' and s = 'HairAccessories') then return next base || '/roblox-accessories'; end if;
    if c = 'Clothing' then return next base || '/roblox-clothing'; end if;
    if c = 'Body' and s <> 'HairAccessories' then return next base || '/roblox-body-parts'; end if;
    if c = 'AvatarAnimations' and s = 'EmoteAnimations' then return next base || '/roblox-emotes'; end if;
    if c = 'AvatarAnimations' and s = 'AnimationBundles' then return next base || '/roblox-animations'; end if;
    if c = 'Makeup' or (r->>'asset_type_id')::int = any(array[76,77,88,89,90]) then return next base || '/roblox-makeup'; end if;
    if c = 'Body' and s = 'HairAccessories' then return next base || '/roblox-accessories/hair-accessories'; end if;
    if c = 'Accessories' and s = 'HeadAccessories' then return next base || '/roblox-accessories/head-accessories'; end if;
    if c = 'Accessories' and s = 'FaceAccessories' then return next base || '/roblox-accessories/face-accessories'; end if;
    if c = 'Accessories' and s = 'NeckAccessories' then return next base || '/roblox-accessories/neck-accessories'; end if;
    if c = 'Accessories' and s = 'ShoulderAccessories' then return next base || '/roblox-accessories/shoulder-accessories'; end if;
    if c = 'Accessories' and s = 'FrontAccessories' then return next base || '/roblox-accessories/front-accessories'; end if;
    if c = 'Accessories' and s = 'BackAccessories' then return next base || '/roblox-accessories/back-accessories'; end if;
    if c = 'Accessories' and s = 'WaistAccessories' then return next base || '/roblox-accessories/waist-accessories'; end if;
    if c = 'Accessories' and s = 'Gear' then return next base || '/roblox-accessories/gear'; end if;
    if c = 'Clothing' and s = 'TShirtAccessories' then return next base || '/roblox-clothing/layered-t-shirts'; end if;
    if c = 'Clothing' and s = 'ShirtAccessories' then return next base || '/roblox-clothing/shirts'; end if;
    if c = 'Clothing' and s = 'SweaterAccessories' then return next base || '/roblox-clothing/sweaters'; end if;
    if c = 'Clothing' and s = 'JacketAccessories' then return next base || '/roblox-clothing/jackets'; end if;
    if c = 'Clothing' and s = 'PantsAccessories' then return next base || '/roblox-clothing/pants'; end if;
    if c = 'Clothing' and s = 'ShortsAccessories' then return next base || '/roblox-clothing/shorts'; end if;
    if c = 'Clothing' and s = 'DressSkirtAccessories' then return next base || '/roblox-clothing/dresses-skirts'; end if;
    if c = 'Clothing' and s = 'ShoesBundles' then return next base || '/roblox-clothing/shoes'; end if;
    if c = 'Clothing' and s = 'ClassicShirts' then return next base || '/roblox-clothing/classic-shirts'; end if;
    if c = 'Clothing' and s = 'ClassicTShirts' then return next base || '/roblox-clothing/classic-t-shirts'; end if;
    if c = 'Clothing' and s = 'ClassicPants' then return next base || '/roblox-clothing/classic-pants'; end if;
    if c = 'Body' and s = 'BodyPartsBundles' then return next base || '/roblox-body-parts/full-bodies'; end if;
    if c = 'Body' and s = 'DynamicHeads' then return next base || '/roblox-body-parts/dynamic-heads'; end if;
    if c = 'Body' and s = 'Heads' then return next base || '/roblox-body-parts/classic-heads'; end if;
    if c = 'Body' and s = 'Faces' then return next base || '/roblox-body-parts/classic-faces'; end if;
  elsif source_table = 'roblox_music_ids' then
    if (r->>'duration_seconds')::numeric > 0 then return next 'roblox-music-ids'; end if;
  elsif source_table = 'roblox_decal_ids' then
    if r->>'status' = 'active' and r->>'thumbnail_state' = 'Completed'
       and r->>'thumbnail_url' is not null and r->>'thumbnail_url' not ilike '%/UnknownImage/%' then
      return next 'roblox-decal-ids';
    end if;
  elsif source_table in ('roblox_font_ids', 'roblox_mesh_ids') then
    if r->>'status' = 'active' and r->>'thumbnail_state' = 'Completed' and r->>'thumbnail_url' is not null then
      return next replace(source_table, '_', '-');
    end if;
  elsif source_table = 'roblox_emote_commands' then
    if r->>'is_published' = 'true' then return next 'roblox-emote-commands'; end if;
  elsif source_table = 'roblox_promo_rewards' then
    if r->>'status' in ('verified_claimable','expired','unavailable') or
       (r->>'status' = 'source_listed_unverified' and r->>'claim_type' = 'experience_code') then
      return next 'roblox-promo-codes';
    end if;
  end if;
end $$;

-- The complex libraries are small indexed subsets, not the full marketplace.
-- Persist identities only, so refreshes and multiple use types do not move dates.
create table public.catalog_membership_snapshots (
  code text primary key, identities text[] not null, updated_at timestamptz not null default now()
);
alter table public.catalog_membership_snapshots enable row level security;
revoke all on public.catalog_membership_snapshots from public, anon, authenticated;
grant all on public.catalog_membership_snapshots to service_role;

create function public.catalog_complex_memberships(family text)
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
$$;

create function public.refresh_catalog_membership_snapshots(family text, touch_dates boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize snapshot readers with writers, including concurrent cron expiry.
  perform pg_catalog.pg_advisory_xact_lock(723461, hashtext(family));
  with desired as materialized (
    select p.code, coalesce(array_agg(distinct m.identity order by m.identity)
      filter (where m.identity is not null), '{}'::text[]) as identities
    from (select code from public.catalog_pages union select 'roblox-decal-ids/curated') p
    left join public.catalog_complex_memberships(family) m on m.code = p.code
    where (family = 'free' and p.code = 'free-roblox-items')
       or (family in ('music','decal') and p.code like 'roblox-' || family || '-ids/games/%')
       or (family = 'decal' and p.code = 'roblox-decal-ids/curated')
    group by p.code
  ), changed as (
    insert into public.catalog_membership_snapshots as saved(code, identities)
    select code, identities from desired
    on conflict(code) do update set identities = excluded.identities, updated_at = now()
    where saved.identities is distinct from excluded.identities
    returning code
  )
  update public.catalog_pages p set updated_at = now()
  where touch_dates and p.code in (select code from changed);
end $$;

create function public.catalog_membership_roblox_catalog_items() returns trigger
language plpgsql security definer set search_path = '' as $$
declare before_rows jsonb := '[]'; after_rows jsonb := '[]';
begin
  if tg_op <> 'INSERT' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into before_rows from (select asset_id, is_deleted, case when name is not null then true end as name, category, subcategory, case when favorite_count is not null then true end as favorite_count, asset_type_id, price_robux, is_for_sale, has_resellers, lowest_resale_price_robux, free_claimability, free_verification_source, free_verified_at from old_rows) r; end if;
  if tg_op <> 'DELETE' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into after_rows from (select asset_id, is_deleted, case when name is not null then true end as name, category, subcategory, case when favorite_count is not null then true end as favorite_count, asset_type_id, price_robux, is_for_sale, has_resellers, lowest_resale_price_robux, free_claimability, free_verification_source, free_verified_at from new_rows) r; end if;
  if not exists ((select value from jsonb_array_elements(before_rows) except select value from jsonb_array_elements(after_rows))
    union all (select value from jsonb_array_elements(after_rows) except select value from jsonb_array_elements(before_rows))) then return null; end if;
  with before_set as materialized (
    select r->>'asset_id' as identity, code from jsonb_array_elements(before_rows) r
    cross join lateral public.catalog_row_memberships('roblox_catalog_items', r) code
  ), after_set as materialized (
    select r->>'asset_id' as identity, code from jsonb_array_elements(after_rows) r
    cross join lateral public.catalog_row_memberships('roblox_catalog_items', r) code
  ), changed as (
    (select * from before_set except select * from after_set)
    union all (select * from after_set except select * from before_set)
  ) update public.catalog_pages p set updated_at = now() where p.code in (select code from changed);
  perform public.refresh_catalog_membership_snapshots('free');
  return null;
end $$;
create trigger catalog_membership_insert after insert on public.roblox_catalog_items referencing new table as new_rows for each statement execute function public.catalog_membership_roblox_catalog_items();
create trigger catalog_membership_delete after delete on public.roblox_catalog_items referencing old table as old_rows for each statement execute function public.catalog_membership_roblox_catalog_items();
create trigger catalog_membership_update after update on public.roblox_catalog_items referencing old table as old_rows new table as new_rows for each statement execute function public.catalog_membership_roblox_catalog_items();
revoke all on function public.catalog_membership_roblox_catalog_items() from public, anon, authenticated;

create function public.catalog_membership_roblox_music_ids() returns trigger
language plpgsql security definer set search_path = '' as $$
declare before_rows jsonb := '[]'; after_rows jsonb := '[]';
begin
  if tg_op <> 'INSERT' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into before_rows from (select asset_id, case when duration_seconds <= 0 or duration_seconds is null then 0 when duration_seconds <= 20 then 10 when duration_seconds < 30 then 25 when duration_seconds <= 600 then 60 else 601 end as duration_seconds from old_rows) r; end if;
  if tg_op <> 'DELETE' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into after_rows from (select asset_id, case when duration_seconds <= 0 or duration_seconds is null then 0 when duration_seconds <= 20 then 10 when duration_seconds < 30 then 25 when duration_seconds <= 600 then 60 else 601 end as duration_seconds from new_rows) r; end if;
  if not exists ((select value from jsonb_array_elements(before_rows) except select value from jsonb_array_elements(after_rows))
    union all (select value from jsonb_array_elements(after_rows) except select value from jsonb_array_elements(before_rows))) then return null; end if;
  with before_set as materialized (
    select r->>'asset_id' as identity, code from jsonb_array_elements(before_rows) r
    cross join lateral public.catalog_row_memberships('roblox_music_ids', r) code
  ), after_set as materialized (
    select r->>'asset_id' as identity, code from jsonb_array_elements(after_rows) r
    cross join lateral public.catalog_row_memberships('roblox_music_ids', r) code
  ), changed as (
    (select * from before_set except select * from after_set)
    union all (select * from after_set except select * from before_set)
  ) update public.catalog_pages p set updated_at = now() where p.code in (select code from changed);
  perform public.refresh_catalog_membership_snapshots('music');
  return null;
end $$;
create trigger catalog_membership_insert after insert on public.roblox_music_ids referencing new table as new_rows for each statement execute function public.catalog_membership_roblox_music_ids();
create trigger catalog_membership_delete after delete on public.roblox_music_ids referencing old table as old_rows for each statement execute function public.catalog_membership_roblox_music_ids();
create trigger catalog_membership_update after update on public.roblox_music_ids referencing old table as old_rows new table as new_rows for each statement execute function public.catalog_membership_roblox_music_ids();
revoke all on function public.catalog_membership_roblox_music_ids() from public, anon, authenticated;

create function public.catalog_membership_roblox_decal_ids() returns trigger
language plpgsql security definer set search_path = '' as $$
declare before_rows jsonb := '[]'; after_rows jsonb := '[]';
begin
  if tg_op <> 'INSERT' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into before_rows from (select asset_id, status, thumbnail_state, case when thumbnail_url is not null and thumbnail_url not ilike '%/UnknownImage/%' then 'image' end as thumbnail_url, texture_id, categories, (curated_rank is not null) as curated_rank, (name ilike '%crosshair%') as name from old_rows) r; end if;
  if tg_op <> 'DELETE' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into after_rows from (select asset_id, status, thumbnail_state, case when thumbnail_url is not null and thumbnail_url not ilike '%/UnknownImage/%' then 'image' end as thumbnail_url, texture_id, categories, (curated_rank is not null) as curated_rank, (name ilike '%crosshair%') as name from new_rows) r; end if;
  if not exists ((select value from jsonb_array_elements(before_rows) except select value from jsonb_array_elements(after_rows))
    union all (select value from jsonb_array_elements(after_rows) except select value from jsonb_array_elements(before_rows))) then return null; end if;
  with before_set as materialized (
    select r->>'asset_id' as identity, code from jsonb_array_elements(before_rows) r
    cross join lateral public.catalog_row_memberships('roblox_decal_ids', r) code
  ), after_set as materialized (
    select r->>'asset_id' as identity, code from jsonb_array_elements(after_rows) r
    cross join lateral public.catalog_row_memberships('roblox_decal_ids', r) code
  ), changed as (
    (select * from before_set except select * from after_set)
    union all (select * from after_set except select * from before_set)
  ) update public.catalog_pages p set updated_at = now() where p.code in (select code from changed);
  perform public.refresh_catalog_membership_snapshots('decal');
  return null;
end $$;
create trigger catalog_membership_insert after insert on public.roblox_decal_ids referencing new table as new_rows for each statement execute function public.catalog_membership_roblox_decal_ids();
create trigger catalog_membership_delete after delete on public.roblox_decal_ids referencing old table as old_rows for each statement execute function public.catalog_membership_roblox_decal_ids();
create trigger catalog_membership_update after update on public.roblox_decal_ids referencing old table as old_rows new table as new_rows for each statement execute function public.catalog_membership_roblox_decal_ids();
revoke all on function public.catalog_membership_roblox_decal_ids() from public, anon, authenticated;

create function public.catalog_membership_roblox_font_ids() returns trigger
language plpgsql security definer set search_path = '' as $$
declare before_rows jsonb := '[]'; after_rows jsonb := '[]';
begin
  if tg_op <> 'INSERT' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into before_rows from (select asset_id, status, thumbnail_state, case when thumbnail_url is not null then true end as thumbnail_url from old_rows) r; end if;
  if tg_op <> 'DELETE' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into after_rows from (select asset_id, status, thumbnail_state, case when thumbnail_url is not null then true end as thumbnail_url from new_rows) r; end if;
  if not exists ((select value from jsonb_array_elements(before_rows) except select value from jsonb_array_elements(after_rows))
    union all (select value from jsonb_array_elements(after_rows) except select value from jsonb_array_elements(before_rows))) then return null; end if;
  with before_set as materialized (
    select r->>'asset_id' as identity, code from jsonb_array_elements(before_rows) r
    cross join lateral public.catalog_row_memberships('roblox_font_ids', r) code
  ), after_set as materialized (
    select r->>'asset_id' as identity, code from jsonb_array_elements(after_rows) r
    cross join lateral public.catalog_row_memberships('roblox_font_ids', r) code
  ), changed as (
    (select * from before_set except select * from after_set)
    union all (select * from after_set except select * from before_set)
  ) update public.catalog_pages p set updated_at = now() where p.code in (select code from changed);
  return null;
end $$;
create trigger catalog_membership_insert after insert on public.roblox_font_ids referencing new table as new_rows for each statement execute function public.catalog_membership_roblox_font_ids();
create trigger catalog_membership_delete after delete on public.roblox_font_ids referencing old table as old_rows for each statement execute function public.catalog_membership_roblox_font_ids();
create trigger catalog_membership_update after update on public.roblox_font_ids referencing old table as old_rows new table as new_rows for each statement execute function public.catalog_membership_roblox_font_ids();
revoke all on function public.catalog_membership_roblox_font_ids() from public, anon, authenticated;

create function public.catalog_membership_roblox_mesh_ids() returns trigger
language plpgsql security definer set search_path = '' as $$
declare before_rows jsonb := '[]'; after_rows jsonb := '[]';
begin
  if tg_op <> 'INSERT' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into before_rows from (select asset_id, status, thumbnail_state, case when thumbnail_url is not null then true end as thumbnail_url from old_rows) r; end if;
  if tg_op <> 'DELETE' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into after_rows from (select asset_id, status, thumbnail_state, case when thumbnail_url is not null then true end as thumbnail_url from new_rows) r; end if;
  if not exists ((select value from jsonb_array_elements(before_rows) except select value from jsonb_array_elements(after_rows))
    union all (select value from jsonb_array_elements(after_rows) except select value from jsonb_array_elements(before_rows))) then return null; end if;
  with before_set as materialized (
    select r->>'asset_id' as identity, code from jsonb_array_elements(before_rows) r
    cross join lateral public.catalog_row_memberships('roblox_mesh_ids', r) code
  ), after_set as materialized (
    select r->>'asset_id' as identity, code from jsonb_array_elements(after_rows) r
    cross join lateral public.catalog_row_memberships('roblox_mesh_ids', r) code
  ), changed as (
    (select * from before_set except select * from after_set)
    union all (select * from after_set except select * from before_set)
  ) update public.catalog_pages p set updated_at = now() where p.code in (select code from changed);
  return null;
end $$;
create trigger catalog_membership_insert after insert on public.roblox_mesh_ids referencing new table as new_rows for each statement execute function public.catalog_membership_roblox_mesh_ids();
create trigger catalog_membership_delete after delete on public.roblox_mesh_ids referencing old table as old_rows for each statement execute function public.catalog_membership_roblox_mesh_ids();
create trigger catalog_membership_update after update on public.roblox_mesh_ids referencing old table as old_rows new table as new_rows for each statement execute function public.catalog_membership_roblox_mesh_ids();
revoke all on function public.catalog_membership_roblox_mesh_ids() from public, anon, authenticated;

create function public.catalog_membership_roblox_emote_commands() returns trigger
language plpgsql security definer set search_path = '' as $$
declare before_rows jsonb := '[]'; after_rows jsonb := '[]';
begin
  if tg_op <> 'INSERT' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into before_rows from (select code, is_published from old_rows) r; end if;
  if tg_op <> 'DELETE' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into after_rows from (select code, is_published from new_rows) r; end if;
  if not exists ((select value from jsonb_array_elements(before_rows) except select value from jsonb_array_elements(after_rows))
    union all (select value from jsonb_array_elements(after_rows) except select value from jsonb_array_elements(before_rows))) then return null; end if;
  with before_set as materialized (
    select r->>'code' as identity, code from jsonb_array_elements(before_rows) r
    cross join lateral public.catalog_row_memberships('roblox_emote_commands', r) code
  ), after_set as materialized (
    select r->>'code' as identity, code from jsonb_array_elements(after_rows) r
    cross join lateral public.catalog_row_memberships('roblox_emote_commands', r) code
  ), changed as (
    (select * from before_set except select * from after_set)
    union all (select * from after_set except select * from before_set)
  ) update public.catalog_pages p set updated_at = now() where p.code in (select code from changed);
  return null;
end $$;
create trigger catalog_membership_insert after insert on public.roblox_emote_commands referencing new table as new_rows for each statement execute function public.catalog_membership_roblox_emote_commands();
create trigger catalog_membership_delete after delete on public.roblox_emote_commands referencing old table as old_rows for each statement execute function public.catalog_membership_roblox_emote_commands();
create trigger catalog_membership_update after update on public.roblox_emote_commands referencing old table as old_rows new table as new_rows for each statement execute function public.catalog_membership_roblox_emote_commands();
revoke all on function public.catalog_membership_roblox_emote_commands() from public, anon, authenticated;

create function public.catalog_membership_roblox_promo_rewards() returns trigger
language plpgsql security definer set search_path = '' as $$
declare before_rows jsonb := '[]'; after_rows jsonb := '[]';
begin
  if tg_op <> 'INSERT' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into before_rows from (select id, status, claim_type from old_rows) r; end if;
  if tg_op <> 'DELETE' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into after_rows from (select id, status, claim_type from new_rows) r; end if;
  if not exists ((select value from jsonb_array_elements(before_rows) except select value from jsonb_array_elements(after_rows))
    union all (select value from jsonb_array_elements(after_rows) except select value from jsonb_array_elements(before_rows))) then return null; end if;
  with before_set as materialized (
    select r->>'id' as identity, code from jsonb_array_elements(before_rows) r
    cross join lateral public.catalog_row_memberships('roblox_promo_rewards', r) code
  ), after_set as materialized (
    select r->>'id' as identity, code from jsonb_array_elements(after_rows) r
    cross join lateral public.catalog_row_memberships('roblox_promo_rewards', r) code
  ), changed as (
    (select * from before_set except select * from after_set)
    union all (select * from after_set except select * from before_set)
  ) update public.catalog_pages p set updated_at = now() where p.code in (select code from changed);
  return null;
end $$;
create trigger catalog_membership_insert after insert on public.roblox_promo_rewards referencing new table as new_rows for each statement execute function public.catalog_membership_roblox_promo_rewards();
create trigger catalog_membership_delete after delete on public.roblox_promo_rewards referencing old table as old_rows for each statement execute function public.catalog_membership_roblox_promo_rewards();
create trigger catalog_membership_update after update on public.roblox_promo_rewards referencing old table as old_rows new table as new_rows for each statement execute function public.catalog_membership_roblox_promo_rewards();
revoke all on function public.catalog_membership_roblox_promo_rewards() from public, anon, authenticated;

create function public.catalog_membership_roblox_music_id_game_usage() returns trigger
language plpgsql security definer set search_path = '' as $$
declare before_rows jsonb := '[]'; after_rows jsonb := '[]';
begin
  if tg_op <> 'INSERT' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into before_rows from (select game_slug, asset_id, compatibility_status from old_rows) r; end if;
  if tg_op <> 'DELETE' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into after_rows from (select game_slug, asset_id, compatibility_status from new_rows) r; end if;
  if not exists ((select value from jsonb_array_elements(before_rows) except select value from jsonb_array_elements(after_rows))
    union all (select value from jsonb_array_elements(after_rows) except select value from jsonb_array_elements(before_rows))) then return null; end if;
  perform public.refresh_catalog_membership_snapshots('music');
  return null;
end $$;
create trigger catalog_membership_insert after insert on public.roblox_music_id_game_usage referencing new table as new_rows for each statement execute function public.catalog_membership_roblox_music_id_game_usage();
create trigger catalog_membership_delete after delete on public.roblox_music_id_game_usage referencing old table as old_rows for each statement execute function public.catalog_membership_roblox_music_id_game_usage();
create trigger catalog_membership_update after update on public.roblox_music_id_game_usage referencing old table as old_rows new table as new_rows for each statement execute function public.catalog_membership_roblox_music_id_game_usage();
revoke all on function public.catalog_membership_roblox_music_id_game_usage() from public, anon, authenticated;

create function public.catalog_membership_roblox_decal_id_game_usage() returns trigger
language plpgsql security definer set search_path = '' as $$
declare before_rows jsonb := '[]'; after_rows jsonb := '[]';
begin
  if tg_op <> 'INSERT' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into before_rows from (select game_slug, asset_id, compatibility_status, texture_id from old_rows) r; end if;
  if tg_op <> 'DELETE' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into after_rows from (select game_slug, asset_id, compatibility_status, texture_id from new_rows) r; end if;
  if not exists ((select value from jsonb_array_elements(before_rows) except select value from jsonb_array_elements(after_rows))
    union all (select value from jsonb_array_elements(after_rows) except select value from jsonb_array_elements(before_rows))) then return null; end if;
  perform public.refresh_catalog_membership_snapshots('decal');
  return null;
end $$;
create trigger catalog_membership_insert after insert on public.roblox_decal_id_game_usage referencing new table as new_rows for each statement execute function public.catalog_membership_roblox_decal_id_game_usage();
create trigger catalog_membership_delete after delete on public.roblox_decal_id_game_usage referencing old table as old_rows for each statement execute function public.catalog_membership_roblox_decal_id_game_usage();
create trigger catalog_membership_update after update on public.roblox_decal_id_game_usage referencing old table as old_rows new table as new_rows for each statement execute function public.catalog_membership_roblox_decal_id_game_usage();
revoke all on function public.catalog_membership_roblox_decal_id_game_usage() from public, anon, authenticated;

select public.refresh_catalog_membership_snapshots('music', false);
select public.refresh_catalog_membership_snapshots('decal', false);
select public.refresh_catalog_membership_snapshots('free', false);
update public.catalog_membership_snapshots set updated_at = coalesce((select updated_at from public.catalog_pages where code = 'roblox-decal-ids'), now()) where code = 'roblox-decal-ids/curated';
revoke all on function public.catalog_row_memberships(text,jsonb) from public, anon, authenticated;
revoke all on function public.catalog_complex_memberships(text) from public, anon, authenticated;
revoke all on function public.refresh_catalog_membership_snapshots(text,boolean) from public, anon, authenticated;
grant execute on function public.refresh_catalog_membership_snapshots(text,boolean) to service_role;

-- Expiry changes membership without a write. Use the existing database cron runner.
select cron.schedule('catalog-free-membership-expiry', '* * * * *',
  $cron$select public.refresh_catalog_membership_snapshots('free');$cron$);
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

  -- p_touch_catalog is retained for old workers; membership triggers own dates.

  return jsonb_build_object(
    'seen_count', v_seen_count,
    'missing_updated', v_missing_updated,
    'retired', v_retired,
    'catalog_touched', v_catalog_touched
  );
end;
$$;


-- Preserve cache refreshes for metadata and ordering, once per statement rather
-- than once per item. The queue also deduplicates by (entity_type, slug).
create function public.catalog_data_revalidation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.enqueue_revalidation(tg_argv[0], tg_argv[1], 'catalog_data_' || lower(tg_op));
  return null;
end $$;
revoke all on function public.catalog_data_revalidation() from public, anon, authenticated;
drop trigger if exists trg_enqueue_revalidation_music_ids on public.roblox_music_ids;
create trigger catalog_data_revalidation after insert or update or delete on public.roblox_music_ids for each statement execute function public.catalog_data_revalidation('catalog', 'roblox-music-ids');
drop trigger if exists trg_enqueue_revalidation_decal_ids on public.roblox_decal_ids;
create trigger catalog_data_revalidation after insert or update or delete on public.roblox_decal_ids for each statement execute function public.catalog_data_revalidation('catalog', 'roblox-decal-ids');
drop trigger if exists trg_enqueue_revalidation_promo_rewards on public.roblox_promo_rewards;
create trigger catalog_data_revalidation after insert or update or delete on public.roblox_promo_rewards for each statement execute function public.catalog_data_revalidation('catalog', 'roblox-promo-codes');
drop trigger if exists trg_enqueue_revalidation_music_game_usage on public.roblox_music_id_game_usage;
create trigger catalog_data_revalidation after insert or update or delete on public.roblox_music_id_game_usage for each statement execute function public.catalog_data_revalidation('catalog', 'roblox-music-ids');
drop trigger if exists trg_enqueue_revalidation_decal_game_usage on public.roblox_decal_id_game_usage;
create trigger catalog_data_revalidation after insert or update or delete on public.roblox_decal_id_game_usage for each statement execute function public.catalog_data_revalidation('catalog', 'roblox-decal-ids');
