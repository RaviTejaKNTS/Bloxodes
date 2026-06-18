-- Rename the codes-page storage layer away from the overloaded `games` name.
-- Roblox game identity remains owned by `roblox_universes`; `/codes/<slug>`
-- page rows live in `code_pages`.

do $$
begin
  if to_regclass('public.games') is not null and to_regclass('public.code_pages') is null then
    alter table public.games rename to code_pages;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'codes' and column_name = 'game_id'
  ) then
    alter table public.codes rename column game_id to code_page_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'game_list_entries' and column_name = 'game_id'
  ) then
    alter table public.game_list_entries rename column game_id to code_page_id;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_constraint where conrelid = 'public.code_pages'::regclass and conname = 'games_pkey') then
    alter table public.code_pages rename constraint games_pkey to code_pages_pkey;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.code_pages'::regclass and conname = 'games_slug_key') then
    alter table public.code_pages rename constraint games_slug_key to code_pages_slug_key;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.code_pages'::regclass and conname = 'games_universe_id_fkey') then
    alter table public.code_pages rename constraint games_universe_id_fkey to code_pages_universe_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.codes'::regclass and conname = 'codes_game_id_code_key') then
    alter table public.codes rename constraint codes_game_id_code_key to codes_code_page_id_code_key;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.codes'::regclass and conname = 'codes_game_id_fkey') then
    alter table public.codes rename constraint codes_game_id_fkey to codes_code_page_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.game_list_entries'::regclass and conname = 'game_list_entries_game_id_fkey') then
    alter table public.game_list_entries rename constraint game_list_entries_game_id_fkey to game_list_entries_code_page_id_fkey;
  end if;
end $$;

alter index if exists public.idx_games_old_slugs rename to idx_code_pages_old_slugs;
alter index if exists public.idx_games_published rename to idx_code_pages_published;
alter index if exists public.idx_games_published_name rename to idx_code_pages_published_name;
alter index if exists public.idx_games_published_updated rename to idx_code_pages_published_updated;
alter index if exists public.idx_games_slug rename to idx_code_pages_slug;
alter index if exists public.idx_games_universe_id rename to idx_code_pages_universe_id;
alter index if exists public.idx_codes_game_code_upper rename to idx_codes_code_page_code_upper;
alter index if exists public.idx_codes_game_first_seen rename to idx_codes_code_page_first_seen;
alter index if exists public.idx_codes_game_status_seen rename to idx_codes_code_page_status_seen;
alter index if exists public.idx_codes_status_game rename to idx_codes_status_code_page;
alter index if exists public.idx_game_list_entries_game rename to idx_game_list_entries_code_page;

do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_games_updated_at' and tgrelid = 'public.code_pages'::regclass) then
    alter trigger trg_games_updated_at on public.code_pages rename to trg_code_pages_updated_at;
  end if;
  if exists (select 1 from pg_trigger where tgname = 'trg_enqueue_revalidation_games' and tgrelid = 'public.code_pages'::regclass) then
    alter trigger trg_enqueue_revalidation_games on public.code_pages rename to trg_enqueue_revalidation_code_pages;
  end if;
  if exists (select 1 from pg_trigger where tgname = 'trg_search_index_games' and tgrelid = 'public.code_pages'::regclass) then
    alter trigger trg_search_index_games on public.code_pages rename to trg_search_index_code_pages;
  end if;
  if exists (select 1 from pg_trigger where tgname = 'trg_set_game_published_at' and tgrelid = 'public.code_pages'::regclass) then
    alter trigger trg_set_game_published_at on public.code_pages rename to trg_set_code_page_published_at;
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.set_game_published_at()') is not null
     and to_regprocedure('public.set_code_page_published_at()') is null then
    alter function public.set_game_published_at() rename to set_code_page_published_at;
  end if;

  if to_regprocedure('public.trg_enqueue_revalidation_games()') is not null
     and to_regprocedure('public.trg_enqueue_revalidation_code_pages()') is null then
    alter function public.trg_enqueue_revalidation_games() rename to trg_enqueue_revalidation_code_pages;
  end if;

  if to_regprocedure('public.trg_search_index_games()') is not null
     and to_regprocedure('public.trg_search_index_code_pages()') is null then
    alter function public.trg_search_index_games() rename to trg_search_index_code_pages;
  end if;
end $$;

alter view if exists public.game_pages_index_view rename to code_pages_index_view;
alter view if exists public.game_code_stats rename to code_page_code_stats;

drop function if exists public.upsert_code(uuid, text, text, text, integer, boolean);
drop function if exists public.upsert_code(uuid, text, text, text, integer, boolean, integer);

create or replace function public.upsert_code(
  p_code_page_id uuid,
  p_code text,
  p_status text,
  p_rewards_text text,
  p_level_requirement integer,
  p_is_new boolean,
  p_provider_priority integer default 0
) returns void
language plpgsql
as $$
declare
  v_code text := trim(p_code);
  v_provider_priority integer := coalesce(p_provider_priority, 0);
begin
  if v_code is null or v_code = '' then
    return;
  end if;

  if exists (
    select 1
    from public.codes
    where code_page_id = p_code_page_id
      and upper(code) = upper(v_code)
      and provider_priority > v_provider_priority
  ) then
    update public.codes
    set last_seen_at = now()
    where code_page_id = p_code_page_id
      and upper(code) = upper(v_code)
      and provider_priority > v_provider_priority;
    return;
  end if;

  insert into public.codes (code_page_id, code, status, rewards_text, level_requirement, is_new, provider_priority)
  values (p_code_page_id, v_code, p_status, p_rewards_text, p_level_requirement, p_is_new, v_provider_priority)
  on conflict (code_page_id, code) do update
  set
    status = excluded.status,
    rewards_text = excluded.rewards_text,
    level_requirement = excluded.level_requirement,
    is_new = excluded.is_new,
    provider_priority = greatest(public.codes.provider_priority, excluded.provider_priority),
    last_seen_at = now(),
    first_seen_at = case
      when public.codes.status = 'expired' and excluded.status = 'active' then now()
      else public.codes.first_seen_at
    end;
end;
$$;

grant all on function public.upsert_code(uuid, text, text, text, integer, boolean, integer) to anon;
grant all on function public.upsert_code(uuid, text, text, text, integer, boolean, integer) to authenticated;
grant all on function public.upsert_code(uuid, text, text, text, integer, boolean, integer) to service_role;

create or replace function public.set_code_page_published_at() returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
begin
  if new.is_published = true
     and (old.is_published is distinct from true)
     and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.trg_enqueue_revalidation_code_pages() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      perform public.enqueue_revalidation('code', old.slug, 'code_pages_delete');
      perform public.enqueue_list_revalidation_for_universe(old.universe_id, 'code_pages_lists_delete');
      perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'code_pages_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    perform public.enqueue_revalidation('code', new.slug, 'code_pages_' || lower(tg_op));
    perform public.enqueue_list_revalidation_for_universe(new.universe_id, 'code_pages_lists_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_universe(new.universe_id, 'code_pages_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_list_revalidation_for_universe(old.universe_id, 'code_pages_lists_update_old');
    perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'code_pages_wiki_update_old');

    if old.slug is distinct from new.slug or new.is_published is distinct from true then
      perform public.enqueue_revalidation('code', old.slug, 'code_pages_old_slug_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.trg_enqueue_revalidation_codes() returns trigger
language plpgsql
as $$
declare
  target_code_page_ids uuid[];
  code_page_record record;
begin
  if tg_op = 'DELETE' then
    target_code_page_ids := array_remove(array[old.code_page_id], null);
  elsif tg_op = 'INSERT' then
    target_code_page_ids := array_remove(array[new.code_page_id], null);
  else
    target_code_page_ids := array_remove(array[old.code_page_id, new.code_page_id], null);
  end if;

  for code_page_record in
    select distinct cp.id, cp.slug, cp.universe_id
    from public.code_pages cp
    where cp.id = any(target_code_page_ids)
      and cp.is_published = true
      and cp.slug is not null
      and trim(cp.slug) <> ''
  loop
    perform public.enqueue_revalidation('code', code_page_record.slug, 'codes_' || lower(tg_op));
    perform public.enqueue_list_revalidation_for_universe(code_page_record.universe_id, 'codes_lists_' || lower(tg_op));
  end loop;

  return null;
end;
$$;

create or replace function public.trg_comments_revalidate_code() returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
begin
  if new.entity_type = 'code' and new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'code', cp.slug, 'comment'
    from public.code_pages cp
    where cp.id = new.entity_id
    on conflict (entity_type, slug)
    do update set
      source = excluded.source,
      created_at = now();
  end if;
  return new;
end;
$$;

create or replace function public.trg_comments_revalidate_entity() returns trigger
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
    select 'code', lower(cp.slug), 'comments_code_' || lower(tg_op)
    from public.code_pages cp
    where cp.id = target_entity_id
      and cp.is_published = true
      and cp.slug is not null
      and trim(cp.slug) <> ''
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
    select 'list', lower(l.slug), 'comments_list_' || lower(tg_op)
    from public.game_lists l
    where l.id = target_entity_id
      and l.is_published = true
      and l.slug is not null
      and trim(l.slug) <> ''
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

create or replace function public.trg_search_index_code_pages() returns trigger
language plpgsql
as $$
declare
  v_search text;
begin
  if tg_op = 'DELETE' then
    delete from public.search_index
    where entity_type = 'code'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.name,
      new.slug,
      array_to_string(new.old_slugs, ' '),
      new.seo_title,
      new.seo_description,
      new.intro_md,
      new.redeem_md,
      new.rewards_md,
      new.troubleshoot_md,
      new.find_codes_md
    ),
    4000
  );

  perform public.upsert_search_index(
    'code',
    new.id::text,
    new.slug,
    new.name,
    'Codes',
    '/codes/' || new.slug,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;

drop function if exists public.run_game_list_sql(text, integer);
create or replace function public.run_game_list_sql(sql_text text, limit_count integer default null)
returns table(
  universe_id bigint,
  rank integer,
  metric_value numeric,
  reason text,
  extra jsonb,
  code_page_id uuid,
  playing bigint,
  visits bigint,
  favorites bigint,
  likes bigint,
  dislikes bigint
)
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
declare
  trimmed text;
  capped_limit int;
begin
  if sql_text is null or length(trim(sql_text)) = 0 then
    raise exception 'sql_text is required';
  end if;

  trimmed := ltrim(sql_text);
  if lower(left(trimmed, 6)) <> 'select' then
    raise exception 'sql_text must start with SELECT';
  end if;

  capped_limit := nullif(limit_count, 0);

  return query execute format(
    'select * from (%s) as src(universe_id, rank, metric_value, reason, extra, code_page_id, playing, visits, favorites, likes, dislikes) %s',
    sql_text,
    case
      when capped_limit is null then ''
      else format('limit %s', capped_limit)
    end
  );
end;
$$;

create or replace view public.code_pages_view with (security_invoker = true) as
with code_stats as (
  select
    c.code_page_id,
    jsonb_agg(c.* order by c.status, c.last_seen_at desc) filter (where c.id is not null) as codes,
    count(*) filter (where c.status = 'active') as active_code_count,
    max(c.first_seen_at) filter (where c.status = 'active') as latest_code_first_seen_at
  from public.codes c
  group by c.code_page_id
)
select
  cp.id,
  cp.name,
  cp.slug,
  cp.old_slugs,
  cp.roblox_link,
  cp.universe_id,
  cp.community_link,
  cp.discord_link,
  cp.twitter_link,
  cp.youtube_link,
  cp.expired_codes,
  cp.cover_image,
  cp.seo_title,
  cp.seo_description,
  cp.intro_md,
  cp.redeem_md,
  cp.find_codes_md,
  cp.troubleshoot_md,
  cp.rewards_md,
  cp.internal_links,
  cp.is_published,
  cp.re_rewritten_at,
  cp.created_at,
  cp.updated_at,
  u.genre_l1,
  u.genre_l2,
  coalesce(cs.codes, '[]'::jsonb) as codes,
  coalesce(cs.active_code_count, 0::bigint) as active_code_count,
  cs.latest_code_first_seen_at,
  greatest(coalesce(cs.latest_code_first_seen_at, cp.updated_at), cp.updated_at) as content_updated_at,
  case
    when u.universe_id is null then null::jsonb
    else jsonb_build_object(
      'universe_id', u.universe_id,
      'slug', u.slug,
      'display_name', u.display_name,
      'name', u.name,
      'creator_name', u.creator_name,
      'creator_id', u.creator_id,
      'creator_type', u.creator_type,
      'social_links', u.social_links,
      'icon_url', u.icon_url,
      'genre_l1', u.genre_l1,
      'genre_l2', u.genre_l2,
      'playing', u.playing,
      'visits', u.visits,
      'favorites', u.favorites,
      'likes', u.likes,
      'dislikes', u.dislikes,
      'age_rating', u.age_rating,
      'desktop_enabled', u.desktop_enabled,
      'mobile_enabled', u.mobile_enabled,
      'tablet_enabled', u.tablet_enabled,
      'console_enabled', u.console_enabled,
      'vr_enabled', u.vr_enabled,
      'updated_at', u.updated_at,
      'description', u.description,
      'game_description_md', u.game_description_md
    )
  end as universe,
  (
    select coalesce(jsonb_agg(rec.* order by rec.active_code_count desc, rec.updated_at desc), '[]'::jsonb)
    from (
      select
        cp2.id,
        cp2.name,
        cp2.slug,
        cp2.cover_image,
        coalesce(cs2.active_code_count, 0::bigint) as active_code_count,
        greatest(coalesce(cs2.latest_code_first_seen_at, cp2.updated_at), cp2.updated_at) as content_updated_at,
        cp2.updated_at,
        u2.genre_l1,
        u2.genre_l2
      from public.code_pages cp2
      left join code_stats cs2 on cs2.code_page_id = cp2.id
      left join public.roblox_universes u2 on u2.universe_id = cp2.universe_id
      where cp2.is_published = true
        and cp2.id <> cp.id
      order by coalesce(cs2.active_code_count, 0::bigint) desc, cp2.updated_at desc
      limit 6
    ) rec
  ) as recommended_games,
  cp.interlinking_ai_copy_md
from public.code_pages cp
left join code_stats cs on cs.code_page_id = cp.id
left join public.roblox_universes u on u.universe_id = cp.universe_id;

create or replace view public.code_page_code_stats with (security_invoker = true) as
select
  cp.id,
  cp.name,
  cp.slug,
  cp.cover_image,
  cp.created_at,
  cp.updated_at,
  coalesce(stats.active_count, 0::bigint) as active_count,
  stats.latest_code_first_seen_at,
  case
    when stats.latest_code_first_seen_at is not null and stats.latest_code_first_seen_at > cp.updated_at then stats.latest_code_first_seen_at
    else cp.updated_at
  end as content_updated_at
from public.code_pages cp
left join lateral (
  select
    count(*) filter (where c.status = 'active') as active_count,
    max(c.first_seen_at) filter (where c.status = 'active') as latest_code_first_seen_at
  from public.codes c
  where c.code_page_id = cp.id
) stats on true
where cp.is_published = true;

create or replace view public.code_pages_index_view with (security_invoker = true) as
select
  cp.id,
  cp.slug,
  cp.name,
  cp.is_published,
  cp.cover_image,
  cp.updated_at,
  cp.created_at,
  cp.universe_id,
  cp.internal_links,
  coalesce(cs.active_code_count, 0::bigint) as active_code_count,
  cs.latest_code_first_seen_at,
  greatest(coalesce(cs.latest_code_first_seen_at, cp.updated_at), cp.updated_at) as content_updated_at,
  u.genre_l1,
  u.genre_l2
from public.code_pages cp
left join (
  select
    codes.code_page_id,
    count(*) filter (where codes.status = 'active') as active_code_count,
    max(codes.first_seen_at) filter (where codes.status = 'active') as latest_code_first_seen_at
  from public.codes
  group by codes.code_page_id
) cs on cs.code_page_id = cp.id
left join public.roblox_universes u on u.universe_id = cp.universe_id
where cp.is_published is not null;

create or replace view public.game_lists_index_view with (security_invoker = true) as
select
  id,
  slug,
  title,
  display_name,
  cover_image,
  limit_count,
  refreshed_at,
  updated_at,
  created_at,
  is_published,
  coalesce((
    select coalesce(cp3.cover_image, u3.icon_url)
    from public.game_list_entries gle3
    left join public.code_pages cp3 on cp3.id = gle3.code_page_id
    left join public.roblox_universes u3 on u3.universe_id = gle3.universe_id
    where gle3.list_id = l.id
    order by gle3.rank
    limit 1
  ), null::text) as top_entry_image
from public.game_lists l
where is_published = true;

create or replace view public.game_lists_view with (security_invoker = true) as
with code_stats as (
  select
    c.code_page_id,
    count(*) filter (where c.status = 'active') as active_code_count,
    max(c.first_seen_at) filter (where c.status = 'active') as latest_code_first_seen_at
  from public.codes c
  group by c.code_page_id
)
select
  l.id,
  l.slug,
  l.title,
  l.hero_md,
  l.intro_md,
  l.outro_md,
  l.meta_title,
  l.meta_description,
  l.cover_image,
  l.list_type,
  l.filter_config,
  l.limit_count,
  l.is_published,
  l.refreshed_at,
  l.created_at,
  l.updated_at,
  l.display_name,
  l.primary_metric_key,
  l.primary_metric_label,
  coalesce(jsonb_agg(jsonb_build_object(
    'universe_id', e.universe_id,
    'list_id', e.list_id,
    'rank', e.rank,
    'metric_value', e.metric_value,
    'reason', e.reason,
    'extra', e.extra,
    'code_page_id', e.code_page_id,
    'game',
      case
        when cp.id is null then null::jsonb
        else jsonb_build_object(
          'id', cp.id,
          'name', cp.name,
          'slug', cp.slug,
          'cover_image', cp.cover_image,
          'universe_id', cp.universe_id,
          'active_count', coalesce(cs.active_code_count, 0::bigint),
          'active_code_count', coalesce(cs.active_code_count, 0::bigint),
          'content_updated_at', greatest(coalesce(cs.latest_code_first_seen_at, cp.updated_at), cp.updated_at)
        )
      end,
    'universe',
      case
        when u.universe_id is null then null::jsonb
        else jsonb_build_object(
          'universe_id', u.universe_id,
          'slug', u.slug,
          'display_name', u.display_name,
          'name', u.name,
          'icon_url', u.icon_url,
          'playing', u.playing,
          'visits', u.visits,
          'favorites', u.favorites,
          'likes', u.likes,
          'dislikes', u.dislikes,
          'age_rating', u.age_rating,
          'desktop_enabled', u.desktop_enabled,
          'mobile_enabled', u.mobile_enabled,
          'tablet_enabled', u.tablet_enabled,
          'console_enabled', u.console_enabled,
          'vr_enabled', u.vr_enabled,
          'updated_at', u.updated_at,
          'description', coalesce(u.game_description_md, u.description),
          'game_description_md', u.game_description_md
        )
      end,
    'badges', (
      select coalesce(jsonb_agg(rec.* order by rec.rank), '[]'::jsonb)
      from (
        select
          gle2.list_id,
          gl2.slug as list_slug,
          gl2.title as list_title,
          gl2.display_name as list_display_name,
          gle2.rank
        from public.game_list_entries gle2
        join public.game_lists gl2 on gl2.id = gle2.list_id and gl2.is_published = true
        where gle2.universe_id = e.universe_id
          and gl2.id <> l.id
          and gle2.rank between 1 and 3
        order by gle2.rank
        limit 3
      ) rec
    )
  ) order by e.rank) filter (where e.universe_id is not null), '[]'::jsonb) as entries,
  (
    select coalesce(jsonb_agg(rec.* order by rec.updated_at desc), '[]'::jsonb)
    from (
      select
        l2.id,
        l2.slug,
        l2.title,
        l2.display_name,
        l2.updated_at
      from public.game_lists l2
      where l2.is_published = true
        and l2.id <> l.id
      order by l2.updated_at desc
      limit 6
    ) rec
  ) as other_lists
from public.game_lists l
left join public.game_list_entries e on e.list_id = l.id
left join public.roblox_universes u on u.universe_id = e.universe_id
left join public.code_pages cp on cp.id = e.code_page_id
left join code_stats cs on cs.code_page_id = cp.id
group by l.id;

create or replace function public.search_site(p_query text, p_limit integer default 120, p_offset integer default 0)
returns table(
  entity_type text,
  entity_id text,
  slug text,
  title text,
  subtitle text,
  url text,
  updated_at timestamp with time zone,
  active_code_count bigint
)
language plpgsql stable
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_query text := trim(coalesce(p_query, ''));
  v_limit integer := greatest(1, least(coalesce(p_limit, 120), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  if v_query = '' then
    return;
  end if;

  return query
  with q as (
    select websearch_to_tsquery('english', v_query) as tsq
  )
  select
    si.entity_type,
    si.entity_id,
    si.slug,
    si.title,
    si.subtitle,
    si.url,
    coalesce(cp.content_updated_at, si.updated_at) as updated_at,
    case when si.entity_type = 'code' then cp.active_code_count else null end as active_code_count
  from public.search_index si
  cross join q
  left join public.code_pages_index_view cp
    on si.entity_type = 'code'
    and cp.id::text = si.entity_id
  where si.is_published = true
    and (
      si.search_vector @@ q.tsq
      or si.search_text ilike '%' || v_query || '%'
    )
  order by
    greatest(
      ts_rank_cd(si.search_vector, q.tsq),
      extensions.similarity(si.search_text, v_query)
    ) desc,
    updated_at desc nulls last
  limit v_limit
  offset v_offset;
end;
$$;

drop trigger if exists trg_code_pages_updated_at on public.code_pages;
create trigger trg_code_pages_updated_at
before update on public.code_pages
for each row execute function public.set_updated_at();

drop trigger if exists trg_enqueue_revalidation_code_pages on public.code_pages;
create trigger trg_enqueue_revalidation_code_pages
after insert or update or delete on public.code_pages
for each row execute function public.trg_enqueue_revalidation_code_pages();

drop trigger if exists trg_search_index_code_pages on public.code_pages;
create trigger trg_search_index_code_pages
after insert or update or delete on public.code_pages
for each row execute function public.trg_search_index_code_pages();

drop trigger if exists trg_set_code_page_published_at on public.code_pages;
create trigger trg_set_code_page_published_at
before insert or update on public.code_pages
for each row execute function public.set_code_page_published_at();

grant all on function public.set_code_page_published_at() to anon;
grant all on function public.set_code_page_published_at() to authenticated;
grant all on function public.set_code_page_published_at() to service_role;
grant all on function public.trg_enqueue_revalidation_code_pages() to anon;
grant all on function public.trg_enqueue_revalidation_code_pages() to authenticated;
grant all on function public.trg_enqueue_revalidation_code_pages() to service_role;
grant all on function public.trg_search_index_code_pages() to anon;
grant all on function public.trg_search_index_code_pages() to authenticated;
grant all on function public.trg_search_index_code_pages() to service_role;
grant all on function public.run_game_list_sql(text, integer) to anon;
grant all on function public.run_game_list_sql(text, integer) to authenticated;
grant all on function public.run_game_list_sql(text, integer) to service_role;
grant all on table public.code_pages to anon;
grant all on table public.code_pages to authenticated;
grant all on table public.code_pages to service_role;
grant all on table public.code_pages_view to anon;
grant all on table public.code_pages_view to authenticated;
grant all on table public.code_pages_view to service_role;
grant all on table public.code_pages_index_view to anon;
grant all on table public.code_pages_index_view to authenticated;
grant all on table public.code_pages_index_view to service_role;
grant all on table public.code_page_code_stats to anon;
grant all on table public.code_page_code_stats to authenticated;
grant all on table public.code_page_code_stats to service_role;
