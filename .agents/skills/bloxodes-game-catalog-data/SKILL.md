---
name: bloxodes-game-catalog-data
description: Prepare source-backed data and images for one approved Bloxodes game catalog after brief approval. Use for local dataset rows, item counts, useful card fields, image paths, grouping, missing item checks, and route assumptions before catalog writing. Do not write final.json unless data is already approved.
---

# Bloxodes Game Catalog Data

Use this after `brief.md` is approved. Prepare the local data and image support for one game catalog.

## Work

1. Read the approved `brief.md`.
2. Inspect or create the local dataset under `data/<Game>/`.
3. Check that item rows match the source-backed scope.
4. Add useful fields players can compare. Do not add raw source clutter.
5. Add or verify images under the expected public image path when the catalog needs images.
6. Confirm `apps/web/src/lib/game-dataset-catalogs.ts` can render the collection, card fields, grouping, item count, and image paths.
7. Update `brief.md` with data status and gaps.

## Data Approval Notes

Add this section to `brief.md`:

```text
Data readiness:
- Local dataset:
- Local item count:
- Source item count:
- Useful fields:
- Image coverage:
- Missing items/images:
- Route/config assumptions:
- Ready for writing: yes/no
```

If data or images are not ready, stop and say exactly what is blocked.
