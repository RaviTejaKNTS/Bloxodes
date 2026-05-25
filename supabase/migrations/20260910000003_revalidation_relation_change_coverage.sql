-- Revalidate old and new related wiki pages when universe-linked content changes.

create or replace function public.trg_enqueue_revalidation_tools()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      perform public.enqueue_revalidation('tool', old.code, 'tools_delete');
      perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'tools_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    perform public.enqueue_revalidation('tool', new.code, 'tools_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_universe(new.universe_id, 'tools_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'tools_wiki_update_old');

    if old.code is distinct from new.code or new.is_published is distinct from true then
      perform public.enqueue_revalidation('tool', old.code, 'tools_old_code_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_tools on public.tools;
create trigger trg_enqueue_revalidation_tools
after insert or update or delete on public.tools
for each row execute function public.trg_enqueue_revalidation_tools();

create or replace function public.trg_enqueue_revalidation_catalog_pages()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      perform public.enqueue_revalidation('catalog', old.code, 'catalog_pages_delete');
      perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'catalog_pages_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    perform public.enqueue_revalidation('catalog', new.code, 'catalog_pages_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_universe(new.universe_id, 'catalog_pages_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'catalog_pages_wiki_update_old');

    if old.code is distinct from new.code or new.is_published is distinct from true then
      perform public.enqueue_revalidation('catalog', old.code, 'catalog_pages_old_code_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_catalog_pages on public.catalog_pages;
create trigger trg_enqueue_revalidation_catalog_pages
after insert or update or delete on public.catalog_pages
for each row execute function public.trg_enqueue_revalidation_catalog_pages();

create or replace function public.trg_enqueue_revalidation_checklist_pages()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_public = true then
      perform public.enqueue_revalidation('checklist', old.slug, 'checklist_pages_delete');
      perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'checklist_pages_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_public = true then
    perform public.enqueue_revalidation('checklist', new.slug, 'checklist_pages_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_universe(new.universe_id, 'checklist_pages_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_public = true then
    perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'checklist_pages_wiki_update_old');

    if old.slug is distinct from new.slug or new.is_public is distinct from true then
      perform public.enqueue_revalidation('checklist', old.slug, 'checklist_pages_old_slug_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_checklist_pages on public.checklist_pages;
create trigger trg_enqueue_revalidation_checklist_pages
after insert or update or delete on public.checklist_pages
for each row execute function public.trg_enqueue_revalidation_checklist_pages();

create or replace function public.trg_enqueue_revalidation_checklist_items()
returns trigger
language plpgsql
as $$
declare
  target_page_ids uuid[];
  page_record record;
begin
  if tg_op = 'DELETE' then
    target_page_ids := array_remove(array[old.page_id], null);
  elsif tg_op = 'INSERT' then
    target_page_ids := array_remove(array[new.page_id], null);
  else
    target_page_ids := array_remove(array[old.page_id, new.page_id], null);
  end if;

  for page_record in
    select distinct cp.slug, cp.universe_id
    from public.checklist_pages cp
    where cp.id = any(target_page_ids)
      and cp.is_public = true
      and cp.slug is not null
      and trim(cp.slug) <> ''
  loop
    perform public.enqueue_revalidation('checklist', page_record.slug, 'checklist_items_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_universe(
      page_record.universe_id,
      'checklist_items_wiki_' || lower(tg_op)
    );
  end loop;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_checklist_items on public.checklist_items;
create trigger trg_enqueue_revalidation_checklist_items
after insert or update or delete on public.checklist_items
for each row execute function public.trg_enqueue_revalidation_checklist_items();

create or replace function public.trg_enqueue_revalidation_quiz_pages()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      perform public.enqueue_revalidation('quiz', old.code, 'quiz_pages_delete');
      perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'quiz_pages_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    perform public.enqueue_revalidation('quiz', new.code, 'quiz_pages_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_universe(new.universe_id, 'quiz_pages_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'quiz_pages_wiki_update_old');

    if old.code is distinct from new.code or new.is_published is distinct from true then
      perform public.enqueue_revalidation('quiz', old.code, 'quiz_pages_old_code_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_quiz_pages on public.quiz_pages;
create trigger trg_enqueue_revalidation_quiz_pages
after insert or update or delete on public.quiz_pages
for each row execute function public.trg_enqueue_revalidation_quiz_pages();

create or replace function public.trg_enqueue_revalidation_wiki_pages()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      perform public.enqueue_revalidation('wiki', old.slug, 'wiki_pages_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    perform public.enqueue_revalidation('wiki', new.slug, 'wiki_pages_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    if old.slug is distinct from new.slug or new.is_published is distinct from true then
      perform public.enqueue_revalidation('wiki', old.slug, 'wiki_pages_old_slug_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_wiki_pages on public.wiki_pages;
create trigger trg_enqueue_revalidation_wiki_pages
after insert or update or delete on public.wiki_pages
for each row execute function public.trg_enqueue_revalidation_wiki_pages();

create or replace function public.trg_enqueue_revalidation_wiki_catalog_pages()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  new_slug text;
  old_slug text;
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      old_slug := old.wiki_slug || '/' || old.collection_slug;
      perform public.enqueue_revalidation('wiki_catalog', old_slug, 'wiki_catalog_pages_delete');
      perform public.enqueue_revalidation('wiki', old.wiki_slug, 'wiki_catalog_pages_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    new_slug := new.wiki_slug || '/' || new.collection_slug;
    perform public.enqueue_revalidation('wiki_catalog', new_slug, 'wiki_catalog_pages_' || lower(tg_op));
    perform public.enqueue_revalidation('wiki', new.wiki_slug, 'wiki_catalog_pages_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('wiki', old.wiki_slug, 'wiki_catalog_pages_wiki_update_old');

    if old.wiki_slug is distinct from new.wiki_slug
      or old.collection_slug is distinct from new.collection_slug
      or new.is_published is distinct from true then
      old_slug := old.wiki_slug || '/' || old.collection_slug;
      perform public.enqueue_revalidation('wiki_catalog', old_slug, 'wiki_catalog_pages_old_slug_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_wiki_catalog_pages on public.wiki_catalog_pages;
create trigger trg_enqueue_revalidation_wiki_catalog_pages
after insert or update or delete on public.wiki_catalog_pages
for each row execute function public.trg_enqueue_revalidation_wiki_catalog_pages();
