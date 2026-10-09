---
name: bloxodes-tool-research
description: Research one approved Bloxodes tool page before writing. Use for production overlap, player input/output need, formula or data source, assumptions, limits, edge cases, related pages, and gaps. Do not write final.json.
---

# Bloxodes Tool Research

You're researching one approved tool idea so the writer and builder know exactly what the player puts in, what they get out and why the math holds up. You hand back a `brief.md`. You don't write `final.json`.

## Output

```text
tmp/content-workspace/<game-or-topic-slug>/tools/<tool-code>/brief.md
```

## What the brief includes

- existing Bloxodes tools and related pages
- the player job
- inputs
- outputs
- the formula or data source
- assumptions and limits
- edge cases
- why this should be a tool, not an article, catalog or wiki page
- open gaps or risks

## Writing the brief for the writer

Keep source and provenance details in `brief.md`. When the tool moves to writing, public fields talk about the game problem and the player's workflow, not about sources, datasets, rows or the research process. Read `.agents/skills/bloxodes-voice/SKILL.md` first.

- **Describe the player job in plain words.** "Figure out how many runs you need to max your pet," not "compute required iterations to reach level cap."
- **Name the reader's real question:** what decision does the tool help them make?
- **Hooks worth using:** a result that surprises players, like an upgrade that pays back slower than it looks.
- **Keep sources and doubts private.** If an assumption is shaky, say so once in plain words so the writer can add one short caveat next to the result it affects.
- **No research jargon in the player job, inputs or outputs.** Formula notes and data sources stay in their own lines.
- Input labels and result wording stay plain and exact.
