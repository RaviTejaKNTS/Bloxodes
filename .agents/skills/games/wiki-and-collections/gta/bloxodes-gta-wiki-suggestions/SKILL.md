---
name: bloxodes-gta-wiki-suggestions
description: Suggest a Bloxodes GTA wiki hub for one Grand Theft Auto game. Use when deciding whether a GTA title has enough stable, source-backed information for a GTA wiki route. Do not write the page or suggest collection pages.
---

# Bloxodes GTA wiki suggestions compatibility entrypoint

Read and follow .agents/skills/bloxodes-franchise-wiki-suggestions/SKILL.md completely, then apply this fixed GTA context:

- Franchise: Grand Theft Auto
- Namespace and table prefix: gta
- Title route: /gta/wiki/<game-slug>
- Game table: games
- Wiki table/view: game_wiki_pages and its GTA views
- Environments: managed development and production
- Official-source policy: Rockstar game pages, support pages, manuals, Newswire posts, and official videos first; dedicated GTA wikis/databases second; established guides third; community material only for unresolved gaps
- Scope boundary: keep GTA Story Mode, GTA Online, announced titles, remasters, expansions, and platform editions explicit and separate

This wrapper preserves the old output and safety behavior: decide one GTA hub only, check the exact GTA row and route before recommending it, do not suggest collections, and never use Roblox tables, APIs, or root /wiki routes. Retain the labels [create], [we already have a page], [skip], and [source discovery incomplete], including the GTA evidence categories for Rockstar, GTA Wiki, GTA databases, guide sites, keyword searches, and edition/platform conflicts.
## Shared game storage

Managed development uses `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`, `game_code_pages`, `game_codes` and `game_tool_pages`. Roblox stays separate. Scope every read and write by namespace. Use `gameDatabase(client, namespace)` for existing logical suffixes.

`games.kind` is only `franchise` or `game`. `parent_id` links a game to its franchise. Other mode and edition labels describe content without adding kinds. Read the wiki row's `canonical_path` before planning collection links. A standalone game's wiki is `/<namespace>/wiki`. A franchise has its own wiki hub and child game wikis. Preserve Minecraft's edition URLs.

Use `publish:game-pages -- --namespace <slug> --file <reviewed.json>` for reviewed game, wiki, codes page and registered tool payloads. It is dry run by default; `--apply` writes only to development. Combined payloads need explicit IDs. Publish identity before wiki, then collections. Research stays in ignored workspaces.

Use `sync:shared-game-collection-runtime` with `--namespace` and the reviewed runtime manifest. Keep immutable dataset/media publication and pointer readback. Preserve drafts, revisions, sources, fields and media. Never edit published items. General wiki and collection workflows cover standalone games and franchises. GTA specialists retain mode, source, map and collectible rules under `namespace = 'gta'`.
