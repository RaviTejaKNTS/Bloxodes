# Catalog Page Todo

Status: not started
Updated: YYYY-MM-DD
Workspace: `tmp/content-workspace/<topic-or-game-slug>/catalogs/<catalog-code-or-collection-slug>/`

## Use With

- Skill: `bloxodes-catalog-writing`
- Core docs: `agents/content/page-types/catalog-pages.md`, `agents/content/research-policy.md`
- Rewrite/edit: `agents/content/flow-pass.md`, `agents/content/final-edit.md`

## Setup

- [ ] Confirm catalog code, page route, target table, existing row, and item data source.
- [ ] Copy this file as `todo.md` before writing or updating `research-notes.md`.
- [ ] Use the game-catalog template instead if this is a game dataset page under `/wiki/<game>/<collection>`.
- [ ] If game-specific, confirm the scope is a durable item collection or UGC exception, not a temporary reward track or platform metadata.
- [ ] Inspect route renderer behavior before promising sections or card fields.

## Research And Data

- [ ] Explain the collection in plain player language before implementation notes.
- [ ] Complete player-usefulness gate: primary reader task, decisions supported, and what the reader can do after reading.
- [ ] Complete required fact matrix: reader need, required facts, source status, local data/card status, and public placement.
- [ ] Complete competitor/source usefulness check when SEO or traffic potential matters.
- [ ] Audit item count, source count, rendered count, title count, and image coverage when item data exists.
- [ ] Record missing, duplicate, stale, unclear, raw, poorly shaped fields, and missing player-useful facts.
- [ ] Mark data action: `ready as-is`, `needs dataset update`, `needs image update`, or `blocked`.
- [ ] Stop if source data shows missing items or expected images that are not fixed or accepted.
- [ ] Stop if source-backed required facts are missing from local data/cards and have not been fixed or explicitly accepted.

## Approval Gate

- [ ] Propose visible title, `seo_title`, exact title promise, grouping axis, and weaker alternatives.
- [ ] Propose how every required fact will be answered in cards, tables, body copy, FAQs, or route changes.
- [ ] Propose card/table fields, raw fields to hide, `description_json` keys, and `description_md` role.
- [ ] Get explicit user confirmation before final copy or Supabase updates.

## Write And Verify

- [ ] Write `final.json` only after data and structure are ready.
- [ ] Run FLOW pass for body copy.
- [ ] Run final edit.
- [ ] Import locally and read back the saved row when applicable.
- [ ] Verify route renders approved sections, fields, counts, images, intro, descriptions, and FAQs.
