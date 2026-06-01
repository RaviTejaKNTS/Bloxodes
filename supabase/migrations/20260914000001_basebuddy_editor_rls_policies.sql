do $$
declare
  read_table text;
  update_table text;
  read_tables text[] := array[
    'games',
    'articles',
    'tools',
    'catalog_pages',
    'wiki_pages',
    'wiki_catalog_pages',
    'events_pages',
    'quiz_pages',
    'checklist_pages',
    'authors',
    'roblox_universes'
  ];
  update_tables text[] := array[
    'games',
    'articles',
    'tools',
    'catalog_pages',
    'wiki_pages',
    'wiki_catalog_pages',
    'events_pages',
    'quiz_pages',
    'checklist_pages'
  ];
begin
  if not exists (select 1 from pg_roles where rolname = 'basebuddy_editor') then
    raise notice 'Skipping BaseBuddy editor RLS policies because role basebuddy_editor does not exist.';
    return;
  end if;

  foreach read_table in array read_tables loop
    if to_regclass(format('public.%I', read_table)) is not null
      and not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = read_table
          and policyname = 'basebuddy_editor_select'
      )
    then
      execute format(
        'create policy basebuddy_editor_select on public.%I for select to basebuddy_editor using (true)',
        read_table
      );
    end if;
  end loop;

  foreach update_table in array update_tables loop
    if to_regclass(format('public.%I', update_table)) is not null
      and not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = update_table
          and policyname = 'basebuddy_editor_update'
      )
    then
      execute format(
        'create policy basebuddy_editor_update on public.%I for update to basebuddy_editor using (true) with check (true)',
        update_table
      );
    end if;
  end loop;
end
$$;

do $$
declare
  dependency_table text;
  dependency_tables text[] := array[
    'game_lists',
    'game_list_entries'
  ];
begin
  if not exists (select 1 from pg_roles where rolname = 'basebuddy_editor') then
    raise notice 'Skipping BaseBuddy editor trigger support policies because role basebuddy_editor does not exist.';
    return;
  end if;

  if to_regclass('public.revalidation_events') is not null then
    grant select, insert, update on public.revalidation_events to basebuddy_editor;
    grant select (entity_type, slug) on public.revalidation_events to basebuddy_editor;
    grant insert (entity_type, slug, source) on public.revalidation_events to basebuddy_editor;
    grant update (created_at, source) on public.revalidation_events to basebuddy_editor;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'revalidation_events'
        and policyname = 'basebuddy_editor_select'
    )
    then
      create policy basebuddy_editor_select on public.revalidation_events
        for select to basebuddy_editor
        using (true);
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'revalidation_events'
        and policyname = 'basebuddy_editor_insert'
    )
    then
      create policy basebuddy_editor_insert on public.revalidation_events
        for insert to basebuddy_editor
        with check (true);
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'revalidation_events'
        and policyname = 'basebuddy_editor_update'
    )
    then
      create policy basebuddy_editor_update on public.revalidation_events
        for update to basebuddy_editor
        using (true)
        with check (true);
    end if;
  end if;

  if to_regclass('public.search_index') is not null then
    grant select, insert, update on public.search_index to basebuddy_editor;
    grant select (entity_type, entity_id) on public.search_index to basebuddy_editor;
    grant insert (
      entity_type,
      entity_id,
      slug,
      title,
      subtitle,
      url,
      updated_at,
      is_published,
      search_text
    ) on public.search_index to basebuddy_editor;
    grant update (
      slug,
      title,
      subtitle,
      url,
      updated_at,
      is_published,
      search_text
    ) on public.search_index to basebuddy_editor;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'search_index'
        and policyname = 'basebuddy_editor_select'
    )
    then
      create policy basebuddy_editor_select on public.search_index
        for select to basebuddy_editor
        using (true);
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'search_index'
        and policyname = 'basebuddy_editor_insert'
    )
    then
      create policy basebuddy_editor_insert on public.search_index
        for insert to basebuddy_editor
        with check (true);
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'search_index'
        and policyname = 'basebuddy_editor_update'
    )
    then
      create policy basebuddy_editor_update on public.search_index
        for update to basebuddy_editor
        using (true)
        with check (true);
    end if;
  end if;

  foreach dependency_table in array dependency_tables loop
    if to_regclass(format('public.%I', dependency_table)) is not null then
      execute format('grant select on public.%I to basebuddy_editor', dependency_table);

      if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = dependency_table
          and policyname = 'basebuddy_editor_select'
      )
      then
        execute format(
          'create policy basebuddy_editor_select on public.%I for select to basebuddy_editor using (true)',
          dependency_table
        );
      end if;
    end if;
  end loop;
end
$$;
