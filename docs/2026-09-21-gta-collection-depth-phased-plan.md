# GTA Collection Depth — Phased Execution Plan

**Date:** 2026-09-21
**Scope:** All 253 GTA collections revised in Phases 1–5 (out of 281; 28 inherited baseline revisions). The earlier 252/29 split was off by one.
**Target:** GTABase parity or better — no duplicate `name`, no filler `cardSummary`, no wrong/missing info.
**Boundary:** All authoring + verification in managed development. Production promotion only on explicit request, per batch, via controlled `--apply --allow-prod` + live readback. No prod writes in Phase 0–5.

## Phase 0 — Global contract (code + gates only, no data rewrites) [THIS RUN]

Published GTA datasets are immutable (`gta_wiki_collection_datasets` + `protect_published_gta_wiki_collection_runtime`), so Phase 0 does NOT rewrite 252 revisions. It fixes the renderer and adds publish gates for all future work.

- 0.1 Renderer: suppress duplicate identity field rendering. Card title already renders `item.name` (`GameCollectionView`, `generic.tsx` explicit v2 path). Filter `id/slug/name/image` out of `sanitizeDisplayFieldList` / `sanitizeDisplayField` so existing datasets stop showing "Name: <same as title>".
- 0.2 Gates in `check:game-collection-data` + `audit:game-collection-datasets:v2`: error when display lists `name`; error when useful fields (excluding `name/cardSummary/slug/section/image` identity keys) ≤ 2; error on filler `cardSummary` patterns (`Open Wheel vehicle in GTA Online`, `listed Online vehicle entry`, `Use the image to confirm`, `Use the item image and location note`, `appears among Grand Theft Auto`).
- 0.3 Templates recorded (no code): vehicle / weapon / character / radio / gang / cheat / mission / collectible / property / multiplayer / achievement field lists from the depth audit. Enforced per-batch from Phase 1 on.
- Verify: `npm run typecheck` (or targeted `tsc`), plus workspace-level checker/audit on a sample dataset file. No DB writes.

## Phase 1 — Pilot (2–3 collections, one run)

- `gta-online-vehicles` (896) + `gta-5-vehicles` (321) + `gta-online-weapons` (111).
- Full workflow-runner per collection: research → data → images → writing → managed-dev publish → `verify:gta-collection-final` → HTML-size gate → desktop+mobile browser review.
- Proves GTABase parity template (manufacturer, price/tradePrice, acquisition, storage/delivery, mods, raceAvailability, topSpeed game+real + lapTime, weight/drivetrain, stats, explosiveResistance, real-life counterpart, DLC/release, bespoke description).
- Parent approval at each gate. Prod promotion deferred.

## Phase 2 — P0 remainder (one run per small batch)

- `gta-5-weapons`, `gta-online-properties` (27), `gta-online-businesses` (16), `gta-online-heists` (11), `gta-5-heists` (6).
- Same gates as Phase 1. Batch size 3–5.

## Phase 3 — Vehicles classics (14 games)

- All remaining `vehicles` lists + vehicle-adjacent (`import-export`, `wang-cars`, `car-azy`, `impound`).
- Classic template subset: acquisition/spawn, edition/platforms, real-life counterpart, stats where game files exist. Never just `category`.

## Phase 4 — Weapons + Characters + Radio

- Weapons (remaining 14): manufacturer, price, acquisition, rankUnlock, damage/fireRate/accuracy/range/clip, mods/Mk II, real-life, DLC/release, bespoke description.
- Characters (18): affiliation, status, full bio, firstAppearance + missionsAppearingIn, voiceActor/performer.
- Radio/media (16): host/DJ, frequency, full tracklist (artist–title), exclusiveTo, titleUpdate added.

## Phase 5 — Missions / collectibles / properties / cheats / long tail

- Missions/jobs/races (57): giver/contact, rankUnlock, payout normal/hard, crew, location, objectives, prerequisites/unlocks, rewards, replay, titleUpdate.
- Collectibles (33): district/area, map hint + thumbnail, coordinates, equipment, reward chain, completion %.
- Properties/safehouses/businesses (20), multiplayer/careers (8), achievements (7), cheats (12), generic thin (19).
- Option to merge micro-collections (1–5 items, 1 useful field) into parent hub instead of enriching.

## Phase 6 — Release (explicit only)

- Per-batch controlled promotion: dry-run → `--apply --allow-prod` → production readback → live URL 200 + title/data/images → sitemap/search/revalidation check.
- Never bundle unapproved batches. Never run release from the authoring workflow.

## Quality review opened 2026-09-25

The Phase 1–5 checkmarks record managed-development publication and the then-current automated checks. They do **not** establish GTABase parity or production readiness. The cross-phase audit found substantive player-facing defects: 947 declared fields empty in every item of their collection, 20 collections copying summaries into objectives, 16 radio collections with missing tracklists, five collectible collections copying `location` into `mapHint`, and a factual Career Builder error. The 2026-09-26 correction pass has cleared those known patterns, repaired additional duplicated fields and roster omissions, and reconciled 281 managed-development revisions. The final pass added 197 approved images and verified native gameplay guidance for the remaining three sensitive collections. Missing-media acceptance and final human preview review remain open in the [current quality gate](2026-09-21-gta-collection-depth-todo.md). The current managed-development GTA Online vehicle roster has 882 entries after source-backed removal of 23 duplicate Drift Tuning upgrade rows and one Story Mode-only TPE Cargobob; all 882 cards now have distinct summaries, with 873 exact vehicle images published and nine gaps remaining; Phase 1 counts below remain the historical snapshot. The user authorized the entire reviewed GTA production release and hub images on 2026-09-26. Phase 6 verification is pending.

## Progress tracker

- [x] Phase 0 — global contract (this change)
- [x] Phase 1 — pilot (online-vehicles, 5-vehicles, online-weapons): COMPLETE in managed-dev 2026-09-21. Research/data/images/writing gates green; pointers flipped + page copy published + media uploaded/verified; `verify:gta-collection-final` green ×3; HTML-size gates pass; pagination + no-dup-Name + Tailscale checks pass.
  - Live in managed-dev: `gta-online-weapons` 112 rows, `gta-5-vehicles` 321 rows, `gta-online-vehicles` 896 rows (row counts match published pointers).
  - One copy fix during verification: `gta-online-vehicles` faq_json.6.a contrast filler rewritten, republished same revision.
  - Preview (port 3100, webpack): `http://teja-homelab.tail13b5bd.ts.net:3100/gta/wiki/gta-online/vehicles`, `/gta/wiki/gta-5/vehicles`, `/gta/wiki/gta-online/weapons` (direct-IP fallback `http://100.86.117.125:3100/...`). Stop with `pkill -f "[n]ext-server"` (port 3000 left free for the 01:00 wiki timer).
- [x] Phase 2 — P0 remainder: COMPLETE in managed-dev 2026-09-21 (119 rows across 5 collections). Research/data/images/writing gates green; pointers flipped + media uploaded/verified; `verify:gta-collection-final` green ×5; HTML-size gates pass (0.17–0.69 MB); enriched data + no-dup-Name confirmed in rendered HTML.
  - `gta-5-weapons` 59 rows (11 new fields: manufacturer, real-life, titleUpdate/release/platforms, mods/tints, ammo, similarWeapons, bespoke description; BZ Gas got its own exact image).
  - `gta-online-properties` 27 rows (9 new fields: price ranges, income caps, districts, unlocks, perks, storage slots, upgrades).
  - `gta-online-businesses` 16 rows (setupCost, income+cap where documented, locationOptions, unlockRank, upgrades, payoutMechanics; cutoff 2026-09-21).
  - `gta-online-heists` 11 rows (giver, location, rank, crew, setups, elite, replay, titleUpdate/release; corrected Humane Labs hard take, Doomsday post-July-2026 payouts, Cluckin Bell first/repeat structure).
  - `gta-5-heists` 6 rows (approachTakes ranges, crewCuts, lesterCut where sourced, casualties, goldObjectives, missionOrder).
  - One copy fix during verification: `gta-online-businesses` description_md "weapon and vehicle research" → "unlock weapon and vehicle upgrades" (provenance-word filter), republished.
  - Review: `http://teja-homelab.tail13b5bd.ts.net:3100/gta/wiki/{gta-5/weapons,gta-online/properties,gta-online/businesses,gta-online/heists,gta-5/heists}` (same preview as Phase 1).
- [x] Phase 3 — Vehicles classics: COMPLETE in managed-dev 2026-09-21/22 (26 collections, ~1,222 rows). Research (12 game groups) → data (classic template: acquisition/spawn, edition/platforms, real-life iconic-only, bespoke description, no `name` in display, pageType locked) → images (896+208+…; 11 SA import-export + 4 SA vehicle-missions accepted text-only gaps, others 100%) → writing (26 finals, {count} titles, description_json keys match sections) → publish → verify green ×26 → HTML-size 0.22–0.54 MB, pagination, no-dup-Name, Tailscale 200.
  - `gta/vehicles` 75, `gta-2/vehicles` 79 + `wang-cars` 1, `gta-4` 121, `tlad` 24, `tbogt` 31, `gta-iii` 61 + `import-export` 39 + `vehicle-missions` 4 (0 images text-only), `vice-city` 107 + `vehicle-missions` 5, `sa` 208 + `import-export` 31 (20/31) + `vehicle-missions` 6 (2/6), `lcs` 82 + `car-azy` 16 + `vehicle-missions` 5, `vcs` 107 + `impound` 32 + `vehicle-missions` 8, `cw` 70 + `vehicle-missions` 4, `advance` 28 + `vehicle-missions` 4, `london-1961` 37 + `london-1969` 37.
  - Fixes during verification: 3 copy provenance phrases (“showroom source”→“showroom origin”, “main source”→“main locations”, “not just looks”→“and use”) republished same revisions.
  - Review: `http://teja-homelab.tail13b5bd.ts.net:3100/gta/wiki/{gta/vehicles,gta-2/vehicles,gta-4/vehicles,gta-iii/vehicles,gta-vice-city/vehicles,gta-san-andreas/vehicles,…}` (same :3100 preview, :3000 left free).
- [x] Phase 4 — weapons + characters + radio: COMPLETE in managed-dev 2026-09-22 (48 collections, ~1,400 rows). Research → data (GTABase parity templates) → images (exact or accepted gaps) → writing (48 finals, {count} titles) → publish → verify green ×48 → HTML-size <0.7 MB, Tailscale 200.
  - Weapons 14: `gta` 4, `gta-2` 18, `gta-iii` 13, `gta-vice-city` 35, `gta-san-andreas` 44, `gta-london-1961` 4, `gta-london-1969` 4, `gta-lcs` 35, `gta-vcs` 37, `gta-cw` 28, `gta-advance` 13, `gta-4` 16, `gta-4-tlad` 21, `gta-4-tbogt` 24.
  - Characters 18: `gta` 92 (49/92), `gta-2` 118 (18/118), `gta-iii` 34 (31/34), `gta-vc` 32 (31/32), `gta-sa` 120 (82/120), `gta-advance` 16, `gta-lcs` 75, `gta-vcs` 23, `gta-cw` 27, `gta-4` 58, `gta-4-tbogt` 9 + `random` 5, `gta-4-tlad` 18 + `random` 4, `gta-5` 89, `gta-online` 71 (22/71), `gta-london-1961` 22 (9/22), `gta-london-1969` 35 (22/35).
  - Radio 16: `gta` 7 (0/7 text-only), `gta-2` 11 (1/11), `gta-iii` 10, `gta-vc` 10, `gta-sa` 13, `gta-lcs` 11 (10/11), `gta-vcs` 9, `gta-cw` 12 (3/12), `gta-advance` 8 (0/8), `gta-4` 23, `gta-4-tbogt` 6, `gta-4-tlad` 6 (4/6), `gta-5` 22, `gta-online` 25, `gta-london-1961` 12 (0/12), `gta-london-1969` 12 (0/12). 3 copy fixes during verification (“late sources”→“late pickups”, “mission source”→“mission pickup”, “Check Requirement first”→“Look at Requirement and Availability”).
  - Review: same :3100 preview (`/gta/wiki/<game>/weapons`, `/characters`, `/radio-stations` or `/radio-media`).
- [x] Phase 5 — missions / collectibles / properties / cheats / tail: COMPLETE in managed-dev 2026-09-24 (171 collections, 5,863 rows). Research → data (GTABase parity: gangs leader/territory/color/symbol/car, cheats effect/phone/button combos, missions giver/rank/payout/crew/location, collectibles district/mapHint/coordinates, properties price/income/location, etc., no `name` in display) → images (exact or accepted gaps, hashed inner→outer synced, text-only cheats 0/0) → writing (171 finals, {count} titles) → publish 171/171 (0 FAILED) → verify 171/171 PASS (11 copy fixes: “not just”→“beyond simply”, “source”→“origin”, “dataset”→“collection”, “this guide”→“the listing”, “Use district”→“Compare by district”), HTML-size <0.7 MB, pagination, Tailscale 200.
  - Gangs 18 (7+21+8+25+8+15+7+11+8+8+13+5+10+100+10+10+12+10), Cheats 12 (35+30+9+50+21+25+43+17+33+91+61+36), Missions 56 (8+20+90+50+8+15+25+7+26+3+4+12+22+60+50+21+7+65+8+30+68+4+20+4+20+3+11+20+4+70+26+70+456+140+220+77+6+8+45+153+32+5+5+3+7+101+70+62+4+35+1+1+59+36+1+36), Collectibles 33 (15+150+200+50+50+10+15+15+50+50+30+27+50+30+50+100+100+100+100+6+6+100+13+10+76+54+50+7+50+50+50+100+99), Properties 18, Multiplayer 8, Achievements 7, Generic 19. All verified on :3100.
- [ ] Phase 6 — batched production releases (explicit only)
