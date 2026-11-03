begin;
set local lock_timeout = '3s';
select pg_advisory_xact_lock(7823462194301);

-- Prerequisite for 20261103000000: accept only the nine reviewed link repairs.
-- Hashes computed with PostgreSQL jsonb::text SHA-256 through read-only managed
-- SQL constant expressions from the frozen production before/after inventory.
-- All nine before hashes match 20261006114258; no geometry/assets/prose changed.
-- Keep old snapshots valid for repeat imports and environments without map rows.
create or replace function public.valid_gta_map_snapshot(slug text, renderer text, data jsonb)
returns boolean language sql immutable set search_path='' as $$
 select renderer=case when slug='gta5' then 'gta5' else 'gta-layered' end
 and encode(extensions.digest(data::text,'sha256'),'hex') = any(case slug
 when 'gta-4' then array['393f66b8f803a7b34bb6396cfe605fcc7b20d964964e9d70cbd7bf6506085b68','a0d29c2262a9e61688d26275d727567430ed6491240b4fcab605cf46b71c58fb']
 when 'gta-chinatown-wars' then array['8fee8a2fbaacdc387c84aabff030cf13c110262caf9d8450781a7b998a137832','13d726d8ede6010bf897420ef51e6d2b91ae653cd36c23c93af8cc65f5c0c6b0']
 when 'gta-iii' then array['7243483239cf9ded6f8a4ae5d82d47802380fa27160041db94451894fafc789f','28b7fa8bd98af52e8ac1c8c17554e43f8f7fa1d6c79aba8d7d3759e687df8994']
 when 'gta-liberty-city-stories' then array['e971f3fb8934fccf58a79a1d562f1b826a7d5d332bcaa2692ca325bd7941b64a','a952bbe246eaf40e6789d55a64622960351fd1ed62646eef7d0c186b951d8f8c']
 when 'gta-online' then array['ecafbe58217508c6ad4e1e48157bcf46f1cd48b30dcd6a455fb5f0c59688c335','9372b2da788ba539444d72df2cbc01193d56c0d0697f0d14202fd143d1fd1eab']
 when 'gta-san-andreas' then array['0f47f7b10c793147d2cf777c75a65005f51dd773f392bc197a45f05bb57ffb19','c4837a51bdd738d1df4e0ff33cbd4e43a5c636b0cbdc1b96bb4cfcd4306fd091']
 when 'gta-vice-city' then array['fd5752da5114de9c2da000e926437651cb283b86ca52096f7e1758b72f9196d4','2c8f59e33dec523533d973f0adb9a9273108819e6ff0b790b7490ed6012baa6b']
 when 'gta-vice-city-stories' then array['3506028acc165c5892f23c8a3d6d98abfd989e67bd34452203ec1714b951ca20','506ef0d9c5062b7f738b48d2ab2f468fa4817092a36da17cd885c9e644e0e6bc']
 when 'gta5' then array['5a01530f556e974af20f28e02d9e2620d51af2cd8ccd8298c1e59b78eb5ece1f','a5ff08cc94a3821809263e8ec7bac0fe04e000fbff814ba4f12dd5303ddce31e']
 else null::text[] end)
$$;
-- CREATE OR REPLACE preserves the existing service-only ACL. Keep it explicit.
revoke all on function public.valid_gta_map_snapshot(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.valid_gta_map_snapshot(text,text,jsonb) to service_role;

-- Map UUIDs differ between environments. Transform only exact approved old
-- snapshots by namespace/slug, preserving IDs, ownership, assets and all other
-- fields. Already-canonical maps are no-ops. Current route targets must match.
select set_config('bloxodes.url_move_namespace','gta',true);
do $maps$
declare m record; link record;
begin
 for m in select * from jsonb_to_recordset('[{"slug":"gta5","renderer":"gta5","before_hash":"5a01530f556e974af20f28e02d9e2620d51af2cd8ccd8298c1e59b78eb5ece1f","mapping":{"/gta/wiki/gta-5/spaceship-parts":"/wiki/gta-5/spaceship-parts","/gta/wiki/gta-5/letter-scraps":"/wiki/gta-5/letter-scraps","/gta/wiki/gta-5/nuclear-waste":"/wiki/gta-5/nuclear-waste","/gta/wiki/gta-5/submarine-pieces":"/wiki/gta-5/submarine-pieces","/gta/wiki/gta-5/monkey-mosaics":"/wiki/gta-5/monkey-mosaics","/gta/wiki/gta-5/peyote-plants":"/wiki/gta-5/peyote-plants","/gta/wiki/gta-5/epsilon-tracts":"/wiki/gta-5/epsilon-tracts","/gta/wiki/gta-5/hidden-packages":"/wiki/gta-5/hidden-packages","/gta/wiki/gta-5/stunt-jumps":"/wiki/gta-5/stunt-jumps","/gta/wiki/gta-5/under-the-bridge":"/wiki/gta-5/under-the-bridge","/gta/wiki/gta-5/knife-flights":"/wiki/gta-5/knife-flights"},"collections":["/gta/wiki/gta-5/spaceship-parts","/gta/wiki/gta-5/letter-scraps","/gta/wiki/gta-5/nuclear-waste","/gta/wiki/gta-5/submarine-pieces","/gta/wiki/gta-5/monkey-mosaics","/gta/wiki/gta-5/peyote-plants","/gta/wiki/gta-5/epsilon-tracts","/gta/wiki/gta-5/hidden-packages","/gta/wiki/gta-5/stunt-jumps","/gta/wiki/gta-5/under-the-bridge","/gta/wiki/gta-5/knife-flights"]},{"slug":"gta-chinatown-wars","renderer":"gta-layered","before_hash":"8fee8a2fbaacdc387c84aabff030cf13c110262caf9d8450781a7b998a137832","mapping":{"/gta/maps/gta-chinatown-wars":"/maps/gta-chinatown-wars","/gta/wiki/gta-chinatown-wars/random-encounters":"/wiki/gta-chinatown-wars/random-encounters","/gta/wiki/gta-chinatown-wars/lions-of-fo":"/wiki/gta-chinatown-wars/lions-of-fo"},"collections":["/gta/wiki/gta-chinatown-wars/random-encounters","/gta/wiki/gta-chinatown-wars/lions-of-fo"]},{"slug":"gta-san-andreas","renderer":"gta-layered","before_hash":"0f47f7b10c793147d2cf777c75a65005f51dd773f392bc197a45f05bb57ffb19","mapping":{"/gta/maps/gta-san-andreas":"/maps/gta-san-andreas","/gta/wiki/gta-san-andreas/import-export":"/wiki/gta-san-andreas/import-export"},"collections":["/gta/wiki/gta-san-andreas/import-export"]},{"slug":"gta-liberty-city-stories","renderer":"gta-layered","before_hash":"e971f3fb8934fccf58a79a1d562f1b826a7d5d332bcaa2692ca325bd7941b64a","mapping":{"/gta/maps/gta-liberty-city-stories":"/maps/gta-liberty-city-stories"},"collections":[]},{"slug":"gta-online","renderer":"gta-layered","before_hash":"ecafbe58217508c6ad4e1e48157bcf46f1cd48b30dcd6a455fb5f0c59688c335","mapping":{"/gta/maps/gta-online":"/maps/gta-online","/gta/wiki/gta-online/action-figures":"/wiki/gta-online/action-figures","/gta/wiki/gta-online/playing-cards":"/wiki/gta-online/playing-cards","/gta/wiki/gta-online/signal-jammers":"/wiki/gta-online/signal-jammers","/gta/wiki/gta-online/media-sticks":"/wiki/gta-online/media-sticks","/gta/wiki/gta-online/movie-props":"/wiki/gta-online/movie-props","/gta/wiki/gta-online/peyote-plants":"/wiki/gta-online/peyote-plants"},"collections":["/gta/wiki/gta-online/action-figures","/gta/wiki/gta-online/playing-cards","/gta/wiki/gta-online/signal-jammers","/gta/wiki/gta-online/media-sticks","/gta/wiki/gta-online/movie-props","/gta/wiki/gta-online/peyote-plants"]},{"slug":"gta-vice-city","renderer":"gta-layered","before_hash":"fd5752da5114de9c2da000e926437651cb283b86ca52096f7e1758b72f9196d4","mapping":{"/gta/maps/gta-vice-city":"/maps/gta-vice-city"},"collections":[]},{"slug":"gta-vice-city-stories","renderer":"gta-layered","before_hash":"3506028acc165c5892f23c8a3d6d98abfd989e67bd34452203ec1714b951ca20","mapping":{"/gta/maps/gta-vice-city-stories":"/maps/gta-vice-city-stories"},"collections":[]},{"slug":"gta-iii","renderer":"gta-layered","before_hash":"7243483239cf9ded6f8a4ae5d82d47802380fa27160041db94451894fafc789f","mapping":{"/gta/maps/gta-iii":"/maps/gta-iii"},"collections":[]},{"slug":"gta-4","renderer":"gta-layered","before_hash":"393f66b8f803a7b34bb6396cfe605fcc7b20d964964e9d70cbd7bf6506085b68","mapping":{"/gta/maps/gta-4":"/maps/gta-4","/gta/wiki/gta-4/side-missions-activities":"/wiki/gta-4/side-missions-activities","/gta/wiki/gta-4-tlad/angus-bike-thefts":"/wiki/gta-4-tlad/angus-bike-thefts","/gta/wiki/gta-4-tlad/bike-races":"/wiki/gta-4-tlad/bike-races","/gta/wiki/gta-4-tbogt/base-jumps":"/wiki/gta-4-tbogt/base-jumps"},"collections":["/gta/wiki/gta-4/side-missions-activities","/gta/wiki/gta-4-tlad/angus-bike-thefts","/gta/wiki/gta-4-tlad/bike-races","/gta/wiki/gta-4-tbogt/base-jumps"]}]'::jsonb)
  v(slug text,renderer text,before_hash text,mapping jsonb,collections jsonb)
 loop
  for link in select key,value from jsonb_each_text(m.mapping) loop
   if not exists(select 1 from public.site_routes r where r.path=link.key
    and r.status='old' and public.site_route_target(r,r.path)=link.value) then
    raise exception 'Reviewed map link destination changed: %',link.key;
   end if;
  end loop;
  update public.game_map_pages p
   set map_data=public.rewrite_game_url_links(p.map_data,m.mapping,m.collections)
   where p.namespace='gta' and p.slug=m.slug and p.renderer_key=m.renderer
    and encode(extensions.digest(p.map_data::text,'sha256'),'hex')=m.before_hash;
 end loop;
end $maps$;
select set_config('bloxodes.url_move_namespace','',true);
select public.refresh_game_content_index('gta');
commit;
