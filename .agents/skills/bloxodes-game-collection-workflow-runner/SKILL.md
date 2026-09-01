---
name: bloxodes-game-collection-workflow-runner
description: Run one or many approved Bloxodes game collection pages with parent review. Use when the user gives approved game collection ideas, asks to create multiple /wiki/<game>/<collection> pages, wants subagents for collection research, data, images, and writing, or needs local verification before Browser preview.
---

# Bloxodes Game Collection Workflow Runner

This is the parent workflow for one collection or a list of collections.

You are the parent. You judge. You do not take over the writing voice unless the fix is tiny.

## How the work splits

1. A **collection subagent** owns research, data, and images for one collection, and waits at each gate.
2. You approve, refine, or block at research, data, and image gates.
3. A **writing subagent** writes `final.json` after image readiness is approved.
4. You review the final copy, run verification, and preview the local page.

Give each collection subagent one collection only. If you have more collections than open slots, queue the rest. Do not write collections from the parent seat.

If subagents are not available, run the same gates yourself in order: research → data → images → writing. Keep writing as its own pass.

The parent may fix tiny non-content metadata or JSON issues (slug, code, IDs, null fields, broken JSON, wrong `faq_json` key names). Anything about tone, body, structure, FAQ wording, or real claims goes back to the writing subagent. Data and image problems go back to the collection subagent.

## Workspace

```text
tmp/content-workspace/<game-slug>/collections/<collection-slug>/
  brief.md
  final.json
```

## Collection subagent handoff (research → data → images)

Every collection-subagent message should set:

- You own one game collection only.
- Do not run `/bloxodes-game-collection-workflow-runner`.
- Do not spawn other subagents. Do the work yourself with your own tools.
- Start with research, then wait for parent approval at each gate.

Skills by gate:

- Research: `.agents/skills/bloxodes-game-collection-research/SKILL.md` → return `brief.md` only
- Data: `.agents/skills/bloxodes-game-collection-data/SKILL.md` → update dataset and brief data notes
- Images: `.agents/skills/bloxodes-game-collection-images/SKILL.md` → save images, wire paths, update brief image notes

Repeat the no-nested-subagents rule when you send each next gate.

## Writing subagent handoff (after image approval)

After image readiness is approved, start a **new** writing subagent. Do not hand writing back to the research/data/image subagent unless the user says to.

Tell the writing subagent:

- You own one collection only.
- Do not run this workflow runner.
- Do not spawn other subagents.
- Skill: `.agents/skills/bloxodes-game-collection-writing/SKILL.md` — read it fully
- Read the approved `brief.md` first, including data and image readiness notes
- Write only:
  `tmp/content-workspace/<game-slug>/collections/<collection-slug>/final.json`
- After drafting, reread once for simple player voice, concrete usefulness, valid JSON, no prose counts, no source/dataset/workflow/page wording, correct `faq_json` keys (`q` / `a`), and a useful `wiki_md`

Also give the writing subagent:

- game slug and collection slug
- path to `brief.md`
- path for `final.json`
- any parent approval notes (soft facts, accepted image gaps, section label risks)

## Workflow

1. Confirm the approved game, universe ID, and collection list.
2. Give each collection subagent exactly one collection.
3. Research gate: subagent returns `brief.md`.
4. Review source proof, scope, coverage, and whether the collection is worth publishing.
5. Approve, refine, or block.
6. Data gate: same subagent prepares the dataset and updates brief notes.
7. Review item count, missing items, v2 shape, sections, fields, image planning, and route assumptions.
8. Image gate: same subagent gathers and wires images, then updates brief notes.
9. Review image coverage, quality, paths, dataset wiring, and checker result.
10. Writing gate: spawn a writing subagent with `bloxodes-game-collection-writing`.
11. Review `final.json`. Send copy/tone/structure/FAQ fixes to the writing subagent. Send data/image gaps back to the collection subagent.
12. Start or reuse localhost with `npm run dev:managed`.
13. Confirm each collection folder contains `brief.md`, `dataset.json`, `media/`, `final.json`, and `runtime-manifest.json`. Run the managed-development verifier. It checks the workspace dataset, creates and publishes the immutable database/R2 runtime revision and page copy from the manifest, validates the saved dataset pointer and item count, and only then checks the route:

```bash
npm run verify:game-collection-finals -- --base-url http://localhost:<port> --game <game-slug> --final-json-root tmp/content-workspace/<game-slug>/collections --collection <collection-slug>
```

Use one `--collection` for each approved collection.

14. Run the HTML size gate against each verified collection URL:

```bash
npm run audit:html-size -- --url http://localhost:<port>/wiki/<game-slug>/<collection-slug> --fail-on-limit
```

15. If the verifier and size gate pass, open each verified `/wiki/<game-slug>/<collection-slug>` link in the Browser (or fetch/preview the live local route when Browser is unavailable).
16. For large collections with pagination, verify:
- the section dropdown lists all real sections, not only the current page section
- choosing a section on another page opens that page at the correct section anchor
- `/wiki/<game-slug>/<collection-slug>/page/2` returns 200 and has `noindex, follow`
- paginated collection URLs are not listed in `/sitemaps/wiki.xml`
17. Return paths, localhost links, blocked collections, size-gate results, pagination checks, and remaining risks.

## Research checks

Once the research subagent returns `brief.md`, check that:

- source proof is strong and complete
- collection is durable, useful, and source-backed
- item fields are useful for players to compare items
- section plan is clear and useful for players
- section labels are not source-table noise

## Data checks

Once the data subagent updates the brief, check that:

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
- `npm run audit:game-collection-datasets:v2 -- --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json` reports no blocking metadata issue.
- If the data is not ready, send it back to the subagent for fixes.

## Image checks

Once the image subagent updates `brief.md`, check that:

- Images are complete and accurate, or missing images are accepted with a clear reason.
- Images clearly show the item and are not thumbnails, logos, page screenshots, or unrelated art.
- Public image paths exist under the expected folder.
- Dataset image fields are wired to the saved images.
- `npm run check:game-collection-data -- --require-images` passed when images are required.
- If images are not ready, send it back to the subagent for fixes before writing.

## Final checks

Before approving any `final.json`, make sure:

- item count and title count agree
- `display_name` is the short reusable collection label, such as `Units`, `Food Items`, `NPCs`, or `UGC Items`; it must not include counts, game names, colons, or title/SEO phrasing
- writing is simple and easy for everyone to read
- card fields help players compare items
- card/list details follow the presentation contract: description, highlight where natural, chip values for compact numbers, detail values for prose, and no label-stuffed values
- image readiness is approved or missing images were clearly accepted
- sections are useful and labels are easy to understand
- `description_json` keys match actual rendered section labels
- no public copy mentions research, datasets, workflow, or page usage
- no prose copy states an item or collection count (no "all X items", "over X", section counts, totals); the only count allowed is the automated `{count}` token in `title` / `seo_title`
- `wiki_md` is specific and useful: it explains the in-game system in plain words, not a generic list blurb, and carries no item count
- title follows `All {count} <Collection> in <Game>`
- paragraphs add context beyond the cards
- `final.json` parses
- verifier, HTML size gate, pagination checks, and Browser preview look good before calling it done

## Parent checks

- production duplicate check is recorded
- source proof supports the collection and important fields
- item count and title count agree
- `display_name` is present and uses the clean reusable collection label
- image gaps are fixed, accepted, or blocked
- card fields help players compare items
- title follows `All {count} <Collection> in <Game>`
- paragraphs add context beyond the cards
- no prose copy states an item or collection count (only the `{count}` token is allowed)
- `wiki_md` clearly explains the in-game system and is useful, not generic, with no item count
- no public copy mentions research, datasets, workflow, or page usage
- `final.json` parses
- verifier, HTML size gate, pagination checks, and Browser preview pass before calling it done
