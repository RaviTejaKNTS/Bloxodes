---
name: bloxodes-game-collection-research
description: Research one approved Bloxodes game collection before data or writing. Use for /wiki/<game>/<collection> source proof, production overlap, collection scope, item-system understanding, useful card fields, section layout, image/source gaps, and whether the collection should proceed. Do not write final.json.
---

# Bloxodes Game Collection Research

Use this for one approved game collection. Research only. Do not write `final.json`.

## Output

Write:

```text
tmp/content-workspace/<game-slug>/collections/<collection-slug>/brief.md
```

## Research

1. Resolve the exact game, universe ID, official Roblox URL, and editorial game slug.
2. Check existing `wiki_collection_pages` on production db for that universe so we do not duplicate a collection.
3. Research online for the collection. Use broad search and stronger sources when available: game wiki, Fandom, BloxInformer, Beebom, Game8, Pro Game Guides, official pages, update logs, and useful creator/community references.
4. Do not stop at one result. Open useful internal links and understand how the game system works.
5. Decide whether the collection is durable, useful, and source-backed.
6. Identify the item fields players need, such as source, location, price, rarity, chance, requirement, damage, role, availability, or effect. These are examples; pick fields based on that game and collection.
7. Decide how the collection should be divided into sections before data work starts. Use sections that help players compare items, not sections that only mirror source tables.

## Gather Sources

We will create our collection pages from the sources you find. List down all the sources you find. We will use multiple sources to fill in gaps and verify information. If you find a source that is not useful, note it as well.

## Brief Shape

create a `brief.md` with the following shape:

```text
Evidence checked:
- Existing Bloxodes coverage:
- Source coverage:
- Collection scope:
- Why this should be a collection:

Sources to use:
- Source 1:
- Source 2:
- Source 3:
- etc.

Data plan:
- Item count expected:
- Useful fields:
- Grouping:
- Image needs:
- Known gaps or risks:

Page layout plan:
- Section field:
- Section order:
- Section labels:
- Why these sections help players:
- Card title field:
- Card description field:
- Card key-value fields:
- Hidden/source-only fields:
- Image field:
- Sort order:
- Section note needs:
- Renderer/config changes needed: yes/no
```

If source proof is weak, say what is missing and stop.
