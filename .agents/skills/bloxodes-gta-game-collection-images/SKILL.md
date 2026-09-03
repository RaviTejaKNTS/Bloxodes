---
name: bloxodes-gta-game-collection-images
description: Gather, save, map, and verify exact item images for one approved Bloxodes GTA collection after data approval. Use for image source checks, media files, images.json, dataset wiring, coverage notes, and image readiness. Do not write final.json or publish production.
---

# Bloxodes GTA game collection images

Own the image pass for one GTA collection. Do not spawn other workers. Start only after the brief records approved data readiness.

## Workspace

Use:

```text
tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>/
  brief.md
  dataset.json
  images.json
  media/
```

Never place authoring images in `data/` or `apps/web/public/`. The GTA verifier uploads the reviewed files to immutable media keys under `gta/<game-slug>/<collection-slug>/`.

## Image rules

1. Read the brief, dataset, and approved item roster.
2. Set a nonzero image target unless the parent approved a text-only exception.
3. Prefer official Rockstar media, official manuals or guides, stable dedicated GTA wiki/database images, and exact in-game item captures from traceable sources.
4. The image must identify the exact row. Do not use logos, page screenshots, thumbnails with unrelated decoration, generic game art, fan art, AI-generated substitutes, or an image of a different game, mode, edition, model, or location.
5. Baked-in item names are acceptable when the underlying image is clear and useful. Record the caveat.
6. Save a normalized file in `media/` with a stable item-based filename. Avoid needless upscaling and repeated recompression.
7. Record the source page and direct image URL in `images.json` or the brief. Keep licenses, access limits, and uncertain matches visible to the parent.
8. Wire the relative media path to `items[].system.image`. Do not add an image field to `items[].item`.
9. A missing image is acceptable only when the parent approves the exact gap after the attempted sources are recorded.
10. Visually inspect uncertain or easily confused images before approving them.

The existing generic image collector may be used when the manifest format fits:

```bash
npm run collect:collection-images -- \
  --manifest <workspace>/images.json \
  --dataset <workspace>/dataset.json \
  --game-name "<Game>" \
  --collection-name "<Collection>" \
  --dry-run
```

Review the dry run, then run it without `--dry-run`. Do not allow this helper to rewrite public fields or change item scope.

## Verification

Run:

```bash
npm run check:game-collection-data -- \
  --game <game-slug> \
  --collection <collection-slug> \
  --file <workspace>/dataset.json \
  --require-images
```

Check that every wired path exists, image files open, duplicate files are intentional, and the dataset count still matches the approved roster.

Append to `brief.md`:

```text
Image readiness:
- Image target:
- Images found:
- Exact-match coverage:
- Images missing or accepted gaps:
- Sources used:
- Rejected image sources and reasons:
- Workspace media path:
- images.json path:
- Dataset paths wired:
- Visual spot-check result:
- Checker command and result:
- Ready for writing, yes/no:
```

Stop when important images are wrong, ambiguous, inaccessible, or missing. Do not let public copy conceal weak image coverage.
