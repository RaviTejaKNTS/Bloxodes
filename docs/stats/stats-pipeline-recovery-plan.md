# Stats Pipeline Recovery Plan

## What Went Stale

Hourly game stats and rank snapshots kept updating, but the daily universe rollup stopped at `2026-06-11`. The old database-local cron jobs for health check, daily rollup, and hourly prune stopped leaving fresh `stats_job_runs` rows around `2026-06-12`.

That means the public daily charts had fresh hourly source data, but the daily table was no longer being finalized.

## Fix Direction

Move the small database maintenance jobs into observable script runs, and keep the database cron path as an optional fast path instead of the only path.

| Job | Fix |
| --- | --- |
| Daily universe rollup | Run `npm run stats:rollup-daily -- --date yesterday --finalize` from a scheduled GitHub workflow and record `stats_job_runs`. |
| Hourly prune | Run `npm run stats:prune-hourly -- --days 90 --apply` from the same workflow and record `stats_job_runs`. |
| Universe audit | Run `npm run stats:audit` after maintenance and record latest hourly/daily/rank coverage. |
| Backfill | Roll up each missing UTC date from `2026-06-12` through yesterday. |

## Operational Rule

For scheduled maintenance, prefer jobs that are:

- idempotent
- visible in `stats_job_runs`
- safe to rerun by date
- free of Roblox API calls

Roblox-fetching jobs should stay on the VPS/Northflank stats workers because GitHub shared runners can be rate-limited. Daily rollup, prune, and audit are database-only, so GitHub is acceptable as a fallback runner.

## Verification

After recovery:

1. `roblox_universe_stats_daily` latest `stat_date` should equal yesterday in UTC.
2. `stats_job_runs` should show recent rows for `stats_universe_daily_rollup`, `stats_universe_hourly_prune`, and `stats_universe_audit`.
3. `npm run stats:audit` should report fresh hourly, daily, hourly-rank, and daily-rank timestamps.
4. `/stats/games/*` long-range charts should have daily data after `2026-06-11`.
