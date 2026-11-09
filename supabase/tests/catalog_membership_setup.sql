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
