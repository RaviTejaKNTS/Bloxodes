---
name: bloxodes-events-workflow-runner
description: Run one approved Bloxodes events page with parent review. Use when the user asks to create or update /events/<game-slug> evergreen page copy with source verification, local verification, and browser preview.
---

# Bloxodes Events Workflow Runner

Spawn one subagent (Agent tool, `subagent_type: general-purpose`) for one events page. The same subagent researches the event source path, waits for parent approval, then writes `final.json`. Continue the same subagent across gates with SendMessage so its context carries over.

## Subagent Handoff

When you spawn the subagent, set the role and exact skill in the prompt:

- You are the subagent for one events page only.
- Do not invoke the `bloxodes-events-workflow-runner` skill.
- Do not spawn or call other subagents.
- Invoke the `bloxodes-events-research` skill (Skill tool).
- Return `brief.md` only and stop for parent approval.

After the parent approves the brief, continue the same subagent with SendMessage:

- Invoke the `bloxodes-events-writing` skill.
- Create `final.json` for the approved brief only.

## Workflow

1. Confirm the game and universe ID.
2. Ask the subagent to use the `bloxodes-events-research` skill and return `brief.md`.
3. Review whether the event data source is good enough. Do not approve manual timeline rows.
4. Ask the same subagent to use the `bloxodes-events-writing` skill and create evergreen `final.json`.
5. Review for stale dates, current-event claims, and invented timeline facts.
6. Start or reuse localhost with `npm run dev:managed`.
7. Run:

```bash
npm run verify:simple-page-finals -- --base-url http://localhost:<port> --file <final.json>
```

8. If the verifier passes, open the verified `/events/<slug>` link in the browser preview (Claude-in-Chrome MCP, or the Preview MCP).
9. Return paths, localhost link, blocked reason if any, and remaining risks.
