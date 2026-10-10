---
name: bloxodes-gta-wiki-research
description: Research one approved Bloxodes GTA wiki hub before writing. Use for exact game identity, release and platform facts, Story Mode or Online scope, core loop, verified controls, related GTA collections, source proof, and risks. Do not write final.json.
---

# Bloxodes GTA wiki research compatibility entrypoint

This is the GTA entry point for hub research. Read and follow `.agents/skills/bloxodes-franchise-wiki-research/SKILL.md` completely, using the GTA context below.

## GTA context

- **Franchise and namespace:** Grand Theft Auto / `gta`
- **Output:** `tmp/content-workspace/gta/<game-slug>/wiki/<game-slug>/brief.md`
- **Hub route:** `/gta/wiki/<game-slug>`
- **Tables/views:** `games`, `game_wiki_pages`, and their GTA views
- **Pipeline docs:** `dev-docs/pipelines/wiki-collections.md`
- **Official sources:** Rockstar game pages, support, manuals, Newswire and official videos
- **Dedicated sources:** GTA Wiki and reliable GTA databases
- **Guide source groups:** Beebom, TechWiser, BloxInformer, Game8, Pro Game Guides and other established guides
- **Mode boundary:** Story Mode and GTA Online are never blended. Announced titles use only confirmed Rockstar facts.
- **Edition boundary:** record Original, Enhanced, Expanded & Enhanced, PC and console differences
- **Controls contract:** the exact existing GTA keys are `action`, `desktop`, `mobile`, `tablet` and `console`. Use only verified values, and `[]` when unknown.
- **Verification command:** `npm run verify:gta-wiki-final`

## GTA rules

- Don't write `final.json`.
- Check the GTA row and the exact managed-development and production route.
- List only existing or approved related GTA pages.
- Reject rumor and trailer inference.
- Write the brief for the writer in plain player language, as the franchise skill and `bloxodes-voice` (`.agents/skills/bloxodes-voice/SKILL.md`) describe. Keep Rockstar/GTA Wiki source talk in the private evidence sections.
- Never use Roblox identifiers, APIs, tables or routes.

## Shared game storage

The franchise skill's "Shared game storage" rules apply as written, with `namespace = 'gta'`. GTA keeps its own mode, source, map and collectible rules under that namespace.
