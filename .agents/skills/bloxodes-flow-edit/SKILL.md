---
name: bloxodes-flow-edit
description: Rewrite Bloxodes public copy for reader flow after first-pass final.json and before final edit. Use for catalog pages, game catalog pages, articles, tools, wiki copy, description_md, how_it_works_md, FAQ, headings, section order, story-like flow, action/how-to sections, and human Roblox-player readability.
---

# Bloxodes FLOW Edit

## Start Here

Read:

- `agents/content/flow-pass.md`
- `agents/content/writing-core.md`
- the matching page-type guide in `agents/content/page-types/`
- `agents/content/final-edit.md`

If these files have not been read in the current task, read them before approving or importing content.

## What This Skill Does

Use this after research, data/card approval, data updates, and the first-pass `final.json`.

The FLOW pass is a rewrite pass. It does not only check whether the copy follows rules. It changes the copy until the page reads in an order that makes sense to a normal Roblox player.

Before editing, open the page folder's `todo.md` and confirm the research/data gates that apply to the page type are checked or intentionally blocked. After rewriting, mark the FLOW item complete in `todo.md` and record the pass in `research-notes.md`.

For catalog and game-catalog pages, also confirm the player-usefulness gate and required fact matrix are present. FLOW should make the copy answer the player task, not explain around missing data. If the page needs prices, damage, upgrade steps, shops, chances, locations, requirements, or route order and those facts are source-backed but absent from data/cards/body, stop and mark the work as needing data update.

For catalog and game-catalog pages, focus hardest on `description_md`, `how_it_works_md`, FAQs, headings, and transitions. Weak pages often have true facts but weird sections. Fix the shape, not only the sentences.

Also check the approved title promise during FLOW. If the title says `how to get them`, `locations`, `drops`, `chances`, `what they do`, or another specific answer, reshape `description_md`, `how_it_works_md`, FAQs, and headings until the page actually delivers that answer.

## Catalog Rules

Keep `description_json` and `description_md` separate:

- `description_json` explains specific card sections near those cards.
- `description_md` explains the whole collection or mechanic.

Every catalog or game-catalog `description_md` should include at least one useful action section when the collection has an action behind it. That can be how to get, find, unlock, farm, grow, hatch, roll, craft, equip, travel, compare, or use the items.

Use tables, bullets, or numbered steps when they explain faster than paragraphs. Do not force formatting when a paragraph is clearer.

Rewrite headings that feel random, field-shaped, or disconnected. A heading should tell the reader what the section is about to help them understand.

## Finish

Update `final.json` directly with the FLOW-cleaned fields. Then run `bloxodes-final-edit`.

Do not call a catalog page ready if the FLOW pass has not happened.
