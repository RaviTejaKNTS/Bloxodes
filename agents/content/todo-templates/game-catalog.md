# Game Catalog Page Todo

Status: not started
Updated: YYYY-MM-DD
Workspace: `tmp/content-workspace/<game-slug>/catalogs/<collection-slug>/`

## Use With

- Skill: `bloxodes-game-catalog-writing`
- Core docs: `agents/content/page-types/game-catalog-pages.md`, `agents/wiki-catalog-workflow.md`
- Rewrite/edit: `agents/content/flow-pass.md`, `agents/content/final-edit.md`

## Setup

- [ ] Confirm editorial game slug, universe ID, collection slug, stable code, route, and existing `wiki_catalog_pages` row.
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
- [ ] Reject weak image substitutions: raw Roblox API thumbnails, generic game icons, broad hero art, guide thumbnails, site-branded images, arrows/callouts, or screenshots where the row subject is not clear.
- [ ] If clean row images are not available, keep row image fields empty and record the missing image count instead of filling placeholders.

## Approval Gate

- [ ] Propose visible title, matching `seo_title`, exact title promise, and required coverage. For wiki catalog pages, use `All <N> <Item Or Collection> in <Game>: <real player SEO question>` unless notes justify a simpler title.
- [ ] Propose how every required fact will be answered in cards, tables, `description_md`, `how_it_works_md`, FAQ, or route changes.
- [ ] Propose strongest grouping axis and why it fits the game.
- [ ] Propose compact card shape using the production template: valid image if available, name/status, one short player-facing description, and usually 3-5 key-value facts.
- [ ] Propose raw/long/internal fields to hide, including source notes, verification state, API/source caveats, long descriptions, raw arrays, nested stats, and strategy paragraphs.
- [ ] Get explicit user confirmation before final copy, dataset updates, or Supabase updates.

## Write And Verify

- [ ] Complete approved dataset/image updates before final copy.
- [ ] Write `final.json` with catalog fields and `wiki_md`.
- [ ] Run FLOW pass and record it in `research-notes.md`.
- [ ] Run final edit.
- [ ] Confirm `description_md` headings are specific and communicative, not generic labels such as `How <collection> works`, `Overview`, `Value`, or `Source`.
- [ ] Confirm rendered cards follow the minimal card standard: no paragraphs, long move lists, raw caveats, full version history, or every available field in the default card.
- [ ] Confirm every rendered default card has a short description unless research notes explain why the collection is pure data.
- [ ] Confirm rendered card values do not expose research/process wording such as `source estimate`, `needs in-game check`, `verification`, `partial`, `source-conflicted`, `reported by`, `dataset`, or `API`.
- [ ] Confirm cards usually show 3-5 key-value facts; if more than 5 are visible, record why and prove the rendered card still scans cleanly.
- [ ] Confirm rendered cards use only one colored status signal and one visually emphasized primary decision field.
- [ ] Verify local import/readback and rendered route counts, sections, fields, images, intro, descriptions, FAQs, and wiki hub blurb.
