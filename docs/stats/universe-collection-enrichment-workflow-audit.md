# Universe Collection And Enrichment Workflow Audit

Audit window: 2026-06-11 11:15-11:25 UTC / 16:45-16:55 IST.

This document records the firsthand audit of how Bloxodes discovers Roblox universes, enriches them, refreshes current stats, and assigns stats tiers. It is based on local code, production Supabase checks, Northflank job state, and VPS cron/log inspection.

## Evidence Checked

- Local scripts:
  - `scripts/universes/collect-roblox-universes.ts`
  - `scripts/universes/discover-universes-by-search.ts`
  - `scripts/universes/discover-universes-by-creators.ts`
  - `scripts/universes/discovery-utils.ts`
  - `scripts/universes/enrich-roblox-universes.ts`
  - `scripts/universes/update-universe-hourly-stats.ts`
  - `scripts/universes/assign-universe-stats-tier.ts`
  - `scripts/universes/stats-tier.ts`
  - `scripts/universes/audit-universe-stats.ts`
- Root `package.json` commands for collection, enrichment, refresh, tiering, audit, ranking, rollups, and revalidation enqueueing.
- Production Supabase project `bmwksaykcsndsvgspapz` table counts, freshness, indexes, cron jobs, and queue state.
- Northflank project `bloxodes`, jobs `stats-hot-hourly` and `stats-daily-ranks`.
- VPS host `srv1432019`, worker path `/home/codex-admin/bloxodes-stats-worker`, crontab, Docker wrapper scripts, and job logs.

## Current Pipeline

### 1. Discovery

There are three universe discovery sources.

`collect:universes` crawls Roblox Explore sorts across countries and devices. It inserts newly seen universes into `roblox_universes` with raw metadata, `last_seen_in_sort`, and many fields still null. It does not write hourly stats directly.

`discover:universes:search` uses Roblox search results to find more universes. It inserts candidates through `insertNewUniverseCandidates()`, which sets new rows to `stats_tier = 'NEW'` and tries to preserve root place and detail data when available.

`discover:universes:creators` uses creator game lists to find more universes. It also uses the shared candidate insert path and marks new rows as `NEW`.

### 2. Enrichment

`enrich:universes:light` fills basic display fields, slugs, root place data, icons, thumbnails, genre/subgenre, and core game details. It orders work by stale or null `last_light_enriched_at`.

`enrich:universes:deep` fills heavier metadata for selected rows, including Open Cloud metadata, social links, passes, badges, and creator/group data. It orders work by stale or null `last_deep_enriched_at`.

The enrichment merge logic intentionally preserves existing non-null values and keeps `slug` locked once assigned. This is good for URL stability.

Daily stats writes from enrichment are disabled by default unless `ROBLOX_ENRICH_WRITE_DAILY_STATS=true`. Normal stats history comes from the hourly refresh workflow.

### 3. Current Stats Refresh

`stats:refresh` and tier-specific aliases call `update-universe-hourly-stats.ts`.

That script reads `roblox_universes` by tier, prioritizing stale or never-refreshed rows, then fetches Roblox game detail and vote data. It writes the latest values back to `roblox_universes` and upserts an hourly sample into `roblox_universe_stats_hourly`.

The hourly row includes current and aggregate values such as playing average, playing peak, visits, favorites, likes, dislikes, rating percent, start/end values, and deltas. The script also records `roblox_universe_update_events` when Roblox `updated_at_api` changes.

### 4. Tier Assignment

`stats:tier` uses the rules in `stats-tier.ts`:

- `NEW`: never refreshed or missing useful stats.
- `HOT`: `playing >= 100` or `visits >= 250,000,000`.
- `WARM`: `playing >= 30` or `visits >= 10,000,000`.
- `COLD`: everything else.

The tier is used to decide how often rows are refreshed.

## Production Scheduling

### Northflank

`stats-hot-hourly`

- Schedule: `12 * * * *`.
- Concurrency policy: `Forbid`.
- Deadline: 5400 seconds.
- Deployed commit: `c02c50254ed6d374789d978eee47d8f9ba4c79e2`.
- Image source: `/Dockerfile.stats-worker` from the `production` branch.

The current run inspected at 2026-06-11 11:12 UTC refreshed HOT rows successfully and then started hourly rank snapshotting. Recent runs at 10:12, 09:12, 08:12, 07:12, 06:12, 05:12, and 04:12 failed, while 03:12 and 02:12 succeeded. Logs show the HOT refresh itself completing before the rank step begins, so the likely failure point is rank snapshotting or later chained work, not the live HOT stats fetch.

`stats-daily-ranks`

- Schedule: `50 0 * * *`.
- Concurrency policy: `Forbid`.
- Deadline: 5400 seconds.
- Deployed commit: `c02c50254ed6d374789d978eee47d8f9ba4c79e2`.

The 2026-06-11 scheduled run failed with Supabase/Postgres error `57014`, `canceling statement due to statement timeout`, during daily rank snapshot upsert after duplicate rank cleanup.

### VPS

The VPS worker uses `/home/codex-admin/bloxodes-stats-worker/bin/run-job.sh`, which runs the current production Docker image with `STATS_WORKER_COMMAND`. It uses `flock` per job name to avoid overlapping copies of the same job.

Current cron schedule:

```cron
5 0 * * * build stats worker image
7 */2 * * * stats-new-refresh
32 */12 * * * stats-warm-refresh
47 */6 * * * stats-cold-refresh
35 1 * * * stats-discovery
20 3 * * * stats-discovery-search
10 4 * * * stats-discovery-creators
5 5 * * * stats-deep-enrichment
10 */6 * * * stats-audit
```

The VPS repository and Docker image were on the same production commit observed in Northflank: `c02c50254ed6d374789d978eee47d8f9ba4c79e2`.

## Production Health Snapshot

At the Supabase check time:

| Table or metric | Value |
| --- | ---: |
| `roblox_universes` rows | 95,651 |
| Universes with slug | 95,195 |
| Universes with current playing | 94,869 |
| Universes with icon | 7,705 |
| `roblox_universe_stats_hourly` rows | 1,498,469 |
| `roblox_universe_stats_daily` rows | 824,002 |
| Latest `last_stats_refreshed_at` | 2026-06-11 11:12:14 UTC |
| Latest hourly sample | 2026-06-11 11:00:00 UTC |

Tier health:

| Tier | Rows | With slug | With icon | Never refreshed | Stale over 24h | Stale over 7d |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| HOT | 4,854 | 4,698 | 4,018 | 0 | 71 | 50 |
| WARM | 9,493 | 9,416 | 2,268 | 0 | 103 | 94 |
| COLD | 79,441 | 79,235 | 1,229 | 0 | 40,790 | 84 |
| NEW | 1,863 | 1,846 | 190 | 1,663 | 1,863 | 1,863 |

The biggest health issue is the `NEW` tier. It is being processed by the VPS every two hours, but most rows remain never refreshed, stale, and without icons.

## What Is Working

- The main current stats refresh path is functional. Production had fresh `roblox_universes` values and an hourly sample for 2026-06-11 11:00 UTC.
- HOT refresh can complete and update live data before the Northflank job failure point.
- WARM and COLD VPS refresh jobs are running and recently completed successfully.
- Explore discovery is running daily and inserts or updates candidates.
- Light enrichment is being run after discovery and during NEW refresh.
- Deep enrichment for HOT games is completing, despite noisy warnings from some Roblox endpoints.
- Tiered scheduling is in place and prevents every universe from being refreshed at the same frequency.
- `run-job.sh` uses per-job locks, so duplicate VPS cron copies of the same job are avoided.

## Holes And Risks

### Search Discovery Is Currently Blocked

`stats-discovery-search` failed on June 9, June 10, and June 11. It failed on the first query, `anime`, after Roblox omni-search returned repeated 429 responses.

Current risk: one rate-limited search query can fail the entire search discovery job, so this source is effectively down.

### Creator Discovery Is Currently Blocked

`stats-discovery-creators` failed on June 9, June 10, and June 11 with a Roblox API validation error:

```text
Allowed values: 10, 25, 50
```

The script is sending a limit value Roblox rejects for the creator games endpoint.

Current risk: creator-based discovery is effectively down until the limit is clamped to the allowed values.

### NEW Tier Is Stuck

The `NEW` tier has 1,863 rows, 1,663 of which were never refreshed. The VPS `stats-new-refresh` job runs every two hours and finishes, but `stats:tier --tier NEW` recently changed 0 rows.

This means a large set of discovered rows is not moving into HOT, WARM, or COLD. Possible causes include invalid/unreachable root places, missing Roblox detail responses, private/deleted universes, or rows that remain too incomplete after enrichment.

Current risk: discovery keeps adding rows, but a chunk of them never becomes useful stats inventory.

### HOT Job Failure Can Hide Behind Fresh Live Data

Northflank `stats-hot-hourly` logs show HOT refresh can finish, then the chained rank step starts. The job still reports failure if the later step fails. This can create two separate problems:

- Live current stats can be fresh while the job status says failed.
- Revalidation or downstream steps can be skipped if they are chained after the failing rank step.

Current risk: current numbers update, but rank snapshots and page freshness drift.

### Worker Runs Are Not Recorded In `stats_job_runs`

The production `stats_job_runs` table currently contains records for Supabase-side health and prune functions, not the VPS or Northflank jobs.

Current risk: the database has no single authoritative view of whether collection, enrichment, refresh, tiering, and ranking jobs succeeded. The only complete evidence is split across Northflank logs and VPS log files.

### Lease Columns Exist But Scripts Do Not Use Them

Production indexes include refresh lease support on `roblox_universes`, but the current refresh scripts select stale rows directly and do not claim rows with a lease before work.

Current risk: if we add more workers or split jobs further, duplicate work and inconsistent row selection become more likely.

### Some Roblox Endpoint Failures Are Expected But Noisy

Deep enrichment logs show many group fetch 429 warnings and game pass 404 warnings. Explore crawl also hits 404s for some sort/country/device combinations such as `try-voice-chat`.

Current risk: real failures are harder to spot, and repeated known-bad requests waste job time.

## Recommended Direction

The workflow is close to the right shape, but it needs sharper separation and observability:

- Split collection, enrichment, current refresh, rank generation, and revalidation into independently observable jobs.
- Record every job run in `stats_job_runs` with counts and errors.
- Fix the two broken discovery jobs.
- Add a repair path for stuck `NEW` rows.
- Use row leases or an explicit job queue before scaling workers.
- Let current stats refresh revalidate pages even if rank generation fails.

Detailed next changes are listed in `docs/stats/stats-workflow-next-changes.md`.
