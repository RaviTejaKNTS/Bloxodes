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

## How To Edit

Read the draft like a player, not like the person who wrote it. Ask whether the page teaches the topic, whether every sentence earns its place, and whether the result can be saved to the database without another cleanup pass.

For catalog, game-catalog, article, and tool pages with body copy, confirm the FLOW pass already happened. If it did not, stop and run `bloxodes-flow-edit` first. Final edit is not allowed to silently replace FLOW.

Reconfirm the player-facing research and target DB fields. Then cut generic openings, repeated ideas, unsupported claims, inflated importance, vague authority, promotional polish, fake analysis tails, and forced structures.

Replace broad claims with specific game, item, event, tool, or dataset details. If the copy names a field such as source, rarity, availability, chance, seats, uses, refresh, or price, it should explain the player-facing meaning before relying on that field as advice.

Public copy should not mention internal research, scraping, AI, prompts, Bloxodes process, or the database. It should also avoid website-first lines such as `Use the X catalog`, `check the catalog`, `this page`, or `dataset`.

Check the shape as carefully as the prose: Markdown should render cleanly, JSON should parse, FAQs should use the expected object shape, article `sources` and `tags` should be honest, and titles or meta descriptions should be readable.

For catalog and game-catalog pages, confirm that `research-notes.md` records the user-confirmed item-card section style and card data shape before final copy. The confirmation must be explicit. Do not accept "user asked me to write the page" as approval of the card sections or card fields. If `description_json` is used, it should contain short section-level notes, and `description_md` should not repeat those same notes.

Also confirm the data and image audit. `research-notes.md` should show local item count, source count, rendered card/table count, title count, image coverage, missing or extra items, and the data action. If research found missing items or expected images and the gap was not fixed or explicitly accepted, the content is not ready.

Also confirm the rendered section and card contracts. The `description_json` keys must match the sections the route actually renders, not the sections the writer hopes it renders. If the route groups by `rarity`, `Other`, or another field while the copy is written for `Walls`, `Floors`, `Common`, `Legendary`, or another section set, the content is not ready. If the cards show raw long descriptions, raw `pros`/`cons`, nested objects, source HTML, vague meta text, or unexplained yes/no values, the content is not ready either.

Count contracts matter too. Count-based titles should match local data and rendered cards unless the notes explain why they intentionally differ.

If a normal player can ask "what does that mean?" after a sentence and the surrounding copy does not answer it, the sentence still fails.

This gate is mandatory inside the same writing workflow. Do not treat it as an optional second pass that the user has to request.

## Completion Rule

Do not mark the content ready unless:

- `research-notes.md` has the reader goal, sources/data checked, confirmed facts, and unknowns
- `research-notes.md` explains the topic in plain language before implementation notes
- catalog or game-catalog notes contain a resolved data and image audit
- catalog or game-catalog notes contain an explicit user confirmation line for the card section style and card data shape
- any approved dataset or image update has been completed before final copy is imported
- `description_json` keys match the route's actual rendered section labels
- rendered card/table fields match the approved card data plan
- title counts, dataset counts, and rendered counts match or have a recorded intentional reason
- `final.json` is valid and shaped for the target table
- public copy passes the blockers in `final-edit.md`
- catalog, game-catalog, article, and tool body copy has gone through the FLOW pass when applicable
- remaining risks are recorded in `research-notes.md`

If important facts are uncertain, return the content as blocked or needs review.
