---
name: bloxodes-gta-game-collection-writing
description: Write final.json for one Bloxodes GTA collection after approved research, data, and images. Use for metadata, collection explanations, FAQs, wiki hub copy, and GTA page identity. Do not change dataset facts or publish production.
---

# Bloxodes GTA game collection writing compatibility entrypoint

Read and follow .agents/skills/bloxodes-franchise-game-collection-writing/SKILL.md completely with this GTA context:

- Franchise and namespace: Grand Theft Auto / gta
- Workspace: tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>/final.json
- Route: /gta/wiki/<game-slug>/<collection-slug>
- Identity fields: wiki_slug is the editorial GTA game slug; collection_slug is the approved collection slug; code is <game-slug>-<collection-slug>
- Page type: database supports browsing and comparison; collectible supports route planning and completion; pageType remains in runtime-manifest.json
- Scope: Story Mode, GTA Online, edition, platform, and release-generation claims stay separate
- Title token: All {count} <Collection> in <Game>, adding Story Mode when needed; never state counts in prose
- Publisher and voice: explain the GTA system plainly, with light factual humor and no Rockstar press-release tone

Preserve the prior field contract, including display_name, intro_md, description_md, how_it_works_md, description_json, faq_json with q/a keys, wiki_md, wiki_sort_order, and is_published. Do not change dataset facts, include universe_id, mention sources, workflow, or site mechanics in public copy, or publish production.
## Shared game storage

Managed development uses `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`, `game_code_pages`, `game_codes` and `game_tool_pages`. Roblox stays separate. Scope every read and write by namespace. Use `gameDatabase(client, namespace)` for existing logical suffixes.

`games.kind` is only `franchise` or `game`. `parent_id` links a game to its franchise. Other mode and edition labels describe content without adding kinds. Read the wiki row's `canonical_path` before planning collection links. A standalone game's wiki is `/<namespace>/wiki`. A franchise has its own wiki hub and child game wikis. Preserve Minecraft's edition URLs.

Use `publish:game-pages -- --namespace <slug> --file <reviewed.json>` for reviewed game, wiki, codes page and registered tool payloads. It is dry run by default; `--apply` writes only to development. Combined payloads need explicit IDs. Publish identity before wiki, then collections. Research stays in ignored workspaces.

Use `sync:shared-game-collection-runtime` with `--namespace` and the reviewed runtime manifest. Keep immutable dataset/media publication and pointer readback. Preserve drafts, revisions, sources, fields and media. Never edit published items. General wiki and collection workflows cover standalone games and franchises. GTA specialists retain mode, source, map and collectible rules under `namespace = 'gta'`.
