-- Current player counts disappear from public read models after 24 hours.
-- Keep next_stats_refresh_at as the claim gate, but cap healthy rows one hour
-- before that deadline. Unavailable experiences retain their seven-day
-- quarantine, and stale/error rows are never made immediately reclaimable in
-- the same worker loop.

create or replace function public.enforce_universe_stats_visibility_deadline()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  visibility_refresh_cap timestamptz;
begin
  if new.stats_tier_reason = 'game_details_unavailable' then
    return new;
  end if;

  if new.last_playing_refreshed_at is null
    or new.last_playing_refreshed_at < statement_timestamp() - interval '23 hours'
  then
    visibility_refresh_cap := statement_timestamp() + interval '1 hour';
  else
    visibility_refresh_cap := new.last_playing_refreshed_at + interval '23 hours';
  end if;

  if new.next_stats_refresh_at is not null
    and new.next_stats_refresh_at > visibility_refresh_cap
  then
    new.next_stats_refresh_at := visibility_refresh_cap;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_universe_stats_visibility_deadline()
  from public, anon, authenticated;
grant execute on function public.enforce_universe_stats_visibility_deadline()
  to postgres, service_role;

drop trigger if exists trg_enforce_universe_stats_visibility_deadline
  on public.roblox_universes;

create trigger trg_enforce_universe_stats_visibility_deadline
before update of
  last_stats_refreshed_at,
  last_playing_refreshed_at,
  next_stats_refresh_at,
  stats_tier_reason
on public.roblox_universes
for each row
execute function public.enforce_universe_stats_visibility_deadline();

with scoped as (
  select
    universe_id,
    case
      when last_playing_refreshed_at is null
        or last_playing_refreshed_at < statement_timestamp() - interval '23 hours'
      then statement_timestamp() + interval '1 hour'
      else last_playing_refreshed_at + interval '23 hours'
    end as refresh_cap
  from public.roblox_universes
  where root_place_id > 0
    and stats_tier_reason is distinct from 'game_details_unavailable'
)
update public.roblox_universes universe
set next_stats_refresh_at = scoped.refresh_cap
from scoped
where universe.universe_id = scoped.universe_id
  and universe.next_stats_refresh_at is not null
  and universe.next_stats_refresh_at > scoped.refresh_cap;
