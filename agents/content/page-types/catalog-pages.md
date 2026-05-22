# Catalog Pages

Use this guide for Supabase-backed catalog pages at `/catalog/<code>` where the page copy lives in `catalog_pages`.

Use this like an editor's note, not a rigid template. The exact section shape should come from the collection, the dataset, and the player decision. Keep the rules firm, but let the page breathe when a different structure explains the collection better.

## Purpose

A catalog page should help readers understand a collection and compare its items quickly. It is not a blog post, but it still needs real explanation. The useful data should stay close to the top, while the copy teaches what the collection does in the game, how players get or use the items, and why certain values matter.

Do not start from fields. Start from the collection.

Do not start from stale data either. If the collection has item cards, tables, images, counts, prices, sources, or availability states, research must check whether those facts are current enough before public copy is written.

Bad:

```markdown
Source and availability explain replacement value.
```

Better:

```markdown
Items from a current shop can usually be bought again. Items from an old event, reward pool, or retired rotation may only come from players who already own them, so the original source changes how carefully you should treat the item.
```

## Database Fields

Write in this shape:

```json
{
  "code": "",
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "intro_md": "",
  "description_md": "",
  "description_json": {},
  "how_it_works_md": "",
  "faq_json": [],
  "schema_ld_json": null,
  "thumb_url": null,
  "wiki_md": null,
  "wiki_sort_order": null
}
```

Only include fields you are updating. Do not invent image URLs or schema payloads.

## Field Roles

- `title`: visible page title. Usually `All <Collection> in <Game>` or a direct catalog name.
- `seo_title`: search title. For catalog and game-catalog pages, default this to the visible `title`, including the item count, because count-based titles are clearer in search results. Only diverge when the visible title is genuinely too long or a route has a special SEO format.
- `meta_description`: under 160 characters, specific to the collection.
- `intro_md`: short context before the primary data section.
- `description_md`: page-level Markdown for the whole collection: mechanics, obtainment, location, overall rules, and mistakes that apply beyond one item section.
- `description_json`: section-level context shown between item-card groups. Use it when the page is divided by rarity, item type, source, event, location, tier, shop, or another meaningful in-game grouping.
- `how_it_works_md`: explain how players should interpret the data in gameplay terms.
- `faq_json`: real questions players would ask after seeing the data.
- `wiki_md`: compact game-system explanation for the game wiki hub. It is not CTA/link-card copy.
- `wiki_sort_order`: only for game-linked catalogs.

Catalog pages own `wiki_md`. Write it during the catalog page workflow, not later during a wiki page rewrite, because it should come from the same collection-specific research as the full catalog page.

## Recommended Shape

For most catalog pages:

1. `intro_md`: what this collection is and why players compare it.
2. Primary item data/cards/table on the page, divided into the strongest useful sections when the dataset supports it.
3. `description_json`: short context beside or between those sections, usually one to three sentences per section.
4. `description_md`: tighter page-level context that explains the full system without repeating the section notes.
5. `how_it_works_md`: how to understand the data in gameplay terms.
6. `faq_json`: concise answers to likely questions.

Keep the page data-first. Do not bury the table/cards under long prose.

For a complex game system, `description_md` can still have real sections. When `description_json` already explains each item group, make `description_md` shorter and focused on full-page mechanics such as how to get the items, where to find the system in-game, how rolls or prices work, and what mistakes to avoid.

After the first-pass `final.json`, run the FLOW pass before final edit. This is where `description_md` gets reshaped into an explanation that reads cleanly instead of a pile of field-driven sections.

## Section Style Confirmation

For catalog and game-catalog changes, research the collection first, then propose the data state, section style, and card data shape before writing final copy or updating Supabase.

The proposal should include:

- local item count, rendered card/table count, page title count, source count, image count, and missing image count when the page has item data
- data update plan if the current local data is stale, incomplete, poorly shaped, or missing expected images
- the recommended grouping axis, such as rarity, item type, source, event, location, tier, shop, world, or unlock route
- why that grouping has real in-game meaning
- alternatives considered and why they are weaker
- the planned `description_json` keys and short notes for each section
- how `description_md` will stay focused on whole-page context instead of repeating section notes
- the planned card or table fields, with the player meaning of each field
- raw fields that should stay hidden, such as long descriptions, raw HTML, raw `pros`/`cons`, nested objects, source dumps, or vague yes/no values
- any route or renderer override needed to make the approved sections and approved card fields actually render

Wait for explicit user confirmation before making the content change. If the user approves a data update, finish that local data work before writing final copy. If the user approves a different section style or card field plan, use that confirmed structure. Do not treat "write this page", "continue", or "go ahead" as approval unless the user has already seen the exact proposed data state, section labels, and card fields and accepted them.

Before saving or importing, verify the route will actually render those sections. The planned `description_json` keys must match the computed section labels from the page renderer. If the renderer is grouping by a stale or blank field, such as empty `rarity` values, fix the renderer or add the confirmed grouping behavior before writing the local DB row.

Verify the rendered card fields too. Cards and tables should show pure comparison data that helps the player act: source, price, rarity, chance, requirement, best use, role, strength, limit, availability, damage, seats, reward type, or another concrete field. Do not render raw long prose, raw `pros`/`cons`, nested object dumps, source HTML, vague meta descriptions, or unexplained `Yes`/`No` values. If a page needs pros and cons, translate them into short labeled fields such as `Strength`, `Limit`, `Best for`, `Trade note`, or the equivalent for that collection.

## Data And Image Audit

When a catalog page has item data, add a `Data and image audit` section to `research-notes.md` before final writing.

Include:

- local dataset or table checked
- local item count
- rendered card/table count
- page title count, if the title includes a count
- current source counts found during research
- missing, extra, duplicate, renamed, stale, or unclear items
- image coverage and missing images when images matter
- data action: `ready as-is`, `needs dataset update`, `needs image update`, or `blocked`

If the audit finds more real items than local data, or finds that important images are missing, the page is not ready for final copy. Propose the data update and get approval first.

## Writing Rules

- Explain the fields players actually scan.
- Define the field in gameplay terms before using it as advice.
- Name the game mechanic, not just the collection.
- Add enough context for the collection to make sense before and after the item cards. A catalog page still stays data-first, but the copy should explain what the items do in the game, how players get them, why the fields matter, and what mistakes to avoid.
- Do not rush the explanation. Set up the collection first, then explain obtainment, value, availability, or mistakes in separate paragraphs.
- Keep one paragraph focused on one concept. If a paragraph starts covering source, rarity, trading, event status, and item value at once, split it.
- Use headings that read like useful sentence fragments, such as `How source changes item value`, not rigid labels such as `Source` or `Value`.
- Let the voice feel like a Roblox player explaining the collection. Use practical `you` and `your` guidance, but do not turn database fields into repeated `I/we` commentary.
- Use exact in-game terms for rarity, source, shop, event, currency, boss, region, or requirement.
- Do not say every item is useful or important.
- Do not say "all items are listed below" unless the sentence also helps readers scan.
- Do not write `Use the X catalog`, `check the catalog`, `this catalog`, `this page`, `dataset`, or `Bloxodes` in public copy.
- Avoid opening every field with `Compare...`; explain the collection or mechanic first.
- Avoid `Read category first`, `Check rarity first`, `Use source first`, and similar field-command lines. Explain the reason instead: category separates item types, rarity only helps sorting, source controls whether an item is still obtainable, and availability decides whether the player is looking at a current route or an older reward.
- Avoid vague field-first lines such as `seats explain use`, `source explains value`, `price explains replacement`, or `rarity helps scanning`. Write the actual gameplay explanation.
- Avoid AI-ish contrast patterns such as `It is not just X` or `Not only X, but also Y`. Catalog copy gets clearer when it says the useful point directly.
- Break `description_md` into small chunks when the copy explains different parts of the system, such as source, value, availability, and player mistakes. This is a readability preference, not a reason to add filler headings.
- Casual Roblox-player judgment is allowed when supported. Say an item is mostly a flex, mostly a collector piece, good for quick tasks, hard to replace, or not worth chasing only when the dataset or research supports that stance.
- Avoid broad claims like "helps you progress faster" unless you name the actual stat, reward, or unlock.
- Use `Not listed` only when the missing value matters.
- Do not expose raw keys such as `is_for_sale` or `asset_type_id` in prose. Translate them into player labels.

## Description Markdown FLOW

`description_md` is the most common place where catalog pages go wrong. It should not become a second version of the card sections. It should not jump from one random fact to another because the research notes had those facts nearby.

Write `description_md` as whole-page explanation:

- what the collection is in the game
- how players get, find, unlock, farm, roll, craft, equip, trade, or use it
- what the visible card fields mean in actual play
- what mistakes or misunderstandings apply across the collection
- what matters after the cards have already shown the item data

Every actionable catalog should include at least one action section. Pick the action that matches the collection:

- `How to get gift prizes in Adopt Me`
- `How to train Instinct levels in Blox Fruits`
- `How to reach these islands`
- `How to farm these materials`
- `How to use this calculator result`
- `How to read old rewards before trading`

If a catalog is passive or purely cosmetic, still explain how players encounter or apply the item. Do not skip the action section just because the item does not have combat stats.

Use structure that helps the reader:

- numbered lists for steps
- tables for repeated comparisons
- bullets for quick rules, mistakes, or examples
- paragraphs for context and judgment

The Adopt Me gift prizes page is the right shape: it explains how gifts work, separates gifts from prizes, uses tables for odds and item types, and then gives practical open/save/trade advice. A weak page might have correct headings like `EXP`, `Cap`, and `V2`, but if those sections do not explain the player action and the reason for each milestone, the reader still gets a weird article.

## Description Markdown vs JSON

Prefer `description_md` for normal whole-page explanation.

Use `description_json` when:

- item cards are divided into meaningful sections
- copy should appear between those item sections
- each key maps to a specific rendered section or ordered slot
- the note helps the reader understand that group before scanning the cards

Do not duplicate the same paragraphs in both fields. If both are used, `description_json` should hold placement-specific section notes, while `description_md` should hold general context such as how the system works, where to find it, how to obtain items, or what mistakes to avoid.

During the FLOW pass, check this separation again. If `description_md` is talking about `Common`, `Rare`, `Third Sea`, `Starter`, or another specific card section in the same way as `description_json`, move that idea into `description_json` or rewrite it as whole-page context.

Good `description_json` entries are short and useful:

```json
{
  "Common": "Common rewards show up most often in gift rolls. They are usually easy current pulls, but older common prizes can still matter when their refresh is gone.",
  "Legendary": "Legendary rewards are the chase tier in a gift refresh. They are still rolls, not guarantees, so the gift odds matter before spending a pile of Bucks."
}
```

## FAQ Rules

Good FAQ entries answer:

- how an item is obtained
- what a field means
- whether something is still available
- what changes during events
- why values may differ from another page
- which fields matter most when comparing

Avoid FAQ entries like:

- `What is this catalog?`
- `Why should I use this page?`
- `Is this page updated?` unless you can explain the update source honestly

## Output Example

```json
{
  "title": "All Accessories in Blox Fruits",
  "seo_title": "All Accessories in Blox Fruits",
  "meta_description": "Compare Blox Fruits accessories by rarity, source, bonuses, and requirements before choosing what to farm or equip.",
  "intro_md": "Accessories change how your Blox Fruits build feels because they add combat bonuses, movement boosts, or utility stats on top of your fruit, sword, gun, or melee setup.",
  "description_md": "Rarity is useful, but the bonus line matters more when you are choosing an accessory for a build. Check the source and requirement before chasing an item because several accessories are locked behind bosses, events, or sea progression.",
  "how_it_works_md": "Start with the bonus column, then check source and requirements. A high-rarity item is not always the right pick if its bonuses do not match your current fruit, weapon, or farming route.",
  "faq_json": [
    {
      "q": "Which accessory field should I compare first?",
      "a": "Compare bonuses first, then source and requirement. Rarity helps with scanning, but the bonus decides whether the accessory fits your build."
    }
  ],
  "wiki_md": "Accessories change a build through bonuses such as damage, movement, defense, or utility. Source and requirements matter because several strong accessories are locked behind bosses, events, or sea progression."
}
```

## Final Checks

- Does the intro explain the collection's role in the game?
- Did `research-notes.md` include a data and image audit when the page has item data?
- Do local item count, rendered card/table count, title count, and source count match or have a written reason for the difference?
- If the audit found missing items or missing images, was that fixed or explicitly accepted before writing?
- Does `description_md` give real context about mechanics, obtainment, value, availability, or player mistakes?
- Did the FLOW pass rewrite `description_md` for whole-page readability before final edit?
- Does `description_md` include a useful action/how-to/use section when the collection has player action behind it?
- If the page uses sections, did research propose and get approval for the section style and card data shape before final writing?
- Did the route actually render those section labels, and do the `description_json` keys match them?
- Did the route actually render the approved card/table fields?
- Are raw descriptions, raw `pros`/`cons`, nested stats, HTML, vague meta fields, and unexplained yes/no values absent from the cards?
- After import, did local Supabase read back the updated `description_json`, and did the local page visibly render at least one section note?
- Does `description_json` explain each section in one to three useful sentences without repeating `description_md`?
- Does the page define unclear terms before relying on them?
- Does the copy use real item examples when the system needs proof?
- Does each paragraph make one concept clear before moving to the next?
- Are headings clear enough to understand without reading the paragraph twice?
- Does `how_it_works_md` explain the data in gameplay terms without sounding like random field commands glued together?
- Are FAQ answers specific?
- Does `wiki_md` explain the collection for the game wiki hub without asking the reader to use a catalog?
- Is every claim supported by the dataset or research notes?
