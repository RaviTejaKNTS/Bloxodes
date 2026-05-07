# Game Dataset Roadmap

Last reviewed: 2026-05-07

Use this as the working queue for building game wiki/catalog datasets one game at a time. The goal is to pick games with strong current Roblox demand, clear dataset structure, and enough long-tail search surface to support Bloxodes wiki pages, catalog pages, tools, quizzes, and code pages.

## Current Priority

1. Steal a Brainrot
2. 99 Nights in the Forest
3. Fish It!
4. Blox Fruits
5. RIVALS
6. Adopt Me
7. Murder Mystery 2

Keep Grow a Garden fresh in parallel because it already has a large local dataset and a seeded wiki page.

## Dataset Candidates

### 1. Steal a Brainrot

Why it matters:
- Very high current Roblox demand and strong social search momentum.
- Good fit for fast-moving wiki/catalog pages because players search for values, rarities, income, rebirths, events, and limited units.

Dataset ideas:
- Brainrots
- Rarities
- Income or money-per-second values
- Mutations or variants
- Rebirth requirements and rewards
- Slaps, troll gear, and gamepasses
- Events and limited drops
- Trading/value list, if reliable sources exist

First useful pages:
- `/wiki/steal-a-brainrot`
- `/catalog/steal-a-brainrot/brainrots`
- `/catalog/steal-a-brainrot/values`
- `/catalog/steal-a-brainrot/rebirths`

Reference snapshot:
- Rolimon's showed Steal a Brainrot with roughly 165k-194k active players in recent crawls and tens of billions of visits.
- Source: https://www.rolimons.com/game/109983668079237

### 2. 99 Nights in the Forest

Why it matters:
- High active player demand with survival, update, class, item, and entity searches.
- Strong dataset shape for evergreen pages and event refreshes.

Dataset ideas:
- Classes
- Entities
- Items
- Eggs
- Pets
- Crafting recipes
- Biomes or locations
- Badges and achievements
- Survival tips and progression notes

First useful pages:
- `/wiki/99-nights-in-the-forest`
- `/catalog/99-nights-in-the-forest/classes`
- `/catalog/99-nights-in-the-forest/entities`
- `/catalog/99-nights-in-the-forest/items`

Reference snapshot:
- Rolimon's showed roughly 262k active players and 26B+ visits in a recent crawl.
- Source: https://www.rolimons.com/game/79546208627805

### 3. Fish It!

Why it matters:
- Strong current player demand.
- Bloxodes already has Fisch-style data patterns, so this should be efficient to model.
- Fishing games create many long-tail searches around fish, rods, bait, locations, rarity, and value.

Dataset ideas:
- Fish
- Rods
- Bait
- Locations
- Boats
- Mutations
- Limited fish
- Trading values
- Skins and crates

First useful pages:
- `/wiki/fish-it`
- `/catalog/fish-it/fish`
- `/catalog/fish-it/rods`
- `/catalog/fish-it/locations`

Reference snapshot:
- Rolimon's showed roughly 159k active players and 4B+ visits in a recent crawl.
- Source: https://www.rolimons.com/game/121864768012064

### 4. Blox Fruits

Why it matters:
- Massive evergreen Roblox search demand.
- Competitive SERP, but the game has enough long-tail structure to justify a dataset if we can keep it accurate.

Dataset ideas:
- Fruits
- Swords
- Fighting styles
- Guns
- Accessories
- Islands
- Bosses
- NPCs
- Materials
- Sea events
- Codes and update history
- Value and tier-list data, only if sources are trustworthy

First useful pages:
- `/wiki/blox-fruits`
- `/catalog/blox-fruits/fruits`
- `/catalog/blox-fruits/swords`
- `/catalog/blox-fruits/islands`

Reference snapshot:
- Rolimon's showed roughly 366k active players and 60B+ visits in a recent crawl.
- Source: https://www.rolimons.com/game/2753915549

### 5. RIVALS

Why it matters:
- High current active players and likely less saturated than the largest roleplay/trading games.
- Good fit for weapons, skins, settings, contracts, and competitive guides.

Dataset ideas:
- Weapons
- Skins
- Charms or cosmetics
- Maps
- Contracts
- Game modes
- Settings and crosshair presets
- Codes

First useful pages:
- `/wiki/rivals`
- `/catalog/rivals/weapons`
- `/catalog/rivals/skins`
- `/catalog/rivals/maps`

Reference snapshot:
- Rolimon's showed roughly 396k active players and 13B+ visits in a recent crawl.
- Source: https://www.rolimons.com/game/17625359962

### 6. Adopt Me

Why it matters:
- Huge evergreen audience and strong update cadence.
- Competitive, but pets and values create constant long-tail search demand.

Dataset ideas:
- Pets
- Eggs
- Pet values
- Vehicles
- Toys
- Houses
- Strollers
- Food
- Events
- Codes, if active

First useful pages:
- `/wiki/adopt-me`
- `/catalog/adopt-me/pets`
- `/catalog/adopt-me/eggs`
- `/catalog/adopt-me/values`

Reference snapshot:
- Rolimon's showed roughly 261k active players and 43B+ visits in a recent crawl.
- Source: https://www.rolimons.com/game/920587237

### 7. Murder Mystery 2

Why it matters:
- Evergreen, trade/value-heavy, and highly dataset-friendly.
- Competitive, but still useful if we focus on clean tables and update discipline.

Dataset ideas:
- Knives
- Guns
- Godlies
- Ancients
- Boxes
- Effects
- Pets
- Trading values
- Codes and events

First useful pages:
- `/wiki/murder-mystery-2`
- `/catalog/murder-mystery-2/knives`
- `/catalog/murder-mystery-2/guns`
- `/catalog/murder-mystery-2/values`

Reference snapshot:
- Rolimon's showed roughly 175k active players and 25B+ visits in a recent crawl.
- Source: https://www.rolimons.com/game/142823291

## Existing Dataset To Maintain

### Grow a Garden

Current status:
- Local structured data already exists under `data/Grow a Garden/`.
- The repo currently seeds a `/wiki/grow-a-garden` page through Supabase migrations.

Maintenance focus:
- Refresh crops, seeds, pets, eggs, gears, mutations, weather, shops, merchants, crafting, food, currencies, and quiz data.
- Keep wiki/catalog copy in sync with major shop, event, pet, seed, and mutation updates.
- Consider weekly freshness checks while demand remains high.

Reference snapshot:
- Rolimon's showed roughly 158k active players and 35B+ visits in a recent crawl.
- Source: https://www.rolimons.com/game/126884695634066

## Collection Workflow

For each game:

1. Confirm current demand before starting.
2. Identify primary sources and stable source URLs.
3. Decide the first dataset slices before collecting everything.
4. Store raw structured data under `data/<Game Name>/`.
5. Add parser/helpers under `apps/web/src/lib/*` or route-family `page-data.tsx`.
6. Add catalog/wiki routes only after the dataset shape is stable.
7. Update metadata, sitemap, feed/revalidation coverage, and relevant AGENTS/inventory docs.
8. Add a small quiz only when the game has enough stable facts.

## Notes

- Prefer games with repeated long-tail searches like values, items, tiers, locations, recipes, classes, bosses, mutations, and codes.
- Avoid value-list pages unless we can keep sources current and clearly label uncertainty.
- Re-check priorities monthly because Roblox traffic shifts quickly.
