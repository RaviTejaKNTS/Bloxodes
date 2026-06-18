---
name: bloxodes-game-catalog-workflow-runner
description: Run one or many approved Bloxodes game catalog pages with parent review. Use when the user gives approved game catalog ideas, asks to create multiple /wiki/<game>/<collection> pages, wants subagents for catalog research/data/writing, or needs local verification before Browser preview.
---

# Bloxodes Game Catalog Workflow Runner

Use subagents and give each subagent one catalog collection. The same subagent should research, prepare data/images, wait for parent approval, then write `final.json`.

If there are more catalogs than subagent slots, queue the extras. Do not write from the parent role.

The parent owns judgment: approve scope, data readiness, final copy, and verification. The parent should not take over unless the fix is tiny.

## Workspace

```text
tmp/content-workspace/<game-slug>/catalogs/<collection-slug>/
  brief.md
  final.json
```

## Workflow

1. Confirm the approved game, universe ID, and catalog list.
2. Give each subagent exactly one collection.
3. Ask the subagent to use `bloxodes-game-catalog-research` and return `brief.md`.
4. Review source proof, scope, existing Bloxodes coverage, and whether the collection is worth a catalog.
5. If approved, ask the same subagent to use `bloxodes-game-catalog-data` and update data/images plus data notes.
6. Review item count, missing items, useful fields, grouping, image coverage, and route assumptions.
7. If approved, ask the same subagent to use `bloxodes-game-catalog-writing` and create `final.json`.
8. Review final copy and JSON. Send fixes back to the same subagent.
9. Start or reuse localhost with `npm run dev:local`.
10. Run:

```bash
npm run verify:game-catalog-finals -- --base-url http://localhost:<port> --game <game-slug> --final-json-root tmp/content-workspace/<game-slug>/catalogs --collection <collection-slug>
```

Use one `--collection` for each approved catalog.

11. If the verifier passes, open each verified `/wiki/<game-slug>/<collection-slug>` link in the Codex Browser.
12. Return paths, localhost links, blocked catalogs, and remaining risks.

## Parent Checks

- production duplicate check is recorded
- source proof supports the collection and important fields
- item count and title count agree
- image gaps are fixed, accepted, or blocked
- card fields help players compare items
- title follows `All N <Collection> in <Game>`
- paragraphs add context beyond the cards
- no public copy mentions research, datasets, workflow, or page usage
- `final.json` parses
- verifier and Browser preview pass before calling it done
