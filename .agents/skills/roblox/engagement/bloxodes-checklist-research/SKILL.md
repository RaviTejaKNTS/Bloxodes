---
name: bloxodes-checklist-research
description: Research one approved Bloxodes 100% completion checklist before writing. Verify coverage, full completion requirements, scope, sections and source proof. Record explicit user exceptions. Do not write final.json.
---

# Bloxodes Checklist Research

Use this for one approved checklist idea. Research only. Do not write `final.json`.

Follow `dev-docs/pipelines/content.md#standalone-checklist-scope`. Normally research one standalone source-verified 100% completion checklist per game, with its supported edition or mode stated and sections inside one board. Reuse the game's existing checklist. Additional pages or preparation lists, beginner milestones and routines need an explicit user exception. Collectible trackers and achievement rosters do not establish in-game 100%.

## Output

Write:

```text
tmp/content-workspace/<game-slug>/checklists/<checklist-slug>/brief.md
```

## Research

1. Resolve the exact game and universe ID.
2. Check the game's published and draft Bloxodes checklists and related pages. Reuse its existing checklist; additional pages require an explicit user exception.
3. Verify the full completion requirements, thresholds, exclusions and alternative paths for the exact scope. Record sources and any explicit user exception. If the scope cannot be verified, return the gap without approving creation.
4. Split the verified requirements into sections and checkable tasks within one board. Plan interchangeable paths as one explicit `A or B` leaf, with each option's completion criteria in its description. All three-level leaves count toward progress regardless of `is_required`; do not plan separate mutually exclusive or optional leaves. Return a gap when branching requirements need unsupported alternative groups.
5. Skip generic advice, article-style how-tos, and tasks that players cannot mark complete.

## Brief Shape

```text
Evidence checked:
- Existing Bloxodes coverage:
- Source coverage:
- Player goal:
- Game/edition/mode completion scope:
- Full 100% requirements, thresholds and exclusions:
- Alternative paths and their single-leaf representation:
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
