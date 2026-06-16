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

For catalog and game-catalog pages, focus hardest on `description_md`, FAQs, headings, and transitions. Weak pages often have true facts but weird sections. Fix the shape, not only the sentences.

For articles, simplify the shape before polishing the sentences. The article should answer the title with the fewest headings that keep it easy to scan. How-to topics should start with the action or steps, not a broad setup section. A complete short article is valid, even around 300 words, and should not be padded.

Also check the approved title promise during FLOW. If the title says `how to get them`, `locations`, `drops`, `chances`, `what they do`, `which should you unlock first`, `what should you build first`, or another specific answer, reshape `description_md`, FAQs, headings, cards, and section notes until the page actually delivers that answer.

For wiki catalog pages, leave `how_it_works_md` empty. Do not add a standalone section about how to read, use, scan, or interpret the page. Put useful gameplay explanations in `description_md`, `description_json`, card labels, or FAQs.

For wiki catalog pages, also enforce the hard public-copy rules: write only about the game, items, and in-game decisions; remove source, research, workflow, dataset, API, verification, and missing-evidence language; keep `intro_md` short and engaging; use SEO-friendly `description_md` headings that solve real player questions; use natural same-universe internal links only where they help; keep FAQs to 3-4 non-repeating questions unless there is a strong reason; do not use analogies or em dashes.

## Catalog Rules

Keep `description_json` and `description_md` separate:

- `description_json` explains specific card sections near those cards.
- `description_md` explains the game items or mechanic.

Every catalog or game-catalog `description_md` should include at least one useful action section when the items or mechanic involve player action. That can be how to get, find, unlock, farm, grow, hatch, roll, craft, equip, travel, compare, or use the items.

Use tables, bullets, or numbered steps when they explain faster than paragraphs. Do not force formatting when a paragraph is clearer.

Rewrite headings that feel random, field-shaped, disconnected, or too generic. A heading should tell the reader what the section is about to help them understand. Do not leave headings like `How classes work`, `How tools work`, `Overview`, or `Value` when the section can say `Where classes unlock and why stock matters` or `What to upgrade before pushing farther`.

## Finish

Update `final.json` directly with the FLOW-cleaned fields. Then run `bloxodes-final-edit`.

Do not call a catalog page ready if the FLOW pass has not happened.
