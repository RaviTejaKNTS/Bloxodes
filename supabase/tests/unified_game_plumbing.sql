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
select pg_temp.assert_plumbing((select resolved_target='/games/minecraft' from public.resolve_site_route('/minecraft/wiki')),'bare legacy wiki goes to the Minecraft hub');
select pg_temp.assert_plumbing((select resolved_target='/wiki/minecraft-bedrock/achievements/page/2' from public.resolve_site_route('/minecraft/wiki/achievements/page/2')),'Bedrock objectives and pagination in one hop');
select pg_temp.assert_plumbing((select count(*)>0 from public.site_routes where status='old' and source='game' and page_id is not null),'moved recrawl sitemap data preserved');
-- Expected identities come from stored owners and paths, never URL builders.
-- Hidden pages retain a shared row with is_published=false. Collections also
-- need a published wiki and dataset; extended pages allow NULL publish dates.
create or replace temporary view plumbing_expected_search as
select p.id,p.kind,p.canonical_path,
 coalesce(p.visible and g.is_published and coalesce(parent.is_published,true),false) visible
from (
 select id,'game_wiki' kind,game_id,canonical_path,is_published visible from public.game_wiki_pages
 union all
 select p.id,'game_collection',p.game_id,p.canonical_path,
  p.is_published and p.published_dataset_id is not null and exists (
   select 1 from public.game_wiki_pages w where w.id=p.wiki_page_id and w.is_published
  ) from public.game_collection_pages p
 union all select id,'game_tool',game_id,canonical_path,is_published from public.game_tool_pages
 union all select id,'game_code',game_id,canonical_path,is_published from public.game_code_pages
 union all select id,'game_checklist',game_id,canonical_path,is_public and published_at<=now() from public.game_checklist_pages
 union all select id,'game_map',game_id,canonical_path,is_published and (published_at is null or published_at<=now()) from public.game_map_pages
 union all select id,'game_quiz',game_id,canonical_path,is_published and (published_at is null or published_at<=now()) from public.game_quiz_pages
 union all select id,'game_catalog',game_id,canonical_path,is_published and (published_at is null or published_at<=now()) from public.game_catalog_pages
) p join public.games g on g.id=p.game_id left join public.games parent on parent.id=g.parent_id;
-- Include the offending type, UUID and path in CI failures.
do $$ declare failures text; begin
 if current_setting('bloxodes.plumbing_phase',true)='legacy' then return; end if;
 select string_agg(kind||'/'||id::text||' at '||coalesce(canonical_path,'<NULL>'),', ' order by kind,id)
 into failures from (
  select p.* from plumbing_expected_search p
  left join public.search_index s on s.entity_type=p.kind and s.entity_id=p.id::text
  where s.id is null or s.url is distinct from p.canonical_path or s.is_published is distinct from p.visible
  order by p.kind,p.id limit 20
 ) missing;
 perform pg_temp.assert_plumbing(failures is null,'shared search identity, stored URL or visibility mismatch: '||coalesce(failures,''));
end $$;
select pg_temp.assert_plumbing(not exists(select 1 from public.revalidation_events where entity_type ~ '^(gta|red_dead|minecraft)_'),'legacy queued cache events replaced');
rollback;
