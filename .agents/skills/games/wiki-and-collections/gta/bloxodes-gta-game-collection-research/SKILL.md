---
name: bloxodes-gta-game-collection-research
description: Research one approved Bloxodes GTA collection before data or writing. Use for GTA collection route overlap, scope, complete roster evidence, player-useful fields, sections, image sources, edition differences, and risks. Write brief.md only.
---

# Bloxodes GTA game collection research compatibility entrypoint

This is the GTA entry point for collection research. Read and follow `.agents/skills/bloxodes-franchise-game-collection-research/SKILL.md` completely, using the GTA context below.

## GTA context

- **Franchise and namespace:** Grand Theft Auto / `gta`
- **Output:** `tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>/brief.md`
- **Route:** `/gta/wiki/<game-slug>/<collection-slug>`
- **Tables/views:** `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`, and the GTA views
- **Pipeline docs:** `dev-docs/pipelines/wiki-collections.md`
- **Official sources:** Rockstar game/manual/support/Newswire/guide sources
- **Dedicated sources:** GTA Wiki and exact-game databases such as GTABase
- **Guide source groups:** Beebom, TechWiser, BloxInformer, Game8, Pro Game Guides and other established guides
- **Mode boundary:** Story Mode and GTA Online are never blended
- **Page type:** `collectible` for finite player-completed Story Mode or Online goals; `database` for reference rosters

## GTA rules

- Keep the franchise skill's requirements: a complete source-backed roster, an independent cross-check, useful comparison fields, game-native sections, exact image planning, edition/platform tracking, route overlap checks, and `brief.md` as the only output.
- Write the writer notes in plain player language, as the franchise skill's "Write the brief for the writer" section and `bloxodes-voice` (`.agents/skills/bloxodes-voice/SKILL.md`) describe. Say "Story Mode" or "GTA Online" the way players do, and keep Rockstar/GTA Wiki source talk in the private evidence sections.
- Don't write `dataset.json` or `final.json`, use Roblox APIs for item rows, or create a new GTA table for a collectible.

## Shared game storage

The franchise skill's "Shared game storage" rules apply as written, with `namespace = 'gta'`. GTA keeps its own mode, source, map and collectible rules under that namespace.
