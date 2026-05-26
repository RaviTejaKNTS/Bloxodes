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
- `agents/content/page-types/code-pages.md`
- `agents/content/page-types/events.md`
- `agents/content/page-types/articles.md`
- `agents/content/page-types/tools.md`
- `agents/content/page-types/checklists.md`

If these files have not been read in the current task, read them before researching or writing. Research is where the page earns its usefulness, so do not rush this step.

## How To Research

Use the game-first workspace:

```text
tmp/content-workspace/<game-or-topic-slug>/<page-folder>/
  todo.md
  research-notes.md
  final.json
```

For game discovery, use `tmp/content-workspace/<game-slug>/discovery/`. For game catalogs, use `tmp/content-workspace/<game-slug>/catalogs/<collection-slug>/`. For non-game/global content, use a stable topic slug as the workspace root.

Before research starts, copy the most specific tracker from `agents/content/todo-templates/` into the folder as `todo.md` and update it as work progresses. Use `page-research.md` only when no page-type template fits.

Write the notes so a human editor can understand the topic before seeing any database row. Explain what the thing is, how it works, what the player actually does, which terms need definition, which groups matter, and where people usually get confused.

For full game coverage, research in two passes. Pass 1 is catalog-led: resolve the game, audit coverage, confirm codes/events automation eligibility, and identify durable core in-game item collections. Pass 2 happens after the core catalog data exists and uses that data to decide wiki, checklist, quiz, tools, and focused evergreen articles. If a recommendation depends on item data or gameplay systems that have not been researched yet, mark it `blocked until catalog data` instead of guessing.

Then inspect the implementation context: local datasets, target Supabase rows, route behavior, official Roblox or developer facts, established community context, and any page-specific source material.

For catalog and game-catalog pages, inspect the data as part of research. Count the local items, compare current source counts, check the rendered card count and title count when the page already exists, and count image coverage when images matter. If the sources show more items than the local dataset, or if expected images are missing, record the gap and mark the notes `needs data update` instead of pushing ahead to final copy.

For game-specific catalog ideas, keep the scope to durable in-game item collections. Reject current season pass reward tracks, one-off event reward lists, current ranked season rewards, broad update summaries, gamepasses, badges, servers, developer products, and raw Roblox media. If an event or season creates permanent items, put those items inside the durable collection and mark source/availability there. UGC is a special exception only when the game has meaningful UGC items and should use the free Roblox items card pattern.

Build the page structure inside the notes. This is not a formality. The outline should show the reader goal, the questions the page must answer, the order that will make sense, which details should be cut, and where a table, bullet list, numbered list, or short paragraph will explain the idea best.

For catalog and game-catalog pages, also plan the later FLOW pass while the research is still fresh. Name what the page-level `description_md` should teach as a whole, what action/how-to/use section the reader needs, and which details belong in `description_json` because they only explain one card section. This prevents the final page from turning into a pile of accurate but disconnected headings.

For catalog and game-catalog pages, stop after research and propose the data action, title promise, item-card section style, and card data shape. Name the local/source/rendered counts, image coverage, any missing or stale items, the recommended visible title and `seo_title`, the exact promise the title makes to the reader, the grouping axis, why it has real in-game meaning, weaker alternatives, the `description_json` notes, and what should stay in `description_md`. Mark the notes `needs data update` when the dataset or images need work. Mark the notes `needs section confirmation` until the user approves the data, title promise, section, and card plan.

Verify facts that can change: codes, events, prices, availability, dates, stats, formulas, and active reward pools. Record source links and checked dates in the notes. If a fact is missing or uncertain, say so there instead of hiding the gap with generic copy.

For code pages, verify source wiring instead of manually collecting code rows. The `games.slug` must be the game slug only, `roblox_link` must be the Roblox experience URL, `source_url` must be the RobloxDen codes page, and `source_url_2` must be the Beebom codes page. Do not write active codes, expired codes, code names, code dates, active counts, current reward mappings, or `first_seen_at` values into local JSON, SQL, Supabase, or `final.json`; the codes refresh script owns that data. Code page prose must stay evergreen.

For event pages, verify whether rows can come from `roblox_virtual_events` or another approved importer. Do not manually write current event rows, live statuses, dates, reward timelines, or one-off event claims into JSON, SQL, Supabase, `final.json`, or `events_pages.content_md`. Event page prose must stay evergreen; the timeline is automation-owned.

For tools, use a hard gate. Check gameplay, search intent, and competing calculators/planners/trackers. Recommend or write a tool only when the input/output job, formula/data source, and player value are real. Otherwise mark it `do not create` or `potential future`.

For articles, check overlap before researching. Do not create articles for current codes, code troubleshooting, events, event timelines, generic beginner guides, broad catalog explanations, or topics already owned by wiki/catalog/checklist/quiz/tool pages. Good article research starts from one focused evergreen player question, such as how to get a specific item, complete a specific quest, use a specific mode/map, unlock a durable mechanic, or farm a stable resource.

Only mark research `ready to write` when the content can be written without guessing, any required data/image update is complete or accepted, and any required title promise, section style, and card data shape have been confirmed.

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
- recommended catalog title, title promise, and how the page will satisfy it
- source URL and refresh action for code pages
- recommended page type and output shape
