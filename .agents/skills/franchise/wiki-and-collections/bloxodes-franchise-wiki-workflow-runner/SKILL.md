---
name: bloxodes-franchise-wiki-workflow-runner
description: Run one or many approved non-Roblox franchise wiki hubs through research, parent review, writing, managed-development verification, and Browser review. In T3 Code each stage goes to its assigned model (Luna for suggestions, research and editorial review; Haiku 5.5 for research review and writing). Never publish production.
---

# Bloxodes Franchise Wiki Workflow Runner

You're the parent for one wiki hub. One subagent researches the game, waits for your approval, then writes `final.json`. You're done when the hub passes GitHub QA and you've returned the paths and run links, or the real failure.

You own the judgment: approve the research, review the copy, and review GitHub verification and rendered screenshots.

**In T3 Code** (you have the `delegate_task` tool and the owner runs the hub here), follow the "Franchise wiki hubs" stage table in `.agents/skills/bloxodes-model-routing/SKILL.md` instead of the subagent handoff below. Luna researches and does the editorial review. Haiku 5.5 reviews the research and writes. Outside T3 Code, follow the handoff below.

**Before you start:** read `bloxodes-docs/content/franchise.md` (identity, routes, tables and the rules every franchise page follows) and `bloxodes-docs/content/page-standards.md` (titles, headings, depth, images and layout). Public copy and writer briefs follow `.agents/skills/bloxodes-voice/SKILL.md`.

## Subagent handoff

Every message to the subagent sets its role and the exact skill.

First handoff:

- You are the subagent for one wiki hub only.
- Do not run `/bloxodes-franchise-wiki-workflow-runner`.
- Do not create or call other subagents.
- Start with `/bloxodes-franchise-wiki-research`.
- Skill file: `.agents/skills/bloxodes-franchise-wiki-research/SKILL.md`.
- Return `brief.md` only and wait for parent approval.

After you approve the brief, send the same subagent:

- Continue with `/bloxodes-franchise-wiki-writing`.
- Skill file: `.agents/skills/bloxodes-franchise-wiki-writing/SKILL.md`.
- Voice guide: `.agents/skills/bloxodes-voice/SKILL.md`, plus the "Wiki hubs" section of `.agents/skills/bloxodes-voice/references/examples.md`.
- Create `game.json` and `final.json` for the approved brief only.

## Workspace

```text
tmp/content-workspace/<namespace>/<game-slug>/wiki/<game-slug>/
  brief.md
  game.json
  final.json
```

Keep any supplied workspace override. The identity, hub and their media must be ready before dependent collections are staged.

## Workflow

1. If no title is approved, use `bloxodes-franchise-wiki-suggestions` and get the parent's title allowlist before research. Confirm the game, namespace, registry UUID, kind, parent, editorial slug and edition/platform/mode scope.
2. Ask the subagent to use `/bloxodes-franchise-wiki-research` and return `brief.md`.
3. Review identity, existing coverage, game loop, controls proof, related pages and gaps.
4. Send feedback or approve the research.
5. Ask the same subagent to use `/bloxodes-franchise-wiki-writing` and create `final.json`.
6. Review `final.json` for accuracy, voice, controls, tips, metadata and related-page assumptions (see the checks below).
7. Keep the approved final and source proof in the ignored workspace. Prepare the exact selected `franchise-wiki` batch with its namespace or immutable private bundle. Don't start a local preview or run checks locally.
8. Run `Managed content QA` on GitHub to stage that exact hub in development, build its preview and capture desktop and mobile screenshots. Review headings, canonical/metadata, images and controls in the reports. A source review doesn't mean browser QA passed.
9. Return paths and the successful GitHub run and artifact links, or the actual QA failure.

This runner stops before production. Separate production publication needs explicit authorization and the selected-content workflow's matching development QA receipt. Installed builders may return authoring-ready artifacts and a durable publication request. GitHub then owns technical QA.

## Parent checks

Facts and data:

- The exact production hub and registry identity were checked for overlap. Related page families were checked where they give useful writing context.
- Game identity and campaign/online/expansion/edition/platform/release scope are exact.
- Both required hub images are present, credited and rendered. Missing images block publication.
- Root and child hubs use the same layout and sections as Roblox hubs. No forced franchise theme or future-page promises.
- Controls are verified or omitted. `controls_json` is `[]` when unknown, and non-empty rows include `action` plus only device keys with verified values.
- GitHub publisher and rendered checks pass.

Copy, checked against `.agents/skills/bloxodes-voice/SKILL.md`:

- **Answer first.** The opening tells a player what the game is and how it plays, not what the wiki will cover.
- `description_md` is short, link-free and focused on the game loop. The core loop is easy to understand.
- **Player voice.** Simple English, a calm and playful gamer-buddy tone, light wit only on real facts. No hype words or AI filler.
- **No templates or research voice.** No stock openings, no "reportedly" or "sources say," no mention of workflow, sources, databases or page usage.
- **No repeats.** Each fact has one home across description, tips and FAQs.
- **Tips are concrete and useful,** like "Buy the Iron Rod before any boat upgrade," not "Upgrading is important."
- **Complete, not just clean.** Tips name real buildings, items, prices or unlocks with a reason, and the description names the actual systems. If the brief lacks those specifics, send it back for research. Short and vague is a fail.
- **Headings** say what's under them in words a player would search.
