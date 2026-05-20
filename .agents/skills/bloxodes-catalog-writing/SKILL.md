---
name: bloxodes-catalog-writing
description: Write or rewrite Supabase-backed Bloxodes catalog page content for catalog_pages fields. Use for /catalog pages, catalog metadata, intro_md, description_md, description_json, how_it_works_md, faq_json, wiki_md, catalog SEO, and catalog copy that must explain item fields, cards, tables, availability, rarity, source, price, requirements, or player comparison.
---

# Bloxodes Catalog Writing

## Start Here

Read:

- `agents/content/writing-core.md`
- `agents/content/research-policy.md`
- `agents/content/page-types/catalog-pages.md`
- `agents/content/final-edit.md`

If these files have not been read in the current task, read them before writing.

If the catalog is for a specific Roblox game dataset, use `bloxodes-game-catalog-writing` instead or additionally.

## What To Understand Before Writing

Before public copy starts, understand the collection as a real thing a player interacts with. A catalog page should not feel like fields were translated into sentences. It should explain what the collection is, what players do with it, how they get or compare items, and why the visible values matter.

Use these inputs:

- current `catalog_pages` schema or row
- route behavior if relevant
- item fields or examples
- topic research about the collection and important catalog items
- `research-notes.md`

## Output Shape

Return valid JSON shaped for `catalog_pages`:

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
  "wiki_md": ""
}
```

Only include fields being written.

## Workflow

Inspect the row, route, and item examples first. Then research the collection in plain language and save that work in `research-notes.md`.

If the page can be divided into item-card sections, propose the section style before writing final copy. The proposal should explain the grouping axis, why it has in-game meaning, which alternatives are weaker, what short `description_json` notes would appear between sections, and what should stay in `description_md`.

Propose the card data shape in the same pass. Name the fields that should appear on cards or tables, the player meaning of each field, which raw fields should stay hidden, and whether the route needs a renderer override. Cards should be clean data surfaces, not mini articles. Do not let raw long descriptions, raw HTML, raw `pros`/`cons`, nested stats objects, vague meta text, or unexplained `Yes`/`No` values appear just because they exist in the dataset.

Wait for user confirmation before writing final copy or updating Supabase. If the user changes the section style or card field plan, use the confirmed structure.

After the structure is confirmed, write directly in the target JSON shape. Do not create generic draft copy for later cleanup. Apply the core writing standard while drafting, then run the final edit gate before saving `final.json`.

## Writing Guidance

Keep the item data near the top of the route. The copy should support the cards or table, not bury them.

Set `seo_title` to the visible `title` by default, including item counts. Count-based titles are useful search context unless the route has a special reason to diverge.

Use `description_json` for short section-level notes when a useful section split exists. Use `description_md` for page-level mechanics: how the system works, where to find it, how players obtain items, and mistakes that apply across the whole collection. Do not repeat the same idea in both fields.

Choose sections by the strongest in-game meaning. Rarity, item type, source, event, location, shop, tier, world, and unlock route are all possible. The right choice is the one that helps players understand the collection long-term, not the field that happens to be easiest to sort.

Explain unclear card or table values in player language. If a value is `Yes`, `No`, a number, a rarity, or a source label, make sure the surrounding copy or UI label tells the reader what that value means.

Before importing, verify the rendered card contract. The actual page should show the approved section labels and approved card fields. If the renderer picks stale grouping, raw prose, nested objects, useless columns, or unexplained values, fix the renderer/data shape before calling the catalog done.

Keep public copy focused on the collection itself. Avoid website-first lines such as `Use the X catalog`, `check the catalog`, `this page`, `dataset`, or `Bloxodes`.

Write FAQs as real player questions. A good FAQ clears up obtainment, availability, a confusing field, a common mistake, or a decision the cards naturally create.

Write `wiki_md` during this workflow when the catalog belongs on a wiki hub. That blurb should explain the item system in the game, not act as a link-card CTA.

## Finish

Save or return only `final.json` shaped fields. Do not return preliminary copy for later cleanup, and do not create `brief.md` or `review.md`.
