# Stats Workflow Next Changes

Audit window: 2026-06-11 11:15-11:25 UTC / 16:45-16:55 IST.

This is the implementation plan produced from the firsthand audit of collection/enrichment, Supabase indexing/read models, and revalidation.

## Goal

Make stats reliable enough that:

- every public number has a clear source,
- every public list is ranked from the correct population,
- refresh jobs are observable from Supabase,
- failed rank jobs do not block live stats freshness,
- revalidation reaches all stats pages and important query variants,
- stale data can be explained quickly from one health view.

## P0: Fix Active Breakages

### 1. Split HOT Refresh From Rank Generation

Problem: Northflank `stats-hot-hourly` often fails after HOT current stats refresh completes, likely during rank snapshotting or later chained work.

Change:

- Run HOT current refresh as its own job.
- Run hourly rank snapshots as a separate job.
- Enqueue `stats:stats` and `stats:games` immediately after successful HOT current refresh.
- Let rank failure mark only rank health, not current stats health.

Why this matters: Top games and current playing can stay fresh even when rank history needs repair.

### 2. Fix Daily Rank Statement Timeouts

Problem: `stats-daily-ranks` failed with Postgres `57014` statement timeout during daily rank snapshot upsert.

Change:

- Stop running every rank type and full snapshot scope in one large daily job.
- Split daily rank jobs by rank set or scope.
- Reduce upsert chunk size.
- Consider DB-side ranking functions that write in smaller deterministic batches.
- Add duplicate cleanup that targets only the affected snapshot/rank type before upsert.

Why this matters: rank charts and historical rank sections cannot be trusted if daily rank jobs fail regularly.

### 3. Fix Creator Discovery Limit

Problem: `stats-discovery-creators` is failing because Roblox rejects the requested creator games limit. Roblox allows `10`, `25`, or `50`.

Change:

- Clamp the creator games request limit to one of the allowed values.
- Add validation before the request is made.
- Keep processing other creators if one creator fails.

Why this matters: one bad request setting has disabled a whole discovery source.

### 4. Make Search Discovery Resilient To 429s

Problem: `stats-discovery-search` fails on the first query after repeated Roblox 429 responses.

Change:

- Do not fail the whole job when one query is rate-limited.
- Rotate or shuffle query order.
- Add per-query backoff and skip-to-next behavior.
- Save progress so the next run does not keep retrying the same blocked query first.

Why this matters: search discovery is currently down because the first query can block the entire run.

### 5. Add Worker Job Run Recording

Problem: `stats_job_runs` does not record VPS or Northflank worker jobs.

Change:

- Add a shared helper used by all stats scripts or wrapper jobs.
- Record start, finish, status, duration, commit sha, environment, rows scanned, rows updated, rows inserted, and error details.
- Use the table for collection, enrichment, refresh, tiering, rollup, ranking, audit, and revalidation enqueue jobs.

Why this matters: production health should not require reading Northflank and VPS logs by hand.

### 6. Make Revalidation Queue Outcomes Visible

Problem: Supabase cron can succeed even when the actual Edge Function times out.

Change:

- Record Edge Function attempts in a table.
- Include request id, batch size, processed count, failed count, status code, duration, and timeout/error text.
- Alert on repeated timeouts, old queue age, or old stats events.
- Reduce queue batch size until timeouts stop.

Why this matters: freshness failures are currently too easy to miss.

## P1: Make Rankings And Lists Correct

### 7. Add A Public Stats Current Index

Problem: public pages query `roblox_universes` directly and compute some global concepts from partial candidate windows.

Change:

Create a `stats_game_current_index` table or materialized view with:

- universe id, root place id, slug, display name, icon.
- genre and subgenre.
- current playing, visits, favorites, likes, dislikes, rating.
- latest refresh timestamp and freshness status.
- 1-hour, 24-hour, and 7-day baselines.
- absolute and percent movement.
- global, genre, and subgenre ranks.

Why this matters: Top games, Fastest risers, list sorting, and detail summaries can all read from the same complete source.

### 8. Add A Genre Current Index

Problem: Trending genres are currently aggregated from a limited top-game window.

Change:

Create `stats_genre_current_index` with:

- genre/subgenre.
- total current playing.
- tracked game count.
- top games.
- 24-hour movement.
- latest computed timestamp.

Why this matters: Trending genres should be a real indexed stat, not a homepage approximation.

### 9. Add A Risers Current Index

Problem: Fastest risers should rank from all eligible games, not a small candidate subset.

Change:

Create `stats_risers_current_index` with:

- current playing.
- 24-hour baseline.
- absolute gain.
- percent gain.
- eligibility threshold.
- computed timestamp.

Recommended ranking rule:

- Require a meaningful current audience, such as `playing >= 1,000`.
- Rank by a blended or guarded score that values real absolute growth and avoids tiny-game percent spikes.
- Display current playing and 24-hour movement from the same computed row.

Why this matters: this keeps Fastest risers useful without letting small games dominate only because their percentage change is large.

### 10. Replace Candidate-Limited Computed Sorts

Problem: `/stats/games` computed sorts such as growth, rating, and peak are currently sorted after loading a bounded candidate set.

Change:

- Use precomputed columns or index tables for these sort modes.
- Make pagination happen after the global sort, not before or after a partial candidate load.

Why this matters: page 2, filters, and alternate sorts should be globally correct.

### 11. Repair The NEW Tier

Problem: 1,663 NEW rows were never refreshed, and the NEW job is not promoting them.

Change:

- Build an audit query/script for NEW rows grouped by reason:
  - missing root place,
  - Roblox detail unavailable,
  - private/deleted,
  - no stats returned,
  - enrichment failed,
  - slug missing,
  - valid but below thresholds.
- Add explicit statuses for invalid/unreachable rows instead of keeping them forever as NEW.
- Retry repairable rows with better root-place resolution.
- Promote valid rows to HOT/WARM/COLD after first successful refresh.

Why this matters: discovery quality depends on NEW being a short-lived intake state, not a permanent holding area.

### 12. Use Refresh Leases Before Scaling Workers

Problem: production has lease columns/indexes, but scripts do not use them.

Change:

- Add a row-claim step for stats refresh jobs.
- Set lease owner and expiry before making Roblox calls.
- Release or expire leases after success/failure.

Why this matters: this allows safe parallel workers and avoids duplicate refresh work.

## P1: Make Revalidation Complete

### 13. Revalidate Stats Immediately After Current Writes

Problem: chained job failures can prevent revalidation from being queued.

Change:

- Enqueue broad stats events after the current stats refresh step succeeds.
- Run ranking and enrichment follow-ups separately.
- Ensure each job records whether it enqueued revalidation.

Why this matters: public pages should not wait for rank jobs before showing fresh current playing numbers.

### 14. Cover `/stats/games` Query Variants

Problem: only `/stats/games` is explicitly revalidated, but the route has query states such as page, sort, genre, and minPlayers.

Change options:

- Prefer dynamic/no-store for highly variable list query states while keeping short CDN cache.
- Or explicitly purge Cloudflare with query-string coverage.
- Or make the route read from a short-lived API/cache layer with clear TTL.

Why this matters: page 1 and page 2 should not disagree after the same refresh.

### 15. Enqueue Detail Events For Important Changed Games

Problem: `stats:games/<slug>` exists but is not broadly used by stats workers.

Change:

- After refresh, identify top games and materially changed games.
- Enqueue detail revalidation for those slugs.
- Keep a cap per run so detail revalidation does not flood the queue.

Why this matters: game detail pages should update quickly when their own charts/ranks/current stats change.

### 16. Separate Or Prioritize Stats Revalidation

Problem: stats events share a queue with all public content.

Change options:

- Add priority to `revalidation_events`.
- Process stats events first.
- Add a separate stats revalidation queue.
- Run a dedicated stats queue worker more frequently.

Why this matters: live stats should not wait behind a large unrelated content publishing burst.

## P2: Reduce Noise And Improve Operations

### 17. Filter Known-Bad Explore Sorts

Problem: Explore discovery repeatedly hits known 404 combinations such as some `try-voice-chat` sort/country/device requests.

Change:

- Track sort/country/device failures.
- Skip combinations that consistently return 404.
- Keep a small periodic retry window in case Roblox changes availability.

### 18. Classify Expected Deep Enrichment Failures

Problem: group 429s and game pass 404s are noisy in deep enrichment logs.

Change:

- Count expected 404s separately from real errors.
- Add per-endpoint rate-limit counters.
- Keep logs concise unless a threshold is crossed.

### 19. Add A Stats Health Dashboard

Problem: the workflow can only be understood by checking multiple systems.

Change:

Build a health page or internal query that shows:

- latest successful run per job,
- latest failure per job,
- oldest pending revalidation event,
- current queue size,
- latest hourly stat sample,
- latest hourly/daily rank snapshot,
- tier counts,
- stale counts by tier,
- NEW stuck count,
- API error rate,
- current deployed commit per worker environment.

### 20. Alert On Freshness SLOs

Suggested alerts:

- HOT latest refresh older than 90 minutes.
- WARM latest refresh older than 14 hours.
- COLD latest refresh older than 7 days.
- Latest hourly stat sample older than 2 hours.
- Latest hourly rank snapshot older than 3 hours.
- Revalidation queue oldest event older than 15 minutes.
- Any stats job failing 2 runs in a row.
- NEW never-refreshed count above a fixed threshold.

## Suggested Build Order

1. Fix creator discovery and search discovery so intake works again.
2. Split HOT current refresh from rank generation and enqueue revalidation after current refresh.
3. Add worker run recording to `stats_job_runs`.
4. Fix daily/hourly rank timeouts with smaller scoped rank jobs.
5. Add revalidation attempt logging and reduce queue batch timeout risk.
6. Build `stats_game_current_index`.
7. Move `/stats` and `/stats/games` to the new index.
8. Add genre and riser indexes.
9. Repair or expire stuck NEW rows.
10. Add dashboard and alerts.

## Definition Of Done

The stats workflow should be considered healthy when:

- HOT current stats refresh succeeds every hour.
- WARM and COLD refresh jobs meet their tier freshness windows.
- NEW rows either promote, repair, or become explicitly invalid within a small number of runs.
- hourly and daily rank snapshots complete on schedule.
- `/stats`, `/stats/games`, and top detail pages revalidate after every current stats refresh.
- page 1, page 2, alternate sorts, and detail pages agree about the same data source.
- all worker jobs appear in `stats_job_runs`.
- revalidation attempts and failures are visible without checking raw Supabase network tables.
