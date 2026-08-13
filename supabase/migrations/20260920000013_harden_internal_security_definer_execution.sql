-- Converge privileged function access after the managed-development baseline
-- and self-hosted production histories. Keep policy helper execution available
-- without leaving its SECURITY DEFINER implementation in the exposed schema.

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.is_admin(user_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    user_uuid is not null
    and user_uuid = (select auth.uid())
    and exists (
      select 1
      from public.app_users app_user
      where app_user.user_id = user_uuid
        and app_user.role = 'admin'
    );
$$;

revoke all on function private.is_admin(uuid) from public, anon, authenticated;
grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.is_admin(uuid) to anon, authenticated, service_role;

create or replace function public.is_admin(user_uuid uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin(user_uuid);
$$;

revoke all on function public.is_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_admin(uuid) to anon, authenticated, service_role;

revoke all on function public.claim_article_generation_queue_item(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_article_generation_queue_item(uuid, text, integer)
  to service_role;

revoke all on function public.invoke_cache_warm_worker()
  from public, anon, authenticated, service_role;
grant execute on function public.invoke_cache_warm_worker()
  to postgres;

revoke all on function public.invoke_revalidation_worker()
  from public, anon, authenticated, service_role;
grant execute on function public.invoke_revalidation_worker()
  to postgres;

revoke all on function public.get_stats_visit_share_chart(date, date, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_stats_visit_share_chart(date, date, integer, integer, integer)
  to service_role;

revoke all on function public.get_roblox_universe_pipeline_health()
  from public, anon, authenticated;
revoke all on function public.get_roblox_universe_pipeline_health_v2()
  from public, anon, authenticated;
revoke all on function public.get_roblox_universe_pipeline_health_v3()
  from public, anon, authenticated;
revoke all on function public.get_roblox_universe_pipeline_health_v4()
  from public, anon, authenticated;
grant execute on function public.get_roblox_universe_pipeline_health() to service_role;
grant execute on function public.get_roblox_universe_pipeline_health_v2() to service_role;
grant execute on function public.get_roblox_universe_pipeline_health_v3() to service_role;
grant execute on function public.get_roblox_universe_pipeline_health_v4() to service_role;
