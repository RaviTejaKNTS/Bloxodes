begin;
alter table public.comments drop constraint comments_entity_type_check;
alter table public.comments add constraint comments_entity_type_check check(entity_type in ('code','article','catalog','event','tool','wiki','wiki_collection','gta_wiki','gta_wiki_collection','red_dead_wiki','red_dead_wiki_collection','minecraft_wiki','minecraft_wiki_collection','minecraft_tool','game_wiki','game_collection','game_tool','game_code','game_map','game_quiz','game_catalog'));
create or replace function public.trg_comments_revalidate_game_content() returns trigger language plpgsql set search_path='' as $$
declare row_data jsonb; target_table text; page_path text;
begin
 for row_data in select v from (values(case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end),(case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end)) r(v) where v is not null loop
  target_table:=case when row_data->>'entity_type' in ('game_wiki','gta_wiki','red_dead_wiki','minecraft_wiki') then 'game_wiki_pages' when row_data->>'entity_type' in ('game_collection','gta_wiki_collection','red_dead_wiki_collection','minecraft_wiki_collection') then 'game_collection_pages' when row_data->>'entity_type' in ('game_tool','minecraft_tool') then 'game_tool_pages' when row_data->>'entity_type'='game_code' then 'game_code_pages' when row_data->>'entity_type'='game_map' then 'game_map_pages' when row_data->>'entity_type'='game_quiz' then 'game_quiz_pages' when row_data->>'entity_type'='game_catalog' then 'game_catalog_pages' end;
  if target_table is not null then
   execute format('select canonical_path from public.%I where id=$1',target_table) into page_path using (row_data->>'entity_id')::uuid;
   if page_path is not null then perform public.enqueue_revalidation('game_content',ltrim(page_path,'/'),'comments_'||lower(tg_op)); end if;
  end if;
 end loop;
 return null;
end $$;
notify pgrst, 'reload schema';
commit;
