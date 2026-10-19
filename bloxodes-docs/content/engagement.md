# Quizzes, checklists, events and tools

Last verified: 2026-10-19

Roblox engagement pages. All of these are made by hand when the owner asks; none have a schedule. The non-Roblox versions are in [franchise games](franchise.md).

Every page type follows the same path: runner skill → research → research review → writing → review, with stages routed by `bloxodes-model-routing`, then `bloxodes-release-e2e` to publish. Writing always uses `bloxodes-voice`.

## Quizzes

- **Skills:** `bloxodes-quiz-workflow-runner`, `bloxodes-quiz-research`, `bloxodes-quiz-writing`. Every question gets a fact check.
- **Data:** `quiz_pages.quiz_data` (JSONB) plus page copy. Account history in `user_quiz_progress`.
- **Runtime:** database only. Each attempt draws five easy, five medium and five hard questions (`apps/web/src/lib/quizzes.ts`).
- **Publish:** `import:content-final` (`scripts/content/import-content-final.ts`), the `content-final` publisher.
- **Live:** 13 published quizzes, last changed 2026-08-29.

## Standalone checklists

- **Skills:** `bloxodes-checklist-workflow-runner`, `bloxodes-checklist-research`, `bloxodes-checklist-writing`. Every task gets a fact check.
- **Data:** `checklist_pages`, `checklist_items`, progress in `user_checklist_progress` (key `checklist:<slug>`).
- **Publish:** `content-final` publisher. Updates must include every kept task and keep its ID, so saved progress survives.
- **Live:** 14 pages with 3,216 tasks, last changed 2026-06-07.

### Standalone checklist scope

This applies to Roblox and non-Roblox checklists.

- **One job:** a checklist is a source-verified 100% completion list for one named game, edition or mode. Verify every required activity, threshold, exclusion and alternative path first. If sources don't prove the full scope, don't make the page. Beginner lists, prep lists and routines need an explicit owner exception, recorded in the plan and brief.
- **One page per game:** check published pages and drafts first, and reuse the existing checklist. No extra pages per edition, mode or milestone without an owner exception.
- **Layout:** each section is a heading with its done/total count, and tasks are checkbox rows in groups of up to 12 so ads can sit between groups.
- **Progress:** the percentage counts checked tasks. It doesn't reproduce a game's weighted completion meter, and `is_required` doesn't exclude anything.
- **Either-or tasks:** write one task titled "A or B". Its description explains both paths and says to tick it after either one. Don't split it into two tasks or use `is_required: false`.
- **Tips** go in descriptions, not as extra checkable rows.
- **Not a collection:** collectible wiki collections and achievement trackers are separate. They don't prove 100% completion.
- Never change existing task IDs, URLs or saved progress.

## Events

- **Evergreen pages:** `bloxodes-events-workflow-runner`, `bloxodes-events-research`, `bloxodes-events-writing` → `events_pages`, published with the `events-final` publisher (`scripts/ci/publish-events.ts`). 22 published pages.
- **Timeline data:** collector-owned, not written by hand. VPS cron at 00:15 UTC runs `collect:virtual-events` (`scripts/events/collect-roblox-virtual-events.ts`), then `seed:event-details -- --all` (`seed-event-details.ts`). Data in `roblox_virtual_events` (8,005 rows).

## Tools

- **Skills:** `bloxodes-tool-workflow-runner`, `bloxodes-tool-research`, `bloxodes-tool-writing`, `bloxodes-tool-suggestions`. Research checks formulas and assumptions.
- **Data:** `tools` and `tools_view` hold copy and metadata. Calculators are TypeScript components; new behaviour needs a code PR.
- **Publish:** `import:tool-finals` (`scripts/content/import-tool-finals.ts`), the `tool-finals` publisher.
- **Live:** 13 published tools, last changed 2026-08-11.

## Suggestions

`bloxodes-engagement-suggestions` suggests which codes, quiz, checklist and events pages a Roblox game should get.

## Known issues

- The events cron is still installed even though the checked-in crontab disables it. Detail generation fails on a missing `TAVILY_API_KEY`, and direct event revalidation reports a missing endpoint and secret. See [schedules](../automation/schedules.md#known-issues).
- The old `event_guide_generation_queue` table has no code left. Drop it in a later migration.
