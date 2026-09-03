---
name: bloxodes-game-collection-suggestions
description: Suggest Bloxodes game collection page opportunities for one Roblox game. Use when the user asks what collection pages can be made, asks for collection-only discovery, or wants durable in-game collection ideas before writing pages.
---

# Bloxodes Game Collection Suggestions

Use this to decide what game collection pages Bloxodes should create for one Roblox game. Do not write the pages here.

## Start

1. Resolve the exact game to find the Universe ID. Skip this when the Universe ID is already provided.
2. Check that the Universe ID belongs to the correct game.
3. Check existing Bloxodes `wiki_collection_pages` for that universe ID. Do not recommend collection pages we already cover.

This step is needed so that you do not recommend collections that already exist for that game.

## Source Check

Search broadly. Use stronger sources when available: game-specific Fandom or wiki pages, official game pages, update logs, creator posts, BloxInformer, Beebom, TechWiser, Game8, Pro Game Guides, and similar Roblox guide sites.

Explicitly search for competitor wiki coverage before deciding:

- Beebom wiki coverage: search Beebom for the game plus `wiki`, `items`, `units`, `weapons`, `pets`, or the likely collection nouns. Open any relevant Beebom wiki/guide page and record what collections or item systems it covers.
- TechWiser wiki coverage: search TechWiser the same way. Open any relevant TechWiser wiki/guide page and record what collections or item systems it covers.
- BloxInformer wiki coverage: search BloxInformer the same way. Open any relevant BloxInformer wiki/guide page and record what collections or item systems it covers.

If one of these sites has no relevant page, say `none found` and include the search query or result URL checked. If one has relevant wiki content, treat its covered item/system collections as strong evidence; recommend `[create]` for any collection that fits Bloxodes criteria and is not already covered.

Do not stop at the first search result or homepage. Open relevant source pages, follow useful internal links, and use them to understand the game's item systems before deciding what Bloxodes can cover.

## What Counts

Recommend only useful, durable in-game collection pages:

- item or system collections such as pets, units, weapons, fruits, maps, areas, recipes, traits, mutations, currencies, classes, bosses, materials, vehicles, cosmetics, unlocks, and similar player-facing systems

Skip events, temporary reward tracks, gamepasses, badges, developer products, servers, broad update summaries, and raw Roblox media.

Only mark `[create]` when there is at least one decent public source and enough detail to make a useful page. For each `[create]`, recommend `page type: checklist` when the player completes finite goals (collectibles, locations, quests, badges, or route steps); otherwise recommend `page type: database`. Both types use the existing collection table and runtime manifest.

### Item count is not a blocker

Do not skip a collection just because it has only a few items. A small collection is still worth `[create]` when all of these hold:

- it is a core, player-facing part of the game (something players actively look up, plan around, or compare), and
- the data is good quality: source-backed, with useful per-item fields (rarity, cost, income, ability, source, stats, etc.), and
- there is real search demand for it (multiple guide/wiki sites cover it, or it shows up in searches as a thing players ask about).

A focused 4–8 item collection that is core to the game and has quality data is a better page than a padded list of trivia. Judge by importance, data quality, and search demand — not by raw count.

Still skip when the small count means it is genuinely thin: not a core system, no useful per-item fields, weak or single-source data, or already covered by a broader collection.

## Output

Start with `Evidence checked`,

```text
Evidence checked:
- Bloxodes existing pages:
- BloxInformer wiki/guide pages:
- Beebom wiki/guide pages:
- TechWiser wiki/guide pages:
- Game8:
- Pro Game Guides:
- Fandom/game wiki:
- standalone wiki:
- All other sources:
- keyword searches:
```

If any source-check line is not actually checked, do not decide. Return `[source discovery incomplete]` with the missing checks. If you have checked, always provide the link to all the pages you have checked. 

then return only game collection recommendations:

- `[create]` durable in-game item/system collection with enough source evidence
- `[we already have a page]` production already covers it
- `[skip]` weak, temporary, global-duplicate, or not a game collection page
- `[source discovery incomplete]` required source checks were not completed

Keep each recommendation short and include the source proof that supports it.
