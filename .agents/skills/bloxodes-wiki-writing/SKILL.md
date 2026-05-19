---
name: bloxodes-wiki-writing
description: Write or rewrite Bloxodes Roblox game wiki hub content for wiki_pages fields. Use for /wiki pages, game hub meta descriptions, tips_md, controls_json, wiki SEO, Roblox universe-aware copy, and pages that should connect codes, catalog pages, events, tools, articles, checklists, quizzes, and live game metadata.
---

# Bloxodes Wiki Writing

## Start Here

Read:

- `agents/content/writing-core.md`
- `agents/content/research-policy.md`
- `agents/content/page-types/wiki-pages.md`
- `agents/wiki-catalog-workflow.md`
- `agents/content/final-edit.md`

If these files have not been read in the current task, read them before writing.

## What This Skill Is For

A wiki page is the hub for a Roblox game. It should orient the reader and let the live related sections carry current details such as codes, events, catalog collections, tools, articles, checklists, quizzes, and Roblox metadata.

Do not turn the wiki page into a giant article. The hub copy should explain how the game works at a useful level, then leave room for the related blocks to do their jobs.

Use these inputs:

- `research-notes.md`
- target `wiki_pages` row
- linked `roblox_universes` row
- related catalog pages by `universe_id` and code prefix
- active code and event availability when relevant
- game-specific datasets or notes
- current research on the game loop, creator, systems, events, codes, catalog collections, tools, and social/developer context

## Output Shape

Return valid JSON:

```json
{
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "tips_md": "",
  "controls_json": []
}
```

Only include fields being written.

## How To Write The Wiki Copy

Inspect the wiki row, Roblox universe row, and live related sections before writing. Then research the game loop in plain language. The copy should show that you understand what the player does in the game, what systems matter, and what a returning player may want to check quickly.

Keep `tips_md` short, practical, and game-specific. A good tip makes one clear point and gives enough context for the reader to know why it matters. Avoid generic advice that could fit any Roblox game.

Do not repeat details already shown in live related sections. If active codes, events, catalog collections, or tools are already rendered below, the wiki copy should orient the reader rather than restating every item.

Do not write or rewrite `catalog_pages.wiki_md` during a wiki workflow. Those blurbs belong to the matching catalog or game-catalog workflow because they need collection-specific research. If a catalog blurb on the wiki is weak, treat that as a separate one-page catalog task.

If a tip uses terms such as source, availability, rarity, refresh, weather, Full Grown, or Neon, give enough context for a casual player to understand the term.

Use `Game created on` and `Game last updated on` for Roblox metadata. Keep Bloxodes freshness labels separate from game metadata. Fill controls only when verified.

## Finish

Run the final edit gate before saving `final.json` and preview `/wiki/<slug>` locally before production promotion.
