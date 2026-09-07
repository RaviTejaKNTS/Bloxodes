---
name: bloxodes-gta-wiki-suggestions
description: Suggest a Bloxodes GTA wiki hub for one Grand Theft Auto game. Use when deciding whether a GTA title has enough stable, source-backed information for a GTA wiki route. Do not write the page or suggest collection pages.
---

# Bloxodes GTA wiki suggestions compatibility entrypoint

Read and follow .agents/skills/bloxodes-franchise-wiki-suggestions/SKILL.md completely, then apply this fixed GTA context:

- Franchise: Grand Theft Auto
- Namespace and table prefix: gta
- Title route: /gta/wiki/<game-slug>
- Game table: gta_games
- Wiki table/view: gta_wiki_pages and its GTA views
- Environments: managed development and production
- Official-source policy: Rockstar game pages, support pages, manuals, Newswire posts, and official videos first; dedicated GTA wikis/databases second; established guides third; community material only for unresolved gaps
- Scope boundary: keep GTA Story Mode, GTA Online, announced titles, remasters, expansions, and platform editions explicit and separate

This wrapper preserves the old output and safety behavior: decide one GTA hub only, check the exact GTA row and route before recommending it, do not suggest collections, and never use Roblox tables, APIs, or root /wiki routes. Retain the labels [create], [we already have a page], [skip], and [source discovery incomplete], including the GTA evidence categories for Rockstar, GTA Wiki, GTA databases, guide sites, keyword searches, and edition/platform conflicts.
