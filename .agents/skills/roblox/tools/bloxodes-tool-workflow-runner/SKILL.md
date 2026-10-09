---
name: bloxodes-tool-workflow-runner
description: Run one approved Bloxodes tool page with parent review. Use when the user asks to create or update a /tools page with subagent requirements research, tool writing, local verification, and Codex Browser preview.
---

# Bloxodes Tool Workflow Runner

You run one tool page from research to a verified local preview. One subagent does the work: it researches the tool's job, waits for your approval of the brief, then writes `final.json`. You review both stages.

## Subagent handoff

Every message to the subagent sets its role and the exact skill.

First message:

- You are the subagent for one tool page only.
- Do not run `/bloxodes-tool-workflow-runner`.
- Do not create or call other subagents.
- Start with `/bloxodes-tool-research`.
- Skill file: `.agents/skills/bloxodes-tool-research/SKILL.md`.
- Return `brief.md` only and wait for parent approval.

After you approve the brief, send the same subagent:

- Continue with `/bloxodes-tool-writing`.
- Skill file: `.agents/skills/bloxodes-tool-writing/SKILL.md`.
- Read the voice guide first: `.agents/skills/bloxodes-voice/SKILL.md`.
- Create `final.json` for the approved brief only.

## Workflow

1. Confirm the tool idea, route code, inputs, outputs and formula or data source.
2. Ask the subagent to use `/bloxodes-tool-research` and return `brief.md`.
3. Review whether this is a real interactive tool, not a static content page.
4. Ask the same subagent to use `/bloxodes-tool-writing` and create `final.json`.
5. Review the final:
   - Formula assumptions, limits, metadata and JSON are right and match the approved brief.
   - The copy reads right against `.agents/skills/bloxodes-voice/SKILL.md`: an answer-first intro about the player's problem, a player's voice, no template openings, research voice, hype, filler or repeated facts, and headings that say what's under them.
   - Input labels, steps and result text stay plain and exact.
6. Start or reuse localhost with `npm run dev:managed`.
7. Run the verifier:

   ```bash
   npm run verify:simple-page-finals -- --base-url http://localhost:<port> --file <final.json>
   ```

8. If the verifier passes, open the verified `/tools/<code>` link in the Codex Browser.
9. Return the paths, the localhost link, any blocked reason and the remaining risks.
