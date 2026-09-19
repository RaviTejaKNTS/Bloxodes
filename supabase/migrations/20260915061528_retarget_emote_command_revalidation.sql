create or replace function public.enqueue_emote_command_revalidation()
returns trigger language plpgsql set search_path = public as $$
begin
  perform public.enqueue_revalidation('catalog', 'roblox-emote-commands', 'emote_commands_' || lower(tg_op));
  return null;
end;
$$;

revoke all on function public.enqueue_emote_command_revalidation() from public, anon, authenticated;
grant execute on function public.enqueue_emote_command_revalidation() to service_role;
