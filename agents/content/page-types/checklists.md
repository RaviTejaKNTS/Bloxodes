# Checklist Pages

Use this guide for Bloxodes checklist pages at `/checklists/<slug>` backed by `checklist_pages` and `checklist_items`.

A checklist page is an interactive progress board. It should help a player keep track while playing, not read like a long guide. The writing should be practical, compact, and grounded in real actions the player can complete.

## Purpose

A good checklist turns a game into a clear route:

- learn the first session basics
- understand the main systems
- collect or unlock the important things
- clear enemies, bosses, shops, services, or map routes
- revisit repeatable maintenance tasks
- run a final completion audit

Bloxodes normally creates one combined checklist per game. Split a game into multiple checklist pages only when the user explicitly asks or when the game is large enough that one board would become unusable.

For new game coverage, checklist planning should usually wait until catalog-led discovery or core catalog data has identified the real systems, item collections, unlock routes, maps, bosses, shops, and repeatable goals. Do not turn surface-level discovery guesses into a checklist.

## Database Fields

Write in this shape:

```json
{
  "page": {
    "universe_id": 10006104044,
    "slug": "wizard-alchemy",
    "title": "Wizard Alchemy Checklist",
    "seo_title": null,
    "seo_description": "",
    "description_md": "",
    "is_public": true
  },
  "items": [
    {
      "section_code": "1",
      "title": "First Session And Core Setup",
      "description": "Parent section description.",
      "is_required": false
    },
    {
      "section_code": "1.1",
      "title": "Basic game start",
      "description": null,
      "is_required": false
    },
    {
      "section_code": "1.1.1",
      "title": "Load into the game and find the starter village",
      "description": "Short reason this task matters.",
      "is_required": true
    }
  ]
}
```

## Section Code Contract

The renderer uses `section_code` depth to decide how a row appears:

- `1`, `2`, `3`: parent section rows. These become major board groups and progress bars.
- `1.1`, `1.2`: subsection labels inside a parent.
- `1.1.1`, `1.1.2`: checkable task rows. These count toward progress.

The DB normalizes `section_code`, so write clean numeric codes from the start. Do not rely on text sorting to create a good order after import. Be careful with `10.2.1` style rows because lexical previews may show `10` before `2`; the renderer parses numeric parts for grouping, but readback samples can look surprising.

## Page Fields

- `slug`: game slug only, such as `wizard-alchemy`.
- `title`: usually `<Game> Checklist`.
- `seo_title`: usually `null` unless there is a clear SEO reason.
- `seo_description`: concise card/meta summary. Do not leave this empty.
- `description_md`: short player-facing intro that explains how to use the board and what route it tracks.
- `universe_id`: set this when the checklist belongs to a game hub.

## Item Fields

- Parent titles should name real game systems, routes, or completion phases.
- Parent descriptions should explain why the section matters.
- Subsection titles should be short labels.
- Leaf task titles should be concrete actions.
- Leaf descriptions should be optional, compact, and useful.
- `is_required` should be `true` for leaf tasks and `false` for parent/subsection rows.

Do not put Markdown bullets in `title`. The UI already renders rows as checklist items.

## Recommended Size

For normal game checklists, target about 130-190 leaf tasks. This range is deep enough to feel useful without becoming a full database dump.

Use more tasks only when the game has a real completionist surface and the tasks still help a player. Use fewer tasks when the game is small, event-limited, or does not have many repeatable systems.

## Research Pattern

Create or update:

```text
tmp/content-workspace/<game-slug>/checklist/
  todo.md
  research-notes.md
  final.json
```

Copy `agents/content/todo-templates/checklist.md` into the folder as `todo.md` before research starts.

Research should answer:

- What does the player do in the first session?
- Which systems unlock or matter later?
- Which item collections deserve item-level tasks?
- Which tasks should be grouped instead of repeated for every item?
- Which routes, NPCs, shops, enemies, bosses, locations, or reward systems should be tracked?
- Which maintenance tasks help after updates or normal play sessions?
- What should the final audit prove?

Inspect existing checklist rows before writing. Use cleaner pages such as The Forge, Jailbreak, and 99 Nights in the Forest as style models. Avoid copying older checklist issues such as missing metadata, leading `-` in titles, or oversized task dumps.

## Good Task Style

Good tasks are actions:

- `Brew Wind Blade Potion`
- `Open the Traveler's Tent Chest`
- `Talk to Roger`
- `Defeat Lava Behemoth`
- `Build one Sea of Oblivion farming loop`

Weak tasks are vague:

- `Learn potions`
- `Understand races`
- `Explore the whole map`
- `Master the game`

If the task is too broad, split it into a smaller action or move the explanation into a parent description.

## Local Import And Preview

Always seed local Supabase first.

After import, verify:

- `checklist_pages_view.slug`
- `title`
- `item_count`
- `leaf_item_count`
- `/checklists/<slug>` returns 200
- `/checklists` shows the card and correct progress total
- `/sitemaps/checklists.xml` includes the route when `is_public` is true

Do not call a checklist finished from JSON alone.
