---
name: bloxodes-game-collection-refresh
description: Refresh Bloxodes local Roblox game collection datasets and their related game wiki collection pages. Use when the user names one collection dataset, names one game and wants all of its collection data checked, or invokes the skill without a selector to refresh every registered game collection. Research source-backed changes, update affected data, images, renderer configuration, and page copy, validate locally, and run collection suggestions only for game-wide or all-games scopes. Do not publish production changes.
---

# Bloxodes Game Collection Refresh

Act as the parent reviewer for collection maintenance. Reuse the focused collection skills instead of restating or weakening their contracts.

## Read First

1. Read the repository `AGENTS.md` and the closest path-scoped instructions for every file changed.
2. Read these skills completely:
   - `.agents/skills/bloxodes-game-collection-research/SKILL.md`
   - `.agents/skills/bloxodes-game-collection-data/SKILL.md`
   - `.agents/skills/bloxodes-game-collection-images/SKILL.md`
   - `.agents/skills/bloxodes-game-collection-writing/SKILL.md`
   - `.agents/skills/bloxodes-game-collection-workflow-runner/SKILL.md`
3. For game-wide or all-games scope, also read `.agents/skills/bloxodes-game-collection-suggestions/SKILL.md`.

## Scope

Work only on local v2 game collection datasets and their `/wiki/<game-slug>/<collection-slug>` pages.

- Treat `GAME_COLLECTION_GROUPS` and `GAME_COLLECTIONS` in `apps/web/src/lib/game-collections` as the registered collection inventory.
- Treat an unregistered local file as a collection candidate only when it uses the v2 `{ meta, items[].item, items[].system }` contract and belongs to a registered game's data directory.
- Ignore every non-collection file. Do not classify, refresh, report, or hand it to another workflow.
- Keep editorial slugs separate from `roblox_universes.slug`.
- Never publish, push, seed production, or invoke a release skill. Prepare and verify local work, then report the release scope.

## Resolve The Mode

Run the deterministic planner before research. Give `--output` a run-specific ignored path so the work is resumable.

```bash
npm run plan:game-collection-refresh -- --game <game-name-or-slug> --collection <collection-slug-or-file> --output tmp/content-workspace/game-collection-refresh/<run-id>/manifest.json
npm run plan:game-collection-refresh -- --game <game-name-or-slug> --output tmp/content-workspace/game-collection-refresh/<run-id>/manifest.json
npm run plan:game-collection-refresh -- --output tmp/content-workspace/game-collection-refresh/<run-id>/manifest.json
```

Apply these mode rules:

- **One collection:** Refresh exactly one resolved dataset and its related page when needed. Do not inspect sibling datasets. Do not run suggestions.
- **One game:** Refresh every registered or v2 collection dataset for the resolved game. Run suggestions once after existing collection work is complete.
- **No selector:** Refresh all registered game groups and all of their registered or v2 collection datasets. Run suggestions once per game. Process a resumable queue and checkpoint after each game.

If a collection selector is ambiguous, stop and require a game selector. If a registered dataset is missing or not v2, record it as blocked instead of silently skipping it.

## Parent Workflow

For one-collection mode, process the single manifest entry. For wider scopes, keep at most three collection workers active alongside the parent and give each worker one collection only. Queue the rest.

For each collection:

1. Record the baseline dataset path, registered state, item count, sections, public fields, image coverage, and current page state.
2. Run the targeted v2 audit before editing.
3. Use `bloxodes-game-collection-research` to research current sources. Extend `brief.md` with a maintenance delta:
   - previous item count and source item count
   - added, removed, renamed, and changed items
   - changed player-facing fields or mechanics
   - section, ordering, and image changes
   - disputed facts and accepted gaps
   - whether page copy is affected, with exact fields
4. Approve, refine, or block the evidence before editing data.
5. Use `bloxodes-game-collection-data` to apply only source-backed changes and update data-readiness notes.
6. Review v2 shape, field consistency, sections, ordering, descriptions, presentation kinds, and renderer support.
7. Use `bloxodes-game-collection-images` only when new, removed, renamed, or better-supported images require an image pass.
8. Decide whether page copy needs a writing pass using the page-impact rules below.
9. Run targeted dataset, copy, route, size, pagination, and Browser checks in proportion to the change.
10. Update the manifest entry with completed gates, changed files, blockers, and page impact before moving on.

If subagents are unavailable, run the same gates yourself in order. Keep research, data, images, and writing as separate passes.

## Page Impact Rules

Export the current page row into the content workspace before editing existing copy when no approved `final.json` is available:

```bash
npm run export:game-collection-final -- --game <game-slug> --collection <collection-slug> --output-root tmp/content-workspace/<game-slug>/collections
```

Pass `--allow-remote-read` only for an intentional read-only snapshot from a non-local database. The export helper never writes to the database.

Use `bloxodes-game-collection-writing` to update `final.json` when any of these are true:

- collection scope, identity, or display name changed
- a mechanic changed enough to invalidate intro, guide, FAQ, or `wiki_md`
- rendered section labels changed and `description_json` may be stale
- item count changed and the page row/title metadata must be synchronized
- representative thumbnail or other stored page metadata changed
- an approved unregistered dataset is becoming a new collection page

Do not rewrite evergreen copy merely because a value changed, an image was replaced, fields were completed, or items were reordered. Still record whether the database `item_count` or stored thumbnail needs synchronization.

Send factual/data/image problems back to the collection worker. Send tone, structure, FAQ, or public-copy problems to a separate writing worker as required by the collection workflow runner.

## Suggestions

After all existing collection work for a game passes:

1. Run `bloxodes-game-collection-suggestions` once for that game.
2. Compare recommendations against registered collections and unregistered v2 candidates already found by the planner.
3. Report `[create]`, `[we already have a page]`, `[skip]`, or `[source discovery incomplete]` with source proof.
4. Do not create a recommended dataset or page without later user approval.

Do not run suggestions in one-collection mode.

## Verification

Run the narrowest applicable checks for every changed collection:

```bash
npm run audit:game-collection-datasets:v2 -- --game <game-slug> --collection <collection-slug>
npm run check:game-collection-data -- --game <game-slug> --collection <collection-slug>
```

When images are required, add `--require-images`. When `final.json` changed, follow the complete verification and preview sequence in `bloxodes-game-collection-workflow-runner`, including copy checks, local seeding/readback, route verification, HTML-size audit, pagination checks when applicable, and Browser preview.

For a data-only change with unaffected page copy, verify the targeted local route still renders the updated item count, sections, fields, and images. Do not generate replacement prose just to satisfy a verifier that expects `final.json`.

## Finish

Return one consolidated report containing:

- requested mode and resolved scope
- checked, changed, unchanged, and blocked collections
- source-backed item/field/image deltas
- page-copy and database-row synchronization needs
- verifier, size, pagination, and preview results
- changed-file allowlist
- new collection recommendations for game-wide or all-games scope
- exact remaining risks and release work

Do not call the refresh complete while a selected collection remains unprocessed. Preserve the manifest so an interrupted game-wide or all-games run can resume.
