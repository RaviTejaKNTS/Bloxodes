# Agents Reference Index

Authoritative instructions now live in the path-scoped `AGENTS.md` files next to the code they govern.
This `agents/` folder remains as a quick-reference inventory for repo-wide discovery.

## Primary Guides

- `AGENTS.md`: root repo workflow and change checklists.
- `apps/extension/AGENTS.md`: Chrome MV3 extension source, Roblox injected UI, and Chrome Web Store packaging rules.
- `apps/mobile/AGENTS.md`: Expo React Native app scope, API contract, and local testing workflow.
- `apps/web/src/app/AGENTS.md`: App Router structure, feeds, sitemaps, auth routes, and route conventions.
- `apps/web/src/app/(site)/AGENTS.md`: public route families, page-data patterns, SEO, and publishable content rules.
- `apps/web/src/app/api/AGENTS.md`: JSON endpoint conventions, mutation safety, extension/mobile APIs, and cache invalidation.
- `apps/web/src/lib/AGENTS.md`: shared data access, caching, auth, SEO, client payload helpers, and domain modules.
- `scripts/AGENTS.md`: automation/script authoring and execution rules.
- `supabase/AGENTS.md`: schema and edge-function guidance.
- `data/AGENTS.md`: local datasets and their consumers.
- `agents/wiki-catalog-workflow.md`: local-first workflow for publishing game datasets as wiki and catalog pages.
- `DESIGN.md`: public live-database design direction, shadcn component usage, design tokens, and readable content rules.
- `docs/platform-monorepo-extension-mobile-plan.md`: current platform snapshot plus longer-term admin, extension, and mobile roadmap.

## Reference Docs In This Folder

- `agents/pages/agents.md`: page and route-family inventory.
- `agents/routes/agents.md`: API, auth, feed, and sitemap route inventory.
- `agents/scripts/agents.md`: script inventory grouped by job type plus preferred npm commands.
- `agents/data/agents.md`: data-source inventory across Supabase, local datasets, and external APIs.
- `agents/wiki-catalog-workflow.md`: repeatable checklist for local `wiki_pages` and `catalog_pages` seeding, rendering, verification, and prod promotion.

## Maintenance Rules

- Update the closest scoped `AGENTS.md` when behavior or workflow changes.
- Update these `agents/*.md` files when the repo surface area changes: new routes, scripts, datasets, or major architecture moves.
- Treat this folder as the discovery layer and the scoped `AGENTS.md` files as the operating layer.
- For workspace-level changes, keep root `package.json`, root `Dockerfile`, `.dockerignore`, and Dokploy notes aligned so production stays web-only unless intentionally expanded.
