Evidence checked:
- Existing Bloxodes coverage: A read-only production query against `database.bloxodes.com` on 2026-08-05 found the correct `roblox_universes` row for universe `10144587520` and root place `125039473548047`. It found zero `wiki_collection_pages` rows for that universe and zero rows for the exact `anime-card-farm` / `crafting` slug pair. Production also has no `wiki_pages` hub row for this universe. Bloxodes does have an existing beginner article that mentions Card Craft in the Plaza, but it does not provide the Evolution recipe table, so this collection would add distinct coverage rather than duplicate it.
- Game identity: Official Roblox APIs resolve universe `10144587520` to root place `125039473548047`, current title `[CRAFT🔨] Anime Card Farm`, and verified creator group `Anime Card Factory`. The editorial slug should remain `anime-card-farm`. Secondary guides call the developer `dream without the vale`, but current official Roblox metadata exposes `Anime Card Factory`; use the official group as the primary creator attribution and treat `dream without the vale` as a secondary studio/developer attribution only if later official or creator-controlled evidence confirms it.
- Source coverage: The AllThings.How guide supplies one complete, internally consistent table of 11 Evolution cards, each card's exact ingredient quantities, Cash cost, and money-per-second output. The official experience title independently confirms that crafting is a current feature. The existing Bloxodes beginner article, Sportskeeda beginner guide, and a separate AllThings.How beginner guide independently confirm the Card Craft activity and the wider pack/Card Box/Cash loop, but they do not reproduce the 11 recipe values.
- Collection scope: Include exactly the 11 finished Evolution cards shown by the current Card Craft guide: Flame Pillar, Emperor King, Silent Esper, Genius Striker, Star Brawler, Demon Captain, Almighty Prime, Twin Mages, Emerald Successor, Fox Ascendant, and Dark Saber. The scope is finished craftable cards and their recipes, not every ingredient card, mutation, trait, pack card, or Card Ranking result. The guide identifies Dark Saber as the top listed craft at `92.1Sp` per second, requiring 1 Royal Saber, 2 Shadow Rider, 1 Golden King, and `40Sp` Cash; this exact ranking/value currently has only the recipe guide as evidence.
- System understanding: Players use the Card Craft station in the central Plaza area, next to Free Rewards, open the Card Craft menu through its NPC, select an Evolution recipe, provide the exact base-card quantities and Cash cost, then wait for the finished card. Public sources do not establish a universal craft duration, so no timer value should be stored or promised.
- Display-name decision: Use `Crafting Recipes`. It matches the `crafting` route and the dominant search intent ("crafting" and "recipe"), while the page copy and section labels should make clear that the 11 outputs are Evolution cards. `Evolution Cards` is accurate but less explicit about the page's main utility: looking up required ingredients and Cash.
- Why this should be a collection: The recipe table answers a durable comparison need: which base cards to save, how many copies are required, how much Cash is needed, and what income the result produces. Eleven structured rows are enough to browse and compare, and the data is materially more useful in cards/sections than buried in prose.
- Recommendation: Proceed to the data stage with a single-source-value caveat. The exact table is complete and actionable, while multiple independent sources corroborate the crafting system. Before publication, the data pass should preserve source wording/units exactly and seek an in-game menu or second current recipe table to catch update drift.

Sources to use:
- Primary recipe source: https://allthings.how/anime-card-farm-crafting-every-evolution-card-recipe/ — use for the 11-card scope, ingredient names and quantities, Cash costs, money-per-second values, station location, and crafting steps.
- Official Roblox experience: https://www.roblox.com/games/125039473548047/Anime-Card-Farm — use for the canonical experience URL, current `[CRAFT🔨]` title, official description, and displayed creator group.
- Official Roblox universe API: https://games.roblox.com/v1/games?universeIds=10144587520 — use for universe ID, root place ID, canonical path, title, genre, and verified creator group.
- Official Roblox places API: https://develop.roblox.com/v1/universes/10144587520/places?limit=100&sortOrder=Asc — use to confirm that place `125039473548047` belongs to universe `10144587520`.
- Official Roblox group API: https://groups.roblox.com/v1/groups/973045631 — use to confirm the current verified `Anime Card Factory` creator group; it does not substantiate the `dream without the vale` name.
- Existing Bloxodes beginner guide: https://bloxodes.com/articles/anime-card-farm-beginners-guide — use for overlap review and independent confirmation that Card Craft accepts required cards/items for a higher-quality card in the Plaza loop. Do not treat it as recipe evidence.
- Supporting system source: https://www.sportskeeda.com/roblox-news/anime-card-farm-a-beginner-s-guide — useful for independent confirmation of the Plaza, Card Craft stall, Card Ranking, and Card Box/Cash loop; not useful for exact recipe rows.
- Supporting system source: https://allthings.how/anime-card-farm-beginner-guide-cards-card-boxes-and-offline-cash/ — useful for the broader economy and Card Craft context; not independent of the primary recipe publisher and not a second check on recipe values.
- Reviewed but not suitable for recipe facts: https://www.animecardfarm.wiki/ and https://animecardfarmwiki.site/ — unofficial hubs with broad progression advice but no complete source-backed Evolution recipe table in the reviewed pages.
- Reviewed but not suitable for this collection: https://www.youtube.com/watch?v=gsjP2zN4qLM — an earlier general beginner video with no indexed evidence for the current 11-recipe Card Craft update.
- Exclude search results about `Craft Anime`, `Anime Card Clash`, and marketplace listings. They refer to different games or player-sold variants and must not be used for Anime Card Farm recipe rows.

Data plan:
- Item count expected: 11.
- Useful fields: `name`; ordered ingredient entries with `cardName` and `quantity`; display-ready `ingredients`; `baseCardCopies` as the sum of ingredient quantities; `cashCost` with the source's suffix and precision preserved; `moneyPerSecond` with the source's suffix and precision preserved; and a short `summary` that states the requirement and output without adding unsupported efficiency claims.
- Grouping: Three progression bands based on the source table's ascending income scale: early recipes (Flame Pillar through Genius Striker, M/B outputs), advanced recipes (Star Brawler through Almighty Prime, T/Qd/Qn outputs), and endgame recipes (Twin Mages through Dark Saber, Sp outputs).
- Image needs: Prefer one clean image for each of the 11 finished Evolution cards, ideally captured from the current in-game Card Craft/collection UI or reusable first-party game media. The reviewed text sources did not establish reliable item-level image coverage. Do not hotlink or crop competitor article assets without confirming provenance and reuse suitability. A generic game thumbnail is not a substitute for 11 card images.
- Known gaps or risks: All 11 exact recipes and income values currently trace to one detailed publisher, so update drift is the main risk. No reviewed source provides craft duration, ingredient-card income, recipe unlock conditions, rarity, or independent proof that every finished card out-earns the consumed cards; omit those claims. The game can add recipes in updates, so item count and values need a current menu/second-source check during data work. Creator naming differs between current official metadata (`Anime Card Factory`) and secondary sites (`dream without the vale`). Item-level image availability remains unverified.

Page layout plan:
- Section field: `system.section`, assigned from the curated progression bands rather than exposed as a claimed in-game category.
- Section order: `early`, `advanced`, `endgame`.
- Section labels: `Early Evolution Recipes`; `Advanced Evolution Recipes`; `Endgame Evolution Recipes`.
- Why these sections help players: They keep nearby income scales together, let newer players scan attainable crafts first, and isolate the four `Sp`-scale endgame targets without creating 11 one-item groups or merely reproducing one undivided source table.
- Card title field: `name`.
- Card description field: `summary`, following the pattern “Requires [ingredient quantities] plus [Cash cost]; produces [money per second] per second.”
- Card key-value fields: `Ingredients`; `Base card copies`; `Cash cost`; `Money per second`.
- Hidden/source-only fields: Keep source URL, checked date, evidence notes, and any raw normalization helpers in the research/data provenance material, not in public `item` fields. Use `system.sortOrder` and `system.section` only for renderer behavior.
- Image field: `system.image`.
- Sort order: Ascending progression in the source-backed recipe order, from Flame Pillar to Dark Saber. Do not alphabetize; the income ladder is the useful comparison order.
- Section note needs: Each section should briefly explain that the bands are browsing aids based on listed output scale, not official in-game rarity tiers. The endgame note may identify Dark Saber as the highest-output card in the reviewed 11-row source while avoiding a timeless “best in the game” claim.
- Renderer/config changes needed: yes for registering the new game/collection dataset, labels, sections, and display fields; no custom renderer component is expected if the generic game-collection cards support a summary plus four key-value fields.

Data readiness:
- Dataset file: `data/Anime Card Farm/crafting.json`
- Item count: 11
- Source item count: 11
- Dataset shape: v2 wrapped `{ meta, items[].item, items[].system }` yes
- Public item fields: `name`, `ingredients`, `baseCardCopies`, `cashCost`, `moneyPerSecond`, `cardSummary`
- System fields: `slug`, `section`, `sortOrder`, `image` only yes
- Metadata: `schemaVersion`, `itemFields`, `columns`, `display.groupLabel`, `display.sectionOrder`, `display.tableFields`, `display.cardFields`, `display.fieldPresentation`
- Section source: Curated browsing bands based on the primary source's ascending recipe/output order; these are not claimed as official in-game tiers.
- Section counts: `Early Evolution Recipes` 4; `Advanced Evolution Recipes` 3; `Endgame Evolution Recipes` 4
- Section order: `Early Evolution Recipes`, `Advanced Evolution Recipes`, `Endgame Evolution Recipes`
- Card fields: `ingredients`, `baseCardCopies`, `cashCost`, `moneyPerSecond`; `cardSummary` is the card description
- Card/table field order: Cards show ingredients, base-card count, Cash cost, then money per second. Tables use the same order followed by the recipe summary.
- Card summary coverage: 11/11
- Field presentation: Explicit collection-level labels and kinds are defined for all five display fields.
- Highlight fields: none; no source-backed status or recommendation field is needed
- Chip fields: `baseCardCopies`, `cashCost`, `moneyPerSecond`
- Detail fields: `ingredients`, `cardSummary`
- Field consistency: All 11 rows contain the same five public comparison fields, with exact source Cash and money-per-second suffixes and precision preserved.
- Image needed: yes
- Image field: `items[].system.image`
- Hidden/source/dev fields absent from public item data: yes
- Sort order: `items[].system.sortOrder`, ascending from Flame Pillar (10) through Dark Saber (110)
- description_json section keys: Later writing must use the three exact rendered section labels; no `final.json` exists at the data stage.
- Renderer/config support: The shared Anime Card Farm group registers `crafting`; the v2 display contract uses the generic renderer and needs no custom component.
- Missing items: none
- Audit command: `npm run audit:game-collection-datasets:v2 -- --game anime-card-farm --collection crafting`
- Audit result: pass; 1 registered dataset checked, 0 issues
- Checker command: `npm run check:game-collection-data -- --game anime-card-farm --collection crafting`
- Checker result: pass with the expected pre-image warning; registered yes, 11 items, section counts 4/3/4, card summaries 11/11, images 0/11, and no errors
- Ready for images: yes

Image readiness:
- Image field: `items[].system.image`
- Expected image count: 11
- Images found: 8 — Flame Pillar, Emperor King, Silent Esper, Genius Striker, Star Brawler, Demon Captain, Almighty Prime, and Twin Mages
- Images missing: 3 — Emerald Successor, Fox Ascendant, and Dark Saber. These are accepted gaps because no clean, item-identifiable in-game images were found; unrelated anime art, marketplace listing graphics, and guessed character substitutes were rejected.
- Image sources used: The visible Card Craft panels in the in-game screenshot published at https://allthings.how/anime-card-farm-crafting-every-evolution-card-recipe/ with source image https://static.allthings.how/wp-content/uploads/2026/08/anime-card-farm-crafting-guide-5785637307.webp
- Public image path: `/Anime%20Card%20Farm/Crafting/<item-slug>.webp`
- Dataset image paths updated: yes for 8 matched items; the 3 accepted gaps remain `null`
- Provenance/handling: Each local WebP is a direct crop of its named, visible in-game Card Craft panel. Files are hosted locally rather than hotlinked, and no generic cover, AI-style article cover, or unrelated character art was used.
- Checker command: `npm run check:game-collection-data -- --game anime-card-farm --collection crafting --require-images`
- Checker result: Strict image mode reports the 3 documented missing images and exits nonzero. The standard checker passes with 11/11 card summaries, 8/11 images, and no missing local files; the v2 audit also passes with 0 issues.
- Ready for writing: yes with the 3 accepted image gaps. All 11 text rows remain complete, 8 named cards have clean local in-game crops, and the renderer supplies consistent placeholders for Emerald Successor, Fox Ascendant, and Dark Saber.
