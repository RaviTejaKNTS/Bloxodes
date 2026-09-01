# Agents Reference Index

Authoritative instructions now live in the path-scoped `AGENTS.md` files next to the code they govern.
This `agents/` folder remains as a quick-reference inventory for repo-wide discovery.

## Primary Guides

- `AGENTS.md`: root repo workflow and change checklists.
- `apps/extension/AGENTS.md`: Chrome MV3 extension source, Roblox injected UI, and Chrome Web Store packaging rules.
- `apps/mobile/AGENTS.md`: Expo React Native app scope, API contract, and local testing workflow.
- `apps/web/src/app/AGENTS.md`: App Router structure, feeds, sitemaps, auth routes, and route conventions.
- `apps/web/src/app/(site)/AGENTS.md`: public route families, page-data patterns, SEO, and publishable content rules.
- `apps/web/src/app/(site)/quizzes/AGENTS.md`: quiz route behavior, local question pool rules, and preview checks.
- `apps/web/src/app/api/AGENTS.md`: JSON endpoint conventions, mutation safety, extension/mobile APIs, and cache invalidation.
- `apps/web/src/lib/AGENTS.md`: shared data access, caching, auth, SEO, client payload helpers, and domain modules.
- `scripts/AGENTS.md`: automation/script authoring and execution rules.
- `supabase/AGENTS.md`: schema and edge-function guidance.
- `data/AGENTS.md`: local datasets and their consumers.
- `.agents/skills/bloxodes-*-workflow-runner/SKILL.md`: parent review workflows for multi-step content jobs.
- `.agents/skills/bloxodes-*-research/SKILL.md`: focused content research and source proof before writing.
- `.agents/skills/bloxodes-game-collection-refresh/SKILL.md`: fast maintenance for existing collection data and item images across one dataset, one game, or all registered collections; no new-collection discovery or suggestions.
- `.agents/skills/bloxodes-*-writing/SKILL.md`: self-contained page-type writing workflows.
- `.agents/skills/bloxodes-*-suggestions/SKILL.md`: focused content opportunity research before writing pages.
- `.agents/skills/bloxodes-simplify-journey-dom/SKILL.md`: flat direct-child DOM workflow and local/live verification for Journey automatic in-content ads.
- `DESIGN.md`: public live-database design direction, shadcn component usage, design tokens, and readable content rules.
- `docs/analytics/journey-auto-ads-dom-refactor-2026-07-14.md`: Music IDs and Decal IDs Journey refactor record, validation evidence, and reusable DOM contract.
- `docs/platform-monorepo-extension-mobile-plan.md`: current platform snapshot plus longer-term admin, extension, and mobile roadmap.

## Reference Docs In This Folder

- `agents/pages/agents.md`: page and route-family inventory.
- `agents/routes/agents.md`: API, auth, feed, and sitemap route inventory.
- `agents/scripts/agents.md`: script inventory grouped by job type plus preferred npm commands.
- `agents/data/agents.md`: data-source inventory across Supabase, local datasets, and external APIs.

## Maintenance Rules

- Update the closest scoped `AGENTS.md` when behavior or workflow changes.
- Update these `agents/*.md` files when the repo surface area changes: new routes, scripts, datasets, or major architecture moves.
- For writing workflow changes, update the relevant `.agents/skills/*/SKILL.md` files directly.
- Treat this folder as the discovery layer and the scoped `AGENTS.md` files as the operating layer.
- For workspace-level changes, keep root `package.json`, root `Dockerfile`, `.dockerignore`, and Dokploy notes aligned so production stays web-only unless intentionally expanded.
