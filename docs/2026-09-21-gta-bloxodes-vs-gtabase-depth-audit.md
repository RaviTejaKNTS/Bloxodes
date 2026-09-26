# GTA Bloxodes vs GTABase — Depth Audit (All 281 GTA Collections)

## September 26 review update

The original September 21 tables and counts below are a historical baseline, not the current catalog. Managed development now has 281 collections and 10,793 items after the source-backed roster, field, copy and media corrections recorded in [the production-readiness review](2026-09-21-gta-collection-depth-todo.md). Production has not been promoted.

The candidate’s strengths are persistent completion checklists, title/mode boundaries, concise useful card fields, exact collectible routes, image enlargement and source credits, and a scoped finder that reaches indexable paginated item rows. The final pass added 197 approved exact images and matched gameplay chapters for GTA 2, GTA V packages and VCS shooting rounds.

[GTABase’s GTA V/Online vehicle database](https://www.gtabase.com/grand-theft-auto-v/vehicles/) remains stronger for specialist comparison: broader performance/specification coverage and filters, large galleries and model-specific acquisition history. Our review does not establish that Bloxodes is better overall. We removed unsupported fields and ratings masquerading as ammunition capacity; adding empty columns or fabricated road-test figures would not close that gap. [GTA Series Videos](https://www.youtube.com/@GTASeriesVideos) and exact source location guides remain useful complements for route execution.

The raw audit retains 1,230 photograph gaps (472 cheat rows; 758 elsewhere), with individually recorded native gameplay alternatives for the 80 rows in three sensitive collections. Reference portrait and specialist-media enrichment remain visible; functional/build/SEO checks alone do not certify every historical fact or competitor parity.

---

**Date:** 2026-09-21
**Scope:** This is the 2026-09-21 managed-development depth snapshot, covering 281 collection rows. It is historical evidence, not a claim of production parity: the 2026-09-25 readback found 173 production pages and 281 managed-development pages. The current source and quality gate is in `docs/2026-09-21-gta-collection-depth-todo.md`.
**Auditor context:** The user flagged GTA Online vehicles and “many other pages” as shallow vs gtabase.com, plus duplicate `name` data.
**Method:**
- Pulled `gta_wiki_collection_pages_view` + `gta_wiki_collection_datasets.meta_json.columns/itemFields/display` + sampled `gta_wiki_collection_items.fields_json` from managed-dev (`bbtcaurrtyoukvjbxbbj.supabase.co`) on 2026-09-21.
- Fetched GTABase detail pages for calibration: `/grand-theft-auto-v/vehicles`, `/vehicles/grand-theft-auto-v/horus` (Super), `/grand-theft-auto-v/weapons`, `/weapons/grand-theft-auto-v/el-strickler-military-rifle`, `/grand-theft-auto-v/radio-stations`, plus index filters/descriptions for vehicles/weapons (features, acquisition, performance).
- Counted “generic cardSummary” pattern: `Open Wheel vehicle...`, `Use the image to confirm...`, `Use the item image and location note...`, `listed Online vehicle entry`.
- Documented duplicate `name` pattern: `item_name` (primary key) re-stored as `fields_json.name` (see `supabase/schema.sql:8825` + `apps/web/src/lib/gta.ts:PublishedGtaCollectionRuntime`).

---

## 0) Global Findings — Fix Once, Benefits Everywhere

### 0.1 Duplicate `name` field on ~90% of collections
**What we do:** `gta_wiki_collection_items.item_name` holds the canonical name (unique per dataset). Yet `fields_json.name` repeats it, and `meta_json.columns` lists `name` again. Cards/tables then render the same string twice — once as title, once as a row field.
**Where:** All collections where `columns[0]=="name"` — roughly **220/281**. Worst on thin pages where *only* fields are `name` + one other (e.g., `gta-4-vehicles: [name, category, cardSummary]`). The card shows: **Title = “Banshee”**, **Field 1 = Name: Banshee** — pure duplication, no added value.
**GTABase contrast:** GTABase never stores a separate “Name” column; the page title *is* the name. Detail tables start directly with useful fields: Manufacturer, Class, Price, Acquisition, etc.
**To-do:** Deprecate `fields_json.name` everywhere; remove `name` from `meta_json.columns/itemFields/cardFields/tableFields`. Keep `item_name` as sole source. One-time migration + renderer update (`apps/web/src/lib/gta.ts`, `apps/web/src/app/(site)/gta/wiki/[slug]/[collection]/page.tsx`).

### 0.2 Generic `cardSummary` filler instead of real data
**Pattern:** When research ran thin, the row was filled with templated fallback:
- `gta-online-vehicles`: `"Open Wheel vehicle in GTA Online."` / `"listed Online vehicle entry."` (same for all 896 rows)
- `gta-4-vehicles`, `gta-san-andreas-vehicles`, etc.: `"Sports & super cars. Use the image to confirm the model and variant."`
- `gta-iii-vehicles`, `gta-vice-city-vehicles`, `gta-iii-weapons`, etc.: `"Use the item image and location note to identify this entry."`

GTABase has **zero** filler: every vehicle has a bespoke description (“Do you hate it when tech takes you out of the moment? So do Pegassi...”), plus distinct per-field data. Filler kills SEO and user trust — looks like an unfinished database.

**To-do (global):** Treat `cardSummary` as optional detail, never as the *only* descriptive field. Enforce audit rule: if `fields_json` outside `cardSummary` ≤2 useful fields, block publish (or flag as “needs enrichment”).

### 0.3 Shallow schema overall
- **~109 collections** have **≤4 columns** (including `name`+`cardSummary`). After removing the duplicate `name` and filler, they often expose **1–2 real fields**.
- Even “deep” GTA 5 Story Mode collections (e.g., `gta-5-vehicles` with 13 fields) miss **50%+ of GTABase fields** (see §1).
- GTABase vehicle detail = **~25 filterable/sortable fields** + per-vehicle private stats (explosive resistance, real top speed, lap time, weight, etc.). We expose **3 fields** for the flagship GTA Online vehicles — the same page users compare us against.

---

## 1) Flagship Gap — GTA Online & GTA 5 Vehicles (Must-Fix P0)

### Why P0
- Most traffic among all GTA collections (GTA Online is live-service; GTA 5 Story Mode is evergreen). User explicitly called this out.
- GTABase’s vehicle list is its #1 competitive moat: filterable by class/manufacturer/price/top speed/edition/acquisition/storage/feature, with per-vehicle micro-data.

### 1.1 `gta-online-vehicles` (896 items) — Our weakest flagship
**Our current `meta_json.columns` (4):**
`name, category, availability, cardSummary` → rendered as `display.cardFields: [name, category, availability]`; sample row:
```json
{ "category": "Open Wheel", "availability": "listed Online vehicle entry.", "cardSummary": "Open Wheel vehicle in GTA Online." }
```
**GTABase fields per vehicle (Pegassi Horus as example) — 24+ fields we miss:**
| GTABase field | Example value | Us in DB? |
|---|---|---|
| Vehicle Class | Super | ✓ (as `category`, but GTABase class taxonomy is richer — 20+ classes) |
| Manufacturer | Pegassi (with logo/branding page) | ❌ |
| Vehicle Features | Has Liveries, HSW Upgrade, Missile Lock-On Jammer, Weaponized/Armored/Custom/Tuner/Drift flags | ❌ |
| Acquisition / Store | Legendary Motorsport ($2,810,000), Southern San Andreas, Warstock, Elitás, DockTease, Benny’s, ArenaWar, Trade Price unlock | ❌ (we have generic `availability` string) |
| GTA Online Price (+ Trade Price) | $2,810,000; Trade Price / unlock task | ❌ |
| Sell value & rules | $500k cap, weekly diminishing returns (60%→50%→10%…) since 2026-05-14 | ❌ |
| Storage Location | Garage (Personal), Pegasus, Hangar, Facility, etc. | ❌ |
| Delivery / Request | Mechanic, Pegasus, SecuroServ CEO, Service Vehicles | ❌ |
| Modifications / Workshop | LSC, LS Car Meet, Benny’s, Hangar, MOC/Avenger, Facility, Nightclub, Arena | ❌ |
| Race Availability | Can be used in Races (or restricted) | ❌ |
| Top Speed (Game Files) | 109.67 mph / 176.50 km/h | ❌ |
| Real Top Speed (Broughy1322 tested) + Lap Time | e.g., 94.70 / lap time circuit | ❌ |
| Based on (Real Life) | Pagani Zonda | ❌ |
| Model ID | `horus` | ❌ |
| Seats / Mass / Weight | 2 seats, 1,230 KG | ❌ |
| Drive Train / Gears | RWD, 6 gears | ❌ |
| GTA V Stats (Rockstar official) | Speed 94.70, Accel 96.00, Braking 29.00, Handling 100.00, Overall 79.93 | ❌ (only gta-5 story vehicles have 4 stats) |
| Explosive Resistance | Homing 1, RPG 1, Explosive Rounds 2, Tank Cannon 1, AA Trailer 1 | ❌ |
| DLC / Title Update + Release Date | 1.73 Kortz Center Heist, 2026-09-10 | ❌ |
| Platforms / Game Edition | PC, PS5, XSX|S, PS4, XBO / GTA Online exclusive | ❌ |
| Description (lore) | “Do you hate it when tech takes you out...” | ❌ (our cardSummary is generic) |
| Images / Custom Paint Jobs | Multiple screenshots + user livery gallery | partial (we have 1 image per row, no gallery) |

**Backlog task:** Rebuild `gta-online-vehicles` schema to ~15-20 fields. Minimum viable deep set (Phase 1): `manufacturer, class, price, tradePrice, tradePriceUnlock, acquisition, storage, modifications, raceAvailability, topSpeedGameFiles, topSpeedReal, lapTime, seats, weight, drivetrain, features[], description, titleUpdate, releaseDate, platforms, realLifeCounterpart, modelId`. Keep `cardSummary` only if bespoke.

### 1.2 `gta-5-vehicles` (321 items, Story Mode) — Deepest we have, still ~50% missing vs GTABase
**Our columns (13):** `manufacturer, seats, availability, edition, acquisition, storyPrice, storage, protagonistOwnership, speed, acceleration, braking, handling, cardSummary` — best in the repo, but:
- Missing: `topSpeedGameFiles, realTopSpeed, lapTime, mass/weight, drivetrain, gears, features[], sellValue, raceAvailability, dlcTitleUpdate, releaseDate, platforms, realLifeCounterpart, modelId, explosiveResistance, description`.
- `storyPrice` vs GTABase `GTA Online Price` confusion: GTABase treats Vehicles as **unified GTA5+Online (803 vehicles)** with edition filters; we split into `gta-5-vehicles` (321) and `gta-online-vehicles` (896) = 1,217 total, implying double-counting and conflicting prices/availability. Align taxonomy or document split explicitly.

### 1.3 All other `vehicles` collections (14 more games, P1)
**All thin — 3 fields only:**
- `gta-vehicles`, `gta-2-vehicles`, `gta-london-1961-vehicles`, `gta-london-1969-vehicles`, `gta-4-vehicles`, `gta-4-tlad-vehicles`, `gta-4-tbogt-vehicles`, `gta-iii-vehicles`, `gta-vice-city-vehicles`, `gta-san-andreas-vehicles`, `gta-liberty-city-stories-vehicles`, `gta-vice-city-stories-vehicles`, `gta-chinatown-wars-vehicles`, `gta-advance-vehicles`
- Sample: `gta-4-vehicles: [name, category, cardSummary]` where `cardSummary` = filler. No price, acquisition, stats, real-life counterpart, etc., though older games have fewer intrinsic fields — but GTABase still provides: class, manufacturer, locations/Spawn points, story availability, etc.

**Per-game missing (template):**
- GBA/Advance & Chinatown Wars: Add `acquisition` (street/shop/reward), even if no “manufacturer”.
- 3D era (III, VC, SA, LCS, VCS): Add `acquisition` (street/spawn/Ammu-Nation/Import-Export), `spawnLocations`, `realLifeCounterpart` where iconic, `stats` if available in game files. GTABase for these titles shows “Vehicle Stats & Locations — how to get” with map locations — we have none.

---

## 2) Weapons — Second Biggest Gap (P0)

### Coverage
16 collections: `gta-weapons`, `gta-2-weapons`, `gta-iii-weapons`, `gta-vice-city-weapons`, `gta-san-andreas-weapons`, `gta-liberty-city-stories-weapons`, `gta-vice-city-stories-weapons`, `gta-chinatown-wars-weapons`, `gta-advance-weapons`, `gta-4-weapons`, `gta-4-tlad-weapons`, `gta-4-tbogt-weapons`, `gta-5-weapons`, `gta-online-weapons` (111 Online-only rows) + two weapon-adjacent?

**Our shallow set (majority):**
- `gta-online-weapons`, `gta-4-weapons`, `gta-san-andreas-weapons`, etc.: `[name, category, availability, cardSummary]` → sample: `{category:"Melee", availability:"Pickup, Ammu-Nation...", cardSummary:"Melee. Episode or returning weapon..."}` — again generic.
- `gta-5-weapons` is slightly deeper but still filler outside core.

**GTABase weapons depth per weapon (El Strickler as example, Assault Rifles):**
| GTABase field | Example | Us? |
|---|---|---|
| Weapon Class | Assault Rifles | ✓ (`category`) |
| Manufacturer | Vom Feuer | ❌ |
| Acquisition + Price | Gun Van (Rotating Stock) $695,000; Ammu-Nation / Agency Armory / Weapon Workshop / Gun Van location rotation | ❌ (generic `availability`) |
| GTA Online Price + discounted / GTA+ early access | $695,000; GTA+ FREE until date | ❌ |
| Damage / Fire Rate / Accuracy / Range / Clip Size / Overall + Ammo Capacity (30/45 ext) | 38.00, 55.00, 45.00, 45.00, 40.00, 44.60 | ❌ (we have zero stat columns) |
| Modifications / Attachments | Extended clip, Scope, Flashlight, Tints, Liveries, Mk II upgrade path | ❌ |
| Based on (Real Life) | Steyr AUG A3; KH-2002 | ❌ |
| DLC / Title Update + Release Date + Platforms | 1.70 Agents of Sabotage, 2024-12-10, PS5/XSX|S only (exclusive) | ❌ |
| Description (lore) | “Nothing screams ‘Class Act’ like…” | ❌ |
| Similar Weapons / Appears In (Motor Wars Cayo Perico) | Cross-links | ❌ |

**Also weapons-specific for GTA Online:** Gun Van rotation, trade price, rank unlock, daily discount, limited-time FREE.

**To-do:** Upgrade all weapon collections to minimum: `weaponClass, manufacturer, price, acquisition, availabilityDetails, damage, fireRate, accuracy, range, clipSize, ammoCapacity, extendedAmmo, modifications[], realLifeCounterpart, titleUpdate, releaseDate, platforms, description`. For older games, include `spawnLocations, purchaseLocations, missionRewards`.

---

## 3) Characters — Thin Biography Layer (P0/P1)

**Coverage:** 16 collections (every GTA game). All but a few share identical shallow schema:
- `gta-characters`, `gta-2-characters`, `gta-4-characters`, `gta-4-tlad-characters`, `gta-4-tbogt-characters`, `gta-advance-characters`, `gta-chinatown-wars-characters`, `gta-liberty-city-stories-characters`, `gta-vice-city-characters`, `gta-san-andreas-characters` etc.: `[name, role, cardSummary]` (or `[name, role, affiliation]` for London).
- Exception: `gta-iii-characters` has `performer` (voice actor) — still shallow; `gta-online-characters` (71) = `[name, role, cardSummary]` even though GTABase splits Online characters by update era with full bios.

**GTABase character page includes (e.g., Michael, Franklin, Horus-related Juan Strickler for weapons):**
- Full biography / background, affiliation (gang/faction), first appearance / missions appearing in, voice actor / performer, affiliations, aliases, canonical status (story vs Online), image gallery, related characters/missions.

**Missing for all 16:** `affiliation/faction, voiceActor/performer (only 1/16 has it), firstAppearanceMission, missionsAppearingIn[], bioLong (vs truncated cardSummary), status (alive/dead/playable/antagonist), age/birthYear, relatedMissions[]`. For GTA Online’s 71 characters: add `eraTitleUpdate, roleDescription (mission giver vs business contact)`.

---

## 4) Radio Stations — Song Data Missing (P1)

**Coverage:** 13 collections: `gta-radio-stations`, `gta-2-radio-stations`, `gta-london-*`, `gta-iii-radio-stations`, etc., plus `gta-4-radio-stations`, `gta-5-radio-stations` (22), `gta-online-radio-stations` (25).

**Our columns:**
- Most: `[name, genre, host, cardSummary]` or even thinner `[name, role, cardSummary]` (e.g., `gta-iii`, `gta-san-andreas`, `gta-vice-city`). `gta-chinatown-wars` = `[name, availability, genre]`.
- No song-level data.

**GTABase has per-station:**
- Host (e.g., DJ Green Lantern / Mister Cee), **full tracklist** (GTA 5 = 750+ songs across 26 stations, each station detail lists every Artist–Title), genre tags, talk vs music, Online-exclusive vs story, update added via Title Update, station artwork, in-game frequency/dial position, “Enhanced Edition” expansion notes.

**To-do:** Add `host, genre, frequency, eraAdded, tracklist[] (artist/title/album, optionally preview link), exclusiveTo (Story/Online), description`. For older games where tracklists are curated/licensed, GTABase still lists full song tables — parity is achievable and expected by users.

---

## 5) Missions / Story — Mixed Depth, Needs Normalization

**“Deep” examples that are closer to GTABase:**
- `gta-story-missions` (90): `[name, chapter, city, missionGroup, missionNumber, missionType, availability, location, objective, reward, unlocks, cardSummary]` — 12 fields, good.
- `gta-kill-frenzies` (70) / `gta-2-kill-frenzies` (60): 11/9 fields with coordinates, timer, requirement, etc.
- `gta-5-story-missions` (87): presumably deeper (not in shallow list).

**Thin / filler missions that need enrichment:**
- `gta-iii-vehicle-missions`, `gta-iii-rc-missions`, `gta-iii-off-road-challenges`, `gta-vice-city-rc-missions`, `gta-san-andreas-vehicle-missions`, `gta-vice-city-street-races`, `gta-liberty-city-stories-drive-by-missions`, `gta-advance-demolition-football`, etc.: `[name, category, cardSummary]` only → sample: `"Firefighter appears among ..."` — placeholder, not a mission brief.
- `gta-online-contact-missions` (220), `gta-online-heists` (11), `gta-online-adversary-modes` (70), `gta-online-races` (153), `gta-online-deathmatches` (77): most are `[name, addedIn, modeDescription]` or `[name, role]` — missing **payout, crew size, rank unlock, difficulty, contact giver, location, replay availability**, which GTABase shows per job (e.g., Contact Mission giver: Gerald/Lester, payout $X/$Y hard, unlock rank).

**GTABase missions per-mission includes:**
- Giver/Contact, Rank Unlock, Payout (Normal/Hard), Crew Min/Max, Location(s), Objectives, Rewards (RP/cash/vehicle unlocks), Prerequisites / Unlocks next mission, Story vs Online flag, Title Update added.

**Rule of thumb:** If a collection’s `fields_json` sample starts with `"X appears among Grand Theft Auto Y's ..."` — it’s a stub and must be enriched before it earns SEO trust.

---

## 6) Cheats — Moderate

**Collections:** 13 cheats lists (e.g., `gta-cheats` = 5 fields: `name, platform, activation, effect, cardSummary` — actually reasonable; `gta-2-cheats` = 6 with per-platform codes; `gta-iii-cheats`: `name, code, availability`).

**Missing vs GTABase:**
- GTABase splits by platform (PS5/PS4/PS3, Xbox, PC, mobile for older), provides **button combo vs phone number vs typed code**, effect category, warning (trophies disabled, etc.), and per-cheat video.
- Our `gta-4-cheats` has `role, phoneNumber` but `cardSummary` holds effect — ok but inconsistent taxonomy. Normalize to: `cheatName, effect, phoneNumber, buttonComboPS, buttonComboXbox, pcCode, platform[][], category, warning, achievementBlock`.

---

## 7) Collectibles & Progression Routes — Good Counts, Thin Location Data

These are our “collectible” `page_type` (progress-checklist) pages. Counts are correct vs known game data, but GTABase adds the value.

| Collection | Our fields | GTABase adds |
|---|---|---|
| `gta-4-flying-rats` (200), `gta-online-action-figures` (100), `gta-online-playing-cards` (54), `gta-online-signal-jammers` (50), `gta-online-peyote-plants` (76) etc. | Mostly `name, location, coordinates, cardSummary` + maybe `reward` | Map image per location, area district, time/weather, bonus reward chain (e.g., 50 pigeons → helicopter at heliport), video guide, coordinates with copy-button, sequential order |
| `gta-iii-hidden-packages` (100), `gta-san-andreas-horseshoes` (50), `oysters` (50), `snapshots` (50), `gang-tags` (100) | Often generic | Per-package map thumbnail, reward per 10 packages (weapons at safehouse), district |
| `gta-5-letter-scraps` (50), `spaceship-parts` (50), `nuclear-waste` (30), `submarine-pieces` (30) | Better — have `area, completion` | District + required equipment (e.g., Trackify app, submarine), reward chain |

If the page is `collectible` and still says “Use the item image...”, it defeats the “checklist” purpose — user needs actionable location hints without leaving the page.

---

## 8) Remaining “Long Tail” — One-Liners That Should Not Ship Thin

These collections have a single real field plus `name`:

**Examples flagged (shallow ≤2 useful fields):**
- `gta-4-multiplayer`, `gta-4-tbogt-multiplayer`, `gta-4-tlad-multiplayer`, `gta-chinatown-wars-multiplayer`, `gta-liberty-city-stories-multiplayer`, `gta-vice-city-stories-multiplayer`, `gta-san-andreas-multiplayer` (2): `[name, category]`
- `gta-online-criminal-careers` (4), `gta-online-freemode-activities` (6), `gta-online-jobs` (8), `gta-online-property-locations` (1): `[name, category]` — yet GTABase for these has detailed payout/unlock/business profit tables.
- `gta-advance-vehicles`, `gta-advance-weapons`, `gta-chinatown-wars-vehicles/weapons`, `gta-london-*-vehicles`, `gta-iii-vehicles/weapons`, `gta-vice-city-vehicles/weapons`, `gta-san-andreas-vehicles/weapons`: see §1-2.
- `gta-san-andreas-schools` (4), `schools` → should list `lessonName, instructor, location, reward, vehicleUnlock, gold/silver/bronze thresholds` (GTABase driving school shows per-license breakdown).
- `gta-san-andreas-properties-assets` (10), `properties` → GTABase has `price, income per day, location, acquisition mission, revenue cap`.

**Decision:** Either enrich to GTABase depth or consolidate thin pages (e.g., merge “Multiplayer modes” into wiki hub rather than a standalone 5-item collection with 2 fields). Shipping 1-field collections hurts crawl budget and looks auto-generated.

---

## 9) Full Backlog — All 281 Collections Ranked

Legend: **P0** = flagship/high traffic + largest GTABase gap. **P1** = meaningful gap, clear GTABase precedent. **P2** = improve filler/duplicate or consolidate.

### P0 — Fix first (user-cited + highest SEO/utility ROI)
- `gta-online-vehicles` (896) — 4→20 fields, see §1.1
- `gta-online-weapons` (111) — §2
- `gta-5-weapons` (59) — same schema as Online weapons
- `gta-5-vehicles` (321) — fill remaining 10 fields (§1.2)
- `gta-san-andreas-vehicles` (208), `gta-4-vehicles` (121), `gta-iii-vehicles` (61): prototype the “classic vehicle” enrichment template (§1.3), then roll out to remaining 11 vehicle lists
- `gta-online-properties` (27), `gta-online-businesses` (16): GTABase property pages include price, income, location, staff upgrades, daily payout — we have `[name, category]` stubs via `property-locations`
- `gta-online-heists` (11) + `gta-5-heists` (6): add giver, payout (normal/hard), setup cost, crew roles, elite challenge, unlock

### P1 — Next wave (thin but high expectation)
**Vehicles (remaining 11):** `gta-vehicles` (75), `gta-2-vehicles` (79), `gta-iii-vehicles`, `gta-vice-city-vehicles`, `gta-liberty-city-stories-vehicles` (82), `gta-vice-city-stories-vehicles`, `gta-chinatown-wars-vehicles` (70), `gta-advance-vehicles` (28), `gta-london-1961/1969-vehicles` (37 each), `gta-4-tbogt-vehicles` (31), `gta-4-tlad-vehicles` (24)

**Weapons (remaining 14):** `gta-weapons` (4), `gta-2-weapons` (18), `gta-iii-weapons` (13), `gta-vice-city-weapons`, `gta-san-andreas-weapons` (44), `gta-liberty-city-stories-weapons` (35), `gta-vice-city-stories-weapons`, `gta-chinatown-wars-weapons` (28), `gta-advance-weapons` (13), `gta-london-*` (4 each), `gta-4-weapons` (16), `gta-4-tbogt/tlad-weapons` (24/21)

**Characters (all 16):** `gta-characters` (92), `gta-2-characters` (118), `gta-iii-characters` (34), `gta-vice-city-characters` (32), `gta-san-andreas-characters` (120), `gta-liberty-city-stories-characters` (75), `gta-vice-city-stories-characters`, `gta-chinatown-wars-characters` (27), `gta-advance-characters` (16), `gta-4-characters` (58), `gta-4-tlad-characters` (18), `gta-4-tbogt-characters` (9), `gta-5-characters` (89), `gta-online-characters` (71), `gta-london-*` (35/22). All need biography/affiliation/voice actor/missionsAppearingIn.

**Radio (13):** All radio collections — add tracklists. Prioritize `gta-5-radio-stations` (22) + `gta-online-radio-stations` (25) (750 songs), then `gta-san-andreas-radio-stations` (13), `gta-vice-city-radio-stations` (10), `gta-4-radio-stations` (23).

**Collectibles (progress) with good counts but thin locs:** `gta-online-signal-jammers` (50), `action-figures` (100), `playing-cards` (54), `peyote-plants` (76), `gta-5-letter-scraps` (50), `spaceship-parts` (50), `nuclear-waste` (30), `gta-4-flying-rats` (200), `gta-iii-hidden-packages` (100) etc. — add per-location map/thumb + reward chain.

**Missions thin:** `gta-online-contact-missions` (220), `adversary-modes` (70), `races` (153), `deathmatches` (77), `survivals` (32), plus all `off-road-challenges`, `rc-missions`, `vehicle-missions`, `stunt-jumps`, `unique-stunt-jumps` (thin stubs).

**Cheats (13):** Normalize schema; add per-platform input method + trophy warning.

### P2 — Cleanup / consolidate or enrich filler
Collections where ≤2 useful fields survive after removing `name`+`cardSummary` (106 collections listed in audit script). Either enrich with GTABase fields or merge into parent wiki hub:

```
gta-characters, gta-power-ups, gta-2-characters, gta-2-power-ups, gta-4-characters, gta-4-friend-activities, gta-4-multiplayer, gta-4-side-missions-activities, gta-4-vehicles, gta-4-weapons, gta-4-tbogt-*, gta-4-tlad-*, gta-5-stats-and-abilities, gta-advance-*, gta-chinatown-wars-characters/multiplayer/vehicles/weapons, gta-iii-characters/gangs/off-road/rc/vehicle-missions/vehicles/weapons, gta-liberty-city-stories-*, gta-london-*, gta-online-characters/criminal-careers/freemode-activities/jobs/property-locations/races/vehicles, gta-san-andreas-asset-missions/challenge-families/characters/gangs/import-export/multiplayer/properties-assets/races/radio-stations/schools/stadium-events/vehicle-missions/vehicles/weapons, gta-vice-city-* (all), gta-vice-city-stories-* etc. (full 106 in /tmp/gta_cols_dump.json shallow set)
```
*See Appendix B for exhaustive code list.*

---

## 10) Recommended Field Templates (to reach GTABase parity)

### Vehicles (apply to all 16; extend for Online/5)
`manufacturer, modelId, class, category, price, tradePrice, tradePriceUnlock, acquisition (store/spawn/reward + site URL), availabilityEdition (Story/Online/exclusive), edition/platforms, releaseDate/titleUpdate, realLifeCounterpart, seats, massWeight, drivetrain, gears, topSpeedGameFiles, topSpeedRealBroughy, lapTime, statsOfficial {speed,accel,braking,handling,overall}, explosiveResistance{homing,rpg,extended...}, features[] (liveries,hsw,weaponized,armored...), storageLocation, deliveryMethod, modifications[]/workshops, raceAvailability, sellValue/sellRules, descriptionLore, imageGallery[]`

*Classic titles (III/VC/SA):* keep subset (`acquisition/spawnLocations, appearanceCity, realLifeCounterpart, statsIfAvailable, priceIfBuyable`) but never just `category`.

### Weapons (all 16)
`weaponClass, manufacturer, price, acquisition (Ammu-Nation/Gun Van/Agency/Workshop), rankUnlock, damage, fireRate, accuracy, range, clipSize, overall, ammoCapacity, extendedAmmo, mods/attachments[], tints/liveries, mkIIUpgrade, realLifeCounterpart, titleUpdate, releaseDate, platforms/edition, descriptionLore, similarWeapons[], appearsInMissions[]`

### Characters (all 16)
`role, affiliation/gang, status (playable/antagonist/civilian), bioLong, firstAppearanceMission, missionsAppearingIn[], voiceActor/performer, affiliationLeadership, age/location, relatedCharacters[], eraTitleUpdate (for Online)`

### Radio (13)
`genre, host/DJ, frequency, eraAdded/titleUpdate, tracklist[] {artist, title, year}, exclusiveTo, description, stationArtwork`

### Missions / Heists / Jobs / Adversary Modes
`giver/contact, location/area, rankUnlock, crewMinMax, payoutNormal/Hard (cash+RP), setupCost, difficulty, prerequisites/unlocks, replay, storyVsOnline, titleUpdate/releaseDate, rewards (vehicle/unlock), eliteChallenge (for heists)`

### Cheats (13)
`cheatName, effect, category, phoneNumber, buttonComboPS, buttonComboXbox, pcTypedCode, platformAvailability[], warningAchievementBlock, gameEdition`

---

## Appendix A — What “Deep” Looks Like in Our Own DB (reference)

`gta-5-vehicles` (13 fields) — the only collection that feels hand-researched; use as template:
`manufacturer, seats, availability, edition, acquisition, storyPrice, storage, protagonistOwnership, speed, acceleration, braking, handling, cardSummary` (+ display groups). Even this needs +10 fields to match GTABase.

`gta-story-missions` (12 fields) + `gta-kill-frenzies` (11 fields) — similarly substantive; model other mission/challenge collections on these.

## Appendix B — Exhaustive Code List (281)

Generated from `gta_wiki_collection_pages_view` ordered by `wiki_slug, collection_slug` (managed-dev 2026-09-21). Item counts in parentheses.

**gta (11):** gta-characters (92), gta-cheats (50), gta-crane-bonuses (44), gta-gangs-and-factions (8), gta-kill-frenzies (70), gta-power-ups (7), gta-radio-stations (7), gta-respray-bomb-shops (2), gta-story-missions (90), gta-vehicles (75), gta-weapons (4)
**gta-2 (11):** gta-2-characters (118), gta-2-cheats (35), gta-2-gangs (7), gta-2-kill-frenzies (60), gta-2-power-ups (15), gta-2-radio-stations (11), gta-2-special-tokens (150), gta-2-story-missions (67), gta-2-vehicles (79), gta-2-wang-cars (1), gta-2-weapons (18)
**gta-4 (13):** gta-4-achievements-and-trophies (51), gta-4-characters (58), gta-4-cheats (30), gta-4-flying-rats (200), gta-4-friend-activities (8), gta-4-gangs-and-factions (21), gta-4-multiplayer (15), gta-4-radio-stations (23), gta-4-safehouses (5), gta-4-side-missions-activities (20), gta-4-story-missions (90), gta-4-stunt-jumps (50), gta-4-vehicles (121), gta-4-weapons (16)
**gta-4-tbogt (16):** achievements-trophies (10), activities (8), base-jumps (15), characters (9), club-management (8), drug-wars (25), friend-activities (7), gangs-and-factions (8), multiplayer (5), radio-media (6), random-characters (5), safehouses (1), seagulls (50), story-missions (26), triathlons (3), vehicles (31), weapons (24) [17 inc. radio/media]
**gta-4-tlad (16):** achievements-trophies (5), activities (4), angus-bike-thefts (10), bike-races (12), characters (18), gang-wars (25), gangs-and-factions (8), multiplayer (7), radio-media (6), random-characters (4), safehouses (2), seagulls (50), story-missions (22), stubbs-dirty-laundry (5), vehicles (24), weapons (21)
**gta-5 (28):** achievements-and-trophies (51), animals (29), characters (89), cheats (36), epsilon-tracts (10), gangs-and-factions (15), heist-crew (13), heists (6), hidden-packages (15), hobbies-and-pastimes (61), knife-flights (15), letter-scraps (50), monkey-mosaics (50), nuclear-waste (30), peyote-plants (27), properties (23), radio-stations (22), random-events (60), spaceship-parts (50), stats-and-abilities (8), story-missions (87), strangers-and-freaks (66), stunt-jumps (50), submarine-pieces (30), under-the-bridge (50), vehicles (321), weapons (59)
**gta-advance (13):** characters (16), cheats (9), demolition-football (1), gangs-and-factions (7), hidden-packages (100), radio-media (8), rampages (21), safehouses (3), story-missions (41), street-races (18), vehicle-missions (4), vehicles (28), weapons (13)
**gta-chinatown-wars (19):** characters (27), cheats (21), drug-dealers (80), gangs-and-factions (11), liberty-city-gun-club (5), lions-of-fo (2), multiplayer (6), odd-jobs (7), radio-stations (12), rampages (35), random-encounters (14), riding-shotgun (8), safehouse-trophies (8), safehouses (21), security-cameras (100), story-missions (65), street-races (8), time-trials (30), unique-stunt-jumps (30), vehicle-missions (4), vehicles (70), weapons (28) [actually 22]
**gta-iii (12):** achievements-trophies (73), characters (34), cheats (25), gangs-and-factions (8), hidden-packages (100), import-export (39), missions (68), off-road-challenges (4), radio-stations (10), rampages (20), rc-missions (4), safehouses (3), unique-stunt-jumps (20), vehicle-missions (4), vehicles (61), weapons (13) [16 inc. achievements]
**gta-liberty-city-stories (17):** assets (4), car-azy-car-giveaway (16), characters (75), cheats (43), drive-by-missions (3), gangs-and-factions (13), hidden-packages (100), misc-challenges (11), multiplayer (7), radio-stations (11), rampages (20), rc-challenges (4), safehouses (3), story-missions (70), street-races (6), unique-stunt-jumps (26), vehicle-missions (5), vehicles (82), weapons (35)
**gta-london-1961 (11):** characters (22), cheats (17), crane-bonuses (26), gangs-and-factions (5), kill-frenzies (7), power-ups (6), radio-stations (12), respray-bomb-shops (2), story-missions (7), vehicles (37), weapons (4)
**gta-london-1969 (11):** characters (35), cheats (33), crane-bonuses (25), gangs-and-factions (10), kill-frenzies (21), power-ups (6), radio-stations (12), respray-bomb-shops (2), story-missions (39), vehicles (37), weapons (4)
**gta-online (33):** action-figures (100), adversary-modes (70), awards (456), businesses (16), career-progress (140), characters (71), contact-missions (220), criminal-careers (4), deathmatches (77), freemode-activities (6), heists (11), jobs (8), last-team-standing (45), media-sticks (13), movie-props (10), peyote-plants (76), playing-cards (54), properties (27), property-locations (1), races (153), radio-stations (25), signal-jammers (50), survivals (32), title-updates (49), vehicles (896), weapons (111), plus businesses/career etc.
**gta-san-andreas (24):** achievements-trophies (82), asset-missions (5), challenge-families (5), characters (120), cheats (91), courier-missions (3), gang-tags (100), gangs-and-factions (2), gangs-and-territories (10), horseshoes (50), import-export (31), multiplayer (2), oysters (50), properties-assets (10), races (7), radio-stations (13), safehouses (37), schools (4), snapshots (50), stadium-events (4), story-missions (101), unique-stunt-jumps (70), vehicle-missions (6), vehicles (208), weapons (44)
**gta-vice-city (15+):** achievements-trophies (77), assets (10), characters (32), cheats (61), chopper-checkpoints (4), gangs-and-factions (12), hidden-packages (100), missions (62), off-road-challenges (4), radio-stations (10), rampages (35), rc-missions (2), safehouses (5), stadium-events (2), store-robberies (1), street-races (4), unique-stunt-jumps (36), vehicle-missions (6), vehicles (101), weapons (33) [per view ~20]
**gta-vice-city-stories (21):** characters, cheats, destruction-challenges, empire-building-sites, empire-business-types, gangs-and-factions, impound-vehicles, multiplayer, radio-stations, rampages, red-balloons (99), safehouses, shooting-range, story-missions, street-races, swingers-club, time-trials, unique-stunt-jumps, vehicle-missions, vehicles, weapons
*Full machine-readable dump: `/tmp/gta_cols_dump.json` and live view `gta_wiki_collection_pages_view`.*

## Appendix C — Methodology Notes & Sources

- GTABase vehicle index: `https://www.gtabase.com/grand-theft-auto-v/vehicles/` — lists 803 GTA 5 + Online vehicles with filters Class/Manufacturer/Edition/Title Update/Acquisition/Storage/Feature; each vehicle detail (e.g., Horus) at `https://www.gtabase.com/vehicles/grand-theft-auto-v/horus` exposes the 24-field set above.
- GTABase weapons index: `https://www.gtabase.com/grand-theft-auto-v/weapons/` (filter by Type/Class/Edition) → detail `https://www.gtabase.com/weapons/grand-theft-auto-v/el-strickler-military-rifle` (stats/customization/real-life/acquisition/release).
- GTABase radio: `https://www.gtabase.com/grand-theft-auto-v/radio-stations/` → per-station tracklists (26 stations, 750+ songs).
- Our schema reference: `supabase/migrations/20260920000017_add_gta_content_platform.sql:108` and `supabase/schema.sql:8796` (`gta_wiki_collection_datasets/item`), plus live `meta_json.columns` dump 2026-09-21.
- Duplicate-name sample: `gta-4-vehicles` item `Banshee` has `fields_json: {category:"Sports & super cars", cardSummary:"Sports & super cars. Use the image..."}` — card still redundantly echoes “Name: Banshee” via `meta_json.columns[0]=name`.

## Next Steps (suggested ticket split)

1. **P0 batch 1:** `gta-online-vehicles` + `gta-5-vehicles` + `gta-online-weapons` schema redesign (one design doc, three dataset refreshes). Fixes ~1,328 rows where depth gap is largest.
2. **P0 batch 2:** `gta-online-properties/businesses/heists` + `gta-5-heists`.
3. **P1:** Normalize `characters` template, then rollout to all 16 games (single research pass per character).
4. **P1:** Vehicles template for classics (single spec, 14 games).
5. **P1:** Radio tracklists (scripted scrape + manual QA).
6. **P2:** Audit all collections matching `sample starts with "X appears among ..."` → either enrich or de-publish/merge.
7. Global: de-duplicate `name` in batch; enforce “no publish with ≤2 useful fields” gate.

*No files were modified except this doc. To continue, pick one collection (recommended: `gta-online-vehicles`) and run the `bloxodes-gta-game-collection-refresh` skill for that single slug.*


## Production publication follow-up — 2026-09-26

The reviewed candidate is now live at web SHA `d62e52ee597b07b91893bd99d49eec896bf12fc9`: 281 collections, 10,793 actual item rows, 16 hubs and 32 hosted hub images. All production pointer/hash/count/copy checks and 281 collection URLs passed. The competitor comparison remains the qualified September 26 assessment above; publication does not establish universal GTABase parity. See the [release verification and outstanding cache configuration repair](2026-09-21-gta-collection-depth-todo.md#production-release-verification--2026-09-26).
