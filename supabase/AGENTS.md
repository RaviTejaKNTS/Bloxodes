# Supabase Guide

Scope: `supabase/`.

This folder defines the app's database contract and edge-function behavior.

## Layout

- `migrations/`: forward-only schema changes.
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
- Views are heavily used by `src/lib/db.ts`, `src/lib/catalog.ts`, and `src/lib/tools.ts`; update app queries alongside schema changes.
- When changing policies, security definer functions, or search-path-sensitive code, review prior hardening migrations for consistency.

## App Integration Checklist

When adding a new table, view, or publishable content type:

1. Add the migration.
2. Update read/write helpers in `src/lib/*`.
3. Update relevant routes in `src/app/(site)` or `src/app/api`.
4. Wire revalidation through `src/app/api/revalidate/route.ts` and `supabase/functions/revalidate/index.ts` if the content is public.
5. Refresh `agents/data/agents.md`.
