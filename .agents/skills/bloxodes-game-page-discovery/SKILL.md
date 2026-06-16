---
name: bloxodes-game-page-discovery
description: Find the complete Bloxodes page coverage plan for a specific Roblox game. Use when auditing existing pages; deciding which catalog pages, articles, tools, codes page, wiki, checklist, and quiz should exist; identifying pages already covered; and producing a compact table-first research note that names the pages to build without treating missing data as a reason to avoid recommending a page.
---

# Bloxodes Game Page Discovery

## Start Here

Use this skill before creating or rewriting a full game coverage set. It is a page-discovery skill: the job is to decide what Bloxodes should cover for the game, what already exists, and what should be built next.

Read:

- `agents/content/research-policy.md`
- `agents/content/PROCESS.md`
- the relevant page-type guides under `agents/content/page-types/`

Also use `bloxodes-research` rules for source priority, current-fact verification, and `research-notes.md` standards.

## Output Contract

Create or update one game-level research file:

```text
tmp/content-workspace/<game-slug>/discovery/
  todo.md
  research-notes.md
```

Before research starts, copy `agents/content/todo-templates/discovery.md` into that folder as `todo.md` and check off items as the audit progresses.

Do not create `brief.md`, `review.md`, separate fan-out plans, or final page JSON during discovery. The research file is the base for later wiki, codes, catalog, article, checklist, quiz, and tool work.

Discovery stops with recommendations. Do not write final public copy, seed Supabase rows, inject code rows, or build datasets unless the user explicitly asks for the next page or data step after seeing the discovery plan.

## Discovery Shape

Research the game fully enough to answer what Bloxodes should publish around it. Do not stop at surface genre facts, but also do not turn discovery into a data-readiness audit. Missing data is normal. If a page is needed, recommend it and list the data/items that must be gathered later.

Discovery starts with production coverage. After resolving the canonical game identity, check the production database or public production pages before brainstorming new pages. Search by universe ID, place ID, game slug, title, old slugs, route, source URLs, item/system names, and topic synonyms across codes, wiki, checklist, quiz, tools, catalogs, articles, and public URLs. If production already covers a topic, mark it `[we already have a page]` and only recommend an update when the existing page is stale, thin, unpublished, broken, or missing required data. Check local datasets and draft rows after the production duplicate gate, not as a replacement for it.

Do not suggest a new article, catalog, tool, checklist, quiz, wiki, code page, or event-adjacent page until this production coverage gate is recorded in `research-notes.md`. If production cannot be checked, stop with `needs production coverage check`.

Discovery should cover:

- exact game identity and ambiguity with similarly named games
- existing Bloxodes pages and local datasets to skip
- all catalog pages needed for durable in-game item/system collections
- all focused article topics that would make coverage feel complete
- practical tools/calculators/planners/checkers worth building
- whether a codes page should exist and whether one is already published
- wiki, checklist, and quiz, which are normally created for every covered game
- events page status only as `skip events in this workflow`; do not plan event pages here

## Core Goal

Answer these questions deeply:

- Which exact Roblox game is this?
- What is its universe ID, place ID, creator, official URL, current description, and update state?
- Which Bloxodes pages already exist for that game?
- Which existing pages are published and complete enough to skip?
- Which existing pages are unpublished, thin, stale, missing data, or worth updating?
- Which missing page types and topics should be created?
- Does the game have a real codes system and supported code source wiring, so automation can own code rows?
- Which durable in-game item collections need catalog pages?
- Which items/systems belong inside each catalog?
- Which experience-style, tutorial, opinionated, or player-question articles should exist without repeating catalogs/wiki/codes?
- Which tools can exist because they have a real input/output job?
- Which pages should be skipped because they already exist?
- Which catalog should be researched and built first?

## Resolve The Game First

Identify the canonical game before auditing pages.

Record:

- game name and preferred Bloxodes slug
- Roblox universe ID
- root place ID
- creator or group
- official Roblox URL
- Roblox genre and age guidance when available
- created and updated timestamps from Roblox API
- current Roblox description summary
- official social/developer links if available
- likely ambiguity with similarly named games

Roblox API checks in discovery are only for identity and metadata. Do not use API item availability to decide catalog coverage, because game catalog item rows must be found through online research and source gathering.

If the request names a game loosely, verify the exact target with current sources. Do not merge pages for games that only share a name pattern, such as `RIVALS`, `Blue Lock Rivals`, and `Racket Rivals`.

## Audit Existing Bloxodes Coverage

Search by universe ID, slug, title, old slugs, and source URLs.

Be explicit about which Bloxodes environment you are auditing. Production is required before new topic recommendations. The default repo env can point at local Supabase in development, so do not call a read "production" unless you intentionally used the production env, checked the public site, or otherwise proved the source is live. For live coverage checks from repo scripts, set `NODE_ENV=production` so `scripts/shared/load-env.ts` loads `.env` instead of `.env.local` / `.env.development.local`. If the public site disagrees with a DB result, treat the environment mismatch as a blocker and resolve it before writing recommendations.

Check every relevant page type:

- codes page in `games`
- wiki page in `wiki_pages`
- checklist page and items
- quiz page and local quiz data
- tools linked by universe ID or game slug
- game catalog pages in `wiki_catalog_pages`
- old catalog redirects or `catalog_pages` rows
- articles linked by universe ID, slug, tags, title, or sources
- local datasets in `data/<Game>/` and `apps/web/src/data/`
- local route/config support, especially `apps/web/src/lib/game-dataset-catalogs.ts`

Use these labels in the discovery tables:

- `[we already have a page]` - published or existing coverage is already present; note if it needs an update in the next-action column.
- `[must create]` - highest-priority page needed for complete game coverage.
- `[have to create]` - useful page needed after the must-create items.
- `[create]` - only for wiki, checklist, and quiz when missing.
- `[does not have codes system]` - codes-only label when no real code system exists.
- `[no tool recommended]` - tools-only label when research finds no real tool use case.

Do not mark a page `[we already have a page]` just because a row exists. Check whether it is published, linked to the correct universe, has useful copy/data, and still matches current facts. Do not mark a topic `[must create]` until production has been checked and no existing production page covers the same intent.

## Codes Eligibility

Only recommend `/codes/<slug>` when the game has a real codes system and supported source wiring.

Check:

- official Roblox description, socials, developer posts, or in-game UI evidence for codes
- RobloxDen page for the game
- Beebom page for the game
- existing `games` row fields: `slug`, `roblox_link`, `source_url`, `source_url_2`, publish state, evergreen copy fields

If RobloxDen or Beebom is missing, record the gap. Do not manually collect active or expired code rows. Do not create a codes page for games with no evidence of a code system.

Codes pages are automation-owned. The discovery output may recommend creating or updating the `games` row and source URLs, but it must never include current code names, active-code counts, expired code lists, current reward mappings, exact code dates, or live freshness claims. Public copy should be evergreen: what the game is, what reward types usually affect, how redemption normally works, why redemption can fail, and where official codes tend to appear.

Recommended result shape:

```markdown
Codes page: [must create] | [have to create] | [we already have a page] | [does not have codes system]
Reason:
Roblox URL:
RobloxDen:
Beebom:
Refresh action:
```

## Events

Do not plan event pages in this workflow. Record one short note if the game has visible event evidence, then move on. Event-page work uses its own events workflow later.

## Catalog Pages

Catalog discovery is the most important part of this skill.

Find every durable in-game item collection that Bloxodes should cover so the game feels complete. A catalog recommendation does not require the dataset to already exist. It does require enough research to believe the item/system exists and belongs on its own page.

Use online research for catalog discovery: official/developer sources, Roblox experience pages, community wikis or databases, guides, videos, screenshots, changelogs, and competitor/source pages. Do not drift into Roblox APIs for item rows. API gaps are not catalog blockers; put the needed online data/source work in the next-action column.

Good catalog candidates include:

- weapons, guns, swords, abilities, spells, styles, fruits, races, clans, traits, perks
- pets, eggs, crops, seeds, materials, fish, bosses, enemies, drops, islands, locations, maps
- vehicles, furniture, cosmetics, skins, wraps, charms, titles, emotes, mounts, tools
- recipes, enchantments, potions, quests, achievements, contracts, or currencies only when they behave like stable item/system collections with repeatable player decisions
- UGC collections only as a special exception when the game has meaningful UGC items; use the item-card pattern from the free Roblox items page

Do not make catalog pages for weak or temporary surfaces:

- one-off event reward tracks
- current season pass reward tiers
- current ranked season rewards
- limited timeline/event pages that should live under events automation
- broad shop/update summaries that are not item collections
- progression concepts without stable item rows
- game servers
- gamepasses
- badges
- developer products
- avatar UGC unless it is intentionally being handled as the UGC exception above
- private server settings
- generic social links
- raw Roblox thumbnails/media

For each catalog candidate, record in a compact table:

- recommended route: `/wiki/<game-slug>/<collection-slug>`
- stable code: `<game-slug>-<collection-slug>`
- status: `[must create]`, `[have to create]`, or `[we already have a page]`
- what items/systems belong inside it
- why players need it
- likely card fields and grouping axis
- existing page/data status, if any
- next data/source task

Do not label needed catalogs as blocked because data must be gathered. Put the data work in the next-action column. Only omit a catalog idea when it is not a real durable item/system collection.

## Articles

Articles should make the game feel fully covered beyond database pages. They can be opinionated, experience-based, communicative, tutorial-style, or route/advice driven, but they must not repeat what a catalog, wiki, codes page, checklist, quiz, or tool already covers better.

Good article candidates include:

- priority and spend choices, such as what to buy first, save for, skip, unlock next, or stop upgrading
- tier, ranking, and recommendation topics when the article can explain the player judgment behind the ranking
- mechanic explainers for systems players search by name, such as weather, mutations, day/night, stock, pity, crafting, evolution, defense, or guilds
- single important item, boss, NPC, island, quest, route, ability, style, pet, or weapon deep dives
- comparison topics, such as one route, item, class, build, or farming method against another
- mistake and avoidance topics, especially currency waste, bad upgrades, risky trades, weak routes, or traps new players hit
- progression and route topics, such as what to do after a major unlock or when to move to the next area
- location and unlock topics when the answer is more than a simple catalog field

Avoid generic beginner guides, update/news articles, event timelines, broad catalog explanations, Discord/Trello/wiki link pages, and `All <core items>` topics. Complete item lists belong to catalog pages, not articles. If the best title starts with `All <items>`, recommend or update the catalog instead unless the article angle is a separate player decision such as best first pick, worth using, or what to skip.

When discovery only produces how-to articles, rerun the topic scan across priority, ranking, mechanic, comparison, mistake, progression, route, location, and unlock intents before finalizing the article list.

For each article candidate, record:

- status: `[must create]`, `[have to create]`, or `[we already have a page]`
- title/angle
- reader question
- production duplicate check: existing article/page found or `none found`
- why it does not repeat another page
- sources/data needed

## Tools

Use a hard gate. Research whether players or competing sites already use a calculator, planner, tracker, optimizer, converter, or checker for this game mechanic.

- Recommend a tool only when it has a real input/output job, enough reliable data or formula support, and clear player value beyond a catalog or article.
- Do not recommend a tool just to duplicate a catalog.
- If no real tool exists, say `[no tool recommended]`.

## Wiki, Checklist, And Quiz

Wiki, checklist, and quiz are common game-coverage pages.

- Use `[create]` when missing.
- Use `[we already have a page]` when existing.
- Do not defer these in discovery. If they need data later, list that in next action.

## Research Notes Shape

Use this structure for `research-notes.md`:

```markdown
# Research Notes: <Game> Page Discovery

Date: YYYY-MM-DD
Page Type: game-page-discovery
Target: /wiki/<game-slug> and related pages
Status: researching | complete

## Game identity

One compact row or bullet list with canonical game, universe ID, place ID, creator, official URL, and ambiguity notes.

## Existing Bloxodes coverage audit

Small table with page type, status label, existing page/data evidence, and next action.

## Codes page

Evidence for or against a codes page. Include RobloxDen and Beebom status. No manual codes.

## Catalog pages

Table of all catalog pages needed. Include route/code, status label, items included, why players need it, fields/grouping, existing data/page, and next action.

## Article pages

Table of all article topics needed. Include status label, title/angle, reader question, why it does not repeat another page, and source/data needs.

## Tools

Table of practical tool ideas, or `[no tool recommended]` with a reason.

## Wiki, checklist, quiz

Small table with each page and `[create]` or `[we already have a page]`.

## Events

One-line note: skipped in this workflow.

## Recommended build order

Ranked page build order. Start with must-create catalog and codes/wiki/checklist/quiz decisions, then have-to-create catalogs/articles/tools.

## Source notes

Compact source list and unresolved ambiguity.
```

## Build Order Rules

Prefer this order unless the game demands otherwise:

1. Resolve game identity and universe ID.
2. Audit production Bloxodes pages first, then local datasets and draft rows.
3. Decide whether a codes page should exist without writing live code rows.
4. List every catalog page needed, including what items belong inside each one.
5. List article topics that complete coverage without repeating catalogs/wiki/codes.
6. List tool opportunities with real input/output value.
7. Mark wiki, checklist, and quiz as `[create]` or `[we already have a page]`.
8. Return a compact table-first plan and stop.

For most new games, the first useful work is:

- codes page, only when eligible
- wiki hub
- checklist
- quiz
- first must-create catalog
- remaining must-create/have-to-create catalogs
- tools only after a hard-gated use case is proven
- articles that add experience, advice, tutorials, or opinionated guidance without repeating page types

For catalog-heavy games, the first gold-standard page should usually be the core evergreen collection with the clearest player decision and best source data, not necessarily the largest collection.

## Final Response

Return a concise summary of:

- canonical game and universe ID
- pages we already have
- pages to create, grouped by page type
- all catalog pages and items/systems they should include
- article topics
- tool ideas
- codes-page decision
- wiki/checklist/quiz decision
- first catalog/page to build next
- research notes path

Keep the detailed evidence in `research-notes.md`.
