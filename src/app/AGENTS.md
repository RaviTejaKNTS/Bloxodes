# App Router Guide

Scope: everything under `src/app/`.

Use this file for route-level work. For public content route specifics, also read `src/app/(site)/AGENTS.md`.

## Structure

- `layout.tsx`, `globals.css`, and `robots.ts` define global shell behavior.
- `(site)/` holds public pages and most SEO-sensitive routes.
- `(secure)/` holds logged-in account pages and login UI.
- `api/` holds JSON endpoints for search, tools, progress/session state, comments, consent, health, avatar updates, and revalidation.
- `auth/roblox/` holds Roblox OAuth entry and callback routes.
- `feed.xml/`, `sitemap.xml/`, and `sitemaps/*` generate feed and sitemap output.

## Page Conventions

- Server components are the default. Use client components only for interactive pieces.
- If a route family has index/detail/pagination variants, keep shared loaders and view helpers in a sibling `page-data.tsx`.
- Keep route files thin. Prefer `src/lib/*` for database access and cross-route logic.
- Public content pages should set metadata and structured data close to the route family, not ad hoc inside unrelated components.
- Preserve readable public content hierarchy: large useful titles and comfortable body copy are allowed and expected.
- For shared UI surfaces, prefer shadcn primitives from `src/components/ui` and keep their composition simple.

## Route Handler Conventions

- `api/*` routes should return JSON through `NextResponse`.
- Mutations should validate request origin and rate-limit where appropriate.
- After writes, revalidate with `revalidateTag` or `revalidatePath` rather than leaving cache invalidation implicit.
- Auth routes should keep `X-Robots-Tag` or equivalent noindex behavior where login callbacks are involved.

## SEO, Feed, and Sitemap Hooks

- Public publishable content currently spans codes, articles, lists, authors, events, checklists, quizzes, wiki pages, tools, and catalog pages.
- If you add a new public content type or route family, review:
  - `src/app/api/revalidate/route.ts`
  - `src/app/feed.xml/route.ts`
  - `src/app/sitemap.xml/route.ts`
  - the relevant route under `src/app/sitemaps/`

## Current App-Level Patterns

- Route families such as codes, events, lists, tools, catalog/free-items, and quizzes use sidecar helpers instead of pushing all logic into page files.
- Account and session state are split between `(secure)` UI, `api/*/session`, and `src/lib/auth/*`.
- Several public pages combine Supabase content with local datasets or API-driven clients. Keep that split obvious.

## When Adding or Changing Routes

1. Put the route in the correct group: `(site)`, `(secure)`, `api`, `auth`, `feed.xml`, or `sitemaps`.
2. Decide whether the route is static, ISR, or dynamic and make that explicit.
3. If the route is public and canonical, make sure sitemap/feed/revalidation coverage stays correct.
4. Update the matching inventory in `agents/pages/agents.md` or `agents/routes/agents.md`.
