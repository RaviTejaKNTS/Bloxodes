---
name: bloxodes-game-catalog-data
description: Prepare source-backed data for one approved Bloxodes game catalog after brief approval. Use for local dataset rows, item counts, useful card fields, section grouping, missing item checks, image field planning, and route assumptions before the image pass and catalog writing. Do not write final.json.
---

# Bloxodes Game Catalog Data

Use this after `brief.md` is approved. Prepare the local data for one game catalog. Do not gather images here; plan the image field and leave image collection for `bloxodes-game-catalog-images`.

## Work

1. Read the approved `brief.md`.
2. Inspect or create the local dataset under `data/<Game>/`.
3. Check that item rows match the source-backed scope.
4. Add useful fields players can compare. Do not add raw source clutter.
5. Add a real section field, usually `catalogSection` unless another field is better. Every item should land in the right section.
6. Add short `cardSummary` text when cards need a plain-English explanation beyond raw fields.
7. When adding descriptions, always use your own words. Do not directly copy from the sources. Make sure the description is accurate and matches the source information.
8. Do not rewrite sourced stats or facts just to sound nicer. Keep factual values accurate.
9. Decide whether the catalog should have images and which dataset field will hold image paths.
10. Confirm `apps/web/src/lib/game-dataset-catalogs.ts` can render the collection, card fields, grouping, item count, and planned image field.
11. Confirm section labels are stable and useful enough for the shared renderer's section dropdown. Do not split, rename, or reorder sections only for page-size reasons; pagination is handled by the renderer.
12. If the collection is missing from `apps/web/src/lib/game-dataset-catalogs.ts`, run:

```bash
npm run register:game-catalog -- --game <game-slug> --collection <collection-slug> --dry-run
```

If the dry run looks right and the game group already exists, run it again without `--dry-run`.

13. Run the dataset readiness check:

```bash
npm run check:game-catalog-data -- --game <game-slug> --collection <collection-slug>
```

Use `--file <dataset.json>` if the catalog is not registered yet. Do not use `--require-images` here; the image skill owns that check.

14. Update `brief.md` with data status and gaps from the checker.

## Data Approval Notes

Add this section to `brief.md`:

```text
Data readiness:
- Dataset file:
- Item count:
- Source item count:
- Section field:
- Section counts:
- Section order:
- Card fields:
- Card summary coverage:
- Image needed: yes/no
- Image field:
- Hidden/source fields:
- Sort order:
- description_json section keys:
- Renderer/config support:
- Missing items:
- Checker command:
- Checker result:
- Ready for images: yes/no
```

If data is not ready, stop and say exactly what is blocked. If data is ready, hand off to the image step before writing.
