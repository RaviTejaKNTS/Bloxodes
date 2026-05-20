# Game-Specific Catalog Pages

Use this guide for dataset-backed game catalog pages such as Grow a Garden crops, Adopt Me pets, Blox Fruits accessories, Brookhaven vehicles, or any future `data/<Game>/` collection.

Use the guide flexibly. The work should always begin with the game system, but the final structure should come from the collection itself. A pet page, a crop page, a vehicle page, a boss page, and a prize page should not sound like the same page with nouns swapped.

## Purpose

Game catalog pages should turn local structured datasets into readable player references. The copy should explain how the collection works in that game, while the item cards or tables carry the detailed data.

The writing standard is closer to a useful wiki explanation than a database caption. The page does not need to become a full article, but it must teach the system before it asks the reader to compare items.

## Required Context

Before writing, inspect:

- `data/<Game>/`
- matching route or dataset config in `apps/web/src/lib/game-dataset-catalogs.ts`
- route family under `apps/web/src/app/(site)/wiki/[slug]/[collection]/` and the shared dataset renderers under `apps/web/src/app/(site)/catalog/`
- existing `wiki_catalog_pages` row
- `agents/wiki-catalog-workflow.md`

Check item examples, not just field names. If research notes do not include real examples and plain-language system explanation, do not write final copy.

## One-Page Standard

For game catalog work, build one approved page before scaling to a batch. Do not rewrite all collections in one script until the first page proves the depth, tone, and structure.

## Catalog Code Rules

Use this stable code for scripts, search, and old URL redirects:

```text
<game-slug>-<collection-slug>
```

Examples:

- `grow-a-garden-crops`
- `adopt-me-pets`
- `blox-fruits-accessories`

The title usually follows:

```text
All <Collection> in <Game>
```

For game-catalog pages, `seo_title` should usually match the visible `title` exactly, including the item count when the title has one. Do not simplify `All 1,898 Furniture Items in Adopt Me` into `All Adopt Me Furniture`; the count is useful search context and can improve click appeal.

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

## Section Style Confirmation

Before writing or updating a game-catalog page, research the collection and propose the item-card section style and card data shape to the user. This applies whether the page already exists or the page is being created fresh.

Choose the grouping with the strongest in-game meaning. Rarity is often better than refresh date when rarity is how the game divides rewards. Source can be better than rarity when obtainment is the real player decision. Item type can be better when the collection mixes tools, vehicles, strollers, weapons, or materials. Other useful grouping axes can be event, location, shop, world, tier, level range, unlock route, crop type, resource type, or boss.

The proposal must include:

- recommended grouping axis
- why that axis helps players understand the collection long-term
- weaker alternatives and why they are not the first choice
- planned `description_json` keys and one-to-three-sentence notes for each section
- which parts stay in `description_md` as whole-page explanation
- planned card fields and the player meaning of each one
- raw fields that should be hidden from cards, such as long `description`, raw `pros`, raw `cons`, nested `stats`, source HTML, or unclear yes/no values
- whether the dataset or route renderer needs an override so the approved fields actually appear

Wait for explicit user confirmation before writing `final.json` or updating local Supabase. If the user changes the section style, use the confirmed style. A broad page request is not section approval. The notes should say what the user approved, such as `confirmed category sections: Walls and Floors`, instead of saying the user merely requested the page.

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

For sectioned catalog pages, the outline must separate `description_json` and `description_md` jobs. `description_json` sets up each item section near the cards. `description_md` explains the full game system, such as where the system lives in-game, how players obtain items, how prices or odds work, and what mistakes apply across the whole collection. Do not repeat the same section notes in both fields.

Do not make the reader sprint through the system. Explain the collection first, then separate obtainment, comparison, availability, trading, crafting, or value notes into their own paragraphs when those ideas are not directly connected.

Headings should read like useful sentence fragments. Prefer `How retired eggs change trade value` over `Value`, or `Why source matters before rarity` over `Source`.

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

## Image Rules

- Use local dataset images when the route supports them.
- Do not add `wiki_image_urls` or per-page image arrays to Supabase.
- If images are missing, record the gap in research notes.
- Do not invent image paths.

## Copy By Collection Type

### Items, accessories, gear, weapons

Focus on rarity, source, stats, requirements, and whether the item fits a build.

### Pets, eggs, mounts, companions

Focus on rarity, source, availability, age/stage rules, abilities, event status, and what makes the pet easy or hard to get again.

### Crops, materials, currencies

Focus on source, value, conversion, refresh timers, crafting, farming, and whether the resource is repeatable.

### Bosses, enemies, quests, islands

Focus on level range, location, rewards, unlocks, and progression order.

### Events

Focus on start/end times, event status, rewards, and what changes while the event is active.

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
- Did you propose the item-card section style after research and get user confirmation before final writing?
- Is the section grouping based on real in-game meaning instead of only the easiest dataset field?
- Did you verify the route actually renders the confirmed section labels?
- Does `description_json` give short useful setup notes for each confirmed section?
- After local import, did the database row read back with the updated `description_json`, and did the local page render those notes?
- Does `description_md` stay focused on whole-page mechanics instead of repeating section notes?
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
