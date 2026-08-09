# Bloxodes Repo Guide

This repository now uses path-scoped `AGENTS.md` files as the main operating guide.
When working in a folder, prefer the closest `AGENTS.md` over older reference docs in `agents/`.

## Start Here

- `apps/extension/AGENTS.md`: Chrome MV3 extension packaging, Roblox injection, API use, and Chrome Web Store update rules.
- `apps/mobile/AGENTS.md`: Expo React Native app scope, mobile API contract, and local testing commands.
- `apps/web/src/app/AGENTS.md`: App Router, layouts, feeds, auth routes, and API conventions.
- `apps/web/src/app/(site)/AGENTS.md`: public page families, page-data patterns, SEO, and content route expectations.
- `apps/web/src/app/api/AGENTS.md`: JSON endpoints, mutation safety, session/progress flows, and revalidation behavior.
- `apps/web/src/lib/AGENTS.md`: shared data access, caching, SEO helpers, auth/security utilities, and domain modules.
- `scripts/AGENTS.md`: automation jobs, preferred npm commands, and script authoring rules.
- `docs/testing/content-release-runbook.md`: required daily release decision tree, code-first/DB-second publishing order, automatic checks, targeted verification, manual audit options, and failure handling.
- `supabase/AGENTS.md`: migrations, edge functions, and how DB changes connect back to the app.
- `data/AGENTS.md`: local datasets and which routes/tools consume them.
- `.agents/skills/bloxodes-*-workflow-runner/SKILL.md`: parent review workflows for multi-step content jobs.
- `.agents/skills/bloxodes-article-release-review/SKILL.md`: list completed automated articles, serve managed-dev previews, and publish or reject only explicit human selections.
- `.agents/skills/bloxodes-*-research/SKILL.md`: focused content research and source proof before writing.
- `.agents/skills/bloxodes-game-collection-data/SKILL.md`: game collection dataset, fields, sections, and renderer readiness.
- `.agents/skills/bloxodes-game-collection-images/SKILL.md`: game collection image collection, local image paths, and image readiness.
- `.agents/skills/bloxodes-game-collection-refresh/SKILL.md`: refresh one collection dataset, one game's collection datasets, or all registered game collections, with affected wiki page review and collection suggestions for wider scopes.
- `.agents/skills/bloxodes-*-writing/SKILL.md`: self-contained page-type writing workflows.
- `.agents/skills/bloxodes-*-suggestions/SKILL.md`: focused content opportunity research before writing pages.
- `.agents/skills/bloxodes-simplify-journey-dom/SKILL.md`: audit and flatten card/list page families for Journey automatic in-content ad placement, including pagination and hydrated DOM verification.
- `.agents/skills/bloxodes-release-e2e/SKILL.md`: explicit-only fast publication of completed work directly to production, including required deployment or database publication, local production sync, and retaining the task worktree for follow-up.
- `docs/analytics/README.md`: Umami/GA4 ownership, access, event taxonomy, verification, and the home for future analytics reports.
- `agents/agents.md`: legacy inventory index kept for quick repo-wide reference.

## Architecture Snapshot

- npm workspaces are enabled at the repo root. `npm run build` remains the production web build and delegates to `npm run build:web`.
- Next.js App Router application in `apps/web`, with public content in `apps/web/src/app/(site)` and account/auth flows in `apps/web/src/app/(secure)` plus `apps/web/src/app/auth`.
- Chrome extension source lives in `apps/extension`. It builds a Chrome MV3 upload package and calls Bloxodes web APIs; it is not part of Dokploy deployment.
- Expo React Native mobile source lives in `apps/mobile`. The app is an expo-router client with native codes, catalog, wiki/collection, tools, events, quiz, checklist, and stats screens, all backed by `/api/mobile/*` web routes plus optional bearer-token Roblox login.
- Supabase is the primary content and product data store. Production now uses the self-hosted Supabase stack on the same Hostinger VPS as the web app, with API at `https://database.bloxodes.com`, Studio at `https://studio.bloxodes.com`, and public storage/media URLs at `https://media.bloxodes.com`; the old managed Supabase project is rollback/source-of-truth fallback only until deletion.
- Local datasets in `data/` and `apps/web/src/data/` back a few tools/catalog sections where structured content does not live in Supabase.
- Operational work happens through root `scripts/` and Supabase edge functions in `supabase/functions/`.
- Dokploy deploys the public web app from the root Dockerfile, which builds `@bloxodes/web` and runs `apps/web/server.js`.
- Production web and database now share VPS CPU, memory, disk, and bandwidth. After deploys or infrastructure work, check both the app container and the Supabase stack instead of treating them as separate platforms.
- Runtime freshness uses `revalidation_events` plus the VPS `revalidate` Edge Function. `/api/revalidate` applies Next revalidation and Cloudflare tag purge, then queues `cache_warm_events`; the VPS `cache-warm` Edge Function warms those URLs separately.

## Working Defaults

- Keep pages server-first. Move repeated loaders and rendering helpers into route-family `page-data.tsx` files or `apps/web/src/lib/*`.
- Prefer adding or extending typed helpers in `apps/web/src/lib/db.ts` instead of scattering raw Supabase queries across page files.
- For public content changes, check all of: metadata, JSON-LD, pagination, sitemap coverage, feed coverage, and `/api/revalidate`.
- For mutations, keep origin validation, rate limiting, and tag revalidation explicit.
- Prefer `npm run ...` aliases over direct `tsx path/to/script.ts` when an alias already exists.
- Keep slug ownership explicit: `roblox_universes.slug` is the stats/universe URL slug for `/stats/games/*` and may include the universe ID. Never copy it into editorial page slugs such as `code_pages.slug`, `wiki_pages.slug`, `events_pages.slug`, `checklist_pages.slug`, `quiz_pages.code`, or `wiki_collection_pages.wiki_slug`.
- Invoke `bloxodes-release-e2e` only when the user explicitly names `$bloxodes-release-e2e` or asks for an `e2e`/`end-to-end` production release. Treat that invocation as confirmation that final checks passed. Publish the explicit allowlist directly to `production` without force; use a PR only when the user explicitly requests one. Never include another branch/worktree's changes. After release, synchronize local `production` but keep the current task worktree and branch for immediate follow-up until the user asks for cleanup.

## Design Direction

- Follow root `DESIGN.md` for visual decisions.
- Bloxodes should read as a public live database: plain, readable content plus clean shadcn-style UI components. The shell should take inspiration from Notion: narrow, quiet, low-friction navigation with subtle states.
- Keep SEO-friendly page/article titles and comfortable body text. Do not shrink editorial content into an admin-dashboard density.
- Use shadcn primitives for reusable interface surfaces such as sidebars, search inputs, nav items, buttons, cards, badges, tabs, sheets, dialogs, dropdowns, tooltips, loading states, and empty states.
- Keep shadcn composition minimal. Match Bloxodes tokens and behavior without building heavy custom layouts inside primitives.

## Change Checklists

### Public page or route family

1. Add or update the route in `apps/web/src/app/(site)`.
2. Keep data loading in `page-data.tsx` or `apps/web/src/lib/*` if the route family has multiple pages.
3. Update metadata, canonical handling, and structured data.
4. Update `apps/web/src/app/sitemap.xml/route.ts`, `apps/web/src/app/sitemaps/*`, `apps/web/src/app/feed.xml/route.ts`, or `apps/web/src/app/api/revalidate/route.ts` if the content is publishable.
5. Refresh the relevant inventory doc in `agents/`.

### Game wiki and collection pages

1. Use the matching `.agents/skills/bloxodes-*` skill directly. For new pages, prefer `bloxodes-wiki-workflow-runner` or `bloxodes-game-collection-workflow-runner`. For source-backed maintenance of existing local collection datasets and their wiki pages, use `bloxodes-game-collection-refresh`.
2. Gather game collection item rows through online research and source collection, not Roblox APIs. APIs are only for universe identity, Roblox metadata, thumbnails, or cross-checks; never block a collection because an API does not expose item rows.
3. Before writing, verify the item list, useful fields, image coverage, and route behavior. Do not write around missing source-backed facts.
4. Seed and preview `wiki_pages` and `wiki_collection_pages` locally before production.
5. Keep collection codes in `<game-slug>-<collection-slug>` format.
6. Verify local dataset images, item counts, useful card fields, metadata, sitemaps, search, and revalidation before publishing.
7. Promote to production only through a forward-only migration or controlled idempotent seed/upsert script.

### Codes pages

1. Use the game slug only for `code_pages.slug`, for example `wizard-alchemy`; do not append `-codes` because the route is already `/codes/<slug>`.
2. Do not use `roblox_universes.slug` for `code_pages.slug`; universe slugs are stats-only identifiers and can include universe IDs.
3. Put the Roblox experience URL in `roblox_link`, not in any `source_url` field.
4. Put the RobloxDen codes page in `source_url` and the Beebom codes page in `source_url_2`; `scripts/codes/update-codes.ts` reads those two fields for the refresh workflow.
5. Keep `seo_title` empty or null unless the user explicitly asks for a custom title.
6. Never manually enter active codes, expired codes, code names, rewards tied to current code names, or code dates. Insert or update the `code_pages` row, then run the codes refresh script to populate `codes`.
7. Write code-page prose and metadata for long-term use. Do not include active code names, exact dates, month/year labels, active-code counts, or freshness claims such as `latest`, `current`, `fresh`, or `updated daily`.

### API or auth flow

1. Validate inputs and request origin.
2. Use shared auth/security helpers from `apps/web/src/lib/auth/*` and `apps/web/src/lib/security/*`.
3. Revalidate tags or paths after successful writes.
4. Document new endpoints in `agents/routes/agents.md`.

### Chrome extension

1. Work under `apps/extension` and follow `apps/extension/AGENTS.md`.
2. Keep permissions minimal and use Bloxodes API routes instead of Supabase or edge functions directly.
3. Keep injected UI scoped under `#bloxodes-codes-extension`; avoid generic global class names that can collide with older live extensions.
4. Run `npm run typecheck:extension` and `npm run package:extension`.

### Mobile app

1. Work under `apps/mobile` and follow `apps/mobile/AGENTS.md`.
2. Keep mobile data access behind `apps/web/src/app/api/mobile/*`.
3. Keep progress features local-first with optional account sync through the mobile bearer-session routes; articles and puzzles stay web-only.
4. Run `npm run typecheck:mobile`.

### Database or content model

1. Add a forward-only migration in `supabase/migrations/`.
2. Update the read layer in `apps/web/src/lib/*`.
3. Wire publish/revalidation flows if the new data powers public content.
4. Update the relevant `AGENTS.md` and `agents/data/agents.md`.

### Script or automation

1. Put the job in the correct `scripts/<area>/` folder.
2. Add or update the `package.json` command if the script is part of the normal workflow.
3. Keep shared helpers in `scripts/shared/`.
4. Document side effects, required env, and purpose in `scripts/AGENTS.md` and `agents/scripts/agents.md`.
