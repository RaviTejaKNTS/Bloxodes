---
name: bloxodes-checklist-writing
description: Write one Bloxodes checklist final.json after brief approval. Use for /checklists pages, metadata, section_code planning, checklist_items, and practical Roblox progression tasks.
---

# Bloxodes Checklist Writing

Use this after `bloxodes-checklist-research` and parent approval. Checklists help players complete a progression path, prep path, collection route, or repeatable in-game routine.

## Workflow

1. Read the approved `brief.md`.
2. Create or update:

```text
tmp/content-workspace/<game-slug>/checklists/<checklist-slug>/
  brief.md
  final.json
```

3. Write checklist page metadata and task rows in `final.json`.
4. Parse JSON and validate that section codes are consistent.

## Writing Rules

- Tasks should be actions a player can mark complete.
- Keep task titles short.
- Use descriptions only when the task needs context.
- Do not create vague tasks like `Learn the game` or `Get better`.
- Avoid generic Roblox advice that does not belong to the game.

## Field Jobs

- `page.universe_id`: Link the checklist to the exact game universe.
- `page.slug`: Use the editorial game slug.
- `page.title`: Use the simple pattern `<Game> Checklist` unless the checklist has a narrower route.
- `page.seo_title`: Keep null or close to the title unless search needs custom text.
- `page.seo_description`: Summarize the route or completion path the board tracks.
- `page.description_md`: Briefly explain what progress the checklist helps players track. Do not turn it into a guide.
- `section_code`: Use numeric depth: parent sections, subsections, then checkable tasks.
- `title`: For parents, name a real phase or system. For leaf tasks, write a concrete action.
- `description`: Add context only when it helps the player complete or understand the task.
- `is_required`: Use `true` for checkable leaf tasks and `false` for parent or subsection rows.

## Output Shape

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
