# Revalidation and Cache Warming

Status: Active
Last verified: 2026-10-03
Evidence: Minecraft trigger fixtures, October 3 production worker checksum/readback, exact-batch revalidation with successful Cloudflare tag purge, worker smoke and public edition cache headers; cron installation retains its earlier verification boundary

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

Minecraft integration was checked in the task checkout on 2026-10-02 and its database triggers were tested in managed development. `minecraft_game`, `minecraft_wiki`, `minecraft_wiki_collection` and `minecraft_tool` use the existing queue. Collection event slugs contain only the collection slug, matching `/minecraft/wiki/<collection>`; tool slugs match `/minecraft/tools/<tool>`. Minecraft tags stay separate from Roblox indexes. Collection writes invalidate Minecraft tool tags because tools can depend on published collection rules. The Minecraft sitemap and feed join the same purge/warm flow. Minecraft wiki and collection search entries inherit game/wiki publication state; the managed-development rollback fixture verified that hiding either parent hides its children. Edition-specific wiki/tool HTML uses private, no-store origin and CDN headers. The proxy puts remembered Bedrock preferences into query URLs before rendering; shared typed data caches remain enabled. The code and worker are deployed to production as of October 3. Authenticated revalidation passed for the exact 40 Minecraft publication events, purged all 50 selected Cloudflare tags without errors and queued deferred warming. The final worker smoke returned HTTP 200 with zero failed events. The initial smoke before the dependent web deployment recorded a failed batch; the final check supersedes it. Worker endpoint and operator secret matched without exposing their values. The deployed SHA-256 is `cf77cdb15f9942d7d627f46accded2e64633c7caf35d132151ba90ecafd895b7`. The release used the owner-authenticated Dokploy container terminal and restart API because the operator SSH key was unavailable, preserved file ownership/mode and retained a guarded rollback copy. No runtime environment value was changed.

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
