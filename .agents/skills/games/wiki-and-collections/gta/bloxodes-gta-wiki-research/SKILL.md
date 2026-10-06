---
name: bloxodes-gta-wiki-research
description: Research one approved Bloxodes GTA wiki hub before writing. Use for exact game identity, release and platform facts, Story Mode or Online scope, core loop, verified controls, related GTA collections, source proof, and risks. Do not write final.json.
---

# Bloxodes GTA wiki research compatibility entrypoint

Read and follow .agents/skills/bloxodes-franchise-wiki-research/SKILL.md completely with this GTA context:

- Franchise and namespace: Grand Theft Auto / gta
- Output: tmp/content-workspace/gta/<game-slug>/wiki/<game-slug>/brief.md
- Hub route: /gta/wiki/<game-slug>
- Tables/views: games, game_wiki_pages, and their GTA views
- Pipeline docs: dev-docs/pipelines/wiki-collections.md
- Official sources: Rockstar game pages, support, manuals, Newswire, and official videos
- Dedicated sources: GTA Wiki and reliable GTA databases
- Guide source groups: Beebom, TechWiser, BloxInformer, Game8, Pro Game Guides, and other established guides
- Mode boundary: Story Mode and GTA Online are never blended; announced titles use only confirmed Rockstar facts
- Edition boundary: Original, Enhanced, Expanded & Enhanced, PC, and console differences must be recorded
- Controls contract: exact existing GTA keys are action, desktop, mobile, tablet, and console; use only verified values and [] when unknown
- Verification command: npm run verify:gta-wiki-final

Do not write final.json. Preserve the prior requirements to check the GTA row and exact managed-development and production route, inventory only existing or approved related GTA pages, reject rumor or trailer inference, and never use Roblox identifiers, APIs, tables, or routes.
## Shared game storage

Managed development uses `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`, `game_code_pages`, `game_codes` and `game_tool_pages`. Roblox stays separate. Scope every read and write by namespace. Use `gameDatabase(client, namespace)` for existing logical suffixes.

`games.kind` is only `franchise` or `game`. `parent_id` links a game to its franchise. Other mode and edition labels describe content without adding kinds. Read the wiki row's `canonical_path` before planning collection links. A standalone game's wiki is `/<namespace>/wiki`. A franchise has its own wiki hub and child game wikis. Preserve Minecraft's edition URLs.

Use `publish:game-pages -- --namespace <slug> --file <reviewed.json>` for reviewed game, wiki, codes page and registered tool payloads. It is dry run by default; `--apply` writes only to development. Combined payloads need explicit IDs. Publish identity before wiki, then collections. Research stays in ignored workspaces.

Use `sync:shared-game-collection-runtime` with `--namespace` and the reviewed runtime manifest. Keep immutable dataset/media publication and pointer readback. Preserve drafts, revisions, sources, fields and media. Never edit published items. General wiki and collection workflows cover standalone games and franchises. GTA specialists retain mode, source, map and collectible rules under `namespace = 'gta'`.
