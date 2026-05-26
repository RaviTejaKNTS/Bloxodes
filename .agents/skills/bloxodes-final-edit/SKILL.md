---
name: bloxodes-final-edit
description: Mandatory final quality gate for Bloxodes content output. Use during every catalog page, game catalog page, wiki page, article, tool, metadata, FAQ, Markdown field, or Supabase JSON writing workflow to confirm factual accuracy, human writing, JSON shape, reader usefulness, and database readiness before returning or importing content.
---

# Bloxodes Final Edit

## Start Here

Read:

- `agents/content/final-edit.md`
- `agents/content/flow-pass.md`
- `agents/content/writing-core.md`

Also read the relevant page-type guide for the content being checked.

If these files have not been read in the current task, read them before approving content.

If the page folder has no `todo.md`, copy `agents/content/todo-templates/final-verification.md` into the same folder before the final gate. Otherwise update the existing `todo.md` and use `final-verification.md` as the checklist for any missing final/import checks.

## How To Edit

Read the draft like a player, not like the person who wrote it. Ask whether the page teaches the topic, whether every sentence earns its place, and whether the result can be saved to the database without another cleanup pass.

For catalog, game-catalog, article, and tool pages with body copy, confirm the FLOW pass already happened. If it did not, stop and run `bloxodes-flow-edit` first. Final edit is not allowed to silently replace FLOW.

Reconfirm the player-facing research and target DB fields. Then cut generic openings, repeated ideas, unsupported claims, inflated importance, vague authority, promotional polish, fake analysis tails, and forced structures.

Replace broad claims with specific game, item, event, tool, or dataset details. If the copy names a field such as source, rarity, availability, chance, seats, uses, refresh, or price, it should explain the player-facing meaning before relying on that field as advice.

Public copy should not mention internal research, scraping, AI, prompts, Bloxodes process, or the database. It should also avoid website-first lines such as `Use the X catalog`, `check the catalog`, `this page`, or `dataset`.

Check the shape as carefully as the prose: Markdown should render cleanly, JSON should parse, FAQs should use the expected object shape, article `sources` and `tags` should be honest, and titles or meta descriptions should be readable.

For articles, also check publishing metadata. The visible title should be SEO-friendly and human, with the main keyword near the front and an outcome phrase only when it makes the headline clearer or more inviting. Published articles need an `author_id`; if none is provided, the import workflow should pick one random author from `authors`. Game articles need an edited 1200x675 feature image made from the game thumbnail with a dark overlay and short centered title text, plus that image injected before the first H2 in `content_md`. Do not approve a raw game thumbnail as the final article cover unless generation is blocked and recorded.

For catalog and game-catalog pages, confirm that `research-notes.md` records the user-confirmed title promise, item-card section style, and card data shape before final copy. The confirmation must be explicit. Do not accept "user asked me to write the page" as approval of the title, card sections, or card fields. If `description_json` is used, it should contain short section-level notes, and `description_md` should not repeat those same notes.

Also confirm the data and image audit. `research-notes.md` should show local item count, source count, rendered card/table count, title count, image coverage, missing or extra items, and the data action. If research found missing items or expected images and the gap was not fixed or explicitly accepted, the content is not ready.

Also confirm the rendered section and card contracts. The `description_json` keys must match the sections the route actually renders, not the sections the writer hopes it renders. If the route groups by `rarity`, `Other`, or another field while the copy is written for `Walls`, `Floors`, `Common`, `Legendary`, or another section set, the content is not ready. If the cards show raw long descriptions, raw `pros`/`cons`, nested objects, source HTML, vague meta text, or unexplained yes/no values, the content is not ready either.

Count contracts matter too. Count-based titles should match local data and rendered cards unless the notes explain why they intentionally differ. Intent contracts matter as much as counts: if the title promises `how to get`, `locations`, `drops`, `chances`, `brewing`, `crafting`, `value`, `effects`, or another specific answer, the page must deliver that answer in the intro, cards, `description_md`, `how_it_works_md`, and FAQ where appropriate.

If a normal player can ask "what does that mean?" after a sentence and the surrounding copy does not answer it, the sentence still fails.

This gate is mandatory inside the same writing workflow. Do not treat it as an optional second pass that the user has to request.

## Completion Rule

Do not mark the content ready unless:

- `todo.md` exists, required gates through final edit are checked, and import/preview gates are checked before the page is called complete
- `research-notes.md` has the reader goal, sources/data checked, confirmed facts, and unknowns
- `research-notes.md` explains the topic in plain language before implementation notes
- catalog or game-catalog notes contain a resolved data and image audit
- catalog or game-catalog notes contain an explicit user confirmation line for the title promise, card section style, and card data shape
- any approved dataset or image update has been completed before final copy is imported
- the visible title and `seo_title` are unique, well-defined, count-accurate when they include a count, and fully supported by the page body
- `description_json` keys match the route's actual rendered section labels
- rendered card/table fields match the approved card data plan
- title counts, dataset counts, and rendered counts match or have a recorded intentional reason
- `final.json` is valid and shaped for the target table
- article output uses a simple SEO-friendly title, a non-null author, an edited feature image, and the card/detail pages are verified to show the same author and cover after import
- code-page `final.json` contains only `games` row fields, uses the game slug without `-codes`, leaves `seo_title` empty or null, puts RobloxDen in `source_url`, Beebom in `source_url_2`, and contains no manual `codes` array or code dates
- events-page `final.json` contains only evergreen `events_pages` fields and no manual timeline rows, live statuses, current event dates, one-off reward timelines, or freshness claims
- article output is focused and evergreen, with an overlap check against codes, events, wiki, catalogs, tools, checklists, and quizzes
- quiz output uses the game slug without `-quiz`, keeps page copy compact, validates the local `QuizData` shape, keeps easy questions easy, makes hard questions pro-level, and varies question rhythm without banning normal quiz phrasing
- public copy passes the blockers in `final-edit.md`
- catalog, game-catalog, article, and tool body copy has gone through the FLOW pass when applicable
- remaining risks are recorded in `research-notes.md`

If important facts are uncertain, return the content as blocked or needs review.
