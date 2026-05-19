---
name: bloxodes-research
description: Research Bloxodes content before writing or updating pages. Use for Roblox game facts, codes, events, catalog datasets, wiki hubs, articles, tools, Supabase field checks, source notes, local dataset review, current Roblox data, and any content where facts may be stale or must be source-aware.
---

# Bloxodes Research

## Start Here

Read:

- `agents/content/research-policy.md`
- `agents/content/PROCESS.md`

Then read the matching page-type guide:

- `agents/content/page-types/catalog-pages.md`
- `agents/content/page-types/game-catalog-pages.md`
- `agents/content/page-types/wiki-pages.md`
- `agents/content/page-types/articles.md`
- `agents/content/page-types/tools.md`

If these files have not been read in the current task, read them before researching or writing. Research is where the page earns its usefulness, so do not rush this step.

## How To Research

Create or update `tmp/content-workspace/YYYY-MM-DD/<page-type>/<slug-or-code>/research-notes.md`.

Write the notes so a human editor can understand the topic before seeing any database row. Explain what the thing is, how it works, what the player actually does, which terms need definition, which groups matter, and where people usually get confused.

Then inspect the implementation context: local datasets, target Supabase rows, route behavior, official Roblox or developer facts, established community context, and any page-specific source material.

Build the page structure inside the notes. This is not a formality. The outline should show the reader goal, the questions the page must answer, the order that will make sense, which details should be cut, and where a table, bullet list, numbered list, or short paragraph will explain the idea best.

For catalog and game-catalog pages, stop after research and propose the item-card section style. Name the grouping axis, explain why it has real in-game meaning, mention weaker alternatives, sketch the `description_json` notes, and say what should stay in `description_md`. Mark the notes `needs section confirmation` until the user approves that structure.

Verify facts that can change: codes, events, prices, availability, dates, stats, formulas, and active reward pools. Record source links and checked dates in the notes. If a fact is missing or uncertain, say so there instead of hiding the gap with generic copy.

Only mark research `ready to write` when the content can be written without guessing and any required section style has been confirmed.

## What Good Research Feels Like

Good research reads like someone genuinely learned the topic. It does not sound like a schema checklist. It includes real item names, real mechanics, real examples, common mistakes, and a clear explanation of why the page should be shaped a certain way.

Prefer local datasets, Supabase rows, official Roblox APIs, Roblox pages, and developer sources. Use community wikis when official details are incomplete, but keep unstable claims checked against the best current source you can find.

For multi-page jobs, one page still gets one research file. Shared game-level notes can support the work, but they do not replace page-specific research.

Do not create `brief.md`, `review.md`, separate fan-out files, or draft artifacts. Keep the useful research, decisions, unknowns, and risks inside `research-notes.md`.

## Output

Return a concise summary of:

- reader goal
- sources checked
- facts confirmed
- unknowns
- recommended page type and output shape
