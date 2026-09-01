---
name: bloxodes-game-collection-refresh
description: Quickly maintain existing Bloxodes Roblox game collection datasets and their existing wiki collection pages. Use when checking for verified new or changed collection data or filling missing item images. Supports one collection, one game, or all registered collections. Stop without editing when no factual or image delta exists. Never discover, suggest, create, or publish new collections.
---

# Bloxodes Game Collection Refresh

Run a bounded maintenance pass on collections that already exist. The normal successful result is `unchanged`: do not manufacture edits just because a source was checked or a refresh was requested.

## Read first

1. Read the repository `AGENTS.md` and the closest path-scoped instructions for every file that may change.
2. Read these skills completely before editing a dataset or image:
   - `.agents/skills/bloxodes-game-collection-data/SKILL.md`
   - `.agents/skills/bloxodes-game-collection-images/SKILL.md`
3. Read `.agents/skills/bloxodes-game-collection-research/SKILL.md` only when the quick check finds a possible delta that needs deeper source confirmation or the sources disagree. Do not run its broad competitor/discovery work for a routine refresh.

## Scope

Work only on registered, existing game collections and their existing `/wiki/<game-slug>/<collection-slug>` pages.

- Use `GAME_COLLECTIONS` in `apps/web/src/lib/game-collections` as the inventory.
- A collection is eligible only when its registered dataset already exists. If its page or dataset is missing, report it as blocked; do not create a page or register a new collection.
- A collection selector resolves one registered collection. A game selector checks that game's registered collections. With no selector, check all registered collections using the same quick gate.
- Do not scan unregistered files, classify collection candidates, run `bloxodes-game-collection-suggestions`, or return new collection recommendations.
- If `plan:game-collection-refresh` is used for selector resolution or a resumable run, process only records with `registered: true` and discard candidate records. Do not make a manifest a prerequisite for a small targeted refresh.
- Keep editorial slugs separate from `roblox_universes.slug`.
- Never publish, push, seed production, or invoke a release skill.

## Quick-check gate

For each selected collection, do this before starting any data, image, or writing pass:

1. Read the local v2 dataset and record a small baseline: dataset path, item count, stable item names/slugs, sections, public fields, image coverage, and the existing page path/row when available.
2. Check the strongest existing or known source for that exact collection and its recent update signal. Use the existing collection brief or source links first. This is a bounded source check, not broad web research or competitor analysis.
3. Compare the source roster and player-facing fields with the local dataset by stable slug/name. Treat only source-backed additions, removals, renames, changed values/mechanics, section/order changes, or a newly verified exact item image as a real delta.
4. Do not treat a changed source timestamp, rewritten source wording, a different URL, or a weak/unconfirmed claim as a delta.

Make the decision immediately:

- **Unchanged:** no verified data delta and all required/accepted item images are present. Stop. Do not create `brief.md`, `final.json`, replacement copy, or worker tasks.
- **Data update:** a verified data delta exists. Apply only that delta, then check images for the affected new or changed items.
- **Image update:** data is unchanged but existing items are missing images or have a clearly better exact item image available. Run only the image pass.
- **Blocked:** evidence is weak, sources conflict, or the dataset/page is missing. Leave files unchanged and report the exact blocker. Use the focused research skill only if resolving it is necessary and in scope.

For a game-wide or all-registered run, perform these quick checks in parallel where practical, then spend the detailed passes only on collections with a positive data or image delta.

## Applying a confirmed data delta

When the quick check is positive:

1. Read and follow `bloxodes-game-collection-data` for the v2 contract. If no approved collection brief exists, create a short maintenance note in the collection workspace containing the sources checked, previous/current counts, exact added/removed/changed rows, image impact, and accepted gaps. Do not redo a full collection-discovery brief.
2. Update only source-backed rows and fields. Preserve unrelated rows, ordering, sections, descriptions, and metadata unless the evidence requires a change. Do not rewrite the dataset for formatting alone.
3. Keep the v2 shape `{ meta, items: [{ item, system }] }`: public game fields stay in `items[].item`; `items[].system` contains only `slug`, `section`, `sortOrder`, and `image`.
4. Update `meta.itemFields`, `meta.columns`, `meta.display`, section order, and sort order only when the confirmed data change requires it. Keep display fields consistent across rows and leave unverified values empty/null rather than guessing.
5. Run the v2 audit and data checker after the edit. If the check exposes an unrelated pre-existing issue, record it separately instead of broadening the refresh.

## Adding or replacing images

Use `bloxodes-game-collection-images` only for new/changed rows or existing image gaps. Do not recollect a complete image set when current images are already acceptable.

- Save exact item images under the expected public path and wire them to `items[].system.image`.
- Do not use logos, page screenshots, edited thumbnails, generic game art, or unrelated substitutes.
- A missing image is acceptable only when the image pass records the exact item, source attempts, and reason.
- Run the image-required checker when the collection requires images or image fields changed:

```bash
npm run check:game-collection-data -- --game <game-slug> --collection <collection-slug> --require-images
```

## Page handling

The local dataset is what the collection route renders. For a data/image-only refresh:

- Do not rewrite `final.json`, page prose, FAQs, headings, or `description_json` by default.
- If a verified change makes existing page copy inaccurate, stop and report the exact field or passage for a separate writing pass; do not expand this quick workflow into full page writing.
- If item count, title/SEO count, stored thumbnail, or another database page field is now stale, report the exact synchronization needed. Do not generate replacement copy just to update a count.
- Verify the targeted local route after changed files are ready. Run full final-copy, pagination, size, or Browser checks only when page copy, renderer configuration, or route behavior changed, or when the user asks for them.

## Verification

Run the narrowest applicable checks only for collections that changed:

```bash
npm run audit:game-collection-datasets:v2 -- --game <game-slug> --collection <collection-slug>
npm run check:game-collection-data -- --game <game-slug> --collection <collection-slug>
```

Add `--require-images` when the collection requires complete image coverage. For an unchanged collection, record the quick-check evidence and do not run the full write/seed/preview workflow.

## Finish

Return one concise report containing:

- requested and resolved scope
- checked, changed, unchanged, and blocked collections
- verified data deltas and image deltas
- any page metadata or copy follow-up that was intentionally not performed
- checks and targeted route results
- changed-file allowlist and remaining risks

State explicitly that no new collection discovery or suggestions were run. Do not call the refresh complete while a selected existing collection is still unprocessed.
