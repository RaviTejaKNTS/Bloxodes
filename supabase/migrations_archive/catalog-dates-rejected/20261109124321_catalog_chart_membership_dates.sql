-- Chart dates compare their visible sets, ignoring rank order within the set.
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

create or replace function public.refresh_catalog_membership_snapshots(family text, touch_dates boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize snapshot readers with writers, including concurrent cron expiry.
  perform pg_catalog.pg_advisory_xact_lock(723461, hashtext(family));
  with desired as materialized (
    select p.code, coalesce(array_agg(distinct m.identity order by m.identity)
      filter (where m.identity is not null), '{}'::text[]) as identities
    from (select code from public.catalog_pages union select unnest(array['roblox-decal-ids/curated','roblox-music-ids/trending','roblox-music-ids/weekly','roblox-music-ids/monthly','roblox-music-ids/yearly'])) p
    left join public.catalog_complex_memberships(family) m on m.code = p.code
    where (family = 'free' and p.code = 'free-roblox-items')
       or (family in ('music','decal') and p.code like 'roblox-' || family || '-ids/games/%')
       or (family = 'decal' and p.code = 'roblox-decal-ids/curated')
       or (family = 'music' and p.code in ('roblox-music-ids/trending','roblox-music-ids/weekly','roblox-music-ids/monthly','roblox-music-ids/yearly'))
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

create or replace function public.catalog_membership_roblox_music_ids() returns trigger
language plpgsql security definer set search_path = '' as $$
declare before_rows jsonb := '[]'; after_rows jsonb := '[]';
begin
  if tg_op <> 'INSERT' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into before_rows from (select asset_id, case when duration_seconds <= 0 or duration_seconds is null then 0 when duration_seconds <= 20 then 10 when duration_seconds < 30 then 25 when duration_seconds <= 600 then 60 else 601 end as duration_seconds, (rank <= 500) as in_chart, source from old_rows) r; end if;
  if tg_op <> 'DELETE' then select coalesce(jsonb_agg(to_jsonb(r)), '[]') into after_rows from (select asset_id, case when duration_seconds <= 0 or duration_seconds is null then 0 when duration_seconds <= 20 then 10 when duration_seconds < 30 then 25 when duration_seconds <= 600 then 60 else 601 end as duration_seconds, (rank <= 500) as in_chart, source from new_rows) r; end if;
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
select public.refresh_catalog_membership_snapshots('music', false);
update public.catalog_membership_snapshots set updated_at = coalesce((select updated_at from public.catalog_pages where code='roblox-music-ids'), now()) where code in ('roblox-music-ids/trending','roblox-music-ids/weekly','roblox-music-ids/monthly','roblox-music-ids/yearly');
