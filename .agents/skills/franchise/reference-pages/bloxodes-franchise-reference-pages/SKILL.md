---
name: bloxodes-franchise-reference-pages
description: Create or update an approved non-Roblox map, standalone checklist, quiz or catalog using shared tables, plain templates and managed-development verification. In T3 Code each stage goes to its assigned model (Luna for research, map and catalog data and a fact check of every question, task and value; Haiku 5.5 for reviews and writing).
---

# Bloxodes Franchise Reference Pages

You run one approved map, quiz, checklist or catalog from research to GitHub-verified QA. A subagent researches, waits for parent approval, then prepares the data and writes `final.json`. You review each stage. You're done when the exact page passes GitHub QA or the real blocker is reported.

**Before you start:** read `bloxodes-docs/content/franchise.md` (identity, routes, tables and the rules every franchise page follows) and `bloxodes-docs/content/page-standards.md` (titles, headings, depth, images and layout). Public copy and writer briefs follow `.agents/skills/bloxodes-voice/SKILL.md`.

For these page types in particular:

- Same sections, sidebar, FAQ, image slots and related links as the Roblox page of the same type.
- No instructions about using the page, ticks, filters or quiz controls.
- Quizzes, checklists, catalogs and maps use the owning game's cover (`games.cover_image`) and square art (`games.hero_image`) for cards and social previews, so confirm the game row has both. Maps also need credited map artwork. Publishing fails if a required image is missing.
- Keep late-story answers out of titles, meta descriptions, intros and quiz openings.

**In T3 Code**, follow the "Franchise reference pages" stage table in `.agents/skills/bloxodes-model-routing/SKILL.md`. Luna researches, builds map/catalog data and fact-checks every question, task and value. Haiku 5.5 reviews research/data and writes. Outside T3 Code, follow the handoff below.

## Subagent handoff

Every message to the subagent sets its role and the exact skill.

First message:

- You are the subagent for one franchise reference page only.
- Do not run the parent workflow or create or call other subagents.
- Read `.agents/skills/bloxodes-franchise-reference-pages/SKILL.md` and only the matching research/writing reference: [quiz](references/quiz.md), [checklist](references/checklist.md), [catalog](references/catalog.md) or [map](references/map.md).
- Return `brief.md` only and wait for parent approval.

After you approve the brief:

- Continue with the matching writing sections and [the payload contract](references/payloads.md).
- Read `.agents/skills/bloxodes-voice/SKILL.md` and the page-type examples.
- Create `final.json` for the approved brief only. Map and catalog data need their own approved data pass before writing.

## Workflow

1. Confirm the exact game identity, namespace, route, approved page idea and scope. Check published pages and drafts for overlap.
2. Ask for research and `brief.md` in `tmp/content-workspace/<namespace>/<game-slug>/<page-type>/<page-slug>/`, keeping any supplied workspace override.
3. Review sources, full supported coverage, title and heading plan, scope, image sources and the relevant page-type research checks. Approve, refine or block. A source review doesn't mean browser QA passed.
4. For maps and catalogs, approve the data before writing. For quizzes, approve the stable fact pool and difficulty plan. For checklists, approve full completion requirements and any explicit user exception.
5. Ask for `final.json`. Review the real copy and data, not the subagent's summary, using the checks below.
6. Keep approved artifacts and sources in the ignored workspace. Prepare the exact selected `game-pages` operation and namespace, or a reviewed immutable bundle, per `bloxodes-docs/operations/release.md`. Don't run the publisher, checks or a preview locally.
7. Run `Managed content QA` on GitHub. It validates and stages the exact payload in development, builds the site and renders desktop/mobile routes. The underlying publisher is `npm run publish:game-pages -- --namespace <namespace> --file <reviewed.json>`, rollback-only by default; CI applies development changes with `--apply`.
8. Review the reports for canonical, metadata, headings, images, layout parity and the selected saved data. Run page-specific map, quiz, checklist or catalog behavior checks there. The receipt must match selected bytes and source SHA.
9. Return exact artifact paths, successful GitHub run/report links, blockers and remaining risks. Production publication needs explicit authorization; selected publication never copies user progress.

Checklist updates include the page's stable UUID and complete retained task inventory. Preserve task UUIDs and keys. QA stages a unique temporary board, compares every reviewed page/task field and publisher default, then tests desktop/mobile ticks, reload, unticking and account saving. A successful hash-bound receipt is required before production publication. See `bloxodes-docs/operations/release.md#managed-development-content-qa`.

## Parent checks

Facts and data:

- Existing coverage and registry ownership are checked by namespace and exact game. No row or route changes owner.
- Every important claim has evidence for its exact edition, platform, mode and release generation. Spoilers follow the approved boundary.
- **Quiz:** every question has one stable correct answer, four plausible options of similar specificity and difficulty that fits the fact. No answer-length giveaways or `explanation` fields. All three difficulty pools are non-empty. Read back `quiz_data` and test the quiz and account history on GitHub.
- **Checklist:** follow the scope, full required set, single-leaf alternatives and stable task rules in the checklist reference. Never infer in-game 100% from an achievement roster. Verify saved and local progress against the reviewed inventory.
- **Catalog:** complete approved rows, useful columns and exact values. No source/debug fields or opaque nested data in public cells. Read back `catalog_data` and test any registered interactions.
- **Map:** exact measured pins, credited artwork, safe links and verified coordinates. Existing GTA `gta-layered` and `gta5` engines and frozen snapshots remain unchanged. A snapshot change requires a reviewed migration.

Copy, checked against `.agents/skills/bloxodes-voice/SKILL.md`:

- The page copy (intro and description) opens with something a player wants, in a player's voice: simple English, calm and a bit playful, light wit only on real facts. No template openings, research voice, hype words or AI filler.
- Questions, options, tasks, marker labels and catalog cells stay plain and exact.
- No fact repeated between intro, body and FAQ. Headings fully name their topics and use varied phrasing.
- No page-use instructions. Tool pages are the only page type that explains the tool.

Verification:

- Required credited images render, including the social image; `og:image` isn't the default Bloxodes logo.
- Layout and sections match the Roblox page of this type. Missing FAQ, image, sidebar or related-link support is an implementation blocker, not a reason to omit the section.
- GitHub verification and desktop/mobile screenshot review pass. Don't claim a check passed without its report.
