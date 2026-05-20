# Bloxodes Content Process

This is the v2 process. The old checklist-heavy workflow failed because it let research become a database summary. This process has one job: make the writer understand the game system deeply enough to explain it like a real Roblox player.

Use this process for serious rewrites, new page copy, or any content that will be saved to Supabase.

The current standard is outline-first. Research does not stop at facts. It must decide what the reader cares about, which sections should exist, which sections should be cut, and which details are better shown as bullets, tables, numbered steps, or section-level `description_json` notes before `final.json` is written.

For catalog and game-catalog pages, the workflow is also section-confirmation-first. After research, propose how the item cards should be divided into sections, explain why that section style is the strongest in-game grouping, propose the clean card fields, and wait for explicit user confirmation before writing final copy or updating Supabase. Do not treat a general request like "write this page", "continue", or "go ahead" as section approval unless the user has already seen the exact section and card-data proposal.

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
4. `agents/content/final-edit.md`

If this reading has not happened in the current task, do not write content.

## 1. Pick One Page

Choose one target page and identify the page type:

- catalog page
- game-specific catalog page
- wiki page
- article
- tool page

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
Page Type: catalog | game-catalog | wiki | article | tool
Target: /path-or-code
Status: researching | needs section confirmation | ready to write | needs review

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
- for catalog and game-catalog pages, the proposed item-card section style, the reason that grouping matches the game, alternatives considered, and the `description_json` keys/notes that should appear between sections

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

For catalog and game-catalog work, do not move from research to final copy until the proposed section style and card data shape are confirmed. The proposal should name the grouping axis, such as rarity, item type, source, location, event, tier, shop, world, or unlock path. It should also name the fields that belong on the cards and the raw fields that should not render. Choose the grouping and card fields that have the clearest in-game meaning, not merely the fields that are easiest to sort.

The research notes must keep `Status: needs section confirmation` until that approval exists. When approval happens, record it plainly, for example: `Section style confirmed by user on YYYY-MM-DD: group by category into Walls and Floors.` Do not write vague lines such as `user requested final copy` as a substitute for confirmation.

## 4. Write `final.json`

Only write `final.json` after `research-notes.md` is marked `ready to write`. For catalog and game-catalog pages, that means the user has already confirmed the proposed section style.

Before importing the final JSON, prove the render contract:

- list the actual section labels the route will render
- list the planned `description_json` keys
- confirm every planned section note matches a rendered section label
- list the actual card fields the route will render
- confirm cards do not show raw long descriptions, raw pros/cons, nested objects, HTML, or unexplained yes/no values
- if the route picks a bad grouping field, such as blank `rarity` values instead of real `category` values, fix the route or add the correct grouping behavior before importing

The final JSON must fit the destination table shape. Write the public fields as final copy from the start. Do not write placeholder copy and expect another pass to make it human.

Follow the outline from research notes. Do not dump every researched fact into the public fields. The final page should keep the useful structure and cut the rest.

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

Only include fields the page type owns. Leave unknown optional fields out instead of inventing values.

Wiki page work should not rewrite catalog-page blurbs. A wiki workflow owns game-level copy such as `meta_description`, `tips_md`, and verified `controls_json`; related catalog summaries should already come from each catalog page's `wiki_md`. If those blurbs are weak, switch to the matching catalog or game-catalog workflow for that one catalog page instead of patching them inside the wiki pass.

For catalog-style pages, `description_json` is the section-level context layer when item cards are divided into meaningful sections. Keep each entry short, usually one to three useful sentences, and place the explanation near the card section it supports. Do not repeat those same notes later in `description_md`.

## 5. Depth Rules

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

## 6. Final Edit Gate

Run `agents/content/final-edit.md` before writing to local Supabase or calling the work ready.

The most important v2 blocker:

If a normal player can ask "what does that mean?" after a sentence, the sentence fails.

For catalog and game-catalog pages, the final edit also fails if section confirmation, render-contract proof, local DB readback, or rendered-page proof is missing. A page is not done because `final.json` exists. It is done only after local Supabase contains the updated fields and the local page visibly renders the intended intro, section notes, and page-level Markdown.

Bad:

```markdown
Seats explain how vehicles play.
```

Better:

```markdown
A one-seat vehicle is mostly personal travel. Multi-seat vehicles matter more when you are moving with friends, roleplaying as a family, or carrying babies and pets around the map.
```

Do not let unclear field-first writing pass because it avoids banned phrases.

## 7. Local Import And Preview

Write approved content to local Supabase first.

Then preview the actual route:

- catalog pages: `/catalog/<code>`
- wiki pages: `/wiki/<slug>`
- articles: `/articles/<slug>`
- tool pages: `/tools/<code>`

Check the rendered page, not just the JSON:

- title and updated timestamp
- intro placement
- primary cards, table, data, or tool
- deeper sections
- FAQ
- mobile readability
- whether the copy feels like it teaches the topic

## 8. Scale Only After Approval

After the first page is approved as the gold standard, repeat the same process per page.

For multiple catalog pages, every page still needs its own:

- `research-notes.md`
- `final.json`
- route preview

Shared game research can support those files, but it cannot replace page-specific research.
