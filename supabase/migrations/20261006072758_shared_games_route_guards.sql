begin;
alter table public.games add check(namespace<>'roblox');
alter table public.games add check(kind='game' or parent_id is null);
alter table public.games add check(parent_id is not null or slug=namespace);
create unique index game_namespace_root_idx on public.games(namespace) where parent_id is null;
create or replace function public.prepare_game_content() returns trigger language plpgsql set search_path='' as $$
declare g public.games%rowtype; root public.games%rowtype; wiki public.game_wiki_pages%rowtype; base text;
begin
 if tg_table_name='games' then
  if new.kind='game' and new.parent_id is null then select id into new.parent_id from public.games where namespace=new.namespace and kind='franchise'; end if;
  if new.parent_id is not null and not exists(select 1 from public.games where id=new.parent_id and kind='franchise' and namespace=new.namespace) then raise exception 'Game parent must be its franchise'; end if;
  return new;
 end if;
 if tg_table_name='game_collection_pages' then
  select * into strict wiki from public.game_wiki_pages where id=new.wiki_page_id;
  if new.game_id<>wiki.game_id or new.namespace<>wiki.namespace or new.wiki_slug<>wiki.slug then raise exception 'Collection wiki ownership mismatch'; end if;
  if new.canonical_path is null then new.canonical_path:=wiki.canonical_path||'/'||new.collection_slug; end if;
 else
  select * into strict g from public.games where id=new.game_id;
  if new.namespace<>g.namespace then raise exception 'Page game ownership mismatch'; end if;
  select * into root from public.games where id=coalesce(g.parent_id,g.id);
  base:='/'||root.slug;
  if new.canonical_path is null then
   if tg_table_name='game_wiki_pages' then new.canonical_path:=base||'/wiki'||case when g.parent_id is null then '' else '/'||g.slug end;
   elsif tg_table_name='game_code_pages' then new.canonical_path:=base||'/codes'||case when g.parent_id is null then '' else '/'||g.slug end;
   elsif tg_table_name='game_tool_pages' then new.canonical_path:=base||'/tools/'||new.slug;
   else new.canonical_path:=base||'/checklists/'||new.slug; end if;
  end if;
 end if;
 if new.canonical_path not like '/'||new.namespace||'/%' then raise exception 'Page route must belong to its namespace'; end if;
 if new.canonical_path !~ '^/[a-z0-9/-]+$' or new.canonical_path like '%..%' then raise exception 'Invalid game content path'; end if;
 if tg_table_name<>'game_checklist_pages' and new.is_published and new.published_at is null then new.published_at:=now(); end if;
 return new;
end $$;


-- Namespace and owner IDs remain stable during ordinary page edits.
create function public.protect_game_page_owner() returns trigger language plpgsql set search_path='' as $$
begin
 if new.namespace<>old.namespace or new.game_id<>old.game_id then raise exception 'Page ownership is permanent; use a reviewed content migration'; end if;
 return new;
end $$;
create trigger protect_game_page_owner before update on public.game_wiki_pages for each row execute function public.protect_game_page_owner();
create trigger protect_game_page_owner before update on public.game_collection_pages for each row execute function public.protect_game_page_owner();
create trigger protect_game_page_owner before update on public.game_code_pages for each row execute function public.protect_game_page_owner();
create trigger protect_game_page_owner before update on public.game_tool_pages for each row execute function public.protect_game_page_owner();
create trigger protect_game_page_owner before update on public.game_checklist_pages for each row execute function public.protect_game_page_owner();
commit;
