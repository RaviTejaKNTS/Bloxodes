begin;
set local lock_timeout = '3s';
-- The same global lock and parent-first table order as the registry backfill.
select pg_catalog.pg_advisory_xact_lock(7823462194301);
lock table public.games,public.game_wiki_pages,public.game_code_pages,public.game_tool_pages,public.game_map_pages,public.game_quiz_pages,public.game_catalog_pages,public.game_checklist_pages,public.game_collection_pages,public.code_pages,public.wiki_pages,public.wiki_collection_pages,public.quiz_pages,public.checklist_pages,public.tools,public.events_pages,public.articles,public.catalog_pages,public.puzzle_pages in share row exclusive mode;
alter table public.games add column url_style text not null default 'namespace' check(url_style in ('namespace','page_type'));
alter table public.games alter column url_style set default 'page_type';

-- Identity, never a saved legacy route, determines the destination. A wiki's
-- permanent slug can differ from its game's slug (legacy-minecraft is one).
create function public.expected_game_page_path(p_game_id uuid,p_type text,p_slug text default null) returns text
language plpgsql stable set search_path='' as $$
declare g public.games; base text; section text;
begin
 select * into strict g from public.games where id=p_game_id;
 if p_type not in ('hub','wiki','collection','code','tool','checklist','map','quiz','catalog') then raise exception 'Unknown game page type: %',p_type; end if;
 if g.url_style='page_type' then
  base:=case when g.kind='franchise' and g.parent_id is null then '/games/'||g.namespace else '/wiki/'||g.slug end;
  if p_type in ('wiki','hub') then return base; end if;
  if p_type='collection' then
   if g.kind='franchise' and g.parent_id is null then raise exception 'Franchise roots cannot own collections'; end if;
   return base||'/'||p_slug;
  end if;
  if p_type='code' then return '/codes/'||g.slug; end if;
  section:=case p_type when 'tool' then 'tools' when 'quiz' then 'quizzes' when 'checklist' then 'checklists' when 'map' then 'maps' else 'catalog' end;
  return '/'||section||'/'||case when p_type in ('tool','catalog') and p_slug<>g.namespace and not starts_with(p_slug,g.namespace||'-') then g.namespace||'-' else '' end||p_slug;
 end if;
 base:='/'||g.namespace;
 if p_type='hub' then return base; end if;
 if p_type in ('wiki','collection') then
  if g.namespace='minecraft' and g.slug in ('minecraft-java','minecraft-bedrock') then
   base:=base||'/'||substr(g.slug,11)||'/wiki';
  else
   base:=base||'/wiki'||case when g.parent_id is null then '' when g.namespace='minecraft' and g.slug='minecraft' then '/legacy-minecraft' else '/'||coalesce(nullif(p_slug,''),g.slug) end;
   if p_type='collection' then
    select canonical_path into base from public.game_wiki_pages where game_id=g.id;
   end if;
  end if;
  return base||case when p_type='collection' then '/'||p_slug else '' end;
 end if;
 if p_type='code' then return base||'/codes'||case when g.parent_id is null then '' else '/'||g.slug end; end if;
 section:=case p_type when 'tool' then 'tools' when 'quiz' then 'quizzes' when 'checklist' then 'checklists' when 'map' then 'maps' else 'catalog' end;
 return base||'/'||section||'/'||p_slug;
end $$;
revoke all on function public.expected_game_page_path(uuid,text,text) from public,anon,authenticated;
grant execute on function public.expected_game_page_path(uuid,text,text) to service_role;

create or replace function public.prepare_game_content() returns trigger language plpgsql set search_path='' as $$
declare g public.games; wiki public.game_wiki_pages; expected text; typ text; slug_value text;
begin
 if tg_table_name='games' then
  if tg_op='UPDATE' and new.url_style is distinct from old.url_style and current_setting('bloxodes.url_move_namespace',true) is distinct from new.namespace then raise exception 'Change URL style only through move_game_namespace_to_page_type_urls'; end if;
  if new.kind='game' and new.parent_id is null then select id into new.parent_id from public.games where namespace=new.namespace and kind='franchise'; end if;
  if new.parent_id is not null then
   select * into g from public.games where id=new.parent_id and kind='franchise' and namespace=new.namespace;
   if not found then raise exception 'Game parent must be its franchise'; end if;
   if tg_op='INSERT' then new.url_style:=g.url_style; end if;
  end if;
  return new;
 end if;
 select * into strict g from public.games where id=new.game_id;
 if new.namespace<>g.namespace then raise exception 'Page game ownership mismatch'; end if;
 typ:=replace(replace(tg_table_name,'game_',''),'_pages','');
 slug_value:=to_jsonb(new)->>'slug';
 if typ='collection' then
  select * into strict wiki from public.game_wiki_pages where id=new.wiki_page_id;
  if new.game_id<>wiki.game_id or new.namespace<>wiki.namespace or new.wiki_slug<>wiki.slug then raise exception 'Collection wiki ownership mismatch'; end if;
  if tg_op='UPDATE' and (new.wiki_page_id is distinct from old.wiki_page_id or new.wiki_slug is distinct from old.wiki_slug) then raise exception 'Collection route identity is permanent'; end if;
  slug_value:=new.collection_slug;
 end if;
 expected:=public.expected_game_page_path(new.game_id,typ,slug_value);
 if new.canonical_path is null then new.canonical_path:=expected; end if;
 if new.canonical_path is distinct from expected then raise exception 'Page route does not match its game and page type: expected %',expected; end if;
 if tg_op='UPDATE' and (new.namespace<>old.namespace or new.game_id<>old.game_id or (to_jsonb(new)->>'slug') is distinct from (to_jsonb(old)->>'slug') or (to_jsonb(new)->>'collection_slug') is distinct from (to_jsonb(old)->>'collection_slug')) then raise exception 'Page ownership and slug are permanent'; end if;
 if typ='checklist' then
  if new.is_public and new.published_at is null then new.published_at:=now(); end if;
 else
  if new.is_published and new.published_at is null then new.published_at:=now(); end if;
 end if;
 return new;
end $$;

-- The installed zz guard also runs after prepare_game_content. Keep it on the
-- same path contract; its former namespace-only checks reject every cutover.
create or replace function public.validate_game_route_identity() returns trigger
language plpgsql set search_path='' as $$
declare expected text; typ text;
begin
 if tg_op='UPDATE' then
  if tg_table_name='game_collection_pages' then
   if new.wiki_page_id is distinct from old.wiki_page_id or new.wiki_slug is distinct from old.wiki_slug or new.collection_slug is distinct from old.collection_slug then raise exception 'Collection route identity is permanent'; end if;
  elsif new.slug is distinct from old.slug then raise exception 'Page route slug is permanent'; end if;
 end if;
 typ:=replace(replace(tg_table_name,'game_',''),'_pages','');
 expected:=public.expected_game_page_path(new.game_id,typ,case when typ='collection' then to_jsonb(new)->>'collection_slug' else to_jsonb(new)->>'slug' end);
 if new.canonical_path is distinct from expected then raise exception 'Page route does not match its game and page type: expected %',expected; end if;
 return new;
end $$;

create or replace function public.prepare_game_extended_page() returns trigger language plpgsql set search_path='' as $$
declare section_name text; expected text;
begin
 section_name:=case tg_table_name when 'game_map_pages' then 'maps' when 'game_quiz_pages' then 'quizzes' else 'catalog' end;
 expected:=public.expected_game_page_path(new.game_id,replace(replace(tg_table_name,'game_',''),'_pages',''),new.slug);
 if exists(select 1 from jsonb_array_elements(new.sources_json) source where jsonb_typeof(source) is distinct from 'object' or jsonb_typeof(source->'title') is distinct from 'string' or coalesce(source->>'url','')!~ '^https://[^[:space:]]+$') then raise exception 'Sources need a title and HTTPS URL'; end if;
 if tg_op='UPDATE' and (new.namespace<>old.namespace or new.game_id<>old.game_id or new.slug<>old.slug) then raise exception 'Page ownership and slug are permanent'; end if;
 if new.canonical_path is null then new.canonical_path:=expected; end if;
 if new.canonical_path<>expected then raise exception 'Page route does not match its game and page type'; end if;
 if new.is_published and new.published_at is null then new.published_at:=now(); end if;
 new.updated_at:=now();
 return new;
end $$;
create or replace function public.site_page_route(p_table text, p_row jsonb) returns public.site_routes
language plpgsql stable set search_path='' as $$
declare r public.site_routes;
begin
 r.page_id:=p_row->>'id'; r.status:='live'; r.origin:='backfill'; r.match_type:='exact';
 r.source:=case when p_table='games' or p_table like 'game\_%' escape '\' then 'game' else 'roblox' end;
 if r.source='game' then
  if p_table='games' then
   if p_row->>'parent_id' is not null then return null; end if;
   -- A moved root has a real wiki owner; do not create a competing hub.
   if p_row->>'url_style'='page_type' then return null; end if;
   r.page_type:='hub'; r.path:=public.expected_game_page_path((p_row->>'id')::uuid,'hub'); r.game_id:=(p_row->>'id')::uuid;
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

create or replace view public.expected_site_routes with (security_invoker=true) as
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
select 'games'::text page_table, p.id::text page_id, r.path,r.source,r.page_type,r.game_id from public.games p cross join lateral public.site_page_route('games',to_jsonb(p)) r where p.parent_id is null and p.url_style='namespace';

revoke all on public.expected_site_routes from public,anon,authenticated;
grant select on public.expected_site_routes to service_role;
drop trigger site_route_sync_update on public.games;
create trigger site_route_sync_update after update of id,namespace,parent_id,url_style on public.games for each row when (old.id is distinct from new.id or old.namespace is distinct from new.namespace or old.parent_id is distinct from new.parent_id or old.url_style is distinct from new.url_style) execute function public.sync_site_page_route();
drop trigger site_route_write_lock on public.games;
create trigger site_route_write_lock before insert or delete or update of id,namespace,parent_id,url_style on public.games for each statement execute function public.lock_site_route_writes();


-- Rewrite string values, never JSON keys, IDs or numeric values. Boundary checks
-- avoid changing similarly named pages (foo must not match foo-bar).
create function public.rewrite_game_url_links(value jsonb, mapping jsonb, collection_paths jsonb default '[]'::jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb; pair record; entry record; original text; revised text;
begin
 case jsonb_typeof(value)
 when 'object' then
  select coalesce(jsonb_object_agg(key,public.rewrite_game_url_links(v,mapping,collection_paths)),'{}'::jsonb) into result from jsonb_each(value) e(key,v);
 when 'array' then
  select coalesce(jsonb_agg(public.rewrite_game_url_links(v,mapping,collection_paths) order by n),'[]'::jsonb) into result from jsonb_array_elements(value) with ordinality e(v,n);
 when 'string' then
  original:=value#>>'{}'; revised:=original;
  for pair in select m.key,m.value#>>'{}' target from jsonb_each(mapping) m order by length(m.key) desc,m.key loop
   revised:=regexp_replace(revised,'(^|[[:space:]"''(<])(https://bloxodes\.com)?'||pair.key||case when collection_paths ? pair.key then '(/page/[1-9][0-9]*)?' else '()' end||'(?=$|[#?[:space:]"'')<>])', E'\\1\\2'||pair.target||E'\\3','g');
  end loop;
  result:=to_jsonb(revised);
 else result:=value;
 end case;
 return result;
end $$;
revoke all on function public.rewrite_game_url_links(jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.rewrite_game_url_links(jsonb,jsonb,jsonb) to service_role;

create function public.move_game_namespace_to_page_type_urls(p_namespace text) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='3s' as $$
declare root public.games; t text; section text; r record; col record; mapping jsonb:='{}'; main_path text; changed bigint; page_count bigint:=0; rewritten bigint:=0; field_count bigint:=0;
begin
 if p_namespace in ('gta','red-dead','minecraft') then
  raise exception 'Namespace % cannot move until its GTA/Red Dead/Minecraft renderer follow-up PR',p_namespace;
 end if;
 -- BEFORE row/table locks: identical order to Phase 2 publishers/backfill.
 perform pg_catalog.pg_advisory_xact_lock(7823462194301);
 lock table public.games,public.game_wiki_pages,public.game_code_pages,public.game_tool_pages,public.game_map_pages,public.game_quiz_pages,public.game_catalog_pages,public.game_checklist_pages,public.game_collection_pages,public.code_pages,public.wiki_pages,public.wiki_collection_pages,public.quiz_pages,public.checklist_pages,public.tools,public.events_pages,public.articles,public.catalog_pages,public.puzzle_pages in share row exclusive mode;
 select * into root from public.games where namespace=p_namespace and parent_id is null;
 if not found then raise exception 'Unknown game namespace: %',p_namespace; end if;
 if not exists(select 1 from public.game_wiki_pages where game_id=root.id) then raise exception 'Namespace needs a root wiki before moving: %',p_namespace; end if;
 if not exists(select 1 from public.games where namespace=p_namespace and url_style<>'page_type') then
  return jsonb_build_object('namespace',p_namespace,'pages_moved',0,'fields_rewritten',0,'row_field_updates',0,'paths','{}'::jsonb);
 end if;
 -- Save every old route before the style change retires synthetic hubs.
 for r in select path from public.site_routes where source='game' and status='live' and game_id in(select id from public.games where namespace=p_namespace) loop
  mapping:=mapping||jsonb_build_object(r.path,r.path);
 end loop;
 perform pg_catalog.set_config('bloxodes.url_move_namespace',p_namespace,true);
 update public.games set url_style='page_type' where namespace=p_namespace;
 main_path:=public.expected_game_page_path(root.id,'wiki');
 foreach t in array array['wiki','code','tool','map','quiz','catalog','checklist','collection'] loop
  for r in execute format('select id,canonical_path,public.expected_game_page_path(game_id,%L,%s) destination from public.game_%I_pages where namespace=$1',t,case when t='collection' then 'collection_slug' else 'slug' end,t) using p_namespace loop
   if r.canonical_path=r.destination then continue; end if;
   mapping:=mapping||jsonb_build_object(r.canonical_path,r.destination);
   execute format('update public.game_%I_pages set canonical_path=$1 where id=$2',t) using r.destination,r.id;
   page_count:=page_count+1;
  end loop;
 end loop;
 -- Synthetic roots and real directories are aliases, not competing page owners.
 mapping:=mapping||jsonb_build_object('/'||p_namespace,main_path,'/'||p_namespace||'/wiki',main_path);
 foreach section in array array['codes','tools','maps','quizzes','checklists','catalog'] loop
  t:=case section when 'codes' then 'code' when 'tools' then 'tool' when 'maps' then 'map' when 'quizzes' then 'quiz' when 'checklists' then 'checklist' else 'catalog' end;
  execute format('select exists(select 1 from public.game_%I_pages where namespace=$1)',t) into r using p_namespace;
  if r.exists and not exists(select 1 from public.site_routes where path='/'||p_namespace||'/'||section and status='old' and page_id is not null) then
   mapping:=mapping||jsonb_build_object('/'||p_namespace||'/'||section,main_path);
  end if;
 end loop;
 for r in select key,value#>>'{}' destination from jsonb_each(mapping) where key<>value#>>'{}' loop
  -- Page-linked old rows created by the route trigger must remain linked.
  if exists(select 1 from public.site_routes where path=r.key and status='old' and page_id is not null) then continue; end if;
  if exists(select 1 from public.site_routes where path=r.key and status='live') then raise exception 'Move alias would replace a live path: %',r.key; end if;
  delete from public.site_routes where path=r.key and status='gone' and source='game' and page_type='hub' and page_id=root.id::text;
  perform public.claim_site_route(jsonb_build_object('path',r.key,'status','old','target_url',r.destination,'origin','namespace-move'));
 end loop;
 perform pg_catalog.set_config('bloxodes.url_move_namespace','',true);
 return jsonb_build_object('namespace',p_namespace,'pages_moved',page_count,'fields_rewritten',field_count,'row_field_updates',rewritten,'paths',mapping);
end $$;
revoke all on function public.move_game_namespace_to_page_type_urls(text) from public,anon,authenticated;
grant execute on function public.move_game_namespace_to_page_type_urls(text) to service_role;

create or replace function public.site_route_target(r public.site_routes,p_path text) returns text
language plpgsql stable set search_path='' set extra_float_digits=1 as $$
declare tail text; parts text[]; digits text; page float8; rendered text; target text;
begin
 if r.status<>'old' then return null; end if;
 if r.page_id is not null then
  select path into target from public.site_routes where source=r.source and page_type=r.page_type and page_id=r.page_id and status='live';
  if r.page_type='collection' and substr(p_path,length(r.path)+1) ~ '^/page/[1-9][0-9]*$' then
   return target||substr(p_path,length(r.path)+1);
  end if;
  return target;
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

create or replace function public.resolve_site_route(p_path text)
returns table(route public.site_routes,resolved_target text)
language sql stable security definer set search_path='' as $$
 select r,public.site_route_target(r,p_path) from public.site_routes r
 -- Virtual collection pages use the page-linked base alias. Exact rows win.
 where (r.status='old' and r.page_type='collection' and r.page_id is not null and r.match_type='exact'
        and starts_with(p_path,r.path||'/page/') and substr(p_path,length(r.path)+1) ~ '^/page/[1-9][0-9]*$')
    or r.path=p_path and (r.match_type='exact' or r.match_self)
    or r.match_type='prefix' and (starts_with(p_path,r.path||'/') or r.path='/' and p_path<>'/' and starts_with(p_path,'/'))
       and (r.tail_mode<>'free-items' or public.site_route_target(r,p_path) is not null)
 order by (r.path=p_path) desc,(r.match_type='exact') desc,length(r.path) desc limit 1
$$;


-- Run AFTER the route move commits. No explicit table/advisory locks; UPDATE
-- locks only candidate rows. Scan 200 IDs at a time before recursive JSON work.
create function public.rewrite_moved_game_links(p_namespace text) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='3s' as $$
declare mapping jsonb; collection_paths jsonb; col record; changed bigint; rewritten bigint:=0; field_count bigint:=0;
 after_id text; batch_ids text[]; column_changed boolean;
begin
 if not exists(select 1 from public.games where namespace=p_namespace and url_style='page_type')
 or exists(select 1 from public.games where namespace=p_namespace and url_style<>'page_type') then
  raise exception 'Namespace must be moved before rewriting links: %',p_namespace;
 end if;
 select coalesce(jsonb_object_agg(path,public.site_route_target(r,path)),'{}'::jsonb) into mapping
 from public.site_routes r where status='old'
 and (path='/'||p_namespace or starts_with(path,'/'||p_namespace||'/'))
 and public.site_route_target(r,path) is not null;
 select coalesce(jsonb_agg(path),'[]'::jsonb) into collection_paths
 from public.site_routes where status='old' and page_type='collection'
 and starts_with(path,'/'||p_namespace||'/');
 -- Only mutable public content columns. Immutable collection revisions/items,
 -- source URLs, identifiers, canonical paths and progress are never rewritten.
 for col in select table_name,column_name,data_type from information_schema.columns
  where table_schema='public' and table_name in ('games','game_wiki_pages','game_collection_pages','game_code_pages','game_tool_pages','game_map_pages','game_quiz_pages','game_catalog_pages','game_checklist_pages','wiki_pages','wiki_collection_pages','code_pages','quiz_pages','checklist_pages','tools','articles','catalog_pages','events_pages')
  and (column_name like '%\_md' escape '\' or column_name in ('faq_json','description_json','controls_json','quiz_data','map_data','catalog_data')) and data_type in ('text','jsonb','json')
 loop
  after_id:=null; column_changed:=false;
  loop
   execute format('select array_agg(id::text order by id::text) from (select id from public.%I where ($1 is null or id::text>$1) and %I::text like $2 order by id::text limit 200) candidates',col.table_name,col.column_name)
    into batch_ids using after_id,'%/'||p_namespace||'%';
   exit when batch_ids is null;
   after_id:=batch_ids[array_length(batch_ids,1)];
   execute format('update public.%I set %I=(public.rewrite_game_url_links(to_jsonb(%I),$1,$3)%s)::%s where id::text=any($2) and to_jsonb(%I) is distinct from public.rewrite_game_url_links(to_jsonb(%I),$1,$3)',col.table_name,col.column_name,col.column_name,case when col.data_type='text' then '#>>''{}''' else '' end,col.data_type,col.column_name,col.column_name) using mapping,batch_ids,collection_paths;
   get diagnostics changed=row_count;
   rewritten:=rewritten+changed;
   if changed>0 then column_changed:=true; end if;
  end loop;
  if column_changed then field_count:=field_count+1; end if;
 end loop;

 return jsonb_build_object('fields_rewritten',field_count,'row_field_updates',rewritten);
end $$;
revoke all on function public.rewrite_moved_game_links(text) from public,anon,authenticated;
grant execute on function public.rewrite_moved_game_links(text) to service_role;

commit;
