---
name: bloxodes-gta-game-collection-suggestions
description: Suggest durable Bloxodes collection pages for one Grand Theft Auto game. Use when deciding which GTA wiki collection databases to create. Do not write pages, mix game modes, or suggest articles and tools as collections.
---

# Bloxodes GTA game collection suggestions

Find useful, durable collections for one GTA game. This skill decides what belongs in the collection system. It does not research a final dataset or write a page.

## Start

1. Resolve the exact GTA game, editorial slug, release status, and official Rockstar URL.
2. Define the requested mode boundary: Story Mode, GTA Online, or another named mode. If the user did not specify it, infer only when the surrounding project plan makes it unambiguous and state the choice.
3. Check `gta_wiki_collection_pages` in managed development and production for the exact `wiki_slug`. Do not recommend a collection already covered.
4. Check the wiki hub and approved roadmap so suggestions fit the current navigation and do not repeat a planned page under a different name.

## Source discovery

Search broadly. Check all of these source groups before deciding:

- Official Rockstar game, manual, support, newswire, and guide pages.
- GTA Wiki or another game-specific wiki.
- A standalone GTA database such as GTABase when it covers the exact game and mode.
- Beebom, TechWiser, BloxInformer, Game8, and Pro Game Guides. Record `none found` for sites with no relevant result.
- Other established guide sites and targeted keyword searches for the likely collection nouns.

Open useful result pages. Do not rely only on search snippets or a site's home page. Competitor coverage proves player interest, not factual accuracy, so verify the proposed collection with stronger sources.

## What counts

Recommend stable player-facing databases such as vehicles, weapons, characters, missions, properties, heists, crew, activities, random events, cheats, achievements, radio stations, factions, animals, locations, and fixed collectible families.

A small collection still qualifies when it is central to the game, has useful per-row fields, and has real search interest. Do not pad it with trivia to increase the count.

Skip:

- Temporary GTA Online rotations, bonuses, shops, events, and reward tracks.
- Rankings, news, update summaries, walkthrough prose, and opinion pieces.
- Calculators or trackers that belong in tools or checklists.
- Collections that cannot be kept separate by game, mode, edition, or platform.
- Broad pages whose rows would have no useful comparison or lookup fields.

Prefer separate routes for location-heavy collectible families. A single collectibles index may link to those routes later, but it should not duplicate every row.

## Output

Start with:

```text
Evidence checked:
- Bloxodes existing GTA pages:
- Official Rockstar sources:
- BloxInformer:
- Beebom:
- TechWiser:
- Game8:
- Pro Game Guides:
- GTA Wiki or game wiki:
- Standalone GTA database/wiki:
- Other sources:
- Keyword searches:
- Game/mode/edition boundary:
```

If a line was not checked, return `[source discovery incomplete]` and name the gap.

Then return only collection decisions:

- `[create]` with a short reason, proposed slug, mode scope, useful fields, and source proof.
- `[we already have a page]` with the existing route.
- `[skip]` with the concrete reason.
- `[source discovery incomplete]` when the evidence does not support a decision.

Do not write a hub, article, checklist, tool, `brief.md`, dataset, or `final.json` in this skill.
