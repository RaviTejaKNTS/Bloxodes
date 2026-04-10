# Agents Reference Index

Authoritative instructions now live in the path-scoped `AGENTS.md` files next to the code they govern.
This `agents/` folder remains as a quick-reference inventory for repo-wide discovery.

## Primary Guides

- `AGENTS.md`: root repo workflow and change checklists.
- `src/app/AGENTS.md`: App Router structure, feeds, sitemaps, auth routes, and route conventions.
- `src/app/(site)/AGENTS.md`: public route families, page-data patterns, SEO, and publishable content rules.
- `src/app/api/AGENTS.md`: JSON endpoint conventions, mutation safety, and cache invalidation.
- `src/lib/AGENTS.md`: shared data access, caching, auth, SEO, and domain helpers.
- `scripts/AGENTS.md`: automation/script authoring and execution rules.
- `supabase/AGENTS.md`: schema and edge-function guidance.
- `data/AGENTS.md`: local datasets and their consumers.

## Reference Docs In This Folder

- `agents/pages/agents.md`: page and route-family inventory.
- `agents/routes/agents.md`: API, auth, feed, and sitemap route inventory.
- `agents/scripts/agents.md`: script inventory grouped by job type plus preferred npm commands.
- `agents/data/agents.md`: data-source inventory across Supabase, local datasets, and external APIs.

## Maintenance Rules

- Update the closest scoped `AGENTS.md` when behavior or workflow changes.
- Update these `agents/*.md` files when the repo surface area changes: new routes, scripts, datasets, or major architecture moves.
- Treat this folder as the discovery layer and the scoped `AGENTS.md` files as the operating layer.
