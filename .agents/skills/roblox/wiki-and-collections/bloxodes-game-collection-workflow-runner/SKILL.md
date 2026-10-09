---
name: bloxodes-game-collection-workflow-runner
description: Run one or many approved Bloxodes game collection pages with parent review. Use when the user gives approved game collection ideas, asks to create multiple /wiki/game-slug/collection-slug pages, wants subagents for collection research, data, images, and writing, or needs GitHub verification and browser reports.
---

# Bloxodes Game Collection Workflow Runner

You're the parent for one collection or a list of collections. Subagents do the research, data, images and writing. You judge each gate. You're done when every collection has passed GitHub QA or is clearly blocked, and you've returned the paths, run links and page-type decisions.

You judge. You don't take over the writing voice unless the fix is tiny.

## Useful coverage

Build the most accurate, up-to-date collection the sources support. Combine rows across sources, merge duplicates and leave unresolved values empty or null. Record missing rows, conflicting claims and follow-ups in the brief so the collection can improve later.

A source saying 97 items while listing 98, an incomplete roster, no official confirmation or uncertain update coverage aren't reasons to block on their own. Don't invent facts or claim complete live coverage. Block only when there truly isn't enough supported material for a worthwhile player-facing page.

## How the work splits

1. A **collection subagent** owns research, data and images for one collection, and waits at each gate.
2. You approve, refine or block at the research, data and image gates.
3. A **writing subagent** writes `final.json` after image readiness is approved.
4. You review the final copy, GitHub verification and rendered screenshots.

- Give each collection subagent one collection only. If you have more collections than open slots, queue the rest.
- Don't write collections from the parent seat.
- If subagents aren't available, run the same gates yourself in order: research, then data, then images, then writing. Keep writing as its own pass.

**Who fixes what**

- **You:** tiny non-content metadata or JSON issues (slug, code, IDs, null fields, broken JSON, wrong `faq_json` key names).
- **Writing subagent:** anything about tone, body, structure, FAQ wording or real claims.
- **Collection subagent:** data and image problems.

## Workspace

```text
tmp/content-workspace/<game-slug>/collections/<collection-slug>/
  brief.md
  final.json
```

## Subagent handoffs

Keep handoffs short. The skills hold the stage instructions, and agents use the inherited workspace context and existing artifacts. Don't restate research requirements, add approval criteria, or send hurry-up or READY-or-BLOCKED checkpoint messages.

**Collection subagent.** Send the skill path, game name and collection name. Use the same subagent for each stage, one skill per handoff:

- `.agents/skills/bloxodes-game-collection-research/SKILL.md`
- `.agents/skills/bloxodes-game-collection-data/SKILL.md`
- `.agents/skills/bloxodes-game-collection-images/SKILL.md`

**Writing subagent.** After the image stage, start a new writing subagent. Send:

- `.agents/skills/bloxodes-game-collection-writing/SKILL.md`
- the voice guide, `.agents/skills/bloxodes-voice/SKILL.md`
- the game name and collection name

Record approval notes or specific corrections in the collection brief before sending the next skill handoff.

## Workflow

1. Read the supplied suggestions file and run every `[create]` collection for the game.
2. Give each collection subagent exactly one collection.
3. **Research gate:** the subagent returns `brief.md`.
4. Review source proof, scope, coverage, whether the collection is worth publishing, and the approved `database` versus `collectible` page-type decision.
5. Approve, refine or block.
6. **Data gate:** the same subagent prepares the dataset and updates the brief notes.
7. Review item count, missing items, v2 shape, sections, fields, image planning, route assumptions and `runtime-manifest.json` `collection.pageType`.
8. **Image gate:** the same subagent gathers and wires images, then updates the brief notes.
9. Review image coverage, quality, paths, dataset wiring and the GitHub checker result when available.
10. **Writing gate:** spawn a writing subagent with `bloxodes-game-collection-writing` and `bloxodes-voice`.
11. Review `final.json`. Send copy, tone, structure and FAQ fixes to the writing subagent. Send data and image gaps back to the collection subagent.
12. Confirm the collection folder has `brief.md`, `dataset.json`, `media/`, `final.json` and `runtime-manifest.json`. Prepare the exact selected `roblox-collection` operations with their immutable bundle. Include the approved hub when needed. Don't start local previews or run checks locally.
13. Run `Managed content QA` on GitHub. It validates and publishes the selected development revisions and media, builds the runner preview and records the selected desktop and mobile routes.
14. Review the dataset pointer/count readback, useful rendered fields, image coverage, metadata and screenshots. Page-specific pagination, HTML-size or collectible progress checks also run on GitHub when needed.
    - **Database pages:** verify section navigation and paginated canonical/noindex behavior.
    - **Collectible pages:** verify local and account progress, filters/reset, and that there's no pagination.
15. Return artifact paths, the exact GitHub run and reports, blocked collections and supported page-type decisions. Don't claim a page-specific check passed unless its report exists. Installed CI-mode builders return authored artifacts for GitHub QA before production publication.

## Research checks

When `brief.md` comes back, check that:

- Sources support a useful collection, and unresolved coverage is recorded for later improvement.
- The collection is durable, useful and source-backed.
- Item fields help players compare items.
- The section plan is clear and useful for players, and section labels aren't source-table noise.
- The page type is explicit: finite player-completed goals use `collectible`, reference rosters use `database`.

## Data checks

When the brief's data notes come back, check that:

**Shape**

- The dataset uses the v2 wrapped `{ meta, items[].item, items[].system }`, not a bare array.
- Public game fields live only in `items[].item`. System fields live only in `items[].system`.
- No public item field is named `collectionSection`, `section`, `sortOrder`, `image`, `slug`, source/verification/raw text, or any other workflow or debug key.
- Hidden, source and dev fields are absent from public item data and aren't exposed as card fields.
- `runtime-manifest.json` declares the approved `collection.pageType`, or an existing manifest is explicitly treated as the `database` default.

**Rows and sections**

- Data includes the supported rows and accurate available fields from the brief. Missing rows or values are documented, not treated as a completeness blocker.
- If a real multi-section grouping exists, `items[].system.section`, `items[].system.sortOrder`, `meta.display.groupLabel` and `meta.display.sectionOrder` are present and match the actual rendered labels.
- Section field, section counts and section order are recorded.
- Every item lands in the right section.

**Fields and presentation**

- Card fields help players compare items.
- Card summaries are there when the collection needs plain-English item context.
- There's a natural source-backed highlight-style field when the collection supports one, like availability, status, strength, best use or recommendation.
- Chip-style fields are used for prices, rarity, tier, duration, cooldown, chance, costs, levels or important short numbers.
- Detail fields are complete prose when the value is a sentence. Semicolon prose isn't turned into fake lists.
- Public fields are consistent across rows, with missing source-backed values left empty or null instead of dropping the field.
- Values don't repeat their labels, like `Type: Standard boost` inside the `type` value.
- Public values read plain per `bloxodes-voice`: short and exact, with no research wording like "reportedly" or "unconfirmed."

**Readiness**

- Image need and image field are recorded for the next step.
- The route renderer/config can show the sections, fields, planned image field and item count.
- GitHub data checks passed, or the remaining warning is accepted.
- `npm run audit:game-collection-datasets:v2 -- --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json` reports no blocking metadata issue.

If the data isn't ready, send it back to the subagent for fixes.

## Image checks

When the brief's image notes come back, check that:

- Images are complete and accurate, or missing images are accepted with a clear reason.
- Images clearly show the item, and aren't thumbnails, logos, page screenshots or unrelated art.
- Public image paths exist under the expected folder.
- Dataset image fields are wired to the saved images.
- GitHub image checks passed when images are required.

If images aren't ready, send them back to the subagent for fixes before writing.

## Final checks

Before you approve any `final.json`, and before you call a collection done:

**Facts and data**

- The production duplicate check is recorded.
- Source proof supports the collection and its important fields.
- The page type is recorded and matches the manifest, page row and route renderer.
- Item count and title count agree.
- Image readiness is approved, or image gaps are fixed, accepted or blocked.
- `description_json` keys match the actual rendered section labels.
- Sections are useful and their labels are easy to understand.
- Card fields help players compare items.
- Card and list details follow the presentation contract: a description, a highlight where natural, chip values for compact numbers, detail values for prose, and no label-stuffed values.

**Title and labels**

- The title follows `All {count} <Collection> in <Game>`.
- `display_name` is present and is the short reusable collection label, like `Units`, `Food Items`, `NPCs` or `UGC Items`. No counts, game names, colons or title/SEO phrasing.

**Copy, checked against `.agents/skills/bloxodes-voice/SKILL.md`**

- **Answer first.** `intro_md` opens on the item system and the choice that matters, not on what the page is.
- **Player voice.** Simple and easy for everyone to read, like a player explaining the system to a friend.
- **Complete, not just clean.** The body uses the dataset's real numbers to say what to pick early, mid and late, the best-value options, how the system unlocks and the common mistakes, at least as well as the top-ranking guides. A few short "check the cost" sections is a fail.
- **No templates or research voice.** No stock openings, no "reportedly" or "sources say." No public copy mentions research, datasets, workflow or page usage.
- **No repeats.** Paragraphs add context beyond the cards, and each fact has one home across intro, description, section notes and FAQs.
- **Headings** say what's under them in words a player would search, without one repeated pattern.
- **No counts in prose.** No "all X items," "over X," section counts or totals. The only count allowed is the automated `{count}` token in `title` and `seo_title`.
- `wiki_md` is specific and useful: it explains the in-game system in plain words, isn't a generic list blurb, and carries no item count.

**Checks**

- `final.json` parses.
- Verifier, HTML size gate, pagination checks and the GitHub browser report pass.
- For `collectible`, account/local progress and no-pagination route checks pass instead of database pagination checks.
