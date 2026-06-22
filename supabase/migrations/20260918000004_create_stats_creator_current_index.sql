create table if not exists public.stats_creator_current_index (
  creator_key text primary key,
  creator_type text not null,
  creator_id bigint not null,
  creator_name text not null,
  creator_slug text not null,
  game_count integer not null default 0,
  hot_game_count integer not null default 0,
  warm_game_count integer not null default 0,
  new_game_count integer not null default 0,
  cold_game_count integer not null default 0,
  playing bigint not null default 0,
  visits bigint not null default 0,
  favorites bigint not null default 0,
  likes bigint not null default 0,
  dislikes bigint not null default 0,
  rating_percent numeric,
  top_universe_id bigint references public.roblox_universes(universe_id) on delete set null,
  top_slug text,
  top_name text,
  top_display_name text,
  top_icon_url text,
  top_playing bigint,
  top_visits bigint,
  top_favorites bigint,
  member_count bigint,
  has_verified_badge boolean,
  last_stats_refreshed_at timestamptz,
  indexed_at timestamptz not null default now(),
  unique (creator_type, creator_id)
);

create index if not exists idx_stats_creator_current_playing
  on public.stats_creator_current_index (playing desc, creator_key asc);

create index if not exists idx_stats_creator_current_visits
  on public.stats_creator_current_index (visits desc, creator_key asc);

create index if not exists idx_stats_creator_current_favorites
  on public.stats_creator_current_index (favorites desc, creator_key asc);

create index if not exists idx_stats_creator_current_games
  on public.stats_creator_current_index (game_count desc, playing desc, creator_key asc);

create index if not exists idx_stats_creator_current_hot_games
  on public.stats_creator_current_index (hot_game_count desc, playing desc, creator_key asc);

create index if not exists idx_stats_creator_current_members
  on public.stats_creator_current_index (member_count desc nulls last, playing desc, creator_key asc);

create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_stats_creator_current_name_trgm
  on public.stats_creator_current_index
  using gin (creator_name extensions.gin_trgm_ops);

alter table public.stats_creator_current_index enable row level security;

grant select on table public.stats_creator_current_index to anon, authenticated, service_role;
grant all on table public.stats_creator_current_index to service_role;

create or replace function public.refresh_stats_creator_current_index()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
set statement_timeout = '120s'
as $$
declare
  refreshed_at timestamptz := now();
  creator_count integer := 0;
begin
  perform set_config('statement_timeout', '120000', true);

  delete from public.stats_creator_current_index where true;

  with base as (
    select
      lower(g.creator_type) as creator_type,
      g.creator_id,
      btrim(g.creator_name) as creator_name,
      g.universe_id,
      g.slug,
      g.name,
      g.display_name,
      g.icon_url,
      coalesce(g.playing, 0) as playing,
      coalesce(g.visits, 0) as visits,
      coalesce(g.favorites, 0) as favorites,
      coalesce(g.likes, 0) as likes,
      coalesce(g.dislikes, 0) as dislikes,
      g.stats_tier,
      g.last_stats_refreshed_at,
      u.creator_has_verified_badge,
      groups.name as group_name,
      groups.member_count,
      groups.has_verified_badge as group_has_verified_badge
    from public.stats_game_current_index g
    left join public.roblox_universes u on u.universe_id = g.universe_id
    left join public.roblox_groups groups
      on lower(g.creator_type) = 'group'
     and groups.group_id = g.creator_id
    where g.creator_id is not null
      and g.creator_name is not null
      and btrim(g.creator_name) <> ''
      and lower(g.creator_type) in ('group', 'user')
  ),
  ranked as (
    select
      *,
      row_number() over (
        partition by creator_type, creator_id
        order by playing desc nulls last, visits desc nulls last, universe_id asc
      ) as rn
    from base
  )
  insert into public.stats_creator_current_index (
    creator_key,
    creator_type,
    creator_id,
    creator_name,
    creator_slug,
    game_count,
    hot_game_count,
    warm_game_count,
    new_game_count,
    cold_game_count,
    playing,
    visits,
    favorites,
    likes,
    dislikes,
    rating_percent,
    top_universe_id,
    top_slug,
    top_name,
    top_display_name,
    top_icon_url,
    top_playing,
    top_visits,
    top_favorites,
    member_count,
    has_verified_badge,
    last_stats_refreshed_at,
    indexed_at
  )
  select
    creator_type || ':' || creator_id::text,
    creator_type,
    creator_id,
    coalesce(max(group_name), max(creator_name) filter (where rn = 1), max(creator_name)),
    public.slugify_stats_label(coalesce(max(group_name), max(creator_name) filter (where rn = 1), max(creator_name))) || '-' || creator_type || '-' || creator_id::text,
    count(*)::integer,
    count(*) filter (where stats_tier = 'HOT')::integer,
    count(*) filter (where stats_tier = 'WARM')::integer,
    count(*) filter (where stats_tier = 'NEW')::integer,
    count(*) filter (where stats_tier = 'COLD')::integer,
    coalesce(sum(playing), 0)::bigint,
    coalesce(sum(visits), 0)::bigint,
    coalesce(sum(favorites), 0)::bigint,
    coalesce(sum(likes), 0)::bigint,
    coalesce(sum(dislikes), 0)::bigint,
    case
      when coalesce(sum(likes), 0) + coalesce(sum(dislikes), 0) <= 0 then null
      else round((coalesce(sum(likes), 0)::numeric / (coalesce(sum(likes), 0) + coalesce(sum(dislikes), 0))::numeric) * 1000) / 10
    end,
    max(universe_id) filter (where rn = 1),
    max(slug) filter (where rn = 1),
    max(name) filter (where rn = 1),
    max(display_name) filter (where rn = 1),
    max(icon_url) filter (where rn = 1),
    max(playing) filter (where rn = 1),
    max(visits) filter (where rn = 1),
    max(favorites) filter (where rn = 1),
    max(member_count),
    case
      when creator_type = 'group' then bool_or(coalesce(group_has_verified_badge, false))
      else bool_or(coalesce(creator_has_verified_badge, false))
    end,
    max(last_stats_refreshed_at),
    refreshed_at
  from ranked
  group by creator_type, creator_id;

  get diagnostics creator_count = row_count;

  return jsonb_build_object(
    'indexed_at', refreshed_at,
    'creators', creator_count
  );
end;
$$;

revoke all on function public.refresh_stats_creator_current_index() from public, anon, authenticated;
grant execute on function public.refresh_stats_creator_current_index() to service_role;
