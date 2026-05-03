# Shared Library Guide

Scope: `apps/web/src/lib`.

Most application behavior should flow through this folder before it reaches page files or API routes.

## Key Modules

- `db.ts`: typed Supabase reads for page families, list pages, detail pages, search-backed views, free items, quizzes, and progress data.
- `catalog.ts`, `tools.ts`, and `wiki.ts`: Supabase-backed content helpers, related-content aggregators, and index readers.
- `seo.ts`, `site-config.ts`, `sitemap.ts`, `content-dates.ts`, `updated-label.ts`: metadata, canonical URLs, sitemap shaping, and freshness labels.
- `auth/*`: session cookies, Roblox OAuth helpers, navigation safety, and current-user lookup.
- `security/*`: request origin checks, IP extraction, CSP, and rate limiting.
- `comments.ts` and `comment-moderation.ts`: comment formatting, tags, and moderation decisions.
- Domain helpers:
  - `forge/*`
  - `grow-a-garden/*`
  - `devex/*`
  - `music-ids-search.ts`
  - `free-items-search.ts`

## Data Access Rules

- Prefer adding new read helpers here instead of querying Supabase directly inside page files.
- Use view tables for index pages and lighter queries when possible.
- Use `unstable_cache` with meaningful tags for read-heavy, shared loaders.
- When a view may lag or differ from the base table, keep a safe fallback query with a compatible field set.

## Shared Utility Rules

- Keep normalization, slug handling, and search parsing centralized.
- Avoid duplicating canonical URL logic or SEO text assembly in page files.
- Security and auth helpers should stay composable so API routes and auth routes can share them.

## Testing

- Existing focused tests live under:
  - `apps/web/src/lib/__tests__`
  - `apps/web/src/lib/security/__tests__`
  - `apps/web/src/lib/forge/__tests__`
- If you change parsing, security, moderation, or calculator logic, add or update targeted tests here.

## When Extending the App

1. Add shared typed helpers in `apps/web/src/lib/*`.
2. Keep route files and UI components thin.
3. If content is publishable, expose tags that `/api/revalidate` can target.
4. Update the relevant doc in `agents/data/agents.md` or `agents/routes/agents.md`.
