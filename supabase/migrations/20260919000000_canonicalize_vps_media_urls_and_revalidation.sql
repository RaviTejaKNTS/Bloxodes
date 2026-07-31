begin;

-- Public Storage objects are served through media.bloxodes.com. The API
-- gateway remains database.bloxodes.com, but it must never be persisted as a
-- public media origin.
do $$
begin
  if exists (
    select 1
    from public.code_pages page
    where page.cover_image like 'https://database.bloxodes.com/storage/v1/object/public/%'
      and not exists (
        select 1
        from storage.objects object
        where object.bucket_id = split_part(
          split_part(page.cover_image, '/storage/v1/object/public/', 2),
          '/',
          1
        )
          and object.name = substring(
            split_part(page.cover_image, '/storage/v1/object/public/', 2)
            from position('/' in split_part(page.cover_image, '/storage/v1/object/public/', 2)) + 1
          )
      )
  ) then
    raise exception 'A code page database-hosted cover is missing from VPS Storage';
  end if;

  if exists (
    select 1
    from public.articles article
    where article.cover_image like 'https://database.bloxodes.com/storage/v1/object/public/%'
      and not exists (
        select 1
        from storage.objects object
        where object.bucket_id = split_part(
          split_part(article.cover_image, '/storage/v1/object/public/', 2),
          '/',
          1
        )
          and object.name = substring(
            split_part(article.cover_image, '/storage/v1/object/public/', 2)
            from position('/' in split_part(article.cover_image, '/storage/v1/object/public/', 2)) + 1
          )
      )
  ) then
    raise exception 'An article database-hosted cover is missing from VPS Storage';
  end if;

  if exists (
    select 1
    from public.articles article
    cross join lateral regexp_matches(
      article.content_md,
      '(https://database\.bloxodes\.com/storage/v1/object/public/[^\s)"<>]+)',
      'g'
    ) as media_match
    where not exists (
      select 1
      from storage.objects object
      where object.bucket_id = split_part(
        split_part(media_match[1], '/storage/v1/object/public/', 2),
        '/',
        1
      )
        and object.name = substring(
          split_part(media_match[1], '/storage/v1/object/public/', 2)
          from position('/' in split_part(media_match[1], '/storage/v1/object/public/', 2)) + 1
        )
    )
  ) then
    raise exception 'An article database-hosted body image is missing from VPS Storage';
  end if;
end;
$$;

-- Drop only stale source-image cache rows whose bytes are not present in the
-- self-hosted Storage metadata. Published article Markdown does not reference
-- these rows; a future refresh can download the original source again.
delete from public.article_source_images source_image
where source_image.public_url is not null
  and (
    source_image.public_url like 'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/%'
    or source_image.public_url like 'https://database.bloxodes.com/storage/v1/object/public/%'
  )
  and not exists (
    select 1
    from storage.objects object
    where object.bucket_id = split_part(
      split_part(source_image.public_url, '/storage/v1/object/public/', 2),
      '/',
      1
    )
      and object.name = source_image.uploaded_path
  );

update public.article_source_images
set public_url = replace(
  replace(
    public_url,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'
  ),
  'https://database.bloxodes.com/storage/v1/object/public/',
  'https://media.bloxodes.com/storage/v1/object/public/'
)
where public_url like 'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/%'
   or public_url like 'https://database.bloxodes.com/storage/v1/object/public/%';

update public.code_pages
set cover_image = replace(
  replace(
    cover_image,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'
  ),
  'https://database.bloxodes.com/storage/v1/object/public/',
  'https://media.bloxodes.com/storage/v1/object/public/'
),
intro_md = replace(
  replace(
    intro_md,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'
  ),
  'https://database.bloxodes.com/storage/v1/object/public/',
  'https://media.bloxodes.com/storage/v1/object/public/'
),
redeem_md = replace(
  replace(
    redeem_md,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'
  ),
  'https://database.bloxodes.com/storage/v1/object/public/',
  'https://media.bloxodes.com/storage/v1/object/public/'
),
rewards_md = replace(
  replace(
    rewards_md,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'
  ),
  'https://database.bloxodes.com/storage/v1/object/public/',
  'https://media.bloxodes.com/storage/v1/object/public/'
),
troubleshoot_md = replace(
  replace(
    troubleshoot_md,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'
  ),
  'https://database.bloxodes.com/storage/v1/object/public/',
  'https://media.bloxodes.com/storage/v1/object/public/'
),
find_codes_md = replace(
  replace(
    find_codes_md,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'
  ),
  'https://database.bloxodes.com/storage/v1/object/public/',
  'https://media.bloxodes.com/storage/v1/object/public/'
)
where row(
  cover_image,
  intro_md,
  redeem_md,
  rewards_md,
  troubleshoot_md,
  find_codes_md
)::text ~ '(bmwksaykcsndsvgspapz\.supabase\.co|database\.bloxodes\.com)/storage/v1/object/public/';

update public.articles
set cover_image = replace(
  replace(
    cover_image,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'
  ),
  'https://database.bloxodes.com/storage/v1/object/public/',
  'https://media.bloxodes.com/storage/v1/object/public/'
),
content_md = replace(
  replace(
    content_md,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'
  ),
  'https://database.bloxodes.com/storage/v1/object/public/',
  'https://media.bloxodes.com/storage/v1/object/public/'
)
where row(cover_image, content_md)::text
  ~ '(bmwksaykcsndsvgspapz\.supabase\.co|database\.bloxodes\.com)/storage/v1/object/public/';

-- Canonicalize these fields at the database boundary as a final safeguard for
-- jobs that accidentally omit SUPABASE_MEDIA_PUBLIC_URL.
create or replace function public.trg_canonicalize_code_page_media()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.cover_image := replace(replace(new.cover_image,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'),
    'https://database.bloxodes.com/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/');
  new.intro_md := replace(replace(new.intro_md,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'),
    'https://database.bloxodes.com/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/');
  new.redeem_md := replace(replace(new.redeem_md,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'),
    'https://database.bloxodes.com/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/');
  new.rewards_md := replace(replace(new.rewards_md,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'),
    'https://database.bloxodes.com/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/');
  new.troubleshoot_md := replace(replace(new.troubleshoot_md,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'),
    'https://database.bloxodes.com/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/');
  new.find_codes_md := replace(replace(new.find_codes_md,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'),
    'https://database.bloxodes.com/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/');
  return new;
end;
$$;

create or replace function public.trg_canonicalize_article_media()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.cover_image := replace(replace(new.cover_image,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'),
    'https://database.bloxodes.com/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/');
  new.content_md := replace(replace(new.content_md,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'),
    'https://database.bloxodes.com/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/');
  return new;
end;
$$;

create or replace function public.trg_canonicalize_article_source_media()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.public_url := replace(replace(new.public_url,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'),
    'https://database.bloxodes.com/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/');
  return new;
end;
$$;

revoke all on function public.trg_canonicalize_code_page_media() from public;
revoke all on function public.trg_canonicalize_article_media() from public;
revoke all on function public.trg_canonicalize_article_source_media() from public;

drop trigger if exists trg_canonicalize_code_page_media on public.code_pages;
create trigger trg_canonicalize_code_page_media
before insert or update on public.code_pages
for each row execute function public.trg_canonicalize_code_page_media();

drop trigger if exists trg_canonicalize_article_media on public.articles;
create trigger trg_canonicalize_article_media
before insert or update on public.articles
for each row execute function public.trg_canonicalize_article_media();

drop trigger if exists trg_canonicalize_article_source_media on public.article_source_images;
create trigger trg_canonicalize_article_source_media
before insert or update on public.article_source_images
for each row execute function public.trg_canonicalize_article_source_media();

-- Keep the source-controlled migration chain and a future schema rebuild on
-- the self-hosted revalidation Edge Function.
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

commit;
