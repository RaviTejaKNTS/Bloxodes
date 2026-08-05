Evidence checked:
- Existing Bloxodes coverage:
  - Universe ID `10356701370` confirmed via Roblox Games API: name `Build a Base and Steal😈`, creator `replayable fun games` (group), root place `132016691802922`, genre Simulation/Tycoon, updated 2026-08-02.
  - Production wiki hub live at `/wiki/build-a-base-and-steal` (pets are core loop; gear collection linked).
  - Production gear collection live at `/wiki/build-a-base-and-steal/gear` (`build-a-base-and-steal-gear`, 7 items in local dataset).
  - Production pets route `/wiki/build-a-base-and-steal/pets` returns 404 — no `wiki_collection_pages` row for pets yet.
  - Local game collection registry (`apps/web/src/lib/game-collections/games/build-a-base-and-steal.ts`) lists only `gear`; `data/Build a Base and Steal/` has `gear.json` only.
- Source coverage:
  - **Strong:** AllThings.How rebirth guide (2026-08-05) lists all 16 rebirth tiers with named pet requirements across 29 distinct pets, including Golden-mutation pets for rebirths 13–14 and notes that fish pets are part of the full rebirth set. Cross-checks with Sportskeeda rebirth guide snippets (full page WAF-blocked in research pass).
  - **Good mechanics:** AllThings beginner guide, AllThings steal/defense guide, Pro Game Guides beginner guide, Roonby beginner and stealing guides — Egg Mystery rolling, claim-cost gating, Pet Luck, steal path, offline income, rebirth panel on left UI.
  - **Identity:** Official Roblox description and Bloxodes wiki hub align on loop (roll pets, build base, steal with gear).
  - **Weak / rejected:** Fan wiki `buildabaseandstealroblox.wiki` (Brainrot-style trading hub, mythic evolution, skill pets — Steal a Brainrot contamination; do not use for stats or roster). RoUniverse endgame guide incorrectly claims no rebirth system (stale). No dedicated Beebom, TechWiser, BloxInformer, Game8, or Fandom wiki pages found. Roonby “Pet Index” URL not found. Earnaldo/RoUniverse emphasize no official master pet list and no trading UI.
- Collection scope:
  - **In scope (v1):** The 29 source-named rebirth-track pets from AllThings rebirth table — the durable, player-useful set tied to permanent Luck progression. These are distinct named entities players must obtain, protect, and sometimes preserve across rebirths (e.g., Dragon, Golden Kitsune).
  - **Out of scope (v1):** Full Egg Mystery gacha roster, drop-rate tables, per-pet $/sec income values, trading/market prices, mutation multiplier math (defer to separate `/articles/build-a-base-and-steal-pet-mutations` article), and any Steal a Brainrot brainrot/mutation taxonomy.
  - **Scoped note:** AllThings states the 29-pet rebirth set “includes Fish pets” but does not label which rows are fish-only; treat fish typing as a verify-live gap, not a roster expansion without proof.
- Why this should be a collection:
  - Pets are the primary income and progression object; rebirth gates name specific pets at each tier.
  - Players search for rebirth pet requirements, what to keep vs reroll, and which pets are worth stealing — a named index beats scattered guide tables.
  - Gear collection already published; pets is the missing core collection for this wiki hub.
  - A rebirth-track roster is source-backed and durable even without a full gacha leak.

Sources to use:
- Source 1: https://allthings.how/build-a-base-and-steal-every-rebirth-requirement-and-reward/ — primary rebirth pet names, rebirth tier mapping, Golden-mutation requirement note, 29-pet total, max 16 rebirths.
- Source 2: https://allthings.how/build-a-base-and-steal-beginner-s-guide-to-pets-rebirth-and-base-defense/ — Egg Mystery obtain loop, Pet Luck, rebirth UI location, qualitative rarity/income relationship, extra base floors from rebirth.
- Source 3: https://allthings.how/build-a-base-and-steal-how-to-steal-pets-earn-money-and-defend-your-base/ — steal obtain path, offline earnings, rebirth as long-term multiplier, Roblox screenshot references for pets UI.
- Source 4: https://www.sportskeeda.com/roblox-news/build-base-steal-rebirth-guide — secondary rebirth pet name cross-check (WAF-blocked for full HTML; search snippets align on early/mid tiers and Yi Qi spelling).
- Source 5: https://progameguides.com/guides/build-a-base-and-steal-beginners-guide/ — beginner obtain paths, Epic-tier qualitative mention, rebirth + luck investment advice.
- Source 6: https://roonby.com/2026/07/19/build-a-base-and-steal-beginners-guide-best-tips-to-earn-more-cash-and-protect-your-base/ — Egg Mystery platform, claim cash requirement, rare/Epic focus, rebirth timing.
- Source 7: https://roonby.com/2026/07/21/3-top-stealing-tips-in-build-a-base-and-steal-guide/ — steal as obtain path for valuable pets (context, not roster).
- Source 8: Roblox Games API / experience listing for universe `10356701370` and place `132016691802922` — game identity confirmation.
- Source 9: https://bloxodes.com/wiki/build-a-base-and-steal and `/gear` — existing Bloxodes coverage, Bat pet vs bat weapon distinction, production overlap check.
- Source 10 (do not treat as truth): https://buildabaseandstealroblox.wiki/en/pets-list/ — polluted fan wiki; useful only as negative reference for Brainrot contamination.

Data plan:
- Item count expected:
  - **29 items** for v1 (all rebirth-required named pets from AllThings).
  - Do not inflate toward fan-wiki “20–30 optimal collection” or unverified full gacha pools.
- Useful fields:
  - `rebirthRequired` — rebirth tier(s) that require this pet in base (e.g., `1`, `13`, or `14` for Golden Unicorn).
  - `rebirthRole` — e.g., `Required for rebirth`, `Golden mutation required`, `Single-pet tier` (R13/R15).
  - `source` — `Egg Mystery roll`, `Steal from other bases`, and `Fishing` only if live-verified for specific pets.
  - `obtainNotes` — short practical notes (must be in base at rebirth, not just indexed; preserve for later tiers).
  - `petCategory` — `Standard`, `Golden mutation`, `Fish` when source-backed.
  - `rarityBand` — qualitative only (`Common`, `Rare`, `Epic`, etc.) when multiple guides agree; omit numeric income.
  - `incomeNote` — qualitative (“higher-tier earner”, “early rebirth gate”) without $/sec unless live tooltip captured.
  - `cardSummary` — one-line player-facing summary.
  - `description` — longer source-backed prose; flag Bat pet vs gear-shop bat weapon.
  - `relatedGearNote` — optional short cross-link text for Gargoyle Bat pet vs gear bats if needed in description only.
- Grouping:
  - Section by **rebirth progression band** (player-comparison friendly, not a raw rebirth table clone):
    - `Early rebirth pets` — Rebirth 1–4 (Cat, Chicken, Bunny, Bat, Owl, Llama, Zebra, Elephant).
    - `Mid rebirth pets` — Rebirth 5–8 (Lion, Stegosaurus, Mammoth, Yi Qi, Velociraptor, Azhdarchid, Gargoyle Bat, Cockatrice).
    - `High rebirth pets` — Rebirth 9–12 (Sphinx, Pegasus, Roc, Hydra, Qilin, Simurgh, Dragon, Unicorn).
    - `Endgame & Golden pets` — Rebirth 13–16 (Golden Kitsune, Golden Unicorn, Golden Dragon, Gnome, Fairy, Mermaid).
  - Sort within section by `rebirthRequired` ascending, then name.
- Image needs:
  - Row images for all 29 pets preferred from in-game UI, AllThings/Roblox credited screenshots, or clean gameplay captures.
  - Expect partial coverage initially; text-only rows acceptable where no clean source image exists (mirror gear dataset honesty).
  - Do not use fan-wiki or Brainrot asset art.
  - Golden mutation pets need mutation-visible captures, not base pet placeholders.
- Known gaps or risks:
  - **No verified full pet roster** beyond rebirth-named set — resist expanding to “all rollable pets” without new sources.
  - **No published per-pet income, claim cost, or rarity table** — do not invent BPS/$/sec or drop rates.
  - **Fish pet labeling** — AllThings mentions fish pets in the 29 count but does not enumerate; verify live (Mermaid likely; confirm others).
  - **Name normalization** — Yi Qi vs YiQi; Gargoyle Bat pet vs Gargoyle Bat gear naming collision; Bat pet vs Bat weapon (already documented on gear page).
  - **Golden mutations** — only three Golden pets confirmed for rebirth gates; broader mutation system belongs in mutations article, not this collection’s multiplier fields.
  - **Rebirth 11–12 order** — Sportskeeda snippets may swap Dragon/Unicorn vs Qilin/Simurgh money tiers; trust AllThings table unless live panel disagrees.
  - **Rebirth 13–16 money thresholds** marked TBA at source — collection should not invent costs.
  - **Steal a Brainrot contamination** — fan wiki and some community tier lists mix wrong mechanics; strict game identity checks on every source.
  - **Sportskeeda / PGG** — timed out or WAF-blocked during research; rely on AllThings primary with snippet cross-check.
  - **Parent article batch** — mutations article may add mutation context; keep collection focused on pet entities and rebirth roles, not duplicate mutation guide prose.

Page layout plan:
- Section field: `section` (system) mapped to rebirth progression bands above.
- Section order: Early rebirth pets → Mid rebirth pets → High rebirth pets → Endgame & Golden pets.
- Section labels: Use band names above; optional section notes explaining rebirth pets must be **in base** at confirm time.
- Why these sections help players: Groups pets by when players first need them, supports “what should I keep for the next rebirth?” without dumping 29 rows into one flat list.
- Card title field: `name`.
- Card description field: `cardSummary`.
- Card key-value fields: `rebirthRequired`, `rebirthRole`, `source`, `petCategory`, `rarityBand` (when known), `incomeNote`.
- Hidden/source-only fields: none required beyond standard `system.slug`, `system.sortOrder`, `system.image`; workflow may add verification notes outside `items[].item`.
- Image field: `system.image` → `/Build a Base and Steal/pets/<slug>.webp` (match gear path convention).
- Sort order: `rebirthRequired` ascending within section, then alphabetical by name.
- Section note needs: yes — one short note on Early band: rebirth wipes pets but permanent Luck/Max Pets/defense blocks remain; Golden pets need mutated rolls/steals.
- Renderer/config changes needed: **yes (minimal)** — register `pets` in `build-a-base-and-steal.ts` collections array and add `pets.json` dataset; no new renderer type expected if v2 `meta.display` follows gear.json pattern.

Go/no-go: **GO** — scoped to 29 rebirth-track pets with AllThings-primary sourcing. Not GO for a complete gacha encyclopedia until stronger roster sources appear.

Parent approval requested: **Yes** — approve research scope (rebirth-track 29 pets, progression-band sections, no invented income stats) before data/images/writing passes.

## Data readiness:
- Dataset file: `data/Build a Base and Steal/pets.json`
- Item count: 30
- Source item count: 30 distinct named pets across AllThings rebirth table (16 rebirth tiers); AllThings headline says 29 but the published table lists 30 unique names
- Dataset shape: v2 wrapped `{ meta, items[].item, items[].system }` yes
- Public item fields: `rebirthRequired`, `rebirthRole`, `source`, `petCategory`, `obtainNotes`, `cardSummary`, `description`
- System fields: `slug`, `section`, `sortOrder`, `image` only yes
- Metadata: `schemaVersion`, `itemFields`, `columns`, `display.groupLabel`, `display.sectionOrder`, `display.tableFields`, `display.cardFields`, `display.fieldPresentation` yes
- Section source: `items[].system.section` rebirth progression bands from approved brief
- Section counts: Early rebirth pets 8, Mid rebirth pets 8, High rebirth pets 8, Endgame & Golden pets 6
- Section order: Early rebirth pets → Mid rebirth pets → High rebirth pets → Endgame & Golden pets
- Card fields: `rebirthRequired`, `rebirthRole`, `source`, `petCategory`, `obtainNotes`, `cardSummary`
- Card/table field order: rebirthRequired, rebirthRole, source, petCategory, obtainNotes, cardSummary, description
- Card summary coverage: 30/30
- Field presentation: rebirthRequired chip, rebirthRole highlight, source plain, petCategory chip, obtainNotes/detail, cardSummary/description detail
- Highlight fields: `rebirthRole`
- Chip fields: `rebirthRequired`, `petCategory`
- Detail fields: `obtainNotes`, `cardSummary`, `description`
- Field consistency: all rows populated for declared card/table fields; `rarityBand`, `incomeNote`, and fish `petCategory` omitted because no source-backed values
- Image needed: yes
- Image field: `items[].system.image`
- Hidden/source/dev fields absent from public item data: yes
- Sort order: `items[].system.sortOrder` by rebirth tier then name within band
- description_json section keys: pending writing pass
- Renderer/config support: `pets` registered in `apps/web/src/lib/game-collections/games/build-a-base-and-steal.ts`
- Missing items: none within rebirth-table scope; full gacha roster intentionally excluded
- Audit command: `npm run audit:game-collection-datasets:v2 -- --game build-a-base-and-steal --collection pets`
- Audit result: pass (0 issues)
- Checker command: `npm run check:game-collection-data -- --game build-a-base-and-steal --collection pets`
- Checker result: pass (0 errors; warn: no images yet)
- Ready for images: yes

Data approval notes for parent:
- Bat and Gargoyle Bat rows clarify pet vs gear-shop bat weapons in `cardSummary` and `description`.
- Golden Kitsune, Golden Unicorn, and Golden Dragon use `petCategory: Golden mutation` and `rebirthRole` notes that mutated versions are required.
- Fish labeling left unset on all rows; Mermaid description notes AllThings fish mention without assigning fish category.
- No invented $/sec, claim costs, drop rates, or rarity bands.

## Image readiness:
- Image field: `items[].system.image`
- Expected image count: 30 (rebirth-track pets)
- Images found: 0 wired
- Images missing: 30 — text-only v1 accepted after failed exact-match search
- Image sources searched:
  - AllThings rebirth/beginner/steal guides (Roblox/BemmyBlox credited screenshots)
  - Official Roblox experience media API (`games.roblox.com/v1/games/10356701370/media`)
  - Sportskeeda rebirth guide (WAF-blocked)
  - Roonby beginner/stealing guides
  - beatcopgame mutations page
  - Fan wiki `buildabaseandstealroblox.wiki` (rejected — Brainrot contamination)
- Public image path: `apps/web/public/Build a Base and Steal/pets/` (empty; rejected candidates removed)
- Dataset image paths updated: yes (all `null`)
- Checker command: `npm run check:game-collection-data -- --game build-a-base-and-steal --collection pets`
- Checker result: pass (0 errors; 0/30 images; warn: no images — expected for text-only v1)
- Ready for writing: yes — text-only v1 after parent image review failure

### Rejected candidates (parent visual review — wrong image worse than missing)
1. **`chicken.webp`** — crop from AllThings rebirth UI rewards row was the cash **Bonus +$5k** stack icon, not the Chicken pet. Removed.
2. **`dragon.webp`** — crop from Roblox promo asset `131151533725964` was a gameplay scene (player carrying multi-tailed fox/kitsune-like pet; dragon statues in background), not a clear exact-match Dragon pet row image. Removed.
3. **`unicorn.webp`** — crop from Roblox promo asset `102331399354103` was an ambiguous white block pet (could read as Llama or other); not a confident Unicorn match. Removed.

### Accepted gaps (text-only v1)
- **All 30 rebirth-track pets:** no source-backed exact-match pet icons found after search pass and parent review of candidate crops.
- **Golden Kitsune, Golden Dragon, Golden Unicorn:** no mutation-visible captures; base-pet placeholders rejected.
- **Cat vs Dog:** rebirth UI shows Dog requirement icon where AllThings lists Cat for Rebirth 1 — no verified Cat icon.
- **Sportskeeda** WAF-blocked; **fan wiki** rejected; no per-pet icon sheet in approved sources.
- Collection ships as rebirth requirement index with text-only cards until in-game captures or a verified icon source appears.

