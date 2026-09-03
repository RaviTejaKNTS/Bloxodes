# GTA 5 wiki collection roadmap

Date: 2026-09-03

Status: Approved for local and managed-development work. Nothing in this plan authorizes production publication.

## Progress (2026-09-03)

Production was not touched. All publication is managed development only.

| Collection | Workspace | Roster | Images | Managed-dev verify | Localhost | Remaining source risks |
| --- | --- | --- | --- | --- | --- | --- |
| Weapons | `tmp/content-workspace/gta/gta-5/collections/weapons/` | 59 | 59/59 | Complete (pre-existing) | http://127.0.0.1:3000/gta/wiki/gta-5/weapons | Shared Wiki pages mix GTA Online; edition markers |
| Vehicles | `tmp/content-workspace/gta/gta-5/collections/vehicles/` | 321 Story Mode enterable models | 321/321 | Verified 2026-09-02. 19 paginated routes, all under 1.0 MB after `gta-5-vehicles` HTML packing at 18k. Page 2+ `noindex, follow`. Sitemap has only the base URL. Desktop/mobile: no overflow, GTA sidebar is GTA Home / GTA Wiki / All Games | http://127.0.0.1:3000/gta/wiki/gta-5/vehicles | Wiki 347 vs 350 vs 321 counting; JB 700 $350,000 wiki vs $475,000 GTABase; Original Special Vehicles grants vs Enhanced website purchases; Police Predator/Maverick kept in Emergency |
| Characters | `.../characters/` | 89 | 89/89 | Verified 2026-09-02. 2 pages; page 1 1.597 MB (under fail limit). GTA sidebar is GTA Home / GTA Wiki / All Games | http://127.0.0.1:3000/gta/wiki/gta-5/characters | Wiki infoboxes leading with Online portraits; player-determined vs Wiki dagger status |
| Story Missions | `.../story-missions/` | 87 possible missions | 87/87 | Verified 2026-09-02. GTA sidebar is GTA Home / GTA Wiki / All Games | http://127.0.0.1:3000/gta/wiki/gta-5/story-missions | 69/74/79/83/87 count confusion; ending gold text names kill objectives |
| Properties | `.../properties/` | 23 | 23/23 | Verified 2026-09-02. HTML size 0.694 MB. Desktop/mobile: no overflow, GTA sidebar is GTA Home / GTA Wiki / All Games | http://127.0.0.1:3000/gta/wiki/gta-5/properties | Activity pay vs weekly income; original-edition free marina/hangar grants; 100% storage counting disagreement left out of public copy |
| Heists | `.../heists/` | 6 | 6/6 | Verified 2026-09-02. HTML size 0.285 MB. Desktop/mobile review: no overflow, GTA sidebar is GTA Home / GTA Wiki / All Games, hub copy sits before the CTA | http://127.0.0.1:3000/gta/wiki/gta-5/heists | Competitor 5-heist lists omit Blitz Play; take ranges; Paleto Social Club still uses masks |
| Heist Crew | `.../heist-crew/` | 13 | 13/13 | Verified 2026-09-02. HTML size 0.402 MB. Desktop/mobile: no overflow, GTA sidebar is GTA Home / GTA Wiki / All Games, portraits render | http://127.0.0.1:3000/gta/wiki/gta-5/heist-crew | Story vs Online cuts; Karl Big Score-only; Rickie 30s vs 50s alarm |
| Strangers & Freaks | `.../strangers-and-freaks/` | 66 | 66/66 | Verified 2026-09-03. Two paginated routes; base 1.141 MB and page 2 0.887 MB. Desktop/mobile: no overflow, all item images load, GTA sidebar is GTA Home / GTA Wiki / All Games | http://127.0.0.1:3000/gta/wiki/gta-5/strangers-and-freaks | 20/24/58/66 counting; Hao unlock; three Grass Roots rows use explicitly caveated representative source stills |
| Random Events | `.../random-events/` | 60 | 60/60 | Verified 2026-09-03. Two paginated routes; base 0.899 MB and page 2 0.818 MB. Desktop/mobile: no overflow, all item images load, GTA sidebar is GTA Home / GTA Wiki / All Games | http://127.0.0.1:3000/gta/wiki/gta-5/random-events | Simeon missable window; Online name collisions |
| Hobbies & Pastimes | `.../hobbies-and-pastimes/` | 61 | 61/61 | Verified 2026-09-03. Two paginated routes; base 0.956 MB and page 2 1.022 MB. Desktop/mobile: no overflow, all item images load, GTA sidebar is GTA Home / GTA Wiki / All Games | http://127.0.0.1:3000/gta/wiki/gta-5/hobbies-and-pastimes | Edition extras; Online Flight School bleed |
| Cheats | `.../cheats/` | 36 effects | 15/36 (14 spawn vehicles + Director Mode; 21 effect rows are an approved gap) | Verified 2026-09-02 with `--allow-missing-images`. HTML size 0.932 MB. Desktop/mobile: no overflow, GTA sidebar is GTA Home / GTA Wiki / All Games | http://127.0.0.1:3000/gta/wiki/gta-5/cheats | TOOLUP loadout wording; invincibility phone length; no money cheat |
| Radio Stations | `.../radio-stations/` | 22 stations, tracks omitted for HTML size | 22/22 | Verified 2026-09-02. Desktop/mobile overflow check passed, GTA sidebar is GTA Home / GTA Wiki / All Games | http://127.0.0.1:3000/gta/wiki/gta-5/radio-stations | Later Online playlists on shared station pages; LSUR/iFruit logos use GTAO-named wiki files that also appear on the GTA V stations page |
| Achievements & Trophies | `.../achievements-and-trophies/` | 51 Enhanced base | 51/51 | Verified 2026-09-02. HTML size 1.435 MB (under fail limit). Single page, GTA sidebar is GTA Home / GTA Wiki / All Games | http://127.0.0.1:3000/gta/wiki/gta-5/achievements-and-trophies | Online trophies in their own section; later DLC lists excluded; A New Perspective is Enhanced-only |
| Gangs & Factions | `.../gangs-and-factions/` | 15 | 15/15 | Verified 2026-09-02. GTA sidebar is GTA Home / GTA Wiki / All Games | http://127.0.0.1:3000/gta/wiki/gta-5/gangs-and-factions | Thin named-member rows for Vagos/Marabunta |
| Animals | `.../animals/` | 29; Chop excluded (stays on Characters) | 29/29 | Verified 2026-09-03. HTML size 0.726 MB. Desktop/mobile: no overflow, all item images load, GTA sidebar is GTA Home / GTA Wiki / All Games | http://127.0.0.1:3000/gta/wiki/gta-5/animals | Online peyote bleed; Pigeon is peyote-only |

Collectibles have not been started.

## Goal

Build the GTA 5 wiki as a set of useful database pages under `/gta/wiki/gta-5`. Keep the current Bloxodes page shell, typography, spacing, collection cards, pagination, metadata, and responsive behavior. GTA content gets its own tables and URL namespace, but it should not get a different visual system.

The existing GTA 5 Weapons collection is the reference implementation:

- Route: `/gta/wiki/gta-5/weapons`
- Workspace: `tmp/content-workspace/gta/gta-5/collections/weapons/`
- Tables: `gta_games`, `gta_wiki_pages`, `gta_wiki_collection_pages`, `gta_wiki_collection_datasets`, and `gta_wiki_collection_items`
- Verification: `npm run verify:gta-collection-final`

Do not use `wiki_collection_pages`, `roblox_universes`, Roblox APIs, Roblox collection registration, `/wiki/<game>/<collection>`, or `verify:game-collection-finals` for GTA work.

## Approved collection queue

Build one collection at a time. Complete research, data, images, writing, managed-development verification, and browser review before moving to the next collection.

| Order | Collection | Slug | Scope and useful fields |
| --- | --- | --- | --- |
| 1 | Weapons | `weapons` | Already complete. Story Mode class, unlock, price, edition, availability, and comparable stat bars. |
| 2 | Vehicles | `vehicles` | Story Mode vehicles only. Class, manufacturer, seats, purchase price, acquisition, storage, protagonist ownership, performance fields when reliable, and edition availability. |
| 3 | Characters | `characters` | Story Mode characters. Role, affiliation, protagonist relationship, mission involvement, actor, status, and character group. |
| 4 | Story Missions | `story-missions` | Every possible main-story mission, including branching missions and endings. Order, protagonists, giver, location, unlocks, approach, gold objectives, and prerequisite. Do not describe the total as one-playthrough mission count. |
| 5 | Properties | `properties` | Story Mode purchasable properties and businesses. Buyer eligibility, price, income, unlock point, location, missions or perks, and garage/storage details. |
| 6 | Heists | `heists` | Story Mode heists. Available approaches, setup missions, required crew roles, protagonists, target, possible take, unlock point, and outcome notes. This deliberately overlaps Story Missions but answers a different comparison question. |
| 7 | Heist Crew Members | `heist-crew` | Recruitable Story Mode crew. Role, skill, cut, unlock method, improvement behavior, approach usefulness, and casualty risk where sources support it. |
| 8 | Strangers & Freaks | `strangers-and-freaks` | Mission chains grouped by stranger and protagonist. Unlock, starting location, mission order, rewards, and completion relevance. |
| 9 | Random Events | `random-events` | Story Mode encounters. Trigger area, eligible protagonist, reward, choices, availability, missability, and edition differences. |
| 10 | Hobbies & Pastimes | `hobbies-and-pastimes` | Stable Story Mode activities. Activity type, location, protagonist access, unlock, completion requirement, reward, and repeatability. |
| 11 | Cheats | `cheats` | One row per cheat effect. PC command, phone number where supported, PlayStation sequence, Xbox sequence, restrictions, and save or achievement effects. Keep platform differences explicit. |
| 12 | Radio Stations | `radio-stations` | Station, genre, host or DJ, availability by edition/platform, and a source-backed description. Add track data only if the source and page size remain manageable. |
| 13 | Achievements & Trophies | `achievements-and-trophies` | Base GTA 5 achievements and trophies. Requirement, platform points or trophy grade, hidden status, mode, and missability. Mark Online requirements instead of mixing them into Story Mode guidance. |
| 14 | Gangs & Factions | `gangs-and-factions` | Story-relevant groups. Territory, members, allies, rivals, missions, and role in the story. Skip groups with no useful per-row information. |
| 15 | Animals | `animals` | Story Mode wildlife. Habitat, behavior, playable peyote form, hunting or photography relevance, and edition availability. |

## Collectibles

Do not start with one enormous `/gta/wiki/gta-5/collectibles` dataset. Location-heavy collectible types need their own search, filters, images, unlock rules, and route. Put the following collection links under a `Collectibles` group on the GTA 5 wiki hub:

| Collection | Slug | Scope notes |
| --- | --- | --- |
| Letter Scraps | `letter-scraps` | Location, region, access notes, nearest landmark, collection order, and final reward or mission. |
| Spaceship Parts | `spaceship-parts` | Location, region, access notes, required mission state, and final reward. |
| Submarine Pieces | `submarine-pieces` | Underwater location, access notes, depth or hazard notes when reliable, unlock, and mission reward. |
| Nuclear Waste | `nuclear-waste` | Underwater location, access notes, collection value, required property, and completion reward. |
| Epsilon Tracts | `epsilon-tracts` | Location, order, unlock requirement, protagonist restriction, and completion reward. |
| Peyote Plants | `peyote-plants` | Location, animal form, environment, access notes, and edition availability. Keep GTA Online peyote events out. |
| Monkey Mosaics | `monkey-mosaics` | Location, photograph position, nearest landmark, unlock, reward, and enhanced-edition availability. |
| Hidden Packages | `hidden-packages` | Story Mode underwater and Altruist Camp packages. Location, access method, value, and respawn behavior when verified. |
| Stunt Jumps | `stunt-jumps` | Launch point, landing zone, recommended vehicle, approach notes, and completion requirement. |
| Under the Bridge | `under-the-bridge` | Bridge location, approach direction, recommended aircraft, clearance notes, and completion requirement. |
| Knife Flights | `knife-flights` | Building gap, approach direction, recommended aircraft, difficulty notes, and completion requirement. |

An optional `/gta/wiki/gta-5/collectibles` page can come later as a purpose-built index that introduces the collectible categories and links to these routes. It should not duplicate every collectible row. The current wiki hub can perform that job until the number of collectible pages makes a separate index useful.

Do not include GTA Online-only sets such as Action Figures, Playing Cards, Movie Props, LD Organics Products, or time-limited event collectibles in the GTA 5 Story Mode queue.

## Items that belong elsewhere

- Build a 100% completion tracker with the checklist page family, not as a collection.
- Publish rankings such as best cars or best weapons as editorial articles that link to the complete database.
- Keep weekly GTA Online rotations, Gun Van stock, bonuses, and temporary rewards out of these durable collections.
- Split GTA Online into its own clearly named scope before adding its changing inventories or progression systems.

## Collection workflow

For every collection:

1. Check the GTA tables and routes for an existing page or conflicting slug.
2. Research the complete item set with at least one strong reference source and enough second-source checking to resolve disagreements.
3. Define the scope before gathering rows. Record Story Mode, edition, platform, and version boundaries in `brief.md`.
4. Create `tmp/content-workspace/gta/gta-5/collections/<collection-slug>/brief.md`.
5. Create a v2 `dataset.json` using the Weapons dataset as the structural example. Public fields belong in `items[].item`; section, order, and image bookkeeping belong in `items[].system`.
6. Gather useful item images. Save them under `media/`, wire them into the dataset, and record sources and gaps in the brief or image manifest.
7. Create `final.json`. Use `All {count} <Collection> in GTA 5` unless the approved scope needs `Story Mode` in the title to prevent confusion with GTA Online.
8. Create `runtime-manifest.json` with route `/gta/wiki/gta-5/<collection-slug>` and code `gta-5-<collection-slug>`.
9. Start or reuse `npm run dev:managed`.
10. Run:

```bash
npm run verify:gta-collection-final -- \
  --base-url http://localhost:3000 \
  --game gta-5 \
  --collection <collection-slug> \
  --workspace tmp/content-workspace/gta/gta-5/collections/<collection-slug>
```

11. Run the HTML-size audit on the collection route and every generated pagination route.
12. Review desktop and mobile in the browser. Check overflow, broken images, card fields, section navigation, pagination, metadata, and GTA-only sidebar links.
13. Stop after managed-development verification. Do not apply production migrations, copy rows to production, upload production media, merge, deploy, or publish without a later explicit approval.

## Quality rules

- Match the existing Roblox wiki and collection design. Do not invent a GTA theme, special hero layout, eyebrow text, or denser dashboard UI.
- Write for Story Mode unless a collection explicitly says otherwise.
- Never pull GTA Online prices, ranks, statistics, unlocks, or items into a Story Mode dataset.
- Preserve edition and platform differences instead of flattening them into one claim.
- Use source-backed item rows. Do not infer missing statistics or manufacture comparison scores.
- Add fields only when they help a player compare or find an item.
- Keep paragraphs useful. Do not mention research, datasets, workflow, SEO, sources, or page construction in public copy.
- Do not hard-code item totals in prose. Let `{count}` resolve the current dataset count in titles.
- Large collections must paginate. Pagination pages use `noindex, follow` and stay out of the sitemap.
- Every item needs a useful image unless the brief records and approves a genuine source gap.

## GTA skill family

Use the dedicated GTA skills. Do not run the Roblox wiki or collection skills for GTA work.

Wiki hubs:

- `bloxodes-gta-wiki-suggestions`
- `bloxodes-gta-wiki-research`
- `bloxodes-gta-wiki-writing`
- `bloxodes-gta-wiki-workflow-runner`

Collections:

- `bloxodes-gta-game-collection-suggestions`
- `bloxodes-gta-game-collection-research`
- `bloxodes-gta-game-collection-data`
- `bloxodes-gta-game-collection-images`
- `bloxodes-gta-game-collection-writing`
- `bloxodes-gta-game-collection-workflow-runner`
- `bloxodes-gta-game-collection-refresh`

The parent runner keeps the research, data, image, writing, managed-development verification, HTML-size, pagination, and browser gates separate. The refresh skill handles later source-backed changes without regenerating an unchanged collection.

## Copy-paste prompt for Grok

```text
Work in the Bloxodes repository and complete the approved GTA 5 wiki collection roadmap at:
docs/2026-09-02-gta-5-wiki-collection-roadmap.md

Start by reading, in full:
- AGENTS.md
- DESIGN.md
- apps/web/src/app/AGENTS.md
- apps/web/src/app/(site)/AGENTS.md
- apps/web/src/lib/AGENTS.md
- scripts/AGENTS.md
- supabase/AGENTS.md
- dev-docs/architecture.md
- dev-docs/environment.md
- dev-docs/pipelines/wiki-collections.md
- .agents/skills/bloxodes-gta-game-collection-workflow-runner/SKILL.md
- tmp/content-workspace/gta/gta-5/collections/weapons/brief.md
- tmp/content-workspace/gta/gta-5/collections/weapons/dataset.json
- tmp/content-workspace/gta/gta-5/collections/weapons/final.json
- tmp/content-workspace/gta/gta-5/collections/weapons/runtime-manifest.json

Use the GTA workflow runner and every GTA phase skill it requires. Read each named skill completely before running that phase. Do not run the Roblox workflow runner, require a Roblox universe ID, call Roblox APIs for collection rows, write to Roblox tables, use /wiki routes, or run verify:game-collection-finals.

Use only the GTA contract:
- Routes: /gta/wiki/gta-5/<collection-slug>
- Workspace: tmp/content-workspace/gta/gta-5/collections/<collection-slug>/
- Codes: gta-5-<collection-slug>
- Tables: gta_games, gta_wiki_pages, gta_wiki_collection_pages, gta_wiki_collection_datasets, gta_wiki_collection_items
- Verifier: npm run verify:gta-collection-final
- Runtime sync: npm run sync:gta-collection-runtime
- Environment: managed development only

Then execute the roadmap in its stated order, beginning with Vehicles. Weapons already exists and is the golden example. Work on one collection per worker. If parallel workers are available, give each worker one collection only and keep a parent review gate between research, data, images, and writing. Never let a research/data worker write final.json before its data and images are approved.

For each collection:
1. Create and review brief.md.
2. Create and validate the complete v2 dataset.json.
3. Gather, save, map, and verify item images.
4. Create and review final.json.
5. Create runtime-manifest.json.
6. Run the GTA verifier against managed development.
7. Run the HTML-size audit.
8. Review the page at desktop and mobile widths in the browser.
9. Confirm no horizontal overflow, broken images, missing sections, bad pagination, eyebrow text, GTA Online contamination, or Roblox links in the GTA sidebar.
10. Record completion and remaining source risks in the roadmap document.

Do not modify the established GTA schema or route family unless a verified collection cannot fit it. Do not create collection-specific database tables. Do not change the site design. Reuse the shared wiki collection renderer and the Weapons implementation.

Stop before production. Do not apply anything to production, publish production content or media, deploy, merge, or push unless I explicitly approve that later.

At each collection gate, report the exact workspace path, source coverage, item count, image coverage, validation result, localhost URL, and any unresolved disagreement. Do not hide missing data by writing around it.
```

## Research basis

- Bloxodes currently has the GTA 5 Weapons collection and no other GTA 5 collection rows in managed development.
- GTABase exposes durable GTA 5 database families for vehicles, weapons, properties, locations, characters, gangs, animals, missions, side missions, and achievements: <https://www.gtabase.com/grand-theft-auto-v/>
- GTA Wiki lists the Story Mode collectible families and distinguishes enhanced-edition content: <https://gta.fandom.com/wiki/Collectibles>
- GTA5Wiki groups Story Mode and Online collectible hunts, which is useful for identifying what must remain outside this Story Mode queue: <https://gta5wiki.com/collectibles/>
- Pro Game Guides has recurring GTA 5 demand around cheats and vehicles: <https://progameguides.com/gta/>
- Beebom covers GTA weapon and beginner-guide demand but does not provide the same complete Story Mode collection structure: <https://beebom.com/best-gta-5-online-weapons/> and <https://beebom.com/gta-online-beginners-guide/>
- Targeted searches found no useful GTA 5 collection coverage on BloxInformer or Game8. TechWiser's relevant wiki taxonomy is centered on GTA 6 rather than a complete GTA 5 database.
