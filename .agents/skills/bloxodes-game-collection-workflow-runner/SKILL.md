---
name: bloxodes-game-collection-workflow-runner
description: Run one or many approved Bloxodes game collection pages with parent review. Use when the user gives approved game collection ideas, asks to create multiple /wiki/<game>/<collection> pages, wants subagents for collection research, data, images, and writing, or needs local verification before Browser preview.
---

# Bloxodes Game Collection Workflow Runner

Use subagents and give each subagent one game collection. The same subagent should research, prepare data, prepare images, and wait for parent approval at each gate. The writing gate is handed to Claude, then the parent resumes final review and verification.

If there are more collections than subagent slots, queue the extras. Do not write from the parent role.

The parent owns judgment: approve scope, data readiness, image readiness, final copy, and verification. The parent should not take over unless the fix is tiny.

## Subagent Handoff

Every subagent message must set the role and exact skill:

- You are the subagent for one game collection only.
- Do not run `/bloxodes-game-collection-workflow-runner`.
- **Do NOT spawn sub-agents or call other agents at any phase. Write and edit all files directly using your own tools.**
- Start with `/bloxodes-game-collection-research`.
- Skill file: `.agents/skills/bloxodes-game-collection-research/SKILL.md`.
- Return `brief.md` only and wait for parent approval.

For later gates, send the same subagent the exact next skill and repeat the no-sub-agents rule in every message:

- Data gate: `/bloxodes-game-collection-data`; skill file `.agents/skills/bloxodes-game-collection-data/SKILL.md`. **Do NOT spawn sub-agents. Write the dataset JSON directly using the Write tool.**
- Image gate: `/bloxodes-game-collection-images`; skill file `.agents/skills/bloxodes-game-collection-images/SKILL.md`. **Do NOT spawn sub-agents. Download images and edit dataset files directly using Bash and Edit/Write tools.**

## Claude Writing Gate

After image readiness is approved, stop using the collection subagent for writing. Use Claude for `final.json`:

```bash
npm run write:game-collection:claude -- --game <game-slug> --collection <collection-slug>
```

This writes a Claude handoff prompt to:

```text
tmp/content-workspace/<game-slug>/collections/<collection-slug>/claude-writing-prompt.md
```

If the Claude CLI is available in the current environment, run:

```bash
npm run write:game-collection:claude -- --game <game-slug> --collection <collection-slug> --run
```

The script invokes Claude with the symlinked Claude writing skill at `.claude/skills/bloxodes-game-collection-writing/SKILL.md`, tells Claude to write `final.json`, and requires Claude to reopen and revise its output once for human-friendly voice, concrete usefulness, no generic filler, valid JSON, no prose counts, no public source/dataset/workflow/page wording, correct `faq_json` keys, and useful `wiki_md`.

If the CLI is not available, paste the generated handoff prompt into Claude manually and continue after Claude writes the same `final.json` path. Do not let the previous Codex subagent write the page unless the user explicitly overrides this workflow.

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
3. Ask the subagent to use `/bloxodes-game-collection-research` and return `brief.md`. Subagents will create their workspace.
4. Review source proof, scope, existing Bloxodes coverage, and whether the collection is worth publishing.
5. Provide feedback, approve, or block the collection according to the checks.
6. If approved, ask the same subagent to use `/bloxodes-game-collection-data` and update data notes.
7. Review item count, missing items, dataset metadata, section plan, useful fields, grouping, image field planning, and route assumptions.
8. If approved, ask the same subagent to use `/bloxodes-game-collection-images` and update image notes.
9. Review image coverage, image quality, local paths, dataset wiring, missing images, and checker result.
10. If approved, run `npm run write:game-collection:claude -- --game <game-slug> --collection <collection-slug>` to prepare the Claude handoff, then run it with `--run` when the Claude CLI is available or paste the generated prompt into Claude manually.
11. After Claude writes `final.json`, review final copy and JSON. Send fixes back to Claude using the same handoff prompt context, not to the previous Codex data/image subagent.
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

15. If the verifier and size gate pass, open each verified `/wiki/<game-slug>/<collection-slug>` link in the Codex Browser.
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
- Dataset uses v2 wrapped `{ meta, items[].item, items[].system }`, not a bare array.
- Public game fields live only in `items[].item`; system fields live only in `items[].system`.
- If a real multi-section grouping exists, `items[].system.section`, `items[].system.sortOrder`, `meta.display.groupLabel`, and `meta.display.sectionOrder` are present and match actual rendered labels.
- No public item field is named `collectionSection`, `section`, `sortOrder`, `image`, `slug`, source/verification/raw text, or any other workflow/debug key.
- `npm run check:game-collection-data` passed or the remaining warning is accepted.
- Section field, section counts, and section order are recorded.
- Every item lands in the right section.
- Card fields help players compare items.
- Card summaries are present when the collection needs plain-English item context.
- The dataset has a natural source-backed highlight-style field when the collection supports one, such as availability, status, strength, best use, or recommendation.
- Chip-style fields are used for prices, rarity, tier, duration, cooldown, chance, costs, levels, or important short numbers.
- Detail fields are complete prose when the value is a sentence; semicolon prose is not being turned into fake lists.
- Public fields are consistent across rows, with missing source-backed values left empty/null instead of dropping the field.
- Values do not repeat their labels, such as `Type: Standard boost` inside the `type` value.
- Hidden/source/dev fields are absent from public item data and not exposed as card fields.
- Image need and image field are recorded for the next step.
- The route renderer/config can show the sections, fields, planned image field, and item count.
- `npm run audit:game-collection-datasets:v2 -- --game <game-slug> --collection <collection-slug>` reports no blocking metadata issue.
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
- Check if `display_name` is the short reusable collection label, such as `Units`, `Food Items`, `NPCs`, or `UGC Items`; it must not include counts, game names, colons, or title/SEO phrasing.
- All the writing is simple and easy for everyone to read.
- Check if card fields help players compare items.
- Check if card/list details follow the new presentation contract: description, highlight where natural, chip values for compact numbers, detail values for prose, and no label-stuffed values.
- Check if image readiness is approved or missing images were clearly accepted.
- Check if sections are useful and labels are easy to understand.
- Check if `description_json` keys match actual rendered section labels.
- No public copy mentions research, datasets, workflow, or page usage.
- No prose copy states an item or collection count (no "all X items", "over X", section counts, totals). The only count allowed is the automated `{count}` token in `title`/`seo_title`.
- `wiki_md` is specific and useful: it explains the in-game system in plain words (what it is, how a player gets/uses it, why it matters), not a generic "this collection lists the items" blurb, and carries no item count.
- Check if the title follows the pattern `All {count} <Collection> in <Game>`.
- Check if the paragraphs add context beyond the cards.
- Check if `final.json` parses.
- Check if the verifier, HTML size gate, pagination checks, and Browser preview look good before calling it done.

## Parent Checks

- production duplicate check is recorded
- source proof supports the collection and important fields
- item count and title count agree
- `display_name` is present and uses the clean reusable collection label, not a slug/title-derived phrase
- image gaps are fixed, accepted, or blocked
- card fields help players compare items
- title follows `All {count} <Collection> in <Game>`
- paragraphs add context beyond the cards
- no prose copy states an item or collection count (only the `{count}` token is allowed)
- `wiki_md` clearly explains the in-game system and is useful, not generic, with no item count
- no public copy mentions research, datasets, workflow, or page usage
- `final.json` parses
- verifier, HTML size gate, pagination checks, and Browser preview pass before calling it done
