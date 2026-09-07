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
- Tables: gta_games, gta_wiki_pages, gta_wiki_collection_pages, gta_wiki_collection_datasets, gta_wiki_collection_items
- Runtime media prefix: gta/<game-slug>/<collection-slug>/
- Page type: database or collectible in runtime-manifest.json, using the existing GTA collection row and v2 dataset for both
- Code pattern: <game-slug>-<collection-slug>
- Audit: npm run audit:game-collection-datasets:v2
- Checker: npm run check:game-collection-data
- Runtime sync dry plan: npm run sync:gta-collection-runtime -- --manifest <workspace>/runtime-manifest.json

Preserve the old v2 contract, public/system field separation, display metadata, section, image-planning, sourceUrls, and data-readiness rules. Do not gather images, write final.json, use data/ or apps/web/public/, use GAME_COLLECTIONS or register:game-collection, call Roblox APIs, or pass --apply, --upload-media, --publish, or --allow-prod.
