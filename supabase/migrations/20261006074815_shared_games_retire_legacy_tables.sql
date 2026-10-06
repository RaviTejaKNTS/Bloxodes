begin;
-- All source rows and their original columns must still match. Lock before comparison.
lock table public.gta_games, public.red_dead_games, public.minecraft_games, public.gta_wiki_pages, public.gta_wiki_collection_pages, public.gta_wiki_collection_datasets, public.gta_wiki_collection_items, public.red_dead_wiki_pages, public.red_dead_wiki_collection_pages, public.red_dead_wiki_collection_datasets, public.red_dead_wiki_collection_items, public.minecraft_wiki_pages, public.minecraft_wiki_collection_pages, public.minecraft_wiki_collection_datasets, public.minecraft_wiki_collection_items, public.gta_checklist_pages, public.gta_checklist_items, public.minecraft_tools, public.minecraft_releases, public.user_gta_collection_progress, public.user_red_dead_collection_progress in access exclusive mode;
do $$
declare source_name text; target_name text; ns text; cols text; mismatch boolean;
begin
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='gta_games';
 execute format('select exists((select %s from public.gta_games except select %s from public.games where namespace=%L))',cols,cols,'gta') into mismatch;
 if mismatch then raise exception 'Original fields differ in gta_games; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='red_dead_games';
 execute format('select exists((select %s from public.red_dead_games except select %s from public.games where namespace=%L))',cols,cols,'red-dead') into mismatch;
 if mismatch then raise exception 'Original fields differ in red_dead_games; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='minecraft_games';
 execute format('select exists((select %s from public.minecraft_games except select %s from public.games where namespace=%L))',cols,cols,'minecraft') into mismatch;
 if mismatch then raise exception 'Original fields differ in minecraft_games; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='gta_wiki_pages';
 execute format('select exists((select %s from public.gta_wiki_pages except select %s from public.game_wiki_pages where namespace=%L))',cols,cols,'gta') into mismatch;
 if mismatch then raise exception 'Original fields differ in gta_wiki_pages; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='gta_wiki_collection_pages';
 execute format('select exists((select %s from public.gta_wiki_collection_pages except select %s from public.game_collection_pages where namespace=%L))',cols,cols,'gta') into mismatch;
 if mismatch then raise exception 'Original fields differ in gta_wiki_collection_pages; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='gta_wiki_collection_datasets';
 execute format('select exists((select %s from public.gta_wiki_collection_datasets except select %s from public.game_collection_datasets where namespace=%L))',cols,cols,'gta') into mismatch;
 if mismatch then raise exception 'Original fields differ in gta_wiki_collection_datasets; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='gta_wiki_collection_items';
 execute format('select exists((select %s from public.gta_wiki_collection_items except select %s from public.game_collection_items where namespace=%L))',cols,cols,'gta') into mismatch;
 if mismatch then raise exception 'Original fields differ in gta_wiki_collection_items; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='red_dead_wiki_pages';
 execute format('select exists((select %s from public.red_dead_wiki_pages except select %s from public.game_wiki_pages where namespace=%L))',cols,cols,'red-dead') into mismatch;
 if mismatch then raise exception 'Original fields differ in red_dead_wiki_pages; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='red_dead_wiki_collection_pages';
 execute format('select exists((select %s from public.red_dead_wiki_collection_pages except select %s from public.game_collection_pages where namespace=%L))',cols,cols,'red-dead') into mismatch;
 if mismatch then raise exception 'Original fields differ in red_dead_wiki_collection_pages; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='red_dead_wiki_collection_datasets';
 execute format('select exists((select %s from public.red_dead_wiki_collection_datasets except select %s from public.game_collection_datasets where namespace=%L))',cols,cols,'red-dead') into mismatch;
 if mismatch then raise exception 'Original fields differ in red_dead_wiki_collection_datasets; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='red_dead_wiki_collection_items';
 execute format('select exists((select %s from public.red_dead_wiki_collection_items except select %s from public.game_collection_items where namespace=%L))',cols,cols,'red-dead') into mismatch;
 if mismatch then raise exception 'Original fields differ in red_dead_wiki_collection_items; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='minecraft_wiki_pages';
 execute format('select exists((select %s from public.minecraft_wiki_pages except select %s from public.game_wiki_pages where namespace=%L))',cols,cols,'minecraft') into mismatch;
 if mismatch then raise exception 'Original fields differ in minecraft_wiki_pages; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='minecraft_wiki_collection_pages';
 execute format('select exists((select %s from public.minecraft_wiki_collection_pages except select %s from public.game_collection_pages where namespace=%L))',cols,cols,'minecraft') into mismatch;
 if mismatch then raise exception 'Original fields differ in minecraft_wiki_collection_pages; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='minecraft_wiki_collection_datasets';
 execute format('select exists((select %s from public.minecraft_wiki_collection_datasets except select %s from public.game_collection_datasets where namespace=%L))',cols,cols,'minecraft') into mismatch;
 if mismatch then raise exception 'Original fields differ in minecraft_wiki_collection_datasets; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='minecraft_wiki_collection_items';
 execute format('select exists((select %s from public.minecraft_wiki_collection_items except select %s from public.game_collection_items where namespace=%L))',cols,cols,'minecraft') into mismatch;
 if mismatch then raise exception 'Original fields differ in minecraft_wiki_collection_items; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='gta_checklist_pages';
 execute format('select exists((select %s from public.gta_checklist_pages except select %s from public.game_checklist_pages where namespace=%L))',cols,cols,'gta') into mismatch;
 if mismatch then raise exception 'Original fields differ in gta_checklist_pages; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='gta_checklist_items';
 execute format('select exists((select %s from public.gta_checklist_items except select %s from public.game_checklist_items where namespace=%L))',cols,cols,'gta') into mismatch;
 if mismatch then raise exception 'Original fields differ in gta_checklist_items; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='minecraft_tools';
 execute format('select exists((select %s from public.minecraft_tools except select %s from public.game_tool_pages where namespace=%L))',cols,cols,'minecraft') into mismatch;
 if mismatch then raise exception 'Original fields differ in minecraft_tools; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='minecraft_releases';
 execute format('select exists((select %s from public.minecraft_releases except select %s from public.game_releases where namespace=%L))',cols,cols,'minecraft') into mismatch;
 if mismatch then raise exception 'Original fields differ in minecraft_releases; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='user_gta_collection_progress';
 execute format('select exists((select %s from public.user_gta_collection_progress except select %s from public.game_collection_progress where namespace=%L))',cols,cols,'gta') into mismatch;
 if mismatch then raise exception 'Original fields differ in user_gta_collection_progress; refusing retirement'; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name='user_red_dead_collection_progress';
 execute format('select exists((select %s from public.user_red_dead_collection_progress except select %s from public.game_collection_progress where namespace=%L))',cols,cols,'red-dead') into mismatch;
 if mismatch then raise exception 'Original fields differ in user_red_dead_collection_progress; refusing retirement'; end if;
end $$;
-- Keep Roblox comment behavior, and let the shared trigger own every non-Roblox type.
create or replace function public.trg_comments_revalidate_entity() returns trigger language plpgsql set search_path='' as $$
declare row_data jsonb; target_table text; target_key text; page_slug text;
begin
 for row_data in select v from (values(case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end),(case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end)) r(v) where v is not null loop
  target_table:=case row_data->>'entity_type' when 'code' then 'code_pages' when 'article' then 'articles' when 'catalog' then 'catalog_pages' when 'event' then 'events_pages' when 'tool' then 'tools' when 'wiki' then 'wiki_pages' when 'wiki_collection' then 'wiki_collection_pages' end;
  if target_table is not null then
   target_key:=case when row_data->>'entity_type' in ('catalog','tool') then 'code' else 'slug' end;
   if target_table='wiki_collection_pages' then select wiki_slug||'/'||collection_slug into page_slug from public.wiki_collection_pages where id=(row_data->>'entity_id')::uuid;
   else execute format('select %I from public.%I where id=$1',target_key,target_table) into page_slug using (row_data->>'entity_id')::uuid;
   end if;
   if page_slug is not null then perform public.enqueue_revalidation(row_data->>'entity_type',lower(page_slug),'comments_'||lower(tg_op)); end if;
  end if;
 end loop;
 return null;
end $$;
create or replace function public.trg_comments_revalidate_game_content() returns trigger language plpgsql set search_path='' as $$
declare row_data jsonb; target_table text; page_path text;
begin
 for row_data in select v from (values(case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end),(case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end)) r(v) where v is not null loop
  target_table:=case when row_data->>'entity_type' in ('game_wiki','gta_wiki','red_dead_wiki','minecraft_wiki') then 'game_wiki_pages' when row_data->>'entity_type' in ('game_collection','gta_wiki_collection','red_dead_wiki_collection','minecraft_wiki_collection') then 'game_collection_pages' when row_data->>'entity_type' in ('game_tool','minecraft_tool') then 'game_tool_pages' when row_data->>'entity_type'='game_code' then 'game_code_pages' end;
  if target_table is not null then
   execute format('select canonical_path from public.%I where id=$1',target_table) into page_path using (row_data->>'entity_id')::uuid;
   if page_path is not null then perform public.enqueue_revalidation('game_content',ltrim(page_path,'/'),'comments_'||lower(tg_op)); end if;
  end if;
 end loop;
 return null;
end $$;
drop trigger trg_comments_revalidate_red_dead_entity on public.comments;
drop trigger trg_comments_revalidate_minecraft_entity on public.comments;
drop view public.gta_wiki_pages_view, public.gta_wiki_collection_pages_view, public.gta_checklist_pages_view, public.red_dead_wiki_pages_view, public.red_dead_wiki_collection_pages_view, public.minecraft_wiki_pages_view, public.minecraft_wiki_collection_pages_view, public.minecraft_tools_view;
-- No CASCADE: an unexpected dependency must stop the migration.
do $$
declare legacy_functions oid[]; fn oid;
begin
 select array_agg(distinct t.tgfoid) into legacy_functions from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal and c.relname in ('gta_games','red_dead_games','minecraft_games','gta_wiki_pages','gta_wiki_collection_pages','gta_wiki_collection_datasets','gta_wiki_collection_items','red_dead_wiki_pages','red_dead_wiki_collection_pages','red_dead_wiki_collection_datasets','red_dead_wiki_collection_items','minecraft_wiki_pages','minecraft_wiki_collection_pages','minecraft_wiki_collection_datasets','minecraft_wiki_collection_items','gta_checklist_pages','gta_checklist_items','minecraft_tools','minecraft_releases','user_gta_collection_progress','user_red_dead_collection_progress') and p.proname<>'set_updated_at';
 drop function public.activate_minecraft_edition_migration(jsonb);
 drop function public.refresh_minecraft_search_visibility(uuid);
 drop function public.trg_comments_revalidate_red_dead_entity();
 drop function public.trg_comments_revalidate_minecraft_entity();
 drop table public.gta_games, public.red_dead_games, public.minecraft_games, public.gta_wiki_pages, public.gta_wiki_collection_pages, public.gta_wiki_collection_datasets, public.gta_wiki_collection_items, public.red_dead_wiki_pages, public.red_dead_wiki_collection_pages, public.red_dead_wiki_collection_datasets, public.red_dead_wiki_collection_items, public.minecraft_wiki_pages, public.minecraft_wiki_collection_pages, public.minecraft_wiki_collection_datasets, public.minecraft_wiki_collection_items, public.gta_checklist_pages, public.gta_checklist_items, public.minecraft_tools, public.minecraft_releases, public.user_gta_collection_progress, public.user_red_dead_collection_progress;
 foreach fn in array legacy_functions loop execute format('drop function %s',fn::regprocedure); end loop;
end $$;
delete from public.search_index where entity_type in ('gta_game','red_dead_game','minecraft_game');
select public.refresh_game_content_index('gta');
select public.refresh_game_content_index('red-dead');
select public.refresh_game_content_index('minecraft');
commit;
