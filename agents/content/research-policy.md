# Bloxodes Research Policy

Research is the strongest part of the Bloxodes content workflow. If the research notes read like a schema summary, the final writing will become field-first and weak. Research must prove that the writer understands the game system, page topic, or tool use case before public copy is written.

Use this before writing any Bloxodes page that depends on game data, codes, events, prices, item stats, formulas, Roblox universe metadata, or player-facing explanation.

The notes should sound like a real explanation, not a checklist with nicer words. Keep the required structure, but write in clear sentences that show the connection between facts. A good note explains why a detail matters to the page, not only that the detail exists.

## Source Priority

Prefer sources in this order:

1. Local structured datasets in `data/` and `apps/web/src/data/`.
2. Supabase rows and views for the target page.
3. Official Roblox APIs and Roblox experience pages.
4. Official developer pages, groups, Discord announcements, X/Twitter, YouTube, Trello, changelogs, or docs.
5. Established game wikis or community databases when official data is incomplete.
6. Other code sites or fan pages only as cross-checks, never as sole authority for important facts.

For unstable facts, browse or query current data. Do not rely on memory.

## One-Page Gold Standard

For catalog, game catalog, wiki, article, and tool writing, do one page first.

Do not batch-write a whole game or category until one page is researched, written, previewed, and approved as the gold standard. Batch generation is allowed only after the first page proves the research and writing standard.

Every page gets exactly:

- `research-notes.md`
- `final.json`

No separate `brief.md`, `review.md`, fan-out plan files, SEO draft files, article body draft files, or generic batch research file.

## Research Notes Must Be Human Notes

`research-notes.md` is not a place to prove that routes, tables, and fields were inspected. It is first a place to understand the topic.

Write it as if another editor will use it to write the page tomorrow. That editor should be able to understand the mechanic, the player goal, the useful groups, the examples, the risks, and the page shape without opening the database first.

The top of the notes must be readable by a human editor who has never seen the database. It should explain:

- what this thing is in the game
- how players use it
- how players get it
- why it matters or does not matter
- what readers came to solve on this page
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
Page Type: catalog | game-catalog | wiki | article | tool
Target: /path-or-code
Status: researching | needs section confirmation | ready to write | needs review

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

## Real examples from the data

Use actual item names, values, sections, or source rows. Explain why each example matters.

## Common mistakes or confusion

List what readers may misunderstand and how the final copy should prevent it.

## Reader questions and page outline

List the real questions the page must answer, then build the section order before writing public copy.

Include:

- the primary reader goal
- sections that must exist because readers care about them
- sections to skip or cut because they would pad the page
- where a table, bullet list, or numbered list would explain faster than paragraphs
- the story flow from opening context to final takeaway
- for catalog and game-catalog pages, the proposed item-card section style, the in-game reason for that grouping, alternatives rejected, and the `description_json` notes that should appear between those sections

Do not mark research ready if this section is only a list of database fields. The outline should feel like an article editor decided the shape of the page before the writer started drafting.

For catalog and game-catalog pages, research pauses at `needs section confirmation` until the user approves the section style. Do not write final copy or update Supabase before that confirmation. The approval must refer to the proposed grouping, not merely to the page request. If the user says "write this catalog page" before seeing the section plan, that is permission to research and propose, not permission to write final copy.

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

After research, propose the section style before writing. Choose the strongest in-game grouping, such as rarity, item type, source, event, location, tier, shop, unlock route, or world. The best grouping is the one that helps players understand the collection long-term, not necessarily the dataset's first category field.

When the route can render copy between item sections, plan `description_json` as short section context. These notes should set up the cards in that section with useful game meaning and should not be repeated in `description_md`.

The route must be checked as part of research. Record the actual section labels the renderer will produce from the current dataset. A column existing in the JSON is not enough. If a blank `rarity` field exists and the route would group every item under `Other`, the research must call that out and block final writing until the grouping behavior is fixed or a confirmed override is planned.

### Game-Specific Catalog Pages

Research the game system behind the collection.

A good game catalog research file should answer:

- What does this item type do during play?
- How does a player normally get it?
- What makes one item different from another?
- Which values change a decision?
- What does a confusing field mean in actual gameplay?
- Which items are current, old, limited, premium, event-only, or trade-only?
- What would a new player misunderstand?
- Which section order would make the collection easy to understand?
- Which parts deserve tables, bullets, or numbered steps?
- Which item-card section style should be proposed to the user before final writing?
- Which `description_json` notes belong between those sections?

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
- active codes and events when relevant
- major systems
- related catalog collections
- tools, checklists, quizzes, articles, and social/developer context

The wiki hub should orient the player, not become a full article. Related sections can carry live detail, but the hub copy still needs practical context.

Do not use wiki research as a shortcut to rewrite every related catalog blurb. Catalog section summaries come from each catalog page's `wiki_md`, and each one needs its own collection research when it changes.

### Articles

Research the exact niche question, update, event, mechanic, comparison, or guide angle. The article should move like a clear explanation, similar to a good editorial guide: what changed, why it matters, how it works, limitations, and what the reader should do next.

### Tool Pages

Research the formula, input, output, unit, edge case, and user misunderstanding. Inspect the tool client logic when available.

The copy should explain what the result means, not simply say the tool calculates something.

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
6. Record missing or uncertain facts instead of hiding them.

## Supabase And Route Review

After topic research, check the target table shape and route behavior.

Core content tables:

- `catalog_pages`
- `wiki_pages`
- `articles`
- `tools`
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

If the answer is no, research is not ready.
