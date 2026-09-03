---
name: bloxodes-gta-game-collection-refresh
description: Maintain an existing Bloxodes GTA collection by checking verified roster, field, edition, and image changes, then updating only confirmed deltas. Use for existing /gta/wiki collections, not discovery or new pages. Stop unchanged when no real delta exists and never publish production.
---

# Bloxodes GTA game collection refresh

Run a bounded maintenance pass on collections that already exist. `Unchanged` is a successful result. Do not rewrite content just because a refresh was requested.

## Read first

Read:

- The root and closest `AGENTS.md` files.
- `dev-docs/pipelines/wiki-collections.md`.
- `.agents/skills/bloxodes-gta-game-collection-data/SKILL.md`.
- `.agents/skills/bloxodes-gta-game-collection-images/SKILL.md`.
- The existing workspace `brief.md`, `dataset.json`, `images.json` when present, `final.json`, and `runtime-manifest.json`.

Read `bloxodes-gta-game-collection-research` only when a possible change needs deeper confirmation or sources disagree. Do not rerun broad discovery for a routine refresh.

## Scope

- Work only on an existing `gta_wiki_collection_pages` row with a published dataset pointer.
- Resolve the collection from the GTA table and exact `/gta/wiki/<game>/<collection>` route.
- Never suggest or create a new collection in this skill.
- Never change Story Mode, Online, edition, or platform scope during a refresh.
- Never write production, deploy, merge, push, or call a release skill.

The authoring workspace is required for an edit. If the workspace is missing, perform the read-only database and source check, then report that a safe GTA workspace export is needed. Do not reconstruct editable image paths or source provenance by guessing.

## Quick-check gate

For each selected collection:

1. Read the published GTA page row, dataset metadata, item count, stable item slugs and names, sections, public fields, and image coverage.
2. Read the existing runtime manifest and brief sources.
3. Check the strongest known source for the exact roster and any recent update signal.
4. Compare by stable slug and name. A real delta is a verified addition, removal, rename, changed mechanic or value, mode/edition correction, section change, or newly verified exact image.
5. Do not treat source timestamps, rewritten wording, URL changes, unverified comments, or a different sort preference as a data change.

Choose one result immediately:

- `Unchanged`: no verified data delta and required or accepted images remain valid. Stop without editing files or page copy.
- `Data update`: a verified roster, field, mode, edition, section, or ordering change exists.
- `Image update`: facts are unchanged but a missing, wrong, or materially better exact image is verified.
- `Copy follow-up`: a verified data change makes a named passage inaccurate. Do not rewrite it inside a data-only refresh.
- `Blocked`: sources conflict, the published pointer is missing, or the authoring workspace cannot support a safe edit.

## Applying a data delta

1. Record the sources, previous value, verified new value, affected rows, and image effect in a maintenance section in `brief.md`.
2. Change only the affected rows and metadata. Preserve unrelated facts, descriptions, sections, ordering, and files.
3. Keep the v2 contract and GTA identity unchanged.
4. Leave unknown values empty. Do not infer a replacement because an old value was removed.
5. Run the dataset audit, checker, and GTA runtime dry plan from the data skill.
6. Run the image skill only for new, renamed, or image-affected rows.

## Applying an image delta

- Replace only the wrong or missing image.
- Keep the old file until the new image is checked and wired.
- Record the new source and why it is a better exact match.
- Run the image-required checker.
- Do not recollect an already acceptable image set.

## Page copy

- Do not regenerate `final.json` by default.
- If a factual change makes a title, metadata field, paragraph, FAQ, section note, or hub blurb inaccurate, report the exact field and run a separate approved writing pass.
- `{count}` titles update through the GTA sync. Never replace the token with a literal count in authoring copy.
- Do not add a freshness claim after a successful check.

## Managed-development verification

For a changed and approved collection, run the same managed-development verifier, HTML-size gate, and targeted browser checks required by `bloxodes-gta-game-collection-workflow-runner`.

The verifier publishes an immutable revision to managed development. It does not authorize production. Never use `--allow-prod`.

## Finish

Return:

- Requested and resolved GTA scope.
- Checked, changed, unchanged, copy-follow-up, and blocked collections.
- Exact roster, field, edition, and image deltas.
- Changed-file allowlist.
- Audit, checker, dry-plan, managed verifier, size, and route results for changed collections.
- Any missing workspace/export blocker.
- A statement that no collection discovery ran and production was untouched.

Do not call the refresh complete while a selected existing collection has no result.
