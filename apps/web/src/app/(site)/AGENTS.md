# Public Site Routes Guide

Scope: `apps/web/src/app/(site)`.

This folder contains the public Bloxodes experience: content hubs, detail pages, catalog sections, tools, policy pages, and route-family helpers.

Scoped route-family guides:

- `apps/web/src/app/(site)/catalog/AGENTS.md`
- `apps/web/src/app/(site)/quizzes/AGENTS.md`
- `apps/web/src/app/(site)/tools/AGENTS.md`

## Route Families

- Core content: home, codes, articles, stats, checklists, events, quizzes, wiki pages, puzzles, authors.
- Catalog: music IDs, free Roblox items, admin commands, color codes, decal IDs, The Forge, and generic catalog fallback routes.
- Tools: Roblox ID extractor, Robux/USD, DevEx, The Forge calculators, Grow a Garden calculator, and generic tool fallback routes.
- Static pages: about, contact, policies, disclaimer, editorial, cookie settings.
- Redirect/fallback: legacy slug resolver in `[slug]/page.tsx`.

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
- Use JSON-LD where the page type clearly maps to content entities like `CollectionPage`, `Article`, `FAQPage`, `ItemList`, or breadcrumbs.
- Canonicals should come from shared helpers in `apps/web/src/lib/seo.ts` and `apps/web/src/lib/site-config.ts`.

## Data Source Split

- Codes, articles, stats, checklists, quizzes, wiki pages, authors, puzzles, and much of catalog/tools content come from Supabase.
- Some catalog/tools pages blend Supabase intro copy with local datasets in `data/`.
- Free items, music IDs, and ID-extractor flows also depend on API routes under `apps/web/src/app/api`.
- Treat global `/catalog` and game-specific `/wiki/<game>/<collection>` as separate pipelines. Their canonical owners are `dev-docs/pipelines/catalog.md` and `dev-docs/pipelines/wiki-collections.md` respectively; a shared card/list renderer does not merge their data ownership.

## Public Route Checklists

### New page family

1. Create route files under the right section.
2. Add sidecar `page-data.tsx` if the family has more than one page.
3. Add metadata, canonical handling, and structured data.
4. Update sitemap and revalidation coverage if the page is publishable or regenerated.
5. Refresh `agents/pages/agents.md`.

### New catalog or tool

1. Decide whether the long-form copy lives in Supabase, local data files, or both.
2. For catalog pages, use `agents/content-writing/agents.md` and the matching catalog skill before shaping route fields.
3. Update `apps/web/src/lib/catalog.ts`, `apps/web/src/lib/tools.ts`, `apps/web/src/lib/db.ts`, or the relevant dataset parser.
4. Keep route slugs, API filtering, and revalidation behavior aligned.
5. If the page is commentable, wire it through the existing comments flow instead of inventing a new one.
6. Follow the scoped workflow in `catalog/AGENTS.md` or `tools/AGENTS.md`.
