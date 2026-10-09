---
name: bloxodes-gta-game-collection-workflow-runner
description: Run one or many approved Bloxodes GTA collections through research, data, images, writing, managed-development publication, verification, size checks, and browser review. Use for GTA wiki collection work. Never publish production.
---

# Bloxodes GTA game collection workflow runner compatibility entrypoint

This is the GTA entry point for running collections. Read and follow `.agents/skills/bloxodes-franchise-game-collection-workflow-runner/SKILL.md` completely, using the GTA context below.

## GTA context

- **Franchise and namespace:** Grand Theft Auto / `gta`
- **Allowlist:** only the GTA game and collection list supplied by the user or the approved roadmap
- **Route:** `/gta/wiki/<game-slug>/<collection-slug>`
- **Workspace:** `tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>/`
- **Tables:** `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`
- **Runtime progress:** GTA collection page type and the existing GTA progress adapter/table
- **Managed development:** `npm run dev:managed`
- **Final verifier:** `npm run verify:gta-collection-final -- --base-url http://localhost:<port> --game <game-slug> --collection <collection-slug> --workspace tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>`
- **HTML-size gate:** `npm run audit:html-size -- --url http://localhost:<port>/gta/wiki/<game-slug>/<collection-slug> --fail-on-limit`
- **Source policy:** Rockstar first, then GTA Wiki or exact-game databases, configured guide sources and targeted searches
- **Mode boundary:** Story Mode and GTA Online stay separate

## GTA rules

- Keep the franchise runner's one-collection worker model, parent approval at the research, data and image gates, a fresh writer after image approval, v2 checks, exact-image checks, database pagination versus collectible no-pagination checks, and managed-development-only publication.
- Also check the GTA sidebar, search and sitemap.
- The writer uses the GTA writing skill (`.agents/skills/bloxodes-gta-game-collection-writing/SKILL.md`) plus `bloxodes-voice`. Review the copy against `bloxodes-voice` as the franchise runner's "Writing gate" describes.
- Never use Roblox APIs, `GAME_COLLECTIONS`, `/wiki` routes, production credentials, `--allow-prod` or production migrations, and never deploy, merge, push or release.

## Shared game storage

The franchise skill's "Shared game storage" rules apply as written, with `namespace = 'gta'`. GTA keeps its own mode, source, map and collectible rules under that namespace.
