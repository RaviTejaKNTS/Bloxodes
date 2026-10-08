---
name: bloxodes-gta-game-collection-data
description: Prepare or update one source-backed Bloxodes GTA collection dataset after brief approval. Use for complete v2 rows, comparison fields, sections, image planning, GTA runtime manifest creation, audits, and data-readiness notes. Do not gather images, write final.json, or publish production.
---

# Bloxodes GTA game collection data compatibility entrypoint

Read and follow .agents/skills/bloxodes-franchise-game-collection-data/SKILL.md completely with this GTA context:

- Franchise and namespace: Grand Theft Auto / gta
- Workspace: tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>/
- Reference format: tmp/content-workspace/gta/gta-5/collections/weapons/
- Route: /gta/wiki/<game-slug>/<collection-slug>
- Tables: games, game_wiki_pages, game_collection_pages, game_collection_datasets, game_collection_items
- Runtime media prefix: gta/<game-slug>/<collection-slug>/
- Page type: database or collectible in runtime-manifest.json, using the existing GTA collection row and v2 dataset for both
- Code pattern: <game-slug>-<collection-slug>
- Audit: npm run audit:game-collection-datasets:v2
- Checker: npm run check:game-collection-data
- Runtime sync dry plan: npm run sync:gta-collection-runtime -- --manifest <workspace>/runtime-manifest.json

For database card videos, declare a public URL field in itemFields, columns, and cardFields with fieldPresentation kind video. Verify each URL against the official uploader. HTTPS YouTube watch, youtu.be, and embed URLs are supported. Keep system.image as the poster and fallback; use null for missing videos. Table and detail declarations render validated watch links.

Preserve the old v2 contract, public/system field separation, display metadata, section, image-planning, sourceUrls, and data-readiness rules. Do not gather images, write final.json, use data/ or apps/web/public/, use GAME_COLLECTIONS or register:game-collection, call Roblox APIs, or pass --apply, --upload-media, --publish, or --allow-prod.
## Shared game storage

Managed development uses `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`, `game_code_pages`, `game_codes` and `game_tool_pages`. Roblox stays separate. Scope every read and write by namespace. Use `gameDatabase(client, namespace)` for existing logical suffixes.

`games.kind` is only `franchise` or `game`. `parent_id` links a game to its franchise. Other mode and edition labels describe content without adding kinds. Read the wiki row's `canonical_path` before planning collection links. A standalone game's wiki is `/<namespace>/wiki`. A franchise has its own wiki hub and child game wikis. Preserve Minecraft's edition URLs.

Use `publish:game-pages -- --namespace <slug> --file <reviewed.json>` for reviewed game, wiki, codes page and registered tool payloads. It is dry run by default; `--apply` writes only to development. Combined payloads need explicit IDs. Publish identity before wiki, then collections. Research stays in ignored workspaces.

Use `sync:shared-game-collection-runtime` with `--namespace` and the reviewed runtime manifest. Keep immutable dataset/media publication and pointer readback. Preserve drafts, revisions, sources, fields and media. Never edit published items. General wiki and collection workflows cover standalone games and franchises. GTA specialists retain mode, source, map and collectible rules under `namespace = 'gta'`.
