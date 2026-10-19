---
name: bloxodes-franchise-game-collection-refresh
description: Maintain an existing non-Roblox franchise collection by checking verified roster, field, scope, and image deltas. Use only for existing collections; stop unchanged and never publish production.
---

# Bloxodes Franchise Game Collection Refresh

You're running a quick maintenance pass on collections that already exist: check for real changes, apply only those, and stop. The normal good result is `unchanged`. Don't make edits just because you checked a source or someone asked for a refresh.

**In T3 Code** (you have the `delegate_task` tool and the owner runs a refresh here), follow the "Franchise collection refresh" stage table in `.agents/skills/bloxodes-model-routing/SKILL.md` instead of running every pass yourself. Luna runs the quick check, applies any data delta and finds images. Haiku 5.5 reviews the delta and the images. Outside T3 Code, the flow below applies.

**Before you start:** read `bloxodes-docs/content/franchise.md` (identity, routes, tables and the rules every franchise page follows) and `bloxodes-docs/content/page-standards.md` (titles, headings, depth, images and layout). Public copy and writer briefs follow `.agents/skills/bloxodes-voice/SKILL.md`.

## Read first

1. The repository `AGENTS.md` and the closest path-scoped instructions for every file that may change.
2. These skills, in full, before you edit a dataset or image:
   - `.agents/skills/bloxodes-franchise-game-collection-data/SKILL.md`
   - `.agents/skills/bloxodes-franchise-game-collection-images/SKILL.md`
3. `.agents/skills/bloxodes-franchise-game-collection-research/SKILL.md`, but only when the quick check finds a possible delta that needs deeper source confirmation, or the sources disagree. Don't run its broad competitor or discovery work for a routine refresh.

## Scope

Work only on existing game collections and their exact stored franchise routes.

- **Inventory:** namespace-scoped `game_collection_pages` and their owning `game_wiki_pages.canonical_path`. Read registry and route rules in `bloxodes-docs/content/franchise.md`.
- **Eligible:** a collection whose published database dataset exists. Export that revision to an ignored content workspace before comparing sources.
- **Missing page or dataset pointer:** report it as blocked. Don't create a page or register a new collection.
- **Selectors:** a collection selector resolves one registered collection. A game selector checks that game's registered collections. No selector means every existing collection in the approved namespace, using the same quick gate.
- **Manifest:** every refresh that changes data needs the explicit workspace runtime manifest.
- Keep namespace, game UUID, title kind and parent identity stable. Check edition, mode, platform and release-generation scope before treating a source change as a delta.

Stay out of discovery:

- Don't scan unregistered files, classify collection candidates, run `bloxodes-franchise-game-collection-suggestions` or return new collection recommendations.
- Never publish, push, seed production or invoke a release skill.

## Quick-check gate

For each selected collection, do this before any data, image or writing pass:

1. Export the current database revision:

   ```bash
   npm run export:shared-game-collection-workspace -- --namespace <namespace> --game <game-slug> --collection <collection-slug> --output-root tmp/content-workspace/<namespace>/<game-slug>/collections
   ```

   Record its item count, stable item names/slugs, sections, public fields, image coverage and page identity.

2. Check the strongest existing or known source for that exact collection and its recent update signal. Start with the existing collection brief or source links. This is a bounded source check, not broad web research or competitor analysis.
3. Compare the source roster and player-facing fields with the local dataset by stable slug or name.

**What counts as a real delta:** source-backed additions, removals, renames, changed values or mechanics, section or order changes, page-type corrections, or a newly verified exact item image.

**What doesn't:** a changed source timestamp, rewritten source wording, a different URL, or a weak or unconfirmed claim.

Decide right away:

| Result | When | What you do |
| --- | --- | --- |
| **Unchanged** | No verified data delta, and all required item images are present and genuine no-image cases are documented. | Stop. Don't create `brief.md`, `final.json`, replacement copy or worker tasks. |
| **Data update** | A verified data delta exists. | Apply only that delta, then check images for the affected new or changed items. |
| **Image update** | Data is unchanged, but existing items are missing images or a clearly better exact item image is available. | Run only the image pass. |
| **Page-type update** | The collection is now clearly a finite player-completed goal or a reference roster. | Make the approved switch between `collectible` and `database`. |
| **Blocked** | Evidence for the change is weak, or the dataset or page is missing. Sources disagreeing isn't a blocker on its own: apply the data skill's "Conflicting sources" rule, and keep the current value when the new evidence isn't better supported. | Leave files unchanged and report the exact blocker. Use the focused research skill only if resolving it is necessary and in scope. |

For a game-wide or all-registered run, do the quick checks in parallel where practical. Spend the detailed passes only on collections with a positive data or image delta.

## Applying a confirmed data delta

1. Follow `bloxodes-franchise-game-collection-data` for the v2 contract. If there's no approved collection brief, create a short maintenance note in the collection workspace with the sources checked, previous and current counts, exact added/removed/changed rows, image impact and accepted gaps. Don't redo a full collection-discovery brief.
2. Update only source-backed rows and fields. Keep unrelated rows, ordering, sections, descriptions and metadata unless the evidence requires a change. Don't rewrite the dataset just for formatting.
3. Keep the v2 shape `{ meta, items: [{ item, system }] }`. Public game fields stay in `items[].item`. `items[].system` holds only `slug`, `section`, `sortOrder` and `image`.
4. Keep `collection.pageType` explicit in the runtime manifest, and check that the database row and route use the same type. A page-type change selects the shared renderer and progress behavior. It doesn't create a new table.
5. Change `meta.itemFields`, `meta.columns`, `meta.display`, section order and sort order only when the confirmed data change requires it. Keep display fields consistent across rows, and leave unverified values empty or null instead of guessing.
6. Run the v2 audit and data checker after the edit. If the check turns up an unrelated pre-existing issue, record it separately instead of widening the refresh.

## Adding or replacing images

Use `bloxodes-franchise-game-collection-images` only for new or changed rows, or existing image gaps. Don't recollect a full image set when the current images are fine.

- Save exact item images under `<workspace>/media/` and wire their filenames to `items[].system.image`.
- Don't use logos, page screenshots, edited thumbnails, generic game art or unrelated substitutes.
- Record the exact item, sources tried and reason for every gap. Missing required images block publication; genuine no-image cases must be documented.
- Run the image-required checker when the collection requires images or image fields changed:

  ```bash
  npm run check:game-collection-data -- --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json --require-images
  ```

## Page handling

The exported workspace is an authoring snapshot. The collection route keeps rendering only the published database revision. For a data- or image-only refresh:

- Don't rewrite `final.json`, page prose, FAQs, headings or `description_json` by default.
- The shared exporter preserves stored `how_it_works_md`. Keep new public help empty. If an export contains legacy website instructions there or elsewhere, report the exact passage for a separate writing pass instead of expanding a data refresh into a rewrite.
- If a verified change makes existing copy wrong, stop and report the exact field or passage for a separate writing pass. Don't grow this quick workflow into full page writing.
- If the item count, title/SEO count, stored thumbnail or another database page field is now stale, report the exact sync needed. Don't generate replacement copy just to update a count.
- Verify the targeted route on GitHub once the changed files are ready. Run full final-copy, pagination, size or Browser checks only when page copy, renderer configuration or route behavior changed, or when the user asks.

## Verification

Preserve Minecraft edition identities and its `database` page-type restriction. On GitHub, run the narrowest checks that apply, and only for collections that changed:

```bash
npm run audit:game-collection-datasets:v2 -- --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json
npm run check:game-collection-data -- --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json
```

Add `--require-images` for required image coverage. Run the shared runtime dry plan with `npm run sync:shared-game-collection-runtime -- --namespace <namespace> --manifest <workspace>/runtime-manifest.json`. It must not apply, upload or publish from this maintenance stage. For an unchanged collection, record the quick-check evidence and skip the full write/seed/preview workflow.

## Finish

Return one short report with:

- requested and resolved scope
- checked, changed, unchanged and blocked collections
- verified data deltas and image deltas
- any page metadata or copy follow-up you deliberately didn't do
- checks and targeted route results
- changed-file allowlist and remaining risks

Say plainly that no new collection discovery or suggestions were run. Don't call the refresh complete while any selected existing collection is still unprocessed.
