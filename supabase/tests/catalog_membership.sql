do $$ begin
  if not exists(select from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create function public.enqueue_revalidation(text,text,text) returns void language plpgsql as $$ begin return; end $$;
create schema cron;
create function cron.schedule(text,text,text) returns bigint language sql as $$ select 1::bigint $$;
create table public.catalog_pages(code text primary key, updated_at timestamptz default '2000-01-01');
create table public.roblox_catalog_items (
 asset_id bigint primary key, is_deleted boolean default false, name text default 'Item', category text,
 subcategory text, favorite_count bigint default 0, asset_type_id int,
 price_robux bigint, is_for_sale boolean, has_resellers boolean, lowest_resale_price_robux bigint,
 free_claimability text, free_verification_source text, free_verified_at timestamptz,
 verified_at timestamptz, thumbnail_url text
);
create table public.roblox_music_ids(asset_id bigint primary key, duration_seconds numeric, rank int, verified_at timestamptz, source text);
create table public.roblox_decal_ids(asset_id bigint primary key, status text, thumbnail_state text, thumbnail_url text, texture_id bigint, categories text[], curated_rank int, name text, verified_at timestamptz);
create table public.roblox_font_ids(asset_id bigint primary key, status text, thumbnail_state text, thumbnail_url text);
create table public.roblox_mesh_ids(like public.roblox_font_ids including all);
create table public.roblox_emote_commands(code text primary key, is_published boolean, sort_order int);
create table public.roblox_promo_rewards(id bigint primary key, status text, claim_type text);
create table public.roblox_music_id_game_usage(game_slug text, asset_id bigint, compatibility_status text, primary key(game_slug,asset_id));
create table public.roblox_decal_id_game_usage(game_slug text, asset_id bigint, compatibility_status text, texture_id bigint, primary key(game_slug,asset_id));
create view public.roblox_music_ids_game_view as select game_slug, asset_id from public.roblox_music_id_game_usage where compatibility_status <> 'failed';
create view public.roblox_decal_ids_game_view as select u.game_slug, u.asset_id, coalesce(d.texture_id,u.texture_id) texture_id from public.roblox_decal_id_game_usage u left join public.roblox_decal_ids d using(asset_id) where compatibility_status <> 'failed';
insert into public.catalog_pages(code) values
 ('roblox-items-and-bundles'), ('roblox-items-and-bundles/roblox-accessories'),
 ('roblox-items-and-bundles/roblox-accessories/hair-accessories'), ('roblox-items-and-bundles/roblox-clothing'),
 ('free-roblox-items'), ('roblox-music-ids'), ('roblox-music-ids/games/forsaken'),
 ('roblox-decal-ids'), ('roblox-decal-ids/games/bloxburg'), ('roblox-font-ids'), ('roblox-mesh-ids'),
 ('roblox-emote-commands'), ('roblox-promo-codes');
-- APPLY MIGRATION HERE
create temp table touches(code text);
create function pg_temp.record_touch() returns trigger language plpgsql as $$ begin insert into touches values(new.code); return new; end $$;
create trigger record_touch after update on public.catalog_pages for each row execute function pg_temp.record_touch();
create function pg_temp.check_touch(c text, expected bigint) returns void language plpgsql as $$
declare actual bigint; begin select count(*) into actual from touches where code=c;
 if actual <> expected then raise exception '% expected % touches, got %',c,expected,actual; end if;
end $$;

-- One catalog update per affected page, even for a bulk insert.
insert into public.roblox_catalog_items(asset_id, category, subcategory) values (1,'Body','HairAccessories'), (2,'Body','HairAccessories');
select pg_temp.check_touch('roblox-items-and-bundles',1);
select pg_temp.check_touch('roblox-items-and-bundles/roblox-accessories/hair-accessories',1);
truncate touches;
update public.roblox_catalog_items set favorite_count=100, verified_at=now(), thumbnail_url='changed';
select pg_temp.check_touch('roblox-items-and-bundles',0);
update public.roblox_catalog_items set name='Renamed';
select pg_temp.check_touch('roblox-items-and-bundles',0);
update public.roblox_catalog_items set category='Clothing', subcategory='ClassicShirts' where asset_id=1;
select pg_temp.check_touch('roblox-items-and-bundles',0);
select pg_temp.check_touch('roblox-items-and-bundles/roblox-accessories',1);
select pg_temp.check_touch('roblox-items-and-bundles/roblox-clothing',1);
truncate touches;
update public.roblox_catalog_items set is_deleted=true;
select pg_temp.check_touch('roblox-items-and-bundles',1);

truncate touches;
insert into public.roblox_music_ids(asset_id,duration_seconds,rank,verified_at) values(10,10,1,null),(20,null,2,null);
select pg_temp.check_touch('roblox-music-ids',1);
select pg_temp.check_touch('roblox-music-ids/games/forsaken',1);
truncate touches;
update public.roblox_music_ids set rank=20, verified_at=now();
select pg_temp.check_touch('roblox-music-ids',0);
update public.roblox_music_ids set duration_seconds=12 where asset_id=10;
select pg_temp.check_touch('roblox-music-ids',0);
select pg_temp.check_touch('roblox-music-ids/games/forsaken',0);
insert into public.roblox_music_id_game_usage values ('forsaken',99,'untested');
select pg_temp.check_touch('roblox-music-ids/games/forsaken',1);
truncate touches;
update public.roblox_music_id_game_usage set compatibility_status='tested';
select pg_temp.check_touch('roblox-music-ids/games/forsaken',0);
delete from public.roblox_music_id_game_usage;
select pg_temp.check_touch('roblox-music-ids/games/forsaken',1);

truncate touches;
insert into public.roblox_font_ids values (1,'active','Pending',null);
select pg_temp.check_touch('roblox-font-ids',0);
update public.roblox_font_ids set thumbnail_state='Completed',thumbnail_url='image';
select pg_temp.check_touch('roblox-font-ids',1);
truncate touches;
update public.roblox_font_ids set thumbnail_url='new-image';
select pg_temp.check_touch('roblox-font-ids',0);
delete from public.roblox_font_ids;
select pg_temp.check_touch('roblox-font-ids',1);

truncate touches;
insert into public.roblox_promo_rewards values(1,'source_listed_unverified','web_promo_code');
select pg_temp.check_touch('roblox-promo-codes',0);
update public.roblox_promo_rewards set status='verified_claimable';
select pg_temp.check_touch('roblox-promo-codes',1);
truncate touches;
update public.roblox_promo_rewards set status='expired';
select pg_temp.check_touch('roblox-promo-codes',0);
update public.roblox_promo_rewards set status='inactive';
select pg_temp.check_touch('roblox-promo-codes',1);

truncate touches;
insert into public.roblox_catalog_items(asset_id,category,subcategory,price_robux,is_for_sale,has_resellers,lowest_resale_price_robux,free_claimability,free_verification_source,free_verified_at)
values(3,'Clothing','ClassicShirts',0,true,false,0,'direct','roblox',now());
select pg_temp.check_touch('free-roblox-items',1);
truncate touches;
update public.roblox_catalog_items set free_verified_at=now()+interval '1 minute' where asset_id=3;
select pg_temp.check_touch('free-roblox-items',0);
update public.roblox_catalog_items set free_verified_at=now()-interval '73 hours' where asset_id=3;
select pg_temp.check_touch('free-roblox-items',1);
truncate touches;
select public.refresh_catalog_membership_snapshots('free');
select pg_temp.check_touch('free-roblox-items',0);

truncate touches;
insert into public.roblox_decal_ids values(10,'active','Completed','image',10,array['posters'],1,'Poster',null);
select pg_temp.check_touch('roblox-decal-ids',1);
select pg_temp.check_touch('roblox-decal-ids/games/bloxburg',1);
truncate touches;
update public.roblox_decal_ids set curated_rank=2,verified_at=now(),thumbnail_url='new-image';
select pg_temp.check_touch('roblox-decal-ids',0);
select pg_temp.check_touch('roblox-decal-ids/games/bloxburg',0);
update public.roblox_decal_ids set status='inactive';
select pg_temp.check_touch('roblox-decal-ids',1);
select pg_temp.check_touch('roblox-decal-ids/games/bloxburg',1);

-- Derived charts use their own item sets, not last_seen_at or rank order.
update public.catalog_membership_snapshots set updated_at='2000-01-01' where code='roblox-music-ids/trending';
update public.roblox_music_ids set rank=30 where asset_id=10;
do $$ begin
 if (select updated_at from public.catalog_membership_snapshots where code='roblox-music-ids/trending') <> '2000-01-01'::timestamptz then raise exception 'Reranking changed chart date'; end if;
end $$;
update public.roblox_music_ids set rank=501 where asset_id=10;
do $$ begin
 if (select updated_at from public.catalog_membership_snapshots where code='roblox-music-ids/trending') = '2000-01-01'::timestamptz then raise exception 'Chart removal did not change date'; end if;
end $$;
insert into public.roblox_emote_commands values('wave',true,1);
truncate touches;
update public.roblox_emote_commands set sort_order=2;
select pg_temp.check_touch('roblox-emote-commands',0);
update public.roblox_emote_commands set is_published=false;
select pg_temp.check_touch('roblox-emote-commands',1);
