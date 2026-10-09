---
name: bloxodes-quiz-research
description: Research one approved Bloxodes quiz before writing. Use for production overlap, game identity, source-backed facts, topic coverage, easy/medium/hard difficulty plan, facts to avoid, and quiz gaps. Do not write final.json.
---

# Bloxodes Quiz Research

You're researching one approved quiz so the writer has a pool of solid, stable facts to build fair questions from. You hand back a `brief.md`. You don't write `final.json`.

## Output

```text
tmp/content-workspace/<game-slug>/quizzes/<quiz-code>/brief.md
```

## Research steps

1. Resolve the exact game and universe ID.
2. Check existing Bloxodes quizzes and related pages for overlap.
3. Gather stable facts players can learn from the game or reliable sources.
4. Split facts into easy, medium and hard, but only if the game has enough depth.
5. Avoid exact dates, current events, rumors, code names and temporary claims, unless the quiz is explicitly about stable history.

## Writing the brief for the writer

Read `.agents/skills/bloxodes-voice/SKILL.md` first.

- **Write each fact as one plain, exact statement** a player would recognize: "The Iron Rod costs 500 Coins at the harbor shop." The writer turns these into questions, so each one needs a single clear answer.
- **Questions stay plain and exact.** No jokes, hedges or trick wording in the fact pool. Personality belongs in the quiz intro only.
- **Name what the player is testing:** how well they know the early game, the bosses, the lore?
- **Hooks worth using:** a surprising true fact most players get wrong. These make great medium and hard questions.
- **Keep sources and doubts private.** They go under `Evidence checked` or `Open gaps or risks`. If a fact is shaky, move it to `Facts to avoid` instead of hedging it.
- **No research jargon in the fact pool.** Words like source coverage or provenance stay in your evidence notes.

## Brief shape

```text
Evidence checked:
- Existing Bloxodes coverage:
- Source coverage:
- Stable fact pool:

Quiz plan:
- Title:
- Code:
- Easy topics:
- Medium topics:
- Hard topics:
- Facts to avoid:
- Hooks worth using:
- Open gaps or risks:
```
