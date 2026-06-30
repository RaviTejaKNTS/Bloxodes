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

## Voice & Tone

Bloxodes house voice: write like a player who knows the game well, telling a friend how it works. Calm, warm, and a little playful, never formal, corporate, or hyped.

- Simple English first. Short sentences, everyday words a younger player gets instantly. Explain any game term in plain words right where it appears.
- Do not use em dashes. Replace any em dash with a colon, comma, parentheses, or two short sentences. This applies to every output field: title, metadata, body, FAQ, and all JSON values.
- Playful, not loud. Drop in a light, dry touch of wit (roughly one per short paragraph) and always wrap it around a real fact, like "protection that overstays its welcome." The fact leads; the wit rides along. Never force a joke, stack puns, or let a quip hide the info.
- Gamer-buddy warmth. Talk to the player as "you," use real in-game nouns, and sound like someone who actually plays, not a manual.
- Spark from rhythm, not adjectives. Energy comes from concrete detail, a strong first line, and varied sentence length, not from words like *ultimate, insane, amazing, epic, must-have, game-changer*. Ban those.
- Open on the real thing: the item, mechanic, or answer. No "In this game…", "This collection…", "Welcome to…", or mood-setting warm-ups.
- Read the room. Keep the wit lighter, or drop it, when the reader is stressed: error fixes, "won't open", crashes, anything troubleshooting. Help first.
- Keep functional slots clean. Steps, task items, table cells, quiz questions, and input labels stay plain and direct. Let the playful voice live in intros, descriptions, and blurbs.
- No filler or AI tics. Cut "Additionally", "Furthermore", "It's important to note", and "not just… but". Every sentence earns its place.

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
