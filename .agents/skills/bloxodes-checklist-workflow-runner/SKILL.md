---
name: bloxodes-checklist-workflow-runner
description: Run one approved Bloxodes checklist page with parent review. Use when the user asks to create or update a /checklists page with subagent research, checklist writing, local verification, and Codex Browser preview.
---

# Bloxodes Checklist Workflow Runner

Use one subagent for one checklist. The same subagent researches the player route, waits for parent approval, then writes `final.json`.

## Subagent Handoff

Every subagent message must set the role and exact skill:

- You are the subagent for one checklist only.
- Do not run `/bloxodes-checklist-workflow-runner`.
- Do not create or call other subagents.
- Start with `/bloxodes-checklist-research`.
- Skill file: `.agents/skills/bloxodes-checklist-research/SKILL.md`.
- Return `brief.md` only and wait for parent approval.

After the parent approves the brief, send the same subagent:

- Continue with `/bloxodes-checklist-writing`.
- Skill file: `.agents/skills/bloxodes-checklist-writing/SKILL.md`.
- Create `final.json` for the approved brief only.

## Workflow

1. Confirm the game, universe ID, and checklist idea.
2. Ask the subagent to use `/bloxodes-checklist-research` and return `brief.md`.
3. Review the route, sections, existing coverage, source proof, and gaps.
4. Ask the same subagent to use `/bloxodes-checklist-writing` and create `final.json`.
5. Review that tasks are concrete actions players can complete.
6. Start or reuse localhost with `npm run dev:local`.
7. Run:

```bash
npm run verify:engagement-finals -- --base-url http://localhost:<port> --file <final.json>
```

8. If the verifier passes, open the verified `/checklists/<slug>` link in the Codex Browser.
9. Return paths, localhost link, blocked reason if any, and remaining risks.

## Parent Checks

- production overlap is checked
- checklist tracks a real player route, not generic advice
- parent rows and leaf tasks have consistent section codes
- task titles are concrete actions
- descriptions add useful context only when needed
- verifier and Browser preview pass
