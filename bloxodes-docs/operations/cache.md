# Cache

Last verified: 2026-10-19

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

Revalidation and warming are separate on purpose, so a big stats purge doesn't wait on hundreds of page fetches. Successful rows are removed from both queues; worker runs are logged in `revalidation_worker_runs` and `cache_warm_worker_runs`.

## Where things live

| Piece | Location |
| --- | --- |
| Queue tables and worker functions | Supabase migrations |
| Edge Functions | `supabase/functions/revalidate`, `supabase/functions/cache-warm` |
| Event to path and tag mapping | `apps/web/src/app/api/revalidate/route.ts`, `apps/web/src/lib/public-cache-tags.ts` |
| Scheduler | `ravitejaknts` crontab on the VPS |

The Edge Function forwards event types it doesn't know, so new content types only need mapping in the web app.

## Runtime variables

- Edge Function: `REVALIDATE_ENDPOINT`, `REVALIDATE_SECRET`, batch and delay controls, service role.
- Web: the same `REVALIDATE_SECRET`, Cloudflare zone and token, purge and warm controls.

Publishers in `publish-content.yml` call `/api/revalidate` directly for their exact pages before checking them live, so a release doesn't wait behind the queue.

## Rules for new public content

Every public page family needs metadata, canonical and JSON-LD, pagination, search, sitemap, feed where it fits, revalidation mapping, Cloudflare tags, and mobile or extension payloads where they apply.
