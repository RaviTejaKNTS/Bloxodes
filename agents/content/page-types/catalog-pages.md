# Catalog Pages

Use this guide for Supabase-backed catalog pages at `/catalog/<code>` where the page copy lives in `catalog_pages`.

Use this like an editor's note, not a rigid template. The exact section shape should come from the collection, the dataset, and the player decision. Keep the rules firm, but let the page breathe when a different structure explains the collection better.

## Purpose

A catalog page should help readers understand a collection and compare its items quickly. It is not a blog post, but it still needs real explanation. The useful data should stay close to the top, while the copy teaches what the collection does in the game, how players get or use the items, and why certain values matter.

Do not start from fields. Start from the collection.

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

## Section Style Confirmation

For catalog and game-catalog changes, research the collection first, then propose the section style before writing final copy or updating Supabase.

The proposal should include:

- the recommended grouping axis, such as rarity, item type, source, event, location, tier, shop, world, or unlock route
- why that grouping has real in-game meaning
- alternatives considered and why they are weaker
- the planned `description_json` keys and short notes for each section
- how `description_md` will stay focused on whole-page context instead of repeating section notes

Wait for explicit user confirmation before making the content change. If the user approves a different section style, use that confirmed structure. Do not treat "write this page", "continue", or "go ahead" as section approval unless the user has already seen the exact proposed section labels and accepted them.

Before saving or importing, verify the route will actually render those sections. The planned `description_json` keys must match the computed section labels from the page renderer. If the renderer is grouping by a stale or blank field, such as empty `rarity` values, fix the renderer or add the confirmed grouping behavior before writing the local DB row.

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

## Description Markdown vs JSON

Prefer `description_md` for normal whole-page explanation.

Use `description_json` when:

- item cards are divided into meaningful sections
- copy should appear between those item sections
- each key maps to a specific rendered section or ordered slot
- the note helps the reader understand that group before scanning the cards

Do not duplicate the same paragraphs in both fields. If both are used, `description_json` should hold placement-specific section notes, while `description_md` should hold general context such as how the system works, where to find it, how to obtain items, or what mistakes to avoid.

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
- Does `description_md` give real context about mechanics, obtainment, value, availability, or player mistakes?
- If the page uses sections, did research propose and get approval for the section style before final writing?
- Did the route actually render those section labels, and do the `description_json` keys match them?
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
