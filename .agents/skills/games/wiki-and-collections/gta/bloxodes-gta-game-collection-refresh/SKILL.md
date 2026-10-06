---
name: bloxodes-gta-game-collection-refresh
description: Maintain an existing Bloxodes GTA collection by checking verified roster, field, edition, and image changes, then updating only confirmed deltas. Use for existing /gta/wiki collections, not discovery or new pages. Stop unchanged when no real delta exists and never publish production.
---

# Bloxodes GTA game collection refresh compatibility entrypoint

Read and follow .agents/skills/bloxodes-franchise-game-collection-refresh/SKILL.md completely with this GTA context:

- Franchise and namespace: Grand Theft Auto / gta
- Existing collection table: game_collection_pages
- Route: /gta/wiki/<game-slug>/<collection-slug>
- Workspace: tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>/
- Pipeline docs: dev-docs/pipelines/wiki-collections.md
- Supporting skills: the GTA data and GTA image compatibility entrypoints
- Scope: existing collections with a published dataset pointer only; never discover, suggest, or create
- Boundaries: never change Story Mode, Online, edition, or platform scope during refresh
- Runtime: GTA pageType, immutable GTA dataset revisions, GTA progress adapter, and managed-development verifier

Preserve the prior quick-check outcomes Unchanged, Data update, Page-type update, Image update, Copy follow-up, and Blocked. Stop unchanged without edits, use source-backed deltas only, keep {count} automated, do not regenerate final.json by default, and never write production, deploy, merge, push, or call a release skill.
## Shared game storage

Managed development uses `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`, `game_code_pages`, `game_codes` and `game_tool_pages`. Roblox stays separate. Scope every read and write by namespace. Use `gameDatabase(client, namespace)` for existing logical suffixes.

`games.kind` is only `franchise` or `game`. `parent_id` links a game to its franchise. Other mode and edition labels describe content without adding kinds. Read the wiki row's `canonical_path` before planning collection links. A standalone game's wiki is `/<namespace>/wiki`. A franchise has its own wiki hub and child game wikis. Preserve Minecraft's edition URLs.

Use `publish:game-pages -- --namespace <slug> --file <reviewed.json>` for reviewed game, wiki, codes page and registered tool payloads. It is dry run by default; `--apply` writes only to development. Combined payloads need explicit IDs. Publish identity before wiki, then collections. Research stays in ignored workspaces.

Use `sync:shared-game-collection-runtime` with `--namespace` and the reviewed runtime manifest. Keep immutable dataset/media publication and pointer readback. Preserve drafts, revisions, sources, fields and media. Never edit published items. General wiki and collection workflows cover standalone games and franchises. GTA specialists retain mode, source, map and collectible rules under `namespace = 'gta'`.
