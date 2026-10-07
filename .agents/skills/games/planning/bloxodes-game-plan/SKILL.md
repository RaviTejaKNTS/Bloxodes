---
name: bloxodes-game-plan
description: Research a new non-Roblox game and plan its Bloxodes wiki, collections, codes, tools, maps, checklists, quizzes and catalogs. Use when asked what to cover for a game or to start its content work.
---

# Plan a game

Start with the exact game and its useful content. Keep the plan short enough for the user to decide what to create.

## Check the game

Read `dev-docs/pipelines/wiki-collections.md` and the shared-game section of `dev-docs/pipelines/content.md`. Check the shared `games` registry, published pages and saved routes in development and production before proposing duplicates. Roblox uses its separate skills and tables.

Research official game, developer, manual and update sources, then useful game databases and guides. Open the sources used for decisions. Confirm release status, available modes and editions, and the gameplay systems that have enough verified information for a page. Keep unreleased or uncertain systems out of the creation list.

Use `kind=game` for a standalone title and `kind=franchise` for a root containing several titles. Children use `parent_id`. A new game does not need a new database table or custom route file. Preserve Minecraft's existing edition paths. GTA uses its specialist source and map rules.

## Choose pages that fit

- Wiki: explain the game, its controls and main systems, then link its references. A franchise root links its child wikis.
- Collections: use separate references for useful rosters such as items, recipes, enemies, equipment, locations or permanent cheats. Support varied fields and images. Collectible collections can have checkmarks.
- Codes: only when the game has redeem codes with verified announcements and redemption steps.
- Tools: only when a calculation helps players and its rules can be verified. Check the registered calculators. Name any new calculation code required.
- Maps: only with reusable map artwork and verified pin positions. The shared image map supports categories, search and zoom. Name a custom map engine only when needed.
- Checklists: normally propose only source-verified 100% completion for the exact game and edition or mode, with one checklist board per detail page. Verify the full requirements before recommending creation. Defer when that scope is unknown; beginner, preparation and routine lists need an explicit user exception. Follow `dev-docs/pipelines/content.md#standalone-checklist-scope`. A collectible or achievement roster does not establish in-game 100% completion.
- Quizzes: stable, source-backed game facts with fair answers. Use the shared quiz player.
- Catalogs: a reference that needs its own columns or presentation outside an individual wiki collection. Reuse a collection when it already fits. Catalogs have a plain page shell and a table by default; cards are optional custom work.

Do not create every type merely because it exists. Avoid multiple pages covering the same roster. Keep competition gaps, player-question lists and planning notes out of the database.

## Return a compact plan

Save `plan.md` in an ignored task workspace when a file is useful. Include the identity, root URL and one table with page type, proposed title, URL, what it contains and whether extra code is needed. Link the sources supporting the proposed coverage. Put the most useful first pages first and briefly explain any skipped types.

For new content, wiki and codes use the standalone or child route rules from the wiki documentation. Named tools, maps, checklists, quizzes and catalogs use `/<namespace>/<type>/<page-slug>`; their section URL is a directory. Collections append their slug to the owning wiki.

If the request is only to plan, return the plan. If it also authorizes creation, continue with the matching skills within that scope. Do not ask again for work the user already authorized.

## Continue with the matching workflow

- Wiki: `bloxodes-franchise-wiki-*`, which also covers standalone games.
- Collections: `bloxodes-franchise-game-collection-*`.
- GTA wiki and collections: the corresponding `bloxodes-gta-*` skills.
- Codes: `bloxodes-games-code-pages`.
- Tools: `bloxodes-games-tool-pages`.
- Maps, checklists, quizzes and catalogs: `bloxodes-games-reference-pages`.

Use the stable `.agents/skills/<skill-name>/SKILL.md` entry points. Research and planning stay in ignored files. Publish reviewed content to managed development and verify it before any separately authorized production release. Homepage and sidebar redesign remain separate work.
