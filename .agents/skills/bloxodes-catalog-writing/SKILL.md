---
name: bloxodes-catalog-writing
description: Write one global Bloxodes catalog final.json after brief approval. Use for /catalog pages backed by catalog_pages, metadata, intro_md, description_md, how_it_works_md, description_json, faq_json, wiki_md, and final.json output.
---

# Bloxodes Catalog Writing

Use this after `bloxodes-catalog-research` and parent approval. For one Roblox game's item collection, use `bloxodes-game-collection-writing`.

## Workflow

1. Read the approved `brief.md`.
2. Create or update:

```text
tmp/content-workspace/<topic-slug>/catalogs/<catalog-code>/
  brief.md
  final.json
```

3. Write `final.json`.
4. Parse JSON before returning.

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
