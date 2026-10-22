# Deferred Bloxodes architecture proposal

Updated: 2026-10-22. Status: deferred. The owner's latest decision is to keep the current site structure and scope only the canonical cleanup. Do not implement the URL migration below. No implementation has started.

The earlier proposal and tracker remain below for reference. Today's scope is to consolidate canonical signals for confirmed duplicate namespace roots and their existing published root wikis, with matching metadata, sitemap and internal-link cleanup. No new hubs or page-type URL migration are part of that work.

Content URLs stay fixed. Database relationships control grouping, discovery and breadcrumbs. Adding a sequel creates new content and group memberships without moving the first game's pages.

This is the deferred target architecture. The deployed site continues to use its existing Roblox and namespaced non-Roblox routes.

## URL structure

| Page | Target URL | Purpose |
| --- | --- | --- |
| Games directory | `/games` | Lists the games and hubs Bloxodes covers. |
| Franchise hub | `/games/gta` | Groups GTA games and franchise-wide resources. |
| Platform hub | `/games/roblox` | Groups Roblox games, wikis and platform resources. |
| Edition hub | `/games/minecraft` | Groups Minecraft editions and shared resources. |
| Wiki index | `/wiki` | Lists game wikis across all covered games. |
| Individual game home and wiki | `/wiki/gta-5`, `/wiki/wardogs` | Explains one game and links its published content. |
| Game collection | `/wiki/gta-5/vehicles` | Covers a collection belonging to that game. |
| Codes | `/codes/{slug}` | One codes page at its permanent address. |
| Tool | `/tools/{slug}` | One calculator, checker or other supported tool. |
| Map | `/maps/{slug}` | One map at its permanent address. |
| Quiz | `/quizzes/{slug}` | One quiz. |
| Checklist | `/checklists/{slug}` | One completion checklist. |
| Catalog | `/catalog/{slug}` | One catalog, including platform-wide references. |
| Article | `/articles/{slug}` | One article or guide. |
| Event | `/events/{slug}` | One event. |

Detail pages use descriptive slugs and can have game, franchise or platform scope. A game can have several tools, maps, quizzes or checklists. Preserve useful existing nested catalog and pagination routes when planning migration.

Existing Roblox statistics and puzzle routes need their own inventory. This decision does not invent statistics for other games or require unrelated routes to move.

## What each page contains

### Games directory

`/games` mixes individual game cards and group cards. A standalone game's card opens its wiki directly. A group card opens its hub. Define a useful published-page fallback for games with codes or other content but no wiki before implementation.

### Group hubs

Hubs represent franchises, platforms or edition groups. They use one shared template with the group type stored in the database.

A hub contains a short overview, its member games or editions, and relevant shared resources. For example, `/games/roblox` includes Roblox games and platform resources such as catalogs, tools and statistics. Its purpose is broader than the all-games wiki index.

Create a hub when readers need a grouping page. A standalone game does not require an extra hub or a separate game homepage.

### Individual game wikis

`/wiki/{game}` is the game's home and main guide. It contains the game overview, useful gameplay guidance, collections and automatic links to its published codes, maps, tools, quizzes, checklists, catalogs, articles and events.

All games use shared wiki and collection templates. Optional components can provide Roblox statistics or other registered game functionality when relevant data exists.

### Resource pages

A resource has one permanent URL and an explicit scope. Relevant hubs and game wikis link to that same page. Showing it in several places does not create additional copies.

| Resource | Scope | URL |
| --- | --- | --- |
| Roblox music IDs | Roblox platform | `/catalog/roblox-music-ids` |
| Roblox profile checker | Roblox platform | `/tools/roblox-profile-checker` |
| Grow a Garden crop value calculator | Grow a Garden game | `/tools/grow-a-garden-crop-value-calculator` |
| GTA completion planner | GTA franchise | `/tools/gta-completion-planner` |

The tool URLs above illustrate the agreed naming pattern. They do not claim those tools are already published.

## Adding a sequel

WARDOGS starts at `/wiki/wardogs`. If WARDOGS 2 arrives:

1. Create the second game's record and wiki at `/wiki/wardogs-2`.
2. Create `/games/wardogs` as the franchise hub when it is useful.
3. Connect both games to that hub.
4. Let directory links and breadcrumbs reflect their membership.

The original wiki, collections and resource URLs remain unchanged. The publisher must not derive permanent content paths from a game's current parent or group membership.

## Content Factory and code repo

The boundary depends on whether the required template or feature already exists.

The Content Factory owns research, fact checks, writing, questions, checklist tasks, collection data, images and supported content publication. The target includes wikis, collections, quizzes, checklists and articles without a code change for each ordinary page.

Today, the Content Factory supports wiki hubs and collections. Other page types need factory workflows, validation and publishing support before agents can produce them there.

The code repo owns shared templates, database structure, validators, publishers, calculators, map engines and source integrations. A new interactive tool or unsupported feature requires code work. Tools, codes and catalogs can become factory content when existing features and publishing support cover the request.

Ordinary content updates should not require a site build. Content still needs factual, editorial, data, image and link review. Shared code and template changes require GitHub checks and representative browser review.

## Implementation tracker

| ID | Work | Status | Completion criteria |
| --- | --- | --- | --- |
| A01 | Agree architecture | Complete | Permanent page-type URLs, optional group hubs and game/group content relationships accepted in this discussion. |
| A02 | Inventory existing content and routes | Not started | Map published URLs, scopes, aliases, game identities, datasets, media and user-progress keys to their targets. |
| A03 | Design identities and relationships | Not started | Extend or reuse the existing registry. Define games, group kinds, memberships, content scope, related links, breadcrumb parents and slug uniqueness. Preserve stable IDs. |
| A04 | Implement shared routes and templates | Not started | Support the agreed indexes, hubs, game wikis and collections from database records. New ordinary games and group membership changes need no route files. |
| A05 | Implement automatic discovery | Not started | Directories, related-page cards and breadcrumbs reflect published records and scope. Define the no-wiki fallback and avoid duplicate or empty pages. |
| A06 | Update contracts and factory workflows | Not started | Publishers support stable routes independent of membership. Provide compatibility for existing bundles and add other page types as their publishing support becomes available. |
| A07 | Plan redirects and canonical cleanup | Not started | Give every existing page an explicit destination. Redirect retired duplicates, align canonicals and structured data, and update internal links, sitemaps, search, feeds and cache handling. |
| A08 | Verify the migration on GitHub | Not started | Cover existing content, sequel membership changes, scoped resources, slug collisions, unpublished pages, redirects, media and saved progress. Review representative shared layouts. |
| A09 | Approve and release | Not started | Release in a compatible order, coordinate affected factory jobs, verify production and preserve rollback options. Production release requires explicit authorization. |

Link implementation PRs and verification evidence here as work completes. No implementation dates or owners have been assigned.

## Details to settle during design

- Global editorial slug collisions, including Roblox games named after other titles.
- Group membership rules and the breadcrumb parent when a page relates to several games or groups.
- The game-card destination when a game has useful published content but no wiki.
- Routes and scope for existing combined franchise pages, specialized catalogs, statistics and legacy Minecraft edition paths.
- How current Roblox and non-Roblox storage feeds shared readers and publishers without losing stable content IDs, datasets or saved progress.

These details refine the agreed structure. They must not make a game's permanent URL depend on whether a sequel exists.

Discussion: [Separate Content From Code](t3-thread://v1/934d1560-ea80-417e-94cd-2178da25b949).
