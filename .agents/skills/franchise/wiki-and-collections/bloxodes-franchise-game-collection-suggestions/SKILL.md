---
name: bloxodes-franchise-game-collection-suggestions
description: Suggest durable wiki collection pages for one non-Roblox game title in a configured franchise namespace. Use before collection research; do not write pages or datasets.
---

# Bloxodes Franchise Game Collection Suggestions

You're deciding which game collection pages Bloxodes should create for one non-Roblox game. You're done when every candidate has a clear call backed by linked source proof. Don't write the pages here.

**Before you start:** read `bloxodes-docs/content/franchise.md` (identity, routes, tables and the rules every franchise page follows) and `bloxodes-docs/content/page-standards.md` (titles, headings, depth, images and layout). Public copy and writer briefs follow `.agents/skills/bloxodes-voice/SKILL.md`.

## Useful coverage

Build the most accurate, up-to-date collection the sources support. Combine rows across sources and merge duplicates. When sources disagree on a value, use the better-supported one or a range, as the data skill's "Conflicting sources" rule says. Leave a value empty or null only when no reliable source gives one. Record missing rows, conflicting claims and follow-ups in the brief so the collection can improve later.

A source saying 97 items while listing 98, an incomplete roster, no official confirmation or uncertain update coverage aren't reasons to block on their own. Don't invent facts or claim complete live coverage. Block only when there truly isn't enough supported material for a worthwhile player-facing page.

## Start

1. Resolve the exact game, namespace, registry UUID, editorial slug, title kind and parent title.
2. Check that the identity belongs to the correct title, edition, platform and mode.
3. Check existing Bloxodes `game_collection_pages` for that namespace and owning wiki. Don't recommend collection pages we already cover.

This is how you avoid recommending collections that already exist for the game.

## Source check

Search broadly. Use the strongest sources you can find: game-specific Fandom or wiki pages, official publisher/developer pages, manuals, update logs, Beebom, TechWiser, Game8, Pro Game Guides and established guides for the exact title.

Go past the first search result or homepage. Open relevant source pages and follow useful internal links until you understand the game's item systems.

**Competitor wiki coverage.** Check these source groups explicitly before you decide:

- **Beebom:** search for the game plus `wiki`, `items`, `units`, `weapons`, `pets` or the likely collection nouns. Open any relevant wiki or guide page and record which collections or item systems it covers.
- **TechWiser:** search the same way. Open any relevant wiki or guide page and record what it covers.
- **Dedicated game wiki/database and official guides:** search the same way. Open relevant roster and system pages and record what they cover.

If a site has no relevant page, write `none found` and include the search query or result URL you checked. If it does have relevant wiki content, treat the collections it covers as strong evidence, and recommend `[create]` for any that fit Bloxodes criteria and aren't already covered.

## What counts

Recommend only useful, durable in-game collection pages: item or system collections such as pets, units, weapons, fruits, maps, areas, recipes, traits, mutations, currencies, classes, bosses, materials, vehicles, cosmetics, unlocks and similar player-facing systems.

Skip events, temporary reward tracks, storefront products, server directories and broad update summaries. Separate mode, expansion, edition, platform and release-generation rosters when their facts differ. Use spoiler-safe collection names.

Mark `[create]` only when there's at least one decent public source and enough detail to make a useful page. For each `[create]`, recommend a page type:

- `page type: collectible` when the player completes finite goals (collectibles, locations, quests, badges or route steps).
- `page type: database` otherwise.

Both types use the existing collection table and runtime manifest.

### Item count isn't a blocker

Don't skip a collection just because it has only a few items. A small collection is still worth `[create]` when all of these hold:

- It's a core, player-facing part of the game: something players actively look up, plan around or compare.
- The data is good: source-backed, with useful per-item fields like rarity, cost, income, ability, source or stats.
- There's real search demand: several guide or wiki sites cover it, or it shows up in searches as something players ask about.

A focused 4 to 8 item collection that's core to the game and has good data beats a padded list of trivia. Judge by importance, data quality and search demand, not raw count.

Still skip it when the small count means it's truly thin: not a core system, no useful per-item fields, weak or single-source data, or already covered by a broader collection.

### Name it the way players search

Name each `[create]` collection the way players actually search for it, using the wording you saw in your keyword checks and competitor pages. "Garden Rush Pets" or "Tower Brawl Units" is right (made-up games, real pattern). A templated angle like "Complete Item Database" or "Ultimate Guide to Every X" isn't. Give a one-line reason a player would open the page, in their words.

## Output

Start with `Evidence checked`:

```text
Evidence checked:
- Bloxodes existing pages:
- Official publisher/developer/manual pages:
- Beebom wiki/guide pages:
- TechWiser wiki/guide pages:
- Game8:
- Pro Game Guides:
- Fandom/game wiki:
- standalone wiki:
- All other sources:
- keyword searches:
```

If any source-check line wasn't actually checked, don't decide. Return `[source discovery incomplete]` with the missing checks. When you have checked, always link every page you checked.

Then return only game collection recommendations:

- `[create]` durable in-game item/system collection with enough source evidence
- `[we already have a page]` production already covers it
- `[skip]` weak, temporary, global-duplicate, or not a game collection page
- `[source discovery incomplete]` required source checks were not completed

Keep each recommendation short and include the source proof behind it.
