---
name: bloxodes-game-plan
description: Research a new non-Roblox game and plan its Bloxodes wiki, collections, codes, tools, maps, checklists, quizzes and catalogs. Use when asked what to cover for a game or to start its content work.
---

# Plan a game

You research one non-Roblox game and plan which Bloxodes pages it should get. Done means a short plan the user can say yes or no to, row by row, with the most useful pages first.

## Check the game

- Read `dev-docs/pipelines/wiki-collections.md` and the shared-game section of `dev-docs/pipelines/content.md`.
- Check the shared `games` registry, published pages and saved routes in development and production before you propose anything, so you don't duplicate.
- Roblox uses its own separate skills and tables.
- Research official game, developer, manual and update sources first, then useful game databases and guides. Open every source you use for a decision.
- Confirm release status, available modes and editions, and which gameplay systems have enough verified information for a page. Keep unreleased or uncertain systems off the creation list.

Identity and routes:

- Use `kind=game` for a standalone title and `kind=franchise` for a root that holds several titles. Children use `parent_id`.
- A new game doesn't need a new database table or custom route file.
- Keep Minecraft's existing edition paths.
- GTA uses its specialist source and map rules.

## Choose pages that fit

| Type | When it fits |
| --- | --- |
| Wiki | Explain the game, its controls and main systems, then link its references. A franchise root links its child wikis. |
| Collections | Separate references for useful rosters such as items, recipes, enemies, equipment, locations or permanent cheats. Support varied fields and images. Collectible collections can have checkmarks. |
| Codes | Only when the game has redeem codes with verified announcements and redemption steps. |
| Tools | Only when a calculation helps players and its rules can be verified. Check the registered calculators. Name any new calculation code needed. |
| Maps | Only with reusable map artwork and verified pin positions. The shared image map supports categories, search and zoom. Name a custom map engine only when needed. |
| Checklists | See the checklist rules below. |
| Quizzes | Stable, source-backed game facts with fair answers. Use the shared quiz player. |
| Catalogs | A reference that needs its own columns or presentation outside a single wiki collection. Reuse a collection when one already fits. Catalogs have a plain page shell and a table by default; cards are optional custom work. |

Checklist rules:

- Normally propose only one standalone, source-verified 100% completion checklist per game, with sections inside its single board.
- State its supported edition or mode, and check the game's existing published pages and drafts before proposing one. Reuse an existing checklist.
- Extra checklist pages, or beginner, preparation and routine lists, need an explicit user exception.
- Verify the full requirements, and defer when that scope is unknown. Follow `dev-docs/pipelines/content.md#standalone-checklist-scope`.
- A collectible or achievement roster doesn't prove in-game 100% completion.

Keep it lean:

- Don't create every page type just because it exists.
- Avoid several pages covering the same roster.
- Keep competition gaps, player-question lists and planning notes out of the database.

## Name pages the way players search

Proposed titles become real page titles, so write them in the words a player would type, not internal labels.

- Use the game's own nouns and the common short game name: "GTA 5 Stunt Jump Locations", not "GTA V Aerial Challenge Collection".
- In "what it contains", say what the player gets in one plain line ("every stunt jump with its location and the vehicle that clears it"), not "a comprehensive resource for players."
- Give each row its own angle. If every row reads like the same template with a different noun, rethink it.

## Return a compact plan

- Save `plan.md` in an ignored task workspace when a file helps.
- Include the identity, the root URL and one table with: page type, proposed title, URL, what it contains, and whether extra code is needed.
- Link the sources that support the proposed coverage.
- Put the most useful first pages first, and briefly explain any skipped types.

URL rules for new content:

- Wiki and codes use the standalone or child route rules from the wiki docs.
- Named tools, maps, checklists, quizzes and catalogs use `/<namespace>/<type>/<page-slug>`. Their section URL is a directory.
- Collections append their slug to the owning wiki.

If the request is only to plan, return the plan. If it also authorizes creation, carry on with the matching skills within that scope. Don't ask again for work the user already authorized.

## Continue with the matching workflow

- Wiki: `bloxodes-franchise-wiki-*`, which also covers standalone games.
- Collections: `bloxodes-franchise-game-collection-*`.
- GTA wiki and collections: the matching `bloxodes-gta-*` skills.
- Codes: `bloxodes-games-code-pages`.
- Tools: `bloxodes-games-tool-pages`.
- Maps, checklists, quizzes and catalogs: `bloxodes-games-reference-pages`.

Use the stable `.agents/skills/<skill-name>/SKILL.md` entry points.

- Research and planning stay in ignored files.
- Publish reviewed content to managed development and verify it there before any separately authorized production release.
- Homepage and sidebar redesign stay separate work.
