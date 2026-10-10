---
name: bloxodes-gta-wiki-suggestions
description: Suggest a Bloxodes GTA wiki hub for one Grand Theft Auto game. Use when deciding whether a GTA title has enough stable, source-backed information for a GTA wiki route. Do not write the page or suggest collection pages.
---

# Bloxodes GTA wiki suggestions compatibility entrypoint

This is the GTA entry point for hub suggestions. Read and follow `.agents/skills/bloxodes-franchise-wiki-suggestions/SKILL.md` completely, then apply this fixed GTA context.

## GTA context

- **Franchise:** Grand Theft Auto
- **Namespace and table prefix:** `gta`
- **Title route:** `/gta/wiki/<game-slug>`
- **Game table:** `games`
- **Wiki table/view:** `game_wiki_pages` and its GTA views
- **Environments:** managed development and production
- **Official-source policy:** Rockstar game pages, support pages, manuals, Newswire posts and official videos first; dedicated GTA wikis/databases second; established guides third; community material only for unresolved gaps
- **Scope boundary:** keep GTA Story Mode, GTA Online, announced titles, remasters, expansions and platform editions explicit and separate

## GTA rules

- Decide on one GTA hub only.
- Check the exact GTA row and route before recommending it.
- Don't suggest collections.
- Never use Roblox tables, APIs or root `/wiki` routes.
- Keep the labels `[create]`, `[we already have a page]`, `[skip]` and `[source discovery incomplete]`.
- Keep the GTA evidence categories in "Evidence checked": Rockstar, GTA Wiki, GTA databases, guide sites, keyword searches, and edition/platform conflicts.
- Propose the hub with the title players search ("GTA 5", "GTA Online"), not an internal label.

## Shared game storage

The franchise skill's "Shared game storage" rules apply as written, with `namespace = 'gta'`. GTA keeps its own mode, source, map and collectible rules under that namespace.
