---
name: bloxodes-game-catalog-writing
description: Write or rewrite Bloxodes game-specific catalog content for durable in-game collections backed by local datasets and wiki_catalog_pages. Use for pets, crops, vehicles, weapons, accessories, maps, materials, cosmetics, UGC exceptions, item data checks, images, wiki_md, metadata, and final.json.
---

# Bloxodes Game Catalog Writing

Read `agents/content-writing/agents.md` first.

Use this for one durable item or system collection inside one Roblox game. Good scopes include pets, crops, vehicles, weapons, accessories, maps, materials, bosses, classes, currencies, cosmetics, and useful UGC collections. Skip temporary reward tracks, one-off event lists, current ranked rewards, gamepasses, badges, developer products, servers, broad update summaries, and raw Roblox media.

## Workflow

1. Resolve the game identity: universe ID, root place ID, creator, Roblox URL, and editorial wiki slug.
2. Check production for an existing `/wiki/<game-slug>/<collection-slug>` page by universe ID, wiki slug, collection slug, code, title, route, and synonyms.
3. Inspect local data under `data/<Game>/`, image folders, and `apps/web/src/lib/game-dataset-catalogs.ts` when relevant.
4. Gather or verify item rows from online sources. Roblox APIs can help with game identity and media, but not as the source of in-game item lists.
5. Create workspace:

```text
tmp/content-workspace/<game-slug>/catalogs/<collection-slug>/
  research-notes.md
  final.json
```

6. Write `research-notes.md` with the collection scope, sources, item count, missing/extra items, image coverage, useful fields, grouping, and route assumptions.
7. Fix data/images if needed, or clearly record any accepted gap.
8. Write `final.json`.
9. Parse JSON and verify item count, title count, rendered sections, card fields, image paths, and metadata before import.

## Local Dataset Work

Use this process when a local game dataset is becoming a public catalog page.

1. Confirm local JSON parses.
2. Confirm the item count against sources, or record the accepted gap in `research-notes.md`.
3. Confirm each public card has fields players can use, such as source, location, price, requirement, rarity, chance, damage, role, availability, or effect.
4. Confirm expected image paths exist, or record why a row is text-only.
5. Confirm the route can render the chosen fields before publishing.
6. Seed and preview locally first when importing a new catalog page.
7. Verify title, metadata, item count, card fields, images, FAQ, wiki hub links, sitemap coverage, search, and revalidation.
8. Promote production content only through the normal controlled seed, upsert, or migration path.

## Writing Rules

- Write for the player who wants to find, compare, unlock, buy, farm, equip, trade, or understand the items.
- Start with what the collection is in the game.
- Keep card copy short. Cards should show one compact description plus useful facts.
- Put deeper explanation in `description_md`, not inside every card.
- Use clear fields: source, location, price, requirement, rarity, chance, damage, role, availability, or effect when those facts help players.
- Do not write copy that explains how to use the page. Write copy that explains the game system.
- The cards already list the items, so paragraphs should add context, strategy, warnings, or decisions.
- Section blurbs must not restate item names or card facts; use them only for group-level strategy, tradeoffs, warnings, or progression context.
- Do not show raw research notes, uncertainty labels, raw source language, or internal dataset language in public copy.
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
  "description_json": {},
  "faq_json": [],
  "wiki_md": "",
  "is_published": true
}
```

Use `<game-slug>-<collection-slug>` for `code`.
Use `<game-slug>` for `wiki_slug` and `<collection-slug>` for `collection_slug`.
Do not use `roblox_universes.slug` for editorial slugs.
