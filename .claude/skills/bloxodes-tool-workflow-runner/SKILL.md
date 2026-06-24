---
name: bloxodes-tool-workflow-runner
description: Run one approved Bloxodes tool page with parent review. Use when the user asks to create or update a /tools page with subagent requirements research, tool writing, local verification, and browser preview.
---

# Bloxodes Tool Workflow Runner

Spawn one subagent (Agent tool, `subagent_type: general-purpose`) for one tool. The same subagent researches the tool job, waits for parent approval, then writes `final.json`. Continue the same subagent across gates with SendMessage so its context carries over.

## Subagent Handoff

When you spawn the subagent, set the role and exact skill in the prompt:

- You are the subagent for one tool page only.
- Do not invoke the `bloxodes-tool-workflow-runner` skill.
- Do not spawn or call other subagents.
- Invoke the `bloxodes-tool-research` skill (Skill tool).
- Return `brief.md` only and stop for parent approval.

After the parent approves the brief, continue the same subagent with SendMessage:

- Invoke the `bloxodes-tool-writing` skill.
- Create `final.json` for the approved brief only.

## Workflow

1. Confirm the tool idea, route code, inputs, outputs, and formula/data source.
2. Ask the subagent to use the `bloxodes-tool-research` skill and return `brief.md`.
3. Review whether this is a real interactive tool, not a static content page.
4. Ask the same subagent to use the `bloxodes-tool-writing` skill and create `final.json`.
5. Review formula assumptions, limits, metadata, copy, and JSON.
6. Start or reuse localhost with `npm run dev:local`.
7. Run:

```bash
npm run verify:simple-page-finals -- --base-url http://localhost:<port> --file <final.json>
```

8. If the verifier passes, open the verified `/tools/<code>` link in the browser preview (Claude-in-Chrome MCP, or the Preview MCP).
9. Return paths, localhost link, blocked reason if any, and remaining risks.
