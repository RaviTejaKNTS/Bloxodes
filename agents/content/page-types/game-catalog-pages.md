# Game-Specific Catalog Pages

Use this guide for dataset-backed game catalog pages such as Grow a Garden crops, Adopt Me pets, Blox Fruits accessories, Brookhaven vehicles, or any future durable `data/<Game>/` item collection.

Use the guide flexibly. The work should always begin with the game system, but the final structure should come from the actual items or mechanic. A pet page, a crop page, a vehicle page, a boss page, and a prize page should not sound like the same page with nouns swapped.

## Purpose

Game catalog pages should turn local structured datasets into readable player references. The copy should explain how the items or mechanic work in that game, while the item cards or tables carry the detailed data.

The writing standard is closer to a useful wiki explanation than a database caption. The page does not need to become a full article, but it must teach the system before it asks the reader to compare items.

The data standard is just as important as the writing standard. A game catalog page should not polish stale data. If research finds missing items, wrong counts, missing images, or fields that do not support useful cards, fix or explicitly approve the data state before final writing.

The usefulness standard is the hard gate. A game catalog page must help the player complete a real in-game job: buy, unlock, upgrade, farm, compare, equip, trade, reach, use, or avoid something. If the current dataset cannot answer that job and sources can, the work is a data update, not a writing pass.

## Catalog Scope Gate

Game catalogs are for core in-game item groups that stay useful beyond one update cycle. The items or mechanic should have repeatable player value: collect, unlock, compare, equip, farm, craft, hatch, buy, roll, trade, fight, visit, or use.

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

- `wiki_slug`: editorial game slug used in `/wiki/<game-slug>/<collection-slug>`; do not copy `roblox_universes.slug`.
- `collection_slug`: collection slug used in `/wiki/<game-slug>/<collection-slug>`.
- `code`: stable old-style code such as `adopt-me-pets`, used by scripts, search, and redirects.
- `universe_id`: links the wiki catalog page to the wiki hub.
- `wiki_md`: shown on the game wiki catalog section.
- `wiki_sort_order`: controls the wiki hub order.
- `description_json`: short section notes shown between item-card groups when the route divides the collection into meaningful sections.
- `how_it_works_md`: leave empty for normal wiki catalog pages. Do not create a standalone section about how to read, use, scan, or interpret the page itself.
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

Gather game catalog item rows through online research and source collection. Use official/developer sources, current community wikis or databases, guides, videos, screenshots, changelogs, and other player-facing sources. Do not use Roblox APIs as the catalog item source of truth; APIs can only help confirm game identity, Roblox metadata, thumbnails, or obvious cross-checks. If an API has no item list, keep researching online instead of marking the catalog blocked.

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

- primary player task and the in-game decision players are making
- required fact matrix with source status, local dataset/card status, and planned public placement
- competitor usefulness check when SEO/search traffic is part of the page decision
- dataset status: local count, source count, rendered count, title count, image count, and missing image count
- data update plan if needed: missing items to add, stale fields to clean, image work to do, and whether a collector script is needed
- recommended visible title and `seo_title`
- exact title promise: what answer the page is promising, such as obtainment, locations, drops, chances, brewing, crafting, effects, bonuses, value, or comparison
- content coverage required to satisfy that title promise
- recommended grouping axis
- why that axis helps players understand the items or mechanic long-term
- weaker alternatives and why they are not the first choice
- planned `description_json` keys and one-to-three-sentence notes for each section
- which parts stay in `description_md` as whole-page explanation
- planned card fields and the player meaning of each one
- raw fields that should be hidden from cards, such as long `description`, raw `pros`, raw `cons`, nested `stats`, source HTML, or unclear yes/no values
- whether the dataset or route renderer needs an override so the approved fields actually appear

Wait for explicit user confirmation before writing `final.json` or updating local Supabase. If the dataset needs changes, update the local dataset after approval and before writing final copy. If the user changes the title, section style, or card fields, use the confirmed version. A broad page request is not data, title, or section approval. The notes should say what the user approved, such as `confirmed title/data/section plan: title promises chest locations, group by route stage, and show landmark, route order, reward notes, and travel tip`, instead of saying the user merely requested the page.

After confirmation, check the route's real section output before writing to the database. The rendered card sections must match the `description_json` keys. If the dataset has a blank `rarity` field and the generic renderer would choose it over the intended category, fix the renderer or add the confirmed grouping override first. Public copy written for `Walls` and `Floors` is not ready while the page renders `Other` or `Rarity`.

Do not accept generated fallback copy as a preview. A game-catalog page without a published `wiki_catalog_pages` row should not render public copy, and the normal seed path should require the approved page-local `final.json`. If a route opens but the visible H1, intro, section notes, body, or FAQ differ from `final.json`, the page is not verified. Record that as a failed import/readback, not as a successful route preview.

Check the route's real card output too. Cards should be clean reference surfaces, not mini articles. Keep pure data that helps a player compare items: source, price, rarity, chance, requirement, best use, role, strength, limit, availability, damage, seats, reward type, or a similar concrete field. Do not render raw long descriptions, raw pros/cons arrays, nested object dumps, unexplained yes/no values, or vague meta text. If a page needs pros and cons, translate them into short fields like `Strength`, `Limit`, `Best for`, or `Trade note`.

## Minimal Card Standard

Game-catalog cards should feel closer to the Bagel Bunny card than the Honored One card. A card is a quick reference surface. It is not the place to squeeze in every paragraph, every caveat, every move list, and every database field.

This is a production contract, not a style preference. Every default game-catalog card should render in this order:

```text
[Image, only when it is a real row-representative image]
Name
Short description, usually 1-2 sentences
Small key-value block, usually 3-5 facts
```

The card should let a normal player understand the item or row in one glance. If the reader has to read a long paragraph, parse an internal caveat, or compare eight loosely related fields, the card failed even if every fact is technically true.

Use this shape for each item card:

1. Image only when research found a clean row-representative image: direct item art, object cutout, NPC screenshot, station screenshot, location screenshot, or another in-game visual where the row subject is clearly visible. If no acceptable image exists, leave the image empty.
2. Name and the strongest status label when available, such as rarity, availability, type, or source.
3. One short description paragraph that explains the item's core role in plain player language. This paragraph should be unique to the item, but it should stay compact. One or two short sentences is usually enough.
4. A small key-value data block with only the facts a player would scan to compare, unlock, buy, use, trade, or avoid the item.

Images are optional only because weak images are worse than blank cards. Never fill row images with raw Roblox API thumbnails, generic game icons, broad hero art, edited guide thumbnails, site-branded cover art, arrows/callouts, or nearby screenshots that do not actually show the row subject. Roblox APIs can confirm identity or metadata; they are not a substitute for catalog image research. If research cannot produce clean row images, record the image gap in `research-notes.md` and keep the card image blank.

Default card descriptions are required unless the notes explain why this item set works better as pure data. The description should sound like a Roblox player explaining the row in-game, not like a database note. Good descriptions say what the item/row changes for the player: role, route fit, use case, weakness, why it is awkward, or why it is different from nearby entries.

The description and data block must not repeat each other. The description should add item-specific meaning that the data rows do not already say: how the item feels in play, what its role changes, why it is awkward, what situation it fits, or what makes it different from nearby entries. Do not write `Availability Free public character` or `Cost Free` in the description when those same facts appear as data rows. If the only thing you can say is already covered by data, skip the description. If the item is better explained as one sentence and there are no useful row-level facts, skip the data block. Depth is welcome, but each piece of the card needs its own job.

There is no fixed number of data points. Choose the useful facts, then stop. A pet card might only need `Eggs`, `Merchants`, and `Abilities`. A weapon card might need `Source`, `Damage`, `Requirement`, and `Best for`. A vehicle card might need `Price`, `Shop`, `Seats`, and `Availability`. If a field does not change a player decision, hide it from the card or explain it elsewhere.

As a practical default, aim for 3-5 visible key-value facts. More than 5 fields needs a written reason in `research-notes.md` and rendered proof that the card still scans cleanly. More than 6 fields is usually a fail for the default card surface and should become a table, details view, body section, or separate guide. Do not show every useful fact just because it exists in the dataset.

Never expose research or workflow language in public cards. Card descriptions, labels, and values must not say `source notes`, `source estimate`, `source-backed`, `needs in-game check`, `needs verification`, `verification`, `partial`, `source-conflicted`, `reported by`, `current sources`, `dataset`, `research`, `API`, or similar process wording. Keep those notes in `research-notes.md`. Public cards should talk about the game: where to go, what it does, when to use it, what it costs, or what unlocks it.

Keep the visual emphasis just as selective. Cards may use color for one actionable status signal, such as `Available`, `Unavailable`, `Retired`, `Trade only`, `Event`, `Limited`, or `Seasonal`. Use green for available, red or muted red for unavailable/retired/trade-only, and amber for event/limited/seasonal. Cards may also visually strengthen one primary decision field for the collection, such as `Source` for pets, `Value` for crops, `Price` for vehicles, `Damage` for weapons, `Level` for islands, or `Unlock` for cosmetics. Everything else should stay quiet key-value text.

Good minimal card description:

```text
Bagel Bunny is a common Grow a Garden pet that hatches from Gourmet Egg.
```

Good card data:

```text
Eggs: 1
Merchants: 0
Abilities: 0
```

Avoid this pattern:

```text
Availability Free public character • Cost Free
Base Moves 5
1: Lapse Blue
2: Reversal Red
3: Rapid Punches
4: Twofold Kick
R: Limitless
Awakening or Special Six Eyes: Lapse Blue MAX, Reversal Red MAX, Hollow Purple, Infinite Void, Limitless, Unlimited Purple, 0.2 Domain
Role Ranged pressure and domain control
Strength Blue, Red, Purple, and Infinite Void give clear ranged and domain pressure.
Limit Strong tools still need clean spacing because predictable ranged pressure can be blocked, baited, or interrupted.
Version Added V1.00
Version Finished V1.00
```

That card has useful facts, but it forces the user to read a mini article inside a card. Split this kind of material instead:

- Keep the card to `Availability`, `Cost`, `HP`, `Role`, and maybe one compact `Special` or `Best for` field.
- Move long move lists, awakened variants, combos, strategy, version history, and caveats into a table, details view, `description_md`, or a dedicated guide section if the page truly needs them.
- Convert paragraphs into short key-value fields only when the label is obvious and the value can be scanned quickly.

The card test is simple: a player should understand the item in one glance, then use the data points to compare it with nearby cards. If the card needs multiple wrapped paragraphs to be understood, the page needs a cleaner card shape or a separate explanatory section.

## Writing Pattern

Hard public-copy rules for wiki catalog pages:

- Public fields must talk only about the game, items, mechanics, unlocks, shops, zones, odds, values, trading, crafting, farming, or other in-game details that help the player.
- Never mention sources, research, workflow, data collection, dataset state, API behavior, verification gaps, or what could not be found. Those notes belong in `research-notes.md`, not `intro_md`, `description_md`, `description_json`, cards, `faq_json`, or `wiki_md`.
- If a useful fact is missing, fix the data or write only with confirmed in-game facts. Do not publish caveats like `sources do not confirm`, `we could not find`, `needs verification`, `reported by`, `source-backed`, or `partial`.
- Write like a Roblox player who understands the game and is helping another player. Use full sentences, simple wording, and enough setup for a new player to follow.
- Do not use analogies or em dashes.
- Keep `intro_md` short and engaging, usually one compact paragraph about the game items or mechanic: what they are, where they appear, how players use or get them, or what decision they affect.
- `description_md` should use only useful, SEO-friendly headings that match real player questions or actions, such as how to get items, when to save them, where to farm them, which ones matter first, what values change a decision, or what mistakes to avoid.
- `description_md` may link naturally to other Bloxodes pages with the same `universe_id`, including the wiki hub, codes page, tools, articles, events, or other wiki catalog pages for the same game. Add links only where they help the sentence. Do not add special link sections, do not use phrases like `in our guide`, and do not pile every link into one paragraph.
- FAQs should usually stop at 3-4 questions. They should answer follow-up questions, not repeat facts already covered by the intro, cards, section notes, or `description_md`.
- The copy should move like a story: set context, show the collection, explain the next practical decision, and connect later sections back to earlier ideas when that helps a new player.

Good game catalog copy usually covers:

1. What the items or mechanic are in the game.
2. What the player actually does with it.
3. How players get, unlock, buy, hatch, craft, farm, earn, or trade it.
4. Main item groups and why they differ.
5. Confusing terms explained in game language.
6. Any current, retired, event, premium, reward, or trade-only caveats.
7. What a new player usually misunderstands.

Keep it concrete. A pets catalog, crops catalog, boss catalog, and vehicle catalog should not sound interchangeable.

Before writing public copy, make an outline in `research-notes.md`. The outline must name the reader questions, the section order, the details to cut, and the formatting plan. If the page has a major acquisition question, such as `How to get eggs`, `How to unlock weapons`, or `How to farm materials`, that section should usually appear before deeper caveats.

The outline must also explain how the page will satisfy the approved title promise. A page titled `All Materials and How to Get Them` needs more than a source column; it needs clear obtainment context, route advice, source groups, and FAQ coverage where useful. A page titled `Chest Locations` needs practical landmarks and route order, not only chest names.

For sectioned catalog pages, the outline must separate `description_json` and `description_md` jobs. `description_json` sets up each item section near the cards. `description_md` explains the game system, such as where the system lives in-game, how players obtain items, how prices or odds work, and what mistakes apply while using or chasing the items. Do not repeat the same section notes in both fields.

The outline must also say where every required fact will be answered. Cards can carry row-level facts such as price, damage, source, chance, requirement, or role. `description_md` should carry process facts such as how to buy, unlock, upgrade, farm, roll, equip, or use the items. `description_json` should explain section-specific context near the cards. FAQs should clear up edge cases, not carry the only explanation of a core process.

Do not add a `How to read this page`, `How to use this list`, or similar meta section. If visible values need explanation, define their gameplay meaning in the body, section notes, card labels, or FAQ.

After the first-pass `final.json`, run the FLOW pass before final edit. This pass should reshape `description_md`, FAQs, headings, section notes, and card context until the page reads like a useful player explanation instead of a stack of facts. The pass must rewrite weak structure, not only check for banned phrases.

For game catalog pages, `description_md` should almost always contain one practical action section. The action depends on the game items or mechanic: how to train Instinct, how to reach islands, how to farm materials, how to unlock swords, how to roll gifts, how to hatch eggs, how to grow crops, how to equip accessories, or how to compare old rewards before trading.

If the items have no direct action, explain the nearest player behavior. A title color page can explain how title-count milestones unlock colors. A special-title page can explain why most entries are not normal player goals. A cosmetic page can explain where the cosmetic applies and how players usually encounter it.

The page should use formatting when it helps:

- numbered lists for steps, unlock paths, or training routes
- tables for repeated comparisons such as gift odds, source types, sea access, or rarity meaning
- bullets for short rules, mistakes, and examples
- paragraphs for the story that connects those pieces

Do not let a game catalog page land on random sections because the data had convenient fields. A Blox Fruits Instinct Levels page should explain how to train Instinct, what the 2824 and 5000 EXP milestones mean, and how normal Instinct connects to Instinct V2. It should not feel like three card notes were enlarged into article headings.

Do not make the reader sprint through the system. Explain the game items or mechanic first, then separate obtainment, comparison, availability, trading, crafting, or value notes into their own paragraphs when those ideas are not directly connected.

Headings should read like useful sentence fragments that tell the reader what the section helps them decide. Avoid lazy labels such as `How classes work`, `How weapons work`, `Overview`, `Value`, `Source`, or `Progression` unless the section immediately makes that phrase specific. Prefer `Where classes unlock and why stock matters`, `What to build first at each station`, `Why source matters before rarity`, or `When retired eggs change trade value`.

Use article-style structure when it helps the catalog page become useful:

- numbered lists for acquisition steps or linear unlock processes
- compact tables for comparing item groups, egg routes, rarity odds, sources, or replacement difficulty
- bullets for quick groups, examples, and mistakes
- paragraphs for the connective explanation that makes the page feel like one story

Do not include every researched fact. Keep facts that explain the game items or mechanic, support a decision, or prevent a common mistake.

When a field name is unclear, define it before using it:

- `seats` on a vehicle means how many passengers can ride, which matters for family roleplay, moving with friends, or carrying babies and pets.
- `source` means the actual route that created the item, such as a shop, event, egg, gift refresh, reward track, boss drop, Robux purchase, or old trade-only release.
- `availability` means whether the route still exists, appears only during events, rotates with weather or shops, or has already left the game.
- `uses` means how many times the item can be consumed or applied before it is gone.
- `chance` means the roll odds only when the unit is known; do not invent percentages.

Public copy should talk about the game items or mechanic, not the website surface. `catalog` can appear in titles or UI labels, but intro, description, FAQ, and wiki copy should usually say `pets`, `eggs`, `vehicles`, `crops`, `accessories`, or the real in-game name.

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

For wiki catalog output, keep `how_it_works_md` as an empty string unless a special route explicitly asks for it.

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
- Does `description_md` include a useful action/how-to/use section, or do notes explain why the items are passive?
- Does the visible title follow `All <N> <Item> in <Game>: <real player question>` unless a recorded reason explains a simpler title?
- Are `description_md` headings specific, action-led, and more useful than generic `How <collection> works` headings?
- Did you explain unclear fields?
- Did you define the game meaning of any field used as advice?
- Does the page teach the system before it talks about comparison?
- Is there enough depth for a new or casual player to understand the game items or mechanic?
- Did you avoid raw internal keys?
- Does copy match the item type or mechanic?
- Does the copy give enough context before jumping into fields or exceptions?
- Does each paragraph explain one connected concept?
- Are headings clear sentence-style fragments instead of rigid one-word labels?
- Does `wiki_md` explain the game items or mechanic without saying `Use the catalog`?
- Did each catalog page get its own `research-notes.md` and `final.json`?
- If this is the first page in a batch, did the user approve it as the gold standard?
- Are images expected from local dataset/codebase rather than Supabase page fields?
- Does the page avoid a game-specific one-off data file unless the dataset itself requires it?
