begin;
set local lock_timeout = '3s';

-- #171 must already be committed. These rewrites take row locks only; do not
-- combine them with the table-locking namespace moves in a schema release.
select public.rewrite_moved_game_links('gta');
select public.rewrite_moved_game_links('red-dead');
select public.rewrite_moved_game_links('minecraft');

-- The deleted GTA directory handler also served /page/<n>. The bare directory
-- already redirects to the franchise hub. Drop its pagination tail in one hop.
-- Do not prefix /gta/maps: its unchanged static map tiles live below that path.
do $$
declare destination text;
begin
 if exists(select 1 from public.games where namespace='gta' and url_style<>'page_type') then
  raise exception 'GTA must use page_type URLs before removing namespace routes';
 end if;
 select public.site_route_target(r,r.path) into destination
 from public.site_routes r where path='/gta/checklists' and status='old';
 if destination is distinct from '/games/gta'
 or not exists(select 1 from public.site_routes where path=destination and status='live') then
  raise exception 'Missing live GTA checklist directory destination';
 end if;
 if exists(select 1 from public.site_routes where path='/gta/checklists/page'
   and (status<>'old' or match_type<>'prefix' or target_url is distinct from destination or tail_mode<>'drop')) then
  raise exception 'Conflicting GTA checklist pagination route';
 end if;
 insert into public.site_routes(path,status,match_type,target_url,tail_mode,redirect_code,origin)
 values('/gta/checklists/page','old','prefix',destination,'drop',301,'namespace-cleanup')
 on conflict(path) do nothing;
end $$;
commit;
