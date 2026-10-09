---
name: bloxodes-code-workflow-runner
description: Run one Bloxodes codes page setup with parent review. Use when the user asks to create or update /codes/<game-slug> page fields, source URLs, Roblox link, local preview, and code refresh workflow without manually writing code rows.
---

# Bloxodes Code Workflow Runner

You set up one `/codes/<game-slug>` page with one subagent. Codes work differently from other pages: you write the page row, and the refresh script fills in the code rows.

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
4. Publish the page row and refresh codes:

   ```bash
   npm run upsert:code-page -- --file <payload.json> --publish
   npm run refresh:codes -- --slug <game-slug>
   ```

5. Start or reuse localhost with `npm run dev:managed`.
6. Open `/codes/<game-slug>` in the Codex Browser and check that the page renders.
7. Return the paths, the localhost link, the refresh status, any blocked reason and the remaining risks.
