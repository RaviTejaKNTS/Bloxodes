---
name: bloxodes-gta-game-collection-suggestions
description: Suggest durable Bloxodes collection pages for one Grand Theft Auto game. Use when deciding which GTA wiki collection databases to create. Do not write pages, mix game modes, or suggest articles and tools as collections.
---

# Bloxodes GTA game collection suggestions compatibility entrypoint

Read and follow .agents/skills/bloxodes-franchise-game-collection-suggestions/SKILL.md completely, then apply this GTA context:

- Franchise and namespace: Grand Theft Auto / gta
- Title route: /gta/wiki/<game-slug>
- Collection route: /gta/wiki/<game-slug>/<collection-slug>
- Tables/views: games, game_wiki_pages, game_collection_pages, and their GTA views
- Environments: managed development and production
- Official-source groups: Rockstar game/manual/support/Newswire/guide pages; GTA Wiki; GTABase or another exact-game GTA database; Beebom, TechWiser, BloxInformer, Game8, Pro Game Guides; other established guides and keyword searches
- Required mode boundary: Story Mode, GTA Online, or another named mode must be explicit

Preserve the old GTA decision behavior: check exact collection overlap, use [create], [we already have a page], [skip], or [source discovery incomplete], recommend database versus collectible, keep location-heavy goals separate, and do not suggest articles, tools, temporary Online rotations, or mixed-mode collections. Do not write a hub, brief, dataset, image set, or final JSON, and never use Roblox sources or tables.
## Shared game storage

Managed development uses `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`, `game_code_pages`, `game_codes` and `game_tool_pages`. Roblox stays separate. Scope every read and write by namespace. Use `gameDatabase(client, namespace)` for existing logical suffixes.

`games.kind` is only `franchise` or `game`. `parent_id` links a game to its franchise. Other mode and edition labels describe content without adding kinds. Read the wiki row's `canonical_path` before planning collection links. A standalone game's wiki is `/<namespace>/wiki`. A franchise has its own wiki hub and child game wikis. Preserve Minecraft's edition URLs.

Use `publish:game-pages -- --namespace <slug> --file <reviewed.json>` for reviewed game, wiki, codes page and registered tool payloads. It is dry run by default; `--apply` writes only to development. Combined payloads need explicit IDs. Publish identity before wiki, then collections. Research stays in ignored workspaces.

Use `sync:shared-game-collection-runtime` with `--namespace` and the reviewed runtime manifest. Keep immutable dataset/media publication and pointer readback. Preserve drafts, revisions, sources, fields and media. Never edit published items. General wiki and collection workflows cover standalone games and franchises. GTA specialists retain mode, source, map and collectible rules under `namespace = 'gta'`.
