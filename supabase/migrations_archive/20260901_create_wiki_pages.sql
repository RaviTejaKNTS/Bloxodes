-- Wiki pages are game-level hubs that connect editorial controls to Roblox universe data.

create table if not exists public.wiki_pages (
  id uuid primary key default uuid_generate_v4(),
  slug text not null,
  title text not null,
  seo_title text,
  meta_description text,
  universe_id bigint references public.roblox_universes(universe_id) on delete set null,
  controls_json jsonb not null default '[]'::jsonb,
  tips_md text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wiki_pages_slug_not_empty check (length(trim(slug)) > 0)
);

create unique index if not exists idx_wiki_pages_slug_lower on public.wiki_pages (lower(slug));
create index if not exists idx_wiki_pages_universe_id on public.wiki_pages (universe_id);
create index if not exists idx_wiki_pages_published on public.wiki_pages (is_published, published_at desc nulls last, updated_at desc);

drop trigger if exists trg_wiki_pages_updated_at on public.wiki_pages;
create trigger trg_wiki_pages_updated_at
before update on public.wiki_pages
for each row execute function public.set_updated_at();

create or replace function public.set_wiki_page_published_at() returns trigger as $$
begin
  if new.is_published = true and new.published_at is null then
    if tg_op = 'INSERT' then
      new.published_at := now();
    elsif old.is_published is distinct from true then
      new.published_at := now();
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_wiki_page_published_at on public.wiki_pages;
create trigger trg_set_wiki_page_published_at
before insert or update on public.wiki_pages
for each row execute function public.set_wiki_page_published_at();

drop view if exists public.wiki_pages_view;
create or replace view public.wiki_pages_view as
select
  wp.*,
  greatest(wp.updated_at, coalesce(wp.published_at, wp.updated_at)) as content_updated_at,
  u.root_place_id as universe_root_place_id,
  u.name as universe_name,
  u.display_name as universe_display_name,
  u.slug as universe_slug,
  u.description as universe_description,
  u.game_description_md as universe_game_description_md,
  u.creator_id as universe_creator_id,
  u.creator_name as universe_creator_name,
  u.creator_type as universe_creator_type,
  u.creator_has_verified_badge as universe_creator_has_verified_badge,
  u.group_id as universe_group_id,
  u.group_name as universe_group_name,
  u.group_has_verified_badge as universe_group_has_verified_badge,
  u.genre as universe_genre,
  u.genre_l1 as universe_genre_l1,
  u.genre_l2 as universe_genre_l2,
  u.age_rating as universe_age_rating,
  u.universe_avatar_type,
  u.desktop_enabled,
  u.mobile_enabled,
  u.tablet_enabled,
  u.console_enabled,
  u.vr_enabled,
  u.voice_chat_enabled,
  u.price,
  u.private_server_price_robux,
  u.create_vip_servers_allowed,
  u.max_players,
  u.server_size,
  u.playing,
  u.visits,
  u.favorites,
  u.likes,
  u.dislikes,
  u.icon_url,
  u.thumbnail_urls,
  u.social_links,
  u.created_at_api,
  u.updated_at_api,
  u.updated_at as universe_updated_at
from public.wiki_pages wp
left join public.roblox_universes u on u.universe_id = wp.universe_id;

alter view if exists public.wiki_pages_view set (security_invoker = true);

-- Revalidation coverage for wiki pages.
alter table public.revalidation_events
  drop constraint if exists revalidation_events_entity_type_check;

alter table public.revalidation_events
  add constraint revalidation_events_entity_type_check
  check (entity_type in ('code','article','list','author','event','checklist','tool','catalog','music','quiz','wiki'));

create or replace function public.trg_enqueue_revalidation_wiki_pages()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('wiki', old.slug, 'wiki_pages_delete');
  elsif new.is_published = true then
    perform public.enqueue_revalidation('wiki', new.slug, 'wiki_pages_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('wiki', old.slug, 'wiki_pages_unpublish');
  end if;
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_wiki_pages on public.wiki_pages;
create trigger trg_enqueue_revalidation_wiki_pages
after insert or update or delete on public.wiki_pages
for each row execute function public.trg_enqueue_revalidation_wiki_pages();

-- Search index coverage for wiki pages.
create or replace function public.trg_search_index_wiki_pages()
returns trigger
language plpgsql
as $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'wiki'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.title,
      new.slug,
      new.seo_title,
      new.meta_description,
      new.tips_md
    ),
    3000
  );

  perform public.upsert_search_index(
    'wiki',
    new.id::text,
    new.slug,
    new.title,
    'Wiki',
    '/wiki/' || new.slug,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;

drop trigger if exists trg_search_index_wiki_pages on public.wiki_pages;
create trigger trg_search_index_wiki_pages
after insert or update or delete on public.wiki_pages
for each row execute function public.trg_search_index_wiki_pages();

select public.upsert_search_index(
  'wiki',
  wp.id::text,
  wp.slug,
  wp.title,
  'Wiki',
  '/wiki/' || wp.slug,
  wp.updated_at,
  wp.is_published,
  left(
    concat_ws(
      ' ',
      wp.title,
      wp.slug,
      wp.seo_title,
      wp.meta_description,
      wp.tips_md
    ),
    3000
  )
)
from public.wiki_pages wp
where wp.slug is not null
  and trim(wp.slug) <> '';
