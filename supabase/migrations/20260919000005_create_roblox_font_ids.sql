-- Official Roblox FontFamily assets used by the global Font IDs catalog.

create table if not exists public.roblox_font_ids (
  asset_id bigint primary key,
  name text not null,
  description text,
  native_styles text[] not null default '{}'::text[],
  faces jsonb not null default '[]'::jsonb,
  designer text,
  font_version text,
  license_name text,
  license_url text,
  creator_id bigint,
  creator_name text,
  creator_verified boolean,
  asset_type_id integer not null default 73,
  purchasable boolean,
  vote_count integer,
  upvote_percent integer,
  thumbnail_url text,
  thumbnail_state text,
  thumbnail_checked_at timestamptz,
  roblox_created_at timestamptz,
  roblox_updated_at timestamptz,
  creator_store_url text not null,
  status text not null default 'active',
  source text not null default 'roblox_creator_store_font_family',
  raw_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roblox_font_ids_asset_type_check check (asset_type_id = 73),
  constraint roblox_font_ids_status_check check (status in ('active', 'inactive', 'error')),
  constraint roblox_font_ids_styles_check check (cardinality(native_styles) > 0),
  constraint roblox_font_ids_faces_check check (jsonb_typeof(faces) = 'array'),
  constraint roblox_font_ids_upvote_percent_check check (
    upvote_percent is null or (upvote_percent >= 0 and upvote_percent <= 100)
  )
);

comment on table public.roblox_font_ids is
  'Official Roblox Creator Store FontFamily assets, their supported faces, and refreshed preview metadata.';
comment on column public.roblox_font_ids.faces is
  'Official FontFamily manifest faces with name, weight, style, and face asset ID.';
comment on column public.roblox_font_ids.raw_payload is
  'Private source evidence from Roblox Creator Store and asset delivery responses. Never render directly.';

create index if not exists idx_roblox_font_ids_public_order
  on public.roblox_font_ids (status, vote_count desc, name);

create index if not exists idx_roblox_font_ids_name
  on public.roblox_font_ids (name);

drop trigger if exists trg_roblox_font_ids_updated_at on public.roblox_font_ids;
create trigger trg_roblox_font_ids_updated_at
before update on public.roblox_font_ids
for each row execute function public.set_updated_at();

create or replace function public.trg_enqueue_revalidation_font_ids()
returns trigger
language plpgsql
as $$
begin
  perform public.enqueue_revalidation(
    'catalog',
    'roblox-font-ids',
    'roblox_font_ids_' || lower(tg_op)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_enqueue_revalidation_font_ids on public.roblox_font_ids;
create trigger trg_enqueue_revalidation_font_ids
after insert or update or delete on public.roblox_font_ids
for each row execute function public.trg_enqueue_revalidation_font_ids();

alter table public.roblox_font_ids enable row level security;

drop policy if exists "roblox_font_ids_public_read" on public.roblox_font_ids;
create policy "roblox_font_ids_public_read"
  on public.roblox_font_ids
  for select
  to anon, authenticated
  using (status = 'active');

drop policy if exists "roblox_font_ids_admin_full_access" on public.roblox_font_ids;
create policy "roblox_font_ids_admin_full_access"
  on public.roblox_font_ids
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

grant select on table public.roblox_font_ids to anon;
grant select on table public.roblox_font_ids to authenticated;
grant all on table public.roblox_font_ids to service_role;

grant all on function public.trg_enqueue_revalidation_font_ids() to service_role;
