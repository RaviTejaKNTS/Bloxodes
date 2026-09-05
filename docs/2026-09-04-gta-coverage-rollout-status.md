# GTA coverage rollout status

Last verified: 2026-09-05

Scope: the approved released-game GTA coverage batch from Grand Theft Auto through Grand Theft Auto Online. The retained public set contains 16 GTA hubs; GTA VI is intentionally unpublished and excluded until the game is released.

Release status: production branch commit `cb22a99335caa0b7d34654dc5b58c7752dc91322` contains the completed release tooling, while the healthy web runtime remains on application SHA `a292b95f4506fcdb2198bd58af40294b17fd2339` because the final operational-only commits correctly skipped a container rebuild. Production has all 16 retained GTA hubs, 32 distinct Bloxodes-hosted R2 hub assets, and 173 published collection pages backed by 173 active immutable datasets and 7,529 active items. The collection split is 80 database pages and 93 checklist pages; there are zero drafts, zero missing published-dataset pointers, and zero page/dataset count mismatches.

Collection media: 7,508 active item rows have immutable R2 image keys. The only 21 text-only rows are non-physical GTA V cheat effects such as invincibility, weather changes, and wanted-level changes; they intentionally do not substitute generic artwork for an exact item image.

Hub media: every retained hub now has a source-checked cover plus a separate, enforced-square title thumbnail, both served from the shared Bloxodes wiki R2 bucket through `media.bloxodes.com`. Production readback verified 32 unique live URLs, 16/16 square thumbnails, and the current cover/thumbnail pointers in public cached HTML. GTA VI source rows remain preserved but unpublished.

Homelab preview access: use `http://teja-homelab.tail13b5bd.ts.net:3000` from a Tailscale-connected device, with `http://100.86.117.125:3000` as the direct-IP fallback. Append any route below to this base; `localhost` links are only for the homelab itself.

## Completed

### Grand Theft Auto IV (`gta-4`)

- Hub: `/gta/wiki/gta-4`
- Collections: vehicles (121), weapons (16), story missions (90), safehouses (5), achievements and trophies (51), Flying Rats (200), and Stunt Jumps (50).
- Media: 533 exact source images mapped and published through the immutable collection revisions.
- Verification: hub and all seven collection routes passed managed-development readback and route verification. Checklist `/page/2` routes return 404; database pagination is present where the collection size requires it. HTML-size audit stayed below the 1.8 MB limit for all seven routes.

### Grand Theft Auto: San Andreas (`gta-san-andreas`)

- Hub: `/gta/wiki/gta-san-andreas`
- Collections: vehicles (208), weapons (44), story missions (101), safehouses (37), Gang Tags (100), Snapshots (50), Horseshoes (50), Oysters (50), and Unique Stunt Jumps (70).
- Media: 710 exact source images mapped and published through immutable collection revisions.
- Verification: hub and all nine collection routes passed managed-development readback and route verification. Checklist `/page/2` routes return 404; database pagination works for Vehicles and Story Missions. All ten routes passed canonical, JSON-LD, sitemap, scoped-search, and HTML-size QA; the largest route was 1.390 MB.

### Grand Theft Auto: Vice City (`gta-vice-city`)

- Hub: `/gta/wiki/gta-vice-city`
- Collections: vehicles (107), weapons (35), missions (62 detailed table entries), safehouses (9), assets (10), Hidden Packages (100), Rampages (35), Unique Stunt Jumps (36), Store Robberies (15), and Chopper Checkpoints (4).
- Media: 413 exact source images mapped and published through immutable collection revisions.
- Verification: hub and all ten collection routes passed managed-development readback and route verification. Checklist `/page/2` routes return 404; Vehicles is the only Vice City collection that paginates in the current renderer. All eleven routes passed canonical, JSON-LD, sitemap, scoped-search, media-rendering, and HTML-size QA; the largest route was 1.543 MB.

### Grand Theft Auto III (`gta-iii`)

- Hub: `/gta/wiki/gta-iii`
- Collections: vehicles (61), weapons (13), missions (68 detailed table entries), safehouses (3), Hidden Packages (100), Rampages (20), Unique Stunt Jumps (20), and Import/Export (39).
- Media: 324 exact source images mapped and published through immutable collection revisions.
- Verification: hub and all eight collection routes passed managed-development readback and route verification. All checklist and database routes correctly return 404 for `/page/2` because none exceeds the current renderer page size. All nine routes passed canonical, JSON-LD, sitemap, scoped-search, media-rendering, and HTML-size QA; the largest route was 1.485 MB.

### Grand Theft Auto IV: The Lost and Damned (`gta-4-tlad`)

- Hub: `/gta/wiki/gta-4-tlad`
- Collections: vehicles (24; unused `packer2` excluded), weapons (21), story missions (22), safehouses (2), Seagulls (50), Random Characters (4 encounter rows), Angus' Bike Thefts (10), Stubbs' Dirty Laundry (5), Bike Races (12), Gang Wars (25 completion-counter rows), and Activities (4 required minigame wins).
- Media: 179 row images mapped and published; 132 exact source images plus 47 explicitly recorded contextual/reused images for fixed text lists or procedural counters.
- Verification: hub and all eleven collection routes passed managed-development readback and route verification. All collection `/page/2` routes correctly return 404. All twelve routes passed canonical, JSON-LD, sitemap, scoped-search, media-rendering, and HTML-size QA; the largest route was 0.538 MB. Friend Activities remain outside this first-pass collection set because the four required minigame wins are covered in Activities and the source does not expose a stable item-level image matrix for every friend/activity combination.

### Grand Theft Auto IV: The Ballad of Gay Tony (`gta-4-tbogt`)

- Hub: `/gta/wiki/gta-4-tbogt`
- Collections: vehicles (31 image-backed entries), weapons (24), story missions (26), safehouses (1), Seagulls (50), BASE Jumps (15), Club Management (8), Random Characters (5 encounters), Drug Wars (25-win 100% threshold), Triathlons (3), Activities (8), and Friend Activities (7).
- Media: 203 row images mapped and published; 150 exact source images plus 53 explicitly recorded contextual/reused images for procedural counters, shared activity images, and fixed lists without unique row screenshots.
- Verification: hub and all twelve collection routes passed managed-development readback and route verification. All collection `/page/2` routes correctly return 404. All thirteen routes passed canonical, JSON-LD, sitemap, scoped-search, media-rendering, and HTML-size QA; the largest route was 0.647 MB. Drug Wars intentionally stop at the 25-win 100% threshold, while the optional 26–50 weapon milestones remain described in the collection copy.

### Grand Theft Auto: Liberty City Stories (`gta-liberty-city-stories`)

- Hub: `/gta/wiki/gta-liberty-city-stories`
- Collections: vehicles (82 image-backed entries from the 87-entry `default.ide` source; five entries without useful exact gallery imagery are explicitly excluded), weapons (35), story missions (70), safehouses (3), Hidden Packages (100), Rampages (20), Unique Stunt Jumps (26), Assets (4), Vehicle Missions (5), Street Races (6), RC Challenges (4), Miscellaneous Challenges (11), and Car-azy Car Giveaway (16).
- Media: 382 row images mapped and published; all rows have exact source or exact reused item media. Car-azy vehicle rows reuse exact LCS vehicle-gallery images with the caveat recorded in the collection copy; no image gaps remain.
- Verification: hub and all thirteen collection routes passed managed-development readback and route verification. All collection `/page/2` routes return 404. All fourteen routes passed canonical, JSON-LD, sitemap, scoped-search, media-rendering, and HTML-size QA; the largest route was 1.659 MB. Browser backend was unavailable, so route QA used local HTTP fetches.

### Grand Theft Auto: Vice City Stories (`gta-vice-city-stories`)

- Hub: `/gta/wiki/gta-vice-city-stories`
- Collections: vehicles (107 image-backed entries from the 111-entry `default.ide` source; four entries without useful exact gallery imagery are explicitly excluded), weapons (37 listed table/gallery entries; the source article's 32-weapons/three-items summary is recorded as a discrepancy), story missions (59), safehouses (4), Empire Building Sites (30), Empire Business Types (6), Vehicle Missions (8), Turismo Street Races (9), Time Trials & Checkpoint Challenges (17 named rows covering the 32 course-set completions plus 13 named checkpoints), Civil Asset Forfeiture Impound Vehicles (32), Phil's Shooting Range (5 rounds), Swinger's Club (1), Destruction Challenges (2), Red Balloons (99), Rampages (35 PS2 superset; 30 on PSP), and Unique Stunt Jumps (36 PS2 superset; 30 on PSP).
- Media: 487 row images mapped and published; 478 exact source images plus 9 explicitly recorded contextual/reused images for the missing Firefighter screenshot, the shared Beach Patrol panel, Sanchez/BMX activity rows, and the five shooting-range rounds. No image gaps remain.
- Verification: hub and all sixteen collection routes passed managed-development copy, v2 audit, image-required checks, dry sync, publication, database readback, and route verification. The vehicles database serves `/page/2`; the other 15 collection/no-second-page checks return 404. All seventeen routes passed canonical, JSON-LD, sitemap, scoped-search, media-rendering, and HTML-size QA; the largest route was 1.522 MB with zero over-limit routes. Browser backend was unavailable, so route QA used local HTTP fetches.

### Grand Theft Auto: Chinatown Wars (`gta-chinatown-wars`)

- Hub: `/gta/wiki/gta-chinatown-wars`
- Collections: vehicles (70), weapons (28 source table/gallery entries), story missions (65: 58 core, five PSP extras, and two optional Social Club missions), random encounters (14), safehouses (21), vehicle missions (4), odd jobs (7), time trials (30: 26 all-platform and four PSP), street races (8), Liberty City Gun Club (5), Riding Shotgun (8: five shared and three PSP), drug dealers (80 required dealers; the Sean bonus is excluded), safehouse trophies (8), security cameras (100), Rampages (35: 30 shared and five PSP), Unique Stunt Jumps (30), and Lions of Fo (2 required random statues).
- Media: 515 row images mapped and published; 423 exact source images plus 92 explicitly recorded contextual/reused images for the odd-job routes, Gun Club courses, dealer gang portraits, and random Lions of Fo locations.
- Verification: hub and all seventeen collection routes passed managed-development copy, v2 audit, image-required checks, dry sync, publication, database readback, and route verification. All collection `/page/2` routes return 404. All eighteen routes passed canonical, JSON-LD, sitemap, scoped-search, media-rendering, and HTML-size QA; the largest route was 1.654 MB with zero over-limit routes. Browser backend was unavailable, so route QA used local HTTP fetches. One-section dataset warnings were expected for vehicle missions, odd jobs, Gun Club, safehouse trophies, and Lions of Fo.

### Grand Theft Auto Advance (`gta-advance`)

- Hub: `/gta/wiki/gta-advance`
- Collections: vehicles (28), weapons (13, including the combined Car Bomb / Detonator entry), story missions (41), safehouses (3), Street Races (18), Hidden Packages (100), Rampages (21), Vehicle Missions (4 systems), and Demolition Football (1 challenge).
- Media: 229 row images mapped and published through immutable collection revisions; all 229 rows have source-backed images. Rampage rows retain both source-listed spawn locations and their exact weapon/objective requirements; package rows retain source coordinates.
- Verification: hub and all nine collection routes passed managed-development copy, v2 audit, image-required checks, dry sync, publication, database readback, and route verification. All collection `/page/2` routes return 404. All ten routes passed canonical, JSON-LD, sitemap, scoped-search, media-rendering, and HTML-size QA; the largest route was 1.136 MB with zero over-limit routes. Browser backend was unavailable, so route QA used local HTTP fetches. One-section dataset warnings were expected for Vehicle Missions and Demolition Football.

### Grand Theft Auto 2 (`gta-2`)

- Hub: `/gta/wiki/gta-2`
- Collections: vehicles (79 entries: 69 named vehicles plus 10 source-listed wreckage models), weapons (18 image-backed playable entries), story missions (67), Special Tokens (150 PC/Dreamcast rows with PlayStation availability notes), Kill Frenzies (60 PC/Dreamcast rows), Wang Cars (one activity row requiring eight GT-A1s), and Gangs & Factions (7).
- Media: 382 row images mapped and published through immutable collection revisions; every row has source-derived media. The Wang Cars activity is represented as one row because the source does not provide a stable eight-location table. Deleted weapons, TBA PlayStation Frenzies, PlayStation-only token replacements without source imagery, optional under-construction Bonus Stages, and the separate reduced Game Boy Color edition remain explicit exclusions.
- Verification: hub and all seven collection routes passed managed-development copy, v2 audit, image-required checks, dry sync, publication, database readback, and route verification. Story Missions serves three district-sized database pages; the other collection `/page/2` routes correctly return 404. All ten valid routes passed canonical, JSON-LD, sitemap, scoped-search, media-rendering, and HTML-size QA; the largest valid route was 1.726 MB with zero over-limit routes. Browser backend was unavailable, so route QA used local HTTP fetches. One-section dataset warnings were expected for Weapons and Wang Cars.

### Grand Theft Auto (`gta`)

- Hub: `/gta/wiki/gta`
- Collections: Vehicles (75), Weapons (4 image-backed firearms), Story Missions (90 counted jobs), Kill Frenzies (70), Power-Ups (7), and Crane Bonuses (44).
- Media: 290 row images mapped and published through immutable collection revisions; 286 are exact row matches and four crane rows explicitly reuse the first matching city-variant vehicle image.
- Verification: hub and all six collection routes passed managed-development copy, v2 audit, image-required checks, dry sync, publication, database readback, and route verification. Story Missions serves three chapter-sized database pages; the other collection `/page/2` routes correctly return 404. All seven primary routes passed canonical, JSON-LD, sitemap, scoped-search, media-rendering, and local dataset/image QA; the largest valid route was 1.701 MB with zero over-limit routes. Browser backend was unavailable, so route QA used local HTTP fetches. Characters, Radio Stations, Respray and Bomb Shops, and broad Map & Locations remain intentionally skipped as reference-only subjects for this completion-focused batch.

### Grand Theft Auto: London 1969 (`gta-london-1969`)

- Hub: `/gta/wiki/gta-london-1969`
- Collections: Vehicles (37 complete vehicle-table rows), Weapons (4), Story Missions (39 counted jobs), Kill Frenzies (21), Power-Ups (6), and Crane Bonuses (25).
- Media: 132 row images mapped and published through immutable collection revisions; every row has a source-backed image. The vehicle article's prose says 36 vehicles, but its category tables contain 37 named rows, so the full table roster is retained and the discrepancy is documented.
- Verification: hub and all six collection routes passed managed-development copy, v2 audit, image-required checks, dry sync, publication, database readback, and route verification. All collection `/page/2` routes correctly return 404. All seven primary routes passed canonical, JSON-LD, sitemap, scoped-search, media-rendering, and local dataset/image QA; the largest valid route was 1.363 MB with zero over-limit routes. Browser backend was unavailable, so route QA used local HTTP fetches. Characters, Radio Stations, and broad map/reference systems remain intentionally skipped for this completion-focused batch.

### Grand Theft Auto: London 1961 (`gta-london-1961`)

- Hub: `/gta/wiki/gta-london-1961`
- Collections: Vehicles (37 complete vehicle-table rows), Weapons (4), Story Missions (7), Kill Frenzies (7), Power-Ups (6), and Crane Bonuses (26).
- Media: 87 row images mapped and published through immutable collection revisions; every row has a source-backed image. As with London 1969, the vehicle table contains 37 rows even though the article summary says 36, and the discrepancy is documented.
- Verification: hub and all six collection routes passed managed-development copy, v2 audit, image-required checks, dry sync, publication, database readback, and route verification. All collection `/page/2` routes correctly return 404. All seven primary routes passed canonical, JSON-LD, sitemap, scoped-search, media-rendering, and local dataset/image QA; the largest valid route was 0.617 MB with zero over-limit routes. Browser backend was unavailable, so route QA used local HTTP fetches. Characters, Radio Stations, and broad map/reference systems remain intentionally skipped for this completion-focused batch.

### Grand Theft Auto Online (`gta-online`)

- Hub: `/gta/wiki/gta-online`
- Collections: Vehicles (896 source-listed entries), Weapons (111), Heists (11), Properties (27 named property types), Signal Jammers (50), Playing Cards (54), Action Figures (100), Movie Props (10), Media Sticks (13), and Peyote Plants (76).
- Media: 1,348 row images mapped and published through immutable collection revisions; 1,337 are exact source images plus 11 explicitly recorded contextual/reused images for five drift/base vehicle variants and two property-category rows.
- Scope boundary: fixed, durable Online systems and collectible routes are covered. Rotating daily activities, seasonal sets, live bounty/cache/shipwreck-style activities, broad mission/race/award catalogs, and LD Organics remain excluded because they need a separate maintenance workflow or do not expose a stable finite item roster.
- Verification: the hub and all ten collection pages passed managed-development copy, v2 audit, image-required checks, dry sync, publication, and database readback. The six checklist `/page/2` routes return 404. Vehicles serves eleven database pages and Weapons serves four; every paginated page has a canonical URL and `noindex, follow`. All 24 valid hub/base/pagination routes passed the formal HTML-size audit with zero over-limit routes; the largest was 1.702 MB. Custom QA passed all 11 primary routes, local dataset/media counts, checklist boundaries, database pagination, sitemap coverage, and scoped search. Browser backend was unavailable, so route QA used local HTTP fetches with the webpack preview after a Turbopack large-page writer failure. The hub, its distinct R2 cover/square thumbnail, and all ten collection pages are live in production.

## Production verification receipt

- The guarded production schema publisher is converged with no pending migration or history repair. Dokploy's owner-authenticated, fixed-container transport is the fallback when the dedicated VPS SSH key is unavailable.
- All 158 reviewed GTA runtime manifests were promoted. Combined with the retained GTA 5 set, production serves 173 collection pages and 7,529 active items.
- All 19 approved Roblox collection conversions are live as checklist pages and retain their expected 1,134 items.
- All 209 checked public URLs returned HTTP 200: 190 GTA index/hub/collection routes and 19 converted Roblox checklist routes.
- The Red Dead migration ledger count and Red Dead production-table count are both zero.

## In progress

- None.

## Queued

- None.
