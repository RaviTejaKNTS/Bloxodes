# Supabase Guide

Scope: `supabase/`.

This folder defines the app's database contract and edge-function behavior.

## Layout

- `migrations/`: forward-only schema changes.
- `migrations_archive/`: archived reference-only SQL files that are not part of the active migration chain.
- `functions/revalidate/`: drains publish events and calls the app revalidation endpoint.
- `functions/roblox-codes/`: Supabase edge function related to Roblox code workflows.
- `schema.sql`: schema snapshot used as a reference point for the current database shape.

## Current Responsibilities

- Core public content tables and views for codes, articles, lists, checklists, quizzes, wiki pages, tools, catalog pages, authors, and events.
- User/account data in `app_users` plus session/progress/comment tables used by account and community features.
- Search, ranking, music IDs, free items, and universe enrichment data that power public pages and API routes.
- Revalidation queueing and publish-trigger automation.

## Migration Rules

- Add new migrations; do not rewrite old ones once they are part of repo history.
- Favor additive, reversible changes where possible.
- For this repo, `schema.sql` is the clean reference for the current database shape. Read it first when you need to understand the live schema.
- Do not manually edit `schema.sql` during feature work. Treat it as a live database dump/reference snapshot only.
- Local Supabase can be bootstrapped from `schema.sql`, then active/pending migrations may be applied as local overlay migrations for development.
- After migrations are applied to live, regenerate `schema.sql` from the live database dump instead of hand-editing it.
- Treat `migrations/` as deployment history for the existing production project, not as the easiest way to infer current state.
- Do not replace the active migration chain with a single baseline file for the current production project. If you generate a clean baseline snapshot, keep it in `schema.sql` or archive it outside `migrations/`.
- Views are heavily used by `src/lib/db.ts`, `src/lib/catalog.ts`, and `src/lib/tools.ts`; update app queries alongside schema changes.
- When changing policies, security definer functions, or search-path-sensitive code, review prior hardening migrations for consistency.

## App Integration Checklist

When adding a new table, view, or publishable content type:

1. Add the migration.
2. Update read/write helpers in `src/lib/*`.
3. Update relevant routes in `src/app/(site)` or `src/app/api`.
4. Wire revalidation through `src/app/api/revalidate/route.ts` and `supabase/functions/revalidate/index.ts` if the content is public.
5. Refresh `agents/data/agents.md`.
