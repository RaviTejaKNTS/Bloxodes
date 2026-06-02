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

Create or update the game-first workspace before writing:

```text
tmp/content-workspace/<game-slug>/wiki/
  todo.md
  research-notes.md
  final.json
```

Copy `agents/content/todo-templates/wiki.md` into the folder as `todo.md` and update it as work progresses.

## What This Skill Is For

A wiki page is the hub for a Roblox game. It should orient the reader and let the live related sections carry current details such as codes, events, catalog collections, tools, articles, checklists, quizzes, and Roblox metadata.

Do not turn the wiki page into a giant article. The hub copy should explain how the game works at a useful level, then leave room for the related blocks to do their jobs.

For new game coverage, prefer writing the wiki after at least one core catalog or strong catalog-led discovery exists. The wiki should be grounded in real item systems and gameplay loops, not surface-level guesses from the Roblox description alone.

Use these inputs:

- `research-notes.md`
- target `wiki_pages` row
- linked `roblox_universes` row
- related catalog pages by `universe_id` and code prefix
- active code and event availability when relevant
- game-specific datasets or notes
- current research on the game loop, creator, systems, events, codes, catalog collections, tools, and social/developer context

Before writing, map the rendered wiki page. `wiki_pages` owns title, SEO, tips, controls, cover, publish state, and the linked universe. The visible game summary comes from `roblox_universes.game_description_md`, not from `tips_md`. Related catalog sections come from catalog pages and their `wiki_md`. Codes, events, tools, articles, checklists, quizzes, media, badges, passes, servers, and developer sections appear only when local related rows exist. Record this map and the companion-data decision in `research-notes.md`. Use the editorial game slug for `/wiki/<slug>`. Do not copy `roblox_universes.slug`; universe slugs belong to `/stats/games/*` and may include universe IDs.

## Output Shape

Return valid JSON:

```json
{
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "tips_md": "",
  "controls_json": [
    { "action": "Interact", "desktop": "E" }
  ]
}
```

Only include fields being written.

If the rendered game summary needs work, also prepare the companion `roblox_universes.game_description_md` value and update it through the local seed/import workflow. Do not try to write that field into `wiki_pages`, and do not call the wiki complete while the visible summary is empty or weak.

## How To Write The Wiki Copy

Inspect the wiki row, Roblox universe row, and live related sections before writing. Then research the game loop in plain language. The copy should show that you understand what the player does in the game, what systems matter, and what a returning player may want to check quickly.

The wiki must answer the minimum player questions: what the game is, what a normal session looks like, which systems drive progress, what a new or returning player should check first, which researched and verified controls exist, which related sections exist locally, and which details are better left to related cards.

Keep `tips_md` short, practical, and game-specific. A good tip makes one clear point and gives enough context for the reader to know why it matters. Avoid generic advice that could fit any Roblox game.

Research controls as a required data point. Write accurate controls into `controls_json` and record the verification source or in-game check in `research-notes.md`. Do not guess generic Roblox controls. If useful controls cannot be verified, mark the wiki blocked or `needs controls research`; do not call it complete with an empty controls array.

Do not repeat details already shown in live related sections. If active codes, events, catalog collections, or tools are already rendered below, the wiki copy should orient the reader rather than restating every item.

Do not write or rewrite `catalog_pages.wiki_md` during a wiki workflow. Those blurbs belong to the matching catalog or game-catalog workflow because they need collection-specific research. If a catalog blurb on the wiki is weak, treat that as a separate one-page catalog task.

If a tip uses terms such as source, availability, rarity, refresh, weather, Full Grown, or Neon, give enough context for a casual player to understand the term.

Use `Game created on` and `Game last updated on` for Roblox metadata. Keep Bloxodes freshness labels separate from game metadata. Fill controls only when verified.

## Finish

Run the final edit gate before saving `final.json`. Then seed or import locally, read back both `wiki_pages` and the linked `roblox_universes` row, and preview `/wiki/<slug>` locally. The rendered page must show the expected title, metadata, game summary, tips, verified controls, related sections, and images when applicable before the todo can be marked complete or the work can be promoted.
