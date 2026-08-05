-- Public Creator Store MeshPart listings and the geometry IDs used by MeshPart.MeshId.

create table if not exists public.roblox_mesh_ids (
  asset_id bigint primary key,
  mesh_id bigint not null,
  texture_id bigint,
  name text not null,
  description text,
  creator_id bigint,
  creator_name text,
  creator_verified boolean,
  asset_type_id integer not null default 40,
  purchasable boolean,
  vote_count integer,
  upvote_percent integer,
  source_rank integer not null,
  thumbnail_url text,
  thumbnail_state text,
  thumbnail_checked_at timestamptz,
  roblox_created_at timestamptz,
  roblox_updated_at timestamptz,
  creator_store_url text not null,
  status text not null default 'active',
  source text not null default 'roblox_creator_store_mesh_part',
  raw_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roblox_mesh_ids_asset_id_check check (asset_id > 0),
  constraint roblox_mesh_ids_mesh_id_check check (mesh_id > 0),
  constraint roblox_mesh_ids_texture_id_check check (texture_id is null or texture_id > 0),
  constraint roblox_mesh_ids_asset_type_check check (asset_type_id = 40),
  constraint roblox_mesh_ids_rank_check check (source_rank > 0),
  constraint roblox_mesh_ids_status_check check (status in ('active', 'inactive', 'error')),
  constraint roblox_mesh_ids_upvote_percent_check check (
    upvote_percent is null or (upvote_percent >= 0 and upvote_percent <= 100)
  )
);

comment on table public.roblox_mesh_ids is
  'Popular public MeshPart listings from Roblox Creator Store, including their underlying MeshId and optional TextureId.';
comment on column public.roblox_mesh_ids.asset_id is
  'The Creator Store MeshPart asset ID.';
comment on column public.roblox_mesh_ids.mesh_id is
  'The underlying geometry asset ID used by MeshPart.MeshId.';
comment on column public.roblox_mesh_ids.raw_payload is
  'Private source evidence from the Roblox Creator Store response. Never render directly.';

create index if not exists idx_roblox_mesh_ids_public_order
  on public.roblox_mesh_ids (source_rank, name, asset_id)
  where status = 'active' and thumbnail_state = 'Completed' and thumbnail_url is not null;

create index if not exists idx_roblox_mesh_ids_newest
  on public.roblox_mesh_ids (roblox_created_at desc nulls last, asset_id)
  where status = 'active' and thumbnail_state = 'Completed' and thumbnail_url is not null;

drop trigger if exists trg_roblox_mesh_ids_updated_at on public.roblox_mesh_ids;
create trigger trg_roblox_mesh_ids_updated_at
before update on public.roblox_mesh_ids
for each row execute function public.set_updated_at();

create or replace function public.trg_enqueue_revalidation_mesh_ids()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.enqueue_revalidation(
    'catalog',
    'roblox-mesh-ids',
    'roblox_mesh_ids_' || lower(tg_op)
  );
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_mesh_ids on public.roblox_mesh_ids;
create trigger trg_enqueue_revalidation_mesh_ids
after insert or update or delete on public.roblox_mesh_ids
for each statement execute function public.trg_enqueue_revalidation_mesh_ids();

alter table public.roblox_mesh_ids enable row level security;

revoke all on table public.roblox_mesh_ids from anon, authenticated;
grant all on table public.roblox_mesh_ids to service_role;

revoke all on function public.trg_enqueue_revalidation_mesh_ids() from public, anon, authenticated;
grant execute on function public.trg_enqueue_revalidation_mesh_ids() to service_role;
