-- Tighten revalidation coverage for pages whose rendered data comes from related tables.

create or replace function public.revalidation_slugify(p_value text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      trim(regexp_replace(lower(replace(coalesce(p_value, ''), '&', 'and')), '[^a-z0-9]+', ' ', 'g')),
      '[[:space:]]+',
      '-',
      'g'
    ),
    ''
  );
$$;

create or replace function public.enqueue_author_revalidation_for_author_id(
  p_author_id uuid,
  p_source text
)
returns void
language plpgsql
as $$
begin
  if p_author_id is null then
    return;
  end if;

  insert into public.revalidation_events (entity_type, slug, source)
  select distinct 'author', lower(a.slug), p_source
  from public.authors a
  where a.id = p_author_id
    and a.slug is not null
    and trim(a.slug) <> ''
  on conflict (entity_type, slug)
  do update set
    created_at = now(),
    source = excluded.source;
end;
$$;

create or replace function public.enqueue_list_revalidation_for_universe(
  p_universe_id bigint,
  p_source text
)
returns void
language plpgsql
as $$
begin
  if p_universe_id is null then
    return;
  end if;

  insert into public.revalidation_events (entity_type, slug, source)
  select distinct 'list', lower(gl.slug), p_source
  from public.game_lists gl
  join public.game_list_entries gle on gle.list_id = gl.id
  where gle.universe_id = p_universe_id
    and gl.is_published = true
    and gl.slug is not null
    and trim(gl.slug) <> ''
  on conflict (entity_type, slug)
  do update set
    created_at = now(),
    source = excluded.source;
end;
$$;

create or replace function public.enqueue_wiki_revalidation_for_list(
  p_list_id uuid,
  p_source text
)
returns void
language plpgsql
as $$
declare
  target_universe_id bigint;
begin
  if p_list_id is null then
    return;
  end if;

  for target_universe_id in
    select distinct gle.universe_id
    from public.game_list_entries gle
    where gle.list_id = p_list_id
      and gle.rank between 1 and 3
      and gle.universe_id is not null
  loop
    perform public.enqueue_wiki_revalidation_for_universe(target_universe_id, p_source);
  end loop;
end;
$$;

create or replace function public.trg_enqueue_revalidation_games()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      perform public.enqueue_revalidation('code', old.slug, 'games_delete');
      perform public.enqueue_list_revalidation_for_universe(old.universe_id, 'games_lists_delete');
      perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'games_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    perform public.enqueue_revalidation('code', new.slug, 'games_' || lower(tg_op));
    perform public.enqueue_list_revalidation_for_universe(new.universe_id, 'games_lists_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_universe(new.universe_id, 'games_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_list_revalidation_for_universe(old.universe_id, 'games_lists_update_old');
    perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'games_wiki_update_old');

    if old.slug is distinct from new.slug or new.is_published is distinct from true then
      perform public.enqueue_revalidation('code', old.slug, 'games_old_slug_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_games on public.games;
create trigger trg_enqueue_revalidation_games
after insert or update or delete on public.games
for each row execute function public.trg_enqueue_revalidation_games();

create or replace function public.trg_enqueue_revalidation_articles()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      perform public.enqueue_revalidation('article', old.slug, 'articles_delete');
      perform public.enqueue_author_revalidation_for_author_id(old.author_id, 'articles_author_delete');
      perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'articles_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    perform public.enqueue_revalidation('article', new.slug, 'articles_' || lower(tg_op));
    perform public.enqueue_author_revalidation_for_author_id(new.author_id, 'articles_author_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_universe(new.universe_id, 'articles_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_author_revalidation_for_author_id(old.author_id, 'articles_author_update_old');
    perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'articles_wiki_update_old');

    if old.slug is distinct from new.slug or new.is_published is distinct from true then
      perform public.enqueue_revalidation('article', old.slug, 'articles_old_slug_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_articles on public.articles;
create trigger trg_enqueue_revalidation_articles
after insert or update or delete on public.articles
for each row execute function public.trg_enqueue_revalidation_articles();

create or replace function public.trg_enqueue_revalidation_codes()
returns trigger
language plpgsql
as $$
declare
  target_game_ids uuid[];
  game_record record;
begin
  if tg_op = 'DELETE' then
    target_game_ids := array_remove(array[old.game_id], null);
  elsif tg_op = 'INSERT' then
    target_game_ids := array_remove(array[new.game_id], null);
  else
    target_game_ids := array_remove(array[old.game_id, new.game_id], null);
  end if;

  for game_record in
    select distinct g.id, g.slug, g.universe_id
    from public.games g
    where g.id = any(target_game_ids)
      and g.is_published = true
      and g.slug is not null
      and trim(g.slug) <> ''
  loop
    perform public.enqueue_revalidation('code', game_record.slug, 'codes_' || lower(tg_op));
    perform public.enqueue_list_revalidation_for_universe(game_record.universe_id, 'codes_lists_' || lower(tg_op));
  end loop;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_codes on public.codes;
create trigger trg_enqueue_revalidation_codes
after insert or update or delete on public.codes
for each row execute function public.trg_enqueue_revalidation_codes();

create or replace function public.trg_enqueue_revalidation_game_lists()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      perform public.enqueue_revalidation('list', old.slug, 'game_lists_delete');
      perform public.enqueue_wiki_revalidation_for_list(old.id, 'game_lists_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    perform public.enqueue_revalidation('list', new.slug, 'game_lists_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_list(new.id, 'game_lists_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_wiki_revalidation_for_list(old.id, 'game_lists_wiki_update_old');

    if old.slug is distinct from new.slug or new.is_published is distinct from true then
      perform public.enqueue_revalidation('list', old.slug, 'game_lists_old_slug_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_game_lists on public.game_lists;
create trigger trg_enqueue_revalidation_game_lists
after insert or update or delete on public.game_lists
for each row execute function public.trg_enqueue_revalidation_game_lists();

create or replace function public.trg_enqueue_revalidation_game_list_entries()
returns trigger
language plpgsql
as $$
declare
  target_list_ids uuid[];
  list_slug text;
begin
  if tg_op = 'DELETE' then
    target_list_ids := array_remove(array[old.list_id], null);
    perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'game_list_entries_wiki_delete');
  elsif tg_op = 'INSERT' then
    target_list_ids := array_remove(array[new.list_id], null);
    perform public.enqueue_wiki_revalidation_for_universe(new.universe_id, 'game_list_entries_wiki_insert');
  else
    target_list_ids := array_remove(array[old.list_id, new.list_id], null);
    perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'game_list_entries_wiki_update_old');
    perform public.enqueue_wiki_revalidation_for_universe(new.universe_id, 'game_list_entries_wiki_update');
  end if;

  for list_slug in
    select distinct gl.slug
    from public.game_lists gl
    where gl.id = any(target_list_ids)
      and gl.is_published = true
      and gl.slug is not null
      and trim(gl.slug) <> ''
  loop
    perform public.enqueue_revalidation('list', list_slug, 'game_list_entries_' || lower(tg_op));
  end loop;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_game_list_entries on public.game_list_entries;
create trigger trg_enqueue_revalidation_game_list_entries
after insert or update or delete on public.game_list_entries
for each row execute function public.trg_enqueue_revalidation_game_list_entries();

create or replace function public.trg_enqueue_revalidation_lists_roblox_universe()
returns trigger
language plpgsql
as $$
begin
  perform public.enqueue_list_revalidation_for_universe(new.universe_id, 'roblox_universes_lists_update');
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_lists_roblox_universes on public.roblox_universes;
create trigger trg_enqueue_revalidation_lists_roblox_universes
after update of
  root_place_id,
  name,
  display_name,
  slug,
  description,
  game_description_md,
  age_rating,
  desktop_enabled,
  mobile_enabled,
  tablet_enabled,
  console_enabled,
  vr_enabled,
  playing,
  visits,
  favorites,
  likes,
  dislikes,
  icon_url,
  updated_at,
  updated_at_api
on public.roblox_universes
for each row execute function public.trg_enqueue_revalidation_lists_roblox_universe();

create or replace function public.enqueue_free_items_catalog_scope(
  p_category text,
  p_subcategory text,
  p_source text
)
returns void
language plpgsql
as $$
declare
  category_slug text := public.revalidation_slugify(p_category);
  subcategory_slug text := public.revalidation_slugify(p_subcategory);
begin
  if category_slug is null then
    return;
  end if;

  perform public.enqueue_revalidation('catalog', 'free-roblox-items/' || category_slug, p_source);

  if subcategory_slug is not null then
    perform public.enqueue_revalidation(
      'catalog',
      'free-roblox-items/' || category_slug || '/' || subcategory_slug,
      p_source
    );
  end if;
end;
$$;

create or replace function public.trg_enqueue_revalidation_free_items_catalog()
returns trigger
language plpgsql
as $$
declare
  old_qualifies boolean := false;
  new_qualifies boolean := false;
begin
  if tg_op <> 'INSERT' then
    old_qualifies := public.qualifies_for_free_items_catalog(
      old.price_robux,
      old.is_deleted,
      old.raw_economy_json,
      old.has_resellers,
      old.lowest_resale_price_robux,
      old.name,
      old.category,
      old.subcategory,
      old.favorite_count
    );
  end if;

  if tg_op <> 'DELETE' then
    new_qualifies := public.qualifies_for_free_items_catalog(
      new.price_robux,
      new.is_deleted,
      new.raw_economy_json,
      new.has_resellers,
      new.lowest_resale_price_robux,
      new.name,
      new.category,
      new.subcategory,
      new.favorite_count
    );
  end if;

  if old_qualifies or new_qualifies then
    perform public.enqueue_revalidation('catalog', 'free-roblox-items', 'roblox_catalog_items_' || lower(tg_op));
  end if;

  if old_qualifies then
    perform public.enqueue_free_items_catalog_scope(
      old.category,
      old.subcategory,
      'roblox_catalog_items_scope_old_' || lower(tg_op)
    );
  end if;

  if new_qualifies then
    perform public.enqueue_free_items_catalog_scope(
      new.category,
      new.subcategory,
      'roblox_catalog_items_scope_' || lower(tg_op)
    );
  end if;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_free_items_catalog on public.roblox_catalog_items;
create trigger trg_enqueue_revalidation_free_items_catalog
after insert or update or delete on public.roblox_catalog_items
for each row execute function public.trg_enqueue_revalidation_free_items_catalog();

create or replace function public.trg_enqueue_revalidation_free_item_images()
returns trigger
language plpgsql
as $$
declare
  target_asset_id bigint;
  item_record record;
begin
  if tg_op = 'DELETE' then
    target_asset_id := old.asset_id;
  else
    target_asset_id := new.asset_id;
  end if;

  if target_asset_id is null then
    return null;
  end if;

  select *
  into item_record
  from public.roblox_catalog_items item
  where item.asset_id = target_asset_id;

  if not found then
    return null;
  end if;

  if public.qualifies_for_free_items_catalog(
    item_record.price_robux,
    item_record.is_deleted,
    item_record.raw_economy_json,
    item_record.has_resellers,
    item_record.lowest_resale_price_robux,
    item_record.name,
    item_record.category,
    item_record.subcategory,
    item_record.favorite_count
  ) then
    perform public.enqueue_revalidation('catalog', 'free-roblox-items', 'roblox_catalog_item_images_' || lower(tg_op));
    perform public.enqueue_free_items_catalog_scope(
      item_record.category,
      item_record.subcategory,
      'roblox_catalog_item_images_scope_' || lower(tg_op)
    );
  end if;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_free_item_images on public.roblox_catalog_item_images;
create trigger trg_enqueue_revalidation_free_item_images
after insert or update or delete on public.roblox_catalog_item_images
for each row execute function public.trg_enqueue_revalidation_free_item_images();

create or replace function public.enqueue_music_revalidation_scope(
  p_section text,
  p_value text,
  p_source text
)
returns void
language plpgsql
as $$
declare
  value_slug text := public.revalidation_slugify(p_value);
begin
  if value_slug is null then
    return;
  end if;

  if p_section = 'genres' then
    perform public.enqueue_revalidation('music', 'roblox-music-ids/genres/' || value_slug, p_source);
  elsif p_section = 'artists' then
    perform public.enqueue_revalidation('music', 'roblox-music-ids/artists/' || value_slug, p_source);
  end if;
end;
$$;

create or replace function public.trg_enqueue_revalidation_music_ids()
returns trigger
language plpgsql
as $$
begin
  perform public.enqueue_revalidation('music', 'roblox-music-ids', 'roblox_music_ids_' || lower(tg_op));

  if tg_op <> 'INSERT' then
    perform public.enqueue_music_revalidation_scope('genres', old.genre, 'roblox_music_ids_genre_old_' || lower(tg_op));
    perform public.enqueue_music_revalidation_scope('artists', old.artist, 'roblox_music_ids_artist_old_' || lower(tg_op));
  end if;

  if tg_op <> 'DELETE' then
    perform public.enqueue_music_revalidation_scope('genres', new.genre, 'roblox_music_ids_genre_' || lower(tg_op));
    perform public.enqueue_music_revalidation_scope('artists', new.artist, 'roblox_music_ids_artist_' || lower(tg_op));
  end if;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_music_ids on public.roblox_music_ids;
create trigger trg_enqueue_revalidation_music_ids
after insert or update or delete on public.roblox_music_ids
for each row execute function public.trg_enqueue_revalidation_music_ids();

create or replace function public.trg_comments_revalidate_entity()
returns trigger
language plpgsql
as $$
declare
  target_entity_type text;
  target_entity_id uuid;
  should_revalidate boolean := false;
begin
  if tg_op = 'DELETE' then
    target_entity_type := old.entity_type;
    target_entity_id := old.entity_id;
    should_revalidate := old.status = 'approved';
  elsif tg_op = 'INSERT' then
    target_entity_type := new.entity_type;
    target_entity_id := new.entity_id;
    should_revalidate := new.status = 'approved';
  else
    target_entity_type := new.entity_type;
    target_entity_id := new.entity_id;
    should_revalidate :=
      old.status = 'approved'
      or new.status = 'approved'
      or old.body_md is distinct from new.body_md
      or old.entity_type is distinct from new.entity_type
      or old.entity_id is distinct from new.entity_id;
  end if;

  if not should_revalidate or target_entity_id is null then
    return null;
  end if;

  if target_entity_type = 'code' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'code', lower(g.slug), 'comments_code_' || lower(tg_op)
    from public.games g
    where g.id = target_entity_id
      and g.is_published = true
      and g.slug is not null
      and trim(g.slug) <> ''
    on conflict (entity_type, slug)
    do update set created_at = now(), source = excluded.source;
  elsif target_entity_type = 'article' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'article', lower(a.slug), 'comments_article_' || lower(tg_op)
    from public.articles a
    where a.id = target_entity_id
      and a.is_published = true
      and a.slug is not null
      and trim(a.slug) <> ''
    on conflict (entity_type, slug)
    do update set created_at = now(), source = excluded.source;
  elsif target_entity_type = 'catalog' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'catalog', lower(c.code), 'comments_catalog_' || lower(tg_op)
    from public.catalog_pages c
    where c.id = target_entity_id
      and c.is_published = true
      and c.code is not null
      and trim(c.code) <> ''
    on conflict (entity_type, slug)
    do update set created_at = now(), source = excluded.source;
  elsif target_entity_type = 'event' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'event', lower(e.slug), 'comments_event_' || lower(tg_op)
    from public.events_pages e
    where e.id = target_entity_id
      and e.is_published = true
      and e.slug is not null
      and trim(e.slug) <> ''
    on conflict (entity_type, slug)
    do update set created_at = now(), source = excluded.source;
  elsif target_entity_type = 'list' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'list', lower(gl.slug), 'comments_list_' || lower(tg_op)
    from public.game_lists gl
    where gl.id = target_entity_id
      and gl.is_published = true
      and gl.slug is not null
      and trim(gl.slug) <> ''
    on conflict (entity_type, slug)
    do update set created_at = now(), source = excluded.source;
  elsif target_entity_type = 'tool' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'tool', lower(t.code), 'comments_tool_' || lower(tg_op)
    from public.tools t
    where t.id = target_entity_id
      and t.is_published = true
      and t.code is not null
      and trim(t.code) <> ''
    on conflict (entity_type, slug)
    do update set created_at = now(), source = excluded.source;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_comments_revalidate_code on public.comments;
drop trigger if exists trg_comments_revalidate_entity on public.comments;
create trigger trg_comments_revalidate_entity
after insert or update or delete on public.comments
for each row execute function public.trg_comments_revalidate_entity();
