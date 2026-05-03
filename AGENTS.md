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
- `supabase/AGENTS.md`: migrations, edge functions, and how DB changes connect back to the app.
- `data/AGENTS.md`: local datasets and which routes/tools consume them.
- `agents/agents.md`: legacy inventory index kept for quick repo-wide reference.

## Architecture Snapshot

- npm workspaces are enabled at the repo root. `npm run build` remains the production web build and delegates to `npm run build:web`.
- Next.js App Router application in `apps/web`, with public content in `apps/web/src/app/(site)` and account/auth flows in `apps/web/src/app/(secure)` plus `apps/web/src/app/auth`.
- Chrome extension source lives in `apps/extension`. It builds a Chrome MV3 upload package and calls Bloxodes web APIs; it is not part of Dokploy deployment.
- Expo React Native mobile source lives in `apps/mobile`. The current mobile V1 is a codes index/detail client backed by `/api/mobile/*` web routes.
- Supabase is the primary content and product data store. Pages usually read from views via `apps/web/src/lib/db.ts`, `apps/web/src/lib/catalog.ts`, and `apps/web/src/lib/tools.ts`.
- Local datasets in `data/` and `apps/web/src/data/` back a few tools/catalog sections where structured content does not live in Supabase.
- Operational work happens through root `scripts/` and Supabase edge functions in `supabase/functions/`.
- Dokploy deploys the public web app from the root Dockerfile, which builds `@bloxodes/web` and runs `apps/web/server.js`.

## Working Defaults

- Keep pages server-first. Move repeated loaders and rendering helpers into route-family `page-data.tsx` files or `apps/web/src/lib/*`.
- Prefer adding or extending typed helpers in `apps/web/src/lib/db.ts` instead of scattering raw Supabase queries across page files.
- For public content changes, check all of: metadata, JSON-LD, pagination, sitemap coverage, feed coverage, and `/api/revalidate`.
- For mutations, keep origin validation, rate limiting, and tag revalidation explicit.
- Prefer `npm run ...` aliases over direct `tsx path/to/script.ts` when an alias already exists.

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
3. Keep V1 focused on codes index/detail until the shared client and auth model mature.
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
