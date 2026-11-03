begin;
-- Phase 2 only: no application readers change. All objects are service-only.
create table public.site_routes (
 path text primary key check (path = lower(path) and path ~ '^/' and path !~ '[?#[:space:]]' and (path = '/' or right(path,1) <> '/') and path not like '%//%'),
 match_type text not null default 'exact' check (match_type in ('exact','prefix')),
 page_type text check (page_type in ('hub','wiki','collection','code','quiz','checklist','tool','map','catalog','event','article','puzzle')),
 source text check (source in ('roblox','game')),
 page_id text,
 game_id uuid,
 status text not null check (status in ('live','old','gone')),
 target_url text,
 redirect_code smallint not null default 301 check (redirect_code in (301,308)),
 origin text not null,
 moved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 -- Drop preserves Next's :path* without a destination capture. free-items models
 -- the five legacy folder shapes, including parseInt(page,10) / positive fallback.
 tail_mode text not null default 'append' check (tail_mode in ('append','drop','free-items')),
 match_self boolean not null default true,
 check ((page_id is null and source is null and page_type is null) or (page_id is not null and source is not null and page_type is not null)),
 check (source is distinct from 'roblox' or game_id is null),
 check (target_url is null or target_url ~ '^(/|https://)'),
 check ((status='live' and page_id is not null and target_url is null and match_type='exact')
     or (status='old' and ((page_id is not null and target_url is null) or (page_id is null and target_url is not null)))
     or (status='gone' and page_id is not null and target_url is null and match_type='exact')),
 check (match_type <> 'prefix' or (status='old' and target_url is not null)),
 check (match_type='prefix' or (tail_mode='append' and match_self))
);
create unique index site_routes_live_owner on public.site_routes(source,page_type,page_id) where status='live';
create index site_routes_owner on public.site_routes(source,page_type,page_id);
create index site_routes_prefix on public.site_routes(path) where match_type='prefix';
create table public.site_route_conflicts (
 id bigint generated always as identity primary key,
 path text not null,
 incumbent jsonb not null,
 claimant jsonb not null,
 origin text not null,
 reason text not null,
 created_at timestamptz not null default now()
);
alter table public.site_routes enable row level security;
alter table public.site_route_conflicts enable row level security;
revoke all on public.site_routes, public.site_route_conflicts from public,anon,authenticated;
grant all on public.site_routes, public.site_route_conflicts to service_role;
revoke all on sequence public.site_route_conflicts_id_seq from public,anon,authenticated;
grant usage,select on sequence public.site_route_conflicts_id_seq to service_role;

-- Only codes whose hand-built URL is proven by today's route code are included.
-- Unknown reserved codes remain in expected_site_routes with a NULL path for audit.
create function public.site_catalog_path(code text) returns text
language plpgsql immutable set search_path='' as $$
declare c text := lower(btrim(code)); prefix text; rest text;
begin
 if c is null or c !~ '^[a-z0-9_-]+(/[a-z0-9_-]+)*$' then return null; end if;
 -- Frozen from RETIRED_MUSIC_GAME_CATALOG_CODES in game-specific-id-pages.ts.
 -- Next's redirect owns both the base and every descendant.
 if c='roblox-music-ids/games/work-at-a-pizza-place' or starts_with(c,'roblox-music-ids/games/work-at-a-pizza-place/') then return null; end if;
 prefix:=split_part(c,'/',1); rest:=substr(c,length(prefix)+1);
 if prefix='roblox-free-items' then return public.site_catalog_path('free-roblox-items'||rest); end if;
 -- Legacy avatar URLs redirect, but their page-data reader requests only the
 -- canonical config code. A leftover legacy code row has no proven page owner.
 if prefix='roblox-avatar-items' then return null; end if;
 if prefix=any(array['roblox-accessories','roblox-clothing','roblox-body-parts','roblox-emotes','roblox-animations','roblox-makeup']) then
   return null;
 end if;
 if c ~ '^(the-forge|grow-a-garden)(-|/|$)' then return null; end if;
 if prefix=any(array['admin-commands','free-roblox-items','roblox-music-ids','roblox-decal-ids','roblox-items-and-bundles']) then
   if rest='' then return '/catalog/'||c; end if;
   if prefix='admin-commands' and rest ~ '^/[^/]+$' then return '/catalog/'||c; end if;
   if prefix='free-roblox-items' and rest ~ '^/[^/]+(/[^/]+)?$' and rest !~ '^/(categories|page)(/|$)' then return '/catalog/'||c; end if;
   if prefix in ('roblox-music-ids','roblox-decal-ids') and rest ~ '^/games(/[^/]+)?$' then return '/catalog/'||c; end if;
   -- Avatar children are configuration-backed, not arbitrary catch-all codes.
   if prefix='roblox-items-and-bundles' then
    if c=any(array['roblox-items-and-bundles/roblox-accessories','roblox-items-and-bundles/roblox-clothing','roblox-items-and-bundles/roblox-body-parts','roblox-items-and-bundles/roblox-emotes','roblox-items-and-bundles/roblox-animations','roblox-items-and-bundles/roblox-makeup','roblox-items-and-bundles/roblox-accessories/hair-accessories','roblox-items-and-bundles/roblox-accessories/head-accessories','roblox-items-and-bundles/roblox-accessories/face-accessories','roblox-items-and-bundles/roblox-accessories/neck-accessories','roblox-items-and-bundles/roblox-accessories/shoulder-accessories','roblox-items-and-bundles/roblox-accessories/front-accessories','roblox-items-and-bundles/roblox-accessories/back-accessories','roblox-items-and-bundles/roblox-accessories/waist-accessories','roblox-items-and-bundles/roblox-accessories/gear','roblox-items-and-bundles/roblox-clothing/layered-t-shirts','roblox-items-and-bundles/roblox-clothing/shirts','roblox-items-and-bundles/roblox-clothing/sweaters','roblox-items-and-bundles/roblox-clothing/jackets','roblox-items-and-bundles/roblox-clothing/pants','roblox-items-and-bundles/roblox-clothing/shorts','roblox-items-and-bundles/roblox-clothing/dresses-skirts','roblox-items-and-bundles/roblox-clothing/shoes','roblox-items-and-bundles/roblox-clothing/classic-shirts','roblox-items-and-bundles/roblox-clothing/classic-t-shirts','roblox-items-and-bundles/roblox-clothing/classic-pants','roblox-items-and-bundles/roblox-body-parts/full-bodies','roblox-items-and-bundles/roblox-body-parts/dynamic-heads','roblox-items-and-bundles/roblox-body-parts/classic-heads','roblox-items-and-bundles/roblox-body-parts/classic-faces']) then return '/catalog/'||c; end if;
    return null; end if;
   return null;
 end if;
 if prefix=any(array['roblox-color-codes','roblox-errors-and-fixes','roblox-promo-codes','roblox-font-ids','roblox-mesh-ids']) and rest<>'' then return null; end if;
 return '/catalog/'||c;
end $$;

-- A single mapping is shared by backfill, triggers and the missing-row audit.
create function public.site_page_route(p_table text, p_row jsonb) returns public.site_routes
language plpgsql stable set search_path='' as $$
declare r public.site_routes;
begin
 r.page_id:=p_row->>'id'; r.status:='live'; r.origin:='backfill'; r.match_type:='exact';
 r.source:=case when p_table='games' or p_table like 'game\_%' escape '\' then 'game' else 'roblox' end;
 if r.source='game' then
  if p_table='games' then
   if p_row->>'parent_id' is not null then return null; end if;
   r.page_type:='hub'; r.path:='/'||(p_row->>'namespace'); r.game_id:=(p_row->>'id')::uuid;
  else
   r.page_type:=replace(replace(p_table,'game_',''),'_pages','');
   r.path:=p_row->>'canonical_path'; r.game_id:=(p_row->>'game_id')::uuid;
  end if;
 else
  case p_table
   when 'code_pages' then r.page_type:='code'; r.path:='/codes/'||(p_row->>'slug');
   when 'wiki_pages' then r.page_type:='wiki'; r.path:='/wiki/'||(p_row->>'slug');
   when 'wiki_collection_pages' then r.page_type:='collection'; r.path:='/wiki/'||(p_row->>'wiki_slug')||'/'||(p_row->>'collection_slug');
   when 'quiz_pages' then r.page_type:='quiz'; r.path:='/quizzes/'||(p_row->>'code');
   when 'checklist_pages' then r.page_type:='checklist'; r.path:='/checklists/'||(p_row->>'slug');
   when 'tools' then r.page_type:='tool'; r.path:='/tools/'||(p_row->>'code');
   when 'events_pages' then r.page_type:='event'; r.path:='/events/'||(p_row->>'slug');
   when 'articles' then r.page_type:='article'; r.path:='/articles/'||(p_row->>'slug');
   when 'puzzle_pages' then r.page_type:='puzzle'; r.path:='/puzzles/'||(p_row->>'slug');
   when 'catalog_pages' then r.page_type:='catalog'; r.path:=public.site_catalog_path(p_row->>'code');
   else raise exception 'Unsupported site route table: %',p_table;
  end case;
 end if;
 return r;
end $$;

-- Serializes route mutations (including simultaneous publishers). No application
-- table locks or publisher changes; AFTER triggers see the final upsert identity.
create function public.claim_site_route(p_claim jsonb, p_backfill boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare c public.site_routes; incumbent public.site_routes;
begin
 perform pg_catalog.pg_advisory_xact_lock(7823462194301);
 select * into c from pg_catalog.jsonb_populate_record(null::public.site_routes,
  jsonb_build_object('match_type','exact','redirect_code',301,'tail_mode','append','match_self',true,'origin','trigger')||p_claim);
 if c.path is null then return; end if;
 if c.path<>lower(c.path) or c.path !~ '^/' or c.path ~ '[?#[:space:]]' or (c.path<>'/' and right(c.path,1)='/') or c.path like '%//%' then
  if not p_backfill then raise exception 'Invalid site route path: %',c.path; end if;
  insert into public.site_route_conflicts(path,incumbent,claimant,origin,reason) values(c.path,'{}',p_claim,c.origin,'Invalid path; page omitted'); return;
 end if;
 select * into incumbent from public.site_routes where path=c.path for update;
 if found and (incumbent.source,incumbent.page_type,incumbent.page_id) is not distinct from (c.source,c.page_type,c.page_id) and c.page_id is not null then
  -- Repeated updates/upserts and moving back to the same page's alias are safe.
  if p_backfill then
   if incumbent.origin<>c.origin then
    insert into public.site_route_conflicts(path,incumbent,claimant,origin,reason) values(c.path,to_jsonb(incumbent),p_claim,c.origin,'Same owner claimed by multiple sources; first retained');
   end if;
   return;
  end if;
  if incumbent.status='live' and c.status<>'live' then return; end if;
 elsif found then
  if not p_backfill and incumbent.status='live' and c.status='live' then
   raise exception 'Site route % is live for %/%/%; cannot assign to %/%/%',c.path,incumbent.source,incumbent.page_type,incumbent.page_id,c.source,c.page_type,c.page_id using errcode='23505';
  end if;
  insert into public.site_route_conflicts(path,incumbent,claimant,origin,reason)
   values(c.path,to_jsonb(incumbent),p_claim,c.origin,case when not p_backfill and c.status='live' then 'Live page took over old/gone route' else 'First claimant retained by backfill priority' end);
  if p_backfill or c.status<>'live' then return; end if;
 end if;
 if c.status='live' then
  update public.site_routes set status='old',moved_at=now(),updated_at=now()
   where source=c.source and page_type=c.page_type and page_id=c.page_id and status='live' and path<>c.path;
 end if;
 insert into public.site_routes(path,match_type,page_type,source,page_id,game_id,status,target_url,redirect_code,origin,tail_mode,match_self)
 values(c.path,c.match_type,c.page_type,c.source,c.page_id,c.game_id,c.status,c.target_url,c.redirect_code,c.origin,c.tail_mode,c.match_self)
 on conflict(path) do update set match_type=excluded.match_type,page_type=excluded.page_type,source=excluded.source,page_id=excluded.page_id,game_id=excluded.game_id,
 status=excluded.status,target_url=excluded.target_url,redirect_code=excluded.redirect_code,origin=excluded.origin,tail_mode=excluded.tail_mode,match_self=excluded.match_self,
 moved_at=case when excluded.status='live' then null else site_routes.moved_at end,updated_at=now();
end $$;

-- Canonical free-items content wins over its legacy fallback, regardless of UUID.
-- Reconcile after INSERT/UPDATE/DELETE so removing or moving the preferred row
-- immediately exposes the remaining fallback. Unrelated live owners still raise.
create function public.sync_site_catalog_route(p_path text) returns void
language plpgsql security definer set search_path='' as $$
declare winner public.catalog_pages; incumbent public.site_routes;
begin
 if p_path is null then return; end if;
 select * into winner from public.catalog_pages p where public.site_catalog_path(p.code)=p_path
 order by (split_part(lower(btrim(p.code)),'/',1)='roblox-free-items'),p.id::text limit 1;
 select * into incumbent from public.site_routes where path=p_path for update;
 if incumbent.source='roblox' and incumbent.page_type='catalog' and incumbent.status='live'
    and incumbent.page_id is distinct from winner.id::text then
  update public.site_routes set
   status=case when exists(select 1 from public.catalog_pages p where p.id::text=incumbent.page_id and public.site_catalog_path(p.code) is not null) then 'old' else 'gone' end,
   moved_at=now(),updated_at=now() where path=p_path;
 end if;
 if winner.id is not null then
  perform public.claim_site_route(jsonb_strip_nulls(to_jsonb(public.site_page_route('catalog_pages',to_jsonb(winner))))||jsonb_build_object('origin','trigger'));
 end if;
end $$;

create function public.restore_site_hubs(p_namespace text) returns void
language plpgsql security definer set search_path='' as $$
declare g record;
begin
 for g in select * from public.games where parent_id is null and namespace=p_namespace order by id loop
  if not exists(select 1 from public.site_routes where path='/'||g.namespace and status='live') then
   perform public.claim_site_route(jsonb_strip_nulls(to_jsonb(public.site_page_route('games',to_jsonb(g))))||jsonb_build_object('origin','trigger'));
  end if;
 end loop;
end $$;

-- Acquire the same lock before publisher row locks, including multi-row upserts.
create function public.lock_site_route_writes() returns trigger
language plpgsql security definer set search_path='' as $$
begin perform pg_catalog.pg_advisory_xact_lock(7823462194301); return null; end $$;

create function public.sync_site_page_route() returns trigger
language plpgsql security definer set search_path='' as $$
declare r public.site_routes; previous public.site_routes; alias text;
begin
 perform pg_catalog.pg_advisory_xact_lock(7823462194301);
 if tg_table_name='catalog_pages' then
  if tg_op in ('DELETE','UPDATE') then perform public.sync_site_catalog_route(public.site_catalog_path(old.code)); end if;
  if tg_op in ('INSERT','UPDATE') then perform public.sync_site_catalog_route(public.site_catalog_path(new.code)); end if;
  if tg_op='DELETE' then return old; end if;
  return new;
 end if;
 if tg_op in ('DELETE','UPDATE') then
  previous:=public.site_page_route(tg_table_name,to_jsonb(old));
  if tg_op='DELETE' then
   update public.site_routes set status='gone',updated_at=now() where source=previous.source and page_type=previous.page_type and page_id=previous.page_id and status='live';
   if previous.source='game' and previous.path ~ '^/[^/]+$' then
    perform public.restore_site_hubs(substr(previous.path,2));
   end if;
   return old;
  end if;
 end if;
 r:=public.site_page_route(tg_table_name,to_jsonb(new));
 -- The bare root is a real rendered route, even where SEO points at /namespace/wiki.
 -- A stored page at that exact path takes precedence over the synthetic hub.
 if tg_table_name='games' and exists(select 1 from public.site_routes where path=r.path and status='live' and page_type<>'hub') then
  -- Retire the previous synthetic owner even when the destination is stored.
  update public.site_routes set status='old',moved_at=now(),updated_at=now()
   where source='game' and page_type='hub' and page_id=previous.page_id and status='live' and path is distinct from r.path;
  return new;
 end if;
 if tg_op='UPDATE' and previous.page_id is not null and (r.path is null or (r.page_id,r.source,r.page_type) is distinct from (previous.page_id,previous.source,previous.page_type)) then
  update public.site_routes set status='gone',updated_at=now() where source=previous.source and page_type=previous.page_type and page_id=previous.page_id and status='live';
 end if;
 if r.path is not null then
  -- A newly stored root page replaces the synthetic hub, not another real page.
  update public.site_routes set status='gone',updated_at=now() where path=r.path and status='live' and page_type='hub' and tg_table_name<>'games';
  perform public.claim_site_route(jsonb_strip_nulls(to_jsonb(r))||jsonb_build_object('origin','trigger'));
 end if;
 -- Only leaving a bare namespace root can uncover a synthetic hub. Identity
 -- and game_id changes at the same path do not uncover one; inserts cannot either.
 if tg_op='UPDATE' and previous.source='game' and previous.path ~ '^/[^/]+$'
    and previous.path is distinct from r.path then
  perform public.restore_site_hubs(substr(previous.path,2));
 end if;
 if tg_table_name='code_pages' then
  foreach alias in array new.old_slugs loop
   alias:=lower(btrim(alias));
   if alias is null or alias='' or '/codes/'||alias=r.path then continue; end if;
   perform public.claim_site_route(jsonb_build_object('path','/codes/'||alias,'source','roblox','page_type','code','page_id',new.id::text,'status','old','origin','code_pages.old_slugs'),true);
  end loop;
 end if;
 return new;
end $$;

create view public.expected_site_routes with (security_invoker=true) as
select 'code_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.code_pages p cross join lateral public.site_page_route('code_pages',to_jsonb(p)) r
union all
select 'wiki_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.wiki_pages p cross join lateral public.site_page_route('wiki_pages',to_jsonb(p)) r
union all
select 'wiki_collection_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.wiki_collection_pages p cross join lateral public.site_page_route('wiki_collection_pages',to_jsonb(p)) r
union all
select 'quiz_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.quiz_pages p cross join lateral public.site_page_route('quiz_pages',to_jsonb(p)) r
union all
select 'checklist_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.checklist_pages p cross join lateral public.site_page_route('checklist_pages',to_jsonb(p)) r
union all
select 'tools'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.tools p cross join lateral public.site_page_route('tools',to_jsonb(p)) r
union all
select 'events_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.events_pages p cross join lateral public.site_page_route('events_pages',to_jsonb(p)) r
union all
select 'articles'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.articles p cross join lateral public.site_page_route('articles',to_jsonb(p)) r
union all
select 'catalog_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.catalog_pages p cross join lateral public.site_page_route('catalog_pages',to_jsonb(p)) r where p.id=(select candidate.id from public.catalog_pages candidate where public.site_catalog_path(candidate.code)=r.path order by (split_part(lower(btrim(candidate.code)),'/',1)='roblox-free-items'),candidate.id::text limit 1) or r.path is null
union all
select 'game_wiki_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.game_wiki_pages p cross join lateral public.site_page_route('game_wiki_pages',to_jsonb(p)) r
union all
select 'game_collection_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.game_collection_pages p cross join lateral public.site_page_route('game_collection_pages',to_jsonb(p)) r
union all
select 'game_code_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.game_code_pages p cross join lateral public.site_page_route('game_code_pages',to_jsonb(p)) r
union all
select 'game_tool_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.game_tool_pages p cross join lateral public.site_page_route('game_tool_pages',to_jsonb(p)) r
union all
select 'game_checklist_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.game_checklist_pages p cross join lateral public.site_page_route('game_checklist_pages',to_jsonb(p)) r
union all
select 'game_map_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.game_map_pages p cross join lateral public.site_page_route('game_map_pages',to_jsonb(p)) r
union all
select 'game_quiz_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.game_quiz_pages p cross join lateral public.site_page_route('game_quiz_pages',to_jsonb(p)) r
union all
select 'game_catalog_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.game_catalog_pages p cross join lateral public.site_page_route('game_catalog_pages',to_jsonb(p)) r
union all
select 'puzzle_pages'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.puzzle_pages p cross join lateral public.site_page_route('puzzle_pages',to_jsonb(p)) r
union all
select 'games'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.games p cross join lateral public.site_page_route('games',to_jsonb(p)) r where p.parent_id is null;

revoke all on public.expected_site_routes from public,anon,authenticated;
grant select on public.expected_site_routes to service_role;
create function public.site_route_touch() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=now(); return new; end $$;
create trigger site_route_touch before update on public.site_routes for each row execute function public.site_route_touch();

create function public.site_route_target(r public.site_routes,p_path text) returns text
language plpgsql stable set search_path='' set extra_float_digits=1 as $$
declare tail text; parts text[]; digits text; page float8; rendered text;
begin
 if r.status<>'old' then return null; end if;
 if r.page_id is not null then
  return (select path from public.site_routes where source=r.source and page_type=r.page_type and page_id=r.page_id and status='live');
 end if;
 if r.match_type='exact' or r.tail_mode='drop' then return r.target_url; end if;
 tail:=case when r.path='/' then nullif(p_path,'/') else substr(p_path,length(r.path)+1) end;
 tail:=coalesce(tail,'');
 if r.tail_mode='free-items' then
  if tail='' then return r.target_url; end if;
  parts:=string_to_array(substr(tail,2),'/');
  if array_length(parts,1) in (1,2) then return r.target_url||tail; end if;
  if (array_length(parts,1)=3 and parts[2]='page') or (array_length(parts,1)=4 and parts[3]='page') then
   digits:=substring(parts[array_length(parts,1)] from '^[[:space:]]*([+-]?[0-9]+)');
   begin page:=digits::float8; exception when numeric_value_out_of_range then page:=null; end;
   if page is null or page<=0 or page='Infinity'::float8 then page:=1; end if;
   -- JS integer string form below 1e21 is decimal, above it is scientific.
   rendered:=case when page<1e21 then page::text::numeric::text else replace(page::text,'e+0','e+') end;
   return r.target_url||'/'||array_to_string(parts[1:array_length(parts,1)-2],'/')||'/page/'||rendered;
  end if;
  return null; -- no legacy route folder matches this shape
 end if;
 return r.target_url||tail;
end $$;

create function public.resolve_site_route(p_path text)
returns table(route public.site_routes,resolved_target text)
language sql stable security definer set search_path='' as $$
 select r,public.site_route_target(r,p_path) from public.site_routes r
 where r.path=p_path and (r.match_type='exact' or r.match_self)
    or r.match_type='prefix' and (starts_with(p_path,r.path||'/') or r.path='/' and p_path<>'/' and starts_with(p_path,'/'))
       and (r.tail_mode<>'free-items' or public.site_route_target(r,p_path) is not null)
 order by (r.match_type='exact') desc,length(r.path) desc limit 1
$$;
create view public.site_route_redirects with (security_invoker=true) as
 select r.*,public.site_route_target(r,r.path) resolved_target from public.site_routes r where status='old';
revoke all on public.site_route_redirects from public,anon,authenticated;
grant select on public.site_route_redirects to service_role;

-- One statement / one snapshot: no REST row limit truncation or cross-page drift.
create function public.site_routes_report() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'counts',coalesce((select jsonb_agg(to_jsonb(c)) from (select source,page_type,status,origin,count(*) from public.site_routes group by source,page_type,status,origin order by source,page_type,status,origin)c),'[]'::jsonb),
  'conflicts',coalesce((select jsonb_agg(to_jsonb(c) order by id) from public.site_route_conflicts c),'[]'::jsonb),
  'orphaned_redirects',coalesce((select jsonb_agg(to_jsonb(r) order by path) from public.site_routes r where status='old' and page_id is not null and not exists(select 1 from public.site_routes live where live.source=r.source and live.page_type=r.page_type and live.page_id=r.page_id and live.status='live')),'[]'::jsonb),
  'prefixes',coalesce((select jsonb_agg(to_jsonb(r) order by path) from public.site_routes r where match_type='prefix'),'[]'::jsonb),
  'missing_pages',coalesce((select jsonb_agg(to_jsonb(e) order by page_table,page_id) from public.expected_site_routes e where not exists(select 1 from public.site_routes r where r.path=e.path and r.source=e.source and r.page_type=e.page_type and r.page_id=e.page_id and r.status='live')
    and not (e.page_table='games' and exists(select 1 from public.site_routes r where r.path=e.path and r.status='live' and r.page_type<>'hub'))),'[]'::jsonb),
  'code_old_slugs_added',(select count(*) from public.site_routes where origin='code_pages.old_slugs'),
  'unmapped_catalogs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code) order by code) from public.catalog_pages where public.site_catalog_path(code) is null),'[]'::jsonb)
 )
$$;
-- Explicitly revoke default EXECUTE, including internal helpers with write access.
revoke all on function public.site_catalog_path(text) from public,anon,authenticated;
grant execute on function public.site_catalog_path(text) to service_role;
revoke all on function public.site_page_route(text,jsonb) from public,anon,authenticated;
grant execute on function public.site_page_route(text,jsonb) to service_role;
revoke all on function public.claim_site_route(jsonb,boolean) from public,anon,authenticated;
grant execute on function public.claim_site_route(jsonb,boolean) to service_role;
revoke all on function public.sync_site_page_route() from public,anon,authenticated;
grant execute on function public.sync_site_page_route() to service_role;
revoke all on function public.site_route_touch() from public,anon,authenticated;
grant execute on function public.site_route_touch() to service_role;
revoke all on function public.site_route_target(public.site_routes,text) from public,anon,authenticated;
grant execute on function public.site_route_target(public.site_routes,text) to service_role;
revoke all on function public.resolve_site_route(text) from public,anon,authenticated;
grant execute on function public.resolve_site_route(text) to service_role;
revoke all on function public.site_routes_report() from public,anon,authenticated;
grant execute on function public.site_routes_report() to service_role;
revoke all on function public.restore_site_hubs(text) from public,anon,authenticated;
grant execute on function public.restore_site_hubs(text) to service_role;
revoke all on function public.sync_site_catalog_route(text) from public,anon,authenticated;
grant execute on function public.sync_site_catalog_route(text) to service_role;
revoke all on function public.lock_site_route_writes() from public,anon,authenticated;
grant execute on function public.lock_site_route_writes() to service_role;
-- pg_temp helper is discarded with the session; no persistent import API.
create function pg_temp.import_site_redirect(p_path text,p_target text,p_origin text,
 p_type text default null,p_slug text default null,p_match text default 'exact',
 p_code integer default 301,p_tail text default 'append',p_self boolean default true) returns void
language plpgsql set search_path='' as $$
declare pid text;
begin
 if p_type='article' then select id::text into pid from public.articles where slug=p_slug order by id::text limit 1;
 elsif p_type='code' then select id::text into pid from public.code_pages where slug=p_slug order by id::text limit 1; end if;
 perform public.claim_site_route(jsonb_build_object('path',p_path,'target_url',case when pid is null then p_target end,
 'page_id',pid,'source',case when pid is not null then 'roblox' end,'page_type',case when pid is not null then p_type end,
 'status','old','origin',p_origin,'match_type',p_match,'redirect_code',p_code,'tail_mode',p_tail,'match_self',p_self),true);
end $$;

-- Match publish_game_content_batch's table order (20261006114354:10),
-- then collection/Roblox parents before children. Do not wait behind publishers
-- indefinitely. SQLSTATE 55P03 aborts the atomic release; retry when they finish.
set local lock_timeout = '3s';
lock table public.games,public.game_wiki_pages,public.game_code_pages,public.game_tool_pages,public.game_map_pages,public.game_quiz_pages,public.game_catalog_pages,public.game_checklist_pages,public.game_collection_pages,public.code_pages,public.wiki_pages,public.wiki_collection_pages,public.quiz_pages,public.checklist_pages,public.tools,public.events_pages,public.articles,public.catalog_pages,public.puzzle_pages in share row exclusive mode;
-- Adding this FK also locks games; defer it to the same short publisher window.
alter table public.site_routes add constraint site_routes_game_id_fkey
 foreign key(game_id) references public.games(id) on delete set null;
-- Stable priority: listed editorial tables, shared tables, then synthetic hubs;
-- within a table: primary-key text order (catalog fallback aliases are filtered). Live always precedes every redirect.
do $$
declare r record;
begin
 for r in select * from public.expected_site_routes order by case page_table
when 'code_pages' then 0
when 'wiki_pages' then 1
when 'wiki_collection_pages' then 2
when 'quiz_pages' then 3
when 'checklist_pages' then 4
when 'tools' then 5
when 'events_pages' then 6
when 'articles' then 7
when 'catalog_pages' then 8
when 'game_wiki_pages' then 9
when 'game_collection_pages' then 10
when 'game_code_pages' then 11
when 'game_tool_pages' then 12
when 'game_checklist_pages' then 13
when 'game_map_pages' then 14
when 'game_quiz_pages' then 15
when 'game_catalog_pages' then 16
when 'puzzle_pages' then 17
when 'games' then 18 end,page_id loop
  if r.page_table='games' and exists(select 1 from public.site_routes where path=r.path and status='live') then continue; end if;
  perform public.claim_site_route(jsonb_build_object('path',r.path,'page_id',r.page_id,'source',r.source,'page_type',r.page_type,'game_id',r.game_id,'status','live','origin','backfill'),true);
 end loop;
end $$;
-- Route statements take the advisory lock BEFORE publisher row locks. UPDATE OF
-- filters the SET list; WHEN suppresses row work for no-op route assignments.
-- A no-op route assignment still takes the statement lock, as do zero-row writes.
-- Transactions that explicitly lock page rows before route DML must take this
-- advisory lock first too; unrelated updates themselves take no advisory lock.
create trigger site_route_write_lock before insert or delete or update of id, slug, old_slugs on public.code_pages for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.code_pages for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, slug, old_slugs on public.code_pages for each row when (old.id is distinct from new.id or old.slug is distinct from new.slug or old.old_slugs is distinct from new.old_slugs) execute function public.sync_site_page_route();
create trigger site_route_write_lock before insert or delete or update of id, slug on public.wiki_pages for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.wiki_pages for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, slug on public.wiki_pages for each row when (old.id is distinct from new.id or old.slug is distinct from new.slug) execute function public.sync_site_page_route();
create trigger site_route_write_lock before insert or delete or update of id, wiki_slug, collection_slug on public.wiki_collection_pages for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.wiki_collection_pages for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, wiki_slug, collection_slug on public.wiki_collection_pages for each row when (old.id is distinct from new.id or old.wiki_slug is distinct from new.wiki_slug or old.collection_slug is distinct from new.collection_slug) execute function public.sync_site_page_route();
create trigger site_route_write_lock before insert or delete or update of id, code on public.quiz_pages for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.quiz_pages for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, code on public.quiz_pages for each row when (old.id is distinct from new.id or old.code is distinct from new.code) execute function public.sync_site_page_route();
create trigger site_route_write_lock before insert or delete or update of id, slug on public.checklist_pages for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.checklist_pages for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, slug on public.checklist_pages for each row when (old.id is distinct from new.id or old.slug is distinct from new.slug) execute function public.sync_site_page_route();
create trigger site_route_write_lock before insert or delete or update of id, code on public.tools for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.tools for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, code on public.tools for each row when (old.id is distinct from new.id or old.code is distinct from new.code) execute function public.sync_site_page_route();
create trigger site_route_write_lock before insert or delete or update of id, slug on public.events_pages for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.events_pages for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, slug on public.events_pages for each row when (old.id is distinct from new.id or old.slug is distinct from new.slug) execute function public.sync_site_page_route();
create trigger site_route_write_lock before insert or delete or update of id, slug on public.articles for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.articles for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, slug on public.articles for each row when (old.id is distinct from new.id or old.slug is distinct from new.slug) execute function public.sync_site_page_route();
create trigger site_route_write_lock before insert or delete or update of id, code on public.catalog_pages for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.catalog_pages for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, code on public.catalog_pages for each row when (old.id is distinct from new.id or old.code is distinct from new.code) execute function public.sync_site_page_route();
create trigger site_route_write_lock before insert or delete or update of id, canonical_path, game_id on public.game_wiki_pages for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.game_wiki_pages for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, canonical_path, game_id on public.game_wiki_pages for each row when (old.id is distinct from new.id or old.canonical_path is distinct from new.canonical_path or old.game_id is distinct from new.game_id) execute function public.sync_site_page_route();
create trigger site_route_write_lock before insert or delete or update of id, canonical_path, game_id on public.game_collection_pages for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.game_collection_pages for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, canonical_path, game_id on public.game_collection_pages for each row when (old.id is distinct from new.id or old.canonical_path is distinct from new.canonical_path or old.game_id is distinct from new.game_id) execute function public.sync_site_page_route();
create trigger site_route_write_lock before insert or delete or update of id, canonical_path, game_id on public.game_code_pages for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.game_code_pages for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, canonical_path, game_id on public.game_code_pages for each row when (old.id is distinct from new.id or old.canonical_path is distinct from new.canonical_path or old.game_id is distinct from new.game_id) execute function public.sync_site_page_route();
create trigger site_route_write_lock before insert or delete or update of id, canonical_path, game_id on public.game_tool_pages for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.game_tool_pages for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, canonical_path, game_id on public.game_tool_pages for each row when (old.id is distinct from new.id or old.canonical_path is distinct from new.canonical_path or old.game_id is distinct from new.game_id) execute function public.sync_site_page_route();
create trigger site_route_write_lock before insert or delete or update of id, canonical_path, game_id on public.game_checklist_pages for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.game_checklist_pages for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, canonical_path, game_id on public.game_checklist_pages for each row when (old.id is distinct from new.id or old.canonical_path is distinct from new.canonical_path or old.game_id is distinct from new.game_id) execute function public.sync_site_page_route();
create trigger site_route_write_lock before insert or delete or update of id, canonical_path, game_id on public.game_map_pages for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.game_map_pages for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, canonical_path, game_id on public.game_map_pages for each row when (old.id is distinct from new.id or old.canonical_path is distinct from new.canonical_path or old.game_id is distinct from new.game_id) execute function public.sync_site_page_route();
create trigger site_route_write_lock before insert or delete or update of id, canonical_path, game_id on public.game_quiz_pages for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.game_quiz_pages for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, canonical_path, game_id on public.game_quiz_pages for each row when (old.id is distinct from new.id or old.canonical_path is distinct from new.canonical_path or old.game_id is distinct from new.game_id) execute function public.sync_site_page_route();
create trigger site_route_write_lock before insert or delete or update of id, canonical_path, game_id on public.game_catalog_pages for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.game_catalog_pages for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, canonical_path, game_id on public.game_catalog_pages for each row when (old.id is distinct from new.id or old.canonical_path is distinct from new.canonical_path or old.game_id is distinct from new.game_id) execute function public.sync_site_page_route();
create trigger site_route_write_lock before insert or delete or update of id, slug on public.puzzle_pages for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.puzzle_pages for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, slug on public.puzzle_pages for each row when (old.id is distinct from new.id or old.slug is distinct from new.slug) execute function public.sync_site_page_route();
create trigger site_route_write_lock before insert or delete or update of id, namespace, parent_id on public.games for each statement execute function public.lock_site_route_writes();
create trigger site_route_sync after insert or delete on public.games for each row execute function public.sync_site_page_route();
create trigger site_route_sync_update after update of id, namespace, parent_id on public.games for each row when (old.id is distinct from new.id or old.namespace is distinct from new.namespace or old.parent_id is distinct from new.parent_id) execute function public.sync_site_page_route();

-- Redirect backfill priority: next.config, articles, root codes, Minecraft,
-- retired lists, free-item folders, then the newly enabled code_pages.old_slugs.
select pg_temp.import_site_redirect('/catalog/roblox-music-ids/games/work-at-a-pizza-place','/catalog/roblox-music-ids','next.config',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/ads.txt','https://adstxt.mediavine.com/sites/75d9ab7d-268c-4e03-bb6c-180ca4b8d5ed/ads.txt','next.config');
select pg_temp.import_site_redirect('/when-does-the-museum-open-in-jailbreak-roblox','/articles/when-does-the-museum-open-in-jailbreak-roblox','article-redirect-slugs','article','when-does-the-museum-open-in-jailbreak-roblox');
select pg_temp.import_site_redirect('/how-to-level-up-fast-in-jailbreak-criminal-vs-cop','/articles/how-to-level-up-fast-in-jailbreak-criminal-vs-cop','article-redirect-slugs','article','how-to-level-up-fast-in-jailbreak-criminal-vs-cop');
select pg_temp.import_site_redirect('/how-to-get-a-mansion-invite-in-jailbreak-roblox','/articles/how-to-get-a-mansion-invite-in-jailbreak-roblox','article-redirect-slugs','article','how-to-get-a-mansion-invite-in-jailbreak-roblox');
select pg_temp.import_site_redirect('/steal-a-brainrot-dealer-update-guide','/articles/steal-a-brainrot-dealer-update-guide','article-redirect-slugs','article','steal-a-brainrot-dealer-update-guide');
select pg_temp.import_site_redirect('/why-roblox-s-simple-graphics-still-beat-every-realistic-game','/articles/why-roblox-s-simple-graphics-still-beat-every-realistic-game','article-redirect-slugs','article','why-roblox-s-simple-graphics-still-beat-every-realistic-game');
select pg_temp.import_site_redirect('/where-to-find-criminal-base-on-roblox-jailbreak','/articles/where-to-find-criminal-base-on-roblox-jailbreak','article-redirect-slugs','article','where-to-find-criminal-base-on-roblox-jailbreak');
select pg_temp.import_site_redirect('/how-to-get-robux-free-and-paid','/articles/how-to-get-robux-free-and-paid','article-redirect-slugs','article','how-to-get-robux-free-and-paid');
select pg_temp.import_site_redirect('/best-simple-roblox-games-for-beginners','/articles/best-simple-roblox-games-for-beginners','article-redirect-slugs','article','best-simple-roblox-games-for-beginners');
select pg_temp.import_site_redirect('/how-to-get-spooky-chest-in-grow-a-garden','/articles/how-to-get-spooky-chest-in-grow-a-garden','article-redirect-slugs','article','how-to-get-spooky-chest-in-grow-a-garden');
select pg_temp.import_site_redirect('/roblox-halloween-spotlight-event-2025','/articles/roblox-halloween-spotlight-event-2025','article-redirect-slugs','article','roblox-halloween-spotlight-event-2025');
select pg_temp.import_site_redirect('/create-and-publish-roblox-game','/articles/create-and-publish-roblox-game','article-redirect-slugs','article','create-and-publish-roblox-game');
select pg_temp.import_site_redirect('/all-fisch-enchantments-guide','/articles/all-fisch-enchantments-guide','article-redirect-slugs','article','all-fisch-enchantments-guide');
select pg_temp.import_site_redirect('/99-nights-in-the-forest-codes','/codes/99-nights-in-the-forest','slug_oldslugs','code','99-nights-in-the-forest');
select pg_temp.import_site_redirect('/a-hero-s-destiny-codes','/codes/a-hero-s-destiny','slug_oldslugs','code','a-hero-s-destiny');
select pg_temp.import_site_redirect('/a-one-piece-game-aopg-codes','/codes/a-one-piece-game-aopg','slug_oldslugs','code','a-one-piece-game-aopg');
select pg_temp.import_site_redirect('/a-universal-time-aut-codes','/codes/a-universal-time-aut','slug_oldslugs','code','a-universal-time-aut');
select pg_temp.import_site_redirect('/adopt-me-codes','/codes/adopt-me','slug_oldslugs','code','adopt-me');
select pg_temp.import_site_redirect('/all-star-tower-defense-codes','/codes/all-star-tower-defense','slug_oldslugs','code','all-star-tower-defense');
select pg_temp.import_site_redirect('/all-star-tower-defense-x-codes','/codes/all-star-tower-defense-x','slug_oldslugs','code','all-star-tower-defense-x');
select pg_temp.import_site_redirect('/anime-adventures-codes','/codes/anime-adventures','slug_oldslugs','code','anime-adventures');
select pg_temp.import_site_redirect('/anime-anexus-simulator-codes','/codes/anime-anexus-simulator','slug_oldslugs','code','anime-anexus-simulator');
select pg_temp.import_site_redirect('/anime-apex-codes','/codes/anime-apex','slug_oldslugs','code','anime-apex');
select pg_temp.import_site_redirect('/anime-arise-evolution-codes','/codes/anime-arise-evolution','slug_oldslugs','code','anime-arise-evolution');
select pg_temp.import_site_redirect('/anime-ascend-codes','/codes/anime-ascend','slug_oldslugs','code','anime-ascend');
select pg_temp.import_site_redirect('/anime-boss-raid-codes','/codes/anime-boss-raid','slug_oldslugs','code','anime-boss-raid');
select pg_temp.import_site_redirect('/anime-card-battle-codes','/codes/anime-card-battle','slug_oldslugs','code','anime-card-battle');
select pg_temp.import_site_redirect('/anime-card-clash-codes','/codes/anime-card-clash','slug_oldslugs','code','anime-card-clash');
select pg_temp.import_site_redirect('/anime-card-master-codes','/codes/anime-card-master','slug_oldslugs','code','anime-card-master');
select pg_temp.import_site_redirect('/anime-champions-simulator-codes','/codes/anime-champions-simulator','slug_oldslugs','code','anime-champions-simulator');
select pg_temp.import_site_redirect('/anime-chaos-simulator-codes','/codes/anime-chaos-simulator','slug_oldslugs','code','anime-chaos-simulator');
select pg_temp.import_site_redirect('/anime-chefs-codes','/codes/anime-chefs','slug_oldslugs','code','anime-chefs');
select pg_temp.import_site_redirect('/anime-climb-and-jump-codes','/codes/anime-climb-and-jump','slug_oldslugs','code','anime-climb-and-jump');
select pg_temp.import_site_redirect('/anime-crossover-defense-codes','/codes/anime-crossover-defense','slug_oldslugs','code','anime-crossover-defense');
select pg_temp.import_site_redirect('/anime-crusaders-codes','/codes/anime-crusaders','slug_oldslugs','code','anime-crusaders');
select pg_temp.import_site_redirect('/anime-defenders-codes','/codes/anime-defenders','slug_oldslugs','code','anime-defenders');
select pg_temp.import_site_redirect('/anime-defense-rng-codes','/codes/anime-defense-rng','slug_oldslugs','code','anime-defense-rng');
select pg_temp.import_site_redirect('/anime-dimensions-simulator-codes','/codes/anime-dimensions-simulator','slug_oldslugs','code','anime-dimensions-simulator');
select pg_temp.import_site_redirect('/anime-dungeon-fighters-codes','/codes/anime-dungeon-fighters','slug_oldslugs','code','anime-dungeon-fighters');
select pg_temp.import_site_redirect('/anime-eternal-codes','/codes/anime-eternal','slug_oldslugs','code','anime-eternal');
select pg_temp.import_site_redirect('/anime-fantasy-codes','/codes/anime-fantasy','slug_oldslugs','code','anime-fantasy');
select pg_temp.import_site_redirect('/anime-fantasy-kingdom-codes','/codes/anime-fantasy-kingdom','slug_oldslugs','code','anime-fantasy-kingdom');
select pg_temp.import_site_redirect('/anime-fate-echoes-codes','/codes/anime-fate-echoes','slug_oldslugs','code','anime-fate-echoes');
select pg_temp.import_site_redirect('/anime-fighters-simulator-codes','/codes/anime-fighters-simulator','slug_oldslugs','code','anime-fighters-simulator');
select pg_temp.import_site_redirect('/anime-final-strike-codes','/codes/anime-final-strike','slug_oldslugs','code','anime-final-strike');
select pg_temp.import_site_redirect('/anime-fruit-world-codes','/codes/anime-fruit-world','slug_oldslugs','code','anime-fruit-world');
select pg_temp.import_site_redirect('/anime-geek-codes','/codes/anime-geek','slug_oldslugs','code','anime-geek');
select pg_temp.import_site_redirect('/anime-hunters-simulator-codes','/codes/anime-hunters-simulator','slug_oldslugs','code','anime-hunters-simulator');
select pg_temp.import_site_redirect('/anime-immortals-codes','/codes/anime-immortals','slug_oldslugs','code','anime-immortals');
select pg_temp.import_site_redirect('/anime-impact-codes','/codes/anime-impact','slug_oldslugs','code','anime-impact');
select pg_temp.import_site_redirect('/anime-infinity-codes','/codes/anime-infinity','slug_oldslugs','code','anime-infinity');
select pg_temp.import_site_redirect('/anime-kingdom-simulator-codes','/codes/anime-kingdom-simulator','slug_oldslugs','code','anime-kingdom-simulator');
select pg_temp.import_site_redirect('/anime-last-stand-codes','/codes/anime-last-stand','slug_oldslugs','code','anime-last-stand');
select pg_temp.import_site_redirect('/anime-mania-codes','/codes/anime-mania','slug_oldslugs','code','anime-mania');
select pg_temp.import_site_redirect('/anime-multiverse-codes','/codes/anime-multiverse','slug_oldslugs','code','anime-multiverse');
select pg_temp.import_site_redirect('/anime-rangers-x-codes','/codes/anime-rangers-x','slug_oldslugs','code','anime-rangers-x');
select pg_temp.import_site_redirect('/anime-realms-codes','/codes/anime-realms','slug_oldslugs','code','anime-realms');
select pg_temp.import_site_redirect('/anime-reborn-codes','/codes/anime-reborn','slug_oldslugs','code','anime-reborn');
select pg_temp.import_site_redirect('/anime-revolution-x-codes','/codes/anime-revolution-x','slug_oldslugs','code','anime-revolution-x');
select pg_temp.import_site_redirect('/anime-rising-codes','/codes/anime-rising','slug_oldslugs','code','anime-rising');
select pg_temp.import_site_redirect('/anime-rng-td-codes','/codes/anime-rng-td','slug_oldslugs','code','anime-rng-td');
select pg_temp.import_site_redirect('/anime-roulette-codes','/codes/anime-roulette','slug_oldslugs','code','anime-roulette');
select pg_temp.import_site_redirect('/anime-royale-codes','/codes/anime-royale','slug_oldslugs','code','anime-royale');
select pg_temp.import_site_redirect('/anime-rush-codes','/codes/anime-rush','slug_oldslugs','code','anime-rush');
select pg_temp.import_site_redirect('/anime-showdown-codes','/codes/anime-showdown','slug_oldslugs','code','anime-showdown');
select pg_temp.import_site_redirect('/anime-simulator-codes','/codes/anime-simulator','slug_oldslugs','code','anime-simulator');
select pg_temp.import_site_redirect('/anime-slashing-simulator-codes','/codes/anime-slashing-simulator','slug_oldslugs','code','anime-slashing-simulator');
select pg_temp.import_site_redirect('/anime-slaying-codes','/codes/anime-slaying','slug_oldslugs','code','anime-slaying');
select pg_temp.import_site_redirect('/anime-storm-simulator-codes','/codes/anime-storm-simulator','slug_oldslugs','code','anime-storm-simulator');
select pg_temp.import_site_redirect('/anime-strike-simulator-codes','/codes/anime-strike-simulator','slug_oldslugs','code','anime-strike-simulator');
select pg_temp.import_site_redirect('/anime-strikers-codes','/codes/anime-strikers','slug_oldslugs','code','anime-strikers');
select pg_temp.import_site_redirect('/anime-switch-codes','/codes/anime-switch','slug_oldslugs','code','anime-switch');
select pg_temp.import_site_redirect('/anime-sword-master-codes','/codes/anime-sword-master','slug_oldslugs','code','anime-sword-master');
select pg_temp.import_site_redirect('/anime-ultimate-battlegrounds-codes','/codes/anime-ultimate-battlegrounds','slug_oldslugs','code','anime-ultimate-battlegrounds');
select pg_temp.import_site_redirect('/anime-unlimited-codes','/codes/anime-unlimited','slug_oldslugs','code','anime-unlimited');
select pg_temp.import_site_redirect('/anime-vanguards-codes','/codes/anime-vanguards','slug_oldslugs','code','anime-vanguards');
select pg_temp.import_site_redirect('/anime-venture-codes','/codes/anime-venture','slug_oldslugs','code','anime-venture');
select pg_temp.import_site_redirect('/anime-verse-x-codes','/codes/anime-verse-x','slug_oldslugs','code','anime-verse-x');
select pg_temp.import_site_redirect('/anime-world-tower-defense-codes','/codes/anime-world-tower-defense','slug_oldslugs','code','anime-world-tower-defense');
select pg_temp.import_site_redirect('/arcade-basketball-codes','/codes/arcade-basketball','slug_oldslugs','code','arcade-basketball');
select pg_temp.import_site_redirect('/arcane-seas-codes','/codes/arcane-seas','slug_oldslugs','code','arcane-seas');
select pg_temp.import_site_redirect('/arm-wrestle-simulator-codes','/codes/arm-wrestle-simulator','slug_oldslugs','code','arm-wrestle-simulator');
select pg_temp.import_site_redirect('/arsenal-codes','/codes/arsenal','slug_oldslugs','code','arsenal');
select pg_temp.import_site_redirect('/ascender-incremental-codes','/codes/ascender-incremental','slug_oldslugs','code','ascender-incremental');
select pg_temp.import_site_redirect('/astral-rng-codes','/codes/astral-rng','slug_oldslugs','code','astral-rng');
select pg_temp.import_site_redirect('/asura-codes','/codes/asura','slug_oldslugs','code','asura');
select pg_temp.import_site_redirect('/asylum-life-codes','/codes/asylum-life','slug_oldslugs','code','asylum-life');
select pg_temp.import_site_redirect('/attack-on-titan-evolution-codes','/codes/attack-on-titan-evolution','slug_oldslugs','code','attack-on-titan-evolution');
select pg_temp.import_site_redirect('/aura-battles-codes','/codes/aura-battles','slug_oldslugs','code','aura-battles');
select pg_temp.import_site_redirect('/aura-farm-boat-racing-codes','/codes/aura-farm-boat-racing','slug_oldslugs','code','aura-farm-boat-racing');
select pg_temp.import_site_redirect('/aura-farm-simulator-codes','/codes/aura-farm-simulator','slug_oldslugs','code','aura-farm-simulator');
select pg_temp.import_site_redirect('/aura-rng-codes','/codes/aura-rng','slug_oldslugs','code','aura-rng');
select pg_temp.import_site_redirect('/bad-business-codes','/codes/bad-business','slug_oldslugs','code','bad-business');
select pg_temp.import_site_redirect('/baddies-codes','/codes/baddies','slug_oldslugs','code','baddies');
select pg_temp.import_site_redirect('/basketball-legends-codes','/codes/basketball-legends','slug_oldslugs','code','basketball-legends');
select pg_temp.import_site_redirect('/basketball-zero-codes','/codes/basketball-zero','slug_oldslugs','code','basketball-zero');
select pg_temp.import_site_redirect('/battle-cat-evolution-codes','/codes/battle-cat-evolution','slug_oldslugs','code','battle-cat-evolution');
select pg_temp.import_site_redirect('/bayside-high-school-codes','/codes/bayside-high-school','slug_oldslugs','code','bayside-high-school');
select pg_temp.import_site_redirect('/be-a-nurse-codes','/codes/be-a-nurse','slug_oldslugs','code','be-a-nurse');
select pg_temp.import_site_redirect('/beaks-codes','/codes/beaks','slug_oldslugs','code','beaks');
select pg_temp.import_site_redirect('/bee-masters-simulator-codes','/codes/bee-masters-simulator','slug_oldslugs','code','bee-masters-simulator');
select pg_temp.import_site_redirect('/bee-swarm-simulator-codes','/codes/bee-swarm-simulator','slug_oldslugs','code','bee-swarm-simulator');
select pg_temp.import_site_redirect('/bike-league-codes','/codes/bike-league','slug_oldslugs','code','bike-league');
select pg_temp.import_site_redirect('/bikeworld-codes','/codes/bikeworld','slug_oldslugs','code','bikeworld');
select pg_temp.import_site_redirect('/blade-ball-codes','/codes/blade-ball','slug_oldslugs','code','blade-ball');
select pg_temp.import_site_redirect('/bladers-rebirth-codes','/codes/bladers-rebirth','slug_oldslugs','code','bladers-rebirth');
select pg_temp.import_site_redirect('/blades-codes','/codes/blades','slug_oldslugs','code','blades');
select pg_temp.import_site_redirect('/blades-rng-blades-of-chance-codes','/codes/blades-rng-blades-of-chance','slug_oldslugs','code','blades-rng-blades-of-chance');
select pg_temp.import_site_redirect('/blockspin-codes','/codes/blockspin','slug_oldslugs','code','blockspin');
select pg_temp.import_site_redirect('/blood-of-punch-codes','/codes/blood-of-punch','slug_oldslugs','code','blood-of-punch');
select pg_temp.import_site_redirect('/blox-fruits-codes','/codes/blox-fruits','slug_oldslugs','code','blox-fruits');
select pg_temp.import_site_redirect('/blue-lock-rivals-codes','/codes/blue-lock-rivals','slug_oldslugs','code','blue-lock-rivals');
select pg_temp.import_site_redirect('/boku-no-roblox-remastered-codes','/codes/boku-no-roblox-remastered','slug_oldslugs','code','boku-no-roblox-remastered');
select pg_temp.import_site_redirect('/bounce-a-brainrot-codes','/codes/bounce-a-brainrot','slug_oldslugs','code','bounce-a-brainrot');
select pg_temp.import_site_redirect('/boxing-beta-codes','/codes/boxing-beta','slug_oldslugs','code','boxing-beta');
select pg_temp.import_site_redirect('/brainrot-evolution-codes','/codes/brainrot-evolution','slug_oldslugs','code','brainrot-evolution');
select pg_temp.import_site_redirect('/brainrot-fighting-codes','/codes/brainrot-fighting','slug_oldslugs','code','brainrot-fighting');
select pg_temp.import_site_redirect('/brainrot-tower-defense-codes','/codes/brainrot-tower-defense','slug_oldslugs','code','brainrot-tower-defense');
select pg_temp.import_site_redirect('/brainrot-training-codes','/codes/brainrot-training','slug_oldslugs','code','brainrot-training');
select pg_temp.import_site_redirect('/build-a-factory-codes','/codes/build-a-factory','slug_oldslugs','code','build-a-factory');
select pg_temp.import_site_redirect('/build-a-scam-empire-codes','/codes/build-a-scam-empire','slug_oldslugs','code','build-a-scam-empire');
select pg_temp.import_site_redirect('/build-a-tractor-codes','/codes/build-a-tractor','slug_oldslugs','code','build-a-tractor');
select pg_temp.import_site_redirect('/build-a-zoo-codes','/codes/build-a-zoo','slug_oldslugs','code','build-a-zoo');
select pg_temp.import_site_redirect('/build-defense-codes','/codes/build-defense','slug_oldslugs','code','build-defense');
select pg_temp.import_site_redirect('/cabin-crew-simulator-codes','/codes/cabin-crew-simulator','slug_oldslugs','code','cabin-crew-simulator');
select pg_temp.import_site_redirect('/cake-off-codes','/codes/cake-off','slug_oldslugs','code','cake-off');
select pg_temp.import_site_redirect('/cali-shootout-codes','/codes/cali-shootout','slug_oldslugs','code','cali-shootout');
select pg_temp.import_site_redirect('/car-crushers-2-codes','/codes/car-crushers-2','slug_oldslugs','code','car-crushers-2');
select pg_temp.import_site_redirect('/car-driving-indonesia-codes','/codes/car-driving-indonesia','slug_oldslugs','code','car-driving-indonesia');
select pg_temp.import_site_redirect('/car-training-codes','/codes/car-training','slug_oldslugs','code','car-training');
select pg_temp.import_site_redirect('/card-rng-codes','/codes/card-rng','slug_oldslugs','code','card-rng');
select pg_temp.import_site_redirect('/catch-a-bee-codes','/codes/catch-a-bee','slug_oldslugs','code','catch-a-bee');
select pg_temp.import_site_redirect('/catch-critters-codes','/codes/catch-critters','slug_oldslugs','code','catch-critters');
select pg_temp.import_site_redirect('/claw-machine-simulator-codes','/codes/claw-machine-simulator','slug_oldslugs','code','claw-machine-simulator');
select pg_temp.import_site_redirect('/clean-a-house-codes','/codes/clean-a-house','slug_oldslugs','code','clean-a-house');
select pg_temp.import_site_redirect('/clicking-universe-codes','/codes/clicking-universe','slug_oldslugs','code','clicking-universe');
select pg_temp.import_site_redirect('/climbing-game-codes','/codes/climbing-game','slug_oldslugs','code','climbing-game');
select pg_temp.import_site_redirect('/clothing-store-simulator-codes','/codes/clothing-store-simulator','slug_oldslugs','code','clothing-store-simulator');
select pg_temp.import_site_redirect('/clover-retribution-codes','/codes/clover-retribution','slug_oldslugs','code','clover-retribution');
select pg_temp.import_site_redirect('/club-roblox-codes','/codes/club-roblox','slug_oldslugs','code','club-roblox');
select pg_temp.import_site_redirect('/collect-all-pets-codes','/codes/collect-all-pets','slug_oldslugs','code','collect-all-pets');
select pg_temp.import_site_redirect('/combat-warriors-codes','/codes/combat-warriors','slug_oldslugs','code','combat-warriors');
select pg_temp.import_site_redirect('/cookie-kingdom-world-codes','/codes/cookie-kingdom-world','slug_oldslugs','code','cookie-kingdom-world');
select pg_temp.import_site_redirect('/creatures-of-sonaria-codes','/codes/creatures-of-sonaria','slug_oldslugs','code','creatures-of-sonaria');
select pg_temp.import_site_redirect('/criminality-codes','/codes/criminality','slug_oldslugs','code','criminality');
select pg_temp.import_site_redirect('/cultivation-simulator-codes','/codes/cultivation-simulator','slug_oldslugs','code','cultivation-simulator');
select pg_temp.import_site_redirect('/da-hood-codes','/codes/da-hood','slug_oldslugs','code','da-hood');
select pg_temp.import_site_redirect('/dalgona-tycoon-codes','/codes/dalgona-tycoon','slug_oldslugs','code','dalgona-tycoon');
select pg_temp.import_site_redirect('/dance-for-ugc-codes','/codes/dance-for-ugc','slug_oldslugs','code','dance-for-ugc');
select pg_temp.import_site_redirect('/dandy-s-world-codes','/codes/dandy-s-world','slug_oldslugs','code','dandy-s-world');
select pg_temp.import_site_redirect('/dead-camp-codes','/codes/dead-camp','slug_oldslugs','code','dead-camp');
select pg_temp.import_site_redirect('/dead-rails-codes','/codes/dead-rails','slug_oldslugs','code','dead-rails');
select pg_temp.import_site_redirect('/dead-sails-dragon-event-codes','/codes/dead-sails-dragon-event','slug_oldslugs','code','dead-sails-dragon-event');
select pg_temp.import_site_redirect('/dead-sewers-codes','/codes/dead-sewers','slug_oldslugs','code','dead-sewers');
select pg_temp.import_site_redirect('/dead-space-event-codes','/codes/dead-space-event','slug_oldslugs','code','dead-space-event');
select pg_temp.import_site_redirect('/dead-spells-codes','/codes/dead-spells','slug_oldslugs','code','dead-spells');
select pg_temp.import_site_redirect('/dead-waters-codes','/codes/dead-waters','slug_oldslugs','code','dead-waters');
select pg_temp.import_site_redirect('/delay-latch-codes','/codes/delay-latch','slug_oldslugs','code','delay-latch');
select pg_temp.import_site_redirect('/demon-slayer-legacy-codes','/codes/demon-slayer-legacy','slug_oldslugs','code','demon-slayer-legacy');
select pg_temp.import_site_redirect('/demon-soul-simulator-codes','/codes/demon-soul-simulator','slug_oldslugs','code','demon-soul-simulator');
select pg_temp.import_site_redirect('/demon-warriors-codes','/codes/demon-warriors','slug_oldslugs','code','demon-warriors');
select pg_temp.import_site_redirect('/demonfall-codes','/codes/demonfall','slug_oldslugs','code','demonfall');
select pg_temp.import_site_redirect('/desert-detectors-codes','/codes/desert-detectors','slug_oldslugs','code','desert-detectors');
select pg_temp.import_site_redirect('/dig-codes','/codes/dig','slug_oldslugs','code','dig');
select pg_temp.import_site_redirect('/dig-it-codes','/codes/dig-it','slug_oldslugs','code','dig-it');
select pg_temp.import_site_redirect('/dinosaur-simulator-codes','/codes/dinosaur-simulator','slug_oldslugs','code','dinosaur-simulator');
select pg_temp.import_site_redirect('/divaz-codes','/codes/divaz','slug_oldslugs','code','divaz');
select pg_temp.import_site_redirect('/divine-duality-elemental-codes','/codes/divine-duality-elemental','slug_oldslugs','code','divine-duality-elemental');
select pg_temp.import_site_redirect('/dodgeball-legends-codes','/codes/dodgeball-legends','slug_oldslugs','code','dodgeball-legends');
select pg_temp.import_site_redirect('/dodgeball-x-codes','/codes/dodgeball-x','slug_oldslugs','code','dodgeball-x');
select pg_temp.import_site_redirect('/doodle-world-codes','/codes/doodle-world','slug_oldslugs','code','doodle-world');
select pg_temp.import_site_redirect('/doors-codes','/codes/doors','slug_oldslugs','code','doors');
select pg_temp.import_site_redirect('/drag-drive-simulator-codes','/codes/drag-drive-simulator','slug_oldslugs','code','drag-drive-simulator');
select pg_temp.import_site_redirect('/drag-project-future-codes','/codes/drag-project-future','slug_oldslugs','code','drag-project-future');
select pg_temp.import_site_redirect('/dragon-ball-rage-codes','/codes/dragon-ball-rage','slug_oldslugs','code','dragon-ball-rage');
select pg_temp.import_site_redirect('/dragon-blox-codes','/codes/dragon-blox','slug_oldslugs','code','dragon-blox');
select pg_temp.import_site_redirect('/dragon-soul-codes','/codes/dragon-soul','slug_oldslugs','code','dragon-soul');
select pg_temp.import_site_redirect('/dragon-training-codes','/codes/dragon-training','slug_oldslugs','code','dragon-training');
select pg_temp.import_site_redirect('/dress-to-impress-codes','/codes/dress-to-impress','slug_oldslugs','code','dress-to-impress');
select pg_temp.import_site_redirect('/drive-world-codes','/codes/drive-world','slug_oldslugs','code','drive-world');
select pg_temp.import_site_redirect('/driving-empire-codes','/codes/driving-empire','slug_oldslugs','code','driving-empire');
select pg_temp.import_site_redirect('/drop-a-poop-codes','/codes/drop-a-poop','slug_oldslugs','code','drop-a-poop');
select pg_temp.import_site_redirect('/duck-army-codes','/codes/duck-army','slug_oldslugs','code','duck-army');
select pg_temp.import_site_redirect('/dudes-battlegrounds-codes','/codes/dudes-battlegrounds','slug_oldslugs','code','dudes-battlegrounds');
select pg_temp.import_site_redirect('/duel-warriors-codes','/codes/duel-warriors','slug_oldslugs','code','duel-warriors');
select pg_temp.import_site_redirect('/dungeons-incremental-2-codes','/codes/dungeons-incremental-2','slug_oldslugs','code','dungeons-incremental-2');
select pg_temp.import_site_redirect('/eating-simulator-codes','/codes/eating-simulator','slug_oldslugs','code','eating-simulator');
select pg_temp.import_site_redirect('/effortless-tower-codes','/codes/effortless-tower','slug_oldslugs','code','effortless-tower');
select pg_temp.import_site_redirect('/elemental-duels-codes','/codes/elemental-duels','slug_oldslugs','code','elemental-duels');
select pg_temp.import_site_redirect('/elemental-warzone-codes','/codes/elemental-warzone','slug_oldslugs','code','elemental-warzone');
select pg_temp.import_site_redirect('/emergency-hamburg-codes','/codes/emergency-hamburg','slug_oldslugs','code','emergency-hamburg');
select pg_temp.import_site_redirect('/enchanted-codes','/codes/enchanted','slug_oldslugs','code','enchanted');
select pg_temp.import_site_redirect('/energy-drink-simulator-codes','/codes/energy-drink-simulator','slug_oldslugs','code','energy-drink-simulator');
select pg_temp.import_site_redirect('/epic-minigames-codes','/codes/epic-minigames','slug_oldslugs','code','epic-minigames');
select pg_temp.import_site_redirect('/escape-room-codes','/codes/escape-room','slug_oldslugs','code','escape-room');
select pg_temp.import_site_redirect('/evade-codes','/codes/evade','slug_oldslugs','code','evade');
select pg_temp.import_site_redirect('/exiled-codes','/codes/exiled','slug_oldslugs','code','exiled');
select pg_temp.import_site_redirect('/fat-race-codes','/codes/fat-race','slug_oldslugs','code','fat-race');
select pg_temp.import_site_redirect('/fight-squiddy-game-codes','/codes/squiddy-game','slug_oldslugs','code','squiddy-game');
select pg_temp.import_site_redirect('/fisch-codes','/codes/fisch','slug_oldslugs','code','fisch');
select pg_temp.import_site_redirect('/fish-a-brainrot-codes','/codes/fish-a-brainrot','slug_oldslugs','code','fish-a-brainrot');
select pg_temp.import_site_redirect('/fish-it-codes','/codes/fish-it','slug_oldslugs','code','fish-it');
select pg_temp.import_site_redirect('/fish-training-codes','/codes/fish-training','slug_oldslugs','code','fish-training');
select pg_temp.import_site_redirect('/fishing-simulator-codes','/codes/fishing-simulator','slug_oldslugs','code','fishing-simulator');
select pg_temp.import_site_redirect('/five-nights-hunted-codes','/codes/five-nights-hunted','slug_oldslugs','code','five-nights-hunted');
select pg_temp.import_site_redirect('/five-nights-td-2-codes','/codes/five-nights-td-2','slug_oldslugs','code','five-nights-td-2');
select pg_temp.import_site_redirect('/fix-it-up-codes','/codes/fix-it-up','slug_oldslugs','code','fix-it-up');
select pg_temp.import_site_redirect('/flex-ugc-codes','/codes/flex-ugc','slug_oldslugs','code','flex-ugc');
select pg_temp.import_site_redirect('/fly-to-space-codes','/codes/fly-to-space','slug_oldslugs','code','fly-to-space');
select pg_temp.import_site_redirect('/flying-rng-codes','/codes/flying-rng','slug_oldslugs','code','flying-rng');
select pg_temp.import_site_redirect('/flying-wings-race-simulator-codes','/codes/flying-wings-race-simulator','slug_oldslugs','code','flying-wings-race-simulator');
select pg_temp.import_site_redirect('/football-legends-codes','/codes/football-legends','slug_oldslugs','code','football-legends');
select pg_temp.import_site_redirect('/force-battlegrounds-codes','/codes/force-battlegrounds','slug_oldslugs','code','force-battlegrounds');
select pg_temp.import_site_redirect('/forge-a-weapon-codes','/codes/forge-a-weapon','slug_oldslugs','code','forge-a-weapon');
select pg_temp.import_site_redirect('/frigid-dusk-codes','/codes/frigid-dusk','slug_oldslugs','code','frigid-dusk');
select pg_temp.import_site_redirect('/fruit-battlegrounds-codes','/codes/fruit-battlegrounds','slug_oldslugs','code','fruit-battlegrounds');
select pg_temp.import_site_redirect('/fruit-defenders-codes','/codes/fruit-defenders','slug_oldslugs','code','fruit-defenders');
select pg_temp.import_site_redirect('/fruit-reborn-codes','/codes/fruit-reborn','slug_oldslugs','code','fruit-reborn');
select pg_temp.import_site_redirect('/fruit-seas-codes','/codes/fruit-seas','slug_oldslugs','code','fruit-seas');
select pg_temp.import_site_redirect('/garden-rng-codes','/codes/garden-rng','slug_oldslugs','code','garden-rng');
select pg_temp.import_site_redirect('/garden-tower-defense-codes','/codes/garden-tower-defense','slug_oldslugs','code','garden-tower-defense');
select pg_temp.import_site_redirect('/gather-speed-codes','/codes/gather-speed','slug_oldslugs','code','gather-speed');
select pg_temp.import_site_redirect('/go-fishing-codes','/codes/go-fishing','slug_oldslugs','code','go-fishing');
select pg_temp.import_site_redirect('/goal-kick-simulator-codes','/codes/goal-kick-simulator','slug_oldslugs','code','goal-kick-simulator');
select pg_temp.import_site_redirect('/goalbound-codes','/codes/goalbound','slug_oldslugs','code','goalbound');
select pg_temp.import_site_redirect('/grand-kaizen-codes','/codes/grand-kaizen','slug_oldslugs','code','grand-kaizen');
select pg_temp.import_site_redirect('/greenville-codes','/codes/greenville','slug_oldslugs','code','greenville');
select pg_temp.import_site_redirect('/grow-a-business-codes','/codes/grow-a-business','slug_oldslugs','code','grow-a-business');
select pg_temp.import_site_redirect('/grow-a-friend-codes','/codes/grow-a-friend','slug_oldslugs','code','grow-a-friend');
select pg_temp.import_site_redirect('/grow-a-garden-codes','/codes/grow-a-garden','slug_oldslugs','code','grow-a-garden');
select pg_temp.import_site_redirect('/grow-crystals-codes','/codes/grow-crystals','slug_oldslugs','code','grow-crystals');
select pg_temp.import_site_redirect('/gubby-rng-codes','/codes/gubby-rng','slug_oldslugs','code','gubby-rng');
select pg_temp.import_site_redirect('/gubby-tower-defense-codes','/codes/gubby-tower-defense','slug_oldslugs','code','gubby-tower-defense');
select pg_temp.import_site_redirect('/gym-league-codes','/codes/gym-league','slug_oldslugs','code','gym-league');
select pg_temp.import_site_redirect('/gym-showdown-simulator-codes','/codes/gym-showdown-simulator','slug_oldslugs','code','gym-showdown-simulator');
select pg_temp.import_site_redirect('/gym-star-simulator-codes','/codes/gym-star-simulator','slug_oldslugs','code','gym-star-simulator');
select pg_temp.import_site_redirect('/haze-piece-codes','/codes/haze-piece','slug_oldslugs','code','haze-piece');
select pg_temp.import_site_redirect('/hell-to-heaven-climb-codes','/codes/hell-to-heaven-climb','slug_oldslugs','code','hell-to-heaven-climb');
select pg_temp.import_site_redirect('/heroes-battlegrounds-codes','/codes/heroes-battlegrounds','slug_oldslugs','code','heroes-battlegrounds');
select pg_temp.import_site_redirect('/heroes-online-world-codes','/codes/heroes-online-world','slug_oldslugs','code','heroes-online-world');
select pg_temp.import_site_redirect('/hide-and-sneak-codes','/codes/hide-and-sneak','slug_oldslugs','code','hide-and-sneak');
select pg_temp.import_site_redirect('/hide-or-die-codes','/codes/hide-or-die','slug_oldslugs','code','hide-or-die');
select pg_temp.import_site_redirect('/highschool-hoops-codes','/codes/highschool-hoops','slug_oldslugs','code','highschool-hoops');
select pg_temp.import_site_redirect('/highway-legends-codes','/codes/highway-legends','slug_oldslugs','code','highway-legends');
select pg_temp.import_site_redirect('/hollow-era-codes','/codes/hollow-era','slug_oldslugs','code','hollow-era');
select pg_temp.import_site_redirect('/home-run-simulator-codes','/codes/home-run-simulator','slug_oldslugs','code','home-run-simulator');
select pg_temp.import_site_redirect('/hoop-heroes-codes','/codes/hoop-heroes','slug_oldslugs','code','hoop-heroes');
select pg_temp.import_site_redirect('/horror-rng-codes','/codes/horror-rng','slug_oldslugs','code','horror-rng');
select pg_temp.import_site_redirect('/human-kebabs-codes','/codes/human-kebabs','slug_oldslugs','code','human-kebabs');
select pg_temp.import_site_redirect('/hunter-era-codes','/codes/hunter-era','slug_oldslugs','code','hunter-era');
select pg_temp.import_site_redirect('/hunters-codes','/codes/hunters','slug_oldslugs','code','hunters');
select pg_temp.import_site_redirect('/hunty-zombie-codes','/codes/hunty-zombie','slug_oldslugs','code','hunty-zombie');
select pg_temp.import_site_redirect('/ice-fishing-simulator-codes','/codes/ice-fishing-simulator','slug_oldslugs','code','ice-fishing-simulator');
select pg_temp.import_site_redirect('/ice-tycoon-codes','/codes/ice-tycoon','slug_oldslugs','code','ice-tycoon');
select pg_temp.import_site_redirect('/ijul-piece-2-codes','/codes/ijul-piece-2','slug_oldslugs','code','ijul-piece-2');
select pg_temp.import_site_redirect('/infinite-mining-incremental-codes','/codes/infinite-mining-incremental','slug_oldslugs','code','infinite-mining-incremental');
select pg_temp.import_site_redirect('/infinity-fighters-codes','/codes/infinity-fighters','slug_oldslugs','code','infinity-fighters');
select pg_temp.import_site_redirect('/inhuman-codes','/codes/inhuman','slug_oldslugs','code','inhuman');
select pg_temp.import_site_redirect('/investor-city-codes','/codes/investor-city','slug_oldslugs','code','investor-city');
select pg_temp.import_site_redirect('/island-of-move-codes','/codes/island-of-move','slug_oldslugs','code','island-of-move');
select pg_temp.import_site_redirect('/it-girl-codes','/codes/it-girl','slug_oldslugs','code','it-girl');
select pg_temp.import_site_redirect('/jailbreak-codes','/codes/jailbreak','slug_oldslugs','code','jailbreak');
select pg_temp.import_site_redirect('/jujutsu-beatdown-codes','/codes/jujutsu-beatdown','slug_oldslugs','code','jujutsu-beatdown');
select pg_temp.import_site_redirect('/jujutsu-infinite-codes','/codes/jujutsu-infinite','slug_oldslugs','code','jujutsu-infinite');
select pg_temp.import_site_redirect('/jujutsu-shenanigans-codes','/codes/jujutsu-shenanigans','slug_oldslugs','code','jujutsu-shenanigans');
select pg_temp.import_site_redirect('/katana-simulator-codes','/codes/katana-simulator','slug_oldslugs','code','katana-simulator');
select pg_temp.import_site_redirect('/kayak-racing-codes','/codes/kayak-racing','slug_oldslugs','code','kayak-racing');
select pg_temp.import_site_redirect('/kengan-codes','/codes/kengan','slug_oldslugs','code','kengan');
select pg_temp.import_site_redirect('/kick-a-brainrot-codes','/codes/kick-a-brainrot','slug_oldslugs','code','kick-a-brainrot');
select pg_temp.import_site_redirect('/king-legacy-codes','/codes/king-legacy','slug_oldslugs','code','king-legacy');
select pg_temp.import_site_redirect('/korrupt-zombies-codes','/codes/korrupt-zombies','slug_oldslugs','code','korrupt-zombies');
select pg_temp.import_site_redirect('/kurokus-basket-showdown-codes','/codes/kurokus-basket-showdown','slug_oldslugs','code','kurokus-basket-showdown');
select pg_temp.import_site_redirect('/labubu-evolution-codes','/codes/labubu-evolution','slug_oldslugs','code','labubu-evolution');
select pg_temp.import_site_redirect('/legends-of-speed-codes','/codes/legends-of-speed','slug_oldslugs','code','legends-of-speed');
select pg_temp.import_site_redirect('/legends-re-written-codes','/codes/legends-re-written','slug_oldslugs','code','legends-re-written');
select pg_temp.import_site_redirect('/level-below-codes','/codes/level-below','slug_oldslugs','code','level-below');
select pg_temp.import_site_redirect('/locked-codes','/codes/locked','slug_oldslugs','code','locked');
select pg_temp.import_site_redirect('/lockover-codes','/codes/lockover','slug_oldslugs','code','lockover');
select pg_temp.import_site_redirect('/loot-fish-codes','/codes/loot-fish','slug_oldslugs','code','loot-fish');
select pg_temp.import_site_redirect('/lost-currents-codes','/codes/lost-currents','slug_oldslugs','code','lost-currents');
select pg_temp.import_site_redirect('/lost-souls-codes','/codes/lost-souls','slug_oldslugs','code','lost-souls');
select pg_temp.import_site_redirect('/lumberjack-simulator-codes','/codes/lumberjack-simulator','slug_oldslugs','code','lumberjack-simulator');
select pg_temp.import_site_redirect('/magnet-simulator-2-codes','/codes/magnet-simulator-2','slug_oldslugs','code','magnet-simulator-2');
select pg_temp.import_site_redirect('/majika-codes','/codes/majika','slug_oldslugs','code','majika');
select pg_temp.import_site_redirect('/make-a-boat-codes','/codes/make-a-boat','slug_oldslugs','code','make-a-boat');
select pg_temp.import_site_redirect('/make-your-pets-famous-codes','/codes/make-your-pets-famous','slug_oldslugs','code','make-your-pets-famous');
select pg_temp.import_site_redirect('/meme-sea-codes','/codes/meme-sea','slug_oldslugs','code','meme-sea');
select pg_temp.import_site_redirect('/mermaid-isle-codes','/codes/mermaid-isle','slug_oldslugs','code','mermaid-isle');
select pg_temp.import_site_redirect('/meta-lock-codes','/codes/meta-lock','slug_oldslugs','code','meta-lock');
select pg_temp.import_site_redirect('/midnight-game-show-codes','/codes/midnight-game-show','slug_oldslugs','code','midnight-game-show');
select pg_temp.import_site_redirect('/mighty-omega-codes','/codes/mighty-omega','slug_oldslugs','code','mighty-omega');
select pg_temp.import_site_redirect('/military-tycoon-codes','/codes/military-tycoon','slug_oldslugs','code','military-tycoon');
select pg_temp.import_site_redirect('/mine-codes','/codes/mine','slug_oldslugs','code','mine');
select pg_temp.import_site_redirect('/monkey-ascension-codes','/codes/monkey-ascension','slug_oldslugs','code','monkey-ascension');
select pg_temp.import_site_redirect('/monster-race-codes','/codes/monster-race','slug_oldslugs','code','monster-race');
select pg_temp.import_site_redirect('/mosquitoes-vs-humans-codes','/codes/mosquitoes-vs-humans','slug_oldslugs','code','mosquitoes-vs-humans');
select pg_temp.import_site_redirect('/motorcycle-racing-codes','/codes/motorcycle-racing','slug_oldslugs','code','motorcycle-racing');
select pg_temp.import_site_redirect('/motorush-codes','/codes/motorush','slug_oldslugs','code','motorush');
select pg_temp.import_site_redirect('/multicrew-tank-combat-codes','/codes/multicrew-tank-combat','slug_oldslugs','code','multicrew-tank-combat');
select pg_temp.import_site_redirect('/multiverse-defenders-codes','/codes/multiverse-defenders','slug_oldslugs','code','multiverse-defenders');
select pg_temp.import_site_redirect('/murder-mystery-2-codes','/codes/murder-mystery-2','slug_oldslugs','code','murder-mystery-2');
select pg_temp.import_site_redirect('/my-anime-life-codes','/codes/my-anime-life','slug_oldslugs','code','my-anime-life');
select pg_temp.import_site_redirect('/my-pet-farm-codes','/codes/my-pet-farm','slug_oldslugs','code','my-pet-farm');
select pg_temp.import_site_redirect('/neighbors-codes','/codes/neighbors','slug_oldslugs','code','neighbors');
select pg_temp.import_site_redirect('/new-bikes-the-ride-codes','/codes/new-bikes-the-ride','slug_oldslugs','code','new-bikes-the-ride');
select pg_temp.import_site_redirect('/octopus-game-codes','/codes/octopus-game','slug_oldslugs','code','octopus-game');
select pg_temp.import_site_redirect('/one-fruit-codes','/codes/one-fruit','slug_oldslugs','code','one-fruit');
select pg_temp.import_site_redirect('/paper-plane-simulator-codes','/codes/paper-plane-simulator','slug_oldslugs','code','paper-plane-simulator');
select pg_temp.import_site_redirect('/paradox-codes','/codes/paradox','slug_oldslugs','code','paradox');
select pg_temp.import_site_redirect('/pet-mine-codes','/codes/pet-mine','slug_oldslugs','code','pet-mine');
select pg_temp.import_site_redirect('/pet-simulator-99-codes','/codes/pet-simulator-99','slug_oldslugs','code','pet-simulator-99');
select pg_temp.import_site_redirect('/pets-go-codes','/codes/pets-go','slug_oldslugs','code','pets-go');
select pg_temp.import_site_redirect('/piggy-branched-realities-codes','/codes/piggy-branched-realities','slug_oldslugs','code','piggy-branched-realities');
select pg_temp.import_site_redirect('/pixel-slayer-codes','/codes/pixel-slayer','slug_oldslugs','code','pixel-slayer');
select pg_temp.import_site_redirect('/pixel-tower-defense-codes','/codes/pixel-tower-defense','slug_oldslugs','code','pixel-tower-defense');
select pg_temp.import_site_redirect('/plants-evolution-codes','/codes/plants-evolution','slug_oldslugs','code','plants-evolution');
select pg_temp.import_site_redirect('/plants-vs-brainrots-codes','/codes/plants-vs-brainrots','slug_oldslugs','code','plants-vs-brainrots');
select pg_temp.import_site_redirect('/pls-donate-codes','/codes/pls-donate','slug_oldslugs','code','pls-donate');
select pg_temp.import_site_redirect('/poop-a-brainrot-codes','/codes/poop-a-brainrot','slug_oldslugs','code','poop-a-brainrot');
select pg_temp.import_site_redirect('/pop-starz-codes','/codes/pop-starz','slug_oldslugs','code','pop-starz');
select pg_temp.import_site_redirect('/popmarket-simulator-codes','/codes/popmarket-simulator','slug_oldslugs','code','popmarket-simulator');
select pg_temp.import_site_redirect('/pressure-codes','/codes/pressure','slug_oldslugs','code','pressure');
select pg_temp.import_site_redirect('/prison-pump-codes','/codes/prison-pump','slug_oldslugs','code','prison-pump');
select pg_temp.import_site_redirect('/project-basketball-codes','/codes/project-basketball','slug_oldslugs','code','project-basketball');
select pg_temp.import_site_redirect('/project-xl-codes','/codes/project-xl','slug_oldslugs','code','project-xl');
select pg_temp.import_site_redirect('/pull-a-sword-codes','/codes/pull-a-sword','slug_oldslugs','code','pull-a-sword');
select pg_temp.import_site_redirect('/quest-mutation-dead-tales-codes','/codes/dead-tales','slug_oldslugs','code','dead-tales');
select pg_temp.import_site_redirect('/race-a-brainrot-codes','/codes/race-a-brainrot','slug_oldslugs','code','race-a-brainrot');
select pg_temp.import_site_redirect('/race-clicker-codes','/codes/race-clicker','slug_oldslugs','code','race-clicker');
select pg_temp.import_site_redirect('/re-xl-codes','/codes/re-xl','slug_oldslugs','code','re-xl');
select pg_temp.import_site_redirect('/rebirth-champions-ultimate-codes','/codes/rebirth-champions-ultimate','slug_oldslugs','code','rebirth-champions-ultimate');
select pg_temp.import_site_redirect('/reborn-as-swordsman-codes','/codes/reborn-as-swordsman','slug_oldslugs','code','reborn-as-swordsman');
select pg_temp.import_site_redirect('/rensselaer-county-codes','/codes/rensselaer-county','slug_oldslugs','code','rensselaer-county');
select pg_temp.import_site_redirect('/restaurant-tycoon-2-codes','/codes/restaurant-tycoon-2','slug_oldslugs','code','restaurant-tycoon-2');
select pg_temp.import_site_redirect('/rh2-the-journey-codes','/codes/rh2-the-journey','slug_oldslugs','code','rh2-the-journey');
select pg_temp.import_site_redirect('/rng-anime-rarities-codes','/codes/rng-anime-rarities','slug_oldslugs','code','rng-anime-rarities');
select pg_temp.import_site_redirect('/rng-odyssey-codes','/codes/rng-odyssey','slug_oldslugs','code','rng-odyssey');
select pg_temp.import_site_redirect('/rng-war-td-codes','/codes/rng-war-td','slug_oldslugs','code','rng-war-td');
select pg_temp.import_site_redirect('/roblox-is-unbreakable-codes','/codes/roblox-is-unbreakable','slug_oldslugs','code','roblox-is-unbreakable');
select pg_temp.import_site_redirect('/rogueblox-codes','/codes/rogueblox','slug_oldslugs','code','rogueblox');
select pg_temp.import_site_redirect('/schlap-codes','/codes/schlap','slug_oldslugs','code','schlap');
select pg_temp.import_site_redirect('/sell-junk-codes','/codes/sell-junk','slug_oldslugs','code','sell-junk');
select pg_temp.import_site_redirect('/shindo-life-codes','/codes/shindo-life','slug_oldslugs','code','shindo-life');
select pg_temp.import_site_redirect('/sisyphus-training-codes','/codes/sisyphus-training','slug_oldslugs','code','sisyphus-training');
select pg_temp.import_site_redirect('/slap-battles-codes','/codes/slap-battles','slug_oldslugs','code','slap-battles');
select pg_temp.import_site_redirect('/slayer-training-codes','/codes/slayer-training','slug_oldslugs','code','slayer-training');
select pg_temp.import_site_redirect('/slayers-unleashed-codes','/codes/slayers-unleashed','slug_oldslugs','code','slayers-unleashed');
select pg_temp.import_site_redirect('/sonic-speed-simulator-codes','/codes/sonic-speed-simulator','slug_oldslugs','code','sonic-speed-simulator');
select pg_temp.import_site_redirect('/sorcery-codes','/codes/sorcery','slug_oldslugs','code','sorcery');
select pg_temp.import_site_redirect('/southwest-florida-codes','/codes/southwest-florida','slug_oldslugs','code','southwest-florida');
select pg_temp.import_site_redirect('/spongebob-tower-defense-codes','/codes/spongebob-tower-defense','slug_oldslugs','code','spongebob-tower-defense');
select pg_temp.import_site_redirect('/spts-return-of-the-reaper-codes','/codes/spts-return-of-the-reaper','slug_oldslugs','code','spts-return-of-the-reaper');
select pg_temp.import_site_redirect('/squid-evolution-codes','/codes/squid-evolution','slug_oldslugs','code','squid-evolution');
select pg_temp.import_site_redirect('/squid-game-the-final-games-codes','/codes/squid-game-the-final-games','slug_oldslugs','code','squid-game-the-final-games');
select pg_temp.import_site_redirect('/squid-game-x-codes','/codes/squid-game-x','slug_oldslugs','code','squid-game-x');
select pg_temp.import_site_redirect('/steal-a-fish-codes','/codes/steal-a-fish','slug_oldslugs','code','steal-a-fish');
select pg_temp.import_site_redirect('/strongman-simulator-codes','/codes/strongman-simulator','slug_oldslugs','code','strongman-simulator');
select pg_temp.import_site_redirect('/super-eleven-codes','/codes/super-eleven','slug_oldslugs','code','super-eleven');
select pg_temp.import_site_redirect('/superhero-legends-codes','/codes/superhero-legends','slug_oldslugs','code','superhero-legends');
select pg_temp.import_site_redirect('/superpower-simulator-chakra-codes','/codes/superpower-simulator-chakra','slug_oldslugs','code','superpower-simulator-chakra');
select pg_temp.import_site_redirect('/superstar-baseball-codes','/codes/superstar-baseball','slug_oldslugs','code','superstar-baseball');
select pg_temp.import_site_redirect('/survive-the-killer-codes','/codes/survive-the-killer','slug_oldslugs','code','survive-the-killer');
select pg_temp.import_site_redirect('/tennis-zero-codes','/codes/tennis-zero','slug_oldslugs','code','tennis-zero');
select pg_temp.import_site_redirect('/the-mall-game-codes','/codes/the-mall-game','slug_oldslugs','code','the-mall-game');
select pg_temp.import_site_redirect('/train-dog-to-fight-codes','/codes/train-dog-to-fight','slug_oldslugs','code','train-dog-to-fight');
select pg_temp.import_site_redirect('/tsubasa-final-shot-codes','/codes/tsubasa-final-shot','slug_oldslugs','code','tsubasa-final-shot');
select pg_temp.import_site_redirect('/type-soul-codes','/codes/type-soul','slug_oldslugs','code','type-soul');
select pg_temp.import_site_redirect('/ultimate-town-multiplayer-codes','/codes/ultimate-town-multiplayer','slug_oldslugs','code','ultimate-town-multiplayer');
select pg_temp.import_site_redirect('/untitled-boxing-game-codes','/codes/untitled-boxing-game','slug_oldslugs','code','untitled-boxing-game');
select pg_temp.import_site_redirect('/volleyball-legends-codes','/codes/volleyball-legends','slug_oldslugs','code','volleyball-legends');
select pg_temp.import_site_redirect('/water-pumping-incremental-2-codes','/codes/water-pumping-incremental-2','slug_oldslugs','code','water-pumping-incremental-2');
select pg_temp.import_site_redirect('/weak-legacy-2-codes','/codes/weak-legacy-2','slug_oldslugs','code','weak-legacy-2');
select pg_temp.import_site_redirect('/zombie-war-tycoon-codes','/codes/zombie-war-tycoon','slug_oldslugs','code','zombie-war-tycoon');
select pg_temp.import_site_redirect('/minecraft/wiki/achievements','/minecraft/bedrock/wiki/achievements','minecraft-legacy',null,null,'prefix',308);
select pg_temp.import_site_redirect('/minecraft/wiki','/minecraft/java/wiki','minecraft-legacy',null,null,'prefix',308,'append',false);
select pg_temp.import_site_redirect('/lists/top-trending-roblox-games','/stats/games','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-action-games','/stats/games?genre=Action','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-battlegrounds-fighting-games','/stats/games?genre=Action&subgenre=Battlegrounds+%26+Fighting','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-music-rhythm-games','/stats/games?genre=Action&subgenre=Music+%26+Rhythm','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-open-world-action-games','/stats/games?genre=Action&subgenre=Open+World+Action','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-adventure-games','/stats/games?genre=Adventure','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-exploration-games','/stats/games?genre=Adventure&subgenre=Exploration','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-scavenger-hunt-games','/stats/games?genre=Adventure&subgenre=Scavenger+Hunt','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-story-games','/stats/games?genre=Adventure&subgenre=Story','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-education-games','/stats/games?genre=Education','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-entertainment-games','/stats/games?genre=Entertainment','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-music-audio-games','/stats/games?genre=Entertainment&subgenre=Music+%26+Audio','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-showcase-hub-games','/stats/games?genre=Entertainment&subgenre=Showcase+%26+Hub','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-video-games','/stats/games?genre=Entertainment&subgenre=Video','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-obby-platformer-games','/stats/games?genre=Obby+%26+Platformer','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-classic-obby-games','/stats/games?genre=Obby+%26+Platformer&subgenre=Classic+Obby','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-runner-games','/stats/games?genre=Obby+%26+Platformer&subgenre=Runner','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-tower-obby-games','/stats/games?genre=Obby+%26+Platformer&subgenre=Tower+Obby','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-party-casual-games','/stats/games?genre=Party+%26+Casual','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-childhood-game-games','/stats/games?genre=Party+%26+Casual&subgenre=Childhood+Game','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-coloring-drawing-games','/stats/games?genre=Party+%26+Casual&subgenre=Coloring+%26+Drawing','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-minigame-games','/stats/games?genre=Party+%26+Casual&subgenre=Minigame','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-quiz-games','/stats/games?genre=Party+%26+Casual&subgenre=Quiz','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-puzzle-games','/stats/games?genre=Puzzle','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-escape-room-games','/stats/games?genre=Puzzle&subgenre=Escape+Room','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-match-merge-games','/stats/games?genre=Puzzle&subgenre=Match+%26+Merge','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-word-games','/stats/games?genre=Puzzle&subgenre=Word','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-rpg-games','/stats/games?genre=RPG','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-action-rpg-games','/stats/games?genre=RPG&subgenre=Action+RPG','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-open-world-survival-rpg-games','/stats/games?genre=RPG&subgenre=Open+World+%26+Survival+RPG','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-turn-based-rpg-games','/stats/games?genre=RPG&subgenre=Turn-based+RPG','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-roleplay-avatar-sim-games','/stats/games?genre=Roleplay+%26+Avatar+Sim','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-animal-sim-games','/stats/games?genre=Roleplay+%26+Avatar+Sim&subgenre=Animal+Sim','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-dress-up-games','/stats/games?genre=Roleplay+%26+Avatar+Sim&subgenre=Dress+Up','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-life-games','/stats/games?genre=Roleplay+%26+Avatar+Sim&subgenre=Life','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-morph-roleplay-games','/stats/games?genre=Roleplay+%26+Avatar+Sim&subgenre=Morph+Roleplay','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-pet-care-games','/stats/games?genre=Roleplay+%26+Avatar+Sim&subgenre=Pet+Care','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-shooter-games','/stats/games?genre=Shooter','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-battle-royale-games','/stats/games?genre=Shooter&subgenre=Battle+Royale','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-deathmatch-shooter-games','/stats/games?genre=Shooter&subgenre=Deathmatch+Shooter','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-pve-shooter-games','/stats/games?genre=Shooter&subgenre=PvE+Shooter','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-shopping-games','/stats/games?genre=Shopping','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-avatar-shopping-games','/stats/games?genre=Shopping&subgenre=Avatar+Shopping','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-simulation-games','/stats/games?genre=Simulation','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-idle-games','/stats/games?genre=Simulation&subgenre=Idle','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-incremental-simulator-games','/stats/games?genre=Simulation&subgenre=Incremental+Simulator','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-physics-sim-games','/stats/games?genre=Simulation&subgenre=Physics+Sim','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-sandbox-games','/stats/games?genre=Simulation&subgenre=Sandbox','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-tycoon-games','/stats/games?genre=Simulation&subgenre=Tycoon','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-vehicle-sim-games','/stats/games?genre=Simulation&subgenre=Vehicle+Sim','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-social-games','/stats/games?genre=Social','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-sports-racing-games','/stats/games?genre=Sports+%26+Racing','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-racing-games','/stats/games?genre=Sports+%26+Racing&subgenre=Racing','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-sports-games','/stats/games?genre=Sports+%26+Racing&subgenre=Sports','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-strategy-games','/stats/games?genre=Strategy','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-board-card-games','/stats/games?genre=Strategy&subgenre=Board+%26+Card+Games','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-tower-defense-games','/stats/games?genre=Strategy&subgenre=Tower+Defense','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-survival-games','/stats/games?genre=Survival','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-1-vs-all-games','/stats/games?genre=Survival&subgenre=1+vs+All','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-escape-games','/stats/games?genre=Survival&subgenre=Escape','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists/top-trending-roblox-utility-other-games','/stats/games?genre=Utility+%26+Other','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/lists','/stats','lists',null,null,'prefix',308,'drop');
select pg_temp.import_site_redirect('/catalog/free-roblox-items/categories','/catalog/free-roblox-items','free-items-categories',null,null,'prefix',308,'free-items');

do $$
declare r record; alias text;
begin
 for r in select id,slug,old_slugs from public.code_pages order by id::text loop
  foreach alias in array r.old_slugs loop
   alias:=lower(btrim(alias));
   if alias is null or alias='' or alias=r.slug then continue; end if;
   perform public.claim_site_route(jsonb_build_object('path','/codes/'||alias,'source','roblox','page_type','code','page_id',r.id::text,'status','old','origin','code_pages.old_slugs'),true);
  end loop;
 end loop;
end $$;

commit;
