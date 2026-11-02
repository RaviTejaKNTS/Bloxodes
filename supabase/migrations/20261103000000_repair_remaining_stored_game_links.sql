begin;
set local lock_timeout = '3s';
select pg_advisory_xact_lock(7823462194301);

-- Exact link-only repair of the reviewed production row/field inventory.
-- Each row uses only mappings actually found in that field, avoiding the
-- namespace-wide 325-mapping scan. Rewrite the current value, never a frozen
-- copy: concurrent prose edits, queries, fragments and asset paths survive.
-- Reuse the existing transaction-local search deferral: page triggers still
-- queue revalidation; rebuild search once per namespace after all updates.
-- Missing development rows are left alone; changed route targets fail closed.
do $$
begin
 if not exists(select 1 from public.site_routes r where r.path='/gta/maps/gta-4' and r.status='old' and public.site_route_target(r,r.path)='/maps/gta-4') then
  raise exception 'Reviewed link destination changed: %', '/gta/maps/gta-4';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/maps/gta-chinatown-wars' and r.status='old' and public.site_route_target(r,r.path)='/maps/gta-chinatown-wars') then
  raise exception 'Reviewed link destination changed: %', '/gta/maps/gta-chinatown-wars';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/maps/gta-iii' and r.status='old' and public.site_route_target(r,r.path)='/maps/gta-iii') then
  raise exception 'Reviewed link destination changed: %', '/gta/maps/gta-iii';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/maps/gta-liberty-city-stories' and r.status='old' and public.site_route_target(r,r.path)='/maps/gta-liberty-city-stories') then
  raise exception 'Reviewed link destination changed: %', '/gta/maps/gta-liberty-city-stories';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/maps/gta-online' and r.status='old' and public.site_route_target(r,r.path)='/maps/gta-online') then
  raise exception 'Reviewed link destination changed: %', '/gta/maps/gta-online';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/maps/gta-san-andreas' and r.status='old' and public.site_route_target(r,r.path)='/maps/gta-san-andreas') then
  raise exception 'Reviewed link destination changed: %', '/gta/maps/gta-san-andreas';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/maps/gta-vice-city' and r.status='old' and public.site_route_target(r,r.path)='/maps/gta-vice-city') then
  raise exception 'Reviewed link destination changed: %', '/gta/maps/gta-vice-city';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/maps/gta-vice-city-stories' and r.status='old' and public.site_route_target(r,r.path)='/maps/gta-vice-city-stories') then
  raise exception 'Reviewed link destination changed: %', '/gta/maps/gta-vice-city-stories';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-4-tbogt/base-jumps' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-4-tbogt/base-jumps') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-4-tbogt/base-jumps';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-4-tlad/angus-bike-thefts' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-4-tlad/angus-bike-thefts') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-4-tlad/angus-bike-thefts';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-4-tlad/bike-races' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-4-tlad/bike-races') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-4-tlad/bike-races';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-4/side-missions-activities' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-4/side-missions-activities') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-4/side-missions-activities';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-4/vehicles' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-4/vehicles') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-4/vehicles';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-5' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-5') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-5';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-5/epsilon-tracts' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-5/epsilon-tracts') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-5/epsilon-tracts';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-5/heists' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-5/heists') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-5/heists';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-5/hidden-packages' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-5/hidden-packages') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-5/hidden-packages';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-5/hobbies-and-pastimes' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-5/hobbies-and-pastimes') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-5/hobbies-and-pastimes';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-5/knife-flights' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-5/knife-flights') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-5/knife-flights';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-5/letter-scraps' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-5/letter-scraps') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-5/letter-scraps';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-5/monkey-mosaics' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-5/monkey-mosaics') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-5/monkey-mosaics';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-5/nuclear-waste' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-5/nuclear-waste') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-5/nuclear-waste';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-5/peyote-plants' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-5/peyote-plants') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-5/peyote-plants';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-5/properties' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-5/properties') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-5/properties';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-5/random-events' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-5/random-events') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-5/random-events';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-5/spaceship-parts' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-5/spaceship-parts') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-5/spaceship-parts';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-5/story-missions' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-5/story-missions') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-5/story-missions';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-5/strangers-and-freaks' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-5/strangers-and-freaks') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-5/strangers-and-freaks';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-5/stunt-jumps' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-5/stunt-jumps') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-5/stunt-jumps';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-5/submarine-pieces' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-5/submarine-pieces') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-5/submarine-pieces';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-5/under-the-bridge' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-5/under-the-bridge') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-5/under-the-bridge';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-6/businesses-and-brands' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-6/businesses-and-brands') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-6/businesses-and-brands';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-6/characters' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-6/characters') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-6/characters';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-6/editions' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-6/editions') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-6/editions';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-6/locations' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-6/locations') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-6/locations';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-6/official-album-tracks' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-6/official-album-tracks') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-6/official-album-tracks';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-6/official-media' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-6/official-media') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-6/official-media';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-6/trailers' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-6/trailers') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-6/trailers';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-6/vehicles' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-6/vehicles') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-6/vehicles';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-6/weapons' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-6/weapons') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-6/weapons';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-6/wildlife' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-6/wildlife') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-6/wildlife';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-chinatown-wars/lions-of-fo' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-chinatown-wars/lions-of-fo') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-chinatown-wars/lions-of-fo';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-chinatown-wars/random-encounters' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-chinatown-wars/random-encounters') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-chinatown-wars/random-encounters';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-online' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-online') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-online';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-online/action-figures' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-online/action-figures') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-online/action-figures';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-online/heists' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-online/heists') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-online/heists';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-online/media-sticks' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-online/media-sticks') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-online/media-sticks';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-online/movie-props' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-online/movie-props') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-online/movie-props';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-online/peyote-plants' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-online/peyote-plants') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-online/peyote-plants';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-online/playing-cards' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-online/playing-cards') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-online/playing-cards';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-online/signal-jammers' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-online/signal-jammers') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-online/signal-jammers';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-san-andreas' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-san-andreas') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-san-andreas';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-san-andreas/gang-tags' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-san-andreas/gang-tags') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-san-andreas/gang-tags';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-san-andreas/horseshoes' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-san-andreas/horseshoes') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-san-andreas/horseshoes';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-san-andreas/import-export' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-san-andreas/import-export') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-san-andreas/import-export';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-san-andreas/oysters' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-san-andreas/oysters') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-san-andreas/oysters';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-san-andreas/safehouses' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-san-andreas/safehouses') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-san-andreas/safehouses';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-san-andreas/snapshots' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-san-andreas/snapshots') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-san-andreas/snapshots';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-san-andreas/story-missions' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-san-andreas/story-missions') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-san-andreas/story-missions';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-vice-city' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-vice-city') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-vice-city';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-vice-city-stories/impound-vehicles' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-vice-city-stories/impound-vehicles') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-vice-city-stories/impound-vehicles';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-vice-city/assets' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-vice-city/assets') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-vice-city/assets';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-vice-city/hidden-packages' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-vice-city/hidden-packages') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-vice-city/hidden-packages';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-vice-city/missions' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-vice-city/missions') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-vice-city/missions';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-vice-city/rampages' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-vice-city/rampages') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-vice-city/rampages';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-vice-city/safehouses' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-vice-city/safehouses') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-vice-city/safehouses';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-vice-city/store-robberies' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-vice-city/store-robberies') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-vice-city/store-robberies';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/gta/wiki/gta-vice-city/unique-stunt-jumps' and r.status='old' and public.site_route_target(r,r.path)='/wiki/gta-vice-city/unique-stunt-jumps') then
  raise exception 'Reviewed link destination changed: %', '/gta/wiki/gta-vice-city/unique-stunt-jumps';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-online' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-online') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-online';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-online/role-ranks' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-online/role-ranks') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-online/role-ranks';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-online/roles' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-online/roles') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-online/roles';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-online/weapons' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-online/weapons') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-online/weapons';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption-2/animals' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption-2/animals') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption-2/animals';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption-2/challenges' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption-2/challenges') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption-2/challenges';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption-2/cigarette-cards' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption-2/cigarette-cards') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption-2/cigarette-cards';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption-2/dinosaur-bones' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption-2/dinosaur-bones') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption-2/dinosaur-bones';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption-2/dreamcatchers' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption-2/dreamcatchers') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption-2/dreamcatchers';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption-2/equipment' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption-2/equipment') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption-2/equipment';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption-2/exotics' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption-2/exotics') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption-2/exotics';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption-2/gold-bars' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption-2/gold-bars') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption-2/gold-bars';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption-2/graves' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption-2/graves') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption-2/graves';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption-2/horses' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption-2/horses') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption-2/horses';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption-2/hunting-requests' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption-2/hunting-requests') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption-2/hunting-requests';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption-2/legendary-animals' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption-2/legendary-animals') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption-2/legendary-animals';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption-2/legendary-fish' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption-2/legendary-fish') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption-2/legendary-fish';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption-2/outfits' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption-2/outfits') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption-2/outfits';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption-2/rock-carvings' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption-2/rock-carvings') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption-2/rock-carvings';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption-2/story-missions' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption-2/story-missions') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption-2/story-missions';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption-2/stranger-missions' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption-2/stranger-missions') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption-2/stranger-missions';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption-2/trinkets-talismans' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption-2/trinkets-talismans') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption-2/trinkets-talismans';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption-2/weapons' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption-2/weapons') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption-2/weapons';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption/bounties' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption/bounties') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption/bounties';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption/challenges' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption/challenges') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption/challenges';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption/gang-hideouts' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption/gang-hideouts') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption/gang-hideouts';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption/horses' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption/horses') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption/horses';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption/outfits' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption/outfits') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption/outfits';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption/story-missions' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption/story-missions') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption/story-missions';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption/stranger-missions' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption/stranger-missions') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption/stranger-missions';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-redemption/weapons' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-redemption/weapons') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-redemption/weapons';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-revolver/bounty-hunter' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-revolver/bounty-hunter') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-revolver/bounty-hunter';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-revolver/journal-entries' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-revolver/journal-entries') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-revolver/journal-entries';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-revolver/showdown-characters' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-revolver/showdown-characters') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-revolver/showdown-characters';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-revolver/showdown-levels' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-revolver/showdown-levels') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-revolver/showdown-levels';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-revolver/story-missions' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-revolver/story-missions') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-revolver/story-missions';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/red-dead-revolver/weapons' and r.status='old' and public.site_route_target(r,r.path)='/wiki/red-dead-revolver/weapons') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/red-dead-revolver/weapons';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/undead-nightmare/horses-of-apocalypse' and r.status='old' and public.site_route_target(r,r.path)='/wiki/undead-nightmare/horses-of-apocalypse') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/undead-nightmare/horses-of-apocalypse';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/undead-nightmare/missing-souls' and r.status='old' and public.site_route_target(r,r.path)='/wiki/undead-nightmare/missing-souls') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/undead-nightmare/missing-souls';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/undead-nightmare/story-missions' and r.status='old' and public.site_route_target(r,r.path)='/wiki/undead-nightmare/story-missions') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/undead-nightmare/story-missions';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/undead-nightmare/survivor-missions' and r.status='old' and public.site_route_target(r,r.path)='/wiki/undead-nightmare/survivor-missions') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/undead-nightmare/survivor-missions';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/undead-nightmare/towns-saved' and r.status='old' and public.site_route_target(r,r.path)='/wiki/undead-nightmare/towns-saved') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/undead-nightmare/towns-saved';
 end if;
 if not exists(select 1 from public.site_routes r where r.path='/red-dead/wiki/undead-nightmare/undead-challenges' and r.status='old' and public.site_route_target(r,r.path)='/wiki/undead-nightmare/undead-challenges') then
  raise exception 'Reviewed link destination changed: %', '/red-dead/wiki/undead-nightmare/undead-challenges';
 end if;
end $$;

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_wiki_pages where id='256ffb44-edde-4b19-80d3-ba0bf754893e'),true);
update public.game_wiki_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/gta/wiki/gta-6/businesses-and-brands":"/wiki/gta-6/businesses-and-brands","/gta/wiki/gta-6/official-album-tracks":"/wiki/gta-6/official-album-tracks","/gta/wiki/gta-6/official-media":"/wiki/gta-6/official-media","/gta/wiki/gta-6/characters":"/wiki/gta-6/characters","/gta/wiki/gta-6/locations":"/wiki/gta-6/locations","/gta/wiki/gta-6/trailers":"/wiki/gta-6/trailers","/gta/wiki/gta-6/editions":"/wiki/gta-6/editions","/gta/wiki/gta-6/vehicles":"/wiki/gta-6/vehicles","/gta/wiki/gta-6/wildlife":"/wiki/gta-6/wildlife","/gta/wiki/gta-6/weapons":"/wiki/gta-6/weapons"}'::jsonb,'["/gta/wiki/gta-6/businesses-and-brands", "/gta/wiki/gta-6/official-album-tracks", "/gta/wiki/gta-6/official-media", "/gta/wiki/gta-6/characters", "/gta/wiki/gta-6/locations", "/gta/wiki/gta-6/trailers", "/gta/wiki/gta-6/editions", "/gta/wiki/gta-6/vehicles", "/gta/wiki/gta-6/wildlife", "/gta/wiki/gta-6/weapons"]'::jsonb)#>>'{}')
where id='256ffb44-edde-4b19-80d3-ba0bf754893e' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/gta/wiki/gta-6/businesses-and-brands":"/wiki/gta-6/businesses-and-brands","/gta/wiki/gta-6/official-album-tracks":"/wiki/gta-6/official-album-tracks","/gta/wiki/gta-6/official-media":"/wiki/gta-6/official-media","/gta/wiki/gta-6/characters":"/wiki/gta-6/characters","/gta/wiki/gta-6/locations":"/wiki/gta-6/locations","/gta/wiki/gta-6/trailers":"/wiki/gta-6/trailers","/gta/wiki/gta-6/editions":"/wiki/gta-6/editions","/gta/wiki/gta-6/vehicles":"/wiki/gta-6/vehicles","/gta/wiki/gta-6/wildlife":"/wiki/gta-6/wildlife","/gta/wiki/gta-6/weapons":"/wiki/gta-6/weapons"}'::jsonb,'["/gta/wiki/gta-6/businesses-and-brands", "/gta/wiki/gta-6/official-album-tracks", "/gta/wiki/gta-6/official-media", "/gta/wiki/gta-6/characters", "/gta/wiki/gta-6/locations", "/gta/wiki/gta-6/trailers", "/gta/wiki/gta-6/editions", "/gta/wiki/gta-6/vehicles", "/gta/wiki/gta-6/wildlife", "/gta/wiki/gta-6/weapons"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='166d851b-54ab-409b-8dbc-b968c3f88577'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/story-missions"]'::jsonb)#>>'{}')
where id='166d851b-54ab-409b-8dbc-b968c3f88577' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/story-missions"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='18bbc56a-29aa-4725-aa6e-4b80bf849a50'),true);
update public.game_collection_pages set intro_md=(public.rewrite_game_url_links(to_jsonb(intro_md),'{"/gta/wiki/gta-4/vehicles":"/wiki/gta-4/vehicles"}'::jsonb,'["/gta/wiki/gta-4/vehicles"]'::jsonb)#>>'{}')
where id='18bbc56a-29aa-4725-aa6e-4b80bf849a50' and to_jsonb(intro_md) is distinct from public.rewrite_game_url_links(to_jsonb(intro_md),'{"/gta/wiki/gta-4/vehicles":"/wiki/gta-4/vehicles"}'::jsonb,'["/gta/wiki/gta-4/vehicles"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='194c3afc-52cf-4246-802e-23c0142dc9c3'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption-2/animals":"/wiki/red-dead-redemption-2/animals"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/animals"]'::jsonb)
where id='194c3afc-52cf-4246-802e-23c0142dc9c3' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption-2/animals":"/wiki/red-dead-redemption-2/animals"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/animals"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='1952684e-f159-43ab-b1e5-2aeacada55bb'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/undead-nightmare/story-missions":"/wiki/undead-nightmare/story-missions"}'::jsonb,'["/red-dead/wiki/undead-nightmare/story-missions"]'::jsonb)#>>'{}')
where id='1952684e-f159-43ab-b1e5-2aeacada55bb' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/undead-nightmare/story-missions":"/wiki/undead-nightmare/story-missions"}'::jsonb,'["/red-dead/wiki/undead-nightmare/story-missions"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='19ba741c-671d-4f12-9782-f003f5d0df17'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/story-missions"]'::jsonb)#>>'{}')
where id='19ba741c-671d-4f12-9782-f003f5d0df17' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/story-missions"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='1addf806-fabe-4692-9c24-b80c079ade11'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/story-missions"]'::jsonb)#>>'{}')
where id='1addf806-fabe-4692-9c24-b80c079ade11' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/story-missions"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='2b6fe401-6061-4715-b07f-874f9763547b'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/story-missions":"/wiki/red-dead-redemption-2/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/story-missions"]'::jsonb)#>>'{}')
where id='2b6fe401-6061-4715-b07f-874f9763547b' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/story-missions":"/wiki/red-dead-redemption-2/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/story-missions"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='2bae6df8-f330-406f-b592-6900cb5a0b5b'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/story-missions":"/wiki/red-dead-redemption-2/story-missions","/red-dead/wiki/red-dead-redemption-2/dinosaur-bones":"/wiki/red-dead-redemption-2/dinosaur-bones"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/story-missions", "/red-dead/wiki/red-dead-redemption-2/dinosaur-bones"]'::jsonb)#>>'{}')
where id='2bae6df8-f330-406f-b592-6900cb5a0b5b' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/story-missions":"/wiki/red-dead-redemption-2/story-missions","/red-dead/wiki/red-dead-redemption-2/dinosaur-bones":"/wiki/red-dead-redemption-2/dinosaur-bones"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/story-missions", "/red-dead/wiki/red-dead-redemption-2/dinosaur-bones"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='2c7b4694-1aac-42b6-8150-4328b82cca00'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/story-missions"]'::jsonb)#>>'{}')
where id='2c7b4694-1aac-42b6-8150-4328b82cca00' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/story-missions"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='30f6c259-1925-4cb8-81aa-30690a524f47'),true);
update public.game_collection_pages set intro_md=(public.rewrite_game_url_links(to_jsonb(intro_md),'{"/gta/wiki/gta-4/vehicles":"/wiki/gta-4/vehicles"}'::jsonb,'["/gta/wiki/gta-4/vehicles"]'::jsonb)#>>'{}')
where id='30f6c259-1925-4cb8-81aa-30690a524f47' and to_jsonb(intro_md) is distinct from public.rewrite_game_url_links(to_jsonb(intro_md),'{"/gta/wiki/gta-4/vehicles":"/wiki/gta-4/vehicles"}'::jsonb,'["/gta/wiki/gta-4/vehicles"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='322351e8-f6a8-4251-8caf-7078ee7cade3'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/cigarette-cards":"/wiki/red-dead-redemption-2/cigarette-cards","/red-dead/wiki/red-dead-redemption-2/dinosaur-bones":"/wiki/red-dead-redemption-2/dinosaur-bones","/red-dead/wiki/red-dead-redemption-2/graves":"/wiki/red-dead-redemption-2/graves"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/cigarette-cards", "/red-dead/wiki/red-dead-redemption-2/dinosaur-bones", "/red-dead/wiki/red-dead-redemption-2/graves"]'::jsonb)#>>'{}')
where id='322351e8-f6a8-4251-8caf-7078ee7cade3' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/cigarette-cards":"/wiki/red-dead-redemption-2/cigarette-cards","/red-dead/wiki/red-dead-redemption-2/dinosaur-bones":"/wiki/red-dead-redemption-2/dinosaur-bones","/red-dead/wiki/red-dead-redemption-2/graves":"/wiki/red-dead-redemption-2/graves"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/cigarette-cards", "/red-dead/wiki/red-dead-redemption-2/dinosaur-bones", "/red-dead/wiki/red-dead-redemption-2/graves"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='3bcd53e1-72eb-453d-b161-03e2b9a0a654'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions","/red-dead/wiki/red-dead-redemption/gang-hideouts":"/wiki/red-dead-redemption/gang-hideouts","/red-dead/wiki/red-dead-redemption/challenges":"/wiki/red-dead-redemption/challenges","/red-dead/wiki/red-dead-redemption/bounties":"/wiki/red-dead-redemption/bounties"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/story-missions", "/red-dead/wiki/red-dead-redemption/gang-hideouts", "/red-dead/wiki/red-dead-redemption/challenges", "/red-dead/wiki/red-dead-redemption/bounties"]'::jsonb)#>>'{}')
where id='3bcd53e1-72eb-453d-b161-03e2b9a0a654' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions","/red-dead/wiki/red-dead-redemption/gang-hideouts":"/wiki/red-dead-redemption/gang-hideouts","/red-dead/wiki/red-dead-redemption/challenges":"/wiki/red-dead-redemption/challenges","/red-dead/wiki/red-dead-redemption/bounties":"/wiki/red-dead-redemption/bounties"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/story-missions", "/red-dead/wiki/red-dead-redemption/gang-hideouts", "/red-dead/wiki/red-dead-redemption/challenges", "/red-dead/wiki/red-dead-redemption/bounties"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='3fdfe648-2a2d-4287-abae-8b744dc8d4e2'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/story-missions":"/wiki/red-dead-redemption-2/story-missions","/red-dead/wiki/red-dead-redemption-2/dinosaur-bones":"/wiki/red-dead-redemption-2/dinosaur-bones"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/story-missions", "/red-dead/wiki/red-dead-redemption-2/dinosaur-bones"]'::jsonb)#>>'{}')
where id='3fdfe648-2a2d-4287-abae-8b744dc8d4e2' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/story-missions":"/wiki/red-dead-redemption-2/story-missions","/red-dead/wiki/red-dead-redemption-2/dinosaur-bones":"/wiki/red-dead-redemption-2/dinosaur-bones"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/story-missions", "/red-dead/wiki/red-dead-redemption-2/dinosaur-bones"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='3fdfe648-2a2d-4287-abae-8b744dc8d4e2'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-online/weapons":"/wiki/red-dead-online/weapons"}'::jsonb,'["/red-dead/wiki/red-dead-online/weapons"]'::jsonb)
where id='3fdfe648-2a2d-4287-abae-8b744dc8d4e2' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-online/weapons":"/wiki/red-dead-online/weapons"}'::jsonb,'["/red-dead/wiki/red-dead-online/weapons"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='4124d5a1-1b15-4b5c-9dcf-2aeb7b5b4a1f'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/weapons":"/wiki/red-dead-redemption-2/weapons","/red-dead/wiki/red-dead-online/roles":"/wiki/red-dead-online/roles"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/weapons", "/red-dead/wiki/red-dead-online/roles"]'::jsonb)#>>'{}')
where id='4124d5a1-1b15-4b5c-9dcf-2aeb7b5b4a1f' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/weapons":"/wiki/red-dead-redemption-2/weapons","/red-dead/wiki/red-dead-online/roles":"/wiki/red-dead-online/roles"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/weapons", "/red-dead/wiki/red-dead-online/roles"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='4592642f-0fbd-4288-a08b-875e0bd81e61'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/legendary-animals":"/wiki/red-dead-redemption-2/legendary-animals","/red-dead/wiki/red-dead-redemption-2/animals":"/wiki/red-dead-redemption-2/animals"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/legendary-animals", "/red-dead/wiki/red-dead-redemption-2/animals"]'::jsonb)#>>'{}')
where id='4592642f-0fbd-4288-a08b-875e0bd81e61' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/legendary-animals":"/wiki/red-dead-redemption-2/legendary-animals","/red-dead/wiki/red-dead-redemption-2/animals":"/wiki/red-dead-redemption-2/animals"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/legendary-animals", "/red-dead/wiki/red-dead-redemption-2/animals"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='4599f971-032a-4caa-8c5e-186b163322fd'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/gta/wiki/gta-vice-city-stories/impound-vehicles":"/wiki/gta-vice-city-stories/impound-vehicles"}'::jsonb,'["/gta/wiki/gta-vice-city-stories/impound-vehicles"]'::jsonb)#>>'{}')
where id='4599f971-032a-4caa-8c5e-186b163322fd' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/gta/wiki/gta-vice-city-stories/impound-vehicles":"/wiki/gta-vice-city-stories/impound-vehicles"}'::jsonb,'["/gta/wiki/gta-vice-city-stories/impound-vehicles"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='4f6041ca-e436-4ac4-8e8d-c5fdb66f7012'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/challenges":"/wiki/red-dead-redemption/challenges","/red-dead/wiki/red-dead-redemption/bounties":"/wiki/red-dead-redemption/bounties","/red-dead/wiki/red-dead-redemption/outfits":"/wiki/red-dead-redemption/outfits","/red-dead/wiki/red-dead-redemption/weapons":"/wiki/red-dead-redemption/weapons"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/challenges", "/red-dead/wiki/red-dead-redemption/bounties", "/red-dead/wiki/red-dead-redemption/outfits", "/red-dead/wiki/red-dead-redemption/weapons"]'::jsonb)#>>'{}')
where id='4f6041ca-e436-4ac4-8e8d-c5fdb66f7012' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/challenges":"/wiki/red-dead-redemption/challenges","/red-dead/wiki/red-dead-redemption/bounties":"/wiki/red-dead-redemption/bounties","/red-dead/wiki/red-dead-redemption/outfits":"/wiki/red-dead-redemption/outfits","/red-dead/wiki/red-dead-redemption/weapons":"/wiki/red-dead-redemption/weapons"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/challenges", "/red-dead/wiki/red-dead-redemption/bounties", "/red-dead/wiki/red-dead-redemption/outfits", "/red-dead/wiki/red-dead-redemption/weapons"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='511625e2-d85b-4014-b08b-b35f8f63bf3b'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/stranger-missions":"/wiki/red-dead-redemption-2/stranger-missions","/red-dead/wiki/red-dead-redemption-2/dinosaur-bones":"/wiki/red-dead-redemption-2/dinosaur-bones","/red-dead/wiki/red-dead-redemption-2/dreamcatchers":"/wiki/red-dead-redemption-2/dreamcatchers","/red-dead/wiki/red-dead-redemption-2/graves":"/wiki/red-dead-redemption-2/graves"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/stranger-missions", "/red-dead/wiki/red-dead-redemption-2/dinosaur-bones", "/red-dead/wiki/red-dead-redemption-2/dreamcatchers", "/red-dead/wiki/red-dead-redemption-2/graves"]'::jsonb)#>>'{}')
where id='511625e2-d85b-4014-b08b-b35f8f63bf3b' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/stranger-missions":"/wiki/red-dead-redemption-2/stranger-missions","/red-dead/wiki/red-dead-redemption-2/dinosaur-bones":"/wiki/red-dead-redemption-2/dinosaur-bones","/red-dead/wiki/red-dead-redemption-2/dreamcatchers":"/wiki/red-dead-redemption-2/dreamcatchers","/red-dead/wiki/red-dead-redemption-2/graves":"/wiki/red-dead-redemption-2/graves"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/stranger-missions", "/red-dead/wiki/red-dead-redemption-2/dinosaur-bones", "/red-dead/wiki/red-dead-redemption-2/dreamcatchers", "/red-dead/wiki/red-dead-redemption-2/graves"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='566dade6-3c0a-454c-b837-7ce9d84162e8'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/stranger-missions":"/wiki/red-dead-redemption-2/stranger-missions","/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/stranger-missions", "/red-dead/wiki/red-dead-redemption/story-missions"]'::jsonb)#>>'{}')
where id='566dade6-3c0a-454c-b837-7ce9d84162e8' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/stranger-missions":"/wiki/red-dead-redemption-2/stranger-missions","/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/stranger-missions", "/red-dead/wiki/red-dead-redemption/story-missions"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='5e0ec3df-903b-4732-ab46-a3e5a80e0057'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/undead-nightmare/survivor-missions":"/wiki/undead-nightmare/survivor-missions"}'::jsonb,'["/red-dead/wiki/undead-nightmare/survivor-missions"]'::jsonb)#>>'{}')
where id='5e0ec3df-903b-4732-ab46-a3e5a80e0057' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/undead-nightmare/survivor-missions":"/wiki/undead-nightmare/survivor-missions"}'::jsonb,'["/red-dead/wiki/undead-nightmare/survivor-missions"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='5e0ec3df-903b-4732-ab46-a3e5a80e0057'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/undead-nightmare/towns-saved":"/wiki/undead-nightmare/towns-saved"}'::jsonb,'["/red-dead/wiki/undead-nightmare/towns-saved"]'::jsonb)
where id='5e0ec3df-903b-4732-ab46-a3e5a80e0057' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/undead-nightmare/towns-saved":"/wiki/undead-nightmare/towns-saved"}'::jsonb,'["/red-dead/wiki/undead-nightmare/towns-saved"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='69fe9b1a-d4df-4228-94d8-427defb9e9c3'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-online/role-ranks":"/wiki/red-dead-online/role-ranks","/red-dead/wiki/red-dead-online/roles":"/wiki/red-dead-online/roles"}'::jsonb,'["/red-dead/wiki/red-dead-online/role-ranks", "/red-dead/wiki/red-dead-online/roles"]'::jsonb)#>>'{}')
where id='69fe9b1a-d4df-4228-94d8-427defb9e9c3' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-online/role-ranks":"/wiki/red-dead-online/role-ranks","/red-dead/wiki/red-dead-online/roles":"/wiki/red-dead-online/roles"}'::jsonb,'["/red-dead/wiki/red-dead-online/role-ranks", "/red-dead/wiki/red-dead-online/roles"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='69fe9b1a-d4df-4228-94d8-427defb9e9c3'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption-2/horses":"/wiki/red-dead-redemption-2/horses"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/horses"]'::jsonb)
where id='69fe9b1a-d4df-4228-94d8-427defb9e9c3' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption-2/horses":"/wiki/red-dead-redemption-2/horses"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/horses"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='6c51eb43-63f3-49d5-ac02-9f20cf0c89b7'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/gold-bars":"/wiki/red-dead-redemption-2/gold-bars"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/gold-bars"]'::jsonb)#>>'{}')
where id='6c51eb43-63f3-49d5-ac02-9f20cf0c89b7' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/gold-bars":"/wiki/red-dead-redemption-2/gold-bars"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/gold-bars"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='6ea190ad-840f-4f8d-8bc8-f2cc004d895e'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/undead-nightmare/towns-saved":"/wiki/undead-nightmare/towns-saved"}'::jsonb,'["/red-dead/wiki/undead-nightmare/towns-saved"]'::jsonb)#>>'{}')
where id='6ea190ad-840f-4f8d-8bc8-f2cc004d895e' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/undead-nightmare/towns-saved":"/wiki/undead-nightmare/towns-saved"}'::jsonb,'["/red-dead/wiki/undead-nightmare/towns-saved"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='6ea190ad-840f-4f8d-8bc8-f2cc004d895e'),true);
update public.game_collection_pages set description_json=public.rewrite_game_url_links(to_jsonb(description_json),'{"/red-dead/wiki/undead-nightmare/horses-of-apocalypse":"/wiki/undead-nightmare/horses-of-apocalypse"}'::jsonb,'["/red-dead/wiki/undead-nightmare/horses-of-apocalypse"]'::jsonb)
where id='6ea190ad-840f-4f8d-8bc8-f2cc004d895e' and to_jsonb(description_json) is distinct from public.rewrite_game_url_links(to_jsonb(description_json),'{"/red-dead/wiki/undead-nightmare/horses-of-apocalypse":"/wiki/undead-nightmare/horses-of-apocalypse"}'::jsonb,'["/red-dead/wiki/undead-nightmare/horses-of-apocalypse"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='6ea190ad-840f-4f8d-8bc8-f2cc004d895e'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption/challenges":"/wiki/red-dead-redemption/challenges"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/challenges"]'::jsonb)
where id='6ea190ad-840f-4f8d-8bc8-f2cc004d895e' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption/challenges":"/wiki/red-dead-redemption/challenges"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/challenges"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='6ed6c32c-ad8d-40ca-9974-afdefb94814f'),true);
update public.game_collection_pages set how_it_works_md=(public.rewrite_game_url_links(to_jsonb(how_it_works_md),'{"/red-dead/wiki/red-dead-revolver/journal-entries":"/wiki/red-dead-revolver/journal-entries"}'::jsonb,'["/red-dead/wiki/red-dead-revolver/journal-entries"]'::jsonb)#>>'{}')
where id='6ed6c32c-ad8d-40ca-9974-afdefb94814f' and to_jsonb(how_it_works_md) is distinct from public.rewrite_game_url_links(to_jsonb(how_it_works_md),'{"/red-dead/wiki/red-dead-revolver/journal-entries":"/wiki/red-dead-revolver/journal-entries"}'::jsonb,'["/red-dead/wiki/red-dead-revolver/journal-entries"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='6ed6c32c-ad8d-40ca-9974-afdefb94814f'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-revolver/showdown-levels":"/wiki/red-dead-revolver/showdown-levels","/red-dead/wiki/red-dead-revolver/bounty-hunter":"/wiki/red-dead-revolver/bounty-hunter","/red-dead/wiki/red-dead-revolver/weapons":"/wiki/red-dead-revolver/weapons"}'::jsonb,'["/red-dead/wiki/red-dead-revolver/showdown-levels", "/red-dead/wiki/red-dead-revolver/bounty-hunter", "/red-dead/wiki/red-dead-revolver/weapons"]'::jsonb)#>>'{}')
where id='6ed6c32c-ad8d-40ca-9974-afdefb94814f' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-revolver/showdown-levels":"/wiki/red-dead-revolver/showdown-levels","/red-dead/wiki/red-dead-revolver/bounty-hunter":"/wiki/red-dead-revolver/bounty-hunter","/red-dead/wiki/red-dead-revolver/weapons":"/wiki/red-dead-revolver/weapons"}'::jsonb,'["/red-dead/wiki/red-dead-revolver/showdown-levels", "/red-dead/wiki/red-dead-revolver/bounty-hunter", "/red-dead/wiki/red-dead-revolver/weapons"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='6ffe1766-d063-48d6-a5b8-f3535d8e0fac'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/story-missions"]'::jsonb)#>>'{}')
where id='6ffe1766-d063-48d6-a5b8-f3535d8e0fac' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/story-missions"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='71ebdf96-d541-4bd2-a975-235ef56d9930'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/legendary-animals":"/wiki/red-dead-redemption-2/legendary-animals","/red-dead/wiki/red-dead-redemption-2/cigarette-cards":"/wiki/red-dead-redemption-2/cigarette-cards","/red-dead/wiki/red-dead-redemption-2/dinosaur-bones":"/wiki/red-dead-redemption-2/dinosaur-bones","/red-dead/wiki/red-dead-redemption-2/dreamcatchers":"/wiki/red-dead-redemption-2/dreamcatchers","/red-dead/wiki/red-dead-redemption-2/equipment":"/wiki/red-dead-redemption-2/equipment"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/legendary-animals", "/red-dead/wiki/red-dead-redemption-2/cigarette-cards", "/red-dead/wiki/red-dead-redemption-2/dinosaur-bones", "/red-dead/wiki/red-dead-redemption-2/dreamcatchers", "/red-dead/wiki/red-dead-redemption-2/equipment"]'::jsonb)#>>'{}')
where id='71ebdf96-d541-4bd2-a975-235ef56d9930' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/legendary-animals":"/wiki/red-dead-redemption-2/legendary-animals","/red-dead/wiki/red-dead-redemption-2/cigarette-cards":"/wiki/red-dead-redemption-2/cigarette-cards","/red-dead/wiki/red-dead-redemption-2/dinosaur-bones":"/wiki/red-dead-redemption-2/dinosaur-bones","/red-dead/wiki/red-dead-redemption-2/dreamcatchers":"/wiki/red-dead-redemption-2/dreamcatchers","/red-dead/wiki/red-dead-redemption-2/equipment":"/wiki/red-dead-redemption-2/equipment"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/legendary-animals", "/red-dead/wiki/red-dead-redemption-2/cigarette-cards", "/red-dead/wiki/red-dead-redemption-2/dinosaur-bones", "/red-dead/wiki/red-dead-redemption-2/dreamcatchers", "/red-dead/wiki/red-dead-redemption-2/equipment"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='7330dbb8-7114-447c-8fe0-b3236dd00b6c'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/story-missions"]'::jsonb)#>>'{}')
where id='7330dbb8-7114-447c-8fe0-b3236dd00b6c' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/story-missions"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='7330dbb8-7114-447c-8fe0-b3236dd00b6c'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/undead-nightmare/survivor-missions":"/wiki/undead-nightmare/survivor-missions"}'::jsonb,'["/red-dead/wiki/undead-nightmare/survivor-missions"]'::jsonb)
where id='7330dbb8-7114-447c-8fe0-b3236dd00b6c' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/undead-nightmare/survivor-missions":"/wiki/undead-nightmare/survivor-missions"}'::jsonb,'["/red-dead/wiki/undead-nightmare/survivor-missions"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='7564c717-191b-42e3-9fa8-0fbc698eb05e'),true);
update public.game_collection_pages set intro_md=(public.rewrite_game_url_links(to_jsonb(intro_md),'{"/red-dead/wiki/red-dead-online/roles":"/wiki/red-dead-online/roles"}'::jsonb,'["/red-dead/wiki/red-dead-online/roles"]'::jsonb)#>>'{}')
where id='7564c717-191b-42e3-9fa8-0fbc698eb05e' and to_jsonb(intro_md) is distinct from public.rewrite_game_url_links(to_jsonb(intro_md),'{"/red-dead/wiki/red-dead-online/roles":"/wiki/red-dead-online/roles"}'::jsonb,'["/red-dead/wiki/red-dead-online/roles"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='7564c717-191b-42e3-9fa8-0fbc698eb05e'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption-2/legendary-animals":"/wiki/red-dead-redemption-2/legendary-animals"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/legendary-animals"]'::jsonb)
where id='7564c717-191b-42e3-9fa8-0fbc698eb05e' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption-2/legendary-animals":"/wiki/red-dead-redemption-2/legendary-animals"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/legendary-animals"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='7bff63ed-03c6-4670-947c-d25ab70c5586'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/undead-nightmare/survivor-missions":"/wiki/undead-nightmare/survivor-missions","/red-dead/wiki/undead-nightmare/undead-challenges":"/wiki/undead-nightmare/undead-challenges"}'::jsonb,'["/red-dead/wiki/undead-nightmare/survivor-missions", "/red-dead/wiki/undead-nightmare/undead-challenges"]'::jsonb)#>>'{}')
where id='7bff63ed-03c6-4670-947c-d25ab70c5586' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/undead-nightmare/survivor-missions":"/wiki/undead-nightmare/survivor-missions","/red-dead/wiki/undead-nightmare/undead-challenges":"/wiki/undead-nightmare/undead-challenges"}'::jsonb,'["/red-dead/wiki/undead-nightmare/survivor-missions", "/red-dead/wiki/undead-nightmare/undead-challenges"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='7bff63ed-03c6-4670-947c-d25ab70c5586'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption/horses":"/wiki/red-dead-redemption/horses"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/horses"]'::jsonb)
where id='7bff63ed-03c6-4670-947c-d25ab70c5586' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption/horses":"/wiki/red-dead-redemption/horses"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/horses"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='7d00a0a2-35fe-4820-b588-35669a5d9e35'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/stranger-missions":"/wiki/red-dead-redemption/stranger-missions","/red-dead/wiki/red-dead-redemption/gang-hideouts":"/wiki/red-dead-redemption/gang-hideouts","/red-dead/wiki/red-dead-redemption/challenges":"/wiki/red-dead-redemption/challenges","/red-dead/wiki/red-dead-redemption/outfits":"/wiki/red-dead-redemption/outfits"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/stranger-missions", "/red-dead/wiki/red-dead-redemption/gang-hideouts", "/red-dead/wiki/red-dead-redemption/challenges", "/red-dead/wiki/red-dead-redemption/outfits"]'::jsonb)#>>'{}')
where id='7d00a0a2-35fe-4820-b588-35669a5d9e35' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/stranger-missions":"/wiki/red-dead-redemption/stranger-missions","/red-dead/wiki/red-dead-redemption/gang-hideouts":"/wiki/red-dead-redemption/gang-hideouts","/red-dead/wiki/red-dead-redemption/challenges":"/wiki/red-dead-redemption/challenges","/red-dead/wiki/red-dead-redemption/outfits":"/wiki/red-dead-redemption/outfits"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/stranger-missions", "/red-dead/wiki/red-dead-redemption/gang-hideouts", "/red-dead/wiki/red-dead-redemption/challenges", "/red-dead/wiki/red-dead-redemption/outfits"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='7d18ab99-7a8b-4d78-9fdb-dfaebbe771dc'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/challenges":"/wiki/red-dead-redemption-2/challenges"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/challenges"]'::jsonb)#>>'{}')
where id='7d18ab99-7a8b-4d78-9fdb-dfaebbe771dc' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/challenges":"/wiki/red-dead-redemption-2/challenges"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/challenges"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='7d18ab99-7a8b-4d78-9fdb-dfaebbe771dc'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption-2/legendary-animals":"/wiki/red-dead-redemption-2/legendary-animals"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/legendary-animals"]'::jsonb)
where id='7d18ab99-7a8b-4d78-9fdb-dfaebbe771dc' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption-2/legendary-animals":"/wiki/red-dead-redemption-2/legendary-animals"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/legendary-animals"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='80f02113-9054-485c-9145-073f920d1957'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-revolver/showdown-characters":"/wiki/red-dead-revolver/showdown-characters","/red-dead/wiki/red-dead-revolver/journal-entries":"/wiki/red-dead-revolver/journal-entries","/red-dead/wiki/red-dead-revolver/bounty-hunter":"/wiki/red-dead-revolver/bounty-hunter"}'::jsonb,'["/red-dead/wiki/red-dead-revolver/showdown-characters", "/red-dead/wiki/red-dead-revolver/journal-entries", "/red-dead/wiki/red-dead-revolver/bounty-hunter"]'::jsonb)#>>'{}')
where id='80f02113-9054-485c-9145-073f920d1957' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-revolver/showdown-characters":"/wiki/red-dead-revolver/showdown-characters","/red-dead/wiki/red-dead-revolver/journal-entries":"/wiki/red-dead-revolver/journal-entries","/red-dead/wiki/red-dead-revolver/bounty-hunter":"/wiki/red-dead-revolver/bounty-hunter"}'::jsonb,'["/red-dead/wiki/red-dead-revolver/showdown-characters", "/red-dead/wiki/red-dead-revolver/journal-entries", "/red-dead/wiki/red-dead-revolver/bounty-hunter"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='8c75faf1-ff1a-4733-b396-5c48c618aa13'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-revolver/showdown-levels":"/wiki/red-dead-revolver/showdown-levels","/red-dead/wiki/red-dead-revolver/story-missions":"/wiki/red-dead-revolver/story-missions","/red-dead/wiki/red-dead-revolver/bounty-hunter":"/wiki/red-dead-revolver/bounty-hunter","/red-dead/wiki/red-dead-revolver/weapons":"/wiki/red-dead-revolver/weapons"}'::jsonb,'["/red-dead/wiki/red-dead-revolver/showdown-levels", "/red-dead/wiki/red-dead-revolver/story-missions", "/red-dead/wiki/red-dead-revolver/bounty-hunter", "/red-dead/wiki/red-dead-revolver/weapons"]'::jsonb)#>>'{}')
where id='8c75faf1-ff1a-4733-b396-5c48c618aa13' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-revolver/showdown-levels":"/wiki/red-dead-revolver/showdown-levels","/red-dead/wiki/red-dead-revolver/story-missions":"/wiki/red-dead-revolver/story-missions","/red-dead/wiki/red-dead-revolver/bounty-hunter":"/wiki/red-dead-revolver/bounty-hunter","/red-dead/wiki/red-dead-revolver/weapons":"/wiki/red-dead-revolver/weapons"}'::jsonb,'["/red-dead/wiki/red-dead-revolver/showdown-levels", "/red-dead/wiki/red-dead-revolver/story-missions", "/red-dead/wiki/red-dead-revolver/bounty-hunter", "/red-dead/wiki/red-dead-revolver/weapons"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='8c75faf1-ff1a-4733-b396-5c48c618aa13'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-revolver/showdown-characters":"/wiki/red-dead-revolver/showdown-characters"}'::jsonb,'["/red-dead/wiki/red-dead-revolver/showdown-characters"]'::jsonb)
where id='8c75faf1-ff1a-4733-b396-5c48c618aa13' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-revolver/showdown-characters":"/wiki/red-dead-revolver/showdown-characters"}'::jsonb,'["/red-dead/wiki/red-dead-revolver/showdown-characters"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='98100827-b226-494c-b9e0-2ea1284121f1'),true);
update public.game_collection_pages set how_it_works_md=(public.rewrite_game_url_links(to_jsonb(how_it_works_md),'{"/red-dead/wiki/red-dead-revolver/story-missions":"/wiki/red-dead-revolver/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-revolver/story-missions"]'::jsonb)#>>'{}')
where id='98100827-b226-494c-b9e0-2ea1284121f1' and to_jsonb(how_it_works_md) is distinct from public.rewrite_game_url_links(to_jsonb(how_it_works_md),'{"/red-dead/wiki/red-dead-revolver/story-missions":"/wiki/red-dead-revolver/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-revolver/story-missions"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='98100827-b226-494c-b9e0-2ea1284121f1'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-revolver/journal-entries":"/wiki/red-dead-revolver/journal-entries"}'::jsonb,'["/red-dead/wiki/red-dead-revolver/journal-entries"]'::jsonb)
where id='98100827-b226-494c-b9e0-2ea1284121f1' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-revolver/journal-entries":"/wiki/red-dead-revolver/journal-entries"}'::jsonb,'["/red-dead/wiki/red-dead-revolver/journal-entries"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='a48bf934-1565-49c9-8c70-e67069c216ea'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions","/red-dead/wiki/red-dead-redemption/gang-hideouts":"/wiki/red-dead-redemption/gang-hideouts"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/story-missions", "/red-dead/wiki/red-dead-redemption/gang-hideouts"]'::jsonb)#>>'{}')
where id='a48bf934-1565-49c9-8c70-e67069c216ea' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions","/red-dead/wiki/red-dead-redemption/gang-hideouts":"/wiki/red-dead-redemption/gang-hideouts"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/story-missions", "/red-dead/wiki/red-dead-redemption/gang-hideouts"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='b8f13f0d-d6ec-4178-b023-2258b4e38fe8'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-online/roles":"/wiki/red-dead-online/roles"}'::jsonb,'["/red-dead/wiki/red-dead-online/roles"]'::jsonb)
where id='b8f13f0d-d6ec-4178-b023-2258b4e38fe8' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-online/roles":"/wiki/red-dead-online/roles"}'::jsonb,'["/red-dead/wiki/red-dead-online/roles"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='babc909a-dab5-4950-b054-7e7c75fc82f1'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/challenges":"/wiki/red-dead-redemption-2/challenges","/red-dead/wiki/red-dead-redemption-2/equipment":"/wiki/red-dead-redemption-2/equipment","/red-dead/wiki/red-dead-redemption-2/animals":"/wiki/red-dead-redemption-2/animals"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/challenges", "/red-dead/wiki/red-dead-redemption-2/equipment", "/red-dead/wiki/red-dead-redemption-2/animals"]'::jsonb)#>>'{}')
where id='babc909a-dab5-4950-b054-7e7c75fc82f1' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/challenges":"/wiki/red-dead-redemption-2/challenges","/red-dead/wiki/red-dead-redemption-2/equipment":"/wiki/red-dead-redemption-2/equipment","/red-dead/wiki/red-dead-redemption-2/animals":"/wiki/red-dead-redemption-2/animals"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/challenges", "/red-dead/wiki/red-dead-redemption-2/equipment", "/red-dead/wiki/red-dead-redemption-2/animals"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='babc909a-dab5-4950-b054-7e7c75fc82f1'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-online":"/wiki/red-dead-online"}'::jsonb,'[]'::jsonb)
where id='babc909a-dab5-4950-b054-7e7c75fc82f1' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-online":"/wiki/red-dead-online"}'::jsonb,'[]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='bda92d1e-605d-4f2b-add6-da9b828e1af2'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/trinkets-talismans":"/wiki/red-dead-redemption-2/trinkets-talismans","/red-dead/wiki/red-dead-redemption-2/weapons":"/wiki/red-dead-redemption-2/weapons","/red-dead/wiki/red-dead-redemption-2/outfits":"/wiki/red-dead-redemption-2/outfits"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/trinkets-talismans", "/red-dead/wiki/red-dead-redemption-2/weapons", "/red-dead/wiki/red-dead-redemption-2/outfits"]'::jsonb)#>>'{}')
where id='bda92d1e-605d-4f2b-add6-da9b828e1af2' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/trinkets-talismans":"/wiki/red-dead-redemption-2/trinkets-talismans","/red-dead/wiki/red-dead-redemption-2/weapons":"/wiki/red-dead-redemption-2/weapons","/red-dead/wiki/red-dead-redemption-2/outfits":"/wiki/red-dead-redemption-2/outfits"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/trinkets-talismans", "/red-dead/wiki/red-dead-redemption-2/weapons", "/red-dead/wiki/red-dead-redemption-2/outfits"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='bda92d1e-605d-4f2b-add6-da9b828e1af2'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption-2/dinosaur-bones":"/wiki/red-dead-redemption-2/dinosaur-bones"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/dinosaur-bones"]'::jsonb)
where id='bda92d1e-605d-4f2b-add6-da9b828e1af2' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption-2/dinosaur-bones":"/wiki/red-dead-redemption-2/dinosaur-bones"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/dinosaur-bones"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='c4b50763-75c2-4526-8cfc-9d49b1680baa'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/hunting-requests":"/wiki/red-dead-redemption-2/hunting-requests","/red-dead/wiki/red-dead-redemption-2/challenges":"/wiki/red-dead-redemption-2/challenges"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/hunting-requests", "/red-dead/wiki/red-dead-redemption-2/challenges"]'::jsonb)#>>'{}')
where id='c4b50763-75c2-4526-8cfc-9d49b1680baa' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/hunting-requests":"/wiki/red-dead-redemption-2/hunting-requests","/red-dead/wiki/red-dead-redemption-2/challenges":"/wiki/red-dead-redemption-2/challenges"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/hunting-requests", "/red-dead/wiki/red-dead-redemption-2/challenges"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='c4b50763-75c2-4526-8cfc-9d49b1680baa'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption-2/legendary-animals":"/wiki/red-dead-redemption-2/legendary-animals","/red-dead/wiki/red-dead-redemption-2/legendary-fish":"/wiki/red-dead-redemption-2/legendary-fish"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/legendary-animals", "/red-dead/wiki/red-dead-redemption-2/legendary-fish"]'::jsonb)
where id='c4b50763-75c2-4526-8cfc-9d49b1680baa' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption-2/legendary-animals":"/wiki/red-dead-redemption-2/legendary-animals","/red-dead/wiki/red-dead-redemption-2/legendary-fish":"/wiki/red-dead-redemption-2/legendary-fish"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/legendary-animals", "/red-dead/wiki/red-dead-redemption-2/legendary-fish"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='c6592519-31ef-4dce-ae61-5b1b75f6db60'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/challenges":"/wiki/red-dead-redemption-2/challenges"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/challenges"]'::jsonb)#>>'{}')
where id='c6592519-31ef-4dce-ae61-5b1b75f6db60' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/challenges":"/wiki/red-dead-redemption-2/challenges"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/challenges"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='c6592519-31ef-4dce-ae61-5b1b75f6db60'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption-2/trinkets-talismans":"/wiki/red-dead-redemption-2/trinkets-talismans","/red-dead/wiki/red-dead-redemption-2/outfits":"/wiki/red-dead-redemption-2/outfits"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/trinkets-talismans", "/red-dead/wiki/red-dead-redemption-2/outfits"]'::jsonb)
where id='c6592519-31ef-4dce-ae61-5b1b75f6db60' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption-2/trinkets-talismans":"/wiki/red-dead-redemption-2/trinkets-talismans","/red-dead/wiki/red-dead-redemption-2/outfits":"/wiki/red-dead-redemption-2/outfits"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/trinkets-talismans", "/red-dead/wiki/red-dead-redemption-2/outfits"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='c9a177b3-6cdc-4ca2-a74f-e8864ba359fc'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/undead-nightmare/story-missions":"/wiki/undead-nightmare/story-missions"}'::jsonb,'["/red-dead/wiki/undead-nightmare/story-missions"]'::jsonb)#>>'{}')
where id='c9a177b3-6cdc-4ca2-a74f-e8864ba359fc' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/undead-nightmare/story-missions":"/wiki/undead-nightmare/story-missions"}'::jsonb,'["/red-dead/wiki/undead-nightmare/story-missions"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='c9a177b3-6cdc-4ca2-a74f-e8864ba359fc'),true);
update public.game_collection_pages set description_json=public.rewrite_game_url_links(to_jsonb(description_json),'{"/red-dead/wiki/undead-nightmare/missing-souls":"/wiki/undead-nightmare/missing-souls","/red-dead/wiki/undead-nightmare/towns-saved":"/wiki/undead-nightmare/towns-saved"}'::jsonb,'["/red-dead/wiki/undead-nightmare/missing-souls", "/red-dead/wiki/undead-nightmare/towns-saved"]'::jsonb)
where id='c9a177b3-6cdc-4ca2-a74f-e8864ba359fc' and to_jsonb(description_json) is distinct from public.rewrite_game_url_links(to_jsonb(description_json),'{"/red-dead/wiki/undead-nightmare/missing-souls":"/wiki/undead-nightmare/missing-souls","/red-dead/wiki/undead-nightmare/towns-saved":"/wiki/undead-nightmare/towns-saved"}'::jsonb,'["/red-dead/wiki/undead-nightmare/missing-souls", "/red-dead/wiki/undead-nightmare/towns-saved"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='ce2c8571-4709-4b02-b365-07983deedc2f'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/challenges":"/wiki/red-dead-redemption-2/challenges"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/challenges"]'::jsonb)#>>'{}')
where id='ce2c8571-4709-4b02-b365-07983deedc2f' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/challenges":"/wiki/red-dead-redemption-2/challenges"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/challenges"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='ce2c8571-4709-4b02-b365-07983deedc2f'),true);
update public.game_collection_pages set description_json=public.rewrite_game_url_links(to_jsonb(description_json),'{"/red-dead/wiki/red-dead-redemption-2/exotics":"/wiki/red-dead-redemption-2/exotics"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/exotics"]'::jsonb)
where id='ce2c8571-4709-4b02-b365-07983deedc2f' and to_jsonb(description_json) is distinct from public.rewrite_game_url_links(to_jsonb(description_json),'{"/red-dead/wiki/red-dead-redemption-2/exotics":"/wiki/red-dead-redemption-2/exotics"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/exotics"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='ce7ef3c8-b072-481f-a587-cb8e648a8917'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/gta/wiki/gta-6/trailers":"/wiki/gta-6/trailers"}'::jsonb,'["/gta/wiki/gta-6/trailers"]'::jsonb)
where id='ce7ef3c8-b072-481f-a587-cb8e648a8917' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/gta/wiki/gta-6/trailers":"/wiki/gta-6/trailers"}'::jsonb,'["/gta/wiki/gta-6/trailers"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='d868c4e5-8eca-4e2c-80cc-44aba568c30a'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-online/roles":"/wiki/red-dead-online/roles"}'::jsonb,'["/red-dead/wiki/red-dead-online/roles"]'::jsonb)#>>'{}')
where id='d868c4e5-8eca-4e2c-80cc-44aba568c30a' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-online/roles":"/wiki/red-dead-online/roles"}'::jsonb,'["/red-dead/wiki/red-dead-online/roles"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='d868c4e5-8eca-4e2c-80cc-44aba568c30a'),true);
update public.game_collection_pages set description_json=public.rewrite_game_url_links(to_jsonb(description_json),'{"/red-dead/wiki/red-dead-online/roles":"/wiki/red-dead-online/roles"}'::jsonb,'["/red-dead/wiki/red-dead-online/roles"]'::jsonb)
where id='d868c4e5-8eca-4e2c-80cc-44aba568c30a' and to_jsonb(description_json) is distinct from public.rewrite_game_url_links(to_jsonb(description_json),'{"/red-dead/wiki/red-dead-online/roles":"/wiki/red-dead-online/roles"}'::jsonb,'["/red-dead/wiki/red-dead-online/roles"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='e00f5983-1c59-4bdf-beec-d218425d2590'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/story-missions"]'::jsonb)
where id='e00f5983-1c59-4bdf-beec-d218425d2590' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption/story-missions":"/wiki/red-dead-redemption/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-redemption/story-missions"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='e09dfbd7-89f0-4063-a548-f364f16c7185'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption-2/cigarette-cards":"/wiki/red-dead-redemption-2/cigarette-cards"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/cigarette-cards"]'::jsonb)
where id='e09dfbd7-89f0-4063-a548-f364f16c7185' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-redemption-2/cigarette-cards":"/wiki/red-dead-redemption-2/cigarette-cards"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/cigarette-cards"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='ecdb67ee-46c0-4692-a459-748fea879968'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-revolver/story-missions":"/wiki/red-dead-revolver/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-revolver/story-missions"]'::jsonb)#>>'{}')
where id='ecdb67ee-46c0-4692-a459-748fea879968' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-revolver/story-missions":"/wiki/red-dead-revolver/story-missions"}'::jsonb,'["/red-dead/wiki/red-dead-revolver/story-missions"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='ecdb67ee-46c0-4692-a459-748fea879968'),true);
update public.game_collection_pages set faq_json=public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-revolver/showdown-characters":"/wiki/red-dead-revolver/showdown-characters","/red-dead/wiki/red-dead-revolver/journal-entries":"/wiki/red-dead-revolver/journal-entries"}'::jsonb,'["/red-dead/wiki/red-dead-revolver/showdown-characters", "/red-dead/wiki/red-dead-revolver/journal-entries"]'::jsonb)
where id='ecdb67ee-46c0-4692-a459-748fea879968' and to_jsonb(faq_json) is distinct from public.rewrite_game_url_links(to_jsonb(faq_json),'{"/red-dead/wiki/red-dead-revolver/showdown-characters":"/wiki/red-dead-revolver/showdown-characters","/red-dead/wiki/red-dead-revolver/journal-entries":"/wiki/red-dead-revolver/journal-entries"}'::jsonb,'["/red-dead/wiki/red-dead-revolver/showdown-characters", "/red-dead/wiki/red-dead-revolver/journal-entries"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='f17b7e6a-aa27-44cb-b8bb-972fca0a3395'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/hunting-requests":"/wiki/red-dead-redemption-2/hunting-requests","/red-dead/wiki/red-dead-redemption-2/cigarette-cards":"/wiki/red-dead-redemption-2/cigarette-cards","/red-dead/wiki/red-dead-redemption-2/legendary-fish":"/wiki/red-dead-redemption-2/legendary-fish","/red-dead/wiki/red-dead-redemption-2/dinosaur-bones":"/wiki/red-dead-redemption-2/dinosaur-bones","/red-dead/wiki/red-dead-redemption-2/rock-carvings":"/wiki/red-dead-redemption-2/rock-carvings","/red-dead/wiki/red-dead-redemption-2/exotics":"/wiki/red-dead-redemption-2/exotics"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/hunting-requests", "/red-dead/wiki/red-dead-redemption-2/cigarette-cards", "/red-dead/wiki/red-dead-redemption-2/legendary-fish", "/red-dead/wiki/red-dead-redemption-2/dinosaur-bones", "/red-dead/wiki/red-dead-redemption-2/rock-carvings", "/red-dead/wiki/red-dead-redemption-2/exotics"]'::jsonb)#>>'{}')
where id='f17b7e6a-aa27-44cb-b8bb-972fca0a3395' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/red-dead/wiki/red-dead-redemption-2/hunting-requests":"/wiki/red-dead-redemption-2/hunting-requests","/red-dead/wiki/red-dead-redemption-2/cigarette-cards":"/wiki/red-dead-redemption-2/cigarette-cards","/red-dead/wiki/red-dead-redemption-2/legendary-fish":"/wiki/red-dead-redemption-2/legendary-fish","/red-dead/wiki/red-dead-redemption-2/dinosaur-bones":"/wiki/red-dead-redemption-2/dinosaur-bones","/red-dead/wiki/red-dead-redemption-2/rock-carvings":"/wiki/red-dead-redemption-2/rock-carvings","/red-dead/wiki/red-dead-redemption-2/exotics":"/wiki/red-dead-redemption-2/exotics"}'::jsonb,'["/red-dead/wiki/red-dead-redemption-2/hunting-requests", "/red-dead/wiki/red-dead-redemption-2/cigarette-cards", "/red-dead/wiki/red-dead-redemption-2/legendary-fish", "/red-dead/wiki/red-dead-redemption-2/dinosaur-bones", "/red-dead/wiki/red-dead-redemption-2/rock-carvings", "/red-dead/wiki/red-dead-redemption-2/exotics"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_collection_pages where id='fbb3eda5-eab5-4932-9f91-077fd6f4965c'),true);
update public.game_collection_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/gta/wiki/gta-san-andreas/import-export":"/wiki/gta-san-andreas/import-export"}'::jsonb,'["/gta/wiki/gta-san-andreas/import-export"]'::jsonb)#>>'{}')
where id='fbb3eda5-eab5-4932-9f91-077fd6f4965c' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/gta/wiki/gta-san-andreas/import-export":"/wiki/gta-san-andreas/import-export"}'::jsonb,'["/gta/wiki/gta-san-andreas/import-export"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_map_pages where id='21b041d8-6cdb-4252-828f-0fe29f5332cf'),true);
update public.game_map_pages set map_data=public.rewrite_game_url_links(to_jsonb(map_data),'{"/gta/wiki/gta-5/spaceship-parts":"/wiki/gta-5/spaceship-parts","/gta/wiki/gta-5/letter-scraps":"/wiki/gta-5/letter-scraps","/gta/wiki/gta-5/nuclear-waste":"/wiki/gta-5/nuclear-waste","/gta/wiki/gta-5/submarine-pieces":"/wiki/gta-5/submarine-pieces","/gta/wiki/gta-5/monkey-mosaics":"/wiki/gta-5/monkey-mosaics","/gta/wiki/gta-5/peyote-plants":"/wiki/gta-5/peyote-plants","/gta/wiki/gta-5/epsilon-tracts":"/wiki/gta-5/epsilon-tracts","/gta/wiki/gta-5/hidden-packages":"/wiki/gta-5/hidden-packages","/gta/wiki/gta-5/stunt-jumps":"/wiki/gta-5/stunt-jumps","/gta/wiki/gta-5/under-the-bridge":"/wiki/gta-5/under-the-bridge","/gta/wiki/gta-5/knife-flights":"/wiki/gta-5/knife-flights"}'::jsonb,'["/gta/wiki/gta-5/spaceship-parts", "/gta/wiki/gta-5/letter-scraps", "/gta/wiki/gta-5/nuclear-waste", "/gta/wiki/gta-5/submarine-pieces", "/gta/wiki/gta-5/monkey-mosaics", "/gta/wiki/gta-5/peyote-plants", "/gta/wiki/gta-5/epsilon-tracts", "/gta/wiki/gta-5/hidden-packages", "/gta/wiki/gta-5/stunt-jumps", "/gta/wiki/gta-5/under-the-bridge", "/gta/wiki/gta-5/knife-flights"]'::jsonb)
where id='21b041d8-6cdb-4252-828f-0fe29f5332cf' and to_jsonb(map_data) is distinct from public.rewrite_game_url_links(to_jsonb(map_data),'{"/gta/wiki/gta-5/spaceship-parts":"/wiki/gta-5/spaceship-parts","/gta/wiki/gta-5/letter-scraps":"/wiki/gta-5/letter-scraps","/gta/wiki/gta-5/nuclear-waste":"/wiki/gta-5/nuclear-waste","/gta/wiki/gta-5/submarine-pieces":"/wiki/gta-5/submarine-pieces","/gta/wiki/gta-5/monkey-mosaics":"/wiki/gta-5/monkey-mosaics","/gta/wiki/gta-5/peyote-plants":"/wiki/gta-5/peyote-plants","/gta/wiki/gta-5/epsilon-tracts":"/wiki/gta-5/epsilon-tracts","/gta/wiki/gta-5/hidden-packages":"/wiki/gta-5/hidden-packages","/gta/wiki/gta-5/stunt-jumps":"/wiki/gta-5/stunt-jumps","/gta/wiki/gta-5/under-the-bridge":"/wiki/gta-5/under-the-bridge","/gta/wiki/gta-5/knife-flights":"/wiki/gta-5/knife-flights"}'::jsonb,'["/gta/wiki/gta-5/spaceship-parts", "/gta/wiki/gta-5/letter-scraps", "/gta/wiki/gta-5/nuclear-waste", "/gta/wiki/gta-5/submarine-pieces", "/gta/wiki/gta-5/monkey-mosaics", "/gta/wiki/gta-5/peyote-plants", "/gta/wiki/gta-5/epsilon-tracts", "/gta/wiki/gta-5/hidden-packages", "/gta/wiki/gta-5/stunt-jumps", "/gta/wiki/gta-5/under-the-bridge", "/gta/wiki/gta-5/knife-flights"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_map_pages where id='64a15f2e-6188-4f81-8ba2-deb6bd8c7842'),true);
update public.game_map_pages set map_data=public.rewrite_game_url_links(to_jsonb(map_data),'{"/gta/maps/gta-chinatown-wars":"/maps/gta-chinatown-wars","/gta/wiki/gta-chinatown-wars/random-encounters":"/wiki/gta-chinatown-wars/random-encounters","/gta/wiki/gta-chinatown-wars/lions-of-fo":"/wiki/gta-chinatown-wars/lions-of-fo"}'::jsonb,'["/gta/wiki/gta-chinatown-wars/random-encounters", "/gta/wiki/gta-chinatown-wars/lions-of-fo"]'::jsonb)
where id='64a15f2e-6188-4f81-8ba2-deb6bd8c7842' and to_jsonb(map_data) is distinct from public.rewrite_game_url_links(to_jsonb(map_data),'{"/gta/maps/gta-chinatown-wars":"/maps/gta-chinatown-wars","/gta/wiki/gta-chinatown-wars/random-encounters":"/wiki/gta-chinatown-wars/random-encounters","/gta/wiki/gta-chinatown-wars/lions-of-fo":"/wiki/gta-chinatown-wars/lions-of-fo"}'::jsonb,'["/gta/wiki/gta-chinatown-wars/random-encounters", "/gta/wiki/gta-chinatown-wars/lions-of-fo"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_map_pages where id='b1bfb684-ab75-406d-a224-841a4a5550b5'),true);
update public.game_map_pages set map_data=public.rewrite_game_url_links(to_jsonb(map_data),'{"/gta/maps/gta-san-andreas":"/maps/gta-san-andreas","/gta/wiki/gta-san-andreas/import-export":"/wiki/gta-san-andreas/import-export"}'::jsonb,'["/gta/wiki/gta-san-andreas/import-export"]'::jsonb)
where id='b1bfb684-ab75-406d-a224-841a4a5550b5' and to_jsonb(map_data) is distinct from public.rewrite_game_url_links(to_jsonb(map_data),'{"/gta/maps/gta-san-andreas":"/maps/gta-san-andreas","/gta/wiki/gta-san-andreas/import-export":"/wiki/gta-san-andreas/import-export"}'::jsonb,'["/gta/wiki/gta-san-andreas/import-export"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_map_pages where id='db56cb07-3bbe-4108-9c02-0c9443b9e2df'),true);
update public.game_map_pages set map_data=public.rewrite_game_url_links(to_jsonb(map_data),'{"/gta/maps/gta-liberty-city-stories":"/maps/gta-liberty-city-stories"}'::jsonb,'[]'::jsonb)
where id='db56cb07-3bbe-4108-9c02-0c9443b9e2df' and to_jsonb(map_data) is distinct from public.rewrite_game_url_links(to_jsonb(map_data),'{"/gta/maps/gta-liberty-city-stories":"/maps/gta-liberty-city-stories"}'::jsonb,'[]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_map_pages where id='e4c8b738-13dd-4cbf-91dd-0c45c69187fb'),true);
update public.game_map_pages set map_data=public.rewrite_game_url_links(to_jsonb(map_data),'{"/gta/maps/gta-online":"/maps/gta-online","/gta/wiki/gta-online/action-figures":"/wiki/gta-online/action-figures","/gta/wiki/gta-online/playing-cards":"/wiki/gta-online/playing-cards","/gta/wiki/gta-online/signal-jammers":"/wiki/gta-online/signal-jammers","/gta/wiki/gta-online/media-sticks":"/wiki/gta-online/media-sticks","/gta/wiki/gta-online/movie-props":"/wiki/gta-online/movie-props","/gta/wiki/gta-online/peyote-plants":"/wiki/gta-online/peyote-plants"}'::jsonb,'["/gta/wiki/gta-online/action-figures", "/gta/wiki/gta-online/playing-cards", "/gta/wiki/gta-online/signal-jammers", "/gta/wiki/gta-online/media-sticks", "/gta/wiki/gta-online/movie-props", "/gta/wiki/gta-online/peyote-plants"]'::jsonb)
where id='e4c8b738-13dd-4cbf-91dd-0c45c69187fb' and to_jsonb(map_data) is distinct from public.rewrite_game_url_links(to_jsonb(map_data),'{"/gta/maps/gta-online":"/maps/gta-online","/gta/wiki/gta-online/action-figures":"/wiki/gta-online/action-figures","/gta/wiki/gta-online/playing-cards":"/wiki/gta-online/playing-cards","/gta/wiki/gta-online/signal-jammers":"/wiki/gta-online/signal-jammers","/gta/wiki/gta-online/media-sticks":"/wiki/gta-online/media-sticks","/gta/wiki/gta-online/movie-props":"/wiki/gta-online/movie-props","/gta/wiki/gta-online/peyote-plants":"/wiki/gta-online/peyote-plants"}'::jsonb,'["/gta/wiki/gta-online/action-figures", "/gta/wiki/gta-online/playing-cards", "/gta/wiki/gta-online/signal-jammers", "/gta/wiki/gta-online/media-sticks", "/gta/wiki/gta-online/movie-props", "/gta/wiki/gta-online/peyote-plants"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_map_pages where id='e89f54b6-dda7-4ab7-92b5-8c0b40a8b7cc'),true);
update public.game_map_pages set map_data=public.rewrite_game_url_links(to_jsonb(map_data),'{"/gta/maps/gta-vice-city":"/maps/gta-vice-city"}'::jsonb,'[]'::jsonb)
where id='e89f54b6-dda7-4ab7-92b5-8c0b40a8b7cc' and to_jsonb(map_data) is distinct from public.rewrite_game_url_links(to_jsonb(map_data),'{"/gta/maps/gta-vice-city":"/maps/gta-vice-city"}'::jsonb,'[]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_map_pages where id='e9d48637-2106-45fb-a8c9-4cba10797841'),true);
update public.game_map_pages set map_data=public.rewrite_game_url_links(to_jsonb(map_data),'{"/gta/maps/gta-vice-city-stories":"/maps/gta-vice-city-stories"}'::jsonb,'[]'::jsonb)
where id='e9d48637-2106-45fb-a8c9-4cba10797841' and to_jsonb(map_data) is distinct from public.rewrite_game_url_links(to_jsonb(map_data),'{"/gta/maps/gta-vice-city-stories":"/maps/gta-vice-city-stories"}'::jsonb,'[]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_map_pages where id='eb3b3fca-c4d5-424d-a048-a6da11b2a65d'),true);
update public.game_map_pages set map_data=public.rewrite_game_url_links(to_jsonb(map_data),'{"/gta/maps/gta-iii":"/maps/gta-iii"}'::jsonb,'[]'::jsonb)
where id='eb3b3fca-c4d5-424d-a048-a6da11b2a65d' and to_jsonb(map_data) is distinct from public.rewrite_game_url_links(to_jsonb(map_data),'{"/gta/maps/gta-iii":"/maps/gta-iii"}'::jsonb,'[]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_map_pages where id='f8b1cab6-a7f4-46d4-a620-a66b8270fc3f'),true);
update public.game_map_pages set map_data=public.rewrite_game_url_links(to_jsonb(map_data),'{"/gta/maps/gta-4":"/maps/gta-4","/gta/wiki/gta-4/side-missions-activities":"/wiki/gta-4/side-missions-activities","/gta/wiki/gta-4-tlad/angus-bike-thefts":"/wiki/gta-4-tlad/angus-bike-thefts","/gta/wiki/gta-4-tlad/bike-races":"/wiki/gta-4-tlad/bike-races","/gta/wiki/gta-4-tbogt/base-jumps":"/wiki/gta-4-tbogt/base-jumps"}'::jsonb,'["/gta/wiki/gta-4/side-missions-activities", "/gta/wiki/gta-4-tlad/angus-bike-thefts", "/gta/wiki/gta-4-tlad/bike-races", "/gta/wiki/gta-4-tbogt/base-jumps"]'::jsonb)
where id='f8b1cab6-a7f4-46d4-a620-a66b8270fc3f' and to_jsonb(map_data) is distinct from public.rewrite_game_url_links(to_jsonb(map_data),'{"/gta/maps/gta-4":"/maps/gta-4","/gta/wiki/gta-4/side-missions-activities":"/wiki/gta-4/side-missions-activities","/gta/wiki/gta-4-tlad/angus-bike-thefts":"/wiki/gta-4-tlad/angus-bike-thefts","/gta/wiki/gta-4-tlad/bike-races":"/wiki/gta-4-tlad/bike-races","/gta/wiki/gta-4-tbogt/base-jumps":"/wiki/gta-4-tbogt/base-jumps"}'::jsonb,'["/gta/wiki/gta-4/side-missions-activities", "/gta/wiki/gta-4-tlad/angus-bike-thefts", "/gta/wiki/gta-4-tlad/bike-races", "/gta/wiki/gta-4-tbogt/base-jumps"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_pages where id='2085c5ce-14e1-44c8-bd54-3a47fc1fa91c'),true);
update public.game_checklist_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/gta/wiki/gta-5":"/wiki/gta-5"}'::jsonb,'[]'::jsonb)#>>'{}')
where id='2085c5ce-14e1-44c8-bd54-3a47fc1fa91c' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/gta/wiki/gta-5":"/wiki/gta-5"}'::jsonb,'[]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_pages where id='402617d9-27ec-4cd8-9af1-9f6815c1a70b'),true);
update public.game_checklist_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/gta/wiki/gta-san-andreas":"/wiki/gta-san-andreas"}'::jsonb,'[]'::jsonb)#>>'{}')
where id='402617d9-27ec-4cd8-9af1-9f6815c1a70b' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/gta/wiki/gta-san-andreas":"/wiki/gta-san-andreas"}'::jsonb,'[]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_pages where id='aeb2f3a2-7708-41c5-b89e-e9758c8d361d'),true);
update public.game_checklist_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/gta/wiki/gta-online/heists":"/wiki/gta-online/heists","/gta/wiki/gta-online":"/wiki/gta-online"}'::jsonb,'["/gta/wiki/gta-online/heists"]'::jsonb)#>>'{}')
where id='aeb2f3a2-7708-41c5-b89e-e9758c8d361d' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/gta/wiki/gta-online/heists":"/wiki/gta-online/heists","/gta/wiki/gta-online":"/wiki/gta-online"}'::jsonb,'["/gta/wiki/gta-online/heists"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_pages where id='c41070b7-adfa-401b-8e3c-8cfb8e140d14'),true);
update public.game_checklist_pages set description_md=(public.rewrite_game_url_links(to_jsonb(description_md),'{"/gta/wiki/gta-vice-city":"/wiki/gta-vice-city"}'::jsonb,'[]'::jsonb)#>>'{}')
where id='c41070b7-adfa-401b-8e3c-8cfb8e140d14' and to_jsonb(description_md) is distinct from public.rewrite_game_url_links(to_jsonb(description_md),'{"/gta/wiki/gta-vice-city":"/wiki/gta-vice-city"}'::jsonb,'[]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='3531f382-13e7-4176-ae1a-06ecd5c26961'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/story-missions":"/wiki/gta-5/story-missions"}'::jsonb,'["/gta/wiki/gta-5/story-missions"]'::jsonb)#>>'{}')
where id='3531f382-13e7-4176-ae1a-06ecd5c26961' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/story-missions":"/wiki/gta-5/story-missions"}'::jsonb,'["/gta/wiki/gta-5/story-missions"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='1df020af-f488-4e8d-8197-619503af8a55'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/heists":"/wiki/gta-5/heists"}'::jsonb,'["/gta/wiki/gta-5/heists"]'::jsonb)#>>'{}')
where id='1df020af-f488-4e8d-8197-619503af8a55' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/heists":"/wiki/gta-5/heists"}'::jsonb,'["/gta/wiki/gta-5/heists"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='3a9b9198-b0fe-4407-a50e-5a37d696e5b8'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/heists":"/wiki/gta-5/heists"}'::jsonb,'["/gta/wiki/gta-5/heists"]'::jsonb)#>>'{}')
where id='3a9b9198-b0fe-4407-a50e-5a37d696e5b8' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/heists":"/wiki/gta-5/heists"}'::jsonb,'["/gta/wiki/gta-5/heists"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='1b8b92de-6037-46dc-880a-213fe7ac52af'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/heists":"/wiki/gta-5/heists"}'::jsonb,'["/gta/wiki/gta-5/heists"]'::jsonb)#>>'{}')
where id='1b8b92de-6037-46dc-880a-213fe7ac52af' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/heists":"/wiki/gta-5/heists"}'::jsonb,'["/gta/wiki/gta-5/heists"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='6ded6aef-fbe8-4860-a917-2ea8fe91b8cc'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/heists":"/wiki/gta-5/heists"}'::jsonb,'["/gta/wiki/gta-5/heists"]'::jsonb)#>>'{}')
where id='6ded6aef-fbe8-4860-a917-2ea8fe91b8cc' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/heists":"/wiki/gta-5/heists"}'::jsonb,'["/gta/wiki/gta-5/heists"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='3d5e4593-56a0-4966-a669-661ce401729d'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/strangers-and-freaks":"/wiki/gta-5/strangers-and-freaks"}'::jsonb,'["/gta/wiki/gta-5/strangers-and-freaks"]'::jsonb)#>>'{}')
where id='3d5e4593-56a0-4966-a669-661ce401729d' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/strangers-and-freaks":"/wiki/gta-5/strangers-and-freaks"}'::jsonb,'["/gta/wiki/gta-5/strangers-and-freaks"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='69756692-0690-4b14-b267-4febb9a8cfe4'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/hobbies-and-pastimes":"/wiki/gta-5/hobbies-and-pastimes"}'::jsonb,'["/gta/wiki/gta-5/hobbies-and-pastimes"]'::jsonb)#>>'{}')
where id='69756692-0690-4b14-b267-4febb9a8cfe4' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/hobbies-and-pastimes":"/wiki/gta-5/hobbies-and-pastimes"}'::jsonb,'["/gta/wiki/gta-5/hobbies-and-pastimes"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='ea63de57-0582-4574-a5c0-9cbf954e6146'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/random-events":"/wiki/gta-5/random-events"}'::jsonb,'["/gta/wiki/gta-5/random-events"]'::jsonb)#>>'{}')
where id='ea63de57-0582-4574-a5c0-9cbf954e6146' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/random-events":"/wiki/gta-5/random-events"}'::jsonb,'["/gta/wiki/gta-5/random-events"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='9eb8558f-0018-42a4-85b9-03f9c51af223'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/spaceship-parts":"/wiki/gta-5/spaceship-parts"}'::jsonb,'["/gta/wiki/gta-5/spaceship-parts"]'::jsonb)#>>'{}')
where id='9eb8558f-0018-42a4-85b9-03f9c51af223' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/spaceship-parts":"/wiki/gta-5/spaceship-parts"}'::jsonb,'["/gta/wiki/gta-5/spaceship-parts"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='eba2afba-2fd2-4b08-b0c5-7cd81e14661b'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/letter-scraps":"/wiki/gta-5/letter-scraps"}'::jsonb,'["/gta/wiki/gta-5/letter-scraps"]'::jsonb)#>>'{}')
where id='eba2afba-2fd2-4b08-b0c5-7cd81e14661b' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/letter-scraps":"/wiki/gta-5/letter-scraps"}'::jsonb,'["/gta/wiki/gta-5/letter-scraps"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='7ec8d32f-632f-41c0-8a4a-00ddb7814b48'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/stunt-jumps":"/wiki/gta-5/stunt-jumps"}'::jsonb,'["/gta/wiki/gta-5/stunt-jumps"]'::jsonb)#>>'{}')
where id='7ec8d32f-632f-41c0-8a4a-00ddb7814b48' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/stunt-jumps":"/wiki/gta-5/stunt-jumps"}'::jsonb,'["/gta/wiki/gta-5/stunt-jumps"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='b0eb4f06-961b-4acd-9617-4f2dd45c3279'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/under-the-bridge":"/wiki/gta-5/under-the-bridge"}'::jsonb,'["/gta/wiki/gta-5/under-the-bridge"]'::jsonb)#>>'{}')
where id='b0eb4f06-961b-4acd-9617-4f2dd45c3279' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/under-the-bridge":"/wiki/gta-5/under-the-bridge"}'::jsonb,'["/gta/wiki/gta-5/under-the-bridge"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='f77ece58-ded0-4ccf-ab06-ae7881964ada'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/knife-flights":"/wiki/gta-5/knife-flights"}'::jsonb,'["/gta/wiki/gta-5/knife-flights"]'::jsonb)#>>'{}')
where id='f77ece58-ded0-4ccf-ab06-ae7881964ada' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/knife-flights":"/wiki/gta-5/knife-flights"}'::jsonb,'["/gta/wiki/gta-5/knife-flights"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='bd80ae14-e1f1-4c71-96bc-f95ef42d1aef'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/properties":"/wiki/gta-5/properties"}'::jsonb,'["/gta/wiki/gta-5/properties"]'::jsonb)#>>'{}')
where id='bd80ae14-e1f1-4c71-96bc-f95ef42d1aef' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-5/properties":"/wiki/gta-5/properties"}'::jsonb,'["/gta/wiki/gta-5/properties"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='f5e0badb-937e-4b78-80f4-f48417747ee4'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-san-andreas/story-missions":"/wiki/gta-san-andreas/story-missions"}'::jsonb,'["/gta/wiki/gta-san-andreas/story-missions"]'::jsonb)#>>'{}')
where id='f5e0badb-937e-4b78-80f4-f48417747ee4' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-san-andreas/story-missions":"/wiki/gta-san-andreas/story-missions"}'::jsonb,'["/gta/wiki/gta-san-andreas/story-missions"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='193d479d-c50a-4bc0-8a53-bee774f678ce'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-san-andreas/safehouses":"/wiki/gta-san-andreas/safehouses"}'::jsonb,'["/gta/wiki/gta-san-andreas/safehouses"]'::jsonb)#>>'{}')
where id='193d479d-c50a-4bc0-8a53-bee774f678ce' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-san-andreas/safehouses":"/wiki/gta-san-andreas/safehouses"}'::jsonb,'["/gta/wiki/gta-san-andreas/safehouses"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='7a349c07-d332-4ff1-a467-70d6ebae6962'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-san-andreas/gang-tags":"/wiki/gta-san-andreas/gang-tags"}'::jsonb,'["/gta/wiki/gta-san-andreas/gang-tags"]'::jsonb)#>>'{}')
where id='7a349c07-d332-4ff1-a467-70d6ebae6962' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-san-andreas/gang-tags":"/wiki/gta-san-andreas/gang-tags"}'::jsonb,'["/gta/wiki/gta-san-andreas/gang-tags"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='7c321171-2318-4218-85c3-8a9a077905a9'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-san-andreas/snapshots":"/wiki/gta-san-andreas/snapshots"}'::jsonb,'["/gta/wiki/gta-san-andreas/snapshots"]'::jsonb)#>>'{}')
where id='7c321171-2318-4218-85c3-8a9a077905a9' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-san-andreas/snapshots":"/wiki/gta-san-andreas/snapshots"}'::jsonb,'["/gta/wiki/gta-san-andreas/snapshots"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='21ea539a-379a-4e11-a6e6-2239eed21cb4'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-san-andreas/horseshoes":"/wiki/gta-san-andreas/horseshoes"}'::jsonb,'["/gta/wiki/gta-san-andreas/horseshoes"]'::jsonb)#>>'{}')
where id='21ea539a-379a-4e11-a6e6-2239eed21cb4' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-san-andreas/horseshoes":"/wiki/gta-san-andreas/horseshoes"}'::jsonb,'["/gta/wiki/gta-san-andreas/horseshoes"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='849d7fad-0fc0-40a2-a0f3-0f9c9483bbc1'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-san-andreas/oysters":"/wiki/gta-san-andreas/oysters"}'::jsonb,'["/gta/wiki/gta-san-andreas/oysters"]'::jsonb)#>>'{}')
where id='849d7fad-0fc0-40a2-a0f3-0f9c9483bbc1' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-san-andreas/oysters":"/wiki/gta-san-andreas/oysters"}'::jsonb,'["/gta/wiki/gta-san-andreas/oysters"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='912bfc0f-d569-46cc-a03e-212c6ba91f0e'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-vice-city/missions":"/wiki/gta-vice-city/missions"}'::jsonb,'["/gta/wiki/gta-vice-city/missions"]'::jsonb)#>>'{}')
where id='912bfc0f-d569-46cc-a03e-212c6ba91f0e' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-vice-city/missions":"/wiki/gta-vice-city/missions"}'::jsonb,'["/gta/wiki/gta-vice-city/missions"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='cf4f816e-118b-40dd-bb78-b87a19d5472d'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-vice-city/assets":"/wiki/gta-vice-city/assets"}'::jsonb,'["/gta/wiki/gta-vice-city/assets"]'::jsonb)#>>'{}')
where id='cf4f816e-118b-40dd-bb78-b87a19d5472d' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-vice-city/assets":"/wiki/gta-vice-city/assets"}'::jsonb,'["/gta/wiki/gta-vice-city/assets"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='536c00cd-e57d-44f7-9069-cf64b8041e69'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-vice-city/unique-stunt-jumps":"/wiki/gta-vice-city/unique-stunt-jumps","/gta/wiki/gta-vice-city/hidden-packages":"/wiki/gta-vice-city/hidden-packages","/gta/wiki/gta-vice-city/store-robberies":"/wiki/gta-vice-city/store-robberies","/gta/wiki/gta-vice-city/safehouses":"/wiki/gta-vice-city/safehouses","/gta/wiki/gta-vice-city/rampages":"/wiki/gta-vice-city/rampages"}'::jsonb,'["/gta/wiki/gta-vice-city/unique-stunt-jumps", "/gta/wiki/gta-vice-city/hidden-packages", "/gta/wiki/gta-vice-city/store-robberies", "/gta/wiki/gta-vice-city/safehouses", "/gta/wiki/gta-vice-city/rampages"]'::jsonb)#>>'{}')
where id='536c00cd-e57d-44f7-9069-cf64b8041e69' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-vice-city/unique-stunt-jumps":"/wiki/gta-vice-city/unique-stunt-jumps","/gta/wiki/gta-vice-city/hidden-packages":"/wiki/gta-vice-city/hidden-packages","/gta/wiki/gta-vice-city/store-robberies":"/wiki/gta-vice-city/store-robberies","/gta/wiki/gta-vice-city/safehouses":"/wiki/gta-vice-city/safehouses","/gta/wiki/gta-vice-city/rampages":"/wiki/gta-vice-city/rampages"}'::jsonb,'["/gta/wiki/gta-vice-city/unique-stunt-jumps", "/gta/wiki/gta-vice-city/hidden-packages", "/gta/wiki/gta-vice-city/store-robberies", "/gta/wiki/gta-vice-city/safehouses", "/gta/wiki/gta-vice-city/rampages"]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='c06450d0-6bae-47bc-9c0d-7cc7121e1334'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-online":"/wiki/gta-online"}'::jsonb,'[]'::jsonb)#>>'{}')
where id='c06450d0-6bae-47bc-9c0d-7cc7121e1334' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-online":"/wiki/gta-online"}'::jsonb,'[]'::jsonb);

select set_config('bloxodes.url_move_namespace',(select namespace from public.game_checklist_items where id='2f2263d2-e1fa-4030-b14e-eddff7946854'),true);
update public.game_checklist_items set description=(public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-online/heists":"/wiki/gta-online/heists"}'::jsonb,'["/gta/wiki/gta-online/heists"]'::jsonb)#>>'{}')
where id='2f2263d2-e1fa-4030-b14e-eddff7946854' and to_jsonb(description) is distinct from public.rewrite_game_url_links(to_jsonb(description),'{"/gta/wiki/gta-online/heists":"/wiki/gta-online/heists"}'::jsonb,'["/gta/wiki/gta-online/heists"]'::jsonb);

select set_config('bloxodes.url_move_namespace','',true);
select public.refresh_game_content_index('gta');
select public.refresh_game_content_index('red-dead');
commit;
