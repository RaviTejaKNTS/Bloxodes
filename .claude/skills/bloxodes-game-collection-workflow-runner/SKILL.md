---
name: bloxodes-game-collection-workflow-runner
description: Run one or many approved Bloxodes game collection pages with parent review. Use when the user gives approved game collection ideas, asks to create multiple /wiki/<game>/<collection> pages, wants subagents for collection research, data, images, and writing, or needs local verification before browser preview.
---

# Bloxodes Game Collection Workflow Runner

Spawn a subagent (Agent tool, `subagent_type: general-purpose`) and give each subagent one game collection. The same subagent should research, prepare data, prepare images, wait for parent approval at each gate, then write `final.json`. Continue the same subagent across gates with SendMessage so its context carries over.

If there are more collections than you can run at once, queue the extras. You can run subagents in parallel (or with `run_in_background`) up to a sensible limit. Do not write from the parent role.

The parent owns judgment: approve scope, data readiness, image readiness, final copy, and verification. The parent should not take over unless the fix is tiny.

## Subagent Handoff

When you spawn the subagent, set the role and exact skill in the prompt:

- You are the subagent for one game collection only.
- Do not invoke the `bloxodes-game-collection-workflow-runner` skill.
- Do not spawn or call other subagents.
- Invoke the `bloxodes-game-collection-research` skill (Skill tool).
- Return `brief.md` only and stop for parent approval.

For later gates, continue the same subagent with SendMessage and name the exact next skill:

- Data gate: invoke the `bloxodes-game-collection-data` skill.
- Image gate: invoke the `bloxodes-game-collection-images` skill.
- Writing gate: invoke the `bloxodes-game-collection-writing` skill.

## Workspace

For each approved game collection:

```text
tmp/content-workspace/<game-slug>/collections/<collection-slug>/
  brief.md
  final.json
```

## Workflow

1. Confirm the approved game, universe ID, and collection list.
2. Give each subagent exactly one collection.
3. Ask the subagent to use the `bloxodes-game-collection-research` skill and return `brief.md`. Subagents will create their workspace.
4. Review source proof, scope, existing Bloxodes coverage, and whether the collection is worth publishing.
5. Provide feedback, approve, or block the collection according to the checks.
6. If approved, ask the same subagent to use the `bloxodes-game-collection-data` skill and update data notes.
7. Review item count, missing items, section plan, useful fields, grouping, image field planning, and route assumptions.
8. If approved, ask the same subagent to use the `bloxodes-game-collection-images` skill and update image notes.
9. Review image coverage, image quality, local paths, dataset wiring, missing images, and checker result.
10. If approved, ask the same subagent to use the `bloxodes-game-collection-writing` skill and create `final.json`.
11. Review final copy and JSON. Send fixes back to the same subagent.
12. Start or reuse localhost with `npm run dev:local`.
13. Run:

```bash
npm run verify:game-collection-finals -- --base-url http://localhost:<port> --game <game-slug> --final-json-root tmp/content-workspace/<game-slug>/collections --collection <collection-slug>
```

Use one `--collection` for each approved collection.

14. Run the HTML size gate against each verified collection URL:

```bash
npm run audit:html-size -- --url http://localhost:<port>/wiki/<game-slug>/<collection-slug> --fail-on-limit
```

15. If the verifier and size gate pass, open each verified `/wiki/<game-slug>/<collection-slug>` link in the browser preview (Claude-in-Chrome MCP, or the Preview MCP).
16. For large collections with pagination, verify:
- the section dropdown lists all real sections, not only the current page section
- choosing a section on another page opens that page at the correct section anchor
- `/wiki/<game-slug>/<collection-slug>/page/2` returns 200 and has `noindex, follow`
- paginated collection URLs are not listed in `/sitemaps/wiki.xml`
17. Return paths, localhost links, blocked collections, size-gate results, pagination checks, and remaining risks.

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
- `npm run check:game-collection-data` passed or the remaining warning is accepted.
- Section field, section counts, and section order are recorded.
- Every item lands in the right section.
- Card fields help players compare items.
- Card summaries are present when the collection needs plain-English item context.
- Public fields are consistent across rows, with missing source-backed values left empty/null instead of dropping the field.
- Values do not repeat their labels, such as `Type: Standard boost` inside the `type` value.
- Hidden/source fields are not exposed as public card fields.
- Image need and image field are recorded for the next step.
- The route renderer/config can show the sections, fields, planned image field, and item count.
- If the data is not ready, send it back to the subagent for fixes.

## Image Checks

Once the image subagent updates `brief.md`, check that:
- Images are complete and accurate, or missing images are accepted with a clear reason.
- Images clearly show the item and are not thumbnails, logos, page screenshots, or unrelated art.
- Public image paths exist under the expected folder.
- Dataset image fields are wired to the saved images.
- `npm run check:game-collection-data -- --require-images` passed when images are required.
- If images are not ready, send it back to the subagent for fixes before writing.

## Final Checks

Before approving any final.json, make sure all the following are met:
- Check if item count and title count agree.
- All the writing is simple and easy for everyone to read.
- Check if card fields help players compare items.
- Check if card/list details follow the presentation contract: description, highlight where natural, chip values for compact numbers, detail values for prose, and no label-stuffed values.
- Check if image readiness is approved or missing images were clearly accepted.
- Check if sections are useful and labels are easy to understand.
- Check if `description_json` keys match actual rendered section labels.
- No public copy mentions research, datasets, workflow, or page usage.
- Check if the title follows the pattern `All N <Collection> in <Game>`.
- Check if the paragraphs add context beyond the cards.
- Check if `final.json` parses.
- Check if the verifier, HTML size gate, pagination checks, and browser preview look good before calling it done.

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
- verifier, HTML size gate, pagination checks, and browser preview pass before calling it done
