---
name: bloxodes-engagement-suggestions
description: Suggest Bloxodes codes, checklist, quiz, and event page opportunities for one Roblox game. Use when the user asks whether a game should have codes, checklists, quizzes, events, or non-catalog page coverage.
---

# Bloxodes Engagement Suggestions

Use this to decide whether Bloxodes should create codes, checklist, quiz, or event pages for one Roblox game. Do not write the pages here.

## Start

1. Resolve the exact game: name, universe ID, root place ID, creator, official Roblox URL, and editorial slug.
2. Check existing Bloxodes `code_pages`, `checklist_pages`, `quiz_pages`, `events_pages`, and related routes for that universe/topic.

## Source Check

Do not hide the research in a file. Put the proof in the final reply:

```text
Evidence checked:
- Existing Bloxodes coverage:
- Codes sources:
- 100% completion requirements and sources:
- Stable quiz fact sources:
- Event sources:
```

If a line is not checked, use `[research incomplete]` for that page family.

## Page Rules

- Codes: recommend only when the game has a real code system and usable code sources. Do not list active codes in suggestions.
- Checklists: normally recommend only source-verified 100% completion for the exact game and edition or mode. Verify the full required activity set and check existing coverage. Each detail page has one board with sections. Defer an unknown completion scope; beginner, preparation and routine lists need an explicit user exception. Follow `dev-docs/pipelines/content.md#standalone-checklist-scope`. Collectible collection trackers remain separate and do not establish in-game 100%.
- Quizzes: recommend only when there are enough stable, source-backed facts for easy, medium, and hard questions.
- Events: recommend only when there is a source-backed Roblox virtual event, official event hub, or clear current/upcoming/past event page value.

Skip gamepasses, badges, developer products, servers, raw Roblox media, thin trivia, and generic beginner tasks.

## Output

Start with `Evidence checked`, then return one section for each family: codes, checklist, quiz, events.

Use these labels:

- `[create]` page family is useful and source-backed
- `[we already have a page]` production already covers it
- `[skip]` weak, unsupported, duplicate, or not useful
- `[research incomplete]` required checks were not completed

Keep the answer short. Include the reason and the source proof for each decision.
