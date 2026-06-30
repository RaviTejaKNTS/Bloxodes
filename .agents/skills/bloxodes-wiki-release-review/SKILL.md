---
name: bloxodes-wiki-release-review
description: Review and release Codex-prepared or agent-prepared Bloxodes wiki batches after both collection pages and the wiki hub are complete. Use when the user asks Codex to review ready rows in Writing plans/wiki-pages-progress.md, open localhost pages, wait for per-game approval, then git-push approved game files and seed approved wiki/collection pages to production.
---

# Bloxodes Wiki Release Review

Use this as the Codex release gate after Codex agents finish a game wiki batch. This skill reviews all eligible games, waits for explicit per-game approval, then releases only the approved games.

## Hard Gate

Only review or publish a game when its row in `Writing plans/wiki-pages-progress.md` has both:

- `Collections` = `✅`
- `Wiki` = `✅`

Do not review, publish, stage, or seed collection-only work. A game without a checked wiki page is not eligible.

## Read First

1. `AGENTS.md`
2. `scripts/AGENTS.md`
3. `.agents/skills/bloxodes-game-collection-workflow-runner/SKILL.md`
4. `.agents/skills/bloxodes-wiki-workflow-runner/SKILL.md`
5. `Writing plans/wiki-pages-progress.md`

## Review Phase

1. Parse the progress table and list every eligible row where `Collections` and `Wiki` are both `✅`.
2. Exclude rows already marked `Prod` = `✅` unless the user explicitly asks to recheck them.
3. If the user named specific games, restrict to those games, but still require both checkmarks.
4. For each eligible game, inspect:
- `tmp/content-workspace/<game-slug>/wiki/<game-slug>/final.json`
- `tmp/content-workspace/<game-slug>/collections/*/final.json`
- `data/<Game Data Dir>/`
- `apps/web/public/<Game Name>/`
- `apps/web/src/lib/game-collections/games/<game-slug>.ts`
- shared renderer/config files changed for that game
5. Check that each collection final has a matching local dataset/config and that the wiki final exists.
6. Start or reuse localhost with `npm run dev:local`.
7. Run local verification:

```bash
npm run verify:wiki-final -- --base-url http://localhost:<port> --game <game-slug> --final-json-root tmp/content-workspace/<game-slug>
npm run verify:game-collection-finals -- --base-url http://localhost:<port> --game <game-slug> --final-json-root tmp/content-workspace/<game-slug>/collections
```

8. Run the HTML size gate for the wiki URL and each verified collection URL:

```bash
npm run audit:html-size -- --url http://localhost:<port>/wiki/<game-slug> --fail-on-limit
npm run audit:html-size -- --url http://localhost:<port>/wiki/<game-slug>/<collection-slug> --fail-on-limit
```

9. Open the local wiki and collection URLs in the Codex Browser for the user to inspect. If browser tooling is unavailable, provide the localhost links.
10. Report one line per game: `Ready`, `Needs fixes`, or `Blocked`, with the exact local links and failed checks.
11. Stop. Do not stage, commit, push, or write production until the user explicitly approves one or more games.

## Approval Gate

Approval is per game. Accept only explicit approval such as:

- `Approve Murder Mystery 2`
- `Approve murder-mystery-2 and the-forge`
- `Approve all ready games`

If approval is partial, release only the approved games. Leave every non-approved game out of git and production DB writes.

## Release Scope

Before staging, build an allowlist for each approved game:

- `data/<Game Data Dir>/`
- `apps/web/public/<Game Name>/`
- `apps/web/src/lib/game-collections/games/<game-slug>.ts`
- approved hunks in `apps/web/src/lib/game-collections/games/index.ts`
- approved game-specific renderer/config changes, if any
- seed-script changes only when they are required for the approved game and already reviewed

Never stage:

- `tmp/`
- `Writing plans/`
- `.claude/`
- unrelated game data/assets/config
- another ready-but-unapproved game
- broad generated files unless required and reviewed

Do not use `git add .` or `git add -A`.

For shared files, do not stage the whole file if it includes unapproved games. Stage only approved hunks or stop and ask before making release-scope edits.

## Git And Deploy

1. Show `git status --short` and confirm the staged file list contains only approved game files.
2. Run the relevant checks before commit. At minimum:

```bash
npm run typecheck:web
npm run build:web
```

If the repo has known unrelated TypeScript/script failures, report them clearly and rely on the narrower checks already run only when the failure is demonstrably unrelated.

3. Commit with a message naming the approved game(s).
4. Push the current branch only after the staged scope is correct.
5. Wait for deployment proof before production DB writes:
- check deploy status when available
- check `https://bloxodes.com/api/health`
- confirm the live build/commit is the pushed one
- confirm representative shipped assets return `200`

## Production DB Publish

After deploy is live, publish approved games one game at a time.

1. Confirm production env targets `database.bloxodes.com`.
2. Read existing production `roblox_universes`, `wiki_pages`, and `wiki_collection_pages` rows for the approved game before writing.
3. Run production dry-runs:

```bash
NODE_ENV=production npm run seed:game-wiki-pages -- --dry-run --game <game-slug> --final-json-root tmp/content-workspace/<game-slug>
NODE_ENV=production npm run seed:game-collection-pages -- --dry-run --game <game-slug> --final-json-root tmp/content-workspace/<game-slug>/collections
```

4. Seed production in order:

```bash
NODE_ENV=production npm run seed:game-wiki-pages -- --game <game-slug> --final-json-root tmp/content-workspace/<game-slug> --allow-prod
```

5. Read back the production wiki row.
6. Seed collections:

```bash
NODE_ENV=production npm run seed:game-collection-pages -- --game <game-slug> --final-json-root tmp/content-workspace/<game-slug>/collections --allow-prod
```

7. Read back production collection rows.
8. Verify live URLs:
- `/wiki/<game-slug>`
- every `/wiki/<game-slug>/<collection-slug>`
- representative images/assets
- sitemap inclusion for canonical wiki/collection URLs
- paginated collection URLs are not in the sitemap and use `noindex, follow`

Do not manually enqueue revalidation by default. Poll live pages first; inspect the revalidation queue/worker only if pages stay stale.

## Finish

Only after production readback and live URL checks pass:

1. Update the approved game rows in `Writing plans/wiki-pages-progress.md`:
- `Codex Review` = `✅`
- `Prod` = `✅`
2. Do not stage the progress file unless the user explicitly asks.
3. Return:
- approved games released
- commit and push proof
- deploy proof
- production readback summary
- live URLs
- games reviewed but not approved
- blocked games and exact reason
