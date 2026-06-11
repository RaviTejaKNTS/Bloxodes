# Supabase Stats Indexation And Read Model Audit

Audit window: 2026-06-11 11:15-11:25 UTC / 16:45-16:55 IST.

This document records the firsthand audit of the production Supabase stats schema, indexes, freshness, and how the public stats pages read data today.

## Evidence Checked

- Production Supabase project `bmwksaykcsndsvgspapz`.
- Live table counts and freshness for:
  - `roblox_universes`
  - `roblox_universe_stats_hourly`
  - `roblox_universe_stats_daily`
  - `roblox_universe_rank_snapshots_hourly`
  - `roblox_universe_rank_snapshots_daily`
  - `roblox_universe_update_events`
  - `stats_job_runs`
  - `revalidation_events`
- Live production indexes on stats tables.
- Local read layer:
  - `apps/web/src/lib/stats.ts`
  - `apps/web/src/app/(site)/stats/page.tsx`
  - `apps/web/src/app/(site)/stats/games/page.tsx`
  - `apps/web/src/app/(site)/stats/games/[slug]/page.tsx`
  - `apps/web/src/app/api/stats/games/route.ts`
  - `apps/web/src/app/api/stats/games/search/route.ts`
  - `apps/web/src/app/api/stats/games/[slug]/charts/route.ts`
  - `apps/web/src/app/api/stats/games/[slug]/rank-charts/route.ts`

## Current Production Tables

### `roblox_universes`

This is the main current-state table. The stats pages use it as the live read model for game name, slug, genre, icon, current playing, visits, favorites, likes, dislikes, rating, timestamps, and tier.

Production count: 95,651 rows.

Important live values at audit time:

- Rows with slug: 95,195.
- Rows with current playing: 94,869.
- Rows with `playing >= 1,000`: 1,206.
- Rows with `playing >= 5,000`: 218.
- Rows with `playing >= 5,000` and refreshed in the last 2 hours: 215.
- Rows with slug and refreshed in the last 2 hours: 4,657.
- Rows with icon: 7,705.

This table is fast and useful for "right now" reads, but it is not a complete precomputed stats index.

### `roblox_universe_stats_hourly`

This is the hourly time-series table.

Production count: 1,498,469 rows.

Latest hourly sample: 2026-06-11 11:00:00 UTC.

The table stores per-hour values and aggregates such as average playing, peak playing, min playing, visits, favorites, likes, dislikes, rating percent, sample count, and deltas.

Hourly row volume is uneven by hour. Recent hours were usually around 4,700 to 6,400 rows, with larger spikes around scheduled WARM/COLD/NEW refresh windows. This matches the tiered refresh design.

### `roblox_universe_stats_daily`

This is the daily rollup table.

Production count: 824,002 rows.

Latest daily stat date: 2026-06-10.

Daily rollups are finalized by Supabase cron at 00:20 UTC for the previous day. The daily playing value is the peak of the day, with average/min and deltas also stored.

### `roblox_universe_rank_snapshots_hourly`

This stores rank history for global, genre, and subgenre ranks.

Production count: 1,727,601 rows.

Latest hourly rank snapshot: 2026-06-11 10:00:00 UTC.

Observed issue: hourly rank rows are inconsistent by hour and rank type. The latest `global_playing` snapshot had only 5,000 rows. Earlier hours included larger `global_playing`, `genre_playing`, and `subgenre_playing` snapshots. This lines up with Northflank rank job failures and different rank-set/snapshot-scope runs.

### `roblox_universe_rank_snapshots_daily`

This stores daily rank history.

Production count: 635,643 rows.

Latest daily rank date: 2026-06-11.

Observed issue: the latest scheduled daily rank job on Northflank failed with a statement timeout during rank snapshot upsert. Daily rank data may be present from partial or previous runs, but the job is not reliably healthy.

### `roblox_universe_update_events`

Production count: 46,832 rows.

This records detected Roblox update events when `updated_at_api` advances during stats refresh.

### `stats_job_runs`

This table exists and has useful indexes, but production records only Supabase-side jobs:

- `stats-health-check`
- `hourly-history-prune`

It does not currently record VPS or Northflank job runs for discovery, enrichment, refresh, tiering, ranking, or revalidation enqueueing.

### `revalidation_events`

This is the shared public revalidation queue. At audit time, it had 637 rows at one check, mostly code/list/wiki events and no pending stats events.

This queue is important to stats freshness, but it is shared with other site workflows.

## Production Index State

The stats tables already have a strong set of indexes.

Important `roblox_universes` indexes include:

- Tier and refresh selection:
  - `idx_roblox_universes_stats_tier_refresh_v2`
  - `idx_roblox_universes_new_refresh_v2`
  - `idx_roblox_universes_stats_refresh_lease`
- Public stats sorting:
  - `idx_roblox_universes_stats_playing`
  - `idx_roblox_universes_stats_visits`
  - `idx_roblox_universes_stats_favorites`
  - `idx_roblox_universes_stats_created`
  - `idx_roblox_universes_stats_updated`
- Genre and subgenre sorting:
  - `idx_roblox_universes_genre_playing`
  - `idx_roblox_universes_subgenre_playing`
- Rank seed indexes:
  - `idx_roblox_universes_rank_playing_v2`
  - `idx_roblox_universes_rank_visits_v2`
  - `idx_roblox_universes_rank_favorites_v2`
  - `idx_roblox_universes_rank_rating_seed_v2`
  - `idx_roblox_universes_rank_genre_playing_v2`
  - `idx_roblox_universes_rank_subgenre_playing_v2`
- Search:
  - trigram indexes on display name and slug.

Important history and rank indexes include:

- `roblox_universe_stats_hourly` by `(universe_id, hour_start desc)`.
- `roblox_universe_stats_hourly` by hour and playing/peak.
- Hourly rank snapshots by universe/time and rank type/time.
- Daily rank snapshots by universe/date and rank type/date.

The database has enough indexing for direct current-state reads and targeted history lookups. The weaker part is not basic indexing; it is that some public views still compute global concepts from partial candidate windows.

## How Stats Pages Read Data Today

### `/stats`

The stats home reads mainly from `roblox_universes` plus hourly baseline data.

It builds:

- Top games right now by current `playing`.
- Most visited games by `visits`.
- Fastest risers by current playing plus 24-hour growth baseline.
- Trending genres from a limited set of top current games.
- Platform trend from selected top games and their hourly rows.

The page is server-rendered with `revalidate = 600`.

### `/stats/games`

The games list reads from `roblox_universes`.

Simple sorts such as playing, visits, favorites, created, and updated can use direct database orderings. Computed sorts such as 24-hour growth, 7-day growth, rating, and peak currently pull a candidate set and sort in application code.

Important limitation: computed sorts use a bounded candidate set, not all matching games globally. This is fast, but it means computed rankings can be incomplete.

The page is server-rendered with `revalidate = 600`.

### `/stats/games/[slug]`

The detail page reads one universe by slug or universe id, then loads:

- hourly chart data,
- daily chart data,
- rank chart data,
- update events,
- related games.

The page is server-rendered with `revalidate = 600`.

### Stats API Routes

The stats API routes are dynamic but set HTTP cache headers:

- Games list/search/summary: `max-age=60, stale-while-revalidate=300`.
- Charts and rank charts: `max-age=300, stale-while-revalidate=1800`.

These API caches are separate from Next page revalidation and need to be considered in freshness planning.

## What Is Working

- Current top games and current list pages can read quickly from indexed `roblox_universes`.
- Hourly chart data exists and is fresh.
- Daily stats rollups are running through Supabase cron.
- The database has indexes for the main current sort paths.
- The database has indexes for hourly and daily chart lookups.
- Rank snapshot tables exist and support rank history when rank jobs complete.
- The current-state table is updated directly by the refresh workflow, so the site has a fast live source for basic numbers.

## Holes And Risks

### No Dedicated Public Stats Read Model

The site currently uses `roblox_universes` as both the operational current-state table and the public stats read model.

This works for simple current sorts, but it makes harder views less reliable:

- Fastest risers need growth baselines.
- Trending genres need global aggregation.
- Computed list sorts need complete ranking.
- Freshness needs clear last-computed timestamps.

A dedicated read model would make the public pages simpler, faster, and more consistent.

### Computed Sorts Are Candidate-Limited

For list sorts such as growth, rating, and peak, the current code loads a limited candidate set and sorts in memory.

Current risk: a game outside the candidate window can be missing from a computed ranking even if it should appear globally.

### Trending Genres Are Based On A Limited Game Window

The current genre aggregation reads a limited set of top games by playing and aggregates from that subset.

Current risk: genre totals can be useful for a homepage preview, but they should not be treated as true platform-wide genre totals unless we create a complete genre index.

### Rank Snapshots Are Not Consistent Enough Yet

Hourly rank snapshots exist, but recent row counts vary heavily by hour and rank type. Daily rank jobs are also timing out.

Current risk: rank charts and rank-derived UI can show missing or stale history even when current playing values are fresh.

### Worker Health Is Not Indexed In Supabase

`stats_job_runs` is not populated by the main VPS/Northflank workers.

Current risk: pages and dashboards cannot tell whether a stale value is expected, recently failed, or never attempted without reading external logs.

### Lease Indexes Are Present But Unused

The database has refresh lease columns and indexes, but refresh scripts do not claim work with leases.

Current risk: as we scale workers, we can duplicate work or race on stale row selection.

## Recommended Read Model

The next version should keep `roblox_universes` as the source of latest universe state, but add stats-specific read models for public pages.

Recommended tables or materialized views:

### `stats_game_current_index`

One row per public stats game.

Suggested fields:

- universe id, root place id, slug, display name, icon.
- genre, subgenre.
- current playing, visits, favorites, rating, likes, dislikes.
- 1-hour, 24-hour, and 7-day baselines.
- absolute and percent movement.
- current global playing rank.
- current genre/subgenre rank.
- latest hourly sample.
- latest refresh timestamp.
- freshness status.

This would power `/stats`, `/stats/games`, and search/filter pages without candidate-limited computed sorts.

### `stats_genre_current_index`

One row per genre/subgenre bucket.

Suggested fields:

- genre/subgenre.
- total current playing.
- game count.
- top game ids.
- 24-hour movement.
- latest computed timestamp.

This would make Trending genres accurate and cheap.

### `stats_risers_current_index`

One row per game that qualifies for riser ranking.

Suggested fields:

- current playing.
- 24-hour baseline.
- absolute gain.
- percent gain.
- minimum playing threshold used.
- latest computed timestamp.

This avoids ranking risers from a small page candidate list and lets the UI explain the ranking honestly.

### `stats_job_runs`

Start writing every worker job run here:

- job name.
- environment: VPS, Northflank, Supabase cron.
- started/finished.
- status.
- rows scanned, rows updated, rows inserted.
- Roblox API error counts.
- Supabase error code/message.
- commit sha.
- log URL or external run id.

This should become the first place to check stats health.

## Recommended Direction

The indexing foundation is good, but the public stats product should move from "query live operational tables and compute some rankings in app code" to "write complete public read models during stats jobs and have pages read those models."

That will make Top games, Fastest risers, Trending genres, list sorting, chart availability, and revalidation much easier to reason about.

Detailed next changes are listed in `docs/stats/stats-workflow-next-changes.md`.
