# Red Dead franchise coverage plan

Last verified: 2026-09-07

Status: scope approved; the first-release managed-development implementation is complete. The Red Dead schema, route/read layer, reusable franchise workflows, five title hubs, and seven approved collection revisions are prepared and verified in managed development. Production release remains a separate approval gate.

## Executive recommendation

Bloxodes should cover Red Dead as one franchise namespace with five durable editorial scopes:

1. **Red Dead Revolver** — the 2004 linear predecessor.
2. **Red Dead Redemption** — the 2010 game, with Story Mode as the primary scope.
3. **Undead Nightmare** — a first-class expansion/content scope attached to Red Dead Redemption, not merely a collection inside it.
4. **Red Dead Redemption 2** — Story Mode as its own scope.
5. **Red Dead Online** — a separate online/live-service scope related to RDR2, not mixed into its Story Mode hub.

The recommended URL family is:

```text
/red-dead
/red-dead/wiki
/red-dead/wiki/<game-slug>
/red-dead/wiki/<game-slug>/<collection-slug>
/red-dead/wiki/<game-slug>/<collection-slug>/page/<page>
```

Wiki collections use `database` for reference rosters and `collectible` for collectible sets with progress tracking. Cross-system completion trackers such as 100% Completion belong to the separate checklist family and are deferred. Publish only the five hubs and six collections listed in the snapshot below.

The first release should prioritize RDR2 Story Mode, then RDR1 Story Mode, then Undead Nightmare. Revolver is a compact, well-bounded follow-up. Red Dead Online should be deliberately last because its role, reward, event, and collectible surfaces require an explicit maintenance policy.

## Evidence boundary and current Bloxodes coverage

### What was checked locally

The current Bloxodes architecture and route inventory were checked in:

- [wiki and collection pipeline](/home/teja/projects/Bloxodes/dev-docs/pipelines/wiki-collections.md)
- [site route guidance](</home/teja/projects/Bloxodes/apps/web/src/app/(site)/AGENTS.md>)
- [shared-library guidance](/home/teja/projects/Bloxodes/apps/web/src/lib/AGENTS.md)
- [GTA route/data read layer](/home/teja/projects/Bloxodes/apps/web/src/lib/gta.ts)
- [GTA coverage rollout status](/home/teja/projects/Bloxodes/docs/2026-09-04-gta-coverage-rollout-status.md)

The committed repository inventory has no tracked Red Dead content records or route files. However, the current working tree already contains an uncommitted/untracked Red Dead implementation scaffold, including:

- [Red Dead landing route](</home/teja/projects/Bloxodes/apps/web/src/app/(site)/red-dead/page.tsx>), [wiki index](</home/teja/projects/Bloxodes/apps/web/src/app/(site)/red-dead/wiki/page.tsx>), game hub, collection, and database-pagination route files.
- [Red Dead server read layer](</home/teja/projects/Bloxodes/apps/web/src/lib/red-dead.ts>) and Red Dead-specific collection components.
- [Red Dead schema migration](</home/teja/projects/Bloxodes/supabase/migrations/20260920000023_create_red_dead_content_platform.sql>) containing the proposed game/wiki/collection dataset family and progress table.

The schema and route/read-layer scaffold has since been applied and verified in managed development. The five approved title hubs and first-release collection revisions are seeded there through the separate immutable-runtime workflow. Production remains intentionally untouched, so the namespace is not yet a production release.

### First-release managed-development snapshot

- Five published title hubs are present: Red Dead Revolver, Red Dead Redemption, Undead Nightmare, Red Dead Redemption 2, and Red Dead Online. Undead Nightmare is linked as an expansion child of Red Dead Redemption; Red Dead Online is a separate online child scope related to Red Dead Redemption 2.
- Six collections are published (four databases and two collectible sets): Red Dead Online Roles (5 rows), Red Dead Redemption Story Missions (57), Red Dead Revolver Story Missions (27), Undead Nightmare Story Missions (8), RDR2 Dinosaur Bones (30), and RDR2 Cigarette Cards (144). The two collectible sets were mistakenly unpublished based on their checklist renderer and now use the collectible renderer with progress tracking. Only RDR2 100% Completion (241 rows) remains unpublished for future checklist work; its dataset is retained.
- All five title hubs now have separate Bloxodes-hosted artwork roles in managed development: a 1600x900 `cover_image` for landing/wiki cards and metadata, plus a 720x720 `hero_image` for the square artwork beside each wiki title. `sync:franchise-wiki-media --namespace red-dead` owns the source check, optimization, R2 upload, and managed-development pointer update.
- The text-only collections keep `items[].system.image` null because the available exact third-party candidates did not clear reuse rights. Candidate files remain local authoring material for future rights review and were not uploaded or hotlinked at runtime.
- The current bundle is the approved first release, not the end of the franchise roadmap. Survivor Side-Missions, RDR2 weapons/animals/outfits, RDR1 collectibles, Revolver systems, and durable Red Dead Online databases remain documented as follow-up opportunities below.

Existing committed coverage is currently split between:

- Roblox: `/wiki/<game-slug>` and `/wiki/<game-slug>/<collection-slug>`, backed by the Roblox wiki tables.
- GTA: `/gta`, `/gta/wiki`, `/gta/wiki/<game-slug>`, and `/gta/wiki/<game-slug>/<collection-slug>`, backed by separate `gta_*` tables but shared collection rendering patterns.

The public Roblox wiki index was also checked during the audit and did not list Red Dead. Production Red Dead routes remain unpopulated until an explicit release, while the managed-development preview is the verification environment for this implementation.

### Architectural implication

Red Dead uses a sibling namespace, not a GTA game row and not a Roblox universe row. The existing GTA implementation is the closest model because it already supports non-Roblox games, isolated data ownership, database/collectible collections, pagination, search, sitemap, and collection progress without forcing a Roblox universe ID. The Red Dead implementation now follows that pattern and is usable in managed development; collection content and release gates still apply.

The target contract is a Red Dead-specific table family, already sketched by the uncommitted migration, with one shared family across all Red Dead titles rather than one table per title:

```text
red_dead_games
red_dead_wiki_pages
red_dead_wiki_collection_pages
red_dead_wiki_collection_datasets
red_dead_wiki_collection_items
```

The tables should preserve the GTA content contract: a game-to-hub relationship, one collection-page record per game/collection, immutable dataset revisions, item rows, a published dataset pointer, a stable collection code in `<game-slug>-<collection-slug>` form, and `page_type` on the collection page. The implementation also includes a Red Dead-specific progress table/API namespace. It does not reuse either `user_checklist_progress` or `user_gta_collection_progress`.

Recommended content metadata, if the future schema supports it:

- `content_kind`: `game`, `expansion`, or `online`.
- `parent_game_id`: for Undead Nightmare and Red Dead Online relationships.
- `mode_scope`: `story`, `online`, `legacy-multiplayer`, or `mixed`.
- `edition_scope`: base game, GOTY/bonus content, modern port, or cross-edition.
- `collection_group`: `game-data`, `collectibles`, `completion`, or `online`.

The last two fields are editorial safeguards. They prevent a modern port, a bonus outfit, a legacy multiplayer activity, or a live-service rotation from being silently presented as part of the wrong base roster.

## Durable title roster

| Game/content slug | Hub decision | Editorial identity | Boundary to enforce |
| --- | --- | --- | --- |
| `red-dead-revolver` | Create | Standalone 2004 Rockstar San Diego western game; the franchise predecessor. | Linear mission, Bounty Hunter, journal, Showdown, shop, and unlock systems. Do not model it like an open-world checklist. |
| `red-dead-redemption` | Create | 2010 Red Dead Redemption; default hub scope is single-player Story Mode. | Keep its original/legacy multiplayer separate from the modern port package, which Rockstar says has no multiplayer. |
| `undead-nightmare` | Create as a first-class child hub | Undead Nightmare is a substantial supernatural story expansion/content scope for RDR. | Separate from the ordinary RDR campaign. Its standalone disc/menu identity and completion counts should not be folded into RDR Story Mode. |
| `red-dead-redemption-2` | Create | 2018 Red Dead Redemption 2 Story Mode. | Do not include Red Dead Online role, rank, economy, or rotating content in this hub. |
| `red-dead-online` | Create as a separate online hub | Standalone-accessible online product launched in 2020 and also related to RDR2. | Treat roles/ranks as durable systems; treat events, bonuses, passes, rotating Collector locations, and limited rewards as maintenance-heavy or article content. |

### Why the expansion gets its own hub

Rockstar’s current Red Dead Redemption product presents Red Dead Redemption and Undead Nightmare together as complete single-player experiences, but Rockstar support still treats the two campaigns as separate main-menu choices. The original Undead Nightmare material also describes a distinct supernatural campaign, survivors, towns, and undead-specific progression. A child hub gives players a clean route and lets Bloxodes label the boundary without duplicating every modern port or selling-package entry.

### Why ports and editions do not get duplicate hubs

Rockstar and Take-Two describe the modern RDR release as a package containing the RDR and Undead Nightmare single-player experiences. The current package spans modern consoles, PC, mobile/Netflix availability, and backwards-compatible platforms, while the original 2010 release had online multiplayer. These are release/edition facts, not five different editorial games. Use edition/platform metadata, source notes, and row-level exclusions where needed; do not create separate hubs for PS3, Xbox 360, PS4, Switch, PC, mobile, GOTY, or Switch 2.

### Red Dead Online is not RDR2 Story Mode

Rockstar describes Red Dead Online as an evolving world with camps, posses, bounties, hunting, trading, Moonshiner activity, and Naturalist play. Rockstar also made it available as a standalone purchase in December 2020. That combination makes it a meaningful editorial scope of its own. It should have a relationship to RDR2 for navigation and provenance, but its tables and collections should never imply that an online role rank or online horse is a Story Mode item.

## Proposed route and page contract

The route slugs should be stable, lowercase, and content-oriented:

| Surface | Route | Page type/role |
| --- | --- | --- |
| Franchise landing | `/red-dead` | Landing page with title cards, mode boundary, and links to the wiki index. |
| Wiki index | `/red-dead/wiki` | Index of the five approved scopes. |
| Game/content hub | `/red-dead/wiki/<game-slug>` | One hub per approved title/content scope. |
| Collection | `/red-dead/wiki/<game-slug>/<collection-slug>` | `database` or `collectible`, selected per candidate below. |
| Database pagination | `/red-dead/wiki/<game-slug>/<collection-slug>/page/<page>` | Only for database collections that need pagination. Checklist page numbers should return 404, matching the existing GTA contract. |

Recommended collection codes are `<game-slug>-<collection-slug>`. A Red Dead collection should have one canonical URL even when a modern release bundles several pieces of content.

The initial namespace should not add `/red-dead/tools`, `/red-dead/events`, `/red-dead/stats`, or a duplicate `/red-dead/checklists/<slug>` family. Those surfaces can be introduced later only when they have a distinct data model and a real player need. Existing global article routes can cover Red Dead explainers without making every article part of the wiki collection schema.

## Collection candidates by title

The decisions below mean **Create candidate** (approve for a later research/data/media workflow), **Defer** (valuable but blocked by a source, normalization, or maintenance gate), or **Skip initially** (not a durable first-release collection). Counts are included only when a checked source supports them; a count marked “reconcile” must not be used to seed data until the conflict is resolved.

### 1. Red Dead Revolver

Rockstar’s official game page is sparse in the accessible crawl, but Take-Two’s official announcement identifies Red Dead Revolver as Rockstar San Diego’s PS2/Xbox western game and a new franchise. The accessible dedicated guide/database evidence is unusually specific for a linear title: iRedDead lists 27 story missions, a 20-chapter Bounty Hunter mode, and a Sheriff Bartlett’s Journal system with 138 entries spread across 365 pages.

| Decision | Route slug | `page_type` | Source-supported scope | Useful row fields | Risks/gaps |
| --- | --- | --- | --- | --- | --- |
| Create | `story-missions` | `database` | 27 story missions. | Mission number, title, playable character, location, objective summary, unlock/reward, source note. | Confirm exact mission titles and ordering against a second accessible guide before writing. Avoid spoiler-heavy card titles in metadata. |
| Create | `bounty-hunter` | `collectible` | 20 Bounty Hunter chapters/replay scenarios, each with an optional objective/reward according to iRedDead. | Chapter, required/optional objective, reward, unlock condition, completion state. | It is a replay mode rather than a conventional collectible list; define whether the row is the chapter or the optional objective. |
| Create | `journal-entries` | `collectible` | 138 journal entries and 365 journal pages are both reported; 15 entries are initially available and 123 must be unlocked. | Journal section, entry number, page range, unlock source, related character/location/weapon/item. | “Entry” and “page” are different units. Use one row per unlockable entry and expose page coverage as a field, pending final reconciliation. |
| Defer | `weapons` | `database` | Journal sections and unlockable weapons are source-supported, but a normalized complete weapon roster was not independently checked in this pass. | Weapon name, category, unlock/purchase source, journal reference, upgrade/variant. | Exact roster and image coverage need a dedicated data pass. |
| Defer | `showdown-characters` | `database` | The guide confirms unlockable Showdown characters. | Character, unlock condition, mode, journal reference. | Exact count and complete roster were not checked from an authoritative accessible source. |
| Defer | `showdown-levels` | `database` | The guide confirms unlockable Showdown levels. | Level, unlock condition, mode, related character/trophy. | Exact count and complete roster were not checked. |
| Skip initially | `shop-items`, `cheats`, `trophies` | — | Useful as article/reference material, but not first-release collection priorities. | — | Low confidence in a clean, stable item-row contract compared with missions, Bounty Hunter, and journal unlocks. |

**Editorial note:** Revolver should launch with a small, high-confidence set. Its journal is the closest equivalent to a broad completion database, but it should not be inflated into a 100% open-world collection that the game does not have.

### 2. Red Dead Redemption — Story Mode

Rockstar’s official materials establish the original game’s single-player campaign, activities, wildlife, horses, weapons, jobs, and original online multiplayer. The current modern product page explicitly says that the modern RDR/Undead package has no multiplayer, so the canonical base hub must identify “Story Mode” and keep legacy online material out of the modern port scope.

The most complete current checklist evidence checked here is iRedDead’s 100% guide: 242 essential objectives, 57 story missions, 19 stranger strands with 18 required for 100%, 94 locations, 13 safehouses, 20 unique bounty locations, seven required gang hideouts (eight if Solomon’s Folly is included), five jobs, six minigames, four challenge tracks of ten tasks each, 18 total outfits with nine basic outfits used in its 100% accounting, and 28 weapons with five rare weapons called out for 100%.

| Decision | Route slug | `page_type` | Source-supported scope | Useful row fields | Risks/gaps |
| --- | --- | --- | --- | --- | --- |
| Create | `100-percent` | `collectible` | 242 essential objectives in the current iRedDead checklist. | Section, objective, requirement, region, prerequisite, 100%-required flag, missability/edition note. | It is a derived completion route, not a single in-game list. Reconcile its totals against Rockstar’s achievement/trophy list and a second guide before publishing. |
| Create | `story-missions` | `database` | 57 story missions. | Sequence, title, chapter/region, protagonist, mission-giver, unlocks, completion notes. | Confirm the final mission-title roster and how post-game missions are grouped. |
| Create | `stranger-missions` | `collectible` | 19 stranger strands, 18 required for 100%; “I Know You” is the notable non-required strand in the checked guide. | Strand, contact, region, mission sequence, prerequisite, required-for-100% flag. | A “strand” is not the same as an individual mission. Define row unit and preserve the optional strand. |
| Create | `weapons` | `database` | 28 total weapons; five rare weapons are identified as 100%-relevant in the checked guide. | Weapon, category, acquisition, region, rare/unique flag, achievement/100% relevance, edition availability. | Need a final canonical roster and variant policy. Modern releases may contain bonus weapons/outfits; tag them instead of silently merging them. |
| Create | `locations` | `collectible` | 94 locations in the current completion guide. | Location, territory, map coordinates, discovery requirement, 100%-required flag, related activity. | Source count is guide-derived; decide whether row unit is named location, map location, or 100% location. |
| Create | `safehouses` | `database` | 13 safehouses. | Name, territory, acquisition/unlock, rest/save function, story relevance. | Verify whether all 13 refer to base Story Mode and whether rented/temporary rooms are included. |
| Create | `bounties` | `collectible` | 20 unique bounty locations. | Bounty target, location, poster/source, capture/death outcome, reward, repeatability. | Repeatable bounty activity must not create duplicate rows for repeat cycles. |
| Create | `gang-hideouts` | `collectible` | Seven required hideouts; eight total when Solomon’s Folly is included in the checked guide. | Hideout, territory, unlock, 100%-required flag, replayability. | Edition/DLC treatment and Solomon’s Folly inclusion need an explicit scope label. |
| Create | `jobs` | `collectible` | Five job locations: two Horsebreaking and three Nightwatch locations. | Job, location, unlock, activity objective, repeatability, 100%-required flag. | A job location is the useful row unit, not every repeatable shift. |
| Create | `minigames` | `collectible` | Six minigames: Arm Wrestling, Blackjack, Five Finger Fillet, Horseshoes, Liar’s Dice, and Poker. | Activity, location(s), win/completion rule, 100%-required flag. | Some activities occur in multiple locations; keep the game as the row and locations as structured fields. |
| Create | `challenges` | `collectible` | Four ambient challenge tracks with ten tasks each (40 tasks) in the checked current guide. | Challenge family, rank, task, reward, prerequisite, 100%-required flag. | Older guides report different category structures. Confirm the four family names before seeding. |
| Create | `outfits` | `collectible` | 18 outfits are listed as the broad collection; nine basic outfits are used for the checked 100% requirement. | Outfit, requirement pieces, region, reward, base/GOTY/Undead flag, 100%-required flag. | Do not mistake the nine 100%-required outfits for the full roster. Edition and DLC outfits need tags. |
| Defer | `animals` | `database` | Rockstar’s official product page says more than 30 species; the checked dedicated guide reports 36 non-legendary animals. | Species, habitat/territory, hunt method, skin/pelt, legendary flag, story/online/Undead scope. | Exact base-game roster and treatment of legendary animals need reconciliation. Do not seed “36” as final without confirming the row definition. |
| Defer | `horses` | `database` | Horses are a core official system, but an exact normalized base-game roster was not checked in this pass. | Breed, coat, acquisition, region, deed/stable, stats, story/online flag. | RDR1 horse breeds, deeds, DLC, and Undead horses have different row units. |
| Defer | `legacy-multiplayer` | `database` or `collectible` after design review | Rockstar’s original manual/newswire documents Online Multiplayer, public/private Free Roam, posses, gang hideouts, hunting grounds, and multiplayer challenges. | Mode, activity, map, player-count rule, challenge, legacy-platform availability. | The modern RDR product explicitly excludes multiplayer. Keep this as a legacy 2010 PS3/Xbox 360 scope or defer it; never present it as current modern-port content. |

**Recommended first RDR1 bundle:** `100-percent`, `story-missions`, `weapons`, `locations`, `safehouses`, `bounties`, `gang-hideouts`, `jobs`, `minigames`, `challenges`, and `outfits`. Add animal/horse databases only after the row-unit and edition pass.

### 3. Undead Nightmare

Undead Nightmare deserves its own child hub at `/red-dead/wiki/undead-nightmare`. Rockstar’s manual describes a separate supernatural campaign in which an undead plague affects towns and survivors, and Rockstar support exposes it as a separate main-menu campaign. It can be offered as standalone content in the product/edition layer, but its editorial route should remain independent of the ordinary RDR Story Mode collection.

The checked sources disagree on several completion totals. iRedDead’s current checklist reports 59 essential objectives, eight story missions, six survivor missions, 20 towns, five cemeteries, 15 missing-person objectives, one required outfit, and four Undead Challenges. PowerPyx reports alternative figures including seven survivor missions, 23 territories, 16 missing people, and eight outfits. An IGN guide also describes Missing Souls as a 16-mission series. These are not safe to merge by arithmetic: some sources count locations, mission strands, territories, or optional/edition content differently.

| Decision | Route slug | `page_type` | Source-supported scope | Useful row fields | Risks/gaps |
| --- | --- | --- | --- | --- | --- |
| Create after reconciliation | `100-percent` | `collectible` | iRedDead: 59 essential objectives. PowerPyx and iRedDead disagree on several component totals. | Section, objective, region, prerequisite, required/optional flag, source count group. | Must resolve the count conflict before publication; show source/version scope in the research brief. |
| Create after reconciliation | `story-missions` | `database` | iRedDead reports eight story missions; the guide notes that game statistics can display four, so the mission-unit definition matters. | Mission, campaign section, objective, location, unlock, completion/statistics label. | Do not choose between “four” and “eight” without defining whether the source counts chapters, named missions, or stat milestones. |
| Create after reconciliation | `survivor-missions` | `collectible` | iRedDead reports six survivor missions; PowerPyx reports seven. | Survivor, mission strand, location, rescue/objective, reward, required flag. | Count conflict and strand-vs-mission ambiguity. |
| Create after reconciliation | `towns-saved` | `collectible` | iRedDead reports 20 towns; PowerPyx reports 23 territories. | Town/territory, region, infestation/rescue state, reward, required flag. | “Town” and “territory” are not interchangeable. Define the row unit from the map and game UI. |
| Create | `cemeteries` | `collectible` | Five cemeteries are reported in the checked completion guides. | Cemetery, region, cleansing objective, reward, repeatability. | Confirm whether DLC/edition cemeteries are included. |
| Create after reconciliation | `missing-persons` | `collectible` | iRedDead reports 15; IGN/PowerPyx material points to a 16-mission Missing Souls series. | Person, mission number, poster/source, location, prerequisite, reward. | Likely an off-by-one or strand-count difference; do not publish a final count until the mission list is mapped. |
| Create | `undead-challenges` | `collectible` | Four core challenges: Undead Hunter, Undead Sharpshooter, Undead Treasure Hunter, and Four Horses of the Apocalypse. Optional weapon challenges are reported separately. | Challenge family, rank, task, reward, optional/required flag. | Separate core four from Tomahawk/Explosive Rifle or other edition/bonus challenges. |
| Create | `horses-of-apocalypse` | `collectible` | Four horses are documented: War, Pestilence, Famine, and Death. The Unicorn is a later challenge-rank reward/related horse, not one of the four Apocalypse horses. | Horse, acquisition, challenge rank, region, undead challenge relation. | Avoid collapsing the four-horse collection and Unicorn into one inaccurate “four” count. |
| Defer | `outfits` | `database` or `collectible` after reconciliation | iRedDead reports four outfits in the expansion and one needed for its 100% checklist; PowerPyx reports eight. | Outfit, acquisition, reward, base/Undead/bonus flag, 100%-required flag. | Strong count and edition conflicts. Resolve full roster before data work. |
| Defer | `weapons` | `database` | Weapon content is present, but a complete Undead-only roster was not checked from an accessible authoritative source. | Weapon, acquisition, ammo, undead/base flag, optional/required flag. | Shared RDR weapons, DLC weapons, and remaster bonus weapons need normalization. |
| Skip initially | `provisions`, `consumables` | — | iRedDead-linked pages report 48 provisions and 13 consumables, but these are lower-priority than the campaign and undead-specific checklists. | — | Large normalization burden for limited player value in the first release. |

**Undead data gate:** before any dataset is written, create a reconciliation matrix that maps every iRedDead, PowerPyx, and IGN mission/location/objective to a single row unit. The initial plan must preserve both source counts and the reason for any final chosen count.

### 4. Red Dead Redemption 2 — Story Mode

Rockstar’s official RDR2 page establishes the 1899 Arthur Morgan Story Mode setting, and Rockstar’s official guide announcement describes a mission-by-mission walkthrough, maps, reference sections, and index. The accessible secondary compendium/checklist sources provide enough structure for a strong database launch, but several categories need a row-definition pass before a count is treated as canonical.

| Decision | Route slug | `page_type` | Source-supported scope | Useful row fields | Risks/gaps |
| --- | --- | --- | --- | --- | --- |
| Create | `100-percent` | `collectible` | The checked guides agree on the main 100% sections: story/strangers, compendium requirements, challenges, collectibles, and activities. GTABase reports 50 animals, 10 equipment, 10 fish, six gangs, 10 horse breeds, 20 plants, 48 weapons, all 90 challenges, 20 dreamcatchers, 30 dinosaur bones, five legendary animals, four table games, and related required activities. | Section, objective, quantity, prerequisite, region, missability, 100%-required flag, Story Mode-only flag. | Do not reduce the whole game to a single “100%” count. The required subset differs from the full compendium roster; the nine-category/90-challenge structure also needs reconciliation with an older eight-category guide. |
| Create | `story-missions` | `database` | Rockstar’s official guide confirms a full mission reference, but an exact mission-row count was not asserted in this pass. | Chapter, mission, giver, region, prerequisite, honor/missability, reward, epilogue flag. | Exact mission/unit count and spoiler treatment need final research. |
| Create | `animals` | `database` | PowerPyx’s compendium reports 178 animal entries; RDR2.wiki reports 16 legendary animals as a separate tracker. | Compendium name, species/variant, habitat, weapon/ammo recommendation, study/kill/skinning fields, legendary flag, Story Mode/Online flag. | 178 is an entry count, not necessarily a species count. Resolve variants, legendary entries, and online overlap. |
| Create after row-unit pass | `fish` | `database` | PowerPyx reports 30 fish compendium entries; the checked 100%/tracker sources separately use 13 legendary fish. | Fish, type, bait, location, legendary flag, 100%-required flag, Story Mode/Online flag. | “30 fish” and “13 legendary fish” may describe overlapping or different row units. Reconcile regular versus legendary entries. |
| Create | `plants` | `database` | 43 plant entries in the checked compendium. | Plant, region, habitat, use/crafting, compendium status, Story Mode/Online flag. | Confirm whether the source includes all variants and whether online-only plants are mixed in. |
| Create after row-unit pass | `horses` | `database` | 19 horse breeds in the checked compendium; GTABase separately covers Story Mode and Online horses with acquisition, wild locations, price, and stats. | Breed, coat/variant, acquisition, wild region, stable/deed, stats, bonding, Story Mode/Online flag. | Decide whether a row is a breed, coat, or purchasable horse variant. Do not merge RDO rank unlocks into Story Mode. |
| Create after normalization | `weapons` | `database` | GTABase/Gamepressure use 59 unique weapons; PowerPyx lists 60 while including an “Unarmed” entry. Use 59 as the working unique-weapon scope only after documenting the exclusion. | Weapon, category, acquisition, location, upgrade, missability, unique/variant flag, Story Mode/Online flag. | Normalize “Unarmed,” variants, melee tools, DLC/bonus content, and online-only weapons. |
| Create | `equipment` | `database` | 74 equipment entries in the checked PowerPyx compendium. | Item, category, acquisition, use, compendium section, missability, Story Mode/Online flag. | Confirm the guide’s equipment unit and avoid duplicating weapons, clothing, or horse gear. |
| Create | `gangs` | `database` | Six gangs in the checked 100%/compendium guides. | Gang, territory, story relevance, hideouts, members, 100%-required flag. | Gang members and hideouts are separate possible future collections; do not double-count them here. |
| Create | `cigarette-cards` | `collectible` | 144 cigarette cards. | Card, set, series, location/acquisition, mailed-set reward, item image, completion state. | Exact set/card metadata and image coverage need a source/media pass. |
| Create | `dinosaur-bones` | `collectible` | 30 dinosaur bones. | Bone number, region, coordinates, mission/letter prerequisite, reward, completion state. | Spoiler and map-coordinate presentation; check whether one is gated by a mission chain. |
| Create | `dreamcatchers` | `collectible` | 20 dreamcatchers. | Number, region, coordinates, reward, completion state. | Strong fixed-route candidate; verify coordinates and item images. |
| Create | `rock-carvings` | `collectible` | 10 rock carvings. | Number, region, coordinates, request/mission relation, reward. | Keep the related stranger chain separate from the ten locations. |
| Create | `graves` | `collectible` | Nine graves in the checked 100% guides. | Grave, deceased character, region, chapter/availability, completion state. | Availability is progression-gated and spoiler-sensitive. |
| Create after source pass | `legendary-animals` | `collectible` | 16 legendary animals are reported by the checked tracker; 100% requirements separately use five. | Animal, habitat, map region, pelt/item, story/100%-required flag. | Distinguish full legendary roster from the five needed for 100%. Confirm current list and variants. |
| Create after fish reconciliation | `legendary-fish` | `collectible` | 13 legendary fish are reported by the checked tracker/100% sources. | Fish, location, lure/bait, map coordinates, mail/reward relation. | Must share a deliberate key with `fish` without producing duplicate or conflicting rows. |
| Create later | `exotics` | `collectible` | The checked 100% guides identify the exotics request chain as required content. | Request stage, item, quantity, location, giver, reward, prerequisite. | Exact row roster and “stage versus item” model were not checked here. |
| Create later | `hunting-requests` | `collectible` | The checked 100% guides identify all hunting requests as required content. | Request, target, quantity, condition, location, reward, prerequisite. | Exact roster and image set need a dedicated research pass. |
| Create later | `treasure-hunts` | `collectible` | One treasure-hunter chain is part of the checked 100% route. | Chain, map stage, clue, location, reward, prerequisite. | Do not turn every map clue into a duplicate collection until source row units are settled. |
| Defer | `stranger-missions`, `shacks`, `trinkets-talismans`, `outfits` | `database`/`collectible` per final scope | These are high-value database subjects, and the checked guides identify them as broad optional/reference content. | Subject-specific fields. | Exact full rosters, missability, variants, and edition boundaries were not fully checked in this pass. |
| Skip initially | `online-animals`, `online-horses`, `online-weapons`, `online-roles` inside this hub | — | These belong to the separate RDO scope. | — | Prevent cross-mode duplication and misleading Story Mode metadata. |

**Recommended first RDR2 bundle:** launch `100-percent`, `animals`, `horses`, `weapons`, `equipment`, `gangs`, `cigarette-cards`, `dinosaur-bones`, `dreamcatchers`, `rock-carvings`, and `graves`, then add legendary/mission-chain collections after the row-unit pass. Use separate collection routes instead of one oversized `/collectibles` database.

### 5. Red Dead Online

Rockstar’s official Red Dead Online pages document five specialist roles—Bounty Hunter, Naturalist, Moonshiner, Trader, and Collector—and describe 20 ranks per role with progression tiers. Rockstar’s standalone announcement confirms that RDO can be owned and played without RDR2. GTABase and RDR2.org provide useful secondary indexes for horses, ability cards, ranks/unlocks, awards, camp/properties, and activities.

| Decision | Route slug | `page_type` | Source-supported scope | Useful row fields | Risks/gaps |
| --- | --- | --- | --- | --- | --- |
| Create first | `roles` | `database` | Five official specialist roles: Bounty Hunter, Naturalist, Moonshiner, Trader, Collector. | Role, activity loop, unlock requirement, role currency/XP concept, role-specific items/skills, rank range, source date. | Avoid volatile current prices, bonuses, and limited-time role rewards in the durable base row. |
| Create first | `role-ranks` | `collectible` | 20 ranks per role; five roles imply 100 role/rank units if each role/rank is one row. | Role, rank, tier, unlock/reward, purchase/role requirement, source date, durable/rotating flag. | The 100-unit total is derived from Rockstar’s five-role/20-rank model. Exact reward rows need a current data pass and may differ by update. |
| Create after current-source pass | `horses` | `database` | GTABase maintains an RDO horse database with breed/acquisition/wild location/price/stats/rank fields. | Breed/coat, acquisition, rank/role requirement, price, stats, stable role, source date. | Current total was not asserted from an authoritative source in this pass. RDO changes and variants need maintenance. |
| Create after current-source pass | `weapons` | `database` | A durable online weapon reference is a plausible high-value database, but a complete current roster was not checked here. | Weapon, category, rank/role unlock, price, ammo, ability interaction, source date. | Live updates, variants, and edition bonuses. Do not publish a total until the source pass is complete. |
| Create after current-source pass | `ability-cards` | `database` | RDO uses four ability slots: one active Dead Eye card and three passive cards; cards have tiers. | Card, active/passive slot, tier, effect, unlock rank, upgrade cost, role/update scope. | Exact current card count and tier rows were not checked from an official source. Keep effect descriptions versioned. |
| Create after current-source pass | `animals` | `database` | Rockstar’s Naturalist role page explicitly covers animal study, sampling/hunting, and legendary animals. | Animal, sample/pelt action, habitat, legendary flag, Naturalist relation, region, source date. | Full current roster and Story Mode overlap were not checked. Use `naturalist-animals` if the role-specific scope is clearer than a generic online animal database. |
| Defer with maintenance plan | `collector-sets` | `collectible` | Collector families and item locations are documented by community maps, but locations rotate through daily cycles. | Set/family, item, cycle/location, value/reward, completion state, last-verified timestamp. | No exact current total was established from an authoritative checked source. A static route will become stale; publish only with a refresh owner and date model. |
| Defer | `camp-properties` | `database` | Secondary databases identify camp and property content as a meaningful RDO category. | Property/camp feature, unlock, price, role/rank requirement, function. | Current catalog and economy values are update-sensitive and were not fully checked. |
| Skip initially | `awards` | `collectible` | RDO award categories are documented, but many awards can reset/repeat and award states are live-service progression. | — | Poor fit for a durable immutable collection until reset/repeat behavior and progress semantics are designed. |
| Skip initially | `free-roam-events`, `monthly-bonuses`, `passes`, `limited-rewards` | — | Rockstar continues to publish time-bound role bonuses and rotating content. | — | These belong to maintained news/article coverage, not an evergreen database revision. |

**RDO rule:** every future row must carry a source/update date and a durable-versus-rotating classification. Do not promise a “complete” online collection unless Bloxodes is prepared to refresh it.

## Mode, edition, and release boundaries

### Story Mode

Story Mode collections should contain only single-player campaign, world, compendium, activity, and completion data for the named game. For RDR2 this means Arthur Morgan’s campaign and its Story Mode compendium. RDO role ranks, ability cards, online horses, online weapons, and online economy must not appear there.

### Undead Nightmare

Undead Nightmare is separate from the ordinary RDR campaign even when the player owns it through a GOTY bundle, modern port, or the current combined product. It gets its own hub/slug and its own dataset codes. Shared base-game entities can be linked or tagged, but not silently duplicated as if the expansion were a fifth platform release.

The original Undead Nightmare disc/package also exposed multiplayer modes and related RDR multiplayer content. Those are legacy RDR1 online features, not part of the modern combined product’s single-player route. The first Undead hub should therefore cover the supernatural Story Mode campaign and its single-player completion systems only; any legacy multiplayer coverage should live under a clearly labeled RDR1 `legacy-multiplayer` scope if it is ever approved.

### Remasters, ports, GOTY, and bonus content

Treat PS3/Xbox 360, PS4, Xbox backwards compatibility, Switch, Switch 2, PC, iOS, Android/Netflix, GOTY, and modern conversion releases as edition/platform metadata. The current RDR product’s official page says the modern package contains RDR and Undead Nightmare single-player content and no multiplayer. Take-Two also notes bonus weapons/outfits in the modern conversion context. Therefore:

- use `edition_scope` or item flags for bonus/edition-only rows;
- keep the base Story Mode roster separate from bonus content;
- do not create a hub for each port;
- do not promise current RDR1 multiplayer on the modern port;
- preserve release-specific notes when an image or unlock differs by edition.

### RDR1 legacy multiplayer

Original RDR multiplayer is a real 2010 feature documented by Rockstar’s manual/newswire, including Free Roam, posses, hideouts, hunting grounds, and challenges. It is not the same product as Red Dead Online. If covered later, use a named `legacy-multiplayer` scope under `red-dead-redemption`, mark it `platform=PS3/Xbox 360 legacy`, and keep it out of the modern RDR product’s 2023/2024/2025 single-player dataset.

### Red Dead Online

RDO has its own standalone availability and its own progression/economy. It should be navigationally related to RDR2 but stored and editorially reviewed as online content. Time-bound bonuses, free-roam events, passes, rotating clothing, and daily Collector cycles should be articles or maintained datasets, not frozen evergreen rows.

## Cross-title collection rules

- Use specific collection slugs such as `dinosaur-bones`, `dreamcatchers`, `rock-carvings`, `gang-hideouts`, and `horses-of-apocalypse`; do not create a catch-all `collectibles` route.
- Use `database` for lookup-heavy rosters: weapons, animals, horses, plants, equipment, gangs, safehouses, roles, and ability cards.
- Use `collectible` for finite completion routes: 100% requirements, fixed map pickups, mission chains, challenges, hideouts, bounties, outfits, and role-rank progression.
- Keep the row unit in the research brief before collecting images. A mission strand, a named mission, a map location, a compendium entry, a species, a horse breed, a coat, and a rank reward are not automatically interchangeable.
- Keep a source URL and source date on every candidate dataset. Use official Rockstar/Take-Two material first, then dedicated databases/wikis, then reputable guides for exhaustive row lists and coordinates.
- Use image provenance at item level. There is no Roblox API that can be used as a substitute for Red Dead item rows or images; final media work needs a separate source/licensing review.
- Keep spoiler warnings and progression/missability flags in hubs and mission/collectible metadata.
- Publish immutable dataset revisions and revalidate only after item count, useful fields, canonical metadata, sitemap, search, and route readback have been checked in managed development.

## Source conflicts and research gaps to resolve

These are explicit gates, not assumptions to hide in the first dataset:

1. **Undead Nightmare counts:** iRedDead and PowerPyx disagree on survivor missions, towns/territories, missing persons, and outfits. IGN’s Missing Souls guide adds a 16-mission series description. Map every named row before choosing totals.
2. **RDR1 challenge taxonomy:** the current iRedDead checklist supports four tracks of ten tasks, but the exact final family names and task grouping still need a second source before seeding.
3. **RDR2 challenge taxonomy:** GTABase and the checked tracker use nine categories and 90 challenges, while an older RDR2.org page reports eight categories. Treat the nine-category/90-task structure as the working candidate, not an unqualified final count, until the category definitions are reconciled.
4. **RDR1 animal roster:** Rockstar only says “over 30” species on the official product page; the dedicated guide’s 36 non-legendary figure needs row-definition confirmation.
5. **RDR1 horses:** exact base Story Mode horse roster, coat/deed row unit, and DLC/Undead separation were not fully checked.
6. **RDR2 compendium units:** 178 animals, 30 fish, 43 plants, 19 horse breeds, 60 weapons, and 74 equipment are guide counts with different inclusion rules. Normalize variants, “Unarmed,” legendary entries, online overlap, and breed/coat semantics before seeding.
7. **RDR2 mission and optional-content totals:** the official guide proves source depth but the exact final mission/stranger/shack/trinket/outfit row counts were not asserted in this pass.
8. **Revolver roster depth:** exact weapons, Showdown characters, Showdown levels, and shop-item totals need a second source and a media pass. The 27 missions, 20 Bounty Hunter chapters, and journal figures are the strongest checked candidates.
9. **RDO current totals:** exact full counts for online horses, weapons, ability cards, animals, camps/properties, and Collector items were not established from authoritative checked sources. RDO counts are update-sensitive.
10. **RDO Collector maintenance:** community maps document rotating cycles, but a durable count and refresh contract were not established. Do not publish a static “complete Collector map” collection without operational ownership.
11. **Fandom/Red Dead Wiki access:** several direct Red Dead Wiki/Fandom pages were discovered but returned robots/internal-error responses in this pass. They may guide discovery, but no blocked page should be the sole proof for a final row or count.
12. **RDR2 official manual access:** Rockstar’s manuals index and official guide announcement were checked, but a complete text extraction of an RDR2 manual was not available in this pass. Use the official guide/manual during the final mission and system research pass where accessible.

## Recommended phased execution order

The roadmap below remains the forward-looking expansion plan. Phase 0 and the first vertical slice of Phases 1–5 are now complete in managed development through the seven collection revisions listed in the snapshot above; the remaining candidates stay gated by their own research, row-unit, image, and maintenance reviews.

### Phase 0 — Editorial and schema contract

Before implementation, approve the five-scope roster, slugs, mode/edition fields, source-date policy, image provenance rules, and the distinction between `database` and `collectible`. Model Undead as an expansion and RDO as online content. Decide whether `collection_group` is added now or represented in existing metadata.

### Phase 1 — Red Dead Redemption 2 Story Mode

Create the Red Dead namespace and the RDR2 hub. Start with `100-percent`, `animals`, `horses`, `weapons`, `equipment`, `gangs`, `cigarette-cards`, `dinosaur-bones`, `dreamcatchers`, `rock-carvings`, and `graves`. This has the strongest available source depth and the clearest player search demand. Resolve the compendium row units before images and dataset publication.

### Phase 2 — Red Dead Redemption Story Mode

Add the RDR1 hub and the first completion/reference bundle: `100-percent`, `story-missions`, `weapons`, `locations`, `safehouses`, `bounties`, `gang-hideouts`, `jobs`, `minigames`, `challenges`, and `outfits`. Keep a visible Story Mode label and document the modern-port multiplayer exclusion.

### Phase 3 — Undead Nightmare

Add the child hub after the count-reconciliation matrix is complete. Build `story-missions`, `survivor-missions`, `towns-saved`, `cemeteries`, `missing-persons`, `undead-challenges`, and `horses-of-apocalypse`; add `100-percent` only after those rows agree. Defer outfits/weapons until the edition and count conflicts are settled.

### Phase 4 — Red Dead Revolver

Launch the compact hub with `story-missions`, `bounty-hunter`, and `journal-entries`. Research and add weapons/Showdown collections only if the final roster and image provenance are complete. Treat journal entries as unlockable checklist rows with page-range metadata.

### Phase 5 — Red Dead Online

Start with `roles` and `role-ranks`. Add horses, weapons, ability cards, and Naturalist animals only after a current-source pass. Require update dates and a refresh owner. Keep Collector sets, awards, free-roam events, bonuses, passes, and limited rewards out of the evergreen first release.

### Phase 6 — Deferred maintenance and expansion

Consider RDR1 legacy multiplayer, RDR2 exotics/hunting requests/treasure/strangers/shacks, Revolver weapons/Showdown, Undead outfits/weapons, and RDO Collector sets only when each has an owner, a stable row unit, a current source set, and a refresh policy. Use global articles for historical port explainers, lore, and live-service news instead of forcing them into the collection database.

## Source register

### Official Rockstar and Take-Two sources

- [Rockstar Red Dead Redemption product page](https://www.rockstargames.com/reddeadredemption) — current RDR + Undead Nightmare product boundary, single-player scope, platforms, and no-multiplayer statement.
- [Rockstar Red Dead Revolver product page](https://www.rockstargames.com/br/games/reddeadrevolver) — official franchise-title page; accessible page text was sparse in this pass, so the Take-Two announcement remains the stronger source for identity details.
- [Rockstar Red Dead Redemption 2 product page](https://www.rockstargames.com/games/RedDeadRedemption2) — Story Mode identity, setting, protagonist, developer, and original platforms.
- [Rockstar Red Dead Online product page](https://www.rockstargames.com/reddeadonline) — online game loop and durable system overview.
- [Rockstar Red Dead Online roles](https://www.rockstargames.com/reddeadonline/features/roles?active=naturalist) — five roles, role progression, and Naturalist scope.
- [Rockstar Red Dead Online standalone announcement](https://www.rockstargames.com/reddeadonline/newswire/article/51974aa3aao1ka/red-dead-online-standalone-now-available) — standalone availability from December 2020.
- [Rockstar Red Dead Redemption official launch news](https://www.rockstargames.com/newswire/article/398a4552k1a79k/red-dead-redemption-official-launch-trailer-coming-tomorrow.html) — original RDR launch timing.
- [Rockstar RDR multiplayer overview](https://www.rockstargames.com/newswire/article/1748koo91a9138/getting-online-with-red-dead-redemption.html) — original RDR Online Multiplayer and Free Roam.
- [Rockstar manuals index](https://www.rockstargames.com/manuals) — official manual inventory for RDR, RDR GOTY/Undead, and RDR2.
- [RDR PS3 manual](https://media.rockstargames.com/rockstargames-newsite/img/manuals/en_us/RDR_PS3_ESSENTIALS_MANUAL_ENG.pdf) — original multiplayer, posse, activities, horse, and control evidence.
- [RDR Xbox 360 manual](https://www.rockstargames.com/img/manuals/en_us/RDR_360_CLASSICS_MANUAL_ENG.pdf) — campaign/activity and system reference.
- [RDR GOTY/Undead manual](https://media-rockstargames-com.akamaized.net/rockstargames-newsite/img/manuals/en_us/RDR_GOTY_PS3_ESSENTIALS_MANUAL_ENG.pdf) — Undead Nightmare’s separate supernatural campaign boundary.
- [Rockstar official RDR2 guide announcement](https://www.rockstargames.com/newswire/article/25o2411817aa9a/Pre-Order-the-Red-Dead-Redemption-2-Complete-Official-Guide) — mission walkthrough, maps, reference sections, and index.
- [Rockstar RDR2 title update notes](https://support.rockstargames.com/articles/12RPCCjibCwnNPatrm8y9y/red-dead-redemption-2-title-update-1-06-notes-ps4-xbox-one) — Compendium, collectible weapons, and Legendary Animal terminology.
- [Rockstar Undead Nightmare standalone support](https://support.rockstargames.com/articles/68TgrDbg5OusKHb90tEcjo/information-about-playing-the-undead-nightmare-disc-as-a-stand-alone-game) — standalone campaign/multiplayer packaging boundary.
- [Rockstar Undead Nightmare PS5 access support](https://support.rockstargames.com/articles/6A7HCAuVPSI1KTCF3ejCYk/how-to-access-undead-nightmare-on-playstation-5) — separate menu access and difficulty modes.
- [Take-Two RDR and Undead Nightmare modern availability announcement](https://www.take2games.com/ir/news/red-dead-redemption-and-undead-nightmare-now-available-nintendo) — modern bundle, platform conversions, and bonus-content context.
- [Take-Two Red Dead Revolver announcement](https://ir.take2games.com/static-files/3315d717-757a-4b92-b0e9-bdb6fd5230af) — official identity, developer, platform, and franchise-predecessor evidence.

### Dedicated databases and reputable guides

- [iRedDead RDR 100% checklist](https://www.ireddead.com/rdr/guides/100-percent-completion-checklist) — current RDR1 objective, mission, location, weapon, outfit, activity, and 100% counts.
- [PowerPyx RDR1 100% checklist](https://www.powerpyx.com/red-dead-redemption-1-100-guide-checklist/) — independent RDR1 completion cross-check and Undead comparison.
- [iRedDead Undead Nightmare 100% checklist](https://www.ireddead.com/undeadnightmare/guides/100-completion-checklist) — Undead objective/count candidate.
- [iRedDead Undead Nightmare completion breakdown](https://www.ireddead.com/undeadnightmare/guides/100-percent-completion-breakdown) — story, survivor, and challenge breakdown.
- [IGN Undead Nightmare guide PDF](https://s3.amazonaws.com/szmanuals/7a656e90d6e2e4ac135dd6f4b0ab440b) — Missing Souls and Four Horses of the Apocalypse cross-check.
- [iRedDead Revolver story mission list](https://www.ireddead.com/reddeadrevolver/guides/story-mission-list) — 27 mission roster and Bounty Hunter context.
- [iRedDead Revolver Bounty Hunter guide](https://www.ireddead.com/reddeadrevolver/guides/bounty-hunter) — replay chapters, optional objectives, and rewards.
- [iRedDead Revolver journal entries](https://www.ireddead.com/reddeadrevolver/guides/journal-entries) — journal entry/page model and unlock scope.
- [iRedDead Revolver trophies](https://www.ireddead.com/reddeadrevolver/guides/trophies) — story/Bounty Hunter and related unlock objectives.
- [PowerPyx RDR2 full compendium](https://www.powerpyx.com/red-dead-redemption-2-full-compendium/) — full-compendium category/count candidate and row discovery.
- [GTABase RDR2 100% guide](https://www.gtabase.com/red-dead-redemption-2/guides/red-dead-redemption-2-100-completion-guide-checklist) — required subsets and 90-challenge structure.
- [RDR2.wiki tracker](https://rdr2.wiki/) — secondary tracker for legendary animals/fish and fixed collectibles; use as discovery/cross-check, not sole authority.
- [RDR2.org challenges page](https://www.rdr2.org/wiki/challenges/) — older challenge-category cross-check; possible stale eight-category grouping, not sole proof of the final taxonomy.
- [Gamepressure RDR2 guide](https://www.gamepressure.com/red-dead-redemption-2/) — mission, collectible, map, and activity cross-check.
- [Gamepressure RDR2 100% guide](https://www.gamepressure.com/red-dead-redemption-2/completing-the-game-in-100/z7b876) — required subset and collectible checklist cross-check.
- [GTABase RDR2 database index](https://www.gtabase.com/red-dead-redemption-2/) — category model for animals, horses, weapons, gangs, cards, locations, and RDO.
- [GTABase RDR2 animal database](https://www.gtabase.com/red-dead-redemption-2/animals/) — animal database field and Story Mode/Online separation ideas.
- [GTABase RDR2 horse database](https://www.gtabase.com/red-dead-redemption-2/horses/) — horse database field and Story Mode/Online separation ideas.
- [GTABase RDO index](https://www.gtabase.com/red-dead-online/) — online database category discovery.
- [GTABase RDO ability cards](https://www.gtabase.com/news/red-dead-redemption-2/online/red-dead-online-ability-cards-full-list-of-character-abilities-loadout) — slot/tier model cross-check.
- [RDR2.org rank unlocks](https://www.rdr2.org/guides/rank-unlocks-guide/) — secondary RDO rank/unlock fields.
- [RDR2.org horse awards](https://www.rdr2.org/guides/horse-awards-guide/) — resettable award behavior and maintenance risk.
- [Jean Ropke Collector map](https://jeanropke.github.io/RDR2CollectorsMap/) and [user guide](https://github.com/jeanropke/RDR2CollectorsMap/wiki/RDO-Collectors-Map-User-Guide) — rotating Collector-cycle evidence; community source only.

The Red Dead Wiki/Fandom pages were useful discovery leads, but several direct pages were not fetchable in this research environment. They must be corroborated before being used as the only source for a published row, exact count, or edition claim.
