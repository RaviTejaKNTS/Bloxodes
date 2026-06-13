# Pending Work: Roblox Universe Name Backfill

## Goal

Clean `roblox_universes.display_name` and `roblox_universes.slug` so public stats pages use stable, clean game names.

- Keep `name` as the raw Roblox source title.
- Remove full bracket, brace, and parenthesis groups from `display_name`, including the text inside.
- Generate stats slugs as `<clean-name>-<universe_id>`.
- Fill missing `display_name` and `slug` values.

## Script

Primary script:

```bash
npm run backfill:universe-display-names
```

Production apply shape used:

```bash
NODE_ENV=production npm run backfill:universe-display-names -- --apply --allow-prod
```

Resume point after the partial run:

```bash
NODE_ENV=production npm run backfill:universe-display-names -- --apply --allow-prod --min-universe-id 9273264061
```

## Completed Work

- Updated the local cleaner so `[]`, `{}`, and `()` groups are removed with their full contents.
- Updated universe insert/enrichment paths to generate ID-suffixed stats slugs.
- Extended the backfill script to repair both `display_name` and `slug`.
- Added resume support through `--min-universe-id`.
- Ran production dry-run:
  - `scanned=96436`
  - `updates=96212`
  - `display_dirty=24784`
  - `display_missing=3483`
  - `slug_dirty=95620`
  - `slug_missing=592`
- Production apply completed at least `62000` row updates before the job hit DB/API pressure.
- A few additional high-ID rows were fixed during resume attempts.

## Current State

The backfill is partially complete. The remaining work starts around:

```text
universe_id >= 9273264061
```

Approximate remaining work:

```text
~34000 rows
```

This estimate is based on the dry-run total (`96212`) minus the confirmed production apply progress (`62000`) plus small follow-up batches.

## Why It Was Paused

The issue appears to be database resource pressure, not bad script logic.

During the run, Supabase began timing out or hanging on:

- Large reads from `roblox_universes`.
- Row-by-row updates.
- Whole-table verification counts.
- Small resumed batches after the first large partial update.

The project is currently on a small production compute shape. The dashboard showed high CPU peaks, sustained high memory usage, and limited baseline disk IO. With the newer stats workload, large update jobs now compete with regular stats reads, refresh jobs, revalidation triggers, and index maintenance.

## Likely Bottlenecks

- Stats expansion increased read/write pressure on `roblox_universes` and related stats tables.
- Updating `roblox_universes` fires revalidation triggers for wiki/list dependencies.
- The backfill touches tens of thousands of rows, which turns normally acceptable triggers into a heavy batch workload.
- Whole-table scans and offset-style paging are no longer safe defaults at this scale.

## Recommended Next Work

1. Audit database load before resuming the backfill:
   - slow queries
   - table/index bloat
   - missing indexes on stats/revalidation joins
   - long-running jobs
   - revalidation queue volume

2. Optimize stats jobs:
   - reduce unnecessary writes when values have not changed
   - keep HOT/WARM/COLD/NEW refreshes separated
   - batch writes more carefully
   - avoid broad revalidation on stats-only updates

3. Review `roblox_universes` triggers:
   - confirm whether name/slug-only updates need wiki/list revalidation per row
   - consider a controlled maintenance mode for bulk data repairs
   - enqueue one broad refresh after the batch instead of per-row queue inserts where safe

4. Resume the remaining name backfill only after the DB is stable:

```bash
NODE_ENV=production npm run backfill:universe-display-names -- --apply --allow-prod --min-universe-id 9273264061
```

5. Verify after completion:
   - no missing `display_name`
   - no missing `slug`
   - stats slugs end with `-<universe_id>`
   - sample bracketed Roblox titles no longer leak bracket text into display names
   - stats pages still resolve

## Notes

Do not continue hammering production with repeated small retries while CPU and memory are saturated. Optimize the database workload first, then finish the backfill in a controlled maintenance window.
