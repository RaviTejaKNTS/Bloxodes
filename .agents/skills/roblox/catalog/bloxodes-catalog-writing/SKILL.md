---
name: bloxodes-catalog-writing
description: Write one global Bloxodes catalog final.json after brief approval. Use for /catalog pages backed by catalog_pages, metadata, intro_md, description_md, how_it_works_md, description_json, faq_json, wiki_md, and final.json output.
---

# Bloxodes Catalog Writing

Catalog pages cover Roblox-wide sets: music codes, font IDs, emotes, error codes. People land here with a job to do, like finding an ID, copying it and using it. Your copy gets them there fast, explains anything that trips them up, and sounds like a player who has done it a hundred times.

Use this after `bloxodes-catalog-research` and parent approval. For one game's item collection, use `bloxodes-game-collection-writing`.

## Read first

- The voice guide: `.agents/skills/bloxodes-voice/SKILL.md`, plus the "Catalog pages" section of `.agents/skills/bloxodes-voice/references/examples.md`.
- The approved `brief.md`.

## Workflow

1. Read the approved brief.
2. Create or update:

   ```text
   tmp/content-workspace/<topic-slug>/catalogs/<catalog-code>/
     brief.md
     final.json
   ```

3. Write `final.json`.
4. Parse the JSON before returning.

## How the copy should read

- **Explain what the items are and what players can do with them.** Say where the items show up, then the exact copy-and-paste step to use one.
- **Short intro, practical body.** `description_md` covers practical help, caveats and how to use or compare the items.
- **Talk about the items, not the website.** No `use this catalog`, `this page` or `the dataset`. Never narrate how the page was made. Follow Public Copy in root `AGENTS.md`.
- **No raw output.** No raw HTML, raw arrays, nested objects or unexplained `Yes`/`No` values.
- **FAQs answer real player questions.**

## SEO and headings

- `title` is one keyword-first H1: a natural, stable phrase that names the collection. Don't pair exact synonyms like `codes` and `IDs` when they mean the same value. Use the clearest term once. Never lead the H1 with an item count, month, year or freshness claim.
- Keep `seo_title` close to the H1. When a verified count or short synonym really helps search intent, put it after the main phrase in brackets, like `Roblox Music Codes [58K+ Audio/Song IDs]`. Skip the count if the source workflow doesn't maintain it.
- `meta_description` says what the reader can find, compare, filter or copy. Include a verified count only when the same refresh workflow maintains it.
- H2s describe the section fully on their own. Clear questions or tasks work well, like `What are Roblox Music Codes?` or `How to use Roblox Music Codes`. Avoid fragments like `Choosing a font`, `Overview`, `Details` and a generic `How it works`.
- Use a topic-specific FAQ heading in the renderer, like `Roblox Font IDs FAQ`, instead of a bare `FAQ` when the route supports a custom title.
- Don't add a visible `Browse all...` line, count line, eyebrow, badge or label just to create a heading level or repeat the H1. If repeated item names need headings and there's no useful parent heading, render item names as H2s. Use H3s only under a genuinely useful visible H2.
- Keep the H1, browser title, Open Graph title, breadcrumb name, WebPage name and ItemList name sourced consistently so they don't drift.

## Field jobs

- `code`: the stable catalog route code.
- `title`: the natural keyword-first H1, with no changing counts or dates.
- `seo_title`: follows the approved comparison-page pattern. A verified count or short synonym in brackets only when it improves search clarity.
- `meta_description`: what the reader can find, compare or understand, with a reason to click.
- `intro_md`: what the collection is and why players use it.
- `description_md`: answers the main question in depth without repeating item cards.
- `description_json`: short section notes only when they explain rendered groups.
- `how_it_works_md`: fields, filters, IDs, values, limits or lookup behavior when needed.
- `faq_json`: useful follow-up questions not already answered. Every entry is `{ "q": "...", "a": "..." }`.
- `wiki_md`: only when the catalog needs a short related-page blurb.

## Output shape

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
  "faq_json": [{ "q": "", "a": "" }],
  "wiki_md": "",
  "is_published": true
}
```

Only include fields the target row uses.
