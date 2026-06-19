---
name: bloxodes-game-catalog-writing
description: Write one Bloxodes game-specific catalog final.json after catalog research and data approval. Use for durable in-game collections backed by local datasets and wiki_catalog_pages, metadata, intro_md, description_md, description_json, faq_json, wiki_md, and final.json output.
---

# Bloxodes Game Catalog Writing

Use this after `brief.md` and data readiness are approved. Use it for one durable item or system collection inside one Roblox game.

## Workflow

1. Read the approved `brief.md`.
2. Confirm `Data readiness` says the dataset, section field, card fields, image coverage, and renderer/config support are ready.
3. Create or update:

```text
tmp/content-workspace/<game-slug>/catalogs/<collection-slug>/
  brief.md
  final.json
```

4. Write `final.json`.
5. Parse JSON before returning.

## Writing Rules

**Key rules**

- Always write in simple English that is easy for anyone to understand.
- Write for Roblox players like a Roblox player who gathered the catalog for everyone to check.

**Do Not**

- Do not write about sources, dataset, or what this page is about.
- Do not write about your actions. Always focus on the game, items, and players.
- Do not write copy that explains how to use the page. Write copy that explains the game system.


**intro_md**

- Write one small paragraph that gets directly into the game item system.
- Give context and cue to the catalog with no repeated info that's anywhere on this page.

**Card copy**

The card should have only this and nothing more:

- Name of the item
- Short description of the item
- Useful key-value facts that are easy to scan.
- There is no limit on how many key value pairs you can have, but only include the ones that are useful for players to compare items.
- Card details come from the dataset. Do not invent fields in `final.json`; make sure the dataset already has the fields the page needs.

**description_json**

Explain section groups only when it adds context beyond the cards.
This goes above each cards section and should not repeat the card copy. It should be a small paragraph that gives context to the group of items in that section.
`description_json` keys must match the actual rendered section labels from the dataset. If the dataset sections are `Basic`, `Rare`, and `Exclusive`, use those exact keys.
Do not create a section note for every section unless it helps. Empty `description_json` is fine when the section labels already explain enough.


**Description_md**

Write 2-3 small sections giving more context, strategy, warnings, or decisions. Do not repeat the card copy. The sections should be small and easy to read.

You can use headings that are almost like sentences. Do not use more than 2 headings. The sections should be small and easy to read.

Do not fluff up, repeat info. Give the available info that is needed and helpful for people

Write in simple English that is easy for anyone to understand.

**wiki_md**

Write one short useful blurb for the game wiki hub.

## Field Jobs

- `title`: Use the Bloxodes catalog title pattern: `All N <Collection> in <Game>`. Add one short reader-focused angle only when it makes the title clearer.
- `seo_title`: Keep it close to the title, but make it natural for search.
- `meta_description`: Say what the reader can compare or learn from the page.
- `intro_md`: Explain what this collection is in the game and why players compare it.
- `description_md`: Answer the main question raised by the title in more depth.
- `how_it_works_md`: Explain page fields only when the fields need context. Keep it short.
- `description_json`: Explain section groups only when it adds context beyond the cards. Keys must match rendered section labels.
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
