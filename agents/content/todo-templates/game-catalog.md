# Game Catalog Page Todo

Status: not started
Updated: YYYY-MM-DD
Workspace: `tmp/content-workspace/<game-slug>/catalogs/<collection-slug>/`

## Use With

- Skill: `bloxodes-game-catalog-writing`
- Core docs: `agents/content/page-types/game-catalog-pages.md`, `agents/wiki-catalog-workflow.md`
- Rewrite/edit: `agents/content/flow-pass.md`, `agents/content/final-edit.md`

## Setup

- [ ] Confirm game slug, universe ID, collection slug, stable code, route, and existing `wiki_catalog_pages` row.
- [ ] Copy this file as `todo.md` before writing or updating `research-notes.md`.
- [ ] Confirm this is a durable in-game item collection, UGC exception, or stable row-level system, not a temporary reward track or platform metadata.
- [ ] Inspect `data/<Game>/`, route/config support, existing local images, and renderer behavior.
- [ ] Check whether discovery notes already ranked this catalog or named blockers.

## Research And Data

- [ ] Explain what the collection does in the game and how players get/use/compare it.
- [ ] Complete player-usefulness gate: primary player task, decisions supported, and what the reader can do after reading.
- [ ] Complete required fact matrix: reader need, required facts, source status, local data/card status, and public placement.
- [ ] Complete competitor/source usefulness check when SEO or traffic potential matters.
- [ ] Audit local count, source count, rendered count, title count, image count, and missing image count.
- [ ] List missing, extra, renamed, duplicate, stale, unclear, raw, poorly shaped rows, and missing player-useful facts.
- [ ] Mark data action: `ready as-is`, `needs dataset update`, `needs image update`, or `blocked`.
- [ ] Stop if the route would render the wrong grouping, raw fields, or broken image paths.
- [ ] Stop if source-backed required facts are missing from local data/cards and have not been fixed or explicitly accepted.

## Approval Gate

- [ ] Propose visible title, matching `seo_title`, exact title promise, and required coverage.
- [ ] Propose how every required fact will be answered in cards, tables, `description_md`, `how_it_works_md`, FAQ, or route changes.
- [ ] Propose strongest grouping axis and why it fits the game.
- [ ] Propose card fields, raw fields to hide, `description_json` keys, and whole-page `description_md` plan.
- [ ] Get explicit user confirmation before final copy, dataset updates, or Supabase updates.

## Write And Verify

- [ ] Complete approved dataset/image updates before final copy.
- [ ] Write `final.json` with catalog fields and `wiki_md`.
- [ ] Run FLOW pass and record it in `research-notes.md`.
- [ ] Run final edit.
- [ ] Verify local import/readback and rendered route counts, sections, fields, images, intro, descriptions, FAQs, and wiki hub blurb.
