---
name: bloxodes-checklist-research
description: Research one approved Bloxodes 100% completion checklist before writing. Verify coverage, full completion requirements, scope, sections and source proof. Record explicit user exceptions. Do not write final.json.
---

# Bloxodes Checklist Research

You're researching one approved checklist so the writer can build a board players can actually tick through to 100%. You hand back a `brief.md`. You don't write `final.json`.

## Scope

Follow `dev-docs/pipelines/content.md#standalone-checklist-scope`.

- Normally, each game gets one standalone, source-verified 100% completion checklist. State the supported edition or mode, and put sections inside one board.
- Reuse the game's existing checklist.
- Additional pages, preparation lists, beginner milestones and routines need an explicit user exception.
- Collectible trackers and achievement rosters don't establish in-game 100%.

## Output

```text
tmp/content-workspace/<game-slug>/checklists/<checklist-slug>/brief.md
```

## Research steps

1. Resolve the exact game and universe ID.
2. Check the game's published and draft Bloxodes checklists and related pages. Reuse its existing checklist. Additional pages need an explicit user exception.
3. Verify the full completion requirements, thresholds, exclusions and alternative paths for the exact scope. Record sources and any explicit user exception. If you can't verify the scope, return the gap. Don't approve creation.
4. Split the verified requirements into sections and checkable tasks within one board.
   - Plan interchangeable paths as one explicit `A or B` leaf, with each option's completion criteria in its description.
   - All three-level leaves count toward progress, whatever their `is_required` value. So don't plan separate mutually exclusive or optional leaves.
   - If branching requirements would need unsupported alternative groups, return a gap.
5. Skip generic advice, article-style how-tos and tasks players can't mark complete.

## Writing the brief for the writer

Task titles end up on the page almost word for word, so write them the way a player would. Read `.agents/skills/bloxodes-voice/SKILL.md` first.

- **Plain player language.** "Beat the Frost Warden on Hard," not "Boss encounter completion (Hard difficulty)."
- **Name the player's real goal** in `Player goal`: what does finishing the game mean to them?
- **Hooks worth using:** the requirement most players miss, the task that takes longest, the order that saves time. Put these in the plan so the short intro has something real to say.
- **Keep sources and doubts private.** They go under `Evidence checked` or `Open gaps or risks`. If a threshold is shaky, say so once in plain words so the writer can add one short note or leave it out.
- **No research jargon in task wording.** Words like source, requirement set or leaf stay in your notes.
- Tasks stay plain and exact. Save personality for the short intro.

## Brief shape

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
- Hooks worth using:
- Open gaps or risks:
```
