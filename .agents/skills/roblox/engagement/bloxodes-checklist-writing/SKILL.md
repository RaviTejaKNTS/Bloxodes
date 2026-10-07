---
name: bloxodes-checklist-writing
description: Write one Bloxodes 100% completion checklist final.json after brief approval. Use for one /checklists board, metadata, sections and verified completion tasks, with explicit user exceptions recorded.
---

# Bloxodes Checklist Writing

Use this after `bloxodes-checklist-research` and parent approval. Normally write only source-verified 100% completion checklists for the exact game and edition or mode. Follow `dev-docs/pipelines/content.md#standalone-checklist-scope`. Preparation lists, beginner milestones and routines need an explicit user exception in the brief.

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

## Voice & Tone

Bloxodes house voice: write like a player who knows the game well, telling a friend how it works. Calm, warm, and a little playful, never formal, corporate, or hyped.

- Simple English first. Short sentences, everyday words a younger player gets instantly. Explain any game term in plain words right where it appears.
- Do not use em dashes. Replace any em dash with a colon, comma, parentheses, or two short sentences. This applies to every output field: title, metadata, body, FAQ, and all JSON values.
- Playful, not loud. Drop in a light, dry touch of wit (roughly one per short paragraph) and always wrap it around a real fact, like "protection that overstays its welcome." The fact leads; the wit rides along. Never force a joke, stack puns, or let a quip hide the info.
- Gamer-buddy warmth. Talk to the player as "you," use real in-game nouns, and sound like someone who actually plays, not a manual.
- Spark from rhythm, not adjectives. Energy comes from concrete detail, a strong first line, and varied sentence length, not from words like *ultimate, insane, amazing, epic, must-have, game-changer*. Ban those.
- Open on the real thing: the item, mechanic, or answer. No "In this game…", "This collection…", "Welcome to…", or mood-setting warm-ups.
- Read the room. Keep the wit lighter, or drop it, when the reader is stressed: error fixes, "won't open", crashes, anything troubleshooting. Help first.
- Keep functional slots clean. Steps, task items, table cells, quiz questions, and input labels stay plain and direct. Let the playful voice live in intros, descriptions, and blurbs.
- No filler or AI tics. Cut "Additionally", "Furthermore", "It's important to note", and "not just… but". Every sentence earns its place.

## Writing Rules

- Tasks should be actions a player can mark complete.
- Normally write one standalone checklist page per game and reuse its existing checklist. Additional pages need an explicit user exception. Sections divide the single board's verified completion requirements.
- Cover the full required set. Encode interchangeable paths as one required leaf with an explicit `A or B` title; describe each verified option and when either complete path satisfies that task. Do not split mutually exclusive choices into separate leaves.
- Every three-level leaf counts toward board progress, even with `is_required: false`. Put optional tips in descriptions rather than checkable rows. Defer branching requirements that cannot fit an accurate single leaf until reviewed alternative-group support exists.
- Do not write around unresolved completion requirements or relabel an achievement roster as in-game 100%.
- Describe the board percentage as checked-task progress unless sources verify its relationship to the in-game meter.
- Keep task titles short.
- Use descriptions only when the task needs context.
- Do not create vague tasks like `Learn the game` or `Get better`.
- Avoid generic Roblox advice that does not belong to the game.

## Field Jobs

- `page.universe_id`: Link the checklist to the exact game universe.
- `page.slug`: Use the editorial game slug.
- `page.title`: Normally use `<Game> 100% completion checklist`. Name the edition or mode when needed. A narrower scope requires an explicit user exception in the brief.
- `page.seo_title`: Keep null or close to the title unless search needs custom text.
- `page.seo_description`: Summarize the route or completion path the board tracks.
- `page.description_md`: Briefly explain what progress the checklist helps players track. Do not turn it into a guide.
- `section_code`: Use numeric depth: parent sections, subsections, then checkable tasks.
- `title`: For parents, name a real phase or system. For leaf tasks, write a concrete action.
- `description`: Add context only when it helps the player complete or understand the task.
- `is_required`: Use `true` for checkable leaf tasks, including a single `A or B` task, and `false` for parent or subsection rows. This flag does not remove a leaf from the board's percentage.

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
