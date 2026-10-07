# Bloxodes Repo Guide

This repository now uses path-scoped `AGENTS.md` files as the main operating guide.
When working in a folder, prefer the closest `AGENTS.md` over older reference docs in `agents/`.

## Start Here

- `dev-docs/README.md`: canonical last-verified architecture and operations index; prefer this over old `docs/` and `agents/` narratives for current-state understanding.
- `dev-docs/architecture.md`: verified production request, data, and automation topology plus known degraded components.
- `dev-docs/environment.md`: env profiles, overlays, ignored value storage, committed examples, runtime ownership, and safety rules.
- `apps/extension/AGENTS.md`: Chrome MV3 extension packaging, Roblox injection, API use, and Chrome Web Store update rules.
- `apps/admin-extension/AGENTS.md`: personal unpacked-only admin popup plus full-page editor for codes pages and articles through `/api/admin/*`.
- `apps/mobile/AGENTS.md`: Expo React Native app scope, mobile API contract, and local testing commands.
- `apps/web/src/app/AGENTS.md`: App Router, layouts, feeds, auth routes, and API conventions.
- `apps/web/src/app/(site)/AGENTS.md`: public page families, page-data patterns, SEO, and content route expectations.
- `apps/web/src/app/api/AGENTS.md`: JSON endpoints, mutation safety, session/progress flows, and revalidation behavior.
- `apps/web/src/lib/AGENTS.md`: shared data access, caching, SEO helpers, auth/security utilities, and domain modules.
- `scripts/AGENTS.md`: automation jobs, preferred npm commands, and script authoring rules.
- `dev-docs/operations/deployment.md`: current production deployment flow and ownership.
- `dev-docs/infrastructure/homelab.md`: current homelab article automation and health.
- `dev-docs/pipelines/catalog.md`: global Roblox `/catalog` data, refresh, page, and release ownership.
- `dev-docs/pipelines/wiki-collections.md`: game wiki hubs and their game-specific collection workflow/data ownership.
- `supabase/AGENTS.md`: migrations, edge functions, and how DB changes connect back to the app.
- `data/AGENTS.md`: local datasets and which routes/tools consume them.
- `.agents/skills/bloxodes-game-plan/SKILL.md`: research and plan useful page types for any non-Roblox game.
- `.agents/skills/bloxodes-games-reference-pages/SKILL.md`: shared maps, standalone checklists, quizzes and catalogs.
- `.agents/skills/bloxodes-*-workflow-runner/SKILL.md`: parent review workflows for multi-step content jobs.
- `.agents/skills/bloxodes-article-release-review/SKILL.md`: list completed automated articles, serve managed-dev previews, and publish or reject only explicit human selections.
- `.agents/skills/bloxodes-article-images/SKILL.md`: run a separate collection-style image pass for location guides, routes, NPCs, puzzle steps, collectibles, and other visually dependent articles before writing.
- `.agents/skills/bloxodes-*-research/SKILL.md`: focused content research and source proof before writing.
- `.agents/skills/bloxodes-game-collection-data/SKILL.md`: game collection dataset, fields, sections, and renderer readiness.
- `.agents/skills/bloxodes-game-collection-images/SKILL.md`: game collection image collection, local image paths, and image readiness.
- `.agents/skills/bloxodes-game-collection-refresh/SKILL.md`: quickly check existing collection datasets for verified data changes and missing item images, then update only affected collections.
- `.agents/skills/bloxodes-gta-wiki-*/SKILL.md`: GTA-specific source, wiki suggestion, research, writing, and parent workflow rules for `/gta/wiki/<game-slug>`.
- `.agents/skills/bloxodes-gta-game-collection-*/SKILL.md`: GTA-specific collection suggestion, research, data, image, writing, workflow, and refresh rules for `/gta/wiki/<game-slug>/<collection-slug>`; never substitute the Roblox collection skills.
- `.agents/skills/bloxodes-*-writing/SKILL.md`: self-contained page-type writing workflows.
- `.agents/skills/bloxodes-*-suggestions/SKILL.md`: focused content opportunity research before writing pages.
- `.agents/skills/bloxodes-simplify-journey-dom/SKILL.md`: audit and flatten card/list page families for Journey automatic in-content ad placement, including pagination and hydrated DOM verification.
- `.agents/skills/bloxodes-release-e2e/SKILL.md`: explicit-only publication through protected production PRs and GitHub content jobs, with exact-SHA verification and safe task cleanup.
- `dev-docs/pipelines/indexing-distribution.md`: current indexing, analytics, and distribution ownership.
- `agents/agents.md`: legacy inventory index kept for quick repo-wide reference.

## Architecture Snapshot

- npm workspaces are enabled at the repo root. `npm run build` remains the production web build and delegates to `npm run build:web`.
- Next.js App Router application in `apps/web`, with public content in `apps/web/src/app/(site)` and account/auth flows in `apps/web/src/app/(secure)` plus `apps/web/src/app/auth`.
- Chrome extension source lives in `apps/extension`. It builds a Chrome MV3 upload package and calls Bloxodes web APIs; it is not part of Dokploy deployment.
- Expo React Native mobile source lives in `apps/mobile`. The app is an expo-router client with native codes, catalog, wiki/collection, tools, events, quiz, checklist, and stats screens, all backed by `/api/mobile/*` web routes plus optional bearer-token Roblox login.
- Supabase is the primary content and product data store. Production uses the self-hosted stack on the same Hostinger VPS as the web app, with API at `https://database.bloxodes.com`, Studio at `https://studio.bloxodes.com`, and public storage/media URLs at `https://media.bloxodes.com`. All workstation development and non-production content work use the separate managed HTTPS `*.supabase.co` development project. The local Supabase CLI database is retired and must not be used.
- Local datasets in `data/` and `apps/web/src/data/` back a few tools/catalog sections where structured content does not live in Supabase.
- Operational work happens through root `scripts/` and Supabase edge functions in `supabase/functions/`.
- Dokploy deploys the public web app from the root Dockerfile, which builds `@bloxodes/web` and runs `apps/web/server.js`.
- Production web and database now share VPS CPU, memory, disk, and bandwidth. After deploys or infrastructure work, check both the app container and the Supabase stack instead of treating them as separate platforms.
- Runtime freshness uses `revalidation_events` plus the VPS `revalidate` Edge Function. `/api/revalidate` applies Next revalidation and Cloudflare tag purge, then queues `cache_warm_events`; the VPS `cache-warm` Edge Function warms those URLs separately.

## Workspace and branches

- T3 assigns one worktree and branch to each task. Stay in the worktree bound to the current thread. Do not launch another thread or create extra branches/worktrees for the same task.
- Keep `/srv/data/projects/Bloxodes` on `production` as the clean main checkout. `/home/teja/projects/Bloxodes` is its compatibility link. T3 task checkouts use `/srv/data/t3code/worktrees/Bloxodes/`; all development source, Git history, env storage and drafts resolve to the HDD. Preserve detached article/automation release and rollback checkouts.
- Use T3 worktree mode. Start a new task from a fresh `origin/production`; do not reset an existing task when production advances. Automatic setup waits before the first agent turn, links the main `.envs` and shared authoring folders, and creates checkout-owned scratch directories. It does not install dependencies or run checks. Never share `node_modules`, build output, preview state or automation queue/lease files.
- Shared drafts live under `tmp/content-workspace`, `tmp/game-plans`, `tmp/game-collection-suggestions` and `tmp/game-collection-runs`. Before editing a game, run `npm run claim:shared-content -- --game <slug>` from the assigned checkout. Release it with the same command plus `--release` when finished. Another checkout must not edit that game while its claim exists. Read old article artifacts and research through `tmp/shared-history`; keep new pipeline state in the task's own scratch directory.
- Run checks, tests, builds, content validation and browser verification on GitHub. Do not run them locally. Use the PR workflow's screenshots and reports for review. Local work is inspection, authoring and edits.
- Commit only the current task's allowlist. Push its branch and open a PR targeting `production`. Link the PR to T3 immediately. Use T3's PR watcher while waiting for checks.
- Before opening a code PR, use an independent Codex subagent to review the task diff. Address supported findings. Docs and skills-only changes use internal review without a paid GitHub review.
- `Selective Codex review` reviews ready code PRs on opening, reopening or leaving draft. It skips docs, skills and content-only changes. Pushes cancel stale reviews without starting another paid review. After code fixes, run `gh workflow run codex-review.yml --ref production -f pull_request=<number>` when ready, and inspect the feedback for that exact head SHA. A review comment does not replace `Required PR checks` or authorize release.
- Merge only after `Required PR checks` passes and the task has release authorization. Never push directly to `production`, force-push it, or bypass protection.
- GitHub deletes the remote task branch after merge. Once the thread has stopped using its checkout, run `cleanup:task-worktree` from another checkout for that exact finished task. The helper requires clean, merged history, a T3 inactivity check and `--inactive-confirmed` on apply. It archives private task scratch files with hash readback before removal and refuses outstanding content claims. Never delete the active thread's worktree or another unfinished task.
- Fast-forward the clean main checkout to the released production SHA. Do not install dependencies there or change installed services, env files, timers or running jobs as part of a release.

## Working Defaults

- Treat canonical documentation maintenance as part of implementation. Any change to architecture, env ownership, infrastructure, deployment, data flow, or a pipeline must update its existing `dev-docs/` owner in the same change. Keep the stable filename, refresh `Last verified` only after rechecking evidence, and do not create parallel current-state docs. New rough notes belong in `docs/YYYY-MM-DD-topic.md`.
- Use GitHub browser artifacts for task preview QA. The existing homelab preview is operator infrastructure, not a task build target. When the user explicitly requests that existing preview, bind Next to `0.0.0.0` and hand off Tailscale links. The verified homelab preview base is `http://teja-homelab.tail13b5bd.ts.net:3000` with `http://100.86.117.125:3000` as the direct-IP fallback; append the route under that base. Keep the public canonical URL as `https://bloxodes.com/...` and do not expose production credentials or publish to production for preview QA.
- Keep pages server-first. Move repeated loaders and rendering helpers into route-family `page-data.tsx` files or `apps/web/src/lib/*`.
- Prefer adding or extending typed helpers in `apps/web/src/lib/db.ts` instead of scattering raw Supabase queries across page files.
- For public content changes, check all of: metadata, JSON-LD, pagination, sitemap coverage, feed coverage, and `/api/revalidate`.
- For mutations, keep origin validation, rate limiting, and tag revalidation explicit.
- Prefer `npm run ...` aliases over direct `tsx path/to/script.ts` when an alias already exists.
- Treat `docs/`, `Writing plans/`, and legacy `agents/` narratives as notes, plans, reports, or historical evidence that can be outdated or unimplemented. Current architecture belongs in the existing owning `dev-docs/` file with a `Last verified` date.
- Store real workstation env values only in ignored `.envs/`; committed contracts live in `env/examples/`. Development defaults to managed Supabase development, production/test use process-only, and production preview is explicit. See `dev-docs/environment.md`.
- Keep slug ownership explicit: `roblox_universes.slug` is the stats/universe URL slug for `/stats/games/*` and may include the universe ID. Never copy it into editorial page slugs such as `code_pages.slug`, `wiki_pages.slug`, `events_pages.slug`, `checklist_pages.slug`, `quiz_pages.code`, or `wiki_collection_pages.wiki_slug`.
- Invoke `bloxodes-release-e2e` only for an explicit release request. It uses the assigned task branch and a PR targeting `production`. GitHub owns checks, schema application, build/deploy and selected content publication. A release request covers the current task's reviewed allowlist, not unrelated pages, env changes or service control. See `dev-docs/operations/deployment.md` for the release contract.


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
2. For GTA pages, use the corresponding `bloxodes-gta-wiki-*` or `bloxodes-gta-game-collection-*` skill. GTA skills own GTA source rules, workspace, routes, scripts, mode boundaries, and managed-development safety rules. Development and production storage use namespace-scoped shared `games`/`game_*` tables; do not use Roblox universe IDs or Roblox publication commands.
3. Gather game collection item rows through online research and source collection, not Roblox APIs. APIs are only for universe identity, Roblox metadata, thumbnails, or cross-checks; never block a collection because an API does not expose item rows.
4. Before writing, verify the item list, useful fields, image coverage, and route behavior. Do not write around missing source-backed facts.
5. Seed page copy and publish the immutable collection dataset/media revision in managed development before preview or production.
6. Keep collection codes in `<game-slug>-<collection-slug>` format.
7. Verify authoring data/media, database pointer and item-count readback, useful card fields, metadata, sitemaps, search, and revalidation before publishing. Runtime must not depend on local collection files.
8. Promote to production only through a forward-only migration or controlled idempotent seed/upsert script.

### Standalone checklists

1. Normally create only source-verified 100% completion checklists. Record the game, edition or mode and full completion requirements; defer the page when that scope cannot be verified.
2. Normally keep one standalone checklist page per game, containing one board with sections for required activities. Reuse the game's existing checklist; extra pages for editions, modes, preparation, beginner milestones or routines need an explicit user exception.
3. Keep collectible collection trackers separate. Completing an achievement or collectible roster does not establish in-game 100% completion. See `dev-docs/pipelines/content.md#standalone-checklist-scope`.

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
4. GitHub CI runs `npm run typecheck:extension` and `npm run package:extension`.

### Mobile app

1. Work under `apps/mobile` and follow `apps/mobile/AGENTS.md`.
2. Keep mobile data access behind `apps/web/src/app/api/mobile/*`.
3. Keep progress features local-first with optional account sync through the mobile bearer-session routes; articles and puzzles stay web-only.
4. GitHub CI runs `npm run typecheck:mobile`.

### Database or content model

1. Add a forward-only migration in `supabase/migrations/`.
2. GitHub runs `supabase:migrations:check`, plans/applies against managed development, then proves and applies the approved merged SHA to production before dependent web deployment. Use forward migrations and separate destructive removals from the earlier compatibility release.
3. Update the read layer in `apps/web/src/lib/*`.
4. Wire publish/revalidation flows if the new data powers public content.
5. Update the relevant existing `dev-docs/` owner, `AGENTS.md`, and `agents/data/agents.md`.

### Script or automation

1. Put the job in the correct `scripts/<area>/` folder.
2. Add or update the `package.json` command if the script is part of the normal workflow.
3. Keep shared helpers in `scripts/shared/`.
4. GitHub runs `npm run env:doctor -- --ci` when env ownership or runtime loading changes.
5. Document side effects, required env, and purpose in `scripts/AGENTS.md`, the existing owning `dev-docs/` file, and `agents/scripts/agents.md`.
