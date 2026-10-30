# Quizzes, checklists, tools and events data

Last verified: 2026-10-30

Roblox engagement pages. Quizzes, checklists and tools are made by hand when the owner asks; none have a schedule. Events are collected data only. The non-Roblox versions are in [franchise games](franchise.md).

Every page type follows the same path: runner skill → research → research review → writing → review, with stages routed by `bloxodes-model-routing`, then `bloxodes-release-e2e` to publish. Writing always uses `bloxodes-voice`.

## Quizzes

- **Skills:** `bloxodes-quiz-workflow-runner`, `bloxodes-quiz-research`, `bloxodes-quiz-writing`. Every question gets a fact check.
- **Data:** `quiz_pages.quiz_data` (JSONB) plus page copy. Account history in `user_quiz_progress`.
- **Runtime:** database only. Each attempt draws five easy, five medium and five hard questions (`apps/web/src/lib/quizzes.ts`).
- **Publish:** `import:content-final` (`scripts/content/import-content-final.ts`), the `content-final` publisher.
- **Live:** 44 published quizzes, last changed 2026-10-30.

## Standalone checklists

- **Skills:** `bloxodes-checklist-workflow-runner`, `bloxodes-checklist-research`, `bloxodes-checklist-writing`. Every task gets a fact check.
- **Data:** `checklist_pages`, `checklist_items`, progress in `user_checklist_progress` (key `checklist:<slug>`).
- **Publish:** `content-final` publisher. Updates must include every kept task and keep its ID, so saved progress survives.
- **Live:** 14 pages with 3,216 tasks, last changed 2026-06-07.

### Standalone checklist scope

This applies to Roblox and non-Roblox checklists.

- **Only where it makes sense:** make a checklist only for a game with enough to track (items, quests, badges, areas) for a board on the scale of the live ones, which run 82 to 543 tasks. Otherwise the game gets a quiz and no checklist. Never shrink the goal to one quest, match or unlock to force a page.
- **One job:** a checklist is a source-verified 100% completion list for one named game, edition or mode, as the game stands today. Verify every required activity, threshold, exclusion and alternative path first. If sources don't prove the full scope, don't make the page. Games update often, so checklists are refreshed when they do; a later update doesn't make today's page wrong. Beginner lists, prep lists, routines and single-goal boards aren't checklists.
- **One page per game:** check published pages and drafts first, and reuse the existing checklist. No extra pages per edition, mode or milestone without an owner exception.
- **Layout:** each section is a heading with its done/total count, and tasks are checkbox rows in groups of up to 12 so ads can sit between groups.
- **Progress:** the percentage counts checked tasks. It doesn't reproduce a game's weighted completion meter, and `is_required` doesn't exclude anything.
- **Either-or tasks:** write one task titled "A or B". Its description explains both paths and says to tick it after either one. Don't split it into two tasks or use `is_required: false`.
- **Tips** go in descriptions, not as extra checkable rows.
- **Not a collection:** collectible wiki collections and achievement trackers are separate. They don't prove 100% completion.
- Never change existing task IDs, URLs or saved progress.

## Events

We collect Roblox virtual events because wiki hubs and other pages show them. We don't write event text or make new events pages.

- **Collector:** VPS cron at 00:15 UTC runs `collect:virtual-events` (`scripts/events/collect-roblox-virtual-events.ts`). It writes only events that changed to `roblox_virtual_events` and its category and thumbnail tables.
- **Where they show:** home, `/events`, `/wiki`, wiki hubs, `/stats/games/<slug>` chart notes, game sidebars and the mobile app.
- **Page refresh:** for each changed game the collector queues `wiki`, `event`, `stats:games/<slug>`, `checklist`, `tool` and `wiki_collection` revalidations (source `virtual_events_vps`) through the normal [revalidation queue](../operations/cache.md).
- **Existing events pages:** 22 published `events_pages` stay live. They have no skills; edit them through the `events-final` publisher (`scripts/ci/publish-events.ts`) only if one needs a fix.

## Tools

- **Skills:** `bloxodes-tool-workflow-runner`, `bloxodes-tool-research`, `bloxodes-tool-writing`, `bloxodes-tool-suggestions`. Research checks formulas and assumptions.
- **Data:** `tools` and `tools_view` hold copy and metadata. Calculators are TypeScript components; new behaviour needs a code PR.
- **Publish:** `import:tool-finals` (`scripts/content/import-tool-finals.ts`), the `tool-finals` publisher.
- **Live:** 13 published tools, last changed 2026-08-11.

## Suggestions

`bloxodes-engagement-suggestions` suggests which codes, quiz and checklist pages a Roblox game should get.
