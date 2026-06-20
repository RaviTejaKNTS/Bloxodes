---
name: bloxodes-game-catalog-workflow-runner
description: Run one or many approved Bloxodes game catalog pages with parent review. Use when the user gives approved game catalog ideas, asks to create multiple /wiki/<game>/<collection> pages, wants subagents for catalog research/data/writing, or needs local verification before Browser preview.
---

# Bloxodes Game Catalog Workflow Runner

Use subagents and give each subagent one catalog collection. The same subagent should research, prepare data/images, wait for parent approval, then write `final.json`.

If there are more catalogs than subagent slots, queue the extras. Do not write from the parent role.

The parent owns judgment: approve scope, data readiness, final copy, and verification. The parent should not take over unless the fix is tiny.

## Workspace

For each approved game catalog collection:

```text
tmp/content-workspace/<game-slug>/catalogs/<collection-slug>/
  brief.md
  final.json
```

## Workflow

1. Confirm the approved game, universe ID, and catalog list.
2. Give each subagent exactly one collection.
3. Ask the subagent to use `bloxodes-game-catalog-research` and return `brief.md`. Subagents will create their workspace.
4. Review source proof, scope, existing Bloxodes coverage, and whether the collection is worth a catalog.
5. Provide feedback, approve, or block the collection according to the checks.
6. If approved, ask the same subagent to use `bloxodes-game-catalog-data` and update data/images plus data notes.
7. Review item count, missing items, section plan, useful fields, grouping, image coverage, and route assumptions.
8. If approved, ask the same subagent to use `bloxodes-game-catalog-writing` and create `final.json`.
9. Review final copy and JSON. Send fixes back to the same subagent.
10. Start or reuse localhost with `npm run dev:local`.
11. Run:

```bash
npm run verify:game-catalog-finals -- --base-url http://localhost:<port> --game <game-slug> --final-json-root tmp/content-workspace/<game-slug>/catalogs --collection <collection-slug>
```

Use one `--collection` for each approved catalog.

12. Run the HTML size gate against each verified catalog URL:

```bash
npm run audit:html-size -- --url http://localhost:<port>/wiki/<game-slug>/<collection-slug> --fail-on-limit
```

13. If the verifier and size gate pass, open each verified `/wiki/<game-slug>/<collection-slug>` link in the Codex Browser.
14. For large catalogs with pagination, verify:
- the section dropdown lists all real sections, not only the current page section
- choosing a section on another page opens that page at the correct section anchor
- `/wiki/<game-slug>/<collection-slug>/page/2` returns 200 and has `noindex, follow`
- paginated catalog URLs are not listed in `/sitemaps/wiki.xml`
15. Return paths, localhost links, blocked catalogs, size-gate results, pagination checks, and remaining risks.

## Research Checks

Once the research subagent returns `brief.md`, check that:
- source proof is strong and complete
- collection is durable, useful, and source-backed
- item fields are useful for players to compare items
- section plan is clear and useful for players
- section labels are not source-table noise

## Data Checks

Once the data subagent completes the process and updates the `brief.md`, check that:
- Data is complete, accurate, and matches the approved brief.
- `npm run check:game-catalog-data` passed or the remaining warning is accepted.
- Section field, section counts, and section order are recorded.
- Every item lands in the right section.
- Card fields help players compare items.
- Card summaries are present when the collection needs plain-English item context.
- Hidden/source fields are not exposed as public card fields.
- Images are complete and accurate, or missing images are accepted with a clear reason.
- The route renderer/config can show the sections, fields, images, and item count.
- If the data is not ready, send it back to the subagent for fixes.

## Final Checks

Before approving any final.json, make sure all the following are met:
- Check if item count and title count agree.
- All the writing is simple and easy for everyone to read.
- Check if card fields help players compare items.
- Check if sections are useful and labels are easy to understand.
- Check if `description_json` keys match actual rendered section labels.
- No public copy mentions research, datasets, workflow, or page usage.
- Check if the title follows the pattern `All N <Collection> in <Game>`.
- Check if the paragraphs add context beyond the cards.
- Check if `final.json` parses.
- Check if the verifier, HTML size gate, pagination checks, and Browser preview look good before calling it done.

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
- verifier, HTML size gate, pagination checks, and Browser preview pass before calling it done
