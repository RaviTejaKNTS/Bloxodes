---
name: bloxodes-games-reference-pages
description: Create or update an approved non-Roblox map, standalone checklist, quiz or catalog using shared tables, plain templates and managed-development verification.
---

# Shared game reference pages

Read the approved game plan and `dev-docs/pipelines/content.md`. Resolve the registry game UUID, namespace, page slug and scope. Roblox stays on its own workflows and tables. Existing GTA maps keep their registered engines.

Research the exact page and save source proof in an ignored `brief.md`. Verify the facts and any roster before preparing data. Maps need artwork attribution and actual coordinates. Quiz answers need sources. Checklist objectives must describe actions a player can complete. Catalog fields must fit the specific reference.

For standalone checklists, follow `dev-docs/pipelines/content.md#standalone-checklist-scope`. Normally maintain one standalone verified 100% completion checklist page per game. Check published pages and drafts, then reuse the game's existing checklist. Record its supported edition or mode, full requirements, exclusions and alternatives in one board with sections. Additional pages or preparation lists, beginner milestones and routines require an explicit user exception in the plan and brief. Defer an unverified completion scope. Preserve collectible collection trackers without claiming they establish in-game 100%.

Use one explicit `A or B` leaf for interchangeable paths, with verified criteria in its description. The board counts every three-level leaf regardless of `is_required`; separate mutually exclusive or optional leaves cannot express alternatives. Defer branching requirements that need unsupported alternative groups. See `references/payloads.md` for the row contract.

Write every public field (titles, intros, descriptions, marker and task text, quiz explanations) in the house voice: `.agents/skills/bloxodes-voice/SKILL.md`. Intros and descriptions can have personality. Marker labels, task titles, quiz questions and catalog cells stay plain and exact.

Read [payloads](references/payloads.md) for the page type being created. Write a reviewed JSON payload with the matching groups. Store content and data together; do not use workspace files at runtime. Keep stable IDs on updates. Do not overwrite another game's rows or move page ownership during ordinary edits.

## GitHub verification and publication

Prepare the exact reviewed payload in a committed selected batch or immutable private bundle. Dispatch `Managed content QA` on GitHub with its reviewed production source SHA. Development validation, application, build and browser checks run there. Do not start local previews or run checks locally.

Checklist updates must include the page's stable UUID and its complete retained task inventory. Preserve existing task UUIDs and keys. The publisher checks the actual target before writing. QA stages a unique temporary board, compares every reviewed page/task field and publisher default, and tests desktop/mobile ticks, reload, unticking and account saving. A successful hash-bound receipt is required before production publication. See `dev-docs/operations/deployment.md#managed-development-content-qa`.

Review GitHub screenshots and reports for the exact page, metadata and layout. Request page-specific GitHub checks for map controls, quiz behavior or custom catalog logic as needed. Production publication stays separate and requires explicit authorization through the selected-content workflow. It applies only the selected rows and never copies user progress.

Use `GameContentPage` for a plain title, intro, body, description and sources. `GameCatalog` is the default table body; a special catalog requires a code change to supply its own React body and bind it to its route. Never put executable code in database rows. `GameMap` provides image pins. `GameQuizPage` uses the existing quiz player. Shared checklists use the existing neutral checklist template and progress API.

Return the exact page paths and GitHub verification/artifact links. Keep work in development unless production publication was explicitly authorized. Do not use Roblox universe IDs for any of these rows.
