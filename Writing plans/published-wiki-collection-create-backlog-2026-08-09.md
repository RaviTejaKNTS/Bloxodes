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

- [ ] Fishing Gear
- [ ] Enchantments
- [ ] Island Keys

### Clean the Library

Evidence: [full report](../tmp/game-collection-suggestions/clean-the-library.md)

- [ ] Classes
- [ ] Library Maps

### Creatures of Sonaria

Evidence: [full report](../tmp/game-collection-suggestions/creatures-of-sonaria.md)

- [ ] Gachas
- [ ] Game Currencies
- [ ] Shrines
- [ ] NPCs
- [ ] Den Buildables
- [ ] Nest Resources
- [ ] Death Rewards
- [ ] Realms

### Demonology

Evidence: [full report](../tmp/game-collection-suggestions/demonology.md)

- [ ] Ghost Models
- [ ] Skins
- [ ] Challenges
- [ ] Objectives
- [ ] Difficulties
- [ ] Level Unlocks
- [ ] Photo Rewards
- [ ] Fortune Teller Tickets

### Drain the Lake

Evidence: [full report](../tmp/game-collection-suggestions/drain-the-lake.md)

- [ ] Classes
- [ ] Endings

### Dress to Impress

Evidence: [full report](../tmp/game-collection-suggestions/dress-to-impress.md)

- [ ] Materials
- [ ] Patterns
- [ ] Poses
- [ ] Game Modes
- [ ] Style Showdown Challenges
- [ ] Characters

### Driving Empire

Evidence: [full report](../tmp/game-collection-suggestions/driving-empire.md)

- [ ] Vehicle Collections
- [ ] Houses
- [ ] Races
- [ ] Customization Upgrades
- [ ] Locations
- [ ] Jobs
- [ ] Trailers

### Evade

Evidence: [full report](../tmp/game-collection-suggestions/evade.md)

- [ ] Emotes
- [ ] Cosmetics
- [ ] Item Skins
- [ ] Unusuals
- [ ] Carry Animations
- [ ] Nametags
- [ ] Currencies
- [ ] Daily Missions

### Evomon

Evidence: [full report](../tmp/game-collection-suggestions/evomon.md)

- [ ] Equipment
- [ ] Traits
- [ ] Natures
- [ ] Moves

### Fisch

Evidence: [full report](../tmp/game-collection-suggestions/fisch.md)

- [ ] Boats
- [ ] Tools
- [ ] Spears
- [ ] Companions
- [ ] Relics
- [ ] NPCs
- [ ] Titles
- [ ] Lanterns
- [ ] Bobbers
- [ ] Rod Skins

### Fish It

Evidence: [full report](../tmp/game-collection-suggestions/fish-it.md)

- [ ] Quests
- [ ] Artifacts
- [ ] Utility Items
- [ ] Potions
- [ ] Totems
- [ ] Rod Skins
- [ ] Weather

### Fling Things and People

Evidence: [full report](../tmp/game-collection-suggestions/fling-things-and-people.md)

- [ ] Slot Machine Rewards

### Forsaken

Evidence: [full report](../tmp/game-collection-suggestions/forsaken.md)

- [ ] Items
- [ ] Status Effects
- [ ] NPCs
- [ ] Quests

### Gakuran

Evidence: [full report](../tmp/game-collection-suggestions/gakuran.md)

- [ ] Phone Apps
- [ ] Jobs
- [ ] Instruments
- [ ] Songs

### Grow a Garden

Evidence: [full report](../tmp/game-collection-suggestions/grow-a-garden.md)

- [ ] Cosmetics
- [ ] Cosmetic Crates
- [ ] Ascension Upgrades

### Grow a Garden 2

Evidence: [full report](../tmp/game-collection-suggestions/grow-a-garden-2.md)

- [ ] Weather
- [ ] Seed Packs
- [ ] Eggs
- [ ] Pet Mutations
- [ ] NPCs
- [ ] Plot Expansions

### Home Alone

Evidence: [full report](../tmp/game-collection-suggestions/home-alone.md)

- [ ] Chores
- [ ] Items

### Jujutsu Shenanigans

Evidence: [full report](../tmp/game-collection-suggestions/jujutsu-shenanigans.md)

- [ ] Moves

### Kick a Lucky Block

Evidence: [full report](../tmp/game-collection-suggestions/kick-a-lucky-block.md)

- [ ] Kick Styles
- [ ] Rebirth Levels

### LifeTogether RP

Evidence: [full report](../tmp/game-collection-suggestions/lifetogether-rp.md)

- [ ] Locations

### Merge a Nuke

Evidence: [full report](../tmp/game-collection-suggestions/merge-a-nuke.md)

- [ ] Nukes
- [ ] Commanders
- [ ] Mutations
- [ ] Base Upgrades

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

- [ ] Ultimates
- [ ] Ranks
- [ ] Rebirths
- [ ] Achievements
- [ ] Currencies
- [ ] Upgrades
- [ ] Merchants
- [ ] Secret Rooms
- [ ] Random Events
- [ ] Fruits
- [ ] Flags
- [ ] Fishing Rods
- [ ] Shovels
- [ ] Keys
- [ ] Lootboxes

### Practical Basketball

Evidence: [full report](../tmp/game-collection-suggestions/practical-basketball.md)

- [ ] Moves

### Restaurant Tycoon 3

Evidence: [full report](../tmp/game-collection-suggestions/restaurant-tycoon-3.md)

- [ ] Restaurant Templates
- [ ] Franchise Levels
- [ ] Rating Categories
- [ ] Music
- [ ] Objectives

### RIVALS

Evidence: [full report](../tmp/game-collection-suggestions/rivals.md)

- [ ] Gamemodes
- [ ] Ranks
- [ ] Currencies
- [ ] Loot Boxes

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

- [ ] Companions
- [ ] Orchard Mutations
- [ ] Orchard Items
- [ ] Tycoon Upgrades
- [ ] Active Income Methods
- [ ] Ascension Rewards

### Slime RNG

Evidence: [full report](../tmp/game-collection-suggestions/slime-rng.md)

- [ ] Upgrades

### Steal a Brainrot

Evidence: [full report](../tmp/game-collection-suggestions/steal-a-brainrot.md)

- [x] Base Skins
- [x] Recipes

### Storage Hunters: Open World

Evidence: [full report](../tmp/game-collection-suggestions/storage-hunters-open-world.md)

- [ ] Auction Items
- [ ] Mutations
- [ ] Lost Items
- [ ] Vehicles
- [ ] Fishing Items
- [ ] Quests

### Survive Zombie Arena

Evidence: [full report](../tmp/game-collection-suggestions/survive-zombie-arena.md)

- [ ] Artifacts

### The Forge

Evidence: [full report](../tmp/game-collection-suggestions/the-forge.md)

- [ ] Rocks
- [ ] Utility Items
- [ ] Ore Crafting Recipes

### The Strongest Battlegrounds

Evidence: [full report](../tmp/game-collection-suggestions/the-strongest-battlegrounds.md)

- [ ] Emotes
- [ ] Techniques

### Untitled Boxing Game

Evidence: [full report](../tmp/game-collection-suggestions/untitled-boxing-game.md)

- [ ] Maps
- [ ] Ranks

### Violence District

Evidence: [full report](../tmp/game-collection-suggestions/violence-district.md)

- [ ] Maps
- [ ] Emotes
- [ ] Item Skins

### Wizard Alchemy

Evidence: [full report](../tmp/game-collection-suggestions/wizard-alchemy.md)

- [ ] Pets

## No new source-ready collections

- +1 Speed Evolve — existing Animals, Trails, and Auras cover the durable documented systems.
- Catalog Avatar Creator — Commands already exists; other candidates were dynamic, global, thin, or event-specific.
- Clean the Supermarket — Grocery Items and Upgrades need refreshes, but no distinct missing collection passed.
- Murderers vs Sheriffs — Maps and Emotes still lack reliable current row-level evidence; detailed Fandom coverage belongs to a different universe.
- Push Rock for Brainrots — existing Brainrots, Rocks, and Upgrades cover the durable documented systems.
