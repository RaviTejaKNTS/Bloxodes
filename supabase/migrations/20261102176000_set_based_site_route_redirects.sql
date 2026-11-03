begin;

-- site_route_redirects called site_route_target() once per row, about 2 ms
-- each, so the middleware's cold load passed its 2-second deadline once every
-- namespace had moved (~1,600 rows). For a row's own path that function
-- returns the page's live path (page-linked rows) or target_url (all others);
-- one join computes the same value for every row at once.
create or replace view public.site_route_redirects with (security_invoker=true) as
 select r.*, case when r.page_id is not null then live.path else r.target_url end resolved_target
 from public.site_routes r
 left join public.site_routes live
  on live.status='live' and live.source=r.source and live.page_type=r.page_type and live.page_id=r.page_id
 where r.status='old';
revoke all on public.site_route_redirects from public,anon,authenticated;
grant select on public.site_route_redirects to service_role;

commit;
