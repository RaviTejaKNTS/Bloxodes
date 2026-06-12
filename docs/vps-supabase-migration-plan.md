# VPS Supabase Migration Plan

This document captures the safe path for moving Bloxodes from managed Supabase to a self-hosted Supabase/Postgres stack on the VPS.

The migration started as a parallel-copy validation project and moved into production cutover on 2026-06-12 after the final managed Supabase sync passed row-count, freshness, storage, app, and SEO checks.

## Current Emergency Context

- Managed Supabase was under high CPU and memory pressure, so the hot production path was moved to the VPS Supabase stack.
- The public web app now points at `https://bloxodesdb.ravitejaknts.com`.
- VPS-local stats worker cron is restored and uses the VPS Supabase endpoint.
- VPS Supabase revalidation is wired through the self-hosted `revalidate` Edge Function, Vault `revalidate_cron_jwt`, and a VPS-local minute cron that calls `public.invoke_revalidation_worker()`.
- GitHub Actions and Northflank writer/stat jobs have been rotated to the VPS Supabase endpoint and service-role key, then restored to their normal schedules.
- Cloudflare emergency cache still needs to be disabled once `CLOUDFLARE_BLOXODES_API` is accepted by Cloudflare from the CLI environment.

## Execution Status: 2026-06-12

Production web was cut over to VPS Supabase.

What is complete:

- Self-hosted Supabase was installed on the VPS under `/home/codex-admin/bloxodes-supabase`.
- The stack uses the Postgres 17 compose override so the target matches managed Supabase's major version.
- Supabase ports are currently bound to localhost/private access for validation, not exposed as the public app database endpoint.
- A persistent local PostgREST bridge was added with `/home/codex-admin/bloxodes-supabase/docker-compose.rest-proxy.yml` because PostgREST answered locally but direct sibling-container traffic to `rest:3000` timed out. Kong and Storage now use `rest:3010` through that bridge.
- A managed Supabase dump was created on the VPS through the IPv4 Supabase pooler because the VPS could not route to the direct IPv6 database host.
- Dump file: `/home/codex-admin/bloxodes-supabase/backups/bloxodes-managed-2026-06-12.dump`.
- Dump size: about 871 MB.
- Restored schemas include `public`, `auth`, `storage`, and `supabase_migrations`.
- Missing target extension `pg_trgm` was added before restore.
- Missing no-login role `basebuddy_editor` was added before restore.
- Auth and Storage ownership/search-path issues were fixed after restore.
- Supabase services report healthy in Docker: DB, Auth, Storage, Kong, REST, Realtime, Studio, Meta, Pooler, Edge Functions, and Imgproxy.
- Storage object bytes were copied from managed Supabase Storage to VPS Supabase Storage after the DB restore. The migration copied 2,416 objects, about 133 MB total, with 0 failures.
- Public VPS Supabase hostnames are configured through Hostinger DNS and Dokploy Traefik:
  - API endpoint: `https://bloxodesdb.ravitejaknts.com`
  - Studio endpoint: `https://bloxodesstudio.ravitejaknts.com`
- `bloxodesdb.ravitejaknts.com` routes to Supabase Kong. `bloxodesstudio.ravitejaknts.com` routes to Supabase Studio with Traefik Basic Auth and admin security headers.
- The self-hosted Supabase `.env` now uses `https://bloxodesdb.ravitejaknts.com` for `SUPABASE_PUBLIC_URL` and `API_EXTERNAL_URL`.
- Final managed Supabase dump was restored to the VPS and analyzed before app cutover.
- Dokploy web runtime env now points at `https://bloxodesdb.ravitejaknts.com` with the VPS anon and service-role keys.
- Production app build `912adbb500719938b84e9cb72cb22d3741b2eb2a` is live.
- The VPS stats worker env file `/home/codex-admin/bloxodes-stats-worker/env.stats-worker` now points at the VPS Supabase endpoint.
- VPS-local stats worker cron has been restored.
- GitHub Actions `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE` secrets have been rotated to the VPS Supabase endpoint/key, and cutover-paused workflows have been re-enabled.
- Northflank `stats-hot-hourly` and `stats-daily-ranks` runtime envs now point at `https://bloxodesdb.ravitejaknts.com` with the VPS service-role key, and their original schedules were restored.
- The `revalidate` Edge Function has been copied to `/home/codex-admin/bloxodes-supabase/volumes/functions/revalidate/index.ts`.
- VPS Edge Functions now have `REVALIDATE_ENDPOINT=https://bloxodes.com/api/revalidate`, `REVALIDATE_SECRET`, and `REVALIDATE_BATCH_SIZE`.
- `public.invoke_revalidation_worker()` now posts to `https://bloxodesdb.ravitejaknts.com/functions/v1/revalidate`.
- A VPS-local cron invokes `public.invoke_revalidation_worker()` every minute.

Database validation results:

- Core row counts matched the final managed Supabase dump for public content tables, stats tables, views, and storage metadata.
- Key restored counts:
  - `articles`: 287
  - `catalog_pages`: 40
  - `codes`: 21,647
  - `games`: 3,909
  - `roblox_universes`: 96,436
  - `stats_game_current_index`: 95,195
  - `storage.objects`: 2,416
  - `auth.users`: 1
- Key app-facing views returned rows:
  - `code_pages_view`: 3,909
  - `game_pages_index_view`: 3,909
  - `tools_view`: 8
  - `wiki_pages_view`: 19
  - `stats_game_current_index` sample returned rows.
- `roblox_universe_stats_hourly` restored 1,708,481 rows with data through `2026-06-12 16:00:00+00`.
- Final managed and VPS freshness matched for hourly stats, daily stats, current stats indexes, code timestamps, and universe `updated_at`.
- Installed extensions on the VPS include `pg_graphql`, `pg_net`, `pg_stat_statements`, `pg_trgm`, `pgcrypto`, `plpgsql`, `supabase_vault`, and `uuid-ossp`.

HTTP API validation results:

- Auth through Kong returned HTTP 200.
- Storage through Kong returned HTTP 200.
- REST through Kong returned HTTP 200 for `games`, `code_pages_view`, and `stats_game_current_index`.
- Public REST through `https://bloxodesdb.ravitejaknts.com` returned HTTP 200 with the anon key.
- Public Studio through `https://bloxodesstudio.ravitejaknts.com` returns HTTP 401 without credentials and HTTP 200 with the protected dashboard credentials.
- Clone-only REST write/delete smoke passed on `revalidation_events`: insert returned HTTP 201, delete returned HTTP 204, and the test row count returned to 0.
- Sampled Storage object downloads returned HTTP 200 with exact expected byte counts.
- The REST bridge is a VPS-local workaround and should be preserved in the compose command until the underlying PostgREST sibling-traffic issue is replaced by a cleaner stack revision.

App-level validation results:

- A temporary Bloxodes web container was started on the VPS using the production web image with Supabase envs pointed at the VPS clone.
- Public page smoke returned HTTP 200 for `/`, `/codes`, `/codes/<slug>`, `/stats`, `/stats/games`, `/stats/games/<slug>`, `/wiki`, `/wiki/<slug>`, `/catalog`, `/catalog/<code>`, `/articles`, `/articles/<slug>`, `/events`, `/events/<slug>`, `/tools`, `/tools/<code>`, `/quizzes`, `/quizzes/<code>`, `/checklists`, `/checklists/<slug>`, `/feed.xml`, and `/sitemap.xml`.
- API smoke returned HTTP 200 for search, stats list/search/chart/rank-chart, mobile codes index/detail, mobile content index/detail, extension codes lookup, and game top nav.
- Live production smoke after cutover returned HTTP 200 for `/`, `/codes`, `/codes/grow-a-garden`, `/stats`, `/stats/games`, `/wiki`, `/catalog`, `/articles`, `/events`, `/tools`, `/sitemap.xml`, `/robots.txt`, `/api/health`, `/api/mobile/codes`, and `/api/stats/games`.
- Uncached query-string origin smoke returned HTTP 200 for sampled wiki, catalog, article, event, tool, stats, and code pages.
- A 60-URL sitemap SEO audit returned 60/60 HTTP 200 and indexable.
- Revalidation smoke passed: a queued `stats:stats` event was processed by the VPS Edge Function and deleted from `revalidation_events`.

VPS resource snapshot after restore:

- VPS has about 2 vCPU and 7.8 GiB RAM.
- Root disk is about 96 GB total, about 62 GB used, and about 35 GB free after final sync and backups.
- Memory has several GiB available during normal checks, but swap usage is high.
- This VPS is acceptable for the cutover window, but it is not the recommended long-term database size while also running the web app, Supabase, and stats workloads.

Current recommendation:

- The VPS Supabase stack is now the production web app database endpoint.
- Keep managed Supabase available as rollback until the VPS has scheduled backups, restore tests, and at least one full day of stable automation.
- Before long-term production use, move this to a dedicated or larger VPS class, preferably at least 4 vCPU, 16 GB RAM, and 160 GB or more SSD for the current Bloxodes growth path.
- Disable Cloudflare emergency cache after `CLOUDFLARE_BLOXODES_API` authenticates from the CLI. Current observed failure is `401 Invalid API Token`, likely from an IP allowlist mismatch or stale local token value.
- Upgrade or separate the VPS soon. The current server is functional, but swap usage has been high during verification.

Cutover env inventory:

- Web/Dokploy runtime: `SUPABASE_URL=https://bloxodesdb.ravitejaknts.com`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`, and any `NEXT_PUBLIC_SUPABASE_*` values if used by the deployed build/runtime.
- Web host allowlists: `apps/web/next.config.js` and `apps/web/src/config/csp-directives.json` if the VPS Supabase API or Storage host changes.
- GitHub Actions: catalog, events, puzzle, codes, indexing, list refresh, article/manual generation, and other jobs that currently read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE`.
- VPS/Northflank stats workers: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`, `SUPABASE_MEDIA_BUCKET`, revalidation envs, and any host wrapper env files.
- Supabase Edge Functions and cron/vault configuration: revalidation, Roblox codes, and any hard-coded managed Supabase function URLs.
- Operator env files: `.env`, `.env.production` in Dokploy, `.env.codex`, `.env.stats`, `.env.northflank`, and GitHub repository/environment secrets.

## Target End State

- VPS runs self-hosted Supabase/Postgres as the main production database.
- Managed Supabase is no longer on the hot path after cutover.
- Daily backups are configured and restorable.
- Heavy stats ingestion, refresh, and enrichment jobs run against the VPS database.
- Public web app envs point to the VPS Supabase endpoint only after validation.
- Cloudflare remains the public availability shield for cached pages.

## Phase 1: Prepare The VPS Stack

1. Confirm VPS capacity.
   - CPU, memory, disk, swap, and current Docker container load.
   - Confirm enough free disk for the DB restore plus at least one compressed backup.
   - Confirm Docker log rotation remains enabled.

2. Decide deployment shape.
   - Preferred for first clone: Postgres/Supabase stack isolated from existing Dokploy app containers.
   - Keep ports private unless a public API endpoint is intentionally needed.
   - Put any public Supabase API behind Cloudflare or a controlled reverse proxy.

3. Create service folders.
   - Example: `/srv/bloxodes/supabase`
   - Example: `/srv/bloxodes/backups`
   - Keep config, env, data volumes, and backups separated.

4. Configure secrets.
   - Generate new JWT secret, anon key, service role key, dashboard credentials, and database passwords.
   - Do not reuse managed Supabase service keys.
   - Store local operator notes outside git.

5. Start the stack.
   - Postgres first.
   - Supabase API/auth/storage components after Postgres is healthy.
   - Confirm health endpoints and logs.

## Phase 2: Snapshot Managed Supabase

1. Keep managed Supabase upgraded while dump runs.
2. Keep write-heavy jobs paused.
3. Dump schema and data from managed Supabase.
   - Include schemas, tables, views, functions, triggers, extensions, policies, grants, and sequences.
   - Include auth schema if the final target includes Supabase Auth migration.
   - Include storage metadata if used.
4. Record dump metadata.
   - Source project ref.
   - Dump started/finished timestamps.
   - Postgres version.
   - Table count and approximate DB size.
   - Command used, with secrets redacted.

## Phase 3: Restore To VPS

1. Restore extensions and schema.
2. Restore data.
3. Restore functions, triggers, policies, grants, and views.
4. Reset sequences.
5. Run `ANALYZE`.
6. Confirm Postgres logs have no restore-time errors that were ignored.

## Phase 4: Database Validation Checklist

Run these checks before any app uses the VPS database.

- Extensions match managed Supabase.
- Public schema table list matches.
- Important private/auth/storage schemas are present if required.
- Row counts match for major tables:
  - `games`
  - `codes`
  - `roblox_universes`
  - `roblox_universe_stats_current`
  - `roblox_universe_stats_hourly`
  - `wiki_pages`
  - `wiki_catalog_pages`
  - `catalog_pages`
  - `articles`
  - `events_pages`
  - `checklist_pages`
  - `quiz_pages`
  - `revalidation_events`
- Views compile and return rows:
  - `game_pages_index_view`
  - stats index/current views used by the web app
  - search/list views used by public pages
- Functions exist and execute for read-only smoke inputs.
- Triggers exist on critical tables.
- RLS is enabled where expected.
- Policies match expected read/write behavior.
- Grants allow app roles to read the same exposed data.
- Sequences are ahead of max IDs.
- Indexes exist for hot public queries and stats queries.
- Slow-query candidates are identified before cutover.

## Phase 5: App-Level Validation

Use a staging/local app pointed at the VPS Supabase env. Do not switch production yet.

Required checks:

- `/api/health` works.
- `/` renders.
- `/codes` renders.
- several `/codes/<slug>` pages render.
- `/wiki` and several wiki detail pages render.
- `/catalog` and catalog detail pages render.
- `/articles` and article detail pages render.
- `/events` and event detail pages render.
- `/stats` renders.
- `/stats/games` renders.
- several `/stats/games/<slug>` pages render.
- search endpoints return results.
- mobile/extension code endpoints still return expected JSON.
- auth/login behavior is tested if auth is part of this cutover.
- revalidation endpoint behavior is tested against the VPS DB.
- Cloudflare cache headers remain correct.

## Phase 6: Automation Migration

Move automation gradually. Do not switch every job at once.

Recommended order:

1. Read-only report jobs.
2. Stats audit jobs.
3. Stats discovery jobs that can be replayed safely.
4. Stats enrichment and refresh jobs.
5. Revalidation queue/drain jobs.
6. Codes/article/content update jobs.
7. Any auth/user-writing workflows last.

For every moved job:

- Change env to VPS Supabase.
- Run dry-run if available.
- Run a small live batch.
- Verify row counts and changed rows.
- Verify no unexpected trigger/revalidation storm.
- Log the command and timestamp.

## Phase 7: Backup And Restore

Backups are required before production cutover.

Minimum backup setup:

- Daily compressed Postgres dump.
- At least 7 daily retained backups.
- Weekly longer-retention backup if disk allows.
- Off-VPS copy, not only local disk.
- Restore test into a temporary database.
- Alert if backup fails or file size is suspiciously small.

Backup checks:

- Backup file exists.
- Backup file is non-empty and compressed.
- Dump command exit code is successful.
- Restore test completes.
- Restored DB passes a small row-count smoke check.

## Phase 8: Cutover Criteria

Only rotate production app envs when all are true:

- VPS DB has passed database validation.
- Staging/local app has passed app-level validation.
- Backups are working and restore-tested.
- Automation migration plan is either complete or intentionally deferred.
- Current managed Supabase can still be used as rollback source.
- Cloudflare emergency cache is enabled or ready.
- A maintenance window is chosen for final sync.
- Final data divergence strategy is clear.

## Phase 9: Final Cutover

1. Pause writes and heavy jobs.
2. Take final managed Supabase dump or run final sync.
3. Restore/sync final changes to VPS.
4. Verify row-count deltas.
5. Rotate app envs to VPS Supabase.
6. Deploy/restart app.
7. Check `/api/health`.
8. Check public pages and APIs.
9. Check auth if enabled.
10. Warm Cloudflare from US and local routes.
11. Watch logs, CPU, memory, and query latency.

## Rollback Plan

Rollback should be possible until managed Supabase is intentionally retired.

Rollback steps:

1. Rotate app envs back to managed Supabase.
2. Restart/deploy app.
3. Confirm `/api/health`.
4. Confirm public pages.
5. Keep Cloudflare emergency cache enabled if origin remains unstable.
6. Stop VPS write automation to avoid split-brain writes.
7. Preserve VPS logs and DB state for debugging.

## Known Risks

- Data divergence after the initial dump.
- Auth/session behavior may differ if Supabase Auth is not migrated perfectly.
- Storage files and metadata may need a separate migration.
- Edge functions, cron jobs, and queues may not map one-to-one.
- Exposed API grants/RLS can silently differ.
- VPS disk pressure can become the new outage source.
- Running the migration while production is under load can hide real errors.

## Immediate Recommendation

Use the current XL window to create and validate the VPS clone if time allows, but keep managed Supabase as production until the validation gates pass. Move heavy stats automation to VPS first, then consider full production cutover after backup/restore and app-level checks are clean.
