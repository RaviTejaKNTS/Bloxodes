# Bloxodes Research Policy

Research is the strongest part of the Bloxodes content workflow. If the research notes read like a schema summary, the final writing will become field-first and weak. Research must prove that the writer understands the game system, page topic, or tool use case before public copy is written.

Use this before writing any Bloxodes page that depends on game data, codes, events, prices, item stats, formulas, Roblox universe metadata, or player-facing explanation.

The notes should sound like a real explanation, not a checklist with nicer words. Keep the required structure, but write in clear sentences that show the connection between facts. A good note explains why a detail matters to the page, not only that the detail exists.

For catalog and game-catalog pages, research must pass a player-usefulness gate before it can become final copy. The agent must identify the real player task, list the facts required to solve it, check whether those facts are source-backed and present in local data, and block writing when useful source-backed facts are missing. Safe-but-thin prose is not a substitute for data work.

## Source Priority

Prefer sources in this order:

1. Local structured datasets in `data/` and `apps/web/src/data/`.
2. Supabase rows and views for the target page.
3. Roblox experience pages and official Roblox APIs for universe identity, Roblox metadata, thumbnails, and cross-checks.
4. Official developer pages, groups, Discord announcements, X/Twitter, YouTube, Trello, changelogs, or docs.
5. Established game wikis or community databases when official data is incomplete.
6. Other code sites or fan pages only as cross-checks, never as sole authority for important facts.

For unstable facts, browse or query current data. Do not rely on memory.

For game catalog datasets, the required path is online research and source gathering. Build item rows from official/developer sources, current community wikis or databases, guides, videos, screenshots, update notes, and other player-facing sources. Do not drift into treating Roblox APIs as the item source of truth; APIs are helpers for identity and metadata only. Never block a catalog page because an API does not expose the in-game item list.

## One-Page Gold Standard

For catalog, game catalog, wiki, article, and tool writing, do one page first.

Do not batch-write a whole game or category until one page is researched, written, previewed, and approved as the gold standard. Batch generation is allowed only after the first page proves the research and writing standard.

Every serious page workflow gets:

- `todo.md`
- `research-notes.md`
- `final.json`

No separate `brief.md`, `review.md`, fan-out plan files, SEO draft files, article body draft files, or generic batch research file.

Use the game-first workspace shape:

```text
tmp/content-workspace/<game-or-topic-slug>/<page-folder>/
  todo.md
  research-notes.md
  final.json
```

For game discovery, use `tmp/content-workspace/<game-slug>/discovery/` and omit `final.json` unless a later workflow explicitly needs it. Copy the matching tracker from `agents/content/todo-templates/` into the folder as `todo.md` before research starts.

For full game coverage, discovery should produce a compact page map, not a data-readiness report. Resolve the game, audit existing coverage, decide whether a codes page should exist, list every catalog page needed for durable in-game item collections, list article topics that complete coverage without repeating other page types, identify any real tool opportunities, and mark wiki/checklist/quiz as create or already covered. If a needed page requires item data, images, or route work, recommend the page and record that work as the next action instead of marking the idea blocked. Event pages are handled by the events workflow, not by game-page discovery.

## Research Notes Must Be Human Notes

`research-notes.md` is not a place to prove that routes, tables, and fields were inspected. It is first a place to understand the topic.

Write it as if another editor will use it to write the page tomorrow. That editor should be able to understand the mechanic, the player goal, the useful groups, the examples, the risks, and the page shape without opening the database first.

The top of the notes must be readable by a human editor who has never seen the database. It should explain:

- what this thing is in the game
- how players use it
- how players get it
- why it matters or does not matter
- what readers came to solve on this page
- what in-game action or decision the final page should make easier
- what facts are required for that action or decision
- what structure will answer those questions in the cleanest order
- what information should be cut because it does not help the page
- what words and fields need explanation
- what examples prove the point
- what new players misunderstand
- what the final page should teach

Database and route details belong in `Implementation notes`, after the game/topic explanation.

## Required Research Notes Format

Use this structure:

```markdown
# Research Notes: Page Title

Date: YYYY-MM-DD
Page Type: discovery | catalog | game-catalog | wiki | code-page | events | article | tool | checklist | quiz
Target: /path-or-code
Status: researching | needs data update | needs section confirmation | ready to write | needs review

## What this is

Explain the topic in plain English. No website talk. No database talk.

## How it works in the game

Explain the real gameplay loop, item behavior, mechanic, formula, or user action.

## Terms a player needs explained

Define important terms in human language. Do not assume the field label explains itself.

## Main groups or systems

Break the topic into useful groups that players actually understand.

## What players care about

Explain usefulness, collection value, trade value, progression value, reward value, replacement difficulty, event timing, or other real decisions.

## Player usefulness gate

For catalog and game-catalog pages, define the real reader job. Name what the player is trying to do, choose, unlock, buy, upgrade, farm, compare, equip, trade, reach, or avoid. Then state what the finished page should let that reader do in-game.

If the answer is vague, the topic or dataset is not ready.

## Required fact matrix

For catalog and game-catalog pages, connect player needs to source-backed facts and local data. Adjust rows to the collection:

| Reader need | Required facts | Source found? | In dataset/cards? | Public location |
| --- | --- | --- | --- | --- |
| Buy or unlock item | price, currency, shop, requirement, route | yes/no | yes/no | cards + how-to |
| Compare item | stat, role, rarity, source, limit, best use | yes/no | yes/no | cards/table |
| Use, upgrade, or farm item | NPC/station, cost, levels, process, reset rule | yes/no | yes/no | `description_md` |

If a required fact is source-backed but missing from local data or the planned card fields, mark the work `needs data update`. Do not continue by writing around that missing fact.

## Competitor usefulness check

When SEO or traffic potential is part of the decision, inspect top useful competitor/source pages and record the player questions they answer, useful facts they expose, sections that help, and weaknesses Bloxodes can improve. This is a coverage check only. Do not copy prose, tables, or structure blindly.

## Real examples from the data

Use actual item names, values, sections, or source rows. Explain why each example matters.

## Data and image audit

For catalog and game-catalog pages, this section is required. It decides whether the model can write now or must update data first.

Include:

- local dataset file and local item count
- current source counts found during research
- existing page title count, if a page already exists
- rendered card count, if the route already exists
- missing items, extra local items, renamed items, duplicate rows, stale fields, unclear rows, missing required facts, or weak card fields
- image coverage: cards with images, cards without images, local image files that are not wired, and images that need to be gathered
- data action: `ready as-is`, `needs dataset update`, `needs image update`, or `blocked`

If current sources show more items than the local dataset, if important images are missing, or if source-backed player-useful facts are missing from local data, do not hide that under a writing task. Record the issue here and keep the status at `needs data update` until the user approves how to fix it or explicitly accepts the current dataset.

## Common mistakes or confusion

List what readers may misunderstand and how the final copy should prevent it.

## Reader questions and page outline

List the real questions the page must answer, then build the section order before writing public copy.

Include:

- the primary reader goal
- sections that must exist because readers care about them
- how the required fact matrix will be satisfied by cards, tables, `description_md`, `how_it_works_md`, FAQ, or route changes
- sections to skip or cut because they would pad the page
- where a table, bullet list, or numbered list would explain faster than paragraphs
- the story flow from opening context to final takeaway
- the action, how-to, obtainment, use, or comparison section the page needs when the topic has player action behind it
- for catalog and game-catalog pages, the proposed data update plan if needed, recommended visible title and `seo_title`, exact title promise, required content coverage for that promise, item-card section style, the in-game reason for that grouping, alternatives rejected, card fields to show or hide, and the `description_json` notes that should appear between those sections
- for catalog and game-catalog pages, what `description_md` should explain as a whole-page story so it does not repeat the same notes as `description_json`

Do not mark research ready if this section is only a list of database fields. The outline should feel like an article editor decided the shape of the page before the writer started drafting.

For catalog and game-catalog pages, research pauses at `needs data update` when the dataset or images are stale. It pauses at `needs section confirmation` until the user approves the title promise, section style, and card data shape. Do not write final copy or update Supabase before those confirmations. The approval must refer to the proposed data action, title, or grouping, not merely to the page request. If the user says "write this catalog page" before seeing the data, title, and section plan, that is permission to research and propose, not permission to write final copy.

## Missing or uncertain facts

Record gaps honestly. Do not invent filler.

## Implementation notes

- Target table:
- Fields to write:
- Dataset or source files checked:
- Route or component behavior that affects rendering:
- Existing Supabase row checked:
- Actual rendered or computed card sections:
- `description_json` keys match rendered sections:

## Writing angle

Explain the story the page should tell, how deep it should go, and what it should skip.
```

Do not mark notes `ready to write` until the player-facing sections and the outline have real substance.

## Topic Research By Page Type

### Catalog Pages

Research the collection and its item groups. For small catalogs, inspect every item when practical. For large catalogs, inspect representative items from each type, source, rarity, price range, availability state, or reward group.

The notes should explain the collection itself before they explain fields.

For game-specific catalogs, reject weak scopes before data work starts. Catalogs should cover durable in-game item collections, not current season pass reward tracks, one-off event reward lists, current ranked season rewards, broad update summaries, gamepasses, badges, servers, developer products, or raw Roblox media. Event/season-origin items belong inside the durable collection they are part of, with source and availability recorded there. UGC is a special exception only when the game has meaningful UGC items and should follow the free Roblox items card pattern.

Run the data and image audit before proposing final copy. Compare local item count with current source counts, page title count, and rendered card count. If a source shows more items than local data, list the missing names and mark the work `needs data update` instead of writing around the gap. If images matter for the collection, count missing images and say whether they can be found locally, need to be gathered, or should be intentionally left blank.

For game-specific catalogs, source counts and missing item names must come from online research, not from Roblox API availability. Roblox APIs may confirm the game/universe or provide Roblox metadata, but they do not decide whether the catalog data can be gathered.

Run the player-usefulness gate before the section proposal. A catalog page should not only list items; it should help the player buy, unlock, compare, upgrade, farm, equip, trade, find, or understand the collection. If important facts such as prices, shop/NPC names, damage values, chances, upgrade steps, locations, route order, requirements, or availability exist in reliable sources but are absent locally, update the dataset or mark the page blocked before writing.

After research, propose the title promise and section style before writing. The title should be unique, well-defined, and tied to the collection's real intent, such as obtainment, locations, drops, chances, brewing, crafting, effects, bonuses, value, or comparison. Choose the strongest in-game grouping, such as rarity, item type, source, location, tier, shop, unlock route, or world. The best grouping is the one that helps players understand the collection long-term, not necessarily the dataset's first category field.

When the route can render copy between item sections, plan `description_json` as short section context. These notes should set up the cards in that section with useful game meaning and should not be repeated in `description_md`.

Plan the `description_md` separately. It should explain the full collection or mechanic, including how players get, use, compare, unlock, travel to, farm, hatch, roll, craft, equip, or avoid mistakes around the items when that action exists. A catalog page can have cards first and still need a clear how-to section later, because the cards show data while `description_md` teaches how the system actually works. If the approved title promises an answer, `description_md`, `how_it_works_md`, FAQs, and card fields must together satisfy that promise.

The route must be checked as part of research. Record the actual section labels the renderer will produce from the current dataset. A column existing in the JSON is not enough. If a blank `rarity` field exists and the route would group every item under `Other`, the research must call that out and block final writing until the grouping behavior is fixed or a confirmed override is planned.

### Game-Specific Catalog Pages

Research the game system behind the collection.

For existing games, audit the current local dataset first. For new games, research must also gather or build the first local dataset. The final page is not ready until the item list, useful card fields, and image coverage are good enough for the page being created.

A good game catalog research file should answer:

- What does this item type do during play?
- How does a player normally get it?
- What makes one item different from another?
- Which values change a decision?
- What required facts does a player need before acting on this page?
- Are those facts present in the local dataset and rendered card fields?
- What useful competitor/source facts are missing from Bloxodes?
- What does a confusing field mean in actual gameplay?
- Which items are current, old, limited, premium, event-only, or trade-only?
- What would a new player misunderstand?
- Which section order would make the collection easy to understand?
- Which parts deserve tables, bullets, or numbered steps?
- Which item-card section style should be proposed to the user before final writing?
- Which `description_json` notes belong between those sections?
- What whole-page `description_md` story belongs after the cards?
- What action/how-to/use section should make the page practically useful?
- Are local data, source counts, rendered card counts, title counts, and images aligned enough to publish?

Examples:

- `seats` in a vehicles page means how many players, babies, pets, or roleplay passengers can ride, not a vague "how it plays."
- `source` in a pets page means whether the pet came from an egg, event, Robux purchase, reward track, gift, or trade-only old release.
- `uses` in a food page means whether one item is consumed once, lasts for multiple needs, or acts like a special effect item.

### Wiki Pages

Research the game as a whole:

- core loop
- creator/developer
- genre and age rating
- current update direction
- code/event availability when related sections exist, without copying live rows into wiki copy
- major systems
- related catalog collections
- tools, checklists, quizzes, articles, and social/developer context

Wiki research must include a rendered field map before writing. Record which visible areas come from `wiki_pages`, which come from the linked `roblox_universes` row, and which come from related page tables. The visible game summary usually comes from `roblox_universes.game_description_md`; if that field is empty or weak, mark a companion universe-description update as part of the wiki workflow.

The notes must answer the minimum useful wiki questions:

- What is this game?
- What does the player do in a normal session?
- Which systems drive progress, rewards, combat, collection, trading, or role choice?
- What should a new or returning player check first?
- Which controls are verified, how they were verified, and how they should be written into `controls_json`?
- Which related sections exist locally, and which likely sections are missing?
- What should the wiki skip because related cards already carry the live detail?

The wiki hub should orient the player, not become a full article. Related sections can carry live detail, but the hub copy still needs practical context.

Do not use wiki research as a shortcut to rewrite every related catalog blurb. Catalog section summaries come from each catalog page's `wiki_md`, and each one needs its own collection research when it changes.

### Articles

Research the exact narrow evergreen player question before approving an article. The article should not overlap a codes page, events page, wiki hub, catalog, checklist, quiz, or tool. Avoid generic beginner guides, codes troubleshooting, event topics, current update news, and broad item/category explainers that belong in catalog or wiki copy.

Good article research starts with a specific durable job: how to get a specific item, complete a specific quest/objective, use a specific mode or map, unlock a stable mechanic, farm a stable resource, solve a durable gameplay problem, or compare a narrow set of choices that cards/tables do not already answer.

The article should move like a clear explanation: what the player is trying to do, what requirement or mechanic matters, the steps or decision path, limitations, and what to check next.

### Events Pages

Research event pages as event hubs backed by `events_pages` and sourced timeline rows in `roblox_virtual_events`. First decide whether the page should exist. A game updating often is not enough; event coverage needs named events, phases, dates, rewards, mechanics, or Roblox virtual event feed evidence.

Record source confidence for dates, rewards, and status labels. If the event evidence is weak, mark the page `do not create` or `blocked` instead of writing a generic event page.

Never inject event timeline data manually. Current/upcoming/past rows, live status labels, dates, reward timelines, and one-off current event claims belong in `roblox_virtual_events` or another approved importer, not in `events_pages.content_md`, JSON, SQL, or prose. Event page copy should stay evergreen and orient the player to the automated timeline.

### Code Pages

Research code pages as source-driven `games` rows, not as hand-maintained code lists. The public path is `/codes/<game-slug>`, so the stored `games.slug` must be the game slug only, such as `wizard-alchemy`, never `wizard-alchemy-codes`.

Before writing or updating a code page, confirm the source wiring:

- `roblox_link` is the official Roblox experience URL.
- `source_url` is the RobloxDen codes page URL.
- `source_url_2` is the Beebom codes page URL.
- `seo_title` is empty or null unless the user explicitly asks for a custom value.
- `scripts/codes/update-codes.ts` can read the row because the game is published and the supported source URLs are in the first two source fields.

Never manually write code rows, active codes, expired codes, code names, active-code counts, `first_seen_at` dates, reward rows, or source-copied code tables into local JSON, SQL, Supabase, or `final.json`. The code data must come from the codes refresh workflow. After the `games` row has the right source URLs, run `npm run refresh:codes -- --slug <game-slug>` and let the script scrape RobloxDen and Beebom, upsert active codes, expire missing codes, and update `expired_codes`.

The article fields on a code page must work long-term. `seo_description`, `intro_md`, `rewards_md`, `troubleshoot_md`, and `find_codes_md` should not name active codes, include exact dates, mention a month/year, promise daily updates, quote active-code counts, or use stale wording such as `latest` or `current`. A rewards table is fine when it explains reward types and how they affect the game, but it must not map current code names to rewards.

### Tool Pages

Research the formula, input, output, unit, edge case, and user misunderstanding. Inspect the tool client logic when available.

Use a hard gate before recommending or writing a tool. Check gameplay, search intent, and competing calculators/planners/trackers. A tool needs a real input/output job, reliable formula or data support, and a result that helps players make a decision. If it only duplicates a catalog, article, checklist, or wiki section, mark it `do not create` or `potential future`.

The copy should explain what the result means, not simply say the tool calculates something.

### Checklist Pages

Research checklists as playable progress boards. Inspect existing `/checklists` pages and the `checklist_pages_view` / `checklist_items` rows before writing a new one. The goal is to decide what a player should actually tick off while playing, not to translate every guide fact into a checkbox.

Use one combined checklist per game unless the user explicitly asks for more. The slug should be the game slug only, such as `wizard-alchemy`. Record the planned parent sections, subsection rows, expected leaf task count, and which local datasets or source rows support item-level tasks.

The research should identify:

- first-session setup tasks
- progression systems
- item collections that deserve item-level tracking
- routes, locations, NPCs, shops, enemies, bosses, and maintenance tasks
- final audit tasks
- which facts should be grouped instead of repeated for every item

Keep the style close to The Forge, Jailbreak, or 99 Nights in the Forest: compact, direct, and playable. Avoid oversized Blox Fruits-style dumps unless the user wants a very large completion board.

### Quiz Pages

Research quizzes as replayable tests of real game knowledge. Record the game systems, route facts, item details, formulas, thresholds, and common mistakes that can support easy, medium, and hard questions.

Do not write a quiz from vague game familiarity. Easy questions should be friendly, medium questions should require actual play knowledge, and hard questions should be pro-level but source-supported.

## Current Facts That Need Fresh Checks

Always verify when possible:

- active and expired codes
- code rewards
- event start and end times
- game stats such as playing, visits, favorites, likes, or dislikes
- Roblox game created and updated dates
- item availability, limited status, prices, sources, rarities, drop chances, and requirements
- tool formulas and calculators
- official social links
- developer or group names
- platform support and age ratings

## Local Dataset Review

For catalog and game catalog work:

1. Find the dataset used by the route.
2. Read real item examples, not only field names.
3. Identify the item groups a player would recognize.
4. Identify fields that need definition because the label is unclear.
5. Check whether images exist when images matter.
6. Compare local item count, rendered card count, title count, and current source counts.
7. Record missing items, stale rows, duplicate rows, renamed items, missing images, and uncertain facts instead of hiding them.
8. If the data needs work, stop writing and propose the dataset/image update plan.

## Supabase And Route Review

After topic research, check the target table shape and route behavior.

Core content tables:

- `catalog_pages`
- `wiki_pages`
- `articles`
- `tools`
- `checklist_pages`
- `checklist_items`
- `games`
- `codes`
- `roblox_universes`
- `roblox_virtual_events`

Catalog content fields:

- `title`
- `seo_title`
- `meta_description`
- `intro_md`
- `description_md`
- `description_json`
- `how_it_works_md`
- `faq_json`
- `wiki_md`
- `wiki_sort_order`

Wiki content fields:

- `title`
- `seo_title`
- `meta_description`
- `tips_md`
- `controls_json`
- `cover_image`
- `universe_id`

Article content fields:

- `title`
- `slug`
- `meta_description`
- `content_md`
- `tags`
- `sources`
- `universe_id`

The current `articles` table does not have `seo_title`; do not include it in article import JSON unless the schema changes.

Tool content fields:

- `code`
- `title`
- `seo_title`
- `meta_description`
- `intro_md`
- `how_it_works_md`
- `description_json`
- `faq_json`
- `cta_label`
- `cta_url`
- `thumb_url`
- `universe_id`

Code page `games` fields:

- `name`
- `slug`
- `is_published`
- `roblox_link`
- `source_url`
- `source_url_2`
- `seo_title`
- `seo_description`
- `intro_md`
- `redeem_md`
- `rewards_md`
- `troubleshoot_md`
- `find_codes_md`

Do not include a `codes` array in code-page content output. The `codes` table is populated only by the codes refresh script from supported source URLs.

## Public Copy Rules

- Keep research and sources internal unless the field is meant for sources.
- Do not mention `research notes`, scraping, source gathering, prompts, AI, database, dataset, or internal checks in public copy.
- Do not write self-referential website copy such as `Use the X catalog`, `check the catalog`, `this page`, `this catalog`, `dataset`, or `Bloxodes` in public content fields.
- Do not invent facts to fill fields.
- If a fact is missing, either omit it or mention the gap only when it helps the reader.

## Research Readiness Test

Before writing, answer these in your own words:

1. Can I explain the topic without using database field names?
2. Can I define every important term a reader may not know?
3. Can I name real examples from the item data or source material?
4. Can I explain what a player should do differently after reading?
5. Can I explain what should not be claimed because facts are missing?
6. For catalog work, can I prove the local item count, rendered card count, title count, source count, and image coverage are either aligned or intentionally accepted?

If the answer is no, research is not ready.
