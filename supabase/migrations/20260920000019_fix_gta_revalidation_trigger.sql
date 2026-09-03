begin;

create or replace function public.trg_enqueue_revalidation_gta_content()
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
    when 'gta_games' then 'gta_game'
    when 'gta_wiki_pages' then 'gta_wiki'
    when 'gta_wiki_collection_pages' then 'gta_wiki_collection'
  end;

  if tg_op = 'DELETE' then
    if coalesce((to_jsonb(old) ->> 'is_published')::boolean, false) then
      event_slug := case
        when tg_table_name = 'gta_wiki_collection_pages' then (to_jsonb(old) ->> 'wiki_slug') || '/' || (to_jsonb(old) ->> 'collection_slug')
        else to_jsonb(old) ->> 'slug'
      end;
      perform public.enqueue_revalidation(event_type, event_slug, tg_table_name || '_delete');
    end if;
    return null;
  end if;

  if coalesce((to_jsonb(new) ->> 'is_published')::boolean, false) then
    event_slug := case
      when tg_table_name = 'gta_wiki_collection_pages' then (to_jsonb(new) ->> 'wiki_slug') || '/' || (to_jsonb(new) ->> 'collection_slug')
      else to_jsonb(new) ->> 'slug'
    end;
    perform public.enqueue_revalidation(event_type, event_slug, tg_table_name || '_' || lower(tg_op));
  end if;

  old_slug := case
    when tg_op <> 'UPDATE' then null
    when tg_table_name = 'gta_wiki_collection_pages' then (to_jsonb(old) ->> 'wiki_slug') || '/' || (to_jsonb(old) ->> 'collection_slug')
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

revoke all on function public.trg_enqueue_revalidation_gta_content() from public;
grant execute on function public.trg_enqueue_revalidation_gta_content() to service_role;

commit;
