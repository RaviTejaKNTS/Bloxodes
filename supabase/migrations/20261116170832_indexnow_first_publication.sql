begin;
-- Match the route migrations' short lock wait and the production runner's
-- statement deadline. Build private objects before locking public writers.
set local lock_timeout = '3s';
set local statement_timeout = '180s';
-- Identity history survives renames. URL history survives deletes and restarts.
create table public.indexnow_pages (
 page_table text not null, page_id text not null, primary key(page_table,page_id)
);
create table public.indexnow_urls (
 path text primary key,
 state text not null check(state in ('known','pending','attempted','submitted','failed','expired')),
 created_at timestamptz not null default now(), attempted_at timestamptz,
 last_checked_at timestamptz, check_count integer not null default 0,
 detail text
);
create index indexnow_pending_checks on public.indexnow_urls(last_checked_at nulls first,created_at,path) where state='pending';
create index indexnow_pending_age on public.indexnow_urls(created_at) where state='pending';
alter table public.indexnow_pages enable row level security;
alter table public.indexnow_urls enable row level security;
revoke all on public.indexnow_pages, public.indexnow_urls from public, anon, authenticated;
grant all on public.indexnow_pages, public.indexnow_urls to service_role;

-- lock_timeout applies only while this function runs and is restored on exit, so a
-- busy ledger can delay a content write by 250 ms at most; the timeout is swallowed below.
create function public.capture_indexnow_publication() returns trigger
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
exception when others or query_canceled or assert_failure then
 -- This nested block rolls back ledger writes only. Never roll back publication,
 -- including cancellation inside this optional trigger. Do not log row contents.
 raise warning 'IndexNow capture failed: table %, id %',tg_table_name,to_jsonb(new)->>'id';
 return new;
end $$;
revoke all on function public.capture_indexnow_publication() from public,anon,authenticated;
grant execute on function public.capture_indexnow_publication() to service_role;

-- Atomic, short check reservation, independent of revalidation event identity.
-- The shortest cooldown (1 minute) is longer than the web drain budget; SKIP LOCKED handles overlap.
create function public.take_indexnow_pending_checks()
returns table(path text,checked_at timestamptz,capped boolean)
language plpgsql security definer set search_path='' as $$
declare picked text[]; cutoff boolean;
begin
 update public.indexnow_urls u set state='expired',detail='No passing public-page check within 30 days'
 where u.state='pending' and u.created_at<=now()-interval '30 days';
 select array_agg(q.path order by q.last_checked_at nulls first,q.created_at,q.path) into picked from (
  select u.path,u.last_checked_at,u.created_at from public.indexnow_urls u
  where u.state='pending' and (u.last_checked_at is null
   -- Back off: 1, 2, 4 ... minutes between checks, at most 6 hours, so pages that
   -- never pass (noindex, scheduled) are not fetched on every revalidation.
   or u.last_checked_at<now()-interval '1 minute'*least(360,power(2,least(greatest(u.check_count-1,0),9))))
  order by u.last_checked_at nulls first,u.created_at,u.path limit 101 for update skip locked
 ) q;
 cutoff:=coalesce(cardinality(picked)>100,false);
 return query with reserved as (
  update public.indexnow_urls u
  set last_checked_at=clock_timestamp(),check_count=u.check_count+1
  where u.path=any(picked[1:100]) returning u.path,u.last_checked_at
 ) select r.path,r.last_checked_at,cutoff from reserved r order by array_position(picked,r.path);
end $$;
revoke all on function public.take_indexnow_pending_checks() from public,anon,authenticated;
grant execute on function public.take_indexnow_pending_checks() to service_role;

-- One-way submission claim. An uncertain send is never automatically retried.
create function public.claim_indexnow_urls(paths text[]) returns setof text
language sql security definer set search_path='' as $$
 update public.indexnow_urls u set state='attempted',attempted_at=now(),detail='Submission started; outcome may be uncertain'
 where u.path in (select unnest(paths) limit 100) and u.state='pending'
 and u.created_at>now()-interval '30 days' returning u.path;
$$;
revoke all on function public.claim_indexnow_urls(text[]) from public,anon,authenticated;
grant execute on function public.claim_indexnow_urls(text[]) to service_role;

-- Same parent-first order as the route registry / batch publisher; add later
-- page families at the end. Hold this window only for seed + trigger installation.
select pg_catalog.pg_advisory_xact_lock(7823462194301);
lock table public.games,public.game_wiki_pages,public.game_code_pages,public.game_tool_pages,public.game_map_pages,public.game_quiz_pages,public.game_catalog_pages,public.game_checklist_pages,public.game_collection_pages,public.code_pages,public.wiki_pages,public.wiki_collection_pages,public.quiz_pages,public.checklist_pages,public.tools,public.events_pages,public.articles,public.catalog_pages,public.puzzle_pages,public.game_article_pages,public.authors,public.stats_reports in share row exclusive mode;
do $$
declare t text;
begin
 foreach t in array array['games','game_wiki_pages','game_code_pages','game_tool_pages','game_map_pages','game_quiz_pages','game_catalog_pages','game_checklist_pages','game_collection_pages','code_pages','wiki_pages','wiki_collection_pages','quiz_pages','checklist_pages','tools','events_pages','articles','catalog_pages','puzzle_pages','game_article_pages','authors','stats_reports'] loop
  -- Only these editorial tables have nullable publication dates populated by
  -- publish guards (set_*_published_at / prepare_game_*). Preserve past history
  -- after unpublishing too. A date is never evidence for a stats report.
  execute format($seed$
   insert into public.indexnow_pages
   select %L,p.id::text from public.%I p
   where case when %L='authors' then true
    when %L='stats_reports' then to_jsonb(p)->>'visibility'='public'
    else coalesce((to_jsonb(p)->>'is_published')::boolean,(to_jsonb(p)->>'is_public')::boolean,false)
      or (to_jsonb(p)->>'published_at')::timestamptz<=now() end
   on conflict do nothing
  $seed$,t,t,t,t);
  execute format('create trigger zz_indexnow_publication after insert or update on public.%I for each row execute function public.capture_indexnow_publication()',t);
 end loop;
end $$;
-- The route registry includes drafts, so join the seeded identity set. Include
-- every owned alias (even live aliases of past publications), plus retired URLs.
insert into public.indexnow_urls(path,state)
 select r.path,'known' from public.expected_site_routes r
 join public.indexnow_pages p on p.page_table=r.page_table and p.page_id=r.page_id
 where r.path is not null on conflict do nothing;
insert into public.indexnow_urls(path,state)
 select r.path,'known' from public.site_routes r
 where r.status<>'live' or exists(select 1 from public.indexnow_pages p where p.page_table=case
  when r.source='game' then case when r.page_type='hub' then 'games' else 'game_'||r.page_type||'_pages' end
  else case r.page_type when 'code' then 'code_pages' when 'wiki' then 'wiki_pages' when 'collection' then 'wiki_collection_pages' when 'quiz' then 'quiz_pages' when 'checklist' then 'checklist_pages' when 'tool' then 'tools' when 'event' then 'events_pages' when 'article' then 'articles' when 'catalog' then 'catalog_pages' when 'puzzle' then 'puzzle_pages' end end
  and p.page_id=r.page_id)
 on conflict do nothing;
insert into public.indexnow_urls(path,state) select '/authors/'||slug,'known' from public.authors on conflict do nothing;
insert into public.indexnow_urls(path,state) select '/stats/reports/'||slug,'known' from public.stats_reports where visibility='public' on conflict do nothing;
commit;
