---
name: bloxodes-franchise-wiki-research
description: Research one approved non-Roblox franchise game wiki hub before writing. Use for title identity, scope, source proof, core loop, controls, related pages, and risks; write brief.md only.
---

# Bloxodes Franchise Wiki Research

You're researching one approved non-Roblox game wiki hub so a writer can explain the game well. You're done when `brief.md` proves the game's identity, explains how the game plays, and lists what's solid, what to skip and what's still missing.

This is research only. Don't write `final.json`.

**Before you start:** read `bloxodes-docs/content/franchise.md` (identity, routes, tables and the rules every franchise page follows) and `bloxodes-docs/content/page-standards.md` (titles, headings, depth, images and layout). Public copy and writer briefs follow `.agents/skills/bloxodes-voice/SKILL.md`.

## Output

Write one file, keeping any supplied workspace override:

```text
tmp/content-workspace/<namespace>/<game-slug>/wiki/<game-slug>/brief.md
```

## Research steps

1. **Pin down the exact game:** namespace, registry game UUID, title kind, parent title, developer, publisher, official URL, release state, platforms and editorial slug.
2. **Check production for overlap.** Look at the exact production wiki route and the matching namespace/game UUID/slug for an existing or conflicting wiki. Look at other Bloxodes page families only when they give useful writing context. Don't turn a broad cross-family inventory into a readiness gate.
3. **Learn how the game plays:** the normal player loop, main systems, progression, controls, and which related pages should be linked.
   - Don't stop at the official game description. Use reputable guide sources (the game's wiki, Beebom, TechWiser and similar) for concrete facts, the same way collection research does.
   - Collect the specifics a writer needs to sound like a player: names of key buildings, items or currencies, early prices, what unlocks what, and the early mistakes players make. Tips need real names and numbers, so gather at least four tip-worthy facts.
   - Only leave a fact out when it's wrong or unsupported. "Not on the official page" isn't a reason to ban it.
   - When sources disagree on a price, unlock or number, keep every value with its source in the evidence notes and give the writer the better-supported value or a range ("400 to 600 Coins"). Never drop a tip-worthy fact just because sources differ.
4. **Verify controls** from reliable sources for the exact platform, edition and mode. If you can't, record that controls should stay empty. Never infer bindings from another title or release generation.
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
- Namespace, game UUID, kind and parent:
- Campaign/online/expansion/edition/platform scope:
- Release state, version-sensitive facts and spoiler boundary:
- Cover, square thumbnail, source URLs and credits:
- Identity fields for game.json: developer, publisher, official URL, release status/dates and platforms:

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

For an unreleased title, use only announced publisher/developer facts. Keep rumors, leaks and trailer inference out of the brief's usable facts. Related links must exist or be explicitly approved; public copy never promises future pages.
