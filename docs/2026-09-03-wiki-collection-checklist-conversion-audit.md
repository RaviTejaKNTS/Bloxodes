# Wiki collection to checklist conversion audit

Date: 2026-09-03

Scope: Roblox wiki collections, with the existing GTA Letter Scraps implementation used as the comparison point.

Status: audit completed 2026-09-03; the approved managed-development conversion was completed 2026-09-04. Production remains unchanged.

## Implementation status (verified 2026-09-04)

After approval, all 19 collections listed in the three waves below were switched to `page_type = checklist` in managed development. The existing published dataset revisions, collection URLs, row counts, and dataset pointers were preserved; no item rows or production content were rewritten.

- 19/19 target pages are published and report `page_type = checklist`.
- The converted pages contain 1,134 tracked items in total.
- All 19 page updates produced `wiki_collection` revalidation events.
- All 19 base routes returned HTTP 200 with checklist UI, while every `/page/2` continuation returned HTTP 404.
- The HTML-size gate passed all 19 routes under the 1.8 MB hard limit. Fish It is the only warning, at roughly 1.077 MB.
- The route now dispatches any database-backed checklist through the shared checklist renderer before the legacy Grow a Garden and The Forge special branches. Metadata likewise avoids the local special-game loader for checklist pages. See [the collection route](../apps/web/src/app/(site)/wiki/[slug]/[collection]/page.tsx).

This was intentionally a page-type conversion, not a content rewrite. The source, image, and scope caveats in the wave notes remain editorial follow-up items. The production database still needs the page-type schema release before these managed-development settings can be promoted.

## Executive recommendation

Checklist mode should be reserved for a finite set of player-completable goals where each row can honestly be answered with “done” or “not done.” It is not a general display style for every collection page.

The inventory and source review produced 19 candidate projects:

- 6 first-wave conversions with strong checklist semantics.
- 4 second-wave conversions that need cleanup, enrichment, or a small source/media pass.
- 9 future checklist or derivative-index projects that should not be flipped as-is.
- The remaining collections should stay database/reference pages.

The first wave I recommend is:

1. 1 Speed Monkey Escape Sunken Shards
2. Catch and Tame Island Keys
3. Grow a Garden Plot Expansions
4. Forsaken Milestones
5. Anime Expeditions Achievements
6. Jujutsu Shenanigans Achievements

The second wave is Storage Hunters Open World Lost Items, Sell Lemons Secret Unlocks, a cleaned Brookhaven secrets dataset, and Grow a Garden 2 Plot Expansions.

The GTA precedent is important: Letter Scraps is a finite, location-based Story Mode hunt with one checkbox per collectible, stable route evidence, and a meaningful completion goal. The Roblox candidates above qualify for the same reason. Large pet, fish, aura, crop, weapon, or unit pages generally do not qualify merely because the player can own or encounter the listed things; those pages are still primarily comparison and reference databases.

## 1. What a checklist collection is in this codebase

The current implementation is a page-type switch over the existing wiki collection model, not a new collection product:

- The page still belongs to wiki_collection_pages and still points at a published wiki_collection_datasets revision.
- The collection code, URL, item rows, sections, sort order, card fields, and media model remain the same.
- page_type is the semantic switch. The supported values are database and checklist.
- Database pages retain the paginated reference view.
- Checklist pages use the shared CollectionChecklist renderer. It shows a single progress total, per-item checkboxes, search, all/not-found/found filtering, section filtering, and reset controls.
- Progress is local-first, with optional account synchronization through the existing checklist progress endpoint.
- Checklist pages do not use the database page pagination model. The canonical checklist route is the base collection route, and /page/2 should not be treated as a valid continuation.
- The renderer has a 2,000 checked-ID safety limit, but that is a technical ceiling, not a recommendation to create 500-card checklists. The interaction becomes less useful well before that point.

The relevant implementation and operating notes are in the [wiki collections pipeline documentation](../dev-docs/pipelines/wiki-collections.md), the [shared checklist renderer](../apps/web/src/components/collection/CollectionChecklist.tsx), and the [page-type migration](../supabase/migrations/20260920000022_add_wiki_collection_page_types.sql).

The GTA implementation establishes the editorial bar. The [GTA 5 collection roadmap](./2026-09-02-gta-5-wiki-collection-roadmap.md) records Letter Scraps as a 50-location Story Mode checklist with complete media coverage and browser QA. The other GTA collection pages remain database pages because they are reference rosters or progression databases, even though some of them contain things a player can eventually complete.

### Checklist qualification test

A collection should be converted only when all of the following are true:

1. Each row is an atomic player goal, not merely a reference entry.
2. The goal is finite and does not reset on a daily, weekly, cooldown, round, or seasonal cycle.
3. Completion persists for the relevant scope, or the page explicitly explains the scope, such as per-character progress.
4. A player can recognize what “done” means without opening several unrelated guides.
5. The row has a stable identity and a reliable source-backed name.
6. The complete set can be enumerated with reasonable confidence.
7. The page has useful completion context: location, route, requirement, reward, level, or a concise achievement description.
8. The interaction cost is appropriate for the count. A 6–76 item checklist is naturally usable; a 200–400 item index needs a deliberate index design and data/media preflight.

The following are disqualifiers or strong warnings:

- Repeatable farming targets, respawning chests, random objectives, rebirth loops, or cooldown missions.
- Rows that are merely prices, rarity tiers, stats, effects, or loot-table entries.
- A mixed page where some rows are permanent goals and others are consumable or repeatable. Split it instead of forcing one page type over all rows.
- A roster whose count changes rapidly or conflicts between the in-game index and available source material.
- A page whose current rows lack stable descriptions or route evidence.

## 2. Current inventory and operational state

The managed-development database contains 664 published Roblox collection pages. Every inspected Roblox page is still marked database. Production has 663 published Roblox collection pages, but the production database currently does not expose the page_type column; the page-type migration exists in the repository but has not yet been promoted to production. This means a future production conversion requires the normal schema release before any production page flip.

The audit reviewed the complete collection inventory, then sampled the rows, sections, fields, source manifests, image coverage, and public route semantics of every plausible checklist-shaped family. The result is intentionally conservative: a collection appears in the candidate queue only when there is a durable player-completion use case and a source-backed path to a clean finite set.

The counts below are current managed-development item counts at the time of the audit. They are planning counts, not a promise that the final checklist roster cannot change after a fresh research pass.

## 3. Recommended conversion queue

### Wave 1: convert first after the normal research and publishing gates

| Existing collection | Items | Recommendation | Checklist unit |
| --- | ---: | --- | --- |
| 1-speed-monkey-escape-sunken-shards | 9 | Direct conversion candidate | One checkbox per Sunken Shard |
| catch-and-tame-island-keys | 6 | Direct conversion candidate | One checkbox per permanent island key |
| grow-a-garden-plot-expansions | 4 | Direct conversion candidate | One checkbox per permanent plot expansion |
| forsaken-milestones | 76 | Direct conversion candidate with per-character labeling | One checkbox per character milestone reward |
| anime-expeditions-achievements | 20 | Direct conversion candidate | One checkbox per permanent achievement |
| jujutsu-shenanigans-achievements | 74 | Direct conversion candidate after excluding rotating content | One checkbox per permanent achievement |

#### 1 Speed Monkey Escape Sunken Shards

This is the clearest Roblox equivalent to GTA Letter Scraps. The current nine rows already contain stage or area, landmark, route instruction, movement requirement, hazard, and checkpoint context. The external [All 9 Sunken Shards guide](https://allthings.how/1-speed-monkey-escape-how-to-get-all-9-sunken-shards/) confirms a fixed nine-shard set, split between the lobby and stages, and explains that collecting all nine unlocks the x2 Speed Treadmill.

Recommended action: keep the existing collection code and dataset identity, enrich or verify row media, set page_type to checklist in the authoring and published page records, and verify the count and reward copy. This should be the first Roblox conversion because it has a small count, an obvious route, a completion reward, and already-structured row-level guidance.

#### Catch and Tame Island Keys

The six current rows are permanent route gates: Yeti, Underwater, Volcano, Cave, Sky, and Fishing keys. Each row already has an image, a summary, a requirement, and an access or reward explanation. The source route confirms that the keys open distinct areas or gates, including the Dragon Island requirement to place six Legendary Eggs and the Forgotten Depths underwater route; see the [Catch and Tame location guide](https://www.catchandtamewiki.com/locations?search=The+Abyss).

Recommended action: convert the six key rows. Phrase the Cave Key as “obtain and use the Cave Key” rather than “farm the chest,” because the chest reward can be repeatable even though the key route is a one-time progression gate. Keep any cooldown or chest-farming information in the card description, not in the completion semantics.

#### Grow a Garden Plot Expansions

The four rows are permanent plot upgrades: right, left, and two rear expansions. The current data already includes costs, card summaries, and the rear wait requirements. Public guides describe the same finite expansion system, including the 250M side expansions, the 500M and 1B rear expansions, and the total cost; see the [Grow a Garden expansion guide](https://beebom.com/how-to-expand-plot-in-grow-a-garden-roblox/amp/) and the current [Bloxodes plot-expansions page](https://bloxodes.com/wiki/grow-a-garden/plot-expansions).

Recommended action: convert after adding explicit prerequisite and wait-time fields to the row content. Explain that the side expansions can be purchased in either order while the rear expansions have dependencies and timers. Images are optional for this upgrade checklist, but the cards must make purchase order and waiting requirements clear.

#### Forsaken Milestones

The 76 rows are a finite per-character reward track: Survivor milestones and Killer milestones, with Milestone I–IV at levels 25, 50, 75, and 100. The [Forsaken milestone reference](https://forsakens.wiki/milestones/) confirms the level thresholds and character-specific reward skins.

Recommended action: convert with the character and role in every card title or section label. The completion total should be understood as 76 tracked milestones, while the prose should explain that progress is earned separately for each character. Do not combine these rows with general account levels or rotating quests. Before release, verify the current character roster and reward names because character updates can add or rename milestone rows.

#### Anime Expeditions Achievements

The current 20 rows are grouped into five achievement categories and already include requirements, rewards, category completion, and card summaries. The [Anime Expeditions achievements guide](https://techwiser.com/anime-expeditions-achievements/) describes achievements as permanent milestones with reward-bearing Collector, Summoner, Expeditions, Story, and related categories.

Recommended action: convert as a compact achievement checklist. Keep category-completion rewards as explanatory text on the relevant category or achievement card, but do not create a second checkbox for the category reward unless the game treats that reward as a separate claimable objective. Verify the eight existing images and decide whether achievement cards need more media; this page can remain useful without character art if the requirement and reward text are complete.

#### Jujutsu Shenanigans Achievements

The current 74 rows are achievement-like requirements across general, mode, stats, and character challenge sections. The public [Jujutsu Shenanigans achievements reference](https://jujutsushenaniganswiki.com/wiki/achievements/) distinguishes permanent achievements from the separate daily and weekly quest systems. The current Bloxodes page also treats the 74-row set as permanent achievement content.

Recommended action: convert the permanent achievement rows, but explicitly exclude daily, weekly, event-limited, and hidden tasks whose availability is not stable. Add a concise card summary and a source-backed reward or title field where available. Because the current rows have no image coverage and no card summaries in the inspected dataset, treat those as a content-quality gate rather than silently publishing a bare checkbox list.

### Wave 2: convert after cleanup or enrichment

| Existing collection | Items | Recommendation | Required preparation |
| --- | ---: | --- | --- |
| storage-hunters-open-world-lost-items | 29 | Convert after row enrichment | Add exact locations, route steps, key dependency, and canonical names |
| sell-lemons-secret-unlocks | 3 | Convert after route clarification | Represent the permanent secret chain and its intermediate steps clearly |
| brookhaven-rp-secrets | 15 | Selective conversion or cleaned replacement | Remove duplicates, trivia, and non-secret rows; verify the current map |
| grow-a-garden-2-plot-expansions | 6 | Convert after source and media pass | Lock costs, order, dependencies, and reliable source coverage |

#### Storage Hunters Open World Lost Items

This is a strong one-time map collectible set. [Pro Game Guides lists all 29 lost-item locations](https://progameguides.com/roblox/all-lost-items-locations-in-storage-hunters-open-world/) and describes the Collection Book rewards at five, 15, and 29 items. The independent [Storage Hunters item route](https://www.storagehuntersopenworldwiki.wiki/items/storage-hunters-open-world-lost-item-locations) also groups the 29 items by area and calls out the key and Scythe route.

The current 29 rows have complete image coverage, but the inspected item fields are mostly generic area, value, and rarity data rather than route instructions. That is the opposite of what a location checklist needs.

Recommended action: enrich the existing rows with canonical item names, exact landmark, route instruction, prerequisite, and collection reward context, then convert. Preserve the Key-to-Scythe dependency in the card content. Because fan sources disagree on some item naming, reconcile names against the strongest current route source before creating stable item slugs.

#### Sell Lemons Secret Unlocks

The three current rows are Sewer Key, UFO Key, and Purity Fruit. External guides describe the Sewer Key and UFO Key as permanent secrets or progression unlocks; see [All Things How’s Sewer Key and UFO Key guide](https://allthings.how/sell-lemons-sewer-key-and-ufo-key-locations-roblox/) and the [Sell Lemons sewer guide](https://selllemonswiki.wiki/guides/sewer-guide/).

Recommended action: make this a short “permanent secret unlocks” checklist, but do not let the three row names hide the route chain. Add the sewer maze or lever sequence, Good Samaritan prerequisite, and the fact that Purity Fruit may involve a repeatable endgame loop before its final reward. If the route has several separately completable one-time gates, a new cleaned checklist dataset may be more honest than treating each top-level reward as a fully self-contained row.

#### Brookhaven RP Secrets

The current 15-row dataset is checklist-shaped only after editorial cleanup. It includes genuine hidden rooms and Easter eggs, but also duplicate access routes, non-secret trivia or landmark entries, and rows such as “Accessory Noise” that are not a durable location goal. Brookhaven’s map and hidden areas are frequently changed, so the [Brookhaven player guide](https://www.brookhaven-rp.com/Player-Guides/Finding-Hidden-Secrets.html) should be treated as supporting evidence rather than a permanent roster contract.

Recommended action: do not flip the current 15-row page. Build a cleaned subset with one row per distinct discoverable secret, remove duplicate routes, and re-verify every location in the live game. Use a new collection code if the cleaned scope no longer matches the existing page’s identity.

#### Grow a Garden 2 Plot Expansions

The six rows are all permanent expansion purchases and are semantically suitable for checklist mode. The current dataset has costs and summaries but no inspected image coverage and weaker source coverage than the original Grow a Garden page.

Recommended action: convert after confirming the game’s current expansion order, costs, prerequisites, and any wait timers from a current source or in-game verification. Keep the six expansion rows separate from crop, pet, or economy reference pages.

### Wave 3: worthwhile future projects, but do not flip the current page as-is

These collections have a plausible checklist use case, but their current dataset, size, scope, or source state is not ready for a direct page-type change.

| Existing collection | Items | Future checklist shape | Why it is not a direct flip |
| --- | ---: | --- | --- |
| pet-simulator-99-shiny-relics | 200 | Shiny Relic index checklist | Fixed collectible semantics, but 200 cards, no images, and source-count drift |
| fish-it-fish | 283 | Fish Index checklist | The game community already uses a checklist, but the page is large, dynamic, and only 154 rows currently have images |
| anime-vanguards-achievements | 148 | Permanent achievement checklist | Strong semantics, but reward text is unstructured, no images, and updates add rows |
| blox-fruits-quest-items | 19 | New one-time puzzles and access checklist | Mixed one-time keys with consumable, repeatable, or chance-based items |
| 1-speed-keyboard-escape-stages | 17 | Clearable stage route checklist | Stage count and world scope are changing or inconsistent across sources |
| build-a-ring-farm-skill-tree | 20 | One-time skill-tree objective checklist | Finite-looking rows, but current source proof and row descriptions are insufficient |
| catch-and-tame-pets | 84 | Separate stable pet collection index | Strong player need, but current Bloxodes scope does not match the 255-pet external checklist |
| bee-swarm-simulator-bees | 46 | Bee index or gifted-bee checklist | The 46 base types are stable, but normal, gifted, event, and amulet goals need separate semantics |
| evomon-monsters | 75 | Dex completion checklist | External sources disagree between 75 catalogued monsters and a 108-slot dex with unrevealed entries |

#### Pet Simulator 99 Shiny Relics

Shiny Relics are a legitimate collectible: [Pro Game Guides describes the paw-shaped relics, their permanent collection behavior, and the shiny-odds bonus every five relics](https://progameguides.com/roblox/pet-simulator-99-all-shiny-relic-locations/). However, the guide title and list currently describe 173 while Bloxodes has 200 rows. The current Bloxodes rows have location hints and summaries but no images.

Recommended action: keep the existing page as a database until the canonical 200-row roster is reconciled and the media plan is complete. Then consider a dedicated checklist presentation or a separate “Shiny Relic index” dataset. The absence of a special full-set reward is not a blocker, but the page should explain the incremental shiny-odds reward and not imply a single final completion reward.

#### Fish It Fish

This is the strongest large-index candidate because the community already has a dedicated [Fish It Master Index Checklist](https://fishit-wiki.com/checklist/) with saved progress and location sections. The related [Fish It fish database](https://fishit-wiki.com/fish/) describes a 250-plus fish index and is regularly updated.

Recommended action: do not change the current 283-row database page directly. First lock the Bloxodes roster and decide whether the checklist tracks species, variants, or index entries. Then perform a size, search, section, media, and mobile review. The existing 154-of-283 image coverage is not enough for a visually useful index if every card is expected to show an image.

#### Anime Vanguards Achievements

The current 148 rows match a permanent achievement system with Story, Raid, Boss Rush, Collector, Unit, and related categories. The [Anime Vanguards achievement reference](https://animevanguards.fandom.com/wiki/Achievements) describes category rewards and milestone requirements.

Recommended action: normalize the reward field, separate category completion rewards from leaf achievements, remove obsolete rows, and establish an update process before converting. The current page has no images and a large card count. A checklist can work, but it should be a deliberate achievement index rather than an unstructured 148-row dump.

#### Blox Fruits Quest Items

The 19-row page is mixed. The likely one-time puzzle or access goals include Torch, Cup, Ancient Relic, Key, Library Key, Water Key, Hidden Key, Holy Torch, Core Brain, Hellfire Torch, and Red Key. Fist of Darkness, God’s Chalice, Sweet Chalice, Hallow Essence, Fire Essence, and raid microchips are consumable, chance-based, or repeatable route items.

The [Blox Fruits puzzles reference](https://bloxfruitswiki.org/wiki/puzzles/) describes puzzles as multi-step unlocks for powerful items or mechanics, and the [Saber puzzle guide](https://bloxfruitswiki.org/wiki/saber/puzzle/) explicitly treats progress as a saved multi-step route.

Recommended action: keep quest-items as a database and create a new, split “puzzles and permanent unlocks” checklist only after each item’s one-time persistence is verified. Do not turn raid chips, summon items, or chance drops into permanent checkboxes.

#### 1 Speed Keyboard Escape Stages

Stages are clearable goals, but the current 17-row page has World 1 and World 2 entries while external guides describe different counts. [Nerds Chalk reports 15 World 1 stages](https://nerdschalk.com/how-to-beat-all-15-world-1-stages-in-1-speed-keyboard-escape/), while [TechWiser describes an expanding multi-world stage structure](https://techwiser.com/1-speed-keyboard-escape-stages/).

Recommended action: wait until the world and stage contract is locked. If the game records permanent clear progress, create a checklist by world; if stages are primarily replayable obstacle-course reference, retain the database view.

#### Build a Ring Farm Skill Tree

The 20 rows look like finite objective and reward nodes, which could support a “complete your skill tree” checklist. However, the current rows do not yet provide enough source-backed explanation or consistent card context to tell whether each row is a one-time unlock, a threshold, or an upgrade-planning entry.

Recommended action: research the in-game tree, distinguish leaf objectives from level thresholds, and only then decide whether to convert the existing page or create a goal-oriented derivative.

#### Catch and Tame Pets

The external [Catch and Tame collection checklist](https://www.catchandtamewiki.com/tools/collection-checklist) explicitly tracks collected pets and active targets, with browser-saved progress and filters, and currently shows 255 visible entries. The official [Roblox game listing](https://www.roblox.com/games/96645548064314/Catch-And-Tame) also frames the game around building a collection.

Recommended action: this is a good future checklist opportunity, but not a direct flip of the current 84-row Bloxodes pets database. First define whether Bloxodes covers standard pets only or also event, exclusive, breed-only, and target variants. Keep the current database for rarity, location, and income comparison; create a separate normalized index if the full collection scope is approved.

#### Bee Swarm Simulator Bees

There is a strong underlying collection concept: community references describe 46 discoverable bee types and distinguish normal, gifted, and event bees; see [the Bee Swarm bee reference](https://bee-swarm-simulator.fandom.com/wiki/Bees). The current Bloxodes page, however, is a stats, abilities, and obtainment database.

Recommended action: do not flip the current page. A future design could use one checklist for the 46 base bee types and a separate gifted-bee goal, because gifted discovery and Supreme Star Amulet progress are not the same completion unit. Event bees also need an explicit permanent-ownership rule.

#### Evomon Monsters

The game’s collection index is promising, but public sources do not agree on its current scope: [Evomon’s public dex](https://evomon.app/dex) describes 108 slots with 76 revealed, while [another Evomon catalog](https://evomon.org/monster-wiki/) presents 75 catalogued monsters. The current Bloxodes collection has 75 rows.

Recommended action: retain the database until the exact in-game dex contract is resolved. A future checklist should represent only stable discovered entries or explicitly label unrevealed slots; it should not imply that a 75-row page is the complete game dex if the game exposes 108 slots.

## 4. Collections that should remain database pages

The following groups were checked as likely candidates and should remain database pages under the current evidence. Some may later produce a separate checklist dataset, but their existing pages should not be relabeled.

### Repeatable, resetting, or farming content

- 99-nights-in-the-forest-tameable-animals: animals are tamed during a run, are affected by random map availability, and are not a persistent account collection. [PC Gamer’s guide](https://www.pcgamer.com/games/roblox/99-nights-in-the-forest-animal-taming/) also notes that not all animals appear in every match.
- demonology-photo-rewards: photo subjects and payout tiers are farmable/repeatable.
- demonology-objectives: objectives include every-job or optional random work rather than a fixed one-time set.
- home-alone-anomalies and home-alone-chores: round-based or repeatable tasks.
- restaurant-tycoon-3-objectives: rows explicitly scale up through repeated actions such as collecting dishes or earning cash from tables.
- restaurant-tycoon-3-milestones: repeated-action tracks with multiple levels, not independent one-time goals.
- adopt-me-star-rewards: daily/login-style reward progression.
- creatures-of-sonaria-mission-creature-unlocks: missions reset on cooldown or daily/weekly schedules; the [Mission System reference](https://creatures-of-sonaria-official.fandom.com/wiki/Mission_System) documents those reset rules.
- creatures-of-sonaria-tokens: token availability mixes exploration, event, shop, gacha, and seasonal behavior.
- wizard-alchemy-chests: the [chest location guide](https://games.gg/roblox/guides/wizard-alchemy-all-chest-locations/) describes hourly respawns, so this is a farming route.
- rebirth, ascension, and similar loop pages, including slime-rng-rebirths, kick-a-lucky-block-rebirth-levels, and grow-a-garden-ascension-upgrades: these are repeatable or tiered progression systems.

### Reference, comparison, or loot-table collections

- Adopt Me pets, accessories, toys, furniture, and related large catalogs.
- Pet Simulator 99 pets, areas, keys, and other comparison-first pages, except the separate Shiny Relic opportunity described above.
- Creatures of Sonaria creatures, tokens, and shrine/reference pages.
- Grow a Garden crops, pets, cosmetics, and mutation/economy tables.
- Brainrot catalogs such as steal-a-brainrot-brainrots, catch-a-brainrot-brainrots, kick-a-lucky-block-brainrots, and steal-an-egg-pets.
- Anime unit, evolution, and map/stat catalogs, except the achievement pages that have a distinct one-time goal system.
- Fisch fish and Sols RNG auras until their index scope and update cadence are stable enough for a deliberate large-index checklist.
- lineage-piece-artifacts: these are multi-slot gear sets and trial bonuses, not one checkbox per collectible artifact.
- practical-basketball-badges: the rows describe gameplay badge/perk effects and use cases, not a permanent achievement list.
- kick-a-lucky-block-zones: zone order, earnings, rarity, and mutation data are reference/progression information, not completed goals.
- build-a-boat-for-treasure-chests: chest tiers and loot pools are not fixed map collectibles.

### Mixed or incomplete pages that need a split

- blox-fruits-quest-items: split permanent puzzle/access goals from consumable or repeatable items before any checklist work.
- the-forge-quests: separate stable one-time main and side quests from repeatable, event, or TBD entries.
- brookhaven-rp-secrets: clean duplicate routes, trivia, and map-dependent rows before a selective conversion.
- storage-hunters-open-world-achievements: cumulative auction milestones can be tracked as progression counters, but they are not equivalent to the finite Lost Items map checklist.
- pet-simulator-99-achievements: achievement slots cycle through harder tiers; a row is not a single final completion state. The [PS99 achievement reference](https://pet-simulator.fandom.com/wiki/Achievements_%28Pet_Simulator_99%29) documents the tiered behavior.

## 5. Recommended conversion method

This is the future content and release workflow; it is not an instruction to make those changes as part of this research task.

### Step 1: approve the exact checklist scope

For each candidate, create a focused research brief with:

- the player goal and completion scope;
- the exact leaf-row roster;
- rows intentionally excluded;
- source evidence for permanence, location, requirement, reward, and count;
- a source conflict log;
- the required fields and media plan.

For mixed collections, decide whether to clean the current page or create a new derivative collection. A direct flip is appropriate only when the existing page identity already matches the finite goal.

### Step 2: normalize each row as a goal

Every row should have:

- a stable item slug;
- a clear goal-oriented name;
- a section that helps the player navigate;
- a one-sentence completion definition;
- requirement or prerequisite;
- location or route context when relevant;
- reward or reason to complete when relevant;
- source-backed notes and optional image.

For achievements and milestones, the completion definition should be the requirement itself. For map collections, it should say what the player must find, obtain, activate, or use. For upgrades, it should say what permanent purchase or unlock is being completed.

### Step 3: run a separate media pass where the page is visual

GTA Letter Scraps is the quality reference for location-heavy collections: one useful image per row, not decorative filler. Storage Hunters, Sunken Shards, Brookhaven secrets, and any future puzzle/location checklist should receive the same treatment. Achievement and upgrade checklists can use fewer images if their card text is complete and the page is still easy to scan.

### Step 4: publish the dataset and page type in managed development

The existing immutable dataset workflow should be used:

1. Create or revise the dataset revision in managed development.
2. Verify item count, stable slugs, sections, card fields, source coverage, and image mappings.
3. Set page_type to checklist in the page authoring payload and runtime manifest.
4. Keep the existing collection code and URL for direct flips; use a new code for a genuinely new split or derivative index.

No new checklist table is required by the current design. The checklist page reuses the collection dataset and the existing progress namespace.

### Step 5: verify the public behavior

Before approving a conversion, verify:

- every row can be checked and unchecked;
- progress totals match the published item count;
- search and section filters expose all rows;
- found/not-found and reset behavior works;
- local progress survives reload;
- signed-in progress syncs and does not overwrite local progress incorrectly;
- item images and card fields are useful;
- database pagination is not still linked from a checklist route;
- /page/2 returns the intended not-found behavior;
- metadata, canonical URL, JSON-LD, sitemap, search, feed, and revalidation behavior remain correct.

### Step 6: handle production schema and release gates

As of this audit, production does not yet have page_type available even though managed development does. The page-type migration must therefore be promoted through the normal database release process before production page conversions. Production content should only be changed after managed-development readback and browser QA pass; this audit did not apply that migration or publish any page.

## 6. Final decision list

### Convert first

- 1-speed-monkey-escape-sunken-shards
- catch-and-tame-island-keys
- grow-a-garden-plot-expansions
- forsaken-milestones
- anime-expeditions-achievements
- jujutsu-shenanigans-achievements

### Convert after cleanup or enrichment

- storage-hunters-open-world-lost-items
- sell-lemons-secret-unlocks
- brookhaven-rp-secrets, but only as a cleaned distinct-secret set
- grow-a-garden-2-plot-expansions

### Research as future checklist or derivative index

- pet-simulator-99-shiny-relics
- fish-it-fish
- anime-vanguards-achievements
- blox-fruits-quest-items, after splitting permanent puzzles and access goals
- 1-speed-keyboard-escape-stages
- build-a-ring-farm-skill-tree
- catch-and-tame-pets
- bee-swarm-simulator-bees
- evomon-monsters

### Keep as database pages for now

All other existing Roblox collections, especially repeatable objectives, rotating missions, rebirth or ascension systems, chest farming routes, economy/stat tables, tiered reward tracks, and large dynamic rosters.

The key editorial decision is to convert the player’s durable completion goal, not the broadest available list. That preserves the database role of existing collections while adding checklists where progress tracking genuinely helps.
