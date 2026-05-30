# Game-Specific Catalog Pages

Use this guide for dataset-backed game catalog pages such as Grow a Garden crops, Adopt Me pets, Blox Fruits accessories, Brookhaven vehicles, or any future durable `data/<Game>/` item collection.

Use the guide flexibly. The work should always begin with the game system, but the final structure should come from the collection itself. A pet page, a crop page, a vehicle page, a boss page, and a prize page should not sound like the same page with nouns swapped.

## Purpose

Game catalog pages should turn local structured datasets into readable player references. The copy should explain how the collection works in that game, while the item cards or tables carry the detailed data.

The writing standard is closer to a useful wiki explanation than a database caption. The page does not need to become a full article, but it must teach the system before it asks the reader to compare items.

The data standard is just as important as the writing standard. A game catalog page should not polish stale data. If research finds missing items, wrong counts, missing images, or fields that do not support useful cards, fix or explicitly approve the data state before final writing.

The usefulness standard is the hard gate. A game catalog page must help the player complete a real in-game job: buy, unlock, upgrade, farm, compare, equip, trade, reach, use, or avoid something. If the current dataset cannot answer that job and sources can, the work is a data update, not a writing pass.

## Catalog Scope Gate

Game catalogs are for core in-game item collections that stay useful beyond one update cycle. The collection should have repeatable player value: collect, unlock, compare, equip, farm, craft, hatch, buy, roll, trade, fight, visit, or use.

Good game-catalog candidates include:

- weapons, abilities, fruits, styles, races, traits, clans, gear, tools, pets, eggs, crops, seeds, materials, fish, bosses, enemies, drops, maps, islands, vehicles, furniture, cosmetics, skins, wraps, charms, titles, emotes, mounts, recipes, enchantments, and potions
- UGC collections only as a special exception when the game has meaningful UGC items; use the item-card pattern from the free Roblox items page instead of treating UGC like normal game gear
- quests, contracts, currencies, or achievements only when they behave like stable item/system collections with row-level data and repeatable player decisions

Do not create game catalog pages for:

- current season pass reward tracks
- one-off event reward lists
- current ranked season rewards
- temporary event timelines or event-only reward summaries
- broad shop/update summaries that are not item collections
- gamepasses, badges, developer products, servers, private server settings, social links, or raw Roblox media

If a temporary event or season introduces permanent items, record those items inside the durable collection they belong to, such as skins, pets, vehicles, or titles. Do not create a separate catalog just because the source route was an event.

## Required Context

Create or update:

```text
tmp/content-workspace/<game-slug>/catalogs/<collection-slug>/
  todo.md
  research-notes.md
  final.json
```

Copy `agents/content/todo-templates/game-catalog.md` into the folder as `todo.md` before research starts.

Before writing, inspect:

- `data/<Game>/`
- matching route or dataset config in `apps/web/src/lib/game-dataset-catalogs.ts`
- route family under `apps/web/src/app/(site)/wiki/[slug]/[collection]/` and the shared dataset renderers under `apps/web/src/app/(site)/catalog/`
- existing `wiki_catalog_pages` row
- `agents/wiki-catalog-workflow.md`

Check item examples, not just field names. If research notes do not include real examples and plain-language system explanation, do not write final copy.

For game catalog pages, also require a player-usefulness gate, a required fact matrix, and a competitor usefulness check when the page is meant to compete in search. These sections must appear before the data/title/section proposal. They should identify the player task, the facts needed for that task, whether those facts are source-backed, whether local data/cards contain them, and where the finished page will expose them.

## One-Page Standard

For game catalog work, build one approved page before scaling to a batch. Do not rewrite all collections in one script until the first page proves the depth, tone, and structure.

The gold-standard page must prove the whole workflow: research quality, data completeness, image coverage, card structure, writing, local import, and rendered verification.

## Catalog Code Rules

Use this stable code for scripts, search, and old URL redirects:

```text
<game-slug>-<collection-slug>
```

Examples:

- `grow-a-garden-crops`
- `adopt-me-pets`
- `blox-fruits-accessories`

The title should be unique, well-defined, and matched to the collection's real search intent. For wiki catalog pages, the default title shape is:

```text
All <N> <Item Or Collection> in <Game>: <Real Player SEO Question>
```

The question after the colon must come from research and should answer a decision players actually care about: how to get the items, where to go first, which option to unlock, what to build, what to save, when to farm, or which entries are worth using. Do not use filler questions such as `What Are They?`, `What Should You Know?`, or a generic `Complete Guide` tail. A plain wiki-style title such as `All <Collection> in <Game>` is only acceptable for a simple list page that has no stronger player question.

Good title patterns include:

- `All 43 Classes in 99 Nights in the Forest: Which Should You Unlock First?`
- `All 59 Materials in 99 Nights in the Forest: How Do You Get Each One?`
- `All 68 Locations in 99 Nights in the Forest: Where Should You Go First?`
- `All 33 Weapons in 99 Nights in the Forest: Which Ones Are Worth Using?`
- `All 10 Enchantments in Wizard Alchemy: What Do They Do?`

For game-catalog pages, `seo_title` should usually match the visible `title` exactly, including the item count when the title has one. Do not simplify `All 1,898 Furniture Items in Adopt Me` into `All Adopt Me Furniture`; the count is useful search context and can improve click appeal.

The title is a promise. If it asks `How do you get each one?`, the page must explain sources, routes, requirements, drops, shops, or repeatability in enough detail. If it asks `Where should you go first?`, the cards and body must give usable route guidance. If it asks `Which should you unlock first?`, the body needs enough role, cost, requirement, and mistake-avoidance context for that decision.

The public route should be `/wiki/<game-slug>/<collection-slug>`, for example `/wiki/adopt-me/pets`. Do not create new game-specific pages under `/catalog`; old `/catalog/<game-slug>-<collection-slug>` URLs should redirect to the wiki route.

## Field Roles

Use the same content fields as normal catalog pages, but write them into `wiki_catalog_pages` for game-specific collections. Pay extra attention to:

- `wiki_slug`: game slug used in `/wiki/<game-slug>/<collection-slug>`.
- `collection_slug`: collection slug used in `/wiki/<game-slug>/<collection-slug>`.
- `code`: stable old-style code such as `adopt-me-pets`, used by scripts, search, and redirects.
- `universe_id`: links the wiki catalog page to the wiki hub.
- `wiki_md`: shown on the game wiki catalog section.
- `wiki_sort_order`: controls the wiki hub order.
- `description_json`: short section notes shown between item-card groups when the route divides the collection into meaningful sections.
- local images: derived from the codebase/dataset, not stored as per-page image arrays in Supabase.

`wiki_md` is not a CTA. It is the wiki hub's short explanation of the collection as a game concept.

This field is owned here. When writing a game wiki page later, do not recreate every collection blurb there; the wiki hub should read the already-researched `wiki_md` from each catalog page. If the blurb is weak, come back through this game-catalog workflow for that one collection.

## Data And Image Audit

Before section approval or final writing, audit the actual collection data.

For existing pages, compare:

- local dataset item count
- rendered card count
- current page title count
- source counts found during research
- local image count and missing image count
- required fact coverage from the player-usefulness matrix

For new game pages, create or update the local dataset as part of the workflow. The model should gather the item list, useful card fields, and image paths before writing final copy. If repeatable collection will matter later, prefer a collector script under `scripts/catalog/collect-<game>-data.ts` instead of one-off manual data.

Write the audit in `research-notes.md`. It should say which data files were checked, which sources disagree, what items are missing or extra, which images are missing, and whether the page is `ready as-is`, `needs dataset update`, `needs image update`, or `blocked`.

If sources disagree, do not pretend the local count is correct. Use judgment, but make the disagreement visible:

- If multiple reliable sources list more Sailor Piece islands than the local 21-row dataset, list the extra island names and mark the page `needs dataset update`.
- If Blox Fruits accessories have local image files but cards are not showing images, mark it `needs image wiring`, not a writing issue.
- If a source count includes removed, admin-only, duplicate, or unreleased entries, explain why the local dataset may intentionally differ.

If sources include player-useful fields that local data is missing, make that visible too. Prices, currencies, shop or NPC names, damage, upgrade paths, roll chances, location landmarks, requirements, limits, role, and practical priority notes are not optional when they are central to the player task and can be verified.

After the user approves the data action, update the local dataset and image wiring before writing `final.json`. Public copy should match the final local dataset, not the stale dataset from the start of research.

## Section Style Confirmation

Before writing or updating a game-catalog page, research the collection and propose the data action, title promise, item-card section style, and card data shape to the user. This applies whether the page already exists or the page is being created fresh.

Choose the grouping with the strongest in-game meaning. Rarity is often better than refresh date when rarity is how the game divides rewards. Source can be better than rarity when obtainment is the real player decision. Item type can be better when the collection mixes tools, vehicles, strollers, weapons, or materials. Other useful grouping axes can be location, shop, world, tier, level range, unlock route, crop type, resource type, or boss. Event can be a source or availability field for permanent items, but do not use current-event grouping to justify a temporary reward-track catalog.

The proposal must include:

- primary player task and the decision the page should make easier
- required fact matrix with source status, local dataset/card status, and planned public placement
- competitor usefulness check when SEO/search traffic is part of the page decision
- dataset status: local count, source count, rendered count, title count, image count, and missing image count
- data update plan if needed: missing items to add, stale fields to clean, image work to do, and whether a collector script is needed
- recommended visible title and `seo_title`
- exact title promise: what answer the page is promising, such as obtainment, locations, drops, chances, brewing, crafting, effects, bonuses, value, or comparison
- content coverage required to satisfy that title promise
- recommended grouping axis
- why that axis helps players understand the collection long-term
- weaker alternatives and why they are not the first choice
- planned `description_json` keys and one-to-three-sentence notes for each section
- which parts stay in `description_md` as whole-page explanation
- planned card fields and the player meaning of each one
- raw fields that should be hidden from cards, such as long `description`, raw `pros`, raw `cons`, nested `stats`, source HTML, or unclear yes/no values
- whether the dataset or route renderer needs an override so the approved fields actually appear

Wait for explicit user confirmation before writing `final.json` or updating local Supabase. If the dataset needs changes, update the local dataset after approval and before writing final copy. If the user changes the title, section style, or card fields, use the confirmed version. A broad page request is not data, title, or section approval. The notes should say what the user approved, such as `confirmed title/data/section plan: title promises chest locations, group by route stage, and show landmark, route order, reward notes, and travel tip`, instead of saying the user merely requested the page.

After confirmation, check the route's real section output before writing to the database. The rendered card sections must match the `description_json` keys. If the dataset has a blank `rarity` field and the generic renderer would choose it over the intended category, fix the renderer or add the confirmed grouping override first. Public copy written for `Walls` and `Floors` is not ready while the page renders `Other` or `Rarity`.

Check the route's real card output too. Cards should be clean reference surfaces, not mini articles. Keep pure data that helps a player compare items: source, price, rarity, chance, requirement, best use, role, strength, limit, availability, damage, seats, reward type, or a similar concrete field. Do not render raw long descriptions, raw pros/cons arrays, nested object dumps, unexplained yes/no values, or vague meta text. If a page needs pros and cons, translate them into short fields like `Strength`, `Limit`, `Best for`, or `Trade note`.

## Writing Pattern

Good game catalog copy usually covers:

1. What the collection is in the game.
2. What the player actually does with it.
3. How players get, unlock, buy, hatch, craft, farm, earn, or trade it.
4. Main item groups and why they differ.
5. Confusing terms explained in game language.
6. Any current, retired, event, premium, reward, or trade-only caveats.
7. What a new player usually misunderstands.

Keep it concrete. A pets catalog, crops catalog, boss catalog, and vehicle catalog should not sound interchangeable.

Before writing public copy, make an outline in `research-notes.md`. The outline must name the reader questions, the section order, the details to cut, and the formatting plan. If the page has a major acquisition question, such as `How to get eggs`, `How to unlock weapons`, or `How to farm materials`, that section should usually appear before deeper caveats.

The outline must also explain how the page will satisfy the approved title promise. A page titled `All Materials and How to Get Them` needs more than a source column; it needs clear obtainment context, route advice, source groups, and FAQ coverage where useful. A page titled `Chest Locations` needs practical landmarks and route order, not only chest names.

For sectioned catalog pages, the outline must separate `description_json` and `description_md` jobs. `description_json` sets up each item section near the cards. `description_md` explains the full game system, such as where the system lives in-game, how players obtain items, how prices or odds work, and what mistakes apply across the whole collection. Do not repeat the same section notes in both fields.

The outline must also say where every required fact will be answered. Cards can carry row-level facts such as price, damage, source, chance, requirement, or role. `description_md` should carry process facts such as how to buy, unlock, upgrade, farm, roll, equip, or use the collection. `how_it_works_md` should explain how to read the visible values. FAQs should clear up edge cases, not carry the only explanation of a core process.

After the first-pass `final.json`, run the FLOW pass before final edit. This pass should reshape `description_md`, `how_it_works_md`, FAQs, and headings until the page reads like a useful player explanation instead of a stack of facts. The pass must rewrite weak structure, not only check for banned phrases.

For game catalog pages, `description_md` should almost always contain one practical action section. The action depends on the collection: how to train Instinct, how to reach islands, how to farm materials, how to unlock swords, how to roll gifts, how to hatch eggs, how to grow crops, how to equip accessories, or how to compare old rewards before trading.

If the collection has no direct action, explain the nearest player behavior. A title color page can explain how title-count milestones unlock colors. A special-title page can explain why most entries are not normal player goals. A cosmetic page can explain where the cosmetic applies and how players usually encounter it.

The page should use formatting when it helps:

- numbered lists for steps, unlock paths, or training routes
- tables for repeated comparisons such as gift odds, source types, sea access, or rarity meaning
- bullets for short rules, mistakes, and examples
- paragraphs for the story that connects those pieces

Do not let a game catalog page land on random sections because the data had convenient fields. A Blox Fruits Instinct Levels page should explain how to train Instinct, what the 2824 and 5000 EXP milestones mean, and how normal Instinct connects to Instinct V2. It should not feel like three card notes were enlarged into article headings.

Do not make the reader sprint through the system. Explain the collection first, then separate obtainment, comparison, availability, trading, crafting, or value notes into their own paragraphs when those ideas are not directly connected.

Headings should read like useful sentence fragments that tell the reader what the section helps them decide. Avoid lazy labels such as `How classes work`, `How weapons work`, `Overview`, `Value`, `Source`, or `Progression` unless the section immediately makes that phrase specific. Prefer `Where classes unlock and why stock matters`, `What to build first at each station`, `Why source matters before rarity`, or `When retired eggs change trade value`.

Use article-style structure when it helps the catalog page become useful:

- numbered lists for acquisition steps or linear unlock processes
- compact tables for comparing item groups, egg routes, rarity odds, sources, or replacement difficulty
- bullets for quick groups, examples, and mistakes
- paragraphs for the connective explanation that makes the page feel like one story

Do not include every researched fact. Keep facts that explain the collection, support a decision, or prevent a common mistake.

When a field name is unclear, define it before using it:

- `seats` on a vehicle means how many passengers can ride, which matters for family roleplay, moving with friends, or carrying babies and pets.
- `source` means the actual route that created the item, such as a shop, event, egg, gift refresh, reward track, boss drop, Robux purchase, or old trade-only release.
- `availability` means whether the route still exists, appears only during events, rotates with weather or shops, or has already left the game.
- `uses` means how many times the item can be consumed or applied before it is gone.
- `chance` means the roll odds only when the unit is known; do not invent percentages.

Public copy should talk about the collection, not the website surface. `catalog` can appear in titles or UI labels, but intro, description, FAQ, and wiki copy should usually say `pets`, `eggs`, `vehicles`, `crops`, `accessories`, or the real collection name.

Avoid:

- `Use the X catalog`
- `Check the catalog`
- `This catalog includes`
- `The dataset includes`
- `on Bloxodes`
- repeated `Compare X, Y, and Z` openings across a batch

Better:

- `Eggs decide which pet pool each hatch can pull from.`
- `A one-seat vehicle is mostly personal travel. Multi-seat vehicles matter more for family roleplay, moving with friends, or carrying babies and pets around the map.`
- `Furniture shapes how a home works before decoration starts, especially for themed rooms and custom builds.`
- `Accessory chests are chance boxes; the chest price changes the odds, not the guarantee.`

## Dataset Field Translation

Translate varied item data into player meaning.

Examples:

- `tradable: true` -> `Tradeable: Yes`
- `limited: false` -> `Limited: No`
- `source: egg` -> explain which egg or source route if known
- `chance: 2.5` -> `2.5% hatch chance` when the unit is known
- `availability: event` -> explain the event or limited window if known
- `bonus_count: 3` -> do not show only `3`; say `3 bonuses` or list the bonuses

Avoid unexplained values like `Yes`, `No`, `3`, or `common` without a visible label.

## Mandatory FLOW Pass

Before import, confirm the FLOW pass has happened and record it in `research-notes.md`. A simple line is enough when the rewrite is clean:

```markdown
FLOW pass: rewrote description_md around whole-page mechanics, added a how-to section, kept section-specific notes in description_json, and checked headings for reader flow.
```

If the pass changes the outline, update `final.json` directly. Do not create another draft file.

## Image Rules

- Use local dataset images when the route supports them.
- Do not add `wiki_image_urls` or per-page image arrays to Supabase.
- If images are missing, record the gap in research notes.
- Do not invent image paths.
- If images exist locally but the page does not render them, treat that as a renderer or dataset-wiring issue and fix it before final verification.
- If images are expected but not available, count the missing images and get approval to continue without them or to gather them first.

## Copy By Collection Type

### Items, accessories, gear, weapons

Focus on rarity, source, stats, requirements, and whether the item fits a build.

### Pets, eggs, mounts, companions

Focus on rarity, source, availability, age/stage rules, abilities, event status, and what makes the pet easy or hard to get again.

### Crops, materials, currencies

Focus on source, value, conversion, refresh timers, crafting, farming, and whether the resource is repeatable.

### Bosses, enemies, quests, islands

Focus on level range, location, rewards, unlocks, and progression order.

### Event-origin items

Only include event-origin items when they belong to a durable collection, such as pets, skins, weapons, vehicles, titles, or cosmetics. Explain the old source and availability on those item cards. Do not turn a current event timeline, season pass track, or one-off reward list into a game catalog.

## Output Shape

```json
{
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "intro_md": "",
  "description_md": "",
  "description_json": {},
  "how_it_works_md": "",
  "faq_json": [],
  "wiki_md": "",
  "wiki_sort_order": 0
}
```

## Final Checks

- Did you inspect actual item examples?
- Did `research-notes.md` include a data and image audit?
- Do local dataset count, rendered card count, page title count, and source count match or have an intentional explanation?
- If research found missing items, did you update the local dataset or get explicit approval to proceed without them?
- If images matter, did you count missing images and verify existing local images are wired?
- Did you propose the item-card section style after research and get user confirmation before final writing?
- Is the section grouping based on real in-game meaning instead of only the easiest dataset field?
- Did you verify the route actually renders the confirmed section labels?
- Does `description_json` give short useful setup notes for each confirmed section?
- After local import, did the database row read back with the updated `description_json`, and did the local page render those notes?
- Does `description_md` stay focused on whole-page mechanics instead of repeating section notes?
- Did the FLOW pass rewrite `description_md`, headings, and transitions before final edit?
- Does `description_md` include a useful action/how-to/use section, or do notes explain why the collection is passive?
- Does the visible title follow `All <N> <Item> in <Game>: <real player question>` unless a recorded reason explains a simpler title?
- Are `description_md` headings specific, action-led, and more useful than generic `How <collection> works` headings?
- Did you explain unclear fields?
- Did you define the game meaning of any field used as advice?
- Does the page teach the system before it talks about comparison?
- Is there enough depth for a new or casual player to understand the collection?
- Did you avoid raw internal keys?
- Does copy match the collection type?
- Does the copy give enough context before jumping into fields or exceptions?
- Does each paragraph explain one connected concept?
- Are headings clear sentence-style fragments instead of rigid one-word labels?
- Does `wiki_md` explain the collection in the game without saying `Use the catalog`?
- Did each catalog page get its own `research-notes.md` and `final.json`?
- If this is the first page in a batch, did the user approve it as the gold standard?
- Are images expected from local dataset/codebase rather than Supabase page fields?
- Does the page avoid a game-specific one-off data file unless the dataset itself requires it?
