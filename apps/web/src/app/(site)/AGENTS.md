# Public Site Routes Guide

## GitHub task and release flow

Stay in the T3-assigned task worktree. Use a PR targeting `production`. Checks, builds, tests, page validation and browser verification run on GitHub, including the commands listed below. Do not install dependencies or run local checks. Production schema/content writes use the CI jobs in `bloxodes-docs/operations/release.md`. Preserve installed runtimes, env files and active jobs.

Scope: `apps/web/src/app/(site)`.

This folder contains the public Bloxodes experience: content hubs, detail pages, catalog sections, tools, policy pages, and route-family helpers.

Scoped route-family guides:

- `apps/web/src/app/(site)/catalog/AGENTS.md`
- `apps/web/src/app/(site)/quizzes/AGENTS.md`
- `apps/web/src/app/(site)/tools/AGENTS.md`

## Shared game pages

Every non-Roblox game uses shared game readers and `components/games` page templates at page-type URLs: `/games/<franchise>` for franchise hubs, then `/wiki`, `/maps`, `/checklists`, `/quizzes`, `/codes`, `/tools` and `/catalog`. Unknown and unpublished pages return 404. `games.kind` and `parent_id` choose a franchise hub or standalone wiki. Old URLs redirect through `site_routes`. The homepage (`app/(site)/page.tsx`, data in `lib/home-page-data.ts`, blocks in `components/home/`) shows franchises in its "Beyond Roblox" block and directory, using the curated link lists in `components/hubs/HubsSidebar.tsx`.

Check metadata, structured data, pagination, shared search, comments, progress, sitemaps, feed and revalidation whenever adding a page type.

## Route Families

- Core content: home, codes, articles, stats, checklists, events, quizzes, wiki pages, puzzles, authors.
- Game-platform entry: `/games`, with franchise hubs at `/games/<franchise>`, all inside the shared Bloxodes shell and components.
- Catalog: music IDs, free Roblox items, admin commands, color codes, decal IDs, The Forge, and generic catalog fallback routes.
- Tools: Roblox ID extractor, Robux/USD, DevEx, The Forge calculators, Grow a Garden calculator, and generic tool fallback routes.
- Static pages: about, contact, policies, disclaimer, editorial, cookie settings.
- Redirect/fallback: registry-backed game routes in `[slug]/[[...segments]]/page.tsx`.

## Working Patterns

- Prefer a sibling `page-data.tsx` when a route family has multiple pages, shared metadata helpers, or both index and detail views.
- Keep heavy data work out of the page file. Route files should mostly compose helpers and present metadata.
- Reuse shared components such as `GameCard`, `ArticleCard`, `PagePagination`, `CommentsSection`, and route-specific client widgets.
- Article Markdown may include validated `tier-list` and `article-checklist` fenced blocks. Keep their schemas in `apps/web/src/lib/article-blocks.ts` and render them through the article detail route rather than allowing raw HTML components in content.
- When interactive UI is required, keep a server wrapper page and isolate client logic in a colocated client component.
- For catalog and tool routes, prefer the shared page primitives for breadcrumb, freshness, FAQ, and rich-content rendering.
- Public pages should feel like readable content inside a clean live-database shell. Keep strong titles and comfortable prose.
- Use shadcn-style primitives for reusable UI surfaces: cards, buttons, badges, search inputs, sheets, sidebars, tabs, tooltips, loading states, and empty states.
- Avoid heavy custom decorative layouts inside shadcn components. Prefer neutral borders, compact spacing, and clear states.

## SEO and Structured Data

- Public pages should define metadata or `generateMetadata`.
- New pages are Google-noindexed until added to the allowlist in `apps/web/src/lib/seo/google-index-policy.ts`.
- Use JSON-LD where the page type clearly maps to content entities like `CollectionPage`, `Article`, `FAQPage`, `ItemList`, or breadcrumbs.
- Canonicals should come from shared helpers in `apps/web/src/lib/seo.ts` and `apps/web/src/lib/site-config.ts`.

## Data Source Split

- Codes, articles, stats, checklists, quizzes, wiki pages, authors, puzzles, and much of catalog/tools content come from Supabase.
- Some catalog/tools pages blend Supabase intro copy with local datasets in `data/`.
- Free items, music IDs, and ID-extractor flows also depend on API routes under `apps/web/src/app/api`.
- Treat global `/catalog` and game-specific `/wiki/<game>/<collection>` as separate pipelines. Their canonical owners are `bloxodes-docs/content/catalog.md` and `bloxodes-docs/content/roblox-wiki.md` respectively; a shared card/list renderer does not merge their data ownership.
- Shared wiki and collection pages use `shared-game-reader.ts` and the common game renderers with stored canonical paths. Never attach non-Roblox rows to Roblox universe or wiki tables.
- Roblox wiki collections use the same `wiki_collection_pages` row with an explicit `page_type`: `database` keeps the existing paginated table/card renderer, while `collectible` uses the shared collectible renderer and local-first/account-synced progress. Keep the page-type decision in the runtime manifest and page row rather than creating a new table.

## Public Route Checklists

### New page family

1. Create route files under the right section.
2. Add sidecar `page-data.tsx` if the family has more than one page.
3. Add metadata, canonical handling, and structured data.
4. Update sitemap and revalidation coverage if the page is publishable or regenerated.

### New catalog or tool

1. Decide whether the long-form copy lives in Supabase, local data files, or both.
2. For catalog pages, use the matching catalog skill before shaping route fields.
3. Update `apps/web/src/lib/catalog.ts`, `apps/web/src/lib/tools.ts`, `apps/web/src/lib/db.ts`, or the relevant dataset parser.
4. Keep route slugs, API filtering, and revalidation behavior aligned.
5. If the page is commentable, wire it through the existing comments flow instead of inventing a new one.
6. Follow the scoped workflow in `catalog/AGENTS.md` or `tools/AGENTS.md`.

## Collection page types

Wiki collection page types are `database` and `collectible` for every game. Standalone `/checklists` pages and progress storage keys are separate from them.

## Standalone game checklists

Standalone checklists live at `/checklists/<slug>` and reuse `ChecklistPageTemplate`, `ChecklistBoard` and the platform-neutral index renderer. Data belongs to `game_checklist_pages` and `game_checklist_items`, linked to `games`. All checkable tasks need exactly three-part section codes. See `bloxodes-docs/content/franchise.md`.

## Shared engagement presentation (2026-09-10)

Checklist and quiz routes use neutral contracts/configuration in `lib/engagement`. Reuse `ChecklistIndexPage`, `ChecklistPageTemplate`, `QuizIndexPage` and `QuizPageTemplate` for presentation changes; keep platform reads and game identities in route data adapters. Quiz sidebar/related content are template slots. Preserve existing progress keys; new platforms need explicit namespaces and supported progress endpoints. See `bloxodes-docs/content/franchise.md` for ownership and verification.


## Shared game reference routes

Page-type routes serve maps, quizzes, catalogs and standalone checklists. Reuse `GameContentPage`, `GameMap`, `GameCatalog`, `GameQuizPage` and the neutral checklist template. Custom tool bodies use `GameToolPageLayout`. GTA maps keep their registered engines; their snapshots load from shared storage.
