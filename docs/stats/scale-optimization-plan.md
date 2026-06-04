# Stats Scale Optimization Plan

This doc tracks the infrastructure and database work needed before Roblox stats grows from about 95K games to 500K-2M+ games.

Keep metric meaning in `docs/stats/metric-contract.md`. Keep chart UI ideas in `docs/stats/chart-feature-followup-plan.md`. This file is only for scale, reliability, and workflow operations.

## Goal

Build a stats pipeline that can:

- refresh important games frequently
- rotate through cold games without stalling hot data
- avoid duplicate work across workers
- preserve existing good data when Roblox APIs return missing fields
- keep public chart APIs fast
- keep database storage under control

## Hosting Direction

Use different compute for different job sizes:

| Job type | Best place | Why |
| --- | --- | --- |
| Small short jobs | Supabase Edge Functions | Good for lightweight scheduled checks and simple repair tasks. |
| Heavy scraping/ranking jobs | Northflank | Better for long-running Node jobs, larger batches, retries, and controlled concurrency. |
| Emergency/manual helpers | Local/Linux laptop | Useful for one-off repairs, backfills, and experiments, but not the main reliable workflow. |

Do not rely on GitHub Actions for the main stats pipeline once the dataset gets large. GitHub Actions are fine for small maintenance tasks, but not for reliable hourly production scraping.

## Priority Order

1. Add the right indexes.
2. Add worker leases/queues.
3. Move heavy jobs to Northflank.
4. Partition high-growth history tables.
5. Batch writes through RPC/database functions.
6. Add job health tables and alerts.
7. Tune public API caching.

## Database Indexes

Add indexes around actual read/write patterns, then verify with `EXPLAIN ANALYZE`.

Important query paths:

- stats page by `roblox_universes.slug`
- chart data by `universe_id + hour_start/stat_date`
- rank chart data by `universe_id + rank_type + hour_start/stat_date`
- tier refresh selection by `stats_tier + last_stats_refreshed_at`
- public stats lists ordered by `playing`, `visits`, `favorites`, `updated_at_api`, `created_at_api`
- genre and subgenre lists ordered by `playing`
- compare-game search by name/slug/universe
- cleanup deletes by old `hour_start`

Avoid adding random indexes. Every index should map to a known API query, worker query, or cleanup query.

## Large Table Partitioning

Partition high-growth time-series tables by time, probably monthly.

Tables to partition first:

- `roblox_universe_stats_hourly`
- `roblox_universe_rank_snapshots_hourly`

Later candidates:

- `roblox_universe_stats_daily`
- `roblox_universe_rank_snapshots_daily`
- `roblox_universe_update_events`

Why:

- 500K games hourly can create massive row counts quickly.
- Monthly partitions make old-hourly pruning cheap.
- Chart queries only scan relevant time partitions.

## Worker Lease System

Before running multiple Northflank workers, add a proper lease model so workers do not refresh the same games.

Recommended fields on `roblox_universes` or a dedicated queue table:

- `next_stats_refresh_at`
- `stats_refresh_locked_at`
- `stats_refresh_locked_by`
- `stats_refresh_attempt_count`
- `last_stats_refresh_error`

Worker flow:

1. Claim a batch with an atomic update.
2. Mark rows as locked by worker ID.
3. Refresh Roblox data.
4. Upsert stats in batches.
5. Update tier and `next_stats_refresh_at`.
6. Release lock.

Locks should expire automatically if a worker dies.

## Refresh Tiers

Keep the simple tier model:

| Tier | Rule | Refresh |
| --- | --- | --- |
| `NEW` | newly discovered, never refreshed, or missing basic stats | immediately |
| `HOT` | `playing >= 100` or `visits >= 250M` | hourly |
| `WARM` | `playing >= 30` or `visits >= 10M` | every 12 hours |
| `COLD` | all remaining games | rotating batches every few days |

Do not refresh every game hourly. The tier system is what keeps the whole pipeline realistic.

## Separate Worker Jobs

Keep these as separate commands/services:

- `NEW` refresh worker
- `HOT` hourly refresh worker
- `WARM` refresh worker
- `COLD` rotating refresh worker
- daily rollup worker
- hourly rank snapshot worker
- daily rank snapshot worker
- hourly retention worker
- media repair/enrichment worker

Do not combine WARM and COLD into one long job. Slow tiers should not block hot freshness.

## Batch Writes

Avoid row-by-row writes through Supabase from Node.

Preferred pattern:

- collect a batch in the worker
- call one RPC/database function per chunk
- let Postgres upsert hourly stats, daily rollups, update events, and rank snapshots

Benefits:

- fewer network calls
- less partial failure
- better null-protection consistency
- easier retry behavior

## Null Protection

Roblox APIs are inconsistent. Missing API fields must not erase existing good data.

Rules:

- If a fetched value is `null` or missing, keep the existing database value.
- Store fetch failures separately.
- Track which fields were present in each run.
- Use raw JSON snapshots for debugging, but do not depend on raw JSON for public page reads.

## Rank Computation

Do not compute ranks on page request.

Workers should precompute:

- hourly relevant playing ranks
- daily full all-game ranks

Public pages should only read chart-ready rank rows.

Hourly rank storage can stay selective. Daily rank storage should be complete for long-term history.

## Retention

Keep:

- daily stats
- daily rank snapshots

Delete after 90 days:

- hourly metric history
- hourly rank snapshots

Use partition drops when partitioning is ready. Until then, use the existing prune function in bounded batches.

## Public API Caching

Stats APIs should fetch only the selected chart payload:

- selected game
- selected metric/scope
- selected range
- selected resolution
- optional previous period
- optional compare games
- optional annotations

Do not preload every chart mode on page load.

Cache short-lived public responses, especially for HOT games. Cache keys should include universe ID, metric/scope, range, resolution, compare IDs, previous-period flag, and annotations flag.

## Monitoring Tables

Add job health tables before scaling workers heavily.

Track per run:

- job name
- worker ID
- started/ended timestamps
- status
- rows claimed
- rows succeeded
- rows failed
- Roblox API failures by type
- Supabase write failures
- retry count
- oldest stale game in each tier

Useful dashboards:

- HOT games stale count
- WARM games stale count
- COLD rotation lag
- games missing icon/thumbnail
- games missing visits/playing/favorites/votes
- hourly rows written per run
- API error rate

## Deployment Shape

Suggested production setup:

- Supabase stores data and runs lightweight RPC/retention functions.
- Supabase Edge Functions handle small scheduled repair/check jobs.
- Northflank runs the main scraping, ranking, rollup, and enrichment workers.
- Local laptop is only for manual backfills or emergency repairs.

Multiple Northflank accounts/workers are okay later, but only after leases exist. More workers without leases will duplicate work and create noisy failures.

## Open Follow-ups

- Design exact queue/lease schema.
- Add missing indexes after checking real query plans.
- Decide partition strategy and migration path.
- Move GitHub stats workflows to Northflank cron jobs.
- Add job health tables and a simple status page/admin query.
- Add batch RPC for stats refresh writes.
- Add batch RPC for rank snapshot writes.
- Add API response caching policy for chart endpoints.
