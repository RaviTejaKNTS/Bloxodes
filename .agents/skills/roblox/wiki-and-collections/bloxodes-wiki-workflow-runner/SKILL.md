---
name: bloxodes-wiki-workflow-runner
description: Run one approved Bloxodes wiki hub with parent review. In T3 Code each stage goes to its assigned model (Luna for research and editorial review; Haiku 5.5 for research review and writing). Use when the user asks to create or update a /wiki/<game-slug> page with subagent research, wiki writing, GitHub verification and browser reports.
---

# Bloxodes Wiki Workflow Runner

You're the parent for one wiki hub. One subagent researches the game, waits for your approval, then writes `final.json`. You're done when the hub passes GitHub QA and you've returned the paths and run links, or the real failure.

You own the judgment: approve the research, review the copy, and review GitHub verification and rendered screenshots.

**In T3 Code** (you have the `delegate_task` tool and the owner runs the hub here), follow the "Wiki hub flow" in `.agents/skills/bloxodes-game-collection-workflow-runner/references/t3-model-routing.md` instead of the subagent handoff below. Luna researches and does the editorial review. Haiku 5.5 reviews the research and writes. Outside T3 Code, follow the handoff below.

## Subagent handoff

Every message to the subagent sets its role and the exact skill.

First handoff:

- You are the subagent for one wiki hub only.
- Do not run `/bloxodes-wiki-workflow-runner`.
- Do not create or call other subagents.
- Start with `/bloxodes-wiki-research`.
- Skill file: `.agents/skills/bloxodes-wiki-research/SKILL.md`.
- Return `brief.md` only and wait for parent approval.

After you approve the brief, send the same subagent:

- Continue with `/bloxodes-wiki-writing`.
- Skill file: `.agents/skills/bloxodes-wiki-writing/SKILL.md`.
- Voice guide: `.agents/skills/bloxodes-voice/SKILL.md`, plus the "Wiki hubs" section of `.agents/skills/bloxodes-voice/references/examples.md`.
- Create `final.json` for the approved brief only.

## Workspace

```text
tmp/content-workspace/<game-slug>/wiki/<game-slug>/
  brief.md
  final.json
```

## Workflow

1. Confirm the game, universe ID and editorial slug.
2. Ask the subagent to use `/bloxodes-wiki-research` and return `brief.md`.
3. Review identity, existing coverage, game loop, controls proof, related pages and gaps.
4. Send feedback or approve the research.
5. Ask the same subagent to use `/bloxodes-wiki-writing` and create `final.json`.
6. Review `final.json` for accuracy, voice, controls, tips, metadata and related-page assumptions (see the checks below).
7. Put the approved hub in the game's `roblox-wiki@1` bundle as `wiki/final.json` (see `contracts/roblox-wiki/v1/README.md`). Leave `cover_image` null; the publisher copies the official thumbnail to R2.
8. Dry run with `npm run content:publish -- <abs-bundle> --only hub` and fix what it flags. With the go-ahead, stage with `--target managed-dev --apply`.
9. Return the bundle path and the publish report, or the actual failure.

Production needs explicit authorization: `--target production --apply --allow-prod` from a clean checkout at the live SHA. See `bloxodes-docs/content/roblox-wiki.md#publishing`. For browser screenshots, selected Roblox QA on GitHub still works.

## Parent checks

Facts and data:

- Production coverage was checked for wiki, codes, catalogs, events, tools, articles, checklists and quizzes.
- Game identity is exact.
- Controls are verified or omitted. `controls_json` is `[]` when unknown, and non-empty rows include `action` plus only device keys with verified values.
- The `content:publish` dry run passes. A dry run isn't browser QA; don't claim screenshots you don't have.

Copy, checked against `.agents/skills/bloxodes-voice/SKILL.md`:

- **Answer first.** The opening tells a player what the game is and how it plays, not what the wiki will cover.
- `description_md` is short, link-free and focused on the game loop. The core loop is easy to understand.
- **Player voice.** Simple English, a calm and playful gamer-buddy tone, light wit only on real facts. No hype words or AI filler.
- **No templates or research voice.** No stock openings, no "reportedly" or "sources say," no mention of workflow, sources, databases or page usage.
- **No repeats.** Each fact has one home across description, tips and FAQs.
- **Tips are concrete and useful,** like "Buy the Iron Rod before any boat upgrade," not "Upgrading is important."
- **Complete, not just clean.** Tips name real buildings, items, prices or unlocks with a reason, and the description names the actual systems. If the brief lacks those specifics, send it back for research. Short and vague is a fail.
- **Headings** say what's under them in words a player would search.
