---
name: bloxodes-quiz-workflow-runner
description: Run one approved Bloxodes quiz page with parent review. Use when the user asks to create or update a /quizzes page with subagent research, question design, local verification, and browser preview.
---

# Bloxodes Quiz Workflow Runner

Spawn one subagent (Agent tool, `subagent_type: general-purpose`) for one quiz. The same subagent researches the game facts, waits for parent approval, then writes `final.json`. Continue the same subagent across gates with SendMessage so its context carries over.

## Subagent Handoff

When you spawn the subagent, set the role and exact skill in the prompt:

- You are the subagent for one quiz only.
- Do not invoke the `bloxodes-quiz-workflow-runner` skill.
- Do not spawn or call other subagents.
- Invoke the `bloxodes-quiz-research` skill (Skill tool).
- Return `brief.md` only and stop for parent approval.

After the parent approves the brief, continue the same subagent with SendMessage:

- Invoke the `bloxodes-quiz-writing` skill.
- Create `final.json` for the approved brief only.

## Workflow

1. Confirm the game, universe ID, and quiz idea.
2. Ask the subagent to use the `bloxodes-quiz-research` skill and return `brief.md`.
3. Review source proof, topic coverage, difficulty plan, and facts to avoid.
4. Ask the same subagent to use the `bloxodes-quiz-writing` skill and create `final.json`.
5. Review that questions are fair, stable, and useful.
6. Start or reuse localhost with `npm run dev:local`.
7. Run:

```bash
npm run verify:engagement-finals -- --base-url http://localhost:<port> --file <final.json>
```

8. If the verifier passes, open the verified `/quizzes/<code>` link in the browser preview (Claude-in-Chrome MCP, or the Preview MCP).
9. Return paths, localhost link, blocked reason if any, and remaining risks.

## Parent Checks

- existing quiz coverage is checked
- questions are stable and source-backed
- wrong answers are plausible and similar in specificity
- no answer is given away by option length
- explanations teach the fact briefly
- verifier and browser preview pass
