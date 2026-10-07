# Supabase Guide

## GitHub task and release flow

Stay in the T3-assigned task worktree. Use a PR targeting `production`. Checks, builds, tests, page validation and browser verification run on GitHub, including the commands listed below. Do not install dependencies or run local checks. Production schema/content writes use the CI jobs in `dev-docs/operations/deployment.md`. Preserve installed runtimes, env files and active jobs.

Scope: `supabase/`.

Current verified managed-development and self-hosted-production topology, versions, health caveats, and upgrade watch items live in `dev-docs/data/supabase.md`. Treat older migration plans in `docs/` as historical evidence.

Update that existing canonical document in the same change whenever the live topology, versions, env ownership, migration model, or Edge Function flow changes. Do not create a parallel current-state Supabase doc.

This folder defines the app's database contract and edge-function behavior.

## Shared games contract

Managed development and production use `games` and `game_*` tables for non-Roblox content. Use the applied October 6 migrations and generated `types/shared-games.ts` for the shared contract. `schema.sql` is the native live production dump after the retirement. Never hand-edit it.

Keep namespaces explicit in reads and writes. Roblox stays outside these tables. Preserve immutable revision guards, owner foreign keys, exact-count publication, reserved namespaces and route validation. New tables and views remain service-only. See `dev-docs/pipelines/wiki-collections.md` for the active publication and verification commands. The old Minecraft activation RPC is retired in development and production.

## Layout

- `migrations/`: forward-only schema changes.
- `migrations_archive/`: archived reference-only SQL files that are not part of the active migration chain.
- `functions/revalidate/`: drains publish events and calls the app revalidation endpoint.
- `functions/cache-warm/`: drains deferred Cloudflare warm paths from `cache_warm_events`.
- `functions/roblox-codes/`: Supabase edge function related to Roblox code workflows.
- `schema.sql`: native live production SQL dump from October 6.
- `types/shared-games.ts`: live managed-development shared-game table/view types.

## Current Responsibilities

- Production Supabase is self-hosted on the same VPS as the web app. The production API endpoint is `https://database.bloxodes.com`; Studio is `https://studio.bloxodes.com`; public storage/media URLs should use `https://media.bloxodes.com`. The separate managed HTTPS `*.supabase.co` project owns all workstation development and non-production content work; it must not be used as the public site's production runtime or media origin. Do not start or target a local Supabase CLI database.
- Core public content tables and views for codes, articles, checklists, quizzes, wiki pages, tools, catalog pages, authors, puzzles, stats, and events. Production and managed development use shared `games` and `game_*` storage; neither system uses Roblox universe or editorial tables for GTA content. Both retain immutable collection dataset pointers. Shared tool pages use registered tool renderers.
- User/account data in `app_users` plus session/progress/comment tables used by account and community features.
- Search, ranking, music IDs, free items, and universe enrichment data that power public pages and API routes.
- Revalidation queueing, publish-trigger automation, and deferred cache warming through `revalidation_events`, `cache_warm_events`, and their worker-run audit tables.

## Migration Rules

- Add new migrations; do not rewrite old ones once they are part of repo history.
- Create migration files with `supabase migration new <name>`, then run `npm run supabase:migrations:check`.
- Favor additive, reversible changes where possible.
- Check the snapshot date and target before using `schema.sql`. The October 6 snapshot includes shared storage; use applied migrations and generated types for later changes.
- Do not manually edit `schema.sql` during feature work. Treat it as a live database dump/reference snapshot only.
- Validate pending migrations against managed Supabase development before controlled production application. Do not bootstrap a local Supabase database as part of the active workflow.
- `supabase/migration-policy.json` records verified pre-convergence ledger exceptions. Do not add an exception from filenames alone: prove the corresponding live objects and record why history differs.
- Migration histories must contain every version at or after the policy's `convergence_version`. Earlier history repairs and schema migrations are separate operations and require explicit target review.
- The schema CI job uses `MANAGED_DEV_SUPABASE_ACCESS_TOKEN` with the Management API for project `bbtcaurrtyoukvjbxbbj`. It proves the transaction with rollback, applies pending forward migrations, and reads back the ledger and readiness. The managed database password remains absent. OAuth connector sessions are for inspection and are not CI credentials.
- Plan self-hosted production with `npm run supabase:production:release -- --approved-sha <full-sha>`. Apply only after explicit permission, after that SHA is on `origin/production`, with `--apply --confirm "APPLY production"`. The command streams an atomic transaction through SSH, Dokploy or the guarded Studio SQL transport into the existing database, proves policy-listed live objects, repairs only verified historical gaps, applies only expected migrations, and verifies the ledger without SSH forwarding or public Postgres.
- After a managed-development application, CI runs `npm run supabase:managed-dev:check` and Supabase security/performance advisors. After production application, verify the ledger, affected objects/RPCs, application health, and the self-hosted security audit before calling the environments converged.
- Do not use `supabase db reset`, local seeding, or a local CLI database in this repository.
- After migrations are applied to live, regenerate `schema.sql` from the live database dump instead of hand-editing it.
- Treat `migrations/` as deployment history for the existing production project, not as the easiest way to infer current state.
- Do not replace the active migration chain with a single baseline file for the current production project. If you generate a clean baseline snapshot, keep it in `schema.sql` or archive it outside `migrations/`.
- Views are heavily used by `src/lib/db.ts`, `src/lib/catalog.ts`, and `src/lib/tools.ts`; update app queries alongside schema changes.
- When changing policies, security definer functions, or search-path-sensitive code, review prior hardening migrations for consistency.
- Edge Functions are deployed artifacts, not just source files. Compare the deployed checksum with `supabase/functions/<name>/index.ts`. Managed development currently has no deployed Bloxodes functions; production reconciliation uses `npm run supabase:production:function:release -- --approved-sha <sha> --function <name>` in plan mode and requires explicit approval plus `--apply --confirm "APPLY <name>"` to mutate the self-hosted runtime.

## App Integration Checklist

The October 3 production model used seven Minecraft tables and three service-only security-invoker views. Development and production now use the shared game tables described above. Use `minecraft-java` and `minecraft-bedrock` for edition game/wiki identities and `<wiki-slug>-<collection>` for collection codes and events. Legacy `minecraft` revisions and comments remain stored behind an unpublished parent. Keep composite dataset ownership and exact-count publication guards. The October 3 release used the service-only `activate_minecraft_edition_migration` function for an exact 48-hash allowlist. The October 6 shared-table release removed this one-time function. Clients use server routes; keep RLS and no anonymous/authenticated table grants. Migration `20261003112951` expands identities/routes and `20261003115649` adds atomic cutover; both passed managed-development fixtures and production application on October 3, 2026. Production activation/readback verified two hubs, 48 exact revisions and 13,026 rows with the legacy parent unpublished.

When adding a new table, view, or publishable content type:

1. Add the migration.
2. Update read/write helpers in `src/lib/*`.
3. Update relevant routes in `src/app/(site)` or `src/app/api`.
4. Wire revalidation through `src/app/api/revalidate/route.ts` and `supabase/functions/revalidate/index.ts` if the content is public. If public pages should be warmed after purge, enqueue through `cache_warm_events` and `supabase/functions/cache-warm/index.ts` instead of warming synchronously inside `/api/revalidate`.
5. Refresh `agents/data/agents.md`.


## GTA standalone checklist support (2026-09-10)

The previous production model uses `gta_checklist_pages` for standalone GTA checklists (one title, composite game ID/slug foreign key) and `gta_checklist_items` (stable item keys and three-part leaf codes). Keep tables/view service-only with RLS enabled; the security-invoker view must filter game/page publication. Progress remains in `user_checklist_progress` under `gta:<slug>`. Seed migrations must preserve existing task IDs on upsert.
Migrations `20260920000030` and `20260920000031` seed the San Andreas, Vice City, and GTA Online checklist pages in managed development and correct their collection-link copy. GTA Online rows are a dated Career Progress snapshot and should be refreshed with a new forward-only seed/update migration when Rockstar changes permanent challenge cards.
Migration `20260920000032` clarifies that GTA Online contains selected tasks only. Preserve its task IDs and partial-coverage notice when maintaining the page; Bloxodes guides do not expose Rockstar player state.

### Emote command references

`roblox_emote_commands` is server-only with RLS, optional catalog-item foreign keys, provenance, verification dates, and explicit publication state. Its statement trigger targets `/catalog/roblox-emote-commands` through the catalog revalidation flow. Migration `20260915045100` creates the table; `20260915061528` moves revalidation ownership from the Marketplace emote IDs page to the command page. Seed references with `seed:emote-commands` after linked item rows exist. See the catalog pipeline owner for evidence boundaries.

## Shared page-type extension

Managed development and production have `game_map_pages`, `game_quiz_pages`, `game_catalog_pages` and `game_quiz_progress`. The three new read views are service-only and filter publication. Use the atomic publisher for page/task batches and `save_game_quiz_progress` for account history. Do not replace registered GTA engine snapshots or renderer identity through ordinary edits. See `dev-docs/pipelines/content.md` for the shared page contract and verified production release.
