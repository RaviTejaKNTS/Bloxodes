---
name: bloxodes-checklist-writing
description: Write one Bloxodes 100% completion checklist final.json after brief approval. Use for one /checklists board, metadata, sections and verified completion tasks, with explicit user exceptions recorded.
---

# Bloxodes Checklist Writing

A checklist is a player's map to 100%. The tasks have to be exact and checkable, and the short page description should make the grind feel doable. Normally you only write source-verified 100% completion checklists for the exact game and edition or mode.

Use this after `bloxodes-checklist-research` and parent approval. Follow `dev-docs/pipelines/content.md#standalone-checklist-scope`. Preparation lists, beginner milestones and routines need an explicit user exception in the brief.

## Read first

- The voice guide: `.agents/skills/bloxodes-voice/SKILL.md`, plus the "Checklists" section of its `references/examples.md`.
- The approved `brief.md`.

## Workflow

1. Read the approved brief.
2. Create or update:

   ```text
   tmp/content-workspace/<game-slug>/checklists/<checklist-slug>/
     brief.md
     final.json
   ```

3. Write the page metadata and task rows in `final.json`.
4. Parse the JSON and check that section codes are consistent.

## Where the voice goes

- **`description_md` gets a little personality.** Say what 100% means in this game and set up the run. "Ember Isles 100% means every vault, every rod and every island quest. It's a long haul, so tick things off as you go."
- **Task titles are plain actions.** "Craft the Ember Compass," not "Make sure you complete the important task of obtaining the Ember Compass."
- **Descriptions only when they help.** A location, a requirement or the one thing people miss.
- **Never narrate how the page was made.** Follow Public Copy in root `AGENTS.md`. Game terms like Research or Source Cargo are fine.

## Task rules

- Every task is an action a player can mark complete.
- Normally write one standalone checklist page per game and reuse its existing checklist. Extra pages need an explicit user exception. Sections split the single board's verified completion requirements.
- Cover the full required set. When there are interchangeable paths, write one required leaf with an explicit `A or B` title, describe each verified option and say when either complete path counts. Never split mutually exclusive choices into separate leaves.
- Every three-level leaf counts toward board progress, even with `is_required: false`. Put optional tips in descriptions, not in checkable rows. Defer branching requirements that can't fit an accurate single leaf until reviewed alternative-group support exists.
- Never write around unresolved completion requirements or relabel an achievement roster as in-game 100%.
- Describe the board percentage as checked-task progress unless sources verify how it relates to the in-game meter.
- Keep task titles short.
- No vague tasks like `Learn the game` or `Get better`.
- No generic Roblox advice that doesn't belong to this game.

## Field jobs

- `page.universe_id`: the exact game universe.
- `page.slug`: the editorial game slug.
- `page.title`: normally `<Game> 100% completion checklist`. Name the edition or mode when needed. A narrower scope needs an explicit user exception in the brief.
- `page.seo_title`: null or close to the title unless search needs custom text.
- `page.seo_description`: the route or completion path the board tracks, with a reason to use it.
- `page.description_md`: a short note on what progress the checklist tracks. Not a guide.
- `section_code`: numeric depth: parent sections, then subsections, then checkable tasks.
- `title`: parents name a real phase or system. Leaf tasks are concrete actions.
- `description`: context only when it helps the player complete or understand the task.
- `is_required`: `true` for checkable leaf tasks, including a single `A or B` task, and `false` for parent or subsection rows. This flag doesn't remove a leaf from the board's percentage.

## Output shape

```json
{
  "page": {
    "universe_id": 0,
    "slug": "",
    "title": "",
    "seo_title": "",
    "seo_description": "",
    "description_md": "",
    "is_public": true
  },
  "items": [
    {
      "section_code": "",
      "title": "",
      "description": null,
      "is_required": true
    }
  ]
}
```
