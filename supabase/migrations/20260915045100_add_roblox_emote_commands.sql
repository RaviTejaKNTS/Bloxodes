-- Reviewed command references supplement the existing Marketplace item corpus.
create table public.roblox_emote_commands (
  code text primary key,
  name text not null,
  command text not null check (command like '/e %' and command !~ '[\r\n]'),
  asset_id bigint references public.roblox_catalog_items(asset_id) on delete restrict,
  kind text not null check (kind in ('default', 'avatar')),
  description text not null,
  requirements text not null,
  source_urls jsonb not null check (jsonb_typeof(source_urls) = 'array' and jsonb_array_length(source_urls) > 0),
  verification_method text not null check (verification_method in ('official_documentation', 'source_documentation', 'in_game_test')),
  verified_at timestamptz not null,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  updated_at timestamptz not null default now(),
  check (kind <> 'default' or asset_id is null),
  check (kind <> 'avatar' or asset_id is not null)
);
create index roblox_emote_commands_asset_id_idx on public.roblox_emote_commands(asset_id);
alter table public.roblox_emote_commands enable row level security;
revoke all on public.roblox_emote_commands from public, anon, authenticated;
grant all on public.roblox_emote_commands to service_role;

create function public.enqueue_emote_command_revalidation()
returns trigger language plpgsql set search_path = public as $$
begin
  perform public.enqueue_revalidation('catalog', 'roblox-items-and-bundles/roblox-emotes', 'emote_commands_' || lower(tg_op));
  return null;
end;
$$;
revoke all on function public.enqueue_emote_command_revalidation() from public, anon, authenticated;
grant execute on function public.enqueue_emote_command_revalidation() to service_role;
create trigger emote_commands_revalidation after insert or update or delete on public.roblox_emote_commands
for each statement execute function public.enqueue_emote_command_revalidation();
