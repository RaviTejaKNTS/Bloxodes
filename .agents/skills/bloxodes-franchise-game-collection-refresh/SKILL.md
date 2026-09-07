---
name: bloxodes-franchise-game-collection-refresh
description: Maintain an existing non-Roblox franchise collection by checking verified roster, field, scope, and image deltas. Use only for existing collections; stop unchanged and never publish production.
---

# Bloxodes franchise game collection refresh

Run a bounded maintenance pass on existing collections in one configured non-Roblox franchise namespace. Unchanged is a successful result. Do not rewrite content merely because a refresh was requested.

## Context and scope

The context must resolve:

- franchise name and namespace
- existing game and collection inventory resolver
- exact collection route and tables/views
- authoring workspace root and export command
- data, image, runtime sync, final verifier, and preview commands
- mode, expansion, online-service, edition, platform, and release-generation boundaries

Work only on an existing collection row with a published dataset pointer. Never discover, suggest, or create a new collection here. If the page or dataset is missing, report it as blocked; do not reconstruct editable provenance by guessing.

Do not use a Roblox registry, Roblox API, another franchise's tables, or another namespace's route. Never publish, deploy, merge, push, or invoke a release skill.

## Read first

1. Read the root and closest AGENTS.md files, the owning pipeline documentation, and the target franchise data and image skills.
2. Read the existing brief, dataset, images, final JSON, and runtime manifest when present.
3. Read the target research skill only when a possible delta needs deeper confirmation or sources disagree.

## Quick-check gate

For each selected collection:

1. Export the current published runtime revision with the context's export command. Record item count, stable item slugs/names, sections, public fields, image coverage, page identity, and page type.
2. Check the strongest known source for that exact collection and its recent update signal. Use the existing brief and source links first. This is a bounded source check, not broad collection discovery.
3. Compare by stable slug and name. Treat only source-backed additions, removals, renames, changed mechanics or values, scope corrections, section/order changes, page-type corrections, or a newly verified exact image as a real delta.
4. Do not treat a changed timestamp, rewritten wording, URL change, weak comment, or different sort preference as a data change.

Choose one result immediately:

- Unchanged: no verified data delta and required or accepted images remain valid. Stop without editing files or page copy.
- Data update: a verified roster, field, scope, section, or ordering change exists.
- Page-type update: the collection is clearly a finite player-completed goal or a reference roster, so an approved switch between collectible and database is needed.
- Image update: facts are unchanged but a missing, wrong, or materially better exact image is verified.
- Copy follow-up: a verified data change makes a named passage inaccurate. Do not rewrite it inside a data-only refresh.
- Blocked: sources conflict, the published pointer is missing, or the workspace cannot support a safe edit.

## Applying a confirmed data delta

1. Record sources, previous values, verified new values, affected rows, scope effect, and image effect in a maintenance section in brief.md.
2. Change only affected rows and metadata. Preserve unrelated facts, descriptions, sections, ordering, and files.
3. Keep the v2 contract and franchise identity unchanged.
4. Keep collection.pageType explicit in the runtime manifest and verify that the database row and route use the same type. A page-type change selects shared renderer/progress behavior; it does not create a new table.
5. Leave unknown values empty. Do not infer a replacement because an old value disappeared.
6. Run the context's dataset audit, checker, and runtime dry plan.
7. Run the image skill only for new, renamed, or image-affected rows.

## Applying an image delta

- Replace only the wrong or missing image.
- Keep the old file until the new image is checked and wired.
- Record the new source and why it is a better exact match.
- Run the image-required checker.
- Do not recollect an already acceptable image set.

## Page copy

- Do not regenerate final.json by default.
- If a factual change makes a title, metadata field, paragraph, FAQ, section note, or hub blurb inaccurate, report the exact field and run a separate approved writing pass.
- Keep {count} titles as the automated token. Never replace it with a literal count.
- Do not add a freshness claim after a successful check.

## Managed-development verification

For a changed and approved collection, run the same managed-development verifier, HTML-size gate, and targeted Browser checks required by the franchise collection workflow. The verifier may publish an immutable revision to managed development, but it does not authorize production.

## Finish

Return:

- requested and resolved scope
- checked, changed, unchanged, copy-follow-up, and blocked collections
- exact roster, field, scope, and image deltas
- changed-file allowlist
- audit, checker, dry-plan, managed verifier, size, and route results for changed collections
- any workspace/export blocker
- a statement that no collection discovery ran and production was untouched

Do not call the refresh complete while a selected existing collection has no result.
