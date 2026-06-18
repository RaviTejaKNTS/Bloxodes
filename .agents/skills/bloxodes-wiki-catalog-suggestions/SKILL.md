---
name: bloxodes-wiki-catalog-suggestions
description: Suggest Bloxodes wiki and game catalog page opportunities for one Roblox game. Use when the user asks what wiki or catalog pages can be made, asks for catalog-only discovery, or wants durable in-game collection ideas before writing pages.
---

# Bloxodes Wiki And Catalog Suggestions

Read `agents/content-writing/agents.md` first.

Use this to decide what wiki hub or game catalog pages Bloxodes should create for one Roblox game. Do not write the pages here.

## Start

1. Resolve the exact game: name, universe ID, root place ID, creator, official Roblox URL, and editorial slug.
2. Check existing Bloxodes `wiki_pages` and `wiki_catalog_pages` for that universe ID. Do not recommend pages we already cover.
3. Record findings in:

```text
tmp/content-workspace/<game-slug>/suggestions/wiki-catalog/research-notes.md
```

## Source Check

Before recommendations, include this compact proof:

```text
Source check:
- Bloxodes existing pages:
- BloxInformer:
- Fandom/game wiki:
- standalone wiki:
- guide sites:
- keyword searches:
```

Search broadly. Use stronger sources when available: game-specific Fandom or wiki pages, official game pages, update logs, creator posts, BloxInformer, Beebom, Game8, Pro Game Guides, and similar Roblox guide sites.

Do not stop at the first search result or homepage. Open relevant source pages, follow useful internal links, and use them to understand the game's item systems before deciding what Bloxodes can cover.

If any source-check line is not actually checked, do not decide. Return `[source discovery incomplete]` with the missing checks.

## What Counts

Recommend only useful, durable in-game pages:

- wiki hub for a game that has enough stable gameplay information
- item or system catalogs such as pets, units, weapons, fruits, maps, areas, recipes, traits, mutations, currencies, classes, bosses, materials, vehicles, cosmetics, unlocks, and similar player-facing systems

Skip events, temporary reward tracks, gamepasses, badges, developer products, servers, broad update summaries, and raw Roblox media.

Only mark `[create]` when there is at least one decent public source and enough detail to make a useful page.

## Output

Return only wiki/catalog recommendations:

- `[create]` durable wiki or catalog page with enough source evidence
- `[we already have a page]` production already covers it
- `[skip]` weak, temporary, global-duplicate, or not a wiki/catalog page
- `[source discovery incomplete]` required source checks were not completed

Keep each recommendation short and include the source proof that supports it.
