# Checklist Page Todo

Status: not started
Updated: YYYY-MM-DD
Workspace: `tmp/content-workspace/<game-slug>/checklist/`

## Use With

- Skill: `bloxodes-checklist-writing`
- Core docs: `agents/content/page-types/checklists.md`, `agents/content/research-policy.md`
- Final gate: `agents/content/final-edit.md`

## Setup

- [ ] Confirm editorial game slug, universe ID, existing checklist page/items, and related wiki/catalog/data pages.
- [ ] Copy this file as `todo.md` before writing or updating `research-notes.md`.
- [ ] Check production DB or public production URLs first for an existing checklist or related page that already covers this game progress path.
- [ ] Use the editorial game slug for the checklist slug, not `roblox_universes.slug`.
- [ ] Confirm catalog-led discovery or core data exists, or mark any missing system knowledge before drafting tasks.
- [ ] Inspect cleaner existing checklist examples before choosing structure.

## Research And Structure

- [ ] Explain the game loop, progression systems, unlocks, collections, routes, bosses, shops, and repeatable goals.
- [ ] Choose parent sections, subsections, and concrete leaf task style.
- [ ] Plan target leaf count or justify a smaller/larger board.
- [ ] Decide which collections deserve item-level tasks and which should stay grouped.

## Write

- [ ] Write `final.json` with `checklist_pages` fields and full `checklist_items`.
- [ ] Keep parent/subsection rows non-checkable and leaf rows checkable.
- [ ] Use clean numeric `section_code` values.
- [ ] Remove vague, duplicate, empty, or leading-bullet task titles.
- [ ] Keep tasks durable; do not include active code names, live event status tasks, or short-lived reward-track tasks.

## Verify

- [ ] Validate row counts, parent count, subsection count, and leaf task count.
- [ ] Import locally and read back `checklist_pages_view`.
- [ ] Preview `/checklists/<slug>`, `/checklists`, and sitemap coverage when public.
