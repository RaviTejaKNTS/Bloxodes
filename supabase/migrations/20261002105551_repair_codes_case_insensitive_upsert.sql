-- Match the existing case-insensitive unique index atomically. Lower-priority
-- observations refresh last_seen_at without changing redemption text or state.
create or replace function public.upsert_code(
  p_code_page_id uuid, p_code text, p_status text, p_rewards_text text,
  p_level_requirement integer, p_is_new boolean, p_provider_priority integer default 0
) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_code text := btrim(p_code);
  v_priority integer := coalesce(p_provider_priority, 0);
begin
  if v_code is null or v_code = '' then return; end if;
  insert into public.codes as existing
    (code_page_id, code, status, rewards_text, level_requirement, is_new, provider_priority)
  values (p_code_page_id, v_code, p_status, p_rewards_text, p_level_requirement, p_is_new, v_priority)
  on conflict (code_page_id, (upper(code))) do update set
    code = case when excluded.provider_priority > existing.provider_priority then excluded.code else existing.code end,
    status = case when excluded.provider_priority >= existing.provider_priority then excluded.status else existing.status end,
    rewards_text = case when excluded.provider_priority >= existing.provider_priority then excluded.rewards_text else existing.rewards_text end,
    level_requirement = case when excluded.provider_priority >= existing.provider_priority then excluded.level_requirement else existing.level_requirement end,
    is_new = case when excluded.provider_priority >= existing.provider_priority then excluded.is_new else existing.is_new end,
    provider_priority = greatest(existing.provider_priority, excluded.provider_priority),
    last_seen_at = now(),
    first_seen_at = case when excluded.provider_priority >= existing.provider_priority
      and existing.status = 'expired' and excluded.status = 'active' then now() else existing.first_seen_at end;
end;
$$;
