# Published Wiki Collection Implementation Handoff

Generated on August 9, 2026 from the live Bloxodes wiki sitemap. Updated at the weekly-limit pause point on August 9, 2026.

## Pause snapshot

- Planned: 227 collections across 52 published game wikis.
- Completed and locally verified: 50 collections across 10 games.
- Research-blocked: 2 collections for Berry Avenue RP.
- Yet to complete: 175 collections across 41 untouched games, plus the two blocked Berry Avenue RP collections when complete rosters become available.
- Production release scope: only the 50 checked collections. Unchecked collections and temporary research reports are excluded.
- Resume point: Build a Base and Steal — Building Parts.
- Release rule: never treat an unchecked row as approved data. Resume each game through the collection workflow runner's research, data, image, writing, parent-review, and local-verification gates.

Checkbox legend:

- `[x]` completed and locally verified.
- `[ ]` not completed; any evidence blocker is written on the same line.

## Release handoff

- Release branch: `codex/release-50-wiki-collections`, based directly on `origin/production` and retained for follow-up.
- Collection content commit: `75d88d02` (`Add 50 verified wiki collections`).
- Deployed collection build: `3075bf2131dfa4f5c2c4e0c1bced9675dc131885`; `/api/health` reported this SHA with a healthy database.
- Database release: all 50 checked `wiki_collection_pages` rows were dry-run, idempotently published, and read back with published state, wiki hub linkage, and universe linkage.
- Live verification: all 50 exact collection URLs returned indexable HTML and appeared in `/sitemaps/wiki.xml`.
- Release cleanup: the temporary GitHub Actions publication workflow and its copied final-JSON payload were removed after successful verification.
- Exclusions: all 177 unchecked collections, temporary research reports, and unrelated Chrono Warfare article assets were excluded from this release.
- Production status: complete. Resume collection creation at Build a Base and Steal — Building Parts.

## Scope

- 57 published game wiki hubs reviewed.
- Practical Basketball was the completed pilot audit; the other 56 games were researched by one dedicated sub-agent per game.
- 52 games have at least one source-backed collection to create.
- 227 collection opportunities are listed below.
- Five games had no new source-ready collection: +1 Speed Evolve, Catalog Avatar Creator, Clean the Supermarket, Murderers vs Sheriffs, and Push Rock for Brainrots.
- Full evidence, competitor checks, existing-page overlap, and skip decisions are stored in `tmp/game-collection-suggestions/<game-slug>.md`.

This file is the implementation handoff and source of truth for continuation. Each unchecked checkbox must still go through the game-collection workflow runner's research, data, image, and parent-review gates before implementation.

## Verification flags

- Build a Ring Farm — verify the conflicting Godly Pet Mutation modifier during data research.
- Home Alone — verify current Item prices and effects in the live build; the collection is real, but the available row-level source labels its values low confidence.
- Restaurant Tycoon 3 — refresh the current Restaurant Template and Music rosters before data approval.
- Slime RNG — reconcile the 165-node Upgrades source against the current live version.
- Untitled Boxing Game — reconcile the stated 45 Maps against the subset currently displayed by the source.
- Violence District — verify the exact live Maps rotation before locking the dataset.

## Traffic tiers (2026-08-19)

Ranked on August 19, 2026 from production `roblox_universes.playing` plus 7-day `roblox_universe_stats_hourly` averages where available. Purpose: focus the remaining backlog on games that can actually bring traffic. Work order is Tier A top to bottom, then Tier B, then optionally Tier C. Tier D stays in the backlog untouched unless a game trends up later. Re-check player counts before starting a new tier; games move between tiers over time.

### Tier A — 100k+ players (7 games, 43 collections)

Tier A run completed 2026-08-20 on branch `tier-a-collections` (local only, not published to production). 31 collections shipped and locally verified; 12 rows blocked with reasons on their lines (thin rosters or missing row-level sources). Per game: Murder Mystery 2 8/8, Steal a Brainrot 2/2, RIVALS 4/4, Grow a Garden 2 5/6, Jujutsu Shenanigans 1/1, Pet Simulator 99 10/15, Fish It 1/7.

| Game | ~Players | Collections |
| --- | --- | --- |
| Murder Mystery 2 | 880k avg | 8 |
| Steal a Brainrot | 224k | 2 |
| RIVALS | 208k avg | 4 |
| Grow a Garden 2 | 150k | 6 |
| Jujutsu Shenanigans | 148k avg | 1 |
| Pet Simulator 99 | 143k avg | 15 |
| Fish It | 122k | 7 |

### Tier B — 40k to 100k players (11 games, 52 collections)

Tier B run completed 2026-08-20 on branch `tier-a-collections` (local only, not published to production). 32 collections shipped and locally verified; 20 rows blocked with reasons on their lines. Per game: Dress to Impress 3/6, Fisch 9/10, The Strongest Battlegrounds 1/2, Violence District 1/3, LifeTogether RP 0/1, Forsaken 3/4, Evade 8/8, Driving Empire 3/7, Fling Things and People 0/1, Kick a Lucky Block 1/2, Creatures of Sonaria 4/8.

| Game | ~Players | Collections |
| --- | --- | --- |
| Dress to Impress | 78k avg | 6 |
| Fisch | 71k avg | 10 |
| The Strongest Battlegrounds | 65k avg | 2 |
| Violence District | 63k | 3 |
| LifeTogether RP | 52k avg | 1 |
| Forsaken | 51k | 4 |
| Evade | 48k avg | 8 |
| Driving Empire | 42k avg | 7 |
| Fling Things and People | 41k avg | 1 |
| Kick a Lucky Block | 40k | 2 |
| Creatures of Sonaria | 38k avg | 8 |

### Tier C — 20k to 40k players (4 games, 17 collections)

Tier C run completed 2026-08-20 on branch `tier-a-collections` (local only, not published to production). 10 collections shipped and locally verified; 7 rows blocked with reasons on their lines. Per game: Storage Hunters 5/6, Grow a Garden 3/3 remaining rows, Gakuran 2/4, Merge a Nuke 0/4 (no reliable sources; the game's search ecosystem is AI wiki farms).

| Game | ~Players | Collections |
| --- | --- | --- |
| Storage Hunters: Open World | 32k | 6 |
| Grow a Garden | 29k | 3 |
| Gakuran | 24k | 4 |
| Merge a Nuke | 20k | 4 |

### Tier D — below 20k players (19 games, deprioritized)

Home Alone (17k), Survive Zombie Arena (15k), Restaurant Tycoon 3 (13k), Catch and Tame (13k), Untitled Boxing Game (13k), Sell Lemons (13k), Evomon (11k), Demonology (9k), Build a Base and Steal (7.5k), Clean the Library (4k), Catch a Brainrot (3k), Drain the Lake (3k), Sailor Piece (2k), Build a Ring Farm (1.6k), The Forge (1.5k), Slime RNG (1.1k), Paint and Seek (350), Wizard Alchemy (300), Practical Basketball (0, likely dead universe).

Berry Avenue RP stays research-blocked regardless of tier.

## Create backlog

### +1 Speed Keyboard Escape

Evidence: [full report](../tmp/game-collection-suggestions/1-speed-keyboard-escape.md)

- [x] Items
- [x] Rebirths
- [x] Number Buttons

### 100 Days At Sea

Evidence: [full report](../tmp/game-collection-suggestions/100-days-at-sea.md)

- [x] Armor
- [x] Food
- [x] Night Raids

### 99 Nights in the Forest

Evidence: [full report](../tmp/game-collection-suggestions/99-nights-in-the-forest.md)

- [x] Armor
- [x] Chests
- [x] Blessings
- [x] Fire Offerings
- [x] Seeds

### Adopt Me

Evidence: [full report](../tmp/game-collection-suggestions/adopt-me.md)

- [x] Pet Accessories
- [x] Stickers
- [x] Houses
- [x] Locations
- [x] NPCs
- [x] Pet Needs
- [x] Task Board Tasks
- [x] Weather

### Animal Hospital

Evidence: [full report](../tmp/game-collection-suggestions/animal-hospital.md)

- [x] Patient Conditions

### Anime Expeditions

Evidence: [full report](../tmp/game-collection-suggestions/anime-expeditions.md)

- [x] Expedition Buildings
- [x] Stat Potentials
- [x] Banners
- [x] Shops

### Anime Squadron

Evidence: [full report](../tmp/game-collection-suggestions/anime-squadron.md)

- [x] Perks
- [x] Awakenings
- [x] Materials
- [x] Stages

### Anime Vanguards

Evidence: [full report](../tmp/game-collection-suggestions/anime-vanguards.md)

- [x] Mounts
- [x] Achievements
- [x] Modifiers
- [x] Cosmetics
- [x] Emotes
- [x] Profile Customization
- [x] Stat Ranks
- [x] Crafting Recipes

### Berry Avenue RP

Evidence: [full report](../tmp/game-collection-suggestions/berry-avenue-rp.md)

- [ ] Houses — blocked: no complete current identity-safe house/apartment roster
- [ ] Vehicles — blocked: no complete current identity-safe vehicle roster

### Blox Fruits

Evidence: [full report](../tmp/game-collection-suggestions/blox-fruits.md)

- [x] Fish
- [x] Fishing Rods
- [x] Baits
- [x] Potions
- [x] Trinkets
- [x] Scrolls
- [x] Enchantments
- [x] Aura Skins
- [x] Fruit Skins
- [x] Raids
- [x] Crafting Recipes
- [x] Currencies
- [x] Stats

### Brookhaven RP

Evidence: [full report](../tmp/game-collection-suggestions/brookhaven-rp.md)

- [x] Lore Characters

### Build a Base and Steal

Evidence: [full report](../tmp/game-collection-suggestions/build-a-base-and-steal.md)

- [ ] Building Parts

### Build a Ring Farm

Evidence: [full report](../tmp/game-collection-suggestions/build-a-ring-farm.md)

- [ ] Gear
- [ ] Farm Skins
- [ ] Pet Mutations
- [ ] Titles
- [ ] Skill Tree

### Catch a Brainrot

Evidence: [full report](../tmp/game-collection-suggestions/catch-a-brainrot.md)

- [ ] Locations
- [ ] Items
- [ ] Rarities

### Catch and Tame

Evidence: [full report](../tmp/game-collection-suggestions/catch-and-tame.md)

- [x] Fishing Gear
- [x] Enchantments
- [x] Island Keys

### Clean the Library

Evidence: [full report](../tmp/game-collection-suggestions/clean-the-library.md)

- [ ] Classes
- [ ] Library Maps

### Creatures of Sonaria

Evidence: [full report](../tmp/game-collection-suggestions/creatures-of-sonaria.md)

- [x] Gachas
- [x] Game Currencies
- [x] Shrines
- [ ] NPCs — blocked 2026-08-20: no NPC roster page on the official wiki
- [x] Den Buildables
- [ ] Nest Resources — blocked 2026-08-20: nesting is a mechanics page, no resource roster exists
- [ ] Death Rewards — blocked 2026-08-20: no death rewards roster in any source
- [ ] Realms — blocked 2026-08-20: Realms redirects to locations; already covered by the prod biomes collection's realm fields

### Demonology

Evidence: [full report](../tmp/game-collection-suggestions/demonology.md)

- [x] Ghost Models
- [x] Skins
- [x] Challenges
- [x] Objectives
- [x] Difficulties
- [x] Level Unlocks
- [x] Photo Rewards
- [x] Fortune Teller Tickets

### Drain the Lake

Evidence: [full report](../tmp/game-collection-suggestions/drain-the-lake.md)

- [ ] Classes
- [ ] Endings

### Dress to Impress

Evidence: [full report](../tmp/game-collection-suggestions/dress-to-impress.md)

- [x] Materials
- [ ] Patterns — blocked 2026-08-20: individual patterns are unnamed gallery swatches; pack layer already covered by prod pattern-packs
- [ ] Poses — blocked 2026-08-20: no per-pose roster exists; covered by prod pose-packs
- [ ] Game Modes — blocked 2026-08-20: no source page and only 2 modes
- [x] Style Showdown Challenges
- [x] Characters

### Driving Empire

Evidence: [full report](../tmp/game-collection-suggestions/driving-empire.md)

- [ ] Vehicle Collections — blocked 2026-08-20: no source documents in-game vehicle collection sets
- [x] Houses
- [ ] Races — blocked 2026-08-20: only 5 race venues exist and they are covered inside the locations page
- [x] Customization Upgrades
- [x] Locations
- [ ] Jobs — blocked 2026-08-20: only 4 teams exist, below page floor
- [ ] Trailers — blocked 2026-08-20: no trailer roster in any source

### Evade

Evidence: [full report](../tmp/game-collection-suggestions/evade.md)

- [x] Emotes
- [x] Cosmetics
- [x] Item Skins
- [x] Unusuals
- [x] Carry Animations
- [x] Nametags
- [x] Currencies
- [x] Daily Missions

### Evomon

Evidence: [full report](../tmp/game-collection-suggestions/evomon.md)

- [x] Equipment
- [x] Traits
- [x] Natures
- [x] Moves

### Fisch

Evidence: [full report](../tmp/game-collection-suggestions/fisch.md)

- [x] Boats
- [ ] Tools — blocked 2026-08-20: no tools roster exists (fischipedia "Tools" is a calculator redirect)
- [x] Spears
- [x] Companions
- [x] Relics
- [x] NPCs
- [x] Titles
- [x] Lanterns
- [x] Bobbers
- [x] Rod Skins

### Fish It

Evidence: [full report](../tmp/game-collection-suggestions/fish-it.md)

- [ ] Quests — blocked 2026-08-20: rotating unlimited task pool with one low-quality stub source; not durable rows
- [ ] Artifacts — blocked 2026-08-20: no artifact roster in any accessible source
- [ ] Utility Items — blocked 2026-08-20: no defined roster; overlaps the potions and totems rows
- [ ] Potions — blocked 2026-08-20: only 4 confirmed potions with conflicting details; revisit when the wiki matures
- [ ] Totems — blocked 2026-08-20: only 4 confirmed totems with conflicting durations across sources; revisit later
- [ ] Rod Skins — blocked 2026-08-20: Skin Crates confirm skins exist but no skin roster is published anywhere
- [x] Weather

### Fling Things and People

Evidence: [full report](../tmp/game-collection-suggestions/fling-things-and-people.md)

- [ ] Slot Machine Rewards — blocked 2026-08-20: the slot machine pays 5 coin tiers on a chance table; a probability note, not a durable item collection

### Forsaken

Evidence: [full report](../tmp/game-collection-suggestions/forsaken.md)

- [x] Items
- [x] Status Effects
- [x] NPCs
- [ ] Quests — blocked 2026-08-20: no quest roster exists on any Forsaken source

### Gakuran

Evidence: [full report](../tmp/game-collection-suggestions/gakuran.md)

- [x] Phone Apps
- [ ] Jobs — blocked 2026-08-20: no jobs roster; the Ramen Shop page is a "Coming soon" stub
- [ ] Instruments — blocked 2026-08-20: only 4 instruments exist; covered contextually on the songs page
- [x] Songs

### Grow a Garden

Evidence: [full report](../tmp/game-collection-suggestions/grow-a-garden.md)

- [x] Cosmetics
- [x] Cosmetic Crates
- [x] Ascension Upgrades

### Grow a Garden 2

Evidence: [full report](../tmp/game-collection-suggestions/grow-a-garden-2.md)

- [x] Weather
- [x] Seed Packs
- [x] Eggs
- [ ] Pet Mutations — blocked 2026-08-20: game has only 2 pet mutations (Big, Huge) with unpublished odds; too thin for a page
- [x] NPCs
- [x] Plot Expansions

### Home Alone

Evidence: [full report](../tmp/game-collection-suggestions/home-alone.md)

- [x] Chores
- [x] Items

### Jujutsu Shenanigans

Evidence: [full report](../tmp/game-collection-suggestions/jujutsu-shenanigans.md)

- [x] Moves

### Kick a Lucky Block

Evidence: [full report](../tmp/game-collection-suggestions/kick-a-lucky-block.md)

- [ ] Kick Styles — blocked 2026-08-20: styles exist but no source publishes a complete roster with stats or prices
- [x] Rebirth Levels

### LifeTogether RP

Evidence: [full report](../tmp/game-collection-suggestions/lifetogether-rp.md)

- [ ] Locations — blocked 2026-08-20: no verifiable location roster; the fan wiki has 6 stub pages against 20+ in-game locations, and lifetogetherrp.com self-declares its map unverified

### Merge a Nuke

Evidence: [full report](../tmp/game-collection-suggestions/merge-a-nuke.md)

- [ ] Nukes — blocked 2026-08-20: only real source (merge-a-nuke.fandom.com, 5 pages) marks its roster "under maintenance" and is missing the ~8 tiers between 16.38K and 4.19M; every other site is an AI-generated wiki farm
- [ ] Commanders — blocked 2026-08-20: no reliable roster source; only AI-generated SEO wiki farms name commanders
- [ ] Mutations — blocked 2026-08-20: no roster source exists anywhere
- [ ] Base Upgrades — blocked 2026-08-20: only the Spawn Tier Upgrade (1 of 3 upgrades) has partial data, with "?" costs mid-table

### Murder Mystery 2

Evidence: [full report](../tmp/game-collection-suggestions/murder-mystery-2.md)

- [x] Maps
- [x] Effects
- [x] Emotes
- [x] Radios
- [x] Boxes
- [x] Crafting Recipes
- [x] Weapon Sets
- [x] Game Modes

### Paint and Seek

Evidence: [full report](../tmp/game-collection-suggestions/paint-and-seek.md)

- [ ] Crates

### Pet Simulator 99

Evidence: [full report](../tmp/game-collection-suggestions/pet-simulator-99.md)

- [x] Ultimates
- [ ] Ranks — blocked 2026-08-20: no per-rank roster exists in sources (Ranks page covers quest mechanics only)
- [x] Rebirths
- [x] Achievements
- [x] Currencies
- [x] Upgrades
- [x] Merchants
- [ ] Secret Rooms — blocked 2026-08-20: only 3 rooms exist, too thin for a page
- [ ] Random Events — blocked 2026-08-20: no row-level source for a random events roster
- [x] Fruits
- [x] Flags
- [x] Fishing Rods
- [ ] Shovels — blocked 2026-08-20: no shovel roster exists in sources
- [x] Keys
- [ ] Lootboxes — blocked 2026-08-20: no lootbox roster page; giftbox data lives in a wiki data template without stable row evidence

### Practical Basketball

Evidence: [full report](../tmp/game-collection-suggestions/practical-basketball.md)

- [ ] Moves

### Restaurant Tycoon 3

Evidence: [full report](../tmp/game-collection-suggestions/restaurant-tycoon-3.md)

- [x] Restaurant Templates
- [x] Franchise Levels
- [x] Rating Categories
- [x] Music
- [x] Objectives

### RIVALS

Evidence: [full report](../tmp/game-collection-suggestions/rivals.md)

- [x] Gamemodes
- [x] Ranks
- [x] Currencies
- [x] Loot Boxes

### Sailor Piece

Evidence: [full report](../tmp/game-collection-suggestions/sailor-piece.md)

- [ ] Materials
- [ ] Artifacts
- [ ] Auras
- [ ] Cosmetics
- [ ] Ascensions
- [ ] Skill Tree
- [ ] Spec Passives
- [ ] Powers
- [ ] Blessings
- [ ] Accessory Enchantments
- [ ] Mastery Milestones
- [ ] NPCs

### Sell Lemons

Evidence: [full report](../tmp/game-collection-suggestions/sell-lemons.md)

- [x] Companions
- [x] Orchard Mutations
- [x] Orchard Items
- [x] Tycoon Upgrades
- [x] Active Income Methods
- [x] Ascension Rewards

### Slime RNG

Evidence: [full report](../tmp/game-collection-suggestions/slime-rng.md)

- [ ] Upgrades

### Steal a Brainrot

Evidence: [full report](../tmp/game-collection-suggestions/steal-a-brainrot.md)

- [x] Base Skins
- [x] Recipes

### Storage Hunters: Open World

Evidence: [full report](../tmp/game-collection-suggestions/storage-hunters-open-world.md)

- [x] Auction Items
- [x] Mutations
- [x] Lost Items
- [x] Vehicles
- [x] Fishing Items
- [ ] Quests — blocked 2026-08-20: Category:Quests has a single page; no quest roster exists

### Survive Zombie Arena

Evidence: [full report](../tmp/game-collection-suggestions/survive-zombie-arena.md)

- [x] Artifacts

### The Forge

Evidence: [full report](../tmp/game-collection-suggestions/the-forge.md)

- [ ] Rocks
- [ ] Utility Items
- [ ] Ore Crafting Recipes

### The Strongest Battlegrounds

Evidence: [full report](../tmp/game-collection-suggestions/the-strongest-battlegrounds.md)

- [ ] Emotes — blocked 2026-08-20: only source is a stub gallery that self-declares missing emotes (544 exist, fraction listed, name-only); limited set already covered by prod limited-emotes
- [x] Techniques

### Untitled Boxing Game

Evidence: [full report](../tmp/game-collection-suggestions/untitled-boxing-game.md)

- [x] Maps
- [x] Ranks

### Violence District

Evidence: [full report](../tmp/game-collection-suggestions/violence-district.md)

- [ ] Maps — blocked 2026-08-20: no maps roster exists in any source; live-rotation verification flag cannot be satisfied
- [x] Emotes
- [ ] Item Skins — blocked 2026-08-20: skins confirmed to exist but no roster is documented anywhere

### Wizard Alchemy

Evidence: [full report](../tmp/game-collection-suggestions/wizard-alchemy.md)

- [ ] Pets

## No new source-ready collections

- +1 Speed Evolve — existing Animals, Trails, and Auras cover the durable documented systems.
- Catalog Avatar Creator — Commands already exists; other candidates were dynamic, global, thin, or event-specific.
- Clean the Supermarket — Grocery Items and Upgrades need refreshes, but no distinct missing collection passed.
- Murderers vs Sheriffs — Maps and Emotes still lack reliable current row-level evidence; detailed Fandom coverage belongs to a different universe.
- Push Rock for Brainrots — existing Brainrots, Rocks, and Upgrades cover the durable documented systems.

## Top-50 wiki-gap batch (added 2026-08-20)

New games from the top-50-by-players sweep with no Bloxodes wiki hub. Each needs a new wiki hub page plus the listed collections. Evidence: [full report](../tmp/game-collection-suggestions/top50-wiki-gaps-2026-08-20.md). Skipped games and rows are recorded in the report; notable revisits: Steal an egg Pets/Eggs and Anime Card Farm once real sources mature.

### Sol's RNG (5361032378)

- [x] Auras
- [x] Gears
- [x] Potions
- [x] Biomes

### Dead Rails (7018190066)

- [x] Classes
- [x] Weapons
- [x] Items
- [x] Entities
- [x] Trains
- [x] Locations

### Dandy's World (5569032992)

- [x] Toons
- [x] Twisteds
- [x] Trinkets

### BedWars (2619619496)

- [x] Kits
- [x] Items

### Tower of Hell (703124385)

- [x] Sections
- [x] Mutators

### Steal an egg (10563114921)

- [x] Biomes

### Grow a Chicken Fighter (10338952197)

- [x] Eggs

### Anime Origins (8946565814)

- [x] Units — unblocked and shipped 2026-08-20: BloxInformer's structured Anime Origins wiki (per-unit pages with type, element, cost, passives) plus PGG/Sportskeeda secret obtainment and evolution coverage supplied the roster the tier lists lacked
- [x] Traits — shipped 2026-08-20 from the BloxInformer traits page alongside units

### BlockSpin (6765805766)

- [ ] Weapons — blocked 2026-08-20: Deltia lists five crate prices and zero named weapons; fandom Weapons is an 181-byte stub (Dumpsters, Weapon Crates, Airdrops) with no names. No two-source roster.
- [ ] Vehicles — blocked 2026-08-20: Deltia lists crate prices and zero names; fandom Cars has 13 names with no second independent roster; Elite crate price disagrees ($12,400 vs $16,500). Do not ship Fandom-only rows.

### Batch results (2026-08-20, branch `tier-a-collections`, local + managed-dev only, not published)

Shipped to managed development (hubs + collections seeded, verifiers + HTML size gates passed):

- Sol's RNG: Auras, Gears, Potions, Biomes (earlier in batch)
- Dead Rails: Classes, Weapons, Items, Entities, Trains, Locations (earlier in batch)
- Dandy's World: Toons, Twisteds, Trinkets (earlier in batch)
- Tower of Hell: Sections (364, empty Modded Sections removed from `sectionOrder` and copy), Mutators (12)
- BedWars: Kits (115), Items (459)
- Steal an Egg: wiki hub + Biomes (9, imageless by design). Universe 10563114921 only; do not mix with the clone `Steal a Egg` 7861158392 used by some existing articles.
- Grow a Chicken Fighter: wiki hub + Eggs (16, imageless by design)
- Anime Origins: wiki hub + Units (46) + Traits (23), hub seeded and both routes verified 2026-08-20

Blocked:

- BlockSpin Weapons (2026-08-20): no named roster on Deltia or fandom
- BlockSpin Vehicles (2026-08-20): one-source fandom names only; crate prices disagree

Publication stays with the owner via `$bloxodes-release-e2e`. Do not seed production from this batch until that explicit release.
