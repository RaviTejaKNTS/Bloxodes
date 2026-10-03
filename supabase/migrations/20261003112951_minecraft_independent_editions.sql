begin;

-- Retain the original identity for legacy revisions and comments during migration.
alter table public.minecraft_games drop constraint minecraft_games_slug_check;
alter table public.minecraft_games add constraint minecraft_games_slug_check check (slug in ('minecraft', 'minecraft-java', 'minecraft-bedrock'));
alter table public.minecraft_wiki_pages drop constraint minecraft_wiki_pages_slug_check;
alter table public.minecraft_wiki_pages add constraint minecraft_wiki_pages_slug_check check (slug in ('minecraft', 'minecraft-java', 'minecraft-bedrock'));
alter table public.minecraft_wiki_collection_pages drop constraint minecraft_wiki_collection_pages_wiki_slug_check;
alter table public.minecraft_wiki_collection_pages add constraint minecraft_wiki_collection_pages_wiki_slug_check check (wiki_slug in ('minecraft', 'minecraft-java', 'minecraft-bedrock'));

create or replace function public.minecraft_wiki_path(wiki_slug text)
returns text language sql immutable strict set search_path = '' as $$
  select case wiki_slug
    when 'minecraft-java' then '/minecraft/java/wiki'
    when 'minecraft-bedrock' then '/minecraft/bedrock/wiki'
    else '/minecraft/wiki' end;
$$;
revoke all on function public.minecraft_wiki_path(text) from public, anon, authenticated;
grant execute on function public.minecraft_wiki_path(text) to service_role;

create or replace function public.trg_enqueue_revalidation_minecraft_content()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  event_type text;
  event_slug text;
  old_slug text;
begin
  event_type := case tg_table_name
    when 'minecraft_games' then 'minecraft_game'
    when 'minecraft_wiki_pages' then 'minecraft_wiki'
    when 'minecraft_wiki_collection_pages' then 'minecraft_wiki_collection'
    when 'minecraft_tools' then 'minecraft_tool'
  end;

  if tg_op = 'DELETE' then
    if coalesce((to_jsonb(old) ->> 'is_published')::boolean, false) then
      event_slug := case
        when tg_table_name = 'minecraft_wiki_collection_pages' then to_jsonb(old) ->> 'code'
        else to_jsonb(old) ->> 'slug'
      end;
      perform public.enqueue_revalidation(event_type, event_slug, tg_table_name || '_delete');
    end if;
    return null;
  end if;

  if coalesce((to_jsonb(new) ->> 'is_published')::boolean, false) then
    event_slug := case
      when tg_table_name = 'minecraft_wiki_collection_pages' then to_jsonb(new) ->> 'code'
      else to_jsonb(new) ->> 'slug'
    end;
    perform public.enqueue_revalidation(event_type, event_slug, tg_table_name || '_' || lower(tg_op));
  end if;

  old_slug := case
    when tg_op <> 'UPDATE' then null
    when tg_table_name = 'minecraft_wiki_collection_pages' then to_jsonb(old) ->> 'code'
    else to_jsonb(old) ->> 'slug'
  end;

  if tg_op = 'UPDATE' and coalesce((to_jsonb(old) ->> 'is_published')::boolean, false) and (
    not coalesce((to_jsonb(new) ->> 'is_published')::boolean, false)
    or old_slug is distinct from event_slug
  ) then
    perform public.enqueue_revalidation(event_type, old_slug, tg_table_name || '_old_slug_or_unpublish');
  end if;

  return null;
end;
$$;

create or replace function public.trg_search_index_minecraft_content()
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
  if tg_table_name = 'minecraft_games' then
    delete from public.search_index
    where entity_type = 'minecraft_game'
      and entity_id = case when tg_op = 'DELETE' then old.id::text else new.id::text end;
    return null;
  end if;

  kind := case tg_table_name
    when 'minecraft_wiki_pages' then 'minecraft_wiki'
    when 'minecraft_wiki_collection_pages' then 'minecraft_wiki_collection'
    when 'minecraft_tools' then 'minecraft_tool'
  end;

  if tg_op = 'DELETE' then
    delete from public.search_index where entity_type = kind and entity_id = old.id::text;
    return null;
  end if;

  if tg_table_name = 'minecraft_tools' then
    target_slug := new.slug;
    target_title := new.title;
    target_subtitle := 'Minecraft tool';
    target_url := '/minecraft/tools/' || new.slug;
    target_search := concat_ws(' ', new.title, new.slug, new.meta_description, new.intro_md, new.how_it_works_md);
  elsif tg_table_name = 'minecraft_wiki_pages' then
    target_slug := new.slug;
    target_title := new.title;
    target_subtitle := 'Minecraft wiki';
    target_url := public.minecraft_wiki_path(new.slug);
    target_search := concat_ws(' ', new.title, new.slug, new.seo_title, new.meta_description, new.description_md, new.tips_md);
  else
    target_slug := new.code;
    target_title := new.title;
    target_subtitle := 'Minecraft wiki collection';
    target_url := public.minecraft_wiki_path(new.wiki_slug) || '/' || new.collection_slug;
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

create or replace function public.trg_comments_revalidate_minecraft_entity()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  event_source text;
begin
  if tg_op <> 'INSERT' then
    event_source := 'comments_' || lower(tg_op) || '_old';

    if old.entity_type = 'minecraft_tool' then
      perform public.enqueue_revalidation('minecraft_tool', (select slug from public.minecraft_tools where id = old.entity_id), event_source);
    elsif old.entity_type = 'minecraft_wiki' then
      perform public.enqueue_revalidation(
        'minecraft_wiki',
        (select lower(page.slug) from public.minecraft_wiki_pages page where page.id = old.entity_id),
        event_source
      );
    elsif old.entity_type = 'minecraft_wiki_collection' then
      perform public.enqueue_revalidation(
        'minecraft_wiki_collection',
        (
          select lower(page.code)
          from public.minecraft_wiki_collection_pages page
          where page.id = old.entity_id
        ),
        event_source
      );
    end if;
  end if;

  if tg_op <> 'DELETE' then
    event_source := 'comments_' || lower(tg_op);

    if new.entity_type = 'minecraft_tool' then
      perform public.enqueue_revalidation('minecraft_tool', (select slug from public.minecraft_tools where id = new.entity_id), event_source);
    elsif new.entity_type = 'minecraft_wiki' then
      perform public.enqueue_revalidation(
        'minecraft_wiki',
        (select lower(page.slug) from public.minecraft_wiki_pages page where page.id = new.entity_id),
        event_source
      );
    elsif new.entity_type = 'minecraft_wiki_collection' then
      perform public.enqueue_revalidation(
        'minecraft_wiki_collection',
        (
          select lower(page.code)
          from public.minecraft_wiki_collection_pages page
          where page.id = new.entity_id
        ),
        event_source
      );
    end if;
  end if;

  return null;
end;
$$;

-- Refresh owned search URLs after changing their route contract.
update public.minecraft_wiki_pages set title = title;
update public.minecraft_wiki_collection_pages set title = title;
notify pgrst, 'reload schema';
commit;
