---
name: bloxodes-games-reference-pages
description: Create or update an approved non-Roblox map, standalone checklist, quiz or catalog using shared tables, plain templates and managed-development verification.
---

# Shared game reference pages

Read the approved game plan and `dev-docs/pipelines/content.md`. Resolve the registry game UUID, namespace, page slug and scope. Roblox stays on its own workflows and tables. Existing GTA maps keep their registered engines.

Research the exact page and save source proof in an ignored `brief.md`. Verify the facts and any roster before preparing data. Maps need artwork attribution and actual coordinates. Quiz answers need sources. Checklist objectives must describe actions a player can complete. Catalog fields must fit the specific reference.

For standalone checklists, follow `dev-docs/pipelines/content.md#standalone-checklist-scope`. Normally create only verified 100% completion checklists. Record the exact game, edition or mode, full requirements, exclusions and alternatives. Keep one board per detail page, with sections inside it. Defer an unverified completion scope; preparation lists, beginner milestones and routines require an explicit user exception in the plan and brief. Preserve collectible collection trackers without claiming they establish in-game 100%.

Read [payloads](references/payloads.md) for the page type being created. Write a reviewed JSON payload with the matching groups. Store content and data together; do not use workspace files at runtime. Keep stable IDs on updates. Do not overwrite another game's rows or move page ownership during ordinary edits.

Use `npm run publish:game-pages -- --namespace <slug> --file <reviewed.json>` for full database validation and rollback. Add `--apply` for authorized managed-development publication. The batch either commits every group or rolls every group back. Checklist page rows precede their task rows within that transaction. An update retains tasks omitted from the batch; removing tasks requires an explicit reviewed cleanup.

Start a managed-development preview. Verify the exact page, its section directory, metadata, JSON-LD, sitemap, search, feed and cache refresh. Check map search, category selection, pins and zoom; quiz answers, result and saved history; checklist ticks, reload and account saving; catalog columns, row data and mobile overflow. Check hidden games, unpublished pages and cross-game progress rejection.

Use `GameContentPage` for a plain title, intro, body, description and sources. `GameCatalog` is the default table body; a special catalog requires a code change to supply its own React body and bind it to its route. Never put executable code in database rows. `GameMap` provides image pins. `GameQuizPage` uses the existing quiz player. Shared checklists use the existing neutral checklist template and progress API.

Return the exact preview URLs and verification result. Keep work in development unless production publication was explicitly authorized. Do not use Roblox universe IDs for any of these rows.
