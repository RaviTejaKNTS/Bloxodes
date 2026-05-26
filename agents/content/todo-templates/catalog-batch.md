# Game Catalog Batch Todo

Status: not started
Updated: YYYY-MM-DD
Workspace: `tmp/content-workspace/<game-slug>/catalogs/`

## Use With

- Skill: `bloxodes-catalog-batch-runner`
- Per-page skill: `bloxodes-game-catalog-writing`
- Core docs: `agents/content/page-types/game-catalog-pages.md`, `agents/wiki-catalog-workflow.md`
- Edit gates: `agents/content/flow-pass.md`, `agents/content/final-edit.md`

## Setup

- [ ] Confirm the user-approved catalog list and the discovery notes path.
- [ ] Confirm one gold-standard catalog has already been approved, or mark which catalog must be completed first.
- [ ] Confirm all target catalogs are durable in-game collections or approved UGC exceptions.
- [ ] Exclude codes, events, season tracks, one-off event rewards, ranked season rewards, gamepasses, badges, servers, developer products, and platform metadata.
- [ ] Confirm live/local DB environment if checking existing rows.
- [ ] Create one row per approved catalog in the tracker table below.

## Batch Tracker

| Catalog | Code | Route | Owner | Stage | Plan | Data | Images | Content | QA | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `<collection>` | `<game-slug>-<collection>` | `/wiki/<game-slug>/<collection>` | unassigned | queued | no | no | no | no | no |  |

Stages: `queued`, `planning`, `revision needed`, `plan approved`, `data/images`, `content`, `subagent qa`, `parent qa`, `done`, `blocked`.

## Subagent Setup

- [ ] Create a detailed prompt for each catalog from `.agents/skills/bloxodes-catalog-batch-runner/references/subagent-prompt.md`.
- [ ] Give each subagent exactly one catalog page.
- [ ] Define the subagent write scope and any shared-file restrictions.
- [ ] Require the subagent to stop after Phase 1 planning.
- [ ] Save prompts and important responses under `tmp/content-workspace/<game-slug>/catalogs/subagents/`.

## Plan Review Gate

- [ ] Review each plan for durable scope and explicit exclusions.
- [ ] Check source list, source count confidence, local/source/rendered/title counts, and row state.
- [ ] Check data action: `ready as-is`, `needs dataset update`, `needs image update`, or `blocked`.
- [ ] Check image plan rejects weak substitutions.
- [ ] Check proposed title, `seo_title`, and exact title promise.
- [ ] Check grouping axis and card fields are useful for players.
- [ ] Check raw fields to hide, `description_json`, `description_md`, FAQ, and `wiki_md` plan.
- [ ] Approve, request revision, or block each catalog before build work starts.

## Build Review Gate

- [ ] Confirm approved data and image updates are complete.
- [ ] Confirm `final.json` exists and matches `wiki_catalog_pages` fields.
- [ ] Confirm FLOW pass is recorded.
- [ ] Confirm final edit is recorded.
- [ ] Confirm JSON parses and local item count, source count, rendered/title count, and image coverage are recorded.
- [ ] Confirm route/config assumptions or shared-file changes are integrated by the parent.
- [ ] Confirm public copy is evergreen, specific, and not generic.

## Parent QA

- [ ] Check each subagent `todo.md` is complete or honestly blocked.
- [ ] Read each `research-notes.md` and verify it explains the collection as a game system.
- [ ] Verify title promise, grouping, card fields, section labels, image behavior, FAQ, and `wiki_md`.
- [ ] Run or review local import/readback and route preview checks when pages are being promoted.
- [ ] Mark each catalog `done` only after data, images, copy, and render assumptions are clean.
- [ ] Record blocked catalogs and the exact blocker.

## Finish

- [ ] Summarize completed catalogs, blocked catalogs, verification checks, and shared integration work.
- [ ] Recommend the next page family only after the finished catalog data supports it.
