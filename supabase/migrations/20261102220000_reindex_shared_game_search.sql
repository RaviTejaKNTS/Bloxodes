begin;
-- Rebuild shared game search rows and drop the retired per-franchise types.
set local lock_timeout = '3s';
select pg_advisory_xact_lock(7823462194301);
-- One set-based insert/upsert across all namespaces, no per-page RPC calls.
select public.refresh_game_content_index(null);
delete from public.search_index where entity_type in
 ('gta_game','gta_wiki','gta_wiki_collection','gta_checklist','red_dead_game','red_dead_wiki','red_dead_wiki_collection','minecraft_game','minecraft_wiki','minecraft_wiki_collection','minecraft_tool');
commit;
