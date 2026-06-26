---
name: bloxodes-game-collection-images
description: Gather, save, wire, and verify images for one approved Bloxodes game collection after data approval. Use for item image source checks, image manifests, local public image paths, dataset image fields, image coverage, and image readiness before collection writing. Do not write final.json.
---

# Bloxodes Game Collection Images

Use this after `brief.md` and data readiness are approved. Give images their own pass before writing.

## Work

1. Read the approved `brief.md` and dataset.
2. Confirm which items need images and which dataset field stores the image path.
3. Find clean item images from useful sources. Prefer official/game wiki style images when available. Use Fandom, BloxInformer, Beebom, Game8, Pro Game Guides, and similar Roblox guide sites when they have better usable images.
4. Do not use edited thumbnails, page screenshots, logos, or images that do not clearly show the item.
5. Save images under the expected public path for the game and collection.
6. Update the dataset image field for each matched item.
7. If an image is missing, record the exact item and why it is missing.
8. If you have an image manifest, collect images with:

```bash
npm run collect:collection-images -- --manifest <images.json> --dataset data/<Game>/<collection>.json --game-name "<Game>" --collection-name "<Collection>" --dry-run
```

If the dry run looks right, run it again without `--dry-run`.

9. Run the readiness check with images required when this collection should have images:

```bash
npm run check:game-collection-data -- --game <game-slug> --collection <collection-slug> --require-images
```

Use `--file <dataset.json>` if the collection is not registered yet.

10. Update `brief.md` with image readiness.

## Image Approval Notes

Add this section to `brief.md`:

```text
Image readiness:
- Image field:
- Expected image count:
- Images found:
- Images missing:
- Image sources used:
- Public image path:
- Dataset image paths updated: yes/no
- Checker command:
- Checker result:
- Ready for writing: yes/no
```

If images are important and coverage is weak, stop and say what is missing. If the collection can work without images, explain why and mark the missing images as accepted.
