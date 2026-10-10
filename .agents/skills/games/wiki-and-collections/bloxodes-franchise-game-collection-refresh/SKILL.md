---
name: bloxodes-franchise-game-collection-refresh
description: Maintain an existing non-Roblox franchise collection by checking verified roster, field, scope, and image deltas. Use only for existing collections; stop unchanged and never publish production.
---

# Bloxodes franchise game collection refresh

You run a bounded maintenance check on existing collections in one non-Roblox franchise namespace. Find real, source-backed changes and fix only those. "Unchanged" is a successful result, so don't rewrite content just because someone asked for a refresh.

## Shared game storage

- **Tables:** managed development uses `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`, `game_code_pages`, `game_codes` and `game_tool_pages`. Roblox stays separate.
- **Namespace:** scope every read and write by namespace. Use `gameDatabase(client, namespace)` for existing logical suffixes.
- **Kinds:** `games.kind` is only `franchise` or `game`. `parent_id` links a game to its franchise. Mode and edition labels describe content; they never add kinds.
- **Routes:** read the wiki row's `canonical_path` before planning collection links. A standalone game's wiki is `/<namespace>/wiki`. A franchise has its own wiki hub plus child game wikis. Keep Minecraft's edition URLs as they are.
- **Pages:** publish reviewed game, wiki, codes page and registered tool payloads with `publish:game-pages -- --namespace <slug> --file <reviewed.json>`. It's a dry run by default, and `--apply` writes only to development. Combined payloads need explicit IDs. Publish identity first, then the wiki, then collections.
- **Collections:** publish with `sync:shared-game-collection-runtime`, passing `--namespace` and the reviewed runtime manifest. Keep immutable dataset/media publication and pointer readback. Preserve drafts, revisions, sources, fields and media. Never edit published items.
- **Workspaces:** research stays in ignored workspaces.
- **Who owns what:** these general wiki and collection workflows cover standalone games and franchises. GTA specialists keep their mode, source, map and collectible rules under `namespace = 'gta'`.

## Context and scope

The context must resolve:

- franchise name and namespace
- existing game and collection inventory resolver
- exact collection route and tables/views
- authoring workspace root and export command
- data, image, runtime sync, final verifier and preview commands
- mode, expansion, online-service, edition, platform and release-generation boundaries

Scope rules:

- Work only on an existing collection row with a published dataset pointer.
- Never discover, suggest or create a new collection here.
- If the page or dataset is missing, report it as blocked. Don't rebuild editable provenance by guessing.
- Don't use a Roblox registry, Roblox API, another franchise's tables or another namespace's route.
- Never publish, deploy, merge, push or invoke a release skill.

## Read first

1. The root and closest `AGENTS.md` files, the owning pipeline docs, and the target franchise data and image skills.
2. The existing brief, dataset, images, final JSON and runtime manifest when present.
3. The target research skill, only when a possible delta needs deeper confirmation or sources disagree.

## Quick-check gate

For each selected collection:

1. Export the current published runtime revision with the context's export command. Record item count, stable item slugs/names, sections, public fields, image coverage, page identity and page type.
2. Check the strongest known source for that exact collection and its recent update signal. Start with the existing brief and source links. This is a bounded source check, not broad collection discovery.
3. Compare by stable slug and name. Only these count as a real delta when a source backs them: additions, removals, renames, changed mechanics or values, scope corrections, section/order changes, page-type corrections, or a newly verified exact image.
4. These don't count as data changes: a changed timestamp, rewritten wording, a URL change, a weak comment, or a different sort preference.

Pick one result right away:

| Result | When |
| --- | --- |
| Unchanged | No verified data delta, and required or accepted images are still valid. Stop without editing files or page copy. |
| Data update | A verified roster, field, scope, section or ordering change exists. |
| Page-type update | The collection is clearly a finite player-completed goal or a reference roster, so an approved switch between collectible and database is needed. |
| Image update | Facts are unchanged, but a missing, wrong or clearly better exact image is verified. |
| Copy follow-up | A verified data change makes a named passage inaccurate. Don't rewrite it inside a data-only refresh. |
| Blocked | Sources conflict, the published pointer is missing, or the workspace can't support a safe edit. |

## Applying a confirmed data delta

1. Add a maintenance section to `brief.md` with sources, previous values, verified new values, affected rows, scope effect and image effect.
2. Change only the affected rows and metadata. Leave unrelated facts, descriptions, sections, ordering and files alone.
3. Keep the v2 contract and franchise identity unchanged.
4. Keep `collection.pageType` explicit in the runtime manifest, and verify the database row and route use the same type. A page-type change picks shared renderer/progress behavior. It doesn't create a new table.
5. Leave unknown values empty. Don't infer a replacement just because an old value disappeared.
6. Run the context's dataset audit, checker and runtime dry plan.
7. Run the image skill only for new, renamed or image-affected rows.

## Applying an image delta

- Replace only the wrong or missing image.
- Keep the old file until the new image is checked and wired.
- Record the new source and why it's a better exact match.
- Run the image-required checker.
- Don't recollect an image set that's already acceptable.

## Page copy

- Don't regenerate `final.json` by default.
- If a factual change makes a title, metadata field, paragraph, FAQ, section note or hub blurb inaccurate, report the exact field and run a separate approved writing pass.
- Keep `{count}` titles as the automated token. Never swap in a literal count.
- Don't add a freshness claim after a successful check.

## Managed-development verification

For a changed and approved collection, run the same managed-development verifier, HTML-size gate and targeted Browser checks the franchise collection workflow requires. The verifier may publish an immutable revision to managed development. That never authorizes production.

## Finish

Return:

- requested and resolved scope
- checked, changed, unchanged, copy-follow-up and blocked collections
- exact roster, field, scope and image deltas
- changed-file allowlist
- audit, checker, dry-plan, managed verifier, size and route results for changed collections
- any workspace/export blocker
- a statement that no collection discovery ran and production was untouched

The refresh isn't complete while any selected existing collection has no result.
