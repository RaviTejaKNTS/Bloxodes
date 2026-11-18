-- Wiki media moved from the retired Cloudflare Worker route
-- https://media.bloxodes.com/wiki/<key> to the R2 custom domain
-- https://wiki-media.bloxodes.com/<key> (bucket root = host root).
-- A permanent Cloudflare redirect keeps the old prefix working; this rewrites
-- stored copies so pages stop depending on it.
--
-- Only mutable public content columns are rewritten. Left as they are, and
-- rewritten by the web app at render time instead:
-- - immutable collection revisions (wiki_collection_datasets/items,
--   game_collection_datasets/items), which items store as R2 keys anyway;
-- - game_map_pages.map_data, whose registered GTA snapshots are pinned by
--   hash in game_registered_map_snapshot_check.
--
-- Only the host changes, so no user trigger may treat this as a content edit:
-- updated_at (sitemap lastmod), publication, IndexNow, search and revalidation
-- triggers must stay quiet. session_replication_role = replica skips every
-- ordinary trigger for this transaction only (no table uses ENABLE ALWAYS), and
-- unlike ALTER TABLE ... DISABLE TRIGGER it takes no extra table lock (that
-- takes SHARE ROW EXCLUSIVE, blocking writers until the shared migration
-- transaction commits): the UPDATEs hold only row locks. Setting it needs a
-- superuser (production runs as supabase_admin) or Supabase's privileged
-- postgres role (managed development), which supautils allows to set it.
--
-- The migration runners apply every pending migration in one transaction, so
-- the runner's lock_timeout, statement_timeout and replication role are saved
-- first and restored at the end. Re-running finds no rows and touches nothing.
begin;

select
  set_config('bloxodes.wiki_media_saved_lock_timeout', current_setting('lock_timeout'), true),
  set_config('bloxodes.wiki_media_saved_statement_timeout', current_setting('statement_timeout'), true),
  set_config('bloxodes.wiki_media_saved_replication_role', current_setting('session_replication_role'), true);

set local lock_timeout = '3s';
set local statement_timeout = '60s';
set local session_replication_role = replica;

do $$
declare
  old_prefix constant text := 'https://media.bloxodes.com/wiki/';
  new_prefix constant text := 'https://wiki-media.bloxodes.com/';
  target text;
  sets text;
  filter text;
  changed bigint;
begin
  if current_setting('session_replication_role') <> 'replica' then
    raise exception 'wiki media host rewrite must run with session_replication_role = replica';
  end if;

  foreach target in array array[
    'wiki_pages', 'wiki_collection_pages',
    'games', 'game_wiki_pages', 'game_collection_pages', 'game_tool_pages', 'game_code_pages',
    'game_map_pages', 'game_quiz_pages', 'game_catalog_pages', 'game_checklist_pages', 'game_article_pages',
    'articles', 'code_pages', 'tools', 'catalog_pages', 'quiz_pages', 'checklist_pages', 'events_pages', 'puzzle_pages'
  ] loop
    if to_regclass(format('public.%I', target)) is null then continue; end if;

    select
      string_agg(format(
        '%1$I = case when %1$I::text like %2$L then (replace(%1$I::text, %3$L, %4$L))::%5$s else %1$I end',
        column_name, '%' || old_prefix || '%', old_prefix, new_prefix, data_type
      ), ', ' order by column_name),
      string_agg(format('%I::text like %L', column_name, '%' || old_prefix || '%'), ' or ' order by column_name)
    into sets, filter
    from information_schema.columns
    where table_schema = 'public'
      and table_name = target
      and data_type in ('text', 'jsonb', 'json')
      and (
        column_name in ('cover_image', 'hero_image', 'thumb_url', 'icon_url', 'image',
                        'quiz_data', 'catalog_data')
        or column_name like '%\_md' escape '\'
        or column_name like '%\_json' escape '\'
      );
    if sets is null then continue; end if;

    -- Plain UPDATE: row locks on matching rows only, no table-level lock beyond
    -- the ROW EXCLUSIVE that every UPDATE takes (it never conflicts with reads).
    execute format('update public.%I set %s where %s', target, sets, filter);
    get diagnostics changed = row_count;
    if changed > 0 then
      raise notice 'wiki media host: % rows rewritten in %', changed, target;
    end if;
  end loop;
end
$$;

-- Restore the replication role with SET LOCAL, not set_config(): supautils
-- lets Supabase's privileged postgres role change it only through SET.
do $$
declare
  saved_role text := current_setting('bloxodes.wiki_media_saved_replication_role');
begin
  if saved_role not in ('origin', 'replica', 'local') then
    raise exception 'unexpected saved session_replication_role: %', saved_role;
  end if;
  execute format('set local session_replication_role = %s', saved_role);
end
$$;

select
  set_config('statement_timeout', current_setting('bloxodes.wiki_media_saved_statement_timeout'), true),
  set_config('lock_timeout', current_setting('bloxodes.wiki_media_saved_lock_timeout'), true);

commit;
