create or replace function public.invoke_revalidation_worker()
returns bigint
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  revalidate_jwt text;
  request_id bigint;
begin
  select decrypted_secret
  into revalidate_jwt
  from vault.decrypted_secrets
  where name = 'revalidate_cron_jwt'
  limit 1;

  if nullif(trim(coalesce(revalidate_jwt, '')), '') is null then
    raise exception 'Missing Vault secret revalidate_cron_jwt for revalidation cron';
  end if;

  select net.http_post(
    url := 'https://database.bloxodes.com/functions/v1/revalidate',
    body := '{}'::jsonb,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || revalidate_jwt,
      'apikey', revalidate_jwt,
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 60000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function public.invoke_revalidation_worker() from public;
grant execute on function public.invoke_revalidation_worker() to postgres;

create or replace function public.invoke_cache_warm_worker()
returns bigint
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  cache_warm_jwt text;
  request_id bigint;
begin
  select decrypted_secret
  into cache_warm_jwt
  from vault.decrypted_secrets
  where name = 'revalidate_cron_jwt'
  limit 1;

  if nullif(trim(coalesce(cache_warm_jwt, '')), '') is null then
    raise exception 'Missing Vault secret revalidate_cron_jwt for cache warm cron';
  end if;

  select net.http_post(
    url := 'https://database.bloxodes.com/functions/v1/cache-warm',
    body := '{}'::jsonb,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || cache_warm_jwt,
      'apikey', cache_warm_jwt,
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 60000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function public.invoke_cache_warm_worker() from public;
grant execute on function public.invoke_cache_warm_worker() to postgres;
