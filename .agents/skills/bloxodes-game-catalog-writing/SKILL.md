---
name: bloxodes-game-catalog-writing
description: Write one Bloxodes game-specific catalog final.json after catalog research and data approval. Use for durable in-game collections backed by local datasets and wiki_catalog_pages, metadata, intro_md, description_md, description_json, faq_json, wiki_md, and final.json output.
---

# Bloxodes Game Catalog Writing

Use this after `brief.md` and data readiness are approved. Use it for one durable item or system collection inside one Roblox game.

## Workflow

1. Read the approved `brief.md`.
2. Confirm `Data readiness` says the dataset, useful fields, image coverage, and route assumptions are ready.
3. Create or update:

```text
tmp/content-workspace/<game-slug>/catalogs/<collection-slug>/
  brief.md
  final.json
```

4. Write `final.json`.
5. Parse JSON before returning.

## Writing Rules

- Write for the player who wants to find, compare, unlock, buy, farm, equip, trade, or understand the items.
- Start with what the collection is in the game.
- Keep card copy short. Cards should show one compact description plus useful facts.
- Put deeper explanation in `description_md`, not inside every card.
- Use clear fields: source, location, price, requirement, rarity, chance, damage, role, availability, or effect when those facts help players.
- Do not write copy that explains how to use the page. Write copy that explains the game system.
- The cards already list the items, so paragraphs should add context, strategy, warnings, or decisions.
- Section blurbs must not restate item names or card facts; use them only for group-level strategy, tradeoffs, warnings, or progression context.
- Do not show internal brief details, uncertainty labels, raw source language, or internal dataset language in public copy.
- `wiki_md` should be a short useful blurb for the game wiki hub.

## Field Jobs

- `title`: Use the Bloxodes catalog title pattern: `All N <Collection> in <Game>`. Add one short reader-focused angle only when it makes the title clearer.
- `seo_title`: Keep it close to the title, but make it natural for search.
- `meta_description`: Say what the reader can compare or learn from the page.
- `intro_md`: Explain what this collection is in the game and why players compare it.
- `description_md`: Answer the main question raised by the title in more depth.
- `how_it_works_md`: Explain page fields only when the fields need context. Keep it short.
- `description_json`: Explain section groups only when it adds context beyond the cards.
- `faq_json`: Answer useful follow-up questions not already covered.
- `wiki_md`: Give the wiki hub one short blurb about why this collection matters.

## Output Shape

```json
{
  "universe_id": 0,
  "wiki_slug": "",
  "collection_slug": "",
  "code": "",
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "intro_md": "",
  "description_md": "",
  "how_it_works_md": "",
  "description_json": {},
  "faq_json": [],
  "wiki_md": "",
  "is_published": true
}
```

Use `<game-slug>-<collection-slug>` for `code`.
Use `<game-slug>` for `wiki_slug` and `<collection-slug>` for `collection_slug`.
Do not use `roblox_universes.slug` for editorial slugs.
