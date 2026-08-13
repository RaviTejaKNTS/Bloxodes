-- Daily rank snapshots are not consumed by the current application. The
-- monolithic writer was timing out after maintaining this redundant index on
-- a multi-gigabyte table. Retain the table read-only during the rollback
-- window, but stop paying the duplicate write/storage cost.

set lock_timeout = '5s';

drop index if exists public.idx_roblox_rank_daily_universe_type_date_v2;

alter table public.roblox_universe_rank_snapshots_daily set (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 50000,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold = 50000
);

reset lock_timeout;
