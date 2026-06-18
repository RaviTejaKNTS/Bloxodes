---
name: bloxodes-catalog-batch-runner
description: Orchestrate multiple approved Bloxodes game catalog pages with one worker per catalog after discovery or a user-approved catalog list. Use for batching durable game catalog research, datasets, images, final.json files, and parent QA.
---

# Bloxodes Catalog Batch Runner

Read `agents/content-writing/agents.md` first.

Use this only when the user wants multiple approved game catalog pages completed together. Each page still follows `bloxodes-game-catalog-writing`.

## Preconditions

- The game identity is known.
- The user approved the catalog list, or `bloxodes-wiki-catalog-suggestions` produced a clear catalog list.
- Each target is a durable in-game collection or approved UGC exception.
- Codes, events, gamepasses, badges, developer products, servers, temporary reward tracks, and raw Roblox media are excluded.
- Production duplicate checks are done before workers create new pages.

## Workspace

```text
tmp/content-workspace/<game-slug>/catalogs/
  batch-notes.md
  <collection-slug>/
    research-notes.md
    final.json
  subagents/
    <collection-slug>-prompt.md
    <collection-slug>-response.md
```

## Parent Workflow

1. Create `batch-notes.md` with the approved catalog list, status, and shared game facts.
2. Give each worker exactly one catalog.
3. Ask each worker to research first, then stop with a plan if data/images are missing or the card shape is unclear.
4. Review scope, source count, item count, missing items, image coverage, card fields, grouping, and title.
5. Approve data/image work or request fixes.
6. Review final `research-notes.md` and `final.json` for each page.
7. Import/verify only after the page files are clean.

If subagents are not available, run the same process sequentially.

## Worker Prompt

Use `references/subagent-prompt.md` as the starting point for each worker prompt.

## Parent QA

Before marking a catalog done, confirm:

- the scope matches the approved list
- production duplicate check is recorded
- sources support the item list and important fields
- local count, title count, rendered count, and image coverage are recorded
- missing items/images are fixed, accepted, or blocked
- cards show useful player-facing facts
- copy is simple and specific
- JSON parses
- route/import assumptions are verified when publishing
- local preview is clean before production import
- production promotion uses the normal controlled seed, upsert, or migration path

## Final Batch Output

Return:

- batch notes path
- completed catalogs
- blocked catalogs and why
- changed data/image files
- import and verification status
