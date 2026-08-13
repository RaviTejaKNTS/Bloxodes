# Revalidation and Cache Warming

Status: Active
Last verified: 2026-08-14
Evidence: repository event mapping, live cron, deployed `revalidate` checksum and authenticated worker smoke, public cache headers, and health features

## Flow

```text
content/data write
  -> revalidation_events
  -> codex-admin minute cron
  -> Supabase revalidate Edge Function
  -> https://bloxodes.com/api/revalidate
  -> Next path/tag revalidation + Cloudflare tag purge
  -> cache_warm_events
  -> codex-admin minute cron
  -> Supabase cache-warm Edge Function
  -> public page fetches
```

Revalidation and warming are intentionally separate. Broad stats/list invalidations should not hold the revalidation request open while many public pages warm.

## Ownership

- Database queue/functions: Supabase migrations and `supabase/functions/{revalidate,cache-warm}`.
- Public path/tag mapping: `apps/web/src/app/api/revalidate/route.ts` and `apps/web/src/lib/public-cache-tags.ts`.
- Scheduler: `codex-admin` crontab invokes `public.invoke_revalidation_worker()` and `public.invoke_cache_warm_worker()` every minute.
- Deployment changes: GitHub performs targeted Cloudflare tag purge separately.

## Required Runtime Variables

- Edge Function: `REVALIDATE_ENDPOINT`, `REVALIDATE_SECRET`, batch/delay/share controls, and service role.
- Web runtime: matching `REVALIDATE_SECRET`, Cloudflare zone/token, and purge/warm controls.
- Secrets live on the execution platforms; committed names are in `env/examples/`.

## Verification

- `/api/health` reported cache tags enabled, tag purge strategy, and ISR public rendering.
- Public home returned Cloudflare `HIT`.
- Both worker cron entries were installed.
- The production `revalidate` source checksum matched the repository after its guarded release, and the authenticated worker smoke processed the queued batch without failures.
- Queue depth/drain correctness was not exhaustively tested in this documentation migration; use targeted pipeline audits for incident work.
