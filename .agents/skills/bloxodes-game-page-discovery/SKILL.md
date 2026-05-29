---
name: bloxodes-game-page-discovery
description: Find Bloxodes page opportunities for a specific Roblox game using a two-pass, catalog-led workflow. Use when auditing existing pages; confirming automation-owned codes/events eligibility; discovering durable in-game item catalogs; deciding skip/update/create/blocked/do-not-create status; and deferring wiki, checklist, quiz, tools, and focused evergreen articles until enough catalog/gameplay data exists.
---

# Bloxodes Game Page Discovery

## Start Here

Use this skill before creating or rewriting a full game coverage set. It is a planning and research skill, not a final writing skill.

Read:

- `agents/content/research-policy.md`
- `agents/content/PROCESS.md`
- `agents/wiki-catalog-workflow.md`
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

Do not create `brief.md`, `review.md`, separate fan-out plans, or final page JSON during discovery. The research file is the base for later wiki, codes, catalog, article, checklist, quiz, tool, and events work.

Discovery stops with recommendations. Do not write final public copy, seed Supabase rows, inject code/event data, or build datasets unless the user explicitly asks for the next page or data step after seeing the discovery plan.

## Professional Discovery Shape

Use two passes for full game coverage:

1. **Pass 1: catalog-led discovery.** Resolve the game, audit existing Bloxodes coverage, confirm codes/events automation eligibility, then find only durable in-game item collections that can become high-quality catalogs. This pass should end with a ranked catalog/data plan and one first gold-standard catalog.
2. **Pass 2: page discovery after catalog data.** After the core catalog data has been fetched or built, use that gameplay understanding to decide the wiki hub, checklist, quiz, tools, and focused evergreen article topics.

Do not brainstorm a broad page list from surface research. If a recommendation depends on item data, gameplay loops, unlock routes, or actual player pain points that have not been researched yet, mark it `blocked until catalog data` or `second-pass only`.

## Core Goal

Answer these questions deeply:

- Which exact Roblox game is this?
- What is its universe ID, place ID, creator, official URL, current description, and update state?
- Which Bloxodes pages already exist for that game?
- Which existing pages are published and complete enough to skip?
- Which existing pages are unpublished, thin, stale, missing data, or worth updating?
- Which missing page types should be created?
- Does the game have a real codes system and supported code source wiring, so automation can own code rows?
- Does the game have real events that Bloxodes can track through automation/imported event rows?
- Which durable core in-game item collections deserve catalog pages?
- Which catalogs need data/images before copy can be written?
- Which catalogs have enough player-useful facts to answer real buy, unlock, upgrade, farm, compare, equip, trade, reach, or use decisions?
- Which non-catalog pages should wait for the second pass?
- What catalog should be built first?

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

If the request names a game loosely, verify the exact target with current sources. Do not merge pages for games that only share a name pattern, such as `RIVALS`, `Blue Lock Rivals`, and `Racket Rivals`.

## Audit Existing Bloxodes Coverage

Search by universe ID, slug, title, old slugs, and source URLs.

Be explicit about which Bloxodes environment you are auditing. The default repo env can point at local Supabase in development, so do not call a read "production" unless you intentionally used the production env, checked the public site, or otherwise proved the source is live. For live coverage checks from repo scripts, set `NODE_ENV=production` so `scripts/shared/load-env.ts` loads `.env` instead of `.env.local` / `.env.development.local`. If the public site disagrees with a DB result, treat the environment mismatch as a blocker and resolve it before writing recommendations.

Check every relevant page type:

- codes page in `games`
- wiki page in `wiki_pages`
- event records or event pages
- checklist page and items
- quiz page and local quiz data
- tools linked by universe ID or game slug
- game catalog pages in `wiki_catalog_pages`
- old catalog redirects or `catalog_pages` rows
- articles linked by universe ID, slug, tags, title, or sources
- local datasets in `data/<Game>/` and `apps/web/src/data/`
- local route/config support, especially `apps/web/src/lib/game-dataset-catalogs.ts`

For each page, assign one status:

- `skip` - published, correctly linked, and complete enough for the current scope
- `update` - exists but is stale, thin, unpublished, missing data, weakly linked, or not aligned with current standards
- `create` - useful page does not exist
- `do not create` - no real in-game system or source support justifies the page
- `blocked` - useful page exists as an idea but sources, data, permissions, or route support are not enough yet

Do not mark a page `skip` just because a row exists. Check whether it is published, linked to the correct universe, has useful copy/data, and still matches current facts.

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
Codes page: create | update | skip | do not create | blocked
Reason:
Roblox URL:
RobloxDen:
Beebom:
Refresh action:
```

## Events Eligibility

Only recommend an events page or event records when the game has meaningful events that can be tracked from stable sources.

Check:

- Roblox API metadata and description for active event language
- developer posts, Discord, X/Twitter, YouTube, Trello, changelogs, or official docs
- community wiki/event pages when official sources are incomplete
- existing local event records and route behavior

Do not create event coverage only because a game updates often. Events need trackable names, phases, rewards, mechanics, or timeline rows from `roblox_virtual_events` or another approved importer. If event data cannot be automated or imported reliably, mark the work `blocked` or `do not create`.

Events pages are automation-owned. Discovery may recommend refreshing or importing event rows, but it must not write current event rows, live event status, dates, reward timelines, or one-off event claims into page copy. Public `events_pages.content_md` should be evergreen orientation around the game's event system and the automated timeline surface.

## Catalog Discovery

Catalog discovery is the most important part of this skill.

Find durable in-game item collections that players can collect, compare, unlock, farm, buy, roll, craft, equip, fight, visit, or use repeatedly. Catalogs should be built around core evergreen game systems, not every temporary reward list that happens to exist. Good catalog candidates include:

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

For each catalog candidate, record:

- recommended route: `/wiki/<game-slug>/<collection-slug>`
- stable code: `<game-slug>-<collection-slug>`
- source count and source names, if available
- local dataset path, if it exists
- local item count
- rendered card/table count, if route exists
- title count, if page exists
- image coverage expectation and known gaps
- primary player task and required facts needed to satisfy it
- source-backed useful facts missing from local data, such as prices, currencies, shops, damage, upgrade paths, chances, requirements, locations, roles, limits, or availability
- competitor/source usefulness notes when search potential matters
- whether the collection is current, retired, event-limited, premium, trade-only, mode-specific, or unclear
- strongest evergreen grouping axis, such as slot, rarity, source, location, unlock route, shop, tier, world, mode, role, or item type
- likely card fields and what each means to players
- raw fields to hide
- whether route/config/data/image work is needed
- status: `skip`, `update`, `create`, `blocked`, or `do not create`

Be deep, not bloated. Bloxodes should cover detailed games thoroughly, but a catalog candidate must be a real durable in-game collection with facts that can help players act. Separate `core catalog`, `later after data`, `UGC exception`, `second-pass only`, and `do not create` instead of padding the plan with temporary rewards or generic systems.

## Tools, Checklists, Quizzes, And Articles

Recommend these only when they have a real player use.

Tools:

- Use a hard gate. Research whether players or competing sites already use a calculator, planner, tracker, optimizer, converter, or checker for this game mechanic.
- Recommend a tool only when it has a real input/output job, enough reliable data or formula support, and clear player value beyond a catalog or article.
- Do not recommend a tool just to duplicate a catalog.
- If the idea is plausible but unproven, put it under `potential future tools`, not `create`.

Checklist:

- Usually one combined checklist per game.
- Recommend `create` or `update` when the game has progression, unlocks, collections, bosses, maps, quests, tasks, ranks, or repeatable goals worth tracking.

Quiz:

- Usually one combined quiz per game.
- Recommend after enough stable facts exist for easy/medium/hard questions.
- Mark `blocked` if the game is too volatile or lacks reliable facts.

Articles:

- Recommend only focused evergreen topics that do not overlap codes, events, wiki hubs, or catalog pages.
- Avoid generic beginner guides. Avoid codes troubleshooting, event articles, update-timeline articles, and broad "maps/skins/items explained" topics that a catalog or wiki page should cover.
- Good article candidates answer a narrow player job after catalog data is understood: how to get a specific item, how to complete a specific quest/objective, how a specific mode or map works, how to unlock a durable mechanic, how to farm a stable resource, or how to solve a specific evergreen gameplay problem.

## Research Notes Shape

Use this structure for `research-notes.md`:

```markdown
# Research Notes: <Game> Page Discovery

Date: YYYY-MM-DD
Page Type: game-page-discovery
Target: /wiki/<game-slug> and related pages
Status: researching | needs data update | needs verification | ready for first page

## Game identity

Canonical game, universe ID, place ID, creator, official links, description, timestamps, and ambiguity notes.

## What players do in this game

Explain the real gameplay loop and why players return.

## Existing Bloxodes coverage audit

Coverage matrix with one row per page type or existing page. Include status, current evidence, gaps, and next action.

## Codes eligibility

Evidence for or against a codes page. Include RobloxDen and Beebom status. No manual codes.

## Events eligibility

Evidence for or against event coverage. Include automation/import path, source quality, and whether dates/rewards belong in timeline rows instead of evergreen copy.

## Catalog discovery

Deep list of durable core in-game item collections. Include proposed route, code, source count, local data state, image state, primary player task, required facts, missing useful facts, grouping axis, card fields, and status. Mark temporary rewards, current season/event rewards, and generic progression systems as `do not create` or `second-pass only`.

## Tools opportunities

Only practical calculators/planners/trackers with real input and output logic, reliable data/formulas, and evidence that players need the tool. Otherwise hard-pass or mark as potential future.

## Checklist plan

Whether a checklist should exist, the major sections it would track, and any blockers.

## Quiz plan

Whether a quiz should exist, likely question areas, and whether facts are stable enough.

## Article opportunities

Specific evergreen article titles or angles, with the narrow reader question each would answer and the page type it does not overlap.

## Recommended build order

Ranked two-pass sequence with reasons. Name the first gold-standard catalog and what data must be fetched before second-pass page recommendations.

## Missing or uncertain facts

Unverified counts, stale source risks, missing source URLs, data/image gaps, route blockers, and facts needing current verification.

## Sources checked

Official Roblox/API, developer sources, community sources, local files, Supabase rows/views, and docs checked.
```

## Build Order Rules

Prefer this order unless the game demands otherwise:

1. Resolve game identity and universe ID.
2. Audit existing Bloxodes pages.
3. Decide codes and events automation eligibility without writing live data.
4. Discover durable core in-game catalogs and reject temporary/weak catalog ideas.
5. Pick one gold-standard catalog and define the data/image/useful-facts action needed.
6. Defer wiki, checklist, quiz, tools, and articles that depend on catalog understanding to second-pass discovery unless the evidence is already strong.
7. Return the ranked catalog-first plan and stop.

For most new games, the first useful work is:

- codes page, only when eligible
- events page, only when automation/imported event rows support it
- one gold-standard catalog with strong data
- wiki hub after at least one core catalog or strong game-system understanding exists
- checklist after enough systems are known from data
- quiz after enough stable facts exist
- tools only after a hard-gated use case is proven
- articles only after catalogs reveal narrow non-overlapping evergreen search intents

For catalog-heavy games, the first gold-standard page should usually be the core evergreen collection with the clearest player decision and best source data, not necessarily the largest collection.

## Final Response

Return a concise summary of:

- canonical game and universe ID
- existing pages to skip
- pages to update
- pages to create
- pages not recommended and why
- catalog opportunities, grouped by priority
- codes/events eligibility
- first recommended catalog/data step to build next
- what must wait for second-pass discovery
- research notes path

Keep the detailed evidence in `research-notes.md`.
