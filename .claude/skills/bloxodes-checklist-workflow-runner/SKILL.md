---
name: bloxodes-checklist-workflow-runner
description: Run one approved Bloxodes checklist page with parent review. Use when the user asks to create or update a /checklists page with subagent research, checklist writing, local verification, and browser preview.
---

# Bloxodes Checklist Workflow Runner

Spawn one subagent (Agent tool, `subagent_type: general-purpose`) for one checklist. The same subagent researches the player route, waits for parent approval, then writes `final.json`. Continue the same subagent across gates with SendMessage so its context carries over.

## Subagent Handoff

When you spawn the subagent, set the role and exact skill in the prompt:

- You are the subagent for one checklist only.
- Do not invoke the `bloxodes-checklist-workflow-runner` skill.
- Do not spawn or call other subagents.
- Invoke the `bloxodes-checklist-research` skill (Skill tool).
- Return `brief.md` only and stop for parent approval.

After the parent approves the brief, continue the same subagent with SendMessage:

- Invoke the `bloxodes-checklist-writing` skill.
- Create `final.json` for the approved brief only.

## Workflow

1. Confirm the game, universe ID, and checklist idea.
2. Ask the subagent to use the `bloxodes-checklist-research` skill and return `brief.md`.
3. Review the route, sections, existing coverage, source proof, and gaps.
4. Ask the same subagent to use the `bloxodes-checklist-writing` skill and create `final.json`.
5. Review that tasks are concrete actions players can complete.
6. Start or reuse localhost with `npm run dev:managed`.
7. Run:

```bash
npm run verify:engagement-finals -- --base-url http://localhost:<port> --file <final.json>
```

8. If the verifier passes, open the verified `/checklists/<slug>` link in the browser preview (Claude-in-Chrome MCP, or the Preview MCP).
9. Return paths, localhost link, blocked reason if any, and remaining risks.

## Parent Checks

- production overlap is checked
- checklist tracks a real player route, not generic advice
- parent rows and leaf tasks have consistent section codes
- task titles are concrete actions
- descriptions add useful context only when needed
- public copy reads in the Bloxodes house voice: simple English, calm playful gamer-buddy, light wit on real facts, no hype words or AI filler
- verifier and browser preview pass
