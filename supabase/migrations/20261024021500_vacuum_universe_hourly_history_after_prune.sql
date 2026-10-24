-- The nightly prune deletes up to 500,000 of the oldest rows from each hourly
-- history table. At the default 20% scale factor autovacuum waits for about
-- 3.6M dead rows on roblox_universe_stats_hourly, so it never ran there or on
-- the rank table. The next prune then scanned the previous night's dead index
-- entries at the old end of hour_start and hit the 8 s statement timeout on its
-- first batch. Vacuum these two tables after about 1% churn instead.
-- Changing storage parameters takes only a SHARE UPDATE EXCLUSIVE lock, so
-- reads and the hourly writers keep running.
alter table public.roblox_universe_stats_hourly set (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_vacuum_threshold = 10000
);

alter table public.roblox_universe_rank_snapshots_hourly set (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_vacuum_threshold = 10000
);
