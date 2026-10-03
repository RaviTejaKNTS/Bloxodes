begin;

create or replace function public.refresh_minecraft_search_visibility(target_game_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.search_index as entry
  set is_published = page.is_published and game.is_published
  from public.minecraft_wiki_pages as page
  join public.minecraft_games as game on game.id = page.game_id
  where page.game_id = target_game_id
    and entry.entity_type = 'minecraft_wiki'
    and entry.entity_id = page.id::text;

  update public.search_index as entry
  set is_published = page.is_published and wiki.is_published and game.is_published
  from public.minecraft_wiki_collection_pages as page
  join public.minecraft_wiki_pages as wiki on wiki.id = page.wiki_page_id
  join public.minecraft_games as game on game.id = page.game_id
  where page.game_id = target_game_id
    and entry.entity_type = 'minecraft_wiki_collection'
    and entry.entity_id = page.id::text;
$$;

create or replace function public.trg_refresh_minecraft_search_visibility()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_row jsonb;
  new_row jsonb;
begin
  if tg_op <> 'INSERT' then
    old_row := to_jsonb(old);
    perform public.refresh_minecraft_search_visibility(
      (old_row ->> case when tg_table_name = 'minecraft_games' then 'id' else 'game_id' end)::uuid
    );
  end if;
  if tg_op <> 'DELETE' then
    new_row := to_jsonb(new);
    perform public.refresh_minecraft_search_visibility(
      (new_row ->> case when tg_table_name = 'minecraft_games' then 'id' else 'game_id' end)::uuid
    );
  end if;
  return null;
end;
$$;

-- PostgreSQL runs equal-timing triggers in name order. Refresh after the index upsert.
create trigger zzz_minecraft_game_search_visibility
after insert or update or delete on public.minecraft_games
for each row execute function public.trg_refresh_minecraft_search_visibility();
create trigger zzz_minecraft_wiki_search_visibility
after insert or update or delete on public.minecraft_wiki_pages
for each row execute function public.trg_refresh_minecraft_search_visibility();
create trigger zzz_minecraft_collection_search_visibility
after insert or update or delete on public.minecraft_wiki_collection_pages
for each row execute function public.trg_refresh_minecraft_search_visibility();

revoke all on function public.refresh_minecraft_search_visibility(uuid), public.trg_refresh_minecraft_search_visibility() from public, anon, authenticated;
grant execute on function public.refresh_minecraft_search_visibility(uuid), public.trg_refresh_minecraft_search_visibility() to service_role;

do $$
declare game_row record;
begin
  for game_row in select id from public.minecraft_games loop
    perform public.refresh_minecraft_search_visibility(game_row.id);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
