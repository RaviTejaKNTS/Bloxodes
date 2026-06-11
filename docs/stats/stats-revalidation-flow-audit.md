# Stats Revalidation Flow Audit

Audit window: 2026-06-11 11:15-11:25 UTC / 16:45-16:55 IST.

This document records the firsthand audit of how stats updates are supposed to reach public pages, where revalidation is triggered, and where freshness can currently break.

## Evidence Checked

- Local app revalidation code:
  - `apps/web/src/app/api/revalidate/route.ts`
  - `apps/web/src/lib/public-cache-tags.ts`
  - `apps/web/src/app/(site)/stats/page.tsx`
  - `apps/web/src/app/(site)/stats/games/page.tsx`
  - `apps/web/src/app/(site)/stats/games/[slug]/page.tsx`
  - `apps/web/src/app/api/stats/games/route.ts`
  - `apps/web/src/app/api/stats/games/search/route.ts`
  - `apps/web/src/app/api/stats/games/[slug]/charts/route.ts`
  - `apps/web/src/app/api/stats/games/[slug]/rank-charts/route.ts`
- Revalidation enqueue script:
  - `scripts/automation/enqueue-revalidation-events.ts`
- Supabase Edge Function:
  - `supabase/functions/revalidate/index.ts`
- Production Supabase:
  - `revalidation_events`
  - `cron.job`
  - `cron.job_run_details`
  - `net._http_response`
  - `public.invoke_revalidation_worker()`
- VPS cron logs for stats jobs that enqueue stats revalidation.
- Northflank job logs for HOT refresh and rank chaining.

## Current Revalidation Flow

### 1. Stats Jobs Enqueue Events

The VPS stats jobs enqueue broad stats events after refresh/tiering:

- `stats:stats`
- `stats:games`

Examples from VPS cron:

```cron
stats-new-refresh -> enqueue stats:stats and stats:games
stats-warm-refresh -> enqueue stats:stats and stats:games
stats-cold-refresh -> enqueue stats:stats and stats:games
```

The enqueue script writes to `revalidation_events` and coalesces events by `(entity_type, slug)`.

### 2. Supabase Cron Invokes The Revalidation Worker

Production Supabase cron runs every five minutes:

```sql
select public.invoke_revalidation_worker();
```

`invoke_revalidation_worker()` uses `pg_net` to call the Supabase Edge Function at `/functions/v1/revalidate`.

Important behavior: the database function returns the `pg_net` request id. It does not wait for, inspect, or validate the final HTTP response body.

### 3. Supabase Edge Function Drains The Queue

`supabase/functions/revalidate/index.ts` reads up to 100 rows from `revalidation_events`, oldest first.

It calls the app revalidation endpoint with either one event or a batch. If the app endpoint succeeds, the Edge Function deletes those queue rows. If the request fails after retries, rows remain in the queue.

### 4. Next App Revalidates Paths And Tags

`apps/web/src/app/api/revalidate/route.ts` maps stats events to paths and tags.

`stats:stats` or `stats:home` revalidates:

- `/stats`
- `/`
- `/sitemap.xml`
- `/sitemaps/stats.xml`

`stats:games` revalidates:

- `/stats`
- `/stats/games`
- `/`
- `/sitemap.xml`
- `/sitemaps/stats.xml`

`stats:games/<slug>` revalidates:

- `/stats`
- `/stats/games`
- `/stats/games/<slug>`
- `/`
- `/sitemap.xml`
- `/sitemaps/stats.xml`

The endpoint also revalidates cache tags such as:

- `stats`
- `stats-home`
- `stats-games`
- `stats-game:<slug>`
- `home`

It can also purge public Cloudflare cache and warm paths when configured.

## Current Page And API Freshness

Stats pages:

- `/stats`: `revalidate = 600`.
- `/stats/games`: `revalidate = 600`.
- `/stats/games/[slug]`: `revalidate = 600`.

Stats API routes:

- Games list/search/summary: dynamic route with `max-age=60, stale-while-revalidate=300`.
- Charts/rank charts: dynamic route with `max-age=300, stale-while-revalidate=1800`.

This means page HTML and API JSON do not share one cache lifecycle. A page can be revalidated while an API response still serves cached data for its configured window.

## Production Evidence

### Supabase Cron Is Running

The `revalidate cron` job is present in production with schedule:

```cron
*/5 * * * *
```

Recent `cron.job_run_details` rows showed the cron function invocation succeeding.

### The Shared Queue Can Be Busy

At one production check, `revalidation_events` had 637 rows. Most were code, list, and wiki events. No stats events were pending at that moment.

This shows stats revalidation is not isolated. A burst from another content workflow can put stats behind the same queue.

### Edge Calls Sometimes Timeout

`net._http_response` showed repeated 60-second timeouts for the revalidation Edge Function around the audit window, including attempts at 10:35, 10:55, 11:05, and 11:15 UTC.

There were also successful responses with bodies like:

```json
{"processed":100,"failed":0,"failures":[]}
```

This means the worker is sometimes draining successfully, but also sometimes exceeding the `pg_net` timeout.

### Cron Success Does Not Mean Revalidation Success

Because `invoke_revalidation_worker()` returns a request id without inspecting `net._http_response`, the Supabase cron run can look successful even when the actual Edge Function request later times out.

This is a major observability gap.

### Northflank HOT Failures Can Skip Later Revalidation

Northflank `stats-hot-hourly` is a chained job. Logs show HOT refresh completes and then rank snapshotting starts. Recent runs often failed after the refresh section.

If revalidation enqueueing is after the failing step, fresh HOT current data can be written to Supabase without the intended page revalidation.

## What Is Working

- The app has explicit stats event handling.
- Broad stats events cover `/stats` and `/stats/games`.
- Detail stats events are supported by the app endpoint.
- Cache tags exist for stats home, games list, and detail pages.
- Supabase cron is actively invoking the queue worker every five minutes.
- The queue coalesces duplicate events by entity and slug, which prevents unlimited duplicate rows for the same broad page.
- Successful Edge Function runs can process 100 events at a time.

## Holes And Risks

### Query Variant Coverage Is Incomplete

`stats:games` revalidates `/stats/games`, but the public route supports query states such as:

- `/stats/games?page=2`
- `/stats/games?sort=growth_24h`
- `/stats/games?genre=...`
- `/stats/games?minPlayers=...`

Next `revalidatePath('/stats/games')` may not reliably clear every cached query variant, and Cloudflare path purging may not include all query-string variants depending on configuration.

Current risk: page 1 can be fresh while page 2 or sorted/filtered variants are stale.

### Detail Events Are Supported But Not Fully Used

The app supports `stats:games/<slug>`, but the observed worker cron commands only enqueue broad `stats:stats` and `stats:games` events.

Current risk: individual game detail pages may rely mostly on the 10-minute route revalidate window instead of immediate revalidation after major rank/stat changes.

### Revalidation Queue Is Shared With Other Content

Stats events share the queue with code, list, wiki, event, catalog, article, and other public content revalidation.

Current risk: stats freshness can lag behind unrelated content bursts.

### Batch Size And Warming Can Trigger Timeouts

The Edge Function processes up to 100 queued events in one request. The app revalidation endpoint can then revalidate paths/tags, purge Cloudflare, and warm paths.

Observed production `pg_net` timeouts show this can exceed 60 seconds.

Current risk: rows remain queued, freshness lags, and the database cron still appears successful.

### No Dead-Letter Or Retry Accounting

Failed queue events remain in `revalidation_events`, but there is no visible retry count, last error, next attempt time, or dead-letter table.

Current risk: a bad event or repeatedly slow batch can keep retrying without a clear dashboard signal.

### API Cache Freshness Is Separate

Dynamic stats API routes set their own HTTP cache headers. Page revalidation does not necessarily purge those API responses.

Current risk: a revalidated page can still fetch or embed API data that is up to the API cache window old.

### Revalidation Depends On Chained Job Success

Some stats cron commands enqueue revalidation at the end of a long command chain. If a later rank or tier step fails before enqueueing, the data update can land without the revalidation event.

Current risk: Supabase data is fresh but public HTML remains stale until route-level ISR naturally refreshes.

## Recommended Direction

Stats revalidation should be treated as its own reliability workflow, not just a final shell command.

Recommended changes:

- Enqueue revalidation immediately after a successful current stats write, even if rank generation later fails.
- Split stats revalidation from the shared queue or add priority processing for stats events.
- Reduce queue batch size or disable expensive warming during queue drains.
- Record every Edge Function attempt outcome, including timeout, status code, processed count, failed count, and duration.
- Explicitly purge or avoid caching query variants that matter for `/stats/games`.
- Enqueue detail events for top games and games whose current/rank data changed enough to affect detail pages.
- Add health checks for queue age, oldest pending stats event, and repeated timeout count.

Detailed next changes are listed in `docs/stats/stats-workflow-next-changes.md`.
