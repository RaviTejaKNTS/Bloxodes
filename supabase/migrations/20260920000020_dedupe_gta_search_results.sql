begin;

create or replace function public.trg_search_index_gta_content()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  kind text;
  target_slug text;
  target_title text;
  target_subtitle text;
  target_url text;
  target_search text;
begin
  if tg_table_name = 'gta_games' then
    delete from public.search_index
    where entity_type = 'gta_game'
      and entity_id = case when tg_op = 'DELETE' then old.id::text else new.id::text end;
    return null;
  end if;

  kind := case tg_table_name
    when 'gta_wiki_pages' then 'gta_wiki'
    when 'gta_wiki_collection_pages' then 'gta_wiki_collection'
  end;

  if tg_op = 'DELETE' then
    delete from public.search_index where entity_type = kind and entity_id = old.id::text;
    return null;
  end if;

  if tg_table_name = 'gta_wiki_pages' then
    target_slug := new.slug;
    target_title := new.title;
    target_subtitle := 'GTA wiki';
    target_url := '/gta/wiki/' || new.slug;
    target_search := concat_ws(' ', new.title, new.slug, new.seo_title, new.meta_description, new.description_md, new.tips_md);
  else
    target_slug := new.wiki_slug || '/' || new.collection_slug;
    target_title := new.title;
    target_subtitle := 'GTA wiki collection';
    target_url := '/gta/wiki/' || target_slug;
    target_search := concat_ws(' ', new.title, new.display_name, new.code, new.wiki_slug, new.collection_slug, new.seo_title, new.meta_description, new.intro_md, new.description_md, new.how_it_works_md, new.wiki_md);
  end if;

  perform public.upsert_search_index(
    kind,
    new.id::text,
    target_slug,
    target_title,
    target_subtitle,
    target_url,
    new.updated_at,
    new.is_published,
    left(target_search, 4000)
  );
  return null;
end;
$$;

delete from public.search_index where entity_type = 'gta_game';

revoke all on function public.trg_search_index_gta_content() from public;
grant execute on function public.trg_search_index_gta_content() to service_role;

commit;
