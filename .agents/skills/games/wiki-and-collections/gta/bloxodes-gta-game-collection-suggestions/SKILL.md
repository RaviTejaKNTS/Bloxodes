---
name: bloxodes-gta-game-collection-suggestions
description: Suggest durable Bloxodes collection pages for one Grand Theft Auto game. Use when deciding which GTA wiki collection databases to create. Do not write pages, mix game modes, or suggest articles and tools as collections.
---

# Bloxodes GTA game collection suggestions compatibility entrypoint

This is the GTA entry point for collection suggestions. Read and follow `.agents/skills/bloxodes-franchise-game-collection-suggestions/SKILL.md` completely, then apply the GTA context below.

## GTA context

- **Franchise and namespace:** Grand Theft Auto / `gta`
- **Title route:** `/gta/wiki/<game-slug>`
- **Collection route:** `/gta/wiki/<game-slug>/<collection-slug>`
- **Tables/views:** `games`, `game_wiki_pages`, `game_collection_pages`, and their GTA views
- **Environments:** managed development and production
- **Official-source groups:** Rockstar game/manual/support/Newswire/guide pages; GTA Wiki; GTABase or another exact-game GTA database; Beebom, TechWiser, BloxInformer, Game8, Pro Game Guides; other established guides and keyword searches
- **Required mode boundary:** Story Mode, GTA Online or another named mode must be explicit

## GTA rules

- Check exact collection overlap before recommending anything.
- Use the labels `[create]`, `[we already have a page]`, `[skip]` and `[source discovery incomplete]`.
- Recommend `database` or `collectible` for each idea.
- Keep location-heavy goals separate.
- Name collections the way GTA players search, using the in-game noun and mode ("GTA Online Signal Jammers", not "Online Collectible Devices").
- Don't suggest articles, tools, temporary Online rotations or mixed-mode collections.
- Don't write a hub, brief, dataset, image set or final JSON, and never use Roblox sources or tables.

## Shared game storage

The franchise skill's "Shared game storage" rules apply as written, with `namespace = 'gta'`. GTA keeps its own mode, source, map and collectible rules under that namespace.
