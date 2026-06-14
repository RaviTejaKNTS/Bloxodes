# Stats Production Automation Plan

This is the concrete operating plan for Roblox stats automation as the dataset grows from the current 95K universes toward 500K-2M+ universes.

Keep metric meaning in `docs/stats/metric-contract.md`.
Keep chart UI ideas in `docs/stats/chart-feature-followup-plan.md`.
Keep broad scale notes in `docs/stats/scale-optimization-plan.md`.

## Final Direction

Use three compute layers:

| Layer | Use for | Do not use for |
| --- | --- | --- |
| Supabase Cron + Edge Functions | short dispatch jobs, database-local jobs, health checks, revalidation drain | Roblox scraping, long crawlers, heavy ranking |
| Northflank | HOT hourly freshness and rank snapshots | all slow backlog jobs on the free plan |
| VPS worker | NEW, WARM, COLD, enrichment, audits, slower backlog jobs | work inside the public web container |

Do not rely on multiple free Northflank accounts. Northflank requires a payment method to create resources and the free Developer Sandbox only allows 2 jobs, 2 services, and 1 addon. It is useful as a bridge, not the full production platform.

Supabase Edge Functions are also not long-job workers. Hosted limits are 256 MB memory, 150s wall-clock on free, 400s on paid, and small CPU limits. Use them as scheduler/dispatcher glue, not as crawlers.

## Current Deployment State

As of this setup pass:

- Production Supabase has migration `20260915000008_stats_production_automation.sql` applied.
- Production Supabase has `stats_job_runs`, stats lease columns, scale indexes, health/prune functions, and Supabase cron schedules for health, daily rollup, and hourly-history pruning.
- Northflank account `_1` has two cron jobs in project `bloxodes`:
  - `stats-hot-hourly`
  - `stats-daily-ranks`
- Both Northflank jobs successfully built from commit `eb80aef9dc6aa556f90062e921c4cf2c18bd56d3`.
- Both Northflank jobs have production runtime env set in Northflank and automatic cron scheduling enabled.
- `stats-hot-hourly` runs at `12 * * * *` UTC with `Forbid` concurrency.
- `stats-daily-ranks` runs at `50 0 * * *` UTC with `Forbid` concurrency.
- One-off Northflank audit override runs succeeded after activation:
  - `stats-hot-hourly`: `2026-06-06T09:44:08Z` to `2026-06-06T09:45:08Z`
  - `stats-daily-ranks`: `2026-06-06T09:44:12Z` to `2026-06-06T09:45:07Z`
- The VPS has a separate user-level Docker worker under:
  - `/home/codex-admin/bloxodes-stats-worker`
- The VPS worker image `bloxodes-stats-worker:production` has been built from the `production` branch.
- The VPS user crontab has the marked `BLOXODES_STATS_WORKER` block for NEW, WARM, COLD, discovery, deep enrichment, audit, and daily worker image refresh.
- A manual VPS `stats:audit` run succeeded against production.

The Northflank `_1` secret upload was explicitly approved in-thread before activation.

References:

- https://supabase.com/docs/guides/functions/limits
- https://supabase.com/docs/guides/cron
- https://northflank.com/docs/v1/application/billing/pricing-on-northflank

## Production Database Connection

All production workers must point at the production Supabase project, not local Supabase.

Required runtime env:

```txt
SUPABASE_URL=https://<prod-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE=<prod-service-role>
SUPABASE_MEDIA_BUCKET=bloxodes-media
```

Optional env by job:

```txt
ROBLOX_OPEN_CLOUD_API_KEY=<for deep enrichment>
REVALIDATE_ENDPOINT=https://bloxodes.com/api/revalidate
REVALIDATE_SECRET=<prod revalidate secret>
```

Rules:

- Never commit production secrets.
- Store secrets in Northflank, Dokploy/VPS worker env, or Supabase function secrets.
- Do not upload `SUPABASE_SERVICE_ROLE` to a new external account unless the account is meant to write to production.
- Before enabling a new worker, run it with a tiny limit against prod first.

Prod smoke commands:

```bash
npm run stats:audit
npm run stats:refresh -- --tier HOT --limit 10
npm run stats:rank -- --all --granularity hourly --rank-set playing --snapshot-scope relevant --limit 100
```

## Supabase Jobs

Use Supabase for jobs that finish quickly or run entirely in the database.

| Job | Schedule UTC | Type | Command / action | Outcome |
| --- | --- | --- | --- | --- |
| `revalidate-drain` | every 2-5 min | Edge Function | `supabase/functions/revalidate` | Drains `revalidation_events` and calls `https://bloxodes.com/api/revalidate`. |
| `stats-health-check` | every 15 min | Edge Function or SQL | query tier stale counts and recent job runs | Detects stale HOT/WARM/COLD queues early. |
| `daily-rollup-finalize` | `20 0 * * *` | SQL/RPC | `select public.rollup_roblox_universe_stats_daily(current_date - 1, true);` | Finalizes yesterday's daily stats from hourly rows. |
| `hourly-history-prune` | `25 1 * * *` | SQL/RPC | call `public.prune_roblox_universe_hourly_history` in bounded batches | Deletes hourly stats/ranks older than 90 days. |
| `stats-revalidation-nudge` | after heavy jobs | SQL insert or script | insert coalesced `stats:stats` and `stats:games` events | Keeps public pages fresh without every worker calling the app directly. |

Supabase jobs should not call Roblox APIs in large loops. If a job needs network calls to Roblox for thousands of universes, it belongs on Northflank or the VPS worker.

## Northflank Jobs

Use the one verified Northflank account for the most important freshness path.

Use repo branch:

```txt
production
```

Use Dockerfile:

```txt
/Dockerfile.stats-worker
```

The Dockerfile reads `STATS_WORKER_COMMAND`, so each job can use the same image with a different command.

| Job | Schedule UTC | Deadline | Command |
| --- | --- | --- | --- |
| `stats-hot-hourly` | `12 * * * *` | 90 min | `npm run stats:refresh -- --tier HOT --limit 10000 && npm run stats:rank -- --all --granularity hourly --rank-set playing --snapshot-scope relevant && npm run enqueue:revalidation -- --source stats_hot_northflank --event stats:stats --event stats:games` |
| `stats-daily-ranks` | `50 0 * * *` | 90 min | `npm run stats:rank -- --all --granularity daily --rank-set all --snapshot-scope all && npm run enqueue:revalidation -- --source stats_daily_ranks_northflank --event stats:games` |

Recommended Northflank env:

```txt
NODE_ENV=production
SUPABASE_URL=<prod>
SUPABASE_SERVICE_ROLE=<prod service role>
UNIVERSE_HOURLY_STATS_BATCH_SIZE=50
UNIVERSE_HOURLY_STATS_REQUEST_DELAY_MS=1200
UNIVERSE_RANK_PAGE_SIZE=1000
UNIVERSE_RANK_UPSERT_CHUNK_SIZE=5000
```

Keep concurrency policy as `Forbid` so a slow run does not overlap the next run.

## VPS Worker Jobs

The VPS already serves the public web app through Dokploy, Traefik, and Cloudflare. Do not run these jobs inside the public Next.js app container.

Create a separate non-public worker on the VPS:

```txt
name: bloxodes-stats-worker
source: RaviTejaKNTS/Bloxodes
branch: production
dockerfile: /Dockerfile.stats-worker
public domain: none
env: production Supabase service env
```

Run jobs as separate scheduled worker invocations, not one forever-running script. If Dokploy scheduled jobs are not enough, use host `systemd` timers or cron to start short-lived Docker runs from the worker image.

| Job | Schedule UTC | Command | Notes |
| --- | --- | --- | --- |
| `stats-new-refresh` | `7 */2 * * *` | `npm run enrich:universes:light -- --tier NEW --limit 1000 --batch 25 && npm run stats:refresh:new -- --limit 5000 && npm run stats:tier -- --tier NEW && npm run enqueue:revalidation -- --source stats_new_vps --event stats:stats --event stats:games` | Moves new games into HOT/WARM/COLD quickly. |
| `stats-discovery-priority` | `22 * * * *` | `npm run discover:universes:priority && npm run enrich:universes:light -- --tier NEW --limit 500 --batch 25 && npm run stats:refresh:new -- --limit 1000 && npm run stats:tier -- --tier NEW && npm run enrich:universes:light -- --tier HOT --limit 250 --batch 25 && npm run enqueue:revalidation -- --source stats_discovery_priority_vps --event stats:stats --event stats:games` | Catches breakout games from top-playing/trending/up-and-coming Explore sorts quickly. |
| `stats-warm-refresh` | `32 */12 * * *` | `npm run stats:refresh:warm -- --limit 20000 && npm run stats:tier -- --tier WARM && npm run enqueue:revalidation -- --source stats_warm_vps --event stats:stats --event stats:games` | Separate from COLD so it does not get trapped behind slow backlog. |
| `stats-cold-refresh` | `47 */6 * * *` | `npm run stats:refresh:cold -- --limit 10000 && npm run stats:tier -- --tier COLD && npm run enqueue:revalidation -- --source stats_cold_vps --event stats:stats --event stats:games` | Rotating backlog. Tune limit based on API rate and VPS load. |
| `stats-discovery` | `35 1 * * *` | `npm run collect:universes && npm run enrich:universes:light -- --tier NEW --limit 1000 --batch 25` | Grows the universe table without blocking HOT freshness. |
| `stats-deep-enrichment` | `5 2 * * *` | `npm run enrich:universes:deep -- --tier HOT --limit 500 --batch 25` | Requires `ROBLOX_OPEN_CLOUD_API_KEY`. Keep conservative. |
| `stats-audit` | `10 */6 * * *` | `npm run stats:audit` | Read/report health. Later write to a job-health table. |

VPS safety rules:

- Give the worker container CPU and memory limits.
- Keep worker logs separate from the web app.
- Do not run multiple heavy jobs at the same time.
- Prefer off-peak schedules for discovery, COLD, and deep enrichment.
- If public web latency or memory rises, reduce worker limits first.

## Job Ownership

| Workflow area | Owner compute | Reason |
| --- | --- | --- |
| HOT hourly stats | Northflank | most important freshness path |
| hourly playing rank | Northflank | follows HOT update and powers rank chart |
| NEW refresh | VPS worker | important but can lag slightly |
| WARM refresh | VPS worker | medium backlog |
| COLD refresh | VPS worker | slow rotating backlog |
| discovery | VPS worker | can run off-peak |
| deep enrichment | VPS worker | API-sensitive, not critical for instant freshness |
| daily rollup | Supabase SQL/RPC | database-local, no Roblox network |
| daily ranks | Northflank | all-game rank compute can be long |
| hourly prune | Supabase SQL/RPC | database-local cleanup |
| revalidation drain | Supabase Edge Function | already queue based |
| health checks | Supabase Edge Function | small and frequent |

## Required Schema Work Before Heavy Scale

Do this before running multiple workers or expanding to hundreds of thousands of games.

### 1. Worker Lease Fields

Add lease fields to `roblox_universes` or a dedicated queue table.

Recommended fields on `roblox_universes`:

```txt
next_stats_refresh_at timestamptz
stats_refresh_locked_at timestamptz
stats_refresh_locked_by text
stats_refresh_attempt_count integer default 0
last_stats_refresh_error text
```

Worker claim flow:

1. Atomically claim rows where `next_stats_refresh_at <= now()` and lock is empty or expired.
2. Mark `stats_refresh_locked_by`.
3. Refresh Roblox data.
4. Upsert hourly stats and update latest universe stats.
5. Set the next refresh time based on the new tier.
6. Clear the lock.

Locks should expire after about 30-60 minutes.

### 2. Batch RPC Writes

Move hot write paths from many Supabase client calls into database functions.

Needed RPCs:

```txt
claim_roblox_universe_stats_batch(tier, limit, worker_id)
upsert_roblox_universe_stats_batch(jsonb payload)
upsert_roblox_universe_rank_snapshots_batch(jsonb payload)
complete_roblox_universe_stats_batch(jsonb results)
```

The current schema already has single-row `upsert_roblox_universe_stats_hourly`. The next step is batch-level RPC so workers make fewer network calls.

### 3. Job Health Table

Add a small job table before more automation:

```txt
stats_job_runs
- id uuid primary key
- job_name text not null
- worker_id text
- started_at timestamptz not null
- finished_at timestamptz
- status text not null
- rows_claimed integer default 0
- rows_succeeded integer default 0
- rows_failed integer default 0
- error text
- metadata jsonb default '{}'
```

Use this for the Supabase health check and for human debugging.

## Index Plan

Add indexes only around real read/write paths. Verify with `EXPLAIN ANALYZE` after each migration.

Use normal `CREATE INDEX` in migrations when tables are still small enough. For very large production tables, create indexes in a controlled maintenance window or use an out-of-transaction concurrent index process.

### Tier Selection

Used by `stats:refresh:*`.

```sql
create index if not exists idx_roblox_universes_stats_tier_refresh
on public.roblox_universes (
  stats_tier,
  last_stats_refreshed_at asc nulls first,
  last_playing_refreshed_at asc nulls first,
  playing desc nulls last,
  visits desc nulls last,
  universe_id
)
where root_place_id is not null;
```

```sql
create index if not exists idx_roblox_universes_new_refresh
on public.roblox_universes (
  last_stats_refreshed_at asc nulls first,
  universe_id
)
where root_place_id is not null
  and (
    stats_tier = 'NEW'
    or last_stats_refreshed_at is null
    or playing is null
    or visits is null
  );
```

### Rank Computation

Used by `stats:rank`.

```sql
create index if not exists idx_roblox_universes_rank_playing
on public.roblox_universes (playing desc nulls last, universe_id)
where playing is not null and (stats_tier is null or stats_tier <> 'NEW');
```

```sql
create index if not exists idx_roblox_universes_rank_visits
on public.roblox_universes (visits desc nulls last, universe_id)
where visits is not null and (stats_tier is null or stats_tier <> 'NEW');
```

```sql
create index if not exists idx_roblox_universes_rank_favorites
on public.roblox_universes (favorites desc nulls last, universe_id)
where favorites is not null and (stats_tier is null or stats_tier <> 'NEW');
```

```sql
create index if not exists idx_roblox_universes_rank_rating_seed
on public.roblox_universes (likes desc nulls last, universe_id)
where likes is not null and (stats_tier is null or stats_tier <> 'NEW');
```

```sql
create index if not exists idx_roblox_universes_genre_playing_rank
on public.roblox_universes (genre_l1, playing desc nulls last, universe_id)
where genre_l1 is not null and playing is not null and (stats_tier is null or stats_tier <> 'NEW');
```

```sql
create index if not exists idx_roblox_universes_subgenre_playing_rank
on public.roblox_universes (genre_l2, playing desc nulls last, universe_id)
where genre_l2 is not null and playing is not null and (stats_tier is null or stats_tier <> 'NEW');
```

### Chart Reads

Metric chart reads should be covered by:

```sql
create index if not exists idx_roblox_universe_stats_hourly_universe_hour_desc
on public.roblox_universe_stats_hourly (universe_id, hour_start desc);
```

```sql
create index if not exists idx_roblox_universe_stats_daily_universe_date_desc
on public.roblox_universe_stats_daily (universe_id, stat_date desc);
```

Rank chart reads:

```sql
create index if not exists idx_roblox_rank_hourly_universe_type_hour
on public.roblox_universe_rank_snapshots_hourly (universe_id, rank_type, hour_start desc);
```

```sql
create index if not exists idx_roblox_rank_daily_universe_type_date
on public.roblox_universe_rank_snapshots_daily (universe_id, rank_type, stat_date desc);
```

Update overlays:

```sql
create index if not exists idx_roblox_universe_update_events_universe_time
on public.roblox_universe_update_events (universe_id, updated_at_api desc);
```

Event overlays:

```sql
create index if not exists idx_roblox_virtual_events_universe_range
on public.roblox_virtual_events (universe_id, start_utc, end_utc);
```

### Cleanup

Used by hourly retention.

```sql
create index if not exists idx_roblox_rank_hourly_hour
on public.roblox_universe_rank_snapshots_hourly (hour_start);
```

```sql
create index if not exists idx_roblox_stats_hourly_hour
on public.roblox_universe_stats_hourly (hour_start);
```

### Compare Search

For compare-game search, enable trigram search only if needed:

```sql
create extension if not exists pg_trgm with schema extensions;
```

```sql
create index if not exists idx_roblox_universes_display_name_trgm
on public.roblox_universes
using gin (display_name extensions.gin_trgm_ops);
```

```sql
create index if not exists idx_roblox_universes_slug_trgm
on public.roblox_universes
using gin (slug extensions.gin_trgm_ops);
```

If Supabase rejects `extensions.gin_trgm_ops` syntax in a migration, use the exact operator class form that matches the extension schema in production.

## Retention

Keep:

- `roblox_universe_stats_daily`
- `roblox_universe_rank_snapshots_daily`
- `roblox_universe_update_events`
- `roblox_universe_media`

Prune after 90 days:

- `roblox_universe_stats_hourly`
- `roblox_universe_rank_snapshots_hourly`

Do not prune daily history just because the public UI only shows 90 days today. Daily history is cheap compared with hourly history and can power future long-range pages.

## Partitioning Later

Before 500K+ games with real hourly rows, partition:

- `roblox_universe_stats_hourly`
- `roblox_universe_rank_snapshots_hourly`

Use monthly partitions first. Once partitioned, retention should drop old partitions instead of deleting rows in batches.

## Rollout Order

1. Add job health table.
2. Add tier/chart/rank indexes.
3. Add lease fields and claim RPC.
4. Move HOT hourly worker to Northflank.
5. Move revalidation, rollup, prune, and health checks to Supabase Cron/Edge.
6. Create the separate VPS worker app/container.
7. Move NEW/WARM/COLD/discovery/enrichment to VPS worker.
8. Add batch stats/rank RPCs.
9. Add table partitioning for hourly tables.
10. Monitor Northflank/VPS run durations and tune limits as universe volume grows.

## Verification Checklist

Before declaring production automation healthy:

- `stats-hot-hourly` writes new hourly rows for HOT games.
- HOT games are not stale by more than 90 minutes.
- WARM games refresh within 12-14 hours.
- COLD rotation lag is visible in audit output.
- Daily rollup writes yesterday rows.
- Daily rank snapshots write all rank types.
- Hourly prune deletes old hourly metric and rank rows.
- Revalidation events are queued after stats jobs.
- `/stats` and `/stats/games/<slug>` show fresh production data.
- Worker logs show no overlapping runs for the same job.
- `stats_job_runs` records success/failure counts.
