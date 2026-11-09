-- A newly authored page starts with the current set, so a later recheck cannot
-- mistake its missing baseline for an addition.
create function public.initialize_catalog_membership_snapshot() returns trigger
language plpgsql security definer set search_path = '' as $$
declare family text;
begin
  family := case
    when new.code like 'roblox-music-ids/games/%' then 'music'
    when new.code like 'roblox-decal-ids/games/%' then 'decal'
    when new.code = 'free-roblox-items' then 'free'
  end;
  if family is not null then
    perform pg_catalog.pg_advisory_xact_lock(723461, hashtext(family));
    insert into public.catalog_membership_snapshots(code, identities, updated_at)
    select new.code, coalesce(array_agg(distinct m.identity order by m.identity), '{}'::text[]), new.updated_at
    from public.catalog_complex_memberships(family) m where m.code = new.code
    on conflict(code) do nothing;
  end if;
  return null;
end $$;
revoke all on function public.initialize_catalog_membership_snapshot() from public, anon, authenticated;
create trigger initialize_catalog_membership_snapshot after insert or update of code on public.catalog_pages
for each row execute function public.initialize_catalog_membership_snapshot();

-- Limit each cron run, including lock waits. A later minute reconciles a run
-- skipped during a long import or database restart.
do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.schedule('catalog-free-membership-expiry', '* * * * *',
      $cron$set statement_timeout = '30s'; set lock_timeout = '5s'; select public.refresh_catalog_membership_snapshots('free');$cron$);
  end if;
end $$;
