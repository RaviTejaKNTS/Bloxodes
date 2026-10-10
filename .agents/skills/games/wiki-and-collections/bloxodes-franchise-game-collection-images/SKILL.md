---
name: bloxodes-franchise-game-collection-images
description: Gather, save, wire, and verify exact item images for one approved non-Roblox franchise collection after data approval. Do not write final.json or publish production.
---

# Bloxodes franchise game collection images

You run the image pass for one collection: find an exact image for each row, save it, wire it into the dataset and prove it's right. Done means the image checker passes and `brief.md` has an image readiness note the parent can approve.

- Start only after `brief.md` records approved data readiness.
- You own this one collection. Don't spawn other workers.

## Shared game storage

- **Tables:** managed development uses `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`, `game_code_pages`, `game_codes` and `game_tool_pages`. Roblox stays separate.
- **Namespace:** scope every read and write by namespace. Use `gameDatabase(client, namespace)` for existing logical suffixes.
- **Kinds:** `games.kind` is only `franchise` or `game`. `parent_id` links a game to its franchise. Mode and edition labels describe content; they never add kinds.
- **Routes:** read the wiki row's `canonical_path` before planning collection links. A standalone game's wiki is `/<namespace>/wiki`. A franchise has its own wiki hub plus child game wikis. Keep Minecraft's edition URLs as they are.
- **Pages:** publish reviewed game, wiki, codes page and registered tool payloads with `publish:game-pages -- --namespace <slug> --file <reviewed.json>`. It's a dry run by default, and `--apply` writes only to development. Combined payloads need explicit IDs. Publish identity first, then the wiki, then collections.
- **Collections:** publish with `sync:shared-game-collection-runtime`, passing `--namespace` and the reviewed runtime manifest. Keep immutable dataset/media publication and pointer readback. Preserve drafts, revisions, sources, fields and media. Never edit published items.
- **Workspaces:** research stays in ignored workspaces.
- **Who owns what:** these general wiki and collection workflows cover standalone games and franchises. GTA specialists keep their mode, source, map and collectible rules under `namespace = 'gta'`.

## What the context gives you

- game and collection slugs
- collection workspace and media root
- target image checker command
- optional image-collection helper and manifest format
- immutable media-key prefix used by the verifier

Work here:

```text
<workspace-root>/<game-slug>/collections/<collection-slug>/
  brief.md
  dataset.json
  images.json
  media/
```

Keep authoring images out of repository runtime/public folders unless the target pipeline explicitly requires it. The verifier uploads reviewed files to immutable media keys under the configured namespace.

## Image rules

1. Read the approved brief, dataset and item roster.
2. Set a nonzero image target unless the parent approved a text-only exception.
3. Prefer, in this order: official publisher/developer media, manuals or guides, stable dedicated game wiki/database images, and exact in-game captures from traceable sources.
4. Each image must identify its exact row. No logos, page screenshots, generic game art, fan art, AI-generated substitutes, or images of a different title, mode, edition, platform, model or location.
5. Baked-in item names are fine when the underlying image is clear and useful. Record the caveat.
6. Save a normalized file in `media/` with a stable, item-based filename. Avoid needless upscaling and repeated recompression.
7. Record the source page and direct image URL in `images.json` or the brief. Keep licensing, access limits and uncertain matches visible to the parent.
8. Wire the relative media path to `items[].system.image`. Never add an image field to `items[].item`.
9. A missing image is OK only when the parent approves that exact gap after you've recorded the sources you tried.
10. Visually inspect any uncertain or easily confused image before approval.

For collectible collections, prefer exact location, route, mission-step, quest or collectible images that help players recognize the goal. Record any text-only exception item by item and get parent approval.

### Image helper

If the context provides one, run its dry plan first:

```bash
<image-helper-command> --manifest <workspace>/images.json --dataset <workspace>/dataset.json --dry-run
```

Review the plan, then run it without the dry-run flag. Don't let a helper rewrite public fields or change item scope.

## Verify

Run the context-provided image checker:

```bash
<image-checker-command> --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json --require-images
```

Then confirm:

- every wired path exists and every image file opens
- any duplicate files are intentional
- the dataset count still matches the approved roster

Append this to `brief.md`:

```text
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
```

Stop when important images are wrong, ambiguous, inaccessible or missing. Public copy should never paper over weak image coverage.
