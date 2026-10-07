---
name: bloxodes-checklist-research
description: Research one approved Bloxodes 100% completion checklist before writing. Verify coverage, full completion requirements, scope, sections and source proof. Record explicit user exceptions. Do not write final.json.
---

# Bloxodes Checklist Research

Use this for one approved checklist idea. Research only. Do not write `final.json`.

Follow `dev-docs/pipelines/content.md#standalone-checklist-scope`. Normally research source-verified 100% completion for the exact game and edition or mode. Each detail page contains one board with sections. Preparation lists, beginner milestones and routines need an explicit user exception. Collectible trackers and achievement rosters do not establish in-game 100%.

## Output

Write:

```text
tmp/content-workspace/<game-slug>/checklists/<checklist-slug>/brief.md
```

## Research

1. Resolve the exact game and universe ID.
2. Check existing Bloxodes checklist and related pages for overlap.
3. Verify the full completion requirements, thresholds, exclusions and alternative paths for the exact scope. Record sources and any explicit user exception. If the scope cannot be verified, return the gap without approving creation.
4. Split the verified requirements into sections and checkable tasks within one board. Keep mutually exclusive alternatives achievable through a valid path.
5. Skip generic advice, article-style how-tos, and tasks that players cannot mark complete.

## Brief Shape

```text
Evidence checked:
- Existing Bloxodes coverage:
- Source coverage:
- Player goal:
- Game/edition/mode completion scope:
- Full 100% requirements, thresholds and exclusions:
- Alternative paths:
- Explicit user exception, if any:

Checklist plan:
- Title:
- Slug:
- Sections:
- One board and its required task set:
- Leaf task examples:
- Skipped tasks:
- Open gaps or risks:
```
