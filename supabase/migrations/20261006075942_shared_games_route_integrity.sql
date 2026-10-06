begin;
create index game_wiki_owner_namespace_idx on public.game_wiki_pages(game_id,namespace);
create index game_collection_owner_namespace_idx on public.game_collection_pages(game_id,namespace);
create index game_checklist_owner_namespace_idx on public.game_checklist_pages(game_id,namespace);
create index game_code_page_owner_namespace_idx on public.game_code_pages(game_id,namespace);
alter table public.games add constraint games_reserved_namespace_check check(namespace not in ('roblox','games','wiki','codes','tools','articles','catalog','stats','checklists','quizzes','events','puzzles','authors','about','contact','disclaimer','lists','browser-extension','editorial-guidelines','how-we-gather-and-verify-codes','terms-of-service','privacy-policy','cookie-settings','account-deletion','api','auth','account','login','logout','search','sitemaps','feed'));

create function public.validate_game_route_identity() returns trigger language plpgsql set search_path='' as $$
declare g public.games%rowtype; wiki public.game_wiki_pages%rowtype; expected text;
begin
 -- Existing Minecraft edition and archived URLs remain stable during ordinary edits.
 if tg_op='UPDATE' and new.canonical_path=old.canonical_path then return new; end if;
 select * into strict g from public.games where id=new.game_id;
 if tg_table_name='game_collection_pages' then
  select * into strict wiki from public.game_wiki_pages where id=new.wiki_page_id;
  expected:=wiki.canonical_path||'/'||new.collection_slug;
 elsif tg_table_name='game_wiki_pages' then
  expected:='/'||new.namespace||'/wiki'||case when g.parent_id is null then '' else '/'||g.slug end;
  if new.namespace='minecraft' and g.slug in ('minecraft-java','minecraft-bedrock') then expected:='/minecraft/'||replace(g.slug,'minecraft-','')||'/wiki'; end if;
 elsif tg_table_name='game_code_pages' then
  expected:='/'||new.namespace||'/codes'||case when g.parent_id is null then '' else '/'||g.slug end;
 elsif tg_table_name='game_tool_pages' then expected:='/'||new.namespace||'/tools/'||new.slug;
 else expected:='/'||new.namespace||'/checklists/'||new.slug;
 end if;
 if new.canonical_path<>expected then raise exception 'Page route does not match its game and page type'; end if;
 -- The namespace lock prevents concurrent claims for the same route across page tables.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('game-route:'||new.namespace,0));
 if exists(select 1 from (
  select id,canonical_path from public.game_wiki_pages union all
  select id,canonical_path from public.game_collection_pages union all
  select id,canonical_path from public.game_code_pages union all
  select id,canonical_path from public.game_tool_pages union all
  select id,canonical_path from public.game_checklist_pages
 ) routes where canonical_path=new.canonical_path and id<>new.id) then raise exception 'Game route already belongs to another page'; end if;
 return new;
end $$;
create trigger zz_game_route_identity before insert or update on public.game_wiki_pages for each row execute function public.validate_game_route_identity();
create trigger zz_game_route_identity before insert or update on public.game_collection_pages for each row execute function public.validate_game_route_identity();
create trigger zz_game_route_identity before insert or update on public.game_code_pages for each row execute function public.validate_game_route_identity();
create trigger zz_game_route_identity before insert or update on public.game_tool_pages for each row execute function public.validate_game_route_identity();
create trigger zz_game_route_identity before insert or update on public.game_checklist_pages for each row execute function public.validate_game_route_identity();
commit;
