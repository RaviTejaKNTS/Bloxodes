---
name: bloxodes-gta-wiki-writing
description: Write game.json and final.json for one approved Bloxodes GTA wiki hub after research approval. Use for GTA game metadata, hub copy, tips, verified controls, and managed-development authoring output. Do not publish production content.
---

# Bloxodes GTA wiki writing compatibility entrypoint

Read and follow .agents/skills/bloxodes-franchise-wiki-writing/SKILL.md completely after approved GTA research, with this fixed context:

- Franchise and namespace: Grand Theft Auto / gta
- Workspace: tmp/content-workspace/gta/<game-slug>/wiki/<game-slug>/
- Hub route: /gta/wiki/<game-slug>
- Publisher default: Rockstar Games
- Status values: announced, upcoming, released
- GTA schema: create game.json and final.json using the existing GTA-shaped fields, with no universe_id
- Controls: non-empty rows use action plus only verified desktop, mobile, tablet, and console keys; use [] when unverified
- Artwork: final.json cover_image is null unless the approved brief documents a reviewed exception; normal game artwork belongs in game.json. Source artwork must be staged through `npm run sync:gta-wiki-media` so released hubs store Bloxodes-hosted `https://media.bloxodes.com/wiki/...` URLs instead of browser-facing Wikia/Rockstar hotlinks.
- GTA hub artwork has two required, distinct roles for released/published hubs: game.json cover_image is the wide card/social cover, and game.json hero_image is separate square-friendly artwork for the thumbnail beside the wiki title. Never duplicate the two URLs.
- Scope: keep Story Mode, GTA Online, announced titles, expansions, editions, and platform differences explicit

Preserve the existing GTA voice and prohibitions: plain player-facing copy, light factual humor, no hype or AI filler, no em dashes, no source, workflow, database, or SEO language, no future collection promises, three or four useful tips, and no production publishing. Parse both JSON files before returning.
