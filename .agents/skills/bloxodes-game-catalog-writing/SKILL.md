---
name: bloxodes-game-catalog-writing
description: Write or rewrite Bloxodes game-specific dataset catalog content for pages like Grow a Garden crops, Adopt Me pets, Blox Fruits accessories, Brookhaven vehicles, and other data-backed Roblox game collections. Use for catalog_pages fields, wiki_md, dataset field explanations, local image-aware catalog copy, and game catalog SEO.
---

# Bloxodes Game Catalog Writing

## Start Here

Read:

- `agents/content/writing-core.md`
- `agents/content/research-policy.md`
- `agents/content/page-types/catalog-pages.md`
- `agents/content/page-types/game-catalog-pages.md`
- `agents/wiki-catalog-workflow.md`
- `agents/content/flow-pass.md`
- `agents/content/final-edit.md`

If these files have not been read in the current task, read them before writing.

## What This Skill Is For

Use this when a catalog page is powered by a game dataset, such as pets, crops, vehicles, accessories, eggs, bosses, currencies, tools, prizes, or other game-specific collections.

The job is not to turn fields into prose. The job is to understand the game system well enough that the cards make sense to a casual player.

The job also includes data readiness. If the item list, source count, rendered card count, title count, image coverage, or card fields are stale or incomplete, do not write around the problem. Record the gap, propose the data/image update, and only write final copy after the data state is approved and fixed or explicitly accepted.

Inspect:

- `research-notes.md`
- `data/<Game>/` item dataset
- `apps/web/src/lib/game-dataset-catalogs.ts`
- target `catalog_pages` row
- route renderer if the page has custom behavior
- local image paths when images matter
- game system context behind the collection
- current source counts and item names from research
- rendered card count and image coverage when the route exists

## Workflow

Identify the collection type and inspect real item examples before writing anything public. Research how players obtain, compare, use, trade, craft, hatch, farm, unlock, or save the items. The notes should explain the game system in plain English before implementation details.

Translate raw fields only after the gameplay term is clear. A field like `source`, `chance`, `rarity`, `seats`, `uses`, `refresh`, or `availability` is not useful until the page explains what it changes for the player.

Create a reader-first outline inside `research-notes.md`. It should name the reader questions, section order, details to cut, and places where a table, bullet list, numbered list, or short paragraph will help.

Before the section proposal, add a required data and image audit to `research-notes.md`. Compare local dataset count, rendered card count, page title count, source counts, and image coverage. List missing items, extra items, renamed items, stale fields, duplicate rows, missing images, and local images that are not wired. Mark the data action as `ready as-is`, `needs dataset update`, `needs image update`, or `blocked`.

For new games or new collections, gather or build the local dataset as part of this workflow. Research should produce the complete item list, clean names/slugs, useful card fields, and image plan before final writing. If repeatable updates will matter, prefer a collector script over a one-off manual dump.

The image plan must reject weak substitutions. Use direct in-game item art, enemy/object cutouts, NPC screenshots, station screenshots, or location screenshots where the catalog subject is clearly visible. Do not use edited guide thumbnails, site-branded cover art, arrows/callouts, generic hero art, or broad nearby screenshots that do not actually show the row subject. If no clean image exists, leave the row image empty and record the capture/source gap.

Before final writing, propose the data action, item-card section style, and card data shape. Explain the count/image audit, any dataset updates needed, the grouping axis, why it has in-game meaning, weaker alternatives, planned `description_json` keys and notes, what stays in `description_md`, which fields should appear on cards, which raw fields should be hidden, and whether the route needs a renderer override. Wait for explicit user confirmation before writing `final.json` or updating Supabase. A request like "write this page" or "continue" is not approval unless the user has already seen and accepted the data, section, and card proposal.

Once the data and structure are confirmed, update the local dataset/images first when needed, then write the page fields directly in first-pass final JSON. Include `wiki_md` and `wiki_sort_order` when the catalog belongs on a wiki hub.

Before the final edit gate, run the mandatory FLOW pass. Rewrite `description_md`, `how_it_works_md`, FAQs, headings, and transitions until the page reads like a useful player explanation. `description_md` must explain the whole collection or mechanic, not the card sections. When the collection has player action behind it, add a clear action section such as how to get, find, unlock, farm, grow, hatch, roll, craft, equip, travel, compare, or use the items. Use a table, bullets, or numbered steps when that explains faster than paragraphs. Then run the final edit gate before saving.

Before importing or calling the page done, prove the content can render. Compare the local dataset count, rendered card count, title count, and image coverage. Compare the planned `description_json` keys with the actual section labels produced by the route. Compare the planned card fields with the actual card fields too. Do not assume a field such as `rarity`, `category`, or `type` will be used because it exists in the dataset; inspect the rendered grouping or the same grouping logic used by the route. If the page needs `Walls` and `Floors` but the route is grouping by `rarity` or `Other`, fix the renderer or add the proper grouping behavior before importing. If the cards are showing raw descriptions, generic pros/cons blobs, nested stats, unexplained yes/no values, or fields that do not help a player decide, clean the dataset fields or add a route override before importing.

After importing to local Supabase, read the row back and verify the updated fields exist in the database. Then fetch or open the local page and confirm visible strings from `intro_md`, `description_json`, and `description_md` actually render. Also confirm card counts and image behavior. `final.json` by itself is not a completed page update.

For multiple catalog pages, finish one user-approved gold-standard page first. After approval, repeat the full workflow per catalog code. Each catalog needs its own `research-notes.md` and `final.json`.

## Writing Guidance

Keep the copy specific to the game system. Say what the collection does in play, how players get or use it, and which values change a decision.

Use `description_json` as the section-level context layer when item cards are divided into meaningful groups. Keep each note short and useful, usually one to three sentences, and place it near the cards it explains.

Keep cards as clean, scannable data. They should show pure player-useful facts such as role, source, price, rarity, chance, requirement, strength, limit, availability, damage, seats, or reward type. Do not show long marketing descriptions, raw HTML, raw `pros` and `cons` arrays, nested stats objects, or unlabeled values. If pros and cons matter, translate them into short data fields such as `Strength`, `Limit`, `Best for`, or `Trade note`.

Keep `description_md` focused on whole-page mechanics: how the system works, where it is in-game, how players obtain items, how prices, odds, or availability work, and mistakes that apply across the full collection. Do not repeat the `description_json` notes there. The FLOW pass should reject random sections that only exist because a field or card group existed.

Choose the section split by the strongest in-game meaning. Rarity, item type, source, event, location, shop, tier, world, unlock route, crop type, resource type, and boss are all possible. Pick the structure that helps players understand the collection, not the structure that is merely convenient.

Do not invent missing item stats, image paths, rewards, or requirements. If the dataset has a gap, record it in research notes and write around it honestly.

If research finds missing items or expected images, do not treat that as a copy caveat by default. The first move is to update the dataset or image wiring after approval. Only write around the gap when the user explicitly accepts the current data state or the source disagreement is explained.

Use practical player judgment when the facts support it: easy to replace, mostly collectible, good for quick tasks, gated by an event, trade-aware, or worth saving. Do not force opinions when the data does not support them.

Public copy should explain the collection itself. Avoid `Use the X catalog`, `check the catalog`, `this page`, `dataset`, or `Bloxodes` in public fields.

Set `seo_title` to the visible `title` by default, including item counts.

## Output

Save or return `final.json` ready for local Supabase review after the FLOW pass and final edit gate. Do not return preliminary copy for later cleanup, and do not create `brief.md` or `review.md`.
