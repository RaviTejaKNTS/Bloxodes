# Cache

Last verified: 2026-11-01

How a database change becomes a fresh public page.

```text
content or data write
  -> revalidation_events (database triggers or explicit events)
  -> VPS cron, every minute: public.invoke_revalidation_worker()
  -> Edge Function `revalidate`
  -> https://bloxodes.com/api/revalidate (secret protected)
  -> Next path/tag revalidation + Cloudflare tag purge
  -> cache_warm_events
  -> VPS cron, every minute: public.invoke_cache_warm_worker()
  -> Edge Function `cache-warm` fetches the public URLs
```

Revalidation and warming are separate on purpose, so a big stats purge doesn't wait on hundreds of page fetches. Successful rows are removed from both queues; worker runs are logged in `revalidation_worker_runs` and `cache_warm_worker_runs`. Each worker run marks runs still `running` after an hour as `failed` ("Abandoned: ..."), since a run stopped mid-batch never records its result. A cache-warm run with dropped paths (404, or out of retries) lists up to 20 of them with their reason in `error`, even when the run's status is `success`; watch `dropped_count`, not just status.

## Where things live

| Piece | Location |
| --- | --- |
| Queue tables and worker functions | Supabase migrations |
| Edge Functions | `supabase/functions/revalidate`, `supabase/functions/cache-warm` |
| Event to path and tag mapping | `apps/web/src/app/api/revalidate/route.ts`, `apps/web/src/lib/public-cache-tags.ts` |
| Scheduler | `ravitejaknts` crontab on the VPS |

The Edge Function forwards event types it doesn't know, so new content types only need mapping in the web app.

Stats chart APIs are the one origin exception: the platform player and visit-share charts keep each result in the web process for 5 minutes and share one query between concurrent requests (`apps/web/src/lib/stats-chart-cache.ts`). See [stats](../content/stats.md). Don't add `unstable_cache` for other public reads.

Redirects are the other in-process cache (`apps/web/src/lib/site-route-snapshot.ts`). Each server process holds a copy of the `site_route_redirects` rows plus the live and gone paths under a prefix rule:

- The first request in a fresh process waits for one shared load, at most 2 seconds. If it fails or times out, that request continues without redirects, and the next requests retry after 2, 4, 8, 16, then every 30 seconds.
- Once loaded, requests use the copy and a background refresh runs every 5 minutes (15-second limit). A failed refresh keeps the last copy.
- `/api/revalidate` doesn't clear it. Route changes show up after the next refresh.

## Runtime variables

- Edge Function: `REVALIDATE_ENDPOINT`, `REVALIDATE_SECRET`, batch and delay controls, service role.
- Web: the same `REVALIDATE_SECRET`, Cloudflare zone and token, purge and warm controls.

Publishers in `publish-content.yml` call `/api/revalidate` directly for their exact pages before checking them live, so a release doesn't wait behind the queue.

## Rules for new public content

Every public page family needs metadata, canonical and JSON-LD, pagination, search, sitemap, feed where it fits, revalidation mapping, Cloudflare tags, and mobile or extension payloads where they apply.
