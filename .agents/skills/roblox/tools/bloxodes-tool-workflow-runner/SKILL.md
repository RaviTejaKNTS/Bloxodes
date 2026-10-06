---
name: bloxodes-tool-workflow-runner
description: Run one approved Bloxodes tool page with parent review. Use when the user asks to create or update a /tools page with subagent requirements research, tool writing, local verification, and Codex Browser preview.
---

# Bloxodes Tool Workflow Runner

Use one subagent for one tool. The same subagent researches the tool job, waits for parent approval, then writes `final.json`.

## Subagent Handoff

Every subagent message must set the role and exact skill:

- You are the subagent for one tool page only.
- Do not run `/bloxodes-tool-workflow-runner`.
- Do not create or call other subagents.
- Start with `/bloxodes-tool-research`.
- Skill file: `.agents/skills/bloxodes-tool-research/SKILL.md`.
- Return `brief.md` only and wait for parent approval.

After the parent approves the brief, send the same subagent:

- Continue with `/bloxodes-tool-writing`.
- Skill file: `.agents/skills/bloxodes-tool-writing/SKILL.md`.
- Create `final.json` for the approved brief only.

## Workflow

1. Confirm the tool idea, route code, inputs, outputs, and formula/data source.
2. Ask the subagent to use `/bloxodes-tool-research` and return `brief.md`.
3. Review whether this is a real interactive tool, not a static content page.
4. Ask the same subagent to use `/bloxodes-tool-writing` and create `final.json`.
5. Review formula assumptions, limits, metadata, copy, and JSON.
6. Start or reuse localhost with `npm run dev:managed`.
7. Run:

```bash
npm run verify:simple-page-finals -- --base-url http://localhost:<port> --file <final.json>
```

8. If the verifier passes, open the verified `/tools/<code>` link in the Codex Browser.
9. Return paths, localhost link, blocked reason if any, and remaining risks.
