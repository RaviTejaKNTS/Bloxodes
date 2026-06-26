-- Roblox decal IDs catalog, modeled after roblox_music_ids but with
-- source provenance and refreshable thumbnail metadata.

create table if not exists public.roblox_decal_ids (
  asset_id bigint primary key,
  texture_id bigint,
  name text not null,
  description text,
  creator_id bigint,
  creator_type text,
  creator_name text,
  creator_verified boolean,
  roblox_created_at timestamptz,
  roblox_updated_at timestamptz,
  is_public_domain boolean,
  is_for_sale boolean,
  price_in_robux integer,
  sales bigint,
  purchasable boolean,
  vote_count bigint,
  upvote_percent integer,
  thumbnail_url text,
  thumbnail_state text,
  thumbnail_checked_at timestamptz,
  status text not null default 'pending',
  status_reason text,
  source text not null default 'roblox_toolbox_decal_search',
  raw_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  verified_at timestamptz,
  popularity_score double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roblox_decal_ids_status_check check (
    status in ('pending', 'active', 'inactive', 'deleted', 'private', 'moderated', 'not_decal', 'error')
  ),
  constraint roblox_decal_ids_creator_type_check check (
    creator_type is null or creator_type in ('User', 'Group')
  ),
  constraint roblox_decal_ids_upvote_percent_check check (
    upvote_percent is null or (upvote_percent >= 0 and upvote_percent <= 100)
  )
);

create table if not exists public.roblox_decal_id_sources (
  id uuid primary key default gen_random_uuid(),
  asset_id bigint not null references public.roblox_decal_ids(asset_id) on delete cascade,
  source_kind text not null,
  source_url text,
  source_query text,
  source_page integer,
  source_rank integer,
  raw_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roblox_decal_id_sources_unique_source unique (
    asset_id,
    source_kind,
    source_url,
    source_query,
    source_page,
    source_rank
  )
);

create index if not exists idx_roblox_decal_ids_status
  on public.roblox_decal_ids (status);

create index if not exists idx_roblox_decal_ids_last_seen
  on public.roblox_decal_ids (last_seen_at desc);

create index if not exists idx_roblox_decal_ids_verified_at
  on public.roblox_decal_ids (verified_at);

create index if not exists idx_roblox_decal_ids_thumbnail_checked_at
  on public.roblox_decal_ids (thumbnail_checked_at);

create index if not exists idx_roblox_decal_ids_popularity_score
  on public.roblox_decal_ids (popularity_score desc);

create index if not exists idx_roblox_decal_ids_creator
  on public.roblox_decal_ids (creator_type, creator_id);

create index if not exists idx_roblox_decal_id_sources_asset_id
  on public.roblox_decal_id_sources (asset_id);

create index if not exists idx_roblox_decal_id_sources_kind
  on public.roblox_decal_id_sources (source_kind);

create or replace view public.roblox_decal_ids_ranked_view
with (security_invoker = true) as
select
  rd.asset_id,
  rd.texture_id,
  rd.name,
  rd.description,
  rd.creator_id,
  rd.creator_type,
  rd.creator_name,
  rd.creator_verified,
  rd.roblox_created_at,
  rd.roblox_updated_at,
  rd.is_public_domain,
  rd.is_for_sale,
  rd.price_in_robux,
  rd.sales,
  rd.purchasable,
  rd.vote_count,
  rd.upvote_percent,
  rd.thumbnail_url,
  rd.thumbnail_state,
  rd.thumbnail_checked_at,
  rd.status,
  rd.status_reason,
  rd.source,
  rd.raw_payload,
  rd.first_seen_at,
  rd.last_seen_at,
  rd.verified_at,
  rd.popularity_score,
  rd.created_at,
  rd.updated_at,
  case
    when rd.thumbnail_state = 'Completed' and rd.thumbnail_url is not null then true
    else false
  end as thumbnail_ready,
  case
    when rd.roblox_created_at is null then 999
    when rd.roblox_created_at >= now() - interval '30 days' then 0
    when rd.roblox_created_at >= now() - interval '180 days' then 1
    when rd.roblox_created_at >= now() - interval '1 year' then 2
    else 3
  end as age_bucket,
  coalesce(src.source_count, 0)::integer as source_count
from public.roblox_decal_ids rd
left join (
  select asset_id, count(*) as source_count
  from public.roblox_decal_id_sources
  group by asset_id
) src on src.asset_id = rd.asset_id
where rd.status = 'active';

create or replace function public.trg_enqueue_revalidation_decal_ids()
returns trigger
language plpgsql
as $$
begin
  perform public.enqueue_revalidation('catalog', 'roblox-decal-ids', 'roblox_decal_ids_' || lower(tg_op));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_enqueue_revalidation_decal_ids on public.roblox_decal_ids;
create trigger trg_enqueue_revalidation_decal_ids
after insert or update or delete on public.roblox_decal_ids
for each row execute function public.trg_enqueue_revalidation_decal_ids();

drop trigger if exists trg_roblox_decal_ids_updated_at on public.roblox_decal_ids;
create trigger trg_roblox_decal_ids_updated_at
before update on public.roblox_decal_ids
for each row execute function public.set_updated_at();

drop trigger if exists trg_roblox_decal_id_sources_updated_at on public.roblox_decal_id_sources;
create trigger trg_roblox_decal_id_sources_updated_at
before update on public.roblox_decal_id_sources
for each row execute function public.set_updated_at();

alter table public.roblox_decal_ids enable row level security;
alter table public.roblox_decal_id_sources enable row level security;

drop policy if exists "roblox_decal_ids_public_read" on public.roblox_decal_ids;
create policy "roblox_decal_ids_public_read"
  on public.roblox_decal_ids
  for select
  to anon, authenticated
  using (status = 'active');

drop policy if exists "roblox_decal_ids_admin_full_access" on public.roblox_decal_ids;
create policy "roblox_decal_ids_admin_full_access"
  on public.roblox_decal_ids
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "roblox_decal_id_sources_admin_full_access" on public.roblox_decal_id_sources;
create policy "roblox_decal_id_sources_admin_full_access"
  on public.roblox_decal_id_sources
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

grant all on table public.roblox_decal_ids to anon;
grant all on table public.roblox_decal_ids to authenticated;
grant all on table public.roblox_decal_ids to service_role;

grant all on table public.roblox_decal_id_sources to authenticated;
grant all on table public.roblox_decal_id_sources to service_role;

grant all on table public.roblox_decal_ids_ranked_view to anon;
grant all on table public.roblox_decal_ids_ranked_view to authenticated;
grant all on table public.roblox_decal_ids_ranked_view to service_role;

grant all on function public.trg_enqueue_revalidation_decal_ids() to anon;
grant all on function public.trg_enqueue_revalidation_decal_ids() to authenticated;
grant all on function public.trg_enqueue_revalidation_decal_ids() to service_role;
