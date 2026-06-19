---
name: bloxodes-game-catalog-data
description: Prepare source-backed data and images for one approved Bloxodes game catalog after brief approval. Use for local dataset rows, item counts, useful card fields, section grouping, image paths, missing item checks, and route assumptions before catalog writing. Do not write final.json unless data is already approved.
---

# Bloxodes Game Catalog Data

Use this after `brief.md` is approved. Prepare the local data and image support for one game catalog.

## Work

1. Read the approved `brief.md`.
2. Inspect or create the local dataset under `data/<Game>/`.
3. Check that item rows match the source-backed scope.
4. Add useful fields players can compare. Do not add raw source clutter.
5. Add a real section field, usually `catalogSection` unless another field is better. Every item should land in the right section.
6. Add short `cardSummary` text when cards need a plain-English explanation beyond raw fields.
7. When adding descriptions, always use your own words. Do not directly copy from the sources. Make sure the description is accurate and matches the source information.
8. Do not rewrite sourced stats or facts just to sound nicer. Keep factual values accurate.
9. Gather images when the catalog needs images. Find clean item images, not edited website thumbnails. Prefer wiki-style item images, but use Fandom, BloxInformer, Beebom, Game8, Pro Game Guides, and similar Roblox guide sites when they have better usable images.
10. Add or verify images under the expected public image path when the catalog needs images.
11. Confirm `apps/web/src/lib/game-dataset-catalogs.ts` can render the collection, card fields, grouping, item count, and image paths.
12. If the collection is missing from `apps/web/src/lib/game-dataset-catalogs.ts`, run:

```bash
npm run register:game-catalog -- --game <game-slug> --collection <collection-slug> --dry-run
```

If the dry run looks right and the game group already exists, run it again without `--dry-run`.

13. If you have an image manifest, collect images with:

```bash
npm run collect:catalog-images -- --manifest <images.json> --dataset data/<Game>/<collection>.json --game-name "<Game>" --collection-name "<Collection>" --dry-run
```

If the dry run looks right, run it again without `--dry-run`.

14. Run the dataset readiness check:

```bash
npm run check:game-catalog-data -- --game <game-slug> --collection <collection-slug>
```

Use `--file <dataset.json>` if the catalog is not registered yet. Add `--require-images` only when the catalog must have images.

15. Update `brief.md` with data status and gaps from the checker.

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
- Image coverage:
- Hidden/source fields:
- Sort order:
- description_json section keys:
- Renderer/config support:
- Missing items/images:
- Checker command:
- Checker result:
- Ready for writing: yes/no
```

If data or images are not ready, stop and say exactly what is blocked. If clean images are available, collect and use them. If images are not available, you can still submit `brief.md`, but note that the catalog will be missing images.
