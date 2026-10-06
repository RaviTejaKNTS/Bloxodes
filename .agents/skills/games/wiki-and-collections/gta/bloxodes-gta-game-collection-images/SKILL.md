---
name: bloxodes-gta-game-collection-images
description: Gather, save, map, and verify exact item images for one approved Bloxodes GTA collection after data approval. Use for image source checks, media files, images.json, dataset wiring, coverage notes, and image readiness. Do not write final.json or publish production.
---

# Bloxodes GTA game collection images compatibility entrypoint

Read and follow .agents/skills/bloxodes-franchise-game-collection-images/SKILL.md completely with this GTA context:

- Franchise and namespace: Grand Theft Auto / gta
- Workspace: tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>/
- Media prefix: gta/<game-slug>/<collection-slug>/
- Preferred sources: official Rockstar media, manuals, guides, stable GTA Wiki or database images, and exact traceable in-game captures
- Route scope: keep Story Mode, GTA Online, edition, platform, model, and location images separate
- Image helper: npm run collect:collection-images
- Image checker: npm run check:game-collection-data -- --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json --require-images

Preserve the old exact-match image rules, nonzero target, source/caveat record, media wiring, collectible location/route image preference, visual spot checks, and parent-approved gaps. Do not write final.json, use logos, screenshots, generic art, fan art, or AI substitutes, or publish production.
## Shared game storage

Managed development uses `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`, `game_code_pages`, `game_codes` and `game_tool_pages`. Roblox stays separate. Scope every read and write by namespace. Use `gameDatabase(client, namespace)` for existing logical suffixes.

`games.kind` is only `franchise` or `game`. `parent_id` links a game to its franchise. Other mode and edition labels describe content without adding kinds. Read the wiki row's `canonical_path` before planning collection links. A standalone game's wiki is `/<namespace>/wiki`. A franchise has its own wiki hub and child game wikis. Preserve Minecraft's edition URLs.

Use `publish:game-pages -- --namespace <slug> --file <reviewed.json>` for reviewed game, wiki, codes page and registered tool payloads. It is dry run by default; `--apply` writes only to development. Combined payloads need explicit IDs. Publish identity before wiki, then collections. Research stays in ignored workspaces.

Use `sync:shared-game-collection-runtime` with `--namespace` and the reviewed runtime manifest. Keep immutable dataset/media publication and pointer readback. Preserve drafts, revisions, sources, fields and media. Never edit published items. General wiki and collection workflows cover standalone games and franchises. GTA specialists retain mode, source, map and collectible rules under `namespace = 'gta'`.
