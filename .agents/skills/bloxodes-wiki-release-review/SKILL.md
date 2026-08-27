---
name: bloxodes-wiki-release-review
description: Release Codex-prepared or agent-prepared Bloxodes wiki batches after their wiki and collection workflow final checks and Browser review are complete. Use when the user asks Codex to publish already-reviewed wiki artifacts, wait for per-game release approval, then release approved game files and seed approved wiki/collection pages to production without rerunning content QA.
---

# Bloxodes Wiki Release Review

Use this after agents finish and final-check a game wiki batch. Readiness comes from the actual wiki and collection artifacts plus their completed final review, not a planning tracker. Confirm release scope, wait for explicit per-game approval, then release only the approved games.

Do not publish collection-only work. Require the actual wiki `final.json` and at least one completed collection `final.json` plus its `runtime-manifest.json`; a missing or stale planning-row/checkmark is never a blocker.

## Read First

1. `AGENTS.md`
2. `scripts/AGENTS.md`
3. `.agents/skills/bloxodes-game-collection-workflow-runner/SKILL.md`
4. `.agents/skills/bloxodes-wiki-workflow-runner/SKILL.md`

## Release Intake

1. Use the games named by the user. If the user asks for all completed games, discover candidates from `tmp/content-workspace/*/wiki/*/final.json` and matching collection finals.
2. Check production rows to avoid republishing an already-live game unless the user explicitly asks to update or recheck it.
3. Never create or edit a planning-tracker row merely to make a game eligible.
4. For each eligible game, confirm the release allowlist from:
- `tmp/content-workspace/<game-slug>/wiki/<game-slug>/final.json`
- `tmp/content-workspace/<game-slug>/collections/*/final.json`
- `tmp/content-workspace/<game-slug>/collections/*/runtime-manifest.json` and its task-local dataset/media inputs
- compatibility registry/renderer files only when the approved work intentionally changes application code
5. Treat the user's explicit per-game release approval as confirmation that the normal verifier, dataset validation, HTML-size gate, pagination checks when applicable, and Browser preview already passed. Do not search for separate proof or tracker state.
6. Do not rerun those checks during release. Return an artifact to the appropriate workflow's final-check stage only if the user says checks are incomplete or the release process changes it after approval.
7. Report one line per game: `Ready to release` or `Needs final checks`, with the exact reason when not ready.
8. Stop. Do not stage, commit, push, or write production until the user explicitly approves one or more games.

## Approval Gate

Approval is per game. Accept only explicit approval such as:

- `Approve Murder Mystery 2`
- `Approve murder-mystery-2 and the-forge`
- `Approve all ready games`

If approval is partial, release only the approved games. Leave every non-approved game out of git and production DB writes.

## Release Scope

Before staging, build an allowlist for each approved game:

- existing compatibility data/public media only when the collection has not yet moved to the database/R2 runtime
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

Skip this entire section when the approved game is database/R2-only and has no allowlisted repository change. A database/R2 content publication must not trigger a web deployment.

1. Show `git status --short` and confirm the staged file list contains only approved game files.
2. Reuse the final workflow results. Do not rerun wiki/collection verifiers, dataset validation, Browser inspection, HTML-size checks, typecheck, or a local production build. Run `git diff --check` and any genuinely necessary tiny release-scope syntax check; let the production workflow perform the one deployable build before changing the live container.

3. Commit with a message naming the approved game(s).
4. Push the task HEAD directly to `production` without force after the staged scope is correct. Do not open a PR unless the user explicitly requests one.
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
BLOXODES_ENV_PROFILE=production-preview NODE_ENV=production npm run seed:game-wiki-pages -- --dry-run --game <game-slug> --final-json-root tmp/content-workspace/<game-slug>
```

4. Seed production in order:

```bash
BLOXODES_ENV_PROFILE=production-preview NODE_ENV=production npm run seed:game-wiki-pages -- --game <game-slug> --final-json-root tmp/content-workspace/<game-slug> --allow-prod
```

5. Read back the production wiki row.
6. Publish each approved collection revision to the production database. Run the manifest dry-run first, then the guarded sync. The sync verifies or uploads immutable objects in the shared R2 bucket:

```bash
BLOXODES_ENV_PROFILE=production-preview BLOXODES_ENV_OVERLAYS=cloudflare NODE_ENV=production npm run sync:game-collection-runtime -- --manifest tmp/content-workspace/<game-slug>/collections/<collection-slug>/runtime-manifest.json
BLOXODES_ENV_PROFILE=production-preview BLOXODES_ENV_OVERLAYS=cloudflare NODE_ENV=production npm run sync:game-collection-runtime -- --manifest tmp/content-workspace/<game-slug>/collections/<collection-slug>/runtime-manifest.json --apply --upload-media --publish --allow-prod
```

The command reuses content-addressed objects already uploaded during managed-development review, uploads only missing immutable objects, verifies all references, inserts an immutable dataset revision, verifies its rows, and only then changes the page's published pointer. Do not copy collection datasets or item media into the production web deploy.

7. Read back the production collection page, published dataset revision, item count, and representative R2 object.
8. Verify live URLs:
- `/wiki/<game-slug>`
- every `/wiki/<game-slug>/<collection-slug>`
- representative images/assets
- sitemap inclusion for canonical wiki/collection URLs
- paginated collection URLs are not in the sitemap and use `noindex, follow`

Do not manually enqueue revalidation by default. Poll live pages first; inspect the revalidation queue/worker only if pages stay stale.

## Finish

Only after production readback and live URL checks pass, return:
- approved games released
- commit and push proof
- deploy proof
- production readback summary
- live URLs
- games reviewed but not approved
- blocked games and exact reason

Keep the current task worktree and branch available for immediate follow-up. Remove them only when the user explicitly asks for cleanup.
