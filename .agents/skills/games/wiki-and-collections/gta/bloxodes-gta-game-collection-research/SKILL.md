---
name: bloxodes-gta-game-collection-research
description: Research one approved Bloxodes GTA collection before data or writing. Use for GTA collection route overlap, scope, complete roster evidence, player-useful fields, sections, image sources, edition differences, and risks. Write brief.md only.
---

# Bloxodes GTA game collection research compatibility entrypoint

Read and follow .agents/skills/bloxodes-franchise-game-collection-research/SKILL.md completely with this context:

- Franchise and namespace: Grand Theft Auto / gta
- Output: tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>/brief.md
- Route: /gta/wiki/<game-slug>/<collection-slug>
- Tables/views: games, game_wiki_pages, game_collection_pages, game_collection_datasets, game_collection_items, and GTA views
- Pipeline docs: dev-docs/pipelines/wiki-collections.md
- Official sources: Rockstar game/manual/support/Newswire/guide sources
- Dedicated sources: GTA Wiki and exact-game databases such as GTABase
- Guide source groups: Beebom, TechWiser, BloxInformer, Game8, Pro Game Guides, and other established guides
- Mode boundary: Story Mode and GTA Online are never blended
- Page type: collectible for finite player-completed Story Mode or Online goals; database for reference rosters

Preserve the old requirements for a complete source-backed roster, independent cross-check, useful comparison fields, game-native sections, exact image planning, edition/platform tracking, route overlap checks, and a brief.md-only output. Do not write dataset.json or final.json, use Roblox APIs for item rows, or create a new GTA table for a collectible.
## Shared game storage

Managed development uses `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`, `game_code_pages`, `game_codes` and `game_tool_pages`. Roblox stays separate. Scope every read and write by namespace. Use `gameDatabase(client, namespace)` for existing logical suffixes.

`games.kind` is only `franchise` or `game`. `parent_id` links a game to its franchise. Other mode and edition labels describe content without adding kinds. Read the wiki row's `canonical_path` before planning collection links. A standalone game's wiki is `/<namespace>/wiki`. A franchise has its own wiki hub and child game wikis. Preserve Minecraft's edition URLs.

Use `publish:game-pages -- --namespace <slug> --file <reviewed.json>` for reviewed game, wiki, codes page and registered tool payloads. It is dry run by default; `--apply` writes only to development. Combined payloads need explicit IDs. Publish identity before wiki, then collections. Research stays in ignored workspaces.

Use `sync:shared-game-collection-runtime` with `--namespace` and the reviewed runtime manifest. Keep immutable dataset/media publication and pointer readback. Preserve drafts, revisions, sources, fields and media. Never edit published items. General wiki and collection workflows cover standalone games and franchises. GTA specialists retain mode, source, map and collectible rules under `namespace = 'gta'`.
