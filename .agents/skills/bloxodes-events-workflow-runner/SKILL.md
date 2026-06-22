---
name: bloxodes-events-workflow-runner
description: Run one approved Bloxodes events page with parent review. Use when the user asks to create or update /events/<game-slug> evergreen page copy with source verification, local verification, and Codex Browser preview.
---

# Bloxodes Events Workflow Runner

Use one subagent for one events page. The same subagent researches the event source path, waits for parent approval, then writes `final.json`.

## Subagent Handoff

Every subagent message must set the role and exact skill:

- You are the subagent for one events page only.
- Do not run `/bloxodes-events-workflow-runner`.
- Do not create or call other subagents.
- Start with `/bloxodes-events-research`.
- Skill file: `.agents/skills/bloxodes-events-research/SKILL.md`.
- Return `brief.md` only and wait for parent approval.

After the parent approves the brief, send the same subagent:

- Continue with `/bloxodes-events-writing`.
- Skill file: `.agents/skills/bloxodes-events-writing/SKILL.md`.
- Create `final.json` for the approved brief only.

## Workflow

1. Confirm the game and universe ID.
2. Ask the subagent to use `/bloxodes-events-research` and return `brief.md`.
3. Review whether the event data source is good enough. Do not approve manual timeline rows.
4. Ask the same subagent to use `/bloxodes-events-writing` and create evergreen `final.json`.
5. Review for stale dates, current-event claims, and invented timeline facts.
6. Start or reuse localhost with `npm run dev:local`.
7. Run:

```bash
npm run verify:simple-page-finals -- --base-url http://localhost:<port> --file <final.json>
```

8. If the verifier passes, open the verified `/events/<slug>` link in the Codex Browser.
9. Return paths, localhost link, blocked reason if any, and remaining risks.
