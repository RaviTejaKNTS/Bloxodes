---
name: bloxodes-gta-game-collection-workflow-runner
description: Run one or many approved Bloxodes GTA collections through research, data, images, writing, managed-development publication, verification, size checks, and browser review. Use for GTA wiki collection work. Never publish production.
---

# Bloxodes GTA game collection workflow runner compatibility entrypoint

Read and follow .agents/skills/bloxodes-franchise-game-collection-workflow-runner/SKILL.md completely with this GTA context:

- Franchise and namespace: Grand Theft Auto / gta
- Allowlist: only the GTA game and collection list supplied by the user or approved roadmap
- Route: /gta/wiki/<game-slug>/<collection-slug>
- Workspace: tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>/
- Tables: games, game_wiki_pages, game_collection_pages, game_collection_datasets, game_collection_items
- Runtime progress: GTA collection page type and the existing GTA progress adapter/table
- Managed development: npm run dev:managed
- Final verifier: npm run verify:gta-collection-final -- --base-url http://localhost:<port> --game <game-slug> --collection <collection-slug> --workspace tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>
- HTML-size gate: npm run audit:html-size -- --url http://localhost:<port>/gta/wiki/<game-slug>/<collection-slug> --fail-on-limit
- Source policy: Rockstar first, then GTA Wiki or exact-game databases, configured guide sources, and targeted searches
- Mode boundary: Story Mode and GTA Online remain separate

Preserve the prior one-collection worker model, parent approval at research, data, and image gates, fresh writer after image approval, v2 checks, exact-image checks, database pagination versus collectible no-pagination checks, GTA sidebar/search/sitemap checks, and managed-development-only publication. Never use Roblox APIs, GAME_COLLECTIONS, /wiki routes, production credentials, --allow-prod, production migrations, deploy, merge, push, or release.
## Shared game storage

Managed development uses `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`, `game_code_pages`, `game_codes` and `game_tool_pages`. Roblox stays separate. Scope every read and write by namespace. Use `gameDatabase(client, namespace)` for existing logical suffixes.

`games.kind` is only `franchise` or `game`. `parent_id` links a game to its franchise. Other mode and edition labels describe content without adding kinds. Read the wiki row's `canonical_path` before planning collection links. A standalone game's wiki is `/<namespace>/wiki`. A franchise has its own wiki hub and child game wikis. Preserve Minecraft's edition URLs.

Use `publish:game-pages -- --namespace <slug> --file <reviewed.json>` for reviewed game, wiki, codes page and registered tool payloads. It is dry run by default; `--apply` writes only to development. Combined payloads need explicit IDs. Publish identity before wiki, then collections. Research stays in ignored workspaces.

Use `sync:shared-game-collection-runtime` with `--namespace` and the reviewed runtime manifest. Keep immutable dataset/media publication and pointer readback. Preserve drafts, revisions, sources, fields and media. Never edit published items. General wiki and collection workflows cover standalone games and franchises. GTA specialists retain mode, source, map and collectible rules under `namespace = 'gta'`.
