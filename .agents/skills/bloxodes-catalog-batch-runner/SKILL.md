---
name: bloxodes-catalog-batch-runner
description: Orchestrate multiple approved Bloxodes game catalog pages with one subagent per catalog. Use after game-page discovery and one gold-standard catalog are approved, when batching durable in-game item catalogs through per-page planning, parent review, data/image gathering, final.json writing, flow/final edit, and parent QA.
---

# Bloxodes Catalog Batch Runner

## Start Here

Use this skill only when the user wants to complete multiple approved game catalog pages in a coordinated batch. This is an orchestration skill. Each catalog page still follows `bloxodes-game-catalog-writing`.

Read:

- `tmp/content-workspace/<game-slug>/discovery/research-notes.md`
- `agents/content/todo-templates/catalog-batch.md`
- `agents/content/todo-templates/game-catalog.md`
- `.agents/skills/bloxodes-game-catalog-writing/SKILL.md`
- `.agents/skills/bloxodes-research/SKILL.md`
- `.agents/skills/bloxodes-flow-edit/SKILL.md`
- `.agents/skills/bloxodes-final-edit/SKILL.md`
- `agents/content/page-types/game-catalog-pages.md`
- `agents/wiki-catalog-workflow.md`

Load `references/subagent-prompt.md` before spawning or hand-writing a per-catalog subagent prompt.

## Preconditions

Do not start a batch until:

- discovery has an approved catalog list or the user gives a clear approved list
- one gold-standard catalog page for the game has already been completed and accepted, or the user explicitly asks this batch to include the first gold-standard page first
- each target is a durable in-game item/location collection or approved UGC exception
- codes and events are excluded from the batch
- temporary season tracks, one-off event rewards, ranked season rewards, gamepasses, badges, servers, developer products, and platform metadata are excluded

Subagents may suggest a possible extra catalog, but they must not create it. The parent keeps scope to the approved page list.

## Workspace

Use the game-first workspace:

```text
tmp/content-workspace/<game-slug>/catalogs/
  batch-todo.md
  <collection-slug>/
    todo.md
    research-notes.md
    final.json
  subagents/
    <collection-slug>-prompt.md
    <collection-slug>-response.md
```

Copy `agents/content/todo-templates/catalog-batch.md` to `batch-todo.md` before spawning agents. Each subagent copies `agents/content/todo-templates/game-catalog.md` to its own `<collection-slug>/todo.md`.

The parent updates `batch-todo.md` and saved prompt/response artifacts. Each subagent updates only its own catalog workspace plus explicitly assigned data/image files.

## Parent Role

The parent agent is the editor, coordinator, and final quality gate.

1. Convert the approved catalog list into a compact batch tracker.
2. Create one detailed prompt per catalog from `references/subagent-prompt.md`.
3. Spawn one subagent per catalog only when subagents are explicitly part of the user request or current workflow.
4. Give each subagent exactly one catalog page and a clear write scope.
5. Require the subagent to stop after the planning gate.
6. Review each plan for data completeness, image quality, section logic, card fields, title promise, route/config needs, and exclusions.
7. Approve, revise, or reject the plan.
8. After build completion, audit the returned files and verification evidence before marking the catalog done.
9. Keep `batch-todo.md` updated as each catalog moves stages.

If multi-agent tools are unavailable, run the same workflow sequentially yourself and still keep the per-catalog folders and parent tracker.

## Subagent Rules

Each subagent owns exactly one catalog page. It must not:

- create another catalog page
- widen the collection scope
- add temporary reward-track catalogs
- manually create codes or events data
- edit another catalog's workspace
- edit shared route/config/collector files unless the parent explicitly assigned that shared file ownership
- hide missing data or missing images behind generic copy

For parallel work, avoid shared-file conflicts. Prefer this pattern:

- subagents write page-local `todo.md`, `research-notes.md`, `final.json`
- subagents write or update only their assigned dataset and collection images
- subagents propose shared config or collector changes in notes unless the parent gave them ownership
- parent applies or reconciles shared config changes after review

## Stage Model

Use these stages in `batch-todo.md`:

- `queued`
- `planning`
- `revision needed`
- `plan approved`
- `data/images`
- `content`
- `subagent qa`
- `parent qa`
- `done`
- `blocked`

The parent should not mark a catalog `done` until all verification checks pass.

## Planning Gate

The first subagent response must be a plan, not final content. Require:

- page identity: game, collection, route, code, universe ID
- durable scope decision and excluded surfaces
- source list and source-count confidence
- local dataset state, expected item count, image state, and route/config state
- data action: `ready as-is`, `needs dataset update`, `needs image update`, or `blocked`
- proposed visible title, `seo_title`, and exact title promise
- grouping axis and why it is the strongest in-game grouping
- card fields to show and raw fields to hide
- `description_json`, `description_md`, `how_it_works_md`, FAQ, and `wiki_md` plan
- files the subagent expects to edit
- risks or questions requiring parent approval

Reject plans that are generic, overlap another page, lean on weak images, use temporary rewards as the catalog, or cannot prove data/image readiness.

## Build Gate

After parent approval, tell the subagent exactly what changed in the plan and what it may edit. The subagent should then:

- complete approved data and image updates
- write `final.json`
- run the FLOW pass
- run the final edit gate
- verify JSON shape, item counts, image paths, route/config behavior, rendered sections, card fields, metadata, FAQ, and `wiki_md`
- record verification results in `research-notes.md`
- return a concise completion report with changed files, counts, blockers, and commands/checks run

Do not accept a completion report that only says the content is written. The page is not done until the parent can see evidence that data, images, copy, and render assumptions are clean.

## Parent QA Checklist

Before marking any catalog `done`, check:

- subagent `todo.md` is complete or honestly blocked
- `research-notes.md` explains the collection like a game system, not a schema
- catalog scope still matches the approved list
- source count, local data count, rendered/title count, and image coverage are recorded
- missing or uncertain items/images are fixed, accepted, or blocked
- title promise is delivered by data and copy
- grouping and card fields match actual route behavior
- public copy is evergreen, specific, and not generic
- `description_md` explains the whole collection, not only card sections
- `description_json` notes match rendered section labels
- `wiki_md` is useful on the wiki hub
- JSON parses and field shapes match `wiki_catalog_pages`
- local import/readback and preview/render checks are done when the page is being promoted

If something is missing, send the subagent a focused fix request and keep the stage at `revision needed` or `parent qa`.

## Output

At the end of a batch, return:

- path to `batch-todo.md`
- completed catalogs
- blocked catalogs and why
- shared config/data/image changes that still need integration
- verification summary
- recommended next page family, if any, based on the finished catalog data
