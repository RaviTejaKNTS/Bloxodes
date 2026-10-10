---
name: bloxodes-model-routing
description: How the T3 Code orchestrator splits a Bloxodes content run between two models. Luna builds evidence, data and facts and does the editorial and fact review. Haiku 5.5 reviews Luna's work, writes and does the one revision. Read it before running any bloxodes-*-workflow-runner stage by stage in T3 Code. Holds the shared rules and the stage tables for codes, quizzes, checklists, events, tools, catalog, franchise and GTA wiki hubs and collections, shared game reference, codes and tool pages, and the Roblox and franchise collection refreshes.
---

# Bloxodes Model Routing

Read this when the owner runs a content runner inside T3 Code and you have the T3 `delegate_task` tool. You're the orchestrator. Each stage goes to a fresh child agent on its assigned model, and you review every handoff. You're done when each page has an approved final file in its run folder, or a clear blocker, and you've reported back to the owner.

Outside T3 Code, runners keep their own flow. That includes the homelab and scheduled automation and the code-controlled article pipeline, which keep their own model settings.

## The split

Luna builds anything that's evidence, data or facts. Haiku 5.5 checks Luna's work and writes. Luna checks Haiku's writing. No model reviews its own work.

| Model | Provider instance | Model ID | Options | Does |
| --- | --- | --- | --- | --- |
| Luna | `codex` | `gpt-6-luna` | `reasoningEffort: max` | Suggestions, research, source checks, data, data deltas, images, editorial and fact review |
| Haiku 5.5 | `claudeAgent` | `claude-haiku-5-5` | `effort: xhigh` | Research, data and image reviews, writing, the one revision |

## Which page has your stage table

| Runner | Stage table |
| --- | --- |
| `bloxodes-article-workflow-runner` | `.agents/skills/bloxodes-article-workflow-runner/references/t3-model-routing.md` |
| `bloxodes-game-collection-workflow-runner`, `bloxodes-wiki-workflow-runner` | `.agents/skills/bloxodes-game-collection-workflow-runner/references/t3-model-routing.md` |
| `bloxodes-code-workflow-runner` | [Codes](#codes) |
| `bloxodes-quiz-workflow-runner` | [Quizzes](#quizzes) |
| `bloxodes-checklist-workflow-runner` | [Checklists](#checklists) |
| `bloxodes-events-workflow-runner` | [Events](#events) |
| `bloxodes-tool-workflow-runner` | [Tools](#tools) |
| `bloxodes-catalog-workflow-runner` | [Catalog](#catalog) |
| `bloxodes-franchise-wiki-workflow-runner`, `bloxodes-gta-wiki-workflow-runner` | [Franchise wiki hubs](#franchise-wiki-hubs) |
| `bloxodes-franchise-game-collection-workflow-runner`, `bloxodes-gta-game-collection-workflow-runner` | [Franchise collections](#franchise-collections) |
| `bloxodes-games-reference-pages` | [Shared game reference pages](#shared-game-reference-pages) |
| `bloxodes-game-collection-refresh` | [Roblox collection refresh](#roblox-collection-refresh) |
| `bloxodes-franchise-game-collection-refresh`, `bloxodes-gta-game-collection-refresh` | [Franchise collection refresh](#franchise-collection-refresh) |
| `bloxodes-games-code-pages` | [Shared game codes pages](#shared-game-codes-pages) |
| `bloxodes-games-tool-pages` | [Shared game tool pages](#shared-game-tool-pages) |

Articles and Roblox wiki and collections follow their own reference pages. The rules below match them and apply to every other runner.

## Handoffs

- Every stage is a new `delegate_task` call with its own `clientRequestId`, like `<run-id>-<page-slug>-writing-r1`. Keep it stable across retries of that call, and keep each `taskId`.
- Don't run a stage yourself, and don't hand two stages to one child. Each stage reads the previous stage's files.
- Children never start sub-agents.
- If a model ID stops resolving, check `orchestrator_capabilities`. Never swap in another model on your own. Ask the owner.
- Pages can run in parallel, one stage at a time per page. Two runs never work on the same game at once.

## Reviews and corrections

- Every review returns `completed`, `needs_revision` or `blocked`, with concrete, quoted findings. Reviews never edit artifacts.
- On `needs_revision`, send the findings to a new task on the stage's own model: research, data and images go to Luna, writing goes to Haiku. One correction per stage, then one more review. If it still fails, fix small prose yourself or report the open findings to the owner.
- A data, image or fact gap found in editorial review goes back to the Luna stage that owns it, then its Haiku review, then writing.
- The writer's draft stays unchanged after review. The revision writes the final file.
- `blocked` stops only that page. Report the stage and the exact blocker. Don't pad around a missing central fact.
- Editorial reviews use the six checks in `.agents/skills/bloxodes-article-writing/references/editorial-review.md` as their format, plus the runner's own checks named in its table below.

## Workspace

Create one run folder per page inside the checkout before the first stage, at `tmp/<runner>-runs/<run-id>/...`. Each table below gives the exact path.

- Don't use `tmp/content-workspace`. It's a symlink outside the checkout, and child agents can't write through it. The same goes for the other symlinked shared folders (`tmp/game-collection-runs`, `tmp/game-plans`, `tmp/content-claims`).
- When a stage skill names a `tmp/content-workspace/...` path, tell the child to use the run folder instead.
- Children work only in their own page folder. They never read another run, `tmp/content-workspace` or `tmp/model-test`.
- `stage-log.md` gets one entry per stage: model, start and end, result and problems.
- For a game-scoped run, take the claim first: `npm run claim:shared-content -- --game <game-slug>`. Release it with `--release` when the run ends, blocked or not. The global catalog has no game and needs no claim.

## Sources and images

- **Conflicting sources.** Keep the better-supported value, or a range for numbers. Record every competing value with its source in the brief. Leave a field empty only when no reliable source gives a value. The full rule is "Conflicting sources" in `.agents/skills/bloxodes-game-collection-data/SKILL.md`.
- **Images are best effort.** They never block a page. Image reviews accept every reasonably searched miss, with the item and the reason.
- If a child's shell can't reach an image host, Luna records the exact image URL and page with `download: blocked` and moves on. You download those files from the main shell before image review.

## What every child brief says

- The stage, the page identity (game name, universe ID or namespace, slugs) and the runner it belongs to.
- The exact folder, the files to write and the previous stage's files to read.
- The skills to read in full first. Writing and editorial review always include `.agents/skills/bloxodes-voice/SKILL.md` and the matching section of `.agents/skills/bloxodes-voice/references/examples.md`.
- Any findings to fix.
- Boundaries: stay in the folder; read-only web research is fine; no database writes, Supabase or R2 uploads, imports, publishing, queue or claim commands, GitHub actions, commits, edits to tracked repo files, builds, tests, checks or previews; no sub-agents; never ask for permission escalation, and log anything blocked in `stage-log.md`.
- What to return: the decision or output paths, a short summary and any problems.

## Your review

You own the content and SEO review in `CLAUDE.md`. After each stage, read the actual files, not just the child's summary. The runner's "Parent checks" (or its gates) are your checklist too. After the revision, review the final as an editor against the voice guide and the brief. Fix small prose issues yourself. Send a gap back only when it needs new research, data or images.

## After the finals

The run stops at approved final files in the run folder. Staging a batch under `content/releases/<batch>/`, `Managed content QA` on GitHub, managed-development publishing, refresh scripts and production release each need the owner's explicit go-ahead. Then follow the runner's own workflow steps from staging onward.

Report per page: status, the stage reached, each review's main findings, what you changed, and the folder path. Add item, question, task or image counts when the page has them.

## The standard flow

Most runners use these five stages. The tables below name the skills, the folder and what each review checks.

| # | Stage | Model | Output |
| --- | --- | --- | --- |
| 1 | Research | Luna | `brief.md` |
| 2 | Research review | Haiku | `research-review.md` |
| 3 | Writing | Haiku | `draft-final.json` |
| 4 | Editorial review | Luna | `editorial-review.md` |
| 5 | Revision | Haiku | `final.json` |

## Codes

`bloxodes-code-workflow-runner`. Folder: `tmp/codes-runs/<run-id>/<game-slug>/`.

| # | Stage | Model | Output |
| --- | --- | --- | --- |
| 1 | Source check | Luna | `brief.md` |
| 2 | Payload writing | Haiku | `draft-payload.json` |
| 3 | Source and evergreen review | Luna | `payload-review.md` |
| 4 | Revision | Haiku | `payload.json` |

1. **Source check** (Luna). Follow steps 1 to 5 of the Workflow in `.agents/skills/bloxodes-code-writing/SKILL.md`: the existing `code_pages` row and live page, the exact experience and Roblox link, whether the game has a real codes system, and the RobloxDen and Beebom pages. Add the verified redeem steps with real button and menu names, the kinds of rewards, and where the game announces codes, each with its source. No real codes system means `blocked`.
2. **Payload writing** (Haiku). Follow the code-writing skill's copy rules, field jobs and output shape, plus the "Codes pages" voice examples. First check the brief gives an exact game, a real codes system and verified redeem steps. If it doesn't, return `blocked` with what's missing instead of guessing.
3. **Source and evergreen review** (Luna). Re-open the source pages. Check the code-writing skill's hard rules (slug, `roblox_link`, source order, `seoTitle`, no `codes` array), the evergreen rules (no code names, counts, dates, or words like "latest" and "updated daily"), redeem steps that match the verified UI, and the copy checks in step 3 of the runner's Workflow.
4. **Revision** (Haiku). Writes `payload.json` from the draft and findings.

Never write code rows. Children never run `upsert:code-page` or `refresh:codes`. Code rows come from the scheduled `Daily Codes Refresh` job.

## Quizzes

`bloxodes-quiz-workflow-runner`. Folder: `tmp/quiz-runs/<run-id>/<quiz-code>/`. The standard flow.

- **Research** follows `.agents/skills/bloxodes-quiz-research/SKILL.md`.
- **Research review** checks source proof, topic coverage, the easy, medium and hard plan, facts to avoid, and whether there are enough stable facts for every level.
- **Writing** follows `.agents/skills/bloxodes-quiz-writing/SKILL.md` and the "Quizzes" voice examples.
- **Editorial review** fact-checks every question against the brief's sources: the correct option is right, no wrong option is also true, and the fact won't go stale. Then the runner's "Parent checks".

## Checklists

`bloxodes-checklist-workflow-runner`. Folder: `tmp/checklist-runs/<run-id>/<checklist-slug>/`. The standard flow.

- **Research** follows `.agents/skills/bloxodes-checklist-research/SKILL.md`.
- **Research review** checks the brief against step 3 of the runner's Workflow: full completion requirements or a recorded user exception, thresholds, exclusions, alternative paths as one `A or B` leaf, sections within one board, existing coverage and source proof.
- **Writing** follows `.agents/skills/bloxodes-checklist-writing/SKILL.md` and the "Checklists" voice examples.
- **Editorial review** fact-checks every task and threshold against the brief's sources, confirms nothing required for 100% is missing, and checks section codes and `A or B` leaves. Then the runner's "Parent checks".

## Events

`bloxodes-events-workflow-runner`. Folder: `tmp/events-runs/<run-id>/<game-slug>/`. The standard flow.

- **Research** follows `.agents/skills/bloxodes-events-research/SKILL.md`.
- **Research review** checks that the event data source is good enough and that nothing relies on manual timeline rows.
- **Writing** follows `.agents/skills/bloxodes-events-writing/SKILL.md` and the "Events pages" voice examples.
- **Editorial review** checks step 5 of the runner's Workflow: no stale dates, current-event claims or invented timeline facts, every fact matching the brief, and the voice checks.

## Tools

`bloxodes-tool-workflow-runner`. Folder: `tmp/tool-runs/<run-id>/<tool-code>/`. The standard flow.

- **Research** follows `.agents/skills/bloxodes-tool-research/SKILL.md`.
- **Research review** checks that it's a real interactive tool, with clear inputs and outputs, a sourced formula or data source, and stated assumptions, limits and edge cases.
- **Writing** follows `.agents/skills/bloxodes-tool-writing/SKILL.md` and the "Tool pages" voice examples.
- **Editorial review** checks the formulas and assumptions against the brief's sources. Work a few sample inputs by hand, including an edge case, and confirm the copy's worked examples and limits match. Then step 5 of the runner's Workflow.

## Catalog

`bloxodes-catalog-workflow-runner`. Folder: `tmp/catalog-runs/<run-id>/<catalog-code>/`. The standard flow. No claim, since the page is global.

- **Research** follows `.agents/skills/bloxodes-catalog-research/SKILL.md`.
- **Research review** checks the production duplicate check, data state and source strength, item count, useful fields and image support.
- **Writing** follows `.agents/skills/bloxodes-catalog-writing/SKILL.md` and the "Catalog pages" voice examples.
- **Editorial review** checks the runner's "Parent checks", including the SEO list. Rendered metadata and headings are checked later in GitHub QA.

## Franchise wiki hubs

`bloxodes-franchise-wiki-workflow-runner` and the GTA wrapper `bloxodes-gta-wiki-workflow-runner`. Folder: `tmp/franchise-runs/<run-id>/<namespace>/<game-slug>/wiki/<game-slug>/`, which makes `tmp/franchise-runs/<run-id>/<namespace>` the workspace root the franchise skills ask for.

Before the first stage, resolve the runner's "Required context" record yourself. GTA uses the fixed context in its wrapper.

| # | Stage | Model | Output |
| --- | --- | --- | --- |
| 0 | Suggestions, only without an approved title list | Luna | `suggestions.md` |
| 1 | Research | Luna | `brief.md` |
| 2 | Research review | Haiku | `research-review.md` |
| 3 | Writing | Haiku | `draft-game.json`, `draft-final.json` |
| 4 | Editorial review | Luna | `editorial-review.md` |
| 5 | Revision | Haiku | `game.json`, `final.json` |

- **Suggestions** follow `.agents/skills/bloxodes-franchise-wiki-suggestions/SKILL.md`. The owner approves the title allowlist before research.
- **Research** follows `.agents/skills/bloxodes-franchise-wiki-research/SKILL.md`, or `bloxodes-gta-wiki-research` for GTA. The brief also records the identity values `game.json` needs (developer, publisher, official URL, release dates, platforms, status) and source artwork for its image roles, each with a source.
- **Research review** checks the approval list in step 5 of the runner's Workflow: identity, release status, scope boundary, source proof, the controls decision, related pages and plain player-language facts for the writer.
- **Writing** follows `.agents/skills/bloxodes-franchise-wiki-writing/SKILL.md`, or `bloxodes-gta-wiki-writing` for GTA, plus the "Wiki hubs" voice examples. `game.json` identity values come from the brief unchanged.
- **Editorial review** checks the runner's "Parent checks", `game.json` against the brief, and the no-future-promise rule. For GTA, add the wrapper's mode boundary, the `gta-6` confirmed-facts rule and two distinct artwork roles.
- Hosted media sync (`sync:gta-wiki-media`) and `publish:game-pages` belong to you after the owner's go-ahead.

## Franchise collections

`bloxodes-franchise-game-collection-workflow-runner` and the GTA wrapper `bloxodes-gta-game-collection-workflow-runner`. Folder: `tmp/franchise-runs/<run-id>/<namespace>/<game-slug>/collections/<collection-slug>/`.

| # | Stage | Model | Output |
| --- | --- | --- | --- |
| 0 | Suggestions, only without an approved collection list | Luna | `suggestions.md` |
| 1 | Research | Luna | `brief.md` |
| 2 | Research review | Haiku | `research-review.md` |
| 3 | Data | Luna | `dataset.json`, `runtime-manifest.json`, data readiness in `brief.md` |
| 4 | Data review | Haiku | `data-review.md` |
| 5 | Images | Luna | `media/`, `images.json`, image readiness in `brief.md` |
| 6 | Image review | Haiku | `image-review.md` |
| 7 | Writing | Haiku | `draft-final.json` |
| 8 | Editorial review | Luna | `editorial-review.md` |
| 9 | Revision | Haiku | `final.json` |

- Use the franchise skills (`bloxodes-franchise-game-collection-suggestions`, `-research`, `-data`, `-images`, `-writing`), or the `bloxodes-gta-game-collection-*` skills for GTA. Writing adds the "Game collections" voice examples.
- **Suggestions** stop for the owner's approved collection allowlist before research.
- Each review uses the runner's matching gate: "Research gate", "Data gate", "Image gate" and, for editorial review, "Writing gate". The editorial review also checks every useful number and pick against `dataset.json`.
- Audits, checkers and runtime-sync dry plans named in the data and image skills run in GitHub QA, not in the child. Reviews mark them pending.
- When a run has a hub and collections, write the collections first so the hub can link to the ones that passed. Publication order stays identity, wiki, then collections.

## Shared game reference pages

`bloxodes-games-reference-pages`, for non-Roblox maps, standalone checklists, quizzes and catalogs. Folder: `tmp/reference-runs/<run-id>/<namespace>/<page-slug>/`.

| # | Stage | Model | Output |
| --- | --- | --- | --- |
| 1 | Research | Luna | `brief.md` |
| 2 | Research review | Haiku | `research-review.md` |
| 3 | Data, maps and catalogs only | Luna | `data.json` |
| 4 | Data review, maps and catalogs only | Haiku | `data-review.md` |
| 5 | Writing | Haiku | `draft-payload.json` |
| 6 | Editorial review | Luna | `editorial-review.md` |
| 7 | Revision | Haiku | `payload.json` |

- **Research** follows the skill and `dev-docs/pipelines/content.md`: source proof, the roster, verified map coordinates and artwork attribution, sourced quiz facts, or the full completion scope for a checklist.
- **Data** builds `map_data` or `catalog_data` from the brief, following `references/payloads.md`. Coordinates come from verified map sources, never from prose. Keep stable IDs on updates.
- **Data review** checks rows and markers against the brief's sources and the payload contract.
- **Writing** builds the full payload: page copy for every type, plus questions for quizzes and sections and tasks for checklists. Map and catalog data is copied from `data.json` unchanged.
- **Editorial review** fact-checks every quiz question and answer, every checklist task and threshold, and every carried-over marker and catalog value against the brief, then the voice and the payload contract. Checklists also get the checks in the Checklists section above.

## Roblox collection refresh

`bloxodes-game-collection-refresh`. Folder: `tmp/refresh-runs/<run-id>/<game-slug>/collections/<collection-slug>/`.

| # | Stage | Model | Output |
| --- | --- | --- | --- |
| 1 | Quick check and data delta | Luna | `quick-check.md`; on a data or page-type update, the edited `dataset.json` and `runtime-manifest.json` plus the maintenance note |
| 2 | Delta review, only after a data or page-type update | Haiku | `delta-review.md` |
| 3 | Images, only for new or changed rows or image gaps | Luna | `media/`, wired image fields |
| 4 | Image review | Haiku | `image-review.md` |

- **Quick check** follows the refresh skill's "Quick-check gate" and returns one result: Unchanged, Data update, Image update, Page-type update or Blocked. Export with `--output-root tmp/refresh-runs/<run-id>/<game-slug>/collections`. If the child can't reach the database, it logs that and you run the export from the main shell.
- **Unchanged** stops the collection after stage 1. Read the quick-check evidence yourself.
- **Delta review** checks that every changed row is source-backed, unrelated rows are untouched, conflicting values follow the rule above and the v2 shape holds.
- **Images** follow the refresh skill's "Adding or replacing images". Image review uses the Roblox collection runner's "Image checks".
- Refresh never writes `final.json` or page copy. Report copy or metadata follow-ups instead. Run quick checks for several collections in parallel, one child per collection.

## Franchise collection refresh

`bloxodes-franchise-game-collection-refresh` and its GTA wrapper. Folder: `tmp/refresh-runs/<run-id>/<namespace>/<game-slug>/collections/<collection-slug>/`.

Same four stages as the Roblox collection refresh: quick check and data delta (Luna), delta review only after a data or page-type update (Haiku), images only for new or changed rows or image gaps (Luna), image review (Haiku). Each stage follows the franchise refresh skill's own gates and the context's export command. Unchanged stops after stage 1.

## Shared game codes pages

`bloxodes-games-code-pages`. Folder: `tmp/codes-runs/<run-id>/<namespace>/<game-slug>/`.

| # | Stage | Model | Output |
| --- | --- | --- | --- |
| 1 | Source check: redemption steps, announcements and code rows | Luna | `brief.md`, `code-rows.json` |
| 2 | Page copy writing | Haiku | `draft-payload.json` |
| 3 | Source and evergreen review | Luna | `payload-review.md` |
| 4 | Revision | Haiku | `payload.json` |

- Code rows are Luna's data. Haiku writes only the long-lived page fields and never edits code rows.
- The review checks evergreen copy (no code names or counts in prose), the status rules (missing from a source doesn't mean expired) and every source link.

## Shared game tool pages

`bloxodes-games-tool-pages`. Folder: `tmp/tool-runs/<run-id>/<namespace>/<tool-slug>/`.

| # | Stage | Model | Output |
| --- | --- | --- | --- |
| 1 | Research and verified rules | Luna | `brief.md`, `rules.json` |
| 2 | Research review | Haiku | `research-review.md` |
| 3 | Writing | Haiku | `draft-payload.json` |
| 4 | Editorial review | Luna | `editorial-review.md` |
| 5 | Revision | Haiku | `payload.json` |

- `rules_json` values are Luna's data. Haiku never changes them.
- The editorial review works ordinary, zero, invalid and large inputs by hand against the rules, and checks the copy explains the math plainly.

