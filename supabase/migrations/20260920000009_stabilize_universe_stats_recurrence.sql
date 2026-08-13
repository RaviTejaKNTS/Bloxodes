-- Keep healthy COLD observations comfortably inside the public 24-hour cutoff.
-- The previous 23-hour deadline could fall just after the fixed hourly poll,
-- leaving the next attempt and read-index publication beyond 24 hours.

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
    or new.last_playing_refreshed_at < statement_timestamp() - interval '20 hours'
  then
    visibility_refresh_cap := statement_timestamp() + interval '1 hour';
  else
    visibility_refresh_cap := new.last_playing_refreshed_at + interval '20 hours';
  end if;

  if new.next_stats_refresh_at is null
    or new.next_stats_refresh_at > visibility_refresh_cap
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

-- Repair rows whose seven-day unavailable cooldown was erased by the old
-- post-refresh tier pass.
update public.roblox_universes
set
  stats_tier = 'COLD',
  stats_tier_reason = 'game_details_unavailable',
  stats_tier_updated_at = statement_timestamp(),
  next_stats_refresh_at = statement_timestamp() + interval '168 hours'
where root_place_id > 0
  and stats_refresh_attempt_count >= 3
  and last_stats_refresh_error = 'Universe missing from successful Roblox game details response'
  and stats_tier_reason is distinct from 'game_details_unavailable';

-- Pull every healthy row onto the new deadline without shortening unavailable
-- cooldowns.
with scoped as (
  select
    universe_id,
    case
      when last_playing_refreshed_at is null
        or last_playing_refreshed_at < statement_timestamp() - interval '20 hours'
      then statement_timestamp() + interval '1 hour'
      else last_playing_refreshed_at + interval '20 hours'
    end as refresh_cap
  from public.roblox_universes
  where root_place_id > 0
    and stats_tier_reason is distinct from 'game_details_unavailable'
)
update public.roblox_universes universe
set next_stats_refresh_at = scoped.refresh_cap
from scoped
where universe.universe_id = scoped.universe_id
  and (
    universe.next_stats_refresh_at is null
    or universe.next_stats_refresh_at > scoped.refresh_cap
  );
