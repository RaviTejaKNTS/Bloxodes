---
name: bloxodes-game-collection-images
description: Gather, save, wire, and verify images for one approved Bloxodes game collection after data approval. Use for item image source checks, image manifests, local public image paths, dataset image fields, image coverage, and image readiness before collection writing. Do not write final.json.
---

# Bloxodes Game Collection Images

> **You are a subagent. Do NOT spawn sub-agents or call other agents. Download images and edit dataset files directly using Bash and the Edit/Write tools.**

Use this after `brief.md` and data readiness are approved. Give images their own authoring pass before writing. Save staging media under the collection workspace; the parent verifier uploads and verifies immutable R2 media keys before the database-backed route can render them.

## Work

1. Read the approved `brief.md` and dataset.
2. Confirm which items need images and which dataset field stores the image path.
3. Find clear item images from useful sources. Prefer official/game-wiki-style images when available. Use Fandom, BloxInformer, Beebom, Game8, Pro Game Guides, approved fan wikis, and similar Roblox guide sites when they have better usable images.
4. Do not use edited thumbnails, page screenshots, logos, or images that do not clearly show the item. A readable item name or other identifying text baked into an otherwise useful item image is acceptable; never reject an image solely because the item name appears on it.
5. Save images under `<workspace>/media/` for the game and collection.
6. Update the dataset image field for each matched item.
7. If an image is missing, record the exact item and why it is missing.
8. If you have an image manifest, collect images with:

```bash
npm run collect:collection-images -- --manifest <images.json> --dataset <workspace>/dataset.json --game-name "<Game>" --collection-name "<Collection>" --dry-run
```

If the dry run looks right, run it again without `--dry-run`.

9. Run the readiness check with images required when this collection should have images:

```bash
npm run check:game-collection-data -- --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json --require-images
```

Do not save collection data or staging media under `data/` or `apps/web/public/`.

For `checklist` collections, prefer an exact location, route, quest step, or collectible view that helps a player recognize the goal. Do not switch a checklist to text-only merely because a generic item thumbnail is easier to find; record attempted sources and obtain parent approval for any accepted gap.

10. Update `brief.md` with image readiness.

## Image Approval Notes

Add this section to `brief.md`:

```text
Image readiness:
- Image field:
- Page type (`database` or `checklist`):
- Expected image count:
- Images found:
- Images missing:
- Image sources used:
- Workspace media path:
- Dataset image paths updated: yes/no
- Checker command:
- Checker result:
- Ready for writing: yes/no
```

If images are important and coverage is weak, stop and say what is missing. If the collection can work without images, explain why and mark the missing images as accepted. Record the source URL in the manifest/brief even when the source image contains a baked-in item name. User- or parent-approved direct item-image sources may be used when their images clearly match the exact game; keep source/licensing caveats in the brief rather than silently dropping usable coverage.
