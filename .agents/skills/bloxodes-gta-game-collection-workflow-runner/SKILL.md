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
- Tables: gta_games, gta_wiki_pages, gta_wiki_collection_pages, gta_wiki_collection_datasets, gta_wiki_collection_items
- Runtime progress: GTA collection page type and the existing GTA progress adapter/table
- Managed development: npm run dev:managed
- Final verifier: npm run verify:gta-collection-final -- --base-url http://localhost:<port> --game <game-slug> --collection <collection-slug> --workspace tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>
- HTML-size gate: npm run audit:html-size -- --url http://localhost:<port>/gta/wiki/<game-slug>/<collection-slug> --fail-on-limit
- Source policy: Rockstar first, then GTA Wiki or exact-game databases, configured guide sources, and targeted searches
- Mode boundary: Story Mode and GTA Online remain separate

Preserve the prior one-collection worker model, parent approval at research, data, and image gates, fresh writer after image approval, v2 checks, exact-image checks, database pagination versus collectible no-pagination checks, GTA sidebar/search/sitemap checks, and managed-development-only publication. Never use Roblox APIs, GAME_COLLECTIONS, /wiki routes, production credentials, --allow-prod, production migrations, deploy, merge, push, or release.
