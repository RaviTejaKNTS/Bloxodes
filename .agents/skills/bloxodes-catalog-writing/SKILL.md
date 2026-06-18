---
name: bloxodes-catalog-writing
description: Write or rewrite global Bloxodes catalog page content backed by catalog_pages. Use for /catalog pages, metadata, intro_md, description_md, description_json, faq_json, wiki_md, source-aware item explanations, and catalog final.json output.
---

# Bloxodes Catalog Writing

Read `agents/content-writing/agents.md` first.

Use this for global catalogs such as Roblox avatar items, free items, music IDs, decal IDs, color codes, or admin commands. For one Roblox game's item collection, use `bloxodes-game-catalog-writing`.

## Workflow

1. Check production for existing catalog coverage by code, title, route, source URL, and topic synonyms.
2. Inspect the current row, local dataset, rendered page behavior, and item examples.
3. If the page is item-backed, verify item count, rendered count, title count, useful fields, and image coverage.
4. Create workspace:

```text
tmp/content-workspace/<topic-slug>/catalogs/<catalog-code>/
  research-notes.md
  final.json
```

5. Write `research-notes.md` with what the catalog covers, production coverage, sources, data/image state, useful fields, and gaps.
6. If data or images are missing, update them or record the accepted gap before writing final copy.
7. Write `final.json`.
8. Parse JSON and verify the public route will show the intended fields and sections.

## Writing Rules

- Explain what the items are and what players can do with them.
- Keep intro copy short.
- Use `description_md` for practical help, caveats, and how to use or compare the items.
- Use `description_json` only for short notes tied to rendered sections.
- Do not write website-first lines like `use this catalog`, `this page`, or `the dataset`.
- Do not expose raw HTML, raw arrays, nested objects, or unexplained `Yes`/`No` values.
- FAQs should answer real player questions.

## Field Jobs

- `code`: Use the stable catalog route code.
- `title`: Name the collection clearly and match the real reader task.
- `seo_title`: Keep it close to the visible title unless search needs a cleaner version.
- `meta_description`: Say what the reader can find, compare, or understand.
- `intro_md`: Explain what the collection is and why players use it.
- `description_md`: Answer the main collection question in depth without repeating item cards.
- `description_json`: Add short section notes only when they explain rendered groups.
- `how_it_works_md`: Explain fields, filters, IDs, values, limits, or lookup behavior when needed.
- `faq_json`: Answer useful follow-up questions not already covered.
- `wiki_md`: Add only when the catalog needs a short related-page blurb.

## Output Shape

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
  "wiki_md": "",
  "is_published": true
}
```

Only include fields the target row uses.
