-- The capture trigger must not swallow a statement timeout or cancel: the content
-- write would then outlive its own deadline. Only ordinary errors are swallowed.
begin;
create or replace function public.capture_indexnow_publication() returns trigger
language plpgsql security definer set search_path='' set lock_timeout='250ms' as $$
declare j jsonb; previous jsonb; r public.site_routes; path text; fresh boolean;
begin
 j:=to_jsonb(new);
 if tg_op='UPDATE' then
  previous:=to_jsonb(old);
  -- Content/data refreshes cannot change publication or route identity.
  if not exists(select 1 from unnest(array['id','slug','code','wiki_slug','collection_slug','canonical_path','namespace','parent_id','game_id','is_published','is_public','visibility','published_at']) k
    where previous->k is distinct from j->k) then return new; end if;
 end if;
 if tg_table_name='stats_reports' then
  if j->>'visibility' is distinct from 'public' then return new; end if;
 elsif tg_table_name<>'authors' then
  if not coalesce((j->>'is_published')::boolean,(j->>'is_public')::boolean,false) then return new; end if;
 end if;
 -- Scheduled pages stay pending until their actual public HTML passes the gate.
 insert into public.indexnow_pages values(tg_table_name,j->>'id') on conflict do nothing;
 fresh:=found;
 if tg_table_name='authors' then
  path:='/authors/'||(j->>'slug');
 elsif tg_table_name='stats_reports' then
  path:='/stats/reports/'||(j->>'slug');
 else
  r:=public.site_page_route(tg_table_name,j); path:=r.path;
 end if;
 if path is not null then
  insert into public.indexnow_urls(path,state) values(path,case when fresh then 'pending' else 'known' end) on conflict do nothing;
 end if;
 return new;
exception when others then
 -- This nested block rolls back ledger writes only; publication is kept. A lock wait
 -- past 250 ms lands here. "others" leaves statement timeouts and cancels alone, so
 -- the caller's own deadline still applies. Do not log row contents.
 raise warning 'IndexNow capture failed: table %, id %',tg_table_name,to_jsonb(new)->>'id';
 return new;
end $$;
commit;
