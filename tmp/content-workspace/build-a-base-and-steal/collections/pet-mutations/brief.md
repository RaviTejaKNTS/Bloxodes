Evidence checked:
- Existing Bloxodes coverage:
  - Universe ID `10356701370` confirmed via Roblox Games API as **Build a Base and Steal😈** by **replayable fun games** (root place ID `132016691802922`, genre Simulation/Tycoon). Matches registered local game collection config in `apps/web/src/lib/game-collections/games/build-a-base-and-steal.ts`.
  - Production wiki hub exists at `/wiki/build-a-base-and-steal` (`universe_id=10356701370`).
  - Production collection coverage is **gear only** (`/wiki/build-a-base-and-steal/gear`, local dataset `data/Build a Base and Steal/gear.json`, 7 items). No `wiki_collection_pages` row or local dataset for `pet-mutations` yet.
  - Related article workspace exists at `tmp/content-workspace/build-a-base-and-steal/articles/build-a-base-and-steal-pet-mutations/` (approved brief + `final.json`), but that is prose/how-to coverage, not a catalog collection page.
  - Local game collection registry lists only `gear`; `pet-mutations` would be a new registered collection.
- Source coverage:
  - **Strong (fully fetched):** beatcopgame.com — 4-mutation table with multipliers and acquisition mapping; FAQ confirms income + sale value effects and one mutation per pet.
  - **Strong (fully fetched):** roonby.com (Aug 4, 2026) — confirms 4 mutations, multipliers, event names (Cosmic Event, Volcano Event, Admin Abuse Event), and that mutations boost MPS + sale value. **Conflicts with beatcopgame on Cosmic roll eligibility** (see gaps).
  - **Contextual:** allthings.how — July 11, 2026 Update + Event introduced “Weathers + Mutations”; Admin Abuse-themed mid-July events; short one-hour Update + Event cadence. No per-mutation table.
  - **Blocked/unusable:** Sportskeeda lead (`build-a-base-and-steal-all-pet-mutations-effects`) — WAF/captcha blocked; cannot verify extra claims.
  - **Wrong-game pollution:** Steal a Brainrot mutation guides (Fandom, Beebom, u7buy, RBLXGUIDE) list 10–14 different mutations with different multipliers (Gold 1.25x, Diamond, Rainbow 10x, etc.). Grow a Garden pet-mutations is a separate machine-based system. **Do not import names, counts, or numbers from those games.**
  - **No official first-party wiki/Trello** with mutation stats; Roblox experience description does not document mutations.
- Collection scope:
  - **Pet mutations** are status modifiers applied to individual pets in Build a Base and Steal. Each pet holds **one mutation at a time**. Mutations multiply both **Money Per Second (passive income)** and **sale value** by a fixed tier multiplier on top of the pet’s base rarity earnings.
  - Current source-backed roster is **exactly four named mutations**: Golden, Cosmic, Inferno, Admin.
  - This is a **small, closed set** tied to the Pet Roll gacha and limited-time Update + Event windows (Volcano/Inferno, Cosmic, Admin Abuse). It is distinct from Steal a Brainrot’s much larger mutation ecosystem despite similar naming (Golden/Gold, Inferno/Lava themes).
  - Collection code: `build-a-base-and-steal-pet-mutations`. Route: `/wiki/build-a-base-and-steal/pet-mutations`.
- Why this should be a collection:
  - Players need a **quick reference table** to compare mutation tiers, multipliers, and how each is obtained (roll vs event).
  - Search demand is real and polluted by wrong-game mutation pages; a game-specific catalog complements the planned `/articles/build-a-base-and-steal-pet-mutations` explainer without duplicating long-form prose.
  - Mutations are a **core progression lever** introduced in the July 2026 “Weathers + Mutations” update wave and tied to recurring live events — durable enough for a wiki collection even with only four rows.
  - Pairs naturally with future `pets` collection and existing `gear` collection on the same wiki hub.

Sources to use:
- Source 1: https://beatcopgame.com/build-a-base-and-steal-pet-mutations-multipliers-how-to-get/ — primary table for mutation names, multipliers (1.5x / 2x / 3x / 4x), rarity labels, acquisition methods, income + sale value effect, one-mutation-per-pet rule, Robux reroll note (low-confidence optional field).
- Source 2: https://roonby.com/2026/08/04/build-a-base-and-steal-mutations-guide-how-to-get-mutated-pets-and-every-mutation-explained/ — cross-check multipliers and effects; stronger detail on event mechanics (Cosmic Event applies to base pets; Volcano Event for Inferno + naturally mutated Inferno pets in volcano); **Golden-only from Pet Roll** claim.
- Source 3: https://allthings.how/build-a-base-and-steal-next-update-event-2/ — update/event context (“Weathers + Mutations” launch July 11, 2026; Admin Abuse event theme); no mutation numbers.
- Source 4: https://www.roblox.com/games/132016691802922/Build-a-Base-and-Steal — game identity, developer, core loop (roll pets, build, steal).
- Source 5: https://allthings.how/build-a-base-and-steal-how-to-steal-pets-earn-money-and-defend-your-base/ — supporting context for MPS/offline income and stealing mutated pets (not mutation stats).
- Source 6 (blocked, do not cite as verified): https://www.sportskeeda.com/roblox-news/build-a-base-and-steal-all-pet-mutations-effects — lead blocked; only use if parent unblocks during data pass.
- Sources to avoid: Steal a Brainrot / Grow a Garden mutation pages; Kick a Lucky Block mutation pages (different game, different multipliers despite similar 1.5x/2x/4x pattern).

Data plan:
- Item count expected: **4 rows** (Golden, Cosmic, Inferno, Admin). Do **not** add a Normal/1x baseline row unless parent wants parity with Kick a Lucky Block — mutations are optional modifiers, not a full tier ladder starting at Normal.
- Useful fields:
  - `multiplier` — e.g. `1.5x`, `2x`, `3x`, `4x` (applies to both MPS and sale value).
  - `incomeEffect` — short plain-language effect on passive cash generation.
  - `saleEffect` — can mirror incomeEffect (“same multiplier on sale value”) or be merged into single `effect` field if redundant.
  - `acquisition` — primary obtain path in player terms (Pet Roll, Cosmic Event, Volcano Event, Admin Abuse Event).
  - `secondaryAcquisition` — optional; e.g. Cosmic also from Pet Roll per beatcopgame, or stealing from other players (general game loop, all mutations).
  - `rarityLabel` — beatcopgame labels: Common / Uncommon / Rare / Very rare mutation (community terminology, not verified in-game UI).
  - `eventName` — named event window when applicable (Cosmic Event, Volcano Event, Admin Abuse Event).
  - `effect` — one-sentence card summary of why the mutation matters.
  - `notes` — conservative caveats (event timing unpredictable; Discord notifications recommended).
- Grouping:
  - Section by **how players obtain** the mutation (helps compare paths, not just multiplier order):
    1. **Pet roll mutations** — Golden (and Cosmic only if beatcopgame roll claim is kept after conflict resolution).
    2. **Limited-time event mutations** — Cosmic (if event-only per roonby), Inferno, Admin.
  - Alternative if acquisition conflict unresolved at data time: single section **All pet mutations** sorted by multiplier ascending (1.5x → 4x) with acquisition as a card field instead of section split.
- Image needs:
  - **Text-only v1 recommended**, matching Kick a Lucky Block / Catch And Tame mutation collections until clean in-game row captures exist.
  - Ideal future captures (original screenshots only): golden-mutated pet on roll UI, cosmic/inferno visual on pet model, admin-mutated pet during Admin Abuse event.
  - Do not reuse Steal a Brainrot or Grow a Garden mutation artwork.
- Known gaps or risks:
  - **Acquisition conflict:** beatcopgame says Cosmic can come from Pet Roll **or** Cosmic Event; roonby says Pet Roll is **Golden-only** and Cosmic/Inferno/Admin require events. Data pass must pick conservative wording (e.g. “Cosmic Event (primary); some guides also report rare Pet Roll Cosmic”) or validate in-game during local preview.
  - **Numeric proof depth:** multipliers are consistent across both fetchable guides but there is no official developer table; Sportskeeda could not be used to triangulate.
  - **No public roll odds** or exact event schedules — do not invent percentages or timers.
  - **Robux skip/reroll** mentioned only on beatcopgame (single source) — omit or mark low-confidence in `notes`.
  - **Live-game drift:** future Update + Event drops could add mutations or retune multipliers; collection copy should describe the current four-tier set without freshness/date claims.
  - **Small catalog SEO risk:** only 4 cards — page value depends on clear fields, section context, and intro/FAQ on the collection page (writing pass), plus cross-links to wiki hub, gear, and mutations article.

Page layout plan:
- Section field: `section` (system field in v2 dataset)
- Section order:
  1. `Pet roll mutations`
  2. `Limited-time event mutations`
  - Fallback single-section order: `All pet mutations`
- Section labels: as above; use title case consistent with gear collection (“Melee weapons”, etc.).
- Why these sections help players: acquisition path is the main decision point (grind rolls vs wait for Volcano/Admin windows vs hunt Cosmic Event). Splitting roll vs event mutations mirrors how guides structure “how to get” content and avoids a flat list that only mirrors competitor tables.
- Card title field: `name` (mutation name: Golden, Cosmic, Inferno, Admin)
- Card description field: `effect` (one-line summary of income + sale value boost)
- Card key-value fields: `multiplier`, `acquisition`, `eventName` (when applicable), `rarityLabel`
- Hidden/source-only fields: `notes`, `secondaryAcquisition`, `incomeEffect`/`saleEffect` if folded into `effect` for display
- Image field: `system.image` — null for all rows in v1 unless original captures are added
- Sort order: within sections, ascending by multiplier (Golden 1 → Cosmic 2 → Inferno 3 → Admin 4); across sections, roll mutations first, then event mutations highest tier last
- Section note needs:
  - **Pet roll mutations:** note that Golden is the most common mutation from Egg Mystery Pet Rolls; Luck/rebirth boosts may improve odds (general guide consensus, no exact rates).
  - **Limited-time event mutations:** note that Volcano, Cosmic, and Admin Abuse events are short, irregular windows — community Discord/event notifications are the practical way to catch them; mutations introduced with July 2026 “Weathers + Mutations” update per allthings.how.
- Renderer/config changes needed: **yes** — register `pet-mutations` in `apps/web/src/lib/game-collections/games/build-a-base-and-steal.ts` (`collections` array + slug/file entry), add `data/Build a Base and Steal/pet-mutations.json` v2 dataset, and wire collection route card on wiki hub if not auto-discovered from registry. No new renderer component expected if fields follow existing mutation-collection patterns (Kick a Lucky Block / Catch And Tame).

Data readiness:
- Dataset file: `data/Build a Base and Steal/pet-mutations.json`
- Item count: 4
- Source item count: 4 (Golden, Cosmic, Inferno, Admin)
- Dataset shape: v2 wrapped `{ meta, items[].item, items[].system }` yes
- Public item fields: `multiplier`, `rarityTier`, `acquisition`, `eventName`, `cardSummary`
- System fields: `slug`, `section`, `sortOrder`, `image` only yes
- Metadata: `schemaVersion`, `itemFields`, `columns`, `display.groupLabel`, `display.sectionOrder`, `display.tableFields`, `display.cardFields`, `display.fieldPresentation` yes
- Section source: parent-approved single section `All pet mutations` (avoids Cosmic acquisition-band split)
- Section counts: All pet mutations — 4
- Section order: `["All pet mutations"]`
- Card fields: `multiplier`, `rarityTier`, `acquisition`, `eventName`, `cardSummary`
- Card/table field order: multiplier → rarityTier → acquisition → eventName → cardSummary
- Card summary coverage: 4/4
- Field presentation: multiplier/rarityTier chips; acquisition/cardSummary detail; eventName plain
- Highlight fields: none (rarityTier is chip, not highlight)
- Chip fields: `multiplier`, `rarityTier`
- Detail fields: `acquisition`, `cardSummary`
- Field consistency: all rows share the same public field keys; `eventName` is null only on Golden
- Image needed: yes (image gate next)
- Image field: `items[].system.image`
- Hidden/source/dev fields absent from public item data: yes
- Sort order: `items[].system.sortOrder` 1–4 ascending by multiplier
- description_json section keys: pending writing pass; section key should match `All pet mutations`
- Renderer/config support: `pet-mutations` registered in `apps/web/src/lib/game-collections/games/build-a-base-and-steal.ts`
- Missing items: none
- Audit command: `npm run audit:game-collection-datasets:v2 -- --game build-a-base-and-steal --collection pet-mutations`
- Audit result: pass (0 issues)
- Checker command: `npm run check:game-collection-data -- --game build-a-base-and-steal --collection pet-mutations`
- Checker result: pass with expected warnings (single section; 0/4 images)
- Ready for images: yes

Data notes:
- Cosmic acquisition uses conservative wording: Cosmic Event primary, with optional Pet Roll mention in `acquisition` only.
- Income and sale value share one multiplier; reflected in `cardSummary` without duplicate fields.
- Robux reroll omitted per parent approval.
- `rarityTier` labels follow beatcopgame community terminology and are not confirmed in-game UI text.
- No roll odds or event schedules included.

Image readiness:
- Image field: `items[].system.image`
- Expected image count: 4 (Golden, Cosmic, Inferno, Admin)
- Images found: 0
- Images missing: Golden, Cosmic, Inferno, Admin (all four)
- Image sources used: none accepted
- Public image path: `apps/web/public/Build a Base and Steal/pet-mutations/` (not created; no files saved)
- Dataset image paths updated: no (all rows remain `null`)
- Search pass summary:
  - beatcopgame.com — only site logo and one generic article featured image (`cf-featured-*.jpg`); no per-mutation row art.
  - roonby.com — one article hero gameplay screenshot (`Screenshot_2010.jpg`, 1294×703); rejected as page screenshot on competitor wp.com CDN, not isolatable per mutation, no verified per-tier labels.
  - allthings.how / OP.GG — gameplay screenshots only; no mutation-specific icons.
  - No Build a Base and Steal Fandom or BloxInformer mutation icon set found.
  - Steal a Brainrot / Grow a Garden / Break For Pets mutation artwork rejected (wrong game or uncertain match).
  - Sportskeeda lead blocked; could not verify any image assets there.
  - Roblox experience page and thumbnails API provide game-level media only, not mutation row icons.
- Accepted gaps: text-only v1 approved. Mutation visuals are applied to pet models in-game rather than published as standalone icon assets; clean original captures would require an in-game screenshot pass during local preview.
- Checker command (standard): `npm run check:game-collection-data -- --game build-a-base-and-steal --collection pet-mutations`
- Checker result (standard): pass with expected warnings (single section; 0/4 images)
- Checker command (require-images): `npm run check:game-collection-data -- --game build-a-base-and-steal --collection pet-mutations --require-images`
- Checker result (require-images): fails as expected (0/4 images) — documents intentional text-only coverage
- Ready for writing: yes (text-only, accepted image gaps)
