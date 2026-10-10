---
name: bloxodes-code-workflow-runner
description: Run one Bloxodes codes page setup with parent review. In T3 Code each stage goes to its assigned model (Luna for the source check and the source and evergreen review; Haiku 5.5 for payload writing). Use when the user asks to create or update /codes/<game-slug> page fields, source URLs, Roblox link, GitHub Managed content QA, and code refresh workflow without manually writing code rows.
---

# Bloxodes Code Workflow Runner

You set up one `/codes/<game-slug>` page with one subagent. Codes work differently from other pages: you write the page row, and the refresh script fills in the code rows.

**In T3 Code** (you have the `delegate_task` tool and the owner runs a codes page here), follow the "Codes" stage table in `.agents/skills/bloxodes-model-routing/SKILL.md` instead of the subagent handoff below. Luna checks the sources and reviews the payload against them and the evergreen rules. Haiku 5.5 writes the payload and the one revision. Code rows still come only from the refresh job. Outside T3 Code, the flow below applies.

## Never write code rows by hand

Don't manually add active codes, expired codes, rewards tied to code names, code dates or active-code counts. The refresh script owns all of that.

## Subagent handoff

Every message to the subagent sets its role and the exact skill:

- You are the subagent for one codes page only.
- Do not run `/bloxodes-code-workflow-runner`.
- Do not create or call other subagents.
- Use `/bloxodes-code-writing`.
- Skill file: `.agents/skills/bloxodes-code-writing/SKILL.md`.
- Read the voice guide first: `.agents/skills/bloxodes-voice/SKILL.md`.
- Return the approved payload for `upsert:code-page` only.

## Workflow

1. Confirm the game, the Roblox link and whether the game has a real code system.
2. Ask the subagent to use `/bloxodes-code-writing` and return the approved payload for `upsert:code-page`.
3. Review the payload:
   - Source URLs and slug are right.
   - The copy is evergreen. No active code names or current counts.
   - The copy reads right against `.agents/skills/bloxodes-voice/SKILL.md`: answer-first opening, player voice, no template openings, research voice, hype or filler, no fact said twice, headings that say what's under them, and plain, exact wording for steps like how to redeem.
4. Stage the reviewed payload in a selected batch under `content/releases/<batch>/` (operation kind `roblox-codes-page`), or use a reviewed immutable bundle. Don't run `upsert:code-page`, `refresh:codes` or a local preview yourself.
5. Run `Managed content QA` on GitHub with the exact committed batch or bundle, then review its screenshots and reports for `/codes/<game-slug>`. Code rows come from the scheduled `Daily Codes Refresh` job, not from this run.
6. Return the paths, the successful GitHub artifact links, any blocked reason and the remaining risks. Production publication needs explicit authorization.