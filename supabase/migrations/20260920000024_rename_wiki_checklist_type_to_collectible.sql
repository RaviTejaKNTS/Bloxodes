begin;

-- Rename only the wiki collection discriminator. Progress keys, datasets,
-- URLs, publication state and standalone checklist pages remain intact.
do $$
declare
  target_table text;
begin
  foreach target_table in array array['wiki_collection_pages', 'gta_wiki_collection_pages', 'red_dead_wiki_collection_pages'] loop
    execute format('alter table public.%I drop constraint if exists %I', target_table, target_table || '_page_type_check');
    execute format('update public.%I set page_type = %L where page_type = %L', target_table, 'collectible', 'checklist');
    execute format('alter table public.%I add constraint %I check (page_type in (%L, %L))', target_table, target_table || '_page_type_check', 'database', 'collectible');
  end loop;
end $$;

-- These collectible sets were temporarily assigned the database renderer.
update public.red_dead_wiki_collection_pages
set page_type = 'collectible'
where wiki_slug = 'red-dead-redemption-2'
  and collection_slug in ('cigarette-cards', 'dinosaur-bones')
  and page_type = 'database';

commit;
