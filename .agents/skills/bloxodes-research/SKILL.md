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

For catalog and game-catalog pages, inspect the data as part of research. Count the local items, compare current source counts, check the rendered card count and title count when the page already exists, and count image coverage when images matter. If the sources show more items than the local dataset, or if expected images are missing, record the gap and mark the notes `needs data update` instead of pushing ahead to final copy.

Build the page structure inside the notes. This is not a formality. The outline should show the reader goal, the questions the page must answer, the order that will make sense, which details should be cut, and where a table, bullet list, numbered list, or short paragraph will explain the idea best.

For catalog and game-catalog pages, also plan the later FLOW pass while the research is still fresh. Name what the page-level `description_md` should teach as a whole, what action/how-to/use section the reader needs, and which details belong in `description_json` because they only explain one card section. This prevents the final page from turning into a pile of accurate but disconnected headings.

For catalog and game-catalog pages, stop after research and propose the data action, item-card section style, and card data shape. Name the local/source/rendered counts, image coverage, any missing or stale items, the grouping axis, why it has real in-game meaning, weaker alternatives, the `description_json` notes, and what should stay in `description_md`. Mark the notes `needs data update` when the dataset or images need work. Mark the notes `needs section confirmation` until the user approves the data, section, and card plan.

Verify facts that can change: codes, events, prices, availability, dates, stats, formulas, and active reward pools. Record source links and checked dates in the notes. If a fact is missing or uncertain, say so there instead of hiding the gap with generic copy.

Only mark research `ready to write` when the content can be written without guessing, any required data/image update is complete or accepted, and any required section style has been confirmed.

## What Good Research Feels Like

Good research reads like someone genuinely learned the topic. It does not sound like a schema checklist. It includes real item names, real mechanics, real examples, common mistakes, and a clear explanation of why the page should be shaped a certain way.

For catalog research, good research also proves the data can carry the page. It says whether the local dataset is complete enough, whether images are wired, and whether the renderer will show the same sections and fields the page is about to explain.

Prefer local datasets, Supabase rows, official Roblox APIs, Roblox pages, and developer sources. Use community wikis when official details are incomplete, but keep unstable claims checked against the best current source you can find.

For multi-page jobs, one page still gets one research file. Shared game-level notes can support the work, but they do not replace page-specific research.

Do not create `brief.md`, `review.md`, separate fan-out files, or draft artifacts. Keep the useful research, decisions, unknowns, and risks inside `research-notes.md`.

## Output

Return a concise summary of:

- reader goal
- sources checked
- facts confirmed
- unknowns
- data/image action for catalog pages
- recommended page type and output shape
