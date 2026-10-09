---
name: bloxodes-wiki-research
description: Research one approved Bloxodes wiki hub before writing. Use for game identity, production overlap, source proof, core game loop, controls, related Bloxodes pages, facts to use, facts to avoid, and open gaps. Do not write final.json.
---

# Bloxodes Wiki Research

You're researching one approved Roblox game wiki hub so a writer can explain the game well. You're done when `brief.md` proves the game's identity, explains how the game plays, and lists what's solid, what to skip and what's still missing.

This is research only. Don't write `final.json`.

## Output

Write one file:

```text
tmp/content-workspace/<game-slug>/wiki/<game-slug>/brief.md
```

## Research steps

1. **Pin down the exact game:** universe ID, root place ID, creator, official URL and editorial slug.
2. **Check production for overlap.** Look at the exact production wiki route and the matching universe/slug for an existing or conflicting wiki. Look at other Bloxodes page families only when they give useful writing context. Don't turn a broad cross-family inventory into a readiness gate.
3. **Learn how the game plays:** the normal player loop, main systems, progression, controls, and which related pages should be linked.
4. **Verify controls** from reliable sources. If you can't, record that controls should stay empty.
5. **Keep the wiki about the game.** Don't turn catalog facts into a wiki rewrite. The wiki explains the game. It doesn't duplicate item lists.

## Writing the brief for the writer

The writer turns your brief into public copy, so give them good material. Read `.agents/skills/bloxodes-voice/SKILL.md` first so you know what the page should sound like.

- **Write facts in player language.** "Sell fish at Harbor Camp before you leave. The outer docks pay less" is ready to use. "Economic differential observed between vendor locations" isn't.
- **Name the reader's real question.** What does someone searching this game want to know first? How does it play, what to do early, what trips new players up?
- **Flag hooks worth using.** A surprising true fact, a common early mistake, the moment the game opens up. One or two is plenty.
- **Keep doubts and sources private.** Put source quality, conflicts and uncertainty in the evidence notes, not in the facts the writer will copy. If a fact is shaky, say so once, plainly, next to it.
- **Leave research jargon out of reader-facing lines.** No "reportedly," "community-documented" or "sources say" in `Facts to use` or `Tips to include`.

## Brief shape

```text
Evidence checked:
- Game identity:
- Existing Bloxodes coverage:
- Source coverage:
- Controls proof:
- Related pages:

Wiki plan:
- Title:
- Reader's real question:
- Core loop:
- Tips to include:
- Hooks worth using:
- Facts to use:
- Facts to avoid:
- Open gaps or risks:
```

If identity, controls or source proof is weak, say exactly what's missing.
