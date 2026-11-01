-- Run on GitHub after cutover and again after the deferred rebuild. No production writes.
begin;
create or replace function pg_temp.assert_plumbing(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'game plumbing: %',message; end if; end $$;
-- The harness selects the phase. The first release must leave every legacy row intact.
select pg_temp.assert_plumbing(
 case when current_setting('bloxodes.plumbing_phase',true)='legacy' then
  (select count(*)=11 from public.search_index where entity_type ~ '^(gta|red_dead|minecraft)_')
 else not exists(select 1 from public.search_index where entity_type ~ '^(gta|red_dead|minecraft)_') end,
 'search identities match the selected release phase');
select pg_temp.assert_plumbing(not exists(select 1 from public.comments where entity_type ~ '^(gta|red_dead|minecraft)_'),'all comment identities migrated');
select pg_temp.assert_plumbing((select resolved_target='/wiki/minecraft-java' from public.resolve_site_route('/minecraft/wiki')),'bare legacy wiki defaults to Java');
select pg_temp.assert_plumbing((select resolved_target='/wiki/minecraft-bedrock/achievements/page/2' from public.resolve_site_route('/minecraft/wiki/achievements/page/2')),'Bedrock objectives and pagination in one hop');
select pg_temp.assert_plumbing((select count(*)>0 from public.site_routes where status='old' and source='game' and page_id is not null),'moved recrawl sitemap data preserved');
-- All page families must have a shared search key, including hidden rows. This
-- compares identities and stored paths, independently of the refresh function.
select pg_temp.assert_plumbing(current_setting('bloxodes.plumbing_phase',true)='legacy' or not exists (
 select 1 from (
  select id,'game_wiki' kind,canonical_path from public.game_wiki_pages
  union all select id,'game_collection',canonical_path from public.game_collection_pages
  union all select id,'game_tool',canonical_path from public.game_tool_pages
  union all select id,'game_code',canonical_path from public.game_code_pages
  union all select id,'game_checklist',canonical_path from public.game_checklist_pages
  union all select id,'game_map',canonical_path from public.game_map_pages
  union all select id,'game_quiz',canonical_path from public.game_quiz_pages
  union all select id,'game_catalog',canonical_path from public.game_catalog_pages
 ) p left join public.search_index s on s.entity_type=p.kind and s.entity_id=p.id::text
 where s.id is null or s.url<>p.canonical_path
),'every game page has its shared search identity and saved URL');
select pg_temp.assert_plumbing(not exists(select 1 from public.revalidation_events where entity_type ~ '^(gta|red_dead|minecraft)_'),'legacy queued cache events replaced');
rollback;
