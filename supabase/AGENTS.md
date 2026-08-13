# Supabase Guide

Scope: `supabase/`.

Current verified managed-development and self-hosted-production topology, versions, health caveats, and upgrade watch items live in `dev-docs/data/supabase.md`. Treat older migration plans in `docs/` as historical evidence.

Update that existing canonical document in the same change whenever the live topology, versions, env ownership, migration model, or Edge Function flow changes. Do not create a parallel current-state Supabase doc.

This folder defines the app's database contract and edge-function behavior.

## Layout

- `migrations/`: forward-only schema changes.
- `migrations_archive/`: archived reference-only SQL files that are not part of the active migration chain.
- `functions/revalidate/`: drains publish events and calls the app revalidation endpoint.
- `functions/cache-warm/`: drains deferred Cloudflare warm paths from `cache_warm_events`.
- `functions/roblox-codes/`: Supabase edge function related to Roblox code workflows.
- `schema.sql`: schema snapshot used as a reference point for the current database shape.

## Current Responsibilities

- Production Supabase is self-hosted on the same VPS as the web app. The production API endpoint is `https://database.bloxodes.com`; Studio is `https://studio.bloxodes.com`; public storage/media URLs should use `https://media.bloxodes.com`. The separate managed HTTPS `*.supabase.co` project owns all workstation development and non-production content work; it must not be used as the public site's production runtime or media origin. Do not start or target a local Supabase CLI database.
- Core public content tables and views for codes, articles, checklists, quizzes, wiki pages, tools, catalog pages, authors, puzzles, stats, and events.
- User/account data in `app_users` plus session/progress/comment tables used by account and community features.
- Search, ranking, music IDs, free items, and universe enrichment data that power public pages and API routes.
- Revalidation queueing, publish-trigger automation, and deferred cache warming through `revalidation_events`, `cache_warm_events`, and their worker-run audit tables.

## Migration Rules

- Add new migrations; do not rewrite old ones once they are part of repo history.
- Create migration files with `supabase migration new <name>`, then run `npm run supabase:migrations:check`.
- Favor additive, reversible changes where possible.
- For this repo, `schema.sql` is the clean reference for the current database shape. Read it first when you need to understand the live schema.
- Do not manually edit `schema.sql` during feature work. Treat it as a live database dump/reference snapshot only.
- Validate pending migrations against managed Supabase development before controlled production application. Do not bootstrap a local Supabase database as part of the active workflow.
- `supabase/migration-policy.json` records verified pre-convergence ledger exceptions. Do not add an exception from filenames alone: prove the corresponding live objects and record why history differs.
- Migration histories must contain every version at or after the policy's `convergence_version`. Earlier history repairs and schema migrations are separate operations and require explicit target review.
- Apply each reviewed migration to managed development through the authenticated Supabase connector, then list migrations and run readiness/advisors. This project intentionally does not store the managed database password or a second CI copy of it.
- Plan self-hosted production with `npm run supabase:production:release -- --approved-sha <full-sha>`. Apply only after explicit permission, after that SHA is on `origin/production`, with `--apply --confirm "APPLY production"`. The command streams an atomic transaction through SSH into the existing database container, proves policy-listed live objects, repairs only verified historical gaps, applies only expected migrations, and verifies the ledger without SSH forwarding or public Postgres.
- After a managed-development application, run `npm run supabase:managed-dev:check` and Supabase security/performance advisors. After production application, verify the ledger, affected objects/RPCs, application health, and the self-hosted security audit before calling the environments converged.
- Do not use `supabase db reset`, local seeding, or a local CLI database in this repository.
- After migrations are applied to live, regenerate `schema.sql` from the live database dump instead of hand-editing it.
- Treat `migrations/` as deployment history for the existing production project, not as the easiest way to infer current state.
- Do not replace the active migration chain with a single baseline file for the current production project. If you generate a clean baseline snapshot, keep it in `schema.sql` or archive it outside `migrations/`.
- Views are heavily used by `src/lib/db.ts`, `src/lib/catalog.ts`, and `src/lib/tools.ts`; update app queries alongside schema changes.
- When changing policies, security definer functions, or search-path-sensitive code, review prior hardening migrations for consistency.
- Edge Functions are deployed artifacts, not just source files. Compare the deployed checksum with `supabase/functions/<name>/index.ts`. Managed development currently has no deployed Bloxodes functions; production reconciliation uses `npm run supabase:production:function:release -- --approved-sha <sha> --function <name>` in plan mode and requires explicit approval plus `--apply --confirm "APPLY <name>"` to mutate the self-hosted runtime.

## App Integration Checklist

When adding a new table, view, or publishable content type:

1. Add the migration.
2. Update read/write helpers in `src/lib/*`.
3. Update relevant routes in `src/app/(site)` or `src/app/api`.
4. Wire revalidation through `src/app/api/revalidate/route.ts` and `supabase/functions/revalidate/index.ts` if the content is public. If public pages should be warmed after purge, enqueue through `cache_warm_events` and `supabase/functions/cache-warm/index.ts` instead of warming synchronously inside `/api/revalidate`.
5. Refresh `agents/data/agents.md`.
