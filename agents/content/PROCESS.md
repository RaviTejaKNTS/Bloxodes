# Bloxodes Content Process

This is the v2 process. The old checklist-heavy workflow failed because it let research become a database summary. This process has one job: make the writer understand the game system deeply enough to explain it like a real Roblox player.

Use this process for serious rewrites, new page copy, or any content that will be saved to Supabase.

The current standard is outline-first, and for catalog work it is data-first and flow-first too. Research does not stop at facts. It must decide what the reader cares about, whether the item data is complete enough, which sections should exist, which sections should be cut, and which details are better shown as bullets, tables, numbered steps, or section-level `description_json` notes before `final.json` is written. After the first-pass JSON exists, the FLOW pass must rewrite the public fields so the page reads in an order that makes sense to a normal player.

For catalog and game-catalog pages, the workflow is also data-confirmation-first, title-confirmation-first, and section-confirmation-first. After research, audit the local dataset against current sources, check image coverage, propose any dataset updates that are needed, propose the visible title and `seo_title`, state the exact promise that title makes, propose how the item cards should be divided into sections, explain why that section style is the strongest in-game grouping, propose the clean card fields, and wait for explicit user confirmation before writing final copy or updating Supabase. Do not treat a general request like "write this page", "continue", or "go ahead" as approval unless the user has already seen the exact data, title, section, and card-data proposal.

Write workflow notes in a human editorial voice. The process should be strict, but the language should still explain the reason behind the step. A clear reason helps the model apply the workflow to a catalog page, article, tool, or wiki hub without turning every output into the same template.

## Non-Negotiable Standard

Do one page well before doing many pages.

No batch rewriting until one page has become the gold standard and the user has approved that standard. If the user asks for 15 catalog pages, pick one representative page first, finish it, preview it, and get approval before scaling.

The workflow has only two generated files:

```text
tmp/content-workspace/YYYY-MM-DD/<page-type>/<slug-or-code>/
  research-notes.md
  final.json
```

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
- article
- tool page
- checklist page

For catalog and game catalog work, do not rewrite every page in a game at once. Build one gold-standard page first. Good choices are pages with enough variety to expose the real writing standard, such as `adopt-me-food`, `adopt-me-vehicles`, `blox-fruits-accessories`, or `grow-a-garden-crops`.

## 2. Research Like A Player, Not A Database

Create `research-notes.md` before writing `final.json`.

The notes must explain the topic in simple language. A good research file should feel like a smart player explaining the system to another player before any polished copy exists.

Do not make the notes sound like a form was filled out. Use the required headings, but write under them in normal sentences. The notes should make it obvious that the writer understands the topic, not only the table schema.

Research must answer:

- What is this thing in the game?
- What does the player actually do with it?
- How does it work during normal gameplay?
- What did the reader probably come here to answer?
- What terms does a new or casual player need explained?
- What are the main item groups, reward groups, mechanics, or exceptions?
- How do players get, use, compare, trade, farm, craft, hatch, unlock, redeem, or calculate it?
- What is current, repeatable, retired, limited, event-only, premium, trade-only, or unclear?
- What real item examples prove the explanation?
- What do players misunderstand?
- What should the page teach before and after the cards, table, tool, or article body?
- What should be cut because it repeats the cards or adds trivia without helping a decision?
- What is the clean section outline?

Schema, table fields, route files, and Supabase rows still matter, but they belong after the game/topic understanding. They are implementation context, not the research itself.

## 3. Use The V2 Research Notes Shape

Use this structure unless a page type clearly needs a small adjustment:

```markdown
# Research Notes: Page Title

Date: YYYY-MM-DD
Page Type: catalog | game-catalog | wiki | code-page | article | tool
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

## Real examples from the data

Use actual item names, groups, values, or rows from the local dataset or source material. Explain why each example matters.

## Data and image audit

For catalog and game-catalog pages, write this before the section proposal. This is a hard gate, not housekeeping.

Include:

- local dataset file and item count
- source counts found during research, with dates or source names
- rendered card count if the route exists
- page title count if the page already exists
- missing items, extra items, renamed items, duplicate items, or stale fields
- image coverage: cards with images, cards without images, images that exist locally but are not wired, and images that still need sourcing
- data action: `ready as-is`, `needs dataset update`, `needs image update`, or `blocked`

If research finds more items than the local dataset, or finds that images are missing even though images are expected for the collection, stop here and make the data issue visible. Do not write public copy on top of stale data.

## Common mistakes or confusion

Write what a player might misunderstand and how the page should prevent that confusion.

## Reader questions and page outline

Write the actual section plan before drafting.

Include:

- primary reader goal
- must-answer questions
- final section order
- parts to cut
- where bullets, tables, or numbered steps should be used
- how the page flows from context to action to caveats
- for catalog and game-catalog pages, the proposed data update plan if needed, recommended visible title and `seo_title`, exact title promise, content coverage needed to satisfy that title, item-card section style, the reason that grouping matches the game, alternatives considered, card fields to show or hide, and the `description_json` keys/notes that should appear between sections

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

For catalog and game-catalog work, do not move from research to final copy until the data state, title promise, proposed section style, and card data shape are confirmed. The proposal should name the dataset status, source-count agreement or disagreement, missing image count, recommended title, title promise, grouping axis, fields that belong on the cards, and raw fields that should not render. Choose the title, grouping, and card fields that have the clearest in-game meaning, not merely the fields that are easiest to sort.

The research notes must keep `Status: needs data update` when the item list or image coverage is not ready. They must keep `Status: needs section confirmation` until the title, section, and card plan is approved. When approval happens, record it plainly, for example: `Title, data, and section plan confirmed by user on YYYY-MM-DD: title promises how to get materials, update missing materials, group by source route, and show source, drop chance, Magic Power, and farming stage.` Do not write vague lines such as `user requested final copy` as a substitute for confirmation.

## 3.5. Build Or Update The Data Before Writing

For existing games, the data step is an audit first. For new games, the data step is a real build step.

After research and approval, update the local dataset before writing public copy when the audit says it is needed. That can mean adding missing items, cleaning names and slugs, adding useful card fields, removing raw HTML, normalizing yes/no values into labeled fields, wiring local images, or creating a collector script when this game will need repeatable refreshes.

Only continue to `final.json` after the local dataset is in the shape the page will use. The page title count, local dataset count, rendered card count, and expected source count should either match or have a written reason for the difference. If the title promises obtainment, locations, drops, chances, brewing, crafting, effects, bonuses, value, or comparison, the outline must show which fields and sections will answer that promise.

## 4. Write First-Pass `final.json`

Only write `final.json` after `research-notes.md` is marked `ready to write`. For catalog and game-catalog pages, that means the user has already confirmed the data state, title promise, proposed section style, and the card data shape, and any required dataset or image updates have been completed locally.

Before importing the final JSON, prove the render contract:

- list the local dataset count, rendered card count, and title count
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
  "controls_json": []
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

Checklist pages use `section_code` depth as the render contract. Parent rows such as `1` create major board sections, child rows such as `1.1` create labels inside a section, and leaf rows such as `1.1.1` become checkable tasks. Use the game slug only for the public route, such as `/checklists/wizard-alchemy`. New checklist rows should include `seo_description` and `description_md`, and task titles must not include Markdown bullets.

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

Code pages are backed by `games` plus the `codes` table, but the content workflow only writes the `games` row. The slug is the game slug only, such as `wizard-alchemy`, because the public route is already `/codes/<slug>`. `roblox_link` must hold the Roblox experience URL. `source_url` must hold the RobloxDen codes page URL, and `source_url_2` must hold the Beebom codes page URL so `scripts/codes/update-codes.ts` can collect live codes. Keep `seo_title` empty or null unless the user explicitly asks otherwise.

Never write active codes, expired codes, code names, `first_seen_at`, or other code rows manually in `final.json`, local JSON, SQL, or Supabase. After the game row is inserted or updated with the correct source URLs, run the codes refresh workflow, usually `npm run refresh:codes -- --slug <game-slug>`, and let that script upsert active and expired codes from the configured sources.

Code page prose and metadata must be evergreen. Do not include active code names, current reward tables tied to specific codes, month/year labels, exact dates, active-code counts, "latest", "current", "updated daily", or any other wording that will age between code refresh runs. The live codes UI owns active codes, dates, counts, and status. The article fields should explain reward types, redemption steps, troubleshooting, and official places to watch in a long-term way.

Only include fields the page type owns. Leave unknown optional fields out instead of inventing values.

Wiki page work should not rewrite catalog-page blurbs. A wiki workflow owns game-level copy such as `meta_description`, `tips_md`, and verified `controls_json`; related catalog summaries should already come from each catalog page's `wiki_md`. If those blurbs are weak, switch to the matching catalog or game-catalog workflow for that one catalog page instead of patching them inside the wiki pass.

For catalog-style pages, `description_json` is the section-level context layer when item cards are divided into meaningful sections. Keep each entry short, usually one to three useful sentences, and place the explanation near the card section it supports. Do not repeat those same notes later in `description_md`.

## 5. Run The FLOW Pass

Run `agents/content/flow-pass.md` after the first-pass `final.json` and before the final edit gate. This is mandatory for catalog and game-catalog pages, and strongly expected for articles and tools.

The FLOW pass is a rewrite pass. It should update `final.json` directly when the page has awkward headings, random sections, rushed explanation, field-first copy, or disconnected paragraphs.

For catalog and game-catalog pages, the FLOW pass must confirm:

- `description_md` explains the whole collection or mechanic, not individual card sections.
- `description_json` owns the section-level notes near the cards.
- `description_md` includes at least one useful action section when the collection has a player action behind it, such as how to get, find, unlock, farm, grow, hatch, roll, craft, equip, travel, compare, or use the items.
- headings read like useful sentence fragments, not one-word labels or random fact snippets.
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

## 7. Final Edit Gate

Run `agents/content/final-edit.md` before writing to local Supabase or calling the work ready. The final edit gate assumes the FLOW pass has already happened. If a catalog or game-catalog page has not gone through FLOW, the final edit fails.

The most important v2 blocker:

If a normal player can ask "what does that mean?" after a sentence, the sentence fails.

For catalog and game-catalog pages, the final edit also fails if section confirmation, render-contract proof, FLOW-pass rewrite, local DB readback, or rendered-page proof is missing. A page is not done because `final.json` exists. It is done only after local Supabase contains the updated fields and the local page visibly renders the intended intro, section notes, and page-level Markdown.

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

## 9. Scale Only After Approval

After the first page is approved as the gold standard, repeat the same process per page.

For multiple catalog pages, every page still needs its own:

- `research-notes.md`
- `final.json`
- a recorded FLOW pass inside those files, not a separate artifact
- route preview

Shared game research can support those files, but it cannot replace page-specific research.
