# Wiki Page Todo

Status: not started
Updated: YYYY-MM-DD
Workspace: `tmp/content-workspace/<game-slug>/wiki/`

## Use With

- Skill: `bloxodes-wiki-writing`
- Core docs: `agents/content/page-types/wiki-pages.md`, `agents/content/research-policy.md`
- Final gate: `agents/content/final-edit.md`

## Setup

- [ ] Confirm game slug, universe ID, place ID, creator, official Roblox URL, and existing `wiki_pages` row.
- [ ] Copy this file as `todo.md` before writing or updating `research-notes.md`.
- [ ] Map rendered wiki sections to source fields: `wiki_pages`, linked `roblox_universes`, and related page tables.
- [ ] Check related codes, events, catalogs, tools, articles, checklist, quiz, media, badges, passes, and universe metadata.
- [ ] Pull useful context from game discovery notes if they exist.
- [ ] Confirm catalog-led discovery or core catalog data exists, or mark the wiki as early/limited instead of guessing systems.

## Research

- [ ] Explain the core game loop in `research-notes.md` before implementation notes.
- [ ] Verify current Roblox metadata and any unstable game/update/event facts.
- [ ] Decide whether `roblox_universes.game_description_md` needs to be written or updated for the visible game summary.
- [ ] Research accurate controls, record verification notes, and write `controls_json`.
- [ ] Note related page gaps without rewriting catalog `wiki_md` inside the wiki workflow.
- [ ] Do not hard-code current code names, active counts, live event status, event dates, or temporary reward timelines.
- [ ] Decide what the wiki should skip because related sections already render it.

## Write

- [ ] Write `final.json` in the `wiki_pages` shape.
- [ ] Write or update the companion game description when the rendered summary needs it.
- [ ] Keep `tips_md` short, specific, and practical.
- [ ] Write verified `controls_json`; if controls cannot be verified, mark the wiki blocked instead of complete.

## Verify

- [ ] Run final edit.
- [ ] Import or preview locally when applicable.
- [ ] Read back local `wiki_pages` and linked `roblox_universes` rows after import or seed.
- [ ] Verify `/wiki/<slug>` renders the title, metadata, game summary, tips, controls, related sections, and images when applicable.
