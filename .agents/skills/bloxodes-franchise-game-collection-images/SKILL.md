---
name: bloxodes-franchise-game-collection-images
description: Gather, save, wire, and verify exact item images for one approved non-Roblox franchise collection after data approval. Do not write final.json or publish production.
---

# Bloxodes franchise game collection images

Own the image pass for one collection. Do not spawn other workers. Start only after the brief records approved data readiness.

## Context and workspace

Resolve from the franchise context:

- game and collection slugs
- collection workspace and media root
- target image checker command
- optional image-collection helper and manifest format
- immutable media-key prefix used by the verifier

Use:

~~~text
<workspace-root>/<game-slug>/collections/<collection-slug>/
  brief.md
  dataset.json
  images.json
  media/
~~~

Never place authoring images in repository runtime/public folders unless the target pipeline explicitly requires it. The verifier should upload reviewed files to immutable media keys under the configured namespace.

## Image rules

1. Read the approved brief, dataset, and item roster.
2. Set a nonzero image target unless the parent approved a text-only exception.
3. Prefer official publisher/developer media, manuals or guides, stable dedicated game wiki/database images, and exact in-game captures from traceable sources.
4. The image must identify the exact row. Do not use logos, page screenshots, generic game art, fan art, AI-generated substitutes, or an image of a different title, mode, edition, platform, model, or location.
5. Baked-in item names are acceptable when the underlying image is clear and useful. Record the caveat.
6. Save a normalized file in media with a stable item-based filename. Avoid needless upscaling and repeated recompression.
7. Record the source page and direct image URL in images.json or the brief. Keep licensing, access limits, and uncertain matches visible to the parent.
8. Wire the relative media path to items[].system.image. Do not add an image field to items[].item.
9. A missing image is acceptable only when the parent approves the exact gap after attempted sources are recorded.
10. Visually inspect uncertain or easily confused images before approval.

For collectible collections, prefer exact location, route, mission-step, quest, or collectible images that help players recognize a goal. Record any text-only exception item by item and obtain parent approval.

If the context provides an image helper, run its dry plan first:

~~~bash
<image-helper-command> --manifest <workspace>/images.json --dataset <workspace>/dataset.json --dry-run
~~~

Review the plan before running it without the dry-run flag. Do not allow a helper to rewrite public fields or change item scope.

## Verification

Run the context-provided image checker:

~~~bash
<image-checker-command> --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json --require-images
~~~

Check that every wired path exists, image files open, duplicate files are intentional, and the dataset count still matches the approved roster.

Append to brief.md:

~~~text
Image readiness:
- Image target:
- Page type: database or collectible
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
~~~

Stop when important images are wrong, ambiguous, inaccessible, or missing. Do not let public copy conceal weak image coverage.
