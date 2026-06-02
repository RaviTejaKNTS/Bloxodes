---
name: bloxodes-checklist-writing
description: Write, review, or seed Bloxodes checklist pages backed by checklist_pages and checklist_items. Use for /checklists pages, checklist metadata, section_code planning, interactive task boards, local Supabase checklist imports, and checklist workflows that need practical Roblox progression tasks.
---

# Bloxodes Checklist Writing

## Start Here

Read:

- `agents/content/writing-core.md`
- `agents/content/research-policy.md`
- `agents/content/page-types/checklists.md`
- `agents/content/final-edit.md`

If these files have not been read in the current task, read them before writing or importing a checklist.

Create or update the game-first workspace before writing:

```text
tmp/content-workspace/<game-slug>/checklist/
  todo.md
  research-notes.md
  final.json
```

Copy `agents/content/todo-templates/checklist.md` into the folder as `todo.md` and update it as work progresses.

## What This Skill Is For

Use this when the page is an interactive progress board under `/checklists/<slug>`. A checklist is not an article and it is not a full item database. It helps a player track real tasks while playing: first-session setup, major systems, important collection goals, route checks, boss clears, shop/service visits, and final completion audits.

Bloxodes normally creates one combined checklist per game unless the user explicitly asks for multiple. For a game-specific checklist, use the game slug as the checklist slug. Example: `wizard-alchemy`, not `wizard-alchemy-checklist`. Do not use `roblox_universes.slug` as the checklist slug; universe slugs belong to `/stats/games/*` and may include universe IDs.

For new game coverage, prefer writing the checklist after core catalog data or catalog-led discovery has identified the real systems, unlocks, item collections, routes, and repeatable goals. Do not turn vague page-discovery guesses into checkable tasks.

## Required Shape

Checklist pages are stored in two tables:

```json
{
  "checklist_pages": {
    "universe_id": null,
    "slug": "",
    "title": "",
    "seo_title": null,
    "seo_description": "",
    "description_md": "",
    "is_public": true
  },
  "checklist_items": [
    {
      "section_code": "1",
      "title": "",
      "description": "",
      "is_required": false
    },
    {
      "section_code": "1.1",
      "title": "",
      "description": null,
      "is_required": false
    },
    {
      "section_code": "1.1.1",
      "title": "",
      "description": "",
      "is_required": true
    }
  ]
}
```

The `section_code` controls rendering:

- `1`, `2`, `3` are parent section rows.
- `1.1`, `1.2` are subsection label rows.
- `1.1.1`, `1.1.2` are real checkable task rows.

Only leaf rows count toward progress. Parent and subsection rows should label the board and explain why that group matters.

## Workflow

Research the game like a player. Explain the game loop, progression systems, item collections, repeatable routes, confusing terms, and what a player would naturally want to track. Inspect existing Bloxodes checklist pages and the current `checklist_pages_view` / `checklist_items` rows before choosing the new structure.

Then write `final.json` with:

- the `checklist_pages` row
- the full `checklist_items` array
- a summary with total rows, leaf task count, parent count, subsection count, and important data sources

Seed local Supabase first. Read back `checklist_pages_view`, confirm `item_count` and `leaf_item_count`, then preview `/checklists/<slug>` and `/checklists`.

## Writing Guidance

Keep the style closer to The Forge and 99 Nights in the Forest than Blox Fruits. The best checklist tasks are short, direct, and playable.

Good:

- `Find Roger's Equipment Shop`
- `Brew Wind Blade Potion`
- `Open the Traveler's Tent Chest`
- `Build one Sea of Oblivion farming loop`

Weak:

- `Understand every possible system deeply`
- `Master Wizard Alchemy`
- `Learn about materials`
- `Explore everything`

Task descriptions can explain why the task matters, but keep them compact. The player should be able to scan the board while playing.

## Size And Depth

For most games, aim for about 130-190 leaf tasks. Larger checklists are allowed only when the game has a real completionist market and the rows remain useful. Avoid turning every minor fact into a checkbox.

Use item-level tasks when item completion matters, such as potions, chests, enemies, important locations, races, or equipment. Use grouped tasks when item-level tracking would become noisy or unstable.

## Hard Rules

- Do not store Markdown bullets in `title`.
- Do not use vague mega tasks when a player needs a concrete action.
- Do not leave `seo_description` empty for new checklists.
- Do not skip `description_md`; the index card and detail intro need real context.
- Do not manually create code rows or code dates from a checklist.
- Do not promise exact "all current" coverage in evergreen prose when a game is actively updating.
- Do not mark the work complete until the local DB readback and rendered route are verified.

## Final Checks

Before calling a checklist ready:

- `final.json` is valid.
- The slug is the game slug.
- The slug is not `roblox_universes.slug`.
- The title is spelled correctly.
- Parent rows have useful descriptions.
- Leaf tasks are actions a player can check off.
- Leaf task count is in the planned range or intentionally justified.
- There are no leading bullets, duplicate section/title pairs, empty titles, or obvious generic tasks.
- `checklist_pages_view` reports the expected `item_count` and `leaf_item_count`.
- `/checklists/<slug>` renders with the correct title and progress count.
- `/checklists` shows the card with the correct task total.
- `/sitemaps/checklists.xml` includes the route when published.
