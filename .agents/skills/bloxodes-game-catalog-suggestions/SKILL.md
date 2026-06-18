---
name: bloxodes-game-catalog-suggestions
description: Suggest Bloxodes game catalog page opportunities for one Roblox game. Use when the user asks what catalog pages can be made, asks for catalog-only discovery, or wants durable in-game collection ideas before writing pages.
---

# Bloxodes Game Catalog Suggestions

Use this to decide what game catalog pages Bloxodes should create for one Roblox game. Do not write the pages here.

## Start

1. Resolve the exact game to find the Universe ID. Skip this when the Universe ID is already provided.
2. Check that the Universe ID belongs to the correct game.
3. Check existing Bloxodes `wiki_catalog_pages` for that universe ID. Do not recommend catalog pages we already cover.

This step is needed so that you do not recommend catalogs that already exist for that game.

## Source Check

Search broadly. Use stronger sources when available: game-specific Fandom or wiki pages, official game pages, update logs, creator posts, BloxInformer, Beebom, Game8, Pro Game Guides, and similar Roblox guide sites.

Do not stop at the first search result or homepage. Open relevant source pages, follow useful internal links, and use them to understand the game's item systems before deciding what Bloxodes can cover.

## What Counts

Recommend only useful, durable in-game catalog pages:

- item or system catalogs such as pets, units, weapons, fruits, maps, areas, recipes, traits, mutations, currencies, classes, bosses, materials, vehicles, cosmetics, unlocks, and similar player-facing systems

Skip events, temporary reward tracks, gamepasses, badges, developer products, servers, broad update summaries, and raw Roblox media.

Only mark `[create]` when there is at least one decent public source and enough detail to make a useful page.

## Output

Start with `Evidence checked`, 

```text
Evidence checked:
- Bloxodes existing pages:
- BloxInformer:
- Fandom/game wiki:
- standalone wiki:
- guide sites:
- keyword searches:
```

If any source-check line is not actually checked, do not decide. Return `[source discovery incomplete]` with the missing checks.

then return only game catalog recommendations:

- `[create]` durable in-game item/system collection with enough source evidence
- `[we already have a page]` production already covers it
- `[skip]` weak, temporary, global-duplicate, or not a game catalog page
- `[source discovery incomplete]` required source checks were not completed

Keep each recommendation short and include the source proof that supports it.
