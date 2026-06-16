# Bloxodes Content Process

This is the v2 process. The old checklist-heavy workflow failed because it let research become a database summary. This process has one job: make the writer understand the game system deeply enough to explain it like a real Roblox player.

Use this process for serious rewrites, new page copy, or any content that will be saved to Supabase.

The current standard is outline-first, and for catalog work it is data-first and flow-first too. Research does not stop at facts. It must decide what the reader cares about, whether the item data is complete enough, which sections should exist, which sections should be cut, and which details are better shown as bullets, tables, numbered steps, or section-level `description_json` notes before `final.json` is written. After the first-pass JSON exists, the FLOW pass must rewrite the public fields so the page reads in an order that makes sense to a normal player.

Production coverage comes first. Before suggesting, writing, or approving any article, catalog, wiki, code page, event page, tool, checklist, or quiz, check the production database or public production page for existing coverage by universe ID, slug, title, topic wording, route, source URLs, and related page family. Do this before brainstorming new topics. If production already covers the same page or topic, mark the work as `[we already have a page]`, update or refresh only when needed, and look for a genuinely new topic instead of suggesting a duplicate.

If production coverage cannot be checked, do not pretend the topic is new. Record the gap in `research-notes.md`, mark the work `blocked` or `needs production coverage check`, and stop before recommending new page ideas.

For catalog and game-catalog pages, the workflow is also data-confirmation-first, title-confirmation-first, and section-confirmation-first. After research, audit the local dataset against current sources, check image coverage, propose any dataset updates that are needed, propose the visible title and `seo_title`, state the exact promise that title makes, propose how the item cards should be divided into sections, explain why that section style is the strongest in-game grouping, propose the clean card fields, and wait for explicit user confirmation before writing final copy or updating Supabase. Do not treat a general request like "write this page", "continue", or "go ahead" as approval unless the user has already seen the exact data, title, section, and card-data proposal.

Catalog and game-catalog research also has to pass the player-usefulness gate. The agent must identify the in-game jobs the reader came to solve, name the exact facts required to solve those jobs, and prove those facts are either in the dataset/card fields or intentionally unavailable. Do not replace missing player-useful facts with safe prose. If a source has prices, shops, upgrade paths, damage, locations, odds, requirements, or other decision-making facts and the local data does not, the page is `needs dataset update`, not `ready to write`.

Write workflow notes in a human editorial voice. The process should be strict, but the language should still explain the reason behind the step. A clear reason helps the model apply the workflow to a catalog page, article, tool, or wiki hub without turning every output into the same template.

## Player Usefulness Gate

For catalog and game-catalog pages, research must prove the page will help a player do something in the game. This gate happens before the data/title/section proposal.

Answer these questions in `research-notes.md`:

- What did the reader probably search because they want to do, choose, unlock, buy, upgrade, farm, compare, equip, trade, reach, or avoid?
- What decisions should the page make easier after one read?
- What exact facts are required for those decisions?
- Which required facts are already in the local dataset?
- Which required facts exist in sources but are missing locally?
- Which required facts are genuinely unknown, unstable, or not source-backed?
- After reading the finished page, what can the player now do in-game?

For item-backed pages, also create a required fact matrix:

| Reader need | Required facts | Source found? | In dataset/cards? | Public location |
| --- | --- | --- | --- | --- |
| Buy or unlock item | price, currency, shop, requirement, route | yes/no | yes/no | cards + how-to |
| Compare item | stat, role, rarity, source, limit, best use | yes/no | yes/no | cards/table |
| Use or upgrade item | NPC/station, cost, levels, process, reset rule | yes/no | yes/no | `description_md` |

Adjust the rows to the collection. A weapons page may need damage, price, currency, Armory slot, VIP/Gamepass/Robux/crate route, upgrade station, and priority advice. A map page may need location, spawn pressure, hold spots, objectives, and gear placement. A classes page may need unlock cost, role, team value, solo value, and upgrade or progression limits.

When search traffic matters or a user asks whether a page is worth writing, inspect top useful competitor/source pages as a coverage check. Do not copy their prose. Record which player tasks they answer, what useful facts or sections they include, where Bloxodes will match or beat them, and where the local data is weaker. If a competitor answers a core player action that Bloxodes does not, the page is not ready for final writing.

## Quiz Answer Option Gate

For quiz pages, research-backed facts are not enough. The answer choices must also be fair as a playable test. Do not let the correct answer stand out because it is the only long, detailed, qualified, or game-specific option. Distractors should usually come from the same system and use comparable specificity: other costs for a cost question, other routes for a route question, other stage counts for a taming question, other stats for a weapon question, and other mechanics for a mechanic question.

Before calling a quiz ready, check the question pool for answer tells. If the correct answer is the unique obvious longest option, or if the wrong answers are short joke labels beside a precise correct answer, rewrite the options. The player should have to know the game, not read the formatting.

## Non-Negotiable Standard

Do one page well before doing many pages.

No batch rewriting until one page has become the gold standard and the user has approved that standard. If the user asks for 15 catalog pages, pick one representative page first, finish it, preview it, and get approval before scaling.

After a gold-standard game catalog is approved and the user asks for an approved multi-catalog run, use `bloxodes-catalog-batch-runner` with `agents/content/todo-templates/catalog-batch.md`. The batch runner coordinates one catalog page per subagent, but each page still needs its own research notes, data/image audit, FLOW pass, final edit, and parent QA.

For full game coverage, discovery is a compact page map. Resolve the game, check production coverage before topic ideation, decide whether a codes page should exist, list every catalog page needed for durable in-game item collections, list article topics that complete coverage without repeating other page types, identify any real tool opportunities, and mark wiki/checklist/quiz as create or already covered. Do not treat missing catalog data as a reason to avoid recommending a needed page; record the item/source/image work as the next action. Event pages are handled by the events workflow, not by game-page discovery.

Catalog item rows are gathered through online research and source collection, not Roblox APIs. Use developer sources, Roblox experience pages, community wikis/databases, guides, videos, screenshots, changelogs, and competitor/source pages to build or repair the local dataset. Roblox APIs are only for universe identity, Roblox metadata, thumbnails, or cross-checks. Missing API item rows must never be used as a reason to block, skip, or shrink a needed catalog.

Codes and events are automation-owned page families. The page copy is evergreen orientation only. Never manually inject current code rows, expired code rows, current event rows, event statuses, dates, reward timelines, or "latest/current" claims into public prose or JSON. Codes come from the code refresh pipeline. Event timelines come from `roblox_virtual_events` or another approved importer.

Use a game-first local workspace so all related work for one game stays together. For non-game or global content, use a stable topic slug as the workspace root.

```text
tmp/content-workspace/<game-or-topic-slug>/
  discovery/
    todo.md
    research-notes.md
  wiki/
    todo.md
    research-notes.md
    final.json
  codes/
    todo.md
    research-notes.md
    final.json
  events/
    todo.md
    research-notes.md
    final.json
  catalogs/<collection-slug>/
    todo.md
    research-notes.md
    final.json
  articles/<article-slug>/
    todo.md
    research-notes.md
    final.json
  tools/<tool-code>/
    todo.md
    research-notes.md
    final.json
  checklist/
    todo.md
    research-notes.md
    final.json
  quiz/
    todo.md
    research-notes.md
    final.json
  subagents/<task-slug>/
    prompt.md
    response.md
```

Each serious workflow starts by copying the matching template from `agents/content/todo-templates/` into the page folder as `todo.md`. Read its `Use With` section before working so the tracker leads back to the right skill and docs. Keep the checklist crisp and update it as work progresses. It is a tracker, not a replacement for research notes.

A copied page todo is not a scratchpad. After copying a template into a workspace, only update `Status`, `Updated`, `Workspace`, and checkbox states. Do not add, remove, rename, reorder, or rewrite checklist items inside a page todo. If a gate is missing, update the master template and process docs, then copy that shape for future work.

A checkbox can only be marked done when the matching evidence exists. Do not check an item because the work is planned, partially done, or expected to pass later. Examples:

- `Import or preview locally` needs an import, seed, or local preview command.
- `Verify /wiki/<slug> renders...` needs rendered HTML or browser proof for the visible page.
- `Research and write controls_json` needs a source note or verification note for the controls. If controls cannot be verified, the page stays blocked or needs controls research.
- `Check related sections` needs the actual related rows or routes to be inspected and recorded.

No `brief.md`. No `review.md`. No fan-out plan file. No draft file. No generic shared batch research file pretending to cover every page.

## Required Reading Order

Before writing or editing public copy, read these files in this order:

1. `agents/content/writing-core.md`
2. `agents/content/research-policy.md`
3. matching page-type guide in `agents/content/page-types/`
4. `agents/content/flow-pass.md` for catalog, game-catalog, article, and tool pages with meaningful body copy
5. `agents/content/final-edit.md`

If this reading has not happened in the current task, do not write content.

## 1. Pick One Page

Choose one target page and identify the page type:

- catalog page
- game-specific catalog page
- wiki page
- code page
- events page
- article
- tool page
- checklist page
- quiz page

For catalog and game catalog work, do not rewrite every page in a game at once. Build one gold-standard page first. Good choices are pages with enough variety to expose the real writing standard, such as `adopt-me-food`, `adopt-me-vehicles`, `blox-fruits-accessories`, or `grow-a-garden-crops`.

## 1.5. Create The Todo Tracker

Before research starts, copy the matching checklist template into the page workspace as `todo.md`:

- discovery: `agents/content/todo-templates/discovery.md`
- wiki: `agents/content/todo-templates/wiki.md`
- code page: `agents/content/todo-templates/codes.md`
- events: `agents/content/todo-templates/events.md`
- catalog: `agents/content/todo-templates/catalog.md`
- game catalog: `agents/content/todo-templates/game-catalog.md`
- approved game catalog batch: `agents/content/todo-templates/catalog-batch.md`
- article: `agents/content/todo-templates/article.md`
- tool: `agents/content/todo-templates/tool.md`
- checklist: `agents/content/todo-templates/checklist.md`
- quiz: `agents/content/todo-templates/quiz.md`

Use `agents/content/todo-templates/page-research.md` only when no specific template fits. The `Use With` section in each template is mandatory context, not decoration: load the named skill/docs when the task depends on them. Update the checklist as work progresses. Do not let the tracker become a second research file; detailed facts, decisions, and risks belong in `research-notes.md`.

## 2. Research Like A Player, Not A Database

Create or update `todo.md` first, then create `research-notes.md` before writing `final.json`.

The first content action inside `research-notes.md` is the production coverage gate. Record which production tables or public URLs were checked, what existing rows/pages were found, and which candidate topics were rejected because production already covers them. Local rows are useful for draft state, but they do not replace the production check when deciding whether to suggest a new public page.

The notes must explain the topic in simple language. A good research file should feel like a smart player explaining the system to another player before any polished copy exists.

Do not make the notes sound like a form was filled out. Use the required headings, but write under them in normal sentences. The notes should make it obvious that the writer understands the topic, not only the table schema.

Research must answer:

- What is this thing in the game?
- What does the player actually do with it?
- How does it work during normal gameplay?
- What did the reader probably come here to answer?
- What in-game job should the page help the reader complete?
- What exact facts are required for that job?
- Which useful facts do current sources or competitor pages include that our local data is missing?
- What terms does a new or casual player need explained?
- What are the main item groups, reward groups, mechanics, or exceptions?
- How do players get, use, compare, trade, farm, craft, hatch, unlock, redeem, or calculate it?
- What is current, repeatable, retired, limited, event-only, premium, trade-only, or unclear?
- What real item examples prove the explanation?
- What do players misunderstand?
- What should the page teach before and after the cards, table, tool, or article body?
- What should be cut because it repeats the cards or adds trivia without helping a decision?
- What is the simplest clean structure for the finished page?

These are research questions, not required public headings. Do not turn `What is this thing?` into a default article section. For how-to articles, the public article should start with the action or steps unless a short definition is truly needed.

Schema, table fields, route files, and Supabase rows still matter, but they belong after the game/topic understanding. They are implementation context, not the research itself.

## 3. Use The V2 Research Notes Shape

Use this structure unless a page type clearly needs a small adjustment:

```markdown
# Research Notes: Page Title

Date: YYYY-MM-DD
Page Type: discovery | catalog | game-catalog | wiki | code-page | events | article | tool | checklist | quiz
Target: /path-or-code
Status: researching | needs data update | needs section confirmation | ready to write | needs review

## What this is

Explain the topic in plain English. Do not mention the website, database, dataset, or route here.

## How it works in the game

Explain the actual gameplay loop. What does the player do? What changes on screen or in inventory? What does the item, mechanic, tool, or page topic affect?

## Terms a player needs explained

List important terms and define them in human language. Examples: seats, source, rarity, needs, Full Grown, Neon, weather shop, gift refresh, drop chance, multiplier, requirement.

## Main groups or systems

Break down the natural groups that matter to players. Examples: normal food vs event food, current eggs vs retired eggs, one-seat vehicles vs multi-seat vehicles, shop items vs reward items.

## What players care about

Explain what is useful, collectible, easy to replace, hard to get, event-gated, premium, trade-only, worth saving, or mostly cosmetic.

## Player usefulness gate

For catalog and game-catalog pages, define the reader's real in-game job, the decision players are making, and the in-game answer they need. If the topic or data cannot help a player do, choose, find, buy, upgrade, or understand something real in the game, it is not ready.

## Required fact matrix

For catalog and game-catalog pages, make a small table that connects reader needs to facts, sources, local data, and public placement:

| Reader need | Required facts | Source found? | In dataset/cards? | Public location |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

If a required fact is source-backed but missing from local data or card fields, mark the status `needs data update`. Do not continue by writing around the gap.

## Competitor usefulness check

When the page is meant to compete in search, compare at least the strongest useful source or competitor page. Record the practical questions they answer, facts they expose, sections that help, and gaps Bloxodes can improve. This is a coverage audit, not permission to copy structure or wording.

## Real examples from the data

Use actual item names, groups, values, or rows from the local dataset or source material. Explain why each example matters.

## Data and image audit

For catalog and game-catalog pages, write this before the section proposal. This is a hard gate, not housekeeping.

Include:

- local dataset file and item count
- source counts found during research, with dates or source names
- rendered card count if the route exists
- page title count if the page already exists
- missing items, extra items, renamed items, duplicate items, stale fields, missing required facts, or weak card fields
- image coverage: cards with images, cards without images, images that exist locally but are not wired, and images that still need sourcing
- data action: `ready as-is`, `needs dataset update`, `needs image update`, or `blocked`

If research finds more items than the local dataset, finds that images are missing even though images are expected for the collection, or finds source-backed useful facts that are missing from the dataset, stop here and make the data issue visible. Do not write public copy on top of stale data or thin fields.

## Common mistakes or confusion

Write what a player might misunderstand and how the page should prevent that confusion.

## Reader questions and page outline

Write the actual section plan before drafting.

Include:

- primary reader goal
- must-answer questions
- how the required fact matrix will be satisfied in cards, body copy, FAQs, or route changes
- final section order
- parts to cut
- where bullets, tables, or numbered steps should be used
- how the page flows from context to action to caveats
- for catalog and game-catalog pages, the proposed data update plan if needed, recommended visible title and `seo_title`, exact title promise, content coverage needed to satisfy that title, item-card section style, the reason that grouping matches the game, alternatives considered, card fields to show or hide, and the `description_json` keys/notes that should appear between sections. For wiki catalog pages, the title should normally follow `All <N> <Item Or Collection> in <Game>: <real player SEO question>`.

## Missing or uncertain facts

List gaps honestly. Do not fill them with generic copy.

## Implementation notes

- Target table:
- Fields to write:
- Dataset or source files checked:
- Route or component behavior that affects rendering:
- Existing Supabase row checked:

## Writing angle

Explain what the final page should teach, what it should skip, the tone to use, and how deep the page needs to be.
```

If the `What this is`, `How it works in the game`, `Real examples from the data`, and `Reader questions and page outline` sections are weak, the research is not ready.

For catalog and game-catalog work, do not move from research to final copy until the player-usefulness gate, data state, title promise, proposed section style, and card data shape are confirmed. The proposal should name the primary player task, the required facts, dataset status, source-count agreement or disagreement, missing image count, recommended title, title promise, grouping axis, fields that belong on the cards, and raw fields that should not render. Choose the title, grouping, and card fields that have the clearest in-game meaning, not merely the fields that are easiest to sort. A wiki catalog title should not be only `All <N> <Collection> in <Game>` when research points to a real question such as which to unlock, how to get each one, where to go first, what to build first, or which entries are worth using.

The research notes must keep `Status: needs data update` when the item list or image coverage is not ready. They must keep `Status: needs section confirmation` until the title, section, and card plan is approved. When approval happens, record it plainly, for example: `Title, data, and section plan confirmed by user on YYYY-MM-DD: title promises how to get materials, update missing materials, group by source route, and show source, drop chance, Magic Power, and farming stage.` Do not write vague lines such as `user requested final copy` as a substitute for confirmation.

## 3.5. Build Or Update The Data Before Writing

For existing games, the data step is an audit first. For new games, the data step is a real build step.

After research and approval, update the local dataset before writing public copy when the audit says it is needed. That can mean adding missing items, cleaning names and slugs, adding useful card fields, adding source-backed prices, damage, locations, shops, odds, requirements, upgrade data, route notes, removing raw HTML, normalizing yes/no values into labeled fields, wiring local images, or creating a collector script when this game will need repeatable refreshes.

Only continue to `final.json` after the local dataset is in the shape the page will use. The page title count, local dataset count, rendered card count, expected source count, and required fact matrix should either match or have a written reason for the difference. If the title promises obtainment, locations, drops, chances, brewing, crafting, effects, bonuses, value, or comparison, the outline must show which fields and sections will answer that promise.

## 4. Write First-Pass `final.json`

Only write `final.json` after `research-notes.md` is marked `ready to write`. For catalog and game-catalog pages, that means the user has already confirmed the data state, title promise, proposed section style, and the card data shape, and any required dataset or image updates have been completed locally.

Before importing the final JSON, prove the render contract:

- list the local dataset count, rendered card count, and title count
- list the primary player task and required facts the page answers
- state the approved title promise and how the body satisfies it
- list the image count and missing image count when images matter
- list the actual section labels the route will render
- list the planned `description_json` keys
- confirm every planned section note matches a rendered section label
- list the actual card fields the route will render
- confirm cards do not show raw long descriptions, raw pros/cons, nested objects, HTML, or unexplained yes/no values
- if the route picks a bad grouping field, such as blank `rarity` values instead of real `category` values, fix the route or add the correct grouping behavior before importing

The final JSON must fit the destination table shape. Write the public fields as final copy from the start. Do not write placeholder copy and expect another pass to make it human.

Follow the outline from research notes. Do not dump every researched fact into the public fields. The first pass should already be useful, but it is not ready for import until the FLOW pass has checked and rewritten the reader path.

Catalog-style output:

```json
{
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "intro_md": "",
  "description_md": "",
  "description_json": {},
  "how_it_works_md": "",
  "faq_json": [],
  "wiki_md": ""
}
```

Catalog-style pages own their own `wiki_md`. That short hub blurb should be written while researching the catalog page because it depends on the same collection-specific facts, item examples, and game-system explanation.

Wiki output:

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

Article output:

```json
{
  "title": "",
  "slug": "",
  "meta_description": "",
  "content_md": "",
  "tags": [],
  "sources": []
}
```

Tool output:

```json
{
  "code": "",
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "intro_md": "",
  "how_it_works_md": "",
  "description_json": {},
  "faq_json": [],
  "cta_label": null,
  "cta_url": null,
  "thumb_url": null,
  "universe_id": null
}
```

Checklist output:

```json
{
  "page": {
    "universe_id": null,
    "slug": "",
    "title": "",
    "seo_title": null,
    "seo_description": "",
    "description_md": "",
    "is_public": true
  },
  "items": [
    {
      "section_code": "1",
      "title": "",
      "description": "",
      "is_required": false
    },
    {
      "section_code": "1.1",
      "title": "",
      "description": null,
      "is_required": false
    },
    {
      "section_code": "1.1.1",
      "title": "",
      "description": "",
      "is_required": true
    }
  ]
}
```

Checklist pages use `section_code` depth as the render contract. Parent rows such as `1` create major board sections, child rows such as `1.1` create labels inside a section, and leaf rows such as `1.1.1` become checkable tasks. Use the editorial game slug only for the public route, such as `/checklists/wizard-alchemy`; do not copy `roblox_universes.slug`. New checklist rows should include `seo_description` and `description_md`, and task titles must not include Markdown bullets.

Code page output:

```json
{
  "name": "",
  "slug": "",
  "is_published": true,
  "roblox_link": "",
  "source_url": "",
  "source_url_2": "",
  "seo_title": null,
  "seo_description": "",
  "intro_md": "",
  "redeem_md": "",
  "rewards_md": "",
  "troubleshoot_md": "",
  "find_codes_md": ""
}
```

Code pages are backed by `games` plus the `codes` table, but the content workflow only writes the `games` row. The slug is the editorial game slug only, such as `wizard-alchemy`, because the public route is already `/codes/<slug>`; do not copy `roblox_universes.slug`. `roblox_link` must hold the Roblox experience URL. `source_url` must hold the RobloxDen codes page URL, and `source_url_2` must hold the Beebom codes page URL so `scripts/codes/update-codes.ts` can collect live codes. Keep `seo_title` empty or null unless the user explicitly asks otherwise.

Never write active codes, expired codes, code names, `first_seen_at`, or other code rows manually in `final.json`, local JSON, SQL, or Supabase. After the game row is inserted or updated with the correct source URLs, run the codes refresh workflow, usually `npm run refresh:codes -- --slug <game-slug>`, and let that script upsert active and expired codes from the configured sources.

Code page prose and metadata must be evergreen. Do not include active code names, current reward tables tied to specific codes, month/year labels, exact dates, active-code counts, "latest", "current", "updated daily", or any other wording that will age between code refresh runs. The live codes UI owns active codes, dates, counts, and status. The article fields should explain reward types, redemption steps, troubleshooting, and official places to watch in a long-term way.

Events page output:

```json
{
  "universe_id": null,
  "slug": "",
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "content_md": "",
  "is_published": true
}
```

Events pages are backed by `events_pages` and timeline rows from `roblox_virtual_events`. Do not create an events page just because a game updates often. Event coverage needs sourced event names, status, dates or phases, rewards, mechanics, or Roblox virtual event feed evidence. If the evidence is weak, mark the page `do not create` or `blocked` in `research-notes.md`.

Never write event rows, current/upcoming/past status, exact live dates, current reward timelines, or one-off event claims manually in `final.json`, local JSON, SQL, Supabase, or `events_pages.content_md`. Event page prose and metadata must be evergreen. The timeline UI owns current event data through `roblox_virtual_events` or another approved importer.

Only include fields the page type owns. Leave unknown optional fields out instead of inventing values.

Wiki page work has a rendered-page contract. Before writing, map the visible wiki page areas to their source fields:

- `wiki_pages` owns `title`, `seo_title`, `meta_description`, `tips_md`, `controls_json`, `cover_image`, publish fields, and the linked `universe_id`.
- `roblox_universes.game_description_md` owns the visible game summary used by the wiki hub.
- `roblox_universes` owns live game metadata such as creator, genre, visits, favorites, dates, device support, and media.
- Related catalog sections come from catalog pages and their `wiki_md` blurbs.
- Codes, events, tools, articles, checklists, quizzes, media, badges, passes, servers, and other developer games are related sections that must be checked for existence.

If the visible game summary is empty or weak, the wiki workflow must update `roblox_universes.game_description_md` or record why it is intentionally left blank. Do not call a wiki complete when only `wiki_pages` fields are filled but the rendered page is still thin.

Wiki page work should not rewrite catalog-page blurbs. A wiki workflow owns game-level copy such as `meta_description`, `tips_md`, researched `controls_json`, and any needed companion `roblox_universes.game_description_md`; related catalog summaries should already come from each catalog page's `wiki_md`. If those blurbs are weak, switch to the matching catalog or game-catalog workflow for that one catalog page instead of patching them inside the wiki pass.

For wiki pages, `tips_md` must stay tight: exactly 3-4 concrete gameplay tips, no fewer and no more. Each tip should help a player make one in-game decision, avoid one mistake, or understand one core system. Do not turn gameplay tips into a long checklist.

For catalog-style pages, `description_json` is the section-level context layer when item cards are divided into meaningful sections. Keep each entry short, usually one to three useful sentences, and place the explanation near the card section it supports. Do not repeat those same notes later in `description_md`.

## 5. Run The FLOW Pass

Run `agents/content/flow-pass.md` after the first-pass `final.json` and before the final edit gate. This is mandatory for catalog and game-catalog pages, and strongly expected for articles and tools.

The FLOW pass is a rewrite pass. It should update `final.json` directly when the page has awkward headings, random sections, rushed explanation, field-first copy, or disconnected paragraphs.

For catalog and game-catalog pages, the FLOW pass must confirm:

- `description_md` explains the whole collection or mechanic, not individual card sections.
- `description_json` owns the section-level notes near the cards.
- `description_md` includes at least one useful action section when the collection has a player action behind it, such as how to get, find, unlock, farm, grow, hatch, roll, craft, equip, travel, compare, or use the items.
- headings read like useful sentence fragments, not one-word labels, random fact snippets, or generic `How <collection> work(s)` labels.
- at least one table, bullet list, or numbered process is used when it would explain faster than prose.
- the copy moves from context to action to interpretation to caveats in a clean pace.
- the page sounds like a practical Roblox player explaining the system, not a database row translated into paragraphs.

If the page is about Instinct levels, the FLOW pass should not settle for disconnected sections such as `Instinct EXP comes from dodging`, `Level 7 is the normal Instinct cap`, and `Instinct V2 comes after this ladder` unless the surrounding copy clearly tells the reader how to train Instinct, how to read the milestones, and how that normal ladder leads into V2. The pass should reshape the article, not merely polish the sentences.

Record major FLOW changes in `research-notes.md` under `Implementation notes` or `Writing angle`.

## 6. Depth Rules

Short is good only when the explanation is complete.

Game catalog pages usually need enough context for the reader to understand the game system around the item cards. When `description_json` carries section-by-section notes, keep `description_md` tighter and focused on page-level mechanics:

- what the item type does
- how players get it
- where to find or use it in the game
- how current, old, limited, event, reward, premium, or trade-only sources differ when that affects the whole collection
- what the important fields mean in gameplay terms when those fields apply across the full page
- what new players misunderstand
- what collectors, traders, builders, grinders, or casual players should care about

Use formatting when it helps:

- bullets for short groups, routes, examples, or pros and cons
- Markdown tables for compact comparisons with repeated columns
- numbered lists for linear steps, such as how to unlock, redeem, hatch, craft, use, or calculate something
- paragraphs for explanation, context, judgment, and story flow

Do not pad. But do not compress away the context.

For articles, the same rule is stricter: do not stretch a focused answer. If the title is fully answered in two sections or around 300 words, keep it there. Start how-to topics with the action, use the fewest headings that still scan well, and only use tables, lists, or a deeper outline when the topic genuinely needs them.

## 7. Final Edit Gate

Run `agents/content/final-edit.md` before writing to local Supabase or calling the work ready. The final edit gate assumes the FLOW pass has already happened for catalog, game-catalog, article, and tool pages with meaningful body copy. If that pass is missing, the final edit fails.

The most important v2 blocker:

If a normal player can ask "what does that mean?" after a sentence, the sentence fails.

For catalog and game-catalog pages, the final edit also fails if section confirmation, render-contract proof, FLOW-pass rewrite, local DB readback, or rendered-page proof is missing. For wiki pages, final edit fails if the rendered field contract, companion universe description decision, related-section check, local DB readback, or rendered-page proof is missing. A page is not done because `final.json` exists. It is done only after local Supabase contains the updated fields and the local page visibly renders the intended copy and related sections.

Bad:

```markdown
Seats explain how vehicles play.
```

Better:

```markdown
A one-seat vehicle is mostly personal travel. Multi-seat vehicles matter more when you are moving with friends, roleplaying as a family, or carrying babies and pets around the map.
```

Do not let unclear field-first writing pass because it avoids banned phrases.

## 8. Local Import And Preview

Write approved content to local Supabase first.

Then preview the actual route:

- catalog pages: `/catalog/<code>`
- wiki pages: `/wiki/<slug>`
- articles: `/articles/<slug>`
- tool pages: `/tools/<code>`
- checklist pages: `/checklists/<slug>`

Check the rendered page, not just the JSON:

- title and updated timestamp
- intro placement
- primary cards, table, data, or tool
- deeper sections
- FAQ
- mobile readability
- whether the copy feels like it teaches the topic

For wiki pages, also check:

- title, meta description, and canonical metadata
- visible game summary from `roblox_universes.game_description_md`
- verified controls rendered from `controls_json`
- exactly 3-4 practical gameplay tips
- related catalog sections and catalog-card images when catalogs exist
- codes, events, tools, articles, checklists, quizzes, media, badges, passes, servers, and developer sections that should appear or be absent based on local data

When the user asks to push wiki or game-catalog pages to production, switch to the production promotion checklist in `agents/wiki-catalog-workflow.md`. Do not call the work complete after the database write alone. Production completion requires the production universe row, existing production page audit, production dry-run, ordered wiki-then-catalog push, production DB readback, a git push/deploy of only the current game's required data/assets/config/script changes, up to 5 minutes of live-page polling for app revalidation, and live URL/content/image proof.

## 9. Scale Only After Approval

After the first page is approved as the gold standard, repeat the same process per page.

For multiple catalog pages, every page still needs its own:

- `todo.md`
- `research-notes.md`
- `final.json`
- a recorded FLOW pass inside those files, not a separate artifact
- route preview

Shared game research can support those files, but it cannot replace page-specific research.
